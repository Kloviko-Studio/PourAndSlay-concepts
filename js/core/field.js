var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const R = () => PS.Rng;
  const KIND_CAP = { big: 6, vial: 2 };
  const LAYER_WEIGHT = 4;
  const isJunk = c => c === 'stone' || c === 'slime';
  const top = t => (t.layers.length ? t.layers[t.layers.length - 1] : null);

  function topBlock(t) {
    const color = top(t);
    let n = 0;
    for (let i = t.layers.length - 1; i >= 0 && t.layers[i] === color; i--) n++;
    return { color, n };
  }

  const makeTube = (kind, cap) => ({ kind, cap: KIND_CAP[kind] || cap, layers: [], frozen: 0 });

  function pourAmount(F, a, b) {
    const ta = F.tubes[a], tb = F.tubes[b];
    if (a === b || !ta || !tb || ta.frozen || tb.frozen || !ta.layers.length) return 0;
    const { color, n } = topBlock(ta);
    // A sieve needs no free space for junk because junk never lands in it.
    if (tb.kind === 'sieve' && isJunk(color)) return n;
    const free = tb.cap - tb.layers.length;
    if (free <= 0) return 0;
    if (tb.kind !== 'vial' && tb.layers.length && top(tb) !== color) return 0;
    return Math.min(n, free);
  }

  function pour(F, a, b) {
    const n = pourAmount(F, a, b);
    if (!n) return { n: 0, color: null, swallowed: false };
    const ta = F.tubes[a], tb = F.tubes[b];
    const color = top(ta);
    ta.layers.length -= n;
    if (tb.kind === 'sieve' && isJunk(color)) return { n, color, swallowed: true };
    for (let i = 0; i < n; i++) tb.layers.push(color);
    return { n, color, swallowed: false };
  }

  function isClosed(F, i) {
    const t = F.tubes[i];
    if (!t || t.kind === 'vial' || !t.layers.length || t.layers.length !== t.cap) return false;
    return t.layers.every(x => x === t.layers[0]);
  }

  function anyMove(F) {
    for (let a = 0; a < F.tubes.length; a++)
      for (let b = 0; b < F.tubes.length; b++) if (pourAmount(F, a, b)) return true;
    return false;
  }

  const totalLayers = F => F.tubes.reduce((s, t) => s + t.layers.length, 0);

  function drawLayer(F, rng) {
    if (F.junkPct > 0 && R().chance(rng, F.junkPct)) return 'slime';
    if (!F.bag.length) {
      const flat = Object.keys(F.deck).flatMap(c => Array(F.deck[c]).fill(c));
      F.bag = R().shuffle(rng, flat);
    }
    return F.bag.pop();
  }

  function makePortion(F, rng) {
    const p = [];
    for (let i = 0; i < F.cap; i++) p.push(drawLayer(F, rng));
    return p;
  }

  // Every deck colour gets a full set (filled >= deck size); the rest are drawn by weight.
  function genLayers(rng, colors, filled, cap) {
    const bag = colors.flatMap(c => Array(LAYER_WEIGHT).fill(c));
    let rows;
    for (let k = 0; k < 200; k++) {
      const sets = R().shuffle(rng, colors.slice()).slice(0, filled);
      while (sets.length < filled) sets.push(R().pick(rng, bag));
      const layers = R().shuffle(rng, sets.flatMap(c => Array(cap).fill(c)));
      rows = [];
      for (let s = 0; s < filled; s++) rows.push(layers.slice(s * cap, (s + 1) * cap));
      if (!rows.some(l => l.every(x => x === l[0]))) break;
    }
    return rows;
  }

  function create(rng, opts) {
    const deckIds = opts.deck.slice();
    const cap = opts.cap || 4;
    const filled = Math.max(opts.filledMin || 5, deckIds.length);
    const deck = {};
    deckIds.forEach(c => { deck[c] = LAYER_WEIGHT; });
    const F = {
      tubes: [], queue: [], bag: [], cap, filled,
      minLayers: (filled - 1) * cap, deck, junkPct: opts.junkPct || 0,
    };
    // Needs a slot with free space to be solvable at all; retry just reshuffles the layers.
    for (let attempt = 0; attempt < 100; attempt++) {
      F.tubes = genLayers(rng, deckIds, filled, cap).map(l => ({ kind: 'plain', cap, layers: l, frozen: 0 }));
      (opts.slots || []).forEach(k => F.tubes.push(makeTube(k, cap)));
      if (anyMove(F)) break;
    }
    for (let i = 0; i < 3; i++) F.queue.push(makePortion(F, rng));
    return F;
  }

  function refill(F, rng, i) {
    const t = F.tubes[i];
    const p = F.queue.shift();
    F.queue.push(makePortion(F, rng));
    for (let k = 0; k < 7; k++) {
      t.layers = p.slice(0, t.cap);
      if (anyMove(F)) break;
      R().shuffle(rng, p);
    }
    return t.layers.slice();
  }

  function drain(F, rng, i) {
    const t = F.tubes[i];
    t.frozen = 0;
    t.layers = [];
    const refilled = totalLayers(F) < F.minLayers;
    if (refilled) refill(F, rng, i);
    return { refilled };
  }

  function layout(F) {
    const row0 = [], row1 = [];
    F.tubes.forEach((_, i) => (i < F.filled ? row0 : row1).push(i));
    return { rows: [row0, row1] };
  }

  function neighbors(F, i) {
    for (const row of layout(F).rows) {
      const p = row.indexOf(i);
      if (p >= 0) return [row[p - 1], row[p + 1]].filter(j => j !== undefined);
    }
    return [];
  }

  function breakStonesNear(F, i) {
    const out = [];
    for (const j of neighbors(F, i)) {
      const t = F.tubes[j];
      const n = t.layers.filter(x => x === 'stone').length;
      if (n) { t.layers = t.layers.filter(x => x !== 'stone'); out.push({ tube: j, n }); }
    }
    return out;
  }

  // Mutates: removes the top layer of each non-empty neighbour.
  function bombNeighbors(F, i) {
    const out = [];
    for (const j of neighbors(F, i)) {
      const t = F.tubes[j];
      if (t.layers.length) out.push({ tube: j, color: t.layers.pop() });
    }
    return out;
  }

  const idxWhere = (F, f) => F.tubes.map((t, j) => j).filter(j => f(F.tubes[j]));

  function addStones(F, rng, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const c = idxWhere(F, t => !t.frozen && t.layers.length < t.cap);
      if (!c.length) break;
      const j = R().pick(rng, c);
      // A sieve swallows any junk that lands in it, thrown or poured.
      if (F.tubes[j].kind !== 'sieve') F.tubes[j].layers.push('stone');
      out.push(j);
    }
    return out;
  }

  function sporeQueue(F, rng, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const portion = k % F.queue.length, p = F.queue[portion];
      const all = p.map((c, x) => x);
      const clean = all.filter(x => p[x] !== 'slime');
      const pos = R().pick(rng, clean.length ? clean : all);
      p[pos] = 'slime';
      out.push({ portion, pos });
    }
    return out;
  }

  function freezeRandom(F, rng, turns) {
    const c = idxWhere(F, t => !t.frozen && t.layers.length);
    if (!c.length) return -1;
    const j = R().pick(rng, c);
    F.tubes[j].frozen = turns;
    return j;
  }

  function stealTop(F, rng) {
    const c = idxWhere(F, t => !t.frozen && t.layers.length && !isJunk(top(t)));
    if (!c.length) return null;
    const j = R().pick(rng, c);
    const out = { tube: j, color: F.tubes[j].layers.pop() };
    // Like a drain: a thief must not be able to empty the field, so a thin field gets an empty tube refilled.
    if (totalLayers(F) < F.minLayers) {
      const e = F.tubes[j].layers.length ? idxWhere(F, t => !t.frozen && !t.layers.length && t.kind !== 'vial')[0] : j;
      if (e != null) { refill(F, rng, e); out.refilled = e; }
    }
    return out;
  }

  function swapColors(F, rng) {
    const present = [...new Set(F.tubes.flatMap(t => t.layers).filter(c => !isJunk(c)))];
    if (present.length < 2) return null;
    const [a, b] = R().shuffle(rng, present);
    F.tubes.forEach(t => { t.layers = t.layers.map(c => (c === a ? b : c === b ? a : c)); });
    return { a, b };
  }

  function tickFrozen(F) {
    F.tubes.forEach(t => { if (t.frozen > 0) t.frozen--; });
  }

  function solvent(F, i) {
    const t = F.tubes[i];
    return t.layers.length ? t.layers.pop() : null;
  }

  function shake(F, rng, i) {
    const t = F.tubes[i];
    R().shuffle(rng, t.layers);
    return t.layers.slice();
  }

  function addFlask(F) {
    F.tubes.push(makeTube('plain', F.cap));
    return F.tubes.length - 1;
  }

  const closableAfterEnemy = F => F.tubes.map((t, i) => i).filter(i => isClosed(F, i));

  PS.Field = {
    create, pourAmount, pour, isClosed, anyMove, refill, drain, breakStonesNear, bombNeighbors,
    neighbors, layout, addStones, sporeQueue, freezeRandom, stealTop, swapColors, tickFrozen,
    solvent, shake, addFlask, closableAfterEnemy,
  };
})();
