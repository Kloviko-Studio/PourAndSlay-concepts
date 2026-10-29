# Концепт v2 — архитектура и контракт модулей

HTML-концепт всей v1 (этап A в `E:\MyApps\Kloviko\pour-and-slay\docs\ROADMAP.md`). Источник правды по правилам и числам — спеки `E:\MyApps\Kloviko\pour-and-slay\docs\` (`content/`, `screens/`, `decisions/`, `CONTEXT.md`). Старый прототип — `legacy/v1.html` (переносим оттуда всё, что не противоречит спекам: правила поля, звук, эффекты, SVG-монстров).

Язык интерфейса — английский по умолчанию, русский в Настройках (`js/i18n.js`: строки UI пишутся рядом с разметкой как `T('рус', 'eng')`, тексты данных — `js/data-en.js` поверх `data.js`). В приложении язык берётся из телефона. Работает и с `file://`, и на GitHub Pages: **обычные `<script src>`, без модулей, без сборки, без зависимостей**.

## Файлы

```
index.html                 оболочка: <link css>, контейнеры, <script> в порядке ниже
css/style.css              токены, компоненты, экраны
css/battle.css             бой, окна внутри попытки, слой обучения
css/debug.css              каталог и отладка
js/data.js                 PS.DATA — весь контент и баланс (только данные)
js/data-en.js              английские названия и описания поверх PS.DATA
js/i18n.js                 PS.T — язык и переводы строк UI
js/core/rng.js             PS.Rng — детерминированный ГСЧ с состоянием в объекте
js/core/util.js            PS.U — clone, clamp, round, plural
js/core/field.js           PS.Field — колбы, переливание, мусор, очередь, генерация
js/core/combat.js          PS.Combat — бой: эффекты цветов, комбо, враг, зелья, события
js/core/run.js             PS.Run — попытка острова: этапы, выбор, босс, воскрешение, монеты
js/core/meta.js            PS.Meta — профиль, Лаборатория, экономика, ежедневка, задания, магазин, сохранение
js/ui/sound.js             PS.Snd
js/ui/fx.js                PS.Fx — кольцо на месте попадания, шарик по дуге, всплывающие числа и надписи (без частиц и тряски)
js/ui/art.js               PS.Art — запасные SVG врагов и островов (основной арт — рисованные картинки из img/)
js/ui/app.js               PS.UI — роутер экранов, оверлеи, верхняя полоса, вкладки, тосты, Ads-заглушка
js/ui/screens/*.js         экраны (регистрируются через PS.UI.screen(name, impl))
js/ui/boot.js              старт приложения (последним)
bot/load.js                загрузка data + core в Node через vm
bot/sim.js                 бот: таблица прохождения островов
bot/test-*.js              тесты ядра (node, без фреймворка, assert)
tools/shoot-screens.mjs    скриншоты экранов и каталога в pour-and-slay/docs/art/shots
tools/playtest.mjs         бой через интерфейс в Chrome без окна: кадры и цена хода
tools/stamp-assets.mjs     метки ?v=<хэш> на css/js в index.html (перед коммитом)
tools/compress-images.py   .webp рядом с исходными .png
```

Порядок `<script>`: data → data-en → i18n → core/rng → core/util → core/field → core/combat → core/run → core/meta → ui/sound → ui/fx → ui/art → ui/app → ui/screens/* → ui/boot.

## Общие правила

- Каждый файл начинается с `var PS = globalThis.PS || (globalThis.PS = {});` и добавляет свой объект. `'use strict'` внутри IIFE.
- **Ядро (`js/core/*`, `js/data.js`) не трогает DOM, `window`, `document`, `localStorage`, `Math.random`, `Date.now()` при загрузке.** Оно должно загружаться в Node (`bot/load.js`). Время передаётся параметром (`now`), хранилище — через `PS.Meta.storage` (адаптер, в Node — память).
- **Всё состояние — простые JSON-объекты** (без классов, функций, `Set`, `Map`, циклических ссылок). Сохранение = `JSON.stringify`.
- Случайность только через `PS.Rng` с состоянием внутри объекта состояния (`state.rng = {s: <uint32>}`) — бот детерминирован по seed.
- Ядро синхронное. Действие возвращает **массив событий**; UI проигрывает события с анимацией, затем рисует итоговое состояние.
- Id совпадают с id в спеках (`docs/content/*.md`).
- Комментарии — только «почему», по-английски, редко. Без JSDoc.

## PS.Rng (`js/core/rng.js`)

```js
PS.Rng.make(seed) -> {s}            // mulberry32
PS.Rng.next(r) -> [0,1)
PS.Rng.int(r, n) -> 0..n-1
PS.Rng.pick(r, arr), PS.Rng.shuffle(r, arr) (на месте, возвращает arr)
PS.Rng.chance(r, p) -> bool
PS.Rng.weighted(r, [{w, ...}]) -> item
```

## PS.DATA (`js/data.js`)

Всё из `docs/content/*.md`. Объекты по id; у каждого элемента: `id, name, icon, desc` (короткое описание с числами, RU; английское — в `data-en.js`). `icon` — эмодзи-метка: UI до отрисовки подменяет её рисованной картинкой, эмодзи на экран не попадают + поля ниже. Тексты описаний — шаблоны с подстановкой чисел из полей не нужны: пишем готовую строку.

```js
PS.DATA = {
  elements: {          // стихии; порядок ключей = порядок показа
    fire:      { role, unlock: 1, base: {dmg: 6},  boost: {dmg: 3},  css: '#...', dark: '#...' },
    water:     { base: {shield: 6}, boost: {shield: 3} },
    life:      { base: {heal: 4},   boost: {heal: 2} },
    poison:    { unlock: 2, base: {tick: 2, turns: 4}, boost: {tick: 1} },
    lightning: { unlock: 4, base: {dmg: 4, delay: 1, delayK2: 2}, boost: {dmg: 2} },
    ice:       { unlock: 6, base: {freeze: 2, freezeK2: 3, vuln: 0.5}, boost: {freeze: 1} },
    dark:      { unlock: 8, base: {dmg: 12, self: 3}, boost: {dmg: 4} },
    mirror:    { unlock: 9, base: {fallbackShield: 4}, boost: null },
  },
  junk: { stone: {...}, slime: { shield: 3 } },
  startDeck: ['fire', 'water', 'life'],
  combo: [1, 1.5, 2, 3],
  potions: { undo: {unlock, weight}, heal: {pct: 0.25}, flask: {}, solvent: {}, shake: {}, sleep: {delay: 3}, firebomb: {mult: 3}, combo: {k: 2} },
  mods:  { tough: {cap: 3, unlock: 1, maxHp: 10, heal: 10}, apron: {cap: 3, pct: 0.10}, caustic: {cap: 3, dmg: 2}, bubble: {cap: 3, shield: 6},
           prep: {cap: 3, dmg: 6}, thorns: {cap: 3, dmg: 3}, leech: {cap: 3, pct: 0.10}, combo_master: {cap: 2, add: 0.25}, potion_pick: {cap: 0 /*без потолка*/, choices: 3} },
  finds: { new_color: {unlock: 2}, boost_color: {unlock: 1, cap: 3}, special_tube: {unlock: 3}, extra_slot: {unlock: 5}, filter: {unlock: 3, cap: 1, pct: 0.5, requires: 'junkEnemy'} },
  tubes: { plain: {cap: 4}, amp: {unlock: 3, mult: 2}, catalyst: {unlock: 5}, sieve: {unlock: 3}, bomb: {unlock: 7}, big: {unlock: 10, cap: 6, mult: 1.5}, vial: {unlock: 10, cap: 2} },
  rarity: { common: {weight: 60, unlock: 1}, rare: {weight: 30, unlock: 5}, legendary: {weight: 10, unlock: 8} },
  relics: { hot_crucible: {rarity: 'common', requires: null, dmg: 4}, ... },   // requires: null | {color: 'water'} | {enemy: 'stone'|'spores'|'fieldSpoiler'}
  lab:   { vitality: {tiers: 8, costs: [20, 30, 50, ...], unlock: 1, per: {maxHp: 5}}, ... },   // costs уже посчитаны и округлены до 5
  boosters: { booster_potion: {gems: 13}, booster_flask: {gems: 20}, booster_vitality: {gems: 13, maxHp: 20}, booster_first_strike: {gems: 10, mult: 2} },
  enemies: { slime: {world: 1, archetype: 'attacker', hp: 18, cycle: [{t: 'atk', v: 5, turns: 3}], art: 'slime'}, ... },
  bosses:  { slime_king: {hp: 36, cycle: [...], extra: {t: 'shield', v: 6, turns: 2}, art: 'slimeKing'}, ... },
  worlds:  [{ n: 1, id: 'meadows', name, theme: 'day'|'night', twist: null | {type: 'stonefall', every: 8} | {type: 'frozenStart', turns: 3} | {type: 'slimeQueue', pct: 0.1} | {type: 'burn', dmg: 2, turns: 2}, boss: 'slime_king', palette: {sky, ground, accent} }],
  islands: [{ n: 1, id: 'sunny_shallows', world: 1, name, tier: 'easy'|'medium'|'hard', stages: 4, bossAt: [4], regulars: ['slime'], M: 1.0, A: 0, final: false }],
  unlocks: { 1: {elements: [...], potions: [...], mods: [...], finds: [...], tubes: [...], lab: [...], relicRarity: 'common', note: '...'}, 2: {...}, ... },   // таблица «Что открывает остров»; предметы с later: 'v1.2' не открываются
  economy: {
    player: {hp: 50}, cap: 4, filledMin: 5, slots: {base: 3, max: 5}, belt: {base: 3}, deckMax: 5,
    drain: {hp: 3}, heal: {regular: 0.10, boss: 0.25}, potionDrop: 0.20, relicInPick: {chance: 0.15, from: 4},
    coins: {reg: [3, 1], flee: [8, 3], kill: [15, 5], first: 20, hardMult: 1.25},   // [a, b] = a + b·i
    gems: {start: 30, first: 5, firstHard: 10, adGift: 2, adGiftPerDay: 3, questsAll: 5},
    revive: {hp: 0.5, gems: 20, perRun: 1 /*одно воскрешение за попытку из любого источника, включая Перо феникса*/}, enemyHeals: 3, reroll: {gems: 7, mult: 2}, potionBuy: {gems: 15, mult: 2}, skip: [5, 1],
    boss: {returnHp: 0.5, rageAt: 0.33, rageTimer: 1},   // вернувшийся босс: returnHp от макс. HP
    interstitial: {fromIsland: 3, minSec: 180},
  },
  daily: [{coins: 30}, {coins: 50}, {gems: 5}, {coins: 80}, {coins: 100}, {coins: 120}, {gems: 15}],
  quests: [{ id, text: 'Закрой {n} колб огня', event: 'close', filter: {color: 'fire'}, n: [10, 2] /* a + b·i */, requires: {color: 'fire'} }],
  questReward: {coins: 40},
  shop: { products: [{id: 'gems_small', name, price: '$0,99', gems: 80}, ..., {id: 'no_ads'}, {id: 'starter', gems: 150, coins: 600, hours: 48}, {id: 'seal', days: 30}],
          coinPacks: [{id: 'coins_small', gems: 20, coins: 150}, ...] },
  seal: { days: 30, coinsMult: 1.5, dailyMult: 2 },
};
```

Точные поля — на усмотрение автора `data.js`, но названия выше обязательны (на них опираются ядро и UI). Если в спеке чего-то не хватает для реализации — автор добавляет поле и пишет об этом в отчёте.

## PS.Field (`js/core/field.js`)

Поле — часть состояния боя. Правила переносим из `legacy/v1.html` (`pourAmount`, `pour`, `isClosed`, `anyMove`, `genLayers`, `makePortion`, `refill`, мусор, слив) с изменениями из спек.

```js
F = { tubes: [{kind, cap, layers: [colorId|'stone'|'slime'], frozen: 0}], queue: [[...], [...], [...]], bag: [], minLayers, deck: {colorId: weight}, junkPct: 0 }

PS.Field.create(rng, {deck: [colorIds], slots: [tubeKind...], cap, filledMin, junkPct}) -> F
PS.Field.pourAmount(F, a, b) -> n          // a, b — индексы
PS.Field.pour(F, a, b) -> {n, color, swallowed: bool}   // сито глотает мусор: swallowed = true
PS.Field.isClosed(F, i) -> bool            // vial никогда не закрывается
PS.Field.anyMove(F) -> bool
PS.Field.refill(F, rng, i) -> layers       // из очереди; до 6 перемешиваний, чтобы был ход
PS.Field.drain(F, rng, i) -> {refilled}    // пусто; дозаливка только если слоёв < minLayers
PS.Field.breakStonesNear(F, i) -> [{tube, n}]
PS.Field.bombNeighbors(F, i) -> [{tube, color}]   // соседи по раскладке на экране (см. ниже)
PS.Field.neighbors(F, i) -> [j...]          // 2 ряда: соседи слева/справа в том же ряду
PS.Field.layout(F) -> {rows: [[i...], [i...]]}  // заполненные сверху, слоты снизу
// действия врага над полем:
PS.Field.addStones(F, rng, n) -> [tubeIdx...]
PS.Field.sporeQueue(F, rng, n) -> [{portion, pos}]
PS.Field.freezeRandom(F, rng, turns) -> tubeIdx | -1
PS.Field.stealTop(F, rng) -> {tube, color} | null
PS.Field.swapColors(F, rng) -> {a, b} | null
PS.Field.tickFrozen(F)
// зелья:
PS.Field.solvent(F, i), PS.Field.shake(F, rng, i), PS.Field.addFlask(F)
PS.Field.closableAfterEnemy(F) -> [i...]    // однотонные полные колбы, которые надо закрыть (баг 10 прототипа)
```

Отличия от прототипа: сито глотает мусор без траты хода (тратит ли ход — решает Combat по `swallowed`); `big` — cap 6; `vial` — cap 2, любые цвета вперемешку (наливать можно любой цвет при свободном месте), никогда не закрывается; `junkPct` — доля слизи в новых порциях (особенность мира и находка «Фильтр» её уменьшают).

## PS.Combat (`js/core/combat.js`)

```js
B = {
  rng, field: F, turn: 0, combo: 0, comboGrace: 0, lastColor: null, freePours: 0,
  player: {hp, maxHp, shield},
  enemy: {id, boss: bool, name, hp, maxHp, shield, cycle, ci, intent: {t, v, turns}, timer, frozen: 0, poison: [{tick, turns}], buff: 1, heals: 0 /*лечения за бой, не больше economy.enemyHeals*/, rage: false, first: true, final: bool /*нефинальный босс при 0 HP уходит*/, patched: bool /*вернувшийся босс с пластырем*/},
  mods, relics, deck: {colorId: boostLevel}, slotsKinds, potions: [ids], // ссылки на данные попытки копируются при старте
  burn: [{dmg, turns}], twist, stuck: false, history: null /*снимок для Отмены*/, owedMove: null /*ход, на котором игрок погиб; проходит после воскрешения*/, status: 'active'|'won'|'lost'|'fled',
  stats: {closes: {colorId: n}, maxCombo, potionsUsed, junkCloses},
}
PS.Combat.create(runCtx, enemySpec) -> {B, events}   // события старта: Заготовка, Пузырь, замороженная колба мира и т.п.
PS.Combat.act(B, action) -> events
   action = {type: 'pour', from, to} | {type: 'drain', tube} | {type: 'potion', idx, tube?}
PS.Combat.canAct(B, action) -> bool
PS.Combat.preview(B) -> {intent, timer, rageSoon}
PS.Combat.effectValue(B, colorId, k) -> число эффекта (для подсказок UI)
```

Порядок расчёта эффекта — `docs/content/README.md`. Ход: каждое переливание тратит ход, кроме: каскадного закрытия, закрытия в Катализаторе, переливания мусора в Сито, Философского камня, Счастливого клевера, зелий, слива в тупике.

**События** (`{type, ...}`; поля, затрагивающие поле, несут `tubes` — копию слоёв всех колб после шага, чтобы UI рисовал промежуточные состояния):

`pour {from, to, n, color, tubes}` · `swallow {tube}` · `close {tube, color, k, cascade, tubes}` · `effect {color, kind: 'dmg'|'shield'|'heal'|'poison'|'freeze'|'delay'|'self'|'slime'|'stone', value}` · `refill {tube, tubes}` · `stones {tube, n, tubes}` · `bomb {tube, targets, tubes}` · `combo {k}` · `turn {free: bool, reason}` · `poison_tick {dmg}` · `burn_tick {dmg}` · `enemy_act {t, v, tubes?, target?}` · `player_hit {dmg, absorbed}` · `enemy_hit {dmg, absorbed, source}` · `enemy_heal {v}` · `enemy_shield {v}` · `intent {t, v, timer}` · `rage` · `frozen_enemy {turns}` · `dead_end` · `drain {tube, free, refilled, tubes}` · `potion {id, tube?}` · `heal {v}` · `relic {id}` (сработала реликвия) · `twist {type, ...}` · `enemy_dead` · `boss_fled` · `player_dead`.

## PS.Run (`js/core/run.js`)

```js
ctx = { maxIsland, lab: {id: tier}, sealActive: bool, seed }   // снимок профиля на старте попытки
R = {
  island: n, ctx, rng, phase: 'battle'|'reward'|'revive'|'won'|'lost',
  stages: [{type: 'regular'|'boss', enemy: id, encounter: 0..E-1}], stage: 0,
  hp, maxHp, deck: {colorId: boostLevel}, mods: {id: stacks}, relics: [ids], slots: [tubeKind...], potions: [ids], beltSize,
  boss: {id, maxHp, encounters, done},
  boosters: [ids], coins: 0, gemsSpent: 0, revives: {free: 0, gems: 0}, rerolls: 0,
  offer: null | {kind: 'pick'|'relic'|'potion_pick'|'replace_color'|'replace_tube', options: [{type: 'mod'|'find'|'relic'|'potion'|'coins', id, color?, tube?}]},
  battle: B | null, best: 0, stats: {...}, firstClear: bool,
}
PS.Run.stagesOf(islandN) -> stages
PS.Run.create(ctx, islandN, boosterIds) -> {R, events}      // сразу стартует бой этапа 1
PS.Run.act(R, action) -> events                           // в phase 'battle' → Combat.act; обрабатывает конец боя
PS.Run.choose(R, optionIdx) -> events                     // может открыть уточняющий offer (какой цвет заменить и т.п.)
PS.Run.reroll(R) -> events                                // оплату кристаллами делает Meta/UI
PS.Run.potionBuyPrice(R), canBuyPotion(R, id), buyPotion(R, id) -> bool   // докупка зелья в бою: вид — раз за бой, цена ×2 за каждую покупку в попытке (R.potionBuys); ADR 0009 в доках игры; оплата — Meta/UI
PS.Run.skip(R) -> events
PS.Run.revive(R, source: 'free'|'gems') -> events
PS.Run.reviveOptions(R) -> {free: bool, gemsPrice: n|null}
PS.Run.giveUp(R) -> events
PS.Run.unlockedPool(R, kind) -> [ids]                     // учитывает ctx.maxIsland и «Требует»
```

Монеты считаются в `R.coins` по формулам `economy.coins` × (Бережливость, Печать, Золотая пробка, сложный тир); бонус первого прохождения и кристаллы за прохождение начисляет Meta при `won`. События Run (в дополнение к событиям Combat): `stage_start {stage, enemy}` · `coins {v, reason}` · `heal_after {v}` · `offer {kind}` · `potion_found {id}` · `boss_encounter_end {fled}` · `revive_prompt` · `revived {source}` · `island_won` · `island_lost`.

## PS.Meta (`js/core/meta.js`)

```js
PS.Meta.storage = {get(k), set(k, v)}       // в браузере — localStorage с try/catch; в Node — память
PS.Meta.load(now) / save() / reset(now)
P = PS.Meta.profile = {
  v: 2, coins, gems, lab: {id: tier}, maxIsland: 1, cleared: {n: true}, best: {n: stage}, seen: {itemKey: true} /*бейджи «новое»*/,
  daily: {day: 0..6, last: 'YYYY-MM-DD'|null}, quests: {date, list: [{id, n, target, progress, done, claimed}], bonusClaimed},
  adGift: {date, used}, seal: {until: ms|0}, noAds: bool, starter: {offeredAt: ms|0, bought: bool},
  lastInterstitial: ms, sessions: n, settings: {sound, music, vibro}, tutorial: {flags}, activeRun: R|null, stats: {...},
}
PS.Meta.ctx(now) -> ctx для Run
PS.Meta.labCost(id) / labTier(id) / canBuyLab(id) / buyLab(id)
PS.Meta.P() -> множитель прогресса
PS.Meta.unlockedAt(n) -> что открывает остров n; newUnlocks(n)
PS.Meta.finishRun(R, now) -> {coins, gems, firstClear, unlocked: [...], newBest}   // переносит итоги в профиль
PS.Meta.spendGems(n) -> bool; addCoins/addGems
PS.Meta.daily(now) -> {day, canClaim, reward}; claimDaily(now, double)
PS.Meta.quests(now) -> list; track(event, data, now); claimQuest(i)
PS.Meta.adGiftLeft(now); claimAdGift(now)
PS.Meta.buy(productId, now)                 // демо: начисляет сразу
PS.Meta.buyCoinPack(id) -> bool
PS.Meta.sealActive(now), sealDaysLeft(now)
PS.Meta.shouldInterstitial(now, context) -> bool   // правила economy.interstitial
PS.Meta.starterAvailable(now)
```

## PS.UI (`js/ui/app.js`) и экраны

- `PS.UI.screen(name, {mount(el, params), unmount?})` — регистрация; `PS.UI.go(name, params)` — переход с анимацией.
- `PS.UI.overlay(html|el, {cls, onClose})` → закрыватель; `PS.UI.toast(text)`; `PS.UI.topbar()` — обновить валюты.
- `PS.UI.tabs` — нижние вкладки (Магазин · Лаборатория · Мир · Коллекция), скрываются в бою.
- `PS.UI.ads.show(kind) -> Promise<bool>` — заглушка: оверлей «Реклама (демо)» на 1,5 с, затем награда. Interstitial — та же заглушка с крестиком.
- `PS.UI.play(events, handlers)` — последовательное проигрывание событий: обработчик возвращает длительность (мс или Promise), следующее событие ждёт её. Порядок и тайминги боя — `pour-and-slay/docs/screens/battle.md`, «Анимации».
- Экраны: `main` (свайп островов), `start` (окно старта), `battle` (+ выбор, реликвия, воскрешение, пауза, сборка), `results`, `cleared`, `lab`, `shop`, `collection`, `daily`, `quests`, `seal`, `settings`, `tutorial` (подсказки поверх боя), `catalog` (Настройки → Отладка → Каталог: всё из данных на одной странице).
- Сохранение `activeRun` после каждого действия; при запуске — «Продолжить забег?».
- ⚙ → Настройки содержит раздел «Отладка» (в концепте он нужен всегда): +500 🪙, +100 💎, открыть все острова, выиграть бой, сбросить прогресс, переключить Печать/Без рекламы.

## Стиль

Решено: два шрифта — рисованный Pangolin для названий и заголовков, ровный Nunito для кнопок, чисел и текста (роли — `pour-and-slay/docs/art/style.md`, «Шрифты»), рисованные небо и парящие острова, кремовые панели с бумажной фактурой и белой обводкой; главная кнопка — самый контрастный элемент экрана (тёплая на холодном). Миры 1–3 дневные, 4–5 ночные. Палитра — `pour-and-slay/docs/art/style.md`; все цвета — CSS-переменные на `:root`. Фон главного экрана (небо, облака, звёзды, острова) в концепте статичен; анимации, которые сделаем в приложении, описаны в `pour-and-slay/docs/screens/main.md`, раздел «Фон и анимации».
