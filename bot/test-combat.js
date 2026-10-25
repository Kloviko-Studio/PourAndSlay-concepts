const assert = require('assert');
const PS = require('./load.js')();
const { Combat: Cb, DATA: D } = PS;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

const MIX = [['fire', 'water', 'life', 'fire'], ['water', 'life', 'fire', 'water'], ['life', 'fire', 'water', 'life']];
function mkF(tubes, queue, filled) {
  return {
    tubes: tubes.map(t => Object.assign({ kind: 'plain', cap: 4, layers: [], frozen: 0 }, Array.isArray(t) ? { layers: t.slice() } : t)),
    queue: (queue || MIX).map(p => p.slice()), bag: [], cap: 4, filled: filled == null ? tubes.length : filled,
    minLayers: 0, deck: { fire: 4, water: 4, life: 4 }, junkPct: 0,
  };
}
const CLOSE_SETUP = [['fire', 'fire', 'fire'], ['water', 'fire'], ['water', 'life'], ['life', 'life'], []];
function mkB(o) {
  o = o || {};
  const rc = Object.assign({ seed: 7, hp: 50, maxHp: 50, deck: { fire: 0, water: 0, life: 0 }, slots: ['plain', 'plain', 'plain'] }, o.rc);
  const es = Object.assign({ id: 'slime', hp: 200, cycle: [{ t: 'atk', v: 5, turns: 50 }] }, o.es);
  const { B, events } = Cb.create(rc, es);
  B.field = mkF(o.tubes || CLOSE_SETUP, o.queue, o.filled);
  B.stuck = false;
  B.startEvents = events;
  return B;
}
const ofType = (ev, t) => ev.filter(e => e.type === t);
const pour = (B, from, to) => Cb.act(B, { type: 'pour', from, to });

test('fire close: base damage, turn spent, event tubes are copies', () => {
  const B = mkB();
  const ev = pour(B, 1, 0);
  const close = ofType(ev, 'close')[0];
  assert.strictEqual(close.color, 'fire');
  assert.strictEqual(close.k, 1);
  assert.deepStrictEqual(close.tubes[0].layers, ['fire', 'fire', 'fire', 'fire']);
  assert.strictEqual(B.enemy.hp, 194);
  assert.strictEqual(B.turn, 1);
  assert.notStrictEqual(ofType(ev, 'pour')[0].tubes, B.field.tubes);
  assert.strictEqual(B.field.tubes[0].layers.length, 4); // refilled from the queue
  assert.strictEqual(B.combo, 1);
});

test('effect order: flat -> tube -> k -> vuln/mastery -> round half up', () => {
  const B = mkB({ rc: { deck: { fire: 1, water: 0, life: 0, poison: 1 }, labFlat: { fire: 1 }, mods: { caustic: 1 }, relics: ['hot_crucible'], masteryPct: 0.1 } });
  // (6 + 3 + 1 + 2 + 4) = 16, amp x2 = 32, k 1.5 = 48, x1.1 = 52.8 -> 53
  assert.strictEqual(Cb.effectValue(B, 'fire', 1.5, 'amp'), 53);
  B.enemy.frozen = 2; // x1.5 vuln on top: 48 * 1.1 * 1.5 = 79.2 -> 79
  assert.strictEqual(Cb.effectValue(B, 'fire', 1.5, 'amp'), 79);
  B.enemy.frozen = 0; B.masteryPct = 0;
  // poison (2+1) * 1.5 = 4.5 rounds up to 5
  assert.strictEqual(Cb.effectValue(B, 'poison', 1.5, 'plain'), 5);
  // big tube: 16 * 1.5 * 1 = 24
  assert.strictEqual(Cb.effectValue(B, 'fire', 1, 'big'), 24);
  assert.strictEqual(Cb.effectValue(B, 'slime', 3), 3);
  assert.strictEqual(Cb.effectValue(B, 'water', 3), 18);
  assert.strictEqual(Cb.effectValue(B, 'mirror', 1), 4);
});

test('combo k table and combo_master', () => {
  const B = mkB();
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(s => Cb.kOf(B, s)), [1, 1.5, 2, 3, 3]);
  B.mods.combo_master = 1;
  assert.deepStrictEqual([0, 1, 2, 3].map(s => Cb.kOf(B, s)), [1, 1.75, 2.25, 3.25]);
});

test('cascade: refill closes again for free with higher k; one turn total', () => {
  const B = mkB({ queue: [['life', 'life', 'life', 'life'], ...MIX] });
  const ev = pour(B, 1, 0);
  const closes = ofType(ev, 'close');
  assert.strictEqual(closes.length, 2);
  assert.strictEqual(closes[1].cascade, true);
  assert.strictEqual(closes[1].color, 'life');
  assert.strictEqual(closes[1].k, 1.5);
  assert.strictEqual(B.turn, 1);
  assert.strictEqual(B.combo, 2);
  assert.ok(ofType(ev, 'combo').some(e => e.k === 1.5));
});

test('cascade_chute raises combo by 2 on cascade', () => {
  const B = mkB({ queue: [['life', 'life', 'life', 'life'], ...MIX], rc: { relics: ['cascade_chute'] } });
  pour(B, 1, 0);
  assert.strictEqual(B.combo, 3);
});

test('combo resets on a move without close; patient mage gives 2 moves grace', () => {
  const tubes = [['fire', 'fire', 'fire'], ['water', 'fire'], ['water', 'life'], ['life', 'life'], [], []];
  let B = mkB({ tubes });
  pour(B, 1, 0);
  assert.strictEqual(B.combo, 1);
  pour(B, 3, 4);
  assert.strictEqual(B.combo, 0);
  B = mkB({ tubes, rc: { relics: ['patient_mage'] } });
  pour(B, 1, 0);
  pour(B, 3, 4);
  assert.strictEqual(B.combo, 1);
  pour(B, 4, 5);
  assert.strictEqual(B.combo, 0);
});

test('catalyst close and sieve swallow do not spend a turn', () => {
  let B = mkB({ tubes: [['fire', 'water'], ['life', 'fire', 'fire', 'fire'], { kind: 'catalyst', layers: ['fire'] }, []], filled: 2 });
  const ev = pour(B, 1, 2);
  assert.ok(ofType(ev, 'close').length === 1);
  assert.strictEqual(B.turn, 0);
  assert.deepStrictEqual(ofType(ev, 'turn')[0], { type: 'turn', free: true, reason: 'catalyst', n: 0 });
  B = mkB({ tubes: [['fire', 'stone', 'stone'], ['water', 'life'], { kind: 'sieve', layers: [] }, []], filled: 2 });
  const ev2 = pour(B, 0, 2);
  assert.strictEqual(ofType(ev2, 'swallow').length, 1);
  assert.deepStrictEqual(B.field.tubes[2].layers, []);
  assert.strictEqual(B.turn, 0);
});

test('philosopher stone: pour after an enemy action is free', () => {
  const B = mkB({ tubes: [['fire', 'water'], ['water', 'life'], [], [], []], rc: { relics: ['philosopher_stone'] }, es: { cycle: [{ t: 'shield', v: 1, turns: 1 }] } });
  B.enemy.timer = 1;
  pour(B, 0, 2); // turn 1, enemy acts
  assert.strictEqual(B.turn, 1);
  assert.strictEqual(B.freePours, 1);
  const ev = pour(B, 2, 3);
  assert.strictEqual(B.turn, 1);
  assert.strictEqual(ofType(ev, 'turn')[0].reason, 'philosopher_stone');
});

test('undo restores the full battle state but not spent potions', () => {
  const B = mkB({ rc: { potions: ['undo', 'heal'] }, es: { cycle: [{ t: 'atk', v: 5, turns: 1 }] } });
  B.enemy.timer = 1;
  B.enemy.poison.push({ tick: 2, turns: 3 });
  const before = JSON.parse(JSON.stringify(B));
  pour(B, 1, 0);
  assert.notStrictEqual(B.enemy.hp, before.enemy.hp);
  assert.ok(B.player.hp < 50);
  const ev = Cb.act(B, { type: 'potion', idx: 0 });
  assert.strictEqual(ofType(ev, 'potion')[0].id, 'undo');
  const after = JSON.parse(JSON.stringify(B));
  for (const k of ['field', 'enemy', 'player', 'rng', 'turn', 'combo', 'lastColor', 'freePours', 'burn']) assert.deepStrictEqual(after[k], before[k], k);
  assert.deepStrictEqual(B.potions, ['heal']);
  assert.strictEqual(B.stats.potionsUsed, 1);
  assert.strictEqual(B.history, null);
  assert.strictEqual(Cb.canAct(B, { type: 'potion', idx: 0 }), true);
  B.potions.unshift('undo');
  assert.strictEqual(Cb.canAct(B, { type: 'potion', idx: 0 }), false); // nothing left to undo
});

test('poison ticks through enemy shield; ivy lasts 8', () => {
  const B = mkB({ tubes: [['poison', 'poison', 'poison'], ['water', 'poison'], ['water', 'life'], [], []], rc: { deck: { poison: 0, water: 0, life: 0 } } });
  B.enemy.shield = 10;
  pour(B, 1, 0);
  assert.deepStrictEqual(B.enemy.poison, [{ tick: 2, turns: 3 }]);
  assert.strictEqual(B.enemy.hp, 198); // first tick on the same turn
  assert.strictEqual(B.enemy.shield, 10);
  const B2 = mkB({ tubes: [['poison', 'poison', 'poison'], ['water', 'poison'], [], []], rc: { relics: ['poison_ivy'], deck: { poison: 0, water: 0, life: 0 } } });
  pour(B2, 1, 0);
  assert.strictEqual(B2.enemy.poison[0].turns, 7);
});

test('ice freezes the enemy, stops its timer and adds vulnerability', () => {
  const B = mkB({ tubes: [['ice', 'ice', 'ice'], ['water', 'ice'], ['fire', 'fire', 'fire'], ['life', 'fire'], [], []], rc: { deck: { ice: 0, fire: 0, life: 0 } } });
  const t0 = B.enemy.timer;
  pour(B, 1, 0);
  assert.strictEqual(B.enemy.frozen, 1); // 2 turns, one consumed by this move
  assert.strictEqual(B.enemy.timer, t0);
  pour(B, 3, 2); // k 1.5 on a frozen enemy: 6 * 1.5 * 1.5 = 13.5 -> 14
  assert.strictEqual(B.enemy.hp, 200 - 14);
  assert.strictEqual(B.enemy.timer, t0);
  const C = mkB({ rc: { relics: ['frost_crown'] } });
  C.enemy.frozen = 3;
  assert.strictEqual(Cb.effectValue(C, 'fire', 1), 12);
});

test('lightning delays the enemy; storm rod 2/3', () => {
  const B = mkB({ tubes: [['lightning', 'lightning', 'lightning'], ['water', 'lightning'], [], []], rc: { deck: { lightning: 0, water: 0, life: 0 } } });
  const t0 = B.enemy.timer;
  pour(B, 1, 0);
  assert.strictEqual(B.enemy.timer, t0 + 1 - 1);
  assert.strictEqual(B.enemy.hp, 196);
  const C = mkB({ tubes: [['lightning', 'lightning', 'lightning'], ['water', 'lightning'], [], []], rc: { relics: ['storm_rod'], deck: { lightning: 0, water: 0, life: 0 } } });
  pour(C, 1, 0);
  assert.strictEqual(C.enemy.timer, t0 + 2 - 1);
});

test('dark hurts self through shield; blood retort heals instead', () => {
  const B = mkB({ tubes: [['dark', 'dark', 'dark'], ['water', 'dark'], [], []], rc: { hp: 40, deck: { dark: 0, water: 0, life: 0 } } });
  B.player.shield = 10;
  pour(B, 1, 0);
  assert.strictEqual(B.enemy.hp, 188);
  assert.strictEqual(B.player.hp, 37);
  assert.strictEqual(B.player.shield, 10);
  const C = mkB({ tubes: [['dark', 'dark', 'dark'], ['water', 'dark'], [], []], rc: { hp: 40, relics: ['blood_retort'], deck: { dark: 0, water: 0, life: 0 } } });
  pour(C, 1, 0);
  assert.strictEqual(C.player.hp, 42);
});

test('mirror repeats last colour at current k; fallback shield; void lens twice', () => {
  const tubes = [['fire', 'fire', 'fire'], ['water', 'fire'], ['mirror', 'mirror', 'mirror'], ['life', 'mirror'], [], []];
  const B = mkB({ tubes, rc: { deck: { fire: 0, mirror: 0, life: 0 } } });
  pour(B, 1, 0); // 6
  pour(B, 3, 2); // mirror fire at k1.5 = 9
  assert.strictEqual(B.enemy.hp, 200 - 6 - 9);
  assert.strictEqual(B.lastColor, 'fire');
  const C = mkB({ tubes: [['mirror', 'mirror', 'mirror'], ['water', 'mirror'], [], []], rc: { deck: { fire: 0, mirror: 0, life: 0 } } });
  pour(C, 1, 0);
  assert.strictEqual(C.player.shield, 4);
  const V = mkB({ tubes, rc: { relics: ['void_lens'], deck: { fire: 0, mirror: 0, life: 0 } } });
  pour(V, 1, 0);
  pour(V, 3, 2);
  assert.strictEqual(V.enemy.hp, 200 - 6 - 18);
});

test('slime close 3 shield (sponge 10); stone close counts for combo; stone heart', () => {
  const B = mkB({ tubes: [['slime', 'slime', 'slime'], ['water', 'slime'], [], []] });
  pour(B, 1, 0);
  assert.strictEqual(B.player.shield, 3);
  const S = mkB({ tubes: [['slime', 'slime', 'slime'], ['water', 'slime'], [], []], rc: { relics: ['sponge'] } });
  pour(S, 1, 0);
  assert.strictEqual(S.player.shield, 10);
  const T = mkB({ tubes: [['fire', 'stone'], ['stone', 'stone', 'stone'], ['water', 'stone'], []], rc: { relics: ['stone_heart'] } });
  const ev = pour(T, 2, 1);
  assert.strictEqual(T.combo, 1);
  assert.strictEqual(T.stats.junkCloses, 1);
  // 4 collected + 1 broken in the neighbour = 5 stones * 4
  assert.strictEqual(T.enemy.hp, 200 - 20);
  assert.deepStrictEqual(T.field.tubes[0].layers, ['fire']);
  assert.strictEqual(ofType(ev, 'stones').length, 1);
});

test('bomb close knocks top layers off neighbours', () => {
  const B = mkB({ tubes: [['water', 'life'], { kind: 'bomb', layers: ['fire', 'fire', 'fire'] }, ['life', 'fire'], []], filled: 4 });
  const ev = pour(B, 2, 1);
  const bomb = ofType(ev, 'bomb')[0];
  assert.deepStrictEqual(bomb.targets.map(t => t.tube), [0, 2]);
  assert.deepStrictEqual(B.field.tubes[0].layers, ['water']);
  assert.deepStrictEqual(B.field.tubes[2].layers, []);
});

test('great cauldron at k3 fires twice; alchemist heart heals on k2+; combo elixir', () => {
  const B = mkB({ rc: { relics: ['great_cauldron', 'alchemist_heart'], hp: 30 } });
  B.combo = 3;
  pour(B, 1, 0);
  assert.strictEqual(B.enemy.hp, 200 - 36);
  assert.strictEqual(B.player.hp, 33);
  const E = mkB({ rc: { potions: ['combo'] } });
  Cb.act(E, { type: 'potion', idx: 0 });
  assert.strictEqual(E.turn, 0);
  const ev = pour(E, 1, 0);
  assert.strictEqual(ofType(ev, 'close')[0].k, 2);
  assert.strictEqual(E.combo, 3);
});

test('enemy attack: shield absorbs then burns; crystal ward, mirror shield, thorns, apron, leech', () => {
  const tubes = [['fire', 'water'], ['water', 'life'], [], [], []];
  const B = mkB({ tubes, es: { cycle: [{ t: 'atk', v: 10, turns: 1 }] } });
  B.enemy.timer = 1; B.player.shield = 4;
  const ev = pour(B, 0, 2);
  assert.deepStrictEqual(ofType(ev, 'player_hit')[0], { type: 'player_hit', dmg: 6, absorbed: 4, source: 'atk' });
  assert.strictEqual(B.player.shield, 0);
  assert.strictEqual(B.player.hp, 44);

  const W = mkB({ tubes, rc: { relics: ['crystal_ward', 'mirror_shield'], mods: { thorns: 1, apron: 2, leech: 1 } }, es: { cycle: [{ t: 'atk', v: 10, turns: 1 }] } });
  W.enemy.timer = 1; W.player.shield = 20; W.player.hp = 40;
  pour(W, 0, 2);
  // apron -20%: 8 absorbed, 12 shield left; thorns 3 + mirror 12 = 15 damage, leech ceil(0.3)+ceil(1.2) = 1 + 2
  assert.strictEqual(W.enemy.hp, 185);
  assert.strictEqual(W.player.hp, 43);
  assert.strictEqual(W.player.shield, 6);
});

test('enemy field actions: stones auto-close full uniform tube; trap', () => {
  const B = mkB({ tubes: [['stone', 'stone', 'stone'], ['water', 'life'], ['fire', 'water', 'life', 'fire'], []], rc: { relics: ['trap'] }, es: { cycle: [{ t: 'stone', v: 1, turns: 1 }] } });
  B.field.tubes[3].frozen = 5; B.field.tubes[1].frozen = 5;
  B.enemy.timer = 1;
  // only tube 0 can take a stone (1 is frozen, 2 is full, 3 frozen)... but the pour must be legal first
  B.field.tubes.push({ kind: 'plain', cap: 4, layers: [], frozen: 0 });
  B.field.tubes.push({ kind: 'plain', cap: 4, layers: ['life'], frozen: 0 });
  const ev = pour(B, 5, 4); // tube 4 now has a layer, still free space; stone goes to 0 or 4
  const act = ofType(ev, 'enemy_act')[0];
  assert.strictEqual(act.t, 'stone');
  assert.ok(ofType(ev, 'enemy_hit').some(e => e.source === 'trap'));
  if (act.target[0] === 0) assert.ok(ofType(ev, 'close').some(c => c.auto && c.color === 'stone'));
  assert.ok(PS.Field.closableAfterEnemy(B.field).length === 0);
});

test('drain costs 3 HP and a turn; dead end makes the next drain free', () => {
  const B = mkB({ tubes: [['fire', 'water'], ['water', 'life'], [], []] });
  Cb.act(B, { type: 'drain', tube: 0 });
  assert.strictEqual(B.player.hp, 47);
  assert.strictEqual(B.turn, 1);
  const S = mkB({ tubes: [['fire', 'water', 'fire', 'water'], ['water', 'fire', 'water', 'fire']] });
  B.combo = 2;
  const ev = Cb.act(S, { type: 'potion', idx: 0 }); // no potion -> no-op
  assert.deepStrictEqual(ev, []);
  S.potions = ['heal'];
  const ev2 = Cb.act(S, { type: 'potion', idx: 0 });
  assert.ok(ofType(ev2, 'dead_end').length === 1);
  assert.strictEqual(S.stuck, true);
  const ev3 = Cb.act(S, { type: 'drain', tube: 0 });
  assert.strictEqual(ofType(ev3, 'drain')[0].free, true);
  assert.strictEqual(S.player.hp, 50);
  assert.strictEqual(S.turn, 0);
  assert.strictEqual(S.combo, 0);
});

test('potions: heal 25%, flask, solvent, shake, sleep, firebomb; none spend a turn', () => {
  const B = mkB({ rc: { hp: 20, potions: ['heal', 'flask', 'solvent', 'shake', 'sleep', 'firebomb'], deck: { fire: 1, water: 0, life: 0 }, labFlat: { fire: 1 } } });
  const n = B.field.tubes.length, t0 = B.enemy.timer;
  Cb.act(B, { type: 'potion', idx: 0 });
  assert.strictEqual(B.player.hp, 33); // 12.5 -> 13
  Cb.act(B, { type: 'potion', idx: 0 });
  assert.strictEqual(B.field.tubes.length, n + 1);
  Cb.act(B, { type: 'potion', idx: 0, tube: 1 });
  assert.deepStrictEqual(B.field.tubes[1].layers, ['water']);
  assert.strictEqual(Cb.canAct(B, { type: 'potion', idx: 0, tube: 1 }), false); // shake needs 2 layers
  Cb.act(B, { type: 'potion', idx: 0, tube: 0 });
  assert.strictEqual(B.field.tubes[0].layers.length, 3);
  Cb.act(B, { type: 'potion', idx: 0 });
  assert.strictEqual(B.enemy.timer, t0 + 3);
  Cb.act(B, { type: 'potion', idx: 0 });
  assert.strictEqual(B.enemy.hp, 200 - 3 * 10);
  assert.strictEqual(B.turn, 0);
  assert.strictEqual(B.stats.potionsUsed, 6);
});

test('hourglass delays first intent by 2; non-final boss retreats at 0 HP; rage only in final encounter', () => {
  const H = mkB({ rc: { relics: ['hourglass'] }, es: { cycle: [{ t: 'atk', v: 5, turns: 3 }] } });
  assert.strictEqual(H.enemy.timer, 5);
  const nf = mkB({ es: { boss: true, final: false, hp: 100, maxHp: 100, cycle: [{ t: 'atk', v: 5, turns: 3 }] } });
  nf.enemy.hp = 60; nf.potions = ['firebomb'];
  let ev = Cb.act(nf, { type: 'potion', idx: 0 });
  assert.strictEqual(nf.status, 'active', 'no early retreat threshold');
  assert.ok(!ofType(ev, 'rage').length, 'no rage outside the final encounter');
  nf.enemy.hp = 3; nf.potions = ['firebomb'];
  ev = Cb.act(nf, { type: 'potion', idx: 0 });
  assert.strictEqual(nf.status, 'fled');
  assert.strictEqual(nf.enemy.hp, 0);
  assert.ok(ofType(ev, 'boss_fled').length === 1 && !ofType(ev, 'enemy_dead').length);
  const fk = mkB({ es: { boss: true, final: true, hp: 3, maxHp: 100, cycle: [{ t: 'atk', v: 5, turns: 3 }] } });
  fk.potions = ['firebomb'];
  Cb.act(fk, { type: 'potion', idx: 0 });
  assert.strictEqual(fk.status, 'won', 'final encounter never retreats');
  const f = mkB({ es: { boss: true, final: true, hp: 40, maxHp: 100, cycle: [{ t: 'atk', v: 5, turns: 3 }, { t: 'shield', v: 5, turns: 3 }] } });
  f.potions = ['firebomb'];
  const ev2 = Cb.act(f, { type: 'potion', idx: 0 });
  assert.ok(ofType(ev2, 'rage').length === 1);
  assert.strictEqual(f.enemy.rage, true);
  f.enemy.timer = 1;
  f.field = mkF([['fire', 'water'], ['water', 'life'], [], []]);
  const ev3 = pour(f, 0, 2);
  assert.strictEqual(ofType(ev3, 'intent')[0].timer, 2);
});

test('world twists: frozen start, stonefall every 8 turns, burn through shield', () => {
  const { B, events } = Cb.create({ seed: 3, hp: 50, maxHp: 50, deck: { fire: 0, water: 0, life: 0 }, slots: ['plain', 'plain', 'plain'], twist: { type: 'frozenStart', turns: 3 } }, { id: 'x', hp: 50, cycle: [{ t: 'atk', v: 1, turns: 9 }] });
  assert.ok(ofType(events, 'twist').length === 1);
  assert.strictEqual(B.field.tubes.filter(t => t.frozen === 3).length, 1);

  const S = mkB({ rc: { hp: 999, maxHp: 999, twist: { type: 'stonefall', every: 8 } }, tubes: [['fire', 'water'], ['water', 'life'], [], []] });
  S.field.minLayers = 100;
  let stones = 0;
  for (let i = 0; S.turn < 8 && i < 40; i++) stones += ofType(Cb.act(S, { type: 'drain', tube: S.field.tubes.findIndex(t => t.layers.length) }), 'twist').length;
  assert.strictEqual(stones, 1);

  const W = mkB({ rc: { twist: { type: 'burn', dmg: 2, turns: 2 } }, tubes: [['fire', 'water'], ['water', 'life'], [], [], []], es: { cycle: [{ t: 'atk', v: 1, turns: 1 }] } });
  W.enemy.timer = 1; W.player.shield = 1;
  pour(W, 0, 2);
  assert.deepStrictEqual(W.burn, [{ dmg: 2, turns: 2 }]);
  W.player.shield = 5;
  pour(W, 2, 3);
  // burn tick 2 pierces the shield, then the 1-damage attack is absorbed and the shield burns
  assert.strictEqual(W.player.hp, 48);
  assert.strictEqual(W.player.shield, 0);
  assert.strictEqual(W.burn.length, 2);
});

test('player death sets lost; json round-trip continues identically', () => {
  const B = mkB({ rc: { hp: 2 } });
  Cb.act(B, { type: 'drain', tube: 0 });
  assert.strictEqual(B.status, 'lost');
  assert.strictEqual(B.player.hp, 0);
  assert.strictEqual(Cb.canAct(B, { type: 'pour', from: 1, to: 0 }), false);
  const { B: X } = Cb.create({ seed: 99, hp: 50, maxHp: 50, deck: { fire: 0, water: 0, life: 0, poison: 0 }, slots: ['plain', 'plain', 'plain'] }, { id: 'golem', hp: 60, cycle: [{ t: 'stone', v: 2, turns: 2 }, { t: 'atk', v: 6, turns: 2 }] });
  const Y = JSON.parse(JSON.stringify(X));
  const rng = PS.Rng.make(5);
  for (let i = 0; i < 60 && X.status === 'active'; i++) {
    const T = X.field.tubes.length, acts = [];
    for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) if (Cb.canAct(X, { type: 'pour', from: a, to: b })) acts.push({ type: 'pour', from: a, to: b });
    if (!acts.length) acts.push({ type: 'drain', tube: X.field.tubes.findIndex(t => t.layers.length) });
    const a = PS.Rng.pick(rng, acts);
    assert.deepStrictEqual(Cb.act(Y, a), Cb.act(X, a));
  }
  assert.deepStrictEqual(Y, X);
});

test('enemy heals at most enemyHeals times per battle', () => {
  const B = mkB({ es: { hp: 200, cycle: [{ t: 'heal', v: 5, turns: 1 }, { t: 'atk', v: 1, turns: 1 }] } });
  B.enemy.hp = 100;
  B.field.minLayers = 99; // drains refill, so the field never runs dry
  let heals = 0;
  for (let i = 0; i < 30 && B.status === 'active'; i++) {
    const ev = Cb.act(B, { type: 'drain', tube: B.field.tubes.findIndex(t => t.layers.length) });
    heals += ofType(ev, 'enemy_heal').length;
    B.player.hp = 50;
  }
  assert.strictEqual(heals, D.economy.enemyHeals);
});

console.log(passed + ' combat tests passed');
