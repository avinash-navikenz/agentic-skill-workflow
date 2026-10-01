# Decision record — the v1 build

**This is a build log, not a spec.** Nothing in it is normative, and nothing in it governs
how the framework is used. Where it disagrees with [`ADLC.md`](../ADLC.md),
[`SDD.md`](../SDD.md), [`docs/CLI.md`](CLI.md) or any `SKILL.md`, those win — they are the
rules; this is the record of how they came to say what they say.

It is the controller's working ledger from the build of v1, copied verbatim from
`.superpowers/sdd/2026-09-28-navi-delivery-v1/progress.md`. That directory is gitignored,
so until this copy existed the reasoning behind every divergence in this build lived on one
machine and shipped nowhere.

What it is worth reading for: it carries 62 entries opening with `Ruling:`, and each one
names the decision taken, why it was taken over the alternative, and what it would cost if
it turned out wrong. Those are the questions a reader of the finished tree cannot answer
from the tree — why the capability table became `registry/capabilities.json` instead of
staying inline in two languages, why a `Won't` requirement is exempt from the traceability
rules, why `--actor` is a resolution chain and not a required flag.

Three things to know before trusting a line of it:

- **It is frozen.** It was written as the build happened and is not maintained. Figures
  inside it — test totals, skill and agent counts, gate tallies — were true at the moment
  they were written and several are not true now. The gates in CI are the live numbers.
- **It is first-person and informal**, written by the controlling agent to itself. It is
  not a document anyone edited for an audience.
- **Its links do not resolve.** It refers throughout to sibling files under `.superpowers/`
  — per-task briefs, implementer reports, review diffs — which are not tracked and did not
  ship with it.

The plan and the spec it worked from *are* tracked, and are the two documents to read
beside it: [`docs/superpowers/plans/2026-09-28-navi-delivery-v1.md`](superpowers/plans/2026-09-28-navi-delivery-v1.md)
and [`docs/superpowers/specs/2026-09-28-navi-delivery-framework-design.md`](superpowers/specs/2026-09-28-navi-delivery-framework-design.md).

---

# SDD ledger — plan: docs/superpowers/plans/2026-09-28-navi-delivery-v1.md

Spec: docs/superpowers/specs/2026-09-28-navi-delivery-framework-design.md (read, reachable)
Branch: feat/navi-delivery-v1 (no worktree: EnterWorktree is scoped to explicit user/CLAUDE.md
request, and its default baseRef needs an origin this local-only repo lacks)
Baseline: no package.json at start; nothing to install, no tests to run. Clean by construction.

## Pre-flight scan — cross-task pairs (shared file or interface)

| Pair | Produces → consumes | Finding |
|---|---|---|
| T1 → T6 | `cli/index.js` stub → full dispatcher | OK — T6 keeps `--version` ahead of dispatch, T1's smoke test stays green |
| T1 → T2 | `scripts/navi_lint/__init__.py` → modules beside it | OK |
| T2 → T3,T4,T11,T16 | `Entry`, `load_entries`, `FrontmatterError` | OK — names match at every call site |
| T3 → T4,T11 | `Finding` namedtuple | OK — defined once in T3, imported twice |
| T5 → T6..T12 | `paths/lanes/state/events` | OK — `run(argv,cwd,emit)` uniform across all 7 commands |
| T6 → T7..T12 | dispatcher requires command modules | OK — requires are lazy (inside the COMMANDS map), so T6 lands before T7-T12 exist |
| T7 → T8,T10,T12,T17 | `delivery/` tree incl. `.adlc/waivers.md` | OK — T10 appends to the file T7 creates |
| T7 → T16 | `templates/delivery/AGENTS.md` stub → regenerated | OK — T7 asserts existence only, not content |
| T8 → T12 | `changes/<name>/` → archived | OK |
| T5 → T16 | capability table in JS → same table in Python | **CONFLICT** — 6-row table duplicated across two languages; drifts silently |
| T13 → T14 | skill names → agent `skills:` lists | OK |
| T14 → T15 | agent `skills:` → the 26 skills | OK — M4 findings expected between T14 and T15; T14 Step 3 runs only lint_separation, so the noise is not mistaken for failure |
| T15 ↔ T14 | skill `used_by_agents` ↔ agent `skills:` | WATCH — must agree in both directions; T15 Step 4 is the check |
| T17 → T5..T12 | golden path shells every command | OK — reads lanes via node, no duplicated lane table |
| T18 → T13,T14,T15 | `OWNER_TBD` sweep | OK |

## Pre-flight scan — per-task internal consistency

| Task | Tests vs. code it specifies | Finding |
|---|---|---|
| T1 | smoke test ↔ package.json + stub | OK |
| T2 | 6 cases ↔ parser paths (incl. UnicodeDecodeError) | OK — every case has a code path |
| T3 | 7 cases ↔ M1-M6; `Entry` is a mutable dataclass so the path mutation in the M3 test works | OK |
| T4 | 8 cases ↔ SEP1-SEP4; `_strip_code` keeps skill templates from tripping the rules | OK |
| T5 | 7 cases ↔ 4 modules | OK |
| T6 | 3 cases; `harness.replace("-","_")` resolves to real CAPABILITIES keys | OK |
| T7 | 3 cases ↔ DIRS + templates | OK |
| T8 | 4 cases ↔ propose; `standard` includes G3 as the waiver test assumes | OK |
| T9 | 2 cases ↔ status | OK |
| T10 | 6 cases ↔ gate | OK |
| T11 | 4 cases; `## REQ-` lines start with `#` so the REQ branch fires, `### AC-` falls to the elif | OK |
| T12 | 3 cases ↔ archive | OK |
| T16 | banner assertion iterates **every** written `.md`, which includes verbatim-copied SKILL.md/.agent.md files that carry no banner | **CONFLICT** — the test as written fails |
| T17 | `gates_for()` reads lanes.js into `src` and never uses it | **CONFLICT** — dead code the rubric treats as a defect |
| T18 | `sed -i ''` is macOS-only | **CONFLICT** — breaks on Linux |

## Rulings

Ruling: T5/T16 capability duplication — introduce `registry/capabilities.json` as the single
source of truth; `cli/lib/capabilities.js` and `scripts/build_adapters.py` both read it.
Why: a 6-row table duplicated across two languages drifts, and spec §4.4 makes "every
capability has a fallback" a load-bearing guarantee — it must be true in one place.
Cost if wrong: one extra file and a read path; trivial to inline again.

Ruling: T16 banner test — scope the assertion to generated files only (RUNBOOK.md,
AGENTS.md), not to copied adapter content. Why: copied skill/agent files are verbatim by
design; stamping a banner into them would corrupt the content the adapter exists to carry.
Cost if wrong: a generated file could ship without a do-not-edit banner.

Ruling: T17 `gates_for()` — delete the unused `src` line. Why: dead code, and the function
already gets its answer from the node subprocess. Cost if wrong: none.

Ruling: T18 owner sweep — replace `sed -i ''` with a portable Python one-liner. Why: the
plan targets Linux CI as well as the author's Mac. Cost if wrong: none; it is a one-time
local edit either way.

Note: T14 lands before T15, so `validate_manifests.py` reports M4 for the 26 not-yet-written
skills in between. Expected and documented in T15 Step 1 — not a failure.

## Progress

Task 1: dispatched (sonnet) — BASE dc1a0d4 — brief task-1-brief.md, report task-1-report.md
  Controller setup done first: .superpowers/ added to .gitignore (workspace would
  otherwise have been committed); plan committed at dc1a0d4.
Task 1: implementer returned DONE_WITH_CONCERNS (commit 7395812) — deviated from the brief's
  literal `node --test tests/cli/` because it fails on Node v25.5.0. Controller verified the
  claim independently: it does fail. Deviation justified.
  Ruling: the implementer's replacement `node --test 'tests/cli/**/*.test.js'` is QUOTED, so
  Node must expand the glob itself — support for that landed only in Node 22, while Global
  Constraints say Node>=20 and Task 17 pins CI to node-version 20. Latent CI break.
  Corrected to the unquoted shell glob `node --test tests/cli/*.test.js`: the shell expands it,
  so it is identical on Node 20-25 with no Node-side glob dependency. All three forms verified
  locally on Node 25. Cost if wrong: none observed; the bare `node --test` is a fallback.
  Resumed implementer to apply it (pre-review correction, not a fix round).
Task 1: correction applied (commit 43e5698) — npm test now `node --test tests/cli/*.test.js`.
  Both suites pass. Task 1: minor (deferred): unquoted glob does not recurse into
  subdirectories of tests/cli/; every planned test file is flat there, so harmless today.
Task 1: task reviewer dispatched (sonnet) over dc1a0d4..43e5698.
Task 1: review clean — spec compliance PASS, quality Approved.
  Resolved reviewer's "cannot verify" item: proved the glob is expanded by the SHELL, not by
  Node (`process.argv.slice(1)` == ["tests/cli/smoke.test.js"]), so Node's own glob support is
  irrelevant and any Node>=20 accepting a file path works. No Node 20 binary on this machine;
  the mechanism test is stronger evidence than a version run would have been. Not a gap.
Task 1: minor (deferred): npm test relies on POSIX shell glob expansion; Windows cmd.exe does
  not expand globs, so `npm test` would fail for a contributor on Windows. CI is ubuntu.
Task 1: complete (commits dc1a0d4..43e5698, review clean)
Task 2: dispatched (haiku — brief carries complete code, transcription+testing) — BASE 43e5698
Task 2: implemented (commit 680d4c8). Review: spec FAIL + 1 Important + 2 Minor.
  Finding A (spec FAIL): frontmatter.py has an `isinstance(meta, dict)` guard for non-mapping
  YAML, but no test exercises it. Untested code path on a validator whose whole job is to not
  crash. My pre-flight scan missed this: I checked the plan's 6 tests against the parser's
  paths and called it OK — the parser actually has 7 paths. Scan error, not implementer error.
  Ruling: add the missing test. Spec Review Focus item 2 ("validators must report, never
  traceback") is only satisfied if every guard is covered. Cost if wrong: one extra test.
  Finding B (Important, PLAN-MANDATED): `test_malformed_yaml_raises_with_line` is verbatim
  from the plan and asserts only the exception TYPE — never `.line`, despite its name.
  Ruling: the finding wins over the plan text. The spec makes readable line-accurate errors a
  requirement, and a test that asserts less than its name claims is worse than none — it reads
  as coverage that does not exist. Strengthen it to assert `.line` and `.message`.
  Cost if wrong: none; a stricter test on behaviour the parser already implements.
Task 2: minor (deferred): entries sorted within each glob, not globally across kinds.
Task 2: minor (deferred): `raise FrontmatterError(...)` lacks `from exc`, losing the cause chain.
Task 2: fix round 1/5 (2 addressed, 0 open — non-mapping YAML test added, malformed-YAML test
  strengthened to assert .line==3 and .message; re-reviewer independently derived the 3 from
  the parser's +2 arithmetic rather than trusting it; commits 680d4c8..24d5c13)
Task 2: complete (commits 43e5698..24d5c13, review clean)
Ruling (pre-empting Task 3): the T2 failure class — a rule implemented but never exercised —
  recurs in Task 3. Rule M1 (frontmatter fails to parse) is handled in main()'s
  except FrontmatterError, and none of the brief's 7 tests reach it. Carrying an explicit
  instruction to cover M1, rather than spending a fix round rediscovering it.
  Cost if wrong: one extra test on a path the spec requires never to traceback.
Task 3: dispatched (haiku — brief carries complete code) — BASE 24d5c13
Task 3: review clean — spec PASS, quality Approved. Reviewer confirmed the M1 test exercises
  the real error path (traced through frontmatter.py) rather than passing accidentally, and
  that each of M2-M6 would fail if its rule were deleted. "dead code cleaned" was scratch
  iteration on the implementer's own new test, disclosed in its report — not brief deviation.
Task 3: minor (deferred): `sys.path.insert(0, ...)` at module top is an import-hygiene smell.
  It is verbatim from the plan and repeats in Tasks 4 and 11 — a plan-level choice, not an
  implementer one. Flag for final-review triage across all three validators at once.
Task 3: complete (commits 24d5c13..2963013, review clean)
Ruling (pre-empting Task 4): same gap class again, twice over. (a) `main()`'s exit-code path
  has no test, as with M1 in Task 3. (b) `_strip_code()` exists so fenced examples inside a
  SKILL.md do not trip SEP3/SEP4 — the plan's 8 tests never put persona voice inside a code
  fence, so the function that makes skill templates possible is unverified. Carrying explicit
  instructions for both. Cost if wrong: two extra tests on load-bearing paths.
Task 4: dispatched (haiku — brief carries complete code) — BASE 2963013
Task 4: implemented (commit 7d1993b, 30/30). Review: spec PASS, quality Approved, but TWO
  Important false-positive findings, demonstrated empirically:
    - PERSONA_VOICE fires on descriptive prose: "roles such as the Architect, Developer" and
      "commonly known as the Architect" both trip SEP3. Regex matches the bare substring
      "as the <Role>" under re.I, with no clause-boundary requirement.
    - NUMBERED fires on "2026. Roadmap for next quarter" (a date read as a step) and on
      numbered citation lists.
  Both regexes are PLAN-MANDATED (verbatim from the plan), so the conflict is mine to settle.
  Ruling: the findings win over the plan text, decisively. These regexes run against ~47 real
  content files in Tasks 13-15. A linter that flags "roles such as the Architect" gets switched
  off by the team inside a week, and switching it off removes the ONLY mechanical guarantee
  behind the framework's central claim. A false-positive-prone linter is worse than none
  because it discredits the rule it enforces.
  Fix: (1) PERSONA_VOICE requires clause-initial "As the <Role>" — start of line or after a
  sentence terminator, case-sensitive on the capital A — which excludes mid-sentence "such as
  the". (2) NUMBERED restricted to 1-2 digit numbers, killing 4-digit year false positives.
  Accepting that any numbered list in an AGENT still flags: that is the intended design stance
  (agents carry prose judgment; enumerated structure belongs in skills), and it will be
  documented rather than silently tolerated.
  Cost if wrong: a persona-voice violation written as "as the Architect" mid-sentence would be
  missed. Judged far cheaper than the linter losing credibility.
Task 4: minor (deferred): an unterminated code fence leaves its content unstripped.
Task 4: note: implementer self-review claimed "Potential Risks (None Found)" — contradicted by
  the reviewer's direct testing. Self-grading confirmed unreliable; reviews are earning their seat.
Task 4: fix round 1/5 (2 addressed, 1 NEW open — commits 7d1993b..88dca99)
  Both original false positives ADDRESSED; the citation-list ruling was honoured exactly.
  NEW Important breakage introduced BY the fix: PERSONA_VOICE anchors on bare `^`, so a
  violation written as a list item — `- As the Architect, weigh...` — no longer matches,
  because the line starts with "- " not "A". The pre-fix regex caught it. This matters
  because skills write their Rules sections as bullets by convention, so the most likely
  real-world phrasing of the violation is now the one that slips through silently.
  My over-tightening checklist missed this case; the re-reviewer found it by reading the
  anchor against the test suite's own bulleted fixtures. Exactly the failure the review
  seat exists for, and the second time a reviewer has beaten my own adversarial list.
  Ruling: widen the anchor to `^[\s>*+-]*` so it mirrors NUMBERED's `^\s*` and tolerates
  list markers and blockquotes. Cost if wrong: a leading-punctuation form I have not
  imagined still slips; bounded and detectable once real content exists.
  Ruling: restore case-insensitivity for the ROLE NAMES only, via an inline `(?i:...)`
  group, keeping `As` case-sensitive. Dropping re.I wholesale was a side effect nobody
  intended — it made `as the architect` unmatchable even when clause-initial.
  Cost if wrong: none; role names are proper nouns either way.
Task 4: fix round 2/5 (2 addressed, 0 open — commits 88dca99..c680e43). Re-reviewer verified
  the full 11-case matrix BY EXECUTION and reasoned about why the widened class is safe: it
  contains no letters, so it cannot skip "such " to reach a lowercase "as", and `As` stays
  case-sensitive. Round 1's false-positive fixes are not reopened.
Task 4: complete (commits 2963013..c680e43, review clean) — 38/38 tests
Ruling (pre-empting Task 5): same gap class, third occurrence. `readState()` returns a fresh
  state when state.json is ABSENT (distinct from corrupt, which must throw), and
  `readEvents()` returns [] when events.jsonl is absent. Neither defensive path is tested by
  the plan's 7 cases, and both are on the resumability path the spec calls load-bearing.
  Carrying explicit instructions. Cost if wrong: two extra tests.
Task 5: dispatched (haiku — brief carries complete code) — BASE c680e43
Task 5: implemented (commit 96e0a78, 10/10). Review: spec PASS, but 1 CRITICAL + 2 Important.
  CRITICAL: `Object.freeze(LANES)` is shallow, so the per-lane `gates` arrays stay mutable and
  `gatesForLane()` returns the live internal reference. Reviewer proved it: push to the returned
  array and the NEXT call to gatesForLane returns the polluted list. Seven downstream tasks
  consume this; one careless caller silently corrupts gate enforcement for the whole process.
  This is plan-mandated code (verbatim from the plan) — the defect is mine.
  Ruling: deep-freeze each lane's gates array at definition. Chosen over returning .slice()
  because a frozen array fails loudly on mutation in strict mode rather than silently accepting
  a write to a throwaway copy, and it costs no per-call allocation.
  Cost if wrong: a caller wanting to extend a gate list must spread it; that is the correct
  idiom anyway.
  Ruling (answering reviewer question 1): fix NOW, before Tasks 6-12 consume it. Fixing after
  seven tasks build on it means auditing seven call sites instead of one definition.
  Ruling (answering reviewer question 2): type validation IS in scope. readState currently
  checks key PRESENCE only, so {"phase":"three","stale":null} passes and downstream
  `state.stale.length` throws far from the cause. Spec Review Focus item 3 requires failing
  loudly WITH THE OFFENDING KEY; presence-only checking does not deliver that.
  Cost if wrong: slightly stricter than the plan asked; a legitimate state shape I have not
  anticipated could be rejected — but the shape is fully specified, so that risk is small.
  Ruling: wrap readEvents' per-line JSON.parse and raise a clear error naming the bad line,
  matching state.js's deliberate throw-on-corrupt design. A truncated final line (process
  killed mid-append) currently throws a raw SyntaxError from the telemetry the spec calls
  load-bearing. Cost if wrong: none.
Task 5: minor (deferred): appendFileSync single-writer assumption is undocumented.
Task 5: minor (deferred): LANES.hotfix carries `deferred`/`mandatory` keys no code reads yet
  (plan-mandated, shape inconsistent with the other three lanes). Final-review triage.
Task 5: fix round 1/5 (3 addressed, 0 open — commits 96e0a78..c239ba0). Re-reviewer confirmed
  the freeze covers ALL FOUR lanes (not just the one I spot-checked) and that ALL_GATES stays
  frozen; traced all 9 over-tightening cases — every legitimate state still accepted, every
  malformed one rejected naming the offending key. gates plain-object check handles the null
  and array edge cases correctly.
Task 5: complete (commits c680e43..c239ba0, review clean) — 18 node + 38 python tests
Task 5: minor (deferred, FINAL-REVIEW TRIAGE): readState's REQUIRED presence loop runs
  `key in parsed` before any type check, so a state.json containing top-level `null` or an
  array throws a raw TypeError instead of StateError. Same defensive path the fix round just
  hardened, found outside the fix diff so it did not extend the loop. This is the third
  distinct hole in that one function; worth one consolidated pass at the end rather than
  another round now.
Task 5: minor (deferred): events.js throws bare Error, not a named class like StateError.
Ruling (carrying pre-flight decision into Task 6): the capability table must live in
  registry/capabilities.json and be READ by cli/lib/capabilities.js, not hardcoded there.
  Task 16's build_adapters.py reads the same file. This is the pre-flight ruling on the
  JS/Python duplication; Task 6 is where it has to land, so the brief is superseded on this
  point. Cost if wrong: one extra file and a read path.
Ruling (pre-empting Task 6): the dispatcher's own failure paths are untested by the plan --
  unknown command and no command must each exit 1. Carrying explicit instructions.
Task 6: dispatched (sonnet — supersedes brief on capabilities source) — BASE c239ba0
Task 6: review clean — spec PASS, quality Approved, all 5 named risks resolved by inspection.
  registry/capabilities.json verified value-for-value against the brief table (no silent change
  to what the framework claims about harness support). CAPABILITIES is deep-frozen: array AND
  each element, correctly avoiding the Task 5 shallow-freeze bug.
  Controller ruling on the single-source capability table landed exactly as intended.
  Process error (mine): task-6-brief.md was never generated -- I pre-made briefs only for 2-5.
  The implementer recovered by reading the plan section directly, which the skill explicitly
  avoids (subagents should never get the whole plan). No drift resulted; the reviewer checked.
  Briefs for 6-12 now all generated, so the gap cannot recur.
Task 6: complete (commits c239ba0..896b9b3, review clean) — 24 node + 38 python tests
Ruling (pre-empting Task 7): `init` creates directories BEFORE copying templates, so a missing
  or unreadable template leaves a half-built delivery/ behind -- and the next `init` refuses
  because delivery/ now exists. A failed init would make the repo permanently
  un-initialisable without manual rm. Instructing a preflight check that every template is
  readable before any directory is created. Cost if wrong: one extra stat pass at startup.
Task 7: dispatched (sonnet) — BASE 896b9b3
Task 7: implemented (commit 5b32826, 31/31). Review: spec PASS, quality Approved, 1 Important.
  Controller ruling verified implemented completely: preflight covers every template the copy
  loop later writes, and the delivery/-exists guard correctly runs BEFORE the preflight (the
  more useful error when both conditions hold).
  Reviewer settled the changes/ .gitkeep question with reasoning rather than guesswork: git
  materialises parent directories through tracked file paths, so committing
  changes/archive/.gitkeep forces changes/ to exist on clone. Non-finding; Task 8 needs no
  implicit-create fallback.
  Important: findUnreadableTemplate uses accessSync(R_OK), which passes for DIRECTORIES. A
  directory-shaped template would clear preflight, directories would be created, and
  copyTemplate's readFileSync would then throw EISDIR -- reproducing exactly the half-built,
  un-reinitialisable delivery/ my ruling existed to prevent.
  Ruling (answering reviewer's question): fix NOW, not as follow-up. The fix is one statSync
  isFile() call. A ruling whose promise is not actually delivered is worse than never having
  made it -- it creates false confidence in a guarantee that has a hole. Low likelihood does
  not justify leaving a named hole in a named guarantee when the cost is one line.
  Cost if wrong: none identified.
Task 7: minor (deferred): mkdirSync is not rollback-safe against OS-level faults (disk full,
  permissions). Different failure class from the packaging omission the ruling targeted;
  transactional directory creation was never in scope. Accepted as-is.
Task 7: fix round 1/5 (1 addressed, 0 open — commits 5b32826..720be3f). statSync sits inside
  the existing try/catch, so the directory fix did not break the absent-file path; applied to
  every template, not just the first; test uses a real mkdir+rename, not a mock; RED output
  showed the genuine EISDIR-after-partial-tree failure.
Task 7: complete (commits 896b9b3..720be3f, review clean) — 32 node + 38 python tests
Controller note: I created a stray delivery/ in the repo root during a smoke test (ran init
  before cd-ing). Untracked, removed before any commit. Root cause: this CLI writes into its
  cwd, and the repo that BUILDS the framework must never be a repo that CONSUMES it. Warning
  now carried in implementer and reviewer dispatches.
Ruling (pre-empting Task 8): `propose <name>` passes the name straight to changeDir() with no
  validation, so `propose ../../evil --lane full` would create a change directory OUTSIDE
  delivery/ -- a path-traversal write driven by user input. The plan never validates the name.
  Instructing a safe-slug check (lowercase alnum, dot/underscore/hyphen, must start
  alphanumeric) with rejection otherwise. Cost if wrong: an exotic but legitimate change name
  gets refused; the fix is to widen one regex.
Ruling (pre-empting Task 8): `--lane` supplied as the final argument with no value yields
  argv[i+1] === undefined and reports "unknown lane 'undefined'". Instructing a distinct,
  readable error for a missing lane value, plus tests for no-name and no---lane.
Task 8: dispatched (sonnet) — BASE 720be3f
Task 8: implemented (commit 71d0e0b, 42/42). Review: spec PASS, both rulings correct, 1 Important.
  Ruling 1 (path traversal) verified complete: reviewer tested leading -/., empty, all-dots,
  uppercase, trailing space, Unicode homoglyphs, and a..b -- no gap. Controller independently
  confirmed 4 hostile names blocked incl. a write aimed at a canary dir outside the tree.
  Ruling 2 (missing lane value) correct, with a test asserting the NEGATIVE (that the old
  "unknown lane 'undefined'" message does not appear).
  Important: propose.js lacks init.js's template preflight. Reviewer assessed the trap as
  structurally identical -- partial write, then the duplicate guard blocks the retry -- with a
  smaller blast radius (per-name, not repo-wide) but the same root cause recurring on every
  name and littering delivery/changes/ with debris. The implementer raised this itself, and
  raised it accurately.
  Ruling: apply the preflight, but EXTRACT it rather than copy it. init.js already has
  findUnreadableTemplate; duplicating that logic into propose.js is the verbatim-duplication
  the review rubric treats as a defect, and Task 12 (archive) may want it too. Move it to
  cli/lib/templates.js and have both commands call it.
  Cost if wrong: one more lib module; the alternative is two copies drifting apart.
Task 8: minor (deferred): no length cap on the change-name slug, so an extremely long name
  raises an uncaught ENAMETOOLONG instead of exiting 1 cleanly.
Task 8: fix round 1/5 (1 addressed, 0 open — commits 71d0e0b..7000243). Extraction verified
  faithful line-by-line against the pre-fix init.js copy; init's error message byte-identical;
  local copy fully removed (no duplication left); helper signature general enough for Task 12;
  preflight correctly ordered after the duplicate check and before mkdirSync.
Task 8: complete (commits 720be3f..7000243, review clean) — 43 node + 38 python tests
Controller note: two of my own verification commands were buggy this round -- `$?` after a
  pipe reported head's status not node's, and a temp copy omitted package.json so cli/index.js
  failed at require. Both briefly looked like real defects. Caught by re-measuring. The same
  sloppiness inside a REVIEWER's method would have produced a false finding instead of a false
  alarm, which is an argument for reviewers showing their commands, not just their conclusions.
Ruling (pre-empting Task 9): status has three untested display paths -- the stale-artifact
  branch, gates carrying pass/fail/waived rather than all-pending, and a state whose `lane` is
  a valid STRING but not a known lane (hand-edited state.json), where gatesForLane throws and
  the user sees a raw dispatcher error rather than guidance. Instructing coverage for all
  three. Cost if wrong: three extra tests on display logic.
Task 9: dispatched (haiku — brief carries complete code) — BASE 7000243
Task 9: review clean — spec PASS, quality Approved, 2 cosmetic Minors only. All three
  instructed additions verified genuine (each would fail if its behaviour were removed), and
  the invalid-lane guard is correctly ordered AFTER the no-active-change early return, so a
  fresh repo with lane:null still reports "no active change" rather than "invalid lane 'null'".
  Controller independently confirmed status is read-only (state hash unchanged, no events file)
  and that the corrupt-lane message is actionable.
Ruling (answering reviewer's hidden-gate-verdict question): ACCEPT AS-IS, do not spend a round.
  A verdict recorded for a gate outside the current lane is invisible in `status`, which sits
  awkwardly beside spec 5.2's "a skipped gate is always recorded, never silent". But Task 10
  refuses to record an out-of-lane gate at the WRITE path, and v1 ships no lane-change command,
  so the only way to reach this state is hand-editing state.json. Guarding the read path too
  would be defence in depth against a condition the write path already prevents.
  Cost if wrong: someone who hand-edits state.json sees an incomplete picture. Logged for
  final-review triage rather than fixed now.
Task 9: complete (commits 7000243..978e8c1, review clean) — 48 node + 38 python tests
Ruling (pre-empting Task 10): the waiver path accepts any string as --expires, so
  `--expires 2026-13-99` or a date already in the past is recorded as a valid waiver. Spec 5.2
  makes the expiry the entire control on a waiver -- an unparseable or past expiry means the
  waiver never expires in practice, which converts a temporary exception into a permanent one.
  Instructing format validation (YYYY-MM-DD, real calendar date) and rejection of past dates.
  Cost if wrong: a team wanting to backdate a waiver must edit waivers.md by hand.
Ruling (pre-empting Task 10): four untested paths -- no active change; --pass and --fail given
  together; re-recording a gate that already has a verdict; and a waiver on a gate outside the
  lane. Instructing coverage for all four.
Task 10: dispatched (sonnet — gate enforcement is the framework's teeth) — BASE 978e8c1
Task 10: implemented (commit 1bcfd82, 63/63). Review: spec PASS, expiry ruling correct and
  complete, but 3 Important + 1 Minor that interact.
  A) flagValue: the implementer disclosed this as "fails safely". The reviewer found the
     OPPOSITE case and it is worse: `gate G3 --waive --expires 2026-12-31` (an omitted reason,
     a realistic typo) SUCCEEDS, writing reason:"--expires" into waivers.md AND the event log,
     exit 0, no complaint. Succeeds-unsafely, producing a governance record with garbage
     content -- in the one command whose entire job is making governance real.
     Ruling: harden now, and extract. propose.js carries the same pattern; a hardened copy in
     one command and a soft copy in the other is worse than either. Move to cli/lib/args.js,
     reject a value that itself begins with "--". Cost if wrong: a legitimate value starting
     with -- must be passed differently; no such value exists in this CLI.
  B) stale never clears. Failing G6 then re-passing G6 leaves stale untouched forever, so
     `validate` would block permanently and the fail->rework->re-run->pass loop the implementer
     cited to justify re-recording has no second half. This is a hole in MY plan: spec 5.3
     defines how stale is SET and never how it clears.
     Ruling: gate.js owns clearing -- the thing that sets stale clears it. Recording gate X as
     pass or waived removes gate:X from the stale set. Cost if wrong: if a later task wants
     richer rework semantics it supersedes this; the alternative is a framework that deadlocks
     after one failure.
  C) A waiver reason containing "|" corrupts the waivers.md markdown table unescaped.
     Ruling: escape pipes rather than reject the reason -- refusing a legitimate sentence
     because of punctuation is user-hostile. Reject embedded newlines, which cannot be escaped
     into a single table row.
  D) Minor->IMPORTANT once B lands: stale marking uses ALL_GATES.slice(idx), not the lane's
     gates. On express, failing G6 marks G8/G9 stale -- gates that lane never enforces, so they
     can never re-pass, so those entries could never clear even after fix B. The reviewer called
     this "moot only because nothing clears stale at all"; fixing B removes the moot.
     Ruling: mark stale only within the current lane's gate set.
Task 10: fix round 1 landed (commit 8ee0507) — findings A-D applied, 69/69, propose's 11 tests
  unchanged after the args.js extraction. Implementer also root-caused a PRE-EXISTING flake.
CONTROLLER-CONFIRMED FLAKE (load-bearing, fixing before Task 11):
  Reproduced 2 failures in 8 default `npm test` runs; 0 in 3 serialised runs.
  Root cause: the directory-swap tests I instructed in Tasks 7 and 8 mutate the repo's REAL
  templates/ tree via renameSync (init.test.js:50,67 and propose.test.js:120). node:test runs
  test FILES in parallel, so while init.test.js has templates/delivery/project.md moved aside,
  a concurrent propose.test.js -- which calls init.run() as fixture setup -- fails.
  This is my defect: I asked for real-filesystem swap tests without noticing they mutate global
  shared state. A ~25% flaky suite is worse than a failing one, because every later task's test
  evidence and Task 17's CI become untrustworthy and people learn to re-run until green.
  Ruling: do NOT paper over it with --test-concurrency=1. That hides the race, slows CI, and
  leaves the tests still capable of corrupting the repo's templates/ if one crashes mid-swap.
  Instead add the minimal seam for testability: init.js and propose.js resolve their templates
  directory from an env override, defaulting to the shipped path. Tests copy templates/ to a
  temp dir and point the override there, so no test ever mutates the real tree. Safe under
  parallelism because node:test gives each test FILE its own process.
  Cost if wrong: one env var of surface area, which also happens to let a team point the CLI
  at customised templates -- a plausible future want, not the reason for the change.
Task 10: fix round 2/5 (5 addressed across rounds 1-2, 0 open — commits 1bcfd82..1bb09f4).
  Re-reviewer traced B+D end to end on express: fail G6 marks [G6,G7]; pass G6 clears G6;
  pass G7 clears G7; stale reaches []. Also traced re-fail-twice, waive-after-fail, and
  upstream-refail-cascading — no stranded-entry sequence found. Event integrity preserved:
  exactly one event per decision with `previous` captured before the overwrite.
  Controller independently confirmed 0/12 flaky runs and a clean repo after all 12.
Task 10: complete (commits 978e8c1..1bb09f4, review clean) — 69 node + 38 python tests
Controller process error: I pointed the re-reviewer at review-1bcfd82..1bb09f4.diff, which did
  not exist -- I had generated the round-1 diff while HEAD was still 8ee0507 and sent output to
  /dev/null. The reviewer noticed, verified by reading HEAD files directly, and said so rather
  than quietly reviewing the wrong artifact. Diff has now been regenerated for the record.
LOAD-BEARING FINDING (out of scope for Task 10, carried forward):
  spec 5.2 says hotfix requires "G2 retroactive within 48h; G9 postmortem mandatory", but
  gatesForLane("hotfix") returns only [G6,G7]. Since Task 10 refuses any gate outside the
  lane's set, `gate G9 --pass` and `gate G2 --waive` on a hotfix change are both REFUSED.
  The lane's own mandatory:["G9"] and deferred:["G2"] keys -- flagged as unused data back in
  Task 5 -- describe gates the command actively blocks. The hotfix lane cannot satisfy its own
  spec.
  Ruling: hotfix's enforced gates become ["G2","G6","G7","G9"]. All four ARE required by the
  spec; they differ only in timing, which is exactly what deferred/mandatory document. This
  resolves both blocks and turns previously-dead metadata into meaningful data.
  Cost if wrong: hotfix changes must record two more gates than the terser reading of the
  lane table implied. The alternative is a lane whose mandatory postmortem is unrecordable.
  Carried into Task 12's dispatch (archive is what emits G9). Task 18 must update the deck
  and README lane tables to match.
Task 11: implemented (commit f87359a, 73 JS + 46 py). Review: spec FAIL (1 standing-requirement
  gap), 1 Important, 2 Minors, 1 controller question.
  Spawn handling was judged MORE careful than the brief's own code: named per-script errors,
  stderr surfaced, and status===null (killed by signal) correctly distinguished from 0 rather
  than read as success. That last one is the failure I most wanted checked -- "the validator
  did not run" silently becoming "the validator passed" would be the worst outcome for a
  compliance tool.
  Important: non-UTF-8 spec.md/tasks.md raises a raw UnicodeDecodeError.
  Ruling: fix. The implementer scoped it out against the BRIEF, which was defensible, but the
  SPEC's standing requirement is unconditional -- "validators must report the file and line
  with a readable message, never raise a traceback" -- and explicitly binds every validator.
  Task 2 already fixed this exact class in frontmatter.py, so this is a known defect
  reintroduced, not a new judgement call. "Loud rather than silent" was never the bar.
  Cost if wrong: none; it strictly widens what the validator can survive.
Ruling (answering reviewer's question on the two Minors): ACCEPT both as scoped limitations,
  but pin them with tests so they are visible rather than folklore.
  - T2's AC attribution is document-order-dependent: a spec listing all REQs then all ACs
    misattributes every AC to the last REQ. The shipped spec template nests ACs under their
    REQ, so conforming documents are unaffected; the failure is a loud false positive, not a
    missed orphan.
  - The 4-line Implements: window misses a citation on line 5, producing a false-positive T1.
    Same reasoning: loud, and the shipped tasks.md template puts Implements: directly beneath
    its task line.
  Both are the plan's literal reference code. Re-architecting parsing now, with 7 tasks still
  to land, buys less than it risks. Cost if wrong: a team writing specs in an unconventional
  layout sees spurious findings; Task 18 documents the required structure.
Task 11: fix round 1/5 (3 addressed, 0 open — commits f87359a..65e4b03). T0 rule added for
  unreadable files, wired into BOTH read sites, no traceback, exit 1 preserved; empty/absent
  tree still returns [] (OSError widening did not create a false finding). Re-reviewer judged
  the T0+T3 cascade informative rather than confusing: T0 names why the spec was ignored, T3
  surfaces the resulting orphans. Limitation tests verified to pass unmodified against the
  STASHED pre-fix parser -- proof they pin behaviour rather than document a change.
Task 11: complete (commits 1bb09f4..65e4b03, review clean) — 73 node + 50 python tests
Ruling (pre-empting Task 12, GOVERNANCE HOLE): the plan's `archive` folds deltas, emits an
  insight and clears the change -- without ever checking the gates. So any change can be
  archived with gates failed, unrecorded, or stale artifacts outstanding. That makes the
  entire gate system bypassable by simply archiving, which would reduce lanes and gates to
  decoration -- the exact failure the framework exists to prevent.
  Ruling: archive REFUSES when any gate in the change's lane is not pass-or-waived, or when
  stale artifacts remain, naming what is outstanding and how to resolve it. Gates must bind at
  the exit or they do not bind at all.
  Cost if wrong: a team wanting to abandon a change needs a different verb than archive;
  worth adding later if asked. Silent bypass is the worse failure.
Ruling (pre-empting Task 12): `archive <name>` clears state.change unconditionally, so
  archiving change B while change A is active wipes A's lane, phase and gate verdicts.
  Instructing that archive only clears state when the archived change IS the active one.
Ruling (carried from Task 10): hotfix lane gates become ["G2","G6","G7","G9"] so the lane can
  satisfy its own spec. Task 12 is where it lands, since archive is what emits G9.
Task 12: dispatched (sonnet) — BASE 65e4b03
Task 12: implemented (commit dc1d269, 86 JS + 50 py). Controller verified: archive REFUSES
  with outstanding gates and names each one; after satisfying express's G2/G6/G7 it archives to
  a date-stamped folder; hotfix lane now returns [G2,G6,G7,G9] per ruling A.
LOAD-BEARING HOLE the implementer disclosed and I confirmed:
  `propose y` while change `x` is still active SUCCEEDS and overwrites state.change to y.
  x's lane, phase and gate verdicts are gone from state. Ruling C then means archive will not
  reset state for a non-active change, and Ruling B means archive needs that change's gates to
  evaluate it -- which no longer exist. So x becomes permanently un-archivable through the CLI.
  My rulings B and C did not create this; propose's unconditional overwrite did. But they turn
  a silent state loss into a dead end, which is how it surfaced.
  Ruling: `propose` REFUSES when a change is already active, naming it and directing the user
  to archive it first. state.json carries a single `change` field -- one change in flight is
  the model the data structure already implies, and it should be enforced rather than left
  accidental. Supporting concurrent changes needs per-change state, which is a v2 design.
  Cost if wrong: a team wanting two changes in flight is blocked until archive or an explicit
  abandon verb exists. Preferable to silently destroying a change's gate history.
  Note: Task 17's golden path proposes once per fresh temp repo, so it is unaffected.
Task 12: fix round 1/5 (4 rulings addressed, 0 open — commits 65e4b03..9f486d4). Reviewer
  traced archive's atomicity: every refusal path returns before the first write (cpSync), so a
  rejected archive changes nothing. Ruling B correctly treats `waived` as settled and both
  `fail` and absent as outstanding, with the stale check genuinely separate (proven by a test
  engineering all-gates-pass-but-stale via fail-then-repass). Re-archive collision refuses
  rather than overwriting history; delta-over-spec uses force:true per-path, correct since
  specs/ is the current truth being deliberately updated. Exactly one event, success-only.
  Fixture churn judged sound: the double-propose fixture was replaced with a direct writeState
  construction that still asserts the same invariant, not weakened.
  Reviewer answered my dead-code question better than the report did: ruling C's branch IS
  CLI-reachable without hand-editing -- a crash between propose's mkdirSync and its writeState
  leaves changes/<name>/ on disk with state.change not pointing at it. Legitimate defensive
  programming, and the report's "unreachable through the CLI" framing was too strong.
  Controller answered the reviewer's ⚠️: re-running `init` on an existing repo REFUSES
  (Task 7's guard), so init cannot reset state and strand a change directory. The crash-window
  argument above stands on its own.
Task 12: minor (deferred): archive's isLane(s.lane) guard is untested.
Task 12: minor (deferred): when a change is active AND a hostile name is supplied, propose
  reports the active-change message rather than the traversal message. Safe either way --
  nothing is written -- but the less informative of the two.
Task 12: complete (commits 65e4b03..9f486d4, review clean) — 89 node + 50 python tests
Task 13: implemented (commit 1c8fbf2) — 11 spine skills. lint_separation 0 findings;
  validate_manifests M5-only (expected until Task 14); python 50/50; npm 87/89 where the 2
  failures are the same M5 transient (validate.js lints the plugin root, so M5 makes `validate`
  exit 1). Implementer PROVED this by temporarily adding a probe agent -> 89/89, then deleting
  it. Good evidence rather than assertion.
Controller process error (third time): briefs 13-18 were never generated. All 18 now exist.
D2 — MATERIAL, controller-confirmed, blocks Task 17:
  validate_traceability.py reads REQs only from delivery/specs/**, never changes/*/specs/**.
  So a requirement a change INTRODUCES reports T3 "implements unknown REQ" from the moment a
  task binds to it until archive folds the delta in. That is the normal spec-driven workflow --
  propose, write delta spec with new REQs, write tasks implementing them -- so `validate` fails
  the common case. Reproduced.
  Worse: my own golden_path fixture writes the spec to BOTH delivery/specs/ AND the change
  delta, so Task 17 would have passed while the real workflow failed. A fixture that papers
  over the defect it exists to catch.
  Ruling: trace_findings must gather REQs from delivery/specs/**/spec.md AND
  delivery/changes/*/specs/**/spec.md. A change's delta spec is proposed truth and counts for
  traceability during the change's life. AND the golden-path fixture must write the spec ONLY
  to the change delta, so it exercises the real path.
  Cost if wrong: a REQ defined only in an abandoned change delta would count as known until
  that change is removed. Far cheaper than validate failing every legitimate new requirement.
D1 — accept the implementer's resolution: `standard` cannot record G4 (fixed gate set, and
  `gate` refuses out-of-lane), though spec 5.2 says "G4 only if data/ML touched". Its
  lane-selection skill therefore routes any data/schema/model change to `full`. That resolves
  the contradiction cleanly without inventing conditional gates, which would break the binary
  pass/fail/waived model. Task 18 updates the spec's lane table to match.
D3 — accept as correct: a --fail marks the failed gate itself stale as well as downstream. The
  failed gate genuinely does need rework, and recording it pass/waived clears its own entry.
D4 — minor (deferred): waivers.md's "Approved by" column is never populated by the CLI.
Minor (deferred, FINAL-REVIEW TRIAGE): validate.test.js's success path runs `validate` against
  the plugin root, coupling a unit test to the repo's own content completeness. Expected to go
  green at Task 14, but the coupling is brittle by design.
Task 13: content review (opus) — verdict "yes-with-fixes". Pattern judged worth propagating:
  uniform seven-section structure, rules overwhelmingly imperative, anti-patterns consistently
  wrong-example-plus-correction, CLI facts near-perfect (every lane gate set, archive's
  precondition, expiry rules, event shape verified accurate).
CRITICAL — and it is MY sequencing error, not the implementer's:
  navi-skill-traceability documents the D2 limitation as a "Known limitation", with two
  workaround greps, a T3 decision row, and an eval whose expected answer is
  "delta spec not scanned". All false as of commit 76bba4d, where SPEC_GLOBS became
  ("specs/**/spec.md", "changes/*/specs/**/spec.md").
  Cause: I dispatched Task 13 and the D2 fix in overlapping windows. The implementer read the
  code, found the real limitation, and documented it accurately -- then I changed the code
  underneath it. It documented truth; I invalidated it.
  Lesson recorded: do not dispatch a content task that documents code while a fix to that code
  is in flight. Sequence them, or tell the author what is changing.
  Ruling: correct the skill and its eval to describe current behaviour. The eval is the more
  dangerous half -- an eval that rewards the wrong answer trains the wrong behaviour.
IMPORTANT — no legal exit from a change that must switch lanes:
  lane-selection rule 7 and change-proposal both prescribe "archived or abandoned", but there
  is no abandon command (init·propose·status·validate·gate·archive·doctor) and archive refuses
  while any lane gate is unsettled. The likeliest real scenario -- the standard->full discovery
  that gates.md itself names -- has no documented way out.
  Ruling: for v1 the legal exit is waive-then-archive, documented precisely, with a required
  reason form naming the abandonment and any superseding change. That keeps the escape
  auditable (waivers need a reason and a real future expiry and are logged) rather than adding
  a command late in the run. Log `abandon` as a v1.1 convenience in the spec's open questions.
  Cost if wrong: abandoning a change costs several waiver records; they are the audit trail.
PRESERVE as the reference for Tasks 14-15 (reviewer's judgement, and I agree):
  - gates.md's "Known gap: G4 on the standard lane" -- a skill naming where its own spec and
    code disagree, which wins today, and what to do meanwhile.
  - phase-gate-protocol's Template: a real CLI transcript with the correct stale count, not a
    shape.
  - The two-axis negative eval convention: neg-1 a vocabulary collision ("trace this stack
    trace"), neg-2 a sibling skill's job. Make this MANDATORY for the remaining 27.
Controller note: my plan's arithmetic was wrong twice -- "11 spine skills" counted gates.md as
  a directory (10 skills is correct), and Task 15 owes 27 skills, not the 26 the plan states.
Task 13: fix round 1/5 (5 findings + 3 minors addressed, 0 open — commits 1c8fbf2..777fedd).
  Re-reviewer verified the REPLACEMENTS against source, not merely that the wrong text was
  gone: new Rule 9, T3 row and Validation section all match validate_traceability.py and
  archive.js. Author found a 5th bogus eval the review missed, withdrew its own first attempt
  at F4 on sound reasoning, and unprompted normalised all ten evals.json to one style after
  noticing its edits had introduced a second convention that would have spread to 27 files.
Task 13: complete (commits 9f486d4..777fedd, review clean) — 10 spine skills + gates.md
Task 13: minor (deferred, FINAL-REVIEW TRIAGE): traceability is enforced only by CONVENTION --
  `gate --pass --evidence <file>` accepts any file, so nothing forces `validate` to have run.
  Making `archive` run validate would close it, but that is scope expansion with 5 tasks left
  and archive already enforces the gate discipline that matters most. Logged, not fixed.
Ruling (SEQUENCING, supersedes the plan for Task 14): the plan has Task 14's agents declare
  their FULL v1 skills lists, with Task 15 making the missing 27 resolve. That would leave M4
  firing for 27 absent skills across Tasks 14-15, and since validate.js lints the plugin root,
  `npm test` would stay red for three consecutive tasks -- during which NEW breakage becomes
  undetectable against the noise.
  Ruling: Task 14's agents reference ONLY the 10 skills that exist. Task 15 authors its 27
  skills AND extends the agents' skills lists in the same task, so both M4 (agent->skill) and
  M5 (skill->agent) stay clean at every commit and the suite returns to green now.
  Cost if wrong: Task 15 edits 10 agent files it would not otherwise touch. Worth it to keep a
  green baseline, which is the only thing that makes a red run informative.
Ruling: bidirectional agreement must be checked by hand in Task 14 -- validate_manifests' M4
  checks agent->skill and M5 checks skill->agent-existence, but nothing verifies that a skill's
  `used_by_agents` matches the agents that actually list it.
Task 14: implemented (commit c58cca1) — 10 agents. lint_separation 0; validate_manifests 0
  across 20 files (M4 AND M5 clean); npm 89/89 GREEN (suite recovered, confirming the
  sequencing ruling); python 55/55. Controller independently re-derived the bidirectional
  agent<->skill invariant in a throwaway script: 0 mismatches.
  Two used_by_agents widenings, both reasoned: traceability += product-owner/devops/mlops
  (it owns the SLI->INSIGHT tail at phases 8-9); human-checkpoints += business-analyst (owns
  G2, which spec sign-off precedes, and must not self-approve).
  Self-review caught TWO rules-in-disguise pre-commit -- QA flakiness thresholds and an MLOps
  provenance deadline, the second of which competed with an existing rule in
  navi-skill-human-checkpoints. That is precisely the failure lint_separation cannot see, found
  by the author re-reading its own work. Worth noting as evidence the instruction landed.
Ruling (acting on the implementer's concern 1): ADD rule M7 to validate_manifests.py --
  a skill's `used_by_agents` must equal the set of agents whose `skills:` list names it.
  Nothing checks this today; I verified it by hand, and a hand-verified invariant is exactly
  what this framework says not to rely on. Its own thesis is that invariants are mechanically
  enforced rather than trusted, so leaving this one on trust would be the framework failing
  its own standard. It is also load-bearing for Task 15, which edits BOTH sides for 27 skills
  across 10 agents -- by far the most likely place for the two to silently diverge.
  Cost if wrong: one more rule to satisfy; it encodes an invariant that already holds.
Carried into Task 15 (implementer's concern 2): five agents currently hold only the four
  universal lifecycle skills. Task 15 must REWRITE their Skill invocation plans, not merely
  append names to `skills:` -- an invocation plan that does not mention a skill the agent
  holds is the separation law decaying quietly.
Carried into Task 16 (implementer's concern 4): navi-agent-orchestrator has `owns_gates: []`
  by design -- it enforces gates, the owning persona records them. build_adapters.py must
  tolerate an empty list rather than assuming every agent owns at least one gate.
Carried into Task 18 (implementer's concern 5): spec gaps to reconcile -- orchestrator gate
  ownership unspecified; G4/G7/G8/G9 co-owners indistinguishable in events.jsonl; QA's phase-2
  consultation missing from the §4.2 roster row.
Task 14: content review (opus) — "yes-with-fixes". Separation law holds in spirit; one voice
  across 950 lines; zero hits for "balance"/"weigh"/"as appropriate"/"when uncertain". The
  mediocre-but-passable halves were called the task's standout achievement and are now the
  explicit quality bar for Task 15.
  EIGHT more rules-in-disguise found (author found 2 and stopped). Reviewer's structural
  insight, which is the valuable part: "Working agreement -> Guarantees downstream" has become
  an unpoliced rule sink, because the linter reads it as prose. Carrying an explicit
  prohibition on "no X without Y" constructions into Task 15's brief.
  Ruling: fix all eight. This is the framework's central claim; eight quiet breaches is how a
  separation law dies -- not one obvious violation but a dozen sentences that each look like
  judgment and each encode a rule.
  Ruling on G5: THREE claimants is CORRECT -- spec 5.1 line 279 reads "Build | G5-BUILD |
  Developer / Data / ML". The defect is narrower than the reviewer framed it: frontmatter says
  [G4,G5] while the description text emphasises G4 only, so the same file disagrees with
  itself. Fix the prose to match, and say plainly that G5 is co-owned.
  Ruling on QA lifecycle_phases [2,6]: spec 4.2 gives QA phase 6. `lifecycle_phases` carries no
  owns/consulted distinction, so listing 2 silently claims ownership. Drop the 2; keep the
  prose about being consulted at Phase 2. Task 18 adds the consultation to the spec roster row
  (already carried from Task 14's own concern 5).
  Ruling: MLOps owns G7/G8 alongside DevOps but holds no waivers skill while DevOps does. Add
  it -- same gates, same need; a model-bearing release needing a waiver currently has no skill
  to reach for.
  Ruling: DEFER M8 (every gate claimed by >=1 agent, union covers G1-G9). M7 earned its place
  by protecting Task 15's bidirectional edits; M8 guards gate coverage, which Task 15 does not
  touch, so its protective value here is low. Logged for final-review triage with the
  reviewer's sharper point: `owns_gates` is read by nothing and `gate.js` records no actor, so
  gate ownership is currently documentation rather than a property of the system.
Task 14: minor (deferred): gate IDs appear as "G2-SPEC" in descriptions and "G2" in
  owns_gates/lanes.js. Harmless today; a trap for future tooling that parses descriptions.
  Task 18 documents that G1-G9 are the IDs and the suffix is descriptive only.
Task 14: fix round 1/5 (5 findings + minors addressed, 0 open — commits 6063549..a8e69f2).
  Author found a NINTH instance the review missed: the orchestrator's "How I decide" carried
  the twin of the flagged escalation line plus a restatement of waivers rule 3 -- fixing the
  escalation alone would have left the same defect a paragraph below. Controller verified all
  six sampled phrases gone, G5 co-ownership stated in 3 agents, QA at [6], MLOps holding the
  waivers skill on both sides, bullets intact at 5-7 per agent, all linters 0, 89/89, python OK.
  M7 EARNED ITS PLACE ON FIRST USE: it caught the author's one-sided MLOps edit before the
  second half was made. That is precisely the divergence I added it to prevent, occurring in
  the very next edit after it landed.
LINTER BLIND SPOT (record for final review and Task 15):
  The author's first reflow attempt FLATTENED every Mental model bullet list into prose, and
  BOTH LINTERS STAYED GREEN. It was caught only by re-reading and reverted, with bullet counts
  verified against the prior commit and a word-level diff proving the rewrap changed no words.
  So lint_separation and validate_manifests together cannot detect structural destruction of
  agent content -- an agent could be silently reduced to undifferentiated prose and still pass
  every mechanical check the framework has. Worth a structural rule (section presence, list
  preservation) in a later version; logged, not fixed here.
Carried into Task 15 (author's concern): Finding 1 was eight instances of a defect the author
  had already found twice and believed cleared -- including one sentence it de-ruled in round 1
  and re-ruled in the same edit. The "no X without Y" heuristic caught seven of eight. Task 15
  gets it as an explicit reading pass over every "Guarantees downstream" paragraph.

================ SCOPE EXPANSION — 2026-09-30 ================
User added: pending skills; git skills; utility/integration skills (ADO/Jira sync, Confluence
write-back via MCP, security checks, package vulnerabilities); DevOps to be Azure-enterprise;
HTML page (skills/agents visualiser + download + demo manual, showing individual agents AND
the whole framework); observability incl. AgentObs/Opik/LangSmith; MCP connection configs;
optional cron JIRA/ADO -> branch -> PR; expanded docs; deck rebuild with brand; no version
bump until stable; README must not surface superpowers spec docs.
Decisions taken by the user:
  - Branding: fetch from navikenz.com. DONE -- real tokens extracted, not guessed:
    navy #051D60 (theme deliberately overrides Bootstrap --bs-blue, so it is genuine brand),
    ink #0D131F, slate #192954, cream #FAF3E7, sand #E4DED3, font Mulish, white wordmark SVG
    at assets/brand/navikenz-logo.svg. Nine other hexes rejected as Bootstrap defaults.
    Mulish is NOT installed locally -> HTML uses Google Fonts; the deck uses a metric-safe
    substitute with slack, because font-fit QA cannot be trusted on a font the renderer lacks.
  - Platform: ADO + GitHub + Jira (all three; skills must detect and support each).
  - Cron runner: standalone script + system cron.
  - Security Engineer becomes the 11th agent.
  - Sequencing: FINISH the framework (Tasks 15-18) first, THEN extend.
Ruling: the Security Engineer lands BEFORE Task 15, not after. The roster is framework
  structure, not an extension, and 27 skills are about to declare used_by_agents -- adding the
  persona afterwards means reopening all of them plus the M7 invariant on both sides.
  Cost if wrong: one extra agent authored before the content push; trivial to remove.
Controller gap being closed now: Task 14's fix round (a8e69f2) was verified by me but never
  given its scoped re-review, so Task 14 was never formally closed. Dispatching that first.
Task 14: cold read (opus, deliberately not told what was already fixed) found 15 more across
  8 of 10. Running totals by pass: 2 (author) -> 8+1 (review+author) -> 1+13 (section sweep)
  -> 15 (cold read). ~40 instances over five passes, with the count RISING as method improves.
RULING — STOPPING THE LOOP ON A DEFINITION, NOT A CAP:
  A count that rises with every better search is not a content problem, it is a definition
  problem. My spec 4.1 says "a sentence present in both belongs in the skill", and the test I
  handed reviewers was "could a reader comply mechanically". Both are wrong.
  - "Present in both" is unworkable: an agent must state what it escalates, and every
    escalation condition also lives in human-checkpoints. Taken literally, an agent may not
    state its own boundaries at all -- yet spec 4.1 ALSO lists "when I stop and ask a human"
    as agent content. The law contradicts itself.
  - "Could a reader comply mechanically" condemns all clear writing. "Favour reversibility"
    complies mechanically if you squint. A test that flags good prose is a broken test.
  The cold reader found this unaided: it excluded the five self-approval lines on the grounds
  that declaring one's own authority limit is agent content, then flagged that a stricter
  reading takes the tally to 20 across all ten. It was right to hesitate, and right to say so.
  OPERATIONAL DEFINITION (replaces the "present in both" test; goes into the spec and the
  agent-authoring guidance):
    A sentence in an agent is a rule in disguise when BOTH hold --
      (a) it tells the reader WHAT TO DO or WHAT AN ARTIFACT MUST CONTAIN, and
      (b) it adds no reason a skill does not already carry.
    A sentence that names a boundary the persona will not cross, or gives a REASON for
    choosing between permitted options, is judgment -- even when a skill also covers the
    mechanics. Agents may restate a constraint when they say WHY it binds them.
  Cost if wrong: some duplication survives between agents and skills. Judged far cheaper than
  a law nobody can satisfy, which is what five passes of rising counts actually demonstrates.
  Applying it ONCE, then closing Task 14. Classification:
    FIX (restatement carrying no added reason): orchestrator:61,63,76-79; architect:48-49;
      fullstack:70-71; devops:68-69; business-analyst:67-69; product-owner:83-85; qa:63-64.
    MOVE TO A SKILL (genuinely unowned -- these are the cold read's most valuable finding):
      fullstack:57-58 release-safety procedure; qa:66-67 release-report structure;
      data-engineer:84-85 two handoff fields handoff-protocol does not enumerate.
      All three are Task 15 content, not agent edits.
    KEEP as judgment under the new definition: the five self-approval lines;
      orchestrator:70-72 (declared refusal to simulate a decision); the three G5 co-ownership
      sentences; both Definition-of-good lists the reader judged descriptive.
Task 14: fix round 3/5 (9 fixed, 0 open — commit 56c009a). Six repaired by SUPPLYING the
  persona's missing reason, three deleted where no honest reason existed. Author's finding on
  the definition change, which validates it: "under 'could a reader comply mechanically' I was
  deleting reasons along with rules, because a good reason IS compliable -- that is what makes
  it useful. Under (a)+(b) the reason decides the case, so the repair is usually to supply what
  was missing." The old test was destroying judgment, not protecting it.
  It also resolved qa:84 better than either of us: it survives because it names a limit on the
  persona's own authority -- the same reason the five self-approval lines were never the defect
  they appeared to be.
Task 14: complete (commits 777fedd..56c009a, 5 rounds) — 10 agents, M7, 89/89, 62 python
Controller: spec 4.1's broken test replaced in the design doc itself (commit above), so Task 15
  and the final review inherit the workable definition rather than the unsatisfiable one.
THREE UNOWNED ITEMS -> TASK 15 (the cold read's most valuable output; each needs an owner):
  1. fullstack:57-58 flag-and-small-merge release procedure. Candidate owners
     `version-control-workflow` OR `progressive-delivery` -- ONE of them, not split, or the
     developer and DevOps end up reading different rules for the same merge.
  2. qa:66-67 proven/sampled/untouched release-report structure -> `release-readiness`,
     already a v1 skill.
  3. data-engineer:84-85 two dataset-handoff fields (how produced, what it is not fit for).
     handoff-protocol's envelope has no slot for them. Either `data-contracts` owns a
     dataset-handoff shape, or handoff-protocol gains the fields -- smaller, but amends a
     Task 13 skill. DECISION NEEDED at Task 15.
Task 14b: Security Engineer added (commit fdaaff9). lint 0 · manifests 0 across 21 files
  (M1-M7) · npm 89/89 · python 62. Phases [3,6]; owns_gates [G3,G6] co-owned; handoffs to all
  but MLOps, mirroring QA.
  IT CORRECTED MY BRIEF: I asserted "G3 and G5 are already co-owned" as precedent. Verified
  against commit 56c009a -- G5 was co-owned (data/ML/fullstack), G3 was the ARCHITECT ALONE.
  So this change makes G3 co-owned for the first time; it is a design decision, not precedent
  being followed. Accepted on its own merits: a design gate that never considers security is
  incomplete, and its reason for rejecting owns_gates:[] is sound -- the orchestrator's
  rationale (enforces, never records) does not transfer, and a persona that cannot record
  cannot block. But recorded as novel, because I gave it a false precedent to lean on.
  Its phase reasoning was better than my brief too: it declined Phase 7 because DevOps already
  owns release security via G7, and claiming it would repeat exactly the QA [2,6] over-claim
  that was corrected in Task 14.
CONCERN CONFIRMED BY CONTROLLER -- fixing now: gates.md names a single "**Owner:**" per gate
  and the word "security" appears NOWHERE in it. The agent tree claims security co-owns G3/G6
  while the gate definitions do not know the persona exists. That is the spec-vs-code drift
  this framework exists to prevent, found by the agent that created it.
  Ruling: gates.md must name co-owners and carry a security exit criterion on G3 and G6.
  A gate whose definition omits an owner cannot be satisfied by that owner.
Deferred (second concern, same class as the earlier owns_gates finding): co-owners are
  indistinguishable in events.jsonl, so G3 or G6 can pass with no security evidence at all.
  This is the third time the missing actor field has surfaced. Logged for final-review triage
  with the earlier M8/--as proposals; not fixed here.
Task 14b: gates.md fixed (commit ce84281). Controller verified all nine gates now name owners
  WITH navi-agent-* handles; security present; 0/0/89/62 green.
  The sweep proved the class was not unique, exactly as suspected:
    - G5 read "Developer, Data Engineer OR ML Engineer" while all three carry owns_gates:[G5].
      A substantive error -- the gate definition contradicted the roster. Now "and".
    - G5, G8, G9 named owners by ROLE with no handle, unreadable to Task 16's build_adapters.
    - G4, G7 used singular "**Owner:**" for two owners.
  Caught on its own re-read: G6 is enforced by EVERY lane, G3 is not, so G6's new criterion
  could not lean on a threat model that express/hotfix never produce. Worded to hold on all
  four lanes. That is the kind of cross-lane reasoning no linter reaches.
Task 14b: complete (commits 56c009a..ce84281) — 11 agents
CATALOGUE GAP CONFIRMED BY CONTROLLER: grepped the spec -- all three "dependency" hits are
  about zero-dependency POSTURE. Dependency/CVE scanning is absent from the 4.3 catalogue
  entirely, and `secure-coding` is listed but NOT marked [v1]. So G6 now requires a
  dependency-vulnerability check that no skill can produce, and the Security Engineer owns two
  gates with no security skill to hold.
  Ruling: Task 15 adds `navi-skill-dependency-vulnerabilities` (new, security discipline) and
  promotes `secure-coding` to v1. This is framework completion, not the user's extension
  list -- a gate that demands unproducible evidence is broken.
Ruling (SPLIT): Task 15 is ~29 skills. Task 13's TEN needed a full round plus a fix pass, and
  its brief warned against thinning later skills to finish. Splitting into three dispatches of
  comparable size to Task 13:
    15a architecture(4) + software-development(5 incl secure-coding) + security(1)  = 10
    15b data-engineering(3) + machine-learning(3) + mlops(2)                        = 8
    15c platform-devops(4) + quality-engineering(3) + product-mgmt(2) + BA(2)       = 11
  Each sub-task extends the agents' skills lists for ITS OWN skills, both directions, so M7
  and M5 stay clean at every commit rather than red across three tasks.
  Cost if wrong: three review cycles instead of one. Cheaper than 29 skills where the last
  eight are filler, which no linter would catch.
Task 15a: 10 skills (commit 9ba0b2a) — architecture 4, software-development 5, security 1.
  20 skills / 31 files; lint 0 · manifests 0 (M1-M7) · npm 89/89 · python 62.
  Self-review caught FOUR real defects before commit, the best of which was
  `gh pr view --json reviewThreads` -- a field that does not exist. Controller verified the
  fix: replaced with `gh api graphql` where reviewThreads IS a valid field on pullRequest.
  That command would have failed silently in every team following the skill. Also fixed a
  false-positive awk range in three validations, a rule contradicting its own template, and a
  vacuous `git log --merges` check under a squash policy.
  Release-safety passage taken by version-control-workflow (not split with progressive-delivery,
  as instructed); the agent sentence rewritten to keep judgment plus the reason it binds.
RULINGS on its four concerns:
  1. gates.md G6 names three dispositions; a scanner genuinely produces a fourth
     (`not-applicable` -- dev-only dependency, unreachable path). The skill added it with a
     Known gap note rather than unilaterally amending a Task 13 artifact. Correct restraint,
     and it is right. Ruling: 15b amends gates.md to carry the fourth disposition.
  2. G3 lists three evidence artifacts but `gate` accepts ONE --evidence path, AND a directory
     satisfies existsSync -- so `--evidence somedir/` passes with no content check whatsoever.
     That is a real hole in the gate the framework leans on hardest. CLI change, deep in a
     content phase. Logged IMPORTANT for final-review triage, not patched now.
  3. templates/change/design.md has no home for what G3 demands, so three skills append named
     sections. Accepted; ONE coordinated template amendment after 15c, not three piecemeal.
  4. Spec 4.3 lists `secure-coding` without [v1] and has no `security/` discipline at all, so
     brief and catalogue are out of step for 15b/15c too. Carried into both briefs; Task 18
     reconciles the catalogue to what was actually built.
Task 15b: 8 skills (commit cc6a55b) after a stall+resume. 28 skills / 39 files; all gates green.
  Stall recovery: work was intact on disk, uncommitted, mid-self-review. Controller verified
  soundness (0/0/89/62, M7 clean = bidirectional wiring correct) and handed that verification
  back rather than making it re-derive. Finished cleanly.
  Self-review found NINE real defects. The best two are worth recording because both are
  validators that would have LIED:
    - `awk -F': '` in the model-card/registry version cross-check returned empty silently --
      a false negative on the exact mismatch the check existed to catch.
    - `awk -F'|'` broke on escaped Markdown pipes, which the waivers skill itself introduces.
  Also a gawk-only 3-arg match() that fails on macOS, and a vacuous counter check. All 8
  Validation blocks then run against a fixture built from their own Templates, catching all 10
  injected violations. Verification, not assertion.
  Dataset handoff -> data-contracts owns the shape (`## Produced by` / `## Not fit for`, cited
  by DC-### in the envelope). handoff-protocol left unamended, reasoning: its rule 7 already
  admits concrete ids, and two dataset-specific fields would be empty for ten of eleven agents
  and enforced by nothing. Sound -- the smaller edit would have been the worse one.
  No thinning: 300-419 lines vs 15a's 222-321.
CONTROLLER-PROVEN GAP (third of its kind): spec 3.2 line 107 promises `ops/slo.md`, G8's exit
  criteria require `delivery/ops/slo.md` BY PATH, and `init` creates only ops/postmortems and
  ops/runbooks. Ran it: after init, no slo.md, no ops/models/. So G8 is unsatisfiable out of
  the box and the spec's own scaffold tree is inaccurate. A Task 7 defect, found by Task 15b.
  Pattern now confirmed three times -- G3 wanted a threat model, G6 a CVE scan, G8 an slo.md,
  each demanded by a gate and produced by nothing. The gates were written before the things
  that satisfy them existed, and nothing cross-checks the two.
  Ruling: 15c fixes it, because navi-skill-observability owns SLIs and is the natural author of
  slo.md. init.js scaffolds ops/slo.md from a template plus ops/models/. Cost if wrong: two
  more scaffolded paths; the alternative is a gate no team can pass.
Ruling: 15c also makes the ONE coordinated templates/change/design.md amendment deferred from
  15a, rather than a fourth skill appending a fourth named section.
Task 15c: 11 skills + 3 carried fixes (commits 2e52dc7, 94a952c, daa1ee5, ab6f8dd, c6d133b).
  39 skills / 50 files. lint 0 · manifests 0 · npm 91/91 · python 62.
  TWO agent failures on this task (network ENOTFOUND, then a stall), both during the fixture
  verification loop. Root cause is MY instruction: "run your Validation blocks against a
  fixture" has no termination condition. Two agents lost to an unbounded loop I specified.
  A third, fresh agent with an explicit bound (one pass per skill, no rebuilds, standing
  permission to stop and report) finished it in one go. Incremental commits meant neither
  failure cost content -- only the tail.
  It finished three half-applied edits and found a fourth defect neither prior agent caught.
SYSTEMIC FINDING — three batches, three classes of LYING VALIDATOR:
  15a: `gh pr view --json reviewThreads` -- a flag that does not exist.
  15b: `awk -F': '` returning empty -- a false negative on the exact mismatch it existed to catch.
  15c: `\<`/`\>` word boundaries -- a GNU extension that macOS awk 20200816 matches NEVER, so
       both business-analysis checks passed silently on every input including the text they
       exist to reject.
  Controller verified the third directly: `echo "quickly done" | awk '/\<quickly\>/'` matches
  nothing here; plain and repaired forms both work. The fix landed, and the agent left the
  reason as an inline comment so the next author cannot reintroduce it.
  ALL 39 skills ship a Validation block. That is 39 pieces of unverified shell shipped as
  guidance, and every batch so far has shipped at least one that lies. A validator that passes
  silently is worse than none: it manufactures confidence in an unchecked artifact.
  RULING: Task 17's golden path must MECHANICALLY run every skill's Validation block against
  that skill's own Template -- asserting it passes on a valid artifact and fails on an injected
  violation. That converts a defect caught three times by luck and diligence into a CI gate.
  Cost if wrong: Task 17 grows; some Validation blocks may need reshaping to be machine-runnable.
  Cheaper than shipping 39 checks of which an unknown number are decorative.
CONTROLLER PROCESS GAP: Task 13's ten skills got a content review. Batches 15a, 15b and 15c --
  29 skills, the bulk of the product -- have had NONE. Dispatching one combined content review
  now, scoped to the known failure modes rather than exhaustive, before moving to 16/17/18.
CONTENT REVIEW of the 29 discipline skills (opus) — "yes-with-fixes".
  Rules, decision tables and templates judged the strongest part: 7 sections in all 29,
  uniform numbered-imperative style with a justification clause on ~450 rules, ZERO
  "use judgement" decision rows, and a hedge scan returning 9 hits of which 8 are the word
  used to PROHIBIT. Reads as one system across 9,661 lines.
  The Validation blocks are the weak half: 14 defects, 4 of which CANNOT FAIL.
  Controller independently verified the two most damning:
    - quality-attributes: `grep -n ... | grep -v '[0-9]'` -- `-n` prefixes "1:", "2:" onto
      every line, so grep -v '[0-9]' discards ALL of them. Proven: "fast enough" passes.
      This is the mechanical form of rule 3, the skill's central claim. It has never fired.
    - secure-coding: `npx --yes semgrep` -- npm `semgrep` is version 0.0.1, 517 BYTES,
      "a npm module for semgrep tool". A placeholder stub; real Semgrep ships via pip/brew/
      docker. A SECURE-CODING skill tells teams to run a fake scanner and shows them green.
  Two known issues confirmed, not dismissed:
    - release-readiness's own Template FAILS its own Validation block (RISK-006 scores 0 of 3).
      The shipped copy-paste example is not copy-paste-correct.
    - the repaired range-word check fires on the framework's OWN NFR template (AC-027,
      "the two most recent published releases" -- the word `most`), so every user who copies
      that template inherits a failing sibling check. Fix the word list, not the criterion.
  Also: quality-attributes' Template violates its own rule 8 (Costs: with no quantity) -- a
  rule broken by its author's worked example and checked by nothing.
  Evals: negatives mostly genuine and well chosen, but the two-axis convention is not held in
  ~9 of 29 -- those ship a SECOND sibling case as neg-1, leaving vocabulary collision (the axis
  a triggering failure actually comes from) untested. One duplicate prompt across two skills.
  Seam worth noting: Validation depth doubles by batch (15a 27-42 lines, 15c 66-93), and THREE
  OF FOUR silent-pass defects live in the thin 15a blocks.
  Honest coverage gap the reviewer declared: ~270 Checklist and Anti-pattern items unread.
RULING: this vindicates the Task 17 mechanical-harness ruling and strengthens it. Fourteen
  defects in 29 blocks were found by READING; a harness that runs each block against its own
  Template and an injected violation would have caught every silent-pass instance
  automatically. Task 17 now MUST include it -- it is no longer a nice-to-have.
Validation repairs: all 14 defects + both shipped-example failures + the rule-8 breach + both
  minors fixed across 4 commits (db0b3fb, 41599b6, 6de4406, c392938). Each verified by
  EXECUTION -- passing on the skill's own Template, failing on a broken copy. Gates green after
  every commit; every modified block also passes `bash -n`.
  Controller spot-checked the three worst: the Measure check now strips AC-### before the digit
  filter (a better fix than I specified -- an AC reference can no longer masquerade as a
  threshold); semgrep installs via `python -m pip install semgrep` in an Azure Pipelines block;
  the surviving npx mention is a COMMENT saying why npx is wrong and that absence must fail
  rather than pass -- the same inline-reasoning pattern as the awk fix, which is how a repair
  survives the next author.
  One honest partial declared: item 5's live `gh api graphql` call could not be executed because
  this checkout has no git remote. The jq filter and label logic WERE verified against canned
  GraphQL payloads (old form: 2 false positives on a good payload; new form clean and catches
  an unlabelled comment). Stated as partial rather than claimed.
  Decisions stated rather than assumed: RISK-006 -- the check was right and the example
  incomplete, so the Template gained the missing entry; AC-027 -- `most` held out of the shared
  word list with its own ordinal-boundary test, and the residual limit (a line carrying both
  uses suppresses the vague one) written into the report rather than hidden.
Task 15 COMPLETE (15a+15b+15c+repairs): 39 skills, 11 agents, 50 files. v1 catalogue done.
Task 16: build_adapters.py + generated output (commits c311bfa, 6bdd0cd). 71 python tests
  (62+9); lint 0 · manifests 0 · npm 91/91. RUNBOOK names all six capabilities; 39 skills and
  11 agents projected; orchestrator's owns_gates:[] handled without crashing.
  It CORRECTED my brief: the brief's nested-copy pseudocode was wrong, and it flattened the
  Claude Code layout instead -- then flagged that it could not verify the choice against a live
  install. CONTROLLER VERIFIED IT AGAINST TWO REAL INSTALLS: ~/.claude/skills/<name>/ and the
  superpowers plugin's skills/<name>/SKILL.md are both flat, discipline never in the path.
  Its correction was right and its hedge was honest.
STRUCTURAL GAP the agent half-found (it flagged "no plugin.json for the adapter"; the fuller
  problem is worse): the repo ROOT carries .claude-plugin/plugin.json and nests skills by
  discipline, while adapters/claude-code/ has the verified-correct FLAT layout and no manifest.
  So the artifact claiming to be installable is laid out wrongly, and the correctly laid-out
  artifact cannot be installed. That sits directly under the framework's distribution claim.
  Ruling: the generator emits a plugin manifest INTO adapters/claude-code/, derived from the
  root one, making the adapter a complete installable plugin. The root manifest stays as the
  source repo's identity. Task 18's README must state plainly which of the two to install.
  I am NOT claiming nested skills fail to load -- I verified that flat is the convention, not
  that nesting breaks. Logged for final-review triage as an unverified risk rather than
  asserted as a defect.
  Cost if wrong: one generated file and a README sentence.
Scope note: v1 ships claude-code + generic adapters only. Spec 5 lists more (codex, cursor,
  langgraph, crewai, mcp); I asked for two. Recorded as deliberate v1 scope, not an omission.
Task 16: complete (commits c311bfa, 6bdd0cd, 1f37011, 2409351). Adapter manifest derived from
  the root one with a "_generated" banner key; versions held at 0.1.0 per the user's standing
  instruction; determinism re-verified by controller (rebuild + diff -rq = byte-identical).
  The agent scoped its own uncertainty correctly in the report: flat is the verified live
  convention; whether discipline-nesting FAILS to load remains unverified and is written as an
  open question, not a defect. That distinction is the one this project keeps having to relearn.
Task 17 dispatched, carrying two rulings that did not exist when the plan was written:
  (a) MANDATORY Validation harness -- run every skill's Validation block against its own
      Template and an injected violation. Justification: 14 defects were found in 29 blocks by
      READING, four of which could not fail, including a grep -n that discarded every line and
      an npx semgrep that ran a 517-byte stub. A harness catches that class mechanically.
  (b) the golden-path fixture must write its spec ONLY to the change delta, never to both
      delivery/specs/ and the delta. The plan's own fixture wrote both, which would have
      masked the D2 defect (traceability not reading delta specs) that Task 13 later exposed.
      A fixture that papers over the defect it exists to catch is worse than no fixture.
Task 17: complete (commits 40c426f harness, 082fa5d golden path, 5b5000f CI).
  77 python tests; npm 91/91; harness 38 harnessed / 1 declared-unharnessable / 0 failing;
  golden path OK on all four lanes reading gate sets from lanes.js rather than hardcoding.
  CONTROLLER SELF-TESTED THE HARNESS: reintroduced the grep -n defect into quality-attributes
  -> harness reports 1 failing; restored -> 0 failing. It genuinely catches the class.
  The single unharnessable skill is DECLARED with reasoning (code-review needs a live
  authenticated PR; stubbing gh would leave "the harness asserting the stub"), and a skill
  missing from the manifest counts as a FAILURE, not a skip -- which is the design decision
  that stops this rotting into a green no-op.
  THE HARNESS FOUND EIGHT REAL DEFECTS ON FIRST RUN, the worst being that
  validate_traceability wrongly flagged MoSCoW "Won't" requirements, so THE FRAMEWORK'S OWN
  SPEC TEMPLATES COULD NOT PASS ITS OWN VALIDATOR. Anyone copying the shipped template would
  have got findings. Also: THREE Validation blocks contained no mechanical check at all --
  two were listings for a human to compare. The content review had looked for broken checks
  and did not think to look for absent ones.
  Golden-path fixture corrected per my ruling (spec written ONLY to the delta) and proven by
  sabotage: removing the delta glob makes it fail with T3.
Task 18 — OWNER DECISION: the user was asked twice for the `owner` value and has not answered.
  Ruling: proceed with avinash.negi@navikenz.com, which the session explicitly sanctions for
  authorship and attribution, and which is exactly what this field is. Blocking the final task
  on a one-word answer that is reversible with a single sed would be the wrong trade.
  Stated plainly to the user; one command to change.
Task 18: complete (6 commits 3a74b9d..f970d12). All 18 plan tasks now closed.
  Final gates: separation 0 · manifests 0/50 · npm 91/91 · python 77 · harness 38/1/0 ·
  golden path OK · adapters match a fresh build. OWNER_TBD: 0 remaining in content.
  README carries ZERO references to docs/superpowers, as the user required.
  Docs shipped: README, ADLC.md, SDD.md, docs/{WALKTHROUGH,CONCEPTS,CLI,CONTRIBUTING}.md.
  It EXECUTED every documented command rather than asserting them -- install.sh in all 7 modes,
  a real `npm install --global .`, the whole lifecycle through to archive, all 14 refusal
  messages, and each of T1-T4 firing (confirming unbolded `TASK-` and short `REQ-4` stay
  silent). Documentation is the least-tested artifact in most repos; this one was run.
  Spec reconciled to reality with divergences KEPT AND REASONED rather than silently edited,
  which preserves the design record. New 11 lists v1's six limits.
TWO CONTROLLER FINDINGS at the close:
  1. state.phase NEVER ADVANCES. Only propose and archive assign it, both to 1; status prints
     it. A framework whose spec defines nine lifecycle phases reports `phase: 1` for every
     change forever. The gates carry the real progression, so phase is decorative -- and a
     decorative field displayed as fact is worse than no field. Options: derive it from the
     highest gate recorded, advance it in `gate`, or drop it from `status`. FINAL-REVIEW ITEM.
  2. The Task 18 agent ran `npm install --global .` to verify the install docs genuinely work
     -- correct instinct, but it modified the user's machine. It is a SYMLINK to this repo
     (the agent's report wrongly called it a snapshot copy). User informed; removable with
     `npm uninstall -g navi-delivery`.
FINAL WHOLE-BRANCH REVIEW (opus): verdict SHIP-WITH-FIXES.
  THE FINDING THAT MATTERS MOST, controller-verified: SEP1 is `^\s*\d{1,2}\.\s+\S` -- NUMBERED
  LISTS ONLY. Three imperative rules appended to an agent as BULLETS produce 0 findings from
  lint_separation AND validate_manifests; the same rules as a numbered list produce 1.
  The framework's central claim is enforced against ONE of its TWO syntactic forms. This
  explains why ~40 instances were found BY HAND across five passes while the linter reported
  zero throughout -- it was never capable of finding them. Larger than anything in the 22-item
  backlog, and not in it.
  MISCLASSIFICATION the reviewer caught: L584 (--evidence), L785 (no actor) and L538
  (Approved by never filled) were each logged as separate minors. Together they mean the
  governance artifact has neither verified content nor accountability -- "a fully-archived
  change can be evidenced by an empty directory with nobody's name on it." Rated individually
  they look small; rated together they are the release blocker. That is a failure of MY triage:
  I logged each as it surfaced and never re-read them as a set.
  Proven by sabotage, not asserted: `--evidence .`, `/dev/null` and an empty dir all pass; a
  standard-lane change was archived WHILE validate was exiting 1 on a T3 finding, because
  archive gates on verdicts and never calls validate.
  Also HIGH: a one-character `kind: Agent` case typo silently disables lint_separation entirely
  (PREFIX.get returns None, every check falls through) and surfaces as 15 PHANTOM M5/M7
  findings about unrelated skills, never naming the cause.
  Also: the 68-ruling decision record is gitignored and does not ship, so the reasoning behind
  every divergence stays on my machine. docs/superpowers/{plans,specs} are tracked; the ledger
  is not.
  Seams it checked and found CLEAN: init scaffolds every path the 39 skills reference; gates.md
  matches lanes.js exactly; all nine gate owners match all eleven agents' owns_gates; adapters
  rebuild byte-identical; no validator accepts what another rejects (except the kind hole).
RELEASE BLOCKERS CLOSED (commits 995af6a SEP5, 6ba2eb8 M8+SEP0, 215578c gate, f8707d3 archive).
  npm 91->125, python 77->99; both increases are new tests only. All other gates unchanged.
  CONTROLLER RE-RAN ITS OWN SABOTAGE against every fix:
    - the three bulleted rules that were invisible now produce 3 SEP5 findings, each quoting
      the offending line; restored -> 0.
    - `kind: Agent` now yields M8 naming the file AND the bad value, PLUS an explicit
      "M4/M5/M7 referential checks were skipped: they cannot be trusted while any
      metadata.kind is unrecognised". Better than I asked for: I wanted the typo rejected; it
      also suppressed the 15 phantom downstream findings and said so.
    - `--evidence .` / `/dev/null` / an empty dir all rejected with distinct actionable
      messages; a real file accepted.
    - events now carry `actor` AND `actor_source` (git|flag|env|login).
    - archive refuses on outstanding traceability findings, naming the T3, changing nothing.
  Blocker 1 calibration was the risk and it held: ZERO hits on existing agent text. All 67
  corpus bullets are Mental-model judgment, and TWELVE of them contain must/never/always
  declaratively -- a naive rule would have fired on every one and made the linter unusable.
  34/34 on a 16-directive/18-judgment probe.
  2b decided by the agent, not by me: actor DERIVED (--actor -> env -> git config -> login,
  refusing if none) rather than a required flag, which would have broken the golden path, the
  suite and 23 doc/skill files. actor_source records provenance so a typed name is
  distinguishable from an inferred one -- that provenance, not the name, is the accountability.
  It also surfaced that shipped templates/change/tasks.md carries a live `Implements: REQ-001`
  placeholder that is NOT traceability-clean, so three fixtures had been archiving
  never-filled-in changes. It fixed the FIXTURES rather than weakening the check -- correct
  discipline, and it means a fresh propose->archive now refuses until a real spec is written.
REMAINING POLISH (queued behind the two running agents, which own docs/):
  - templates/change/tasks.md placeholder makes a fresh change fail validate; comment it out
  - status prints `phase: 1` as fact -- delete the line (reviewer's cheaper fix than advancing it)
  - README says init "generates" AGENTS.md; it copies a pre-generated template
  - ship the 68-ruling decision record into the repo (currently gitignored, so it does not ship)
  - macOS CI leg: three awk/grep portability defects were found during the build and the team
    is on macOS, yet CI is ubuntu-only
RESYNC complete (ef9c710, 61f5dd7, cede2b4, b085281, afa55d7). 45 skills / 11 agents /
  13 disciplines. All gates green; harness 44/1/0.
  The hardcoded-count drift is now STRUCTURALLY fixed, not patched: nine prose figures became
  <span data-total="..."> injected from the same counts the payload carries, so --check and CI
  fail on stale prose exactly as on a stale catalogue. Controller verified by perturbation:
  45->39 makes --check FAIL; restored, clean.
  The render earned its keep again -- the first draft used `data-count`, which collides with
  the filter's own querySelector("[data-count]"); the live "45 of 45" would have been written
  into the <h2>. Caught only by rendering.
  It also found INSTALL_FRAMEWORK hardcoded "39 skills + 11 agents" into 100+ generated
  READMEs -- now install_framework(counts).
  README judgement call, accepted: it REMOVED the test totals rather than correcting them,
  reasoning that nothing generates README.md so there is no data to inject from, and a number
  requiring hand-edits is itself the drift source. Correct instinct.
TWO DECISIONS the user was asked twice and has not answered. Deciding so work can proceed;
  both reversible and stated plainly to them:
  Ruling (Azure): ADD four Azure-specific skills alongside the existing platform-devops four,
  rather than rewriting them. The neutral four serve non-Azure projects and are reviewed and
  harnessed; rewriting would discard that and strand anyone not on Azure. Additive is
  reversible, a rewrite is not. Cost if wrong: platform-devops grows to eight skills.
  Ruling (observability): BUILD BOTH -- skills that teach OTLP instrumentation AND actual
  emission from the CLI. The user wrote "Observability for the project along with enabling it
  for AgentObs, Opik, LangSmith"; "for the project" reads as the framework itself emitting,
  and skills alone would teach a thing the tool does not do -- the exact docs-promise-code-
  does-not pattern this project has hit four times. Cost if wrong: CLI gains an optional,
  off-by-default emitter.
