var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const U = PS.U;
  const D = () => PS.DATA;
  const KEY = 'ps.v2.profile';
  const DAY = 86400000, HOUR = 3600000;
  // Window in which a fresh rewarded view or purchase suppresses an interstitial.
  const AFTER_REWARD_MS = 60000;

  const memory = {};
  function defaultStorage() {
    return {
      get(k) {
        try { if (globalThis.localStorage) return globalThis.localStorage.getItem(k); } catch (e) { /* fall through to memory */ }
        return k in memory ? memory[k] : null;
      },
      set(k, v) {
        try { if (globalThis.localStorage) { globalThis.localStorage.setItem(k, v); return; } } catch (e) { /* fall through to memory */ }
        memory[k] = v;
      },
    };
  }

  function defaults(now) {
    return {
      v: 2, coins: 0, gems: D().economy.gems.start, lab: {}, maxIsland: 1, cleared: {}, best: {}, seen: {},
      daily: { day: 0, last: null, got: {} }, quests: { date: null, list: [], bonusClaimed: false },
      adGift: { date: null, used: 0 }, seal: { until: 0 }, noAds: false, starter: { offeredAt: 0, bought: false },
      lastInterstitial: 0, lastRewardedOrPurchase: 0, sessions: 0,
      settings: { sound: true, music: true, vibro: true }, tutorial: {}, activeRun: null,
      stats: { runs: 0, wins: 0, createdAt: now || 0 },
    };
  }

  function fill(target, def) {
    for (const k of Object.keys(def)) {
      if (target[k] === undefined) target[k] = U.clone(def[k]);
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && target[k] && typeof target[k] === 'object') fill(target[k], def[k]);
    }
    return target;
  }

  // Version hook: add a step per future schema bump.
  function migrate(p, now) {
    if (!p || typeof p !== 'object') return defaults(now);
    p.v = 2;
    // Runs saved before the returning-boss rework had a shared HP pool and no boss.maxHp; the next encounter would get NaN HP.
    const R = p.activeRun;
    if (R && R.boss && R.boss.maxHp == null && D().bosses[R.boss.id] && islandOf(R.island)) {
      R.boss.maxHp = U.round(D().bosses[R.boss.id].hp * islandOf(R.island).M);
    }
    return fill(p, defaults(now));
  }

  const Meta = { storage: defaultStorage(), profile: null };
  const P_ = () => Meta.profile;
  const islandOf = n => D().islands[n - 1];

  Meta.load = function (now) {
    let p = null;
    try { const raw = Meta.storage.get(KEY); if (raw) p = JSON.parse(raw); } catch (e) { p = null; }
    p = migrate(p, now);
    p.sessions += 1;
    Meta.profile = p;
    Meta.save();
    return p;
  };
  Meta.save = function () {
    try { Meta.storage.set(KEY, JSON.stringify(Meta.profile)); } catch (e) { /* storage full or blocked */ }
  };
  Meta.reset = function (now) {
    Meta.profile = defaults(now);
    Meta.profile.sessions = 1;
    Meta.save();
    return Meta.profile;
  };

  Meta.P = () => islandOf(P_().maxIsland).P;

  Meta.ctx = function (now) {
    const p = P_();
    return { maxIsland: p.maxIsland, lab: U.clone(p.lab), sealActive: Meta.sealActive(now), seed: (now >>> 0) || 1 };
  };

  Meta.addCoins = n => { P_().coins += n; Meta.save(); };
  Meta.addGems = n => { P_().gems += n; Meta.save(); };
  Meta.spendGems = function (n) {
    if (P_().gems < n) return false;
    P_().gems -= n; Meta.save(); return true;
  };

  // Lab
  Meta.labOpen = () => P_().stats.runs > 0;
  Meta.labTier = id => P_().lab[id] || 0;
  Meta.labCost = function (id) {
    const def = D().lab[id], t = Meta.labTier(id);
    return def && t < def.tiers ? def.costs[t] : null;
  };
  Meta.labLockReason = function (id) {
    const def = D().lab[id], p = P_();
    if (!def) return 'unknown';
    if (def.unlock > p.maxIsland) return 'island';
    if (!Meta.labOpen()) return 'first';
    if (p.activeRun) return 'run';
    if (Meta.labTier(id) >= def.tiers) return 'max';
    return null;
  };
  Meta.canBuyLab = function (id) {
    const cost = Meta.labCost(id);
    return cost !== null && !Meta.labLockReason(id) && P_().coins >= cost;
  };
  Meta.buyLab = function (id, now) {
    if (!Meta.canBuyLab(id)) return false;
    const cost = Meta.labCost(id);
    P_().coins -= cost;
    P_().lab[id] = Meta.labTier(id) + 1;
    Meta.track('lab_spend', { coins: cost }, now || 0);
    Meta.save();
    return true;
  };

  // Unlocks
  Meta.unlockedAt = n => D().unlocks[n] || null;
  Meta.newUnlocks = function (n) {
    const u = Meta.unlockedAt(n), out = [];
    if (!u) return out;
    for (const kind of Object.keys(u)) {
      if (kind === 'note') continue;
      const v = u[kind];
      if (Array.isArray(v)) v.forEach(id => out.push({ kind, id, key: kind + ':' + id }));
      else if (typeof v === 'string') out.push({ kind, id: v, key: kind + ':' + v });
    }
    return out;
  };
  function unlockedKeys() {
    const keys = {};
    for (let n = 1; n <= P_().maxIsland; n++) Meta.newUnlocks(n).forEach(it => { keys[it.key] = true; });
    return keys;
  }
  Meta.markSeen = function (key) { P_().seen[key] = true; Meta.save(); };
  Meta.isNew = key => !!unlockedKeys()[key] && !P_().seen[key];
  Meta.newCount = function (kind) {
    const seen = P_().seen, keys = unlockedKeys();
    return Object.keys(keys).filter(k => (!kind || k.indexOf(kind + ':') === 0) && !seen[k]).length;
  };

  Meta.finishRun = function (R, now) {
    const p = P_(), E = D().economy, n = R.island, isl = islandOf(n);
    const hard = isl.tier === 'hard';
    const res = { coins: R.coins || 0, gems: 0, firstClear: false, unlocked: [], newBest: false };
    p.stats.runs += 1;

    const stage = Math.max(R.best || 0, R.phase === 'won' ? R.stages.length : (R.stage || 0) + 1);
    const prev = p.best[n] || 0;
    // A first attempt always sets a best; only beating an earlier one counts as a record.
    if (stage > prev) { p.best[n] = stage; res.newBest = prev > 0; }

    if (R.phase === 'won') {
      p.stats.wins += 1;
      if (!p.cleared[n]) {
        res.firstClear = true;
        p.cleared[n] = true;
        res.coins += U.round(E.coins.first * n * (hard ? E.coins.hardMult : 1));
        res.gems += hard ? E.gems.firstHard : E.gems.first;
        const next = Math.min(n + 1, D().islands.length);
        if (next > p.maxIsland) {
          p.maxIsland = next;
          res.unlocked = Meta.newUnlocks(next);
        }
        if (n === 2 && !p.starter.offeredAt) p.starter.offeredAt = now;
      }
    }
    p.coins += res.coins;
    p.gems += res.gems;
    p.activeRun = null;
    Meta.save();
    return res;
  };

  // Daily reward
  Meta.daily = function (now) {
    const p = P_(), r = D().daily[p.daily.day];
    return {
      day: p.daily.day,
      canClaim: p.daily.last !== U.dayKey(now),
      reward: r.coins ? { coins: Math.round(r.coins * Meta.P()) } : { gems: r.gems },
      autoDouble: Meta.sealActive(now),
    };
  };
  Meta.claimDaily = function (now, double) {
    const p = P_(), d = Meta.daily(now);
    if (!d.canClaim) return null;
    const k = (double || d.autoDouble) ? 2 : 1, out = {};
    if (d.reward.coins) { out.coins = d.reward.coins * k; p.coins += out.coins; }
    if (d.reward.gems) { out.gems = d.reward.gems * k; p.gems += out.gems; }
    if (double && !d.autoDouble) p.lastRewardedOrPurchase = now;
    if (d.day === 0) p.daily.got = {};
    p.daily.got[d.day] = out;
    p.daily.last = U.dayKey(now);
    p.daily.day = (p.daily.day + 1) % D().daily.length;
    Meta.save();
    return out;
  };

  // Quests
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function questAvailable(t) {
    const r = t.requires, max = P_().maxIsland;
    if (!r) return true;
    if (r.color) { const c = D().colors[r.color]; if (c && (c.unlock || 1) > max) return false; }
    if (r.island && r.island > max) return false;
    if (r.lab && !Meta.labOpen()) return false;
    return true;
  }
  function unlockedColors() { return Object.keys(D().colors).filter(id => (D().colors[id].unlock || 1) <= P_().maxIsland); }
  function questTarget(t) { const n = U.lin(t.n, P_().maxIsland); return t.scaleP ? Math.round(n * Meta.P()) : n; }
  Meta.questText = function (q) {
    const t = D().quests.find(x => x.id === q.id);
    if (!t) return '';
    const c = q.color && D().colors[q.color];
    return t.text.replace('{n}', q.target).replace('{color}', c ? (c.gen || c.name) : '');
  };
  Meta.quests = function (now) {
    const p = P_(), day = U.dayKey(now);
    if (p.quests.date !== day) {
      const rng = PS.Rng.make(hashStr(day) ^ 0x51ed);
      const pool = PS.Rng.shuffle(rng, D().quests.filter(questAvailable));
      p.quests = {
        date: day, bonusClaimed: false,
        list: pool.slice(0, D().questsPerDay || 3).map(t => {
          const q = { id: t.id, n: questTarget(t), target: questTarget(t), progress: 0, done: false, claimed: false };
          if (t.filter && t.filter.color === '$deck') q.color = PS.Rng.pick(rng, unlockedColors());
          return q;
        }),
      };
      Meta.save();
    }
    return p.quests.list;
  };
  Meta.track = function (event, data, now) {
    data = data || {};
    let changed = false;
    Meta.quests(now).forEach(q => {
      const t = D().quests.find(x => x.id === q.id);
      if (!t || t.event !== event || q.done) return;
      const f = t.filter || {};
      for (const k of Object.keys(f)) {
        const want = f[k] === '$deck' ? q.color : f[k];
        if (data[k] !== want && !(want === true && data[k]) && !(typeof want === 'number' && data[k] >= want)) return;
      }
      q.progress = Math.min(q.target, q.progress + (event === 'lab_spend' ? (data.coins || 0) : (data.n || 1)));
      if (q.progress >= q.target) q.done = true;
      changed = true;
    });
    if (changed) Meta.save();
  };
  Meta.claimQuest = function (i) {
    const p = P_(), q = p.quests.list[i];
    if (!q || !q.done || q.claimed) return null;
    q.claimed = true;
    const out = { coins: Math.round(D().questReward.coins * Meta.P()), gems: 0 };
    p.coins += out.coins;
    if (!p.quests.bonusClaimed && p.quests.list.every(x => x.claimed)) {
      p.quests.bonusClaimed = true;
      out.gems = D().economy.gems.questsAll;
      p.gems += out.gems;
    }
    Meta.save();
    return out;
  };

  // Ad gift
  function adRoll(now) {
    const a = P_().adGift, day = U.dayKey(now);
    if (a.date !== day) { a.date = day; a.used = 0; }
    return a;
  }
  Meta.adGiftLeft = now => D().economy.gems.adGiftPerDay - adRoll(now).used;
  Meta.claimAdGift = function (now) {
    if (Meta.adGiftLeft(now) <= 0) return false;
    adRoll(now).used += 1;
    P_().gems += D().economy.gems.adGift;
    P_().lastRewardedOrPurchase = now;
    Meta.save();
    return true;
  };

  // Shop
  const starterMs = () => D().shop.products.find(x => x.id === 'starter').hours * HOUR;
  Meta.sealActive = now => P_().seal.until > now;
  Meta.sealDaysLeft = now => Meta.sealActive(now) ? Math.ceil((P_().seal.until - now) / DAY) : 0;
  Meta.starterAvailable = function (now) {
    const s = P_().starter;
    return !s.bought && s.offeredAt > 0 && now < s.offeredAt + starterMs();
  };
  Meta.starterLeftMs = now => Math.max(0, P_().starter.offeredAt + starterMs() - now);
  Meta.buy = function (id, now) {
    const p = P_(), prod = D().shop.products.find(x => x.id === id);
    if (!prod) return false;
    if (id === 'no_ads') {
      if (p.noAds) return false;
      p.noAds = true;
    } else if (id === 'starter') {
      if (!Meta.starterAvailable(now)) return false;
      p.starter.bought = true; p.gems += prod.gems; p.coins += prod.coins;
    } else if (id === 'seal') {
      p.seal.until = Math.max(now, p.seal.until) + (prod.days || D().seal.days) * DAY;
    } else if (prod.gems) {
      p.gems += prod.gems;
    } else return false;
    p.lastRewardedOrPurchase = now;
    Meta.save();
    return true;
  };
  Meta.coinPackAmount = id => { const c = D().shop.coinPacks.find(x => x.id === id); return c ? Math.round(c.coins * Meta.P()) : 0; };
  Meta.buyCoinPack = function (id) {
    const c = D().shop.coinPacks.find(x => x.id === id);
    if (!c || !Meta.spendGems(c.gems)) return false;
    P_().coins += Meta.coinPackAmount(id);
    Meta.save();
    return true;
  };

  // Ads
  Meta.shouldInterstitial = function (now, ctx) {
    const p = P_(), cfg = D().economy.interstitial;
    const island = Math.max(p.maxIsland, (ctx && ctx.island) || 0);
    if (p.noAds || Meta.sealActive(now)) return false;
    if (island < cfg.fromIsland || p.sessions <= 1) return false;
    if (p.lastInterstitial && now - p.lastInterstitial < cfg.minSec * 1000) return false;
    if (p.lastRewardedOrPurchase && now - p.lastRewardedOrPurchase < AFTER_REWARD_MS) return false;
    return true;
  };
  Meta.markInterstitial = function (now) { P_().lastInterstitial = now; Meta.save(); };
  Meta.markRewarded = function (now) { P_().lastRewardedOrPurchase = now; Meta.save(); };

  Meta.debug = {
    addCoins: n => Meta.addCoins(n == null ? 500 : n),
    addGems: n => Meta.addGems(n == null ? 100 : n),
    unlockAll() {
      const p = P_();
      p.maxIsland = D().islands.length;
      for (let n = 1; n < p.maxIsland; n++) p.cleared[n] = true;
      Meta.save();
    },
    toggleSeal(now) { const p = P_(); p.seal.until = p.seal.until > now ? 0 : now + D().seal.days * DAY; Meta.save(); },
    toggleNoAds() { P_().noAds = !P_().noAds; Meta.save(); },
  };

  PS.Meta = Meta;
})();
