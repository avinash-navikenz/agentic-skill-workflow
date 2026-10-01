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

// The root of the shipped templates/ tree (containing "delivery/" and
// "change/" subdirectories), overridable via NAVI_DELIVERY_TEMPLATES.
//
// This seam exists for testability: init.js and propose.js each read a
// template file before writing anything, and tests that want to exercise
// "template missing" / "template is a directory" must mutate a templates
// tree somehow. Doing that to the repository's own shipped templates/ is
// unsafe under node:test's default per-file parallelism — one test file
// can have a shipped template renamed aside at the exact moment another
// test file's fixture setup (e.g. propose's tests calling init.run()) reads
// it, and a crash between rename-away and rename-back permanently corrupts
// the repo's templates/. Resolving this lazily (called from inside run(),
// not cached at module load) lets a test set the override for the
// duration of one call after copying templates/ to a throwaway temp
// directory, and mutate only that copy — the real templates/ is never
// touched. Each node:test file is its own process, so one file's override
// cannot race another file's.
function templatesRoot() {
  return process.env.NAVI_DELIVERY_TEMPLATES || path.join(__dirname, "..", "..", "templates");
}

module.exports = { findUnreadableTemplate, templatesRoot };
