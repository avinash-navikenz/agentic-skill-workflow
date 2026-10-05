#!/usr/bin/env python3
"""Carry a toy change through every lane and assert the framework holds.

The script *is* the test: it exits non-zero on the first failed assertion.

Two things about the fixture are deliberate and worth stating, because getting
either wrong makes the run look green while testing nothing:

1. The change's spec is written **only** to the change's own delta
   (`delivery/changes/<name>/specs/…`), never to `delivery/specs/`. That is the
   real workflow — a change introduces requirements in its delta, and `archive`
   folds them into `delivery/specs/`. Writing to both masks whether the
   traceability validator reads delta specs at all, which is a defect this
   project has actually shipped.

2. Lane gate sets are read from `cli/lib/lanes.js` at runtime. Hardcoding them
   would make the fixture agree with itself rather than with the CLI.
"""
from __future__ import annotations

import datetime
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = [shutil.which("node") or "node", str(ROOT / "cli" / "index.js")]

SPEC = """# Capability — Theme

**Status:** delta for change `{change}`

## Requirements

### REQ-001 — Users can choose a theme
**Priority:** Must

#### AC-001
Given a signed-in user,
when they toggle the theme,
then the choice persists across sessions.
Implements: REQ-001

### REQ-002 — Per-device override
**Priority:** Won't

Not in this change: it needs a device identity the product does not have.
"""

TASKS = """# Tasks — {change}

- [ ] **TASK-001** Add the toggle
  - Implements: REQ-001
  - Verified by: AC-001
"""


def run(args: list[str], cwd: Path, expect: int = 0) -> str:
    res = subprocess.run(CLI + args, cwd=cwd, capture_output=True, text=True)
    assert res.returncode == expect, (
        f"navi-delivery {' '.join(args)} -> {res.returncode} (want {expect})\n"
        f"{res.stdout}{res.stderr}"
    )
    return res.stdout + res.stderr


def lane_gates(lane: str) -> list[str]:
    """The lane's gates, read from the CLI rather than restated here."""
    res = subprocess.run(
        [CLI[0], "-e",
         "const l=require(process.argv[1]);"
         "process.stdout.write(JSON.stringify(l.gatesForLane(process.argv[2])))",
         str(ROOT / "cli" / "lib" / "lanes.js"), lane],
        capture_output=True, text=True,
    )
    assert res.returncode == 0, f"could not read lane '{lane}': {res.stderr}"
    return json.loads(res.stdout)


def all_gates() -> list[str]:
    res = subprocess.run(
        [CLI[0], "-e",
         "const l=require(process.argv[1]);process.stdout.write(JSON.stringify(l.ALL_GATES))",
         str(ROOT / "cli" / "lib" / "lanes.js")],
        capture_output=True, text=True,
    )
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


def events(delivery: Path) -> list[dict]:
    path = delivery / ".adlc" / "events.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def state(delivery: Path) -> dict:
    return json.loads((delivery / ".adlc" / "state.json").read_text(encoding="utf-8"))


def future_date(days: int = 90) -> str:
    return (datetime.date.today() + datetime.timedelta(days=days)).isoformat()


# ---------------------------------------------------------------------------

def check_init(workdir: Path) -> None:
    """Phase 0: the scaffold `init` is contracted to produce."""
    run(["init"], workdir)
    delivery = workdir / "delivery"
    for rel in ["project.md", "AGENTS.md", ".adlc/waivers.md", "ops/slo.md"]:
        assert (delivery / rel).exists(), f"init did not scaffold {rel}"
    for rel in ["specs", "changes/archive", "decisions", "ops/runbooks",
                "ops/postmortems", "ops/models", ".adlc"]:
        assert (delivery / rel).is_dir(), f"init did not scaffold the {rel}/ directory"
    # Re-running must refuse rather than overwrite a tree with work in it.
    out = run(["init"], workdir, expect=1)
    assert "already exists" in out, out


def check_propose_refusals(workdir: Path, active: str) -> None:
    """`propose` takes exactly one active change, and validates its inputs."""
    out = run(["propose", "second-change", "--lane", "standard"], workdir, expect=1)
    assert "already active" in out, out
    assert not (workdir / "delivery" / "changes" / "second-change").exists(), \
        "a refused propose left a directory behind"
    out = run(["propose", "bad-lane-change", "--lane", "sideways"], workdir, expect=1)
    assert "unknown lane" in out or "already active" in out, out
    assert state(workdir / "delivery")["change"] == active, \
        "a refused propose changed the active change"


def check_gate_refusals(workdir: Path, lane: str, change: str) -> None:
    """A gate outside the lane, and a waiver without a real future expiry."""
    gates = lane_gates(lane)
    outside = next((g for g in all_gates() if g not in gates), None)
    evidence = workdir / "evidence.md"
    if outside:
        out = run(["gate", outside, "--pass", "--evidence", evidence.name], workdir, expect=1)
        assert f"not in lane '{lane}'" in out, out
        assert outside not in state(workdir / "delivery")["gates"], \
            f"{outside} was recorded despite being outside lane '{lane}'"

    inside = gates[0]
    # A waiver needs a reason...
    out = run(["gate", inside, "--waive", "--expires", future_date()], workdir, expect=1)
    assert "requires a reason" in out, out
    # ...an expiry...
    out = run(["gate", inside, "--waive", "a stated reason"], workdir, expect=1)
    assert "requires --expires" in out, out
    # ...a real calendar date...
    out = run(["gate", inside, "--waive", "a stated reason", "--expires", "2026-02-30"],
              workdir, expect=1)
    assert "not a real calendar date" in out, out
    # ...and one in the future.
    out = run(["gate", inside, "--waive", "a stated reason", "--expires", "2020-01-01"],
              workdir, expect=1)
    assert "strictly in the future" in out, out
    # Evidence has to resolve.
    out = run(["gate", inside, "--pass", "--evidence", "no-such-file.md"], workdir, expect=1)
    assert "evidence file not found" in out, out
    assert state(workdir / "delivery")["gates"] == {}, \
        "a refused gate decision was recorded anyway"


def check_rework_loop(workdir: Path, lane: str) -> None:
    """A failed gate marks the lane's later gates stale, and re-recording clears it."""
    gates = lane_gates(lane)
    if len(gates) < 2:
        return
    target = gates[0]
    run(["gate", target, "--fail", "--evidence", "evidence.md"], workdir)
    s = state(workdir / "delivery")
    assert s["gates"][target] == "fail", s
    assert f"gate:{target}" in s["stale"], s
    for g in s["stale"]:
        assert g.removeprefix("gate:") in gates, \
            f"a gate outside lane '{lane}' was marked stale: {g}"
    # validate refuses while anything is stale.
    out = run(["validate"], workdir, expect=1)
    assert "stale artifact" in out, out
    # archive refuses too, and changes nothing.
    out = run(["archive", CHANGE_FOR[lane]], workdir, expect=1)
    assert "Nothing was changed" in out, out
    # Re-recording the gate clears its own staleness and carries the prior verdict.
    out = run(["gate", target, "--pass", "--evidence", "evidence.md"], workdir)
    assert "re-recorded: fail -> pass" in out, out
    assert f"gate:{target}" not in state(workdir / "delivery")["stale"]
    last = [e for e in events(workdir / "delivery") if e.get("gate") == target][-1]
    assert last.get("previous") == "fail", last


CHANGE_FOR = {lane: f"{lane}-change" for lane in ["express", "standard", "full", "hotfix"]}


def run_lane(lane: str, workdir: Path) -> None:
    change = CHANGE_FOR[lane]
    delivery = workdir / "delivery"

    # --- phases 0-1: scaffold and propose ---------------------------------
    check_init(workdir)
    run(["propose", change, "--lane", lane], workdir)
    change_dir = delivery / "changes" / change
    # Structure, not content. propose scaffolds no artifacts: an empty template
    # makes "nobody started" indistinguishable from "written badly", and lets a
    # gate pass against a placeholder. The files below are written by the work.
    for rel in ["specs", "evidence"]:
        assert (change_dir / rel).is_dir(), f"propose did not create {rel}/"
    for rel in ["proposal.md", "design.md", "tasks.md", "handoffs.md"]:
        assert not (change_dir / rel).exists(), f"propose scaffolded {rel}"
    check_propose_refusals(workdir, change)

    # --- phase 2: the delta spec, and only the delta -----------------------
    spec_dir = change_dir / "specs" / "theme"
    spec_dir.mkdir(parents=True, exist_ok=True)
    (spec_dir / "spec.md").write_text(SPEC.format(change=change), encoding="utf-8")
    (change_dir / "tasks.md").write_text(TASKS.format(change=change), encoding="utf-8")
    (workdir / "evidence.md").write_text("proof\n", encoding="utf-8")
    assert not list((delivery / "specs").glob("**/spec.md")), \
        "the fixture wrote a spec to delivery/specs/ — a change's requirements live in its delta until archive"

    # Traceability must already be clean, reading the delta spec.
    trace = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_traceability.py"),
         str(delivery), "--strict"],
        capture_output=True, text=True)
    assert trace.returncode == 0, \
        f"{lane}: traceability is not clean against the delta spec:\n{trace.stdout}"

    # --- phases 3-8: the gates the lane enforces ---------------------------
    check_gate_refusals(workdir, lane, change)
    check_rework_loop(workdir, lane)

    gates = lane_gates(lane)
    waived = gates[-1] if len(gates) > 1 else None
    for gate in gates:
        if gate == waived:
            out = run(["gate", gate, "--waive",
                       f"{gate} is unmet: the toy change has no evidence for it",
                       "--expires", future_date()], workdir)
            assert f"{gate} waived until" in out, out
        elif state(delivery)["gates"].get(gate) != "pass":
            run(["gate", gate, "--pass", "--evidence", "evidence.md"], workdir)

    s = state(delivery)
    for gate in gates:
        assert s["gates"].get(gate) in ("pass", "waived"), f"{lane}: {gate} is {s['gates'].get(gate)}"
    assert set(s["gates"]) <= set(gates), \
        f"{lane}: a gate outside the lane was recorded: {sorted(set(s['gates']) - set(gates))}"
    assert not s["stale"], f"{lane}: artifacts are still stale: {s['stale']}"

    # The waiver reached the register with its reason and expiry.
    if waived:
        waivers = (delivery / ".adlc" / "waivers.md").read_text(encoding="utf-8")
        assert f"| {waived} |" in waivers, waivers
        assert future_date() in waivers, waivers

    out = run(["status"], workdir)
    for gate in gates:
        assert gate in out, f"{lane}: status does not mention {gate}"

    run(["validate"], workdir)

    # --- phase 9: archive, fold, and the postmortem ------------------------
    run(["archive", change], workdir)
    stamped = list((delivery / "changes" / "archive").glob(f"*-{change}"))
    assert stamped, f"{lane}: the change was not archived"
    assert not change_dir.exists(), f"{lane}: the change directory survived archive"
    folded = delivery / "specs" / "theme" / "spec.md"
    assert folded.exists(), f"{lane}: archive did not fold the delta spec into delivery/specs/"
    assert "REQ-001" in folded.read_text(encoding="utf-8")
    post = delivery / "ops" / "postmortems" / f"{change}.md"
    assert post.exists(), f"{lane}: no insight was emitted"
    assert "INSIGHT-001" in post.read_text(encoding="utf-8")

    # Archiving twice, and archiving an unknown change, both refuse.
    out = run(["archive", change], workdir, expect=1)
    assert "unknown change" in out, out

    # --- telemetry ---------------------------------------------------------
    log = events(delivery)
    recorded = [e for e in log if e.get("gate")]
    assert len(recorded) >= len(gates) + 1, f"{lane}: telemetry is missing gate events"
    assert log[-1] == {**log[-1], "gate": "G9", "verdict": "archived", "change": change}, log[-1]
    for event in recorded:
        assert "ts" in event and "change" in event, event
        if event["verdict"] in ("pass", "fail"):
            assert "evidence" in event, event
        if event["verdict"] == "waived":
            assert event.get("reason") and event.get("expires"), event

    # Traceability still clean once the spec is canonical.
    trace = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_traceability.py"), str(delivery)],
        capture_output=True, text=True)
    assert trace.returncode == 0, f"{lane}: traceability broke at archive:\n{trace.stdout}"

    # The tree is ready for the next change.
    assert state(delivery)["change"] is None, "archive left a change active"
    run(["propose", "next-change", "--lane", "express"], workdir)


def main() -> int:
    lanes = ["express", "standard", "full", "hotfix"]
    print(f"lanes read from cli/lib/lanes.js: " +
          ", ".join(f"{l} ({len(lane_gates(l))} gates)" for l in lanes))
    for lane in lanes:
        with tempfile.TemporaryDirectory(prefix=f"navi-golden-{lane}-") as tmp:
            run_lane(lane, Path(tmp))
            print(f"  {lane}: OK  ({' '.join(lane_gates(lane))})")

    for script in ["validate_manifests.py", "lint_separation.py"]:
        res = subprocess.run([sys.executable, str(ROOT / "scripts" / script), str(ROOT)],
                             capture_output=True, text=True)
        assert res.returncode == 0, f"{script} failed:\n{res.stdout}{res.stderr}"
        print(f"  {script}: OK")

    print("golden path: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
