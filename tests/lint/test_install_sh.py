"""install.sh had no tests, and shipped installing all 61 items or nothing.

The catalogue page offered every agent an "install this on its own" block whose
own note admitted the result would not work — the agent arrived without the
skills it is written to load. These tests pin the scoped install that replaced it.
"""
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
INSTALL = ROOT / "install.sh"
ADAPTER = ROOT / "adapters" / "claude-code"


def declared_skills(agent: str) -> list[str]:
    """The skills an agent's own file names — the installer's source of truth."""
    text = (ADAPTER / "agents" / f"{agent}.md").read_text(encoding="utf8")
    block = re.search(r"^skills:\s*$\n((?:\s*-\s*\S+\s*\n)+)", text, re.M)
    return re.findall(r"-\s*(\S+)", block.group(1)) if block else []


@unittest.skipUnless(shutil.which("bash"), "bash is required to run the installer")
class InstallScriptTest(unittest.TestCase):
    def run_install(self, *args, expect=0):
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        env = {**os.environ,
               "CLAUDE_SKILLS_DIR": str(self.skills),
               "CLAUDE_AGENTS_DIR": str(self.agents)}
        p = subprocess.run(["bash", str(INSTALL), *args, "--yes"],
                           cwd=ROOT, env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, expect,
                         f"exit {p.returncode}\nstdout: {p.stdout}\nstderr: {p.stderr}")
        return p

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.skills = pathlib.Path(self.tmp, "skills")
        self.agents = pathlib.Path(self.tmp, "agents")

    def installed(self):
        s = sorted(p.name for p in self.skills.iterdir()) if self.skills.exists() else []
        a = sorted(p.stem for p in self.agents.iterdir()) if self.agents.exists() else []
        return s, a

    def test_an_agent_brings_exactly_the_skills_it_declares(self):
        agent = "navi-agent-architect"
        self.run_install("--agent", agent)
        skills, agents = self.installed()
        self.assertEqual(agents, [agent])
        self.assertEqual(skills, sorted(declared_skills(agent)),
                         "a scoped agent install must bring its skills and no others")

    def test_a_skill_can_be_installed_on_its_own(self):
        self.run_install("--skill", "navi-skill-commit-craft")
        self.assertEqual(self.installed(), (["navi-skill-commit-craft"], []))

    def test_two_agents_sharing_a_skill_install_it_once(self):
        a, b = "navi-agent-architect", "navi-agent-qa-engineer"
        self.run_install("--agent", a, "--agent", b)
        skills, agents = self.installed()
        self.assertEqual(agents, sorted([a, b]))
        self.assertEqual(skills, sorted(set(declared_skills(a)) | set(declared_skills(b))))

    def test_uninstalling_one_agent_keeps_skills_another_still_holds(self):
        """Skills are shared. Removing the agent you stopped using must not
        break the one you kept."""
        a, b = "navi-agent-architect", "navi-agent-qa-engineer"
        self.assertTrue(set(declared_skills(a)) & set(declared_skills(b)),
                        "this test needs two agents that share a skill")
        self.run_install("--agent", a, "--agent", b)
        self.run_install("--agent", b, "--uninstall")
        skills, agents = self.installed()
        self.assertEqual(agents, [a])
        self.assertEqual(skills, sorted(declared_skills(a)))

    def test_no_selection_installs_everything(self):
        self.run_install()
        skills, agents = self.installed()
        self.assertEqual(len(skills), len(list((ADAPTER / "skills").glob("navi-skill-*"))))
        self.assertEqual(len(agents), len(list((ADAPTER / "agents").glob("navi-agent-*.md"))))

    def test_an_unknown_agent_is_refused_and_names_the_real_ones(self):
        p = self.run_install("--agent", "navi-agent-nope", expect=2)
        self.assertIn("no such agent", p.stderr)
        self.assertIn("navi-agent-architect", p.stderr)
        self.assertEqual(self.installed(), ([], []), "nothing may be installed on refusal")

    def test_a_flag_without_its_name_is_refused(self):
        p = subprocess.run(["bash", str(INSTALL), "--agent"],
                           cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(p.returncode, 2)
        self.assertIn("needs a name", p.stderr)


if __name__ == "__main__":
    unittest.main()
