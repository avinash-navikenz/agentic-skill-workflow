import sys
import unittest
import tempfile
from io import StringIO
from pathlib import Path
from scripts.validate_traceability import trace_findings, main

SPEC = """# Spec
## REQ-001 Users can toggle theme
### AC-001 Given a logged-in user, when they toggle, then it persists.
## REQ-002 Theme respects system preference
"""

SPEC_CLEAN = """# Spec
## REQ-001 Users can toggle theme
### AC-001 Given a logged-in user, when they toggle, then it persists.
"""

TASKS_OK = "- [ ] **TASK-001** Add toggle\n  - Implements: REQ-001\n"
TASKS_ORPHAN = "- [ ] **TASK-001** Add toggle\n"
TASKS_GHOST = "- [ ] **TASK-001** Add toggle\n  - Implements: REQ-999\n"


def build(tmp, spec, tasks):
    root = Path(tmp) / "delivery"
    (root / "specs" / "theme").mkdir(parents=True)
    (root / "specs" / "theme" / "spec.md").write_text(spec, encoding="utf-8")
    (root / "changes" / "c").mkdir(parents=True)
    (root / "changes" / "c" / "tasks.md").write_text(tasks, encoding="utf-8")
    return root


def rules(fs):
    return sorted({f.rule for f in fs})


def run_main(args):
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    try:
        code = main(args)
        output = sys.stdout.getvalue()
    finally:
        sys.stdout = old_stdout
    return code, output


class TestTrace(unittest.TestCase):
    def test_T1_task_without_implements(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertIn("T1", rules(trace_findings(build(t, SPEC, TASKS_ORPHAN))))

    def test_T2_requirement_without_acceptance_criteria(self):
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC, TASKS_OK))
            self.assertIn("T2", rules(fs))
            self.assertTrue(any("REQ-002" in f.message for f in fs))

    def test_T3_implements_unknown_requirement(self):
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC, TASKS_GHOST))
            self.assertIn("T3", rules(fs))
            self.assertTrue(any("REQ-999" in f.message for f in fs))

    def test_T4_strict_flags_requirement_with_no_task(self):
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC, TASKS_OK), strict=True)
            self.assertIn("T4", rules(fs))

    # --- Additions beyond the brief ---

    def test_empty_delivery_tree_returns_no_findings(self):
        # A delivery/ directory that exists but has neither specs/ nor
        # changes/ populated must not raise — glob() over a missing
        # subdirectory returns no matches rather than erroring, but this
        # proves it end-to-end rather than assuming it.
        with tempfile.TemporaryDirectory() as t:
            root = Path(t) / "delivery"
            root.mkdir()
            self.assertEqual(trace_findings(root), [])
            self.assertEqual(trace_findings(root, strict=True), [])

    def test_absent_delivery_tree_returns_no_findings(self):
        # The delivery/ directory itself does not exist at all yet (e.g.
        # before `navi-delivery init` has run).
        with tempfile.TemporaryDirectory() as t:
            root = Path(t) / "delivery"
            self.assertFalse(root.exists())
            self.assertEqual(trace_findings(root), [])

    def test_main_exit_code_one_when_findings(self):
        with tempfile.TemporaryDirectory() as t:
            root = build(t, SPEC, TASKS_ORPHAN)
            code, output = run_main([str(root)])
            self.assertEqual(code, 1)
            self.assertIn("T1", output)

    def test_main_exit_code_zero_when_clean(self):
        with tempfile.TemporaryDirectory() as t:
            root = build(t, SPEC_CLEAN, TASKS_OK)
            code, output = run_main([str(root)])
            self.assertEqual(code, 0)
            self.assertIn("0 traceability finding(s)", output)


if __name__ == "__main__":
    unittest.main()
