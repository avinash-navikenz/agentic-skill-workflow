# MCP connections

Two skills in this framework reach systems outside the repository:
`navi-skill-work-item-sync` (Jira, Azure Boards) and `navi-skill-knowledge-publishing`
(Confluence, Azure DevOps Wiki). Both prefer an MCP server when the session has one
connected, and fall back to REST with a token read from the environment when it does
not. The reason is in those skills: an MCP server holds the credential, so no token
ever reaches the shell, the transcript, or a file in the repository.

This directory holds the connection files for that preferred route. They are inputs
you edit, not code the CLI reads — `navi` never opens them. The harness does.

## The files

| File | Route | Authenticates with | Needs |
| --- | --- | --- | --- |
| `atlassian-cloud.mcp.json` | Atlassian's hosted server, `https://mcp.atlassian.com/v2/mcp` | OAuth in the browser, as you | nothing |
| `atlassian-cloud-token.mcp.json` | `mcp-atlassian` run locally by `uvx` | Atlassian Cloud API token | `uv`, the six `JIRA_*`/`CONFLUENCE_*` variables |
| `azure-devops.mcp.json` | `@azure-devops/mcp` run locally by `npx` | your `az login` session | Node, Azure CLI, `ADO_ORGANIZATION` |
| `github.mcp.json` | GitHub's hosted server, `https://api.githubcopilot.com/mcp/` | OAuth in the browser, as you | nothing |
| `github-local.mcp.json` | `ghcr.io/github/github-mcp-server` in Docker | a personal access token | Docker, `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `.env.example` | — | — | copy it, fill it, source it; never commit the copy |

Prefer a hosted row. It carries no secret for you to leak, and it acts as you, so the
server can do nothing your own account cannot. Take a local row when your harness
cannot reach a hosted server, when you need the Data Center products, or when a
service account rather than a person must own the actions.

## Installing one

Each file is complete on its own: one server, under the `mcpServers` key that Claude
Code, Cursor and Windsurf all read. Install it in whichever of these ways suits you.

**Claude Code, one command** — this writes the entry for you, so nothing is copied:

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v2/mcp
claude mcp add --transport http github   https://api.githubcopilot.com/mcp/
claude mcp add ado -- npx -y @azure-devops/mcp "$ADO_ORGANIZATION"
```

**Any harness that reads `.mcp.json`** — copy the file to your project root as
`.mcp.json`, or merge its `mcpServers` entry into the `.mcp.json` you already have.
Merging is a key-level union: two files that each define `mcpServers` combine into one
object with both servers under it.

```bash
cp config/mcp/github.mcp.json .mcp.json          # first server
# second server, merged into the first, no editor needed:
python3 - <<'PY'
import json, pathlib
dst = pathlib.Path(".mcp.json"); src = pathlib.Path("config/mcp/atlassian-cloud.mcp.json")
cur = json.loads(dst.read_text()) if dst.exists() else {"mcpServers": {}}
cur["mcpServers"].update(json.loads(src.read_text())["mcpServers"])
dst.write_text(json.dumps(cur, indent=2) + "\n")
PY
```

**VS Code with GitHub Copilot** reads a different shape — `servers`, not `mcpServers`,
in `.vscode/mcp.json`. The server definitions themselves are identical; only the
wrapping key differs.

## Variables, and what must never be in these files

Every secret is a `${NAME}` reference the harness expands at launch. No file here
holds a credential, and `scripts/validate_mcp_configs.py` fails CI if one ever does —
it rejects any value shaped like a GitHub, Atlassian or JWT token, and any `${NAME}`
that `.env.example` does not document.

Copy `.env.example` to a path outside the repository, fill it in, and source it before
starting your harness. `.gitignore` already covers `config/mcp/.env`, but a file
outside the repository cannot be committed by accident at all.

## Server and Data Center

Both local rows above are written for Cloud. For Jira Server/Data Center,
`mcp-atlassian` takes `JIRA_PERSONAL_TOKEN` in place of `JIRA_USERNAME` and
`JIRA_API_TOKEN`. Its README does not document the Confluence equivalent, so read that
project's Authentication page before assuming a name — do not guess it from the Jira
one.

## Checking a connection works

The honest check is a read through the server, not a process that started:

1. Start your harness and confirm the server is listed (`claude mcp list`, or your
   harness's equivalent).
2. Ask for one specific record you can verify by eye — a work item you know the title
   of, a Confluence page you have open in a tab.
3. If it fails, the failure is almost always one of three: the OAuth consent was never
   completed, the variable is unset in the shell that launched the harness (not the
   one you typed in), or the account genuinely lacks access to that project.

A server that connects but returns nothing is case three more often than it looks.
