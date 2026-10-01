#!/usr/bin/env node
/**
 * Builds docs/navi-delivery-overview.pptx.
 *
 * navi-delivery declares zero runtime dependencies as a stated guarantee, and an
 * `npm install` inside the repository would rewrite the root package.json. So
 * pptxgenjs is never installed here — it is supplied from outside:
 *
 *   npm install --prefix /tmp/deckdeps pptxgenjs
 *   NODE_PATH=/tmp/deckdeps/node_modules node docs/deck/build-deck.js
 *
 * The script itself IS committed. An uncommitted generator for a committed
 * artefact is how a deck drifts away from the thing it describes with nobody
 * able to tell: the counts on slide 16 said 39 skills for as long as that was
 * true somewhere, and nothing could have caught it.
 *
 * Brand tokens come from assets/brand/tokens.json. The wordmark is rasterised
 * ahead of time by make-logo.py (qlmanage + Pillow, both already on macOS) into
 * logo.json — no `sharp`, no native build, and no binary committed to the repo.
 * Every diagram and icon on every slide is drawn with pptxgenjs shapes and text.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

// The repository this script lives in, found from the script itself. It used to
// default to one person's absolute path, which is correct on exactly one
// machine and silently wrong on every other.
const REPO = process.env.NAVI_REPO || path.resolve(__dirname, "..", "..");
const OUT = process.argv[2] || path.join(REPO, "docs", "navi-delivery-overview.pptx");

// Read from the tree, never retyped. A deck that states a count is a deck that
// will state a stale one the moment a skill lands, unless the count is derived.
function countSkills() {
  const root = path.join(REPO, "skills");
  return fs.readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
    .reduce((n, d) => n + fs.readdirSync(path.join(root, d))
      .filter((s) => fs.existsSync(path.join(root, d, s, "SKILL.md"))).length, 0);
}
const SKILLS = countSkills();
const AGENTS = fs.readdirSync(path.join(REPO, "agents"))
  .filter((d) => fs.statSync(path.join(REPO, "agents", d)).isDirectory()).length;
const DISCIPLINE_COUNT = fs.readdirSync(path.join(REPO, "skills"))
  .filter((d) => fs.statSync(path.join(REPO, "skills", d)).isDirectory()).length;

/* ------------------------------------------------------------------ brand */

const T = JSON.parse(fs.readFileSync(path.join(REPO, "assets/brand/tokens.json"), "utf8"));
const NAVY = T.palette.navy.hex;   // 051D60
const INK = T.palette.ink.hex;     // 0D131F
const SLATE = T.palette.slate.hex; // 192954
const CREAM = T.palette.cream.hex; // FAF3E7
const SAND = T.palette.sand.hex;   // E4DED3

// Derived tints (not brand tokens — noted in the build report).
const PAPER = "FFFFFF";        // card surface on cream
const RULE = "CFC7B8";         // hairline on cream
const MUTED = "5F6476";        // secondary text on cream
const MUTED_D = "9BA2BA";      // secondary text on navy
const PANEL_D = "0E2470";      // raised card on navy
const PANEL_D2 = "132C79";     // second-level card on navy
const TINT = "F1E9DA";         // tinted card on cream
const NUMERAL = "B9AE98";      // ghost numeral on a light card — SAND was unreadable
const BRICK = "A6392B";        // refusal / limitation marker on light
const BRICK_D = "E08A72";      // refusal marker on dark

// Mulish is the brand face; it is not installed on the build machine, so it is
// used only for short display strings with generous slack. Everything where a
// fit error would show is Calibri (metric-safe, ships with Office).
const DISPLAY = "Mulish";
const BODY = "Calibri";

const W = 13.333;
const H = 7.5;
const M = 0.7;                 // side margin
const CW = W - 2 * M;          // content width = 11.933

/* ------------------------------------------------------------------ logo */

// Pre-rasterised by make-logo.py. LOGO.aspect is height/width of the drawn mark
// (0.1379 — the 174x24 viewBox exactly), so every placement derives its height
// from its width and the wordmark can never be squashed.
function loadLogos() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "logo.json"), "utf8"));
}

/* --------------------------------------------------------------- helpers */

// Every helper builds a fresh options object: pptxgenjs mutates them in place.
const text = (s, str, o) => s.addText(str, Object.assign({ isTextBox: true, margin: 0 }, o));

function card(s, o) {
  const opt = {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: o.fill },
    line: o.line ? { color: o.line, width: o.lineWidth || 1 } : { color: o.fill, width: 0 },
    rectRadius: o.radius === undefined ? 0.06 : o.radius,
  };
  if (o.shadow) {
    opt.shadow = { type: "outer", color: o.shadowColor || "000000", opacity: 0.1, blur: 6, offset: 2, angle: 90 };
  }
  s.addShape("roundRect", opt);
}

function arrow(s, o) {
  s.addShape("line", {
    x: o.x, y: o.y, w: o.w, h: o.h,
    line: {
      color: o.color,
      width: o.width || 1.75,
      endArrowType: o.end === false ? "none" : "triangle",
      beginArrowType: o.begin ? "triangle" : "none",
      dashType: o.dash || "solid",
    },
    flipH: !!o.flipH,
    flipV: !!o.flipV,
  });
}

/** Slide chrome. mode: "dark" | "ink" | "light" */
function frame(s, n, opts) {
  const dark = opts.mode !== "light";
  s.background = { color: opts.mode === "ink" ? INK : opts.mode === "dark" ? NAVY : CREAM };

  if (opts.eyebrow) {
    text(s, opts.eyebrow.toUpperCase(), {
      x: M, y: 0.44, w: CW, h: 0.24, fontSize: 10, bold: true, charSpacing: 2,
      color: dark ? MUTED_D : MUTED, fontFace: BODY,
    });
  }
  if (opts.title) {
    text(s, opts.title, {
      x: M, y: 0.74, w: opts.titleW || CW, h: 0.62,
      fontSize: opts.titleSize || 31, bold: true,
      color: dark ? CREAM : NAVY, fontFace: DISPLAY, valign: "top",
    });
  }
  if (opts.kicker) {
    text(s, opts.kicker, {
      x: M, y: 1.4, w: opts.kickerW || CW, h: 0.36,
      fontSize: 13.5, color: dark ? MUTED_D : MUTED, fontFace: BODY, valign: "top",
    });
  }
  // Footer: wordmark bottom-right, caption bottom-left. No rules, no stripes.
  s.addImage({ data: dark ? LOGO.cream : LOGO.navy, x: W - M - 1.0, y: H - 0.52, w: 1.0, h: 1.0 * LOGO.aspect });
  text(s, `navi-delivery  ·  v0.1.0  ·  ${n}`, {
    x: M, y: H - 0.54, w: 5, h: 0.22, fontSize: 8.5,
    color: dark ? "6E7591" : "8D8578", fontFace: BODY,
  });
}

/** Bulleted list with correct pptxgenjs bullet handling. */
function bullets(s, items, o) {
  const runs = items.map((t, i) => ({
    text: t,
    options: { bullet: true, breakLine: i < items.length - 1 },
  }));
  s.addText(runs, Object.assign(
    { isTextBox: true, margin: 0, fontFace: BODY, paraSpaceAfter: o.gap === undefined ? 5 : o.gap },
    o
  ));
}

// Slide 1 is the title and slide 19 the close; neither carries a frame, so the
// sequence starts at 2 and every frame call takes the next number. Inserting a
// slide renumbers the rest, which is the point.
const TOTAL_SLIDES = 19;
let SEQ = 1;
const seq = () => `${++SEQ} / ${TOTAL_SLIDES}`;

let LOGO;

/* ============================================================ the content */

const PHASES = [
  ["1", "Plan", "G1", "Product Owner"],
  ["2", "Specify", "G2", "Business Analyst"],
  ["3", "Architect", "G3", "Architect + Security"],
  ["4", "Data & Model", "G4", "Data + ML Engineer"],
  ["5", "Build", "G5", "Developer / Data / ML"],
  ["6", "Verify", "G6", "QA + Security"],
  ["7", "Release", "G7", "DevOps + MLOps"],
  ["8", "Operate", "G8", "MLOps + DevOps"],
  ["9", "Learn", "G9", "Product Owner + Architect"],
];

const LANES = [
  ["express", "copy · a config value · a flag flip", ["G2", "G6", "G7"], "A flag flip still gets a spec, a test and a release record. Nothing else."],
  ["standard", "most features and bug fixes", ["G1", "G2", "G3", "G5", "G6", "G7", "G8"], "The default. Seven gates, not nine."],
  ["full", "new capability · regulated · data or model", ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"], "Everything. Anything touching a dataset, schema, feature or model lands here."],
  ["hotfix", "production is degraded right now", ["G2", "G6", "G7", "G9"], "Ship now; G2 retroactive within 48h; the G9 postmortem is mandatory."],
];
const ALL_GATES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"];

// Counted from the tree and sorted descending, never retyped. This chart was
// wrong for four disciplines the moment a batch of skills landed, and a bar
// chart that is wrong reads as authoritative rather than as out of date.
const DISCIPLINES = fs.readdirSync(path.join(REPO, "skills"))
  .filter((d) => fs.statSync(path.join(REPO, "skills", d)).isDirectory())
  .map((d) => [d, fs.readdirSync(path.join(REPO, "skills", d))
    .filter((s) => fs.existsSync(path.join(REPO, "skills", d, s, "SKILL.md"))).length])
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/* ============================================================ slide build */

async function build() {
  LOGO = loadLogos();

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";          // must precede addSlide
  pres.author = "Navikenz";
  pres.company = "Navikenz";
  pres.title = "navi-delivery — delivery framework overview";

  /* ---------------------------------------------------------- 1. title */
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addImage({ data: LOGO.cream, x: M, y: 0.72, w: 2.3, h: 2.3 * LOGO.aspect });

    text(s, "navi-delivery", {
      x: M, y: 1.95, w: 10, h: 1.0, fontSize: 58, bold: true, color: CREAM, fontFace: DISPLAY,
    });
    text(s, "An agentic SDLC framework — Plan to Monitor, in any harness.", {
      x: M, y: 3.0, w: 10.4, h: 0.44, fontSize: 19, color: SAND, fontFace: BODY,
    });
    text(s, "Agents hold the judgment.   Skills hold the rules.", {
      x: M, y: 3.55, w: 10.4, h: 0.4, fontSize: 15, italic: true, color: MUTED_D, fontFace: BODY,
    });

    const stats = [
      [String(AGENTS), "persona agents", "one per discipline, plus an orchestrator"],
      [String(SKILLS), `skills · ${DISCIPLINE_COUNT} disciplines`, "standards, tables, templates, validators"],
      ["9 / 9 / 4", "phases · gates · lanes", "proportionality, so nobody routes around it"],
    ];
    const cw = (CW - 2 * 0.36) / 3;
    stats.forEach(([big, lab, sub], i) => {
      const x = M + i * (cw + 0.36);
      card(s, { x, y: 4.55, w: cw, h: 1.72, fill: SLATE });
      text(s, big, { x: x + 0.3, y: 4.74, w: cw - 0.6, h: 0.62, fontSize: 34, bold: true, color: CREAM, fontFace: DISPLAY });
      text(s, lab, { x: x + 0.3, y: 5.42, w: cw - 0.6, h: 0.28, fontSize: 12.5, bold: true, color: SAND, fontFace: BODY });
      text(s, sub, { x: x + 0.3, y: 5.72, w: cw - 0.6, h: 0.42, fontSize: 10, color: MUTED_D, fontFace: BODY });
    });

    text(s, "Version 0.1.0  ·  owner avinash.negi@navikenz.com  ·  internal adoption briefing", {
      x: M, y: H - 0.56, w: 9, h: 0.24, fontSize: 9, color: "6E7591", fontFace: BODY,
    });
    s.addNotes(`navi-delivery is built and shipped, not a design. Counts read from the repo at build time: ${AGENTS} agents, ${SKILLS} skills across ${DISCIPLINE_COUNT} disciplines, 9 phases and gates, 4 lanes, an 8-verb CLI.`);
  }

  /* ------------------------------------------------------- 2. why it exists */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "The problem",
      title: "AI helps with the code. It does not help with the lifecycle.",
      kicker: "Coding assistants land in the middle of delivery and leave both ends untouched. Three things then go wrong, every time.",
    });

    const probs = [
      ["Judgment is re-invented at every prompt",
        "Each session re-derives what a Business Analyst or an Architect already knows. The reasoning is produced, used once and thrown away. Nothing accumulates between changes, so the tenth change costs what the first one did."],
      ["Standards live in people's heads",
        "Or in a wiki detached from the moment the work happens. A convention that is not attached to the artifact being written is a convention that will be missed, and the review that catches it is the most expensive place to catch it."],
      ["The loop never closes",
        "An incident rarely changes the standard that allowed it. The postmortem is written, filed, and read by nobody, so the same defect returns under a different name six months later."],
    ];
    const ch = 1.30;
    probs.forEach(([h, b], i) => {
      const y = 1.98 + i * (ch + 0.22);
      card(s, { x: M, y, w: CW, h: ch, fill: PAPER, line: RULE });
      // Numeral block, no stripe.
      text(s, String(i + 1), { x: M + 0.32, y: y + 0.26, w: 0.7, h: 0.8, fontSize: 38, bold: true, color: NUMERAL, fontFace: DISPLAY });
      text(s, h, { x: M + 1.18, y: y + 0.24, w: CW - 1.6, h: 0.32, fontSize: 16, bold: true, color: NAVY, fontFace: DISPLAY });
      text(s, b, { x: M + 1.18, y: y + 0.62, w: CW - 1.6, h: 0.66, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.15 });
    });

    text(s, "The response is to separate the two things that keep getting fused — and then to make the separation mechanical, so it survives contact with a deadline.", {
      x: M, y: 6.55, w: CW, h: 0.3, fontSize: 12, italic: true, color: NAVY, fontFace: BODY,
    });
    s.addNotes("This framing comes from docs/CONCEPTS.md \u00a71.");
  }

  /* ------------------------------------------------------- 3. what it is */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "What it is",
      title: "One framework, dropped into any repo",
      kicker: "Install once. It scaffolds a delivery/ tree into the repo you actually work in, and records what happened at every gate.",
    });

    const pillars = [
      [String(AGENTS), "Agents", "The thinking",
        ["Mission and accountability", "A mental model of the discipline", "How to weigh trade-offs", "When to escalate to a human", "Which skill to reach for"]],
      [String(SKILLS), "Skills", "The rules",
        ["Standards and conventions", "Decision tables", "Copy-ready templates", "Self-check checklists", "A mechanical Validation block"]],
      ["9·9·4", "Lifecycle", "The spine",
        ["Nine ADLC phases", "Nine binding gates, evidence required", "Four lanes for proportionality", "REQ → … → INSIGHT traceability", "State that survives the session"]],
    ];
    const cw = (CW - 2 * 0.34) / 3;
    pillars.forEach(([big, name, sub, list], i) => {
      const x = M + i * (cw + 0.34);
      card(s, { x, y: 2.0, w: cw, h: 3.65, fill: i === 1 ? NAVY : PAPER, line: i === 1 ? NAVY : RULE });
      const fg = i === 1 ? CREAM : NAVY;
      const fg2 = i === 1 ? MUTED_D : MUTED;
      text(s, big, { x: x + 0.3, y: 2.22, w: cw - 0.6, h: 0.58, fontSize: 30, bold: true, color: i === 1 ? CREAM : NAVY, fontFace: DISPLAY });
      text(s, name, { x: x + 0.3, y: 2.86, w: cw - 0.6, h: 0.32, fontSize: 18, bold: true, color: fg, fontFace: DISPLAY });
      text(s, sub.toUpperCase(), { x: x + 0.3, y: 3.2, w: cw - 0.6, h: 0.22, fontSize: 9, bold: true, charSpacing: 1.6, color: fg2, fontFace: BODY });
      bullets(s, list, { x: x + 0.3, y: 3.56, w: cw - 0.6, h: 1.9, fontSize: 11, color: i === 1 ? SAND : MUTED, gap: 7 });
    });

    card(s, { x: M, y: 5.88, w: CW, h: 0.82, fill: TINT });
    text(s, "Runs in Claude Code today, and in a bare chat window with no plugin support at all — every agent capability declares a mandatory fallback.", {
      x: M + 0.34, y: 6.06, w: CW - 0.68, h: 0.46, fontSize: 12.5, color: NAVY, fontFace: BODY,
    });
  }

  /* ------------------------------ 4. DIAGRAM: agents invoke skills */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "dark", eyebrow: "Diagram · the separation",
      title: "Judgment invokes rules. It never improvises them.",
      kicker: "An agent may not produce a lifecycle artifact from memory. It loads the governing skill, follows it, and records which skills it used.",
    });

    const bw = 4.85, by = 2.15, bh = 3.0;
    const ax = M + bw;                 // start of the arrow channel
    const rx = W - M - bw;             // left edge of the right card

    // Agent card
    card(s, { x: M, y: by, w: bw, h: bh, fill: PANEL_D });
    text(s, "AGENT", { x: M + 0.32, y: by + 0.26, w: 3, h: 0.34, fontSize: 19, bold: true, color: CREAM, fontFace: DISPLAY });
    text(s, "what · why · when", { x: M + 0.32, y: by + 0.64, w: 4, h: 0.24, fontSize: 10.5, color: MUTED_D, fontFace: BODY });
    bullets(s, [
      "Mission and accountability",
      "A mental model of the discipline",
      "How to weigh a trade-off, and why",
      "What 'good' looks like here",
      "When to stop and escalate to a human",
      "A plan for which skills to invoke",
    ], { x: M + 0.32, y: by + 1.0, w: bw - 0.64, h: 1.45, fontSize: 11, color: SAND, gap: 4 });
    text(s, "Voice: first person, persona.   File: agents/navi-agent-<persona>/", {
      x: M + 0.32, y: by + bh - 0.40, w: bw - 0.64, h: 0.26, fontSize: 9.5, color: MUTED_D, fontFace: BODY,
    });

    // Skill card
    card(s, { x: rx, y: by, w: bw, h: bh, fill: PANEL_D2 });
    text(s, "SKILL", { x: rx + 0.32, y: by + 0.26, w: 3, h: 0.34, fontSize: 19, bold: true, color: CREAM, fontFace: DISPLAY });
    text(s, "how", { x: rx + 0.32, y: by + 0.64, w: 4, h: 0.24, fontSize: 10.5, color: MUTED_D, fontFace: BODY });
    bullets(s, [
      "Standards and conventions",
      "A decision table for the hard calls",
      "A copy-ready template",
      "A self-check checklist",
      "Named anti-patterns",
      "A mechanical Validation block",
    ], { x: rx + 0.32, y: by + 1.0, w: bw - 0.64, h: 1.45, fontSize: 11, color: SAND, gap: 4 });
    text(s, "Voice: impersonal, imperative.   File: skills/<discipline>/navi-skill-<name>/",
      { x: rx + 0.32, y: by + bh - 0.40, w: bw - 0.64, h: 0.26, fontSize: 9.5, color: MUTED_D, fontFace: BODY });

    // The channel between them
    arrow(s, { x: ax + 0.22, y: by + 1.12, w: rx - ax - 0.44, h: 0, color: CREAM, width: 2.25 });
    text(s, "loads", { x: ax, y: by + 0.7, w: rx - ax, h: 0.3, fontSize: 12.5, bold: true, color: CREAM, align: "center", fontFace: BODY });
    text(s, "never improvises", { x: ax, y: by + 1.28, w: rx - ax, h: 0.28, fontSize: 10, italic: true, color: MUTED_D, align: "center", fontFace: BODY });

    arrow(s, { x: ax + 0.22, y: by + 2.32, w: rx - ax - 0.44, h: 0, color: SAND, width: 1.6, flipH: true });
    text(s, "records which skills it used,", { x: ax, y: by + 1.74, w: rx - ax, h: 0.26, fontSize: 9.5, color: SAND, align: "center", fontFace: BODY });
    text(s, "in the handoff envelope", { x: ax, y: by + 1.98, w: rx - ax, h: 0.26, fontSize: 9.5, color: SAND, align: "center", fontFace: BODY });

    // Enforcement strip
    card(s, { x: M, y: 5.5, w: CW, h: 1.2, fill: SLATE });
    text(s, "Enforced, not aspirational — scripts/lint_separation.py fails the build on:", {
      x: M + 0.32, y: 5.66, w: 6.4, h: 0.3, fontSize: 12, bold: true, color: CREAM, fontFace: BODY,
    });
    const seps = [["SEP1", "a numbered procedure inside an agent"], ["SEP2", "a Template or Checklist inside an agent"],
    ["SEP3", "persona voice inside a skill"], ["SEP4", "first person inside a skill"]];
    const sw = (CW - 0.64) / 4;
    seps.forEach(([id, d], i) => {
      const x = M + 0.32 + i * sw;
      text(s, id, { x, y: 6.04, w: sw - 0.2, h: 0.24, fontSize: 11, bold: true, color: CREAM, fontFace: BODY });
      text(s, d, { x, y: 6.28, w: sw - 0.2, h: 0.36, fontSize: 9.5, color: MUTED_D, fontFace: BODY });
    });
    s.addNotes("The falsifiable test: delete every agent and the skills still fully specify how work is done; delete every skill and the agents still specify what, why and when.");
  }

  /* ------------------------------------------------------- 5. the agents */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: `${AGENTS} agents`,
      title: "One persona per discipline, plus a delivery lead",
      kicker: "Each carries a mission, a mental model, its escalation triggers, and the phases and gates it owns.",
    });

    card(s, { x: M, y: 2.0, w: CW, h: 0.92, fill: NAVY });
    text(s, "navi-agent-orchestrator", { x: M + 0.34, y: 2.18, w: 3.9, h: 0.3, fontSize: 15, bold: true, color: CREAM, fontFace: DISPLAY });
    text(s, "Delivery lead — lane selection, gate enforcement, rework ordering, arbitration between personas", {
      x: M + 0.34, y: 2.5, w: 8.3, h: 0.28, fontSize: 11, color: SAND, fontFace: BODY,
    });
    text(s, "Phases 1–9", { x: W - M - 1.9, y: 2.3, w: 1.56, h: 0.3, fontSize: 13, bold: true, color: CREAM, align: "right", fontFace: DISPLAY });

    const agents = [
      ["Product Owner", "1 · 9", "Is it worth making, and did it move the measure?"],
      ["Business Analyst", "2", "Ambiguity out; testable criteria in."],
      ["Architect", "3 · 9", "Boundaries, quality attributes, what debt we accept."],
      ["Security Engineer", "3 · 6", "Trust boundaries, threat model, what we can live with."],
      ["Fullstack Developer", "5", "Decomposition, contracts, seams, what to refactor."],
      ["Data Engineer", "4 · 5", "Lineage, schema evolution, idempotency, contracts."],
      ["ML Engineer", "4 · 5", "Is ML warranted? Baseline, leakage, where it fails."],
      ["MLOps Engineer", "7 · 8", "Promotion criteria, drift and decay, model rollback."],
      ["DevOps Engineer", "7 · 8", "Blast radius, environment parity, SLOs, secrets."],
      ["QA Engineer", "6", "Risk-based coverage, flakiness, the release call."],
    ];
    const cols = 5, gx = 0.24, gy = 0.26;
    const cw = (CW - (cols - 1) * gx) / cols, chh = 1.5;
    agents.forEach(([n, ph, d], i) => {
      const x = M + (i % cols) * (cw + gx);
      const y = 3.12 + Math.floor(i / cols) * (chh + gy);
      card(s, { x, y, w: cw, h: chh, fill: PAPER, line: RULE });
      text(s, n, { x: x + 0.22, y: y + 0.2, w: cw - 0.44, h: 0.5, fontSize: 12.5, bold: true, color: NAVY, fontFace: DISPLAY, valign: "top" });
      text(s, "PHASE " + ph, { x: x + 0.22, y: y + 0.68, w: cw - 0.44, h: 0.2, fontSize: 8.5, bold: true, charSpacing: 1, color: "9A9184", fontFace: BODY });
      text(s, d, { x: x + 0.22, y: y + 0.92, w: cw - 0.44, h: 0.48, fontSize: 9.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.1 });
    });

    text(s, "Every agent declares the skills it may invoke, and validate_manifests.py refuses a name that does not resolve.", {
      x: M, y: 6.62, w: CW, h: 0.3, fontSize: 11, italic: true, color: MUTED, fontFace: BODY,
    });
  }

  /* ------------------------------------------------------- 6. the skills */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: `${SKILLS} skills`,
      title: `${DISCIPLINE_COUNT} disciplines, and every skill the same shape`,
      kicker: "A skill is not prose. It is a standard, a decision table, a template you can copy, a checklist, named anti-patterns, and a check a machine can run.",
    });

    // Discipline bars — a count chart drawn as shapes, sorted descending. Both
    // the scale and the row split follow the data, so a new discipline lands in
    // the chart rather than off the bottom of it.
    const max = Math.max(...DISCIPLINES.map((d) => d[1]));
    const colsD = 2, rows = Math.ceil(DISCIPLINES.length / colsD);
    const colW = (CW - 0.5) / colsD;
    DISCIPLINES.forEach(([name, n], i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const x = M + col * (colW + 0.5);
      const y = 2.06 + row * (rows > 6 ? 0.44 : 0.5);
      text(s, name, { x, y: y + 0.02, w: 2.55, h: 0.3, fontSize: 11.5, color: NAVY, fontFace: BODY });
      const barX = x + 2.65, barMax = colW - 3.15;
      card(s, { x: barX, y: y + 0.07, w: barMax, h: 0.22, fill: SAND, radius: 0.04 });
      card(s, { x: barX, y: y + 0.07, w: barMax * (n / max), h: 0.22, fill: NAVY, radius: 0.04 });
      text(s, String(n), { x: barX + barMax + 0.12, y: y + 0.02, w: 0.35, h: 0.3, fontSize: 11.5, bold: true, color: NAVY, fontFace: DISPLAY });
    });

    card(s, { x: M, y: 5.3, w: (CW - 0.3) / 2, h: 1.4, fill: PAPER, line: RULE });
    text(s, "Every skill ends with a Validation block", { x: M + 0.3, y: 5.5, w: (CW - 0.3) / 2 - 0.6, h: 0.28, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
    text(s, "A command or a grep that a machine runs — not advice. scripts/validate_skill_checks.py runs each block against that skill's own template, then against a mutation that breaks a rule the block claims to catch.",
      { x: M + 0.3, y: 5.84, w: (CW - 0.3) / 2 - 0.6, h: 0.72, fontSize: 10.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.12 });

    const x2 = M + (CW - 0.3) / 2 + 0.3;
    card(s, { x: x2, y: 5.3, w: (CW - 0.3) / 2, h: 1.4, fill: TINT });
    text(s, "Reuses the tooling this team already has", { x: x2 + 0.3, y: 5.5, w: (CW - 0.3) / 2 - 0.6, h: 0.28, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
    text(s, "Each skill ships an evals.json in the house format, so /skill-creator, /eai-eng-skills-evaluator and skill-batch-creator all work against this repo unchanged.",
      { x: x2 + 0.3, y: 5.84, w: (CW - 0.3) / 2 - 0.6, h: 0.72, fontSize: 10.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.12 });
  }

  /* ------------------------------ 7. DIAGRAM: the nine-phase loop */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "dark", eyebrow: "Diagram · the lifecycle",
      title: "Nine phases, nine gates — and phase 9 feeds phase 1",
      kicker: "Not a waterfall and not a line. The last phase is the one that changes what the first phase will be asked to do.",
    });

    const nw = 2.0, nh = 0.94;
    const topY = 2.28, botY = 5.12;
    const topX = [0, 1, 2, 3, 4].map((i) => M + i * (nw + (CW - 5 * nw) / 4));
    const botGap = (CW - 4 * nw) / 3;
    const botX = [0, 1, 2, 3].map((i) => M + i * (nw + botGap));   // holds 9,8,7,6

    const node = (x, y, idx) => {
      const [num, name, gate] = PHASES[idx];
      card(s, { x, y, w: nw, h: nh, fill: PANEL_D });
      text(s, "PHASE " + num, { x: x + 0.2, y: y + 0.15, w: nw - 0.9, h: 0.2, fontSize: 8, bold: true, charSpacing: 1, color: MUTED_D, fontFace: BODY });
      text(s, name, { x: x + 0.2, y: y + 0.4, w: nw - 0.32, h: 0.4, fontSize: 13, bold: true, color: CREAM, fontFace: DISPLAY, valign: "top" });
      card(s, { x: x + nw - 0.72, y: y + 0.13, w: 0.54, h: 0.26, fill: CREAM, radius: 0.04 });
      text(s, gate, { x: x + nw - 0.72, y: y + 0.155, w: 0.54, h: 0.21, fontSize: 9.5, bold: true, color: NAVY, align: "center", fontFace: BODY });
    };

    [0, 1, 2, 3, 4].forEach((i) => node(topX[i], topY, i));
    [8, 7, 6, 5].forEach((idx, i) => node(botX[i], botY, idx));   // 9,8,7,6 left→right

    // top row arrows (→)
    for (let i = 0; i < 4; i++) {
      const from = topX[i] + nw, to = topX[i + 1];
      arrow(s, { x: from + 0.07, y: topY + nh / 2, w: to - from - 0.14, h: 0, color: SAND, width: 1.6 });
    }
    // right descender: phase 5 → phase 6
    const rcx = topX[4] + nw / 2;
    arrow(s, { x: rcx, y: topY + nh + 0.08, w: 0, h: botY - topY - nh - 0.16, color: SAND, width: 1.6 });
    // bottom row arrows (←): 6→7→8→9 means right-to-left
    for (let i = 3; i > 0; i--) {
      const from = botX[i], to = botX[i - 1] + nw;
      arrow(s, { x: to + 0.07, y: botY + nh / 2, w: from - to - 0.14, h: 0, color: SAND, width: 1.6, flipH: true });
    }
    // the closing leg: phase 9 → phase 1, up the left side, in cream
    const lcx = botX[0] + nw / 2;
    arrow(s, { x: lcx, y: topY + nh + 0.08, w: 0, h: botY - topY - nh - 0.16, color: CREAM, width: 2.5, flipV: true });

    // centre caption
    const ccx = M + 2.05, ccw = CW - 4.1;
    text(s, "The loop that closes", { x: ccx, y: 3.52, w: ccw, h: 0.3, fontSize: 15, bold: true, color: CREAM, align: "center", fontFace: DISPLAY });
    text(s, "archive folds the delta spec into specs/ and writes an insight stub. Every INSIGHT-### routes to exactly one destination:\na candidate REQ-### in the product backlog, or a pull request against the navi-skill-* file that got it wrong.",
      { x: ccx, y: 3.9, w: ccw, h: 0.72, fontSize: 11, color: SAND, align: "center", fontFace: BODY, lineSpacingMultiple: 1.2 });
    text(s, "An insight with no destination closes no loop, and is not an insight.",
      { x: ccx, y: 4.62, w: ccw, h: 0.28, fontSize: 10.5, italic: true, color: MUTED_D, align: "center", fontFace: BODY });

    // A label badge ON the closing edge: filled with the slide ground so it
    // interrupts the arrow rather than being crossed by it.
    card(s, { x: M + 0.15, y: 3.98, w: 1.70, h: 0.76, fill: NAVY, radius: 0.05 });
    text(s, "INSIGHT-###", {
      x: M + 0.15, y: 4.08, w: 1.70, h: 0.26, fontSize: 10, bold: true, color: CREAM, align: "center", fontFace: BODY,
    });
    text(s, "backlog  ·  skill amendment", {
      x: M + 0.10, y: 4.36, w: 1.80, h: 0.28, fontSize: 8, color: SAND, align: "center", fontFace: BODY,
    });
    text(s, "A phase that emits no telemetry did not happen. A gate whose verdict was never recorded was never passed.", {
      x: M, y: 6.6, w: CW, h: 0.3, fontSize: 11, italic: true, color: MUTED_D, fontFace: BODY,
    });
  }

  /* ------------------------------------------------------- 8. the gates */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "The nine gates",
      title: "Each gate closes a phase, and needs a path on disk",
      kicker: "A verdict is one of exactly three values — pass, fail, waived. There is no conditional pass and no pass with follow-ups.",
    });

    const G = [
      ["G1", "Plan", "Lane declared and justified; at least one measurable outcome; non-goals a reader would otherwise assume", "proposal.md"],
      ["G2", "Specify", "Every REQ-### carries an AC-###; Given/When/Then with an observable outcome; open questions as Q-###", "delta spec · traceability output"],
      ["G3", "Architect", "Alternatives rejected; an ADR-### per consequential decision; a threat model with every threat dispositioned", "design.md · ADRs · threat model"],
      ["G4", "Data & Model", "A contract per source dataset; lineage; a leakage-checked eval set tied to the proposal's outcome; PII classified", "contracts · lineage · baseline report"],
      ["G5", "Build", "Every task done or explicitly deferred; every AC referenced by an automated test; review complete", "build output · traceability · review record"],
      ["G6", "Verify", "Negative and empty-state paths, not only the happy path; flaky tests quarantined with an owner and a date", "test report · defect list · security record"],
      ["G7", "Release", "A rollback path that has been exercised, with a known time-to-restore; blast radius stated in people", "pipeline run · rollback rehearsal · approval"],
      ["G8", "Operate", "An SLI-### per shipped capability, with an error budget and an alert that fires before it burns; telemetry confirmed arriving", "ops/slo.md · runbooks · a live query"],
      ["G9", "Learn", "Predicted outcome against measured, with the gap named; every INSIGHT-### routed to exactly one destination", "ops/postmortems/<name>.md"],
    ];
    const rh = 0.452;
    const colG = 0.72, colP = 1.42, colE = 3.15;
    text(s, "GATE", { x: M + 0.1, y: 2.02, w: colG, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1, color: "9A9184", fontFace: BODY });
    text(s, "CLOSES", { x: M + 0.1 + colG, y: 2.02, w: colP, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1, color: "9A9184", fontFace: BODY });
    text(s, "EXIT CRITERIA, IN SHORT", { x: M + 0.1 + colG + colP, y: 2.02, w: 5, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1, color: "9A9184", fontFace: BODY });
    text(s, "EVIDENCE", { x: W - M - colE, y: 2.02, w: colE, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1, color: "9A9184", fontFace: BODY });

    G.forEach(([g, p, c, e], i) => {
      const y = 2.34 + i * rh;
      if (i % 2 === 0) card(s, { x: M, y: y - 0.05, w: CW, h: rh - 0.04, fill: PAPER, radius: 0.04 });
      text(s, g, { x: M + 0.1, y: y + 0.04, w: colG, h: 0.3, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
      text(s, p, { x: M + 0.1 + colG, y: y + 0.07, w: colP, h: 0.3, fontSize: 11, bold: true, color: NAVY, fontFace: BODY });
      text(s, c, { x: M + 0.1 + colG + colP, y: y + 0.03, w: W - M - colE - (M + 0.1 + colG + colP) - 0.2, h: 0.38, fontSize: 9.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.05 });
      text(s, e, { x: W - M - colE, y: y + 0.06, w: colE - 0.1, h: 0.34, fontSize: 9.5, italic: true, color: "7A7263", fontFace: BODY });
    });

    text(s, "Skipped \u2260 waived.  A gate outside the lane is refused outright and recorded nowhere. A gate inside it that cannot be met is waived — with a reason and a real future date.", {
      x: M, y: 6.52, w: CW, h: 0.3, fontSize: 10.5, color: NAVY, fontFace: BODY,
    });
  }

  /* ------------------------------ 9. DIAGRAM: lanes as gate subsets */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "Diagram · proportionality",
      title: "Four lanes — each one a subset of the nine gates",
      kicker: "Forcing nine gates onto a flag flip guarantees the next flag flip goes around the framework. express is a slice of full, not a different process.",
    });

    const labW = 1.75, cellW = 0.86, cellGap = 0.13;
    const gridX = M + labW + 0.25;
    const rowH = 0.62, rowGap = 0.20;
    const gridY = 2.42;

    // header
    ALL_GATES.forEach((g, i) => {
      text(s, g, {
        x: gridX + i * (cellW + cellGap), y: gridY - 0.32, w: cellW, h: 0.24,
        fontSize: 9.5, bold: true, color: "9A9184", align: "center", fontFace: BODY,
      });
    });
    const tailX = gridX + 9 * (cellW + cellGap) + 0.08;

    LANES.forEach(([lane, when, gates, bargain], r) => {
      const y = gridY + r * (rowH + rowGap);
      text(s, lane, { x: M, y: y + 0.04, w: labW, h: 0.26, fontSize: 14, bold: true, color: NAVY, fontFace: DISPLAY });
      text(s, when, { x: M, y: y + 0.30, w: labW + 0.22, h: 0.40, fontSize: 8, color: MUTED, fontFace: BODY, valign: "top" });
      ALL_GATES.forEach((g, i) => {
        const x = gridX + i * (cellW + cellGap);
        const on = gates.includes(g);
        card(s, { x, y, w: cellW, h: rowH, fill: on ? NAVY : CREAM, line: on ? NAVY : RULE, radius: 0.05 });
        text(s, g, { x, y: y + 0.14, w: cellW, h: 0.3, fontSize: 10.5, bold: on, color: on ? CREAM : "B3AB9C", align: "center", fontFace: BODY });
      });
      text(s, gates.length + " of 9", { x: tailX, y: y + 0.16, w: 1.0, h: 0.28, fontSize: 10.5, bold: true, color: NAVY, fontFace: BODY });
    });

    // annotations under the grid
    const notes = [
      ["Choose by the highest-severity characteristic present", "Never the average. One regulated field in an otherwise trivial change makes the whole change full."],
      ["Where two lanes both fit, take the wider one", "An unnecessary gate costs hours. A missing gate costs an incident."],
      ["Lanes are never widened in place", "state.lane is not hand-edited. A change that outgrows its lane is waived out, archived, and re-proposed."],
    ];
    const nw2 = (CW - 2 * 0.3) / 3;
    notes.forEach(([h, b], i) => {
      const x = M + i * (nw2 + 0.3);
      card(s, { x, y: 5.94, w: nw2, h: 0.90, fill: PAPER, line: RULE });
      text(s, h, { x: x + 0.22, y: 6.06, w: nw2 - 0.44, h: 0.28, fontSize: 10.5, bold: true, color: NAVY, fontFace: BODY });
      text(s, b, { x: x + 0.22, y: 6.34, w: nw2 - 0.44, h: 0.46, fontSize: 9, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.1 });
    });

    text(s, "hotfix defers G2 (retroactive within 48 hours) and makes G9 mandatory.   standard cannot record G4 at all — see slide 15.", {
      x: M, y: 5.62, w: CW, h: 0.28, fontSize: 10, italic: true, color: MUTED, fontFace: BODY,
    });
  }

  /* ------------------------------ 10. DIAGRAM: a change, end to end */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "dark", eyebrow: "Diagram · one change, end to end — and where it refuses",
      title: "propose  →  gates  →  validate  →  archive",
      kicker: "Every refusal below writes nothing at all — not the state, not the waivers row, not the event. A half-recorded change is worse than a blocked one.",
    });

    const n = 4, bw = 2.6;
    const gap = (CW - n * bw) / (n - 1);
    const xs = [0, 1, 2, 3].map((i) => M + i * (bw + gap));
    const stages = [
      ["propose", "--lane <lane>", "Opens the change from templates. The lane is fixed here, for the life of the change."],
      ["gate G#", "--pass | --fail | --waive", "Records a verdict plus an evidence path into state.json, and appends an event."],
      ["validate", "[--strict]", "Frontmatter and naming, the separation law, the ID chain. --strict adds the orphan check."],
      ["archive", "<name>", "Folds the delta spec into specs/, moves the change, writes the insight stub."],
    ];
    const refusals = [
      ["unknown lane '<x>' — valid lanes: ...", "--lane requires a value", "change '<name>' already exists"],
      ["G4 is not in lane 'standard'", "evidence path does not exist / not a regular file / is empty (0 bytes)", "--expires must be strictly in the future"],
      ["3 stale artifact(s) — resolve rework first", "T1 · T2 · T3 findings  (T4 under --strict)"],
      ["gates and/or artifacts are not settled", "refuses to overwrite an existing archive"],
    ];

    stages.forEach(([cmd, flag, body], i) => {
      const x = xs[i];
      card(s, { x, y: 2.24, w: bw, h: 1.5, fill: PANEL_D });
      text(s, cmd, { x: x + 0.22, y: 2.38, w: bw - 0.44, h: 0.3, fontSize: 15, bold: true, color: CREAM, fontFace: DISPLAY });
      text(s, flag, { x: x + 0.22, y: 2.68, w: bw - 0.44, h: 0.24, fontSize: 9.5, color: SAND, fontFace: BODY });
      text(s, body, { x: x + 0.22, y: 2.96, w: bw - 0.44, h: 0.68, fontSize: 9.5, color: MUTED_D, fontFace: BODY, lineSpacingMultiple: 1.12 });
      if (i < n - 1) arrow(s, { x: x + bw + 0.1, y: 2.99, w: gap - 0.2, h: 0, color: CREAM, width: 1.8 });

      // refusal card below
      card(s, { x, y: 4.12, w: bw, h: 1.58, fill: INK, line: "2A2F45" });
      text(s, "REFUSES WHEN", { x: x + 0.22, y: 4.26, w: bw - 0.44, h: 0.2, fontSize: 8, bold: true, charSpacing: 1, color: BRICK_D, fontFace: BODY });
      bullets(s, refusals[i], { x: x + 0.22, y: 4.52, w: bw - 0.44, h: 1.05, fontSize: 9, color: SAND, gap: 5 });
      arrow(s, { x: x + bw / 2, y: 3.8, w: 0, h: 0.26, color: BRICK_D, width: 1.3, dash: "dash" });
    });

    // the rework loop, drawn beneath
    card(s, { x: M, y: 5.96, w: CW, h: 0.82, fill: SLATE });
    text(s, "gate G6 --fail", { x: M + 0.3, y: 6.14, w: 1.6, h: 0.3, fontSize: 12, bold: true, color: BRICK_D, fontFace: BODY });
    arrow(s, { x: M + 2.0, y: 6.29, w: 0.5, h: 0, color: SAND, width: 1.5 });
    text(s, "G6 and every later gate in the same lane are marked stale  →  validate fails while any stale entry remains  →  a rework record names the phase to re-enter  →  each stale gate is cleared by re-recording it individually.", {
      x: M + 2.62, y: 6.12, w: CW - 3.0, h: 0.5, fontSize: 10, color: SAND, fontFace: BODY, lineSpacingMultiple: 1.12,
    });
    s.addNotes("Re-recording appends a new event carrying `previous`. History is appended, never overwritten: six months later the log still says G6 failed once, on what evidence.");
  }

  /* ------------------------------ 11. DIAGRAM: the traceability chain */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "Diagram · spec-driven",
      title: "Everything traces back to a requirement",
      kicker: "The spec is the source of truth and code is its consequence. A code change that outruns its spec is a defect, not a shortcut.",
    });

    const chain = [
      ["REQ", "requirement", "specs/<cap>/spec.md"],
      ["AC", "acceptance", "under its REQ heading"],
      ["ADR", "decision", "decisions/ADR-###.md"],
      ["TASK", "work item", "changes/<name>/tasks.md"],
      ["TEST", "proof", "your own test suite"],
      ["SLI", "telemetry", "ops/slo.md"],
      ["INSIGHT", "learning", "ops/postmortems/"],
    ];
    const cn = 7, cw = 1.44, cgap = (CW - cn * cw) / (cn - 1);
    chain.forEach(([id, lab, loc], i) => {
      const x = M + i * (cw + cgap);
      card(s, { x, y: 2.15, w: cw, h: 1.32, fill: i === 0 || i === cn - 1 ? NAVY : PAPER, line: i === 0 || i === cn - 1 ? NAVY : RULE });
      const fg = i === 0 || i === cn - 1 ? CREAM : NAVY;
      const fg2 = i === 0 || i === cn - 1 ? SAND : MUTED;
      text(s, id, { x: x + 0.06, y: 2.34, w: cw - 0.12, h: 0.34, fontSize: id.length > 4 ? 14 : 17, bold: true, color: fg, align: "center", fontFace: DISPLAY });
      text(s, lab, { x: x + 0.06, y: 2.72, w: cw - 0.12, h: 0.24, fontSize: 9.5, color: fg2, align: "center", fontFace: BODY });
      text(s, loc, { x: x + 0.06, y: 3.0, w: cw - 0.12, h: 0.36, fontSize: 8, italic: true, color: fg2, align: "center", fontFace: BODY });
      if (i < cn - 1) arrow(s, { x: x + cw + 0.04, y: 2.81, w: cgap - 0.08, h: 0, color: NAVY, width: 1.5 });
    });

    const halfW = (CW - 0.3) / 2;
    card(s, { x: M, y: 3.78, w: halfW, h: 2.06, fill: PAPER, line: RULE });
    text(s, "What the validator actually sees", { x: M + 0.28, y: 3.96, w: halfW - 0.56, h: 0.28, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
    bullets(s, [
      "A requirement only on a line starting with #  — not in a paragraph, a table cell or a bullet",
      "A criterion anywhere between its REQ heading and the next one",
      "A task only when the id is bold: **TASK-###**",
      "Implements: REQ-### only within three lines of the task",
      "Three digits minimum — REQ-4 is silently not a requirement",
    ], { x: M + 0.28, y: 4.3, w: halfW - 0.56, h: 1.4, fontSize: 9.5, color: MUTED, gap: 5 });

    const x2 = M + halfW + 0.3;
    card(s, { x: x2, y: 3.78, w: halfW, h: 2.06, fill: TINT });
    text(s, "The five findings", { x: x2 + 0.28, y: 3.96, w: halfW - 0.56, h: 0.28, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
    const F = [["T0", "the file is not readable — so it was not checked"],
    ["T1", "a TASK-### with no Implements: line"],
    ["T2", "a REQ-### with no acceptance criteria"],
    ["T3", "a TASK-### implementing an unknown REQ-###"],
    ["T4", "a REQ-### no task implements — --strict only"]];
    F.forEach(([id, d], i) => {
      const y = 4.32 + i * 0.29;
      text(s, id, { x: x2 + 0.28, y, w: 0.42, h: 0.24, fontSize: 10.5, bold: true, color: NAVY, fontFace: BODY });
      text(s, d, { x: x2 + 0.76, y, w: halfW - 1.04, h: 0.24, fontSize: 9.5, color: MUTED, fontFace: BODY });
    });

    text(s, "Never silence a finding by renaming an ID to one that happens to exist. Fix the missing link, or delete the orphan.", {
      x: M, y: 6.02, w: CW, h: 0.3, fontSize: 11, italic: true, color: NAVY, fontFace: BODY,
    });
    text(s, "The chain runs one way. An insight can propose a new requirement — but only by becoming a candidate REQ-### in a new change, never by editing backwards into a closed one.", {
      x: M, y: 6.34, w: CW, h: 0.3, fontSize: 10.5, color: MUTED, fontFace: BODY,
    });
  }

  /* ------------------------------------------------------- 12. the CLI */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "dark", eyebrow: "The CLI",
      title: "Eight verbs, and nothing to install but Node and Python",
      kicker: "Every command runs against the current working directory. The framework itself has zero runtime dependencies.",
      kickerW: 11.4,
    });

    const verbs = [
      ["init", "scaffold delivery/, generate AGENTS.md, detect the harness"],
      ["propose", "open a change from templates; fix its lane"],
      ["status", "change, lane, phase, gate verdicts, stale artifacts"],
      ["gate", "record a verdict with an evidence path, or a waiver"],
      ["validate", "frontmatter, the separation law, the ID chain"],
      ["archive", "fold the delta into specs/, emit the insight stub"],
      ["doctor", "harness detection; native vs fallback capabilities"],
      ["telemetry", "export the gate ledger as OTLP traces; off until you run it"],
    ];
    const lw = 7.5;
    verbs.forEach(([v, d], i) => {
      const y = 2.14 + i * 0.53;
      card(s, { x: M, y, w: lw, h: 0.47, fill: i % 2 ? PANEL_D : SLATE });
      text(s, v, { x: M + 0.26, y: y + 0.10, w: 1.35, h: 0.28, fontSize: 12.5, bold: true, color: CREAM, fontFace: "Consolas" });
      text(s, d, { x: M + 1.72, y: y + 0.12, w: lw - 2.0, h: 0.26, fontSize: 10, color: SAND, fontFace: BODY });
    });

    const tx = M + lw + 0.45, tw = W - M - tx;
    card(s, { x: tx, y: 2.18, w: tw, h: 2.92, fill: PANEL_D2 });
    text(s, "What it puts in your repo", { x: tx + 0.28, y: 2.34, w: tw - 0.56, h: 0.28, fontSize: 13, bold: true, color: CREAM, fontFace: DISPLAY });
    const tree = [
      "delivery/",
      "  project.md      your stack & conventions",
      "  AGENTS.md       harness entry point",
      "  specs/          current truth",
      "  changes/        in flight, and archive/",
      "  decisions/      ADRs",
      "  ops/            slo · runbooks · postmortems",
      "  .adlc/          state · events · waivers",
    ];
    text(s, tree.join("\n"), {
      x: tx + 0.28, y: 2.62, w: tw - 0.56, h: 2.25, fontSize: 10, color: SAND, fontFace: "Consolas", lineSpacingMultiple: 1.62, valign: "top",
    });

    card(s, { x: tx, y: 5.26, w: tw, h: 1.28, fill: SLATE });
    text(s, "ops/ is the deliberate extension", { x: tx + 0.28, y: 5.40, w: tw - 0.56, h: 0.26, fontSize: 11.5, bold: true, color: CREAM, fontFace: BODY });
    text(s, "It is past where change-proposal tooling usually stops. Phases 8 and 9 need a home in the repo, or the loop from an incident back to a changed standard cannot close.",
      { x: tx + 0.28, y: 5.70, w: tw - 0.56, h: 0.72, fontSize: 9.5, color: MUTED_D, fontFace: BODY, lineSpacingMultiple: 1.12 });

    card(s, { x: M, y: 6.45, w: lw, h: 0.45, fill: SLATE });
    text(s, "status, validate and archive read only .adlc/state.json and .adlc/events.jsonl. A verdict asserted in prose does not exist.", {
      x: M + 0.26, y: 6.57, w: lw - 0.5, h: 0.24, fontSize: 9.5, color: SAND, fontFace: BODY,
    });
  }

  /* ------------------------------------------------ 13. runs anywhere */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "Portability",
      title: "Neutral capabilities, and a mandatory fallback for each",
      kicker: "An agent that names Read and Bash works in exactly one harness. The fallback column is what makes 'runs anywhere' true rather than aspirational.",
    });

    const caps = JSON.parse(fs.readFileSync(path.join(REPO, "registry/capabilities.json"), "utf8"));
    const cols = [["CAPABILITY", 2.35], ["CLAUDE CODE", 2.1], ["CODEX / CURSOR", 2.35], ["FALLBACK — NO TOOLING AT ALL", CW - 2.35 - 2.1 - 2.35]];
    let cx = M + 0.24;
    cols.forEach(([h, w]) => {
      text(s, h, { x: cx, y: 2.06, w: w - 0.2, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1, color: "9A9184", fontFace: BODY });
      cx += w;
    });
    caps.forEach((c, i) => {
      const y = 2.38 + i * 0.6;
      card(s, { x: M, y, w: CW, h: 0.52, fill: i === caps.length - 1 ? NAVY : PAPER, line: i === caps.length - 1 ? NAVY : RULE });
      const fg = i === caps.length - 1 ? CREAM : NAVY;
      const fg2 = i === caps.length - 1 ? SAND : MUTED;
      let x = M + 0.24;
      text(s, c.name, { x, y: y + 0.15, w: cols[0][1] - 0.2, h: 0.26, fontSize: 11, bold: true, color: fg, fontFace: "Consolas" }); x += cols[0][1];
      text(s, c.claude_code, { x, y: y + 0.15, w: cols[1][1] - 0.2, h: 0.26, fontSize: 10.5, color: fg2, fontFace: BODY }); x += cols[1][1];
      text(s, c.codex || "— not available —", { x, y: y + 0.15, w: cols[2][1] - 0.2, h: 0.26, fontSize: 10.5, color: fg2, fontFace: BODY }); x += cols[2][1];
      text(s, c.fallback, { x, y: y + 0.15, w: cols[3][1] - 0.24, h: 0.26, fontSize: 10.5, color: fg2, fontFace: BODY });
    });

    card(s, { x: M, y: 6.02, w: CW, h: 0.72, fill: TINT });
    text(s, "A persona is a subagent where subagents exist, and a role the model steps into where they do not — the same agent file, the same skills, degraded isolation only. registry/capabilities.json is the single source, and scripts/build_adapters.py projects it into each harness's shape. Adapters are generated; CI diffs them, so a hand edit fails the build.", {
      x: M + 0.3, y: 6.14, w: CW - 0.6, h: 0.5, fontSize: 10, color: NAVY, fontFace: BODY, lineSpacingMultiple: 1.1,
    });
  }

  /* ------------------------------------------------- 14. testing the content */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "How we know it holds",
      title: "The content is the product, so we test it like one",
      kicker: "Four validators, a harness that runs every skill's own checks, and a golden path across all four lanes — all of it in CI on every push.",
    });

    const checks = [
      ["validate_manifests.py", "M1–M7", "Frontmatter parses; required keys present; names match their directory and prefix; every skill an agent names resolves; every skill is named by at least one agent.", "0 findings across 50 files"],
      ["lint_separation.py", "SEP1–SEP4", "A numbered procedure or a template inside an agent; persona voice or first person inside a skill. The one check that stops the two halves merging.", "0 separation findings"],
      ["validate_traceability.py", "T0–T4", "The ID chain in your delivery/ tree: every requirement criteria'd, every task attached to a requirement that exists.", "0 traceability findings"],
      ["validate_skill_checks.py", "the harness", "Runs each skill's own Validation block against its own Template — then against a mutation that breaks a rule the block claims to catch. A check that stays silent fails here.", "38 harnessed · 1 declared-unharnessable · 0 failing"],
    ];
    const ch2 = 0.86;
    checks.forEach(([n, tag, d, res], i) => {
      const y = 2.04 + i * (ch2 + 0.14);
      card(s, { x: M, y, w: CW, h: ch2, fill: PAPER, line: RULE });
      text(s, n, { x: M + 0.28, y: y + 0.14, w: 3.1, h: 0.28, fontSize: 12, bold: true, color: NAVY, fontFace: "Consolas" });
      text(s, tag, { x: M + 0.28, y: y + 0.44, w: 3.1, h: 0.24, fontSize: 9.5, color: "9A9184", fontFace: BODY });
      text(s, d, { x: M + 3.5, y: y + 0.14, w: CW - 3.5 - 3.4, h: 0.62, fontSize: 10, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.12 });
      text(s, res, { x: W - M - 3.3, y: y + 0.26, w: 3.02, h: 0.40, fontSize: 10, bold: true, color: NAVY, align: "right", fontFace: BODY });
    });

    const hw = (CW - 0.3) / 2;
    card(s, { x: M, y: 6.0, w: hw, h: 0.78, fill: NAVY });
    text(s, "golden_path.py", { x: M + 0.28, y: 6.12, w: hw - 0.56, h: 0.26, fontSize: 11.5, bold: true, color: CREAM, fontFace: "Consolas" });
    text(s, "A toy change carried through all nine phases on all four lanes, asserting the artifacts, the gate verdicts and zero orphans.   golden path: OK", {
      x: M + 0.28, y: 6.38, w: hw - 0.56, h: 0.34, fontSize: 9.5, color: SAND, fontFace: BODY, lineSpacingMultiple: 1.08,
    });
    card(s, { x: M + hw + 0.3, y: 6.0, w: hw, h: 0.78, fill: TINT });
    text(s, "The test suites", { x: M + hw + 0.58, y: 6.12, w: hw - 0.56, h: 0.26, fontSize: 11.5, bold: true, color: NAVY, fontFace: BODY });
    text(s, "125 Node tests over the CLI and 99 Python tests over the linters, plus a check that the generated adapters still match their source.", {
      x: M + hw + 0.58, y: 6.38, w: hw - 0.56, h: 0.34, fontSize: 9.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.08,
    });
  }

  /* ------------------------------------------- 15. what v1 does not do */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "ink", eyebrow: "Honestly",
      title: "What v1 does not do yet",
      kicker: "These are real, recorded, and worth knowing before you meet them. A deck that hides its limitations costs the framework its credibility on day one.",
    });

    const lim = [
      ["Only two adapters are built",
        "claude-code and generic ship and are exercised. Codex and Cursor have sibling manifests at the repo root and doctor detects both — but no adapter tree is built for either, and neither has been loaded in its harness. LangGraph and CrewAI are named in the design and not built. Use adapters/generic/RUNBOOK.md there today."],
      ["gate --evidence validates the shape of evidence, not its content",
        "Evidence must be a regular, non-empty file — a directory, a device and a zero-byte file are each refused with their own message. But a file containing a single space passes. The gate records that evidence was named and that something is there to open; only a human establishes that it says anything."],
      ["Gate actors are derived, not authenticated",
        "Every gate event does carry actor and actor_source, resolved from --actor, $NAVI_DELIVERY_ACTOR, git config user.email or the OS login, in that order — and a decision with no resolvable actor is refused outright. But that is attribution, not authentication: nothing stops someone passing a name that is not theirs. actor_source is what lets a reader weigh it."],
      ["G4 is enforced only on the full lane",
        "cli/lib/lanes.js implements standard as a fixed set without G4, and gate refuses anything outside the set — so a standard change that turns out to touch data cannot record G4 at all. Until that is reconciled, lane selection routes anything touching a dataset, schema, feature or model to full at proposal time."],
      ["Two more, for completeness",
        "A waiver attaches to the whole gate, so one unfixable finding waives every criterion that gate checks. And navi-skill-code-review is declared unharnessable: its substantive checks read a live authenticated pull request, which neither a fixture nor CI can supply."],
    ];
    const lh = 0.80;
    lim.forEach(([h, b], i) => {
      const y = 2.06 + i * (lh + 0.10);
      card(s, { x: M, y, w: CW, h: lh, fill: "151B2B", line: "252B3F" });
      text(s, h, { x: M + 0.3, y: y + 0.10, w: CW - 0.6, h: 0.26, fontSize: 12, bold: true, color: BRICK_D, fontFace: DISPLAY });
      text(s, b, { x: M + 0.3, y: y + 0.36, w: CW - 0.6, h: 0.40, fontSize: 9.5, color: SAND, fontFace: BODY, lineSpacingMultiple: 1.05 });
    });

    text(s, "Also worth knowing: validate always lints the whole installed framework tree, not only your repo — so its output mentions 50 framework files whichever repo you run it in.", {
      x: M, y: 6.58, w: CW, h: 0.3, fontSize: 10, italic: true, color: "8E93AD", fontFace: BODY,
    });
  }

  /* ------------------------------------------------------- 16. adopting */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "Adopting it",
      title: "Five minutes to a first proposal",
      kicker: "Prerequisites: Node 20 or later, and Python 3. Nothing else.",
    });

    const steps = [
      ["1", "Add the marketplace", "/plugin marketplace add navikenz/navi-delivery", `the preferred way in — ${SKILLS} skills and ${AGENTS} agents, with no clone`],
      ["2", "Install the plugin", "/plugin install navi-delivery@navi-delivery", "./install.sh --yes does the same job from a clone"],
      ["3", "Scaffold into the repo you work in", "navi-delivery init", "Initialised delivery/ (harness: claude-code)"],
      ["4", "Open your first change", "navi-delivery propose add-csv-export --lane standard", "Created delivery/changes/add-csv-export (lane: standard; gates: G1 · G2 · G3 · G5 · G6 · G7 · G8)"],
    ];
    steps.forEach(([n, h, cmd, out], i) => {
      const y = 2.0 + i * 0.99;
      card(s, { x: M, y, w: CW, h: 0.86, fill: PAPER, line: RULE });
      text(s, n, { x: M + 0.28, y: y + 0.2, w: 0.4, h: 0.48, fontSize: 24, bold: true, color: NUMERAL, fontFace: DISPLAY });
      text(s, h, { x: M + 0.86, y: y + 0.13, w: 3.5, h: 0.28, fontSize: 12, bold: true, color: NAVY, fontFace: DISPLAY });
      text(s, cmd, { x: M + 0.86, y: y + 0.44, w: 6.0, h: 0.28, fontSize: 10.5, color: SLATE, fontFace: "Consolas" });
      text(s, "→ " + out, { x: M + 7.1, y: y + 0.28, w: CW - 7.4, h: 0.44, fontSize: 9, italic: true, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.08 });
    });

    card(s, { x: M, y: 6.02, w: CW, h: 0.74, fill: NAVY });
    text(s, "Install adapters/claude-code/ — that is what install.sh installs, and it is a complete plugin on its own. The repo root also carries a manifest, but its skills nest one level deeper and whether a harness loads that layout is unverified. Read next: docs/WALKTHROUGH.md, which carries this exact change all the way through.", {
      x: M + 0.3, y: 6.14, w: CW - 0.6, h: 0.52, fontSize: 10, color: SAND, fontFace: BODY, lineSpacingMultiple: 1.1,
    });
  }

  /* -------------------------------------- 17. outside the repository */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "light", eyebrow: "Outside the repository",
      title: "Connecting to the tracker, without a token in the shell",
      kicker: "Two skills reach past the repo. Both prefer an MCP server, because the server holds the credential.",
      kickerW: 11.4,
    });

    const rows = [
      ["Atlassian", "hosted, OAuth as you", "mcp.atlassian.com/v2/mcp"],
      ["Atlassian", "local, API token", "uvx mcp-atlassian"],
      ["Azure DevOps", "local, your az login", "npx @azure-devops/mcp"],
      ["GitHub", "hosted, OAuth as you", "api.githubcopilot.com/mcp/"],
      ["GitHub", "local, a token", "ghcr.io/github/github-mcp-server"],
    ];
    const lw = 6.95;
    text(s, "config/mcp/ — five connection files, ready to install", {
      x: M, y: 2.02, w: lw, h: 0.28, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
    rows.forEach(([svc, route, cmd], i) => {
      const y = 2.42 + i * 0.56;
      card(s, { x: M, y, w: lw, h: 0.48, fill: i % 2 ? TINT : PAPER, line: RULE });
      text(s, svc, { x: M + 0.24, y: y + 0.13, w: 1.6, h: 0.26, fontSize: 11, bold: true, color: NAVY, fontFace: BODY });
      text(s, route, { x: M + 1.9, y: y + 0.14, w: 1.75, h: 0.24, fontSize: 9.5, color: MUTED, fontFace: BODY });
      text(s, cmd, { x: M + 3.72, y: y + 0.14, w: lw - 3.96, h: 0.24, fontSize: 9.5, color: SLATE, fontFace: "Consolas" });
    });

    card(s, { x: M, y: 5.3, w: lw, h: 1.0, fill: NAVY });
    text(s, "No credential is in any of those files", {
      x: M + 0.26, y: 5.44, w: lw - 0.5, h: 0.26, fontSize: 11.5, bold: true, color: CREAM, fontFace: BODY });
    text(s, "Every secret is a ${NAME} the harness expands. A CI check fails on a value shaped like a known token anywhere in the document, and on any literal under a credential-shaped key — which is what catches an internal credential matching no public pattern.", {
      x: M + 0.26, y: 5.72, w: lw - 0.5, h: 0.5, fontSize: 9, color: SAND, fontFace: BODY, lineSpacingMultiple: 1.1 });

    const rx = M + lw + 0.45, rw = W - M - rx;
    text(s, "automation/cron/ — optional", {
      x: rx, y: 2.02, w: rw, h: 0.28, fontSize: 13, bold: true, color: NAVY, fontFace: DISPLAY });
    card(s, { x: rx, y: 2.42, w: rw, h: 1.72, fill: TINT, line: RULE });
    text(s, "Tracker item → proposed branch", {
      x: rx + 0.26, y: 2.56, w: rw - 0.5, h: 0.26, fontSize: 11.5, bold: true, color: NAVY, fontFace: BODY });
    text(s, "For each tagged item it has not seen: branch off the base, propose, seed the proposal from the item, commit, push, open a pull request. What it opens is a scaffolded branch — a person still writes the why.", {
      x: rx + 0.26, y: 2.86, w: rw - 0.5, h: 1.14, fontSize: 9.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.14 });

    const props = [
      ["Never touches your checkout", "every change happens in a worktree it creates and removes"],
      ["Nothing irreversible without --push", "the default stops at the local commit and reports"],
      ["Tracker text is never code", "anyone can file a ticket; values arrive via the environment"],
    ];
    props.forEach(([h, d], i) => {
      const y = 4.3 + i * 0.68;
      card(s, { x: rx, y, w: rw, h: 0.6, fill: PAPER, line: RULE });
      text(s, h, { x: rx + 0.24, y: y + 0.09, w: rw - 0.48, h: 0.24, fontSize: 10.5, bold: true, color: NAVY, fontFace: BODY });
      text(s, d, { x: rx + 0.24, y: y + 0.33, w: rw - 0.48, h: 0.22, fontSize: 9, color: MUTED, fontFace: BODY });
    });

    card(s, { x: M, y: 6.45, w: lw, h: 0.45, fill: TINT, line: RULE });
    text(s, "Prefer a hosted route: it carries no secret to leak, and acts as you — so it can do nothing your own account cannot.", {
      x: M + 0.24, y: 6.57, w: lw - 0.48, h: 0.24, fontSize: 9, color: MUTED, fontFace: BODY });
    s.addNotes("config/mcp/ ships five connection files and a .env.example; scripts/validate_mcp_configs.py runs in CI. automation/cron/ is opt-in and prints its crontab line rather than installing it, unless you pass --apply.");
  }

  /* ------------------------------------------------ 18. telemetry */
  {
    const s = pres.addSlide();
    frame(s, seq(), {
      mode: "dark", eyebrow: "Telemetry",
      title: "One trace per change, one span per gate",
      kicker: "navi-delivery telemetry — off until you run it. No other command makes a network call.",
      kickerW: 11.4,
    });

    const lw = 6.4;
    card(s, { x: M, y: 2.1, w: lw, h: 2.52, fill: PANEL_D });
    text(s, "The waterfall", { x: M + 0.28, y: 2.26, w: lw - 0.56, h: 0.26, fontSize: 12.5, bold: true, color: CREAM, fontFace: DISPLAY });
    const tree = [
      "change:add-csv-export        root",
      "├─ G1 pass                   status 1",
      "├─ G2 fail                   status 2",
      "├─ G2 pass                   attempt 2",
      "└─ G6 waived                 expires 2026-12-31",
    ];
    text(s, tree.join("\n"), {
      x: M + 0.28, y: 2.6, w: lw - 0.56, h: 1.3, fontSize: 9.5, color: SAND, fontFace: "Consolas", lineSpacingMultiple: 1.5, valign: "top" });
    text(s, "A gate decision is an instant, so its span has no duration. The number a delivery dashboard wants — how long the change waited — is an attribute saying exactly that, not a fabricated duration.", {
      x: M + 0.28, y: 4.0, w: lw - 0.56, h: 0.52, fontSize: 9, color: MUTED_D, fontFace: BODY, lineSpacingMultiple: 1.12 });

    const rx = M + lw + 0.45, rw = W - M - rx;
    // Two columns, not three: the third was 1.34in wide, which wraps a
    // 25-character value onto a second line inside a 0.48in card.
    const backends = [
      ["AgentObs", "X-Ingest-Key · direct OTLP ingestion"],
      ["Opik", "Authorization · workspace + project"],
      ["LangSmith", "x-api-key · Langsmith-Project"],
      ["Any OTLP", "headers verbatim · a collector or another vendor"],
    ];
    text(s, "Four backends, OTLP/HTTP JSON", { x: rx, y: 2.1, w: rw, h: 0.28, fontSize: 12.5, bold: true, color: CREAM, fontFace: DISPLAY });
    backends.forEach(([n, d], i) => {
      const y = 2.5 + i * 0.56;
      card(s, { x: rx, y, w: rw, h: 0.48, fill: i % 2 ? PANEL_D : SLATE });
      text(s, n, { x: rx + 0.24, y: y + 0.12, w: 1.5, h: 0.26, fontSize: 11, bold: true, color: CREAM, fontFace: BODY });
      text(s, d, { x: rx + 1.78, y: y + 0.13, w: rw - 2.02, h: 0.24, fontSize: 9, color: SAND, fontFace: BODY });
    });

    card(s, { x: M, y: 4.78, w: CW, h: 1.0, fill: SLATE });
    text(s, "What it exports is the ledger — not the agents' model calls", {
      x: M + 0.28, y: 4.92, w: CW - 0.56, h: 0.26, fontSize: 11.5, bold: true, color: CREAM, fontFace: BODY });
    text(s, "Who recorded which gate, when, with what evidence, how long the change waited, how many times a gate was re-recorded. The CLI makes no model calls, so it has none to report — and claiming otherwise would be exactly the promise this framework's own skills exist to stop people making.", {
      x: M + 0.28, y: 5.2, w: CW - 0.56, h: 0.5, fontSize: 9.5, color: SAND, fontFace: BODY, lineSpacingMultiple: 1.12 });

    card(s, { x: M, y: 5.94, w: CW, h: 0.96, fill: INK, line: "2A2F45" });
    text(s, "The one way this can silently do nothing", {
      x: M + 0.28, y: 6.06, w: CW - 0.56, h: 0.26, fontSize: 11, bold: true, color: BRICK_D, fontFace: BODY });
    text(s, "llm.span.kind is AgentObs's own convention. It renders only the kinds it recognises; one it does not know is accepted, stored, and shown on no screen — with no error on either side. Probe it before trusting a dashboard. Credentials come from the environment only, are never printed, and never reach the local record of what was sent.", {
      x: M + 0.28, y: 6.34, w: CW - 0.56, h: 0.5, fontSize: 9, color: MUTED_D, fontFace: BODY, lineSpacingMultiple: 1.12 });
    s.addNotes("doctor shows which backends are configured and what is missing, by variable name, printing header names and never header values. preview builds the payload through the same pure fold export uses. A refused export exits non-zero and changes nothing about the delivery record.");
  }

  /* ------------------------------------------------------- 19. close */
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addImage({ data: LOGO.cream, x: M, y: 0.85, w: 2.3, h: 2.3 * LOGO.aspect });

    text(s, "Agents hold the judgment.", { x: M, y: 2.2, w: 11.4, h: 0.8, fontSize: 42, bold: true, color: CREAM, fontFace: DISPLAY });
    text(s, "Skills hold the rules.", { x: M, y: 3.0, w: 11.4, h: 0.8, fontSize: 42, bold: true, color: SAND, fontFace: DISPLAY });
    text(s, "Delete every agent and the skills still fully specify how work is done. Delete every skill and the agents still specify what, why and when.", {
      x: M, y: 4.05, w: 10.6, h: 0.5, fontSize: 13, italic: true, color: MUTED_D, fontFace: BODY, lineSpacingMultiple: 1.15,
    });

    const links = [
      ["README.md", "clone to first proposal"],
      ["ADLC.md", "nine gates, four lanes, rework"],
      ["SDD.md", "the ID chain, and what the validator really sees"],
      ["docs/WALKTHROUGH.md", "one change carried end to end"],
      ["docs/CONCEPTS.md", "why the framework is shaped this way"],
      ["docs/CLI.md", "every verb, every rule, every known limitation"],
      ["docs/TELEMETRY.md", "the span model and the silent-failure trap"],
      ["config/mcp/README.md", "connecting Jira, ADO and Confluence"],
    ];
    const lw2 = (CW - 0.4) / 2;
    links.forEach(([f, d], i) => {
      const x = M + (i % 2) * (lw2 + 0.4);
      const y = 4.9 + Math.floor(i / 2) * 0.54;
      text(s, f, { x, y, w: 2.6, h: 0.3, fontSize: 11.5, bold: true, color: CREAM, fontFace: "Consolas" });
      text(s, d, { x: x + 2.7, y: y + 0.02, w: lw2 - 2.7, h: 0.3, fontSize: 10.5, color: MUTED_D, fontFace: BODY });
    });

    text(s, "navi-delivery v0.1.0  ·  owner avinash.negi@navikenz.com", {
      x: M, y: H - 0.54, w: 8, h: 0.24, fontSize: 9, color: "6E7591", fontFace: BODY,
    });
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
}

build().catch((e) => { console.error(e); process.exit(1); });
