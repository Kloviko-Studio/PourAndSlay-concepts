var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const D = () => PS.DATA;
  const Fd = () => PS.Field;
  const Rg = () => PS.Rng;
  const U = () => PS.U;

  const JUNK = { stone: true, slime: true };
  const DMG_COLORS = { fire: true, lightning: true, dark: true };
  const PRIMARY = { fire: 'dmg', water: 'shield', life: 'heal', poison: 'tick', lightning: 'dmg', ice: 'freeze', dark: 'dmg' };
  const TUBE_POTIONS = { solvent: true, shake: true };
  // Refill can keep producing closed tubes; the cap only guards against a pathological queue.
  const MAX_CHAIN = 30;

  const has = (B, id) => B.relics.indexOf(id) >= 0;
  const stacks = (B, id) => B.mods[id] || 0;
  const alive = B => B.status === 'active';
  const tubesOf = F => F.tubes.map(t => ({ kind: t.kind, cap: t.cap, layers: t.layers.slice(), frozen: t.frozen }));
  // Filter halves junk from every source, not just the queue, so it matters outside the spores world too.
  const junkCount = (B, v) => (B.filter ? Math.floor(v / 2) : v);
  const queueOf = F => F.queue.map(p => p.slice());
  const relicEv = (ev, id) => ev.push({ type: 'relic', id });
  const rnd = v => U().round(v);

  function kOf(B, step) {
    const c = D().combo;
    return c[Math.min(step, c.length - 1)] + (step >= 1 ? stacks(B, 'combo_master') * D().mods.combo_master.add : 0);
  }
  const stepOfK = (B, k) => { let s = 0; for (let i = 0; i < D().combo.length; i++) if (k >= kOf(B, i)) s = i; return s; };

  function tubeMult(kind) {
    const t = D().tubes[kind];
    return t && t.mult ? t.mult : 1;
  }

  function flat(B, color) {
    const c = D().elements[color], key = PRIMARY[color];
    let v = c.base[key] + (c.boost && c.boost[key] ? c.boost[key] * (B.deck[color] || 0) : 0);
    v += B.labFlat[color] || 0;
    if (DMG_COLORS[color]) v += stacks(B, 'caustic') * D().mods.caustic.dmg;
    if (color === 'fire' && has(B, 'hot_crucible')) v += D().relics.hot_crucible.dmg;
    return v;
  }

  function vulnMult(B) {
    if (!(B.enemy.frozen > 0)) return 1;
    return 1 + (has(B, 'frost_crown') ? D().relics.frost_crown.vuln : D().elements.ice.base.vuln);
  }

  // README order: base + flat -> x special tube -> x k -> x relics/freeze/mastery/boosters -> round half up.
  function scaled(B, color, k, kind) {
    let m = 1 + (B.masteryPct || 0);
    if (DMG_COLORS[color] || color === 'poison') m *= B.firstStrike || 1;
    if (DMG_COLORS[color]) m *= vulnMult(B);
    return rnd(flat(B, color) * tubeMult(kind) * k * m);
  }

  function freezeTurns(B, step) {
    const c = D().elements.ice;
    return c.base.freeze + c.boost.freeze * (B.deck.ice || 0) + (step >= 2 ? c.base.freezeK2 - c.base.freeze : 0);
  }

  function delayTurns(B, step) {
    const src = has(B, 'storm_rod') ? D().relics.storm_rod : D().elements.lightning.base;
    return step >= 2 ? src.delayK2 : src.delay;
  }

  function effectValue(B, color, k, kind) {
    if (k == null) k = kOf(B, Math.min(B.combo, D().combo.length - 1));
    kind = kind || 'plain';
    if (color === 'slime') return has(B, 'sponge') ? D().relics.sponge.shield : D().junk.slime.shield;
    if (color === 'stone') return 0;
    if (color === 'mirror') return B.lastColor ? effectValue(B, B.lastColor, k, kind) : D().elements.mirror.base.fallbackShield;
    if (color === 'ice') return freezeTurns(B, stepOfK(B, k));
    return scaled(B, color, k, kind);
  }

  // ---- damage / heal plumbing ----
  function checkEnemy(B, ev) {
    const e = B.enemy;
    if (e.hp <= 0) {
      e.hp = 0;
      // A beaten boss retreats until its last encounter, where it can only win or die.
      const fled = e.boss && !e.final;
      B.status = fled ? 'fled' : 'won';
      ev.push({ type: fled ? 'boss_fled' : 'enemy_dead' });
    } else if (e.boss && e.final && !e.rage && e.hp <= e.maxHp * D().economy.boss.rageAt) {
      e.rage = true;
      ev.push({ type: 'rage' });
    }
  }

  function healPlayer(B, v, source, ev) {
    if (!alive(B) || v <= 0) return 0;
    const p = B.player, real = Math.min(v, p.maxHp - p.hp);
    p.hp += real;
    ev.push({ type: 'heal', v: real, source });
    return real;
  }

  function hitEnemy(B, dmg, source, ev) {
    if (!alive(B) || !(dmg > 0)) return 0;
    const e = B.enemy;
    let absorbed = 0;
    if (source !== 'poison') { absorbed = Math.min(e.shield, dmg); e.shield -= absorbed; }
    const real = dmg - absorbed;
    e.hp -= real;
    B.stats.dmgDealt += real;
    ev.push({ type: 'enemy_hit', dmg: real, absorbed, source });
    const leech = stacks(B, 'leech');
    if (real > 0 && leech) healPlayer(B, Math.ceil(real * leech * D().mods.leech.pct - 1e-9), 'leech', ev);
    checkEnemy(B, ev);
    return real;
  }

  function hurtPlayer(B, dmg, source, ev, pierce) {
    if (!alive(B) || !(dmg > 0)) return 0;
    const p = B.player;
    let absorbed = 0;
    if (!pierce) { absorbed = Math.min(p.shield, dmg); p.shield -= absorbed; }
    const real = dmg - absorbed;
    p.hp -= real;
    ev.push({ type: 'player_hit', dmg: real, absorbed, source });
    if (p.hp <= 0) {
      p.hp = 0;
      B.status = 'lost';
      ev.push({ type: 'player_dead' });
    }
    return real;
  }

  function addShield(B, v, color, ev) {
    B.player.shield += v;
    ev.push({ type: 'effect', color, kind: color === 'slime' ? 'slime' : 'shield', value: v });
  }

  // ---- colour effects ----
  function applyColor(B, color, step, kind, ev, viaMirror) {
    if (!alive(B)) return;
    const k = kOf(B, step), C = D().elements;
    switch (color) {
      case 'fire': case 'lightning': case 'dark': {
        const v = scaled(B, color, k, kind);
        ev.push({ type: 'effect', color, kind: 'dmg', value: v });
        hitEnemy(B, v, color, ev);
        if (!alive(B)) break;
        if (color === 'lightning') {
          const d = delayTurns(B, step);
          B.enemy.timer += d;
          if (has(B, 'storm_rod')) relicEv(ev, 'storm_rod');
          ev.push({ type: 'effect', color, kind: 'delay', value: d });
        } else if (color === 'dark') {
          if (has(B, 'blood_retort')) { relicEv(ev, 'blood_retort'); healPlayer(B, D().relics.blood_retort.heal, 'blood_retort', ev); } else {
            ev.push({ type: 'effect', color, kind: 'self', value: C.dark.base.self });
            hurtPlayer(B, C.dark.base.self, 'dark', ev, true);
          }
        }
        break;
      }
      case 'water': addShield(B, scaled(B, color, k, kind), color, ev); break;
      case 'life': {
        const v = scaled(B, color, k, kind);
        ev.push({ type: 'effect', color, kind: 'heal', value: v });
        healPlayer(B, v, 'life', ev);
        break;
      }
      case 'poison': {
        const v = scaled(B, color, k, kind);
        const turns = has(B, 'poison_ivy') ? D().relics.poison_ivy.turns : C.poison.base.turns;
        B.enemy.poison.push({ tick: v, turns });
        ev.push({ type: 'effect', color, kind: 'poison', value: v, turns });
        break;
      }
      case 'ice': {
        const n = freezeTurns(B, step);
        // Max instead of sum: stacking ice would otherwise lock the enemy forever.
        B.enemy.frozen = Math.max(B.enemy.frozen, n);
        ev.push({ type: 'effect', color, kind: 'freeze', value: n });
        ev.push({ type: 'frozen_enemy', turns: B.enemy.frozen });
        break;
      }
      case 'mirror': {
        if (B.lastColor) {
          const times = has(B, 'void_lens') ? D().relics.void_lens.times : 1;
          if (times > 1) relicEv(ev, 'void_lens');
          for (let i = 0; i < times; i++) applyColor(B, B.lastColor, step, kind, ev, true);
        } else addShield(B, C.mirror.base.fallbackShield, 'mirror', ev);
        break;
      }
      case 'slime':
        if (has(B, 'sponge')) relicEv(ev, 'sponge');
        addShield(B, effectValue(B, 'slime'), 'slime', ev);
        break;
    }
    if (!viaMirror && color !== 'mirror' && !JUNK[color]) B.lastColor = color;
  }

  function closeTube(B, i, opts, ev, depth) {
    const F = B.field, t = F.tubes[i], color = t.layers[0], n = t.layers.length;
    const maxStep = D().combo.length - 1;
    let step = Math.min(B.combo, maxStep);
    if (B.comboElixir) { step = Math.max(step, Math.max(0, D().combo.indexOf(D().potions.combo.k))); B.comboElixir = false; }
    const k = kOf(B, step);
    B.combo = Math.max(B.combo, step) + (opts.cascade && has(B, 'cascade_chute') ? D().relics.cascade_chute.steps : 1);
    const junk = !!JUNK[color];
    B.stats.closes[color] = (B.stats.closes[color] || 0) + 1;
    if (junk) B.stats.junkCloses++;
    B.stats.maxCombo = Math.max(B.stats.maxCombo, D().combo[step]);
    ev.push({ type: 'close', tube: i, color, k, step, cascade: !!opts.cascade, auto: !!opts.auto, junk, n, tubes: tubesOf(F) });
    if (step >= 1) ev.push({ type: 'combo', k: D().combo[step], step });

    const times = step >= 3 && has(B, 'great_cauldron') ? D().relics.great_cauldron.times : 1;
    if (times > 1) relicEv(ev, 'great_cauldron');
    for (let x = 0; x < times; x++) {
      if (color === 'stone') {
        ev.push({ type: 'effect', color, kind: 'stone', value: 0 });
        if (has(B, 'stone_heart')) { relicEv(ev, 'stone_heart'); hitEnemy(B, n * D().relics.stone_heart.dmg, 'stone_heart', ev); }
      } else applyColor(B, color, step, t.kind, ev, false);
    }
    if (step >= 2 && has(B, 'alchemist_heart') && alive(B)) { relicEv(ev, 'alchemist_heart'); healPlayer(B, D().relics.alchemist_heart.heal, 'alchemist_heart', ev); }
    if (B.status !== 'active' && B.status !== 'lost') return;

    // Field mechanics finish even if the player just died, so a revive resumes from a consistent field.
    Fd().breakStonesNear(F, i).forEach(s => {
      ev.push({ type: 'stones', tube: s.tube, n: s.n, tubes: tubesOf(F) });
      if (has(B, 'stone_heart') && alive(B)) { relicEv(ev, 'stone_heart'); hitEnemy(B, s.n * D().relics.stone_heart.dmg, 'stone_heart', ev); }
    });
    if (B.status !== 'active' && B.status !== 'lost') return;
    if (t.kind === 'bomb') {
      const targets = Fd().bombNeighbors(F, i);
      if (targets.length) ev.push({ type: 'bomb', tube: i, targets, tubes: tubesOf(F) });
    }
    t.frozen = 0;
    Fd().refill(F, B.rng, i);
    ev.push({ type: 'refill', tube: i, tubes: tubesOf(F), queue: queueOf(F) });
    if (alive(B) && depth < MAX_CHAIN && Fd().isClosed(F, i)) closeTube(B, i, { cascade: true }, ev, depth + 1);
  }

  // Full uniform tubes left by enemy actions or twists must close, otherwise they'd block the field.
  function settleClosed(B, ev) {
    for (let g = 0; g < MAX_CHAIN && alive(B); g++) {
      const c = Fd().closableAfterEnemy(B.field);
      if (!c.length) break;
      closeTube(B, c[0], { auto: true }, ev, 0);
    }
  }

  // ---- enemy ----
  function setIntent(B, ev) {
    const e = B.enemy;
    let it = e.cycle[e.ci % e.cycle.length];
    // Heals are capped per battle: a healer that out-heals the player stalls the fight forever.
    if (it.t === 'heal' && e.heals >= D().economy.enemyHeals) it = e.cycle[++e.ci % e.cycle.length];
    e.ci++;
    let timer = it.turns;
    if (e.rage) timer -= D().economy.boss.rageTimer;
    if (e.first && has(B, 'hourglass')) timer += D().relics.hourglass.delay;
    e.first = false;
    e.timer = Math.max(1, timer);
    e.intent = { t: it.t, v: it.v, turns: it.turns };
    ev.push({ type: 'intent', t: it.t, v: it.v, timer: e.timer });
  }

  function enemyAct(B, ev) {
    const e = B.enemy, it = e.intent, F = B.field, rng = B.rng, p = B.player;
    let spoiled = false;
    // Enemy shield lasts until its next action; stacking forever made shield bosses unkillable.
    if (e.shield > 0) { ev.push({ type: 'enemy_shield_burn', v: e.shield }); e.shield = 0; }
    switch (it.t) {
      case 'atk': {
        let dmg = it.v * e.buff;
        e.buff = 1;
        const apron = stacks(B, 'apron');
        if (apron) dmg = rnd(dmg * Math.max(0, 1 - apron * D().mods.apron.pct));
        ev.push({ type: 'enemy_act', t: 'atk', v: dmg });
        hurtPlayer(B, dmg, 'atk', ev, false);
        if (alive(B)) {
          const th = stacks(B, 'thorns');
          if (th) hitEnemy(B, th * D().mods.thorns.dmg, 'thorns', ev);
          if (alive(B) && p.shield > 0 && has(B, 'mirror_shield')) {
            relicEv(ev, 'mirror_shield');
            hitEnemy(B, rnd(p.shield * D().relics.mirror_shield.ratio), 'mirror_shield', ev);
          }
        }
        if (p.shield > 0) {
          const keep = has(B, 'crystal_ward') ? Math.floor(p.shield * (1 - D().relics.crystal_ward.burn)) : 0;
          if (keep) relicEv(ev, 'crystal_ward');
          ev.push({ type: 'shield_burn', v: p.shield - keep });
          p.shield = keep;
        }
        if (B.twist && B.twist.type === 'burn' && alive(B)) {
          B.burn.push({ dmg: B.twist.dmg, turns: B.twist.turns });
          ev.push({ type: 'twist', twist: 'burn', dmg: B.twist.dmg, turns: B.twist.turns });
        }
        break;
      }
      case 'stone': {
        const idx = Fd().addStones(F, rng, junkCount(B, it.v));
        spoiled = idx.length > 0;
        ev.push({ type: 'enemy_act', t: 'stone', v: it.v, target: idx, tubes: tubesOf(F) });
        break;
      }
      case 'spores': {
        const r = Fd().sporeQueue(F, rng, junkCount(B, it.v));
        spoiled = r.length > 0;
        ev.push({ type: 'enemy_act', t: 'spores', v: it.v, target: r, queue: queueOf(F) });
        break;
      }
      case 'freeze': {
        const j = Fd().freezeRandom(F, rng, it.v);
        spoiled = j >= 0;
        ev.push({ type: 'enemy_act', t: 'freeze', v: it.v, target: j, tubes: tubesOf(F) });
        break;
      }
      case 'steal': {
        const r = Fd().stealTop(F, rng);
        spoiled = !!r;
        ev.push({ type: 'enemy_act', t: 'steal', v: 0, target: r, tubes: tubesOf(F) });
        break;
      }
      case 'swap': {
        const r = Fd().swapColors(F, rng);
        spoiled = !!r;
        ev.push({ type: 'enemy_act', t: 'swap', v: 0, target: r, tubes: tubesOf(F) });
        break;
      }
      case 'shield':
        e.shield += it.v;
        ev.push({ type: 'enemy_act', t: 'shield', v: it.v });
        ev.push({ type: 'enemy_shield', v: it.v });
        break;
      case 'buff':
        e.buff = 2;
        ev.push({ type: 'enemy_act', t: 'buff', v: 2 });
        break;
      case 'heal': {
        const real = Math.min(it.v, e.maxHp - e.hp);
        e.hp += real;
        e.heals = (e.heals || 0) + 1;
        ev.push({ type: 'enemy_act', t: 'heal', v: it.v });
        ev.push({ type: 'enemy_heal', v: real });
        break;
      }
    }
    if (spoiled && alive(B) && has(B, 'trap')) { relicEv(ev, 'trap'); hitEnemy(B, D().relics.trap.dmg, 'trap', ev); }
    settleClosed(B, ev);
    if (has(B, 'philosopher_stone')) B.freePours = D().relics.philosopher_stone.free;
    if (B.status === 'active' || B.status === 'lost') setIntent(B, ev);
  }

  function passTurn(B, ev) {
    const e = B.enemy, F = B.field;
    B.turn++;
    ev.push({ type: 'turn', free: false, n: B.turn });
    Fd().tickFrozen(F);

    let pd = 0;
    e.poison.forEach(p => { pd += p.tick; p.turns--; });
    e.poison = e.poison.filter(p => p.turns > 0);
    if (pd) { ev.push({ type: 'poison_tick', dmg: pd }); hitEnemy(B, pd, 'poison', ev); if (!alive(B)) return; }

    if (B.burn.length) {
      let bd = 0;
      B.burn.forEach(b => { bd += b.dmg; b.turns--; });
      B.burn = B.burn.filter(b => b.turns > 0);
      ev.push({ type: 'burn_tick', dmg: bd });
      hurtPlayer(B, bd, 'burn', ev, true);
      if (!alive(B)) return;
    }

    if (B.twist && B.twist.type === 'stonefall' && B.turn % B.twist.every === 0) {
      const idx = Fd().addStones(F, B.rng, 1);
      ev.push({ type: 'twist', twist: 'stonefall', target: idx, tubes: tubesOf(F) });
      settleClosed(B, ev);
      if (!alive(B)) return;
    }

    if (e.frozen > 0) {
      e.frozen--;
      ev.push({ type: 'frozen_enemy', turns: e.frozen, tick: true });
      return;
    }
    e.timer--;
    if (e.timer <= 0) enemyAct(B, ev);
  }

  // ---- move bookkeeping ----
  function snapshot(B) {
    const h = B.history;
    B.history = null;
    const s = U().clone(B);
    B.history = h;
    return s;
  }

  function comboMiss(B) {
    if (has(B, 'patient_mage')) {
      B.comboGrace++;
      if (B.comboGrace >= D().relics.patient_mage.grace) { B.combo = 0; B.comboGrace = 0; }
    } else { B.combo = 0; B.comboGrace = 0; }
  }

  function endMove(B, free, ev) {
    if (!free && B.freePours > 0) { B.freePours--; free = 'philosopher_stone'; relicEv(ev, free); }
    if (!free && has(B, 'lucky_clover') && Rg().chance(B.rng, D().relics.lucky_clover.chance)) { free = 'lucky_clover'; relicEv(ev, free); }
    if (free) ev.push({ type: 'turn', free: true, reason: free, n: B.turn });
    else passTurn(B, ev);
  }

  function afterAction(B, ev) {
    if (!alive(B)) return ev;
    const stuck = !Fd().anyMove(B.field);
    if (stuck && !B.stuck) ev.push({ type: 'dead_end' });
    B.stuck = stuck;
    return ev;
  }

  // ---- actions ----
  function canAct(B, a) {
    if (!B || !a || B.status !== 'active') return false;
    const F = B.field;
    if (a.type === 'pour') return Fd().pourAmount(F, a.from, a.to) > 0;
    if (a.type === 'drain') { const t = F.tubes[a.tube]; return !!t && t.layers.length > 0; }
    if (a.type === 'potion') {
      const id = B.potions[a.idx];
      if (!id) return false;
      if (TUBE_POTIONS[id]) { const t = F.tubes[a.tube]; return !!t && t.layers.length >= (id === 'shake' ? 2 : 1); }
      if (id === 'undo') return !!B.history;
      if (id === 'combo') return !B.comboElixir;
      return !!D().potions[id];
    }
    return false;
  }

  function doPour(B, a, ev) {
    const F = B.field;
    B.history = snapshot(B);
    const r = Fd().pour(F, a.from, a.to);
    ev.push({ type: 'pour', from: a.from, to: a.to, n: r.n, color: r.color, tubes: tubesOf(F) });
    let free = null, closed = false;
    if (r.swallowed) {
      free = 'sieve';
      ev.push({ type: 'swallow', tube: a.to, color: r.color, n: r.n });
    } else if (Fd().isClosed(F, a.to)) {
      const kind = F.tubes[a.to].kind;
      closeTube(B, a.to, {}, ev, 0);
      closed = true;
      if (kind === 'catalyst') free = 'catalyst';
    }
    if (!alive(B)) { if (B.status === 'lost') B.owedMove = { free }; return; }
    // A swallow is a free tidy-up, not a move, so it doesn't break the chain.
    if (closed) B.comboGrace = 0;
    else if (!r.swallowed) comboMiss(B);
    endMove(B, free, ev);
  }

  function doDrain(B, a, ev) {
    const F = B.field;
    B.history = snapshot(B);
    const free = !!B.stuck;
    const r = Fd().drain(F, B.rng, a.tube);
    B.combo = 0;
    B.comboGrace = 0;
    B.stuck = false;
    ev.push({ type: 'drain', tube: a.tube, free, refilled: r.refilled, tubes: tubesOf(F) });
    if (!free) hurtPlayer(B, D().economy.drain.hp, 'drain', ev, true);
    if (!alive(B)) { if (B.status === 'lost') B.owedMove = { drain: true }; return; }
    if (r.refilled && Fd().isClosed(F, a.tube)) closeTube(B, a.tube, {}, ev, 0);
    if (!alive(B)) return;
    if (free) ev.push({ type: 'turn', free: true, reason: 'dead_end', n: B.turn });
    else passTurn(B, ev);
  }

  function doPotion(B, a, ev) {
    const id = B.potions[a.idx], F = B.field, P = D().potions;
    B.potions.splice(a.idx, 1);
    B.stats.potionsUsed++;
    const e = { type: 'potion', id };
    if (TUBE_POTIONS[id]) e.tube = a.tube;
    switch (id) {
      case 'undo': {
        const snap = B.history, potions = B.potions.slice(), used = B.stats.potionsUsed;
        Object.keys(snap).forEach(k => { B[k] = snap[k]; });
        // Potions spent since the snapshot stay spent, so undo can't refund them.
        B.potions = potions;
        B.stats.potionsUsed = used;
        B.history = null;
        e.tubes = tubesOf(B.field);
        ev.push(e);
        return;
      }
      case 'heal': ev.push(e); healPlayer(B, rnd(B.player.maxHp * P.heal.pct), 'potion', ev); break;
      case 'flask': e.tube = Fd().addFlask(F); e.tubes = tubesOf(F); ev.push(e); break;
      case 'solvent': e.color = Fd().solvent(F, a.tube); e.tubes = tubesOf(F); ev.push(e); break;
      case 'shake': Fd().shake(F, B.rng, a.tube); e.tubes = tubesOf(F); ev.push(e); break;
      case 'sleep':
        B.enemy.timer += P.sleep.delay;
        ev.push(e);
        ev.push({ type: 'intent', t: B.enemy.intent.t, v: B.enemy.intent.v, timer: B.enemy.timer });
        break;
      case 'firebomb': {
        ev.push(e);
        const v = rnd(P.firebomb.mult * scaled(B, 'fire', 1, 'plain'));
        ev.push({ type: 'effect', color: 'fire', kind: 'dmg', value: v, source: 'firebomb' });
        hitEnemy(B, v, 'firebomb', ev);
        break;
      }
      case 'combo': B.comboElixir = true; ev.push(e); break;
      default: ev.push(e);
    }
    // The undo snapshot predates this potion; restoring it would silently revert the potion's effect.
    B.history = null;
    if (alive(B)) settleClosed(B, ev);
  }

  function act(B, a) {
    const ev = [];
    if (!canAct(B, a)) return ev;
    if (a.type === 'pour') doPour(B, a, ev);
    else if (a.type === 'drain') doDrain(B, a, ev);
    else doPotion(B, a, ev);
    return afterAction(B, ev);
  }

  // Used after a revive: finish any close the death interrupted and refresh dead-end state.
  function settle(B) {
    const ev = [];
    settleClosed(B, ev);
    // The move that killed the player never passed its turn; a revive must not make it free.
    const owed = B.owedMove;
    B.owedMove = null;
    if (owed && alive(B)) { if (owed.drain) passTurn(B, ev); else endMove(B, owed.free, ev); }
    return afterAction(B, ev);
  }

  function preview(B) {
    const e = B.enemy;
    return {
      intent: e.intent, timer: e.timer, frozen: e.frozen, rage: e.rage,
      rageSoon: !!(e.boss && e.final && !e.rage),
      rageAt: e.boss && e.final ? Math.floor(e.maxHp * D().economy.boss.rageAt) : null,
      buff: e.buff,
    };
  }

  function create(rc, es) {
    const E = D().economy;
    const rng = Rg().make(rc.seed);
    const field = Fd().create(rng, {
      deck: Object.keys(rc.deck), slots: rc.slots || [], cap: E.cap, filledMin: E.filledMin, junkPct: rc.junkPct || 0,
    });
    const B = {
      rng, field, turn: 0, combo: 0, comboGrace: 0, comboElixir: false, lastColor: null, freePours: 0,
      player: { hp: rc.hp, maxHp: rc.maxHp, shield: 0 },
      enemy: {
        id: es.id, boss: !!es.boss, name: es.name || es.id, hp: es.hp, maxHp: es.maxHp || es.hp, shield: 0,
        cycle: es.cycle.map(c => ({ t: c.t, v: c.v, turns: c.turns })), ci: 0, intent: null, timer: 0,
        frozen: 0, poison: [], buff: 1, heals: 0, rage: false, first: true, final: es.final !== false, patched: !!es.patched,
      },
      mods: U().clone(rc.mods || {}), relics: (rc.relics || []).slice(), deck: U().clone(rc.deck), labFlat: U().clone(rc.labFlat || {}),
      masteryPct: rc.masteryPct || 0, firstStrike: rc.firstStrike || 1, filter: !!rc.filter,
      slotsKinds: (rc.slots || []).slice(), potions: (rc.potions || []).slice(),
      burn: [], twist: rc.twist ? U().clone(rc.twist) : null, stuck: false, history: null, status: 'active',
      stats: { closes: {}, maxCombo: 0, potionsUsed: 0, junkCloses: 0, dmgDealt: 0 },
    };
    if (!B.enemy.boss) B.enemy.final = false;
    const ev = [];
    if (B.twist && B.twist.type === 'frozenStart') {
      const j = Fd().freezeRandom(field, rng, B.twist.turns);
      ev.push({ type: 'twist', twist: 'frozenStart', target: j, turns: B.twist.turns, tubes: tubesOf(field) });
    }
    const shield = (rc.startShield || 0) + stacks(B, 'bubble') * D().mods.bubble.shield;
    if (shield > 0) { B.player.shield = shield; ev.push({ type: 'shield', v: shield, source: 'start' }); }
    const prep = stacks(B, 'prep');
    if (prep) hitEnemy(B, prep * D().mods.prep.dmg, 'prep', ev);
    if (alive(B)) setIntent(B, ev);
    afterAction(B, ev);
    return { B, events: ev };
  }

  PS.Combat = { create, act, canAct, preview, effectValue, settle, kOf };
})();
