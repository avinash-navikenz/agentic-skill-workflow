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
  assert.strictEqual(cron.slugFor({ id: "AB#4411", title: "Fix / the thing!" }), "ab-4411-fix-the-thing");
  assert.ok(!cron.slugFor({ id: "X-1", title: "a".repeat(200) }).endsWith("-"));
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

test("without --push nothing reaches the remote", () => {
  const { work, origin } = fixture();
  items(work, [{ id: "PROJ-9", title: "Local only" }]);
  const result = cron.run(config(work), ctx(work, { push: false }));
  assert.strictEqual(result.proposed[0].pushed, false);
  assert.strictEqual(git(["branch", "--list", "navi/proj-9-local-only"], origin), "");
});

test("an item already processed is not proposed twice", () => {
  const { work } = fixture();
  items(work, [{ id: "PROJ-10", title: "Once" }]);
  process.env.NAVI_PR_LOG = path.join(work, "pr.txt");
  const cfg = config(work);
  assert.strictEqual(cron.run(cfg, ctx(work)).proposed.length, 1);
  assert.strictEqual(cron.run(cfg, ctx(work)).proposed.length, 0);
});

test("a failed item is not recorded, so the next run retries it", () => {
  const { work } = fixture();
  items(work, [{ id: "PROJ-11", title: "Breaks" }]);
  const cfg = config(work, { pr: { command: "exit 3" } });
  const result = cron.run(cfg, ctx(work));
  assert.strictEqual(result.failed.length, 1);
  assert.match(result.failed[0].message, /pull-request command failed \(3\)/);
  assert.strictEqual(cron.readProcessed(work, cfg).has("PROJ-11"), false);
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
