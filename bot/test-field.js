const assert = require('assert');
const PS = require('./load.js')(['js/core/rng.js', 'js/core/util.js', 'js/core/field.js']);
const { Field: Fd, Rng } = PS;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };
const mk = (tubes, extra) => Object.assign({
  tubes: tubes.map(t => Object.assign({ kind: 'plain', cap: 4, layers: [], frozen: 0 }, Array.isArray(t) ? { layers: t } : t)),
  queue: [['fire', 'fire', 'fire', 'fire'], ['water', 'water', 'water', 'water'], ['life', 'life', 'life', 'life']],
  bag: [], cap: 4, filled: 2, minLayers: 8, deck: { fire: 4, water: 4, life: 4 }, junkPct: 0,
}, extra);

test('pour basics and amounts', () => {
  const F = mk([['a', 'b', 'b'], ['b'], [], ['a', 'a', 'a', 'a']]);
  assert.strictEqual(Fd.pourAmount(F, 0, 1), 2);
  assert.strictEqual(Fd.pourAmount(F, 0, 2), 2);
  assert.strictEqual(Fd.pourAmount(F, 0, 3), 0);
  assert.strictEqual(Fd.pourAmount(F, 0, 0), 0);
  assert.strictEqual(Fd.pourAmount(F, 2, 1), 0);
  assert.strictEqual(Fd.pourAmount(F, 3, 0), 0);
  assert.deepStrictEqual(Fd.pour(F, 0, 1), { n: 2, color: 'b', swallowed: false });
  assert.deepStrictEqual(F.tubes[1].layers, ['b', 'b', 'b']);
  assert.deepStrictEqual(F.tubes[0].layers, ['a']);
  assert.deepStrictEqual(Fd.pour(F, 2, 1), { n: 0, color: null, swallowed: false });
});

test('free space limits the amount; frozen blocks both ways', () => {
  const F = mk([['a', 'a', 'a'], ['a', 'a'], { layers: ['a'], frozen: 2 }, []]);
  assert.strictEqual(Fd.pourAmount(F, 0, 1), 2);
  assert.strictEqual(Fd.pourAmount(F, 0, 2), 0);
  assert.strictEqual(Fd.pourAmount(F, 2, 3), 0);
});

test('junk pours onto same junk or empty only', () => {
  const F = mk([['a', 'stone'], ['b', 'slime'], ['c', 'stone'], ['d'], []]);
  assert.strictEqual(Fd.pourAmount(F, 0, 1), 0);
  assert.strictEqual(Fd.pourAmount(F, 0, 2), 1);
  assert.strictEqual(Fd.pourAmount(F, 0, 3), 0);
  assert.strictEqual(Fd.pourAmount(F, 0, 4), 1);
  assert.strictEqual(Fd.pourAmount(F, 3, 0), 0);
});

test('sieve swallows junk even when full, colours behave normally', () => {
  const F = mk([['a', 'stone', 'stone'], { kind: 'sieve', layers: ['x', 'x', 'x', 'x'] }, ['y', 'slime'], { kind: 'sieve', layers: [] }, ['a', 'a']]);
  assert.strictEqual(Fd.pourAmount(F, 0, 1), 2);
  assert.deepStrictEqual(Fd.pour(F, 0, 1), { n: 2, color: 'stone', swallowed: true });
  assert.deepStrictEqual(F.tubes[0].layers, ['a']);
  assert.strictEqual(F.tubes[1].layers.length, 4);
  assert.strictEqual(Fd.pour(F, 2, 3).swallowed, true);
  assert.strictEqual(Fd.pourAmount(F, 4, 1), 0);
  assert.strictEqual(Fd.pourAmount(F, 4, 3), 2);
  assert.strictEqual(Fd.pour(F, 4, 3).swallowed, false);
  assert.deepStrictEqual(F.tubes[3].layers, ['a', 'a']);
});

test('vial accepts any colour while it has space, never closes', () => {
  const F = mk([['a', 'b'], { kind: 'vial', cap: 2, layers: ['c'] }, { kind: 'vial', cap: 2, layers: ['a', 'a'] }, { kind: 'vial', cap: 2, layers: [] }]);
  assert.strictEqual(Fd.pourAmount(F, 0, 1), 1);
  Fd.pour(F, 0, 1);
  assert.deepStrictEqual(F.tubes[1].layers, ['c', 'b']);
  assert.strictEqual(Fd.pourAmount(F, 0, 1), 0);
  assert.strictEqual(Fd.pourAmount(F, 0, 2), 0);
  assert.strictEqual(Fd.isClosed(F, 2), false);
  // Pouring out follows normal rules.
  assert.strictEqual(Fd.pourAmount(F, 2, 3), 2);
  assert.strictEqual(Fd.pourAmount(F, 1, 0), 0);
});

test('big cap 6, vial cap 2, isClosed, closableAfterEnemy', () => {
  const F = Fd.create(Rng.make(1), { deck: ['fire', 'water', 'life'], slots: ['big', 'plain', 'vial'], cap: 4, filledMin: 5 });
  assert.strictEqual(F.tubes.find(t => t.kind === 'big').cap, 6);
  assert.strictEqual(F.tubes.find(t => t.kind === 'vial').cap, 2);
  const G = mk([['a', 'a', 'a', 'a'], ['a', 'a', 'a', 'b'], { kind: 'big', cap: 6, layers: Array(6).fill('x') }, { kind: 'big', cap: 6, layers: Array(5).fill('x') }, ['stone', 'stone', 'stone', 'stone'], [], { kind: 'vial', cap: 2, layers: ['a', 'a'] }]);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map(i => Fd.isClosed(G, i)), [true, false, true, false, true, false, false]);
  assert.deepStrictEqual(Fd.closableAfterEnemy(G), [0, 2, 4]);
});

const DECKS = [['fire', 'water', 'life'], ['fire', 'water', 'life', 'poison'], ['fire', 'water', 'life', 'poison', 'ice']];
const SLOTS = [['plain', 'plain', 'plain'], ['plain', 'sieve', 'big'], ['vial', 'amp', 'bomb', 'catalyst', 'plain'], ['plain'], ['vial']];

test('generation: never pre-closed, always has a move (1000 seeds x decks x slots)', () => {
  for (let seed = 1; seed <= 1000; seed++)
    for (const deck of DECKS) for (const slots of SLOTS) {
      const F = Fd.create(Rng.make(seed), { deck, slots, cap: 4, filledMin: 5 });
      const filled = Math.max(5, deck.length);
      assert.strictEqual(F.tubes.length, filled + slots.length);
      assert.strictEqual(F.queue.length, 3);
      assert.strictEqual(F.minLayers, (filled - 1) * 4);
      for (let i = 0; i < F.tubes.length; i++) assert.ok(!Fd.isClosed(F, i), 'pre-closed');
      assert.ok(Fd.anyMove(F), 'no move');
      for (const c of deck) assert.ok(F.tubes.some(t => t.layers.includes(c)), 'colour missing');
      for (let i = 0; i < filled; i++) assert.strictEqual(F.tubes[i].layers.length, 4);
      for (let i = filled; i < F.tubes.length; i++) assert.strictEqual(F.tubes[i].layers.length, 0);
    }
});

test('junkPct converts portion layers to slime; 0 gives none', () => {
  let none = 0, some = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const A = Fd.create(Rng.make(seed), { deck: DECKS[0], slots: SLOTS[0], junkPct: 0 });
    const B = Fd.create(Rng.make(seed), { deck: DECKS[0], slots: SLOTS[0], junkPct: 0.5 });
    none += A.queue.flat().filter(c => c === 'slime').length;
    some += B.queue.flat().filter(c => c === 'slime').length;
  }
  assert.strictEqual(none, 0);
  const ratio = some / (200 * 12);
  assert.ok(ratio > 0.4 && ratio < 0.6, String(ratio));
});

test('bag: 3 colours x 4 layers = 12 drawn layers hold exactly 4 of each', () => {
  const F = Fd.create(Rng.make(7), { deck: DECKS[0], slots: SLOTS[0] });
  assert.deepStrictEqual(F.deck, { fire: 4, water: 4, life: 4 });
  // create drew 12 layers into the queue from one bag
  const counts = {};
  F.queue.flat().forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  assert.deepStrictEqual(counts, { fire: 4, water: 4, life: 4 });
});

test('refill takes the next portion and pushes a new one', () => {
  const F = mk([[], ['a'], []]);
  const first = F.queue[0].slice(), second = F.queue[1].slice();
  const got = Fd.refill(F, Rng.make(3), 0);
  assert.deepStrictEqual(got.slice().sort(), first.slice().sort());
  assert.deepStrictEqual(F.tubes[0].layers, got);
  assert.deepStrictEqual(F.queue[0], second);
  assert.strictEqual(F.queue.length, 3);
  assert.strictEqual(F.queue[2].length, 4);
});

test('refill reshuffles so a move exists when possible', () => {
  let ok = 0;
  const N = 300;
  for (let seed = 1; seed <= N; seed++) {
    // Only the refilled tube's top 'a' onto tube 1 gives a move.
    const F = mk([[], ['b', 'c', 'a'], ['c', 'b', 'c', 'b']]);
    F.queue[0] = ['b', 'c', 'a', 'a'];
    const before = F.queue[0].slice();
    const got = Fd.refill(F, Rng.make(seed), 0);
    assert.deepStrictEqual(got.slice().sort(), before.slice().sort());
    if (Fd.anyMove(F)) ok++;
  }
  assert.ok(ok / N >= 0.98, 'ratio ' + ok / N);
  // A portion that already allows a move keeps its order.
  const F = mk([[], ['a']]);
  F.queue[0] = ['b', 'b', 'a', 'a'];
  assert.deepStrictEqual(Fd.refill(F, Rng.make(1), 0), ['b', 'b', 'a', 'a']);
  // No possible move: terminates and still fills the tube.
  const G = mk([[], ['a', 'b', 'a', 'b']]);
  G.queue[0] = ['c', 'c', 'c', 'c'];
  assert.strictEqual(Fd.refill(G, Rng.make(1), 0).length, 4);
});

test('drain empties, clears frozen, refills only below minLayers', () => {
  const rng = Rng.make(5);
  const F = mk([{ layers: ['a', 'b', 'a', 'b'], frozen: 3 }, ['a', 'a', 'a', 'a'], ['b', 'b', 'b', 'a'], []], { minLayers: 8 });
  assert.strictEqual(Fd.drain(F, rng, 0).refilled, false);
  assert.deepStrictEqual(F.tubes[0].layers, []);
  assert.strictEqual(F.tubes[0].frozen, 0);
  const H = mk([{ layers: ['a', 'b', 'a', 'b'], frozen: 1 }, ['a', 'a'], [], []], { minLayers: 8 });
  assert.strictEqual(Fd.drain(H, rng, 0).refilled, true);
  assert.strictEqual(H.tubes[0].layers.length, 4);
  assert.strictEqual(H.tubes[0].frozen, 0);
  const K = mk([['a', 'b', 'a', 'b'], ['a', 'a', 'a', 'a'], ['b', 'b', 'b', 'a'], []], { minLayers: 8 });
  assert.strictEqual(Fd.drain(K, rng, 0).refilled, false);
});

test('enemy ops: addStones only into non-frozen tubes with space', () => {
  const rng = Rng.make(11);
  const F = mk([['a', 'a', 'a', 'a'], { layers: ['a'], frozen: 2 }, ['b', 'b', 'b'], []]);
  for (let k = 0; k < 20; k++) {
    const G = JSON.parse(JSON.stringify(F));
    const got = Fd.addStones(G, rng, 2);
    assert.strictEqual(got.length, 2);
    assert.ok(got.every(j => j === 2 || j === 3));
    assert.strictEqual(G.tubes[1].layers.length, 1);
    assert.strictEqual(G.tubes[0].layers.length, 4);
    assert.ok(G.tubes.every(t => t.layers.length <= t.cap));
  }
  const full = mk([['a', 'a', 'a', 'a'], { layers: [], frozen: 1 }]);
  assert.deepStrictEqual(Fd.addStones(full, rng, 3), []);
  const one = mk([['a', 'a', 'a'], ['a', 'a', 'a', 'a']]);
  assert.deepStrictEqual(Fd.addStones(one, rng, 3), [0]);
});

test('enemy ops: stealTop skips junk tops and frozen tubes', () => {
  const rng = Rng.make(2);
  for (let k = 0; k < 30; k++) {
    const F = mk([['a', 'stone'], ['b', 'c'], { layers: ['d'], frozen: 1 }, []], { minLayers: 0 });
    assert.deepStrictEqual(Fd.stealTop(F, rng), { tube: 1, color: 'c' });
    assert.deepStrictEqual(F.tubes[1].layers, ['b']);
  }
  assert.strictEqual(Fd.stealTop(mk([['a', 'slime'], []]), rng), null);
  // A thin field gets an empty tube refilled from the queue, so a thief can't empty it.
  const T = mk([['a'], [], []], { minLayers: 4 });
  const r = Fd.stealTop(T, rng);
  assert.strictEqual(r.tube, 0);
  assert.strictEqual(r.refilled, 0);
  assert.deepStrictEqual(T.tubes[0].layers, ['fire', 'fire', 'fire', 'fire']);
});

test('enemy ops: swapColors, freezeRandom, tickFrozen, sporeQueue', () => {
  const rng = Rng.make(4);
  const F = mk([['a', 'b', 'stone'], ['b', 'a', 'slime'], ['a']]);
  const s = Fd.swapColors(F, rng);
  assert.deepStrictEqual([s.a, s.b].sort(), ['a', 'b']);
  assert.deepStrictEqual(F.tubes.map(t => t.layers), [['b', 'a', 'stone'], ['a', 'b', 'slime'], ['b']]);
  assert.strictEqual(Fd.swapColors(mk([['a', 'a'], ['stone']]), rng), null);

  const G = mk([[], { layers: ['a'], frozen: 2 }, ['b']]);
  assert.strictEqual(Fd.freezeRandom(G, rng, 3), 2);
  assert.strictEqual(G.tubes[2].frozen, 3);
  assert.strictEqual(Fd.freezeRandom(G, rng, 3), -1);
  Fd.tickFrozen(G);
  assert.deepStrictEqual(G.tubes.map(t => t.frozen), [0, 1, 2]);

  const H = mk([[]]);
  const sp = Fd.sporeQueue(H, rng, 3);
  assert.deepStrictEqual(sp.map(x => x.portion), [0, 1, 2]);
  sp.forEach(x => assert.strictEqual(H.queue[x.portion][x.pos], 'slime'));
  Fd.sporeQueue(H, rng, 3);
  assert.ok(H.queue.every(p => p.filter(c => c === 'slime').length === 2));
});

test('potions: solvent, shake, addFlask', () => {
  const F = mk([['a', 'b', 'c', 'd'], []]);
  assert.strictEqual(Fd.solvent(F, 0), 'd');
  assert.strictEqual(Fd.solvent(F, 1), null);
  Fd.shake(F, Rng.make(9), 0);
  assert.deepStrictEqual(F.tubes[0].layers.slice().sort(), ['a', 'b', 'c']);
  assert.strictEqual(Fd.addFlask(F), 2);
  assert.strictEqual(F.tubes[2].cap, 4);
  assert.strictEqual(F.tubes[2].kind, 'plain');
});

test('breakStonesNear and bombNeighbors act on same-row neighbours', () => {
  const F = mk([['a', 'stone', 'stone'], ['b', 'b', 'b', 'b'], ['stone', 'c'], ['d', 'stone'], []], { filled: 3 });
  assert.deepStrictEqual(Fd.breakStonesNear(F, 1), [{ tube: 0, n: 2 }, { tube: 2, n: 1 }]);
  assert.deepStrictEqual(F.tubes[0].layers, ['a']);
  assert.deepStrictEqual(F.tubes[2].layers, ['c']);
  assert.deepStrictEqual(Fd.breakStonesNear(F, 1), []);
  // tube 2 (row 0) is not a neighbour of tube 3 (row 1)
  assert.deepStrictEqual(Fd.breakStonesNear(F, 4), [{ tube: 3, n: 1 }]);
  const G = mk([['a', 'x'], ['b'], ['c', 'y']], { filled: 3 });
  assert.deepStrictEqual(Fd.bombNeighbors(G, 1), [{ tube: 0, color: 'x' }, { tube: 2, color: 'y' }]);
  assert.deepStrictEqual(G.tubes.map(t => t.layers), [['a'], ['b'], ['c']]);
  const H = mk([['a'], [], []], { filled: 3 });
  assert.deepStrictEqual(Fd.bombNeighbors(H, 1), [{ tube: 0, color: 'a' }]);
});

test('layout and neighbors', () => {
  const F = Fd.create(Rng.make(1), { deck: DECKS[0], slots: ['plain', 'sieve', 'bomb'] });
  assert.deepStrictEqual(Fd.layout(F), { rows: [[0, 1, 2, 3, 4], [5, 6, 7]] });
  assert.deepStrictEqual(Fd.neighbors(F, 0), [1]);
  assert.deepStrictEqual(Fd.neighbors(F, 2), [1, 3]);
  assert.deepStrictEqual(Fd.neighbors(F, 4), [3]);
  assert.deepStrictEqual(Fd.neighbors(F, 5), [6]);
  assert.deepStrictEqual(Fd.neighbors(F, 6), [5, 7]);
  Fd.addFlask(F);
  assert.deepStrictEqual(Fd.layout(F).rows[1], [5, 6, 7, 8]);
  assert.deepStrictEqual(Fd.neighbors(F, 7), [6, 8]);
  assert.deepStrictEqual(Fd.layout(Fd.create(Rng.make(1), { deck: DECKS[0], slots: [] })).rows[1], []);
});

test('determinism by seed, plain JSON state', () => {
  const run = seed => {
    const rng = Rng.make(seed);
    const F = Fd.create(rng, { deck: DECKS[1], slots: SLOTS[1], junkPct: 0.2 });
    Fd.drain(F, rng, 0); Fd.addStones(F, rng, 2); Fd.stealTop(F, rng); Fd.swapColors(F, rng); Fd.sporeQueue(F, rng, 2);
    Fd.refill(F, rng, 5);
    return JSON.stringify([F, rng]);
  };
  for (let s = 1; s <= 50; s++) assert.strictEqual(run(s), run(s));
  assert.notStrictEqual(run(1), run(2));
  const F = Fd.create(Rng.make(1), { deck: DECKS[0], slots: SLOTS[0] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(F)), F);
});

test('a sieve swallows thrown stones', () => {
  const F = mk([{ kind: 'sieve', layers: [] }]);
  const out = Fd.addStones(F, Rng.make(1), 3);
  assert.deepStrictEqual(out, [0, 0, 0]);
  assert.deepStrictEqual(F.tubes[0].layers, []);
});

console.log(passed + ' tests passed');
