// Balance bot: plays islands with a lookahead policy and simulates an Earn-to-Die style campaign.
//   node bot/sim.js --campaigns 30 --seed 1 [--revive] [--ads]
//   node bot/sim.js --island 4 --attempts 40 --lab "vitality:3,essence_fire:2" [--seed 1]
const PS = require('./load.js')();
const { Run, Combat: Cb, Field: Fd, Meta, DATA: D, Rng } = PS;

// ---------- CLI ----------
const argv = process.argv.slice(2);
const opt = { campaigns: 30, seed: 1, revive: false, ads: false, island: 0, attempts: 8, lab: '', maxTurns: 600, cap: 8, verbose: false, jobs: 12, worker: "" };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--revive') opt.revive = true;
  else if (a === '--ads') opt.ads = true;
  else if (a === '--verbose') opt.verbose = true;
  else if (a.startsWith('--')) { const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); const v = argv[++i]; opt[k] = isNaN(+v) ? v : +v; }
}
if (opt.island && !argv.includes('--attempts')) opt.attempts = 30;

// ---------- anomalies ----------
const anomalies = { exception: [], stuck: [], nan: [], guard: [] };
const note = (kind, msg) => { anomalies[kind].push(msg); };

// ---------- battle helpers ----------
const clone = B => { const h = B.history; B.history = null; const c = JSON.parse(JSON.stringify(B)); B.history = h; return c; };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const isJunk = c => c === 'stone' || c === 'slime';

function incoming(B) {
  const e = B.enemy, it = e.intent;
  if (!it || it.t !== 'atk') return 0;
  return Math.round(it.v * e.buff * (1 - 0.1 * (B.mods.apron || 0)));
}

function mobility(F) {
  let m = 0;
  for (let a = 0; a < F.tubes.length; a++) for (let b = 0; b < F.tubes.length; b++) if (Fd.pourAmount(F, a, b)) m++;
  return m;
}

const POTION_VALUE = { undo: 0, heal: 5, sleep: 5, firebomb: 5, flask: 3, solvent: 3, shake: 2, combo: 3 };

function fieldScore(B) {
  const F = B.field;
  let s = 0, empties = 0;
  for (let ti = 0; ti < F.tubes.length; ti++) {
    const t = F.tubes[ti];
    if (t.kind === 'vial') continue;
    const n = t.layers.length;
    if (!n) { empties++; continue; }
    let runs = 1, bottom = 1;
    for (let i = 1; i < n; i++) if (t.layers[i] !== t.layers[i - 1]) runs++;
    while (bottom < n && t.layers[bottom] === t.layers[0]) bottom++;
    if (runs === 1) s += n * n * 0.7; else s += bottom * 0.8 - (runs - 1) * 2;
    let stones = 0;
    for (const c of t.layers) if (c === 'stone') stones++; else if (c === 'slime') s -= 1;
    if (stones) {
      // A neighbour that is about to close will shatter these stones.
      const near = Fd.neighbors(F, ti).some(j => { const u = F.tubes[j]; return u.layers.length >= 2 && u.layers.every(x => x === u.layers[0]) && u.layers[0] !== 'stone'; });
      s -= stones * (near ? 1 : 2.5);
    }
    if (t.frozen) s -= 1;
  }
  s += Math.min(empties, 2) * 3;
  const m = mobility(F);
  if (m === 0) s -= 12; else if (m === 1) s -= 3;
  return s;
}

function closesOf(B) { let n = 0; for (const k in B.stats.closes) n += B.stats.closes[k]; return n; }

function value(B) {
  if (B.status === 'lost') return -1e6;
  if (B.status === 'won' || B.status === 'fled') return 1e6;
  const e = B.enemy, p = B.player;
  let poison = 0;
  for (const x of e.poison) poison += x.tick * x.turns;
  const inc = incoming(B);
  const t = e.timer + e.frozen;
  const imminent = t <= 1 ? 1 : t === 2 ? 0.7 : t === 3 ? 0.45 : 0.25;
  const useful = Math.min(p.shield, inc);
  let v = -(Math.max(0, e.hp - poison) + 0.6 * e.shield) * 1.2;
  v += p.hp * 0.9 + (p.hp < p.maxHp * 0.4 ? p.hp * 0.6 : 0);
  v += useful * imminent * 1.1 + (p.shield - useful) * 0.15;
  if (inc > 0) v += Math.min(t, 5) * inc * 0.15;
  if (e.frozen) v += e.frozen * (inc > 0 ? inc * 0.2 : 1.5);
  v += Math.min(B.combo, 3) * 1.5;
  v += closesOf(B) * 7;
  v += fieldScore(B);
  for (const id of B.potions) v += POTION_VALUE[id] || 1;
  return v;
}

function legalPours(B) {
  const T = B.field.tubes.length, out = [];
  for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) if (Cb.canAct(B, { type: 'pour', from: a, to: b })) out.push({ type: 'pour', from: a, to: b });
  return out;
}

function simulate(B, a, br) {
  const c = clone(B);
  c.rng.s = Math.floor(Rng.next(br) * 4294967296) >>> 0; // hide the future refill from the lookahead
  Cb.act(c, a);
  return c;
}

function candidates(B) {
  const F = B.field, T = F.tubes.length;
  const pours = legalPours(B);
  const acts = pours.slice();
  const m = pours.length;
  if (m <= (opt.drainM === undefined ? 0 : opt.drainM)) for (let t = 0; t < T; t++) if (Cb.canAct(B, { type: 'drain', tube: t })) acts.push({ type: 'drain', tube: t });
  B.potions.forEach((id, idx) => {
    if (id === 'flask' && m <= 3) acts.push({ type: 'potion', idx });
    else if (id === 'combo' && pours.some(a => closes(B, a))) acts.push({ type: 'potion', idx });
    else if (id === 'solvent' && m <= 3) { for (let t = 0; t < T; t++) if (Cb.canAct(B, { type: 'potion', idx, tube: t })) acts.push({ type: 'potion', idx, tube: t }); }
    else if (id === 'shake' && m <= 2) { for (let t = 0; t < T; t++) if (Cb.canAct(B, { type: 'potion', idx, tube: t })) acts.push({ type: 'potion', idx, tube: t }); }
  });
  return acts;
}

function closes(B, a) {
  if (a.type !== 'pour') return false;
  const F = B.field, src = F.tubes[a.from], dst = F.tubes[a.to], c = src.layers[src.layers.length - 1];
  return dst.kind !== 'vial' && dst.layers.length + Fd.pourAmount(F, a.from, a.to) === dst.cap && dst.layers.every(x => x === c);
}

const keyOf = B => B.field.tubes.map(t => t.layers.join(',')).join('|');

function bestFollow(B, br) {
  let best = -Infinity;
  const pours = legalPours(B);
  if (!pours.length) {
    const T = B.field.tubes.length;
    for (let t = 0; t < T; t++) if (Cb.canAct(B, { type: 'drain', tube: t })) pours.push({ type: 'drain', tube: t });
  }
  for (const a of pours) { const v = value(simulate(B, a, br)); if (v > best) best = v; }
  return best === -Infinity ? value(B) : best;
}

function ruleAction(B) {
  const e = B.enemy, p = B.player, inc = incoming(B);
  const idx = id => B.potions.indexOf(id);
  let i = idx('firebomb');
  if (i >= 0) {
    const dmg = 3 * Cb.effectValue(B, 'fire', 1, 'plain');
    if (dmg >= e.shield + e.hp || (B.potions.length >= 3 && dmg >= 0.5 * e.hp)) return { type: 'potion', idx: i };
  }
  i = idx('heal');
  if (i >= 0 && p.maxHp - p.hp >= 0.2 * p.maxHp && (p.hp <= p.maxHp * 0.4 || (inc > 0 && p.hp <= inc * 1.3 && p.hp < p.maxHp * 0.7))) return { type: 'potion', idx: i };
  i = idx('sleep');
  if (i >= 0 && e.timer === 1 && !e.frozen && inc > 0 && (inc >= p.hp * 0.4 || inc >= p.maxHp * 0.3)) return { type: 'potion', idx: i };
  return null;
}

function chooseBattleAction(B, br, recent, last) {
  const r = ruleAction(B);
  if (r && Cb.canAct(B, r)) return r;
  const acts = candidates(B);
  if (!acts.length) return null;
  const scored = acts.map(a => {
    const c = simulate(B, a, br);
    let v = value(c);
    if (a.type === 'pour' && recent.includes(keyOf(c)) && closesOf(c) === closesOf(B)) v -= 15;
    if (last && a.type === 'pour' && last.type === 'pour' && a.from === last.to && a.to === last.from) v -= 25;
    return { a, v, c };
  });
  scored.sort((x, y) => y.v - x.v);
  let best = scored[0];
  if (scored.length > 1 && best.v < 9e5) {
    let bv = -Infinity;
    for (const s of scored.slice(0, 3)) {
      if (s.v > 9e5) { best = s; bv = Infinity; break; }
      if (s.c.status !== 'active') continue;
      const v = 0.4 * s.v + 0.6 * bestFollow(s.c, br);
      if (v > bv) { bv = v; best = s; }
    }
  }
  return best.a;
}

// ---------- pick policy ----------
const MOD_V = { tough: 7, apron: 6, caustic: 6, bubble: 5, prep: 4, thorns: 4, leech: 3, combo_master: 4, potion_pick: 5 };
const COLOR_V = { fire: 10, water: 7, life: 6, poison: 6, lightning: 6, ice: 4, dark: 5, mirror: 3 };
const TUBE_V = { amp: 7, catalyst: 6, sieve: 4, bomb: 4, big: 5, vial: 1, plain: 0 };
const RELIC_V = { hot_crucible: 7, hourglass: 5, lucky_clover: 6, golden_stopper: 4, alchemist_heart: 4, stone_heart: 5, sponge: 4, blood_retort: 8,
  storm_rod: 7, trap: 6, mirror_shield: 7, crystal_ward: 6, frost_crown: 7, poison_ivy: 7, void_lens: 7, bandolier: 6, cascade_chute: 4,
  patient_mage: 5, philosopher_stone: 9, great_cauldron: 6, phoenix_feather: 8 };
const POTION_PICK_V = { heal: 6, undo: 2, sleep: 6, firebomb: 6, flask: 5, solvent: 4, shake: 3, combo: 5 };

function scoreOption(R, o) {
  switch (o.type) {
    case 'mod': {
      let v = MOD_V[o.id] || 3;
      if (o.id === 'caustic' && !['fire', 'lightning', 'dark'].some(c => c in R.deck)) v = 1;
      return v - 1.2 * (R.mods[o.id] || 0);
    }
    case 'find':
      if (o.id === 'boost_color') return (COLOR_V[o.color] || 3) * 0.8 - 1.5 * (R.deck[o.color] || 0) + 2;
      if (o.id === 'new_color') return (COLOR_V[o.color] || 3) * (opt.newColor || 0.6) - (Object.keys(R.deck).length >= 5 ? 3 : 0);
      if (o.id === 'special_tube') return (TUBE_V[o.tube] || 2) - (R.slots.indexOf('plain') < 0 ? 2 : 0);
      if (o.id === 'extra_slot') return 7;
      if (o.id === 'filter') return 4;
      return 2;
    case 'relic': return (RELIC_V[o.id] || 4) + 1;
    case 'potion': return POTION_PICK_V[o.id] || 3;
    case 'coins': return 2.5;
  }
  return 0;
}

function pickReward(R, evs) {
  const off = R.offer, opts = off.options;
  if (off.kind === 'replace_color') {
    let bi = 0, bv = Infinity;
    opts.forEach((o, i) => { const v = (COLOR_V[o.id] || 3) + 2 * (R.deck[o.id] || 0); if (v < bv) { bv = v; bi = i; } });
    return Run.choose(R, bi);
  }
  if (off.kind === 'replace_tube') {
    let bi = 0, bv = Infinity;
    opts.forEach((o, i) => { const v = TUBE_V[o.id] || 0; if (v < bv) { bv = v; bi = i; } });
    return Run.choose(R, bi);
  }
  if (off.kind === 'potion_pick') {
    let bi = 0, bv = -1;
    opts.forEach((o, i) => { const v = POTION_PICK_V[o.id] || 3; if (v > bv) { bv = v; bi = i; } });
    return Run.choose(R, bi);
  }
  let bi = -1, bv = -Infinity;
  opts.forEach((o, i) => { const v = scoreOption(R, o); if (v > bv) { bv = v; bi = i; } });
  if (bi < 0 || bv < 2) return Run.skip(R);
  return Run.choose(R, bi);
}

// ---------- one island attempt ----------
function playAttempt(island, ctx, br, agg) {
  const { R, events } = Run.create(ctx, island, []);
  const res = { R, turns: 0, actions: 0, stuck: false, deathEnemy: null, deathStage: 0, hpLostPerStage: [] };
  let all = events, recent = [], lastBattleKey = '', guard = 0, lastAct = null;
  const tally = evs => {
    for (const e of evs) {
      if (e.type === 'enemy_hit' && e.dmg > 0) agg.dmg[e.source] = (agg.dmg[e.source] || 0) + e.dmg;
      else if (e.type === 'chosen') {
        const o = e.option, k = e.kind + ':' + o.type + ':' + o.id + (o.color ? '/' + o.color : '') + (o.tube ? '/' + o.tube : '');
        if (e.kind === 'pick' || e.kind === 'relic') agg.picks[k] = (agg.picks[k] || 0) + 1;
      } else if (e.type === 'skipped') agg.picks['skip'] = (agg.picks['skip'] || 0) + 1;
      else if (e.type === 'drain' && !e.free) agg.drains++;
      else if (e.type === 'potion') agg.potions[e.id] = (agg.potions[e.id] || 0) + 1;
    }
  };
  tally(all);
  while (R.phase !== 'won' && R.phase !== 'lost') {
    if (++guard > 200000) { note('guard', `island ${island} seed ${ctx.seed}: run loop guard`); Run.giveUp(R); break; }
    let ev = [];
    if (R.phase === 'battle') {
      const B = R.battle, bk = R.stage + ':' + B.enemy.id;
      if (bk !== lastBattleKey) { lastBattleKey = bk; recent = []; res.battleStartHp = B.player.hp; }
      if (B.turn > opt.maxTurns || ++res.actions > 20000) {
        note('stuck', `island ${island} seed ${ctx.seed}: stage ${R.stage + 1} ${B.enemy.id} turn ${B.turn} enemyHp ${B.enemy.hp} shield ${B.enemy.shield} hp ${B.player.hp}`);
        res.stuck = true; Run.giveUp(R); break;
      }
      const a = chooseBattleAction(B, br, recent, lastAct);
      lastAct = a;
      if (!a) { note('guard', `island ${island} seed ${ctx.seed}: no legal action at stage ${R.stage + 1}`); Run.giveUp(R); break; }
      if (opt.trace && R.stage + 1 === opt.trace) console.error(`t${B.turn} hp${B.player.hp}/${B.player.maxHp} sh${B.player.shield} | ${B.enemy.id} hp${B.enemy.hp} sh${B.enemy.shield} ${B.enemy.intent.t}${B.enemy.intent.v}@${B.enemy.timer} cmb${B.combo} | ${JSON.stringify(a)} | ${B.field.tubes.map(t => t.layers.map(x => x[0]).join("")).join(" ")}`);
      ev = Run.act(R, a);
      if (!ev.length) { note('guard', `island ${island} seed ${ctx.seed}: action rejected ${JSON.stringify(a)}`); Run.giveUp(R); break; }
      const nb = R.battle;
      recent.push(keyOf(nb)); if (recent.length > 10) recent.shift();
      for (const v of [nb.player.hp, nb.player.shield, nb.enemy.hp, nb.enemy.shield, nb.turn, nb.combo, R.coins]) {
        if (!finite(v)) { note('nan', `island ${island} seed ${ctx.seed}: non-finite value after ${JSON.stringify(a)}`); Run.giveUp(R); break; }
      }
    } else if (R.phase === 'reward') ev = pickReward(R);
    else if (R.phase === 'revive') {
      if (res.deathStage === 0) { res.deathStage = R.stage + 1; res.deathEnemy = R.stages[R.stage].enemy; res.deathBoss = R.stages[R.stage].type === 'boss'; }
      ev = opt.revive && Run.reviveOptions(R).free ? Run.revive(R, 'free') : Run.giveUp(R);
    }
    tally(ev);
  }
  if (R.phase === 'lost' && res.deathStage === 0) { res.deathStage = R.stage + 1; res.deathEnemy = R.stages[R.stage].enemy; res.deathBoss = R.stages[R.stage].type === 'boss'; }
  res.turns = R.stats.turns;
  agg.closes += Object.values(R.stats.closes).reduce((a, b) => a + b, 0); agg.turns += R.stats.turns; agg.combo[R.stats.maxCombo] = (agg.combo[R.stats.maxCombo] || 0) + 1;
  return res;
}

// ---------- lab spending ----------
const LAB_W = { vitality: 1.2, essence_fire: 1.3, essence_water: 0.8, essence_life: 0.7, start_shield: 0.7, belt: 0.6, intuition: 0.5, second_wind: 0.7, mastery: 1.4, slot: 1.5, thrift: 1.0 };
function spendLab() {
  for (;;) {
    let best = null;
    for (const id of Object.keys(D.lab)) {
      if (Meta.labLockReason(id)) continue;
      const cost = Meta.labCost(id), eff = cost / (LAB_W[id] || 0.5);
      if (!best || eff < best.eff) best = { id, cost, eff };
    }
    if (!best || Meta.profile.coins < best.cost) return;
    Meta.buyLab(best.id, 0);
  }
}

// ---------- aggregation ----------
const newIsland = () => ({ campaigns: 0, attempts: 0, firstTry: 0, within3: 0, cleared: 0, forced: 0, att2clear: [], failStage: [], failCoins: [], winCoins: [], failTurns: [], winTurns: [], deaths: {}, ms: 0, stageN: 0 });
const newAgg = () => ({ dmg: {}, picks: {}, potions: {}, drains: 0, closes: 0, turns: 0, combo: {} });
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '-';
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);

function recordAttempt(S, island, res, coinsGot) {
  const R = res.R, won = R.phase === 'won';
  S.attempts++;
  if (won) { S.winCoins.push(coinsGot); S.winTurns.push(res.turns); }
  else {
    S.failStage.push(res.deathStage || R.stage + 1); S.failCoins.push(R.coins); S.failTurns.push(res.turns);
    const k = (res.deathBoss ? 'boss:' : '') + res.deathEnemy + '@' + res.deathStage;
    S.deaths[k] = (S.deaths[k] || 0) + 1;
  }
}

// ---------- campaign mode ----------
function runRange(from, to) {
  const islands = D.islands.length;
  const S = Array.from({ length: islands + 1 }, newIsland), agg = newAgg();
  const totals = [], blockedAt = [];
  for (let c = from; c < to; c++) {
    const master = Rng.make(opt.seed * 1000003 + c * 7919 + 1), br = Rng.make(opt.seed * 31 + c + 5);
    Meta.reset(0);
    let earned = 0, blocked = 0;
    for (let n = 1; n <= islands; n++) {
      const St = S[n];
      St.campaigns++;
      let cleared = false, tries = 0;
      while (!cleared && tries < opt.cap) {
        tries++;
        const ctx = Meta.ctx(0);
        ctx.seed = Math.floor(Rng.next(master) * 4294967296) >>> 0 || 1;
        const ts = Date.now();
        let res;
        try { res = playAttempt(n, ctx, br, agg); } catch (err) { note('exception', `island ${n} seed ${ctx.seed}: ${err.stack.split('\n').slice(0, 3).join(' | ')}`); res = null; }
        St.ms += Date.now() - ts;
        if (opt.verbose) console.error(`c${c} isl ${n} try ${tries} ${res ? res.R.phase : "EXC"} stage ${res ? res.deathStage : 0} ${Date.now() - ts}ms turns ${res ? res.turns : 0} coins ${Meta.profile.coins}`);
        if (!res) { Meta.reset(0); continue; }
        const fin = Meta.finishRun(res.R, 0);
        let coins = fin.coins;
        if (opt.ads && Rng.chance(master, 0.5)) { Meta.addCoins(coins); coins *= 2; }
        earned += coins;
        recordAttempt(St, n, res, coins);
        cleared = res.R.phase === 'won';
        if (cleared) {
          St.cleared++; St.att2clear.push(tries);
          if (tries === 1) St.firstTry++;
          if (tries <= 3) St.within3++;
        }
        spendLab();
      }
      if (!cleared) {
        // Keep sampling later islands with an under-powered profile; counted separately.
        St.forced++; blocked++;
        const p = Meta.profile;
        p.cleared[n] = true; p.maxIsland = Math.min(n + 1, islands);
        if (!blockedAt.length || blockedAt[blockedAt.length - 1].c !== c) blockedAt.push({ c, n });
      }
    }
    totals.push(earned);
  }
  return { S, agg, totals, blocked: [...new Set(blockedAt.map(b => b.c))].length, anomalies };
}

function mergeInto(a, b) {
  for (const k of Object.keys(b)) {
    if (Array.isArray(b[k])) a[k] = (a[k] || []).concat(b[k]);
    else if (b[k] && typeof b[k] === "object") a[k] = mergeInto(a[k] || {}, b[k]);
    else a[k] = (a[k] || 0) + b[k];
  }
  return a;
}

function runCampaigns() {
  const { spawn } = require("child_process");
  const t0 = Date.now(), jobs = Math.min(opt.jobs, opt.campaigns), parts = [];
  let pending = jobs;
  const finish = () => {
    const S = parts[0].S.map(() => newIsland()), agg = newAgg(), totals = [];
    let blocked = 0;
    for (const p of parts) {
      p.S.forEach((x, i) => mergeInto(S[i], x)); mergeInto(agg, p.agg); totals.push(...p.totals); blocked += p.blocked;
      for (const k of Object.keys(anomalies)) anomalies[k].push(...p.anomalies[k]);
    }
    report(S, agg, totals, blocked, Date.now() - t0);
  };
  for (let j = 0; j < jobs; j++) {
    const from = Math.floor(opt.campaigns * j / jobs), to = Math.floor(opt.campaigns * (j + 1) / jobs);
    const child = spawn(process.execPath, [__filename, ...argv, "--worker", from + ":" + to], { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", d => { out += d; });
    child.on("close", () => { parts[j] = JSON.parse(out); if (--pending === 0) finish(); });
  }
}

function report(S, agg, totals, blocked, ms) {
  printTable(S, opt.campaigns, true);
  console.log(`\nCampaign coins earned (all attempts, incl. first-clear bonus): mean ${f1(mean(totals))}, median ${f1(median(totals))}, min ${Math.min(...totals)}, max ${Math.max(...totals)}`);
  console.log(`Campaigns with at least one blocked island (cap ${opt.cap} attempts): ${blocked}/${opt.campaigns}`);
  printAgg(agg);
  console.log(`\nTotal time ${(ms / 1000).toFixed(1)}s, attempts ${S.reduce((s, x) => s + x.attempts, 0)}`);
  printAnomalies();
}

function printTable(S, campaigns, campaign) {
  console.log(`\nisl tier   reach  1st   <=3   att(mean/med)  failStage  coin/fail  coin/clear  avgTurns(w/f)  ms/att  blocked`);
  for (let n = 1; n < S.length; n++) {
    const s = S[n];
    if (!s.attempts) continue;
    const isl = D.islands[n - 1];
    const sf = s.failStage.length ? f1(mean(s.failStage)) + '/' + isl.stages : '-';
    console.log([
      String(n).padEnd(3), isl.tier.padEnd(6), String(s.campaigns).padEnd(6), pct(s.firstTry, s.campaigns).padEnd(5), pct(s.within3, s.campaigns).padEnd(5),
      (f1(mean(s.att2clear)) + '/' + f1(median(s.att2clear))).padEnd(14), sf.padEnd(10), f1(mean(s.failCoins)).padEnd(10), f1(mean(s.winCoins)).padEnd(11),
      (Math.round(mean(s.winTurns)) + '/' + Math.round(mean(s.failTurns))).padEnd(14), String(Math.round(s.ms / s.attempts)).padEnd(7), s.forced,
    ].join(' '));
  }
  console.log('\nDeaths by enemy@stage:');
  for (let n = 1; n < S.length; n++) {
    const s = S[n], ks = Object.keys(s.deaths).sort((a, b) => s.deaths[b] - s.deaths[a]).slice(0, 5);
    if (ks.length) console.log(`  isl ${n}: ` + ks.map(k => `${k} x${s.deaths[k]}`).join(', '));
  }
}

function printAgg(agg) {
  const tot = Object.values(agg.dmg).reduce((s, x) => s + x, 0) || 1;
  console.log('\nDamage share by source: ' + Object.keys(agg.dmg).sort((a, b) => agg.dmg[b] - agg.dmg[a]).map(k => `${k} ${(100 * agg.dmg[k] / tot).toFixed(0)}%`).join(', '));
  const pk = Object.keys(agg.picks).sort((a, b) => agg.picks[b] - agg.picks[a]).slice(0, 14);
  console.log('Most picked: ' + pk.map(k => `${k} ${agg.picks[k]}`).join(', '));
  console.log(`Closes per turn ${(agg.closes / (agg.turns || 1)).toFixed(2)}; best combo per attempt: ` + Object.keys(agg.combo).map(k => `x${k}:${agg.combo[k]}`).join(' '));
  console.log('Potions used: ' + Object.keys(agg.potions).map(k => `${k} ${agg.potions[k]}`).join(', ') + `; paid drains ${agg.drains}`);
}

function printAnomalies() {
  const kinds = Object.keys(anomalies);
  const total = kinds.reduce((s, k) => s + anomalies[k].length, 0);
  console.log(`\nAnomalies: ${total}` + (total ? '' : ' (none)'));
  for (const k of kinds) if (anomalies[k].length) console.log(`  ${k}: ${anomalies[k].length}; e.g. ${anomalies[k].slice(0, 3).join(' || ')}`);
}

// ---------- single island mode ----------
function runIsland() {
  const n = opt.island, S = [null, ...D.islands.map(newIsland)], agg = newAgg();
  const lab = {};
  String(opt.lab || '').split(',').filter(Boolean).forEach(kv => { const [k, v] = kv.split(':'); lab[k] = +v; });
  const master = Rng.make(opt.seed * 1000003 + n), br = Rng.make(opt.seed * 31 + 5);
  const St = S[n], t0 = Date.now();
  St.campaigns = opt.attempts;
  const hist = [];
  for (let i = 0; i < opt.attempts; i++) {
    Meta.reset(0);
    Meta.profile.maxIsland = n; Meta.profile.lab = lab;
    const ctx = Meta.ctx(0);
    ctx.seed = Math.floor(Rng.next(master) * 4294967296) >>> 0 || 1;
    const ts = Date.now();
    let res;
    try { res = playAttempt(n, ctx, br, agg); } catch (err) { note('exception', `island ${n} seed ${ctx.seed}: ${err.stack.split('\n').slice(0, 3).join(' | ')}`); continue; }
    St.ms += Date.now() - ts;
    recordAttempt(St, n, res, res.R.coins);
    if (res.R.phase === 'won') { St.cleared++; hist.push('W'); } else hist.push('x' + res.deathStage);
  }
  console.log(`Island ${n} (${D.islands[n - 1].tier}), lab ${JSON.stringify(lab)}, ${opt.attempts} attempts: win rate ${pct(St.cleared, opt.attempts)}`);
  St.firstTry = St.cleared; St.within3 = St.cleared; St.att2clear = St.cleared ? [1] : [];
  printTable(S, opt.attempts, false);
  printAgg(agg);
  console.log(`\nTotal time ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  printAnomalies();
}

if (opt.worker) { const [a, b] = String(opt.worker).split(":").map(Number); process.stdout.write(JSON.stringify(runRange(a, b))); }
else if (opt.island) runIsland();
else runCampaigns();
