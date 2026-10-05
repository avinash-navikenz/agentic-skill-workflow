"use strict";
const path = require("node:path");
const deliveryDir = (root) => path.join(root, "delivery");
const adlcDir = (root) => path.join(deliveryDir(root), ".adlc");
module.exports = {
  deliveryDir, adlcDir,
  statePath: (root) => path.join(adlcDir(root), "state.json"),
  eventsPath: (root) => path.join(adlcDir(root), "events.jsonl"),
  // Model calls, kept apart from the gate ledger: a different kind of record,
  // written by a different actor, and one a reader may want to delete without
  // touching the audit trail.
  usagePath: (root) => path.join(adlcDir(root), "usage.jsonl"),
  waiversPath: (root) => path.join(adlcDir(root), "waivers.md"),
  changeDir: (root, name) => path.join(deliveryDir(root), "changes", name),
};
