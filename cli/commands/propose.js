"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { changeDir } = require("../lib/paths");
const { readState, writeState } = require("../lib/state");
const { isLane, gatesForLane, LANES } = require("../lib/lanes");
const { flagValue } = require("../lib/args");
const { GATES, evidenceHint, advise } = require("../lib/gates");

// The artifacts a change produces, and the skill that carries each one's
// template. NOT files this command writes.
//
// An empty scaffold makes "nobody has started" indistinguishable from "somebody
// wrote this badly", and a gate can pass against a placeholder nobody filled in.
// The skills already carry these templates — that is what a skill IS — so the
// CLI creating a second copy was both redundant and a way to ship files no
// author ever opened. The directory is structure; the files are work.
const ARTIFACTS = [
  { file: "proposal.md", skill: "navi-skill-change-proposal",    what: "why this change, and the outcome it commits to" },
  { file: "design.md",   skill: "navi-skill-decision-records",   what: "the approach, and an ADR per consequential decision" },
  { file: "tasks.md",    skill: "navi-skill-task-decomposition", what: "TASK-### bound to the REQ-### each implements" },
  { file: "handoffs.md", skill: "navi-skill-handoff-protocol",   what: "who hands what to whom, and what is blocked" },
];

// Directories only. `specs/` holds the delta spec and `evidence/` the files
// gates are recorded against; both are places, not content.
const DIRS = ["specs", "evidence"];

const USAGE = [
  "usage: navi-delivery propose <name> --lane <express|standard|full|hotfix>",
  "",
  "  <name>   a slug: lowercase letters, digits, '.', '_', '-'  (e.g. dashboard-accent)",
  "  --lane   how many gates this change answers to; navi-skill-lane-selection picks it",
].join("\n");

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

// A developer naming a change types what they would say out loud — "accent
// colour on the dashboard". Rejecting that with the rule alone makes them
// derive the slug themselves; offering the slug makes the next command a
// copy-paste. Returns "" when nothing usable survives (e.g. "???").
function suggestName(name) {
  const slug = String(name).toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "")
    .replace(/\.\.+/g, ".");
  return isValidName(slug) ? slug : "";
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
    emit(`invalid change name '${name}' — a change name is a slug: lowercase letters, digits, '.', '_' and '-', starting with a letter or digit.`);
    const suggestion = suggestName(name);
    if (suggestion) {
      emit("");
      emit(`  navi-delivery propose ${suggestion}${laneFlag.value ? ` --lane ${laneFlag.value}` : ""}`);
    }
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

  for (const d of DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const gateList = gatesForLane(lane);
  const gates = gateList.join(" · ");
  s.change = name; s.lane = lane; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(cwd, s);
  const first = gateList[0];

  emit(`Created delivery/changes/${name}/  ·  lane ${lane}  ·  ${gateList.length} gates: ${gates}`);
  emit("");
  emit("  specs/      the delta spec for each capability this change touches");
  emit("  evidence/   the files gates are recorded against");
  emit("");
  emit("Write these as the work reaches them — nothing is scaffolded, so a file that");
  emit("exists is a file somebody wrote:");
  emit("");
  for (const a of ARTIFACTS) emit(`  ${a.file.padEnd(13)} ${a.what.padEnd(52)} ${a.skill}`);
  emit("");
  emit("  navi-delivery scaffold <proposal|design|tasks|handoffs>   writes one skeleton");

  advise(["",
          `Start with proposal.md. ${first} reads it: ${GATES[first].needs}.`,
          "",
          `Then:  navi-delivery gate ${first} --pass --evidence ${evidenceHint(first, name)}`]);
  return 0;
}
module.exports = { run };
