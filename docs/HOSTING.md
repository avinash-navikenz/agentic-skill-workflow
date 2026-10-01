# Reading and publishing the field guide

## Reading it: open the file

`docs/index.html` needs no web server and no hosting account.

```bash
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
open docs/index.html          # macOS;  xdg-open on Linux,  start on Windows
```

That is the whole procedure. The page is a single self-contained file — the only
external references are three Google Fonts links, which fall back to system fonts — and
nothing is fetched at runtime, so hash routes (`#/skills`, `#/agents/navi-agent-architect`)
work straight from `file://`.

**It is better from a clone than from a web server.** Every "on disk at …" link in the
catalogue points at `../<path>` relative to the page: from a clone those open the real
`SKILL.md`, `README.md`, `ADLC.md` and `SDD.md` beside it. Served from a web host, with
only the page uploaded, the same links 404.

Access control is whatever the repository already has. Nothing is exposed, nothing is
hosted, and there is nothing to keep running.

## Publishing it, if that changes

`.github/workflows/pages.yml` is written and working — its **build** job runs on every
push and proves both branches still assemble. The **deploy** job is gated behind a
repository variable and does nothing until somebody turns it on, because a workflow that
fails on every push is a check people stop reading.

To turn it on:

1. The repository must be **public**, or on **GitHub Pro** or above. Pages from a private
   repository is not available on the free plan — the API refuses it with *"Your current
   plan does not support GitHub Pages for this repository."*
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Not "Deploy from
   a branch": this workflow uploads an artifact, and the branch option ignores it.
3. Set the repository variable **`PUBLISH_PAGES`** to `true`.
4. **Allow `dev` to deploy.** Enabling Pages creates a `github-pages` environment whose
   branch policy permits the default branch only, so a push to `dev` builds and then fails
   at the deploy step with no explanation worth reading. Add it:

   ```bash
   gh api -X POST /repos/<owner>/<repo>/environments/github-pages/deployment-branch-policies \
     -f name=dev
   ```

   Or Settings → Environments → github-pages → Deployment branches → Add `dev`.

Then:

| Branch | URL |
| --- | --- |
| `main` | `https://avinash-navikenz.github.io/agentic-skill-workflow/` |
| `dev` | `https://avinash-navikenz.github.io/agentic-skill-workflow/dev/` |

A push to either branch rebuilds **both**: Pages serves one site per repository, so the
two copies are assembled into a single artifact by a job that checks out both branches —
the only way to publish two branches to one site without each deployment wiping the other.
The dev copy carries an orange banner and a link back to the stable page.

### The site would be public, whatever the repository is

GitHub Pages has **no access control** unless the repository is owned by an
**organization** on **GitHub Enterprise Cloud**, and even then every reader needs a GitHub
seat. `avinash-navikenz` is a User account, so that route is closed.

A login added to a static page in JavaScript is **not** access control: the HTML is served
to whoever requests the URL, and the content sits in the browser's network tab before any
script runs. If that is ever offered as a solution, it is theatre.

The Navikenz tenant names were already replaced with `contoso` throughout in preparation
for publishing. The rule still holds: **anything you would not post publicly does not
belong in the page.**

### If it must be both private and online

| Route | Login | Cost shape | Catch |
| --- | --- | --- | --- |
| Org on GitHub Enterprise Cloud | GitHub, Entra via SAML SSO | per seat | every reader needs a GitHub seat |
| Azure Static Web Apps, Standard | Entra, direct | per app | needs an Azure subscription |
| Cloudflare Pages + Access | Entra, direct | free to 50 users | a second vendor |

All three are real server-side access control. The Static Web Apps implementation was
written and then removed when no Azure subscription was available; it is in the history at
`62fb0b2` if it becomes an option.

## When a skill or agent is added

Nothing, either way. The build job regenerates the catalogue from the tree before
assembling, so the page a reader opens — from a clone or from Pages — matches what is in
the repository.
