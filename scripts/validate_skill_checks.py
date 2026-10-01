#!/usr/bin/env python3
"""Run every skill's own ## Validation block against its own ## Template.

Why this exists
---------------
Every skill ships a `## Validation` section: shell a team runs to
check the artifact the skill's `## Template` describes. A content review found
fourteen defects in those blocks, four of which *could not fail* — a `grep -n`
whose line-number prefix satisfied the digit filter it was meant to apply, an
`npx semgrep` resolving to a 517-byte placeholder package, an `awk` flag that
was never reset. Every one of them reported success on input that violated the
rule. This harness exists so the next fourteen are caught here rather than by
someone reading carefully.

What it asserts, per skill
--------------------------
1. The skill's Template, staged at the path the Template's own prose names,
   satisfies the skill's own Validation block (clean output).
2. A declared mutation that violates a rule the block claims to check makes the
   block *speak*, with the message the declaration names.

Nothing is skipped silently. `scripts/skill_harness.yaml` must carry an entry
for every skill on disk; a skill that genuinely cannot be harnessed declares
`unharnessable:` with a reason, and a skill with no entry at all is a failure.
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skill_harness_lib import fences, skill_files, skill_sections  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path(__file__).resolve().parent / "skill_harness.yaml"
TIMEOUT = 180

# A clean shell: the skills' checks are POSIX shell, and a developer profile
# that shadows `grep` or `find` with a function (oh-my-zsh does exactly that)
# would otherwise decide whether a check passes.
BASH_ENV = {
    "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    "LANG": "C",
    "LC_ALL": "C",
    "TZ": "UTC",
    "GIT_AUTHOR_NAME": "harness",
    "GIT_AUTHOR_EMAIL": "harness@example.invalid",
    "GIT_COMMITTER_NAME": "harness",
    "GIT_COMMITTER_EMAIL": "harness@example.invalid",
}


@dataclass
class Result:
    name: str
    status: str                     # harnessed | unharnessable | fail
    reason: str = ""
    problems: list[str] = field(default_factory=list)


def die(msg: str) -> None:
    print(f"harness error: {msg}", file=sys.stderr)
    raise SystemExit(2)


# --------------------------------------------------------------------------
# skill content
# --------------------------------------------------------------------------

def load_skills(root: Path) -> dict[str, Path]:
    out = {}
    for path in skill_files(root):
        out[path.parent.name] = path
    return out


def template_fence(path: Path, index: int) -> str:
    blocks = fences(skill_sections(path).get("Template", ""))
    if index >= len(blocks):
        die(f"{path}: Template has {len(blocks)} fenced block(s); fence {index} was requested")
    return blocks[index][1]


def validation_script(path: Path) -> str:
    section = skill_sections(path).get("Validation")
    if section is None:
        die(f"{path}: no '## Validation' section")
    blocks = [body for lang, body in fences(section) if lang in ("bash", "sh", "")]
    if not blocks:
        die(f"{path}: '## Validation' has no shell block")
    return "\n".join(blocks)


# --------------------------------------------------------------------------
# corpus
# --------------------------------------------------------------------------

SHA_RE = re.compile(r"\b[0-9a-f]{40}\b")
SHORT_SHA_RE = re.compile(r"`([0-9a-f]{7,12})`")


def substitute(text: str, vars: dict) -> str:
    for key, value in vars.items():
        text = text.replace("{" + key + "}", value)
        text = text.replace("<" + key + ">", value)
    return text


def node_bin() -> str:
    found = shutil.which("node")
    if not found:
        die("node is not on PATH; the harness needs it to run the CLI")
    return found


def npm_bin() -> str:
    return shutil.which("npm") or "/bin/false"


def run_cli(args: list[str], cwd: Path) -> None:
    res = subprocess.run(
        ["node", str(ROOT / "cli" / "index.js"), *args],
        cwd=cwd, capture_output=True, text=True,
    )
    if res.returncode != 0:
        die(f"corpus: `navi-delivery {' '.join(args)}` failed:\n{res.stdout}{res.stderr}")


def git(args: list[str], cwd: Path) -> str:
    res = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, env={**os.environ, **BASH_ENV})
    if res.returncode != 0:
        die(f"corpus: `git {' '.join(args)}` failed:\n{res.stdout}{res.stderr}")
    return res.stdout.strip()


def build_corpus(manifest: dict, skills: dict[str, Path], dest: Path, vars: dict,
                 group: str = "base") -> None:
    """A delivery/ tree carrying skill Templates at the paths their prose names.

    Staging is *shared across skills* on purpose. Many blocks are cross-artifact
    by design — release-readiness reads the spec's AC ids, the strategy's RISK
    ids and the threat model's THREAT ids and checks each lands in exactly one
    of three sections. Staged one skill at a time those checks would find no ids
    and pass on an empty set, which is the defect class this harness exists to
    catch.

    `group` selects a variant. The Templates are illustrations of one running
    example, and two clusters number it differently: the spec/tasks cluster
    writes AC-001..003, the QA cluster (strategy, design, release report)
    presupposes the richer AC-011..019. A single tree would make one cluster's
    Template fail a check that is working correctly. Entries tagged with a
    group are added on top of `base`, later entries overriding earlier ones.
    """
    groups = ("base",) if group == "base" else ("base", group)

    def selected(items):
        return [i for i in items if i.get("group", "base") in groups]

    dest.mkdir(parents=True, exist_ok=True)

    # The repo's own scripts, agents and CLI, reachable the way a real checkout
    # is: the blocks run `python3 scripts/validate_traceability.py`, `ls agents/`
    # and `navi-delivery ...` by those names.
    (dest / "scripts").symlink_to(ROOT / "scripts")
    (dest / "agents").symlink_to(ROOT / "agents")
    bin_dir = dest / "bin"
    bin_dir.mkdir()
    shims = {
        "navi-delivery": f'exec "{node_bin()}" "{ROOT / "cli" / "index.js"}" "$@"',
        # The blocks' `python3` must be the interpreter that has this repo's
        # dev dependencies (PyYAML). /usr/bin/python3 does not.
        "python3": f'exec "{sys.executable}" "$@"',
        "node": f'exec "{node_bin()}" "$@"',
        "npm": f'exec "{npm_bin()}" "$@"',
        # Deliberately not the real npx. navi-skill-api-design's block shells an
        # OpenAPI linter out of the npm registry; running it would make the
        # harness depend on network availability and on that tool's output
        # format. The stub says so, in a line the manifest declares
        # informational, and the block's other four checks run for real.
        "npx": ('echo "harness: npx is not run here — the OpenAPI lint is an external '
                'network tool, see scripts/skill_harness.yaml" >&2; exit 1'),
    }
    for name, line in shims.items():
        shim = bin_dir / name
        shim.write_text(f"#!/bin/sh\n{line}\n", encoding="utf-8")
        shim.chmod(0o755)

    run_cli(["init"], dest)
    run_cli(["propose", vars["change"], "--lane", manifest["lane"]], dest)

    # Fixture files no Template supplies: application source, lockfiles, CI
    # definitions, and the test files several blocks assert exist on disk.
    for item in selected(manifest.get("corpus", [])):
        path = dest / substitute(item["path"], vars)
        path.parent.mkdir(parents=True, exist_ok=True)
        body = substitute(item.get("content", ""), vars)
        if item.get("mode") == "append" and path.exists():
            with path.open("a", encoding="utf-8") as fh:
                fh.write(body)
        else:
            path.write_text(body, encoding="utf-8")

    # A real (bare, local) origin. navi-skill-version-control-workflow's block
    # fetches it, compares tags against it and reads its default branch; a
    # fixture with no remote would make three of its checks unrunnable rather
    # than tested. Nothing here reaches the network.
    git(["init", "-q", "--bare", ".remote.git"], dest)
    git(["-C", ".remote.git", "config", "gc.auto", "0"], dest)
    git(["-C", ".remote.git", "config", "receive.autogc", "false"], dest)
    git(["init", "-q", "-b", "main"], dest)
    # `git commit` otherwise kicks off `gc --auto` in the background, which
    # repacks .git/objects while the harness is copying the corpus and makes
    # copytree fail on directories that vanish mid-walk.
    git(["config", "gc.auto", "0"], dest)
    git(["remote", "add", "origin", "./.remote.git"], dest)
    git(["commit", "-q", "--allow-empty", "-m", "chore: base fixture (#1)"], dest)
    base_sha = git(["rev-parse", "HEAD"], dest)
    git(["tag", "v1.0.0"], dest)
    git(["push", "-q", "origin", "main", "--tags"], dest)
    vars = {**vars, "sha": base_sha, "short_sha": base_sha[:7]}

    for entry in selected(manifest.get("stage", [])):
        skill = entry["skill"]
        if skill not in skills:
            die(f"stage entry names unknown skill '{skill}'")
        body = template_fence(skills[skill], entry.get("fence", 0))
        body = substitute(body, vars)
        # Templates cite illustrative commit shas. Several blocks check those
        # resolve (`git cat-file -e`). Rewriting them to the fixture's own base
        # commit keeps that check live instead of declaring it informational.
        body = SHA_RE.sub(base_sha, body)
        body = SHORT_SHA_RE.sub(lambda m: f"`{base_sha[:len(m.group(1))]}`", body)
        path = dest / substitute(entry["path"], vars)
        path.parent.mkdir(parents=True, exist_ok=True)
        body = entry.get("prefix", "") + body + entry.get("suffix", "")
        if entry.get("mode") == "append" and path.exists():
            with path.open("a", encoding="utf-8") as fh:
                fh.write("\n" + body)
        else:
            path.write_text(body, encoding="utf-8")

    # Overlays applied after staging: content that must replace or follow a
    # staged Template rather than precede it.
    for item in selected(manifest.get("post", [])):
        path = dest / substitute(item["path"], vars)
        path.parent.mkdir(parents=True, exist_ok=True)
        if "replace" in item:
            old_s, new_s = (substitute(s, vars) for s in item["replace"])
            text = path.read_text(encoding="utf-8")
            if text.count(old_s) != 1:
                die(f"post replace on {item['path']}: {text.count(old_s)} match(es) for {old_s!r}")
            path.write_text(text.replace(old_s, new_s), encoding="utf-8")
            continue
        body = substitute(item.get("content", ""), vars)
        if item.get("mode") == "append" and path.exists():
            with path.open("a", encoding="utf-8") as fh:
                fh.write(body)
        else:
            path.write_text(body, encoding="utf-8")

    # The test suite is the one artifact no skill Template supplies, and three
    # blocks check that every AC in the change's spec is named by a test. It is
    # derived from the staged spec so it cannot drift: a criterion added to the
    # spec *after* this point — which is what a mutation does — is uncovered,
    # which is exactly the condition those checks exist to report.
    derived = manifest.get("derive_ac_tests")
    if derived:
        spec_dir = dest / "delivery" / "changes" / vars["change"] / "specs"
        ids = sorted({m for p in spec_dir.rglob("*.md")
                      for m in re.findall(r"\bAC-\d{3,}\b", p.read_text(encoding="utf-8"))})
        path = dest / substitute(derived, vars)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            "// Derived from the change's spec by the Validation harness.\n"
            + "".join(f'it("{ac} is covered", () => {{}});\n' for ac in ids),
            encoding="utf-8")

    # Several blocks read delivery/.adlc/events.jsonl to check a gate was not
    # recorded pass while a criterion is unmet. Recording the gates through the
    # CLI is the only way that log comes into existence.
    for entry in manifest.get("gates", []):
        gate = entry["gate"]
        if "waive" in entry:
            expires = (datetime.date.today() + datetime.timedelta(days=180)).isoformat()
            run_cli(["gate", gate, "--waive", substitute(entry["waive"], vars),
                     "--expires", expires], dest)
        else:
            run_cli(["gate", gate, "--pass", "--evidence", substitute(entry["evidence"], vars)], dest)

    # `gate --waive` leaves the approver column empty for a person to fill in by
    # hand; navi-skill-waivers-and-deferrals' own Template says so, and its check
    # reports every live waiver that still has none. Filling it is part of
    # building a corpus that a team would consider complete.
    approver = manifest.get("waiver_approver")
    if approver:
        waivers = dest / "delivery" / ".adlc" / "waivers.md"
        rows = waivers.read_text(encoding="utf-8").splitlines(keepends=True)
        waivers.write_text("".join(
            r.replace("| |\n", f"| {approver} |\n") if r.rstrip("\n").endswith("| |") else r
            for r in rows), encoding="utf-8")

    # A scan record must post-date the lockfile it scanned. mtime ordering *is*
    # the check, and every file here is written within the same second, so the
    # lockfiles are backdated rather than left to chance.
    old = time.time() - 3600
    for rel in manifest.get("backdate", []):
        path = dest / substitute(rel, vars)
        if path.exists():
            os.utime(path, (old, old))

    # The corpus commit stays local: the version-control block asserts the
    # branch is not behind origin/main, which it is not, and that every commit
    # that *reached* origin/main arrived through a pull request.
    git(["add", "-A"], dest)
    git(["commit", "-q", "-m", "feat: stage the corpus (#2)"], dest)
    # Pack synchronously. Anything that repacks .git/objects later races the
    # copytree that gives each skill its own copy of this tree.
    git(["gc", "--quiet", "--prune=now"], dest)
    git(["-C", ".remote.git", "gc", "--quiet", "--prune=now"], dest)
    # `git commit` does not change mtimes, so the backdating above survives it.
    for rel in manifest.get("backdate", []):
        path = dest / substitute(rel, vars)
        if path.exists():
            os.utime(path, (old, old))


# --------------------------------------------------------------------------
# running a skill's block
# --------------------------------------------------------------------------

def run_block(script: str, cwd: Path) -> str:
    env = {**BASH_ENV, "PATH": f"{cwd / 'bin'}:{BASH_ENV['PATH']}", "HOME": str(cwd)}
    try:
        res = subprocess.run(
            ["bash", "-c", script], cwd=cwd, capture_output=True, text=True,
            env=env, timeout=TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return f"harness: the Validation block did not finish within {TIMEOUT}s"
    return res.stdout + res.stderr


def residue(output: str, informational: list[str]) -> list[str]:
    """Lines the block emitted that are not declared informational."""
    patterns = [re.compile(p) for p in informational]
    out = []
    for line in output.splitlines():
        if not line.strip():
            continue
        if any(p.search(line) for p in patterns):
            continue
        out.append(line)
    return out


class MutationError(Exception):
    """A declared mutation no longer applies — reported against its skill."""


def apply_mutation(work: Path, mutation: dict, vars: dict) -> None:
    path = work / substitute(mutation["file"], vars)
    if not path.exists():
        raise MutationError(f"{mutation['file']} does not exist in the corpus")
    text = path.read_text(encoding="utf-8")
    if "replace" in mutation:
        old, new = mutation["replace"]
        old, new = substitute(old, vars), substitute(new, vars)
        count = text.count(old)
        if count != 1:
            raise MutationError(
                f"its anchor occurs {count} time(s) in {mutation['file']}, expected exactly 1 "
                f"— the Template moved under it")
        text = text.replace(old, new)
    elif "delete_line" in mutation:
        needle = substitute(mutation["delete_line"], vars)
        lines = [ln for ln in text.splitlines(keepends=True) if needle not in ln]
        if len(lines) == len(text.splitlines(keepends=True)):
            raise MutationError(f"no line contains {needle!r}")
        text = "".join(lines)
    elif "append" in mutation:
        text = text + substitute(mutation["append"], vars)
    else:
        raise MutationError("needs one of replace / delete_line / append")
    path.write_text(text, encoding="utf-8")


def check_skill(name: str, path: Path, spec: dict, corpus: Path, tmp: Path, vars: dict,
                verbose: bool) -> Result:
    script = validation_script(path)
    script = substitute(script, vars)
    informational = spec.get("informational", []) or []
    problems: list[str] = []

    work = tmp / f"{name}-clean"
    shutil.copytree(corpus, work, symlinks=True)
    clean = run_block(script, work)
    left = residue(clean, informational)
    if left:
        problems.append("its own Template does not satisfy its own checks:\n      "
                        + "\n      ".join(left[:20]))
    if verbose and clean.strip():
        print(f"    [{name}] raw output:\n" + "\n".join("      " + l for l in clean.splitlines()))

    mutations = spec.get("mutations") or []
    if not mutations:
        problems.append("no mutation declared — a block nothing violates is a block nothing tests")
    for mutation in mutations:
        mwork = tmp / f"{name}-mut-{mutations.index(mutation)}"
        shutil.copytree(corpus, mwork, symlinks=True)
        try:
            apply_mutation(mwork, mutation, vars)
        except MutationError as exc:
            problems.append(f"mutation '{mutation['name']}' could not be applied: {exc}")
            continue
        out = run_block(script, mwork)
        expects = substitute(mutation["expects"], vars)
        if expects not in out:
            problems.append(
                f"mutation '{mutation['name']}' left the block silent — expected output "
                f"containing {expects!r}. The check it targets cannot fail."
            )
        elif expects in clean:
            problems.append(
                f"mutation '{mutation['name']}' expects {expects!r}, which the *unmutated* "
                f"corpus already emits — the assertion proves nothing."
            )

    return Result(name, "fail" if problems else "harnessed", problems=problems)


# --------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("root", nargs="?", default=str(ROOT))
    ap.add_argument("--only", action="append", default=[], help="run just these skills")
    ap.add_argument("--keep", action="store_true", help="keep the temp tree and print its path")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    skills = load_skills(root)
    if not skills:
        die(f"no skills found under {root}/skills")

    manifest = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    declared = manifest.get("skills") or {}

    # A skill absent from the manifest is a failure, never a skip. A silent
    # skip is how a check that cannot fail survives a harness.
    missing = sorted(set(skills) - set(declared))
    extra = sorted(set(declared) - set(skills))
    if missing:
        print("The following skills have no entry in scripts/skill_harness.yaml.")
        print("Add a `mutations:` entry, or `unharnessable: <reason>`:")
        for name in missing:
            print(f"  {name}")
        return 1
    if extra:
        print("scripts/skill_harness.yaml names skills that do not exist:")
        for name in extra:
            print(f"  {name}")
        return 1

    vars = {
        "change": manifest["change"],
        "model": manifest["model"],
        "name": manifest["change"],
        "lane": manifest["lane"],
    }

    tmp_root = Path(tempfile.mkdtemp(prefix="navi-skill-harness-"))
    try:
        corpora: dict[str, Path] = {}

        def corpus_for(group: str) -> Path:
            if group not in corpora:
                path = tmp_root / f"corpus-{group}"
                build_corpus(manifest, skills, path, vars, group)
                corpora[group] = path
            return corpora[group]

        results: list[Result] = []
        for name in sorted(skills):
            spec = declared[name] or {}
            if args.only and name not in args.only:
                continue
            if "unharnessable" in spec:
                results.append(Result(name, "unharnessable", reason=spec["unharnessable"]))
                continue
            corpus = corpus_for(spec.get("group", "base"))
            results.append(check_skill(name, skills[name], spec, corpus, tmp_root, vars, args.verbose))
    finally:
        if args.keep:
            print(f"\ntemp tree kept at {tmp_root}")
        else:
            shutil.rmtree(tmp_root, ignore_errors=True)

    harnessed = [r for r in results if r.status == "harnessed"]
    unharnessable = [r for r in results if r.status == "unharnessable"]
    failing = [r for r in results if r.status == "fail"]

    for r in failing:
        print(f"FAIL {r.name}")
        for p in r.problems:
            print(f"    - {p}")
    if unharnessable:
        print("\ndeclared unharnessable:")
        for r in unharnessable:
            print(f"  {r.name}: {r.reason}")

    print(f"\n{len(harnessed)} harnessed · {len(unharnessable)} declared-unharnessable · "
          f"{len(failing)} failing  (of {len(results)} skill(s) considered)")
    return 1 if failing else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
