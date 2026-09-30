"""Enforce the separation law: judgment lives in agents, rules live in skills."""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.navi_lint.registry import Entry, load_entries
from scripts.validate_manifests import Finding

NUMBERED = re.compile(r"^\s*\d{1,2}\.\s+\S", re.M)
PROC_HEADING = re.compile(r"^##+\s*(Template|Checklist)\b", re.M | re.I)
PERSONA_VOICE = re.compile(
    r"(?:(?:^[\s>*+-]*|[.!?]\s+)As the (?i:Architect|Product Owner|Business Analyst|Developer|Data Engineer|"
    r"ML Engineer|MLOps Engineer|DevOps Engineer|QA Engineer)\b|\b(?:you|You) should weigh\b|\b(?:in|In) my judgment\b)",
    re.M)
FIRST_PERSON = re.compile(r"(?:^|\s)I\s+(?:prefer|think|decide|weigh|would|favour|favor)\b")

def _strip_code(body: str) -> str:
    return re.sub(r"```.*?```", "", body, flags=re.S)

# ---------------------------------------------------------------------------
# SEP5 — imperative directives written as bullets in an agent.
#
# SEP1 only ever matched numbered lists (`^\s*\d{1,2}\.\s+\S`), so the same
# three rules appended to an agent as bullets scored zero. Roughly forty
# violations were found by hand across five review passes while this linter
# reported zero throughout: it was never capable of finding them.
#
# The governing definition (spec §4.1) is that a sentence is a rule in
# disguise when BOTH (a) it tells the reader what to do or what an artifact
# must contain, AND (b) it adds no reason the governing skill does not already
# carry. (b) is not mechanically testable, so SEP5 aims squarely at (a) and
# accepts that a human reads the hit.
#
# Precision, not recall, is the constraint. Agents legitimately use bullets
# throughout `Mental model`, and those bullets are judgment: all 67 bullets in
# the shipped 11-agent corpus live there, and 12 of them contain `must`,
# `never` or `always` inside ordinary declarative prose ("The question is
# never whether it fails", "a state someone must later reason about"). A bare
# keyword match would fire on every one of them, and a linter that cries wolf
# on valid prose gets switched off — which would remove the only mechanical
# guarantee this framework has. So the two forms below are deliberately
# narrow, and each carries its own disqualifier.
# ---------------------------------------------------------------------------

# A bullet line, and the indented continuation lines that belong to it.
_BULLET_START = re.compile(r"^\s*[-*+]\s+(\S.*)$")
_BLOCK_BREAK = re.compile(r"^\s*(?:[-*+]\s|\d{1,2}\.\s|#|>|\||```)")

# Form 1: the bullet opens with a bare imperative verb.
#
# The lexicon is curated rather than exhaustive on purpose. Words that are far
# more often the *subject* of a declarative sentence in this corpus than an
# imperative verb are left out even though English allows them as verbs —
# `code`, `design`, `test`, `trust`, `monitor`, `process`, `value`, `cost`,
# `release`, `gate`, `model`, `scope`, `control`, `plan`, `rollback`. Leaving
# them out costs recall on sentences nobody writes and buys precision on
# sentences this corpus is full of ("Code is read far more often than
# written", "Trust boundaries are where the design's assumptions stop").
IMPERATIVE_VERBS = frozenset("""
add apply ask assert attach avoid bind capture check choose confirm copy
create declare define delete deploy describe document emit ensure escalate
exclude favour favor fill follow generate give hand include install invoke
keep label link list log mark move name note number open pick place prefer
prepare provide publish put raise read record refuse reject remove rename
repeat replace report require restate return review rotate run send set ship
start state stop store submit tag take trace treat update use validate verify
write
""".split())

# Adverbials that can sit in front of an imperative verb without changing that
# the sentence is an instruction. `always`, `never`, `do not` and `don't` are
# also directive *on their own* when they open a bullet — "Never average two
# personas' disagreement" is a rule however the verb after it is spelled — so
# they are tracked separately from the merely-skippable ones.
_DIRECTIVE_OPENERS = ("always", "never", "do not", "don't", "do n't")
_SKIPPABLE_OPENERS = ("first", "then", "next", "also", "instead", "otherwise",
                      "only", "finally", "afterwards", "additionally")

# Disqualifier for form 1: a copula or auxiliary appearing immediately after
# the opening word almost always means the opening word is a *subject*, not an
# imperative verb — "Record keeping is uneven", "Review is the cheapest
# control". Scanning only the first few tokens keeps genuine directives whose
# object clause contains a copula ("Ensure that the spec is testable").
_COPULA = frozenset("is are was were be been being has have had does do did "
                    "will would can could may might should".split())
# ...unless a determiner, complementiser or object pronoun got there first. An
# imperative's object clause starts with one of these, and any copula after it
# belongs to that clause rather than to the opening word: "Verify the rollback
# has been run", "Ensure that the spec is testable", "Ensure it is recorded".
# A declarative subject reaches its copula without one: "Record keeping is
# uneven", "Review is the cheapest control", "Trust boundaries are where...".
_OBJECT_MARKERS = frozenset("""
the a an this that these those its their your our my his her sure certain
any all each every no both some another such it them us him me
""".split())
_COPULA_WINDOW = 4

# Form 2: an artifact requirement — "<artifact> must contain <thing>", which
# is spec §4.1's own wording for the second half of test (a).
#
# The subject must be a determiner-led noun phrase of at most four words with
# no copula inside it, which is what separates the requirement
#   "The design document must contain a rejected-alternatives section"
# from the corpus's declarative use
#   "Every branch I add is a state someone must later reason about"
# where `is` intervenes between the determiner and `must`.
_NOT_COPULA = r"(?!(?:is|are|was|were|be|been|being|has|have|had|do|does|did)\b)"
ARTIFACT_MUST = re.compile(
    r"^(?:the|a|an|every|each|any|all|no|this|that|your)\s+"
    r"(?:" + _NOT_COPULA + r"[a-z][\w'\u2019-]*\s+){0,4}"
    r"must(?:\s+not|\s+never)?\s+[a-z]",
    re.I)
SECOND_PERSON_MUST = re.compile(
    r"\byou\s+(?:must|shall|are\s+required\s+to|are\s+never\s+to)\b", re.I)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")

def _bullet_items(body: str):
    """Yield (line_number, joined_text) for every bullet item in `body`."""
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        m = _BULLET_START.match(lines[i])
        if not m:
            i += 1
            continue
        parts = [m.group(1)]
        j = i + 1
        while j < len(lines) and lines[j].strip() and not _BLOCK_BREAK.match(lines[j]):
            parts.append(lines[j].strip())
            j += 1
        yield i + 1, " ".join(parts)
        i = j

def _plain(text: str) -> str:
    """Strip the markdown that would otherwise hide the first word."""
    text = re.sub(r"^\[[ xX]\]\s*", "", text)            # task-list checkbox
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)  # links -> label
    text = re.sub(r"`[^`]*`", " ", text)                  # inline code
    text = re.sub(r"[*_]{1,3}", "", text)                 # emphasis
    return text.strip()

def _words(sentence: str) -> list[str]:
    return re.findall(r"[A-Za-z][\w'\u2019-]*", sentence)

def _opens_with_imperative(sentence: str) -> bool:
    low = sentence.strip().lower()
    forced = False
    # Peel any directive/skippable adverbial off the front, remembering whether
    # one of them was itself directive.
    changed = True
    while changed:
        changed = False
        for opener in _DIRECTIVE_OPENERS:
            if low.startswith(opener + " "):
                forced, low, changed = True, low[len(opener) + 1:].lstrip(), True
                break
        if changed:
            continue
        for opener in _SKIPPABLE_OPENERS:
            if low.startswith(opener + " ") or low.startswith(opener + ", "):
                low = low[len(opener):].lstrip(" ,")
                changed = True
                break
    words = _words(low)
    if not words:
        return False
    if not forced and words[0] not in IMPERATIVE_VERBS:
        return False
    # Copula disqualifier — see _COPULA above.
    for idx in range(1, min(_COPULA_WINDOW, len(words))):
        if words[idx] in _OBJECT_MARKERS:
            return True
        if words[idx] in _COPULA:
            return False
    return True

def _is_directive_bullet(text: str) -> bool:
    plain = _plain(text)
    if not plain:
        return False
    sentences = [s for s in _SENTENCE_SPLIT.split(plain) if s.strip()]
    if sentences and _opens_with_imperative(sentences[0]):
        return True
    return any(ARTIFACT_MUST.search(s.strip()) or SECOND_PERSON_MUST.search(s)
               for s in sentences)

def _excerpt(text: str, width: int = 72) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= width else flat[:width - 1] + "\u2026"

def bulleted_rule_findings(entry: "Entry") -> list[Finding]:
    body = _strip_code(entry.body)
    return [Finding("SEP5", entry.path,
                    f"line {n}: bulleted imperative directive "
                    f"\u2014 move the rule to a skill: \"{_excerpt(text)}\"")
            for n, text in _bullet_items(body) if _is_directive_bullet(text)]

def separation_findings(entry: Entry) -> list[Finding]:
    body = _strip_code(entry.body)
    out: list[Finding] = []
    if entry.kind == "agent":
        if NUMBERED.search(body):
            out.append(Finding("SEP1", entry.path, "agent contains a numbered procedure; move it to a skill"))
        if PROC_HEADING.search(body):
            out.append(Finding("SEP2", entry.path, "agent contains a Template or Checklist section; move it to a skill"))
        out.extend(bulleted_rule_findings(entry))
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
