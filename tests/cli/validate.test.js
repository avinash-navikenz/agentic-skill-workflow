"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const validate = require("../../cli/commands/validate");
const { readState, writeState } = require("../../cli/lib/state");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-val-"));
  init.run([], root, () => {});
  return root;
}

// A delivery/specs/**/spec.md defining REQ-001 (with AC-001, implemented by
// the task writeTask() lands below) and REQ-002 (with AC-002, implemented by
// nothing). Plain `validate` has nothing to flag T1-T3 on; only --strict's
// T4 rule flags REQ-002 as orphaned, which is what lets the two tests below
// prove --strict actually changes traceability's behaviour on one fixture.
function writeWellFormedSpec(root) {
  const dir = path.join(root, "delivery", "specs", "theme");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    "# Spec\n" +
      "## REQ-001 Users can toggle theme\n" +
      "### AC-001 Given a logged-in user, when they toggle, then it persists.\n" +
      "## REQ-002 Theme respects system preference\n" +
      "### AC-002 Given no explicit choice, then it follows the OS setting.\n",
  );
}

// The change's own tasks.md. templates/change/tasks.md ships its example with
// `TASK-###` / `REQ-###` placeholders that no validator rule matches, so a
// freshly proposed change carries no live task at all — see the note in that
// template. A fixture that wants one writes it.
function writeTask(root, change) {
  fs.writeFileSync(
    path.join(root, "delivery", "changes", change, "tasks.md"),
    "# Tasks\n\n- [ ] **TASK-001** Add the toggle\n  - Implements: REQ-001\n",
  );
}

test("validate fails while stale artifacts remain", () => {
  const root = repo();
  propose.run(["c", "--lane", "standard"], root, () => {});
  const s = readState(root); s.stale = ["gate:G6"]; writeState(root, s);
  const lines = [];
  assert.strictEqual(validate.run([], root, (x) => lines.push(x)), 1);
  assert.match(lines.join("\n"), /1 stale artifact/);
});

test("validate succeeds on a well-formed tree with no stale artifacts", () => {
  const root = repo();
  propose.run(["c", "--lane", "standard"], root, () => {});
  writeWellFormedSpec(root);
  writeTask(root, "c");
  // TASK-001 implements REQ-001, so no T1/T2/T3 findings arise, and REQ-002 is
  // only orphaned under --strict, not under plain validate.
  const lines = [];
  const code = validate.run([], root, (x) => lines.push(x));
  assert.strictEqual(code, 0, lines.join("\n"));
  assert.match(lines.join("\n"), /validate: OK/);
});

test("--strict propagates into traceability while plain validate does not, on the same fixture", () => {
  const root = repo();
  propose.run(["c", "--lane", "standard"], root, () => {});
  writeWellFormedSpec(root);
  writeTask(root, "c");

  const plainLines = [];
  const plainCode = validate.run([], root, (x) => plainLines.push(x));
  assert.strictEqual(plainCode, 0, plainLines.join("\n"));
  assert.doesNotMatch(plainLines.join("\n"), /\bT4\b/);

  const strictLines = [];
  const strictCode = validate.run(["--strict"], root, (x) => strictLines.push(x));
  assert.strictEqual(strictCode, 1, strictLines.join("\n"));
  assert.match(strictLines.join("\n"), /\bT4\b/);
  assert.match(strictLines.join("\n"), /REQ-002/);
  // REQ-001 is implemented by TASK-001, so --strict must not flag it.
  assert.doesNotMatch(strictLines.join("\n"), /REQ-001/);
});

// spawnSync inherits process.env by default (validate.js passes no `env`
// override), so pointing PATH at a directory with no python3 reliably
// reproduces "python3 is missing" without depending on — or disturbing —
// whatever the host's real PATH happens to contain. The override is
// process-local and restored in `finally`; node:test isolates each test
// file into its own process, so this cannot leak into another file.
test("validate reports a clear, non-zero failure when python3 is not on PATH", () => {
  const root = repo();
  propose.run(["c", "--lane", "standard"], root, () => {});
  writeWellFormedSpec(root);

  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), "nd-val-emptybin-"));
  const savedPath = process.env.PATH;
  process.env.PATH = emptyBin;
  try {
    const lines = [];
    const code = validate.run([], root, (x) => lines.push(x));
    assert.strictEqual(code, 1);
    const out = lines.join("\n");
    // A spawn failure must be reported by name, not just folded silently
    // into a generic "validate: FAILED".
    assert.match(out, /validate_manifests\.py/);
    assert.match(out, /ENOENT|no such file|not found/i);
  } finally {
    process.env.PATH = savedPath;
  }
});
