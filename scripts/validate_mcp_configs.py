"""Checks for the MCP connection files in config/mcp/.

These files are inputs a team edits and then installs into a harness, so the
failure they invite is a credential pasted where a ${NAME} reference belongs —
and committed. C4 is the rule that exists for that. The rest keep the set
honest: a file that does not parse, a server shape no harness accepts, a
variable the .env.example never mentions, a file the README never lists.

C4 catches a credential three ways: by shape anywhere in the document, by the
key it sits under, and by the flag it follows in an args array. What it still
cannot catch is a bespoke internal credential passed as a bare positional
argument — `["run", "<secret>"]` is indistinguishable from an ordinary
argument, and guessing would reject the real ones. Review positional arguments
by eye; everything with a name on it is checked here.
"""
import json
import re
import sys
from collections import namedtuple
from pathlib import Path

Finding = namedtuple("Finding", "rule path message")

VAR = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}")

# Shapes that are a credential whatever key they sit under. Checked against every
# string in the document, so a token in an arg, a header or a URL is caught too.
SECRET_SHAPES = [
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{16,}"), "a GitHub token"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "a GitHub fine-grained token"),
    (re.compile(r"\bATATT[A-Za-z0-9_\-=.]{20,}"), "an Atlassian API token"),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\."), "a JWT"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"), "a Slack token"),
    # Hyphens included: the pattern without them matched only the retired
    # `sk-<40 alnum>` form and missed every current one — sk-proj-…, sk-ant-….
    (re.compile(r"\bsk-[A-Za-z0-9][A-Za-z0-9\-_]{19,}"), "an API key"),
    # Userinfo in a URL. `https://user:token@host/mcp` is an ordinary way to
    # write a credentialed endpoint and carries one in plain sight.
    (re.compile(r'https?://[^/\s:@"]+:[^/\s@"]+@'), "a credential in a URL"),
    # An Azure DevOps PAT has no prefix at all: 52 characters of base32. Bare
    # high-entropy strings are the format nothing else here can recognise, so
    # they are matched by shape — long, alphabet-restricted, and not a
    # ${NAME} reference or an ordinary word.
    (re.compile(r"\b[a-z2-7]{52}\b"), "an Azure DevOps personal access token"),
]

# A value under one of these keys must be a ${NAME} reference, never a literal —
# even a literal that matches no pattern above, because a bespoke or internal
# credential matches nothing and is exactly as committed.
SECRET_KEY = re.compile(r"TOKEN|SECRET|PASSWORD|_KEY$|^KEY$|\bPAT\b|AUTHORIZATION", re.I)

# The same idea for a positional argument: `["--token", "<literal>"]` carries a
# credential in a place no key name describes. The flag before it is the name.
SECRET_FLAG = re.compile(r"^--?(?:[a-z-]*-)?(?:token|secret|password|passwd|pat|key|apikey|api-key|auth)$", re.I)


def _flagged_args(server):
    """Yield (index, value) for each arg that follows a credential-shaped flag."""
    args = server.get("args")
    if not isinstance(args, list):
        return
    for i in range(len(args) - 1):
        flag, value = args[i], args[i + 1]
        if isinstance(flag, str) and isinstance(value, str) and SECRET_FLAG.fullmatch(flag):
            yield i + 1, value


def _strings(node, trail=""):
    """Every string in the document, with the key path that reached it."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _strings(v, f"{trail}.{k}" if trail else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _strings(v, f"{trail}[{i}]")
    elif isinstance(node, str):
        yield trail, node


def _check_server(name, server, path):
    out = []
    where = f"server '{name}'"
    has_cmd = "command" in server
    has_url = "url" in server
    if "command" in server and not isinstance(server["command"], str):
        out.append(Finding("C3", path, f"{where} has a non-string 'command'"))
    if "env" in server and not isinstance(server["env"], dict):
        out.append(Finding("C3", path, f"{where} has a non-object 'env' — C4 cannot read it, "
                                       "so a credential inside it would go unchecked"))
    if "headers" in server and not isinstance(server["headers"], dict):
        out.append(Finding("C3", path, f"{where} has a non-object 'headers'"))
    if has_cmd and has_url:
        out.append(Finding("C3", path, f"{where} sets both 'command' and 'url' — a server is "
                                       "one transport or the other, and no harness will guess"))
    elif has_cmd:
        if not isinstance(server.get("args", []), list):
            out.append(Finding("C3", path, f"{where} has a non-list 'args'"))
    elif has_url:
        url = server["url"]
        if not url.startswith("https://"):
            out.append(Finding("C3", path, f"{where} has a non-https url: {url!r}"))
        if server.get("type") not in ("http", "sse"):
            out.append(Finding("C3", path, f"{where} has a url but type {server.get('type')!r} — "
                                           "a remote server must declare 'http' or 'sse'"))
    else:
        out.append(Finding("C3", path, f"{where} has neither 'command' nor 'url'"))
    return out


def check(root: Path):
    out = []
    d = root / "config" / "mcp"
    files = sorted(d.glob("*.mcp.json"))
    if not files:
        return [Finding("C0", d, "no *.mcp.json files found")]

    env_example = d / ".env.example"
    documented = set()
    if env_example.exists():
        for line in env_example.read_text(encoding="utf8").splitlines():
            m = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
            if m:
                documented.add(m.group(1))
    else:
        out.append(Finding("C5", env_example, "missing — C5 cannot check any variable without it"))

    readme = d / "README.md"
    readme_text = readme.read_text(encoding="utf8") if readme.exists() else ""
    if not readme_text:
        out.append(Finding("C6", readme, "missing — the files have no manual"))

    for f in files:
        rel = f.relative_to(root)
        raw = f.read_text(encoding="utf8")
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError as exc:
            out.append(Finding("C1", rel, f"does not parse as JSON: {exc}"))
            continue

        if set(doc) != {"mcpServers"} or not isinstance(doc["mcpServers"], dict) or not doc["mcpServers"]:
            out.append(Finding("C2", rel, "top level must be exactly {\"mcpServers\": {<at least one>}} — "
                                          f"found keys {sorted(doc)}"))
            continue

        for name, server in doc["mcpServers"].items():
            if not isinstance(server, dict):
                out.append(Finding("C3", rel, f"server '{name}' is not an object"))
                continue
            out.extend(_check_server(name, server, rel))
            for index, value in _flagged_args(server):
                if value and not VAR.fullmatch(value):
                    out.append(Finding("C4", rel, f"server '{name}' args[{index}] is a literal "
                                                  f"following {server['args'][index - 1]!r}. Only a "
                                                  "${NAME} reference belongs after a credential flag"))

        for trail, value in _strings(doc):
            for pattern, what in SECRET_SHAPES:
                if pattern.search(value):
                    out.append(Finding("C4", rel, f"{trail} looks like {what}. Replace it with a "
                                                  "${NAME} reference and document NAME in .env.example"))
            # `env.JIRA_API_TOKEN` -> JIRA_API_TOKEN, but `args[3]` used to
            # yield `args[3]`, which matches nothing — so the key rule could
            # never fire on an array element, and `args` is exactly where this
            # file set puts values (`["-y", "@azure-devops/mcp", "${ADO_ORG}"]`).
            # Strip the index and use the array's own name.
            key = re.sub(r"\[\d+\]$", "", trail).rsplit(".", 1)[-1]
            if SECRET_KEY.search(key) and value and not VAR.fullmatch(value):
                out.append(Finding("C4", rel, f"{trail} is a literal under a credential-shaped key. "
                                              "Only a ${NAME} reference belongs here"))
            for var in VAR.findall(value):
                if documented and var not in documented:
                    out.append(Finding("C5", rel, f"{trail} references ${{{var}}}, which "
                                                  ".env.example does not document"))

        if readme_text and f.name not in readme_text:
            out.append(Finding("C6", rel, "is not named in config/mcp/README.md — a file nobody "
                                          "documented is a file nobody can install"))

    names = {f.name for f in files} | {".env.example"}
    for named in re.findall(r"`([A-Za-z0-9_.-]+\.mcp\.json)`", readme_text):
        if named not in names:
            out.append(Finding("C6", readme, f"names `{named}`, which does not exist"))

    return out


def main(argv):
    root = Path(argv[0]) if argv else Path.cwd()
    findings = check(root)
    for f in findings:
        print(f"{f.rule} {f.path}: {f.message}")
    n = len(sorted((root / "config" / "mcp").glob("*.mcp.json")))
    print(f"\n{len(findings)} finding(s) across {n} connection file(s)")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
