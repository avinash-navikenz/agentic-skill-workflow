"""Detect orphans across REQ -> AC -> TASK in a scaffolded delivery/ tree."""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.validate_manifests import Finding

REQ = re.compile(r"\b(REQ-\d{3,})\b")
AC = re.compile(r"\b(AC-\d{3,})\b")
TASK_LINE = re.compile(r"\*\*(TASK-\d{3,})\*\*")
# A requirement recorded as MoSCoW "Won't" is a decision not to build it. Both
# navi-skill-spec-authoring and navi-skill-non-functional-requirements write one
# with a reason and deliberately no acceptance criteria and no task — that is the
# shape their own Templates ship and their own Validation blocks assert ("a Won't
# still carries a reason"). Reporting T2/T4 against it made the framework's own
# spec Template unable to pass `navi-delivery validate`, and the only way to
# clear it was to delete the record of the decision. Matches both the ASCII and
# the typographic apostrophe.
WONT = re.compile(r"\*\*Priority:\*\*\s*Won[\u2019']t\b")
IMPLEMENTS = re.compile(r"Implements:\s*(REQ-\d{3,})")

# Validators must report the file and a readable message, never raise a
# traceback (see scripts/navi_lint/frontmatter.py, which applies the same
# rule to UnicodeDecodeError). read_text(encoding="utf-8") raises
# UnicodeDecodeError on invalid bytes and can also raise OSError (e.g. a
# dangling symlink, or the file vanishing between glob() and read) — both
# are reported as a T0 Finding on that file instead of propagating.
def _read_text(path: Path) -> tuple[str | None, Finding | None]:
    try:
        return path.read_text(encoding="utf-8"), None
    except (UnicodeDecodeError, OSError) as exc:
        return None, Finding("T0", path, f"file is not readable: {exc}")

# Requirements are gathered from two locations:
#   - delivery/specs/**/spec.md          -- canonical, folded in by `archive`
#   - delivery/changes/*/specs/**/spec.md -- each change's own delta spec
# The normal spec-driven workflow is: propose a change, write its delta spec
# introducing new REQ-###s under delivery/changes/<name>/specs/, then write
# tasks that implement them -- and only *archive* folds those requirements
# into delivery/specs/. Scanning delivery/specs/ alone means a requirement a
# change introduces reports T3 ("implements unknown REQ") from the moment a
# task binds to it until the change is archived, which fails the common
# case. A change's delta spec is proposed truth and counts for traceability
# for the lifetime of that change, so both globs are scanned identically and
# merged into the same `reqs` / `reqs_with_ac` structures.
SPEC_GLOBS = ("specs/**/spec.md", "changes/*/specs/**/spec.md")

def trace_findings(delivery_root: Path, strict: bool = False) -> list[Finding]:
    out: list[Finding] = []
    reqs: dict[str, Path] = {}
    reqs_with_ac: set[str] = set()
    wont: set[str] = set()

    specs = [spec for pattern in SPEC_GLOBS for spec in sorted(delivery_root.glob(pattern))]
    for spec in specs:
        text, finding = _read_text(spec)
        if finding:
            out.append(finding)
            continue
        current = None
        for line in text.splitlines():
            m = REQ.search(line)
            if m and line.lstrip().startswith("#"):
                current = m.group(1)
                # Decision: the same REQ-### id appearing in both
                # delivery/specs/ and a change's delta spec is treated as a
                # legitimate amendment (the change revising an already-
                # canonical requirement), not a collision worth its own
                # finding -- see the module-level note above and the report
                # for the reasoning. reqs_with_ac is a set that only ever
                # grows, so an AC recorded against a REQ from either source
                # satisfies T2/T4 regardless of which copy is read first or
                # last; `reqs[current]` simply ends up pointing at whichever
                # copy was scanned last (delta after canonical, per
                # SPEC_GLOBS' order), which is cosmetic only -- it decides
                # where a T2/T4 Finding's path points, not whether one fires.
                reqs[current] = spec
            elif current and WONT.search(line):
                wont.add(current)
            elif current and AC.search(line):
                reqs_with_ac.add(current)

    implemented: set[str] = set()
    for tasks in sorted(delivery_root.glob("changes/*/tasks.md")):
        text, finding = _read_text(tasks)
        if finding:
            out.append(finding)
            continue
        lines = text.splitlines()
        for i, line in enumerate(lines):
            tm = TASK_LINE.search(line)
            if not tm:
                continue
            window = "\n".join(lines[i:i + 4])
            im = IMPLEMENTS.search(window)
            if not im:
                out.append(Finding("T1", tasks, f"{tm.group(1)} has no 'Implements: REQ-###' line"))
                continue
            req = im.group(1)
            implemented.add(req)
            if req not in reqs:
                out.append(Finding("T3", tasks, f"{tm.group(1)} implements unknown {req}"))

    for req, spec in sorted(reqs.items()):
        if req in wont:
            continue
        if req not in reqs_with_ac:
            out.append(Finding("T2", spec, f"{req} has no acceptance criteria"))
        if strict and req not in implemented:
            out.append(Finding("T4", spec, f"{req} is implemented by no task"))
    return out

def main(argv: list[str]) -> int:
    strict = "--strict" in argv
    positional = [a for a in argv if not a.startswith("--")]
    root = Path(positional[0]) if positional else Path.cwd() / "delivery"
    findings = trace_findings(root, strict=strict)
    for f in findings:
        print(f"{f.rule} {f.path}: {f.message}")
    print(f"\n{len(findings)} traceability finding(s)")
    return 1 if findings else 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
