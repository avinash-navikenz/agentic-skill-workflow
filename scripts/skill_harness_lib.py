"""Shared parsing for the Validation harness.

The SKILL.md body is Markdown whose Template blocks themselves contain `##`
headings, so a naive heading split truncates every Template at the first
heading *inside* its own fence. Both helpers here are fence-aware for that
reason.
"""
import re
from pathlib import Path

FENCE_RE = re.compile(r"^(`{3,})(.*)$")


def split_sections(text: str) -> dict:
    """Map H2 heading -> body, ignoring headings that sit inside a code fence."""
    out: dict[str, str] = {}
    name: str | None = None
    cur: list[str] = []
    marker = ""
    for line in text.splitlines(keepends=True):
        m = FENCE_RE.match(line.rstrip("\n"))
        if m:
            if not marker:
                marker = m.group(1)
            elif m.group(1) == marker and not m.group(2).strip():
                marker = ""
        if not marker and line.startswith("## "):
            if name is not None:
                out[name] = "".join(cur)
            name, cur = line[3:].strip(), []
            continue
        cur.append(line)
    if name is not None:
        out[name] = "".join(cur)
    return out


def fences(block: str) -> list[tuple[str, str]]:
    """Return [(language, body), ...] for every fenced block in `block`."""
    out: list[tuple[str, str]] = []
    cur: list[str] = []
    lang = ""
    marker = ""
    for line in block.splitlines(keepends=True):
        m = FENCE_RE.match(line.rstrip("\n"))
        if m and not marker:
            marker, lang, cur = m.group(1), m.group(2).strip(), []
            continue
        if m and marker and m.group(1) == marker and not m.group(2).strip():
            out.append((lang, "".join(cur)))
            marker = ""
            continue
        if marker:
            cur.append(line)
    return out


def skill_files(root: Path) -> list[Path]:
    return sorted(root.glob("skills/*/*/SKILL.md"))


def skill_sections(path: Path) -> dict:
    return split_sections(path.read_text(encoding="utf-8"))
