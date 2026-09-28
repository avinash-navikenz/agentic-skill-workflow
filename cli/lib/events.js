"use strict";
const fs = require("node:fs");
const { eventsPath, adlcDir } = require("./paths");

function appendEvent(root, evt) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  const record = { ts: new Date().toISOString(), ...evt };
  fs.appendFileSync(eventsPath(root), JSON.stringify(record) + "\n");
}

function readEvents(root) {
  const p = eventsPath(root);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

module.exports = { appendEvent, readEvents };
