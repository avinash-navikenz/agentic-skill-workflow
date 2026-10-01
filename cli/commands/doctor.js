"use strict";
const { CAPABILITIES, detectHarness } = require("../lib/capabilities");

function run(argv, cwd, emit = console.log) {
  const harness = detectHarness(process.env);
  emit(`harness: ${harness}`);
  emit("");
  for (const c of CAPABILITIES) {
    const native = harness === "generic" ? null : c[harness.replace("-", "_")];
    emit(native ? `  native   ${c.name} -> ${native}` : `  fallback ${c.name} -> ${c.fallback}`);
  }
  return 0;
}

module.exports = { run };
