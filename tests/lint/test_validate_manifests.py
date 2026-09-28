import unittest
import tempfile
import sys
from io import StringIO
from pathlib import Path
from scripts.navi_lint.registry import Entry
from scripts.validate_manifests import check, main

def skill(name="navi-skill-alpha", desc="Use when x. Trigger phrases include: alpha.", **meta):
    m = {"version": "0.1.0", "maturity": "draft", "kind": "skill", "discipline": "architecture",
         "lifecycle_phases": [3], "owner": "OWNER_TBD", "tags": "a", "model": "sonnet"}
    m.update(meta)
    return Entry(name, "skill", Path(f"skills/architecture/{name}/SKILL.md"),
                 {"name": name, "description": desc, "allowed-tools": "Read", "metadata": m}, "body")

def agent(name="navi-agent-architect", skills=("navi-skill-alpha",)):
    m = {"version": "0.1.0", "maturity": "draft", "kind": "agent", "discipline": "architecture",
         "lifecycle_phases": [3], "owner": "OWNER_TBD", "tags": "a", "model": "opus"}
    return Entry(name, "agent", Path(f"agents/{name}/{name}.agent.md"),
                 {"name": name, "description": "Use when architecting.", "allowed-tools": "Read",
                  "metadata": m, "skills": list(skills), "owns_gates": ["G3"],
                  "capabilities": ["read_file"], "consumes": [], "produces": [],
                  "handoff_to": [], "escalate_to_human_when": ["conflict"]}, "body")

def rules(findings):
    return sorted({f.rule for f in findings})

class TestManifests(unittest.TestCase):
    def test_clean_pair_has_no_findings(self):
        self.assertEqual(check([skill(), agent()]), [])

    def test_M2_missing_required_metadata_key(self):
        s = skill(); del s.meta["metadata"]["model"]
        self.assertIn("M2", rules(check([s, agent()])))

    def test_M3_name_prefix_wrong_for_kind(self):
        s = skill(name="navi-agent-alpha")
        self.assertIn("M3", rules(check([s, agent(skills=("navi-agent-alpha",))])))

    def test_M3_name_does_not_match_directory(self):
        s = skill()
        s.path = Path("skills/architecture/navi-skill-beta/SKILL.md")
        self.assertIn("M3", rules(check([s, agent()])))

    def test_M4_agent_references_missing_skill(self):
        findings = check([skill(), agent(skills=("navi-skill-ghost",))])
        self.assertIn("M4", rules(findings))
        self.assertTrue(any("navi-skill-ghost" in f.message for f in findings))

    def test_M5_orphan_skill_referenced_by_nobody(self):
        findings = check([skill(), skill(name="navi-skill-lonely"), agent()])
        self.assertIn("M5", rules(findings))
        self.assertTrue(any("navi-skill-lonely" in f.message for f in findings))

    def test_M6_skill_description_missing_trigger_phrases(self):
        s = skill(desc="Use when x.")
        self.assertIn("M6", rules(check([s, agent()])))

    def test_M1_malformed_frontmatter(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            skill_dir = tmpdir_path / "skills" / "architecture" / "navi-skill-x"
            skill_dir.mkdir(parents=True)
            # Create a file with no frontmatter at all
            skill_file = skill_dir / "SKILL.md"
            skill_file.write_text("No frontmatter at all\nJust body")
            # Capture stdout
            old_stdout = sys.stdout
            sys.stdout = StringIO()
            try:
                exit_code = main([str(tmpdir)])
                output = sys.stdout.getvalue()
            finally:
                sys.stdout = old_stdout
            self.assertEqual(exit_code, 1)
            self.assertIn("M1", output)

if __name__ == "__main__":
    unittest.main()
