# Project rules

## Images
- When asked to rename images, give each a simple, short `snake_case` name that says what it is, prefixed by its kind when the folder mixes kinds: `tube_amp`, `liquid_fire`, `element_water`, `cork`. Never keep generator names like `Golden amplifier test tube-1`.
- Originals stay as `.png` art sources; the game loads the `.webp` written next to them by `python tools/compress-images.py`. New sizes, quality or trimming go into that script's rules, not into one-off conversions.

## Deploy
- After any change in `css/` or `js/`, run `node tools/stamp-assets.mjs` before committing. GitHub Pages lets browsers cache files for 10 minutes; without fresh `?v=` stamps a phone mixes new scripts with stale styles and screens fall apart.
