# Publishing the field guide, behind Entra

`docs/index.html` is published to **Azure Static Web Apps** with Microsoft Entra ID in
front of it. Two destinations, one workflow (`.github/workflows/site.yml`):

| Branch | Where it lands | Who can see it |
| --- | --- | --- |
| `main` | the production URL | anyone in the tenant you assign |
| `dev` | a named staging environment, its own URL | the same people, same login |

The dev copy carries an orange banner saying so. The two pages are otherwise identical,
and a preview read as released is the mistake worth one line of CSS to prevent.

## Why not GitHub Pages

GitHub Pages has no authentication. A login added to a static page in JavaScript is not
access control — the HTML is served to anyone who requests the URL, and the content is in
the network tab before any script runs.

GitHub *can* gate a Pages site, but only on **GitHub Enterprise Cloud**, and only to
people holding a **GitHub account with an org seat**; Entra is the identity provider, but
GitHub org membership is the authorisation. Static Web Apps asks a reader for an Entra
account and nothing else, which is the right trade when the audience is wider than the
engineers who already have seats.

## What to configure, once

### 1. Entra app registration

In **Microsoft Entra admin centre → App registrations → New registration**:

- **Name:** anything — `navi-delivery field guide` reads well in a consent prompt.
- **Supported account types:** *Accounts in this organizational directory only* (single
  tenant). This is the first of two things keeping the page internal.
- **Redirect URI:** *Web* →
  `https://<your-site>.azurestaticapps.net/.auth/login/aad/callback`

  Add a second one for the dev environment once Azure has given it a URL. The pattern is
  always `<site>/.auth/login/aad/callback`; these endpoints are provided by Static Web
  Apps, so there is nothing to build at those paths.

Then either:

- **Certificates & secrets → New client secret** — simplest, and expires, so diarise it; or
- **a user-assigned managed identity as a federated credential** — no secret to rotate.
  Assign the identity to the static web app only: anything else holding it can act as this
  app registration.

### 2. Restrict who can sign in

A single-tenant app still lets *everyone in the tenant* in. To narrow it:

**Entra → Enterprise applications → your app → Properties → Assignment required: Yes**,
then **Users and groups → Add** the group that should read it.

Without this step the page is open to the whole of Navikenz. That may be what you want —
decide it deliberately rather than inherit it.

### 3. The Static Web App

Create it on the **Standard** plan. Custom authentication — your own app registration —
is not available on Free, and Free's preconfigured providers cannot be pinned to your
tenant.

Under **Settings → Environment variables**, add:

| Name | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | the app registration's Application (client) ID |
| `AZURE_CLIENT_SECRET` | the client secret itself |

`site/staticwebapp.config.json` refers to these **by name only**, so no secret is ever in
git. If you took the managed-identity route instead, set
`OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID` to the managed identity's client ID and point
`clientSecretSettingName` at that name.

### 4. GitHub

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static Web App → **Manage deployment token** |
| Variable | `AZURE_TENANT_ID` | your Entra tenant ID |
| Variable | `PRODUCTION_URL` | optional; the dev banner links back to it |

`AZURE_TENANT_ID` is a variable rather than a secret because a tenant ID is not one — it
appears in every sign-in URL. It is kept out of git so the tenant can change without a
commit. The workflow **fails** if it is unset rather than deploying a site nobody can sign
in to.

## What the config does

`site/staticwebapp.config.json`, in order:

- **`routes`** — `/*` requires the `authenticated` role, so every path needs a sign-in.
  `/.auth/login/aad` stays open to `anonymous`, or nobody could reach the login.
- **`responseOverrides.401`** — redirects an unauthenticated visitor to the Entra login
  instead of showing them a 401. The page is for reading, not for debugging.
- **`navigationFallback`** — the guide is one file using hash routes (`#/skills`), so any
  path serves `index.html`. `/.auth/*` is excluded; those are the platform's.
- **`globalHeaders`** — a content security policy matching exactly what the page loads:
  Google Fonts, one inline style, one inline script. Nothing else, and no framing.

## Checking it works

The honest check is a reader who should *not* get in:

1. Open the production URL in a private window. You should be sent to Entra, not to the page.
2. Sign in as somebody in the assigned group. You should land on the guide.
3. Sign in as somebody in the tenant but **not** in the group. You should be refused.
   If they get in, step 2 of the Entra setup was skipped.
4. Open the dev URL. Same login, orange banner.

`/.auth/me` returns the signed-in identity as JSON, which is the quickest way to see what
the platform thinks about a session.

## When a skill or agent is added

Nothing. CI already fails a pull request whose generated files are stale, and this
workflow regenerates the catalogue before publishing — so a merge to `main` puts the new
entry on the site, and a merge to `dev` puts it on the preview.
