import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT.parent / "Eos-Tools"


def load_tool(name):
    path = TOOLS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    import sys
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class EosToolsTests(unittest.TestCase):
    def test_read_file_returns_line_numbered_content_and_trace_flag(self):
        read_file = load_tool("read_file").read_file
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "a.txt"
            p.write_text("one\ntwo\nthree\n", encoding="utf-8")
            result = read_file(str(p), offset=2, limit=2, trace=True)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["start_line"], 2)
        self.assertIn("2|two", result["content"])
        self.assertTrue(result["trace_enabled"])

    def test_write_file_returns_full_written_content(self):
        write_file = load_tool("write_file").write_file
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "b.txt"
            result = write_file(str(p), "alpha\nbeta")
            self.assertEqual(p.read_text(encoding="utf-8"), "alpha\nbeta")
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["content"], "alpha\nbeta")
        self.assertEqual(result["total_lines"], 2)

    def test_edit_file_replace_returns_diff_and_trace_update(self):
        edit_file = load_tool("edit_file").edit_file
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "c.txt"
            p.write_text("a\nb\nc\n", encoding="utf-8")
            result = edit_file(str(p), mode="replace", old_string="b", new_string="B", trace_update=False)
            self.assertEqual(p.read_text(encoding="utf-8"), "a\nB\nc\n")
        self.assertEqual(result["status"], "ok")
        self.assertIn("-b", result["diff"])
        self.assertIn("+B", result["diff"])
        self.assertFalse(result["trace_update"])

    def test_trace_file_updates_session_trace_cache(self):
        trace_file = load_tool("trace_file").trace_file
        with tempfile.TemporaryDirectory() as td:
            cache = Path(td) / "session_file_trace.json"
            result = trace_file("/tmp/a.txt", "trace", trace_cache_path=str(cache), session_id="s")
            self.assertEqual(result["status"], "traced")
            result = trace_file("/tmp/a.txt", "untrace", trace_cache_path=str(cache), session_id="s")
            self.assertEqual(result["status"], "untraced")
    def test_edit_file_patch_mode_applies_v4a_update(self):
        edit_file = load_tool("edit_file").edit_file
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "d.txt"
            p.write_text("one\ntwo\nthree\n", encoding="utf-8")
            patch_text = f"""*** Begin Patch
*** Update File: {p}
@@
 one
-two
+TWO
 three
*** End Patch
"""
            result = edit_file(str(p), mode="patch", patch=patch_text)
            self.assertEqual(p.read_text(encoding="utf-8"), "one\nTWO\nthree\n")
        self.assertEqual(result["status"], "ok")
        self.assertIn("-two", result["diff"])
        self.assertIn("+TWO", result["diff"])
        self.assertEqual(result["operations"][0]["old_range"], [2, 2])
        self.assertEqual(result["operations"][0]["new_range"], [2, 2])


if __name__ == "__main__":
    unittest.main()
