var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const D = () => PS.DATA;
  const Rg = () => PS.Rng;
  const U = () => PS.U;
  const C = () => PS.Combat;

  const islandOf = n => D().islands[n - 1];
  const worldOf = isl => D().worlds[isl.world - 1];
  const labTier = (R, id) => (R.ctx.lab && R.ctx.lab[id]) || 0;
  const hasRelic = (R, id) => R.relics.indexOf(id) >= 0;
  const unlocked = (R, def) => !def.later && (def.unlock || 1) <= R.ctx.maxIsland;
  const SUB_OFFERS = { potion_pick: true, replace_color: true, replace_tube: true };

  function stagesOf(n, rng) {
    const isl = islandOf(n), out = [];
    rng = rng || Rg().make(n * 7919);
    let enc = 0;
    for (let s = 1; s <= isl.stages; s++) {
      if (isl.bossAt.indexOf(s) >= 0) out.push({ type: 'boss', enemy: isl.boss, encounter: enc++ });
      else out.push({ type: 'regular', enemy: Rg().pick(rng, isl.regulars), encounter: 0 });
    }
    return out;
  }

  // The boss gets its `extra` action on the second island it appears on (second island of the world).
  const bossExtra = (R) => { const b = D().bosses[R.boss.id]; return !!b.extra && b.islands.indexOf(R.island) === 1; };

  function islandTags(R) {
    const isl = islandOf(R.island), tags = {};
    isl.regulars.forEach(id => (D().enemies[id].tags || []).forEach(t => { tags[t] = true; }));
    const b = D().bosses[isl.boss];
    ((bossExtra(R) ? b.tagsExtra : b.tags) || []).forEach(t => { tags[t] = true; });
    return tags;
  }

  // ---- pools ----
  function relicOk(R, id) {
    const r = D().relics[id];
    if (hasRelic(R, id) || D().rarity[r.rarity].unlock > R.ctx.maxIsland) return false;
    const q = r.requires;
    if (!q) return true;
    if (q.color) return q.color in R.deck;
    if (q.enemy) return !!islandTags(R)[q.enemy];
    return true;
  }

  function unlockedPool(R, kind) {
    const d = D();
    switch (kind) {
      case 'elements': return Object.keys(d.elements).filter(id => unlocked(R, d.elements[id]));
      case 'potions': return Object.keys(d.potions).filter(id => unlocked(R, d.potions[id]));
      case 'tubes': return Object.keys(d.tubes).filter(id => id !== 'plain' && unlocked(R, d.tubes[id]));
      case 'mods': return Object.keys(d.mods).filter(id => unlocked(R, d.mods[id]) && modOk(R, id));
      case 'finds': return Object.keys(d.finds).filter(id => unlocked(R, d.finds[id]) && findOptions(R, id).length > 0);
      case 'relics': return Object.keys(d.relics).filter(id => relicOk(R, id));
    }
    return [];
  }

  function modOk(R, id) {
    const m = D().mods[id];
    if (id === 'potion_pick') return R.potions.length < R.beltSize && unlockedPool(R, 'potions').length > 0;
    return !m.cap || (R.mods[id] || 0) < m.cap;
  }

  // Every candidate option a find could become; one is picked at random for the offer.
  function findOptions(R, id) {
    const d = D();
    switch (id) {
      case 'new_color':
        return unlockedPool(R, 'elements').filter(c => !(c in R.deck)).map(c => ({ type: 'find', id, color: c }));
      case 'boost_color':
        return Object.keys(R.deck).filter(c => d.elements[c].boost && R.deck[c] < (d.finds.boost_color.cap || 3))
          .map(c => ({ type: 'find', id, color: c }));
      case 'special_tube':
        return unlockedPool(R, 'tubes').map(t => ({ type: 'find', id, tube: t }));
      case 'extra_slot':
        return R.slots.length < (d.finds.extra_slot.maxSlots || d.economy.slots.max) ? [{ type: 'find', id }] : [];
      case 'filter':
        return !R.filter && islandTags(R)[d.finds.filter.requires || 'junkEnemy'] ? [{ type: 'find', id }] : [];
    }
    return [];
  }

  const weighted = (R, ids, w) => Rg().weighted(R.rng, ids.map(id => ({ id, w: w(id) }))).id;
  const potionWeight = id => D().potions[id].weight || 1;
  const relicWeight = id => D().rarity[D().relics[id].rarity].weight;

  function randomPotion(R) {
    const pool = unlockedPool(R, 'potions');
    return pool.length ? weighted(R, pool, potionWeight) : null;
  }

  function sampleWeighted(R, ids, w, n) {
    const left = ids.slice(), out = [];
    while (out.length < n && left.length) {
      const id = weighted(R, left, w);
      out.push(id);
      left.splice(left.indexOf(id), 1);
    }
    return out;
  }

  const choices = R => D().economy.picks.choices + labTier(R, 'intuition') * D().lab.intuition.per.choices;
  const coinsOption = () => ({ type: 'coins', v: D().economy.emptyPoolCoins });

  function genPick(R) {
    const n = choices(R), rng = R.rng, cfg = D().economy;
    const mods = Rg().shuffle(rng, unlockedPool(R, 'mods').map(id => ({ type: 'mod', id })));
    const finds = Rg().shuffle(rng, unlockedPool(R, 'finds').map(id => Rg().pick(rng, findOptions(R, id))));
    const out = [];
    if (mods.length) out.push(mods.shift());
    if (finds.length) out.push(finds.shift());
    const rest = Rg().shuffle(rng, mods.concat(finds));
    while (out.length < n && rest.length) out.push(rest.shift());
    if (out.length < n) out.push(coinsOption());
    if (R.ctx.maxIsland >= cfg.relicInPick.from && Rg().chance(rng, cfg.relicInPick.chance)) {
      const relics = unlockedPool(R, 'relics');
      if (relics.length) out[Rg().int(rng, out.length)] = { type: 'relic', id: weighted(R, relics, relicWeight) };
    }
    return Rg().shuffle(rng, out);
  }

  function genRelics(R) {
    const ids = sampleWeighted(R, unlockedPool(R, 'relics'), relicWeight, choices(R));
    return ids.length ? ids.map(id => ({ type: 'relic', id })) : [coinsOption()];
  }

  function genPotions(R) {
    return sampleWeighted(R, unlockedPool(R, 'potions'), potionWeight, D().mods.potion_pick.choices).map(id => ({ type: 'potion', id }));
  }

  function openOffer(R, kind, options, ev, extra) {
    R.offer = Object.assign({ kind, options }, extra || {});
    R.phase = 'reward';
    ev.push({ type: 'offer', kind });
  }

  // ---- coins / heal ----
  function coinMult(R) {
    const d = D(), isl = islandOf(R.island);
    let m = isl.tier === 'hard' ? d.economy.coins.hardMult : 1;
    m *= 1 + labTier(R, 'thrift') * d.lab.thrift.per.coinsPct;
    if (R.ctx.sealActive) m *= d.seal.coinsMult;
    if (hasRelic(R, 'golden_stopper')) m *= 1 + d.relics.golden_stopper.coinsPct;
    return m;
  }

  function addCoins(R, base, reason, ev) {
    const v = U().round(base * coinMult(R));
    R.coins += v;
    ev.push({ type: 'coins', v, reason });
  }

  function healAfter(R, pct, ev) {
    const p = pct + labTier(R, 'second_wind') * D().lab.second_wind.per.healAfter;
    const v = Math.min(R.maxHp - R.hp, U().round(R.maxHp * p));
    R.hp += v;
    ev.push({ type: 'heal_after', v });
  }

  // ---- battles ----
  function enemySpec(R, st) {
    const isl = islandOf(R.island);
    const scale = cycle => cycle.map(c => ({ t: c.t, v: c.t === 'atk' ? c.v + isl.A : c.v, turns: c.turns }));
    if (st.type === 'regular') {
      const d = D().enemies[st.enemy], hp = U().round(d.hp * isl.M);
      return { id: d.id, name: d.name, boss: false, hp, maxHp: hp, cycle: scale(d.cycle), final: false };
    }
    const b = D().bosses[st.enemy], E = R.boss.encounters, i = st.encounter;
    const cycle = scale(bossExtra(R) ? b.cycle.concat([b.extra]) : b.cycle);
    const hp = i === 0 ? R.boss.maxHp : U().round(R.boss.maxHp * D().economy.boss.returnHp);
    return { id: b.id, name: b.name, boss: true, hp, maxHp: R.boss.maxHp, cycle, final: i === E - 1, patched: i > 0 };
  }

  function labFlat(R) {
    const out = {};
    Object.keys(D().lab).forEach(id => {
      const per = D().lab[id].per, t = labTier(R, id);
      if (!t || !per || !per.color) return;
      const key = Object.keys(per).find(k => k !== 'color');
      out[per.color] = (out[per.color] || 0) + t * per[key];
    });
    return out;
  }

  function battleCtx(R) {
    const w = worldOf(islandOf(R.island)), twist = w.twist;
    let junk = twist && twist.type === 'slimeQueue' ? twist.pct : 0;
    if (R.filter) junk *= 1 - D().finds.filter.pct;
    return {
      seed: Math.floor(Rg().next(R.rng) * 4294967296) >>> 0,
      hp: R.hp, maxHp: R.maxHp, deck: R.deck, labFlat: labFlat(R),
      masteryPct: labTier(R, 'mastery') * D().lab.mastery.per.effectPct,
      startShield: labTier(R, 'start_shield') * D().lab.start_shield.per.shield,
      mods: R.mods, relics: R.relics, slots: R.slots, potions: R.potions, beltSize: R.beltSize,
      twist, junkPct: junk, filter: !!R.filter,
      firstStrike: R.stage === 0 && R.boosters.indexOf('booster_first_strike') >= 0 ? D().boosters.booster_first_strike.mult : 1,
    };
  }

  function startStage(R, i, ev) {
    R.stage = i;
    R.best = Math.max(R.best, i + 1);
    R.offer = null;
    const st = R.stages[i];
    if (hasRelic(R, 'bandolier') && R.potions.length < R.beltSize) {
      const id = randomPotion(R);
      if (id) { R.potions.push(id); ev.push({ type: 'relic', id: 'bandolier' }); ev.push({ type: 'potion_found', id, source: 'bandolier' }); }
    }
    const spec = enemySpec(R, st);
    const out = C().create(battleCtx(R), spec);
    R.battle = out.B;
    R.phase = 'battle';
    ev.push({ type: 'stage_start', stage: i, enemy: st.enemy, boss: st.type === 'boss', encounter: st.encounter, final: !!spec.final });
    if (st.type === 'boss') { R.stats.bossReached++; ev.push({ type: 'boss_reach', encounter: st.encounter }); }
    out.events.forEach(e => ev.push(e));
    if (R.battle.status !== 'active') endBattle(R, ev);
  }

  function mergeStats(R, B) {
    if (!B || B.merged) return;
    B.merged = true;
    const s = R.stats, b = B.stats;
    Object.keys(b.closes).forEach(c => { s.closes[c] = (s.closes[c] || 0) + b.closes[c]; });
    s.junkCloses += b.junkCloses;
    s.potionsUsed += b.potionsUsed;
    s.maxCombo = Math.max(s.maxCombo, b.maxCombo);
    s.dmgDealt += b.dmgDealt;
    s.turns += B.turn;
  }

  function nextStage(R, ev) {
    if (R.stage + 1 >= R.stages.length) { R.phase = 'won'; R.offer = null; ev.push({ type: 'island_won' }); return; }
    startStage(R, R.stage + 1, ev);
  }

  function endBattle(R, ev) {
    const B = R.battle, st = R.stages[R.stage], d = D(), i = R.island;
    if (B.status === 'lost') {
      if (hasRelic(R, 'phoenix_feather') && revivesLeft(R) > 0) {
        R.phoenixUsed = true;
        B.status = 'active';
        B.player.hp = Math.max(1, U().round(B.player.maxHp * d.relics.phoenix_feather.hp));
        B.history = null;
        ev.push({ type: 'relic', id: 'phoenix_feather' });
        ev.push({ type: 'revived', source: 'phoenix' });
        C().settle(B).forEach(e => ev.push(e));
        if (B.status !== 'active') endBattle(R, ev);
        return;
      }
      R.hp = 0;
      R.phase = 'revive';
      ev.push({ type: 'revive_prompt' });
      return;
    }
    mergeStats(R, B);
    R.hp = B.player.hp;
    R.potions = B.potions.slice();
    R.stats.stagesCleared++;
    ev.push({ type: 'stage_clear', stage: R.stage });

    if (st.type === 'regular') {
      R.stats.kills++;
      ev.push({ type: 'kill', enemy: st.enemy, boss: false });
      addCoins(R, U().lin(d.economy.coins.reg, i), 'kill', ev);
      if (R.stage + 1 >= R.stages.length) { nextStage(R, ev); return; }
      healAfter(R, d.economy.heal.regular, ev);
      if (R.potions.length < R.beltSize && Rg().chance(R.rng, d.economy.potionDrop)) {
        const id = randomPotion(R);
        if (id) { R.potions.push(id); ev.push({ type: 'potion_found', id, source: 'drop' }); }
      }
      openOffer(R, 'pick', genPick(R), ev);
      return;
    }

    const fled = B.status === 'fled';
    R.boss.done++;
    if (fled) addCoins(R, U().lin(d.economy.coins.flee, i), 'boss_fled', ev);
    else {
      R.stats.kills++;
      ev.push({ type: 'kill', enemy: st.enemy, boss: true });
      addCoins(R, U().lin(d.economy.coins.kill, i), 'boss_kill', ev);
    }
    ev.push({ type: 'boss_encounter_end', fled, encounter: st.encounter });
    if (R.stage + 1 >= R.stages.length) { nextStage(R, ev); return; }
    healAfter(R, d.economy.heal.boss, ev);
    openOffer(R, 'relic', genRelics(R), ev);
  }

  // ---- public API ----
  function create(ctx, n, boosterIds, opts) {
    const d = D(), E = d.economy, isl = islandOf(n);
    opts = opts || {};
    let boosterPotion = opts.potion || null;
    const boosters = [];
    (boosterIds || []).forEach(b => {
      const [id, arg] = String(b).split(':');
      if (boosters.indexOf(id) < 0) boosters.push(id);
      if (id === 'booster_potion' && arg) boosterPotion = boosterPotion || arg;
    });
    const R = {
      v: 1, island: n, ctx: U().clone(ctx), rng: Rg().make(ctx.seed), phase: 'battle',
      stages: null, stage: 0, hp: 0, maxHp: 0, deck: {}, mods: {}, relics: [], slots: [], potions: [], beltSize: 0, filter: false,
      boss: null, boosters, coins: 0, gemsSpent: 0, revives: { free: 0, gems: 0, life: 0 }, phoenixUsed: false, rerolls: 0,
      offer: null, battle: null, best: 0, firstClear: false,
      stats: { closes: {}, junkCloses: 0, kills: 0, bossReached: 0, maxCombo: 0, potionsUsed: 0, stagesCleared: 0, turns: 0, dmgDealt: 0 },
    };
    R.stages = stagesOf(n, R.rng);
    const b = d.bosses[isl.boss];
    R.boss = { id: b.id, maxHp: U().round(b.hp * isl.M), encounters: isl.bossAt.length, done: 0 };

    R.maxHp = E.player.hp + labTier(R, 'vitality') * d.lab.vitality.per.maxHp
      + (boosters.indexOf('booster_vitality') >= 0 ? d.boosters.booster_vitality.maxHp : 0);
    R.hp = R.maxHp;
    d.startDeck.forEach(c => { R.deck[c] = 0; });
    const slots = Math.min(E.slots.max, E.slots.base + labTier(R, 'slot') * d.lab.slot.per.slots
      + (boosters.indexOf('booster_flask') >= 0 ? d.boosters.booster_flask.slots : 0));
    for (let s = 0; s < slots; s++) R.slots.push('plain');
    R.beltSize = E.belt.base + (labTier(R, 'belt') >= 2 ? 1 : 0);
    // Start potions may overflow the belt so a paid booster is never lost; drops/picks respect beltSize.
    R.potions = (d.potionStart || ['undo', 'heal']).slice();
    if (boosters.indexOf('booster_potion') >= 0) {
      const ok = boosterPotion && d.potions[boosterPotion] && unlocked(R, d.potions[boosterPotion]);
      const id = ok ? boosterPotion : randomPotion(R);
      if (id) R.potions.push(id);
    }
    if (labTier(R, 'belt') >= 1) { const id = randomPotion(R); if (id) R.potions.push(id); }

    const events = [];
    startStage(R, 0, events);
    return { R, events };
  }

  function act(R, a) {
    if (R.phase !== 'battle' || !R.battle) return [];
    const ev = C().act(R.battle, a);
    if (R.battle.status !== 'active') endBattle(R, ev);
    return ev;
  }

  const canAct = (R, a) => R.phase === 'battle' && !!R.battle && C().canAct(R.battle, a);

  function applyOption(R, o, ev) {
    const d = D();
    switch (o.type) {
      case 'mod':
        if (o.id === 'potion_pick') { openOffer(R, 'potion_pick', genPotions(R), ev); return false; }
        R.mods[o.id] = (R.mods[o.id] || 0) + 1;
        if (o.id === 'tough') { R.maxHp += d.mods.tough.maxHp; R.hp = Math.min(R.maxHp, R.hp + d.mods.tough.heal); }
        return true;
      case 'find':
        switch (o.id) {
          case 'new_color':
            if (Object.keys(R.deck).length >= d.economy.deckMax) {
              openOffer(R, 'replace_color', Object.keys(R.deck).map(c => ({ type: 'color', id: c })), ev, { pending: o.color });
              return false;
            }
            R.deck[o.color] = 0;
            return true;
          case 'boost_color': R.deck[o.color] = (R.deck[o.color] || 0) + 1; return true;
          case 'special_tube': {
            const j = R.slots.indexOf('plain');
            if (j >= 0) { R.slots[j] = o.tube; return true; }
            openOffer(R, 'replace_tube', R.slots.map((k, s) => ({ type: 'tube', id: k, slot: s })), ev, { pending: o.tube });
            return false;
          }
          case 'extra_slot': R.slots.push('plain'); return true;
          case 'filter': R.filter = true; return true;
        }
        return true;
      case 'relic': if (!hasRelic(R, o.id)) R.relics.push(o.id); return true;
      case 'potion': R.potions.push(o.id); return true;
      case 'coins': addCoins(R, o.v, 'empty_pool', ev); return true;
    }
    return true;
  }

  function choose(R, idx) {
    const ev = [];
    if (R.phase !== 'reward' || !R.offer) return ev;
    const off = R.offer, o = off.options[idx];
    if (!o) return ev;
    let done = true;
    if (off.kind === 'replace_color') { delete R.deck[o.id]; R.deck[off.pending] = 0; }
    else if (off.kind === 'replace_tube') R.slots[o.slot] = off.pending;
    else done = applyOption(R, o, ev);
    ev.push({ type: 'chosen', kind: off.kind, option: o });
    if (done) nextStage(R, ev);
    return ev;
  }

  const rerollPrice = R => D().economy.reroll.gems * Math.pow(D().economy.reroll.mult, R.rerolls);

  function reroll(R) {
    const ev = [];
    if (R.phase !== 'reward' || !R.offer || SUB_OFFERS[R.offer.kind]) return ev;
    R.gemsSpent += rerollPrice(R);
    R.rerolls++;
    openOffer(R, R.offer.kind, R.offer.kind === 'relic' ? genRelics(R) : genPick(R), ev);
    ev[ev.length - 1].reroll = true;
    return ev;
  }

  function skip(R) {
    const ev = [];
    if (R.phase !== 'reward' || !R.offer) return ev;
    // Skipping a follow-up (which colour/tube to replace, which potion) just cancels that pick.
    if (!SUB_OFFERS[R.offer.kind]) addCoins(R, U().lin(D().economy.skip, R.island), 'skip', ev);
    ev.push({ type: 'skipped', kind: R.offer.kind });
    nextStage(R, ev);
    return ev;
  }

  // One revive per attempt from any source (ad, a stored life, gems or Phoenix Feather), so gems cannot buy a win outright.
  const revivesLeft = R => D().economy.revive.perRun - R.revives.free - R.revives.gems - (R.revives.life || 0) - (R.phoenixUsed ? 1 : 0);

  function reviveOptions(R) {
    const ok = R.phase === 'revive' && revivesLeft(R) > 0;
    return { free: ok, gemsPrice: ok ? D().economy.revive.gems : null };
  }

  function revive(R, source) {
    const ev = [], o = reviveOptions(R);
    if (R.phase !== 'revive') return ev;
    // 'life' spends a stored life from the profile; the caller takes it, the run only counts the revive
    if (source === 'free' || source === 'life' ? !o.free : (source !== 'gems' || o.gemsPrice == null)) return ev;
    if (source === 'gems') R.gemsSpent += o.gemsPrice;
    R.revives[source] = (R.revives[source] || 0) + 1;
    const B = R.battle;
    B.status = 'active';
    B.player.hp = Math.max(1, U().round(B.player.maxHp * D().economy.revive.hp));
    // Undo would roll back past the death and hand back the pre-death HP on top of the revive.
    B.history = null;
    R.phase = 'battle';
    ev.push({ type: 'revived', source, price: source === 'gems' ? o.gemsPrice : 0 });
    C().settle(B).forEach(e => ev.push(e));
    if (B.status !== 'active') endBattle(R, ev);
    return ev;
  }

  function giveUp(R) {
    if (R.phase === 'won' || R.phase === 'lost') return [];
    if (R.battle) { mergeStats(R, R.battle); R.potions = R.battle.potions.slice(); }
    R.phase = 'lost';
    R.offer = null;
    return [{ type: 'island_lost' }];
  }

  PS.Run = {
    stagesOf, create, act, canAct, choose, reroll, rerollPrice, skip, revive, reviveOptions, giveUp, unlockedPool,
    coinMult, islandTags,
  };
})();
