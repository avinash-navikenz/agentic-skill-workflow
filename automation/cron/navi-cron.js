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
  const root = path.resolve(repoRoot);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`stateFile ${JSON.stringify(cfg.stateFile)} resolves outside the repository ` +
                    `(${resolved}) — it must sit beside the checkout`);
  }
  return resolved;
}

function readProcessed(repoRoot, cfg) {
  const p = stateFileFor(repoRoot, cfg);
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    return new Set();          // no file yet is the ordinary first run
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
    git(["worktree", "add", "--detach", worktree, `${cfg.repo.remote}/${cfg.repo.base}`], repoRoot);
    // -B, not -b: a branch left behind by an earlier interrupted run is reset
    // rather than fatal. The content is regenerated scaffold, so there is
    // nothing in it worth preserving over a fresh attempt.
    git(["checkout", "-B", branch], worktree);

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
         `chore(delivery): propose ${slug} from ${item.id}\n\nOpened by navi-cron. Nothing in this branch has been reviewed by a person.`],
        worktree);

    if (!push) {
      log(`  would push ${branch} and open a pull request (--push not given)`);
      return { slug, branch, pushed: false };
    }

    // --force-with-lease, because a previous run may have pushed this branch and
    // then failed at the pull-request step: the item was not recorded, so it is
    // retried, and the retry's commit has a different timestamp and so a
    // different sha. The lease is what keeps that from overwriting a human who
    // has since pushed work onto the branch — it refuses instead.
    //
    // Pushed from the repository root, not the worktree: a remote configured as
    // a relative path (`../origin.git`) resolves against the directory git runs
    // in, and the worktree is somewhere under the system temp directory. The
    // branch ref lives in the common repository either way.
    git(["push", "--force-with-lease", "-u", cfg.repo.remote, branch], repoRoot);
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
    // The local branch always goes, whatever happened. On success it lives on
    // the remote and the local ref serves nothing; on failure it must not be
    // there, or the next run dies at branch creation and reports a git error
    // instead of the real one, for the life of that branch. Either way, "it
    // never touches the checkout it runs in" includes the checkout's branch
    // list — one ref per work item, accumulating forever, is touching it.
    try { git(["branch", "-D", branch], repoRoot); } catch { /* may never have been created */ }
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

  const maxFlag = value("--max");
  if (maxFlag !== null && !/^[0-9]+$/.test(maxFlag)) {
    // Number("abc") is NaN, slice(0, NaN) is empty, and the run reported a
    // clean zero-item pass. A typo must not look like "nothing to do".
    process.stderr.write(`navi-cron: --max must be a whole number, got ${JSON.stringify(maxFlag)}\n`);
    return 2;
  }
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
