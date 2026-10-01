import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_mcp_configs import check

GOOD = {"mcpServers": {"github": {"type": "http", "url": "https://api.githubcopilot.com/mcp/"}}}
ENV = "GITHUB_PERSONAL_ACCESS_TOKEN=\nADO_ORGANIZATION=\n"


def build(tmp, files, env=ENV, readme=None):
    """Write a config/mcp/ directory. `files` maps filename -> dict or raw string."""
    d = Path(tmp) / "config" / "mcp"
    d.mkdir(parents=True)
    for name, body in files.items():
        (d / name).write_text(body if isinstance(body, str) else json.dumps(body), encoding="utf8")
    if env is not None:
        (d / ".env.example").write_text(env, encoding="utf8")
    if readme is None:
        readme = "# MCP\n" + "".join(f"`{n}`\n" for n in files)
    (d / "README.md").write_text(readme, encoding="utf8")
    return Path(tmp)


def rules(findings):
    return sorted({f.rule for f in findings})


class TestMcpConfigs(unittest.TestCase):
    def run_check(self, **kwargs):
        with tempfile.TemporaryDirectory() as tmp:
            return check(build(tmp, **kwargs))

    def test_clean_set_has_no_findings(self):
        self.assertEqual(self.run_check(files={"github.mcp.json": GOOD}), [])

    def test_C0_empty_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "config" / "mcp").mkdir(parents=True)
            self.assertEqual(rules(check(Path(tmp))), ["C0"])

    def test_C1_unparseable_json(self):
        f = self.run_check(files={"broken.mcp.json": "{not json"})
        self.assertIn("C1", rules(f))

    def test_C2_wrong_top_level_key(self):
        f = self.run_check(files={"a.mcp.json": {"servers": {"x": {"command": "npx"}}}})
        self.assertIn("C2", rules(f))

    def test_C2_empty_server_map(self):
        self.assertIn("C2", rules(self.run_check(files={"a.mcp.json": {"mcpServers": {}}})))

    def test_C3_both_transports(self):
        bad = {"mcpServers": {"x": {"command": "npx", "url": "https://example.com"}}}
        self.assertIn("C3", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C3_neither_transport(self):
        bad = {"mcpServers": {"x": {"env": {}}}}
        self.assertIn("C3", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C3_remote_without_type(self):
        bad = {"mcpServers": {"x": {"url": "https://example.com/mcp"}}}
        self.assertIn("C3", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C3_plaintext_url(self):
        bad = {"mcpServers": {"x": {"type": "http", "url": "http://example.com/mcp"}}}
        self.assertIn("C3", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_literal_github_token_anywhere(self):
        bad = {"mcpServers": {"x": {"command": "docker",
                                    "args": ["--header", "ghp_0123456789abcdefghijklmnop"]}}}
        self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_literal_under_credential_key(self):
        # Matches no known token shape — an internal credential — and is caught anyway.
        bad = {"mcpServers": {"x": {"command": "uvx",
                                    "env": {"JIRA_API_TOKEN": "hunter2-internal"}}}}
        self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_reference_under_credential_key_is_fine(self):
        ok = {"mcpServers": {"x": {"command": "uvx",
                                   "env": {"JIRA_API_TOKEN": "${JIRA_API_TOKEN}"}}}}
        f = self.run_check(files={"a.mcp.json": ok}, env="JIRA_API_TOKEN=\n")
        self.assertEqual(f, [])

    def test_C4_non_credential_literal_is_fine(self):
        ok = {"mcpServers": {"x": {"command": "docker",
                                   "env": {"GITHUB_TOOLSETS": "repos,issues"}}}}
        self.assertEqual(self.run_check(files={"a.mcp.json": ok}), [])

    def test_C4_catches_the_token_formats_actually_in_use(self):
        """Every one of these was planted in `args` and reported NO findings.

        The key-name rule could not fire on an array element, and the sk- pattern
        could not cross a hyphen — so it matched only the retired OpenAI form.
        """
        for label, secret in [
            ("current OpenAI", "sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"),
            ("Anthropic", "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz01234"),
            ("Azure DevOps PAT", "abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrst"),
            ("legacy OpenAI", "sk-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab"),
        ]:
            bad = {"mcpServers": {"x": {"command": "docker", "args": ["run", secret]}}}
            with self.subTest(label):
                self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_catches_a_credential_in_a_url(self):
        bad = {"mcpServers": {"x": {"type": "http", "url": "https://user:S3cr3tP4ssw0rd@h/mcp"}}}
        self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_catches_a_literal_after_a_credential_flag(self):
        # A bespoke credential matches no public pattern; the flag before it is
        # what names it.
        bad = {"mcpServers": {"x": {"command": "docker", "args": ["run", "--token", "hunter2-internal"]}}}
        self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_catches_the_joined_and_header_argument_forms(self):
        """Both report no findings when only adjacent pairs are compared."""
        joined = {"mcpServers": {"x": {"command": "docker",
                                       "args": ["run", "--token=hunter2internal"]}}}
        self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": joined})))
        # The standard mcp-remote shape: the credential is inside one argument,
        # after a header name nothing else inspects.
        header = {"mcpServers": {"x": {"command": "npx",
                                       "args": ["mcp-remote", "--header",
                                                "Authorization: Bearer hunter2internal"]}}}
        self.assertIn("C4", rules(self.run_check(files={"a.mcp.json": header})))

    def test_C4_accepts_a_reference_written_the_way_a_header_is(self):
        ok = {"mcpServers": {"x": {"command": "npx",
                                   "args": ["mcp-remote", "--header",
                                            "Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"]}}}
        self.assertEqual(self.run_check(files={"a.mcp.json": ok},
                                        env="GITHUB_PERSONAL_ACCESS_TOKEN=\n"), [])

    def test_C3_rejects_a_non_string_url_rather_than_crashing(self):
        bad = {"mcpServers": {"x": {"type": "http", "url": 12345}}}
        self.assertIn("C3", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C4_leaves_ordinary_arguments_alone(self):
        ok = {"mcpServers": {"x": {"command": "npx",
                                   "args": ["-y", "@azure-devops/mcp", "${ADO_ORGANIZATION}",
                                            "--token", "${GITHUB_PERSONAL_ACCESS_TOKEN}"]}}}
        self.assertEqual(self.run_check(files={"a.mcp.json": ok},
                                        env="ADO_ORGANIZATION=\nGITHUB_PERSONAL_ACCESS_TOKEN=\n"), [])

    def test_C3_rejects_shapes_that_would_hide_a_credential_from_C4(self):
        for label, server in [
            ("non-object env", {"command": "x", "env": ["JIRA_API_TOKEN=secret"]}),
            ("non-string command", {"command": ["docker", "run"]}),
            ("non-object headers", {"type": "http", "url": "https://h/x", "headers": "a: b"}),
        ]:
            with self.subTest(label):
                self.assertIn("C3", rules(self.run_check(files={"a.mcp.json": {"mcpServers": {"x": server}}})))

    def test_C5_undocumented_variable(self):
        bad = {"mcpServers": {"x": {"command": "npx", "args": ["${NOT_DOCUMENTED}"]}}}
        self.assertIn("C5", rules(self.run_check(files={"a.mcp.json": bad})))

    def test_C5_missing_env_example(self):
        f = self.run_check(files={"a.mcp.json": GOOD}, env=None)
        self.assertIn("C5", rules(f))

    def test_C6_file_absent_from_readme(self):
        f = self.run_check(files={"a.mcp.json": GOOD}, readme="# MCP\nnothing listed\n")
        self.assertIn("C6", rules(f))

    def test_C6_readme_names_a_file_that_does_not_exist(self):
        f = self.run_check(files={"a.mcp.json": GOOD},
                           readme="# MCP\n`a.mcp.json` and `ghost.mcp.json`\n")
        self.assertIn("C6", rules(f))


if __name__ == "__main__":
    unittest.main()
