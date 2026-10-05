"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { deliveryDir } = require("../lib/paths");
const { newState, writeState } = require("../lib/state");
const { detectHarness } = require("../lib/capabilities");
const { advise } = require("../lib/gates");
const { findUnreadableTemplate, templatesRoot } = require("../lib/templates");

const DIRS = ["specs", "changes/archive", "decisions", "ops/runbooks", "ops/postmortems", "ops/models", ".adlc"];
const GITKEEP_DIRS = ["specs", "changes/archive", "decisions", "ops/runbooks", "ops/postmortems", "ops/models"];

// Template name (relative to the "delivery" templates dir) -> destination
// path relative to delivery/.
const TEMPLATE_FILES = [
  { name: "project.md", dest: "project.md" },
  { name: "AGENTS.md", dest: "AGENTS.md" },
  { name: path.join(".adlc", "waivers.md"), dest: path.join(".adlc", "waivers.md") },
  // G8-OPERATE's exit criteria name delivery/ops/slo.md by path. Before this
  // entry existed, `init` created ops/runbooks/ and ops/postmortems/ and no
  // slo.md, so a freshly initialised tree could not satisfy G8 without a file
  // nothing told the team to create. Registered in TEMPLATE_FILES rather than
  // written inline so it goes through findUnreadableTemplate() with the
  // others — an unregistered template reintroduces the half-built delivery/
  // trap the preflight exists to prevent.
  { name: path.join("ops", "slo.md"), dest: path.join("ops", "slo.md") },
];

function copyTemplate(templatesDir, name, dest) {
  fs.writeFileSync(dest, fs.readFileSync(path.join(templatesDir, name), "utf8"));
}


// Two different questions, and conflating them is how a prompt ends up in a
// public repository.
//
// (a) The CONTENT files. `.adlc/usage.jsonl` holds prompts and completions,
//     which routinely carry proprietary code, customer data, and whatever
//     somebody pasted into a model. `.adlc/telemetry.json` records what THIS
//     machine sent, so two developers produce two different ones and neither
//     is a shared fact. Neither is ever committed, and that is not a choice
//     offered — it is the default nobody would want reversed by accident.
//
// (b) The RECORD itself — specs, decisions, gate verdicts, waivers. The
//     framework's premise is that a gate leaves evidence in the repository, so
//     the default is to commit it. A team that wants it local can say so.
const LOCAL_ONLY = `# Written by navi-delivery init.
#
# Prompts and completions recorded by \`telemetry record\`. They carry whatever
# was sent to a model — source, customer data, anything pasted in — so they stay
# out of the repository.
.adlc/usage.jsonl

# What THIS machine last sent to a telemetry backend, and whether it arrived.
# Per-machine, so committing it only produces conflicts.
.adlc/telemetry.json
`;

const PRIVATE_LINES = `
# navi-delivery: this team keeps its delivery record local (init --private).
delivery/
`;

function askKeepLocal(emit) {
  // Only when a person is actually there. CI, scripts and the golden path run
  // this with no TTY and must never block on a question nobody can answer.
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const answer = (() => {
    try {
      process.stdout.write(
        "\nCommit the delivery record (specs, decisions, gate verdicts) to this repository?\n" +
        "  [Y] yes — the evidence lives with the code, which is what the gates assume\n" +
        "   n  no  — add delivery/ to .gitignore and keep it on this machine\n" +
        "> ");
      const buf = Buffer.alloc(8);
      const n = fs.readSync(0, buf, 0, 8, null);
      return buf.toString("utf8", 0, n).trim().toLowerCase();
    } catch {
      return "";          // no readable stdin after all
    }
  })();
  return answer === "n" || answer === "no";
}

function appendRootGitignore(cwd, emit) {
  const file = path.join(cwd, ".gitignore");
  let existing = "";
  try {
    existing = fs.readFileSync(file, "utf8");
  } catch { /* no .gitignore yet */ }
  if (/^delivery\/\s*$/m.test(existing)) {
    emit("delivery/ was already in .gitignore");
    return;
  }
  fs.writeFileSync(file, existing + (existing && !existing.endsWith("\n") ? "\n" : "") + PRIVATE_LINES);
  emit("Added delivery/ to .gitignore — the delivery record stays on this machine.");
}

function run(argv, cwd, emit = console.log) {
  const dir = deliveryDir(cwd);
  if (fs.existsSync(dir)) {
    emit(`delivery/ already exists at ${dir} — refusing to overwrite. Remove it or run elsewhere.`);
    return 1;
  }

  // Resolved per-call (not cached at module load) so NAVI_DELIVERY_TEMPLATES
  // can be set for the duration of a single test — see lib/templates.js.
  const templates = path.join(templatesRoot(), "delivery");

  const missing = findUnreadableTemplate(templates, TEMPLATE_FILES.map((t) => t.name));
  if (missing) {
    emit(`cannot init: template '${missing}' is missing or unreadable (expected at ${path.join(templates, missing)}). Nothing was created.`);
    return 1;
  }

  for (const d of DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });
  for (const d of GITKEEP_DIRS) fs.writeFileSync(path.join(dir, d, ".gitkeep"), "");
  for (const { name, dest } of TEMPLATE_FILES) copyTemplate(templates, name, path.join(dir, dest));
  writeState(cwd, newState());

  // Always, and not negotiable: content never reaches a commit by default.
  fs.writeFileSync(path.join(dir, ".gitignore"), LOCAL_ONLY);

  emit(`Initialised delivery/  ·  harness ${detectHarness(process.env)}  ·  prompts and the send record gitignored`);

  const keepLocal = argv.includes("--private")
    || (!argv.includes("--commit") && askKeepLocal(emit));
  if (keepLocal) {
    appendRootGitignore(cwd, emit);
  } else {
    emit("The record (specs, decisions, gate verdicts) will be committed — --private keeps it local.");
  }

  advise(["", "Next:  navi-delivery propose <name> --lane <express|standard|full|hotfix>"]);
  return 0;
}

module.exports = { run };
