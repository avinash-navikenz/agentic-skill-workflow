"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const cron = require("../../automation/cron/navi-cron.js");
const REPO = path.resolve(__dirname, "..", "..");
const CLI = path.join(REPO, "cli", "index.js");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

// A checkout with an origin it can push to, and delivery/ already initialised
// on the base branch — the state a real repository is in before cron runs.
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cron-fx-"));
  const work = path.join(root, "work");
  const origin = path.join(root, "origin.git");
  fs.mkdirSync(work);
  execFileSync("git", ["init", "--bare", "--initial-branch=main", origin]);
  git(["init", "--initial-branch=main"], work);
  git(["config", "user.email", "t@example.com"], work);
  git(["config", "user.name", "T"], work);
  const r = spawnSync(process.execPath, [CLI, "init"], { cwd: work, encoding: "utf8" });
  assert.strictEqual(r.status, 0, `init failed: ${r.stdout}${r.stderr}`);
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "init"], work);
  git(["remote", "add", "origin", origin], work);
  git(["push", "-q", "-u", "origin", "main"], work);
  return { root, work, origin };
}

function config(work, over = {}) {
  return Object.assign({
    source: { name: "test", fetch: `cat ${path.join(work, "items.json")}` },
    repo: { base: "main", remote: "origin", branchPrefix: "navi/" },
    lane: "express",
    maxPerRun: 10,
    stateFile: ".navi-cron-state.json",
    pr: { command: `printf '%s' "$NAVI_ITEM_TITLE" > "$NAVI_PR_LOG"` },
  }, over);
}

function ctx(work, over = {}) {
  return Object.assign({ repoRoot: work, log: () => {}, push: true, cliPath: CLI }, over);
}

function items(work, list) {
  fs.writeFileSync(path.join(work, "items.json"), JSON.stringify(list));
}

test("slugFor reduces a tracker id and title to a proposable slug", () => {
  assert.strictEqual(cron.slugFor({ id: "PROJ-12", title: "Add CSV export" }), "proj-12-add-csv-export");
  assert.ok(!cron.slugFor({ id: "X-1", title: "a".repeat(200) }).endsWith("-"));
  assert.ok(cron.slugFor({ id: "AB#4411", title: "Fix / the thing!" }).startsWith("ab-4411-fix-the-thing"));
});

test("two ids that reduce to the same text get different slugs", () => {
  // Reduction is lossy, and a collision is not cosmetic: the second item's
  // branch creation fails and keeps failing on every run.
  assert.notStrictEqual(cron.slugFor({ id: "AB#4411", title: "Fix login" }),
                        cron.slugFor({ id: "AB-4411", title: "Fix login" }));
  const long = "a".repeat(80);
  assert.notStrictEqual(cron.slugFor({ id: "P-1", title: long }),
                        cron.slugFor({ id: "P-2", title: long }));
  // An id that survives reduction intact keeps a clean, readable slug.
  assert.strictEqual(cron.slugFor({ id: "proj-7", title: "Short" }), "proj-7-short");
});

test("slugFor refuses an id that yields nothing usable", () => {
  assert.throws(() => cron.slugFor({ id: "###", title: "!!!" }), /no usable slug/);
});

test("validateItems rejects output that is not a list of identified items", () => {
  assert.throws(() => cron.validateItems({ issues: [] }), /JSON array/);
  assert.throws(() => cron.validateItems([{ title: "no id" }]), /no string 'id'/);
  assert.deepStrictEqual(cron.validateItems([{ id: " P-1 " }])[0].id, "P-1");
});

test("loadConfig rejects a lane the CLI would refuse", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cfg-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ source: { fetch: "true" }, repo: { base: "main", remote: "origin" }, lane: "quick" }));
  assert.throws(() => cron.loadConfig(f), /is not one of express/);
});

test("a run proposes a change, commits it, and pushes the branch", () => {
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-7", title: "Add CSV export", url: "https://jira/PROJ-7", body: "Finance asked." }]);
  const cfg = config(work);
  const prLog = path.join(work, "pr.txt");
  process.env.NAVI_PR_LOG = prLog;

  const result = cron.run(cfg, ctx(work));
  assert.strictEqual(result.failed.length, 0);
  assert.strictEqual(result.proposed.length, 1);

  const branch = "navi/proj-7-add-csv-export";
  assert.match(git(["branch", "--list", branch], origin), /proj-7/);
  const files = git(["ls-tree", "-r", "--name-only", branch], origin);
  assert.match(files, /delivery\/changes\/proj-7-add-csv-export\/proposal\.md/);
  const proposal = git(["show", `${branch}:delivery/changes/proj-7-add-csv-export/proposal.md`], origin);
  assert.match(proposal, /Add CSV export/);
  assert.match(proposal, /Finance asked\./);
  assert.strictEqual(fs.readFileSync(prLog, "utf8"), "Add CSV export");
});

test("tracker text never reaches a shell as code", () => {
  const { work } = fixture();
  const canary = path.join(work, "pwned");
  items(work, [{ id: "PROJ-8", title: `x"; touch ${canary}; echo "`, body: `$(touch ${canary})` }]);
  const cfg = config(work);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");

  const result = cron.run(cfg, ctx(work));
  assert.strictEqual(result.failed.length, 0, JSON.stringify(result.failed));
  assert.ok(!fs.existsSync(canary), "a title executed as a command");
  assert.strictEqual(fs.readFileSync(path.join(work, "pr.txt"), "utf8"), `x"; touch ${canary}; echo "`);
});

test("without --push nothing reaches the remote and nothing stays local", () => {
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-9", title: "Local only" }]);
  const result = cron.run(config(work), ctx(work, { push: false }));
  assert.strictEqual(result.proposed[0].pushed, false);
  assert.strictEqual(git(["branch", "--list", "navi/proj-9-local-only"], origin), "");
  assert.strictEqual(git(["branch", "--list", "navi/proj-9-local-only"], work), "");
});

test("an item already processed is not proposed twice", () => {
  const { work } = fixture();
  items(work, [{ id: "PROJ-10", title: "Once" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");
  const cfg = config(work);
  assert.strictEqual(cron.run(cfg, ctx(work)).proposed.length, 1);
  assert.strictEqual(cron.run(cfg, ctx(work)).proposed.length, 0);
});

test("a failed item is not recorded, and the NEXT run fails the same way, not worse", () => {
  const { work } = fixture();
  items(work, [{ id: "PROJ-11", title: "Breaks" }]);
  const cfg = config(work, { pr: { command: "exit 3" } });

  const first = cron.run(cfg, ctx(work));
  assert.strictEqual(first.failed.length, 1);
  assert.match(first.failed[0].message, /pull-request command failed \(3\)/);
  assert.strictEqual(cron.readProcessed(work, cfg).has("PROJ-11"), false);

  // The whole point of not recording it. A leftover branch used to make every
  // later run die at `checkout -b ... already exists`, reporting a git error
  // instead of the real one, for the life of that branch.
  const second = cron.run(cfg, ctx(work));
  assert.strictEqual(second.failed.length, 1);
  assert.match(second.failed[0].message, /pull-request command failed \(3\)/,
               "the retry reported a different failure — the first run left something behind");
});

test("no local branch exists at any point during a run, not merely after it", () => {
  // Checking only after the run passed under the old model too, which created
  // the branch and deleted it in its `finally`. The pull-request command runs
  // mid-flight — after the point a branch would have been created — so it is
  // what can see the difference.
  const { work } = fixture();
  items(work, [{ id: "PROJ-19", title: "Mid flight" }]);
  const seen = path.join(work, "branches-during-run.txt");
  const cfg = config(work, {
    pr: { command: `git -C "${work}" branch --list 'navi/*' > "${seen}"` },
  });

  const result = cron.run(cfg, ctx(work));
  assert.strictEqual(result.failed.length, 0, JSON.stringify(result.failed));
  assert.strictEqual(fs.readFileSync(seen, "utf8").trim(), "",
                     "a local branch existed while the run was in flight");
  assert.strictEqual(git(["branch", "--list", "navi/*"], work), "");
});

test("a run without --push records nothing, so the first real run still opens it", () => {
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-14", title: "Trial week" }]);
  const cfg = config(work);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");

  // The documented onboarding: run it without --push for a week first.
  for (let i = 0; i < 3; i += 1) assert.strictEqual(cron.run(cfg, ctx(work, { push: false })).proposed.length, 1);
  assert.strictEqual(cron.readProcessed(work, cfg).size, 0, "a dry run recorded the item");
  assert.strictEqual(git(["branch", "--list", "navi/proj-14-trial-week"], work), "",
                     "a dry run left a branch in the checkout");

  // Then the real one.
  const real = cron.run(cfg, ctx(work));
  assert.strictEqual(real.proposed.length, 1);
  assert.strictEqual(real.proposed[0].pushed, true);
  assert.match(git(["branch", "--list", "navi/proj-14-trial-week"], origin), /proj-14/);
});

test("a remote configured as a relative path still pushes", () => {
  // The push used to run inside the worktree, which lives under the system temp
  // directory, so `../origin.git` resolved against the wrong place and every
  // push failed with "does not appear to be a git repository".
  const { work, origin } = fixture();
  git(["remote", "set-url", "origin", path.relative(work, origin)], work);
  items(work, [{ id: "PROJ-17", title: "Relative remote" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");
  const result = cron.run(config(work), ctx(work));
  assert.strictEqual(result.failed.length, 0, JSON.stringify(result.failed));
  assert.match(git(["branch", "--list", "navi/proj-17-relative-remote"], origin), /proj-17/);
});

test("a local branch of the same name is neither used nor touched", () => {
  // It used to be force-reset by `checkout -B` and then force-deleted in the
  // finally — so a branch a person had made, carrying a commit that existed
  // nowhere else, was silently destroyed by a successful run.
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-15", title: "Interrupted" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");

  git(["branch", "navi/proj-15-interrupted"], work);
  git(["checkout", "-q", "navi/proj-15-interrupted"], work);
  fs.writeFileSync(path.join(work, "theirs.txt"), "a commit that exists nowhere else");
  git(["add", "theirs.txt"], work);          // not -A: items.json must stay untracked
  git(["commit", "-q", "-m", "HUMAN: work in progress"], work);
  const theirs = git(["rev-parse", "navi/proj-15-interrupted"], work);
  git(["checkout", "-q", "main"], work);

  const result = cron.run(config(work), ctx(work));
  assert.strictEqual(result.failed.length, 0, JSON.stringify(result.failed));
  assert.strictEqual(git(["rev-parse", "navi/proj-15-interrupted"], work), theirs,
                     "the run moved or deleted a branch it did not create");
  assert.match(git(["branch", "--list", "navi/proj-15-interrupted"], origin), /proj-15/);
});

test("a remote branch this run cannot fast-forward is never overwritten", () => {
  // --force-with-lease used to guard this, but the lease reads a tracking ref
  // this runner never refreshes — so one `git fetch` by anybody made the force
  // succeed and a person's commits disappeared from the remote.
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-18", title: "Contested" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");
  const branch = "navi/proj-18-contested";

  // Somebody else's branch, already on the remote, unrelated to our base.
  git(["checkout", "-q", "-b", "theirs"], work);
  fs.writeFileSync(path.join(work, "theirs.txt"), "their work");
  git(["add", "theirs.txt"], work);          // not -A: items.json must stay untracked
  git(["commit", "-q", "-m", "HUMAN: wrote the proposal"], work);
  git(["push", "-q", "origin", `HEAD:refs/heads/${branch}`], work);
  const theirs = git(["rev-parse", "HEAD"], work);
  git(["checkout", "-q", "main"], work);
  git(["fetch", "-q", "origin"], work);        // the step that defeated the lease

  const result = cron.run(config(work), ctx(work));
  assert.strictEqual(result.failed.length, 1);
  assert.match(result.failed[0].message, /carries commits this run did not make/);
  assert.strictEqual(git(["rev-parse", branch], origin), theirs,
                     "the run overwrote a branch somebody else had pushed");
});

test("a retry still recognises its own branch after the base has moved", () => {
  // The tree comparison this replaced was computed against the CURRENT base, so
  // the moment anybody merged to main the rebuilt tree differed from the pushed
  // one and the runner declared its own branch to be somebody else's — refusing
  // the item permanently. Bases move constantly, which made the retry path a
  // one-shot.
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-41", title: "Retry me" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");

  // Run 1: the pull-request step fails after the branch is pushed.
  const first = cron.run(config(work, { pr: { command: "exit 3" } }), ctx(work));
  assert.strictEqual(first.failed.length, 1);
  const pushed = git(["rev-parse", "navi/proj-41-retry-me"], origin);

  // Somebody merges to the base.
  fs.writeFileSync(path.join(work, "moved.txt"), "someone else's merge");
  git(["add", "moved.txt"], work);
  git(["commit", "-q", "-m", "someone else's merge"], work);
  git(["push", "-q", "origin", "main"], work);

  // Run 2: the documented retry. It must reopen, not accuse a person.
  const second = cron.run(config(work), ctx(work));
  assert.strictEqual(second.failed.length, 0, JSON.stringify(second.failed));
  assert.strictEqual(second.proposed[0].pushed, true);
  assert.strictEqual(git(["rev-parse", "navi/proj-41-retry-me"], origin), pushed,
                     "the retry rewrote a branch it only needed to reopen");
  assert.ok(cron.readProcessed(work, config(work)).has("PROJ-41"));
});

test("a state file that cannot be read or parsed stops the run", () => {
  const { work } = fixture();
  const cfg = config(work);
  const state = path.join(work, cfg.stateFile);

  fs.writeFileSync(state, "{truncated");
  assert.throws(() => cron.run(cfg, ctx(work)), /not valid JSON[\s\S]*Refusing to run/);

  fs.writeFileSync(state, JSON.stringify({ done: [] }));
  assert.throws(() => cron.run(cfg, ctx(work)), /no 'processed' array/);

  // Unreadable is not the same as absent. Only ENOENT means "nothing yet";
  // anything else used to fall through to an empty set and re-propose the lot.
  fs.writeFileSync(state, JSON.stringify({ processed: ["PROJ-30"] }));
  fs.chmodSync(state, 0o000);
  try {
    assert.throws(() => cron.run(cfg, ctx(work)), /cannot be read \(EACCES\)/);
  } finally {
    fs.chmodSync(state, 0o644);
  }
  fs.rmSync(state);
  fs.mkdirSync(state);
  assert.throws(() => cron.run(cfg, ctx(work)), /cannot be read \(EISDIR\)/);
});

test("a stateFile pointing outside the repository is refused", () => {
  const { work } = fixture();
  items(work, [{ id: "PROJ-16", title: "Escape" }]);
  assert.throws(() => cron.run(config(work, { stateFile: "../escaped.json" }), ctx(work)),
                /resolves outside the repository/);
  assert.throws(() => cron.run(config(work, { stateFile: "/tmp/escaped.json" }), ctx(work)),
                /resolves outside the repository/);

  // A symlink inside the checkout pointing out of it: path arithmetic alone
  // said this was contained, and the run then read and wrote outside the repo.
  const outside = path.join(path.dirname(work), "outside.json");
  fs.symlinkSync(outside, path.join(work, "state-link.json"));
  assert.throws(() => cron.run(config(work, { stateFile: "state-link.json" }), ctx(work)),
                /resolves outside the repository/);
  assert.strictEqual(fs.existsSync(outside), false, "the run wrote outside the repository");

  // Two hops: resolving only the first one landed inside the repository and
  // passed, while the write followed the chain the rest of the way out.
  fs.symlinkSync("hop2.json", path.join(work, "hop1.json"));
  fs.symlinkSync(path.join("..", "outside.json"), path.join(work, "hop2.json"));
  assert.throws(() => cron.run(config(work, { stateFile: "hop1.json" }), ctx(work)),
                /resolves outside the repository/);
  assert.strictEqual(fs.existsSync(outside), false, "a two-hop link wrote outside the repository");
});

test("the checkout cron runs in is left on its own branch, clean", () => {
  const { work } = fixture();
  items(work, [{ id: "PROJ-12", title: "Untouched" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");
  cron.run(config(work), ctx(work));
  assert.strictEqual(git(["rev-parse", "--abbrev-ref", "HEAD"], work), "main");
  const dirty = git(["status", "--porcelain"], work)
    .split("\n").filter((l) => l && !/items\.json|pr\.txt|navi-cron-state/.test(l));
  assert.deepStrictEqual(dirty, [], `checkout was modified: ${dirty.join("; ")}`);
  assert.strictEqual(git(["worktree", "list"], work).split("\n").length, 1);
  // "Never touches your checkout" includes its branch list. A branch per item
  // accumulating here is touching it, and the earlier version of this test
  // checked HEAD, status and worktrees but not this.
  assert.strictEqual(git(["branch", "--list", "navi/*"], work), "",
                     "a navi/ branch was left in the checkout");
});

test("maxPerRun bounds how many items one run opens", () => {
  const { work } = fixture();
  items(work, [{ id: "A-1", title: "one" }, { id: "A-2", title: "two" }, { id: "A-3", title: "three" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");
  const result = cron.run(config(work, { maxPerRun: 2 }), ctx(work));
  assert.strictEqual(result.proposed.length, 2);
});

test("a fetch command that fails stops the run with its stderr", () => {
  const { work } = fixture();
  assert.throws(() => cron.run(config(work, { source: { fetch: "echo nope >&2; exit 4" } }), ctx(work)),
                /source\.fetch failed \(4\): nope/);
});

test("--max refuses anything that is not a whole number", () => {
  // Number("abc") is NaN and slice(0, NaN) is empty, so a typo used to report a
  // clean zero-item run. `--max` with nothing after it fell back to the config.
  const err = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { err.push(String(s)); return true; };
  try {
    assert.strictEqual(cron.main(["--config", "nonsuch.json", "--max", "abc"]), 2);
    assert.match(err.join(""), /--max must be a whole number/);
    err.length = 0;
    assert.strictEqual(cron.main(["--config", "nonsuch.json", "--max"]), 2);
    assert.match(err.join(""), /--max needs a whole number/);
  } finally {
    process.stderr.write = write;
  }
});

test("main() runs end to end — the entry point every cron line actually calls", () => {
  // The suite exercised run() directly and called main() only on paths that
  // return before doing work, so a ReferenceError in main left 191 tests green
  // while every real invocation died. This drives the whole entry point.
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-40", title: "End to end" }]);
  const cfgPath = path.join(work, "cfg.json");
  fs.writeFileSync(cfgPath, JSON.stringify({
    source: { name: "t", fetch: `cat ${path.join(work, "items.json")}` },
    repo: { base: "main", remote: "origin", branchPrefix: "navi/" },
    lane: "express", maxPerRun: 3, stateFile: ".navi-cron-state.json",
    pr: { command: "true" },
  }));

  const cwd = process.cwd();
  const out = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { out.push(String(s)); return true; };
  let code;
  try {
    process.chdir(work);
    code = cron.main(["--config", cfgPath, "--push"]);
  } finally {
    process.stdout.write = write;
    process.chdir(cwd);
  }

  assert.strictEqual(code, 0, out.join(""));
  assert.match(out.join(""), /1 proposed, 0 failed/);
  assert.match(git(["branch", "--list", "navi/proj-40-end-to-end"], origin), /proj-40/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(work, ".navi-cron-state.json"), "utf8")).processed[0],
                     "PROJ-40");
});
