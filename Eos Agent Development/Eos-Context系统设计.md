# AI Agent Context Management Architecture: Dynamic File State & Defragmentation

## 1. Overview
This document outlines a high-efficiency context and memory management architecture for an AI Agent interacting with a filesystem (`read_file`, `patch`, `write_file`). The primary goals are to prevent context pollution (stale file states), minimize token consumption, maintain logical chain-of-thought, and maximize LLM prompt cache hit rates.

## 2. Core Mechanisms

### 2.1 Cache-Aware State Notification
When a file is modified (via `patch` or `write_file`), the Agent's memory of this file becomes outdated. 
*   **Action:** Append a "State Change Notification" at the *very end* of the user prompt (the most dynamic part of the context window). 
*   **Purpose:** Notifying the model at the end preserves the prefix cache for the massive conversation history. The model is informed of the change and given the autonomy to decide whether to re-read the file.

### 2.2 Tombstoning & Lazy-Loading (History Truncation)
If the model decides to read a file that has been marked as changed, the system must clean up the old state.
*   **Action:** Locate the historical `read_file` tool response for this specific file. Mutate/replace its content entirely with a tombstone string: `[此文件内容已过期，新版文件请见下文]` (This file content is outdated, see below for the new version).
*   **Purpose:** Reclaims thousands of tokens while preserving the logical reasoning chain ("I read it before, but now I'm reading the updated version").

### 2.3 Context Defragmentation (Chunked Read Merging)
When a large file is read in chunks across multiple turns, do not leave scattered tool responses in the history.
*   **Action:** When a new chunk is read, locate the immediately preceding `read_file` response for this file and replace it with: `[读取的文章片段已合并处理]` (Read text snippets have been merged). 
*   **Global View:** In the *current* tool response, output the **merged result** of all chunks read so far.
*   **Gap Handling:** For non-continuous reads (e.g., lines 1-20, then 100-120), fill the unread gaps in the merged view with a specific placeholder:
    `... lines 21-99 hidden: have not read ...`

### 2.4 Local Delta Injection (The "Temporary Cheat Sheet")
To prevent the model from experiencing "Lost in the Middle" when viewing the merged global view, provide a temporary highlight of the exactly requested lines.
*   **Action:** At the end of the current `read_file` tool response, append a dedicated block containing *only* the newly requested chunk for this specific turn.
*   **Cleanup:** On the *very next* tool call or conversation turn, strictly **clear/remove** this temporary block from the history, leaving only the updated Merged Global View.

### 2.5 Forced Refresh on Modified Files
If a file has been modified, any subsequent `read_file` operation—even if just fetching a single line—must trigger the full refresh mechanism.
*   **Action:** Apply the tombstone to old reads, generate a fresh Merged Global View based on the physical disk's current state, and append the requested single line as the Local Delta Injection.

---

## 3. Workflow Example: `read_file`

**Turn 1: Model calls `read_file(lines 1-10)`**
*   *Response:* Returns lines 1-10. Appends temporary block of lines 1-10.

**Turn 2: Model calls `read_file(lines 50-60)`**
*   *Middleware Actions:*
    1. Removes the temporary block from Turn 1's response.
    2. Mutates Turn 1's main response to: `[读取的文章片段已合并处理]`
    3. Generates Merged View: lines 1-10 + `... lines 11-49 hidden: have not read ...` + lines 50-60.
    4. Generates Temporary Block: lines 50-60.
*   *Current Response:* Returns the Merged View + Temporary Block.

**Turn 3: Model calls `patch()` on the file**
*   *Middleware Actions:* Updates physical file. Appends notification to the next user prompt: "File modified. History outdated."

**Turn 4: Model calls `read_file(lines 1-5)`**
*   *Middleware Actions:*
    1. Finds the merged response from Turn 2 and mutates it to: `[此文件内容已过期，新版文件请见下文]`
    2. Generates new view based on the patched file.
    3. Appends lines 1-5 as the temporary block.

---

## Appendix: Original User Messages (Ideation Source)

> **Message 1:**
> 现在我正在自己设计自己的AI Agent。我希望通过工具调用历史的裁剪来减少上下文占用。主要针对patch, write_file和read_file。关于read_file，存在一个“文件过期”问题：相对于最新版文件，可能上一次read_file返回的内容有些是已经被改过的。如果再次read_file，不仅可能造成上下文污染，还会额外消耗上下文。

> **Message 2:**
> 我希望：将所有与历史记录中的文件状态不同的文件都告知模型（包装在用户提示词最后，以提高缓存命中率），模型可以选择读也可以不读；如果读了，那么就将历史的那条读取给替换掉（“此文件内容已过期，新版文件请见下文”），然后返回新的文件。同时，如果一个大文件被分块读取了，会被直接合并在一起（避免零散的、甚至是隔了其他文件内容的文件内容影响模型的理解）。

> **Message 3:**
> 是这样的：
> 模型调用readfile读了一部分内容（首次读取），再读取另一部分内容时：直接将上一条工具调用的返回值替换为“读取的文章片段已合并处理”，然后在当前这一次工具返回值中直接写合并的结果。会在该次返回值的末尾单独返回当次新阅读的内容，在下一次调用时清除。
> 如果这个文件的内容被修改过，那么在readfile时，即使只读一行代码，也会触发之前的文件刷新机制，同样在最后附加一个临时的“当次读取内容”。

> **Message 4:**
> 像你这样即可，不过要注明lines xxx hidden: have not read。现在总结我的思想成为一个markdown文档供ai agent理解并开发。必须在最后附加上我的所有消息原文。包裹在一个代码块中输出。
