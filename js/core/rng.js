var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  // State lives in a plain object so runs serialize and the bot replays deterministically.
  function make(seed) { return { s: (seed >>> 0) || 0x9e3779b9 }; }
  function next(r) {
    r.s = (r.s + 0x6d2b79f5) >>> 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const int = (r, n) => Math.floor(next(r) * n);
  const pick = (r, arr) => arr[int(r, arr.length)];
  function shuffle(r, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = int(r, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  const chance = (r, p) => next(r) < p;
  function weighted(r, items) {
    const total = items.reduce((s, it) => s + (it.w || 0), 0);
    let x = next(r) * total;
    for (const it of items) { x -= it.w || 0; if (x < 0) return it; }
    return items[items.length - 1];
  }
  PS.Rng = { make, next, int, pick, shuffle, chance, weighted };
})();
