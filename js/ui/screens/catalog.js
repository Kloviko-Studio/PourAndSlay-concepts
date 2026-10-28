var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
  const D = () => PS.DATA;
  let tab = 'icons', query = '';

  function fmt(v) {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) {
      if (!v.length) return '—';
      if (v.every(x => x && typeof x === 'object' && 't' in x)) return v.map(x => `${x.t} ${x.v}/${x.turns}`).join(' → ');
      return v.map(fmt).join(', ');
    }
    if (typeof v === 'object') return Object.keys(v).map(k => `${k}: ${fmt(v[k])}`).join(' · ');
    return String(v);
  }
  function flatten(o, prefix, out) {
    Object.keys(o).forEach(k => {
      const v = o[k], key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else out[key] = v;
    });
    return out;
  }
  // Cards show what a designer reads first; every raw field stays one tap away under "All fields".
  const SHOWN = ['id', 'name', 'desc', 'art', 'nameEn', 'text', 'css', 'dark', 'gen'];
  const rawOf = it => { const o = flatten(it, '', {}); SHOWN.forEach(k => delete o[k]); return o; };

  // unlock null or `later` marks content that exists in data but is not in the current build
  function entries(src, build) {
    return Object.keys(src).map(id => {
      const it = src[id];
      const e = { id, name: it.name || id, icon: '', desc: it.desc || '', island: it.unlock || null, later: it.later || (it.unlock === null ? 'later' : null), facts: [], raw: rawOf(it), group: '' };
      return (build && build(e, it)) || e;
    });
  }
  const fact = (label, html) => ({ label, html });
  const coins = n => `${UI.ico.coin(16)}${UI.fmt(n)}`;
  const gems = n => `${UI.ico.gem(16)}${UI.fmt(n)}`;
  const reward = r => [r.gems && gems(r.gems), r.lives && `${UI.ico.heart(16)}${r.lives}`, r.coins && coins(r.coins)].filter(Boolean).join(' ');
  const enemyPic = id => `<span class="cat-art">${UI.enemyArt(id)}</span>`;
  const islandPic = n => { const pic = UI.islandPic(n); return pic ? `<img class="cat-pic" src="${pic}" alt="" loading="lazy" decoding="async">` : `<span class="cat-art">${UI.islandArt(n)}</span>`; };
  const worldTitle = w => `${T('Мир', 'World')} ${w.n} · ${w.name}`;

  const ROLE = { damage: T('урон', 'damage'), defense: T('защита', 'defense'), heal: T('лечение', 'healing'), dot: T('урон по ходам', 'damage over time'), tempo: T('темп', 'tempo'), setup: T('подготовка', 'setup'), risk: T('риск', 'risk'), flex: T('повтор', 'copy') };
  const NEEDS = { stone: T('враги с камнями', 'enemies with stones'), spores: T('враги со слизью', 'enemies with slime'), fieldSpoiler: T('враги, что портят поле', 'enemies that spoil the field'), junkEnemy: T('враги с мусором', 'enemies with junk') };
  function needs(r) {
    if (!r) return null;
    if (typeof r === 'string') return esc(NEEDS[r] || r);
    if (r.color) return `${UI.elBadge(r.color)}${esc(D().elements[r.color].name)}`;
    if (r.enemy) return esc(NEEDS[r.enemy] || r.enemy);
    return esc(fmt(r));
  }
  const cycle = list => list.map(x => `<span class="cat-step">${UI.intentIco(x.t)}${x.v ? `<b>${x.v}</b>` : ''}<small>${T(`${x.turns} х.`, `${x.turns} t.`)}</small></span>`).join('<span class="cat-arr">›</span>');

  // Interface art that no other tab shows: each picture lives in exactly one place of the catalog.
  const GALLERY = () => [
    [T('Главный экран и вкладки', 'Main screen & tabs'), [
      ['main_screen/coin', T('Монета', 'Coin'), T('Верхняя панель, цены, награды', 'Top bar, prices, rewards')],
      ['main_screen/diamond', T('Кристалл', 'Gem'), T('Верхняя панель, цены, награды', 'Top bar, prices, rewards')],
      ['main_screen/seal', T('Печать алхимика', "Alchemist's Seal"), T('Кнопка в верхней панели, окно Печати', 'Top-bar button, Seal window')],
      ['main_screen/settings', T('Настройки', 'Settings'), T('Кнопка в верхней панели, пауза', 'Top-bar button, pause menu')],
      ['main_screen/market', T('Магазин', 'Shop'), T('Вкладка и заголовок', 'Tab and header')],
      ['main_screen/laboratory', T('Лаборатория', 'Lab'), T('Вкладка и заголовок', 'Tab and header')],
      ['main_screen/world', T('Мир', 'World'), T('Вкладка главного экрана', 'Main-screen tab')],
      ['main_screen/collection', T('Коллекция', 'Collection'), T('Вкладка и заголовок, каталог', 'Tab and header, catalog')],
      ['main_screen/present', T('Подарок', 'Gift'), T('Подарок дня, стартовый набор', 'Daily gift, starter pack')],
      ['main_screen/tasks', T('Задания', 'Quests'), T('Кнопка и экран заданий', 'Quests button and screen')],
      ['main_screen/boss', T('Босс', 'Boss'), T('Встреча с боссом на полоске этапов, финал', 'Boss stage on the stage strip, finale')],
      ['main_screen/lock', T('Замок', 'Lock'), T('Закрытый остров, закрытая ступень', 'Locked island, locked upgrade')]]],
    [T('Бой', 'Battle'), [
      ['battle/heart', T('Сердце', 'Heart'), T('HP игрока, жизни, воскрешение', 'Player HP, lives, revive')],
      ['battle/shield', T('Щит', 'Shield'), T('Щит игрока и врага, +щит', 'Player and enemy shield, +shield')],
      ['battle/pause', T('Пауза', 'Pause'), T('Кнопка паузы', 'Pause button')],
      ['battle/bag', T('Сумка', 'Bag'), T('Кнопка и окно «Сборка»', 'Build button and window')],
      ['battle/drain', T('Слив', 'Drain'), T('Кнопка «Слить», правила', 'Drain button, rules')],
      ['../mobs/plaster', T('Пластырь', 'Plaster'), T('Вернувшийся босс', 'A returning boss')]]],
    [T('Намерения и статусы врага', 'Enemy intents & statuses'), [
      ['gameplay/intents/intent_attack', T('Удар', 'Attack'), T('Намерение врага, правила «Враг»', 'Enemy intent, "Enemy" rules')],
      ['gameplay/intents/intent_shield', T('Щит врага', 'Enemy shield'), T('Намерение врага', 'Enemy intent')],
      ['gameplay/intents/intent_buff', T('Усиление', 'Power-up'), T('Намерение и статус: удар ×2', 'Intent and status: next hit ×2')],
      ['gameplay/intents/intent_heal', T('Лечение врага', 'Enemy heal'), T('Намерение, счётчик лечений', 'Intent, heal counter')],
      ['gameplay/intents/intent_steal', T('Кража', 'Steal'), T('Намерение: украдёт слой', 'Intent: steals a layer')],
      ['gameplay/intents/intent_swap', T('Обмен', 'Swap'), T('Намерение и всплывающее: цвета поменялись', 'Intent and pop-up: colours swapped')],
      ['gameplay/intents/status_rage', T('Ярость', 'Rage'), T('Статус врага', 'Enemy status')],
      ['gameplay/intents/status_burn', T('Поджог', 'Burn'), T('Статус игрока в Пепельных Землях', 'Player status in the Ashlands')]]],
    [T('Окна и подсказки', 'Windows & hints'), [
      ['ui/rule_close', T('Закрытие', 'Closing'), T('Правила «Закрытие»', '"Closing" rules')],
      ['ui/skull', T('Череп', 'Skull'), T('Окно «Ты пал!», сложный остров', '"You fell!" window, hard island')],
      ['ui/timer', T('Таймер', 'Timer'), T('Задания, стартовый набор, подарок', 'Quests, starter pack, gift')],
      ['ui/quest_done', T('Хлопушка', 'Popper'), T('Задание выполнено', 'Quest done')],
      ['ui/ad_reward', T('Реклама за награду', 'Rewarded ad'), T('Кнопки «за рекламу», окно рекламы', '"For an ad" buttons, ad window')],
      ['ui/ad_break', T('Реклама между забегами', 'Ad break'), T('Окно рекламы между попытками', 'Ad between runs')],
      ['ui/hand', T('Рука', 'Hand'), T('Подсказки обучения', 'Tutorial hints')]]],
    [T('Настройки', 'Settings'), [
      ['settings/sound', T('Звук', 'Sound'), ''], ['settings/music', T('Музыка', 'Music'), ''], ['settings/vibration', T('Вибрация', 'Vibration'), ''],
      ['settings/language', T('Язык', 'Language'), ''], ['settings/restore', T('Восстановить покупки', 'Restore purchases'), ''],
      ['settings/privacy', T('Реклама и приватность', 'Ads & privacy'), ''], ['settings/policy', T('Политика', 'Policy'), ''],
      ['settings/support', T('Поддержка', 'Support'), ''], ['settings/reset', T('Сбросить прогресс', 'Reset progress'), '']]],
  ].flatMap(([group, list]) => list.map(([path, name, desc]) => ({
    id: path.replace('../', ''), name, desc, group, facts: [], raw: {}, tile: true,
    icon: `<img class="cat-gimg" src="img/icons/${path}.webp" alt="" loading="lazy" decoding="async">`,
  })));

  const CATS = [
    { id: 'icons', label: T('Иконки', 'Icons'), raw: () => GALLERY().map(e => ({ file: e.id, name: e.name, use: e.desc })), list: GALLERY },
    {
      id: 'elements', label: T('Стихии', 'Elements'), raw: () => ({ elements: D().elements, junk: D().junk }),
      list: () => entries(D().elements, (e, it) => {
        e.icon = UI.elBadge(e.id); e.group = T('Стихии', 'Elements');
        e.facts = [fact(T('роль', 'role'), esc(ROLE[it.role] || it.role)), it.boostMax ? fact(T('усиление', 'boost'), T(`до ${it.boostMax} шагов`, `up to ${it.boostMax} steps`)) : null].filter(Boolean);
      }).concat(entries(D().junk, e => { e.icon = UI.elBadge(e.id); e.group = T('Мусор', 'Junk'); })),
    },
    {
      id: 'tubes', label: T('Колбы', 'Tubes'), raw: () => D().tubes, showcase: tubeShowcase,
      list: () => entries(D().tubes, (e, it) => { e.icon = UI.item('tubes', e.id).icon; if (it.cap) e.facts.push(fact(T('слоёв', 'layers'), it.cap)); }),
    },
    {
      id: 'potions', label: T('Зелья', 'Potions'), raw: () => ({ potions: D().potions, potionStart: D().potionStart }),
      list: () => entries(D().potions, (e, it) => {
        e.icon = UI.item('potions', e.id).icon;
        e.facts.push(fact(T('вес выпадения', 'drop weight'), it.weight));
        if ((D().potionStart || []).indexOf(e.id) >= 0) e.facts.push(fact('', T('в стартовом поясе', 'in the starting belt')));
      }),
    },
    {
      id: 'picks', label: T('Моды и находки', 'Mods & finds'), raw: () => ({ mods: D().mods, finds: D().finds }),
      list: () => entries(D().mods, (e, it) => {
        e.icon = UI.item('mods', e.id).icon; e.group = T('Моды — карточка «Бонус»', 'Mods — "Bonus" card');
        e.facts.push(fact(T('стаков', 'stacks'), it.cap ? T(`до ${it.cap}`, `up to ${it.cap}`) : T('без стаков', 'no stacks')));
      }).concat(entries(D().finds, (e, it) => {
        e.icon = UI.item('finds', e.id).icon; e.group = T('Находки — карточка «Находка»', 'Finds — "Find" card');
        if (it.cap) e.facts.push(fact(T('стаков', 'stacks'), T(`до ${it.cap}`, `up to ${it.cap}`)));
        if (it.requires) e.facts.push(fact(T('нужны', 'needs'), needs(it.requires)));
      })),
    },
    {
      id: 'relics', label: T('Реликвии', 'Relics'), raw: () => ({ relics: D().relics, rarity: D().rarity }),
      list: () => {
        const R = D().rarity, order = Object.keys(R);
        return entries(D().relics, (e, it) => {
          const r = R[it.rarity];
          e.icon = UI.item('relics', e.id).icon; e.island = r.unlock; e.cls = 'r-' + it.rarity; e.rank = order.indexOf(it.rarity);
          e.group = `${r.name} · ${T('вес', 'weight')} ${r.weight}`;
          if (it.requires) e.facts.push(fact(T('нужно', 'needs'), needs(it.requires)));
        }).sort((a, b) => a.rank - b.rank);
      },
    },
    {
      id: 'boosters', label: T('Бусты', 'Boosts'), raw: () => D().boosters,
      list: () => entries(D().boosters, (e, it) => { e.icon = UI.item('boosters', e.id).icon; e.facts.push(fact(T('цена', 'price'), gems(it.gems))); }),
    },
    {
      id: 'lab', label: T('Лаборатория', 'Lab'), raw: () => D().lab,
      list: () => entries(D().lab, (e, it) => {
        e.icon = UI.item('lab', e.id).icon;
        e.facts = [fact(T('ступеней', 'tiers'), it.tiers), fact(T('цены', 'costs'), it.costs.map(UI.fmt).join(' · ')), fact(T('всего', 'total'), coins(it.costs.reduce((s, c) => s + c, 0)))];
      }),
    },
    {
      id: 'enemies', label: T('Враги', 'Enemies'), raw: () => ({ enemies: D().enemies, bosses: D().bosses }),
      list: () => D().worlds.flatMap(w => {
        const g = worldTitle(w);
        const regular = entries(D().enemies, (e, it) => {
          e.icon = enemyPic(e.id); e.big = true; e.island = w.n * 2 - 1; e.group = g; e.world = it.world;
          e.facts = [fact('HP', it.hp), fact(T('цикл', 'cycle'), cycle(it.cycle))];
        }).filter(e => e.world === w.n);
        const bosses = entries(D().bosses, (e, it) => {
          e.icon = enemyPic(e.id); e.big = true; e.island = it.islands[0]; e.group = g; e.world = it.world; e.cls = 'boss';
          e.tag = `<span class="tag tag-hard">${it.final ? T('Финальный босс', 'Final boss') : T('Босс', 'Boss')}</span>`;
          e.facts = [fact('HP', it.hp), fact(T('острова', 'islands'), it.islands.join(', ')), fact(T('цикл', 'cycle'), cycle(it.cycle))];
          if (it.extra) e.facts.push(fact(T('на втором острове', 'on the second island'), cycle([it.extra])));
        }).filter(e => e.world === w.n);
        return regular.concat(bosses);
      }),
    },
    {
      id: 'islands', label: T('Острова', 'Islands'), raw: () => ({ worlds: D().worlds, islands: D().islands, unlocks: D().unlocks }),
      list: () => D().islands.map(it => {
        const w = D().worlds[it.world - 1], u = D().unlocks[it.n];
        const TIER = { easy: T('лёгкий', 'easy'), medium: T('средний', 'medium'), hard: T('сложный', 'hard') };
        const opens = UI.unlockList(it.n).map(x => (UI.unlockLabel(x) || {}).icon).filter(Boolean).join('');
        return {
          id: it.id, name: `${it.n}. ${it.name}`, icon: islandPic(it.n), desc: u && u.note, island: null, group: worldTitle(w), groupSub: w.desc,
          strip: opens ? `<span class="tiny dim">${T('Открывает', 'Opens')}</span>${opens}` : '',
          facts: [fact(T('этапов', 'stages'), it.stages), fact(T('боссы на этапах', 'bosses at'), it.bossAt.join(', ')), fact(T('сложность', 'tier'), TIER[it.tier] || it.tier),
            fact(T('враги', 'enemies'), esc(it.regulars.map(id => D().enemies[id].name).join(', ')))],
          raw: rawOf(it),
        };
      }),
    },
    {
      id: 'shop', label: T('Магазин', 'Shop'), raw: () => ({ shop: D().shop, seal: D().seal, adGift: D().economy.gems.adGift }),
      list: () => {
        const sh = D().shop, ec = D().economy;
        const prod = (p, group) => Object.assign(entries({ [p.id]: p })[0], { icon: UI.shopIco(p.id), group, island: null });
        const paid = sh.products.map(p => {
          const e = prod(p, T('За деньги', 'Real money'));
          e.facts = [fact(T('цена', 'price'), esc(p.price)), (p.gems || p.coins) && fact(T('даёт', 'gives'), reward(p)),
            p.days && fact(T('срок', 'lasts'), T(`${p.days} дней`, `${p.days} days`)), p.hours && fact(T('в продаже', 'on sale'), T(`${p.hours} ч после острова ${p.afterIsland}`, `${p.hours} h after island ${p.afterIsland}`))].filter(Boolean);
          if (p.id === 'seal') e.facts.push(fact(T('монеты', 'coins'), '×' + D().seal.coinsMult), fact(T('подарок дня', 'daily gift'), '×' + D().seal.dailyMult));
          return e;
        });
        const packs = sh.coinPacks.map(p => { const e = prod(p, T('Монеты за кристаллы', 'Coins for gems')); e.facts = [fact(T('цена', 'price'), gems(p.gems)), fact(T('даёт', 'gives'), coins(p.coins))]; return e; });
        const gift = {
          id: 'ad_gift', name: T('Кристаллы за рекламу', 'Gems for an ad'), icon: UI.inlineArt('ui/ad_reward'), desc: '', group: T('Бесплатно', 'Free'), raw: { adGift: ec.gems.adGift, adGiftPerDay: ec.gems.adGiftPerDay },
          facts: [fact(T('даёт', 'gives'), gems(ec.gems.adGift)), fact(T('в день', 'per day'), ec.gems.adGiftPerDay)],
        };
        return paid.concat(packs, [gift]);
      },
    },
    {
      id: 'rewards', label: T('Подарки и задания', 'Gifts & quests'), raw: () => ({ daily: D().daily, quests: D().quests, questsPerDay: D().questsPerDay, questReward: D().questReward }),
      list: () => D().daily.map((d, i) => ({
        id: 'day_' + (i + 1), name: T(`День ${i + 1}`, `Day ${i + 1}`), desc: '', group: T('Подарок дня', 'Daily gift'), raw: d, facts: [], tile: true, html: reward(d),
        icon: `<img class="cat-gimg" src="img/icons/${d.lives ? 'battle/heart' : d.gems ? 'main_screen/diamond' : 'main_screen/coin'}.webp" alt="">`,
      }))
        .concat(D().quests.map(q => ({
          id: q.id, name: q.text, icon: UI.art('tasks', 30), desc: '', group: T(`Задания — ${D().questsPerDay} в день`, `Quests — ${D().questsPerDay} a day`), raw: rawOf(q),
          facts: [fact(T('цель', 'goal'), esc(`${q.n[0]} + ${q.n[1]}×i`)), fact(T('награда', 'reward'), coins(D().questReward.coins)), q.requires && fact(T('с', 'from'), esc(fmt(q.requires)))].filter(Boolean),
        }))),
    },
    {
      id: 'numbers', label: T('Числа', 'Numbers'), raw: () => ({ economy: D().economy, combo: D().combo, startDeck: D().startDeck, potionStart: D().potionStart }),
      list: () => {
        const ec = D().economy, row = (id, name, html) => ({ id, name, icon: '', desc: '', group: T('Старт', 'Start'), raw: {}, facts: [fact('', html)] });
        const start = [
          row('startDeck', T('Стартовая колода', 'Starting deck'), D().startDeck.map(UI.elBadge).join('')),
          row('potionStart', T('Стартовый пояс', 'Starting belt'), D().potionStart.map(id => UI.item('potions', id).icon).join('')),
          row('combo', T('Множители комбо', 'Combo multipliers'), D().combo.map(k => '×' + k).join(' › ')),
        ];
        const eco = Object.keys(ec).map(k => {
          const v = ec[k], flat = v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, '', {}) : { '': v };
          return { id: k, name: k, icon: '', desc: '', group: T('Экономика', 'Economy'), raw: {}, facts: Object.keys(flat).map(f => fact(f, esc(fmt(flat[f])))) };
        });
        return start.concat(eco);
      },
    },
  ];

  const cat = id => CATS.find(c => c.id === id) || CATS[0];

  function matches(e, q) {
    if (!q) return true;
    const hay = [e.id, e.name, e.desc, e.group, Object.keys(e.raw).map(k => k + ' ' + fmt(e.raw[k])).join(' ')].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every(w => hay.indexOf(w) >= 0);
  }

  function copy(text, what) {
    const done = () => UI.toast(T(`Скопировано: ${what}`, `Copied: ${what}`));
    // file:// and some webviews reject the async clipboard API.
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { UI.toast(T('Не удалось скопировать', "Couldn't copy")); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  const tile = e => `<div class="panel tight cat-tile">${e.icon}<b>${esc(e.name)}</b>${e.desc ? `<span>${esc(e.desc)}</span>` : ''}${e.html ? `<span class="cat-fact">${e.html}</span>` : ''}<code>${esc(e.id)}</code></div>`;
  function card(e) {
    const facts = e.facts.map(f => `<span class="cat-fact">${f.label ? `<i>${esc(f.label)}</i>` : ''}${f.html}</span>`).join('');
    const keys = Object.keys(e.raw);
    const raw = keys.length ? `<details class="cat-raw"><summary>${T('Все поля', 'All fields')}</summary><div class="cat-kvs">${keys.map(k => `<span class="cat-kv"><b>${esc(k)}</b>${esc(fmt(e.raw[k]))}</span>`).join('')}</div></details>` : '';
    return `<div class="panel tight cat-card${e.later ? ' later' : ''}${e.cls ? ' ' + e.cls : ''}">
      <div class="cat-head">
        ${e.icon ? `<span class="cat-ico${e.big ? ' big' : ''}">${e.icon}</span>` : ''}
        <div class="cat-title"><b>${esc(e.name)}</b><span class="cat-id">${esc(e.id)}</span></div>
        <div class="cat-tags">${e.later ? `<span class="tag tag-gold">${esc(e.later)}</span>` : ''}${e.island ? `<span class="tag">${T('остров', 'island')} ${e.island}</span>` : ''}${e.tag || ''}</div>
      </div>
      ${e.desc ? `<p class="cat-desc">${esc(e.desc)}</p>` : ''}
      ${e.strip ? `<div class="cat-strip">${e.strip}</div>` : ''}
      ${facts ? `<div class="cat-facts">${facts}</div>` : ''}${raw}
    </div>`;
  }

  // Every tube kind and state the battle can draw, in its real markup, for checking the art side by side.
  function tubeShowcase() {
    const els = Object.keys(D().elements), kinds = Object.keys(D().tubes);
    const tube = (kind, layers, o, label) => `<div class="cat-tube"><div class="bt-tw${o && o.cls ? ' ' + o.cls : ''}">` +
      UI.tubeHtml({ kind, cap: kind === 'vial' ? 2 : 4, layers, frozen: o && o.frozen }, o) + `</div><span class="tiny dim">${esc(label)}</span></div>`;
    const name = k => (D().tubes[k] || {}).name || k;
    const glow = c => (D().elements[c] || D().junk[c]).css;
    const full = c => [c, c, c, c];
    const rows = [
      [T('Пустые', 'Empty'), kinds.map(k => tube(k, [], null, name(k)))],
      [T('Закрыты пробкой', 'Corked'), kinds.filter(k => k !== 'vial').map((k, i) => tube(k, full(els[i]), { cork: true, glow: glow(els[i]) }, name(k)))
        .concat(tube('vial', ['stone', 'fire'], null, T('Пробирка не закрывается', 'A vial never closes')))],
      [T('Полные, без пробки', 'Full, open'), kinds.map((k, i) => tube(k, k === 'vial' ? ['slime', 'water'] : ['fire', 'water', 'life', els[3 + i % 5]], null, name(k)))],
      [T('Наполовину', 'Half full'), kinds.map((k, i) => tube(k, k === 'vial' ? [els[i]] : [els[i], els[i + 1]], null, name(k)))],
      [T('Слияние слоёв', 'Merged runs'), [
        tube('plain', ['fire'], null, '1'), tube('plain', ['water', 'water'], null, '2'), tube('plain', ['life', 'life', 'life'], null, '3'),
        tube('plain', ['poison', 'poison', 'lightning', 'lightning'], null, '2 + 2'), tube('plain', ['ice', 'dark', 'dark', 'dark'], null, '1 + 3'),
        tube('plain', ['mirror', 'fire', 'mirror', 'fire'], null, '1 · 1 · 1 · 1')]],
      [T('Все жидкости', 'All liquids'), els.concat(Object.keys(D().junk)).map(c => tube('plain', full(c), null, (D().elements[c] || D().junk[c]).name))],
      [T('Состояния', 'States'), [
        tube('plain', ['fire', 'water'], { cls: 'sel' }, T('выбрана', 'selected')), tube('plain', ['life', 'life'], { cls: 'hint' }, T('подсказка', 'hint')),
        tube('plain', ['water', 'fire', 'fire'], { cls: 'bomb-n' }, T('сосед бомбы', 'bomb neighbour')), tube('plain', ['dark', 'ice'], { frozen: 2 }, T('заморожена', 'frozen')),
        tube('vial', ['ice'], { frozen: 1 }, T('Пробирка во льду', 'frozen vial')), tube('plain', full('fire'), { glow: glow('fire') }, T('закрытие без пробки', 'close glow'))]],
    ];
    return `<div class="cat-tubes">${rows.map(([title, cells]) => `<div class="sec-title">${title}</div><div class="cat-tube-row">${cells.join('')}</div>`).join('')}</div>`;
  }

  UI.screen('catalog', {
    chrome: { tabs: false },
    mount(el, params) {
      const back = params.back;
      el.innerHTML = `<div class="scr-head"><button class="btn-icon" data-a="back" aria-label="${T('Назад', 'Back')}">${UI.ico.left}</button><h1>${UI.inlineArt('main_screen/collection')} ${T('Каталог', 'Catalog')}</h1><span class="tag" data-r="total"></span></div>
        <div class="seg" data-r="tabs"></div>
        <div class="row cat-tools">
          <input class="cat-search" type="search" placeholder="${T('Поиск: id, имя, поле…', 'Search: id, name, field…')}" value="${esc(query)}" data-a="q">
        </div>
        <div class="row cat-tools wrap">
          <span class="tiny dim cat-counts" data-r="counts"></span>
          <button class="btn btn-sm" data-a="copyCat">JSON: ${T('вкладка', 'tab')}</button>
          <button class="btn btn-sm" data-a="copyAll">JSON: ${T('всё', 'all')}</button>
        </div>
        <div data-r="list"></div>`;
      const $ = r => el.querySelector(`[data-r=${r}]`);

      function renderTabs() {
        $('tabs').innerHTML = CATS.map(c => `<button data-t="${c.id}" class="${c.id === tab ? 'on' : ''}">${c.label}</button>`).join('');
        $('tabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
          PS.Snd.play('select'); tab = b.dataset.t; renderTabs(); renderList();
        });
        const on = $('tabs').querySelector('.on');
        if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      }

      function renderList() {
        const all = cat(tab).list();
        const shown = all.filter(e => matches(e, query));
        const later = all.filter(e => e.later).length;
        $('counts').textContent = T(`всего ${all.length}`, `total ${all.length}`) + (later ? T(` · позже ${later}`, ` · later ${later}`) : '') + (query ? T(` · найдено ${shown.length}`, ` · found ${shown.length}`) : '');
        $('total').textContent = String(all.length);
        let g = null, html = '';
        shown.forEach((e, i) => {
          if (i === 0 || e.group !== g) {
            if (i) html += '</div>';
            g = e.group;
            html += `${g ? `<div class="sec-title">${esc(g)}</div>${e.groupSub ? `<p class="cat-sub">${esc(e.groupSub)}</p>` : ''}` : ''}<div class="${e.tile ? 'cat-gallery' : 'cat-cards'}">`;
          }
          html += e.tile ? tile(e) : card(e);
        });
        if (shown.length) html += '</div>';
        const extra = cat(tab).showcase && !query ? cat(tab).showcase() : '';
        $('list').innerHTML = extra + (html || `<p class="center dim">${T('Ничего не найдено', 'Nothing found')}</p>`);
      }

      el.querySelector('[data-a=back]').onclick = () => { PS.Snd.play('select'); UI.go('settings', { back }); };
      el.querySelector('[data-a=q]').oninput = ev => { query = ev.target.value.trim(); renderList(); };
      el.querySelector('[data-a=copyCat]').onclick = () => copy(JSON.stringify(cat(tab).raw(), null, 2), cat(tab).label);
      el.querySelector('[data-a=copyAll]').onclick = () => copy(JSON.stringify(PS.DATA, null, 2), T('весь PS.DATA', 'all of PS.DATA'));
      renderTabs();
      renderList();
    },
  });
})();
