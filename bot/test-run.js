const assert = require('assert');
const PS = require('./load.js')();
const { Run, Combat: Cb, DATA: D, Rng } = PS;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };
const ctxOf = (o) => Object.assign({ maxIsland: 10, lab: {}, sealActive: false, seed: 1234 }, o);
const ofType = (ev, t) => ev.filter(e => e.type === t);

// Ends the current battle through the public API: enemy left at `hp`, then a firebomb lands.
function finishBattle(R, hp) {
  const B = R.battle;
  B.enemy.shield = 0;
  B.enemy.hp = hp == null ? 1 : hp;
  B.potions.push('firebomb');
  return Run.act(R, { type: 'potion', idx: B.potions.length - 1 });
}
function advance(R) {
  let ev = [];
  if (R.phase === 'battle') ev = finishBattle(R);
  if (R.phase === 'reward') ev = ev.concat(Run.skip(R));
  return ev;
}

test('stages follow island data', () => {
  for (const isl of D.islands) {
    const st = Run.stagesOf(isl.n, Rng.make(5));
    assert.strictEqual(st.length, isl.stages);
    assert.deepStrictEqual(st.map((s, i) => s.type === 'boss' ? i + 1 : 0).filter(Boolean), isl.bossAt);
    st.filter(s => s.type === 'regular').forEach(s => assert.ok(isl.regulars.indexOf(s.enemy) >= 0));
    assert.deepStrictEqual(st.filter(s => s.type === 'boss').map(s => s.encounter), isl.bossAt.map((_, i) => i));
  }
  assert.ok(Run.stagesOf(1).every((s, i) => s.enemy === (i < 3 ? 'slime' : 'slime_king')));
});

test('start: hp, deck, slots, belt, potions with lab and boosters', () => {
  let { R, events } = Run.create(ctxOf({ maxIsland: 1 }), 1, []);
  assert.strictEqual(R.maxHp, 50);
  assert.deepStrictEqual(R.deck, { fire: 0, water: 0, life: 0 });
  assert.deepStrictEqual(R.slots, ['plain', 'plain', 'plain']);
  assert.deepStrictEqual(R.potions, ['undo', 'heal']);
  assert.strictEqual(R.beltSize, 3);
  assert.strictEqual(R.phase, 'battle');
  assert.strictEqual(ofType(events, 'stage_start').length, 1);
  assert.strictEqual(R.battle.enemy.hp, 18);

  ({ R } = Run.create(ctxOf({ lab: { vitality: 2, slot: 1, belt: 2, essence_fire: 3, start_shield: 1, mastery: 2 } }), 3,
    ['booster_potion:sleep', 'booster_flask', 'booster_vitality', 'booster_first_strike']));
  assert.strictEqual(R.maxHp, 50 + 10 + 20);
  assert.strictEqual(R.slots.length, 3 + 1 + 1);
  assert.strictEqual(R.beltSize, 4);
  assert.strictEqual(R.potions.length, 4);
  assert.strictEqual(R.potions[2], 'sleep');
  assert.deepStrictEqual(R.deck, { fire: 0, water: 0, life: 0 }); // lab bonuses stay out of the deck
  const B = R.battle;
  assert.deepStrictEqual(B.labFlat, { fire: 3 });
  assert.strictEqual(B.player.shield, 3);
  assert.strictEqual(B.firstStrike, 2);
  assert.ok(Math.abs(B.masteryPct - 0.1) < 1e-9);
  assert.strictEqual(B.enemy.hp, Math.round(D.enemies[R.stages[0].enemy].hp * D.islands[2].M));
  // fire (6+3) * 1.1 * 2 = 19.8 -> 20
  assert.strictEqual(Cb.effectValue(B, 'fire', 1), 20);
  assert.deepStrictEqual(Run.create(ctxOf(), 1, ['booster_potion'], { potion: 'sleep' }).R.potions, ['undo', 'heal', 'sleep']);
});

test('enemy scaling: hp x M, atk + A only', () => {
  const { R } = Run.create(ctxOf(), 5, []);
  const st = R.stages[0], d = D.enemies[st.enemy], B = R.battle;
  assert.strictEqual(B.enemy.hp, Math.round(d.hp * D.islands[4].M));
  d.cycle.forEach((c, i) => assert.strictEqual(B.enemy.cycle[i].v, c.t === 'atk' ? c.v + D.islands[4].A : c.v));
});

test('regular win: coins, heal 10%, offer; skip pays 5+i', () => {
  const { R } = Run.create(ctxOf(), 2, []);
  while (R.stages[R.stage].enemy === 'gremlin') advance(R);
  R.battle.player.hp = 20;
  const ev = finishBattle(R);
  assert.strictEqual(R.phase, 'reward');
  assert.deepStrictEqual(ofType(ev, 'coins')[0], { type: 'coins', v: 8, reason: 'kill' });
  assert.strictEqual(ofType(ev, 'heal_after')[0].v, 5);
  assert.strictEqual(R.hp, 25);
  assert.strictEqual(R.offer.kind, 'pick');
  assert.ok(ofType(ev, 'kill').length === 1);
  const c0 = R.coins;
  const sk = Run.skip(R);
  assert.strictEqual(R.coins - c0, 7);
  assert.ok(ofType(sk, 'stage_start').length === 1);
});

test('coin multipliers: hard tier, thrift, seal, golden stopper', () => {
  const { R } = Run.create(ctxOf({ lab: { thrift: 2 }, sealActive: true }), 4, []);
  R.relics.push('golden_stopper');
  const ev = finishBattle(R);
  // (4+2*4) * 1.25 * 1.2 * 1.5 * 1.25 = 33.75 -> 34
  assert.strictEqual(ofType(ev, 'coins')[0].v, 34);
  const plain = Run.create(ctxOf(), 3, []).R;
  assert.strictEqual(ofType(finishBattle(plain), 'coins')[0].v, 10);
});

test('recurring boss: full HP, then returns patched with half HP; extra action; rage only in final', () => {
  const { R } = Run.create(ctxOf(), 4, []);
  const max = Math.round(48 * D.islands[3].M);
  assert.strictEqual(R.boss.maxHp, max);
  const seen = [];
  let guard = 0;
  while (R.phase !== 'won' && guard++ < 50) {
    if (R.phase === 'battle' && R.battle.enemy.boss) {
      const e = R.battle.enemy;
      seen.push({ hp: e.hp, final: e.final, patched: e.patched, cycle: e.cycle.length });
      assert.strictEqual(e.maxHp, max);
      if (!e.final) {
        const ev = finishBattle(R);
        assert.ok(ofType(ev, 'boss_fled').length === 1);
        assert.ok(!ofType(ev, 'rage').length);
        assert.strictEqual(ofType(ev, 'coins')[0].v, Math.round((8 + 12) * 1.25));
        assert.strictEqual(R.offer.kind, 'relic');
        assert.ok(ofType(ev, 'heal_after').length === 1);
        Run.skip(R);
        continue;
      }
      e.hp = Math.floor(max * 0.33) + 5; e.shield = 0;
      R.battle.potions.push('firebomb');
      const ev = Run.act(R, { type: 'potion', idx: R.battle.potions.length - 1 });
      assert.ok(ofType(ev, 'rage').length === 1);
      finishBattle(R);
      assert.strictEqual(R.phase, 'won');
      continue;
    }
    advance(R);
  }
  const half = Math.round(max / 2);
  assert.deepStrictEqual(seen.map(s => s.hp), [max, half, half]);
  assert.deepStrictEqual(seen.map(s => s.patched), [false, true, true]);
  assert.deepStrictEqual(seen.map(s => s.final), [false, false, true]);
  assert.ok(seen.every(s => s.cycle === D.bosses.ancient_golem.cycle.length + 1)); // island 4 = 2nd island of the boss
  assert.strictEqual(Run.create(ctxOf(), 3, []).R.stages.filter(s => s.type === 'boss').length, 2);
  const r3 = Run.create(ctxOf(), 3, []).R;
  while (!(r3.phase === 'battle' && r3.battle.enemy.boss)) advance(r3);
  assert.strictEqual(r3.battle.enemy.cycle.length, D.bosses.ancient_golem.cycle.length);
});

test('island 1: single final boss encounter, killing it wins the island', () => {
  const { R } = Run.create(ctxOf({ maxIsland: 1 }), 1, []);
  let ev = [];
  while (R.phase !== 'won') ev = advance(R);
  assert.ok(ofType(ev, 'island_won').length === 1);
  assert.strictEqual(R.stats.kills, 4);
  assert.strictEqual(R.stats.bossReached, 1);
  assert.strictEqual(R.coins, 6 * 3 + 20 + 3 * 6);
});

function kill(R) {
  const B = R.battle;
  B.player.hp = 1; B.player.shield = 0;
  return Run.act(R, { type: 'drain', tube: B.field.tubes.findIndex(t => t.layers.length) });
}

test('revive: one per attempt from any source; give up loses', () => {
  let { R } = Run.create(ctxOf(), 3, []);
  let ev = kill(R);
  assert.strictEqual(R.phase, 'revive');
  assert.ok(ofType(ev, 'revive_prompt').length === 1);
  assert.deepStrictEqual(Run.reviveOptions(R), { free: true, gemsPrice: 20 });
  const enemyHp = R.battle.enemy.hp;
  ev = Run.revive(R, 'free');
  assert.strictEqual(R.phase, 'battle');
  assert.strictEqual(R.battle.player.hp, 25);
  assert.strictEqual(R.battle.enemy.hp, enemyHp);
  kill(R);
  assert.deepStrictEqual(Run.reviveOptions(R), { free: false, gemsPrice: null });
  assert.deepStrictEqual(Run.revive(R, 'gems'), []);
  ev = Run.giveUp(R);
  assert.strictEqual(R.phase, 'lost');
  assert.ok(ofType(ev, 'island_lost').length === 1);

  ({ R } = Run.create(ctxOf(), 3, []));
  kill(R);
  Run.revive(R, 'gems');
  assert.strictEqual(R.gemsSpent, 20);
  kill(R);
  assert.deepStrictEqual(Run.reviveOptions(R), { free: false, gemsPrice: null }, 'a gem revive also uses the one revive');
});

test('phoenix feather uses the one revive', () => {
  const { R } = Run.create(ctxOf(), 3, []);
  R.relics.push('phoenix_feather');
  R.battle.relics.push('phoenix_feather');
  const ev = kill(R);
  assert.strictEqual(R.phase, 'battle');
  assert.strictEqual(R.battle.player.hp, 15);
  assert.ok(ofType(ev, 'revived').some(e => e.source === 'phoenix'));
  kill(R);
  assert.strictEqual(R.phase, 'revive');
  assert.deepStrictEqual(Run.reviveOptions(R), { free: false, gemsPrice: null });
});

test('a move that killed the player still passes its turn after the revive', () => {
  const { R } = Run.create(ctxOf(), 3, []);
  const turn = R.battle.turn;
  kill(R);
  assert.strictEqual(R.battle.turn, turn);
  const ev = Run.revive(R, 'free');
  assert.strictEqual(R.battle.turn, turn + 1);
  assert.ok(ofType(ev, 'turn').some(e => !e.free));
});

function pickOffer(R) {
  R.phase = 'reward';
  R.offer = { kind: 'pick', options: [] };
  Run.reroll(R);
  return R.offer.options;
}

test('pick offer: >=1 mod and >=1 find, size 3 (4 with intuition), respects caps and unlocks', () => {
  const { R } = Run.create(ctxOf({ maxIsland: 5 }), 5, []);
  R.mods.tough = 3;
  R.slots = ['plain', 'plain', 'plain', 'plain', 'plain'];
  let relics = 0;
  for (let i = 0; i < 400; i++) {
    const o = pickOffer(R);
    assert.strictEqual(o.length, 3);
    if (!o.some(x => x.type === 'relic')) {
      assert.ok(o.some(x => x.type === 'mod'), JSON.stringify(o));
      assert.ok(o.some(x => x.type === 'find'), JSON.stringify(o));
    } else relics++;
    o.forEach(x => {
      assert.notStrictEqual(x.id, 'tough');
      assert.notStrictEqual(x.id, 'extra_slot');
      if (x.type === 'mod') assert.ok(D.mods[x.id].unlock <= 5);
      if (x.id === 'combo_master') assert.fail('combo_master is from island 7');
      if (x.id === 'new_color') assert.ok(D.colors[x.color].unlock <= 5 && !(x.color in R.deck));
      if (x.id === 'boost_color') assert.ok(x.color in R.deck);
      if (x.id === 'special_tube') assert.ok(['amp', 'sieve', 'catalyst'].indexOf(x.tube) >= 0);
    });
  }
  assert.ok(relics > 20 && relics < 110, 'relic share ~15%: ' + relics);
  const r3 = Run.create(ctxOf({ maxIsland: 3 }), 3, []).R;
  for (let i = 0; i < 200; i++) assert.ok(!pickOffer(r3).some(x => x.type === 'relic'));
  const r4 = Run.create(ctxOf({ lab: { intuition: 1 } }), 4, []).R;
  assert.strictEqual(pickOffer(r4).length, 4);
  // potion_pick is not offered with a full belt
  r4.potions = ['heal', 'heal', 'heal'];
  for (let i = 0; i < 100; i++) assert.ok(!pickOffer(r4).some(x => x.id === 'potion_pick'));
  // everything capped -> coins option
  const rc = Run.create(ctxOf({ maxIsland: 1 }), 1, []).R;
  Object.keys(D.mods).forEach(id => { rc.mods[id] = D.mods[id].cap; });
  rc.potions = ['heal', 'heal', 'heal'];
  Object.keys(rc.deck).forEach(c => { rc.deck[c] = 3; });
  rc.filter = true;
  assert.deepStrictEqual(pickOffer(rc), [{ type: 'coins', v: 15 }]);
});

test('relic filtering: rarity unlock, colour and enemy requirements, not owned', () => {
  const r1 = Run.create(ctxOf({ maxIsland: 1 }), 1, []).R;
  const p1 = Run.unlockedPool(r1, 'relics');
  p1.forEach(id => assert.strictEqual(D.relics[id].rarity, 'common'));
  ['blood_retort', 'storm_rod', 'stone_heart'].forEach(id => assert.ok(p1.indexOf(id) < 0, id));
  assert.ok(p1.indexOf('sponge') >= 0 && p1.indexOf('trap') >= 0); // slime king spores
  const r3 = Run.create(ctxOf({ maxIsland: 3 }), 3, []).R;
  const p3 = Run.unlockedPool(r3, 'relics');
  assert.ok(p3.indexOf('stone_heart') >= 0 && p3.indexOf('trap') >= 0 && p3.indexOf('sponge') < 0);
  const r8 = Run.create(ctxOf({ maxIsland: 8 }), 8, []).R;
  r8.deck.dark = 0;
  r8.relics.push('hourglass');
  const p8 = Run.unlockedPool(r8, 'relics');
  assert.ok(p8.indexOf('blood_retort') >= 0 && p8.indexOf('crystal_ward') >= 0 && p8.indexOf('phoenix_feather') >= 0);
  assert.ok(p8.indexOf('hourglass') < 0 && p8.indexOf('frost_crown') < 0 && p8.indexOf('void_lens') < 0);
  r8.phase = 'reward'; r8.offer = { kind: 'relic', options: [] };
  Run.reroll(r8);
  assert.strictEqual(r8.offer.options.length, 3);
  assert.strictEqual(new Set(r8.offer.options.map(o => o.id)).size, 3);
});

test('finds: new colour with full deck asks what to replace; special tube fills empty slot or replaces', () => {
  const { R } = Run.create(ctxOf(), 6, []);
  R.phase = 'reward';
  R.offer = { kind: 'pick', options: [{ type: 'find', id: 'new_color', color: 'ice' }] };
  Run.choose(R, 0);
  assert.ok('ice' in R.deck);
  Object.assign(R.deck, { poison: 0 });
  R.deck.fire = 2;
  R.phase = 'reward';
  R.offer = { kind: 'pick', options: [{ type: 'find', id: 'new_color', color: 'lightning' }] };
  let ev = Run.choose(R, 0);
  assert.strictEqual(R.offer.kind, 'replace_color');
  assert.ok(ofType(ev, 'offer').length === 1);
  Run.choose(R, R.offer.options.findIndex(o => o.id === 'fire'));
  assert.ok(!('fire' in R.deck) && R.deck.lightning === 0);
  assert.strictEqual(R.phase, 'battle');

  R.phase = 'reward';
  R.offer = { kind: 'pick', options: [{ type: 'find', id: 'special_tube', tube: 'amp' }] };
  Run.choose(R, 0);
  assert.strictEqual(R.slots[0], 'amp');
  R.slots = ['amp', 'sieve', 'amp'];
  R.phase = 'reward';
  R.offer = { kind: 'pick', options: [{ type: 'find', id: 'special_tube', tube: 'catalyst' }] };
  Run.choose(R, 0);
  assert.strictEqual(R.offer.kind, 'replace_tube');
  Run.choose(R, 1);
  assert.deepStrictEqual(R.slots, ['amp', 'catalyst', 'amp']);

  R.phase = 'reward';
  R.offer = { kind: 'pick', options: [{ type: 'mod', id: 'tough' }] };
  const hp = R.hp, max = R.maxHp;
  Run.choose(R, 0);
  assert.strictEqual(R.maxHp, max + 10);
  assert.strictEqual(R.battle.player.maxHp, max + 10);
  assert.ok(R.hp >= hp);

  R.phase = 'reward'; R.potions = ['undo'];
  R.offer = { kind: 'pick', options: [{ type: 'mod', id: 'potion_pick' }] };
  Run.choose(R, 0);
  assert.strictEqual(R.offer.kind, 'potion_pick');
  assert.strictEqual(R.offer.options.length, 3);
  const pid = R.offer.options[1].id;
  Run.choose(R, 1);
  assert.deepStrictEqual(R.battle.potions, ['undo', pid]);
});

test('reroll price doubles; filter halves junk; potion drop respects the belt', () => {
  const { R } = Run.create(ctxOf(), 7, []);
  assert.strictEqual(Run.rerollPrice(R), 7);
  R.phase = 'reward'; R.offer = { kind: 'pick', options: [] };
  Run.reroll(R);
  assert.strictEqual(Run.rerollPrice(R), 14);
  R.filter = true;
  Run.skip(R);
  assert.ok(Math.abs(R.battle.field.junkPct - 0.05) < 1e-9);
  let drops = 0;
  for (let s = 0; s < 300; s++) {
    const r = Run.create(ctxOf({ seed: s + 1 }), 2, []).R;
    while (r.stages[r.stage].enemy === 'gremlin') advance(r);
    r.battle.potions = ['heal', 'heal'];
    drops += ofType(finishBattle(r), 'potion_found').length;
    assert.ok(r.potions.length <= 3);
  }
  assert.ok(drops > 30 && drops < 95, 'drop ~20%: ' + drops);
});

function legalActions(R, rng) {
  const B = R.battle, T = B.field.tubes.length, acts = [];
  for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) if (Cb.canAct(B, { type: 'pour', from: a, to: b })) acts.push({ type: 'pour', from: a, to: b });
  if (Rng.chance(rng, 0.05) || !acts.length) for (let t = 0; t < T; t++) if (Cb.canAct(B, { type: 'drain', tube: t })) acts.push({ type: 'drain', tube: t });
  if (Rng.chance(rng, 0.1)) B.potions.forEach((p, idx) => { for (let t = 0; t < T; t++) if (Cb.canAct(B, { type: 'potion', idx, tube: t })) { acts.push({ type: 'potion', idx, tube: t }); break; } });
  return acts;
}

function closes(B, a) {
  if (a.type !== 'pour') return false;
  const F = B.field, src = F.tubes[a.from], dst = F.tubes[a.to], c = src.layers[src.layers.length - 1];
  return dst.kind !== 'vial' && dst.layers.length + PS.Field.pourAmount(F, a.from, a.to) === dst.cap && dst.layers.every(x => x === c);
}

let stalled = 0;
function playRandom(seed, n, boosters) {
  const rng = Rng.make(seed * 31 + 7);
  const ctx = ctxOf({ seed, maxIsland: 10, lab: seed % 3 ? {} : { vitality: 4, mastery: 2, intuition: 1, belt: 2, slot: 1, thrift: 1 } });
  const { R } = Run.create(ctx, n, boosters);
  // Half the runs get a huge HP pool so random play reaches bosses, offers and island wins.
  if (seed % 2) { R.maxHp = R.hp = R.battle.player.maxHp = R.battle.player.hp = 5000; }
  const log = [];
  let steps = 0;
  while (R.phase !== 'won' && R.phase !== 'lost') {
    // A 5000-HP random player can stall forever against a shield-stacking enemy; that's play, not an engine loop.
    if (++steps >= 20000) { assert.ok(seed % 2, 'normal runs must end'); Run.giveUp(R); stalled++; break; }
    let ev;
    if (R.phase === 'battle') {
      const acts = legalActions(R, rng);
      assert.ok(acts.length > 0, 'a legal action always exists');
      const closing = acts.filter(a => closes(R.battle, a));
      const a = Rng.pick(rng, closing.length && Rng.chance(rng, 0.8) ? closing : acts);
      log.push(a);
      ev = Run.act(R, a);
    } else if (R.phase === 'reward') {
      const x = Rng.next(rng);
      if (x < 0.05 && !/replace|potion_pick/.test(R.offer.kind)) ev = Run.reroll(R);
      else if (x < 0.1) ev = Run.skip(R);
      else ev = Run.choose(R, Rng.int(rng, R.offer.options.length));
    } else {
      const o = Run.reviveOptions(R);
      ev = o.free ? Run.revive(R, 'free') : o.gemsPrice && Rng.chance(rng, 0.5) ? Run.revive(R, 'gems') : Run.giveUp(R);
    }
    assert.ok(Array.isArray(ev));
    const B = R.battle;
    for (const v of [R.hp, R.maxHp, R.coins, B.player.hp, B.player.shield, B.enemy.hp, B.enemy.shield, B.enemy.timer, B.turn, B.combo]) assert.ok(Number.isFinite(v), 'finite');
    assert.ok(B.enemy.hp >= 0 && B.player.hp >= 0 && B.player.hp <= B.player.maxHp);
    ev.forEach(e => { if ('value' in e) assert.ok(Number.isFinite(e.value)); if ('dmg' in e) assert.ok(Number.isFinite(e.dmg)); });
  }
  return { R, log };
}

test('fuzz: 200 random runs end without exceptions or NaN', () => {
  const ends = { won: 0, lost: 0 };
  for (let s = 1; s <= 200; s++) {
    const n = (s % 10) + 1;
    const { R } = playRandom(s, n, s % 4 ? [] : ['booster_potion', 'booster_flask', 'booster_vitality', 'booster_first_strike']);
    ends[R.phase]++;
    JSON.parse(JSON.stringify(R));
  }
  console.log('    fuzz ends', JSON.stringify(ends), 'stalled god-mode runs:', stalled);
});

test('determinism by seed and JSON round-trip mid-run', () => {
  const a = playRandom(77, 4, []), b = playRandom(77, 4, []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a.R)), JSON.parse(JSON.stringify(b.R)));
  // Replay the same action log on a deserialized copy taken mid-run.
  const ctx = ctxOf({ seed: 99 });
  const { R } = Run.create(ctx, 3, []);
  const rng = Rng.make(4);
  let copy = null, steps = 0;
  const actions = [];
  while (R.phase !== 'won' && R.phase !== 'lost' && steps++ < 3000) {
    if (steps === 40) copy = JSON.parse(JSON.stringify(R));
    let act;
    if (R.phase === 'battle') act = { k: 'act', a: Rng.pick(rng, legalActions(R, rng)) };
    else if (R.phase === 'reward') act = { k: 'choose', a: Rng.int(rng, R.offer.options.length) };
    else act = { k: Run.reviveOptions(R).free ? 'revive' : 'giveUp' };
    if (steps >= 40) actions.push(act);
    const apply = (X, x) => x.k === 'act' ? Run.act(X, x.a) : x.k === 'choose' ? Run.choose(X, x.a) : x.k === 'revive' ? Run.revive(X, 'free') : Run.giveUp(X);
    apply(R, act);
    if (copy && steps >= 40) apply(copy, act);
  }
  assert.ok(copy);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(R)));
});

test('half-up rounding survives float noise: 90 HP x 35% boss heal = 32', () => {
  assert.strictEqual(PS.U.round(90 * (0.25 + 2 * 0.05)), 32);
  const { R } = Run.create(ctxOf({ lab: { vitality: 8, second_wind: 2 } }), 3, []);
  assert.strictEqual(R.maxHp, 90);
  while (!(R.phase === 'battle' && R.battle.enemy.boss)) advance(R);
  R.battle.player.hp = 10;
  const ev = finishBattle(R);
  assert.strictEqual(ofType(ev, 'heal_after')[0].v, 32);
});

test('revive and phoenix clear the undo snapshot so undo cannot roll back past the death', () => {
  let { R } = Run.create(ctxOf(), 3, []);
  kill(R);
  Run.revive(R, 'free');
  assert.strictEqual(R.battle.history, null);
  assert.ok(!Run.canAct(R, { type: 'potion', idx: R.battle.potions.indexOf('undo') }));
  ({ R } = Run.create(ctxOf(), 3, []));
  R.relics.push('phoenix_feather');
  R.battle.relics.push('phoenix_feather');
  kill(R);
  assert.strictEqual(R.phase, 'battle');
  assert.strictEqual(R.battle.history, null);
});

test('empty slots are capped at 5 from all sources', () => {
  const { R } = Run.create(ctxOf({ lab: { slot: 2 } }), 5, ['booster_flask']);
  assert.strictEqual(R.slots.length, D.economy.slots.max);
});

test('relic in the after-stage pick follows the max open island, not the current one', () => {
  const seen = { low: 0, high: 0 };
  for (let seed = 1; seed < 200; seed++) {
    for (const [k, max] of [['low', 3], ['high', 4]]) {
      const { R } = Run.create(ctxOf({ maxIsland: max, seed }), 1, []);
      finishBattle(R);
      if (R.offer && R.offer.options.some(o => o.type === 'relic')) seen[k]++;
    }
  }
  assert.strictEqual(seen.low, 0);
  assert.ok(seen.high > 0);
});

console.log(passed + ' run tests passed');
