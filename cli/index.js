#!/usr/bin/env node
"use strict";
const pkg = require("../package.json");

function main(argv) {
  if (argv.includes("--version")) { process.stdout.write(pkg.version + "\n"); return 0; }
  process.stderr.write("usage: navi-delivery <command>\n");
  return 1;
}
process.exit(main(process.argv.slice(2)));
