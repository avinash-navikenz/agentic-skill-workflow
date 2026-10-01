---
name: navi-skill-merge-conflicts
description: >
  Use when git has stopped with conflicted paths — a merge, a rebase, a cherry-pick or a
  revert — and the work on both sides has to survive the resolution. Defines which side is
  which in each operation, how the common ancestor is read, what is regenerated rather than
  merged, how rerere helps and how it misleads, when to abort, and how a side that was
  deliberately dropped is recorded on Azure DevOps, GitHub and Jira-tracked repositories.
  Trigger phrases include: merge conflict, CONFLICT (content), conflict markers, both modified,
  deleted by them, git checkout --ours, git checkout --theirs, rerere, conflictStyle, zdiff3,
  lockfile conflict, package-lock conflict, merge --abort, rebase --continue, rebase --skip,
  resolve conflicts, unmerged paths, .orig files.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: software-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer, navi-agent-devops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "git, merge conflict, rebase, rerere, gitattributes, lockfile, regeneration, azure-devops, github, jira"
  model: sonnet
---

## When to use

Git has stopped and named conflicted paths; a resolution has been made and has to be checked
before it is committed; a lockfile or other generated file is in the conflict; the same
conflict has appeared for the third rebase running; or a merge has already landed and someone
suspects a side went missing.

Two skills stand either side of this one and neither is restated here.
`navi-skill-version-control-workflow` owns **policy**: branch per change, integrate the default
branch daily, squash each branch into one commit, revert a bad merge, tag immutably.
`navi-skill-branching` owns **which integration command is run** — rebase while the branch is
yours alone, merge from the moment anyone else holds it or a review thread is attached. This
skill owns only what happens **between** them: from the moment git reports conflicted paths to
the moment the resolution is committed with both sides accounted for. It never proposes a
different integration shape, a different branch name or a different merge shape; if the
resolution turns out to be impossible, the answer is to abort and go back to those two skills,
not to invent a third rule here.

## Rules

1. Read the conflict before resolving it. `git status --short` names every conflicted path and
   its kind — `UU` both modified, `UD` deleted by them, `DU` deleted by us, `AA` both added —
   and `git log --merge --oneline -- <path>` names the commits on each side that touched it.
   The markers show two texts; the conflict is two intentions, and only the commits carry those.
2. Set `merge.conflictStyle = zdiff3` before the first conflict, not after it. The default
   two-way marker shows only the two results, so "they added a line" and "you deleted a line"
   look identical and the wrong one is picked about half the time. zdiff3 prints the common
   ancestor between `|||||||` and `=======`, which is the only thing that distinguishes them.
3. Never trust the words "ours" and "theirs" — they invert. In a merge, stage 2 (`--ours`,
   under `<<<<<<<`) is the branch you are on. In a rebase or a cherry-pick, git is replaying
   your commit *onto* the other branch, so stage 2 is the **upstream** and stage 3
   (`--theirs`) is **your own commit** — and the marker is still labelled `HEAD`. Read
   `git show :2:<path>` and `git show :3:<path>` instead of reading the label.
4. Resolve by taking a whole side only when the other side's change to that file is genuinely
   unwanted, and say so in the merge commit's body. `git checkout --ours <path>` discards the
   other branch's work on that file silently and leaves no record anywhere that it existed.
   `navi-skill-commit-craft` owns what that message looks like; this skill owns that it is there.
5. Regenerate generated files; never merge them. A line merge of `package-lock.json` produces
   a dependency graph that is neither side's and that no install would ever have written.
   Resolve the manifest (`package.json`) by hand, then `npm install --package-lock-only
   --no-audit --no-fund` and stage what it writes.
6. Declare every lockfile `merge=binary` in `.gitattributes` so git refuses the line merge and
   reports the conflict instead. Without it git will cheerfully produce a lockfile that
   installs nothing anyone intended, and the merge will look clean.
7. Never write `merge=ours` or `merge=theirs` into `.gitattributes`. It resolves the path by
   discarding the other side automatically, with no marker, no prompt and no record — a
   lockfile marked `merge=ours` loses every dependency the other branch added and the merge
   reports success.
8. Use `merge=union` only for a file that is an append-only list — a changelog, a
   contributors file. Union concatenates both sides' lines; on anything with ordering or
   structure it produces duplicated or interleaved nonsense that still parses.
9. Enable `rerere`, and remember that it replays *your earlier answer*, not the right answer.
   It is the only thing that makes a daily rebase of a long branch bearable, and it is also
   how one wrong resolution propagates silently into every later rebase.
10. Keep `rerere.autoupdate` false. True stages the replayed resolution before anybody looks
    at it, which turns rerere from an assistant into an unreviewed committer.
11. Undo a bad remembered resolution with `git rerere forget <path>` while the conflict is
    still in the tree, then `git checkout --merge -- <path>` to put the markers back. Running
    `forget` after the merge has been committed changes nothing you can see.
12. Abort rather than improvise. `git merge --abort`, `git rebase --abort`,
    `git cherry-pick --abort` and `git revert --abort` each restore the tree to exactly where
    the operation started. A resolution being guessed at under time pressure is a resolution
    nobody can review.
13. Never run `git rebase --skip`. It does not skip the conflict — it drops the entire commit
    being replayed, with everything else that commit contained. The work is then only in the
    reflog, and only until it expires.
14. Preflight before integrating anything large: `git merge-tree --write-tree --name-only
    <ours> <theirs>` exits non-zero and lists the paths that will conflict, without touching
    the working tree or the index. It is the only way to find out what a merge costs before
    paying for it.
15. Run the tests after resolving, before committing. A conflict-free merge is routinely a
    broken one: one side renamed a function, the other side added a caller, and git merged
    both without overlap. Text has no conflict; the program does.
16. Decide a delete/modify conflict explicitly. `UD` means the other side deleted a file you
    changed; git will not choose. `git rm <path>` accepts the deletion, `git add <path>` keeps
    your version — and keeping it means finding out why it was deleted before you do.
17. Leave no `.orig` or `.rej` behind. Merge tools write them, nobody reads them, and a
    committed `.orig` is a second copy of the file that drifts from the first. Set
    `mergetool.keepBackup = false` and delete the ones already in the tree.
18. Check the result for a side that vanished before pushing. For a merge commit, a file that
    is byte-identical to one parent while the *other* parent changed it is a dropped side,
    whether that was intended or not — the Validation block finds them.

## Decision table

| Observed condition | Required action |
|---|---|
| Git reports `CONFLICT` on any operation | `git status --short`; resolve nothing until every path and its kind is read |
| The markers show two texts and no ancestor | `git config --global merge.conflictStyle zdiff3`, then `git checkout --conflict=zdiff3 -- <path>` |
| The conflict is inside a rebase or cherry-pick | Stage 2 is the upstream and stage 3 is your commit; read `git show :2:` and `git show :3:` |
| A whole side is about to be taken | Name the path and the reason in the merge commit body |
| A lockfile is conflicted | Resolve the manifest, regenerate the lockfile, stage what the tool wrote |
| A lockfile has no entry in `.gitattributes` | Add `merge=binary` before the next integration |
| `.gitattributes` contains `merge=ours` or `merge=theirs` | Remove it; it is a silent discard with no record |
| A changelog or append-only list conflicts every time | `merge=union` for that path only |
| The same conflict has been resolved by hand twice | `git config --global rerere.enabled true` |
| rerere resolved a path and the result looks wrong | `git rerere forget <path>`, then `git checkout --merge -- <path>` |
| The resolution is being guessed at | `git merge --abort` / `git rebase --abort` / `git cherry-pick --abort` |
| A rebase step conflicts and the commit looks unwanted | Abort and decide on a branch; never `git rebase --skip` |
| A long branch is about to take the default branch | `git merge-tree --write-tree --name-only <ours> <theirs>` first |
| Every path is resolved and staged | Run the tests, then commit — not the other way round |
| `git status` shows `UD` or `DU` | `git rm <path>` to accept the deletion, `git add <path>` to keep the file |
| `.orig` or `.rej` files are in the tree | Delete them; set `mergetool.keepBackup = false` |
| A merge has landed and a change seems missing | Compare the merge against both parents (see Validation) |
| A GitHub pull request reports conflicts | `gh pr checkout <number>`, resolve locally, push — not the web editor |
| An Azure DevOps pull request reports conflicts | Resolve locally; `az repos pr` has no conflict command, and the web resolver is text-only |
| A Jira-tracked repository conflicts | Resolve locally; put the issue key in the merge commit so the DVCS integration links it |

## Template

The merge attributes these rules assume, as `.gitattributes` at the repository root:

```gitattributes
# Generated dependency graphs. merge=binary makes git refuse the line merge and
# report the conflict, which is the only honest outcome: the resolution is to
# regenerate the file from the resolved manifest, never to interleave two graphs.
package-lock.json   merge=binary
yarn.lock           merge=binary
poetry.lock         merge=binary
Gemfile.lock        merge=binary
go.sum              merge=binary

# Append-only lists, where concatenating both sides is the right answer.
CHANGELOG.md        merge=union

# No path here resolves by discarding a side. The two attributes that do so
# (see Rule 7) take the other branch's change out with no marker, no prompt and
# no record of what was dropped, and the merge still reports success.
```

The repository configuration they assume, appended once to `.git/config` — or set with
`git config --local <key> <value>`:

```ini
[merge]
	conflictStyle = zdiff3
[rerere]
	enabled = true
	autoupdate = false
[mergetool]
	keepBackup = false
```

Resolving a conflict, from the stop to the commit:

```bash
# 1. What conflicted, and of what kind.
git status --short
#   UU src/theme/resolver.ts      both modified
#   UD src/theme/legacy.ts        deleted by them
#   UU package-lock.json          both modified

# 2. What each side was trying to do. Not the markers — the commits.
git log --merge --oneline -- src/theme/resolver.ts

# 3. The three inputs, read rather than guessed. In a merge :2 is this branch;
#    in a rebase or cherry-pick :2 is the upstream and :3 is your own commit.
git show :1:src/theme/resolver.ts > /tmp/base.ts     # common ancestor
git show :2:src/theme/resolver.ts > /tmp/ours.ts
git show :3:src/theme/resolver.ts > /tmp/theirs.ts

# 4. Edit the file so both intentions survive. If the markers were written in
#    the old two-way style, re-write them with the ancestor shown:
git checkout --conflict=zdiff3 -- src/theme/resolver.ts

# 5. The delete/modify conflict is a decision, not a merge.
git log --oneline -1 --diff-filter=D -- src/theme/legacy.ts   # who deleted it, and why
git rm src/theme/legacy.ts            # accept the deletion
# ...or keep it, having found out why it went:
# git add src/theme/legacy.ts

# 6. The lockfile is regenerated, never merged. The manifest above it is
#    resolved by hand like any other source file — both sides added a dependency
#    and both are wanted.
git status --short package.json           # resolve it, then:
npm install --package-lock-only --no-audit --no-fund
git add package.json package-lock.json

# 7. Tests before commit. A merge with no textual conflict is still routinely broken.
npm test

# 8. Commit, naming any path where a side was deliberately not taken.
git commit
```

Preflighting, aborting, and undoing a remembered resolution:

```bash
# What would conflict, without touching the working tree. Exits non-zero and
# lists the paths when there is anything to resolve.
git merge-tree --write-tree --name-only HEAD origin/main

# Put everything back exactly as it was before the operation started.
git merge --abort
git rebase --abort
git cherry-pick --abort

# rerere replayed yesterday's answer and yesterday's answer was wrong.
git rerere status                          # paths it is tracking in this conflict
git rerere diff                            # what it thinks the resolution is
git rerere forget src/theme/resolver.ts    # while the conflict is still open
git checkout --merge -- src/theme/resolver.ts   # markers back, resolve again
```

Per platform, once the conflict is a pull request's problem:

```bash
# GitHub: take the branch locally. The web conflict editor handles text only,
# commits straight onto the branch, and runs no tests.
gh pr checkout 482
git fetch origin && git merge origin/main
# ...resolve, test, then:
git push

# Azure DevOps: there is no conflict verb on the CLI — `az repos pr` can create,
# update, list, check out, vote and link work items, and nothing else. Resolve
# locally, exactly as above, after checking out the pull request:
az repos pr checkout --id 482
git fetch origin && git merge origin/main

# Jira tracks the work; the repository lives on one of the hosts above. Resolve
# locally and put the issue key in the merge commit so the DVCS integration links
# the merge to the issue.
git commit -m "Merge origin/main into change/theme-persistence (SHELL-4411)" -m \
"resolver.ts: both sides kept — the header precedence from main, the session
fallback from this branch.
legacy.ts: accepted main's deletion; AC-003 now reaches the same path through
resolver.ts, confirmed by the AC-003 test.
package-lock.json: regenerated from the resolved package.json, not merged."
```

## Checklist

- [ ] Every conflicted path and its kind was read from `git status --short` before any edit
- [ ] `merge.conflictStyle` is `zdiff3`, so every marker shows the common ancestor
- [ ] Inside a rebase or cherry-pick, the sides were read from `:2:` and `:3:`, not from the labels
- [ ] No whole side was taken without the reason being in the merge commit body
- [ ] Every lockfile was regenerated from its resolved manifest, not line-merged
- [ ] Every lockfile has `merge=binary` in `.gitattributes`
- [ ] `.gitattributes` contains no `merge=ours` and no `merge=theirs`
- [ ] `merge=union` is set only on files that are append-only lists
- [ ] `rerere.enabled` is true and `rerere.autoupdate` is false
- [ ] Any resolution rerere replayed was read before it was staged
- [ ] No `git rebase --skip` was run
- [ ] Every delete/modify conflict was decided with `git rm` or `git add`, not left
- [ ] The tests were run after the resolution and before the commit
- [ ] No `.orig` or `.rej` file is in the tree or in the commit
- [ ] No conflict marker survives in any tracked file
- [ ] No merge commit matches one parent exactly on a file the other parent changed

## Anti-patterns

**Resolving from the markers alone.** Two blocks of text, pick the longer one, delete the
markers, `git add`. Nobody looked at what either side was for, and the half that is now gone
was the fix for the defect that opened the branch. `git log --merge` first.

**The two-way marker.** The default conflict style shows your version and their version and
not the version both came from — so a line the other side *deleted* looks exactly like a line
you *added*, and it comes back. `merge.conflictStyle = zdiff3` makes the difference visible.

**"Ours" during a rebase.** `git checkout --ours` in the middle of `git rebase origin/main`,
believing it keeps the branch's work. It keeps `origin/main`'s, because a rebase replays your
commit onto the upstream and the upstream is stage 2 — and the marker says `HEAD`, which makes
it worse. Read `git show :2:` and `git show :3:`.

**The merged lockfile.** `package-lock.json` resolved by hand, markers removed, both sides'
blocks kept. The result is a graph no install has ever produced; it resolves to versions
neither branch tested, and the failure appears three days later in CI on an unrelated change.
Resolve `package.json`, regenerate, stage.

**`merge=ours` on the lockfile.** Added because the lockfile conflicted every single day. It
does stop the conflicts: every dependency the other branch added is now discarded silently and
the merge reports success. The missing package is found at runtime.

**`git rebase --skip` to get through it.** The conflict was awkward and `--skip` made it stop.
It did not skip the conflict — it dropped the commit, and the three unrelated changes that
were in it. The only copy left is in the reflog, for ninety days, findable by nobody who does
not already know it is missing.

**rerere on autopilot.** The same conflict was resolved wrongly once, three weeks ago. rerere
has replayed that resolution into every rebase since, silently, and `rerere.autoupdate` staged
each one. The wrong answer is now in eleven commits. `git rerere forget`, and read what it
replays.

**The green merge that does not build.** No textual conflict: one side renamed `resolveTheme`,
the other added a call to it. Git merged both cleanly because the lines never overlapped. Run
the tests before the commit, not in CI after the push.

**The `.orig` file in the repository.** The merge tool left `resolver.ts.orig`, it was caught
by `git add -A`, and now two files look like the resolver. Six months later somebody edits the
wrong one. `mergetool.keepBackup = false`.

**Resolving in the web editor.** The GitHub conflict resolver is a textarea. It cannot run the
tests, it cannot regenerate a lockfile, it commits straight onto the branch, and it offers the
two-way marker. `gh pr checkout` and resolve where the tests are.

## Validation

```bash
# Nothing is still mid-resolution.
git ls-files -u | cut -f2 | sort -u \
  | sed 's|^|unmerged path still in the index — resolve it and git add it: |'
GITDIR=$(git rev-parse --git-dir)
for op in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  [ -e "$GITDIR/$op" ] && echo "$op is present — a merge, cherry-pick, revert or rebase was left unfinished"
done

# Conflict markers that survived a resolution. Both of these forms always carry
# a label, so neither matches a markdown rule or a row of equals signs.
git grep -I -n -e '^<<<<<<< ' -e '^>>>>>>> ' -- . \
  | sed 's|^|conflict marker left in tracked content: |'

# Merge-tool wreckage, committed or not.
git ls-files -- '*.orig' '*.rej' | sed 's|^|resolution leftover committed: |'
git status --porcelain --untracked-files=all -- '*.orig' '*.rej' \
  | sed 's|^|resolution leftover in the working tree: |'

# The conflict style shows the common ancestor.
case "$(git config --get merge.conflictStyle)" in
  diff3|zdiff3) ;;
  *) echo "merge.conflictStyle is neither diff3 nor zdiff3 — the markers hide the common ancestor, and a side that only deleted a line is then invisible" ;;
esac

# rerere remembers; autoupdate would stage a replay before anybody read it.
[ "$(git config --get rerere.enabled)" = "true" ] \
  || echo "rerere.enabled is not true — the same conflict is resolved by hand on every rebase"
[ "$(git config --get rerere.autoupdate)" = "true" ] \
  && echo "rerere.autoupdate is true — a replayed resolution is staged before anybody reads it"

# Every lockfile present refuses the line merge.
git ls-files -- '*.lock' '*lock.json' '*lock.yaml' 'Gemfile.lock' 'go.sum' | while read -r f; do
  git check-attr merge -- "$f" | grep -q ': merge: binary$' \
    || echo "$f has no merge=binary in .gitattributes — git will line-merge a generated file into a graph that is neither side's"
done

# No path is resolved by discarding a side.
grep -nE '(^|[[:space:]])merge=(ours|theirs)([[:space:]]|$)' .gitattributes 2>/dev/null \
  | sed 's|^|.gitattributes resolves a path by discarding one side, with no record of what was dropped: |'

# Merge commits where one side's change to a file did not reach the result. A
# file byte-identical to one parent, on a path the *other* parent also changed,
# is that other side dropped — deliberately or not.
git log --merges --format='%H' | while read -r m; do
  p1=$(git rev-parse -q --verify "$m^1") || continue
  p2=$(git rev-parse -q --verify "$m^2") || continue
  base=$(git merge-base "$p1" "$p2") || continue
  short=$(git rev-parse --short "$m")
  git diff --name-only "$base" "$p2" | while read -r f; do
    git diff --quiet "$m" "$p1" -- "$f" \
      && echo "merge $short: $f is byte-identical to the first parent while the second parent changed it — that side is not in the result"
  done
  git diff --name-only "$base" "$p1" | while read -r f; do
    git diff --quiet "$m" "$p2" -- "$f" \
      && echo "merge $short: $f is byte-identical to the second parent while the first parent changed it — that side is not in the result"
  done
done
```

Each command prints nothing when the rule holds. Two limits are worth stating. The last check
only speaks on a repository that has merge commits — a branch integrated by rebase, or squashed
on arrival, leaves no second parent for it to compare against, so on a squash-merge trunk it is
the pull request's own merge preview that has to be read instead. And a file that legitimately
documents conflict markers — this file is one — is the marker check's only false positive;
exclude that path rather than weakening the pattern. Nothing here can tell whether a side was
dropped on purpose. That is what the merge commit's body is for, and no command can check that
the reason written there is true.
