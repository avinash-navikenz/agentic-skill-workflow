"""The hand-written docs state counts. This fails when one of them goes stale.

docs/index.html's counts are generated and checked by build_catalogue.py. The
README and docs/CLI.md are written by hand, and their numbers aged silently:
the README said 45 skills at 50, and both said "seven verbs" after the eighth
landed. A count a person types is a count that will be wrong, so it is checked
here rather than trusted.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORDS = {7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve",
         13: "Thirteen", 14: "Fourteen"}


def skills():
    return sum(1 for _ in (ROOT / "skills").glob("*/*/SKILL.md"))


def agents():
    return sum(1 for d in (ROOT / "agents").iterdir() if d.is_dir())


def disciplines():
    return sum(1 for d in (ROOT / "skills").iterdir() if d.is_dir())


def verb_names():
    """The CLI's verbs, in order, read from the dispatcher's own COMMANDS map."""
    src = (ROOT / "cli" / "index.js").read_text(encoding="utf8")
    block = src.split("const COMMANDS = {", 1)[1].split("};", 1)[0]
    return re.findall(r"^\s*(\w+):\s*\(\)\s*=>", block, re.MULTILINE)


def verbs():
    return len(verb_names())


class TestDocCounts(unittest.TestCase):
    def setUp(self):
        self.readme = (ROOT / "README.md").read_text(encoding="utf8")
        self.cli_doc = (ROOT / "docs" / "CLI.md").read_text(encoding="utf8")

    def test_readme_states_the_real_counts(self):
        text = re.sub(r"\s+", " ", self.readme)
        for n, phrase in [(agents(), "persona agents"), (skills(), "skills"),
                          (disciplines(), "disciplines")]:
            self.assertIn(f"{n} {phrase}", text,
                          f"README.md does not say '{n} {phrase}' — the tree has {n}")

    def test_the_verb_count_is_the_same_in_three_places(self):
        n = verbs()
        word = WORDS[n]
        self.assertIn(f"{word.lower()}-verb CLI", self.readme,
                      f"README.md does not call it a {word.lower()}-verb CLI; "
                      f"cli/index.js dispatches {n} verbs")
        self.assertTrue(self.cli_doc.lstrip().startswith(f"# CLI reference"),
                        "docs/CLI.md no longer opens with its title")
        self.assertIn(f"{word} verbs.", self.cli_doc,
                      f"docs/CLI.md does not say '{word} verbs.'; cli/index.js dispatches {n}")
        self.assertIn(f"## The {word.lower()} verbs", self.readme,
                      f"README.md's verb section heading does not say {word.lower()}")

    def test_every_dispatched_verb_has_a_reference_section(self):
        for verb in verb_names():
            self.assertRegex(self.cli_doc, rf"(?m)^## `{verb}[ `<]",
                             f"docs/CLI.md has no `## {verb}` section, but the CLI dispatches it")

    def test_the_usage_line_lists_exactly_the_dispatched_verbs(self):
        line = re.search(r"^navi-delivery <([^>]+)>", self.cli_doc, re.MULTILINE)
        self.assertIsNotNone(line, "docs/CLI.md has no `navi-delivery <...>` usage line")
        self.assertEqual(line.group(1).split("|"), verb_names(),
                         "docs/CLI.md's usage line does not match cli/index.js's COMMANDS map")

    def test_every_rule_a_validator_emits_is_documented(self):
        """A rule table that lists M1-M7 while the script emits M8 is a table that
        says the check does not exist. Both of this repo's validators grew a rule
        after their tables were written."""
        manifests = (ROOT / "scripts" / "validate_manifests.py").read_text(encoding="utf8")
        separation = (ROOT / "scripts" / "lint_separation.py").read_text(encoding="utf8")
        emitted = set(re.findall(r'Finding\("(M\d)"', manifests))
        emitted |= set(re.findall(r'print\(f"(M\d) ', manifests))
        emitted |= set(re.findall(r'Finding\("(SEP\d)"', separation))
        for rule in sorted(emitted):
            self.assertIn(f"| `{rule}` |", self.cli_doc,
                          f"docs/CLI.md's rule table omits {rule}, which the validator emits")

    def test_the_disciplines_table_matches_the_skills_tree(self):
        """The table is hand-maintained and the tree is not. It silently fell four
        skills behind in two disciplines, and omitted `integration` entirely."""
        block = re.search(r"\| Discipline \| Skills \|\n\|---\|---\|\n((?:\|.*\n)+)", self.readme)
        self.assertIsNotNone(block, "README.md has no disciplines table")
        listed = {n: int(c) for n, c in re.findall(r"\| `([a-z-]+)` \| (\d+) \|", block.group(1))}
        actual = {d.name: len(list(d.glob("*/SKILL.md")))
                  for d in (ROOT / "skills").iterdir() if d.is_dir()}
        self.assertEqual(listed, actual,
                         "README.md's disciplines table disagrees with skills/")


if __name__ == "__main__":
    unittest.main()
