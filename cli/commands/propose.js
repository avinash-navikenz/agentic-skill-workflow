"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { changeDir } = require("../lib/paths");
const { readState, writeState } = require("../lib/state");
const { isLane, gatesForLane, LANES } = require("../lib/lanes");
const { findUnreadableTemplate } = require("../lib/templates");

const FILES = ["proposal.md", "design.md", "tasks.md", "handoffs.md"];
const TEMPLATES = path.join(__dirname, "..", "..", "templates", "change");

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
  const laneIdx = argv.indexOf("--lane");

  if (!name || laneIdx === -1) {
    emit(USAGE);
    return 1;
  }

  // Controller ruling 2: distinguish "--lane given with no value" (a usage
  // error) from "--lane given with an invalid value" (an unknown-lane
  // error). Without this, "--lane" as the final argument reads argv[i+1]
  // as undefined and reports the confusing "unknown lane 'undefined'".
  if (laneIdx === argv.length - 1) {
    emit(`--lane requires a value — one of: ${Object.keys(LANES).join(", ")}`);
    return 1;
  }
  const lane = argv[laneIdx + 1];

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

  // Verify every template is readable BEFORE creating any directory. If a
  // template is missing or unreadable partway through a real propose, we'd
  // leave a half-built changes/<name>/ behind — and since this command
  // refuses to run when that directory already exists, that half-built
  // tree would permanently block retrying the same name.
  const missing = findUnreadableTemplate(TEMPLATES, FILES);
  if (missing) {
    emit(`cannot propose: template '${missing}' is missing or unreadable (expected at ${path.join(TEMPLATES, missing)}). Nothing was created.`);
    return 1;
  }

  fs.mkdirSync(path.join(dir, "specs"), { recursive: true });
  const gates = gatesForLane(lane).join(" · ");
  for (const f of FILES) {
    const body = fs.readFileSync(path.join(TEMPLATES, f), "utf8")
      .replace(/\{\{CHANGE\}\}/g, name)
      .replace(/\{\{LANE\}\}/g, lane)
      .replace(/\{\{GATES\}\}/g, gates);
    fs.writeFileSync(path.join(dir, f), body);
  }
  const s = readState(cwd);
  s.change = name; s.lane = lane; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(cwd, s);
  emit(`Created delivery/changes/${name} (lane: ${lane}; gates: ${gates})`);
  return 0;
}
module.exports = { run };
