#!/usr/bin/env node
"use strict";
//
// navi-cron — turn tracker items into proposed changes, on a schedule.
//
// One run: ask the tracker for candidate work items, and for each one it has
// not seen before, create a branch off the base, propose a change on it, seed
// the proposal from the item, commit, push, and open a pull request.
//
// Three properties this file exists to hold:
//
// 1. It never touches the checkout it runs in. Every change happens in a git
//    worktree it creates and removes. A cron job that left the user's working
//    tree on another branch at 3am would be worse than no cron job.
// 2. It never interpolates tracker text into a shell string. A Jira summary is
//    attacker-controllable in most organisations; `$(...)` in a title must be a
//    title, not a command. Configured commands receive values as environment
//    variables and quote them themselves.
// 3. It does nothing irreversible unless told to. Without --push it stops at
//    the local commit and prints what it would have done.
//
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const USAGE = `usage: navi-cron --config <file> [--push] [--max <n>] [--quiet]

  --config <file>  required; see navi-cron.config.example.json
  --push           push the branch and run the configured pull-request command.
                   Without it, the run stops at the local commit and reports.
  --max <n>        override maxPerRun from the config
  --quiet          only print errors and the one-line summary
`;

const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/;

// ---------------------------------------------------------------- config

function loadConfig(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`cannot read config ${file}: ${e.message}`);
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    throw new Error(`config ${file} is not valid JSON: ${e.message}`);
  }
  const need = (p, v) => {
    if (v === undefined || v === null || v === "") throw new Error(`config ${file}: missing ${p}`);
  };
  need("source.fetch", cfg.source && cfg.source.fetch);
  need("repo.base", cfg.repo && cfg.repo.base);
  need("repo.remote", cfg.repo && cfg.repo.remote);
  need("lane", cfg.lane);
  if (!["express", "standard", "full", "hotfix"].includes(cfg.lane)) {
    throw new Error(`config ${file}: lane ${JSON.stringify(cfg.lane)} is not one of express, standard, full, hotfix`);
  }
  cfg.repo.branchPrefix = cfg.repo.branchPrefix || "navi/";
  cfg.maxPerRun = Number.isInteger(cfg.maxPerRun) ? cfg.maxPerRun : 3;
  cfg.stateFile = cfg.stateFile || ".navi-cron-state.json";
  return cfg;
}

// ------------------------------------------------------------ item shape

// A tracker id is not a path segment. `PROJ-12`, `AB#4411` and `feat/x` all
// arrive from real trackers; all three become directory names here, so they
// are reduced to the same slug grammar `navi-delivery propose` enforces.
//
// Reducing loses information, and two items can reduce to one slug: `AB#4411`
// and `AB-4411` both give `ab-4411`, and two 80-character titles truncate to
// the same 60. A collision is not cosmetic — the second item's branch creation
// fails, and it then fails identically on every run forever. So when (and only
// when) the reduction actually lost something, a short digest of the exact id
// is appended. An id that survives reduction intact keeps a clean slug.
function slugFor(item) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const id = clean(item.id);
  const title = clean(item.title || "");
  const full = [id, title].filter(Boolean).join("-");
  const base = full.slice(0, 60).replace(/-+$/g, "");

  const lossy = id !== item.id.toLowerCase() || base !== full;
  const slug = lossy
    ? `${base.slice(0, 53).replace(/-+$/g, "")}-${crypto.createHash("sha256").update(item.id).digest("hex").slice(0, 6)}`
    : base;

  if (!SLUG_RE.test(slug)) throw new Error(`item ${JSON.stringify(item.id)} yields no usable slug`);
  return slug;
}

function validateItems(parsed) {
  if (!Array.isArray(parsed)) throw new Error("source.fetch must print a JSON array of items");
  return parsed.map((it, i) => {
    if (!it || typeof it !== "object") throw new Error(`item ${i} is not an object`);
    if (typeof it.id !== "string" || !it.id.trim()) throw new Error(`item ${i} has no string 'id'`);
    return { id: it.id.trim(), title: String(it.title || it.id), url: String(it.url || ""),
             body: String(it.body || ""), lane: it.lane ? String(it.lane) : null };
  });
}

// ------------------------------------------------------------- processes

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${r.status}): ${(r.stderr || "").trim()}`);
  }
  return (r.stdout || "").trim();
}

// Configured commands run through a shell, because a config author needs
// pipes and flags. Tracker text therefore NEVER reaches the command string —
// it is handed over in the environment, and the config quotes "$NAVI_ITEM_TITLE"
// itself. A title of `"; rm -rf ~; #` is then a title.
function shell(command, { cwd, env = {}, capture = true }) {
  const r = spawnSync("sh", ["-c", command], {
    cwd, encoding: "utf8", env: { ...process.env, ...env },
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (r.error) throw new Error(`command failed to start: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// The marker that makes a branch identifiable as this tool's work. It goes in
// the commit message, so it travels with the commit to the remote and back.
const TRAILER = "Navi-Cron-Item";

// The remote's sha for a branch, or null when it has none. `ls-remote` asks the
// remote directly, so no tracking ref — which this runner never refreshes for
// `navi/*` — can make a stale answer look current.
function remoteBranchSha(cfg, branch, repoRoot) {
  const out = git(["ls-remote", "--heads", cfg.repo.remote, `refs/heads/${branch}`], repoRoot);
  return out ? out.split(/\s+/)[0] : null;
}

// Is every commit on that remote branch one of ours, for this item?
//
// Comparing trees instead looked equivalent and was not: the worktree is cut
// from the current base, so the moment anybody merges to the base our rebuilt
// tree differs from the one we pushed — and the runner then declared its OWN
// branch to be somebody else's and refused the item permanently. Bases move
// constantly; that made the retry path a one-shot. An editable title did it too.
//
// The trailer does not move when the base does. A commit without it is somebody
// else's work, which is the only question being asked here.
function remoteBranchIsOurs(cfg, branch, item, repoRoot) {
  try {
    git(["fetch", "--quiet", cfg.repo.remote, `refs/heads/${branch}`], repoRoot);
    const range = `FETCH_HEAD --not ${cfg.repo.remote}/${cfg.repo.base}`;
    const commits = git(["rev-list", ...range.split(" ")], repoRoot).split("\n").filter(Boolean);
    if (!commits.length) return false;      // nothing of ours distinguishes it
    return commits.every((sha) => {
      const message = git(["show", "-s", "--format=%B", sha], repoRoot);
      return message.includes(`${TRAILER}: ${item.id}`);
    });
  } catch {
    // Cannot prove it is ours — a fetch that failed, a ref that moved. Refusing
    // for this run is the safe answer; the next run asks again.
    return false;
  }
}

function itemEnv(item, extra = {}) {
  return {
    NAVI_ITEM_ID: item.id, NAVI_ITEM_TITLE: item.title, NAVI_ITEM_URL: item.url,
    NAVI_ITEM_BODY: item.body, ...extra,
  };
}

// ----------------------------------------------------------------- state

// The state file must stay beside the checkout. An absolute or `../` path in a
// config would otherwise have the runner writing wherever it pointed.
function stateFileFor(repoRoot, cfg) {
  const resolved = path.resolve(repoRoot, cfg.stateFile);
  const root = fs.realpathSync(repoRoot);
  // realpath, because path.resolve is pure string arithmetic: a symlink inside
  // the checkout pointing out of it passed the check and then read and wrote
  // outside the repository. The file itself may not exist yet, so its directory
  // is what gets resolved.
  let real;
  try {
    real = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
    // The whole chain, not one hop. readlinkSync resolves a single link, so a
    // first link landing inside the repository passed the check while the write
    // followed the chain the rest of the way out. lstat rather than existsSync,
    // because a link whose target does not exist yet reports false from
    // existsSync and so was never followed at all.
    for (let hop = 0; hop < 20; hop += 1) {
      const stat = fs.lstatSync(real, { throwIfNoEntry: false });
      if (!stat || !stat.isSymbolicLink()) break;
      real = path.resolve(path.dirname(real), fs.readlinkSync(real));
    }
  } catch {
    real = resolved;           // an absent parent cannot be a symlink out
  }
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error(`stateFile ${JSON.stringify(cfg.stateFile)} resolves outside the repository ` +
                    `(${real}) — it must sit beside the checkout`);
  }
  return resolved;
}

function readProcessed(repoRoot, cfg) {
  const p = stateFileFor(repoRoot, cfg);
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (e) {
    // ONLY a missing file is "nothing processed yet". A file that exists and
    // cannot be read — EACCES after a run under sudo, EISDIR, a bad mount — is
    // the record being unavailable, and treating that as empty re-opens a
    // duplicate branch and pull request for every item it holds.
    if (e.code === "ENOENT") return new Set();
    throw new Error(`${p} exists but cannot be read (${e.code}). Refusing to run: treating it as ` +
                    "empty would re-propose every item it records.");
  }
  // A truncated or hand-edited file used to be indistinguishable from "nothing
  // processed yet", and the next run re-opened duplicate branches and pull
  // requests for every item it had already handled. Losing the record is worth
  // stopping for; it is one line to fix and unbounded duplicate work not to.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${p} is not valid JSON (${e.message}). Refusing to run: treating it as ` +
                    "empty would re-propose every item it records. Fix or delete the file.");
  }
  if (!parsed || !Array.isArray(parsed.processed)) {
    throw new Error(`${p} has no 'processed' array. Refusing to run — see above.`);
  }
  return new Set(parsed.processed);
}

function writeProcessed(repoRoot, cfg, seen) {
  const p = stateFileFor(repoRoot, cfg);
  fs.writeFileSync(p, JSON.stringify({ processed: [...seen].sort() }, null, 2) + "\n");
}

// ------------------------------------------------------------------- run

function proposalBody(item, cfg) {
  return [
    `# ${item.title}`, "",
    `Opened by navi-cron from ${cfg.source.name || "the tracker"}.`, "",
    `- Work item: ${item.id}${item.url ? ` — ${item.url}` : ""}`,
    `- Lane: ${item.lane || cfg.lane}`, "",
    "## Why", "",
    item.body.trim() || "_The tracker item carried no description. Write the why before G1._", "",
    "## What a reviewer should check", "",
    "_Nothing here was written by a person yet. This branch is a starting point,",
    "not a proposal: fill in the sections below before asking for a gate._", "",
  ].join("\n");
}

function processItem(item, cfg, ctx) {
  const { repoRoot, cliPath, push, log } = ctx;
  const slug = slugFor(item);
  const branch = `${cfg.repo.branchPrefix}${slug}`;
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "navi-cron-"));

  try {
    // Detached, and it STAYS detached: no local branch is ever created. The
    // commit is pushed straight to the remote ref by sha.
    //
    // This removes two failures at once rather than managing them. A named local
    // branch had to be force-created (so a branch a person made with the same
    // name was silently reset) and force-deleted afterwards (so their unpushed
    // commits became dangling objects) — and a leftover one from a killed run
    // wedged every later run. With no local branch there is nothing to reset,
    // nothing to delete, and nothing to leave behind.
    git(["worktree", "add", "--detach", worktree, `${cfg.repo.remote}/${cfg.repo.base}`], repoRoot);

    const lane = item.lane || cfg.lane;
    const r = spawnSync(process.execPath, [cliPath, "propose", slug, "--lane", lane],
                        { cwd: worktree, encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`propose failed (${r.status}): ${(r.stdout || "") + (r.stderr || "")}`.trim());
    }

    const proposal = path.join(worktree, "delivery", "changes", slug, "proposal.md");
    fs.writeFileSync(proposal, proposalBody(item, cfg));

    git(["add", "-A"], worktree);
    git(["commit", "-q", "-m",
         `chore(delivery): propose ${slug} from ${item.id}\n\n` +
         "Opened by navi-cron. Nothing in this branch has been reviewed by a person.\n\n" +
         `${TRAILER}: ${item.id}`],
        worktree);

    if (!push) {
      log(`  would push ${branch} and open a pull request (--push not given)`);
      return { slug, branch, pushed: false };
    }

    // Pushed by sha to an explicit refspec, from the repository root — which is
    // why no local branch is needed, and why a remote configured as a relative
    // path (`../origin.git`) resolves: it would otherwise be read from the
    // worktree, which lives under the system temp directory.
    //
    // NO force, and no lease. --force-with-lease reads the lease from the
    // remote-tracking ref, and this runner only ever fetches the base — so the
    // ref for a `navi/` branch stays stale and the lease holds, right up until
    // somebody runs `git fetch` in the checkout. After that it is satisfied by
    // the refreshed ref and the push overwrites whatever a person had put on
    // that branch. A plain push is rejected instead, which is the correct
    // outcome: this tool opens branches, it does not resolve conflicts on them.
    const sha = git(["rev-parse", "HEAD"], worktree);
    const remoteSha = remoteBranchSha(cfg, branch, repoRoot);

    if (remoteSha === null) {
      git(["push", cfg.repo.remote, `${sha}:refs/heads/${branch}`], repoRoot);
    } else if (remoteBranchIsOurs(cfg, branch, item, repoRoot)) {
      // Our own branch from an earlier run whose pull-request step failed: the
      // item was not recorded, so it is being retried. Nothing is pushed over
      // it — the scaffold already up there is as good as the one just built —
      // and the run goes straight to the step that failed.
      log(`  ${branch} is already on ${cfg.repo.remote} and is this item's — reopening`);
    } else {
      // Somebody else's commits are on that branch, or the check could not be
      // completed. Either way it is not this tool's to resolve.
      throw new Error(`${branch} on ${cfg.repo.remote} carries commits this run did not make. ` +
                      "Somebody's own work, or a branch it could not verify. Finish or delete " +
                      "it; this item is retried untouched until you do.");
    }
    if (cfg.pr && cfg.pr.command) {
      const res = shell(cfg.pr.command, {
        cwd: worktree,
        env: itemEnv(item, { NAVI_BRANCH: branch, NAVI_BASE: cfg.repo.base, NAVI_SLUG: slug }),
      });
      if (res.status !== 0) {
        // The branch is pushed and the work is not lost. Say so, and let the
        // next run leave this item alone — a half-open item re-proposed every
        // five minutes is how a board fills with duplicate branches.
        throw new Error(`pull-request command failed (${res.status}): ${res.stderr.trim() || res.stdout.trim()}`);
      }
    }
    log(`  pushed ${branch}`);
    return { slug, branch, pushed: true };
  } finally {
    try { git(["worktree", "remove", "--force", worktree], repoRoot); } catch { /* best effort */ }
    fs.rmSync(worktree, { recursive: true, force: true });
    // Nothing else to undo: the run created no branch, so there is none to
    // delete — and so no path on which this could delete somebody else's.
  }
}

function run(cfg, ctx) {
  const { repoRoot, log } = ctx;
  const seen = readProcessed(repoRoot, cfg);
  const fetched = shell(cfg.source.fetch, { cwd: repoRoot });
  if (fetched.status !== 0) {
    throw new Error(`source.fetch failed (${fetched.status}): ${fetched.stderr.trim()}`);
  }
  let items;
  try {
    items = validateItems(JSON.parse(fetched.stdout));
  } catch (e) {
    throw new Error(`source.fetch output unusable: ${e.message}`);
  }

  const todo = items.filter((it) => !seen.has(it.id)).slice(0, ctx.max ?? cfg.maxPerRun);
  log(`${items.length} item(s) from the tracker, ${items.length - todo.length} already seen or over the cap`);

  const done = [];
  const failed = [];
  for (const item of todo) {
    log(`${item.id}: ${item.title}`);
    try {
      const outcome = processItem(item, cfg, ctx);
      done.push(outcome);
      // Recorded only when the branch reached the remote. A failure must be
      // retried next run, and so must a run without --push: the documented way
      // to try this tool is a week of push-less runs, and recording those ids
      // would mean the first real run found every item already seen and opened
      // nothing, forever.
      if (outcome.pushed) {
        seen.add(item.id);
        writeProcessed(repoRoot, cfg, seen);
      }
    } catch (e) {
      failed.push({ id: item.id, message: e.message });
      log(`  FAILED: ${e.message}`);
    }
  }
  return { considered: items.length, proposed: done, failed };
}

// ------------------------------------------------------------------ main

function main(argv) {
  const flag = (n) => argv.includes(n);
  const value = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
  };
  const configPath = value("--config");
  if (!configPath || flag("--help")) {
    process.stdout.write(USAGE);
    return configPath ? 0 : 2;
  }
  // Argv is checked before anything is read from disk: a mistyped flag should be
  // reported as a mistyped flag, not behind whatever the config complains about
  // first.
  //
  // `value()` returns null both when a flag is absent and when it is present
  // with nothing usable after it, so the two are told apart here — `--max` with
  // no number is a typo, not a request for the configured default.
  if (argv.includes("--max")) {
    const given = value("--max");
    if (given === null) {
      process.stderr.write("navi-cron: --max needs a whole number after it\n");
      return 2;
    }
    if (!/^[0-9]+$/.test(given)) {
      // Number("abc") is NaN, slice(0, NaN) is empty, and the run reported a
      // clean zero-item pass. A typo must not look like "nothing to do".
      process.stderr.write(`navi-cron: --max must be a whole number, got ${JSON.stringify(given)}\n`);
      return 2;
    }
  }

  const quiet = flag("--quiet");
  const log = (m) => { if (!quiet) process.stdout.write(m + "\n"); };

  let cfg, repoRoot;
  try {
    cfg = loadConfig(configPath);
    repoRoot = git(["rev-parse", "--show-toplevel"], process.cwd());
    git(["fetch", cfg.repo.remote, cfg.repo.base], repoRoot);
  } catch (e) {
    process.stderr.write(`navi-cron: ${e.message}\n`);
    return 2;
  }

  // Read here, validated at the top of main. Moving the validation above
  // loadConfig took this binding with it and left the reference below, so every
  // real run died with `maxFlag is not defined` — inside main's try, so it was
  // reported as though the config were at fault.
  const maxFlag = value("--max");
  let result;
  try {
    result = run(cfg, {
      repoRoot, log, push: flag("--push"),
      max: maxFlag !== null ? Number(maxFlag) : undefined,
      cliPath: path.resolve(__dirname, "..", "..", "cli", "index.js"),
    });
  } catch (e) {
    process.stderr.write(`navi-cron: ${e.message}\n`);
    return 1;
  }

  process.stdout.write(
    `navi-cron: ${result.proposed.length} proposed, ${result.failed.length} failed, ` +
    `${result.considered} considered\n`);
  return result.failed.length ? 1 : 0;
}

module.exports = { loadConfig, slugFor, validateItems, readProcessed, writeProcessed,
                   proposalBody, processItem, run, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
