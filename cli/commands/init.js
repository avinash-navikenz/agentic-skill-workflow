"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { deliveryDir } = require("../lib/paths");
const { newState, writeState } = require("../lib/state");
const { detectHarness } = require("../lib/capabilities");
const { findUnreadableTemplate } = require("../lib/templates");

const DIRS = ["specs", "changes/archive", "decisions", "ops/runbooks", "ops/postmortems", ".adlc"];
const GITKEEP_DIRS = ["specs", "changes/archive", "decisions", "ops/runbooks", "ops/postmortems"];
const TEMPLATES = path.join(__dirname, "..", "..", "templates", "delivery");

// Template name (relative to TEMPLATES) -> destination path relative to delivery/.
const TEMPLATE_FILES = [
  { name: "project.md", dest: "project.md" },
  { name: "AGENTS.md", dest: "AGENTS.md" },
  { name: path.join(".adlc", "waivers.md"), dest: path.join(".adlc", "waivers.md") },
];

function copyTemplate(name, dest) {
  fs.writeFileSync(dest, fs.readFileSync(path.join(TEMPLATES, name), "utf8"));
}

function run(argv, cwd, emit = console.log) {
  const dir = deliveryDir(cwd);
  if (fs.existsSync(dir)) {
    emit(`delivery/ already exists at ${dir} — refusing to overwrite. Remove it or run elsewhere.`);
    return 1;
  }

  const missing = findUnreadableTemplate(TEMPLATES, TEMPLATE_FILES.map((t) => t.name));
  if (missing) {
    emit(`cannot init: template '${missing}' is missing or unreadable (expected at ${path.join(TEMPLATES, missing)}). Nothing was created.`);
    return 1;
  }

  for (const d of DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });
  for (const d of GITKEEP_DIRS) fs.writeFileSync(path.join(dir, d, ".gitkeep"), "");
  for (const { name, dest } of TEMPLATE_FILES) copyTemplate(name, path.join(dir, dest));
  writeState(cwd, newState());

  emit(`Initialised delivery/ (harness: ${detectHarness(process.env)})`);
  emit("Next: navi-delivery propose <name> --lane standard");
  return 0;
}

module.exports = { run };
