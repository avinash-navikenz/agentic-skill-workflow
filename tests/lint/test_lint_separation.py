import unittest
import tempfile
import sys
from io import StringIO
from pathlib import Path
from scripts.navi_lint.registry import Entry
from scripts.lint_separation import separation_findings, main

def ent(kind, body):
    name = "navi-agent-architect" if kind == "agent" else "navi-skill-alpha"
    return Entry(name, kind, Path(f"{kind}s/{name}/x.md"), {"name": name}, body)

def rules(fs):
    return sorted({f.rule for f in fs})

class TestSeparation(unittest.TestCase):
    def test_clean_agent_passes(self):
        body = "## Mission\nOwn the design.\n\n## How I decide\nFavour reversible choices.\n"
        self.assertEqual(separation_findings(ent("agent", body)), [])

    def test_clean_skill_passes(self):
        body = "## Rules\n- Record every decision.\n\n## Anti-patterns\n- Undated ADRs.\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

    def test_SEP1_numbered_procedure_in_agent(self):
        body = "## Mission\nOwn it.\n\n1. Open the file\n2. Edit the header\n"
        self.assertIn("SEP1", rules(separation_findings(ent("agent", body))))

    def test_SEP2_template_heading_in_agent(self):
        self.assertIn("SEP2", rules(separation_findings(ent("agent", "## Template\n```\nx\n```\n"))))

    def test_SEP2_checklist_heading_in_agent(self):
        self.assertIn("SEP2", rules(separation_findings(ent("agent", "## Checklist\n- [ ] x\n"))))

    def test_SEP3_persona_voice_in_skill(self):
        body = "## Rules\nAs the Architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

    def test_SEP4_first_person_in_skill(self):
        self.assertIn("SEP4", rules(separation_findings(ent("skill", "## Rules\nI prefer small ADRs.\n"))))

    def test_numbered_list_in_skill_is_allowed(self):
        body = "## Rules\n1. Number every requirement\n2. Keep one per line\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

    # Additional test (a): main() exit code behavior
    def test_main_returns_zero_for_clean_tree(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            agent_dir = tmpdir_path / "agents" / "navi-agent-clean"
            agent_dir.mkdir(parents=True)
            agent_file = agent_dir / "navi-agent-clean.agent.md"
            agent_file.write_text("---\nname: navi-agent-clean\nmetadata:\n  kind: agent\n---\n## Mission\nOwn the design.\n")

            old_stdout = sys.stdout
            sys.stdout = StringIO()
            try:
                exit_code = main([str(tmpdir)])
            finally:
                sys.stdout = old_stdout

            self.assertEqual(exit_code, 0)

    def test_main_returns_one_when_findings_exist(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            agent_dir = tmpdir_path / "agents" / "navi-agent-bad"
            agent_dir.mkdir(parents=True)
            agent_file = agent_dir / "navi-agent-bad.agent.md"
            # This agent contains a numbered procedure which violates SEP1
            agent_file.write_text("---\nname: navi-agent-bad\nmetadata:\n  kind: agent\n---\n1. Open the file\n2. Edit it\n")

            old_stdout = sys.stdout
            sys.stdout = StringIO()
            try:
                exit_code = main([str(tmpdir)])
            finally:
                sys.stdout = old_stdout

            self.assertEqual(exit_code, 1)

    # Additional test (b): _strip_code() removes fenced content, preventing false positives
    def test_fenced_code_with_persona_voice_produces_no_finding(self):
        # Persona voice inside a fenced code block should be stripped and produce no finding
        body = "## Template\n```\nAs the Architect, weigh coupling against delivery speed.\n```\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

    def test_unfenced_persona_voice_produces_SEP3(self):
        # Same text outside a fence should produce SEP3
        body = "## Rules\nAs the Architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

if __name__ == "__main__":
    unittest.main()
