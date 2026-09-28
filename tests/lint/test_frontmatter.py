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
