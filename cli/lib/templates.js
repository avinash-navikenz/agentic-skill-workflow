"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Shared preflight: verify every named template under `templatesDir` is a
// readable regular file BEFORE a caller creates any directory or writes
// anything. If a template is missing, unreadable, or a directory partway
// through a real run, the caller would otherwise be left with a half-built
// tree it can neither retry (the destination already exists) nor clean up
// automatically.
//
// A directory at a template's path must be treated the same as a missing
// template: fs.accessSync(R_OK) alone succeeds for directories too, which
// would let this check pass and defer the failure to the caller's
// readFileSync (EISDIR) — after directories have already been created.
//
// Returns the name of the first missing-or-unreadable template, or null if
// all are fine. Never throws.
function findUnreadableTemplate(templatesDir, filenames) {
  for (const name of filenames) {
    const src = path.join(templatesDir, name);
    let stat;
    try {
      fs.accessSync(src, fs.constants.R_OK);
      stat = fs.statSync(src);
    } catch {
      return name;
    }
    if (!stat.isFile()) return name;
  }
  return null;
}

module.exports = { findUnreadableTemplate };
