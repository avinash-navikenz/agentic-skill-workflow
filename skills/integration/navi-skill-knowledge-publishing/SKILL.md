---
name: navi-skill-knowledge-publishing
description: >
  Use when an artefact that lives in `delivery/` has to be readable by people who do not have
  the repository — a spec, an ADR, a postmortem — and is published to Confluence, an Azure
  DevOps wiki or a docs repository. Defines what is publishable, which direction edits flow,
  the concurrency token each platform demands, the markup each one accepts, when to go through
  an MCP server instead of a token, and how a published page is kept from going stale.
  Trigger phrases include: publish to Confluence, push the ADR to the wiki, share the spec with
  the business, postmortem write-up, Confluence page id, storage format, atlas_doc_format,
  azure devops wiki page, docs repo, MCP Atlassian, page version conflict, 409, stale wiki page.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: integration
  lifecycle_phases: [2, 3, 9]
  used_by_agents: [navi-agent-architect, navi-agent-devops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "confluence, wiki, publishing, adr, postmortem, mcp, azure-devops, github, integration"
  model: sonnet
---

## When to use

An ADR has been accepted and the people it binds do not read the repository; a postmortem is
finished and the lesson is for the whole organisation; a spec has passed its gate and the
business sponsor wants to read it; or a page published months ago is being quoted and nobody
has checked it against the file it came from.

This skill owns **distribution only** — which artefacts leave the repository, where they land,
what makes the copy traceable back, and how it is kept current. It owns nothing about content.
`navi-skill-decision-records` owns what an ADR contains and when it is Accepted;
`navi-skill-incident-response` owns what a postmortem says and how blamelessly;
`navi-skill-spec-authoring` owns the spec. If what is being published is wrong, this skill is
not where it is fixed — the artefact in `delivery/` is, and the page is republished afterwards.

## Rules

1. The repository is the source and the page is a copy. Every edit happens in `delivery/`,
   goes through review, and is published from there. A page edited in Confluence is a fork of
   the truth that nobody reviewed and nobody can diff.
2. Publish only what is settled: an ADR whose Status is Accepted, a postmortem that has been
   through its review, a spec that has passed its gate. Publishing a draft puts a half-decision
   in front of the people least able to tell it is one.
3. Record every publication in `delivery/published.md` — the source path, the page, the
   platform's page reference, the version it was written at, the commit it was published from,
   and the date. A page with no row is a page nobody can trace, update or retire.
4. Publish from a named commit and record it. "Published from `9f31c07`" is the only thing
   that makes "is this page stale?" a question a command can answer, rather than a feeling.
5. Re-publish when the source moves. Compare the source's last-changing commit against the
   commit in the register — `git log -1 --format=%h -- <source>` — and republish anything that
   has drifted. The page people quote is the one nobody has looked at since.
6. One source, one page, both ways. Two pages from one source gives two answers to the same
   question; two sources onto one page means the second publish silently destroyed the first.
7. Send the concurrency token the platform demands, and never omit it. Confluence requires
   `version.number` set to the current version plus one, and rejects anything else with 409.
   An Azure DevOps wiki page update requires `--version`, which is the page's ETag. The GitHub
   contents API requires the `sha` of the blob being replaced whenever the file already exists.
   Each of those exists to stop one publish overwriting another, and skipping it either fails
   loudly or — worse — succeeds over somebody's work.
8. Convert the markup; never paste markdown into a body that is not markdown. Confluence v2
   takes `storage` or `atlas_doc_format`; markdown sent as `storage` renders as a single
   paragraph of literal asterisks and hashes, and the page looks published until somebody reads it.
9. Prefer an MCP server when the session has one connected. It holds the credential, so no
   token is typed into a shell, pasted into a script or written into the register; read the
   tool list for its page-create and page-update tools rather than assuming their names. Fall
   back to REST with a token from the environment when there is no server.
10. Keep every credential out of the repository: out of the register, out of any publishing
    script, and out of the page's own body. A token committed once is a token rotated, not a
    token deleted in the next commit.
11. Put a backlink at the top of every published page: the source path and the commit it came
    from. Without it the page is an orphan the moment somebody copies a line out of it, and
    nobody can find out whether it is current.
12. Check the audience before the first publish, not after. A postmortem names systems, and
    sometimes people; an ADR names rejected vendors. A space that is open to the whole company
    is a different decision from a space that is open to the team, and it is made once per
    destination, by a person.
13. Retire orphans deliberately. When a source is deleted or archived, the page it produced
    is still live and still indexed — archive the page and remove the row, or restore the
    source. Leaving both is how a decision that was reversed keeps being quoted.
14. Publish the artefacts outside readers need, not the tree. ADRs, postmortems and gated
    specs have an audience beyond the repository; task lists, handoff records and gate evidence
    do not, and publishing them buries the three pages that mattered.
15. The page is never the evidence. A gate reads `delivery/`; a published page is a courtesy
    copy, and `navi-skill-phase-gate-protocol` is not satisfied by a link to a wiki.
16. Derive the page's title and location from the artefact, so the same source always lands in
    the same place. `ENG/Decisions/ADR-007` is findable by someone who has only the ADR number;
    a page titled after whatever the author was thinking that morning is not.

## Decision table

| Observed condition | Required action |
|---|---|
| An ADR has reached Status `Accepted` | Publish it, and add its row to `delivery/published.md` |
| A postmortem has been through its review | Publish it to the agreed space; check the audience first |
| A spec has passed its gate and has a non-technical audience | Publish it; link back to the path and commit |
| Someone edited the page instead of the file | Copy the change into `delivery/`, review it, republish over the page |
| A source has changed since the commit in the register | Republish, and update the commit and version in the row |
| A source is published to two pages | Retire one; one source, one page |
| Two sources write the same page | Split them; the second publish destroyed the first |
| Updating a Confluence page | `version.number` = current + 1, or the API answers 409 |
| Updating an Azure DevOps wiki page | `--version <ETag>` from the page's current state |
| Updating a file in a docs repository | `sha` of the blob being replaced |
| The body is markdown and the API takes storage | Convert it; markdown in a storage body renders as literal text |
| An MCP server for the destination is connected | Publish through it; no token reaches the shell or the repository |
| No MCP server is connected | REST, with the token read from the environment |
| A token is about to be written into a file | Stop; read it from the environment and rotate the one already written |
| A page is being published for the first time | Confirm who can read that space, with a person |
| A source was deleted or archived | Archive the page and remove its row |
| A gate needs the artefact | Point it at `delivery/`; a wiki link is not evidence |
| A page needs a title | Derive it from the artefact: `<space>/Decisions/ADR-007` |

## Template

The register, at `delivery/published.md`:

```markdown
# Published — navikenz shell

**Destination:** confluence
**Site:** https://contoso.atlassian.net/wiki
**Space:** ENG
**Route:** the Atlassian MCP server when the session has one connected; `curl` against
`/wiki/api/v2` when it does not. Both write the same page — only the transport differs, and
neither is allowed to become the place the content lives.

| Source | Page | Page id | Version | Published from | Published |
|---|---|---|---|---|---|
| delivery/decisions/ADR-007.md | ENG/Decisions/ADR-007 | 884736001 | 4 | `9f31c07` | 2026-09-28 |
| delivery/decisions/ADR-009.md | ENG/Decisions/ADR-009 | 884736002 | 1 | `9f31c07` | 2026-09-28 |
| delivery/decisions/ADR-014.md | ENG/Decisions/ADR-014 | 884736003 | 2 | `9f31c07` | 2026-09-28 |
| delivery/ops/postmortems/theme-persistence.md | ENG/Postmortems/theme-persistence | 884736010 | 3 | `9f31c07` | 2026-09-29 |
| delivery/changes/theme-persistence/specs/theme-preference/spec.md | ENG/Specs/theme-preference | 884736020 | 7 | `9f31c07` | 2026-09-28 |
```

The backlink every published page opens with, generated rather than typed:

```bash
SRC=delivery/decisions/ADR-007.md
SHA=$(git log -1 --format=%h -- "$SRC")
cat > /tmp/page.md <<EOF
> Published from \`$SRC\` at commit \`$SHA\`. Edits are made there and republished;
> an edit made on this page is lost at the next publish.

$(cat "$SRC")
EOF
```

Publishing to Confluence — the REST route, when no MCP server is connected:

```bash
SITE=https://contoso.atlassian.net/wiki
# The token comes from the environment. It is never written into a file in this repository.
AUTH="$JIRA_USER:$CONFLUENCE_API_TOKEN"

# The space's numeric id, which the page API wants rather than the key.
SPACE_ID=$(curl -sS -u "$AUTH" "$SITE/api/v2/spaces?keys=ENG" | jq -r '.results[0].id')

# Create. The body must be converted to a representation Confluence accepts;
# markdown sent as `storage` renders as literal asterisks.
curl -sS -u "$AUTH" -X POST -H "Content-Type: application/json" \
  "$SITE/api/v2/pages" \
  -d "$(jq -n --arg sid "$SPACE_ID" --arg title "ADR-007 Store theme preference server-side" \
          --rawfile body /tmp/page.storage.html \
          '{spaceId:$sid, status:"current", title:$title,
            body:{representation:"storage", value:$body}}')" \
  | jq -r '"page id \(.id) version \(.version.number)"'

# Update. The version must be the page's current version plus one; anything else
# is answered 409, which is the API refusing to overwrite somebody's edit.
CURRENT=$(curl -sS -u "$AUTH" "$SITE/api/v2/pages/884736001" | jq -r '.version.number')
curl -sS -u "$AUTH" -X PUT -H "Content-Type: application/json" \
  "$SITE/api/v2/pages/884736001" \
  -d "$(jq -n --argjson next "$((CURRENT + 1))" --arg title "ADR-007 Store theme preference server-side" \
          --rawfile body /tmp/page.storage.html \
          '{id:"884736001", status:"current", title:$title,
            body:{representation:"storage", value:$body},
            version:{number:$next, message:"republished from ADR-007.md"}}')" \
  | jq -r '"now version \(.version.number)"'
```

The same publish on the other two destinations:

```bash
# --- Azure DevOps wiki ------------------------------------------------------
# Create. Content comes from a file; there is no markup conversion, because the
# Azure DevOps wiki is markdown natively.
az devops wiki page create --wiki shell.wiki --path "/Decisions/ADR-007" \
  --file-path /tmp/page.md --encoding utf-8 \
  --org https://dev.azure.com/contoso --project shell \
  --comment "publish ADR-007 from delivery/decisions/ADR-007.md"

# Update. --version is the page's ETag, which `show` returns; it is this
# platform's version of the same concurrency check Confluence spells as a number.
ETAG=$(az devops wiki page show --wiki shell.wiki --path "/Decisions/ADR-007" \
         --org https://dev.azure.com/contoso --project shell --query eTag -o tsv)
az devops wiki page update --wiki shell.wiki --path "/Decisions/ADR-007" \
  --version "$ETAG" --file-path /tmp/page.md --encoding utf-8 \
  --org https://dev.azure.com/contoso --project shell \
  --comment "republish ADR-007 from delivery/decisions/ADR-007.md"

# --- A docs repository on GitHub -------------------------------------------
# The concurrency token here is the blob sha, and it is required whenever the
# file already exists. Omitting it on an existing path is rejected, not merged.
SHA=$(gh api repos/navikenz/handbook/contents/decisions/ADR-007.md --jq .sha 2>/dev/null)
gh api --method PUT repos/navikenz/handbook/contents/decisions/ADR-007.md \
  -f message="publish ADR-007 from delivery/decisions/ADR-007.md" \
  -f content="$(base64 < /tmp/page.md | tr -d '\n')" \
  ${SHA:+-f sha="$SHA"} \
  --jq '.content.sha'
```

The staleness sweep, run before any gate that cites a published artefact:

```bash
grep -E '^\|[[:space:]]*delivery/' delivery/published.md \
| awk -F'|' '{ for (i=2;i<=6;i++) gsub(/^[ \t]+|[ \t]+$/,"",$i); print $2 "\t" $6 }' \
| while IFS="$(printf '\t')" read -r src from; do
    from=$(echo "$from" | tr -d '`')
    latest=$(git log -1 --format=%h -- "$src")
    [ -n "$latest" ] || { echo "$src: no history — is the path right?"; continue; }
    case "$latest" in
      "$from"*) ;;
      *) git merge-base --is-ancestor "$latest" "$from" 2>/dev/null \
           || echo "$src has changed since it was published from $from (now $latest) — republish" ;;
    esac
  done
```

## Checklist

- [ ] Every published page's content came from `delivery/`, not from an edit on the page
- [ ] Nothing was published that is still a draft, unreviewed, or short of its gate
- [ ] Every publication has a row in `delivery/published.md`
- [ ] Every row names the commit the page was published from
- [ ] Every row's source still exists in the repository
- [ ] No source is published to two pages, and no two sources share a page
- [ ] Every update sent the platform's concurrency token — version, ETag or blob sha
- [ ] The body was converted to a representation the destination actually renders
- [ ] An MCP server was used where one was connected, so no token entered the shell
- [ ] No credential is in the register, in a publishing script, or in a page
- [ ] Every page opens with the source path and the commit it came from
- [ ] The audience of each destination space was confirmed by a person before first publish
- [ ] No page remains live for a source that was deleted or archived
- [ ] Every Accepted ADR and every reviewed postmortem has been published
- [ ] No gate cites a wiki link as its evidence
- [ ] Page titles are derived from the artefact, so the same source lands in the same place

## Anti-patterns

**Editing the page.** A typo is fixed in Confluence because it is one word. Three months later
the page and the ADR differ in four places, nobody knows which is right, and the repository —
the one with the review history — is the one that is wrong. Fix it in `delivery/` and republish.

**Publishing the draft.** The ADR is in Proposed, but the meeting is tomorrow and the page is
convenient. Half the organisation now believes a decision has been made, and the half that
objected at the meeting has to argue against something that already looks settled.

**The page with no row.** Somebody published an ADR by hand eighteen months ago. It is still
the top search result, it describes an approach that was reversed, and nothing in the
repository knows the page exists. Every publish gets a row.

**No commit in the register.** The row says the page was published, on a date. Whether the
source has changed since is now unanswerable without reading both and comparing by eye, which
is exactly what nobody does. Record the commit.

**Omitting the version.** The Confluence update is written without `version.number` because
the 409 was annoying. The call that finally worked overwrote an edit a colleague made that
morning, and Confluence recorded it as a normal new version. The token is the safety.

**Markdown in a storage body.** The page publishes successfully and renders as one long
paragraph of `##` and `**`. The API was never going to complain — `storage` is XHTML, and
markdown is valid text. Convert, then publish.

**The token in the script.** `publish.sh` with the Confluence API token on line 3, committed
so the pipeline could run it. It is now in the repository's history, in every clone and in
every fork. Read it from the environment; rotate the one that was committed.

**Publishing the whole tree.** A nightly job mirrors `delivery/` into the wiki. Four hundred
pages of handoff records and gate evidence, and the three ADRs anybody needed are on page nine
of the search results. Publish what has an audience.

**The orphaned page.** The change was archived and its spec moved; the page stayed. It is
indexed, it is quoted in a support article, and it describes behaviour the product has not had
since March. Archive the page when the source goes.

**The wiki link as evidence.** G3 recorded with a Confluence URL in the evidence field. The
page can be edited by anyone with the space, so the evidence can change after the gate passed.
Evidence lives in `delivery/`.

## Validation

```bash
REG=delivery/published.md
if [ ! -f "$REG" ]; then
  echo "no $REG — nothing records which artefact became which page, at which version, from which commit"
else
dest=$(sed -n 's/^\*\*Destination:\*\*[[:space:]]*//p' "$REG" | head -1)
space=$(sed -n 's/^\*\*Space:\*\*[[:space:]]*//p' "$REG" | head -1)
site=$(sed -n 's/^\*\*Site:\*\*[[:space:]]*//p' "$REG" | head -1)

case "$dest" in
  confluence|azure-devops-wiki|github-docs) ;;
  *) echo "$REG declares destination '$dest' — it must be confluence, azure-devops-wiki or github-docs, because the page reference, the concurrency token and the markup differ per platform" ;;
esac
case "$site" in
  https://*) ;;
  *) echo "$REG publishes to '$site' — a page written over anything but https is a page the path can rewrite" ;;
esac
echo "$site" | grep -qE '://[^/@[:space:]]+:[^/@[:space:]]+@' \
  && echo "$REG has a credential embedded in the destination URL — rotate it and use the platform's credential helper"

ROWS=$(grep -E '^\|[[:space:]]*delivery/' "$REG" \
  | awk -F'|' '{ for (i=2;i<=7;i++) gsub(/^[ \t]+|[ \t]+$/,"",$i); print $2 "\t" $3 "\t" $4 "\t" $5 "\t" $6 "\t" $7 }')

[ -n "$ROWS" ] || echo "$REG has no publication rows — the register exists and records nothing"

printf '%s\n' "$ROWS" | while IFS="$(printf '\t')" read -r src page ref ver from pub; do
  [ -n "$src" ] || continue
  [ -f "$src" ] || echo "$REG publishes $src, which this repository does not have — the page is still live and its source is gone"
  case "$page" in
    "$space"/*) ;;
    *) echo "$REG publishes $src to '$page', which is not under the declared space $space" ;;
  esac
  if [ "$dest" = "confluence" ]; then
    echo "$ref" | grep -qE '^[0-9]+$' \
      || echo "$REG records page reference '$ref' for $src — a Confluence page id is numeric, and an update addressed by title silently creates a second page"
    echo "$ver" | grep -qE '^[1-9][0-9]*$' \
      || echo "$REG records version '$ver' for $src — a Confluence update must send the current version number, and anything else is rejected 409"
  else
    [ -n "$ref" ] || echo "$REG records no page reference for $src"
    [ -n "$ver" ] || echo "$REG records no concurrency token for $src — an update that sends none overwrites whatever is there"
  fi
  sha=$(echo "$from" | tr -d '`')
  git cat-file -e "${sha}^{commit}" 2>/dev/null \
    || echo "$REG says $src was published from $sha, which is not a commit in this repository"
  echo "$pub" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' \
    || echo "$REG records publication date '$pub' for $src — use ISO yyyy-mm-dd"
done

printf '%s\n' "$ROWS" | cut -f3 | sort | uniq -d \
  | sed "s|^|$REG publishes two different sources onto one page — the second overwrites the first: |"
printf '%s\n' "$ROWS" | cut -f1 | sort | uniq -d \
  | sed "s|^|$REG publishes one source to two pages — readers now have two answers: |"

for adr in delivery/decisions/ADR-*.md; do
  [ -f "$adr" ] || continue
  status=$(sed -n '/^## Status/{n;p;}' "$adr" | head -1 | tr -d '[:space:]')
  [ "$status" = "Accepted" ] || continue
  grep -qF "| $adr |" "$REG" \
    || echo "$adr is Accepted and no row in $REG publishes it — the decision binds people who cannot see it"
done
for pm in delivery/ops/postmortems/*.md; do
  [ -f "$pm" ] || continue
  grep -qF "| $pm |" "$REG" \
    || echo "$pm is not published by $REG — a postmortem nobody outside the repository can read teaches nobody"
done

grep -nEi '(token|password|secret|api[_-]?key)[^A-Za-z0-9]{1,4}[A-Za-z0-9/+_=-]{16,}' "$REG" \
  | sed "s|^|$REG carries a credential — rotate it and use the platform's credential helper: |"
grep -n '<[a-z][a-z0-9 _-]*>' "$REG" | sed "s|^|$REG has an unfilled placeholder — |"
fi
```

Each command prints nothing when the rule holds. Two things it deliberately does not do. It
never calls the destination, so a row that is internally perfect and points at a page somebody
deleted last week still passes — only the publish itself finds that, which is why the publish
reads the page's current version back rather than assuming it. And staleness is the fourth
fence in the Template rather than a check here: on a fresh checkout every artefact shares one
commit, so a staleness comparison run against the repository's own fixture would report every
row stale and prove nothing. Run it on a real repository, before the gate.
