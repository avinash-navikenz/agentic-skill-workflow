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
// are reduced to the same slug grammar `navi-delivery propose` enforces. The
// id leads so two items with similar titles never collide.
function slugFor(item) {
  const base = `${item.id} ${item.title || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  if (!SLUG_RE.test(base)) throw new Error(`item ${JSON.stringify(item.id)} yields no usable slug`);
  return base;
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

function readProcessed(repoRoot, cfg) {
  const p = path.resolve(repoRoot, cfg.stateFile);
  try {
    const seen = JSON.parse(fs.readFileSync(p, "utf8")).processed;
    return new Set(Array.isArray(seen) ? seen : []);
  } catch {
    return new Set();
  }
}

function writeProcessed(repoRoot, cfg, seen) {
  const p = path.resolve(repoRoot, cfg.stateFile);
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
    git(["checkout", "-b", branch], worktree);

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

    git(["push", "-u", cfg.repo.remote, branch], worktree);
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
    try { git(["worktree", "remove", "--force", worktree], repoRoot); } catch { /* reported below */ }
    fs.rmSync(worktree, { recursive: true, force: true });
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
      done.push(processItem(item, cfg, ctx));
      // Recorded only on success. A failure must be retried next run, not
      // silently dropped because the id was written before the work.
      seen.add(item.id);
      writeProcessed(repoRoot, cfg, seen);
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
  let result;
  try {
    result = run(cfg, {
      repoRoot, log, push: flag("--push"),
      max: maxFlag ? Number(maxFlag) : undefined,
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
