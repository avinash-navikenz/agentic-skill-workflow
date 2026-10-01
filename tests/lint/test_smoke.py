import unittest
from pathlib import Path

class TestLayout(unittest.TestCase):
    def test_package_importable(self):
        root = Path(__file__).resolve().parents[2]
        self.assertTrue((root / "scripts" / "navi_lint" / "__init__.py").exists())

if __name__ == "__main__":
    unittest.main()
