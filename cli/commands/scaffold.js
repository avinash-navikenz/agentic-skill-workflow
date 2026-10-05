"use strict";
// Write one change artifact, when the work reaches it.
//
// `propose` deliberately scaffolds nothing: an empty template makes "nobody has
// started" indistinguishable from "somebody wrote this badly", and lets a gate
// pass against a placeholder. But the structure is real — design.md's nine
// headings are G3's exit criteria, and nine skills fill named sections of it —
// so the templates stay, and this is how you ask for one.
const fs = require("node:fs");
const path = require("node:path");
const { changeDir } = require("../lib/paths");
const { readState } = require("../lib/state");
const { gatesForLane } = require("../lib/lanes");
const { findUnreadableTemplate, templatesRoot } = require("../lib/templates");
const { flagValue } = require("../lib/args");

const ARTIFACTS = Object.freeze({
  proposal:  { file: "proposal.md",  skill: "navi-skill-change-proposal" },
  design:    { file: "design.md",    skill: "navi-skill-decision-records" },
  tasks:     { file: "tasks.md",     skill: "navi-skill-task-decomposition" },
  handoffs:  { file: "handoffs.md",  skill: "navi-skill-handoff-protocol" },
});

const USAGE = `usage: navi-delivery scaffold <${Object.keys(ARTIFACTS).join("|")}> [--change <slug>]

Writes one artifact from its template, into the change in flight. Refuses to
overwrite a file that already exists — the work in it is not this command's.`;

function run(argv, cwd, emit = console.log) {
  const which = argv[0];
  if (!which || argv.includes("--help")) { emit(USAGE); return which ? 0 : 1; }

  const spec = ARTIFACTS[which];
  if (!spec) {
    emit(`unknown artifact '${which}' — one of: ${Object.keys(ARTIFACTS).join(", ")}`);
    return 1;
  }

  const s = readState(cwd);
  const change = flagValue(argv, "--change").value || (s && s.change);
  if (!change) { emit("no change in flight — name one with --change <slug>"); return 1; }

  const dir = changeDir(cwd, change);
  if (!fs.existsSync(dir)) { emit(`no such change: ${change}`); return 1; }

  const dest = path.join(dir, spec.file);
  // Never over a file somebody wrote. This command exists to save typing a
  // skeleton, not to replace work.
  if (fs.existsSync(dest)) {
    emit(`${spec.file} already exists — refusing to overwrite. Delete it first if you meant to start again.`);
    return 1;
  }

  const templates = path.join(templatesRoot(), "change");
  const missing = findUnreadableTemplate(templates, [spec.file]);
  if (missing) {
    emit(`cannot scaffold: template '${missing}' is missing or unreadable (expected at ${path.join(templates, missing)}). Nothing was written.`);
    return 1;
  }

  const lane = s && s.lane ? s.lane : "";
  const body = fs.readFileSync(path.join(templates, spec.file), "utf8")
    .replace(/\{\{CHANGE\}\}/g, change)
    .replace(/\{\{LANE\}\}/g, lane)
    .replace(/\{\{GATES\}\}/g, lane ? gatesForLane(lane).join(" · ") : "");
  fs.writeFileSync(dest, body);

  emit(`Wrote delivery/changes/${change}/${spec.file} — a skeleton, not an answer.`);
  emit(`Its rules are in ${spec.skill}.`);
  return 0;
}

module.exports = { run, ARTIFACTS };
