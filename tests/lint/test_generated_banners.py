"""The adapters are generated and committed. A banner that names an absolute
path makes every local build rewrite all 111 files to the builder's home
directory, and every CI build rewrite them back — an endless phantom diff,
and the builder's home directory published in a public repo."""
import pathlib
import re
import os
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
BANNER = re.compile(r"source: (\S+) -->")


class GeneratedBannerTest(unittest.TestCase):
    def test_no_committed_banner_names_an_absolute_path(self):
        for path in list(ROOT.glob("adapters/**/*.md")) + list(ROOT.glob("templates/**/*.md")):
            for shown in BANNER.findall(path.read_text(encoding="utf8")):
                self.assertFalse(shown.startswith("/"),
                                 f"{path.relative_to(ROOT)} names an absolute source path")

    def test_the_build_is_byte_identical_from_a_relative_and_an_absolute_root(self):
        """`main()` defaults the root to Path.cwd() (absolute); a caller may pass
        a relative one. Both must produce the same bytes, or a local build and a
        CI build rewrite each other's output forever."""
        sys.path.insert(0, str(ROOT))
        from scripts.build_adapters import build

        outs = []
        for root in (ROOT, pathlib.Path(os.path.relpath(ROOT, os.getcwd()))):
            with tempfile.TemporaryDirectory() as tmp:
                build(root, pathlib.Path(tmp))
                outs.append({
                    p.relative_to(tmp).as_posix(): p.read_bytes()
                    for p in pathlib.Path(tmp).rglob("*") if p.is_file()
                })
        self.assertEqual(outs[0], outs[1],
                         "a relative and an absolute build root produce different bytes")


if __name__ == "__main__":
    unittest.main()
