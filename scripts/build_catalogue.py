#!/usr/bin/env python3
"""Extract the navi-delivery catalogue from the repo and embed it in docs/index.html.

Everything the browsable page knows about agents, skills, disciplines, phases, gates
and lanes is derived here from the files that are themselves the source of truth:

  agents/navi-agent-*/<name>.agent.md   frontmatter + prose sections
  skills/<discipline>/navi-skill-*/SKILL.md
  cli/lib/lanes.js                      the lane -> gate-set mapping the CLI enforces
  ADLC.md                               the phase table and the gate table

Nothing is hand-transcribed into the page, so regenerating after a change to any of
those files keeps the page true.

Usage:
    python3 scripts/build_catalogue.py              # print JSON to stdout
    python3 scripts/build_catalogue.py --inject     # rewrite the <script> block in docs/index.html
    python3 scripts/build_catalogue.py --check      # non-zero exit if docs/index.html is stale
    python3 scripts/build_catalogue.py --readmes    # write one README.md per skill and agent

Following this project's convention (navi_lint/frontmatter.py, validate_traceability.py),
unreadable or malformed input is reported as a readable message, never a bare traceback.

Determinism: entries are read in sorted path order and no output carries a timestamp,
PID or absolute path, so two builds of the same tree are byte-identical.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.navi_lint.registry import load_entries  # noqa: E402
from scripts.navi_lint.frontmatter import FrontmatterError  # noqa: E402

BEGIN = "<!-- BEGIN GENERATED CATALOGUE -->"
END = "<!-- END GENERATED CATALOGUE -->"
SCRIPT_OPEN = '<script id="navi-catalogue" type="application/json">'
SCRIPT_CLOSE = "</script>"

TRIGGER_MARKER = "Trigger phrases include:"


class CatalogueError(Exception):
    """A readable, non-traceback-worthy failure while building the catalogue."""


# --------------------------------------------------------------------------- text


def _squash(text: str) -> str:
    """Collapse the hard-wrapped prose of a markdown paragraph onto one line."""
    return re.sub(r"\s+", " ", text or "").strip()


def _sections(body: str) -> dict[str, str]:
    """Split a markdown body into {heading: text} for its level-2 headings."""
    out: dict[str, str] = {}
    current = None
    buf: list[str] = []
    for line in body.replace("\r\n", "\n").split("\n"):
        if line.startswith("## "):
            if current is not None:
                out[current] = "\n".join(buf).strip()
            current = line[3:].strip()
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        out[current] = "\n".join(buf).strip()
    return out


def _bullets(text: str) -> list[str]:
    """Pull top-level `- ` bullets out of a section, un-wrapping each."""
    items: list[str] = []
    for raw in (text or "").split("\n"):
        if raw.startswith("- "):
            items.append(raw[2:].strip())
        elif items and raw.startswith("  ") and raw.strip():
            items[-1] += " " + raw.strip()
    return [_squash(i) for i in items if i.strip()]


def _prose_before_fence(text: str) -> str:
    """The prose a section opens with, up to its first fenced block."""
    lines: list[str] = []
    for line in (text or "").split("\n"):
        if line.lstrip().startswith("```") or line.startswith("|"):
            break
        lines.append(line)
    return _squash("\n".join(lines))


def _template_artifact(text: str) -> str:
    """What a skill's `## Template` section tells the reader to produce.

    Most templates open with a sentence naming the destination path. A few open
    straight into the fenced block, so fall back to the first `delivery/...` path
    mentioned anywhere in the section, and then to the block's own first heading.
    """
    prose = _prose_before_fence(text)
    if prose:
        return prose
    path = re.search(r"`((?:delivery|templates)/[^`]+)`", text or "")
    if path:
        return f"Written to `{path.group(1)}`."
    for line in (text or "").split("\n"):
        stripped = line.strip()
        if stripped.startswith("#"):
            return _squash(stripped.lstrip("# ")) + " — see the skill's Template section."
    return ""


def _bold_leads(text: str) -> list[str]:
    """The `**Bold lead.**` openers a skill's Anti-patterns section is written in."""
    return [_squash(m) for m in re.findall(r"^\*\*(.+?)\*\*", text or "", re.MULTILINE)]


def _split_description(description: str) -> tuple[str, list[str]]:
    """Separate a frontmatter description into its prose and its trigger phrases."""
    text = _squash(description)
    if TRIGGER_MARKER in text:
        head, tail = text.split(TRIGGER_MARKER, 1)
        phrases = [p.strip(" .") for p in tail.split(",") if p.strip(" .")]
        return head.strip(), phrases
    return text, []


def _label(name: str) -> str:
    """`navi-skill-api-design` -> `API design`; `navi-agent-qa-engineer` -> `QA Engineer`."""
    stem = re.sub(r"^navi-(skill|agent)-", "", name)
    words = stem.split("-")
    acronyms = {"api", "qa", "kpi", "sli", "slo", "ml", "mlops", "devops", "adr", "tdd"}
    special = {"api": "API", "qa": "QA", "kpi": "KPI", "sli": "SLI",
               "mlops": "MLOps", "devops": "DevOps", "adr": "ADR"}
    out = []
    for i, w in enumerate(words):
        if w in special:
            out.append(special[w])
        elif w in acronyms:
            out.append(w.upper())
        elif i == 0:
            out.append(w.capitalize())
        else:
            out.append(w)
    return " ".join(out)


def _agent_label(name: str) -> str:
    stem = re.sub(r"^navi-agent-", "", name)
    special = {"qa": "QA", "mlops": "MLOps", "devops": "DevOps", "ml": "ML"}
    return " ".join(special.get(w, w.capitalize()) for w in stem.split("-"))


# --------------------------------------------------------------------------- framework constants


def _lanes(root: Path) -> list[dict]:
    """Read the lane -> gate-set mapping straight out of the CLI that enforces it."""
    path = root / "cli" / "lib" / "lanes.js"
    try:
        src = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise CatalogueError(f"cannot read lane definitions at {path}: {exc}") from exc

    lanes: list[dict] = []
    pattern = re.compile(
        r"^\s*(express|standard|full|hotfix):\s*\{(.*?)\},?\s*$", re.MULTILINE | re.DOTALL
    )
    for match in pattern.finditer(src):
        lane, block = match.group(1), match.group(2)
        gate_list = re.search(r"gates:\s*(?:Object\.freeze\()?\[([^\]]*)\]", block)
        if not gate_list:
            raise CatalogueError(f"lane '{lane}' in {path} has no parseable gates: list")
        gates = re.findall(r'"(G[1-9])"', gate_list.group(1))
        if "ALL_GATES" in gate_list.group(1):
            gates = [f"G{i}" for i in range(1, 10)]
        when = re.search(r'when:\s*"([^"]*)"', block)
        deferred = re.findall(r'deferred:\s*\[([^\]]*)\]', block)
        mandatory = re.findall(r'mandatory:\s*\[([^\]]*)\]', block)
        lanes.append({
            "lane": lane,
            "gates": gates,
            "when": when.group(1) if when else "",
            "deferred": re.findall(r'"(G[1-9])"', deferred[0]) if deferred else [],
            "mandatory": re.findall(r'"(G[1-9])"', mandatory[0]) if mandatory else [],
        })
    if len(lanes) != 4:
        raise CatalogueError(
            f"expected 4 lanes in {path}, parsed {len(lanes)} — the file's shape has changed"
        )
    order = {"express": 0, "standard": 1, "full": 2, "hotfix": 3}
    return sorted(lanes, key=lambda x: order[x["lane"]])


def _md_rows(text: str) -> list[list[str]]:
    rows = []
    for line in text.split("\n"):
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            continue
        rows.append(cells)
    return rows


def _phases_and_gates(root: Path) -> tuple[list[dict], list[dict]]:
    """Parse ADLC.md's phase table (§1) and gate table (§2)."""
    path = root / "ADLC.md"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise CatalogueError(f"cannot read {path}: {exc}") from exc

    phases: list[dict] = []
    for cells in _md_rows(text):
        if len(cells) == 4 and re.fullmatch(r"\d", cells[0]) and re.fullmatch(r"G\d", cells[2]):
            phases.append({
                "n": int(cells[0]), "phase": cells[1], "gate": cells[2], "owner": cells[3],
            })

    gates: list[dict] = []
    for cells in _md_rows(text):
        if len(cells) == 4 and re.fullmatch(r"\*\*G\d\*\*", cells[0]):
            gates.append({
                "gate": cells[0].strip("*"),
                "closes": cells[1],
                "exit": _squash(cells[2]),
                "evidence": _squash(cells[3]),
            })

    if len(phases) != 9 or len(gates) != 9:
        raise CatalogueError(
            f"expected 9 phases and 9 gates in {path}, parsed {len(phases)} and {len(gates)}"
        )
    return phases, gates


def _chain_and_findings(root: Path) -> tuple[list[dict], list[dict]]:
    """Parse SDD.md's ID-chain table (§1) and its validator-findings table (§3)."""
    path = root / "SDD.md"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise CatalogueError(f"cannot read {path}: {exc}") from exc

    chain: list[dict] = []
    findings: list[dict] = []
    id_cell = re.compile(r"^`(REQ|AC|ADR|TASK|SLI|INSIGHT)-###`$|^`TEST`$")
    for cells in _md_rows(text):
        if len(cells) == 4 and id_cell.match(cells[0]):
            chain.append({
                "id": cells[0].strip("`"),
                "artifact": _squash(cells[1]),
                "lives_in": _squash(cells[2]),
                "upstream": _squash(cells[3]),
            })
        elif len(cells) == 3 and re.fullmatch(r"`T[0-4]`", cells[0]):
            findings.append({
                "code": cells[0].strip("`"),
                "meaning": _squash(cells[1]),
                "fix": _squash(cells[2]),
            })

    if len(chain) != 7:
        raise CatalogueError(f"expected 7 links in {path}'s ID chain, parsed {len(chain)}")
    if len(findings) != 5:
        raise CatalogueError(f"expected 5 validator findings in {path}, parsed {len(findings)}")
    return chain, findings


# --------------------------------------------------------------------------- build


def catalogue_items(root: Path) -> dict:
    """The agent and skill halves of the catalogue, and nothing else.

    Split out of build() so a caller that only needs the tree — build_adapters.py,
    rendering the README that ships inside the adapter — does not also have to
    supply ADLC.md, SDD.md and cli/lib/lanes.js. Those are framework constants
    the pages need; a skill's README does not depend on any of them.
    """
    try:
        entries = load_entries(root)
    except FrontmatterError as exc:
        raise CatalogueError(str(exc)) from exc

    agents: list[dict] = []
    skills: list[dict] = []

    for e in entries:
        meta = e.meta.get("metadata") or {}
        sections = _sections(e.body)
        desc, triggers = _split_description(e.meta.get("description", ""))
        common = {
            "name": e.name,
            "discipline": meta.get("discipline", ""),
            "phases": list(meta.get("lifecycle_phases") or []),
            "description": desc,
            "maturity": meta.get("maturity", ""),
            "version": meta.get("version", ""),
            "model": meta.get("model", ""),
            "tags": [t.strip() for t in str(meta.get("tags", "")).split(",") if t.strip()],
            "path": e.path.relative_to(root).as_posix(),
        }

        if e.kind == "agent":
            agents.append({
                **common,
                "label": _agent_label(e.name),
                "mission": _squash(sections.get("Mission", "")),
                "mental_model": _bullets(sections.get("Mental model", "")),
                "how_i_decide": _squash(sections.get("How I decide", "")),
                "definition_of_good": _squash(sections.get("Definition of good", "")),
                "working_agreement": _squash(sections.get("Working agreement", "")),
                "owns_gates": list(e.meta.get("owns_gates") or []),
                "skills": list(e.meta.get("skills") or []),
                "capabilities": list(e.meta.get("capabilities") or []),
                "consumes": list(e.meta.get("consumes") or []),
                "produces": list(e.meta.get("produces") or []),
                "handoff_to": list(e.meta.get("handoff_to") or []),
                "escalate_to_human_when": list(e.meta.get("escalate_to_human_when") or []),
            })
        elif e.kind == "skill":
            rules = sections.get("Rules", "")
            skills.append({
                **common,
                "label": _label(e.name),
                "trigger": _squash(sections.get("When to use", "")),
                "trigger_phrases": triggers,
                "produces": _template_artifact(sections.get("Template", "")),
                "used_by_agents": list(meta.get("used_by_agents") or []),
                "rule_count": len(re.findall(r"^\d+\.\s", rules, re.MULTILINE)),
                "anti_patterns": _bold_leads(sections.get("Anti-patterns", ""))[:4],
                "has_validation": "Validation" in sections,
            })
        else:
            raise CatalogueError(f"{e.path}: metadata.kind is '{e.kind}', expected agent or skill")

    agents.sort(key=lambda a: a["name"])
    skills.sort(key=lambda s: (s["discipline"], s["name"]))

    # Cross-check the two directions of the agent<->skill relation. A skill that names an
    # agent which does not hold it (or the reverse) is a real defect in the tree, not a
    # rendering problem, so surface it rather than quietly drawing a one-sided edge.
    agent_names = {a["name"] for a in agents}
    skill_names = {s["name"] for s in skills}
    problems: list[str] = []
    for a in agents:
        for s in a["skills"]:
            if s not in skill_names:
                problems.append(f"{a['name']} holds unknown skill {s}")
    for s in skills:
        for a in s["used_by_agents"]:
            if a not in agent_names:
                problems.append(f"{s['name']} is used_by unknown agent {a}")
    if problems:
        raise CatalogueError("referential integrity: " + "; ".join(sorted(problems)))

    return {"agents": agents, "skills": skills}


def build(root: Path) -> dict:
    items = catalogue_items(root)
    agents, skills = items["agents"], items["skills"]

    disciplines = sorted({s["discipline"] for s in skills} | {a["discipline"] for a in agents})
    discipline_rows = [{
        "id": d,
        "label": d.replace("-", " "),
        "skills": sum(1 for s in skills if s["discipline"] == d),
        "agents": sum(1 for a in agents if a["discipline"] == d),
    } for d in disciplines]

    phases, gates = _phases_and_gates(root)
    chain, findings = _chain_and_findings(root)

    return {
        "agents": agents,
        "skills": skills,
        "disciplines": discipline_rows,
        "phases": phases,
        "gates": gates,
        "lanes": _lanes(root),
        "chain": chain,
        "findings": findings,
        "counts": {
            "agents": len(agents),
            "skills": len(skills),
            "disciplines": len(discipline_rows),
            "phases": len(phases),
            "gates": len(gates),
            "lanes": 4,
        },
    }


# --------------------------------------------------------------------------- readmes
#
# One README.md per skill and per agent, written from the same model the
# catalogue pages render, so the page and the file on disk cannot drift.
#
# A README is a summary for a human deciding whether this is the thing they
# want and how to get it. It deliberately carries no rules: SKILL.md and
# *.agent.md remain the only authority for those, and are linked rather than
# quoted. Two copies of a rule drift; this framework exists to stop that.

NOTES_BEGIN = "<!-- BEGIN NOTES -->"
NOTES_END = "<!-- END NOTES -->"
NOTES_PLACEHOLDER = (
    "_Nothing hand-written yet. Anything between the NOTES markers survives "
    "regeneration; everything outside them is overwritten._"
)

README_STAMP = (
    "Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's "
    "frontmatter and section headings. Edit the source file, not this one — except "
    "inside the NOTES block, which regeneration preserves."
)

INSTALL_FRAMEWORK = {
    "intro": (
        "`adapters/claude-code/` is the installable artefact: generated output in the "
        "flat layout the convention uses (`skills/<name>/SKILL.md`, `agents/<name>.md`) "
        "with its own `.claude-plugin/plugin.json`, so the directory is a complete "
        "plugin on its own. The repository root also carries a plugin manifest, but its "
        "skills are nested a level deeper and that layout has not been verified to load "
        "in any harness — do not install the repo root."
    ),
    "steps": [
        "python3 scripts/build_adapters.py .   # adapters/ is generated; refresh it first",
        "./install.sh --yes                    # symlinks 39 skills + 11 agents into ~/.claude",
    ],
    "note": (
        "`--copy` installs copies instead of symlinks; `--uninstall` removes exactly what it "
        "installed; `CLAUDE_SKILLS_DIR` and `CLAUDE_AGENTS_DIR` override the destinations "
        "(which default to `$HOME/.claude/skills` and `$HOME/.claude/agents`). Prerequisites "
        "are Node 20 or newer and Python 3, and nothing else."
    ),
}

ALONE_NOTE_SKILL = (
    "Installed on its own, this skill has **no agent holding it**. Nothing in the "
    "lifecycle will invoke it: no phase loads it and no gate depends on it, because it "
    "is an agent that decides when a skill applies. Useful for reading the rules or "
    "trying them in one session — not how the framework is meant to run."
)

ALONE_NOTE_AGENT = (
    "Installed on its own, this agent arrives **without the skills it holds**. It is "
    "written to load them rather than work from memory, so on its own it will reach for "
    "files that are not there. Useful for reading its judgment — not how the framework "
    "is meant to run."
)


def _end_sentence(text: str) -> str:
    """A `## Template` lead-in ends in `:` because a fenced block follows it in the
    source. The block is not carried into the README, so the colon would dangle."""
    text = (text or "").strip()
    return text[:-1] + "." if text.endswith(":") else text


def _rel(from_dir: str, to_path: str) -> str:
    """POSIX relative path from one repo-relative directory to a repo-relative file."""
    up = "../" * len(from_dir.split("/"))
    return up + to_path


def _meta_line(item: dict) -> str:
    bits = [f"`{item['name']}`", item["kind"]]
    if item.get("discipline"):
        bits.append(f"discipline `{item['discipline']}`")
    if item.get("phases"):
        plural = "phases" if len(item["phases"]) > 1 else "phase"
        bits.append(f"ADLC {plural} " + ", ".join(str(p) for p in item["phases"]))
    if item["kind"] == "agent":
        bits.append("owns " + (", ".join(item["owns_gates"]) if item.get("owns_gates")
                               else "no gate (it enforces gates the personas own)"))
    if item.get("model"):
        bits.append(f"model `{item['model']}`")
    bits.append(f"{item.get('maturity', '')} v{item.get('version', '')}".strip())
    return " · ".join(b for b in bits if b)


def _skill_readme(s: dict, agents_by_name: dict) -> dict:
    home = str(Path(s["path"]).parent.as_posix())
    holders = []
    gates: list[str] = []
    for n in s["used_by_agents"]:
        a = agents_by_name.get(n)
        if not a:
            continue
        for g in a.get("owns_gates") or []:
            if g not in gates:
                gates.append(g)
        holders.append({
            "name": n,
            "label": a["label"],
            "owns_gates": list(a.get("owns_gates") or []),
            "md": _rel(home, str(Path(a["path"]).parent.as_posix()) + "/README.md"),
            "html": "agents.html#e-" + n,
        })
    adapter_dir = f"adapters/claude-code/skills/{s['name']}"
    return {
        "kind": "skill",
        "label": s["label"],
        "meta": _meta_line({**s, "kind": "skill"}),
        "lead": s["description"],
        "fires": s["trigger"],
        "phrases": list(s["trigger_phrases"]),
        "produces": _end_sentence(s["produces"]),
        "holders": holders,
        "gates": sorted(gates),
        "authority": {
            "md": "SKILL.md",
            "html": s["path"],
            "what": (
                f"{s['rule_count']} numbered rules, a decision table, a template, a checklist, "
                "an anti-pattern list"
                + (", and a validation block a reader can run" if s["has_validation"] else "")
            ),
        },
        "install_alone": {
            "steps": [
                "python3 scripts/build_adapters.py .",
                f"cp -R {adapter_dir} ~/.claude/skills/",
            ],
            "note": ALONE_NOTE_SKILL,
        },
        "source": s["path"],
    }


def _agent_readme(a: dict, skills_by_name: dict, agents_by_name: dict) -> dict:
    home = str(Path(a["path"]).parent.as_posix())
    held = []
    for n in a["skills"]:
        s = skills_by_name.get(n)
        if not s:
            continue
        held.append({
            "name": n,
            "label": s["label"],
            "discipline": s["discipline"],
            "md": _rel(home, str(Path(s["path"]).parent.as_posix()) + "/README.md"),
            "html": "skills.html#e-" + n,
        })
    return {
        "kind": "agent",
        "label": a["label"],
        "meta": _meta_line({**a, "kind": "agent"}),
        "lead": a["mission"],
        "fires": a["description"],
        "phrases": [],
        "produces": list(a["produces"]),
        "consumes": list(a["consumes"]),
        "handoff_to": [{"name": n, "label": (agents_by_name.get(n) or {}).get("label", n),
                        "html": "agents.html#e-" + n} for n in a["handoff_to"]],
        "owns_gates": list(a["owns_gates"]),
        "phases": list(a["phases"]),
        "escalates": list(a["escalate_to_human_when"]),
        "held": held,
        "gates": list(a["owns_gates"]),
        "authority": {
            "md": Path(a["path"]).name,
            "html": a["path"],
            "what": ("its mission, mental model, how it decides, its definition of good, "
                     "its working agreement and its skill-invocation plan"),
        },
        "install_alone": {
            "steps": [
                "python3 scripts/build_adapters.py .",
                f"cp adapters/claude-code/agents/{a['name']}.md ~/.claude/agents/",
            ],
            "note": ALONE_NOTE_AGENT,
        },
        "source": a["path"],
    }


def readme_models(data: dict) -> dict[str, dict]:
    """{entry name: readme model} for every agent and skill in a built catalogue."""
    agents_by_name = {a["name"]: a for a in data["agents"]}
    skills_by_name = {s["name"]: s for s in data["skills"]}
    models: dict[str, dict] = {}
    for a in data["agents"]:
        models[a["name"]] = _agent_readme(a, skills_by_name, agents_by_name)
    for s in data["skills"]:
        models[s["name"]] = _skill_readme(s, agents_by_name)
    return models


def _fence(steps: list[str]) -> str:
    return "```sh\n" + "\n".join(steps) + "\n```"


def readme_markdown(m: dict, *, flat: bool = False) -> str:
    """Render one README. `flat=True` is the copy that ships inside the generated
    adapter, where the discipline folders are gone and a relative link to a sibling
    item would dangle; those become plain repo paths instead of links."""
    def link(text: str, href: str) -> str:
        return f"`{text}`" if flat else f"[{text}]({href})"

    out: list[str] = [f"# {m['label']}", "", m["meta"], ""]
    if m["lead"]:
        out += [m["lead"], ""]

    out += ["## When it fires", "", m["fires"] or "_Not stated in the source file._", ""]
    if m["phrases"]:
        out += ["It is written to trigger on: " +
                ", ".join(f"`{p}`" for p in m["phrases"]) + ".", ""]

    out += ["## What it produces", ""]
    if m["kind"] == "skill":
        out += [m["produces"] or "_Not stated in the source file._", ""]
    else:
        out += ["Writes " + ", ".join(f"`{p}`" for p in m["produces"]) + "."
                if m["produces"] else "_Nothing declared._", ""]
        if m.get("consumes"):
            out += ["Reads " + ", ".join(f"`{c}`" for c in m["consumes"]) + ".", ""]

    if m["kind"] == "skill":
        n = len(m["holders"])
        out += [f"## Which agents hold it ({n})", ""]
        if n:
            out += ["A skill is never invoked on its own — an agent loads it. These hold it:", ""]
            for h in m["holders"]:
                gates = (" — owns " + ", ".join(h["owns_gates"])) if h["owns_gates"] else ""
                out.append(f"- {link(h['label'], h['md'])}{gates}")
            out.append("")
            if m["gates"]:
                out += ["Through them it is reachable from gates " +
                        ", ".join(f"`{g}`" for g in m["gates"]) + ".", ""]
        else:
            out += ["**No agent holds this skill.** Nothing in the lifecycle will load it.", ""]
    else:
        out += ["## Phases and gates it owns", ""]
        out += ["- ADLC phases: " + (", ".join(str(p) for p in m["phases"]) or "none"),
                "- Gates: " + (", ".join(f"`{g}`" for g in m["owns_gates"])
                               if m["owns_gates"]
                               else "none — it enforces the gates the persona agents own"),
                ""]
        out += [f"## Skills it holds ({len(m['held'])})", ""]
        out += ["It loads these rather than working from memory, and records which it used "
                "in the handoff envelope:", ""]
        for h in m["held"]:
            out.append(f"- {link(h['label'], h['md'])} — `{h['discipline']}`")
        out.append("")
        out += ["## When it stops and asks a human", ""]
        for e in m["escalates"]:
            out.append(f"- {e}")
        out.append("")
        if m["handoff_to"]:
            out += ["## Hands off to", "",
                    ", ".join(h["label"] for h in m["handoff_to"]) + ".", ""]

    out += ["## Install", "", "### This " + m["kind"] + " on its own", "",
            _fence(m["install_alone"]["steps"]), "", m["install_alone"]["note"], "",
            "### The whole framework", "", INSTALL_FRAMEWORK["intro"], "",
            _fence(INSTALL_FRAMEWORK["steps"]), "", INSTALL_FRAMEWORK["note"], ""]

    out += ["## Where the rules live", "",
            f"This README is a summary and carries no rules. "
            f"{link(m['authority']['md'], m['authority']['md'])} is the authority — it holds "
            f"{m['authority']['what']}. Nothing from it is repeated here, so the two cannot "
            f"disagree.", ""]

    out += ["## Notes", "", NOTES_BEGIN, "", NOTES_PLACEHOLDER, "", NOTES_END, "",
            "---", "", README_STAMP, ""]
    return "\n".join(out)


def _carry_notes(existing: str, generated: str) -> str:
    """Keep whatever a human wrote between the NOTES markers of the previous file."""
    if NOTES_BEGIN not in existing or NOTES_END not in existing:
        return generated
    old = existing.split(NOTES_BEGIN, 1)[1].split(NOTES_END, 1)[0]
    if not old.strip() or NOTES_PLACEHOLDER in old:
        return generated
    head, rest = generated.split(NOTES_BEGIN, 1)
    tail = rest.split(NOTES_END, 1)[1]
    return head + NOTES_BEGIN + old + NOTES_END + tail


def write_readmes(root: Path, data: dict) -> list[Path]:
    """Write skills/*/*/README.md and agents/*/README.md. Returns what changed."""
    models = readme_models(data)
    by_name = {e["name"]: e for e in data["agents"] + data["skills"]}
    changed: list[Path] = []
    for name, m in sorted(models.items()):
        target = root / Path(by_name[name]["path"]).parent / "README.md"
        text = readme_markdown(m)
        try:
            previous = target.read_text(encoding="utf-8")
        except OSError:
            previous = ""
        text = _carry_notes(previous, text)
        if previous != text:
            try:
                target.write_text(text, encoding="utf-8")
            except OSError as exc:
                raise CatalogueError(f"cannot write {target}: {exc}") from exc
            changed.append(target)
    return changed


# --------------------------------------------------------------------------- injection


def _render_block(data: dict) -> str:
    payload = json.dumps(data, indent=1, sort_keys=False, ensure_ascii=False)
    # `</script>` inside a JSON string would close the block early; no current value
    # contains one, but the escape costs nothing and removes the failure mode.
    payload = payload.replace("</", "<\\/")
    return f"{BEGIN}\n{SCRIPT_OPEN}\n{payload}\n{SCRIPT_CLOSE}\n{END}"


def inject(root: Path, data: dict, *, check_only: bool = False) -> bool:
    page = root / "docs" / "index.html"
    try:
        html = page.read_text(encoding="utf-8")
    except OSError as exc:
        raise CatalogueError(f"cannot read {page}: {exc}") from exc

    start, stop = html.find(BEGIN), html.find(END)
    if start == -1 or stop == -1 or stop < start:
        raise CatalogueError(
            f"{page} has no `{BEGIN}` / `{END}` pair — the page must carry both markers"
        )

    updated = html[:start] + _render_block(data) + html[stop + len(END):]
    if updated == html:
        return False
    if not check_only:
        page.write_text(updated, encoding="utf-8")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("root", nargs="?", default=".", help="repository root (default: .)")
    parser.add_argument("--inject", action="store_true",
                        help="rewrite the generated block in docs/index.html")
    parser.add_argument("--check", action="store_true",
                        help="exit non-zero if docs/index.html is stale")
    parser.add_argument("--readmes", action="store_true",
                        help="write skills/*/*/README.md and agents/*/README.md")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    try:
        data = build(root)
        if args.readmes:
            changed = write_readmes(root, data)
            c = data["counts"]
            print(f"readmes: {c['agents'] + c['skills']} written, {len(changed)} changed")
            for path in changed[:5]:
                print(f"  {path.relative_to(root).as_posix()}")
            if len(changed) > 5:
                print(f"  … {len(changed) - 5} more")
            if not (args.inject or args.check):
                return 0
        if args.check:
            if inject(root, data, check_only=True):
                print("docs/index.html is stale — run: python3 scripts/build_catalogue.py --inject",
                      file=sys.stderr)
                return 1
            print("docs/index.html catalogue is up to date")
            return 0
        if args.inject:
            changed = inject(root, data)
            c = data["counts"]
            print(f"{'updated' if changed else 'unchanged'}: docs/index.html "
                  f"({c['agents']} agents, {c['skills']} skills, {c['disciplines']} disciplines)")
            return 0
        json.dump(data, sys.stdout, indent=1, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    except CatalogueError as exc:
        print(f"build_catalogue: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
