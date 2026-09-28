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
