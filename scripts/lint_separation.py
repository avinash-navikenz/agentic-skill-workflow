"""Enforce the separation law: judgment lives in agents, rules live in skills."""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.navi_lint.registry import Entry, load_entries
from scripts.validate_manifests import Finding

NUMBERED = re.compile(r"^\s*\d{1,2}\.\s+\S", re.M)
PROC_HEADING = re.compile(r"^##+\s*(Template|Checklist)\b", re.M | re.I)
PERSONA_VOICE = re.compile(
    r"(?:^|[.!?]\s+)As the (Architect|Product Owner|Business Analyst|Developer|Data Engineer|"
    r"ML Engineer|MLOps Engineer|DevOps Engineer|QA Engineer)\b|\b(?:you|You) should weigh\b|\b(?:in|In) my judgment\b",
    re.M)
FIRST_PERSON = re.compile(r"(?:^|\s)I\s+(?:prefer|think|decide|weigh|would|favour|favor)\b")

def _strip_code(body: str) -> str:
    return re.sub(r"```.*?```", "", body, flags=re.S)

def separation_findings(entry: Entry) -> list[Finding]:
    body = _strip_code(entry.body)
    out: list[Finding] = []
    if entry.kind == "agent":
        if NUMBERED.search(body):
            out.append(Finding("SEP1", entry.path, "agent contains a numbered procedure; move it to a skill"))
        if PROC_HEADING.search(body):
            out.append(Finding("SEP2", entry.path, "agent contains a Template or Checklist section; move it to a skill"))
    elif entry.kind == "skill":
        if PERSONA_VOICE.search(body):
            out.append(Finding("SEP3", entry.path, "skill uses persona voice; move the judgment to an agent"))
        if FIRST_PERSON.search(body):
            out.append(Finding("SEP4", entry.path, "skill uses first person; skills are impersonal and imperative"))
    return out

def main(argv: list[str]) -> int:
    root = Path(argv[0]) if argv else Path.cwd()
    findings = [f for e in load_entries(root) for f in separation_findings(e)]
    for f in findings:
        print(f"{f.rule} {f.path}: {f.message}")
    print(f"\n{len(findings)} separation finding(s)")
    return 1 if findings else 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
