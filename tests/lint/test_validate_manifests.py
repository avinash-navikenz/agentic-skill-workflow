import unittest
import tempfile
import sys
from io import StringIO
from pathlib import Path
from scripts.navi_lint.registry import Entry, load_entries
from scripts.validate_manifests import check, main

def skill(name="navi-skill-alpha", desc="Use when x. Trigger phrases include: alpha.", **meta):
    m = {"version": "0.1.0", "maturity": "draft", "kind": "skill", "discipline": "architecture",
         "lifecycle_phases": [3], "owner": "OWNER_TBD", "tags": "a", "model": "sonnet",
         "used_by_agents": ["navi-agent-architect"]}
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

def _with_evals(tmp, entry, write=True):
    """Materialise a skill directory so the evals check has something to look at."""
    path = Path(tmp) / entry.path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("body")
    if write:
        (path.parent / "evals").mkdir(exist_ok=True)
        (path.parent / "evals" / "evals.json").write_text("{}")
    return Entry(entry.name, entry.kind, path, entry.meta, entry.body)


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

    def test_M7_used_by_agents_agrees_with_the_agents_that_list_it(self):
        s = skill(used_by_agents=["navi-agent-qa-engineer", "navi-agent-architect"])
        a1 = agent()
        a2 = agent(name="navi-agent-qa-engineer")
        self.assertEqual(check([s, a1, a2]), [])

    def test_M7_skill_claims_an_agent_that_does_not_list_it(self):
        s = skill(used_by_agents=["navi-agent-architect", "navi-agent-qa-engineer"])
        findings = check([s, agent()])
        self.assertIn("M7", rules(findings))
        self.assertTrue(any("navi-agent-qa-engineer" in f.message and "does not list" in f.message
                            for f in findings))

    def test_M7_agent_lists_a_skill_absent_from_its_used_by_agents(self):
        s = skill(used_by_agents=["navi-agent-architect"])
        findings = check([s, agent(), agent(name="navi-agent-qa-engineer")])
        self.assertIn("M7", rules(findings))
        self.assertTrue(any("navi-agent-qa-engineer" in f.message and "absent from" in f.message
                            for f in findings))

    def test_M7_empty_used_by_agents_on_a_skill_an_agent_lists(self):
        s = skill(used_by_agents=[])
        findings = check([s, agent()])
        self.assertIn("M7", rules(findings))
        self.assertTrue(any("navi-agent-architect" in f.message and "absent from" in f.message
                            for f in findings))
        self.assertNotIn("M5", rules(findings))

    def test_M7_missing_used_by_agents_key_is_treated_as_empty(self):
        s = skill()
        del s.meta["metadata"]["used_by_agents"]
        m7 = [f for f in check([s, agent()]) if f.rule == "M7"]
        self.assertEqual(len(m7), 1)
        self.assertIn("navi-agent-architect", m7[0].message)
        self.assertIn("absent from used_by_agents", m7[0].message)

    def test_M7_reports_both_directions_at_once(self):
        s = skill(used_by_agents=["navi-agent-qa-engineer"])
        m7 = [f for f in check([s, agent()]) if f.rule == "M7"]
        self.assertEqual(len(m7), 2)
        self.assertTrue(any("navi-agent-qa-engineer" in f.message and "does not list" in f.message
                            for f in m7))
        self.assertTrue(any("navi-agent-architect" in f.message and "absent from" in f.message
                            for f in m7))

    def test_M7_is_clean_against_the_repo_content(self):
        entries = load_entries(Path(__file__).resolve().parents[2])
        self.assertEqual([f for f in check(entries) if f.rule == "M7"], [])

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

# ---------------------------------------------------------------------------
# M8 — metadata.kind must be one of {skill, agent}.
#
# `kind: Agent` (wrong case) made lint_separation report 0 findings on a file
# with obvious violations, and made this validator emit 15 phantom M5/M7
# findings about unrelated skills while never naming the file that caused them.
# ---------------------------------------------------------------------------
class TestKindValidation(unittest.TestCase):
    def _bad(self, value):
        a = agent()
        a.meta["metadata"]["kind"] = value
        return a

    def test_wrong_case_kind_is_reported(self):
        found = check([skill(), self._bad("Agent")])
        self.assertIn("M8", rules(found))

    def test_finding_names_the_file_and_the_bad_value(self):
        found = [f for f in check([skill(), self._bad("Agent")]) if f.rule == "M8"]
        first = found[0]
        self.assertEqual(Path("agents/navi-agent-architect/navi-agent-architect.agent.md"), first.path)
        self.assertIn("'Agent'", first.message)

    def test_arbitrary_kind_is_reported(self):
        for value in ["Skill", "persona", "", None, "AGENT", "agents"]:
            with self.subTest(value=value):
                self.assertIn("M8", rules(check([skill(), self._bad(value)])))

    def test_valid_kinds_are_accepted(self):
        self.assertNotIn("M8", rules(check([skill(), agent()])))

    def test_absent_kind_is_left_to_M2(self):
        a = agent()
        del a.meta["metadata"]["kind"]
        found = check([skill(), a])
        self.assertNotIn("M8", rules(found))
        self.assertIn("M2", rules(found))

    def test_referential_checks_are_withheld_not_misreported(self):
        # The bug's loudest symptom: 15 findings pointing at innocent skills.
        # With a broken kind the referential results are untrustworthy, so they
        # are withheld and the withholding is stated.
        found = check([skill(), self._bad("Agent")])
        self.assertEqual([], [f for f in found if f.rule in ("M4", "M5", "M7")])
        self.assertTrue(any("skipped" in f.message for f in found if f.rule == "M8"))


if __name__ == "__main__":
    unittest.main()


class TestEvals(unittest.TestCase):
    def test_M9_skill_without_evals_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = _with_evals(tmp, skill(), write=False)
            self.assertIn("M9", rules(check([s, agent()])))

    def test_M9_satisfied_when_evals_json_is_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = _with_evals(tmp, skill(), write=True)
            self.assertNotIn("M9", rules(check([s, agent()])))

    def test_M9_does_not_ask_an_agent_for_evals(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = _with_evals(tmp, agent(), write=False)
            s = _with_evals(tmp, skill(), write=True)
            self.assertNotIn("M9", rules(check([s, a])))
