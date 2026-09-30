---
name: navi-skill-code-review
description: >
  Use when reviewing a pull request, responding to review comments, or deciding whether a
  change may merge. Defines who reviews, what is read against what, the three comment classes,
  how a blocking comment is resolved, and what G5 accepts as the review record.
  Trigger phrases include: code review, review this PR, pull request, blocking comment,
  approve, request changes, resolve the thread, merge criteria, reviewer, self-approval.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: software-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer, navi-agent-architect]
  owner: OWNER_TBD
  tags: "code-review, pull-request, quality, g5, collaboration"
  model: sonnet
---

## When to use

A pull request is open and needs reviewing, review comments have arrived and need answering,
or G5 is about to be recorded and needs the review record.

## Rules

1. Review every change that reaches the default branch, and never approve a change written by
   the reviewer. G5's exit criterion is that review is complete with every blocking comment
   resolved; a self-approval records that nobody read it.
2. Read the diff against the artifacts, not against taste. Open the change's `spec.md` for the
   `AC-###` it claims, and `design.md` for the `CONTRACT-###` it touches, before the first
   comment. A review conducted from the diff alone can only find what the diff shows.
3. Scope one pull request to one `delivery/changes/<name>` and name it in the description with
   the `TASK-###` ids it completes. A pull request carrying two changes cannot be reverted as
   either one.
4. Let the automated checks finish before the human review starts. A reviewer spending
   attention on what a linter reports is attention not spent on the error path.
5. Label every comment as exactly one of `blocking:`, `non-blocking:`, or `question:` as the
   first token of the comment. G5 counts blocking comments; an unlabelled comment cannot be
   counted, and its author's intent is guessed by whoever wants to merge.
6. Ground every `blocking:` comment in something the author can check against: an `AC-###`, a
   `CONTRACT-###`, a `THREAT-###`, a rule in a `navi-skill-*` file, or a defect the reviewer
   can describe as an input and a wrong output. A preference with no such ground is
   `non-blocking:` regardless of how strongly it is held.
7. Resolve a blocking comment in exactly one of three ways: a change in the diff, a change to
   the spec or design that removes the requirement behind it, or a recorded decision — an
   `ADR-###` or a waiver under `navi-skill-waivers-and-deferrals`. Agreement in a thread is
   not a resolution.
8. Let the comment's author mark it resolved. An author who disagrees with a blocker answers
   it in the thread and, if the disagreement stands, escalates through
   `navi-skill-handoff-protocol` with `kind: review` rather than resolving it unilaterally.
9. Answer every comment, including the ones being declined, with the reason. A force-push that
   silently removes the code a comment was attached to leaves the reviewer no way to tell
   agreement from oversight.
10. Turn every `non-blocking:` comment that will be acted on later into a tracker issue —
    Azure DevOps work item, GitHub issue, or Jira issue — and put its id in the thread before
    resolving. A `TODO` added in the diff carries that id in the code, or it is not added.
11. Require the Security Engineer as a reviewer whenever the diff changes a file named in a
    threat model's `mitigated` disposition or its `Verify` line, adds a dependency, touches
    authentication, authorisation, session handling, or cryptography, or adds a route that
    accepts input. That routing is mechanical, not a judgment call at review time.
12. Treat a secret in the diff as blocking, and as an incident: the credential is exposed the
    moment it exists in the branch history, so it is rotated rather than removed in a follow-up
    commit.
13. Review before merge. There is no merge-then-address: the leverage of a review is that the
    code has not shipped, and a comment on merged code competes with the next change.
14. Record the review for G5 as `delivery/changes/<name>/evidence/g5-review.md`: the pull
    request reference, the reviewers, and every blocking comment with how it was resolved.
    The gate reads the record, not the review tool.

## Decision table

| Observed condition in the diff or the review | Required action |
|---|---|
| The author is the only approver | Not reviewed — find a reviewer; G5 cannot record complete |
| The pull request touches two `delivery/changes/<name>` | Split it; each change merges and reverts on its own |
| Automated checks are red | Do not start the human review |
| A comment has no `blocking:`/`non-blocking:`/`question:` label | Ask the author to label it before counting it |
| A blocker is grounded only in preference | Relabel `non-blocking:`; merging is not conditional on taste |
| A blocker is grounded in an `AC-###` the diff does not satisfy | Blocking until the diff, the spec, or a recorded decision changes |
| The author disagrees with a blocker | Answer in the thread; escalate with `kind: review`; never self-resolve |
| A non-blocking comment will be acted on later | Create the tracker issue; put its id in the thread and in any `TODO` |
| The diff removes or weakens a test named in a `THREAT-###` `Verify` line | Security Engineer review required before merge |
| The diff touches auth, sessions, crypto, or adds an input route | Security Engineer review required before merge |
| The diff adds or upgrades a dependency | Security Engineer review, and re-run `navi-skill-dependency-vulnerabilities` |
| The diff changes a response shape, a schema, or an event payload | Check it against its `CONTRACT-###` and the breaking-change test |
| A secret, token or key appears anywhere in the diff | Blocking; rotate the credential, then remove it |
| A new `TODO` carries no tracker id | Blocking; add the id or delete the `TODO` |
| An `AC-###` in scope has no test in the diff | Blocking; `navi-skill-test-driven-development` owns the cycle |
| A `TASK-###` is checked off with no `Implements:` line | Blocking; T1 will fail at G5 |
| The change is urgent and a blocker is open | Record a waiver with an expiry, or fix it; never merge past an unresolved blocker |

## Template

Reviewing, from the command line:

```bash
# 1. Read the artifacts before the diff
CHANGE=theme-persistence
sed -n '/#### AC-00[1-9]/,+4p' delivery/changes/$CHANGE/specs/theme/spec.md
grep -A12 '^### CONTRACT-001' delivery/changes/$CHANGE/design.md

# 2. Check the automated run finished
gh pr checks 482
# all checks were successful

# 3. Read the diff with the criteria in front of you
gh pr diff 482

# 4. Leave labelled comments
gh pr review 482 --request-changes --body "blocking: AC-003 requires the warning to omit the user id; src/shell/render.ts:88 logs err.userId. See CONTRACT-001 Errors."
gh pr comment 482 --body "non-blocking: renderShell now takes five positional args — worth an options object. Raised as DEV-4419, not blocking this merge."
gh pr comment 482 --body "question: is the 400ms timeout in src/session/client.ts:22 the CONTRACT-001 figure, or coincidence?"
```

On Azure DevOps the same three comments are left on the pull request with the same first
tokens, and the tracker id is the work item:

```bash
az repos pr create --title "TASK-004 theme fallback" --work-items 4419 --squash
az repos pr set-vote --id 482 --vote -5   # -5 = rejected, the blocking vote
```

The record G5 reads, at `delivery/changes/theme-persistence/evidence/g5-review.md`:

```markdown
# Code review record — theme-persistence

- **Pull request:** github.com/navikenz/shell/pull/482 (squash-merged 2026-09-28)
- **Change:** theme-persistence; tasks TASK-004, TASK-005
- **Reviewers:** Dan Okafor (developer), Priya Raman (security — diff touches session handling)
- **Automated checks:** green at 2026-09-28T13:10Z (lint, unit, contract, dependency scan)

| # | Class | Grounded in | Resolution |
|---|---|---|---|
| 1 | blocking | AC-003 | Fixed in c41f9a2 — the warning logs the failure code only; test/security/log-redaction.spec.ts added |
| 2 | blocking | CONTRACT-001 Timing | Fixed in 8b2d117 — timeout set to the contract's 400ms |
| 3 | blocking | THREAT-002 Verify | Fixed in 8b2d117 — the deleted assertion restored and extended |
| 4 | non-blocking | reviewer preference | Declined for this change; raised as DEV-4419 |
| 5 | question | — | Answered in thread; no change |

No blocking comment was resolved by agreement alone. Comment 4 was raised by the reviewer and
resolved by the reviewer after the tracker id was posted.
```

Then the gate:

```bash
navi-delivery gate G5 --pass --evidence delivery/changes/theme-persistence/evidence/g5-review.md
# => G5 pass (evidence: delivery/changes/theme-persistence/evidence/g5-review.md)
```

## Checklist

- [ ] At least one approver who did not write the change
- [ ] The reviewer read `spec.md` and `design.md` before the diff
- [ ] The pull request covers exactly one `delivery/changes/<name>` and names its tasks
- [ ] Automated checks were green before the human review started
- [ ] Every comment carries `blocking:`, `non-blocking:` or `question:` as its first token
- [ ] Every blocking comment names an `AC-###`, `CONTRACT-###`, `THREAT-###`, skill rule, or a reproducible defect
- [ ] Every blocking comment was resolved by a diff change, an artifact change, or a recorded decision
- [ ] Every blocking comment was resolved by the person who raised it
- [ ] Every comment was answered, including the declined ones
- [ ] Every deferred non-blocking comment has a tracker id, in the thread and in any `TODO`
- [ ] Security Engineer reviewed the diff where the routing rule requires it
- [ ] No secret appears anywhere in the branch history; any that did was rotated
- [ ] `evidence/g5-review.md` exists and lists every blocking comment and its resolution

## Anti-patterns

**Rubber stamp.** `LGTM 👍` on a 900-line diff, four minutes after it opened. The gate records
that a review happened and the record is true and worthless. Review against the criteria, or
say the diff is too large to review and ask for it to be split.

**The taste blocker.** `blocking: I'd use a map here.` The author cannot check this against
anything, so the argument is about authority instead of the code. Label it `non-blocking:`, or
ground it: `blocking: the array scan is O(n) per request and QAS-001 budgets 1200ms at 500 rps`.

**Resolution by agreement.** `Good point, we should fix that` and the thread marked resolved,
with nothing in the diff. The next reader believes it was handled. Resolve with a commit, an
artifact change, or a recorded decision.

**Author resolves the blocker.** The author marks the reviewer's blocking comment resolved
because they disagree with it. Now the disagreement is invisible and the merge carries it.
Answer in the thread and escalate as `kind: review`.

**Silent force-push.** The commented lines disappear in a rebase, the thread goes stale, and
the tool marks it outdated. The reviewer cannot tell whether the point was taken. Answer every
comment explicitly, then push.

**Merge now, comments later.** `Merging to unblock the release — will address the review in a
follow-up.` The follow-up competes with the next change and loses. Record a waiver with an
expiry if the date cannot move, so the exception is visible.

**The orphan TODO.** `// TODO: handle the empty case` with no id. It is now permanent and
nobody is assigned. Add the tracker id or handle the case.

**Secret removed in a follow-up commit.** The key is deleted in the next commit and the review
resolved. The key is still in the branch history and still valid. Rotate it, then remove it.

**Two changes in one pull request.** A feature and an unrelated refactor, merged together
because they were in the same working tree. The revert on Friday takes the refactor with it.
Split them.

## Validation

```bash
# The pull request under review, read from the checkout rather than hardcoded
read -r OWNER REPO <<<"$(gh repo view --json owner,name --jq '.owner.login + " " + .name')"
PR=$(gh pr view --json number --jq .number)

# Every blocking review thread is resolved (GitHub; review threads are GraphQL-only)
gh api graphql -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" -f query='
  query($owner:String!,$repo:String!,$pr:Int!){
    repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
      reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ body } } } } } } }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.isResolved==false) | .comments.nodes[0].body' \
  | grep '^blocking:'

# Every review comment carries a class label. The labels live on review comments, which
# `gh pr view --json comments` does not return — that field is the PR's issue comments. Only
# each comment's first line is tested, or every continuation line reads as unlabelled.
gh api graphql -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" -f query='
  query($owner:String!,$repo:String!,$pr:Int!){
    repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
      reviewThreads(first:100){ nodes{ comments(first:50){ nodes{ body } } } } } } }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[].comments.nodes[].body
        | split("\n")[0]' \
  | grep -vE '^(blocking|non-blocking|question):'

# The change has a review record and it names a pull request
CHANGE=<name>
test -f delivery/changes/$CHANGE/evidence/g5-review.md || echo "no review record"
grep -q 'Pull request:' delivery/changes/$CHANGE/evidence/g5-review.md || echo "record names no PR"

# No TODO without a tracker id in the diff
git diff origin/main... | grep -nE '^\+.*TODO' | grep -vE '(DEV|SEC|OPS)-[0-9]+'

# No credential-shaped string anywhere in the branch history
git log -p origin/main... | grep -nEi '(api[_-]?key|secret|password|token)\s*[:=]\s*["\x27][A-Za-z0-9/+_-]{16,}'
```

Each command prints nothing when the rule holds. The last two read the branch history rather
than the current diff, because a secret removed in a later commit is still a live credential.
