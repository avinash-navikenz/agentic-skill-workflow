---
name: navi-skill-branching
description: >
  Use when creating a branch, moving onto one that already exists, bringing the default branch
  into one, or deleting one. Defines the base a branch is cut from, the upstream it tracks, the
  choice between rebase and merge when integrating, how uncommitted work survives a switch, and
  how a finished or abandoned branch is cleaned up on Azure DevOps, GitHub and Jira-tracked
  repositories.
  Trigger phrases include: create a branch, git switch, git checkout, checkout someone's branch,
  set upstream, track a remote branch, rebase onto main, keep my branch up to date, stash,
  git worktree, detached HEAD, delete a branch, prune, branch is gone, default branch.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: software-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer, navi-agent-devops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "git, branching, upstream, rebase, stash, worktree, cleanup, azure-devops, github, jira"
  model: sonnet
---

## When to use

A branch is about to be created; someone else's branch has to be run locally; the default branch
has moved and an open branch has to take it; work has to be put down mid-change to pick up
something else; or a branch is finished, abandoned, or has been deleted on the server.

`navi-skill-version-control-workflow` owns branch **policy**: the name is `change/<name>`, it is
cut from the default branch, it is integrated at least daily, it is squash-merged, and the
default branch is protected. This skill owns the **mechanics** that policy assumes — which base
the branch is actually cut from when the local default branch is stale, what upstream it tracks,
whether the daily integration is a rebase or a merge, where uncommitted work goes during a
switch, and what is left behind when the branch is gone. Where the two touch, policy wins: this
skill never proposes a different name or a different merge shape.

## Rules

1. Fetch before cutting a branch, and cut it from the remote-tracking ref:
   `git fetch origin && git switch -c change/<name> origin/main`. Cutting from a local `main`
   that was last updated on Tuesday starts the branch behind by everything since Tuesday, and
   the first integration then looks like a conflict the author caused.
2. Resolve the default branch's name rather than typing `main`. `git symbolic-ref --short
   refs/remotes/origin/HEAD` names it, and `git remote set-head origin --auto` sets that ref
   when a repository was created by `git init` rather than by `git clone`. Repositories on all
   three platforms still exist with `master`, `develop` and `trunk` as their default.
3. Use `git switch` and `git restore`, not `git checkout`. `git checkout <name>` moves a branch
   or discards a file's changes depending on what `<name>` happens to be, and the second of
   those is unrecoverable.
4. Give every branch an upstream at its first push: `git push -u origin HEAD`, or set
   `push.autoSetupRemote = true` once. A branch with no upstream makes `git status` unable to
   say whether it is ahead or behind, and every later check in this file silently passes.
5. Never embed a credential in a remote URL. `https://user:token@dev.azure.com/…` puts the token
   in `.git/config`, in every backup of the working tree and in every `git remote -v` run on a
   screen share. Use the platform's credential helper — `az repos` and `gh auth` each install
   one — and rotate any token that has already been written into a URL.
6. Integrate the default branch into an open branch by rebase while the branch is yours alone:
   `git fetch origin && git rebase origin/main`. The branch keeps one line of history and the
   eventual squash has one parent.
7. Integrate by merge instead — `git merge origin/main` — the moment anyone else has the branch
   checked out, or a review thread is attached to a commit on it. Rebasing rewrites commits
   other people hold, and their next pull produces a duplicated history nobody asked for.
8. Never rebase a branch that has been merged into another branch, and never rebase the default
   branch. Both produce commits that are duplicates of commits already in the shared history.
9. Put uncommitted work somewhere named before switching: `git stash push -m "<what it is>"`, or
   a second checkout with `git worktree add ../shell-hotfix change/<name>`. An unnamed stash is
   found three weeks later with no way to tell what it was for.
10. Prefer `git worktree` to `git stash` when the interruption will outlast a coffee. A stash is
    a stack in one working tree; a worktree is a second directory with its own branch, so the
    interrupted work is still on disk, still building, and still open in the editor.
11. Run `git stash list` before every `git stash push` and after every `git stash pop`. A pop
    that hits a conflict leaves the stash in the list, and the second pop then replays work that
    is already in the tree.
12. Check out someone else's branch by fetching it, not by guessing: `git fetch origin
    <branch> && git switch <branch>`. On GitHub, `gh pr checkout <number>` does both and sets
    the upstream, including for a branch on a fork, which a bare fetch of `origin` cannot reach.
13. Return from a detached HEAD with `git switch -`, and recover a commit made while detached
    with `git reflog` and `git branch <name> <sha>`. A detached HEAD is not an error state, but
    commits made there are unreachable the moment you switch away.
14. Delete a branch only with `git branch -d`, never `-D`, unless the commits it holds are
    already reachable from somewhere else. `-d` refuses to delete unmerged work; `-D` is the
    command that loses it. After a squash merge `-d` will also refuse, because the squash is a
    different commit — confirm with `git log origin/main --oneline | grep <the squash subject>`
    first, then use `-D`.
15. Set `fetch.prune = true` so that a branch deleted on the server stops appearing locally, and
    check `git branch -vv` for `: gone]` before starting new work. All three platforms delete
    the source branch on merge when configured to, and the local copy is what is left.
16. Never leave the default branch checked out with uncommitted changes. Work belongs on a
    change branch from the first edit, and moving it afterwards costs a `git stash` and a
    `git switch -c` that could have been one command.

## Decision table

| Observed condition | Required action |
|---|---|
| A change is starting and `delivery/changes/<name>` exists | `git fetch origin && git switch -c change/<name> origin/main` |
| `git symbolic-ref refs/remotes/origin/HEAD` fails | `git remote set-head origin --auto`, then read it |
| A branch was created and not yet pushed | `git push -u origin HEAD` |
| `.git/config` holds `https://user:token@…` | Replace with a credential helper; rotate that token |
| The default branch moved and nobody else has this branch | `git fetch origin && git rebase origin/main` |
| The default branch moved and someone else has this branch checked out | `git merge origin/main` |
| A review thread is attached to a commit on the branch | `git merge origin/main`; do not rebase |
| Uncommitted work is in the way of a switch that will take minutes | `git stash push -m "<what it is>"` |
| Uncommitted work is in the way of a switch that will take hours | `git worktree add ../<dir> change/<name>` |
| `git stash pop` reported a conflict | Resolve, then `git stash drop` — the entry is still in the list |
| A GitHub pull request has to be run locally | `gh pr checkout <number>` |
| An Azure DevOps or Jira-tracked branch has to be run locally | `git fetch origin <branch> && git switch <branch>` |
| `git status` says HEAD is detached | `git switch -`; `git reflog` if a commit was made there |
| A branch is merged and finished | `git branch -d <name>` |
| `git branch -d` refuses after a squash merge | Confirm the squash subject is on the default branch, then `git branch -D <name>` |
| `git branch -vv` shows `: gone]` | The server deleted it; `git branch -D` the local copy |
| The default branch is checked out and the tree is dirty | `git stash`, `git switch -c change/<name> origin/main`, `git stash pop` |

## Template

The repository configuration these rules assume, appended once to `.git/config` — or set with
`git config --local <key> <value>`:

```ini
[fetch]
	prune = true
[push]
	default = current
	autoSetupRemote = true
[rebase]
	autoStash = true
[branch]
	autoSetupMerge = always
```

Cutting, pushing and integrating a branch:

```bash
# The default branch by name, read rather than assumed.
git remote set-head origin --auto
DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD)     # e.g. origin/main

# 1. Cut from the remote-tracking ref, never from a stale local branch.
git fetch origin
git switch -c change/theme-persistence "$DEFAULT"

# 2. First push sets the upstream.
git push -u origin HEAD
git branch -vv                       # change/theme-persistence [origin/change/theme-persistence]

# 3. Daily integration. Rebase while the branch is yours alone...
git fetch origin && git rebase "$DEFAULT"
# ...merge from the moment anyone else holds it, or a review thread is attached.
git fetch origin && git merge "$DEFAULT"
```

Putting work down and picking it up again:

```bash
# Minutes: a named stash.
git stash push -m "theme resolver: header precedence, half done"
git stash list
git switch change/other-thing
git switch -
git stash pop
git stash list                       # empty, or the pop hit a conflict and it is still there

# Hours: a second working tree, so the interrupted branch stays on disk and builds.
git worktree add ../shell-hotfix change/session-timeout
cd ../shell-hotfix
# ... when it is finished
cd - && git worktree remove ../shell-hotfix
git worktree list
```

Running someone else's branch, per platform:

```bash
# GitHub, including a branch on a fork:
gh pr checkout 482

# Azure DevOps and Jira-tracked repositories: fetch the source branch by name.
git fetch origin change/session-timeout
git switch change/session-timeout
```

Cleaning up, and recovering when something has gone:

```bash
git fetch --prune origin
git branch -vv | grep ': gone\]'          # deleted on the server, still here
git branch -d change/theme-persistence    # refuses if the work is not reachable elsewhere
# After a squash merge -d refuses, because the squash is a different commit:
git log origin/main --oneline -20 | grep 'theme-persistence'
git branch -D change/theme-persistence

# Detached HEAD, with a commit made there:
git reflog -10
git branch rescue/theme-resolver 9f31c07
git switch -
```

## Checklist

- [ ] The branch was cut from a freshly fetched remote-tracking ref, not a local default branch
- [ ] The default branch's name was read from `refs/remotes/origin/HEAD`, not typed
- [ ] `git switch` was used, not `git checkout`
- [ ] The branch has an upstream, visible in `git branch -vv`
- [ ] No remote URL in `.git/config` contains a credential
- [ ] Integration was a rebase only while the branch was nobody else's
- [ ] A branch anyone else holds, or that carries a review thread, was integrated by merge
- [ ] Every stash was pushed with `-m`, and `git stash list` is empty afterwards
- [ ] An interruption longer than a coffee used a worktree rather than a stash
- [ ] No branch was deleted with `-D` while holding work reachable from nowhere else
- [ ] `fetch.prune` is set, and no `: gone]` branch is left in `git branch -vv`
- [ ] The default branch is not checked out with uncommitted changes

## Anti-patterns

**Branching off yesterday's `main`.** `git switch -c change/theme-persistence main` with no
fetch. The branch starts eleven commits behind, and the conflicts that follow look like the
author's fault. Fetch, then cut from `origin/main`.

**Typing `main`.** Every script and every instruction hardcodes it, and then the repository
that still uses `master` — or the Azure DevOps project that standardised on `develop` — silently
does the wrong thing, because `git rebase main` against a branch that does not exist fails, and
`git switch -c x main` against a *stale local* `main` does not. Read
`refs/remotes/origin/HEAD`.

**`git checkout` for everything.** `git checkout config` moves to the branch called `config` if
there is one and throws away every change to the file called `config` if there is not. The two
outcomes look nothing alike and the second cannot be undone. `git switch` and `git restore` each
do one of those jobs.

**The token in the URL.** `git remote set-url origin https://contoso:9c2f4b@dev.azure.com/…`
because the credential helper was being awkward. The token is now in `.git/config`, in the
backup, and in the screenshot of `git remote -v` in the support ticket. Use the helper; rotate
the token.

**Rebasing a shared branch.** Two people have `change/theme-persistence` checked out; one
rebases and force-pushes. The other pulls, gets both copies of every commit, and resolves the
same conflicts a second time. Rebase only while the branch is yours alone.

**The anonymous stash.** `git stash` three times over a fortnight. `stash@{0}`, `stash@{1}`,
`stash@{2}`, no messages, and no way to tell which is worth keeping — so all three stay forever.
`git stash push -m`.

**The pop that half-worked.** `git stash pop` conflicted, the conflict was resolved, and the
stash is still in the list. The next `pop` replays the same work over the top of itself. Check
`git stash list` after every pop, and `git stash drop` when it is done.

**`git branch -D` to make the message go away.** `-d` refused because the branch held two
commits that were nowhere else. `-D` deleted them. They are in the reflog for ninety days and
findable by nobody who does not already know to look. Find out why `-d` refused first.

**The branch that is gone.** The server deleted it on merge; the local copy is still there,
still shows in every completion, and is still behind by everything since. Set
`fetch.prune = true` and clear anything showing `: gone]`.

## Validation

```bash
# HEAD is on a branch, not on a commit.
git symbolic-ref -q HEAD >/dev/null \
  || echo "HEAD is detached — 'git switch -' returns to the branch you left"

# Every local branch tracks a remote branch, and that branch is still there.
git for-each-ref --format='%(refname:short) %(upstream:short)' refs/heads | while read -r b u; do
  if [ -z "$u" ]; then
    echo "local branch $b tracks nothing — push it with: git push -u origin $b"
    continue
  fi
  git rev-parse --verify -q "refs/remotes/$u" >/dev/null \
    || echo "local branch $b tracks $u, which origin does not have"
  behind=$(git rev-list --count "$b..$u" 2>/dev/null)
  ahead=$(git rev-list --count "$u..$b" 2>/dev/null)
  if [ "${behind:-0}" -gt 0 ] && [ "${ahead:-0}" -gt 0 ]; then
    echo "$b and $u have both moved ($behind behind, $ahead ahead) — one side was rewritten"
  fi
done

# Branches the server has deleted, still held locally.
git branch -vv | grep ': gone\]' \
  | sed 's|^|local branch whose upstream origin deleted — git branch -D it: |'

# No credential was ever written into a remote URL.
git remote -v | grep -E '://[^/@[:space:]]+:[^/@[:space:]]+@' \
  | sed 's|^|remote URL carries an embedded credential — rotate that token: |'

# Worktrees whose directory has gone, still registered.
git worktree list --porcelain | grep '^prunable' \
  | sed 's|^|prunable worktree — run: git worktree prune: |'

# The configuration these rules assume is actually set in this repository.
[ "$(git config --get fetch.prune)" = "true" ] \
  || echo "fetch.prune is not true — branches deleted on the server stay in this checkout"
[ "$(git config --get push.autoSetupRemote)" = "true" ] \
  || echo "push.autoSetupRemote is not true — a new branch's first push leaves it tracking nothing"
[ "$(git config --get rebase.autoStash)" = "true" ] \
  || echo "rebase.autoStash is not true — the daily integration refuses on a dirty tree"
```

Each command prints nothing when the rule holds. Nothing here can tell whether an integration
should have been a merge rather than a rebase — that depends on who else holds the branch, which
git does not record. Ask before rebasing, every time.
