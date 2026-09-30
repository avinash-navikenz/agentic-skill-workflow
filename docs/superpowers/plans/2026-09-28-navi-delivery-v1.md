# navi-delivery v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v1 of `navi-delivery` — an installable agentic SDLC framework shipping 10 persona agents and 37 skills, a CLI that scaffolds a governed lifecycle into any repo, and three validators that enforce the framework's own rules mechanically.

**Architecture:** Two trees. The *shipped* tree (`agents/`, `skills/`, `cli/`, `scripts/`) is the plugin. The *scaffolded* tree (`delivery/` inside a consuming repo) is what `navi-delivery init` writes from `templates/delivery/`. A Node CLI owns the lifecycle state machine; Python validators own content compliance. Agents hold judgment, skills hold rules, and `lint_separation.py` is what keeps that true over time.

**Tech Stack:** Node ≥20 (CLI, `node:test` built-in runner, zero runtime deps) · Python ≥3.11 (validators, stdlib `unittest`, PyYAML as the single dev dependency) · Markdown + YAML frontmatter for all content.

**Spec:** `docs/superpowers/specs/2026-09-28-navi-delivery-framework-design.md`

> **Post-execution note (2026-09-30, Task 18).** This plan is the execution record and its
> steps are left as they were written and worked. Three of its stated numbers were overtaken
> during execution and are corrected here rather than rewritten below:
>
> - The Goal says "10 persona agents and 37 skills". **11 agents and 39 skills across 12
>   disciplines** shipped — the Security Engineer was added (spec §10 Q3, answered yes) and
>   brought a `security/` discipline with it.
> - The Goal and the §3.1 tree say "three validators". **Four** shipped:
>   `validate_manifests.py`, `lint_separation.py`, `validate_traceability.py` and
>   `validate_skill_checks.py`.
> - `validate_manifests.py` is described throughout as carrying rules **M1–M6**. It ships
>   **M1–M7**. `M7` enforces that a skill's `metadata.used_by_agents` equals exactly the set
>   of agents listing that skill, reported in both directions because the fix differs by
>   direction. It was added during execution; M4 and M5 could both stay clean while the two
>   sides of that invariant drifted apart.
>
> The reconciled design record is the spec above, revised on the same date.

## Global Constraints

- Skill names MUST match `navi-skill-<descriptive-name>`; agent names MUST match `navi-agent-<persona>`. Verbatim from spec §3.3.
- Every content file carries YAML frontmatter with `name`, `description`, `allowed-tools`, and a `metadata:` block containing `version`, `maturity`, `kind`, `discipline`, `lifecycle_phases`, `owner`, `tags`, `model`. Agents additionally carry `owns_gates`, `skills`, `capabilities`, `consumes`, `produces`, `handoff_to`, `escalate_to_human_when`.
- Every skill `description` MUST end with a sentence beginning `Trigger phrases include:` — house convention, verbatim from spec §3.3.
- `kind:` is `skill` or `agent`. Agent files are named `<agent-name>.agent.md`; skill files are `SKILL.md`.
- Runtime dependencies: **zero**. Dev dependencies: PyYAML only. Test runners are `node:test` and `unittest`, both stdlib.
- The nine gates are exactly `G1`..`G9`. The four lanes are exactly `express`, `standard`, `full`, `hotfix`.
- The traceability chain is exactly `REQ → AC → ADR → TASK → TEST → SLI → INSIGHT`.
- `owner` metadata value is unresolved (spec §10 open question 1). Use the literal `OWNER_TBD` everywhere; Task 18 sweeps it.
- Adapters under `adapters/` are **generated**. Never hand-edit; `build_adapters.py` is the only writer.

## Review Focus

Five conditions the spec implies but no task's happy path exercises. Each line's test is assigned to the task that owns the code.

1. **`navi-delivery init` run in a repo that already has `delivery/`** — must refuse and leave existing content untouched, never merge or clobber. → Task 7.
2. **A content file with absent, malformed, or non-UTF-8 frontmatter** — validators must report the file and line with a readable message, never raise a traceback. → Task 2.
3. **A hand-edited or truncated `.adlc/state.json`** — the CLI must fail loudly with the offending key, never silently reset to a fresh state and lose gate history. → Task 5.
4. **`gate G4 --pass` recorded on an `express` change, whose lane excludes G4** — must be rejected with the lane's valid gate set, not appended as if valid. → Task 10.
5. **A skill referenced by an agent's `skills:` list that does not exist, and a skill no agent references** — both are referential-integrity failures and must fail the build in each direction. → Task 3.

---

## File Structure

```
navi-delivery/
├── package.json                     Node entry, bin: navi-delivery
├── install.sh                       house install convention, --yes for CI
├── requirements-dev.txt             PyYAML
├── .claude-plugin/plugin.json       harness manifests (hand-written, small)
├── .codex-plugin/plugin.json
├── .cursor-plugin/plugin.json
├── cli/
│   ├── index.js                     argv dispatch, exit codes
│   ├── lib/paths.js                 repo root discovery, delivery/ paths
│   ├── lib/lanes.js                 lane → gate-set table
│   ├── lib/state.js                 .adlc/state.json read/write/validate
│   ├── lib/events.js                .adlc/events.jsonl append/read
│   └── commands/{init,propose,status,gate,validate,archive,doctor}.js
├── scripts/
│   ├── navi_lint/frontmatter.py     parse_frontmatter()
│   ├── navi_lint/registry.py        load_entries()
│   ├── validate_manifests.py        M1–M6 rules
│   ├── lint_separation.py           SEP1–SEP4 rules
│   ├── validate_traceability.py     orphan detection
│   ├── build_adapters.py            manifest projection
│   └── golden_path.py               end-to-end CI fixture
├── templates/delivery/              the scaffold payload
├── agents/navi-agent-*/             10 agents
├── skills/<discipline>/navi-skill-*/  37 skills
└── tests/
    ├── cli/*.test.js                node:test
    └── lint/test_*.py               unittest
```

---

### Task 1: Repo scaffold and test infrastructure

**Files:**
- Create: `package.json`, `requirements-dev.txt`, `.gitignore`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`
- Create: `cli/index.js`, `scripts/navi_lint/__init__.py`
- Test: `tests/cli/smoke.test.js`, `tests/lint/test_smoke.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs `node --test tests/cli/`; `python3 -m unittest discover -s tests/lint` runs Python tests. `node cli/index.js --version` prints the version from `package.json`.

- [ ] **Step 1: Write the failing test**

`tests/cli/smoke.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const pkg = require("../../package.json");

test("--version prints package version", () => {
  const out = execFileSync("node", ["cli/index.js", "--version"], { encoding: "utf8" });
  assert.strictEqual(out.trim(), pkg.version);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/cli/smoke.test.js`
Expected: FAIL — `Cannot find module '../../package.json'`.

- [ ] **Step 3: Write package.json and the CLI stub**

`package.json`:
```json
{
  "name": "navi-delivery",
  "version": "0.1.0",
  "description": "Agentic SDLC framework — plan to monitor, in any harness",
  "bin": { "navi-delivery": "cli/index.js" },
  "scripts": { "test": "node --test tests/cli/" },
  "license": "UNLICENSED",
  "private": true,
  "engines": { "node": ">=20" }
}
```

`cli/index.js`:
```js
#!/usr/bin/env node
"use strict";
const pkg = require("../package.json");

function main(argv) {
  if (argv.includes("--version")) { process.stdout.write(pkg.version + "\n"); return 0; }
  process.stderr.write("usage: navi-delivery <command>\n");
  return 1;
}
process.exit(main(process.argv.slice(2)));
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/cli/smoke.test.js`
Expected: PASS.

- [ ] **Step 5: Add the Python side**

`requirements-dev.txt`:
```
PyYAML>=6.0
```

`scripts/navi_lint/__init__.py`: empty file.

`tests/lint/test_smoke.py`:
```python
import unittest
from pathlib import Path

class TestLayout(unittest.TestCase):
    def test_package_importable(self):
        root = Path(__file__).resolve().parents[2]
        self.assertTrue((root / "scripts" / "navi_lint" / "__init__.py").exists())

if __name__ == "__main__":
    unittest.main()
```

Run: `python3 -m unittest discover -s tests/lint -v`
Expected: PASS.

- [ ] **Step 6: Write the three plugin manifests**

`.claude-plugin/plugin.json` (the other two are the same shape with `name` unchanged):
```json
{
  "name": "navi-delivery",
  "description": "Agentic SDLC framework: persona agents over best-practice skills, plan to monitor",
  "version": "0.1.0",
  "author": { "name": "Navikenz" },
  "keywords": ["sdlc", "adlc", "spec-driven", "agents", "skills"]
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json requirements-dev.txt .gitignore .claude-plugin .codex-plugin .cursor-plugin cli scripts tests
git commit -m "chore: scaffold navi-delivery repo and test runners"
```

---

### Task 2: Frontmatter parser and content registry

**Files:**
- Create: `scripts/navi_lint/frontmatter.py`, `scripts/navi_lint/registry.py`
- Test: `tests/lint/test_frontmatter.py`, `tests/lint/test_registry.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parse_frontmatter(path: Path) -> tuple[dict, str]` returning `(meta, body)`. Raises `FrontmatterError(path, line, message)`.
  - `class FrontmatterError(Exception)` with attributes `path`, `line`, `message`.
  - `@dataclass Entry: name: str; kind: str; path: Path; meta: dict; body: str`
  - `load_entries(root: Path) -> list[Entry]` — walks `agents/**/*.agent.md` and `skills/**/SKILL.md`.

- [ ] **Step 1: Write the failing tests**

`tests/lint/test_frontmatter.py`:
```python
import unittest, tempfile
from pathlib import Path
from scripts.navi_lint.frontmatter import parse_frontmatter, FrontmatterError

def write(tmp, text, name="SKILL.md"):
    p = Path(tmp) / name
    p.write_text(text, encoding="utf-8")
    return p

class TestParse(unittest.TestCase):
    def test_parses_meta_and_body(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "---\nname: navi-skill-x\nmetadata:\n  kind: skill\n---\n\n# Body\ntext\n")
            meta, body = parse_frontmatter(p)
            self.assertEqual(meta["name"], "navi-skill-x")
            self.assertEqual(meta["metadata"]["kind"], "skill")
            self.assertIn("# Body", body)

    def test_missing_frontmatter_raises_readable_error(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "# Just a heading\n")
            with self.assertRaises(FrontmatterError) as cm:
                parse_frontmatter(p)
            self.assertEqual(cm.exception.line, 1)
            self.assertIn("no frontmatter", cm.exception.message)

    def test_unterminated_frontmatter_raises(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "---\nname: x\n")
            with self.assertRaises(FrontmatterError) as cm:
                parse_frontmatter(p)
            self.assertIn("unterminated", cm.exception.message)

    def test_malformed_yaml_raises_with_line(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "---\nname: [unclosed\n---\nbody\n")
            with self.assertRaises(FrontmatterError):
                parse_frontmatter(p)

    def test_crlf_and_non_ascii_survive(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "---\r\nname: navi-skill-café\r\n---\r\nbody — dash\r\n")
            meta, body = parse_frontmatter(p)
            self.assertEqual(meta["name"], "navi-skill-café")
            self.assertIn("—", body)

    def test_non_utf8_bytes_raise_frontmatter_error(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / "SKILL.md"
            p.write_bytes(b"---\nname: \xff\xfe\n---\nbody\n")
            with self.assertRaises(FrontmatterError) as cm:
                parse_frontmatter(p)
            self.assertIn("not valid UTF-8", cm.exception.message)

if __name__ == "__main__":
    unittest.main()
```

> These six cases are Review Focus item 2: no input shape may produce a traceback.

- [ ] **Step 2: Run them and watch them fail**

Run: `python3 -m unittest tests.lint.test_frontmatter -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.navi_lint.frontmatter'`.

- [ ] **Step 3: Implement the parser**

`scripts/navi_lint/frontmatter.py`:
```python
"""Parse YAML frontmatter from a markdown file, with readable errors."""
from pathlib import Path
import yaml

class FrontmatterError(Exception):
    def __init__(self, path: Path, line: int, message: str):
        super().__init__(f"{path}:{line}: {message}")
        self.path, self.line, self.message = path, line, message

def parse_frontmatter(path: Path) -> tuple[dict, str]:
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise FrontmatterError(path, 1, "file is not valid UTF-8")
    text = raw.replace("\r\n", "\n")
    if not text.startswith("---\n"):
        raise FrontmatterError(path, 1, "no frontmatter: file must begin with '---'")
    end = text.find("\n---\n", 3)
    if end == -1:
        raise FrontmatterError(path, text.count("\n") + 1, "unterminated frontmatter: no closing '---'")
    block, body = text[4:end + 1], text[end + 5:]
    try:
        meta = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        line = (mark.line + 2) if mark else 1
        raise FrontmatterError(path, line, f"invalid YAML in frontmatter: {getattr(exc, 'problem', exc)}")
    if not isinstance(meta, dict):
        raise FrontmatterError(path, 1, "frontmatter must be a YAML mapping")
    return meta, body
```

- [ ] **Step 4: Run and watch them pass**

Run: `python3 -m unittest tests.lint.test_frontmatter -v`
Expected: 6 tests PASS.

- [ ] **Step 5: Write the registry test**

`tests/lint/test_registry.py`:
```python
import unittest, tempfile
from pathlib import Path
from scripts.navi_lint.registry import load_entries

SKILL = "---\nname: navi-skill-alpha\nmetadata:\n  kind: skill\n---\nbody\n"
AGENT = "---\nname: navi-agent-architect\nmetadata:\n  kind: agent\n---\nbody\n"

class TestRegistry(unittest.TestCase):
    def test_discovers_both_kinds(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            sd = root / "skills" / "architecture" / "navi-skill-alpha"; sd.mkdir(parents=True)
            (sd / "SKILL.md").write_text(SKILL, encoding="utf-8")
            ad = root / "agents" / "navi-agent-architect"; ad.mkdir(parents=True)
            (ad / "navi-agent-architect.agent.md").write_text(AGENT, encoding="utf-8")
            entries = load_entries(root)
            self.assertEqual({e.kind for e in entries}, {"skill", "agent"})
            self.assertEqual({e.name for e in entries}, {"navi-skill-alpha", "navi-agent-architect"})

    def test_empty_tree_returns_empty_list(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(load_entries(Path(t)), [])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 6: Implement the registry**

`scripts/navi_lint/registry.py`:
```python
"""Discover every agent and skill file under a navi-delivery repo root."""
from dataclasses import dataclass
from pathlib import Path
from .frontmatter import parse_frontmatter

@dataclass
class Entry:
    name: str
    kind: str
    path: Path
    meta: dict
    body: str

def load_entries(root: Path) -> list[Entry]:
    found: list[Entry] = []
    for path in sorted(root.glob("skills/*/*/SKILL.md")):
        meta, body = parse_frontmatter(path)
        found.append(Entry(meta.get("name", ""), (meta.get("metadata") or {}).get("kind", ""), path, meta, body))
    for path in sorted(root.glob("agents/*/*.agent.md")):
        meta, body = parse_frontmatter(path)
        found.append(Entry(meta.get("name", ""), (meta.get("metadata") or {}).get("kind", ""), path, meta, body))
    return found
```

- [ ] **Step 7: Run the whole Python suite and commit**

Run: `python3 -m unittest discover -s tests/lint -v`
Expected: all PASS.

```bash
git add scripts/navi_lint tests/lint
git commit -m "feat: frontmatter parser and content registry with readable errors"
```

---

### Task 3: validate_manifests.py

**Files:**
- Create: `scripts/validate_manifests.py`
- Test: `tests/lint/test_validate_manifests.py`

**Interfaces:**
- Consumes: `load_entries()`, `Entry` from Task 2.
- Produces: `check(entries: list[Entry]) -> list[Finding]` where `Finding = namedtuple("Finding", "rule path message")`. Module runs as `python3 scripts/validate_manifests.py [root]`, exit 0 clean / 1 on findings.

Rules: **M1** frontmatter parses (inherited from Task 2) · **M2** required keys present for the kind · **M3** `name` matches directory name and the `navi-skill-`/`navi-agent-` prefix for its kind · **M4** every name in an agent's `skills:` resolves to a real skill · **M5** every skill is named by at least one agent · **M6** a skill's `description` contains `Trigger phrases include:`.

- [ ] **Step 1: Write the failing tests**

`tests/lint/test_validate_manifests.py`:
```python
import unittest
from pathlib import Path
from scripts.navi_lint.registry import Entry
from scripts.validate_manifests import check

def skill(name="navi-skill-alpha", desc="Use when x. Trigger phrases include: alpha.", **meta):
    m = {"version": "0.1.0", "maturity": "draft", "kind": "skill", "discipline": "architecture",
         "lifecycle_phases": [3], "owner": "OWNER_TBD", "tags": "a", "model": "sonnet"}
    m.update(meta)
    return Entry(name, "skill", Path(f"skills/architecture/{name}/SKILL.md"),
                 {"name": name, "description": desc, "allowed-tools": "Read", "metadata": m}, "body")

def agent(name="navi-agent-architect", skills=("navi-skill-alpha",)):
    m = {"version": "0.1.0", "maturity": "draft", "kind": "agent", "discipline": "architecture",
         "lifecycle_phases": [3], "owner": "OWNER_TBD", "tags": "a", "model": "opus"}
    return Entry(name, "agent", Path(f"agents/{name}/{name}.agent.md"),
                 {"name": name, "description": "Use when architecting.", "allowed-tools": "Read",
                  "metadata": m, "skills": list(skills), "owns_gates": ["G3"],
                  "capabilities": ["read_file"], "consumes": [], "produces": [],
                  "handoff_to": [], "escalate_to_human_when": ["conflict"]}, "body")

def rules(findings):
    return sorted({f.rule for f in findings})

class TestManifests(unittest.TestCase):
    def test_clean_pair_has_no_findings(self):
        self.assertEqual(check([skill(), agent()]), [])

    def test_M2_missing_required_metadata_key(self):
        s = skill(); del s.meta["metadata"]["model"]
        self.assertIn("M2", rules(check([s, agent()])))

    def test_M3_name_prefix_wrong_for_kind(self):
        s = skill(name="navi-agent-alpha")
        self.assertIn("M3", rules(check([s, agent(skills=("navi-agent-alpha",))])))

    def test_M3_name_does_not_match_directory(self):
        s = skill()
        s.path = Path("skills/architecture/navi-skill-beta/SKILL.md")
        self.assertIn("M3", rules(check([s, agent()])))

    def test_M4_agent_references_missing_skill(self):
        findings = check([skill(), agent(skills=("navi-skill-ghost",))])
        self.assertIn("M4", rules(findings))
        self.assertTrue(any("navi-skill-ghost" in f.message for f in findings))

    def test_M5_orphan_skill_referenced_by_nobody(self):
        findings = check([skill(), skill(name="navi-skill-lonely"), agent()])
        self.assertIn("M5", rules(findings))
        self.assertTrue(any("navi-skill-lonely" in f.message for f in findings))

    def test_M6_skill_description_missing_trigger_phrases(self):
        s = skill(desc="Use when x.")
        self.assertIn("M6", rules(check([s, agent()])))

if __name__ == "__main__":
    unittest.main()
```

> `test_M4_...` and `test_M5_...` together are Review Focus item 5 — referential integrity is checked in both directions.

- [ ] **Step 2: Run and watch them fail**

Run: `python3 -m unittest tests.lint.test_validate_manifests -v`
Expected: FAIL — `No module named 'scripts.validate_manifests'`.

- [ ] **Step 3: Implement**

`scripts/validate_manifests.py`:
```python
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
```

- [ ] **Step 4: Run and watch them pass**

Run: `python3 -m unittest tests.lint.test_validate_manifests -v`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate_manifests.py tests/lint/test_validate_manifests.py
git commit -m "feat: validate_manifests with M1-M6 rules and two-way referential integrity"
```

---

### Task 4: lint_separation.py — the separation law

**Files:**
- Create: `scripts/lint_separation.py`
- Test: `tests/lint/test_lint_separation.py`

**Interfaces:**
- Consumes: `Entry` from Task 2.
- Produces: `separation_findings(entry: Entry) -> list[Finding]` reusing `Finding` from Task 3. Runs as `python3 scripts/lint_separation.py [root]`, exit 0/1.

Rules: **SEP1** an agent body contains a numbered procedure (`^\s*\d+\.\s`) · **SEP2** an agent body contains a `## Template` or `## Checklist` heading · **SEP3** a skill body uses persona voice (`as the <Persona>,` / `you should weigh` / `in my judgment`) · **SEP4** a skill body uses first person (`^I ` or ` I `).

- [ ] **Step 1: Write the failing tests**

`tests/lint/test_lint_separation.py`:
```python
import unittest
from pathlib import Path
from scripts.navi_lint.registry import Entry
from scripts.lint_separation import separation_findings

def ent(kind, body):
    name = "navi-agent-architect" if kind == "agent" else "navi-skill-alpha"
    return Entry(name, kind, Path(f"{kind}s/{name}/x.md"), {"name": name}, body)

def rules(fs):
    return sorted({f.rule for f in fs})

class TestSeparation(unittest.TestCase):
    def test_clean_agent_passes(self):
        body = "## Mission\nOwn the design.\n\n## How I decide\nFavour reversible choices.\n"
        self.assertEqual(separation_findings(ent("agent", body)), [])

    def test_clean_skill_passes(self):
        body = "## Rules\n- Record every decision.\n\n## Anti-patterns\n- Undated ADRs.\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

    def test_SEP1_numbered_procedure_in_agent(self):
        body = "## Mission\nOwn it.\n\n1. Open the file\n2. Edit the header\n"
        self.assertIn("SEP1", rules(separation_findings(ent("agent", body))))

    def test_SEP2_template_heading_in_agent(self):
        self.assertIn("SEP2", rules(separation_findings(ent("agent", "## Template\n```\nx\n```\n"))))

    def test_SEP2_checklist_heading_in_agent(self):
        self.assertIn("SEP2", rules(separation_findings(ent("agent", "## Checklist\n- [ ] x\n"))))

    def test_SEP3_persona_voice_in_skill(self):
        body = "## Rules\nAs the Architect, weigh coupling against delivery speed.\n"
        self.assertIn("SEP3", rules(separation_findings(ent("skill", body))))

    def test_SEP4_first_person_in_skill(self):
        self.assertIn("SEP4", rules(separation_findings(ent("skill", "## Rules\nI prefer small ADRs.\n"))))

    def test_numbered_list_in_skill_is_allowed(self):
        body = "## Rules\n1. Number every requirement\n2. Keep one per line\n"
        self.assertEqual(separation_findings(ent("skill", body)), [])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run and watch them fail**

Run: `python3 -m unittest tests.lint.test_lint_separation -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`scripts/lint_separation.py`:
```python
"""Enforce the separation law: judgment lives in agents, rules live in skills."""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.navi_lint.registry import Entry, load_entries
from scripts.validate_manifests import Finding

NUMBERED = re.compile(r"^\s*\d+\.\s+\S", re.M)
PROC_HEADING = re.compile(r"^##+\s*(Template|Checklist)\b", re.M | re.I)
PERSONA_VOICE = re.compile(
    r"\bas the (Architect|Product Owner|Business Analyst|Developer|Data Engineer|"
    r"ML Engineer|MLOps Engineer|DevOps Engineer|QA Engineer)\b|\byou should weigh\b|\bin my judgment\b",
    re.I)
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
```

- [ ] **Step 4: Run and watch them pass**

Run: `python3 -m unittest tests.lint.test_lint_separation -v`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lint_separation.py tests/lint/test_lint_separation.py
git commit -m "feat: lint_separation enforcing SEP1-SEP4"
```

---

### Task 5: CLI library — paths, lanes, state, events

**Files:**
- Create: `cli/lib/paths.js`, `cli/lib/lanes.js`, `cli/lib/state.js`, `cli/lib/events.js`
- Test: `tests/cli/lib.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `paths.js`: `deliveryDir(root) -> string`, `adlcDir(root) -> string`, `statePath(root)`, `eventsPath(root)`, `waiversPath(root)`, `changeDir(root, name)`.
  - `lanes.js`: `LANES` (frozen object), `gatesForLane(lane) -> string[]`, `isLane(v) -> boolean`, `ALL_GATES` (`["G1".."G9"]`).
  - `state.js`: `readState(root) -> State`, `writeState(root, state) -> void`, `newState() -> State`. `State = {version:1, change:string|null, lane:string|null, phase:number, gates:{[gate]:"pass"|"fail"}, stale:string[]}`. Throws `StateError` on a malformed file.
  - `events.js`: `appendEvent(root, evt) -> void`, `readEvents(root) -> object[]`.

- [ ] **Step 1: Write the failing tests**

`tests/cli/lib.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const lanes = require("../../cli/lib/lanes");
const state = require("../../cli/lib/state");
const events = require("../../cli/lib/events");

function tmpRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-"));
  fs.mkdirSync(path.join(root, "delivery", ".adlc"), { recursive: true });
  return root;
}

test("every lane maps to a non-empty gate subset of G1..G9", () => {
  for (const name of Object.keys(lanes.LANES)) {
    const gates = lanes.gatesForLane(name);
    assert.ok(gates.length > 0, `${name} has no gates`);
    for (const g of gates) assert.ok(lanes.ALL_GATES.includes(g), `${name}: bad gate ${g}`);
  }
});

test("express is the lightest lane and full is every gate", () => {
  assert.deepStrictEqual(lanes.gatesForLane("express"), ["G2", "G6", "G7"]);
  assert.deepStrictEqual(lanes.gatesForLane("full"), lanes.ALL_GATES);
});

test("unknown lane is rejected", () => {
  assert.strictEqual(lanes.isLane("standrd"), false);
  assert.throws(() => lanes.gatesForLane("standrd"), /unknown lane 'standrd'/);
});

test("state round-trips", () => {
  const root = tmpRepo();
  const s = state.newState();
  s.change = "add-dark-mode"; s.lane = "standard"; s.phase = 3;
  state.writeState(root, s);
  assert.deepStrictEqual(state.readState(root), s);
});

test("corrupt state.json fails loudly and never resets silently", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"), "{ not json");
  assert.throws(() => state.readState(root), /state\.json is not valid JSON/);
});

test("state.json missing a required key names that key", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: "x", lane: "full" }));
  assert.throws(() => state.readState(root), /missing required key 'phase'/);
});

test("events append as one JSON object per line", () => {
  const root = tmpRepo();
  events.appendEvent(root, { gate: "G2", verdict: "pass" });
  events.appendEvent(root, { gate: "G6", verdict: "fail" });
  const all = events.readEvents(root);
  assert.strictEqual(all.length, 2);
  assert.strictEqual(all[1].gate, "G6");
  assert.ok(all[0].ts, "event must be timestamped");
});
```

> The two corrupt-state tests are Review Focus item 3.

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/cli/lib.test.js`
Expected: FAIL — `Cannot find module '../../cli/lib/lanes'`.

- [ ] **Step 3: Implement the four modules**

`cli/lib/paths.js`:
```js
"use strict";
const path = require("node:path");
const deliveryDir = (root) => path.join(root, "delivery");
const adlcDir = (root) => path.join(deliveryDir(root), ".adlc");
module.exports = {
  deliveryDir, adlcDir,
  statePath: (root) => path.join(adlcDir(root), "state.json"),
  eventsPath: (root) => path.join(adlcDir(root), "events.jsonl"),
  waiversPath: (root) => path.join(adlcDir(root), "waivers.md"),
  changeDir: (root, name) => path.join(deliveryDir(root), "changes", name),
};
```

`cli/lib/lanes.js`:
```js
"use strict";
const ALL_GATES = Object.freeze(["G1","G2","G3","G4","G5","G6","G7","G8","G9"]);
const LANES = Object.freeze({
  express:  { gates: ["G2","G6","G7"], when: "copy, config, flag flip" },
  standard: { gates: ["G1","G2","G3","G5","G6","G7","G8"], when: "most features and bugs" },
  full:     { gates: [...ALL_GATES], when: "new capability, regulated, or any ML" },
  hotfix:   { gates: ["G6","G7"], when: "production incident", deferred: ["G2"], mandatory: ["G9"] },
});
const isLane = (v) => Object.prototype.hasOwnProperty.call(LANES, v);
function gatesForLane(lane) {
  if (!isLane(lane)) {
    throw new Error(`unknown lane '${lane}' — valid lanes: ${Object.keys(LANES).join(", ")}`);
  }
  return LANES[lane].gates;
}
module.exports = { ALL_GATES, LANES, isLane, gatesForLane };
```

`cli/lib/state.js`:
```js
"use strict";
const fs = require("node:fs");
const { statePath, adlcDir } = require("./paths");

class StateError extends Error {}
const REQUIRED = ["version", "change", "lane", "phase", "gates", "stale"];

const newState = () => ({ version: 1, change: null, lane: null, phase: 1, gates: {}, stale: [] });

function readState(root) {
  const p = statePath(root);
  if (!fs.existsSync(p)) return newState();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    throw new StateError(`${p}: state.json is not valid JSON — refusing to reset; fix or delete it`);
  }
  for (const key of REQUIRED) {
    if (!(key in parsed)) throw new StateError(`${p}: missing required key '${key}'`);
  }
  return parsed;
}

function writeState(root, state) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  fs.writeFileSync(statePath(root), JSON.stringify(state, null, 2) + "\n");
}

module.exports = { newState, readState, writeState, StateError };
```

`cli/lib/events.js`:
```js
"use strict";
const fs = require("node:fs");
const { eventsPath, adlcDir } = require("./paths");

function appendEvent(root, evt) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  const record = { ts: new Date().toISOString(), ...evt };
  fs.appendFileSync(eventsPath(root), JSON.stringify(record) + "\n");
}

function readEvents(root) {
  const p = eventsPath(root);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

module.exports = { appendEvent, readEvents };
```

- [ ] **Step 4: Run and watch them pass**

Run: `node --test tests/cli/lib.test.js`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/lib tests/cli/lib.test.js
git commit -m "feat: CLI lib for paths, lanes, state and events"
```

---

### Task 6: CLI dispatcher and `doctor`

**Files:**
- Modify: `cli/index.js`
- Create: `cli/commands/doctor.js`, `cli/lib/capabilities.js`
- Test: `tests/cli/doctor.test.js`

**Interfaces:**
- Consumes: nothing from Task 5.
- Produces: `cli/index.js` exports `main(argv) -> number`. Each command module exports `run(argv, cwd) -> number`. `capabilities.js` exports `CAPABILITIES` — an array of `{name, claude_code, codex, cursor, fallback}` — and `detectHarness(env) -> "claude-code"|"codex"|"cursor"|"generic"`.

- [ ] **Step 1: Write the failing test**

`tests/cli/doctor.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const { CAPABILITIES, detectHarness } = require("../../cli/lib/capabilities");
const doctor = require("../../cli/commands/doctor");

test("every capability declares a fallback", () => {
  assert.ok(CAPABILITIES.length >= 6);
  for (const c of CAPABILITIES) {
    assert.ok(c.fallback && c.fallback.length > 0, `${c.name} has no fallback`);
  }
});

test("harness detection falls back to generic", () => {
  assert.strictEqual(detectHarness({ CLAUDECODE: "1" }), "claude-code");
  assert.strictEqual(detectHarness({}), "generic");
});

test("doctor exits 0 and names the harness", () => {
  const lines = [];
  const code = doctor.run([], process.cwd(), (s) => lines.push(s));
  assert.strictEqual(code, 0);
  assert.ok(lines.join("\n").includes("harness:"));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/cli/doctor.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement capabilities and doctor**

`cli/lib/capabilities.js`:
```js
"use strict";
const CAPABILITIES = Object.freeze([
  { name: "read_file",      claude_code: "Read",            codex: "file read",  cursor: "file read",  fallback: "ask the human to paste the file" },
  { name: "write_file",     claude_code: "Write",           codex: "file write", cursor: "file write", fallback: "emit the file in a fenced block" },
  { name: "run_command",    claude_code: "Bash",            codex: "shell",      cursor: "shell",      fallback: "ask the human to run it and paste output" },
  { name: "search",         claude_code: "Grep/Glob",       codex: "search",     cursor: "search",     fallback: "ask for the relevant paths" },
  { name: "ask_human",      claude_code: "AskUserQuestion", codex: "prompt",     cursor: "prompt",     fallback: "ask a plain question, then wait" },
  { name: "spawn_subagent", claude_code: "Agent",           codex: null,         cursor: null,         fallback: "adopt the persona sequentially in this session" },
]);

function detectHarness(env) {
  if (env.CLAUDECODE || env.CLAUDE_PLUGIN_ROOT) return "claude-code";
  if (env.CODEX_HOME) return "codex";
  if (env.CURSOR_TRACE_ID) return "cursor";
  return "generic";
}
module.exports = { CAPABILITIES, detectHarness };
```

`cli/commands/doctor.js`:
```js
"use strict";
const { CAPABILITIES, detectHarness } = require("../lib/capabilities");

function run(argv, cwd, emit = console.log) {
  const harness = detectHarness(process.env);
  emit(`harness: ${harness}`);
  emit("");
  for (const c of CAPABILITIES) {
    const native = harness === "generic" ? null : c[harness.replace("-", "_")];
    emit(native ? `  native   ${c.name} -> ${native}` : `  fallback ${c.name} -> ${c.fallback}`);
  }
  return 0;
}
module.exports = { run };
```

- [ ] **Step 4: Wire the dispatcher**

Replace `cli/index.js`:
```js
#!/usr/bin/env node
"use strict";
const pkg = require("../package.json");

const COMMANDS = {
  init:    () => require("./commands/init"),
  propose: () => require("./commands/propose"),
  status:  () => require("./commands/status"),
  gate:    () => require("./commands/gate"),
  validate:() => require("./commands/validate"),
  archive: () => require("./commands/archive"),
  doctor:  () => require("./commands/doctor"),
};

function main(argv) {
  if (argv.includes("--version")) { process.stdout.write(pkg.version + "\n"); return 0; }
  const [name, ...rest] = argv;
  if (!name || !COMMANDS[name]) {
    process.stderr.write(`usage: navi-delivery <${Object.keys(COMMANDS).join("|")}>\n`);
    return 1;
  }
  try {
    return COMMANDS[name]().run(rest, process.cwd());
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main };
```

> Commands not yet written will throw on require; Tasks 7–12 add them. Keep `tests/cli/smoke.test.js` green by running `--version` before dispatch, as above.

- [ ] **Step 5: Run and watch them pass**

Run: `node --test tests/cli/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add cli tests/cli/doctor.test.js
git commit -m "feat: CLI dispatcher, capability table and doctor"
```

---

### Task 7: `init` and the scaffold payload

**Files:**
- Create: `cli/commands/init.js`, `templates/delivery/project.md`, `templates/delivery/AGENTS.md`, `templates/delivery/.adlc/waivers.md`, `templates/delivery/.gitkeep` files for `specs/`, `changes/archive/`, `decisions/`, `ops/runbooks/`, `ops/postmortems/`
- Test: `tests/cli/init.test.js`

**Interfaces:**
- Consumes: `paths.js`, `state.js` from Task 5.
- Produces: `run(argv, cwd) -> number`. Exit 0 on success, 1 if `delivery/` already exists.

- [ ] **Step 1: Write the failing tests**

`tests/cli/init.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "nd-init-"));

test("init creates the full delivery tree", () => {
  const root = tmp();
  assert.strictEqual(init.run([], root, () => {}), 0);
  for (const rel of ["project.md", "AGENTS.md", "specs", "changes/archive",
                     "decisions", "ops/runbooks", "ops/postmortems",
                     ".adlc/state.json", ".adlc/waivers.md"]) {
    assert.ok(fs.existsSync(path.join(root, "delivery", rel)), `missing ${rel}`);
  }
});

test("init writes a valid initial state", () => {
  const root = tmp();
  init.run([], root, () => {});
  const s = JSON.parse(fs.readFileSync(path.join(root, "delivery", ".adlc", "state.json"), "utf8"));
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.change, null);
});

test("init refuses when delivery/ exists and leaves content untouched", () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, "delivery"), { recursive: true });
  const sentinel = path.join(root, "delivery", "mine.md");
  fs.writeFileSync(sentinel, "do not touch");
  const lines = [];
  assert.strictEqual(init.run([], root, (s) => lines.push(s)), 1);
  assert.strictEqual(fs.readFileSync(sentinel, "utf8"), "do not touch");
  assert.ok(lines.join("\n").includes("already exists"));
  assert.ok(!fs.existsSync(path.join(root, "delivery", "project.md")));
});
```

> The third test is Review Focus item 1.

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/cli/init.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`cli/commands/init.js`:
```js
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { deliveryDir, adlcDir } = require("../lib/paths");
const { newState, writeState } = require("../lib/state");
const { detectHarness } = require("../lib/capabilities");

const DIRS = ["specs", "changes/archive", "decisions", "ops/runbooks", "ops/postmortems", ".adlc"];
const TEMPLATES = path.join(__dirname, "..", "..", "templates", "delivery");

function copyTemplate(name, dest) {
  fs.writeFileSync(dest, fs.readFileSync(path.join(TEMPLATES, name), "utf8"));
}

function run(argv, cwd, emit = console.log) {
  const dir = deliveryDir(cwd);
  if (fs.existsSync(dir)) {
    emit(`delivery/ already exists at ${dir} — refusing to overwrite. Remove it or run elsewhere.`);
    return 1;
  }
  for (const d of DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });
  for (const d of ["specs", "changes/archive", "decisions", "ops/runbooks", "ops/postmortems"]) {
    fs.writeFileSync(path.join(dir, d, ".gitkeep"), "");
  }
  copyTemplate("project.md", path.join(dir, "project.md"));
  copyTemplate("AGENTS.md", path.join(dir, "AGENTS.md"));
  copyTemplate(path.join(".adlc", "waivers.md"), path.join(adlcDir(cwd), "waivers.md"));
  writeState(cwd, newState());
  emit(`Initialised delivery/ (harness: ${detectHarness(process.env)})`);
  emit("Next: navi-delivery propose <name> --lane standard");
  return 0;
}
module.exports = { run };
```

- [ ] **Step 4: Write the template files**

`templates/delivery/project.md`:
```markdown
# Project context

> Filled in by the team. Agents read this before every phase.

## Stack
<languages, frameworks, datastores, cloud>

## Conventions
<branching, review, deploy cadence>

## Constraints
<regulatory, data residency, SLA commitments>

## Glossary
<domain terms and their exact meaning here>
```

`templates/delivery/.adlc/waivers.md`:
```markdown
# Waivers

Every waived gate is recorded here with a reason and an expiry. A waiver
without an expiry is invalid.

| Date | Change | Gate | Reason | Expires | Approved by |
|------|--------|------|--------|---------|-------------|
```

`templates/delivery/AGENTS.md`: a stub containing the line `<!-- GENERATED by navi-delivery build_adapters -->` — Task 16 replaces its body.

- [ ] **Step 5: Run and watch them pass**

Run: `node --test tests/cli/init.test.js`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/commands/init.js templates tests/cli/init.test.js
git commit -m "feat: init scaffolds delivery/ and refuses to clobber"
```

---

### Task 8: `propose`

**Files:**
- Create: `cli/commands/propose.js`, `templates/change/{proposal.md,design.md,tasks.md,handoffs.md}`
- Test: `tests/cli/propose.test.js`

**Interfaces:**
- Consumes: `lanes.js`, `state.js`, `paths.js`.
- Produces: `run(argv, cwd, emit) -> number`. Usage `propose <name> --lane <lane>`. Sets `state.change`, `state.lane`, `state.phase = 1`.

- [ ] **Step 1: Write the failing tests**

`tests/cli/propose.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const { readState } = require("../../cli/lib/state");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-prop-"));
  init.run([], root, () => {});
  return root;
}

test("propose creates the change folder and records lane", () => {
  const root = repo();
  assert.strictEqual(propose.run(["add-dark-mode", "--lane", "standard"], root, () => {}), 0);
  const dir = path.join(root, "delivery", "changes", "add-dark-mode");
  for (const f of ["proposal.md", "tasks.md", "handoffs.md"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  const s = readState(root);
  assert.strictEqual(s.change, "add-dark-mode");
  assert.strictEqual(s.lane, "standard");
  assert.strictEqual(s.phase, 1);
});

test("proposal.md records the lane and its gate set", () => {
  const root = repo();
  propose.run(["x", "--lane", "express"], root, () => {});
  const text = fs.readFileSync(path.join(root, "delivery", "changes", "x", "proposal.md"), "utf8");
  assert.match(text, /lane: express/);
  assert.match(text, /G2 · G6 · G7/);
});

test("an unknown lane is rejected and lists the valid ones", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["x", "--lane", "standrd"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /unknown lane 'standrd'/);
  assert.match(lines.join("\n"), /express, standard, full, hotfix/);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "x")));
});

test("a duplicate change name is refused", () => {
  const root = repo();
  propose.run(["dup", "--lane", "full"], root, () => {});
  assert.strictEqual(propose.run(["dup", "--lane", "full"], root, () => {}), 1);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/cli/propose.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`cli/commands/propose.js`:
```js
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { changeDir } = require("../lib/paths");
const { readState, writeState } = require("../lib/state");
const { isLane, gatesForLane, LANES } = require("../lib/lanes");

const FILES = ["proposal.md", "design.md", "tasks.md", "handoffs.md"];
const TEMPLATES = path.join(__dirname, "..", "..", "templates", "change");

function run(argv, cwd, emit = console.log) {
  const name = argv[0];
  const laneIdx = argv.indexOf("--lane");
  const lane = laneIdx === -1 ? null : argv[laneIdx + 1];
  if (!name || !lane) { emit("usage: navi-delivery propose <name> --lane <lane>"); return 1; }
  if (!isLane(lane)) {
    emit(`unknown lane '${lane}' — valid lanes: ${Object.keys(LANES).join(", ")}`);
    return 1;
  }
  const dir = changeDir(cwd, name);
  if (fs.existsSync(dir)) { emit(`change '${name}' already exists`); return 1; }
  fs.mkdirSync(path.join(dir, "specs"), { recursive: true });
  const gates = gatesForLane(lane).join(" · ");
  for (const f of FILES) {
    const body = fs.readFileSync(path.join(TEMPLATES, f), "utf8")
      .replace(/\{\{CHANGE\}\}/g, name)
      .replace(/\{\{LANE\}\}/g, lane)
      .replace(/\{\{GATES\}\}/g, gates);
    fs.writeFileSync(path.join(dir, f), body);
  }
  const s = readState(cwd);
  s.change = name; s.lane = lane; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(cwd, s);
  emit(`Created delivery/changes/${name} (lane: ${lane}; gates: ${gates})`);
  return 0;
}
module.exports = { run };
```

`templates/change/proposal.md`:
```markdown
---
change: {{CHANGE}}
lane: {{LANE}}
gates: {{GATES}}
status: proposed
---

# {{CHANGE}}

## Why
<the outcome this change commits to; link the INSIGHT-### or ask that prompted it>

## What changes
<capabilities added, modified or removed>

## Impact
<systems, data, consumers, migrations>

## Non-goals
<explicitly out of scope>
```

`templates/change/tasks.md`:
```markdown
# Tasks — {{CHANGE}}

Each task names the requirement it implements. A task with no `Implements:`
line fails traceability.

- [ ] **TASK-001** <description>
  - Implements: REQ-001
```

`templates/change/handoffs.md`:
```markdown
# Handoffs — {{CHANGE}}

```yaml
- from: navi-agent-business-analyst
  to: navi-agent-architect
  phase: 2 → 3
  artifacts: []
  skills_used: []
  assumptions: []
  open_questions: []
  confidence: medium
```
```

`templates/change/design.md`:
```markdown
# Design — {{CHANGE}}

## Approach
<the technical shape; link ADR-### for anything consequential>

## Alternatives rejected
<what was considered and why it lost>

## Risks
<what could go wrong and the mitigation>
```

- [ ] **Step 4: Run and watch them pass**

Run: `node --test tests/cli/propose.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/commands/propose.js templates/change tests/cli/propose.test.js
git commit -m "feat: propose creates a lane-scoped change"
```

---

### Task 9: `status`

**Files:**
- Create: `cli/commands/status.js`
- Test: `tests/cli/status.test.js`

**Interfaces:**
- Consumes: `state.js`, `lanes.js`, `events.js`.
- Produces: `run(argv, cwd, emit) -> number`. Prints change, lane, phase, per-gate verdict (`pass`/`fail`/`pending`), and any stale artifacts.

- [ ] **Step 1: Write the failing test**

`tests/cli/status.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const status = require("../../cli/commands/status");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-stat-"));
  init.run([], root, () => {});
  return root;
}

test("status on a fresh repo says no active change", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(status.run([], root, (s) => lines.push(s)), 0);
  assert.match(lines.join("\n"), /no active change/i);
});

test("status lists every gate in the lane as pending", () => {
  const root = repo();
  propose.run(["x", "--lane", "express"], root, () => {});
  const lines = [];
  status.run([], root, (s) => lines.push(s));
  const out = lines.join("\n");
  assert.match(out, /change:\s+x/);
  assert.match(out, /lane:\s+express/);
  for (const g of ["G2", "G6", "G7"]) assert.match(out, new RegExp(`${g}\\s+pending`));
  assert.ok(!out.includes("G4"), "gates outside the lane must not be listed");
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/cli/status.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`cli/commands/status.js`:
```js
"use strict";
const { readState } = require("../lib/state");
const { gatesForLane } = require("../lib/lanes");

function run(argv, cwd, emit = console.log) {
  const s = readState(cwd);
  if (!s.change) { emit("no active change — run: navi-delivery propose <name> --lane <lane>"); return 0; }
  emit(`change: ${s.change}`);
  emit(`lane:   ${s.lane}`);
  emit(`phase:  ${s.phase}`);
  emit("");
  for (const g of gatesForLane(s.lane)) emit(`  ${g}  ${s.gates[g] || "pending"}`);
  if (s.stale.length) {
    emit("");
    emit(`stale artifacts (${s.stale.length}) — rework required before validate passes:`);
    for (const a of s.stale) emit(`  ${a}`);
  }
  return 0;
}
module.exports = { run };
```

- [ ] **Step 4: Run and watch it pass**

Run: `node --test tests/cli/status.test.js`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/commands/status.js tests/cli/status.test.js
git commit -m "feat: status reports lane-scoped gate verdicts"
```

---

### Task 10: `gate` — recording decisions, rework and waivers

**Files:**
- Create: `cli/commands/gate.js`
- Test: `tests/cli/gate.test.js`

**Interfaces:**
- Consumes: `state.js`, `events.js`, `lanes.js`.
- Produces: `run(argv, cwd, emit) -> number`. Usage `gate <G#> --pass|--fail --evidence <path> [--waive "<reason>" --expires <YYYY-MM-DD>]`. A `--fail` marks downstream artifacts stale. Every outcome appends an event.

- [ ] **Step 1: Write the failing tests**

`tests/cli/gate.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const gate = require("../../cli/commands/gate");
const { readState } = require("../../cli/lib/state");
const { readEvents } = require("../../cli/lib/events");

function repo(lane = "standard") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-gate-"));
  init.run([], root, () => {});
  propose.run(["c", "--lane", lane], root, () => {});
  fs.writeFileSync(path.join(root, "evidence.md"), "proof");
  return root;
}

test("a passing gate is recorded in state and events", () => {
  const root = repo();
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {}), 0);
  assert.strictEqual(readState(root).gates.G2, "pass");
  const evts = readEvents(root);
  assert.strictEqual(evts.at(-1).gate, "G2");
  assert.strictEqual(evts.at(-1).verdict, "pass");
});

test("a gate outside the lane's set is refused", () => {
  const root = repo("express");
  const lines = [];
  assert.strictEqual(gate.run(["G4", "--pass", "--evidence", "evidence.md"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /G4 is not in lane 'express'/);
  assert.match(lines.join("\n"), /G2, G6, G7/);
  assert.strictEqual(readState(root).gates.G4, undefined);
});

test("a pass without evidence is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /--evidence is required/);
});

test("a pass citing a missing evidence file is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "nope.md"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /evidence file not found/);
});

test("a failing gate marks downstream artifacts stale", () => {
  const root = repo();
  gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {});
  gate.run(["G6", "--fail", "--evidence", "evidence.md"], root, () => {});
  const s = readState(root);
  assert.strictEqual(s.gates.G6, "fail");
  assert.ok(s.stale.length > 0, "a failed gate must mark downstream work stale");
});

test("a waiver requires a reason and an expiry and is written to waivers.md", () => {
  const root = repo();
  assert.strictEqual(gate.run(["G3", "--waive", "no arch impact"], root, () => {}), 1);
  assert.strictEqual(
    gate.run(["G3", "--waive", "no arch impact", "--expires", "2026-12-31"], root, () => {}), 0);
  const text = fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8");
  assert.match(text, /no arch impact/);
  assert.match(text, /2026-12-31/);
  assert.strictEqual(readEvents(root).at(-1).verdict, "waived");
});
```

> `test("a gate outside the lane's set is refused")` is Review Focus item 4.

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/cli/gate.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`cli/commands/gate.js`:
```js
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { readState, writeState } = require("../lib/state");
const { appendEvent } = require("../lib/events");
const { gatesForLane, ALL_GATES } = require("../lib/lanes");
const { waiversPath } = require("../lib/paths");

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
}

function run(argv, cwd, emit = console.log) {
  const gate = argv[0];
  if (!ALL_GATES.includes(gate)) { emit(`unknown gate '${gate}' — valid: ${ALL_GATES.join(", ")}`); return 1; }

  const s = readState(cwd);
  if (!s.change) { emit("no active change"); return 1; }
  const laneGates = gatesForLane(s.lane);
  if (!laneGates.includes(gate)) {
    emit(`${gate} is not in lane '${s.lane}' — this lane enforces: ${laneGates.join(", ")}`);
    return 1;
  }

  const waiveReason = flagValue(argv, "--waive");
  if (waiveReason) {
    const expires = flagValue(argv, "--expires");
    if (!expires) { emit("a waiver requires --expires <YYYY-MM-DD>"); return 1; }
    const row = `| ${new Date().toISOString().slice(0, 10)} | ${s.change} | ${gate} | ${waiveReason} | ${expires} | |\n`;
    fs.appendFileSync(waiversPath(cwd), row);
    s.gates[gate] = "waived";
    writeState(cwd, s);
    appendEvent(cwd, { change: s.change, gate, verdict: "waived", reason: waiveReason, expires });
    emit(`${gate} waived until ${expires}`);
    return 0;
  }

  const passed = argv.includes("--pass");
  const failed = argv.includes("--fail");
  if (passed === failed) { emit("specify exactly one of --pass or --fail"); return 1; }

  const evidence = flagValue(argv, "--evidence");
  if (!evidence) { emit("--evidence is required to record a gate decision"); return 1; }
  if (!fs.existsSync(path.resolve(cwd, evidence))) { emit(`evidence file not found: ${evidence}`); return 1; }

  s.gates[gate] = passed ? "pass" : "fail";
  if (failed) {
    const idx = ALL_GATES.indexOf(gate);
    s.stale = [...new Set([...s.stale, ...ALL_GATES.slice(idx).map((g) => `gate:${g}`)])];
  }
  writeState(cwd, s);
  appendEvent(cwd, { change: s.change, gate, verdict: s.gates[gate], evidence });
  emit(`${gate} ${s.gates[gate]} (evidence: ${evidence})`);
  if (failed) emit(`rework required — ${s.stale.length} artifact(s) marked stale`);
  return 0;
}
module.exports = { run };
```

- [ ] **Step 4: Run and watch them pass**

Run: `node --test tests/cli/gate.test.js`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/commands/gate.js tests/cli/gate.test.js
git commit -m "feat: gate records verdicts, waivers and rework staleness"
```

---

### Task 11: `validate_traceability.py` and the `validate` command

**Files:**
- Create: `scripts/validate_traceability.py`, `cli/commands/validate.js`
- Test: `tests/lint/test_traceability.py`, `tests/cli/validate.test.js`

**Interfaces:**
- Consumes: nothing from earlier Python tasks except `Finding`.
- Produces: `trace_findings(delivery_root: Path) -> list[Finding]`. Runs as `python3 scripts/validate_traceability.py <delivery-root> [--strict]`.
- `cli/commands/validate.js` shells the three Python validators and returns non-zero if any fails or if `state.stale` is non-empty.

Orphan rules: **T1** a `TASK-###` with no `Implements: REQ-###` · **T2** a `REQ-###` in a spec with no `AC-###` under it · **T3** an `Implements:` naming a `REQ-###` that no spec defines · **T4** (strict only) a `REQ-###` with no `TASK-###` implementing it.

- [ ] **Step 1: Write the failing Python test**

`tests/lint/test_traceability.py`:
```python
import unittest, tempfile
from pathlib import Path
from scripts.validate_traceability import trace_findings

SPEC = """# Spec
## REQ-001 Users can toggle theme
### AC-001 Given a logged-in user, when they toggle, then it persists.
## REQ-002 Theme respects system preference
"""

TASKS_OK = "- [ ] **TASK-001** Add toggle\n  - Implements: REQ-001\n"
TASKS_ORPHAN = "- [ ] **TASK-001** Add toggle\n"
TASKS_GHOST = "- [ ] **TASK-001** Add toggle\n  - Implements: REQ-999\n"

def build(tmp, spec, tasks):
    root = Path(tmp) / "delivery"
    (root / "specs" / "theme").mkdir(parents=True)
    (root / "specs" / "theme" / "spec.md").write_text(spec, encoding="utf-8")
    (root / "changes" / "c").mkdir(parents=True)
    (root / "changes" / "c" / "tasks.md").write_text(tasks, encoding="utf-8")
    return root

def rules(fs):
    return sorted({f.rule for f in fs})

class TestTrace(unittest.TestCase):
    def test_T1_task_without_implements(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertIn("T1", rules(trace_findings(build(t, SPEC, TASKS_ORPHAN))))

    def test_T2_requirement_without_acceptance_criteria(self):
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC, TASKS_OK))
            self.assertIn("T2", rules(fs))
            self.assertTrue(any("REQ-002" in f.message for f in fs))

    def test_T3_implements_unknown_requirement(self):
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC, TASKS_GHOST))
            self.assertIn("T3", rules(fs))
            self.assertTrue(any("REQ-999" in f.message for f in fs))

    def test_T4_strict_flags_requirement_with_no_task(self):
        with tempfile.TemporaryDirectory() as t:
            fs = trace_findings(build(t, SPEC, TASKS_OK), strict=True)
            self.assertIn("T4", rules(fs))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run and watch it fail**

Run: `python3 -m unittest tests.lint.test_traceability -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the traceability validator**

`scripts/validate_traceability.py`:
```python
"""Detect orphans across REQ -> AC -> TASK in a scaffolded delivery/ tree."""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.validate_manifests import Finding

REQ = re.compile(r"\b(REQ-\d{3,})\b")
AC = re.compile(r"\b(AC-\d{3,})\b")
TASK_LINE = re.compile(r"\*\*(TASK-\d{3,})\*\*")
IMPLEMENTS = re.compile(r"Implements:\s*(REQ-\d{3,})")

def trace_findings(delivery_root: Path, strict: bool = False) -> list[Finding]:
    out: list[Finding] = []
    reqs: dict[str, Path] = {}
    reqs_with_ac: set[str] = set()

    for spec in sorted(delivery_root.glob("specs/**/spec.md")):
        current = None
        for line in spec.read_text(encoding="utf-8").splitlines():
            m = REQ.search(line)
            if m and line.lstrip().startswith("#"):
                current = m.group(1)
                reqs[current] = spec
            elif current and AC.search(line):
                reqs_with_ac.add(current)

    implemented: set[str] = set()
    for tasks in sorted(delivery_root.glob("changes/*/tasks.md")):
        lines = tasks.read_text(encoding="utf-8").splitlines()
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
```

- [ ] **Step 4: Run and watch it pass**

Run: `python3 -m unittest tests.lint.test_traceability -v`
Expected: 4 tests PASS.

- [ ] **Step 5: Write and implement the `validate` command**

`tests/cli/validate.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const validate = require("../../cli/commands/validate");
const { readState, writeState } = require("../../cli/lib/state");

test("validate fails while stale artifacts remain", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-val-"));
  init.run([], root, () => {});
  propose.run(["c", "--lane", "standard"], root, () => {});
  const s = readState(root); s.stale = ["gate:G6"]; writeState(root, s);
  const lines = [];
  assert.strictEqual(validate.run([], root, (x) => lines.push(x)), 1);
  assert.match(lines.join("\n"), /1 stale artifact/);
});
```

`cli/commands/validate.js`:
```js
"use strict";
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { readState } = require("../lib/state");
const { deliveryDir } = require("../lib/paths");

const ROOT = path.join(__dirname, "..", "..");

function run(argv, cwd, emit = console.log) {
  let failed = 0;
  const strict = argv.includes("--strict");

  const s = readState(cwd);
  if (s.stale.length) {
    emit(`${s.stale.length} stale artifact(s) — resolve rework before validating`);
    failed = 1;
  }

  const checks = [
    ["validate_manifests.py", [ROOT]],
    ["lint_separation.py", [ROOT]],
    ["validate_traceability.py", strict ? [deliveryDir(cwd), "--strict"] : [deliveryDir(cwd)]],
  ];
  for (const [script, args] of checks) {
    const res = spawnSync("python3", [path.join(ROOT, "scripts", script), ...args], { encoding: "utf8" });
    if (res.stdout) emit(res.stdout.trimEnd());
    if (res.status !== 0) failed = 1;
  }
  emit(failed ? "validate: FAILED" : "validate: OK");
  return failed;
}
module.exports = { run };
```

- [ ] **Step 6: Run the whole suite and commit**

Run: `npm test && python3 -m unittest discover -s tests/lint`
Expected: all PASS.

```bash
git add scripts/validate_traceability.py cli/commands/validate.js tests
git commit -m "feat: traceability validator and validate command"
```

---

### Task 12: `archive`

**Files:**
- Create: `cli/commands/archive.js`
- Test: `tests/cli/archive.test.js`

**Interfaces:**
- Consumes: `state.js`, `events.js`, `paths.js`.
- Produces: `run(argv, cwd, emit) -> number`. Moves `changes/<name>/` to `changes/archive/YYYY-MM-DD-<name>/`, folds delta specs into `specs/`, appends an `INSIGHT-###` stub to `ops/postmortems/<name>.md`, clears the active change.

- [ ] **Step 1: Write the failing tests**

`tests/cli/archive.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const archive = require("../../cli/commands/archive");
const { readState } = require("../../cli/lib/state");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-arch-"));
  init.run([], root, () => {});
  propose.run(["c", "--lane", "express"], root, () => {});
  const delta = path.join(root, "delivery", "changes", "c", "specs", "theme");
  fs.mkdirSync(delta, { recursive: true });
  fs.writeFileSync(path.join(delta, "spec.md"), "# Theme\n## REQ-001 x\n### AC-001 y\n");
  return root;
}

test("archive date-stamps the change and folds deltas into specs", () => {
  const root = repo();
  assert.strictEqual(archive.run(["c"], root, () => {}), 0);
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "archive", `${today}-c`)));
  assert.ok(fs.existsSync(path.join(root, "delivery", "specs", "theme", "spec.md")));
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "c")));
});

test("archive emits an insight stub and clears the active change", () => {
  const root = repo();
  archive.run(["c"], root, () => {});
  const post = fs.readFileSync(path.join(root, "delivery", "ops", "postmortems", "c.md"), "utf8");
  assert.match(post, /INSIGHT-001/);
  assert.match(post, /product backlog|skill amendment/);
  assert.strictEqual(readState(root).change, null);
});

test("archiving an unknown change is refused", () => {
  const root = repo();
  assert.strictEqual(archive.run(["nope"], root, () => {}), 1);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/cli/archive.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`cli/commands/archive.js`:
```js
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { deliveryDir, changeDir } = require("../lib/paths");
const { readState, writeState } = require("../lib/state");
const { appendEvent } = require("../lib/events");

const INSIGHT = (name) => `# Postmortem — ${name}

## What we learned

- **INSIGHT-001** <what changed in our understanding>
  - Destination: product backlog | skill amendment
  - Target: <REQ candidate, or the navi-skill-* to amend>

## KPI vs actual
<what we predicted, what happened>
`;

function run(argv, cwd, emit = console.log) {
  const name = argv[0];
  const dir = changeDir(cwd, name);
  if (!name || !fs.existsSync(dir)) { emit(`unknown change '${name}'`); return 1; }

  const root = deliveryDir(cwd);
  const deltas = path.join(dir, "specs");
  if (fs.existsSync(deltas)) {
    fs.cpSync(deltas, path.join(root, "specs"), { recursive: true });
  }

  const stamped = path.join(root, "changes", "archive", `${new Date().toISOString().slice(0, 10)}-${name}`);
  fs.mkdirSync(path.dirname(stamped), { recursive: true });
  fs.renameSync(dir, stamped);

  const post = path.join(root, "ops", "postmortems", `${name}.md`);
  if (!fs.existsSync(post)) fs.writeFileSync(post, INSIGHT(name));

  const s = readState(cwd);
  s.change = null; s.lane = null; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(cwd, s);
  appendEvent(cwd, { change: name, gate: "G9", verdict: "archived" });
  emit(`Archived to delivery/changes/archive/${path.basename(stamped)}`);
  emit(`Insights: delivery/ops/postmortems/${name}.md — route each to the backlog or a skill amendment`);
  return 0;
}
module.exports = { run };
```

- [ ] **Step 4: Run and watch them pass**

Run: `node --test tests/cli/archive.test.js`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/commands/archive.js tests/cli/archive.test.js
git commit -m "feat: archive folds deltas, emits insights and closes the loop"
```

---

### Task 13: Author the 11 spine skills

**Files:**
- Create: `skills/lifecycle-method/navi-skill-{phase-gate-protocol,lane-selection,traceability,handoff-protocol,waivers-and-deferrals,human-checkpoints}/SKILL.md` + `evals/evals.json`
- Create: `skills/spec-driven-development/navi-skill-{spec-authoring,acceptance-criteria,change-proposal,task-decomposition}/SKILL.md` + `evals/evals.json`
- Create: `skills/lifecycle-method/navi-skill-phase-gate-protocol/references/gates.md`

> Eleven directories: six under `lifecycle-method`, four under `spec-driven-development`, plus the shared `references/gates.md`.

**Interfaces:**
- Consumes: the frontmatter contract from Global Constraints; validated by Tasks 3 and 4.
- Produces: skill names referenced by agents in Task 14. Exact names as listed above.

- [ ] **Step 1: Write the eval fixture for one skill first**

`skills/spec-driven-development/navi-skill-acceptance-criteria/evals/evals.json`:
```json
{
  "skill": "navi-skill-acceptance-criteria",
  "cases": [
    { "id": "pos-1", "type": "positive",
      "prompt": "Turn 'the report should be fast' into acceptance criteria.",
      "expect": ["Given", "When", "Then", "AC-", "measurable threshold"] },
    { "id": "neg-1", "type": "negative",
      "prompt": "Write me a SQL query to list users.",
      "expect_not_triggered": true },
    { "id": "edge-1", "type": "edge",
      "prompt": "Write acceptance criteria for 'the UI should feel polished'.",
      "expect": ["not objectively testable", "escalate"] }
  ]
}
```

- [ ] **Step 2: Write that skill, and confirm the linters reject a bad version first**

Create the file with a deliberate violation — the sentence `As the Business Analyst, weigh whether this is testable.` in the body.

Run: `python3 scripts/lint_separation.py .`
Expected: FAIL with `SEP3 ... skill uses persona voice`.

- [ ] **Step 3: Remove the violation and write the real skill**

`skills/spec-driven-development/navi-skill-acceptance-criteria/SKILL.md`:
```markdown
---
name: navi-skill-acceptance-criteria
description: >
  Use when writing or reviewing acceptance criteria for a requirement. Defines the
  Given/When/Then form, the objective-testability rules, and AC-### numbering.
  Trigger phrases include: acceptance criteria, AC, given when then, testable requirement,
  definition of done for a requirement.
allowed-tools: Read Write Edit Grep
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: spec-driven-development
  lifecycle_phases: [2, 6]
  used_by_agents: [navi-agent-business-analyst, navi-agent-qa-engineer, navi-agent-product-owner]
  owner: OWNER_TBD
  tags: "sdd, requirements, quality"
  model: sonnet
---

## When to use

A requirement exists and needs criteria, or criteria exist and need review.

## Rules

1. One criterion per behaviour. Never bundle two behaviours into one AC.
2. Write every criterion as `Given <state>, when <action>, then <observable outcome>`.
3. Number criteria `AC-###`, sequential within the capability, never reused after deletion.
4. Every criterion names an observable outcome. Reject adjectives without a threshold.
5. Each criterion states its requirement in an `Implements: REQ-###` line.
6. A criterion that cannot be observed by a test or an instrument is not a criterion — record it as an open question instead.

## Decision table

| Phrase in the requirement | Required action |
|---|---|
| "fast", "responsive", "quick" | Replace with a latency threshold and a percentile |
| "secure" | Replace with the specific threat and its mitigation |
| "user-friendly", "polished", "intuitive" | Not testable — raise as an open question |
| "most", "usually", "typically" | Replace with a percentage and a measurement window |

## Template

```markdown
### AC-001
Given a signed-in user with a saved theme preference,
when they load any page,
then the saved theme is applied before first paint.
Implements: REQ-001
```

## Checklist

- [ ] Every criterion uses Given/When/Then
- [ ] Every criterion carries an `Implements:` line
- [ ] No adjective appears without a threshold
- [ ] Numbering is sequential with no reuse
- [ ] Untestable statements moved to open questions

## Anti-patterns

**Bundled behaviours.** `then the theme applies and the preference syncs across devices` — two outcomes, two tests, two criteria. Split them.

**Unmeasurable adjective.** `then the page loads quickly` — replace with `then the page reaches interactive within 1.5s at p95 on a 4G profile`.

**Restating the requirement.** `Given the feature, when used, then it works` — carries no information. Name the state, the action and the observable.

## Validation

Run `python3 scripts/validate_traceability.py delivery/` — every `REQ-###` must
report at least one `AC-###`, and rule T2 must be clean.
```

- [ ] **Step 4: Run the linters and watch them pass**

Run: `python3 scripts/lint_separation.py . && python3 scripts/validate_manifests.py .`
Expected: `lint_separation` reports 0 findings. `validate_manifests` reports M5 for every skill until Task 14 adds the agents — that is expected at this point; no other rule may fire.

- [ ] **Step 5: Write the remaining ten spine skills in the same shape**

Each gets the same seven sections (When to use · Rules · Decision table · Template · Checklist · Anti-patterns · Validation) and an `evals/evals.json` with at least one positive, one negative and one edge case.

- `navi-skill-phase-gate-protocol` — the nine phases, entry/exit criteria, what counts as evidence per gate. Carries `references/gates.md` with one section per `G1`..`G9`.
- `navi-skill-lane-selection` — the decision table mapping change characteristics to `express`/`standard`/`full`/`hotfix`, and the rule that a lane is declared in `proposal.md` before work starts.
- `navi-skill-traceability` — the ID chain, numbering rules, the `Implements:` convention, orphan classes T1–T4.
- `navi-skill-handoff-protocol` — the handoff envelope YAML shape from spec §4.5, plus the rule that consultations are recorded as `kind: review`.
- `navi-skill-waivers-and-deferrals` — the waiver row format, the mandatory expiry, and the rule that a hotfix's deferred `G2` is a waiver with a 48-hour expiry.
- `navi-skill-human-checkpoints` — the four checkpoints (spec sign-off, architecture sign-off, release approval, incident/rollback) and the rule that a human decision is never simulated.
- `navi-skill-spec-authoring` — the spec template, `REQ-###` numbering, MoSCoW, the non-functional sections.
- `navi-skill-change-proposal` — the proposal template and what a complete "Why/What/Impact/Non-goals" contains.
- `navi-skill-task-decomposition` — `TASK-###` sizing, the vertical-slice rule, dependency ordering.

- [ ] **Step 6: Run everything and commit**

Run: `python3 scripts/lint_separation.py . && python3 -m unittest discover -s tests/lint`
Expected: PASS, 0 separation findings.

```bash
git add skills/lifecycle-method skills/spec-driven-development
git commit -m "feat: author the 11 spine skills (lifecycle-method, spec-driven-development)"
```

---

### Task 14: Author the 10 agents

**Files:**
- Create: `agents/navi-agent-{orchestrator,product-owner,business-analyst,architect,fullstack-developer,data-engineer,machine-learning-engineer,mlops-engineer,devops-engineer,qa-engineer}/<same-name>.agent.md`

**Interfaces:**
- Consumes: the skill names authored in Task 13 (and Task 15 for discipline skills — write the full `skills:` lists now, and Task 15 makes them resolve).
- Produces: agent names consumed by `build_adapters.py` in Task 16 and by `golden_path.py` in Task 17.

- [ ] **Step 1: Write one agent and confirm the separation linter catches a bad version**

Create `agents/navi-agent-business-analyst/navi-agent-business-analyst.agent.md` containing a numbered procedure:
```markdown
## Mission
Turn intent into an unambiguous spec.

1. Read the intent
2. List the actors
3. Write the requirements
```

Run: `python3 scripts/lint_separation.py .`
Expected: FAIL with `SEP1 ... agent contains a numbered procedure`.

- [ ] **Step 2: Rewrite it as judgment only**

```markdown
---
name: navi-agent-business-analyst
description: >
  Use when turning an approved intent into an unambiguous, testable specification.
  Owns ADLC Phase 2 and the G2-SPEC gate.
allowed-tools: Read Write Edit Grep AskUserQuestion
metadata:
  version: "0.1.0"
  maturity: draft
  kind: agent
  discipline: business-analysis
  lifecycle_phases: [2]
  owner: OWNER_TBD
  tags: "requirements, specification"
  model: opus
owns_gates: [G2]
skills:
  - navi-skill-spec-authoring
  - navi-skill-acceptance-criteria
  - navi-skill-requirements-elicitation
  - navi-skill-non-functional-requirements
  - navi-skill-traceability
  - navi-skill-handoff-protocol
capabilities: [read_file, write_file, search, ask_human]
consumes: [intent.md, kpi.md]
produces: [spec.md, ac.md, glossary.md, open-questions.md]
handoff_to: [navi-agent-architect, navi-agent-qa-engineer]
escalate_to_human_when:
  - A requirement conflicts with a signed-off requirement
  - An acceptance criterion cannot be made objectively testable
  - A regulatory or data-privacy constraint surfaces that the intent did not anticipate
---

## Mission

Turn an approved intent into a specification precise enough that two competent
engineers building from it independently would produce the same behaviour.

## Mental model

- Ambiguity is the defect. Everything else downstream is a symptom of it.
- The interesting requirements are the ones nobody stated: the empty state, the
  concurrent edit, the partial failure, the actor who is not the happy-path user.
- Non-functional requirements are requirements. Unstated, they become incidents.
- A requirement that cannot be observed cannot be accepted, and therefore is not yet a requirement.

## How I decide

When completeness and speed conflict, favour naming the gap over closing it —
an explicit open question costs a day, a wrong assumption costs a release.
When a stakeholder describes a solution, work backwards to the outcome and
specify that instead. When two requirements conflict, never reconcile silently:
surface both and escalate.

## Definition of good

Excellent: every requirement is observable, every criterion carries its
requirement, every assumption is written down, and the open questions list is
non-empty and specific. Mediocre: a tidy restatement of what the stakeholder
said, with no new questions raised.

## Working agreement

Needs from upstream: an approved intent and its success measures.
Guarantees downstream: no requirement without acceptance criteria, no criterion
without an observable outcome, and every assumption listed rather than buried.

## Skill invocation plan

Specification work loads `navi-skill-spec-authoring`; criteria load
`navi-skill-acceptance-criteria`; discovery loads
`navi-skill-requirements-elicitation`; quality attributes load
`navi-skill-non-functional-requirements`; every handoff loads
`navi-skill-handoff-protocol`.
```

- [ ] **Step 3: Run the linter and watch it pass**

Run: `python3 scripts/lint_separation.py .`
Expected: 0 findings.

- [ ] **Step 4: Write the remaining nine agents in the same shape**

Each carries: frontmatter per Global Constraints · Mission · Mental model · How I decide · Definition of good · Working agreement · Skill invocation plan. No procedures, no templates, no checklists. Persona responsibilities are taken verbatim from spec §4.2.

- [ ] **Step 5: Commit**

```bash
git add agents
git commit -m "feat: author the 10 persona agents, judgment only"
```

---

### Task 15: Author the 26 remaining v1 discipline skills

**Files:**
- Create, each with `SKILL.md` + `evals/evals.json`:
  - `skills/product-management/navi-skill-{outcome-and-kpi-definition,backlog-prioritisation}`
  - `skills/business-analysis/navi-skill-{requirements-elicitation,non-functional-requirements}`
  - `skills/architecture/navi-skill-{decision-records,quality-attributes,interface-contracts,threat-modelling}`
  - `skills/software-development/navi-skill-{test-driven-development,code-review,api-design,version-control-workflow}`
  - `skills/data-engineering/navi-skill-{data-contracts,pipeline-design,data-quality}`
  - `skills/machine-learning/navi-skill-{problem-framing,evaluation-design,model-cards}`
  - `skills/mlops/navi-skill-{model-registry-and-promotion,drift-monitoring}`
  - `skills/platform-devops/navi-skill-{pipeline-automation,progressive-delivery,observability,incident-response}`
  - `skills/quality-engineering/navi-skill-{test-strategy,test-design,release-readiness}`

**Interfaces:**
- Consumes: the frontmatter contract; the `used_by_agents` values must match the `skills:` lists written in Task 14.
- Produces: nothing downstream depends on their bodies, only their names.

- [ ] **Step 1: Confirm the gap the task closes**

Run: `python3 scripts/validate_manifests.py .`
Expected: M4 findings naming each of the 26 skills an agent references but that does not exist yet. Record the count.

- [ ] **Step 2: Author each skill with the seven-section shape**

Same structure as Task 13 Step 3: When to use · Rules · Decision table · Template · Checklist · Anti-patterns · Validation. Rules are imperative and testable; no hedging, no "consider".

- [ ] **Step 3: Author each `evals/evals.json`**

Minimum three cases per skill — one positive (the skill should fire and produce its artifact), one negative (a superficially similar prompt that must NOT trigger it), one edge (an input the rules explicitly send to escalation).

- [ ] **Step 4: Run both linters and watch them pass**

Run: `python3 scripts/validate_manifests.py . && python3 scripts/lint_separation.py .`
Expected: **0 findings from both.** M4 and M5 are now clean in both directions — this is the moment Review Focus item 5 is satisfied on real content.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat: author the 26 remaining v1 discipline skills"
```

---

### Task 16: `build_adapters.py` and the generated AGENTS.md

**Files:**
- Create: `scripts/build_adapters.py`
- Test: `tests/lint/test_build_adapters.py`
- Generates: `adapters/claude-code/`, `adapters/generic/RUNBOOK.md`, and `templates/delivery/AGENTS.md`

**Interfaces:**
- Consumes: `load_entries()` from Task 2, `CAPABILITIES` mirrored from `cli/lib/capabilities.js`.
- Produces: `build(root: Path, out: Path) -> list[Path]` returning every file written. Runs as `python3 scripts/build_adapters.py [root]`.

- [ ] **Step 1: Write the failing test**

`tests/lint/test_build_adapters.py`:
```python
import unittest, tempfile
from pathlib import Path
from scripts.build_adapters import build

SKILL = ("---\nname: navi-skill-alpha\ndescription: Use when x. Trigger phrases include: a.\n"
         "allowed-tools: Read\nmetadata:\n  kind: skill\n  discipline: architecture\n---\nbody\n")
AGENT = ("---\nname: navi-agent-architect\ndescription: Use when designing.\nallowed-tools: Read\n"
         "metadata:\n  kind: agent\n  discipline: architecture\nskills: [navi-skill-alpha]\n---\nbody\n")

def tree(t):
    root = Path(t)
    sd = root / "skills" / "architecture" / "navi-skill-alpha"; sd.mkdir(parents=True)
    (sd / "SKILL.md").write_text(SKILL, encoding="utf-8")
    ad = root / "agents" / "navi-agent-architect"; ad.mkdir(parents=True)
    (ad / "navi-agent-architect.agent.md").write_text(AGENT, encoding="utf-8")
    return root

class TestAdapters(unittest.TestCase):
    def test_writes_claude_code_and_generic_runbook(self):
        with tempfile.TemporaryDirectory() as t:
            root = tree(t)
            written = build(root, root / "adapters")
            names = {p.name for p in written}
            self.assertIn("RUNBOOK.md", names)
            self.assertTrue((root / "adapters" / "claude-code" / "skills" / "navi-skill-alpha" / "SKILL.md").exists())

    def test_runbook_lists_a_fallback_for_every_capability(self):
        with tempfile.TemporaryDirectory() as t:
            root = tree(t)
            build(root, root / "adapters")
            text = (root / "adapters" / "generic" / "RUNBOOK.md").read_text(encoding="utf-8")
            for cap in ["read_file", "write_file", "run_command", "search", "ask_human", "spawn_subagent"]:
                self.assertIn(cap, text)

    def test_generated_files_carry_the_do_not_edit_banner(self):
        with tempfile.TemporaryDirectory() as t:
            root = tree(t)
            for p in build(root, root / "adapters"):
                if p.suffix == ".md":
                    self.assertIn("GENERATED", p.read_text(encoding="utf-8"))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run and watch it fail**

Run: `python3 -m unittest tests.lint.test_build_adapters -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`scripts/build_adapters.py`:
```python
"""Project the agent and skill tree into harness-specific adapters. Generated — never hand-edit."""
import shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.navi_lint.registry import load_entries

BANNER = "<!-- GENERATED by scripts/build_adapters.py — do not edit by hand -->\n\n"

CAPABILITIES = [
    ("read_file", "Read", "ask the human to paste the file"),
    ("write_file", "Write", "emit the file in a fenced block"),
    ("run_command", "Bash", "ask the human to run it and paste output"),
    ("search", "Grep/Glob", "ask for the relevant paths"),
    ("ask_human", "AskUserQuestion", "ask a plain question, then wait"),
    ("spawn_subagent", "Agent", "adopt the persona sequentially in this session"),
]

def build(root: Path, out: Path) -> list[Path]:
    entries = load_entries(root)
    written: list[Path] = []

    cc = out / "claude-code"
    for e in entries:
        dest = cc / ("skills" if e.kind == "skill" else "agents") / e.name
        dest.mkdir(parents=True, exist_ok=True)
        target = dest / e.path.name
        shutil.copyfile(e.path, target)
        written.append(target)

    generic = out / "generic"
    generic.mkdir(parents=True, exist_ok=True)
    lines = [BANNER, "# navi-delivery — running with no plugin support\n\n",
             "Paste this file, then work the phases in order. Each phase names the agent to\n",
             "adopt and the skills to load before producing anything.\n\n",
             "## Capability fallbacks\n\n",
             "| Capability | Native | Fallback when unavailable |\n|---|---|---|\n"]
    for name, native, fallback in CAPABILITIES:
        lines.append(f"| `{name}` | {native} | {fallback} |\n")
    lines.append("\n## Agents\n\n")
    for e in entries:
        if e.kind == "agent":
            skills = ", ".join(e.meta.get("skills") or [])
            lines.append(f"- **{e.name}** — loads: {skills}\n")
    runbook = generic / "RUNBOOK.md"
    runbook.write_text("".join(lines), encoding="utf-8")
    written.append(runbook)

    agents_md = root / "templates" / "delivery" / "AGENTS.md"
    if agents_md.parent.exists():
        body = [BANNER, "# Working in this repo with navi-delivery\n\n",
                "Phases, gates and lanes are defined by the framework. Before producing any\n",
                "artifact, adopt the phase's agent and load its skills.\n\n"]
        for e in entries:
            if e.kind == "agent":
                body.append(f"- `{e.name}` — {e.meta.get('description','').strip().splitlines()[0]}\n")
        agents_md.write_text("".join(body), encoding="utf-8")
        written.append(agents_md)
    return written

def main(argv: list[str]) -> int:
    root = Path(argv[0]) if argv else Path.cwd()
    written = build(root, root / "adapters")
    print(f"wrote {len(written)} file(s)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

- [ ] **Step 4: Run and watch it pass, then generate for real**

Run: `python3 -m unittest tests.lint.test_build_adapters -v && python3 scripts/build_adapters.py .`
Expected: 3 tests PASS; adapters written.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_adapters.py tests/lint/test_build_adapters.py adapters templates/delivery/AGENTS.md
git commit -m "feat: adapter generation and harness-agnostic RUNBOOK"
```

---

### Task 17: `golden_path.py` end-to-end fixture and CI

**Files:**
- Create: `scripts/golden_path.py`, `.github/workflows/ci.yml`
- Test: the script *is* the test; it exits non-zero on any failure.

**Interfaces:**
- Consumes: the CLI from Tasks 6–12 and the validators from Tasks 3, 4, 11.
- Produces: `run_lane(lane: str, workdir: Path) -> None` raising `AssertionError` on failure; `main() -> int`.

- [ ] **Step 1: Write the fixture**

`scripts/golden_path.py`:
```python
"""Carry a toy project through every lane and assert the framework holds."""
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = ["node", str(ROOT / "cli" / "index.js")]

SPEC = """# Theme

## REQ-001 Users can choose a theme
### AC-001 Given a signed-in user, when they toggle, then the choice persists.
"""
TASKS = "- [ ] **TASK-001** Add the toggle\n  - Implements: REQ-001\n"

def run(args, cwd, expect=0):
    res = subprocess.run(CLI + args, cwd=cwd, capture_output=True, text=True)
    assert res.returncode == expect, f"{args} -> {res.returncode} (want {expect})\n{res.stdout}{res.stderr}"
    return res.stdout

def gates_for(lane):
    src = (ROOT / "cli" / "lib" / "lanes.js").read_text(encoding="utf-8")
    res = subprocess.run(["node", "-e",
        f"process.stdout.write(JSON.stringify(require('{ROOT}/cli/lib/lanes').gatesForLane('{lane}')))"],
        capture_output=True, text=True)
    return json.loads(res.stdout)

def run_lane(lane: str, workdir: Path) -> None:
    run(["init"], workdir)
    run(["propose", f"{lane}-change", "--lane", lane], workdir)

    delivery = workdir / "delivery"
    spec_dir = delivery / "changes" / f"{lane}-change" / "specs" / "theme"
    spec_dir.mkdir(parents=True, exist_ok=True)
    (spec_dir / "spec.md").write_text(SPEC, encoding="utf-8")
    (delivery / "specs" / "theme").mkdir(parents=True, exist_ok=True)
    (delivery / "specs" / "theme" / "spec.md").write_text(SPEC, encoding="utf-8")
    (delivery / "changes" / f"{lane}-change" / "tasks.md").write_text(TASKS, encoding="utf-8")
    (workdir / "evidence.md").write_text("proof", encoding="utf-8")

    for gate in gates_for(lane):
        run(["gate", gate, "--pass", "--evidence", "evidence.md"], workdir)

    # a gate outside the lane must be refused
    outside = next((g for g in [f"G{i}" for i in range(1, 10)] if g not in gates_for(lane)), None)
    if outside:
        run(["gate", outside, "--pass", "--evidence", "evidence.md"], workdir, expect=1)

    run(["validate"], workdir)
    run(["archive", f"{lane}-change"], workdir)

    stamped = list((delivery / "changes" / "archive").glob(f"*-{lane}-change"))
    assert stamped, f"{lane}: change was not archived"
    assert (delivery / "ops" / "postmortems" / f"{lane}-change.md").exists(), f"{lane}: no insight emitted"
    events = (delivery / ".adlc" / "events.jsonl").read_text(encoding="utf-8").strip().splitlines()
    assert len(events) >= len(gates_for(lane)) + 1, f"{lane}: telemetry missing"

def main() -> int:
    for lane in ["express", "standard", "full", "hotfix"]:
        with tempfile.TemporaryDirectory() as tmp:
            run_lane(lane, Path(tmp))
            print(f"  {lane}: OK")
    for script in ["validate_manifests.py", "lint_separation.py"]:
        res = subprocess.run([sys.executable, str(ROOT / "scripts" / script), str(ROOT)],
                             capture_output=True, text=True)
        assert res.returncode == 0, f"{script} failed:\n{res.stdout}"
        print(f"  {script}: OK")
    print("golden path: OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run it and fix what it finds**

Run: `python3 scripts/golden_path.py`
Expected: `golden path: OK`. Any failure is a real integration defect in Tasks 6–12 — fix the command, not the fixture.

- [ ] **Step 3: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements-dev.txt
      - run: npm test
      - run: python3 -m unittest discover -s tests/lint -v
      - run: python3 scripts/validate_manifests.py .
      - run: python3 scripts/lint_separation.py .
      - run: python3 scripts/golden_path.py
      - name: adapters are up to date
        run: |
          python3 scripts/build_adapters.py .
          git diff --exit-code adapters templates/delivery/AGENTS.md
```

- [ ] **Step 4: Commit**

```bash
git add scripts/golden_path.py .github/workflows/ci.yml
git commit -m "test: golden-path fixture across all four lanes, wired into CI"
```

---

### Task 18: README, install.sh and the owner sweep

**Files:**
- Create: `install.sh`, `ADLC.md`, `SDD.md`
- Modify: `README.md`, every `SKILL.md` and `*.agent.md` (the `OWNER_TBD` sweep)

**Interfaces:**
- Consumes: everything.
- Produces: the shipped, installable artifact.

- [ ] **Step 1: Write the install script**

`install.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
YES="${1:-}"
TARGET="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

echo "navi-delivery installer"
echo "  skills -> $TARGET"
if [ "$YES" != "--yes" ]; then
  read -r -p "Proceed? [y/N] " ans
  [ "$ans" = "y" ] || { echo "aborted"; exit 1; }
fi

mkdir -p "$TARGET"
for dir in skills/*/navi-skill-*; do
  ln -sfn "$(pwd)/$dir" "$TARGET/$(basename "$dir")"
done
echo "Installed $(ls -d skills/*/navi-skill-* | wc -l | tr -d ' ') skills."
echo "Next: npx navi-delivery init"
```

- [ ] **Step 2: Sweep the owner placeholder**

Decide the value with the human partner (spec §10 open question 1), then:

```bash
grep -rl "OWNER_TBD" agents skills | xargs sed -i '' "s/OWNER_TBD/<agreed-owner>/g"
grep -r "OWNER_TBD" agents skills && echo "STILL PRESENT" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Write ADLC.md and SDD.md**

`ADLC.md` carries spec §5 — the nine phases with entry/exit criteria, the nine gates with their evidence requirements, the four lanes, and the rework rule. `SDD.md` carries spec §5.4 — the ID chain, numbering, the `Implements:` convention, and the spec-first rule. Absorb `prompts/agentic-sdlc-system.prompt.md` here if the human partner chose "absorb" on spec §10 open question 4, then delete it.

- [ ] **Step 4: Rewrite README.md for the shipped framework**

Replace the design-stage README with install, quickstart, the five CLI verbs, and a link to `ADLC.md`. The quickstart must get a reader from clone to a first proposal in under five minutes.

- [ ] **Step 5: Verify the whole acceptance list**

Run every check from spec §9:
```bash
npm test
python3 -m unittest discover -s tests/lint
python3 scripts/validate_manifests.py .
python3 scripts/lint_separation.py .
python3 scripts/golden_path.py
node cli/index.js doctor
```
Expected: all pass; `doctor` reports the harness and no capability without a fallback.

- [ ] **Step 6: Commit**

```bash
git add install.sh ADLC.md SDD.md README.md agents skills
git commit -m "feat: install script, methodology docs and owner sweep for v1"
```

---

## Self-Review

**Spec coverage.** §3.1 shipped tree → Tasks 1, 18. §3.2 scaffolded tree → Task 7. §3.3 conventions → Tasks 2, 3. §4.1 separation law → Task 4. §4.2 agent roster → Task 14. §4.3 skill catalogue → Tasks 13, 15. §4.4 capability portability → Tasks 6, 16. §4.5 handoff envelope → Task 13 (`navi-skill-handoff-protocol`) and Task 8 (`handoffs.md` template). §5.1 phases/gates → Tasks 10, 13. §5.2 lanes → Tasks 5, 8, 10. §5.3 rework → Task 10. §5.4 traceability → Task 11. §5.5 state/resumability → Task 5. §5.6 loop closure → Task 12. §6 CLI → Tasks 6–12. §7 quality strategy → Tasks 3, 4, 13, 15, 17. §8 failure modes → Tasks 5, 7, 10.

**Gap found and closed:** spec §7 requires `evals/evals.json` per skill; Task 13 Step 1 and Task 15 Step 3 now specify the eval shape explicitly rather than leaving it implied.

**Known deferral:** spec §10 open questions 2 (orchestrator placement), 3 (Security Engineer as an eleventh agent) and 5 (stack opinionation) are unresolved. The plan implements the spec's current answers — orchestrator as an agent, no Security Engineer, stack-neutral rules with a `project.md` override. If any answer changes, Task 14 (agents) and Task 15 (`software-development` skills) absorb the change; nothing else moves.

**Type consistency.** `Finding` is defined once in `validate_manifests.py` and imported by `lint_separation.py` and `validate_traceability.py`. `Entry` is defined once in `registry.py`. `run(argv, cwd, emit)` is the signature of every CLI command module. `gatesForLane` is spelled identically in `lanes.js`, `status.js`, `gate.js` and `golden_path.py`.

**Review Focus coverage.** Item 1 → Task 7 Step 1 test 3. Item 2 → Task 2 Step 1, six cases. Item 3 → Task 5 Step 1, two corrupt-state tests. Item 4 → Task 10 Step 1 test 2, and again end-to-end in Task 17. Item 5 → Task 3 Step 1 tests M4/M5, and on real content in Task 15 Step 4.
