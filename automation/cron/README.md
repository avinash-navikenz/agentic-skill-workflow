# navi-cron — tracker items to proposed branches, on a schedule

Optional. Nothing in the framework needs it, and a team that proposes changes by hand
loses nothing by never installing it.

What one run does: ask the tracker for candidate work items, and for each one it has
not seen before, branch off the base, run `navi-delivery propose`, seed the proposal
from the item, commit, push, and open a pull request.

What it does **not** do: write a specification, design anything, or satisfy a gate. The
branch it opens is a starting point with the work item's title and link in it. A person
still writes the proposal — the saving is the branch, the scaffold and the link, not
the thinking.

## Three properties worth knowing before you schedule it

**It never touches the checkout it runs in.** Every change happens in a git worktree it
creates and removes. A cron job that left your working tree on another branch overnight
would cost more than it saves, so it cannot.

**Tracker text never reaches a shell as code.** In most organisations anyone can file a
ticket, so a summary of `"; rm -rf ~; #` is a thing that can arrive. Configured commands
get their values from the environment — `$NAVI_ITEM_TITLE`, `$NAVI_ITEM_ID`,
`$NAVI_ITEM_URL`, `$NAVI_ITEM_BODY`, `$NAVI_BRANCH`, `$NAVI_BASE`, `$NAVI_SLUG` — and
quote them themselves. `tests/cron/navi-cron.test.js` asserts a hostile title stays a
title.

**It does nothing irreversible without `--push`.** The default stops at the local commit
and reports what it would have pushed. Run it that way for a week first.

## Configure

Start from `navi-cron.jira.example.json` or `navi-cron.ado.example.json`.

`source.fetch` is a shell command that must print a **JSON array** of items:

```json
[{ "id": "PROJ-7", "title": "Add CSV export", "url": "https://jira/PROJ-7", "body": "optional", "lane": "optional" }]
```

Only `id` is required. `lane` on an item overrides the config's `lane` for that item.
That contract is the whole integration surface: any tracker that can be queried from a
shell works, and the examples use `jq` to reshape Jira and Azure Boards output into it.
Needing `jq` is a property of the examples, not of the runner.

`pr.command` runs after the push. Leave it out and the branch is pushed with no pull
request opened.

## Run it once by hand

```bash
node automation/cron/navi-cron.js --config automation/cron/navi-cron.jira.example.json
# add --push when you believe what it printed
```

Credentials come from the environment the command runs in — the same variables the
`navi-skill-work-item-sync` skill uses. Nothing is read from the config.

## Schedule it

```bash
./automation/cron/install-cron.sh --config /abs/path/to/config.json           # prints the line
./automation/cron/install-cron.sh --config /abs/path/to/config.json --apply   # installs it
```

Printing is the default on purpose. `--apply` replaces any previous navi-cron line for
this repository rather than appending, so running it twice leaves one job, not two jobs
opening duplicate branches for the same item.

cron does not read your shell profile, so the scheduled line sources
`$HOME/.navi-cron.env` if it exists. Put the tracker variables there and `chmod 600` it.

## What it remembers

`.navi-cron-state.json` beside the checkout, holding the ids it has proposed. An item is
recorded only after its branch is pushed and its pull request opened — a failure halfway
is retried on the next run rather than silently dropped. Delete a line from that file to
make it propose an item again. Both the state file and `.navi-cron.log` are gitignored.

## When it fails

| Symptom | Almost always |
| --- | --- |
| `source.fetch failed` | the credential variables were not in the environment cron ran with |
| `source.fetch output unusable` | the `jq` filter printed an object, or an error, instead of an array |
| `propose failed` | the base branch has a change already in flight; `delivery/` allows one |
| `pull-request command failed` | `gh`/`az` is not on cron's PATH, or not logged in as anyone |
| nothing happens, no error | every candidate id is already in `.navi-cron-state.json` |
