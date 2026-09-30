---
name: navi-skill-pull-requests
description: >
  Use when opening a pull request, or when a reviewer cannot tell from the description what the
  change is for. Defines the description written from the actual diff, the sections that carry
  what the diff cannot show, the reviewer's reading order, and how the tracker item is linked on
  Azure DevOps, GitHub and Jira.
  Trigger phrases include: pull request, PR description, open a PR, raise a PR, merge request,
  gh pr create, az repos pr create, draft PR, PR template, request reviewers, link work item to
  PR, what should the PR say.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: software-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer]
  owner: avinash.negi@navikenz.com
  tags: "git, pull-request, code-review, description, reviewers, azure-devops, github, jira"
  model: sonnet
---

## When to use

A branch is ready for review; a pull request is open and the description no longer matches what
the branch now contains; a reviewer has asked what the change is for; or the tracker item that
this change closes has to be linked to it.

`navi-skill-version-control-workflow` owns that a pull request exists at all — one per change,
squash-merged, into a protected default branch. `navi-skill-code-review` owns what happens after
it opens: the review conversation, the comment classes, thread resolution and the G5 record.
This skill owns only the artifact between them — the description, written from the diff that is
actually there, and what it has to say that the diff cannot.

## Rules

1. Write the description at `delivery/changes/<name>/pull-request.md` and give that file to the
   platform — `gh pr create --body-file`, or `az repos pr create --description "$(cat …)"`. A
   description typed into a web form exists only inside the platform, cannot be reviewed before
   it is published, and is lost when the repository moves host.
2. Derive it from the diff, with `git diff --stat origin/main...HEAD` and
   `git diff origin/main...HEAD`. Three dots, not two: two dots diffs the tip of the default
   branch against the branch and shows every change that landed on the default branch while the
   work was open, which is not what the reviewer is being asked to read.
3. Carry these six sections and no fewer: `## What changed`, `## Why`,
   `## What the diff does not show`, `## How it was verified`, `## Risk and rollback`,
   `## Reviewer guide`.
4. Write `## What changed` as one line per area of the diff, each naming the path the reviewer
   will open. A description that lists behaviours without paths makes the reviewer rebuild the
   mapping the author already had.
5. Write `## Why` from the change's `proposal.md` and the requirement it serves, not from the
   commit subjects. Commit subjects say what each step did; the reviewer is deciding whether
   the whole is worth merging.
6. Fill `## What the diff does not show` with at least the four things a diff structurally
   cannot carry: the alternative that was rejected and why; anything deliberately left alone
   inside the files touched; every out-of-band step the change needs to work (migration, flag
   default, configuration key, secret rotation, index build); and any behaviour that changes
   for a caller the diff does not contain.
7. Write `## How it was verified` as commands and their outcomes, naming the test paths that
   exist in the branch. "Tested locally" is not verification; `npm test -- test/integration/
   store-timeout.spec.ts — 1 passing` is.
8. Name a way back in `## Risk and rollback`: the flag that turns the new path off, or the
   revert of this squash. A pull request with no stated way back is one whose rollback plan is
   invented during the incident.
9. Write `## Reviewer guide` as a numbered reading order — the file to open first, then next,
   with one clause each saying what to look for. A reviewer who starts at the alphabetically
   first file reviews the migration before the reason for it.
10. Name the generated, vendored and mechanically-reformatted files explicitly and say so, so
    the reviewer skips them rather than reading a lockfile line by line.
11. Cite only `TASK-###` and `AC-###` ids that resolve in the change's `tasks.md` and spec. An
    id in a description that resolves nowhere is a claim the reviewer cannot check.
12. Cite only paths that exist on the branch. A path renamed after the description was written
    sends the reviewer to a file that is not there and costs them the benefit of the doubt.
13. Record the platform on a `**Platform:**` line — `Azure DevOps`, `GitHub` or `Jira` — read
    from `git remote get-url origin`, and link the tracker item the way that platform links it:
    Azure DevOps by `az repos pr create --work-items 4421`, which creates the link as a
    relation rather than parsing the text; GitHub by a closing keyword in the body
    (`Closes #4421`), which fires when the pull request merges into the default branch; Jira by
    the issue key in the branch name or the pull request title, which the Jira development
    panel indexes. Writing GitHub's keyword into an Azure DevOps description links nothing.
14. Open the pull request as a draft while any required check is red or the description is
    incomplete, and mark it ready in one action when both are settled. A reviewer who starts on
    a red branch spends their pass on failures the author already knows about.
15. Request review from the owner of every interface the diff changes, in addition to whoever
    the branch protection requires. Protection counts approvals; it does not know that this
    diff altered a contract three teams call.
16. Re-derive the description after every push that changes the diff, and update the file.
    A description that described the first version of the branch is worse than none, because
    the reviewer trusts it.
17. Never replace the description with a link to the tracker item. The tracker holds what was
    asked for; the pull request has to say what was done about it and what to look at.

## Decision table

| Observed condition | Required action |
|---|---|
| A branch is ready for review | Write `delivery/changes/<name>/pull-request.md`, then create the pull request from that file |
| The diff is being summarised | `git diff --stat origin/main...HEAD` — three dots |
| A simpler approach was rejected | Record it under `## What the diff does not show` |
| The change needs a migration, a flag default or a config key | Record the out-of-band step under `## What the diff does not show` |
| A lockfile or generated file is in the diff | Name it and say it is generated, so the reviewer skips it |
| The change alters a contract a caller outside the diff depends on | Name the caller, and request review from its owner |
| A required check is red | Open as a draft; `gh pr ready` once it is green |
| `git remote get-url origin` contains `dev.azure.com` | `az repos pr create --work-items 4421`; no closing keyword in the text |
| `git remote get-url origin` contains `github.com` | `Closes #4421` in the body |
| The team tracks in Jira | Put the issue key in the branch name or the title; the development panel indexes it |
| A push changed the diff after the description was written | Re-derive the description and update the file |
| A reviewer asks what the change is for | The answer belongs in `## Why`, not in a comment thread |
| The description would be "see AB#4421" | Not a description — write what was done and what to read first |
| The branch is 40 files and 2,300 lines | `navi-skill-version-control-workflow` rule 4 governs: split it before describing it |
| A review thread is open on lines about to be rewritten | `navi-skill-version-control-workflow` rule 10 governs: answer first, then push |

## Template

Copy into `delivery/changes/<name>/pull-request.md`:

```markdown
# theme-persistence: TASK-006 resolve the theme without the preference store

**Change:** `delivery/changes/theme-persistence`
**Platform:** Azure DevOps
**Tracker:** AB#4421
**Diff:** 4 files, +118 / -46, from `git diff --stat origin/main...HEAD`

## What changed

- `src/preferences/store.ts` — the render path no longer reads the preference store; the
  resolver takes the theme from the request header the shell already sends.
- `src/flags/index.ts` — the old store-read path stays behind `THEME_PERSISTENCE_ENABLED`.
- `test/integration/store-timeout.spec.ts` — new; asserts the AC-015 behaviour with the store
  unreachable.
- `delivery/changes/theme-persistence/rollout.md` — the wave that flips the default.

## Why

REQ-015 requires first render to degrade rather than fail when the preference store is
unreachable. On 2026-09-14 the store shared a connection pool with the session service, and
pool exhaustion there took first render down with it for eleven minutes. The store read was an
optional preference on a hard-dependency code path, and this change removes it from that path.

## What the diff does not show

- **Rejected:** a five-second timeout around the store read. It keeps the dependency and turns
  an outage into five seconds of blank page per request, which AC-015 measures as a failure
  rather than a degradation.
- **Left alone deliberately:** the write path in the same file still reads the store
  synchronously. It is not on the render path, and changing it would put an untested second
  behaviour into this diff. TASK-034 covers it.
- **Out of band:** `THEME_PERSISTENCE_ENABLED` must be created in the flag service, defaulting
  to `false`, before this merges. The rollout waves are in
  `delivery/changes/theme-persistence/rollout.md`.
- **Callers outside the diff:** the reporting job reads `user_preferences` directly and is
  unaffected; the shell's server-render path is the only caller that changes.

## How it was verified

- `npm test -- test/integration/store-timeout.spec.ts` — 1 passing; fails on `main`.
- `npm test` — full suite green.
- Staging, store scaled to zero: first render served the header theme in 180ms, one warning
  logged with no user id, which is what AC-015 states.

## Risk and rollback

The new path is behind `THEME_PERSISTENCE_ENABLED`, default `false`; flipping it off restores
the store read with no deploy. If the flag itself misbehaves, `git revert` of this squash
commit restores the previous behaviour in one commit. The old path is removed by TASK-034, in
its own merge, a week after the final wave.

## Reviewer guide

1. `src/preferences/store.ts` — the resolver's order of precedence: header, then store, then
   light. Check that no branch reaches the store before first paint.
2. `test/integration/store-timeout.spec.ts` — whether the test fails for the right reason when
   the store is up but slow, not only when it is absent.
3. `src/flags/index.ts` — the flag name matches the one `rollout.md` names.
4. `package-lock.json` is generated; nothing in it needs reading.
```

Creating the pull request from that file, per platform:

```bash
# Read the diff the reviewer will be asked to read. Three dots.
git fetch -q origin
git diff --stat origin/main...HEAD
git diff origin/main...HEAD | head -200

PR=delivery/changes/theme-persistence/pull-request.md

# GitHub: the body is the file; the closing keyword in it acts on merge.
gh pr create --base main --head "$(git branch --show-current)" \
  --title "theme-persistence: TASK-006 resolve the theme without the preference store" \
  --body-file "$PR" --reviewer navikenz/platform --draft
gh pr ready                       # once the required checks are green
gh pr view --json additions,deletions,changedFiles,files,isDraft

# Azure DevOps: the work item is a relation, not text in the description.
az repos pr create --source-branch "$(git branch --show-current)" --target-branch main \
  --title "theme-persistence: TASK-006 resolve the theme without the preference store" \
  --description "$(cat "$PR")" --work-items 4421 --draft true

# Jira-tracked host: the issue key in the title is what the development panel indexes.
gh pr create --title "SHELL-4421 theme-persistence: resolve the theme without the store" \
  --body-file "$PR"
```

Re-deriving the description after a push that changed the diff:

```bash
git fetch -q origin
git diff --stat origin/main...HEAD           # compare against the "**Diff:**" line
git diff --name-only origin/main...HEAD | while read -r f; do
  grep -q "$f" delivery/changes/theme-persistence/pull-request.md \
    || echo "changed but undescribed: $f"
done
```

## Checklist

- [ ] The description is a file under the change directory, not text typed into the platform
- [ ] It was derived from `git diff origin/main...HEAD`, with three dots
- [ ] All six required sections are present
- [ ] `## What changed` names a path for every area of the diff
- [ ] `## What the diff does not show` carries the rejected alternative, what was left alone, every out-of-band step and every affected caller outside the diff
- [ ] `## How it was verified` names commands and outcomes, not "tested locally"
- [ ] `## Risk and rollback` names a flag or a revert
- [ ] `## Reviewer guide` is a numbered reading order
- [ ] Generated and vendored files are named as such
- [ ] Every `TASK-###` and `AC-###` resolves; every path exists on the branch
- [ ] `**Platform:**` matches the origin, and the tracker is linked the way that platform links it
- [ ] The pull request was a draft until the checks were green
- [ ] The owner of every interface the diff changes was requested as a reviewer
- [ ] The description was re-derived after the last push

## Anti-patterns

**"See AB#4421."** The whole description. The tracker says what was asked for eleven weeks ago;
it does not say what this branch did about it, what was left out, or which file to open first.
Write the six sections.

**The commit-log description.** The body is `git log --oneline` pasted in. The reviewer can
already see the commits, and what they needed — the reason the whole is worth merging — is the
one thing not in them. Write `## Why` from the proposal.

**Two-dot diff.** `git diff origin/main..HEAD` in a branch that has been open a week. The
description now claims the reviewer is reading changes that arrived on `main` from four other
merges. Use `origin/main...HEAD`.

**The undisclosed migration.** The diff is clean and the description says nothing about the
index that must exist before the query in it will return in under a minute. It is created by
hand in production at 11pm. Put every out-of-band step in `## What the diff does not show`.

**The stale description.** Written at the first push, four pushes ago. It describes a design
the branch abandoned, and the reviewer reviews the description. Re-derive it after every push.

**The lockfile ambush.** 3,400 lines of generated dependency tree in the diff, unmentioned. The
reviewer either reads it or skips the whole diff. Name the generated files and say they are
generated.

**Alphabetical review.** No reading order, so the reviewer opens the migration first and spends
the pass reconstructing why it exists. Write the numbered guide.

**The wrong platform's link.** `Closes #4421` in an Azure DevOps pull request description. Azure
DevOps does not parse it, the work item stays open, and nobody notices until the sprint review.
Link with `--work-items`.

**Ready while red.** The pull request opens with three failing checks and a request for review.
The reviewer's entire pass is spent on failures the author already knew about. Open as a draft.

## Validation

```bash
CHANGE=<name>
PR="delivery/changes/$CHANGE/pull-request.md"
TASKS="delivery/changes/$CHANGE/tasks.md"
SPECS="delivery/changes/$CHANGE/specs"

# The six sections a reviewer cannot work without.
for h in "## What changed" "## Why" "## What the diff does not show" \
         "## How it was verified" "## Risk and rollback" "## Reviewer guide"; do
  grep -q "^$h\$" "$PR" || echo "pull-request.md has no '$h' section"
done

# The header block records the change, the platform and the tracker item.
grep -q '^\*\*Change:\*\* ' "$PR" || echo "pull-request.md names no change directory"
grep -E '^\*\*Platform:\*\* ' "$PR" | grep -qE '(Azure DevOps|GitHub|Jira)$' \
  || echo "'**Platform:**' is not one of Azure DevOps / GitHub / Jira"
grep -E '^\*\*Tracker:\*\* ' "$PR" \
  | grep -vE '^\*\*Tracker:\*\* (AB#[0-9]+|([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?#[0-9]+|[A-Z][A-Z0-9]+-[0-9]+)$' \
  | sed 's|^|Tracker id is in no platform.s shape (AB#1234, #123, PROJ-123): |'

# Every path the reviewer is sent to exists on the branch.
grep -oE '`[A-Za-z0-9_./-]+\.[A-Za-z0-9]+`' "$PR" | tr -d '`' | sort -u | while read -r p; do
  case "$p" in
    */*) [ -e "$p" ] || echo "pull-request.md points the reviewer at $p, which is not in the tree" ;;
  esac
done

# Every framework id the description cites resolves.
for id in $(grep -oE 'TASK-[0-9]{3,}' "$PR" | sort -u); do
  grep -q "\*\*$id\*\*" "$TASKS" || echo "pull-request.md names $id, which is in no tasks.md entry"
done
for id in $(grep -oE 'AC-[0-9]{3,}' "$PR" | sort -u); do
  grep -rq "$id" "$SPECS" || echo "pull-request.md names $id, which is in no spec"
done

# The two sections that are most often left as headings.
[ "$(awk '/^## What the diff does not show$/{on=1;next} /^## /{on=0} on' "$PR" \
     | grep -c '[^[:space:]]')" -ge 4 ] \
  || echo "'## What the diff does not show' carries less than the four things a diff cannot show"
[ "$(awk '/^## Reviewer guide$/{on=1;next} /^## /{on=0} on' "$PR" \
     | grep -c '^[0-9]\+\. ')" -ge 1 ] \
  || echo "'## Reviewer guide' states no reading order"

# A way back is named, not implied.
awk '/^## Risk and rollback$/{on=1;next} /^## /{on=0} on' "$PR" \
  | grep -qE 'git revert|flag' \
  || echo "'## Risk and rollback' names neither a flag nor a revert"
```

Each command prints nothing when the rule holds. Nothing here can tell whether the description
still matches the diff — re-derive it with `git diff --stat origin/main...HEAD` before marking
the pull request ready, and compare it against the `**Diff:**` line by eye.
