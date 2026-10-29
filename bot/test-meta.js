const assert = require('assert');
const PS = require('./load.js')();

if (!PS.DATA) {
  const islands = [];
  for (let n = 1; n <= 10; n++) islands.push({ n, tier: n === 5 ? 'hard' : 'easy', stages: 4, M: 1 + (n - 1) * 0.5 });
  PS.DATA = {
    elements: { fire: { unlock: 1 }, poison: { unlock: 2 } },
    lab: { vitality: { tiers: 3, costs: [20, 30, 50], unlock: 1 }, belt: { tiers: 2, costs: [80, 300], unlock: 2 } },
    islands,
    unlocks: { 1: { elements: ['fire'] }, 2: { elements: ['poison'], lab: ['belt'], relicRarity: 'common' }, 3: { potions: ['sleep'] } },
    economy: {
      coins: { first: 20, hardMult: 1.25 },
      gems: { start: 30, first: 5, firstHard: 10, adGift: 2, adGiftPerDay: 3, questsAll: 5 },
      interstitial: { fromIsland: 3, minSec: 180 },
    },
    daily: [{ coins: 30 }, { coins: 50 }, { gems: 5 }, { coins: 80 }, { coins: 100 }, { coins: 120 }, { gems: 15 }],
    quests: [
      { id: 'q_fire', event: 'close', filter: { color: 'fire' }, n: [10, 2], requires: { color: 'fire' } },
      { id: 'q_poison', event: 'close', filter: { color: 'poison' }, n: [8, 2], requires: { color: 'poison' } },
      { id: 'q_kill', event: 'kill', n: [3, 1], requires: null },
      { id: 'q_boss', event: 'boss_reached', n: [1, 0], requires: null },
      { id: 'q_lab', event: 'lab_spend', n: [50, 25], requires: null },
    ],
    questReward: { coins: 40 },
    shop: {
      products: [
        { id: 'gems_small', gems: 80 }, { id: 'no_ads' },
        { id: 'starter', gems: 150, coins: 600, hours: 48 }, { id: 'seal', days: 30 },
      ],
      coinPacks: [{ id: 'coins_small', gems: 20, coins: 150 }],
    },
    seal: { days: 30, coinsMult: 1.5, dailyMult: 2 },
  };
}
const D = PS.DATA, M = PS.Meta, U = PS.U;
const DAY = 86400000, HOUR = 3600000;
const T0 = new Date(2026, 5, 1, 12, 0, 0).getTime();

function fresh(now) { M.storage.set('ps.v2.profile', ''); M.reset(now); M.load(now); return M.profile; }
function winRun(n, coins) { return { island: n, phase: 'won', coins: coins || 0, stages: [1, 2, 3, 4], stage: 3, best: 0 }; }

// defaults + persistence
let p = fresh(T0);
assert.strictEqual(p.gems, D.economy.gems.start);
assert.strictEqual(p.maxIsland, 1);
assert.strictEqual(p.sessions, 2);
M.profile.coins = 7; M.save();
M.load(T0);
assert.strictEqual(M.profile.coins, 7, 'profile persists through storage');
assert.deepStrictEqual(Object.keys(M.ctx(T0)).sort(), ['lab', 'maxIsland', 'sealActive', 'seed']);

// lab costs and locks
p = fresh(T0);
const ids = Object.keys(D.lab);
const id1 = ids.find(i => D.lab[i].unlock === 1), idLocked = ids.find(i => D.lab[i].unlock > 1);
assert.strictEqual(M.labCost(id1), D.lab[id1].costs[0]);
assert.strictEqual(M.canBuyLab(id1), false, 'no coins');
M.addCoins(1e6);
assert.strictEqual(M.labLockReason(id1), 'first', 'lab opens after the first attempt');
M.profile.stats.runs = 1;
assert.strictEqual(M.canBuyLab(id1), true);
assert.strictEqual(M.canBuyLab(idLocked), false, 'island lock');
assert.ok(M.buyLab(id1, T0));
assert.strictEqual(M.labTier(id1), 1);
assert.strictEqual(M.labCost(id1), D.lab[id1].costs[1] === undefined ? null : D.lab[id1].costs[1]);
assert.strictEqual(M.profile.coins, 1e6 - D.lab[id1].costs[0]);
M.profile.activeRun = { phase: 'battle' };
assert.strictEqual(M.canBuyLab(id1), false, 'lab locked during active run');
assert.strictEqual(M.labLockReason(id1), 'run');
M.profile.activeRun = null;
while (M.buyLab(id1, T0));
assert.strictEqual(M.labCost(id1), null, 'maxed');

// finishRun: first clear vs replay
p = fresh(T0);
let res = M.finishRun(winRun(1, 30), T0);
assert.strictEqual(res.firstClear, true);
assert.strictEqual(res.coins, 30 + 20 * 1);
assert.strictEqual(res.gems, D.economy.gems.first);
assert.strictEqual(M.profile.maxIsland, 2);
assert.ok(res.unlocked.some(u => u.id === 'poison'));
assert.strictEqual(res.newBest, false, 'a first attempt is not a record');
assert.strictEqual(M.profile.coins, 50);
res = M.finishRun(winRun(1, 30), T0);
assert.strictEqual(res.firstClear, false);
assert.strictEqual(res.coins, 30);
assert.strictEqual(res.gems, 0);
assert.strictEqual(res.newBest, false);
assert.strictEqual(M.profile.maxIsland, 2);
res = M.finishRun({ island: 2, phase: 'lost', coins: 12, stages: [1, 2, 3, 4], stage: 1, best: 0 }, T0);
assert.strictEqual(res.coins, 12);
assert.strictEqual(M.profile.best[2], 2);
assert.strictEqual(res.newBest, false);
res = M.finishRun({ island: 2, phase: 'lost', coins: 0, stages: [1, 2, 3, 4], stage: 2, best: 0 }, T0);
assert.strictEqual(res.newBest, true, 'beating an earlier best is a record');
assert.strictEqual(M.profile.cleared[2], undefined);
assert.strictEqual(M.profile.maxIsland, 2);
assert.strictEqual(M.profile.activeRun, null);
// hard tier
const hardN = D.islands.findIndex(i => i.tier === 'hard') + 1;
if (hardN) {
  M.profile.maxIsland = hardN;
  res = M.finishRun(winRun(hardN, 0), T0);
  assert.strictEqual(res.coins, U.round(20 * hardN * 1.25));
  assert.strictEqual(res.gems, D.economy.gems.firstHard);
}

// starter window
p = fresh(T0);
assert.strictEqual(M.starterAvailable(T0), false, 'not before island 2 cleared');
M.finishRun(winRun(1), T0);
assert.strictEqual(M.starterAvailable(T0), false);
M.finishRun(winRun(2), T0);
assert.strictEqual(M.starterAvailable(T0 + 47 * HOUR), true);
assert.strictEqual(M.starterAvailable(T0 + 49 * HOUR), false);
const g0 = M.profile.gems, c0 = M.profile.coins;
assert.ok(M.buy('starter', T0 + HOUR));
assert.strictEqual(M.profile.gems, g0 + 150);
assert.strictEqual(M.profile.coins, c0 + 600);
assert.strictEqual(M.buy('starter', T0 + 2 * HOUR), false, 'once only');
assert.strictEqual(M.starterAvailable(T0 + 2 * HOUR), false);

// daily cycle across skipped days
p = fresh(T0);
let d = M.daily(T0);
assert.strictEqual(d.day, 0); assert.strictEqual(d.canClaim, true);
assert.deepStrictEqual(M.claimDaily(T0), { coins: 30 });
assert.strictEqual(M.daily(T0 + HOUR).canClaim, false, 'one claim per calendar day');
assert.strictEqual(M.claimDaily(T0 + HOUR), null);
d = M.daily(T0 + 5 * DAY); // skipped days
assert.strictEqual(d.day, 1, 'skipping does not reset or advance');
assert.deepStrictEqual(M.claimDaily(T0 + 5 * DAY, true), { coins: 100 }, 'ad double');
assert.deepStrictEqual(M.claimDaily(T0 + 6 * DAY), { gems: 5 });
assert.deepStrictEqual(M.profile.daily.got[1], { coins: 100 }, 'claimed amount is stored for display');
for (let i = 0; i < 4; i++) M.claimDaily(T0 + (7 + i) * DAY);
assert.strictEqual(M.profile.daily.day, (3 + 4) % 7);
assert.strictEqual(M.daily(T0 + 30 * DAY).day, 0);
M.profile.maxIsland = 3;
assert.strictEqual(M.daily(T0 + 40 * DAY).reward.coins, 30 * D.islands[2].P, 'coins scale by P');
M.profile.seal.until = T0 + 100 * DAY;
assert.deepStrictEqual(M.claimDaily(T0 + 40 * DAY), { coins: 60 * D.islands[2].P }, 'seal doubles automatically');

// lives: day 4 gives a stored revive, capped; a full stock gets the day's coins instead
p = fresh(T0);
M.profile.daily.day = 3;
assert.deepStrictEqual(M.claimDaily(T0), { lives: 1 });
assert.strictEqual(M.profile.lives, 1);
M.profile.daily.day = 3; M.profile.lives = D.economy.lives.max - 1;
assert.deepStrictEqual(M.claimDaily(T0 + DAY, true), { lives: 1 }, 'doubling stops at the cap');
M.profile.daily.day = 3;
assert.deepStrictEqual(M.claimDaily(T0 + 2 * DAY), { coins: 80 }, 'full stock pays coins');
assert.strictEqual(M.useLife(), true);
assert.strictEqual(M.profile.lives, D.economy.lives.max - 1);
M.profile.lives = 0;
assert.strictEqual(M.useLife(), false);

// quests
p = fresh(T0);
let ql = M.quests(T0);
assert.strictEqual(ql.length, 3);
assert.ok(!ql.some(q => q.id === 'q_poison'), 'poison quest requires unlocked color');
assert.strictEqual(M.quests(T0 + HOUR)[0].id, ql[0].id, 'stable within a day');
const t = D.quests.find(x => x.id === ql[0].id);
assert.strictEqual(ql[0].target, t.n[0] + t.n[1] * 1);
M.profile.maxIsland = 2;
const days = new Set();
for (let i = 1; i < 8; i++) days.add(M.quests(T0 + i * DAY).map(q => q.id).join());
assert.ok(days.size > 1, 'quests regenerate per day');
assert.strictEqual(M.profile.quests.date, U.dayKey(T0 + 7 * DAY));
M.profile.maxIsland = 1;
const now = T0 + 20 * DAY;
ql = M.quests(now);
ql.forEach(q => {
  const tpl = D.quests.find(x => x.id === q.id);
  const data = tpl.event === 'lab_spend' ? { coins: q.target } : Object.assign({}, tpl.filter, q.color ? { color: q.color } : {});
  const reps = tpl.event === 'lab_spend' ? 1 : q.target;
  for (let i = 0; i < reps; i++) M.track(tpl.event, data, now);
  assert.ok(q.done, q.id);
});
M.track('close', { color: 'water' }, now);
const cb = M.profile.coins, gb = M.profile.gems;
assert.deepStrictEqual(M.claimQuest(0), { coins: 40, gems: 0 });
assert.strictEqual(M.claimQuest(0), null, 'double claim');
M.claimQuest(1);
assert.deepStrictEqual(M.claimQuest(2), { coins: 40, gems: 5 });
assert.strictEqual(M.profile.coins, cb + 120);
assert.strictEqual(M.profile.gems, gb + 5);
// wrong-filter event does not progress
M.reset(T0); M.load(T0);
const q0 = M.quests(T0).find(q => q.id === 'q_fire');
if (q0) { M.track('close', { color: 'water' }, T0); assert.strictEqual(q0.progress, 0); }

// ad gift
p = fresh(T0);
assert.strictEqual(M.adGiftLeft(T0), 3);
for (let i = 0; i < 3; i++) assert.ok(M.claimAdGift(T0));
assert.strictEqual(M.claimAdGift(T0), false);
assert.strictEqual(M.profile.gems, 36);
assert.strictEqual(M.adGiftLeft(T0 + DAY), 3);

// seal stacking, packs, no_ads
p = fresh(T0);
assert.strictEqual(M.sealActive(T0), false);
M.buy('seal', T0);
assert.strictEqual(M.sealActive(T0 + 29 * DAY), true);
assert.strictEqual(M.sealDaysLeft(T0), 30);
M.buy('seal', T0 + 10 * DAY);
assert.strictEqual(M.profile.seal.until, T0 + 60 * DAY, 'stacks on remaining time');
M.buy('seal', T0 + 100 * DAY);
assert.strictEqual(M.profile.seal.until, T0 + 130 * DAY, 'renew after expiry starts from now');
assert.strictEqual(M.ctx(T0).sealActive, true);
M.buy('gems_small', T0);
assert.strictEqual(M.profile.gems, 110);
assert.ok(M.buyCoinPack('coins_small'));
assert.strictEqual(M.profile.coins, 150 * M.P());
assert.strictEqual(M.profile.gems, 90);
M.profile.gems = 0;
assert.strictEqual(M.buyCoinPack('coins_small'), false);
assert.strictEqual(M.buy('nope', T0), false);

// interstitial
p = fresh(T0);
M.profile.maxIsland = 3;
const L = T0 + 10 * HOUR;
assert.strictEqual(M.shouldInterstitial(L, { island: 3 }), true);
M.profile.sessions = 1;
assert.strictEqual(M.shouldInterstitial(L, { island: 3 }), false, 'first session');
M.profile.sessions = 2;
M.profile.maxIsland = 2;
assert.strictEqual(M.shouldInterstitial(L, { island: 2 }), false, 'before island 3');
M.profile.maxIsland = 3;
M.markInterstitial(L);
assert.strictEqual(M.shouldInterstitial(L + 179000, {}), false, 'under 180 s');
assert.strictEqual(M.shouldInterstitial(L + 181000, {}), true);
M.markRewarded(L + 181000);
assert.strictEqual(M.shouldInterstitial(L + 182000, {}), false, 'right after rewarded');
assert.strictEqual(M.shouldInterstitial(L + 181000 + 120000, {}), true);
M.buy('gems_small', L + 400000);
assert.strictEqual(M.shouldInterstitial(L + 401000, {}), false, 'right after purchase');
M.profile.noAds = true;
assert.strictEqual(M.shouldInterstitial(L + DAY, {}), false, 'no_ads');
M.profile.noAds = false;
M.profile.seal.until = L + 2 * DAY;
assert.strictEqual(M.shouldInterstitial(L + DAY, {}), false, 'seal');
assert.strictEqual(M.shouldInterstitial(L + 3 * DAY, {}), true, 'seal expired');

// seen badges
p = fresh(T0);
assert.strictEqual(M.isNew('elements:fire'), true);
assert.strictEqual(M.isNew('elements:poison'), false, 'not unlocked yet');
const nc = M.newCount();
M.markSeen('elements:fire');
assert.strictEqual(M.isNew('elements:fire'), false);
assert.strictEqual(M.newCount(), nc - 1);

// reset + debug
M.debug.addCoins(); M.debug.addGems(); M.debug.unlockAll();
assert.strictEqual(M.profile.maxIsland, D.islands.length);
M.debug.toggleSeal(T0); assert.strictEqual(M.sealActive(T0), true);
M.debug.toggleSeal(T0); assert.strictEqual(M.sealActive(T0), false);
M.debug.toggleNoAds(); assert.strictEqual(M.profile.noAds, true);
M.reset(T0);
assert.strictEqual(M.profile.maxIsland, 1);
assert.strictEqual(M.profile.coins, 0);

// An active run saved with the old boss HP pool (no boss.maxHp) gets maxHp back on load.
{
  const p = fresh(T0);
  p.activeRun = { island: 4, boss: { id: 'ancient_golem', pool: 120, poolMax: 120, encounters: 3, done: 1 } };
  M.save();
  M.load(T0);
  assert.strictEqual(M.profile.activeRun.boss.maxHp, U.round(D.bosses.ancient_golem.hp * D.islands[3].M));
}

console.log('test-meta: all passed');
