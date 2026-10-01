---
name: navi-skill-commit-craft
description: >
  Use when a commit is about to be made on a change branch — deciding what goes into it, what
  stays out, and writing the message that explains why the change is shaped the way it is.
  Defines the staging pass, the one-reason commit boundary, the drafted message file, and the
  trailers that bind a commit to its task and to the Azure DevOps, GitHub or Jira work item.
  Trigger phrases include: commit message, write a commit, git add, staging, git add -p,
  atomic commit, amend, fixup, commit body, why not what, conventional commit, commit trailer,
  co-authored-by, AB#, smart commit, link commit to work item.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: software-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer]
  owner: avinash.negi@navikenz.com
  tags: "git, commit, staging, atomic-commits, commit-message, trailers, azure-devops, github, jira"
  model: sonnet
---

## When to use

Work on a change branch has reached a point worth recording; a working tree holds more than one
reason for changing; a commit message is being written; or a commit that has not been pushed is
about to be amended, split or reordered.

`navi-skill-version-control-workflow` owns everything from the branch outward: the branch name,
the flag that guards a replacement, the squash that lands on the default branch and the subject
that squash carries. This skill owns everything inward of that — which hunks become one commit,
and what the body of each branch commit says that the diff cannot. Both skills write about
subjects; the one that reaches the default branch is version-control-workflow's, and the ones on
the branch that feed it are this skill's.

## Rules

1. Stage by hunk, never by tree. `git add -p` for every file, `git add <path>` only when the
   whole file is one reason. `git add -A` and `git add .` stage whatever else happened to be in
   the tree, and the review of that commit then covers work nobody described.
2. Read `git diff --staged` in full before every commit, and `git diff` afterwards to see what
   was left behind. A commit is the last moment a mistake is cheap to unmake.
3. Make each commit carry one reason for changing. A subject that needs `and` to be truthful is
   two commits; split with `git reset -p` and stage each half separately.
4. Keep the tree building at every commit on the branch. A commit that does not build cannot be
   bisected past and cannot be reverted alone, which is what makes the branch's history worth
   keeping at all.
5. Write the message into `delivery/changes/<name>/commits/<TASK-###>.msg` and commit it with
   `git commit -F`. The draft is reviewable before the commit exists, and the trailers are
   machine-checkable before they are frozen into history.
6. Open the message with a subject line, then an empty line, then the body. Git treats the first
   line as the subject and anything on line two as body text, so a message with no blank second
   line has no subject at all in `git log --oneline`, in every tracker that parses the commit,
   and in the pull request the squash generates.
7. Write the body under a `Why:` heading, and write in it what the diff cannot show: the
   constraint that forced this shape, the behaviour that broke without it, or the measurement
   that prompted it. The diff already states what changed; a body that restates it has
   duplicated the one part of the commit that cannot go stale.
8. Record the alternative that was rejected, on a `Rejected:` line, whenever an obvious simpler
   approach was not taken. The next reader's first instinct will be that simpler approach, and
   without this line they will try it, fail the same way, and pay the same cost twice.
9. End the message with trailers — `Satisfies:`, `Refs:`, `Tracker:`, `Co-authored-by:` — each
   on its own line, in the `Name: value` form `git interpret-trailers` parses. A trailer wrapped
   into a paragraph is prose, and every tool that reads trailers will miss it.
10. Put the framework ids on `Refs:` — the `TASK-###` this commit advances — and the acceptance
    criteria it satisfies on `Satisfies: AC-###`. Both must resolve: a `Refs:` naming a task
    that is in no `tasks.md` is a commit bound to nothing.
11. Put the tracker item on a single `Tracker:` line in the shape the host platform parses, and
    only that shape: `AB#1234` for Azure DevOps Boards, `#123` or `owner/repo#123` for GitHub
    Issues, `PROJ-123` for Jira. The three are not interchangeable — GitHub ignores `AB#1234`,
    Azure DevOps ignores a bare `#123`, and Jira links on the key alone.
12. Derive the platform from `git remote get-url origin` rather than from habit: a host
    containing `dev.azure.com` or `visualstudio.com` is Azure DevOps, `github.com` is GitHub,
    and anything else with a Jira project configured takes the Jira key. A repository mirrored
    to two hosts takes the trailer of the host the branch is pushed to.
13. Never put a closing keyword — `Fixes #123`, `Closes AB#1234`, `PROJ-123 #resolve` — in a
    branch commit. The branch is squashed, and every platform acts on the squash subject and
    body that reaches the default branch; a closing keyword on a branch commit either fires
    early or is silently dropped. Closing belongs on the pull request, which
    `navi-skill-pull-requests` owns.
14. Name every person who wrote part of the commit on a `Co-authored-by: Name <email>` trailer.
    All three platforms attribute on that trailer and on nothing else, so a pairing session
    recorded only in the body is a pairing session only one person is credited for.
15. Amend, squash and reorder freely while the commit is unpushed, and stop at the push.
    `git commit --amend`, `git rebase -i`, `git commit --fixup` and `--autosquash` are for
    tidying a branch before anyone reads it; after a push, rewriting is governed by
    `navi-skill-version-control-workflow`'s force-push rule.
16. Never write a subject that says nothing: `wip`, `fix`, `misc`, `update`, `cleanup`, `more`,
    `address review comments`, `PR feedback`. Each of these is a commit whose reason was known
    for about ten seconds and is now lost.
17. Never commit generated output, dependency trees, editor state or credentials as a side
    effect of a hunk-level stage. Check `git status --short` for untracked files before
    committing and add them to `.gitignore` rather than to the commit.
18. Write the branch's `Why:` lines so they survive the squash. The squash body that reaches
    the default branch is assembled from these drafts — see `navi-skill-pull-requests` for how —
    so a reason recorded only in a commit that is about to be collapsed is a reason that is
    about to be deleted.

## Decision table

| Observed condition | Required action |
|---|---|
| The working tree changes two files for two different reasons | Stage each with `git add -p`; make two commits |
| `git diff --staged` shows a hunk the subject does not describe | `git reset -p` that hunk; commit it separately |
| The subject needs `and` to be truthful | Split the commit |
| The message body is longer than one line | Draft it at `delivery/changes/<name>/commits/<TASK-###>.msg` and `git commit -F` |
| The body repeats what the diff shows | Replace it with the constraint, breakage or measurement that forced this shape |
| A simpler approach was tried and abandoned | Add a `Rejected:` line naming it and why it failed |
| The commit advances `TASK-006` | `Refs: TASK-006`, and the id resolves in `tasks.md` |
| The commit makes `AC-015` pass | `Satisfies: AC-015`, and the id resolves in the change's spec |
| `git remote get-url origin` contains `dev.azure.com` | `Tracker: AB#1234` |
| `git remote get-url origin` contains `github.com` | `Tracker: #123` or `Tracker: owner/repo#123` |
| The origin is neither, and the team tracks in Jira | `Tracker: PROJ-123` |
| The tracker item should close when this lands | Leave the closing keyword off the commit; put it on the pull request |
| Two people wrote the change | `Co-authored-by: Name <email>` for the second, on its own line |
| The commit is unpushed and its message is wrong | `git commit --amend`; re-read `git log -1 --format=%B` |
| The commit is unpushed and belongs in an earlier one | `git commit --fixup <sha>`, then `git rebase -i --autosquash` |
| The commit is pushed and a review thread is attached | Do not rewrite it — `navi-skill-version-control-workflow` rule 10 governs |
| `git status --short` shows an untracked build artifact | Add it to `.gitignore`; do not stage it |
| The tree does not build at this commit | Fold it into the next one before pushing, or fix it in the same commit |

## Template

The drafted message, at `delivery/changes/theme-persistence/commits/TASK-006.msg`:

```text
TASK-006: fall back to the request header when the store is unreadable

Why:
The preference store shares a connection pool with the session service, and a
pool exhaustion there took first render down with it in the 2026-09-14 outage.
Reading the store on the render path made an optional preference into a hard
dependency of every page. The Accept-CH header the shell already sends carries
enough to pick a theme, so the render path no longer waits on the store at all.

Rejected:
A five-second timeout around the store read. It keeps the dependency and turns
an outage into five seconds of blank page per request, which AC-015 measures as
a failure rather than a degradation.

Satisfies: AC-015
Refs: TASK-006
Tracker: AB#4421
Co-authored-by: Dan Okafor <dan.okafor@example.invalid>
```

The staging pass that produces it:

```bash
# 1. See everything, then stage one reason at a time.
git status --short
git add -p src/preferences/store.ts     # y/n per hunk; s splits, q stops

# 2. Read what is about to be committed, and what is being left behind.
git diff --staged
git diff

# 3. Commit from the draft rather than from the command line.
git commit -F delivery/changes/theme-persistence/commits/TASK-006.msg

# 4. Confirm git parsed a subject, a body and the trailers.
git log -1 --format='%s'
git log -1 --format='%(trailers:only=true,unfold=true)'

# 5. The leftover hunks are the next commit, not a footnote to this one.
git add -p src/preferences/store.ts
git commit -F delivery/changes/theme-persistence/commits/TASK-007.msg
```

The `Tracker:` line per platform — the three are not interchangeable:

```bash
# Which platform this repository is on, read rather than assumed.
case "$(git remote get-url origin)" in
  *dev.azure.com*|*visualstudio.com*) echo "Tracker: AB#4421" ;;   # Azure Boards
  *github.com*)                       echo "Tracker: #4421"  ;;    # or owner/repo#4421
  *)                                  echo "Tracker: SHELL-4421" ;; # Jira issue key
esac

# Confirm the platform read the link, once the branch is pushed:
az boards work-item show --id 4421 --query 'relations[].url' -o tsv   # Azure DevOps
gh api "repos/{owner}/{repo}/commits/$(git rev-parse HEAD)" --jq '.commit.message'  # GitHub
curl -sS -u "$JIRA_USER:$JIRA_TOKEN" \
  "$JIRA_BASE/rest/dev-status/latest/issue/detail?issueId=$ID&applicationType=github&dataType=repository"
```

Splitting a commit that turned out to hold two reasons, before it is pushed:

```bash
git reset --soft HEAD~1          # the changes come back, staged
git reset                        # unstage; the working tree is untouched
git add -p                       # stage the first reason only
git commit -F delivery/changes/theme-persistence/commits/TASK-006.msg
git add -p                       # the second reason
git commit -F delivery/changes/theme-persistence/commits/TASK-007.msg
git log --oneline -3
```

## Checklist

- [ ] Every hunk in `git diff --staged` is described by the subject
- [ ] The subject states one reason and does not need `and`
- [ ] The subject is not `wip`, `fix`, `misc`, `update`, `cleanup` or `address review comments`
- [ ] Line 2 of the message is empty
- [ ] The body has a `Why:` section stating a constraint, a breakage or a measurement
- [ ] A `Rejected:` line names the simpler approach, where one was abandoned
- [ ] `Refs:` names a `TASK-###` that exists in the change's `tasks.md`
- [ ] `Satisfies:` names `AC-###` ids that exist in the change's spec
- [ ] `Tracker:` carries exactly one id, in the shape the origin's platform parses
- [ ] No closing keyword (`Fixes`, `Closes`, `#resolve`) appears on a branch commit
- [ ] Every co-author has a `Co-authored-by: Name <email>` trailer
- [ ] `git status --short` shows no generated or credential-bearing file left untracked
- [ ] The tree builds at this commit
- [ ] Nothing amended or rebased here has been pushed

## Anti-patterns

**`git add -A` then write the subject.** The tree held the feature, a debug `console.log`, a
formatting pass over an untouched file and a half-finished experiment. All four are now one
commit called "add theme fallback", and the reviewer approves a diff that contains three things
nobody mentioned. Stage each reason with `git add -p` and commit it on its own.

**The what-body.** `Why: Changed store.ts to call readHeader() instead of readStore().` The diff
says that, in more detail, and forever. Write the reason the call changed: `the store shares a
pool with the session service and took first render down with it on 2026-09-14`.

**"Address review comments."** Four commits on the branch with that subject. Six months later
the bisect lands on one of them and the reader learns that somebody, once, had a comment. Name
what the comment made you change: `TASK-006: derive the theme from the session, not the body`.

**The missing blank line.** `TASK-006: fall back to the header` followed immediately by the
explanation on line two. Git now treats the whole paragraph as the subject; `git log --oneline`
is unreadable and every trailer parser sees a single run-on line. Leave line 2 empty.

**The wrapped trailer.** `... and it refs TASK-006, tracker AB#4421.` No tool will find either.
Put each trailer on its own line in `Name: value` form.

**The wrong platform's id.** `Tracker: AB#4421` in a repository whose origin is `github.com`.
Azure Boards' syntax means nothing to GitHub, so the commit links to nothing, and the omission
is invisible until somebody asks which change closed the issue. Read the origin, then choose.

**Closing from the branch.** `Fixes #4421` on the third of nine branch commits. On a squash
merge the platform sees only the squash message, so either the issue closed when that commit was
pushed to a shared branch or the keyword vanished. Close from the pull request.

**The uncredited pair.** The body says "worked on this with Dan". The platform credits one
author, the contribution graph credits one author, and the release notes credit one author. Add
`Co-authored-by: Dan Okafor <dan.okafor@example.invalid>`.

**The amend after the push.** The message was wrong, so `git commit --amend` and `git push
--force` — over a branch a reviewer had already started reading. The threads now point at a
commit that does not exist. Amend before the push; afterwards, add a commit.

## Validation

```bash
CHANGE=<name>
DRAFTS="delivery/changes/$CHANGE/commits"
TASKS="delivery/changes/$CHANGE/tasks.md"
SPECS="delivery/changes/$CHANGE/specs"

# Every drafted message is shaped so `git commit -F` produces a readable commit.
find "$DRAFTS" -name '*.msg' 2>/dev/null | while read -r m; do
  subject=$(head -1 "$m")
  [ ${#subject} -le 72 ] || echo "$m: subject is ${#subject} characters, over 72"
  case "$subject" in
    *.) echo "$m: subject ends in a full stop" ;;
  esac
  case "$subject" in
    *" and "*) echo "$m: subject joins two changes with 'and' — split the commit" ;;
  esac
  [ -z "$(sed -n 2p "$m")" ] || echo "$m: line 2 is not blank, so git reads no subject"
  grep -q '^Why:$' "$m" || echo "$m: no 'Why:' section — the diff already says what changed"
  grep -q '^Refs: ' "$m" || echo "$m: no 'Refs:' trailer naming the TASK ids"
  grep -q '^Tracker: ' "$m" || echo "$m: no 'Tracker:' trailer naming the work item"
  grep -nEi '^(fixes|closes|resolves|fixed|closed|resolved) ' "$m" \
    | sed "s|^|$m: closing keyword on a branch commit — close from the pull request: |"
done

# Every id a draft claims resolves where the framework keeps it.
for id in $(sed -n 's/^Refs: //p' "$DRAFTS"/*.msg 2>/dev/null | tr ',' ' '); do
  case "$id" in TASK-*) grep -q "\*\*$id\*\*" "$TASKS" \
    || echo "Refs names $id, which is in no tasks.md entry" ;; esac
done
for id in $(sed -n 's/^Satisfies: //p' "$DRAFTS"/*.msg 2>/dev/null | tr ',' ' '); do
  case "$id" in AC-*) grep -rq "$id" "$SPECS" \
    || echo "Satisfies names $id, which is in no spec" ;; esac
done

# Exactly one tracker id per draft, in a shape one of the three platforms parses.
sed -n 's/^Tracker: //p' "$DRAFTS"/*.msg 2>/dev/null \
  | grep -vE '^(AB#[0-9]+|([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?#[0-9]+|[A-Z][A-Z0-9]+-[0-9]+)$' \
  | sed 's|^|Tracker id is in no platform.s shape (AB#1234, #123, PROJ-123): |'

# Every co-author trailer carries an address, which is what the platforms credit on.
grep -h '^Co-authored-by:' "$DRAFTS"/*.msg 2>/dev/null \
  | grep -v '<[^@ ]\+@[^> ]\+>' \
  | sed 's|^|Co-authored-by with no <email> — the platform credits nobody: |'

# No commit on this branch carries a subject that says nothing, or an over-long one.
git log origin/main..HEAD --pretty=%s \
  | grep -inE '^(wip|fix|fixes|misc|update|updates|cleanup|more|stuff|minor|address(ed)?( review)? comments|pr feedback)( .*)?$' \
  | sed 's|^|branch commit subject says nothing: |'
git log origin/main..HEAD --pretty=%s \
  | awk 'length($0) > 72 { print "branch commit subject is " length($0) " characters: " $0 }'
```

Each command prints nothing when the rule holds. The `Why:` check is the one that decays
quietest: a body can satisfy every mechanical check above and still say only what the diff
says, which no script can tell — that one is read by the reviewer, under
`navi-skill-code-review`.
