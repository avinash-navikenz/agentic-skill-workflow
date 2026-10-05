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

    def test_every_install_flag_the_docs_advertise_actually_exists(self):
        """The page and the README print install commands as copyable text. Nothing
        runs them, so a flag that was renamed or never existed reads as working
        instructions — which is how the catalogue came to advertise a per-item
        install that did not work."""
        accepted = set(re.findall(r"^\s*(--[a-z-]+)[|)]", INSTALL.read_text(encoding="utf8"), re.M))
        accepted |= set(re.findall(r"\|(--[a-z-]+)\)", INSTALL.read_text(encoding="utf8")))
        self.assertIn("--agent", accepted, "install.sh must accept --agent")
        for doc in (ROOT / "docs" / "index.html", ROOT / "README.md"):
            text = doc.read_text(encoding="utf8")
            for flag in set(re.findall(r"\./install\.sh\s+(--[a-z-]+)", text)):
                self.assertIn(flag, accepted,
                              f"{doc.name} shows `install.sh {flag}`, which install.sh rejects")

    def test_the_page_offers_the_scoped_install_not_a_hand_copy(self):
        """Both hand-written install sections — the home teaser and the install
        page — drifted behind the generated panes once already."""
        page = (ROOT / "docs" / "index.html").read_text(encoding="utf8")
        self.assertNotIn("cp -R adapters/claude-code/skills/navi-skill-&lt;name&gt;", page,
                         "the page still tells people to copy a skill by hand")
        self.assertEqual(page.count("./install.sh --agent navi-agent-&lt;name&gt;"), 1,
                         "the install page should offer the scoped agent install, once")

    def test_every_item_offers_the_plugin_route(self):
        """The plugin is the one-command install and it reached none of the 61
        item panes — they offered only a clone. The marketplace manifest is the
        authority for the names in those two commands."""
        import json
        page = (ROOT / "docs" / "index.html").read_text(encoding="utf8")
        data = json.loads(re.search(
            r'<script id="navi-catalogue" type="application/json">(.*?)</script>',
            page, re.S).group(1))
        plugin = data["install_framework"]["plugin"]
        self.assertTrue(plugin["steps"], "no plugin steps on the install block")

        market = json.loads((ROOT / ".claude-plugin" / "marketplace.json").read_text())
        name = market["plugins"][0]["name"]
        self.assertIn(f"/plugin install {name}@{market['name']}", " ".join(plugin["steps"]),
                      "the plugin command does not match marketplace.json")
        src = pathlib.Path(market["plugins"][0]["source"].lstrip("./"))
        self.assertTrue((ROOT / src).is_dir(),
                        f"marketplace.json points at {src}, which does not exist")


if __name__ == "__main__":
    unittest.main()
