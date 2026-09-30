"use strict";
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { flagValue } = require("./args");

// Who recorded a gate verdict. Gate events carried no actor at all, yet G3 and
// G6 are co-owned — the log could not say which owner recorded a verdict, and
// a fully-archived change could be evidenced by nobody.
//
// Design decision: the actor is DERIVED with an explicit override, never a
// required flag, and its provenance is recorded alongside it.
//
// A required --actor is the strongest form of accountability and was rejected
// on cost: it breaks every existing call site — the golden path, the gate test
// suite, and ~20 skills and docs that spell out `navi-delivery gate <G>
// --pass --evidence <file>` verbatim. Forcing a flag through all of those to
// buy a name that `git config user.email` already knows is a poor trade for a
// v1 release.
//
// Silently defaulting was rejected for the opposite reason: a log that says
// "unknown" is no better than the log that said nothing, and worse than one
// that refuses.
//
// What makes derivation sufficient is `actor_source`. An actor typed
// deliberately (`flag`, `env`) is stronger evidence than one inferred from the
// shell's login (`login`), and an auditor reading events.jsonl can now tell
// the two apart. That distinction — not the name alone — is the accountability
// the record lacked.
const ENV_VAR = "NAVI_DELIVERY_ACTOR";

// Ordered strongest-to-weakest. `git` sits above `login` because a git
// identity is configured on purpose and is the same name that will appear on
// the commit the evidence lives in; a login name is whatever the shell
// happened to be.
function fromGit(cwd) {
  try {
    const out = execFileSync("git", ["config", "--get", "user.email"], {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000,
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

function fromLogin() {
  for (const key of ["USER", "LOGNAME", "USERNAME"]) {
    const v = (process.env[key] || "").trim();
    if (v) return v;
  }
  // os.userInfo() still answers in containers that set no USER env var. It
  // throws when there is no passwd entry at all, which is the one case that
  // genuinely has no name to record.
  try {
    const name = (os.userInfo().username || "").trim();
    return name || null;
  } catch {
    return null;
  }
}

// An actor becomes one cell of a Markdown table row in waivers.md and one
// JSON field in events.jsonl. A newline would break the row in a way no
// escaping can repair, so it is refused rather than mangled — the same ruling
// already applied to a waiver reason.
function actorError(name) {
  if (name.includes("\n") || name.includes("\r")) {
    return "--actor must not contain a newline — it becomes a single waivers.md table cell";
  }
  return null;
}

// Returns { actor, source } or { error }.
function resolveActor(argv, cwd) {
  const flag = flagValue(argv, "--actor");
  if (flag.present && !flag.value) {
    return { error: "--actor requires a name — got none (or the next token looks like a flag)" };
  }
  const candidates = flag.value
    ? [[flag.value, "flag"]]
    : [[process.env[ENV_VAR] || "", "env"], [fromGit(cwd) || "", "git"], [fromLogin() || "", "login"]];
  for (const [raw, source] of candidates) {
    const name = String(raw).trim();
    if (!name) continue;
    const problem = actorError(name);
    if (problem) return { error: problem };
    return { actor: name, source };
  }
  return {
    error: `cannot determine who is recording this decision — pass --actor <name> or set ${ENV_VAR}`,
  };
}

// Only the weakest source is worth interrupting for. A git identity is a
// deliberate configuration and warning about it on every gate call would train
// people to ignore the warning, which is the failure mode navi-agent-devops-engineer
// names for alerts.
function actorWarning(source) {
  return source === "login"
    ? `note: actor inferred from your login — pass --actor <name> or set ${ENV_VAR} to record it deliberately`
    : null;
}

module.exports = { resolveActor, actorWarning, ENV_VAR };
