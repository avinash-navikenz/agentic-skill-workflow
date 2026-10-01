# The overview deck

`docs/navi-delivery-overview.pptx` — 19 slides, built by `build-deck.js`.

The generator is committed. It used to live outside the repository, and the cost of that
showed up exactly where you would expect: the adoption slide said "39 skills" long after
there were more, and nothing could have caught it, because the only way to rebuild the
deck was to have the author's scratch directory.

## Rebuilding

`pptxgenjs` is never installed into this repository — zero runtime dependencies is a
stated guarantee, and `npm install` here would rewrite the root `package.json`. Supply
it from outside instead:

```bash
npm install --prefix /tmp/deckdeps pptxgenjs
NODE_PATH=/tmp/deckdeps/node_modules node docs/deck/build-deck.js
```

That writes `docs/navi-delivery-overview.pptx` in place. Pass a path as the first
argument to write somewhere else.

## What is derived, and what is not

Every count on every slide is read from the tree at build time — skills, agents,
disciplines, and the discipline bar chart including its scale and its row split. None of
them is typed into the script. A new skill therefore changes the deck's numbers on the
next rebuild, and a new discipline lands inside the chart rather than off the bottom of
it.

The prose is not derived. A slide whose *claim* stops being true — a verb that is
removed, a limitation that is fixed — needs an edit here, and CI cannot tell you that.

## Inputs

| File | What it is |
| --- | --- |
| `build-deck.js` | the generator; every diagram and icon is drawn with pptxgenjs shapes |
| `logo.json` | the Navikenz wordmark, rasterised to base64 PNG in cream and navy |
| `make-logo.py` | rebuilds `logo.json` from `assets/brand/navikenz-logo.svg` (qlmanage + Pillow, both already on macOS) |
| `assets/brand/tokens.json` | the palette, read at build time — no colour is invented in the script |

## Checking a rebuild

There is no LibreOffice on the machines this was built on, so a rendered visual pass is
not available. Two checks are:

```bash
python3 <pptx-skill>/scripts/office/validate.py docs/navi-delivery-overview.pptx
```

and a geometry pass over the generated XML — shapes off the canvas, and text boxes
overlapping each other — which is what caught the two-line wrap in a 0.48in card on the
telemetry slide. Both are worth running before committing a rebuilt deck.
