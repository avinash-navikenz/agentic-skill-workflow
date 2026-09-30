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

    # False-positive regression tests (from coordinator review)
    def test_persona_voice_in_descriptive_context_does_not_trigger(self):
        # "as the Architect" in the middle of a sentence should not trigger
        body = "## Rules\nThis gate applies to roles such as the Architect, Developer, and QA Engineer.\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

    def test_persona_voice_after_verb_does_not_trigger(self):
        # "as the Architect" after "known as" should not trigger
        body = "## Rules\nThe lead is commonly known as the Architect on this team.\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

    def test_four_digit_year_does_not_trigger_numbered_procedure(self):
        # Years (3+ digits) should not trigger SEP1
        body = "## Mission\n2026. Roadmap for next quarter\n"
        self.assertEqual(separation_findings(ent("agent", body)), [])

    def test_SEP1_still_catches_one_digit_procedures(self):
        # Verify that 1-2 digit procedures are still caught
        body = "## Mission\n1. Open the file\n2. Edit it\n"
        self.assertIn("SEP1", rules(separation_findings(ent("agent", body))))

    def test_SEP3_still_catches_clause_initial_persona_voice(self):
        # Verify that clause-initial "As the Role" is still caught
        body = "## Rules\nAs the Architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

    # Tests for second fix round - list marker and blockquote support
    def test_SEP3_persona_voice_in_bulleted_list(self):
        # Bulleted persona voice should trigger SEP3
        body = "## Rules\n- As the Architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

    def test_SEP3_persona_voice_in_blockquote(self):
        # Blockquoted persona voice should trigger SEP3
        body = "## Rules\n> As the Architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

    def test_SEP3_persona_voice_with_lowercase_role_name(self):
        # Lowercase role names should still trigger SEP3
        body = "## Rules\nAs the architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

# ---------------------------------------------------------------------------
# SEP5 — bulleted imperative directives in agents.
#
# SEP1 matched numbered lists only, so the same rules written as bullets
# scored zero. These tests pin both halves of the behaviour: the directives
# that must now be caught, and the judgment prose that must stay silent.
# The second half is the load-bearing one — a linter that fires on valid
# `Mental model` prose gets switched off.
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

# Every one of these is an instruction to the reader or a statement of what an
# artifact must contain (spec §4.1 test (a)).
DIRECTIVE_BULLETS = [
    "Write the ADR before starting implementation.",
    "Record every gate verdict in the events log.",
    "Keep the ADR index current.",
    "Verify the rollback has been run.",
    "Use the shipped template for every ADR.",
    "Always escalate a vendor lock-in decision.",
    "Never average two personas' disagreement.",
    "Do not accept a spec without numbers.",
    "Don't merge without a green gate.",
    "First, run the traceability validator.",
    "Ensure that the spec is testable before accepting Phase 3 work.",
    "Ensure it is signed off.",
    "The handoff record must name the receiving persona.",
    "Every waiver must carry an expiry date.",
    "You must record the verdict before handing off.",
]

# Judgment. Real `Mental model` bullets from the shipped corpus, plus the
# near-miss shapes that a naive rule would trip on: a noun that is also a verb
# in subject position, and `must`/`never`/`always` used declaratively.
JUDGMENT_BULLETS = [
    "Architecture is the set of decisions that are expensive to reverse.",
    "Debt is a financing decision, not a moral failure.",
    "Code is read far more often than written.",
    "Testing does not create quality; it reveals it.",
    "Monitoring input distributions catches decay weeks before outcomes does.",
    "Rollback is only real if it has been run.",
    "A model is a perishable asset.",
    "Value and effort are both estimates.",
    "Process that is disproportionate gets routed around.",
    "Lineage is not documentation; it is the ability to answer a question.",
    "Alerts that do not correspond to a decision train people to ignore alerts.",
    # `never` / `always` / `must` as ordinary prose, not as instructions.
    "The question is never whether it fails but whether we can detect it.",
    "Every branch I add is a state someone must later reason about.",
    "The interesting question is always who is wrong about, and how badly.",
    # Nouns that English also allows as verbs, in subject position.
    "Trust boundaries are where the design's assumptions stop being true.",
    "Review is the cheapest control we have.",
    "Record keeping is uneven across the teams.",
    "Reporting is not the same as monitoring.",
]

class TestSEP5BulletedImperatives(unittest.TestCase):
    def _agent(self, bullets, heading="## Working agreement"):
        return ent("agent", heading + "\n" + "".join(f"- {b}\n" for b in bullets))

    def test_each_directive_bullet_is_caught(self):
        for bullet in DIRECTIVE_BULLETS:
            with self.subTest(bullet=bullet):
                found = separation_findings(self._agent([bullet]))
                self.assertIn("SEP5", rules(found), f"not caught: {bullet}")

    def test_each_judgment_bullet_is_not_caught(self):
        for bullet in JUDGMENT_BULLETS:
            with self.subTest(bullet=bullet):
                found = separation_findings(self._agent([bullet], "## Mental model"))
                self.assertEqual([], found, f"false positive on: {bullet}")

    def test_one_finding_per_offending_bullet(self):
        found = [f for f in separation_findings(self._agent(DIRECTIVE_BULLETS))
                 if f.rule == "SEP5"]
        self.assertEqual(len(DIRECTIVE_BULLETS), len(found))

    def test_finding_quotes_the_offending_line(self):
        found = separation_findings(self._agent(["Write the ADR before starting implementation."]))
        self.assertIn("Write the ADR", found[0].message)
        self.assertIn("line 2", found[0].message)

    def test_multi_line_bullet_is_read_as_one_item(self):
        body = ("## Working agreement\n"
                "- Record the verdict in the events log before\n"
                "  handing off to the next persona.\n")
        self.assertIn("SEP5", rules(separation_findings(ent("agent", body))))

    def test_directive_in_a_later_sentence_of_a_judgment_bullet_is_not_caught(self):
        # Only the bullet's opening sentence is read as the imperative slot;
        # `must` is still checked across the whole item, which is what form 2
        # is for. This keeps trailing subordinate clauses from firing.
        body = "## Mental model\n- Architecture is expensive to reverse, and always has been.\n"
        self.assertEqual([], separation_findings(ent("agent", body)))

    def test_checkbox_bullet_is_caught(self):
        body = "## Working agreement\n- [ ] Verify the rollback has been run.\n"
        self.assertIn("SEP5", rules(separation_findings(ent("agent", body))))

    def test_emphasis_does_not_hide_the_imperative(self):
        body = "## Working agreement\n- **Use** the shipped template for every ADR.\n"
        self.assertIn("SEP5", rules(separation_findings(ent("agent", body))))

    def test_directive_bullet_inside_a_fence_is_ignored(self):
        body = "## Mission\nOwn it.\n\n```\n- Write the ADR before starting.\n```\n"
        self.assertEqual([], separation_findings(ent("agent", body)))

    def test_numbered_lists_are_still_caught_by_SEP1(self):
        body = "## Working agreement\n1. Open the file\n2. Edit the header\n"
        self.assertIn("SEP1", rules(separation_findings(ent("agent", body))))

    def test_skills_may_contain_rules_as_bullets(self):
        # Rules are what a skill is for — SEP5 is agent-only.
        body = ("## Rules\n"
                "- Record every decision.\n"
                "- The ADR must contain a rejected-alternatives section.\n"
                "- Always stamp the date.\n"
                "- Never merge without a green gate.\n")
        self.assertEqual([], separation_findings(ent("skill", body)))

    def test_shipped_agent_corpus_stays_clean(self):
        # The calibration guarantee: all 11 shipped agents were reviewed by
        # hand and must keep scoring zero. If this fails, either an agent
        # acquired a rule or SEP5 lost precision — both are worth stopping for.
        from scripts.navi_lint.registry import load_entries
        agents = [e for e in load_entries(REPO_ROOT) if e.kind == "agent"]
        self.assertGreaterEqual(len(agents), 11)
        hits = [f for e in agents for f in separation_findings(e)]
        self.assertEqual([], hits, f"shipped agents no longer clean: {hits}")


if __name__ == "__main__":
    unittest.main()
