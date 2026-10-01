"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
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
  // Builds its own repository with a known identity rather than borrowing this
  // one's. The earlier version resolved against __dirname and so depended on
  // the machine having a configured user.email — true on a developer's laptop,
  // false on a CI runner, where actions/checkout configures none. It passed
  // locally and failed on both platforms the moment it ran in CI.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "nd-actor-"));
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "dana@example.com"], { cwd: repo });

  withEnv({ [ENV_VAR]: undefined }, () => {
    assert.deepStrictEqual(resolveActor([], repo), { actor: "dana@example.com", source: "git" });
  });
});

test("a repository with no configured identity falls back to the login name", () => {
  // The other half of the same behaviour, and the one a CI runner actually
  // meets. Without it, nothing covers the fall-through.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "nd-actor-"));
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
  // Nothing to unset: a fresh repository has no local user.email, and
  // `--unset-all` on an absent key exits non-zero. What has to be neutralised
  // is the GLOBAL config, which is where a developer's identity lives and why
  // this passed locally while the runner saw none.

  withEnv({ [ENV_VAR]: undefined, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" }, () => {
    assert.strictEqual(resolveActor([], repo).source, "login");
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
