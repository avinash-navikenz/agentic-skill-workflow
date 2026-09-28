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

    # --- Fix round 1: unreadable files must yield a Finding, never raise ---

    def test_T0_spec_with_invalid_utf8_yields_finding_not_traceback(self):
        # Mirrors scripts/navi_lint/frontmatter.py's handling of
        # UnicodeDecodeError: a malformed source file is reported by path
        # with a readable message, never an uncaught traceback.
        with tempfile.TemporaryDirectory() as t:
            root = Path(t) / "delivery"
            (root / "specs" / "theme").mkdir(parents=True)
            (root / "specs" / "theme" / "spec.md").write_bytes(b"\xff\xfe not valid utf-8 REQ-001\n")
            (root / "changes" / "c").mkdir(parents=True)
            (root / "changes" / "c" / "tasks.md").write_text(TASKS_OK, encoding="utf-8")
            fs = trace_findings(root)  # must not raise
            self.assertIn("T0", rules(fs))
            code, output = run_main([str(root)])
            self.assertEqual(code, 1)
            self.assertIn("T0", output)

    def test_T0_tasks_with_invalid_utf8_yields_finding_not_traceback(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t) / "delivery"
            (root / "specs" / "theme").mkdir(parents=True)
            (root / "specs" / "theme" / "spec.md").write_text(SPEC_CLEAN, encoding="utf-8")
            (root / "changes" / "c").mkdir(parents=True)
            (root / "changes" / "c" / "tasks.md").write_bytes(b"\xff\xfe **TASK-001** not valid utf-8\n")
            fs = trace_findings(root)  # must not raise
            self.assertIn("T0", rules(fs))
            code, output = run_main([str(root)])
            self.assertEqual(code, 1)
            self.assertIn("T0", output)

    # --- Fix round 1: pinned, known limitations (parsing logic unchanged) ---

    def test_KNOWN_LIMITATION_acs_grouped_after_all_reqs_misattribute_to_last_req(self):
        # Known limitation, accepted as-is: the parser attributes any AC-###
        # line to whichever REQ heading was *most recently seen*, not to the
        # REQ it is textually associated with. A spec that lists every REQ
        # heading first and every AC line afterwards (instead of nesting each
        # AC under its own REQ, as the shipped template does) misattributes
        # every AC to the last REQ heading in the file. This test documents
        # that current behaviour; it is not a licence to fix it.
        # Deliberately avoid the literal text "REQ-001"/"REQ-002" inside the
        # AC lines themselves — the parser's REQ regex has no notion of
        # headings vs. body text, only "matches REQ-### and the line starts
        # with '#'", so restating a REQ id inside an AC line would itself
        # re-trigger heading detection and mask the very bug under test.
        spec_all_reqs_then_all_acs = (
            "# Spec\n"
            "## REQ-001 First requirement\n"
            "## REQ-002 Second requirement\n"
            "### AC-001 Some criterion for the first one\n"
            "### AC-002 Some criterion for the second one\n"
        )
        tasks = (
            "- [ ] **TASK-001** Do first\n"
            "  - Implements: REQ-001\n"
            "- [ ] **TASK-002** Do second\n"
            "  - Implements: REQ-002\n"
        )
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, spec_all_reqs_then_all_acs, tasks))
            self.assertIn("T2", rules(fs))
            # REQ-001 is flagged as having no AC, even though AC-001 is
            # present in the file — it was attributed to REQ-002 instead,
            # since REQ-002 was the most recently seen heading.
            self.assertTrue(any(f.rule == "T2" and "REQ-001" in f.message for f in fs))
            # REQ-002 is (incorrectly, but consistently) credited with both.
            self.assertFalse(any(f.rule == "T2" and "REQ-002" in f.message for f in fs))

    def test_KNOWN_LIMITATION_implements_line_beyond_window_is_a_false_positive_T1(self):
        # Known limitation, accepted as-is: T1 only looks at a 4-line window
        # starting at the TASK-### line itself (lines[i:i+4]). An
        # `Implements:` line further than 3 lines below its TASK-### line is
        # missed, producing a false-positive T1 even though the task does
        # name a requirement. The shipped template puts `Implements:` on the
        # very next line, so this does not occur in practice. This test
        # documents current behaviour; it is not a licence to fix it.
        tasks_implements_too_far_below = (
            "- [ ] **TASK-001** Add toggle\n"
            "  - Some detail one\n"
            "  - Some detail two\n"
            "  - Some detail three\n"
            "  - Implements: REQ-001\n"
        )
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC_CLEAN, tasks_implements_too_far_below))
            self.assertIn("T1", rules(fs))
            self.assertTrue(any("TASK-001" in f.message for f in fs if f.rule == "T1"))


if __name__ == "__main__":
    unittest.main()
