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
