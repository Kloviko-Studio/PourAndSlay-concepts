# Project rules

## Images
- When asked to rename images, give each a simple, short `snake_case` name that says what it is, prefixed by its kind when the folder mixes kinds: `tube_amp`, `liquid_fire`, `element_water`, `cork`. Never keep generator names like `Golden amplifier test tube-1`.
- Originals stay as `.png` art sources; the game loads the `.webp` written next to them by `python tools/compress-images.py`. New sizes, quality or trimming go into that script's rules, not into one-off conversions.

## Battle locations
- When the user sends layers for an island's battle location (arena backdrop, ground cap, dungeon earth), connect them by `../pour-and-slay/docs/art/battle-locations.md` without re-asking the decisions recorded there: files go to `img/battle/island_<NN>/` (two-digit number), the island gets `battleArt` in `js/data.js`, nothing else in the code changes. A layer that doesn't fit those rules gets regenerated, not compensated in code.

## Deploy
- After any change in `css/` or `js/`, run `node tools/stamp-assets.mjs` before committing. GitHub Pages lets browsers cache files for 10 minutes; without fresh `?v=` stamps a phone mixes new scripts with stale styles and screens fall apart.

## Pour & Slay docs are the source of truth
- Before changing rules, numbers, screens or art in the concept, read the matching spec in `../pour-and-slay/docs/` (`content/`, `screens/`, `art/`, `decisions/`, `CONTEXT.md`). Don't silently break it: if the concept should differ, say so and propose updating the docs (or an ADR) first.
- After every change in the concept, bring those docs in line in the same piece of work: numbers, ids, screen behaviour, animation order, screenshots (`node tools/shoot-screens.mjs`) and lessons worth carrying to the React Native app (`docs/lessons.md` there).
- Exception: things deliberately left out of the concept and built only in the real app (e.g. the living main-screen background). The docs say so explicitly ("в прототипе нет, делается в приложении"); such gaps are not mismatches and need no concept change.
