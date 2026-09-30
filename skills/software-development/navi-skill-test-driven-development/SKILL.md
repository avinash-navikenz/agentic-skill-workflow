---
name: navi-skill-test-driven-development
description: >
  Use when implementing an acceptance criterion or fixing a defect, before the implementation
  is written. Defines the red-green-refactor cycle, the AC-### binding every test carries, what
  counts as a real red, and when a test may be changed.
  Trigger phrases include: TDD, test first, write the test, red green refactor, failing test,
  regression test, reproduce the bug, unit test for this criterion, test before code.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: software-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer]
  owner: OWNER_TBD
  tags: "testing, tdd, quality, traceability, regression"
  model: sonnet
---

## When to use

A `TASK-###` is about to be implemented, a defect has been reported, or a refactor is about to
start and the behaviour must be pinned before it moves.

## Rules

1. Write the test before the code that makes it pass. Every `AC-###` the change implements
   gets its test written first; G5 requires every acceptance criterion to have at least one
   automated test referencing it, and a test written afterwards describes what was built
   rather than what was asked for.
2. Name the criterion inside the test. Put the id in the test's own title —
   `test("AC-003: store unreachable renders the light theme", ...)` — so a grep for `AC-003`
   finds the test, the spec and the task. A test that binds to nothing cannot be counted at
   G5 and cannot be found at G6.
3. Run the test and watch it fail before writing any implementation. An unrun test is a
   guess about what the system currently does.
4. Accept only a real red: the test fails on its assertion, with the expected and actual
   values printed. A failure from a missing import, a syntax error or an unresolved module is
   a broken harness, not a red — fix it and run again.
5. Write one behaviour per test, matching one criterion. A test asserting two outcomes gives
   one verdict over both, and the day it goes red nobody knows which behaviour broke.
6. Write the smallest change that turns the test green, then stop. Extra behaviour added while
   green is behaviour no test asked for and no criterion covers.
7. Refactor only while green, and run the tests after every structural change. A refactor that
   cannot be verified between steps is a rewrite.
8. Never change a test to make a failing implementation pass. A test is changed only when the
   criterion changed, and the criterion changes in `spec.md` first — see
   `navi-skill-acceptance-criteria`. Change the test in the same commit as the spec change,
   not before it.
9. Reproduce every defect with a failing test before fixing it. The test that reproduces the
   defect is the regression test; a fix with no reproducing test is a fix nobody can prove
   and nothing stops from being undone.
10. Write tests for the negative and empty-state criteria in the same cycle as the happy path.
    Those are the criteria the implementation would otherwise invent an answer for, and G6
    requires them covered.
11. Assert observable behaviour, never internals. A test that asserts a row was written to
    `user_preferences` passes while the user sees nothing, and fails the day the storage
    changes without the behaviour changing. Assert what the criterion's `then` clause names.
12. Keep every test deterministic. No `sleep`, no wall-clock reads, no network calls, no
    unseeded randomness: inject the clock, the transport and the seed. A test that fails once
    a fortnight costs more than the behaviour it covers.
13. Quarantine a flaky test with a named owner and a date rather than re-running it until
    green. G6 requires exactly this, and a retry in the config is how a team stops believing
    red.
14. Check a `TASK-###` off in `tasks.md` only when the tests for every `AC-###` it implements
    are green in a full run, not in a filtered one. Which risks are worth testing and at which
    level is the change's test strategy, decided in the quality-engineering discipline; this
    skill governs the order in which the code and its test get written.

## Decision table

| Observed condition | Required action |
|---|---|
| An `AC-###` has no test | Write the failing test first, with the id in its title |
| A new test passes the first time it runs | It asserts something already true — revert the behaviour it claims to cover and confirm it goes red |
| A test fails on an import or syntax error | Not a red — fix the harness and run again |
| A defect is reported | Write the failing reproduction first; keep it as the regression test |
| A test asserts two outcomes | Split it, one per criterion |
| The implementation is green and the test now looks wrong | The test is right until the criterion changes; change `spec.md` first |
| A criterion genuinely changed | Update `spec.md`, then the test, in one commit; re-run |
| A test needs a delay to pass | Inject the clock or await the condition; never `sleep` |
| A test calls a real network service | Replace with the contract's fake; the boundary is covered by its contract test |
| A test fails intermittently | Quarantine with owner and date; do not retry until green |
| Refactoring is about to start | Ensure the behaviour is green and pinned by tests first |
| A `TASK-###` is about to be checked off | Run the full suite, not the filtered one |
| Coverage of a criterion is manual by necessity | Record the reason in the G6 evidence; the criterion still needs a recorded verification |

## Template

A full cycle for `AC-003` — a real terminal session, not a shape:

```bash
# 1. Read the criterion. This is what the test must assert, verbatim.
grep -A4 '#### AC-003' delivery/changes/theme-persistence/specs/theme/spec.md
# Given the preference store is unreachable,
# when a signed-in user loads any page,
# then the light theme is applied and one warning is logged with the user id omitted.
```

```typescript
// test/shell/theme-fallback.spec.ts — written before any implementation
import { test, expect } from "vitest";
import { renderShell } from "../../src/shell/render";
import { FakeUserStore } from "../fakes/user-store";
import { CaptureLog } from "../fakes/log";

test("AC-003: store unreachable renders the light theme", async () => {
  const store = new FakeUserStore({ mode: "unreachable" });
  const log = new CaptureLog();

  const shell = await renderShell({ userId: "u-123", store, log });

  expect(shell.theme).toBe("light");
});

test("AC-003: store unreachable logs one warning without the user id", async () => {
  const store = new FakeUserStore({ mode: "unreachable" });
  const log = new CaptureLog();

  await renderShell({ userId: "u-123", store, log });

  expect(log.warnings).toHaveLength(1);
  expect(log.warnings[0]).not.toContain("u-123");
});
```

```bash
# 2. Watch it fail — on the assertion, with expected and actual printed.
npx vitest run test/shell/theme-fallback.spec.ts
#  FAIL  test/shell/theme-fallback.spec.ts > AC-003: store unreachable renders the light theme
#  AssertionError: expected undefined to be 'light'
#   - Expected:  "light"
#   + Received:  undefined
#  Tests  2 failed (2)

# 3. Write the smallest implementation that turns both green, then run again.
npx vitest run test/shell/theme-fallback.spec.ts
#  Tests  2 passed (2)

# 4. Refactor if needed, re-running after each structural step.
npx vitest run test/shell/theme-fallback.spec.ts
#  Tests  2 passed (2)

# 5. Run the whole suite before checking the task off.
npm test
#  Tests  318 passed (318)
```

```markdown
<!-- delivery/changes/theme-persistence/tasks.md -->
- [x] **TASK-004** Render the light theme when the preference store is unreachable
  - Implements: REQ-001
  - Tests: test/shell/theme-fallback.spec.ts (AC-003)
```

Reproducing a defect before fixing it:

```bash
# The report: "theme flashes dark then light for users with no preference"
# 1. Write the test that reproduces it, named for the criterion it violates.
npx vitest run test/shell/theme-default.spec.ts
#  FAIL  AC-002: no stored preference applies the OS scheme before first paint
#  AssertionError: expected 'dark' to be 'light'
#  Tests  1 failed (1)

# 2. Fix. 3. Re-run. The reproduction stays in the suite as the regression test.
npx vitest run test/shell/theme-default.spec.ts
#  Tests  1 passed (1)
```

## Checklist

- [ ] The test was written before the implementation
- [ ] The test title carries the `AC-###` it covers
- [ ] The test was run and seen to fail on its assertion, not on a harness error
- [ ] Each test asserts one behaviour
- [ ] The implementation is the smallest change that turned it green
- [ ] Refactoring happened only while green, with a run after each step
- [ ] No test was edited to accommodate a failing implementation
- [ ] Every defect fixed in this change has a reproducing test in the suite
- [ ] Negative and empty-state criteria have tests, not only the happy path
- [ ] No test sleeps, reads the wall clock, calls a network, or uses unseeded randomness
- [ ] Any flaky test is quarantined with an owner and a date
- [ ] The full suite is green before any `TASK-###` is checked off

## Anti-patterns

**Test written after the fact.** The implementation ships, then a test is written that
exercises it. It will pass on the first run and it encodes the bug as the specification. Write
the test from the criterion, watch it fail, then implement.

**Green on first run.** A new test that passes immediately proves nothing about the change. If
it is genuinely covering existing behaviour, say so; if it is meant to cover new behaviour,
remove the implementation line and confirm it goes red.

**Red by harness.** `Cannot find module '../fakes/user-store'` counted as the red step. The
assertion never ran, so nothing was learned about the system. Fix the import and run again.

**The test edited into submission.** `expect(shell.theme).toBe("dark")` changed to
`toBeDefined()` after the implementation disagreed with it. The criterion is now whatever the
code does. If AC-003 was wrong, change `spec.md` first; otherwise fix the code.

**Asserting the mechanism.** `expect(db.rows("user_preferences")).toHaveLength(1)`. This
passes while the user sees the wrong theme and fails when the storage changes for reasons
nobody cares about. Assert what the criterion's `then` clause names.

**Fix with no reproduction.** A one-line fix for a reported defect, no test. Nobody can show
the defect existed, and the next refactor reintroduces it silently. Reproduce first; the
reproduction is the regression test.

**Sleep as synchronisation.** `await sleep(200)` before the assertion. It passes on a fast
machine and fails in CI, and the fix will be a longer sleep. Inject the clock, or await the
condition the test actually depends on.

**Retry until green.** `retries: 2` added to the runner because one test is unreliable. The
suite now reports success for a system that failed. Quarantine the test with an owner and a
date, and diagnose it as a defect.

**Bundled test for a bundled criterion.** One test covering AC-001 and AC-002 because the code
path is shared. One red now means two unknowns. Split the test, one per criterion.

## Validation

```bash
CHANGE=<name>

# Every acceptance criterion in the change's spec is named by at least one test
for ac in $(grep -rhoE 'AC-[0-9]{3,}' delivery/changes/$CHANGE/specs/ | sort -u); do
  grep -rq "$ac" test/ src/ 2>/dev/null || echo "$ac: no test references it"
done

# No test sleeps or reads the wall clock directly
grep -rnE '\b(sleep\(|Thread\.sleep|time\.sleep|Date\.now\(\)|new Date\(\))' test/ \
  | grep -v 'fakes/'

# No retry configuration hiding flakiness
grep -rnE '\bretries?\s*[:=]\s*[1-9]' package.json vitest.config.* jest.config.* 2>/dev/null

# Tasks and requirements are bound; T1 and T3 must be clean before G5
python3 scripts/validate_traceability.py delivery/

# The full suite, not a filtered run
npm test
```

The first command is the one G5 reads: every criterion with no test referencing it is a
criterion the gate cannot honestly record. The traceability run covers the other half —
T1 finds a task with no `Implements:` line, T3 finds one implementing a requirement that does
not exist.
