"""Detect orphans across REQ -> AC -> TASK in a scaffolded delivery/ tree."""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.validate_manifests import Finding

REQ = re.compile(r"\b(REQ-\d{3,})\b")
AC = re.compile(r"\b(AC-\d{3,})\b")
TASK_LINE = re.compile(r"\*\*(TASK-\d{3,})\*\*")
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

def trace_findings(delivery_root: Path, strict: bool = False) -> list[Finding]:
    out: list[Finding] = []
    reqs: dict[str, Path] = {}
    reqs_with_ac: set[str] = set()

    for spec in sorted(delivery_root.glob("specs/**/spec.md")):
        text, finding = _read_text(spec)
        if finding:
            out.append(finding)
            continue
        current = None
        for line in text.splitlines():
            m = REQ.search(line)
            if m and line.lstrip().startswith("#"):
                current = m.group(1)
                reqs[current] = spec
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
