"""Unit tests for the page and README generator.

The generator had none. The three functions below are the ones whose silent
failure would be expensive: _carry_notes decides whether a person's hand-written
note survives a regeneration, _apply_counts is the only thing keeping the page's
numbers honest, and _replace_region is what writes into the page at all.
"""
import unittest

from scripts.build_catalogue import (
    CatalogueError, NOTES_BEGIN, NOTES_END, NOTES_PLACEHOLDER,
    _apply_counts, _bold_leads, _bullets, _carry_notes, _label, _md_rows,
    _replace_region, _sections, _split_description, _squash,
)

GENERATED = f"head\n{NOTES_BEGIN}\n{NOTES_PLACEHOLDER}\n{NOTES_END}\ntail"


class TestNotes(unittest.TestCase):
    def test_a_hand_written_note_survives_regeneration(self):
        existing = f"old head\n{NOTES_BEGIN}\nMind the rate limit.\n{NOTES_END}\nold tail"
        out = _carry_notes(existing, GENERATED)
        self.assertIn("Mind the rate limit.", out)
        self.assertTrue(out.startswith("head"))
        self.assertTrue(out.endswith("tail"))

    def test_an_untouched_placeholder_is_replaced_not_carried(self):
        existing = f"x\n{NOTES_BEGIN}\n{NOTES_PLACEHOLDER}\n{NOTES_END}\ny"
        self.assertEqual(_carry_notes(existing, GENERATED), GENERATED)

    def test_an_empty_note_region_is_replaced(self):
        existing = f"x\n{NOTES_BEGIN}\n   \n{NOTES_END}\ny"
        self.assertEqual(_carry_notes(existing, GENERATED), GENERATED)

    def test_a_file_without_markers_is_regenerated_whole(self):
        self.assertEqual(_carry_notes("no markers here", GENERATED), GENERATED)


class TestCounts(unittest.TestCase):
    def test_every_span_is_rewritten(self):
        html = '<span data-total="skills">1</span> and <span data-total="skills">1</span>'
        self.assertEqual(_apply_counts(html, {"skills": 46}).count(">46<"), 2)

    def test_a_count_the_catalogue_does_not_know_is_refused_by_name(self):
        with self.assertRaises(CatalogueError) as cm:
            _apply_counts('<span data-total="widgets">3</span>', {"skills": 1})
        self.assertIn("widgets", str(cm.exception))

    def test_text_outside_a_span_is_untouched(self):
        html = 'there are 45 skills <span data-total="skills">45</span>'
        self.assertEqual(_apply_counts(html, {"skills": 46}),
                         'there are 45 skills <span data-total="skills">46</span>')


class TestRegion(unittest.TestCase):
    def test_the_body_between_the_markers_is_replaced(self):
        html = "a\n<!-- B -->\nold\n<!-- E -->\nz"
        self.assertEqual(_replace_region(html, "<!-- B -->", "<!-- E -->", "new"),
                         "a\n<!-- B -->\nnew\n<!-- E -->\nz")

    def test_a_missing_marker_is_an_error_rather_than_a_silent_no_op(self):
        for html in ("a\n<!-- B -->\nz", "a\n<!-- E -->\nz", "a\n<!-- E -->\n<!-- B -->\nz"):
            with self.assertRaises(CatalogueError):
                _replace_region(html, "<!-- B -->", "<!-- E -->", "new")


class TestParsing(unittest.TestCase):
    def test_sections_split_on_level_two_headings_only(self):
        body = "## One\na\n### Deeper\nb\n## Two\nc"
        self.assertEqual(_sections(body), {"One": "a\n### Deeper\nb", "Two": "c"})

    def test_a_wrapped_bullet_is_unwrapped_into_one_item(self):
        self.assertEqual(_bullets("- first line\n  continued\n- second"),
                         ["first line continued", "second"])

    def test_trigger_phrases_are_split_off_the_description(self):
        head, phrases = _split_description("Use when x happens. Trigger phrases include: a, b , c.")
        self.assertEqual(head, "Use when x happens.")
        self.assertEqual(phrases, ["a", "b", "c"])

    def test_a_description_without_triggers_keeps_all_its_prose(self):
        self.assertEqual(_split_description("Use when x."), ("Use when x.", []))

    def test_acronyms_in_a_name_are_not_title_cased_into_nonsense(self):
        self.assertEqual(_label("navi-skill-api-design"), "API design")
        self.assertEqual(_label("navi-skill-azure-pipelines"), "Azure pipelines")

    def test_bold_leads_are_taken_from_line_starts_only(self):
        text = "**First.** body\nnot a **lead** mid-line\n**Second.** body"
        self.assertEqual(_bold_leads(text), ["First.", "Second."])

    def test_a_markdown_table_drops_its_separator_and_keeps_every_other_row(self):
        table = "| A | B |\n|:--|--:|\n| 1 | 2 |\n| 3 | 4 |"
        self.assertEqual(_md_rows(table), [["A", "B"], ["1", "2"], ["3", "4"]])

    def test_a_cell_of_dashes_that_is_not_a_separator_survives(self):
        self.assertEqual(_md_rows("| a | --- |\n| - | x |"), [["a", "---"], ["-", "x"]])

    def test_hard_wrapped_prose_squashes_onto_one_line(self):
        self.assertEqual(_squash("a\n  b\n\nc "), "a b c")


if __name__ == "__main__":
    unittest.main()
