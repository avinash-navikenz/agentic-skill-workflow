"""Frontmatter, naming and referential-integrity checks for navi-delivery content."""
import sys
from collections import namedtuple
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.navi_lint.registry import Entry, load_entries
from scripts.navi_lint.frontmatter import FrontmatterError

Finding = namedtuple("Finding", "rule path message")

REQUIRED_META = ["version", "maturity", "kind", "discipline", "lifecycle_phases", "owner", "tags", "model"]
REQUIRED_TOP = ["name", "description", "allowed-tools", "metadata"]
AGENT_ONLY = ["skills", "owns_gates", "capabilities", "consumes", "produces", "handoff_to", "escalate_to_human_when"]
PREFIX = {"skill": "navi-skill-", "agent": "navi-agent-"}

def check(entries: list[Entry]) -> list[Finding]:
    out: list[Finding] = []
    skills = {e.name for e in entries if e.kind == "skill"}
    referenced: set[str] = set()
    # M7 compares both sides of the used_by_agents/skills invariant, so the agent side is
    # collected up front rather than during the pass below: entry order is not guaranteed.
    listed_by: dict[str, set[str]] = {}
    for e in entries:
        if e.kind == "agent":
            for ref in e.meta.get("skills") or []:
                listed_by.setdefault(ref, set()).add(e.name)

    for e in entries:
        for key in REQUIRED_TOP:
            if key not in e.meta:
                out.append(Finding("M2", e.path, f"missing required key '{key}'"))
        meta = e.meta.get("metadata") or {}
        for key in REQUIRED_META:
            if key not in meta:
                out.append(Finding("M2", e.path, f"missing required metadata.{key}"))
        if e.kind == "agent":
            for key in AGENT_ONLY:
                if key not in e.meta:
                    out.append(Finding("M2", e.path, f"agent missing required key '{key}'"))

        prefix = PREFIX.get(e.kind)
        if prefix and not e.name.startswith(prefix):
            out.append(Finding("M3", e.path, f"name '{e.name}' must start with '{prefix}' for kind '{e.kind}'"))
        expected_dir = e.path.parent.name
        if e.name and e.name != expected_dir:
            out.append(Finding("M3", e.path, f"name '{e.name}' does not match directory '{expected_dir}'"))

        if e.kind == "skill":
            if "Trigger phrases include:" not in (e.meta.get("description") or ""):
                out.append(Finding("M6", e.path, "skill description must contain 'Trigger phrases include:'"))
        if e.kind == "agent":
            for ref in e.meta.get("skills") or []:
                referenced.add(ref)
                if ref not in skills:
                    out.append(Finding("M4", e.path, f"references unknown skill '{ref}'"))

    for name in sorted(skills - referenced):
        path = next(e.path for e in entries if e.name == name)
        out.append(Finding("M5", path, f"skill '{name}' is referenced by no agent"))

    for e in entries:
        if e.kind != "skill":
            continue
        declared = set((e.meta.get("metadata") or {}).get("used_by_agents") or [])
        listed = listed_by.get(e.name, set())
        # Reported as two directions, because the fix differs: the first means the skill's
        # claim is stale, the second means the agent acquired the skill without being recorded.
        for name in sorted(declared - listed):
            out.append(Finding("M7", e.path, f"used_by_agents names '{name}', which does not list this skill"))
        for name in sorted(listed - declared):
            out.append(Finding("M7", e.path, f"agent '{name}' lists this skill but is absent from used_by_agents"))
    return out

def main(argv: list[str]) -> int:
    root = Path(argv[0]) if argv else Path.cwd()
    try:
        entries = load_entries(root)
    except FrontmatterError as exc:
        print(f"M1 {exc}")
        return 1
    findings = check(entries)
    for f in findings:
        print(f"{f.rule} {f.path}: {f.message}")
    print(f"\n{len(findings)} finding(s) across {len(entries)} file(s)")
    return 1 if findings else 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
