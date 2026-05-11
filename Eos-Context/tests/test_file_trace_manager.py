import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANAGER_PATH = ROOT / "file_trace_manager.py"
spec = importlib.util.spec_from_file_location("file_trace_manager", MANAGER_PATH)
manager = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = manager
spec.loader.exec_module(manager)


def tool_call(call_id, name, args):
    return {
        "role": "assistant",
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)},
            }
        ],
    }


def tool_result(call_id, payload):
    return {"role": "tool", "tool_call_id": call_id, "content": json.dumps(payload, ensure_ascii=False)}


class FileTraceManagerTests(unittest.TestCase):
    def test_trace_applies_edit_to_known_ranges_and_uses_current_line_numbers(self):
        lines = [f"line {i}" for i in range(1, 80)]
        read_1_40 = "\n".join(f"{i}|{lines[i-1]}" for i in range(1, 41))
        read_55_59 = "\n".join(f"{i}|{lines[i-1]}" for i in range(55, 60))
        old = "\n".join(lines[32:37])
        new = "new 33\nnew 34"
        messages = [
            tool_call("t0", "trace_file", {"path": "/tmp/example.py", "operation": "trace"}),
            tool_result("t0", {"status": "traced", "path": "/tmp/example.py"}),
            tool_call("t1", "read_file", {"path": "/tmp/example.py", "offset": 1, "limit": 40}),
            tool_result("t1", {"status": "ok", "path": "/tmp/example.py", "offset": 1, "limit": 40, "content": read_1_40, "total_lines": 79}),
            tool_call("t2", "read_file", {"path": "/tmp/example.py", "offset": 55, "limit": 5}),
            tool_result("t2", {"status": "ok", "path": "/tmp/example.py", "offset": 55, "limit": 5, "content": read_55_59, "total_lines": 79}),
            tool_call("t3", "edit_file", {"mode": "replace", "path": "/tmp/example.py", "old_string": old, "new_string": new, "trace_update": True}),
            tool_result("t3", {"status": "ok", "path": "/tmp/example.py", "diff": "diff text"}),
        ]
        transformed, cache = manager.transform_messages(messages, {"session_id": "s", "files": {}})
        traces = [m for m in transformed if m.get("role") == "file_trace"]
        self.assertTrue(traces)
        latest_trace = traces[-1]["content"]
        self.assertIn("33|new 33", latest_trace)
        self.assertIn("34|new 34", latest_trace)
        self.assertIn("37|line 40", latest_trace)
        self.assertIn("52|line 55", latest_trace)
        self.assertIn("56|line 59", latest_trace)
        self.assertNotIn("55|line 55", latest_trace)
        self.assertIn("edit_arguments_omitted", json.dumps(transformed, ensure_ascii=False))
        self.assertEqual(cache["files"]["/tmp/example.py"]["known_ranges"][0]["start"], 1)
        self.assertEqual(cache["files"]["/tmp/example.py"]["known_ranges"][0]["end"], 37)

    def test_write_file_omits_argument_but_file_trace_contains_full_text(self):
        content = "alpha\nbeta\ngamma"
        messages = [
            tool_call("t0", "trace_file", {"path": "/tmp/write.py", "operation": "trace"}),
            tool_result("t0", {"status": "traced", "path": "/tmp/write.py"}),
            tool_call("t1", "write_file", {"path": "/tmp/write.py", "content": content}),
            tool_result("t1", {"status": "ok", "path": "/tmp/write.py", "content": content, "total_lines": 3}),
        ]
        transformed, cache = manager.transform_messages(messages, {"session_id": "s", "files": {}})
        serialized = json.dumps(transformed, ensure_ascii=False)
        self.assertIn("content_omitted", serialized)
        self.assertNotIn('"content": "alpha\\nbeta\\ngamma"', serialized)
        trace_content = [m["content"] for m in transformed if m.get("role") == "file_trace"][-1]
        self.assertIn("1|alpha", trace_content)
        self.assertIn("3|gamma", trace_content)
        self.assertEqual(cache["files"]["/tmp/write.py"]["known_ranges"][0]["end"], 3)

    def test_error_fix_id_summarizes_failed_call_and_processes_successful_fix(self):
        messages = [
            tool_call("t0", "trace_file", {"path": "/tmp/fix.py", "operation": "trace"}),
            tool_result("t0", {"status": "traced", "path": "/tmp/fix.py"}),
            tool_call("bad", "read_file", {"path": "/tmp/fix.py", "offset": 100, "limit": 10}),
            tool_result("bad", {"status": "error", "path": "/tmp/fix.py", "error": "range invalid"}),
            tool_call("good", "read_file", {"path": "/tmp/fix.py", "offset": 1, "limit": 2, "error_fix_id": "bad"}),
            tool_result("good", {"status": "ok", "path": "/tmp/fix.py", "offset": 1, "limit": 2, "content": "1|a\n2|b"}),
        ]
        transformed, cache = manager.transform_messages(messages, {"session_id": "s", "files": {}})
        serialized = json.dumps(transformed, ensure_ascii=False)
        self.assertIn("failed_then_fixed", serialized)
        self.assertIn("1|a", [m["content"] for m in transformed if m.get("role") == "file_trace"][-1])
        self.assertEqual(cache["files"]["/tmp/fix.py"]["known_ranges"][0]["start"], 1)
    def test_trace_update_false_generates_delta_notice_without_full_known_content(self):
        messages = [
            tool_call("t0", "trace_file", {"path": "/tmp/delta.py", "operation": "trace"}),
            tool_result("t0", {"status": "traced", "path": "/tmp/delta.py"}),
            tool_call("t1", "write_file", {"path": "/tmp/delta.py", "content": "a\nb\nc"}),
            tool_result("t1", {"status": "ok", "path": "/tmp/delta.py", "content": "a\nb\nc"}),
            tool_call("t2", "edit_file", {"mode": "replace", "path": "/tmp/delta.py", "old_string": "b", "new_string": "B", "trace_update": False}),
            tool_result("t2", {"status": "ok", "path": "/tmp/delta.py", "diff": "diff text"}),
        ]
        transformed, cache = manager.transform_messages(messages, {"session_id": "s", "files": {}})
        traces = [m for m in transformed if m.get("role") == "file_trace"]
        self.assertEqual(len(traces), 1)
        delta_trace = traces[-1]["content"]
        self.assertIn("mode: delta_only", delta_trace)
        self.assertIn("Full file_trace content intentionally not refreshed", delta_trace)
        self.assertNotIn("1|a", delta_trace)
        self.assertNotIn("2|B", delta_trace)
        self.assertEqual(cache["files"]["/tmp/delta.py"]["known_ranges"][0]["content"], ["a", "B", "c"])

    def test_oversize_trace_becomes_large_notice_and_records_permanent_node(self):
        content = "\n".join(f"line {i}" for i in range(30))
        messages = [
            tool_call("t0", "trace_file", {"path": "/tmp/large.py", "operation": "trace"}),
            tool_result("t0", {"status": "traced", "path": "/tmp/large.py"}),
            tool_call("t1", "write_file", {"path": "/tmp/large.py", "content": content}),
            tool_result("t1", {"status": "ok", "path": "/tmp/large.py", "content": content}),
        ]
        transformed, cache = manager.transform_messages(messages, {"session_id": "s", "files": {}}, char_limit=200)
        trace_content = [m["content"] for m in transformed if m.get("role") == "file_trace"][-1]
        self.assertIn("mode: large", trace_content)
        self.assertIn("exceeds the configured trace limit", trace_content)
        self.assertTrue(cache["files"]["/tmp/large.py"]["oversize"])
        self.assertEqual(cache["files"]["/tmp/large.py"]["trace_nodes"][-1]["status"], "permanent")


if __name__ == "__main__":
    unittest.main()
