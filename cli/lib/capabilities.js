"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Single source of truth for this table is registry/capabilities.json —
// scripts/build_adapters.py (Python) reads the same file, so the six rows
// never drift between the two languages. Do not hardcode the table here.
const REGISTRY_PATH = path.join(__dirname, "..", "..", "registry", "capabilities.json");

const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const CAPABILITIES = Object.freeze(raw.map((c) => Object.freeze({ ...c })));

function detectHarness(env) {
  if (env.CLAUDECODE || env.CLAUDE_PLUGIN_ROOT) return "claude-code";
  if (env.CODEX_HOME) return "codex";
  if (env.CURSOR_TRACE_ID) return "cursor";
  return "generic";
}

module.exports = { CAPABILITIES, detectHarness };
