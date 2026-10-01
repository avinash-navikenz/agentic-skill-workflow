"""Rasterise the Navikenz wordmark without sharp.

qlmanage (macOS Quick Look, always present) renders the SVG but flattens it onto
white, so the mark is drawn in pure black and the white ground is converted into
an alpha channel. The result is a tightly-cropped transparent PNG that can be
tinted to any brand colour.
"""
import base64, json, pathlib, subprocess, sys
from PIL import Image

# Found from this file, not hardcoded: the previous absolute path was correct on
# exactly one machine.
REPO = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).parent
WORK = HERE / "logo-build"
WORK.mkdir(exist_ok=True)

svg = (REPO / "assets/brand/navikenz-logo.svg").read_text()
black = svg.replace('fill="white"', 'fill="#000000"')
src = WORK / "mark.svg"
src.write_text(black)

subprocess.run(["qlmanage", "-t", "-s", "2400", "-o", str(WORK), str(src)],
               check=True, capture_output=True)
raw = Image.open(WORK / "mark.svg.png").convert("RGB")

# alpha = ink coverage; crop to the drawn mark
lum = raw.convert("L")
alpha = lum.point(lambda v: 255 - v)
bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
alpha = alpha.crop(bbox)
w, h = alpha.size
print(f"mark {w}x{h}  aspect {w/h:.3f}", file=sys.stderr)

out = {}
for name, hexcol in [("cream", "FAF3E7"), ("navy", "051D60"), ("white", "FFFFFF")]:
    rgb = tuple(int(hexcol[i:i+2], 16) for i in (0, 2, 4))
    img = Image.new("RGBA", (w, h), rgb + (0,))
    img.putalpha(alpha)
    p = WORK / f"logo-{name}.png"
    img.save(p)
    out[name] = "image/png;base64," + base64.b64encode(p.read_bytes()).decode()
out["aspect"] = h / w
(HERE / "logo.json").write_text(json.dumps(out))
print("wrote logo.json", file=sys.stderr)
