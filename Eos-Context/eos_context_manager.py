"""
Eos-Context: 文件上下文管理器
在模型调用前对 messages 做投影转换。
"""

import json
import copy
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path


def estimate_tokens(text: str) -> int:
    """估算文本的 token 数量（简化计算：1 token ≈ 4 字符）"""
    return len(text) // 4


def estimate_message_tokens(msg: Dict[str, Any]) -> int:
    """估算单条消息的 token 数量"""
    tokens = 0
    # 角色和基本结构
    tokens += 10
    # 内容
    content = msg.get("content", "")
    if isinstance(content, str):
        tokens += estimate_tokens(content)
    # 工具调用
    tool_calls = msg.get("tool_calls", [])
    for tc in tool_calls:
        func = tc.get("function", {})
        tokens += estimate_tokens(func.get("name", ""))
        args_str = func.get("arguments", "{}")
        tokens += estimate_tokens(args_str)
    # 其他字段
    for key in ["reasoning_content", "tool_call_id", "tool_name"]:
        val = msg.get(key)
        if isinstance(val, str):
            tokens += estimate_tokens(val)
    return tokens


class FileContextManager:
    """文件上下文管理器"""

    def __init__(self):
        # 存储工具调用结果，用于上下文管理
        self._tool_calls: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def get_system_prompt_rules() -> str:
        """
        Return system prompt rules for context management.

        These rules tell the model how to handle retries and file state.
        """
        return """
## Context Management Rules

1. **Failed tool calls**: If a tool call fails, you MUST reference the failed call's ID when retrying. Example: "Retrying call_001 with corrected arguments."
2. **File state awareness**: After a file is modified (via eos_write_file or eos_edit_file), you will receive a file change notification. If you need the updated content, call eos_read_file again.
3. **Stale content**: Historical eos_read_file results may be marked as outdated. Do not rely on outdated content — re-read the file if needed.
4. **Chunked reads**: When reading a file in chunks, previous chunks are merged automatically. The merged view includes gap markers for unread sections.
"""

    def record_tool_call(
        self,
        call_id: str,
        tool_name: str,
        tool_args: dict,
        result: str,
        success: bool,
    ):
        """记录工具调用结果"""
        self._tool_calls[call_id] = {
            "tool": tool_name,
            "args": tool_args,
            "result": result,
            "success": success,
        }

    def process_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        处理 messages，生成 transformed messages。

        规则：
        1. eos_read_file：
           - 第一次读取：不做修改
           - 文件被改过再读：之前的读取记录标记为过期
           - 合并条件：两次调用间隔 token < 500，或最旧距最新间隔 < 轮次数*300+200
           - 只有未过期、未合并的 read_file 参与合并计算
        2. eos_write_file：
           - 省略 tool_call arguments 中的 content 字段
           - tool_result content 保持不变（包含完整文件内容）
           - 上下文中其他对此文件的 read/write/edit 的 tool_result content 标记为过期
        3. eos_edit_file：
           - 省略 tool_call arguments 中的 old_string 和 new_string 字段
           - tool_result content 保持不变（包含完整 diff）
        """
        transformed = copy.deepcopy(messages)

        # 跟踪每个文件的状态
        file_states = {}  # path -> { version, last_write_index, last_edit_index, read_segments }

        # 收集需要标记为过期的 tool_result 索引
        expired_results = {}  # tool_call_id -> "reason"

        # 记录已过期/已合并的 tool_call_id
        expired_or_merged_ids = set()

        # 计算每条消息的 token 累积位置
        message_tokens = []
        cumulative_tokens = 0
        for msg in transformed:
            tokens = estimate_message_tokens(msg)
            message_tokens.append(cumulative_tokens)
            cumulative_tokens += tokens

        # 第一遍：收集信息
        for i, msg in enumerate(transformed):
            if msg.get("role") != "assistant":
                continue

            tool_calls = msg.get("tool_calls", [])
            for tc in tool_calls:
                func = tc.get("function", {})
                tool_name = func.get("name", "")
                tool_call_id = tc.get("id", "")

                if tool_name not in ["eos_read_file", "eos_write_file", "eos_edit_file"]:
                    continue

                try:
                    args = json.loads(func.get("arguments", "{}"))
                except:
                    args = {}

                path = args.get("path", "")
                if not path:
                    continue

                # 查找对应的 tool result
                result_idx = None
                result_content = None
                for j in range(i + 1, len(transformed)):
                    if transformed[j].get("role") == "tool" and transformed[j].get("tool_call_id") == tool_call_id:
                        result_idx = j
                        result_content = transformed[j].get("content", "")
                        break

                if result_idx is None:
                    continue

                # 检查是否失败
                is_success = True
                try:
                    result_json = json.loads(result_content)
                    is_success = result_json.get("status") == "ok"
                except:
                    pass

                # 检查是否有 error_fix_id（无论成功还是失败）
                error_fix_id = args.get("error_fix_id")
                if error_fix_id:
                    # 查找失败的工具调用
                    for k, msg2 in enumerate(transformed):
                        if msg2.get("role") == "tool" and msg2.get("tool_call_id") == error_fix_id:
                            # 检查是否是同名工具
                            for l in range(k - 1, -1, -1):
                                if transformed[l].get("role") == "assistant":
                                    for tc2 in transformed[l].get("tool_calls", []):
                                        if tc2.get("id") == error_fix_id:
                                            if tc2.get("function", {}).get("name") == tool_name:
                                                # 标记失败的工具调用为已修正
                                                expired_results[error_fix_id] = "我在这里失败过，并已被后续调用修正"
                                                expired_or_merged_ids.add(error_fix_id)
                                            break
                                    break

                # 如果失败，不参与上下文管理
                if not is_success:
                    continue

                # 初始化文件状态
                if path not in file_states:
                    file_states[path] = {
                        "version": 0,
                        "last_write_index": -1,
                        "last_edit_index": -1,
                        "read_segments": []
                    }

                state = file_states[path]

                # 处理 eos_write_file
                if tool_name == "eos_write_file":
                    # 省略 content 字段
                    func["arguments"] = json.dumps({
                        "path": path,
                        "content_omitted": True
                    })

                    # 标记之前所有对此文件的 tool_result 为过期（不包括 write_file 自己）
                    for k, msg2 in enumerate(transformed):
                        if msg2.get("role") == "tool":
                            # 查找对应的 tool_call
                            tc_id = msg2.get("tool_call_id", "")
                            if tc_id == tool_call_id:
                                continue  # 跳过 write_file 自己的 tool_result
                            for l in range(k - 1, -1, -1):
                                if transformed[l].get("role") == "assistant":
                                    for tc2 in transformed[l].get("tool_calls", []):
                                        if tc2.get("id") == tc_id:
                                            try:
                                                args2 = json.loads(tc2.get("function", {}).get("arguments", "{}"))
                                            except:
                                                args2 = {}
                                            if args2.get("path") == path and tc2.get("function", {}).get("name") in ["eos_read_file", "eos_write_file", "eos_edit_file"]:
                                                expired_results[tc_id] = "文件内容已过期，请关注最新的文件内容"
                                                expired_or_merged_ids.add(tc_id)
                                            break
                                    break

                    # 更新文件状态
                    state["version"] += 1
                    state["last_write_index"] = result_idx
                    state["read_segments"] = []

                # 处理 eos_edit_file
                elif tool_name == "eos_edit_file":
                    # 省略 old_string 和 new_string 字段
                    new_args = {
                        "path": path,
                        "old_string_omitted": True,
                        "new_string_omitted": True
                    }
                    if "mode" in args:
                        new_args["mode"] = args["mode"]
                    if "replace_all" in args:
                        new_args["replace_all"] = args["replace_all"]
                    func["arguments"] = json.dumps(new_args)

                    # 更新文件状态
                    state["version"] += 1
                    state["last_edit_index"] = result_idx

                # 处理 eos_read_file
                elif tool_name == "eos_read_file":
                    # 检查是否需要标记之前的读取为过期
                    if state["last_write_index"] > 0 or state["last_edit_index"] > 0:
                        # 文件被改过，标记之前的读取为过期
                        for seg in state["read_segments"]:
                            if seg["tool_call_id"] not in expired_or_merged_ids:
                                expired_results[seg["tool_call_id"]] = "文件内容已过期，请关注最新的文件内容"
                                expired_or_merged_ids.add(seg["tool_call_id"])

                    # 过滤出未过期、未合并的 read_segment（真正还在生效的）
                    valid_segments = [
                        seg for seg in state["read_segments"]
                        if seg["tool_call_id"] not in expired_or_merged_ids
                    ]

                    # 计算当前 read_file 在消息序列中的 token 位置
                    current_token_pos = message_tokens[result_idx] if result_idx < len(message_tokens) else cumulative_tokens

                    # 检查是否可以合并
                    can_merge = False
                    if valid_segments:
                        # 最旧一次距最新一次的间隔
                        oldest_token_pos = valid_segments[0]["token_pos"]
                        span_tokens = current_token_pos - oldest_token_pos
                        read_count = len(valid_segments) + 1  # 包括当前这次
                        merge_threshold = read_count * 300 + 200

                        if span_tokens < merge_threshold:
                            # 检查相邻两次的间隔
                            for seg in valid_segments:
                                gap_tokens = abs(current_token_pos - seg["token_pos"])
                                if gap_tokens < 500:
                                    can_merge = True
                                    break

                    if can_merge:
                        # 标记旧的读取为已合并
                        for seg in valid_segments:
                            expired_results[seg["tool_call_id"]] = "已合并到后续 eos_read_file 输出"
                            expired_or_merged_ids.add(seg["tool_call_id"])

                    # 更新读取段
                    state["read_segments"].append({
                        "token_pos": current_token_pos,
                        "tool_call_id": tool_call_id,
                        "result_idx": result_idx
                    })

        # 第二遍：应用过期标记
        for i, msg in enumerate(transformed):
            if msg.get("role") == "tool":
                tc_id = msg.get("tool_call_id", "")
                if tc_id in expired_results:
                    msg["content"] = json.dumps({
                        "status": "ok",
                        "summary": expired_results[tc_id]
                    }, ensure_ascii=False)

        return transformed


def main():
    """命令行入口"""
    import argparse
    parser = argparse.ArgumentParser(description="Eos-Context: 文件上下文管理器")
    parser.add_argument("--input-messages", required=True, help="输入 messages JSON 文件路径")
    parser.add_argument("--output-messages", required=True, help="输出 messages JSON 文件路径")

    args = parser.parse_args()

    # 读取输入
    with open(args.input_messages, 'r', encoding='utf-8') as f:
        messages = json.load(f)

    # 处理
    manager = FileContextManager()
    transformed = manager.process_messages(messages)

    # 写入输出
    with open(args.output_messages, 'w', encoding='utf-8') as f:
        json.dump(transformed, f, indent=2, ensure_ascii=False)

    print(f"处理完成：{len(messages)} 条消息 -> {len(transformed)} 条消息")


if __name__ == "__main__":
    main()
