"""The page is published alone — GitHub Pages uploads index.html and nothing
else — so a relative link from it to a file in the repository is a 404 on the
live site. Every one of them was, until these tests existed.
"""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGE = ROOT / "docs" / "index.html"


class PageLinkTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf8")
        cls.data = json.loads(
            re.search(r'<script id="navi-catalogue" type="application/json">(.*?)</script>',
                      cls.html, re.S).group(1))

    def test_no_link_reaches_outside_the_published_page(self):
        """`href="../x"` resolves above the site root, where nothing is published.
        The one exception is the dev copy's bare `../`, which is how it points at
        the stable page one directory up."""
        for href in re.findall(r'href="(\.\.[^"]*)"', self.html):
            self.assertEqual(href, "../",
                             f'{href} resolves outside the published site')

    def test_the_source_link_helper_is_present(self):
        """Source links go to the repository, on the branch this copy was built
        from, because the files themselves are not published."""
        self.assertIn("function src(path)", self.html)
        self.assertIn("/blob/", self.html)

    def test_every_source_path_the_page_links_to_exists(self):
        """A link is only as good as its target. These paths are built from
        frontmatter, so a moved or renamed file breaks them silently."""
        missing = []
        for item in self.data["skills"] + self.data["agents"]:
            m = item["readme"]
            readme = re.sub(r"/[^/]+$", "/README.md", m["source"])
            for path in (m["authority"]["html"], m["source"], readme):
                if not (ROOT / path).is_file():
                    missing.append(f'{item["name"]} -> {path}')
        self.assertEqual(missing, [], "the page links to files that do not exist")

    def test_every_item_has_what_the_detail_pane_renders(self):
        """A missing field renders as an empty section rather than an error, so
        nothing else catches it."""
        for item in self.data["skills"] + self.data["agents"]:
            name = item["name"]
            self.assertTrue(item.get("summary", "").strip(), f"{name} has no card summary")
            self.assertTrue(item["readme"].get("lead", "").strip(), f"{name} has no lead")
        for s in self.data["skills"]:
            self.assertTrue(s["readme"].get("rules_out"),
                            f'{s["name"]} has no anti-patterns to show')

    def test_no_skill_summary_opens_with_the_trigger_phrase(self):
        """All 50 frontmatter descriptions begin "Use when ...", which is right for
        an agent matching on them and wrong as the first line a person reads."""
        for s in self.data["skills"]:
            self.assertFalse(s["readme"]["lead"].startswith("Use when"),
                             f'{s["name"]}: the lead still opens with the trigger sentence')


if __name__ == "__main__":
    unittest.main()
