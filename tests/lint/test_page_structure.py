"""The page is one HTML file edited by hand and by script. A patch that computed
its end offset from the start of the file rather than from its own start once
duplicated 280 lines of it — four routes and two catalogue sections, with
duplicate ids. The router shows every element matching a route, so both copies
rendered; `querySelector` wires only the first, so the second was a dead shell
with empty dropdowns. Nothing caught it: the catalogue check reads only the JSON
block, and the page still "worked" above the fold.
"""
import collections
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGE = ROOT / "docs" / "index.html"

# A CSS selector string inside the script — `querySelector('[data-cat="agent"]')`
# — is byte-identical to the attribute in the markup. Only the markup form is
# preceded by whitespace rather than an opening bracket or quote.
MARKUP_ROUTE = re.compile(r'(?<=\s)data-route="([^"]*)"')
MARKUP_CAT = re.compile(r'(?<=\s)data-cat="([^"]+)"')


class PageStructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf8")

    def test_no_id_is_used_twice(self):
        ids = re.findall(r'\sid="([^"]+)"', self.html)
        dupes = [i for i, n in collections.Counter(ids).items() if n > 1]
        self.assertEqual(dupes, [], "duplicate element ids")

    def test_every_route_appears_exactly_once(self):
        routes = re.findall(MARKUP_ROUTE, self.html)
        dupes = [r for r, n in collections.Counter(routes).items() if n > 1]
        self.assertEqual(dupes, [], "a route rendered more than once")

    def test_each_catalogue_kind_has_exactly_one_section(self):
        """buildCatalogue() uses querySelector, so a second section of the same
        kind is never wired: empty filters, empty list, empty detail pane."""
        kinds = re.findall(MARKUP_CAT, self.html)
        self.assertEqual(sorted(kinds), ["agent", "skill"])

    def test_every_nav_route_has_a_page_and_every_page_a_nav_entry(self):
        nav = {h[2:] for h in re.findall(r'href="(#/[a-z-]*)"', self.html)}
        pages = set(re.findall(MARKUP_ROUTE, self.html))
        self.assertEqual(nav - pages, set(), "nav links to a route with no page")
        self.assertEqual(pages - nav, set(), "a page no nav entry reaches")


if __name__ == "__main__":
    unittest.main()
