#!/usr/bin/env node
"use strict";
const pkg = require("../package.json");

// Lazy requires: Tasks 7-12 add these command modules. Loading them eagerly
// here would break every test in this task before those files exist.
const COMMANDS = {
  init: () => require("./commands/init"),
  propose: () => require("./commands/propose"),
  status: () => require("./commands/status"),
  gate: () => require("./commands/gate"),
  validate: () => require("./commands/validate"),
  archive: () => require("./commands/archive"),
  doctor: () => require("./commands/doctor"),
  telemetry: () => require("./commands/telemetry"),
};

function main(argv) {
  // Only as the first word. Matching it anywhere meant
  // `gate G2 --pass --evidence x --version` printed the version and exited 0
  // with the gate unrecorded — a command that looked like it had succeeded.
  if (argv[0] === "--version") {
    process.stdout.write(pkg.version + "\n");
    return 0;
  }
  const [name, ...rest] = argv;
  if (!name || !COMMANDS[name]) {
    process.stderr.write(`usage: navi-delivery <${Object.keys(COMMANDS).join("|")}>\n`);
    return 1;
  }
  try {
    return COMMANDS[name]().run(rest, process.cwd());
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return 1;
  }
}

// `telemetry export` is the one command that waits on a network round trip, so
// main may return a promise. process.exit(promise) coerces to NaN and exits 0 —
// a failed export would report success — so a thenable result is awaited here.
if (require.main === module) {
  const result = main(process.argv.slice(2));
  if (result && typeof result.then === "function") {
    result.then(
      (code) => process.exit(code),
      (err) => { process.stderr.write(`error: ${err.message}\n`); process.exit(1); },
    );
  } else {
    process.exit(result);
  }
}
module.exports = { main };
