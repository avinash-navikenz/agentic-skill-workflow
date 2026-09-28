"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { changeDir } = require("../lib/paths");
const { readState, writeState } = require("../lib/state");
const { isLane, gatesForLane, LANES } = require("../lib/lanes");
const { findUnreadableTemplate, templatesRoot } = require("../lib/templates");
const { flagValue } = require("../lib/args");

const FILES = ["proposal.md", "design.md", "tasks.md", "handoffs.md"];

const USAGE = "usage: navi-delivery propose <name> --lane <lane>";

// Controller ruling 1: the change name becomes a directory segment under
// delivery/changes/. Without validation, a name like "../../evil" escapes
// delivery/ entirely (path traversal driven by user input), and a name
// like "../../../etc/foo" could write template files into arbitrary
// locations. Require a safe slug: lowercase letters, digits, dot,
// underscore and hyphen, starting with a letter or digit. ".." is also
// rejected explicitly even though a name such as "a..b" would otherwise
// satisfy the character-class regex.
const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/;
function isValidName(name) {
  return typeof name === "string" && SLUG_RE.test(name) && !name.includes("..");
}

function run(argv, cwd, emit = console.log) {
  const name = argv[0];
  const laneFlag = flagValue(argv, "--lane");

  if (!name || !laneFlag.present) {
    emit(USAGE);
    return 1;
  }

  // Fix round 1 (Task 12 follow-up): state.json has exactly one `change`
  // field — one change in flight is the model the data already implies.
  // Before this check, proposing a second change while one was still
  // active silently overwrote state.change, wiping the first change's
  // lane/phase/gate history (propose used to reset gates/stale
  // unconditionally below) while leaving its directory behind on disk,
  // permanently un-archivable — archive's ruling C rightly refuses to
  // touch anything that isn't the active change, and by then there was no
  // recorded history left to check even if it wanted to.
  //
  // This runs right after the bare usage-shape check (missing name/--lane
  // entirely is still the most fundamental problem and is reported first)
  // but deliberately BEFORE validating this proposal's own --lane value,
  // name, or checking for a duplicate directory: an active change blocks
  // *any* new proposal unconditionally, so there is no reason to validate
  // a proposal that cannot proceed regardless of how well-formed it is.
  // It also runs well before the first filesystem write (mkdirSync, near
  // the bottom of this function) — nothing is created on this path.
  const s = readState(cwd);
  if (s.change) {
    emit(`change '${s.change}' is already active — archive it first (navi-delivery archive ${s.change}) before proposing another change`);
    return 1;
  }

  // Controller ruling 2: distinguish "--lane given with no usable value" (a
  // usage error) from "--lane given with an invalid value" (an unknown-lane
  // error). Without this, "--lane" as the final argument (or followed by
  // another flag) reads a bogus value and reports a confusing
  // "unknown lane" error instead of naming the real problem.
  if (!laneFlag.value) {
    emit(`--lane requires a value — one of: ${Object.keys(LANES).join(", ")}`);
    return 1;
  }
  const lane = laneFlag.value;

  if (!isValidName(name)) {
    emit(`invalid change name '${name}' — only lowercase letters, digits, '.', '_' and '-' are allowed, starting with a letter or digit (no '..', '/' or '\\')`);
    return 1;
  }

  if (!isLane(lane)) {
    emit(`unknown lane '${lane}' — valid lanes: ${Object.keys(LANES).join(", ")}`);
    return 1;
  }

  const dir = changeDir(cwd, name);
  if (fs.existsSync(dir)) {
    emit(`change '${name}' already exists`);
    return 1;
  }

  // Resolved per-call (not cached at module load) so NAVI_DELIVERY_TEMPLATES
  // can be set for the duration of a single test — see lib/templates.js.
  const templates = path.join(templatesRoot(), "change");

  // Verify every template is readable BEFORE creating any directory. If a
  // template is missing or unreadable partway through a real propose, we'd
  // leave a half-built changes/<name>/ behind — and since this command
  // refuses to run when that directory already exists, that half-built
  // tree would permanently block retrying the same name.
  const missing = findUnreadableTemplate(templates, FILES);
  if (missing) {
    emit(`cannot propose: template '${missing}' is missing or unreadable (expected at ${path.join(templates, missing)}). Nothing was created.`);
    return 1;
  }

  fs.mkdirSync(path.join(dir, "specs"), { recursive: true });
  const gates = gatesForLane(lane).join(" · ");
  for (const f of FILES) {
    const body = fs.readFileSync(path.join(templates, f), "utf8")
      .replace(/\{\{CHANGE\}\}/g, name)
      .replace(/\{\{LANE\}\}/g, lane)
      .replace(/\{\{GATES\}\}/g, gates);
    fs.writeFileSync(path.join(dir, f), body);
  }
  s.change = name; s.lane = lane; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(cwd, s);
  emit(`Created delivery/changes/${name} (lane: ${lane}; gates: ${gates})`);
  return 0;
}
module.exports = { run };
