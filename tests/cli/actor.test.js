"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const os = require("node:os");
const { resolveActor, actorWarning, ENV_VAR } = require("../../cli/lib/actor");

// Each case restores what it changed: node:test runs files in separate
// processes, but tests within a file share one environment.
function withEnv(overrides, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(overrides)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// PATH is pointed at nothing so `git config` cannot run; this is what makes
// the env/git/login ordering testable without touching the user's git config.
const NO_GIT = { PATH: "/nonexistent" };

test("--actor wins over every other source", () => {
  withEnv({ ...NO_GIT, [ENV_VAR]: "from-env" }, () => {
    assert.deepStrictEqual(resolveActor(["--actor", "Dana"], "/"), { actor: "Dana", source: "flag" });
  });
});

test("the environment variable is used when no flag is given", () => {
  withEnv({ ...NO_GIT, [ENV_VAR]: "ci-bot@navikenz.com" }, () => {
    assert.deepStrictEqual(resolveActor([], "/"), { actor: "ci-bot@navikenz.com", source: "env" });
  });
});

test("a git identity is preferred over the login name", () => {
  // Runs in this repository, which has a configured user.email.
  withEnv({ [ENV_VAR]: undefined }, () => {
    const r = resolveActor([], __dirname);
    assert.strictEqual(r.source, "git");
    assert.ok(r.actor.length > 0);
  });
});

test("the login name is the last resort, and is flagged as weak", () => {
  withEnv({ ...NO_GIT, [ENV_VAR]: undefined }, () => {
    const r = resolveActor([], "/");
    assert.strictEqual(r.source, "login");
    assert.match(actorWarning(r.source), /inferred from your login/);
  });
});

test("only the login source warns — a deliberate name is not nagged about", () => {
  assert.strictEqual(actorWarning("flag"), null);
  assert.strictEqual(actorWarning("env"), null);
  assert.strictEqual(actorWarning("git"), null);
});

test("with no name available at all, the decision is refused rather than logged as unknown", () => {
  const realUserInfo = os.userInfo;
  os.userInfo = () => { throw new Error("no passwd entry"); };
  try {
    withEnv({ ...NO_GIT, [ENV_VAR]: undefined, USER: undefined, LOGNAME: undefined, USERNAME: undefined },
      () => {
        const r = resolveActor([], "/");
        assert.ok(r.error, "expected a refusal");
        assert.match(r.error, /cannot determine who is recording/);
        assert.strictEqual(r.actor, undefined);
      });
  } finally {
    os.userInfo = realUserInfo;
  }
});

test("--actor given without a value is refused, not silently derived", () => {
  const r = resolveActor(["--actor", "--pass"], "/");
  assert.match(r.error, /--actor requires a name/);
});

test("an actor containing a newline is refused", () => {
  const r = resolveActor(["--actor", "Dana\nOkonkwo"], "/");
  assert.match(r.error, /newline/);
});

test("surrounding whitespace is trimmed", () => {
  assert.strictEqual(resolveActor(["--actor", "  Dana  "], "/").actor, "Dana");
});

test("a blank environment variable falls through to the next source", () => {
  withEnv({ [ENV_VAR]: "   " }, () => {
    assert.notStrictEqual(resolveActor([], __dirname).source, "env");
  });
});
