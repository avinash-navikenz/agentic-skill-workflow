"use strict";
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { readState } = require("../lib/state");
const { deliveryDir } = require("../lib/paths");

const ROOT = path.join(__dirname, "..", "..");

function run(argv, cwd, emit = console.log) {
  let failed = 0;
  const strict = argv.includes("--strict");

  const s = readState(cwd);
  if (s.stale.length) {
    emit(`${s.stale.length} stale artifact(s) — resolve rework before validating`);
    failed = 1;
  }

  const checks = [
    ["validate_manifests.py", [ROOT]],
    ["lint_separation.py", [ROOT]],
    ["validate_traceability.py", strict ? [deliveryDir(cwd), "--strict"] : [deliveryDir(cwd)]],
  ];
  for (const [script, args] of checks) {
    const res = spawnSync("python3", [path.join(ROOT, "scripts", script), ...args], { encoding: "utf8" });

    // A validator that cannot run is not a validator that passed. spawnSync
    // leaves `status` null (not 0) both when the child process can't be
    // started at all (res.error, e.g. python3 missing from PATH) and when
    // it's killed by a signal — either way, distinguish "could not run" from
    // "ran and found problems" so the reason reaches the user instead of a
    // bare "validate: FAILED".
    if (res.error) {
      emit(`failed to run ${script}: ${res.error.message}`);
      failed = 1;
      continue;
    }
    if (res.stdout) emit(res.stdout.trimEnd());
    if (res.stderr) emit(res.stderr.trimEnd());
    if (res.status !== 0) failed = 1;
  }
  emit(failed ? "validate: FAILED" : "validate: OK");
  return failed;
}
module.exports = { run };
