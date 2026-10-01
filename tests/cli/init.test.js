const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const { readState } = require("../../cli/lib/state");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "nd-init-"));

// The three "template is missing / is a directory" tests below need to
// mutate a templates tree to provoke the failure they're checking for.
// Doing that to the repository's own shipped templates/ is unsafe under
// node:test's default per-file parallelism (see lib/templates.js for the
// full reasoning), so instead: copy templates/ to a disposable temp
// directory, point NAVI_DELIVERY_TEMPLATES at the copy, mutate only the
// copy, and always restore the environment variable afterwards so no test
// leaks the override to another test in this file.
function withTemplatesOverride(fn) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "nd-templates-"));
  fs.cpSync(path.join(__dirname, "..", "..", "templates"), copy, { recursive: true });
  const prev = process.env.NAVI_DELIVERY_TEMPLATES;
  process.env.NAVI_DELIVERY_TEMPLATES = copy;
  try {
    fn(copy);
  } finally {
    if (prev === undefined) delete process.env.NAVI_DELIVERY_TEMPLATES;
    else process.env.NAVI_DELIVERY_TEMPLATES = prev;
  }
}

test("init creates the full delivery tree", () => {
  const root = tmp();
  assert.strictEqual(init.run([], root, () => {}), 0);
  for (const rel of ["project.md", "AGENTS.md", "specs", "changes/archive",
                     "decisions", "ops/runbooks", "ops/postmortems", "ops/models",
                     "ops/slo.md",
                     ".adlc/state.json", ".adlc/waivers.md"]) {
    assert.ok(fs.existsSync(path.join(root, "delivery", rel)), `missing ${rel}`);
  }
});

// G8-OPERATE names delivery/ops/slo.md by path and its drift/decay criterion is
// satisfied by files under delivery/ops/models/. Both must exist after a bare
// init or the gate is unsatisfiable out of the box.
test("init scaffolds the G8 operating artifacts: ops/slo.md and ops/models/", () => {
  const root = tmp();
  init.run([], root, () => {});
  const slo = fs.readFileSync(path.join(root, "delivery", "ops", "slo.md"), "utf8");
  assert.ok(slo.includes("SLI-001"), "slo.md should ship an SLI-### entry shape");
  assert.ok(slo.includes("**Objective:**"), "slo.md should ship the Objective field");
  assert.ok(slo.includes("**Error budget:**"), "slo.md should ship the Error budget field");
  assert.ok(fs.statSync(path.join(root, "delivery", "ops", "models")).isDirectory());
  assert.ok(fs.existsSync(path.join(root, "delivery", "ops", "models", ".gitkeep")));
});

test("init writes a valid initial state", () => {
  const root = tmp();
  init.run([], root, () => {});
  const s = JSON.parse(fs.readFileSync(path.join(root, "delivery", ".adlc", "state.json"), "utf8"));
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.change, null);
});

test("init refuses when delivery/ exists and leaves content untouched", () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, "delivery"), { recursive: true });
  const sentinel = path.join(root, "delivery", "mine.md");
  fs.writeFileSync(sentinel, "do not touch");
  const lines = [];
  assert.strictEqual(init.run([], root, (s) => lines.push(s)), 1);
  assert.strictEqual(fs.readFileSync(sentinel, "utf8"), "do not touch");
  assert.ok(lines.join("\n").includes("already exists"));
  assert.ok(!fs.existsSync(path.join(root, "delivery", "project.md")));
});

// --- Controller ruling: verify templates BEFORE creating any directory ---

test("init with a missing template creates nothing and fails clearly", () => {
  withTemplatesOverride((templatesCopy) => {
    const root = tmp();
    const projectTemplate = path.join(templatesCopy, "delivery", "project.md");
    fs.rmSync(projectTemplate);
    const lines = [];
    const code = init.run([], root, (s) => lines.push(s));
    assert.strictEqual(code, 1);
    assert.ok(lines.join("\n").includes("project.md"), "error should name the missing template");
    assert.ok(!fs.existsSync(path.join(root, "delivery")), "delivery/ must not exist after a failed init");
  });
});

test("init with a template path that is a directory (not a file) creates nothing and fails clearly", () => {
  withTemplatesOverride((templatesCopy) => {
    const root = tmp();
    const projectTemplate = path.join(templatesCopy, "delivery", "project.md");
    fs.rmSync(projectTemplate);
    fs.mkdirSync(projectTemplate); // stand-in: a directory where a file is expected
    const lines = [];
    const code = init.run([], root, (s) => lines.push(s));
    assert.strictEqual(code, 1);
    assert.ok(lines.join("\n").includes("project.md"), "error should name the offending template");
    assert.ok(!fs.existsSync(path.join(root, "delivery")), "delivery/ must not exist after a failed init");
  });
});

// The preflight must cover EVERY template init copies, not just the first one.
// A template added to TEMPLATE_FILES but left out of findUnreadableTemplate()
// would fail at copy time — after the directories exist — leaving a half-built
// delivery/ that init itself then refuses to overwrite.
test("init with a missing ops/slo.md template creates nothing and fails clearly", () => {
  withTemplatesOverride((templatesCopy) => {
    const root = tmp();
    fs.rmSync(path.join(templatesCopy, "delivery", "ops", "slo.md"));
    const lines = [];
    const code = init.run([], root, (s) => lines.push(s));
    assert.strictEqual(code, 1);
    assert.ok(lines.join("\n").includes("slo.md"), "error should name the missing template");
    assert.ok(!fs.existsSync(path.join(root, "delivery")), "delivery/ must not exist after a failed init");
  });
});

// --- Additional coverage beyond the brief ---

test("AGENTS.md is created and contains the generated-file marker", () => {
  const root = tmp();
  init.run([], root, () => {});
  const contents = fs.readFileSync(path.join(root, "delivery", "AGENTS.md"), "utf8");
  assert.ok(contents.includes("<!-- GENERATED by navi-delivery build_adapters -->"));
});

test(".adlc/waivers.md exists and contains the waiver table header", () => {
  const root = tmp();
  init.run([], root, () => {});
  const contents = fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8");
  assert.ok(contents.includes("| Date | Change | Gate | Reason | Expires | Approved by |"));
});

test("the state written by init round-trips through readState() without throwing", () => {
  const root = tmp();
  init.run([], root, () => {});
  const s = readState(root);
  assert.deepStrictEqual(s, { version: 1, change: null, lane: null, phase: 1, gates: {}, stale: [] });
});
