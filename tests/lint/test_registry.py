import unittest, tempfile
from pathlib import Path
from scripts.navi_lint.registry import load_entries

SKILL = "---\nname: navi-skill-alpha\nmetadata:\n  kind: skill\n---\nbody\n"
AGENT = "---\nname: navi-agent-architect\nmetadata:\n  kind: agent\n---\nbody\n"

class TestRegistry(unittest.TestCase):
    def test_discovers_both_kinds(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            sd = root / "skills" / "architecture" / "navi-skill-alpha"; sd.mkdir(parents=True)
            (sd / "SKILL.md").write_text(SKILL, encoding="utf-8")
            ad = root / "agents" / "navi-agent-architect"; ad.mkdir(parents=True)
            (ad / "navi-agent-architect.agent.md").write_text(AGENT, encoding="utf-8")
            entries = load_entries(root)
            self.assertEqual({e.kind for e in entries}, {"skill", "agent"})
            self.assertEqual({e.name for e in entries}, {"navi-skill-alpha", "navi-agent-architect"})

    def test_empty_tree_returns_empty_list(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(load_entries(Path(t)), [])

if __name__ == "__main__":
    unittest.main()
