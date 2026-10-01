# Publishing the field guide

`docs/index.html` is published to **GitHub Pages** by `.github/workflows/pages.yml`:

| Branch | URL | |
| --- | --- | --- |
| `main` | `https://<owner>.github.io/<repo>/` | the stable page |
| `dev` | `https://<owner>.github.io/<repo>/dev/` | orange banner, links back to stable |

A push to either branch rebuilds **both**. Pages serves one site per repository, so the
two copies are assembled into a single artifact by a job that checks out both branches —
the only way to publish two branches to one site without each deployment wiping the other.

## The site is public. There is no way to gate it here.

Anyone with the URL can read every page, every skill and every agent README.

This is not a setting that was left off. GitHub Pages has **no access control** unless the
repository is owned by an **organization** on **GitHub Enterprise Cloud** — and even then,
every reader needs a GitHub account with a seat. A personal account cannot restrict a Pages
site at all.

And a login added to a static page in JavaScript is **not** access control: the HTML is
served to whoever requests the URL, and the content sits in the browser's network tab
before any script runs. If you ever see that offered as a solution, it is theatre.

So the rule for this page is simple: **anything you would not post publicly does not belong
in it.** Before publishing, the Navikenz tenant names were replaced with `contoso`
throughout for exactly this reason.

### If it must be private later

| Route | Login | Cost shape | Catch |
| --- | --- | --- | --- |
| Org on GitHub Enterprise Cloud | GitHub, Entra via SAML SSO | per seat | every reader needs a GitHub seat |
| Azure Static Web Apps, Standard | Entra, direct | per app | needs an Azure subscription |
| Cloudflare Pages + Access | Entra, direct | free to 50 users | a second vendor |

All three are real server-side access control. Static Web Apps was built and then removed
from this repository when it turned out no Azure subscription was available; the commit is
in the history if it becomes an option again.

## Turning it on, once

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Not "Deploy from
   a branch" — this workflow uploads an artifact, and the branch option would ignore it.
2. Push to `main`. The first run creates the site; the URL appears on the workflow summary
   and under Settings → Pages.
3. Create `dev` when you want a preview page. Until it exists the workflow publishes the
   stable page alone and says so in the log, rather than failing.

Nothing else. No secrets, no variables, no tokens.

## What the workflow does

- **Regenerates the catalogue** on both branches before publishing, rather than trusting
  what was committed. CI already fails a pull request whose generated files are stale, so
  by merge time they are current — regenerating anyway costs seconds and makes "the
  published page matches the tree" true by construction rather than by convention.
- **Stamps the dev copy** with `data-env="dev"` on `<html>`. The banner and its styling
  live in the page and are inert without that attribute, so there is no markup in the
  workflow to drift out of sync with the page.
- **Writes `.nojekyll`.** Pages runs Jekyll by default, which silently drops any path
  beginning with an underscore. Nothing here does today; the file costs nothing and removes
  the trap.
- **Never cancels a deployment in flight.** A half-uploaded site is worse than a late one.

## When a skill or agent is added

Nothing. Merge to `main` and the entry is on the site; merge to `dev` and it is on the
preview. The regeneration step is what makes that true without anyone remembering to run it.

## Reading it without a web server

The page is a single self-contained file — the only external references are three Google
Fonts links, which fall back to system fonts. Nothing is fetched at runtime, so
`docs/index.html` opens correctly straight from a clone over `file://`, hash routes and all.
That is the zero-infrastructure way to read it, and it respects whatever access control the
repository already has.
