"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { main } = require("../../cli/index");

function captureStderr(fn) {
  let captured = "";
  const orig = process.stderr.write;
  process.stderr.write = (chunk) => {
    captured += chunk;
    return true;
  };
  try {
    const result = fn();
    return { result, captured };
  } finally {
    process.stderr.write = orig;
  }
}

test("unknown command returns 1 and writes usage to stderr", () => {
  const { result, captured } = captureStderr(() => main(["nosuchcommand"]));
  assert.strictEqual(result, 1);
  assert.ok(captured.includes("usage:"), `expected usage in stderr, got: ${captured}`);
});

test("no command at all returns 1 and writes usage to stderr", () => {
  const { result, captured } = captureStderr(() => main([]));
  assert.strictEqual(result, 1);
  assert.ok(captured.includes("usage:"), `expected usage in stderr, got: ${captured}`);
});
