"use strict";
const path = require("node:path");
const deliveryDir = (root) => path.join(root, "delivery");
const adlcDir = (root) => path.join(deliveryDir(root), ".adlc");
module.exports = {
  deliveryDir, adlcDir,
  statePath: (root) => path.join(adlcDir(root), "state.json"),
  eventsPath: (root) => path.join(adlcDir(root), "events.jsonl"),
  waiversPath: (root) => path.join(adlcDir(root), "waivers.md"),
  changeDir: (root, name) => path.join(deliveryDir(root), "changes", name),
};
