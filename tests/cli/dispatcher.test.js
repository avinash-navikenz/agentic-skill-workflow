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

test("--version is read only as the first word", () => {
  // Matched anywhere in argv, it turned a real command into a version print:
  // `gate G2 --pass --evidence x --version` exited 0 with the gate unrecorded.
  const out = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { out.push(String(s)); return true; };
  try {
    assert.strictEqual(main(["--version"]), 0);
    assert.match(out.join(""), /\d+\.\d+\.\d+/);
    out.length = 0;
    // Not a version print: an unknown verb, refused.
    assert.strictEqual(main(["nonsuch", "--version"]), 1);
    assert.strictEqual(out.join(""), "");
  } finally {
    process.stdout.write = write;
  }
});
