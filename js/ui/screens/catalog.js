var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
  let tab = 'elements', query = '';

  const HIDE = { id: 1, name: 1, icon: 1, sym: 1, desc: 1, art: 1, later: 1, unlock: 1, nameEn: 1 };

  function fmt(v) {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) {
      if (!v.length) return '—';
      if (v.length && v.every(x => x && typeof x === 'object' && 't' in x)) return v.map(x => `${x.t} ${x.v}/${x.turns}`).join(' → ');
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

  function params(it, skip) {
    const out = {};
    Object.keys(it).forEach(k => { if (!HIDE[k] && !(skip && skip[k])) out[k] = it[k]; });
    return out;
  }

  const IN_GAME = { later: false, label: T('в игре', 'in game') };

  // unlock null or `later` marks content that exists in data but is not in the current build.
  function status(it) {
    if (it.later) return { later: true, label: it.later + ' (later)' };
    if (it.unlock === null) return { later: true, label: 'later' };
    if (it.status) return { later: false, label: String(it.status) };
    return IN_GAME;
  }

  function fromMap(src, extra) {
    return Object.keys(src).map(id => {
      const it = src[id];
      const e = { id, name: it.name || id, icon: it.icon || '', desc: it.desc, island: it.unlock === undefined ? 1 : it.unlock, st: status(it), params: params(it), group: '' };
      return extra ? extra(e, it) || e : e;
    });
  }

  // One entry per top-level key; nested objects are flattened to dotted keys.
  function fromParams(src) {
    return Object.keys(src).map(k => {
      const v = src[k];
      const p = v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, '', {}) : { value: v };
      return { id: k, name: k, icon: '', desc: '', island: null, st: IN_GAME, params: p, group: '' };
    });
  }

  const art = id => `<span class="cat-art">${UI.enemyArt(id)}</span>`;
  const D = () => PS.DATA;

  function openedBy(u) {
    const p = {};
    Object.keys(u).forEach(k => { if (k !== 'note' && u[k] && u[k].length !== 0) p[k] = u[k]; });
    return p;
  }

  // Every icon still drawn as emoji or inline SVG; the painted ones in img/icons (coins, gems, tabs, top bar…) are already final and left out.
  const PAINTED = /🪙|💎/u;
  const svg = (k, s) => { const v = UI.ico[k]; return typeof v === 'function' ? v(s) : v; };
  const UI_ICONS = () => {
    const G = { ui: T('Интерфейс', 'Interface'), set: T('Настройки и Печать', 'Settings & Seal'), bt: T('Бой', 'Battle'), win: T('Окна и подсказки', 'Windows & hints') };
    return [
      [svg('left'), T('Стрелка назад / влево', 'Back / left arrow'), T('Кнопка «назад» в шапке экранов, листание островов', 'Back button on screen headers, island pager'), G.ui],
      [svg('right'), T('Стрелка вправо', 'Right arrow'), T('Листание островов, строки настроек', 'Island pager, settings rows'), G.ui],
      [svg('close'), T('Крестик', 'Close'), T('Закрыть окно', 'Close a window'), G.ui],
      [`<span class="cat-mark" style="background:#7cc463">${svg('check', 18)}</span>`, T('Галочка (SVG)', 'Check (SVG)'), T('Выбранный буст, выполненное', 'Picked boost, done state'), G.ui],
      ['✓', T('Галочка', 'Check mark'), T('«Пройден» у острова, полученное задание, выбранный буст', '"Cleared" island tag, claimed quest, picked boost'), G.ui],
      ['👑', T('Корона (эмодзи)', 'Crown (emoji)'), T('Метка «Финал» у последнего острова', '"Finale" tag on the last island'), G.ui],
      ['🔒', T('Замок (эмодзи)', 'Lock (emoji)'), T('«Пройди остров N», закрытые улучшения лаборатории', '"Clear island N", locked lab upgrades'), G.ui],
      ['⏳', T('Песочные часы', 'Hourglass'), T('Таймер заданий, стартового набора, подарка', 'Quest, starter pack and gift timers'), G.ui],
      ['☁️', T('Облако', 'Cloud'), T('Слайд «Скоро новые острова»', '"New islands coming soon" slide'), G.ui],
      ['🛒', T('Тележка', 'Cart'), T('Заголовок «Магазин»', 'Shop header'), G.ui],
      ['⚗️', T('Колба алхимика', 'Alembic'), T('Заголовок «Лаборатория», окно «Продолжить забег?», подсказка о лаборатории', 'Lab header, "Continue run?" window, lab hint'), G.ui],
      ['📖', T('Книга', 'Book'), T('Заголовок «Коллекция», кнопка «Как играть»', 'Collection header, "How to play" button'), G.ui],
      ['🎁', T('Подарок (эмодзи)', 'Gift (emoji)'), T('Заголовок «Подарок дня», перк Печати', 'Daily Gift header, Seal perk'), G.ui],
      ['💰', T('Мешок монет', 'Money bag'), T('Дни 5–6 подарка (награда больше)', 'Gift days 5–6 (bigger reward)'), G.ui],
      ['📜', T('Свиток', 'Scroll'), T('Заголовок «Задания», невыполненное задание', 'Quests header, unfinished quest'), G.ui],
      ['🎉', T('Хлопушка', 'Party popper'), T('Задание выполнено, награду можно забрать', 'Quest done, reward ready'), G.ui],
      ['✅', T('Зелёная галочка', 'Green check'), T('Награда за задание получена', 'Quest reward claimed'), G.ui],
      ['🎬', T('Хлопушка кино', 'Clapper'), T('Награда за рекламу, окно рекламы', 'Rewarded ad, ad window'), G.ui],
      ['📺', T('Телевизор', 'TV'), T('Реклама между забегами', 'Ad between runs'), G.ui],
      ['🗂', T('Картотека', 'Card index'), T('Заголовок «Каталог»', 'Catalog header'), G.ui],
      ['🔓', T('Открытый замок', 'Open lock'), T('Раздел «Открытия» каталога', 'Catalog "Unlocks" section'), G.ui],
      ['🏝', T('Остров', 'Island'), T('Запасная иконка острова', 'Fallback island icon'), G.ui],
      ['🏺', T('Амфора', 'Amphora'), T('Открытие новых реликвий', 'New relics unlocked'), G.ui],
      ['❔', T('Вопрос', 'Question'), T('Неизвестный предмет', 'Unknown item'), G.ui],
      ['👾', T('Монстрик', 'Space invader'), T('Запасной рисунок врага', 'Fallback enemy picture'), G.ui],
      ['⚙', T('Шестерёнка (эмодзи)', 'Gear (emoji)'), T('Заголовок «Настройки», кнопка в паузе', 'Settings header, pause menu button'), G.set],
      ['🔊', T('Динамик', 'Speaker'), T('Звук', 'Sound'), G.set],
      ['🎵', T('Нота', 'Note'), T('Музыка', 'Music'), G.set],
      ['📳', T('Вибрация', 'Vibration'), T('Вибрация', 'Vibration'), G.set],
      ['🌐', T('Глобус', 'Globe'), T('Язык', 'Language'), G.set],
      ['♻️', T('Переработка', 'Recycle'), T('Восстановить покупки', 'Restore purchases'), G.set],
      ['🛡', T('Щит (настройки)', 'Shield (settings)'), T('Реклама и приватность', 'Ads & privacy'), G.set],
      ['📄', T('Документ', 'Page'), T('Политика конфиденциальности', 'Privacy policy'), G.set],
      ['✉️', T('Конверт', 'Envelope'), T('Поддержка', 'Support'), G.set],
      ['🗑', T('Корзина', 'Bin'), T('Сбросить прогресс', 'Reset progress'), G.set],
      ['🪶', T('Перо', 'Feather'), T('Перк Печати: бесплатное воскрешение', 'Seal perk: free revive'), G.set],
      ['🚫', T('Запрет', 'No entry'), T('Перк Печати и товар «Без рекламы»', 'Seal perk and "No ads" item'), G.set],
      [svg('heart', 28), T('Сердце', 'Heart'), T('HP игрока в бою', 'Player HP in battle'), G.bt],
      [svg('shield', 22), T('Щит', 'Shield'), T('Щит игрока в бою', 'Player shield in battle'), G.bt],
      [svg('drop'), T('Капля', 'Drop'), T('Кнопка «Слить»', 'Drain button'), G.bt],
      [svg('pause'), T('Пауза', 'Pause'), T('Кнопка паузы', 'Pause button'), G.bt],
      [svg('bag'), T('Сумка', 'Bag'), T('Кнопка «Сборка»', 'Build button'), G.bt],
      [svg('undo'), T('Отмена (SVG)', 'Undo (SVG)'), T('Зелье «Отмена» на поясе', 'Undo potion on the belt'), G.bt],
      [svg('heal'), T('Лечение (SVG)', 'Heal (SVG)'), T('Зелье «Лечение» на поясе', 'Heal potion on the belt'), G.bt],
      [svg('crown', 22), T('Корона (SVG)', 'Crown (SVG)'), T('Метка «Босс» у имени врага', '"Boss" tag by the enemy name'), G.bt],
      ['⚔️', T('Мечи', 'Swords'), T('Намерение врага: удар; страница правил «Враг»', 'Enemy intent: attack; "Enemy" rules page'), G.bt],
      ['🪨', T('Камень', 'Rock'), T('Намерение: камни в колбы; камнепад; правила «Мусор»', 'Intent: stones in tubes; rockfall; "Junk" rules'), G.bt],
      ['🍄', T('Гриб', 'Mushroom'), T('Намерение: слизь в очередь', 'Intent: slime into the queue'), G.bt],
      ['❄️', T('Снежинка', 'Snowflake'), T('Намерение и метка на колбе: заморозка колбы', 'Intent and tube mark: tube frozen'), G.bt],
      ['🤏', T('Щепотка', 'Pinch'), T('Намерение: украдёт слой', 'Intent: steal a layer'), G.bt],
      ['🔀', T('Перемешать', 'Shuffle'), T('Намерение: поменяет цвета', 'Intent: swap colours'), G.bt],
      ['🛡', T('Щит (враг)', 'Shield (enemy)'), T('Намерение и статус: щит врага; +щит', 'Intent and status: enemy shield; +shield'), G.bt],
      ['💪', T('Бицепс', 'Biceps'), T('Намерение и статус: усиленный удар ×2', 'Intent and status: next hit ×2'), G.bt],
      ['💚', T('Зелёное сердце', 'Green heart'), T('Намерение: враг лечится', 'Intent: enemy heals'), G.bt],
      ['😡', T('Злость', 'Angry face'), T('Статус: ярость врага', 'Status: enemy rage'), G.bt],
      ['🔥', T('Огонь (статус)', 'Fire (status)'), T('Статус: поджог игрока', 'Status: burn on the player'), G.bt],
      ['💤', T('Сон', 'Sleep'), T('Всплывающее число: зелье сна', 'Floating number: sleep potion'), G.bt],
      ['⇄', T('Обмен', 'Swap'), T('Всплывающее: цвета поменялись', 'Floating: colours swapped'), G.bt],
      ['🧪', T('Пробирка', 'Test tube'), T('Страница правил «Переливание»', '"Pouring" rules page'), G.win],
      ['✨', T('Искры', 'Sparkles'), T('Правила «Закрытие», комбо ×2, новое открытие', '"Closing" rules, combo ×2, new unlock'), G.win],
      ['🚰', T('Кран', 'Tap'), T('Правила «Слив и зелья»', '"Drain & potions" rules'), G.win],
      ['🫧', T('Пузыри', 'Bubbles'), T('Слизь в правилах и подсказках', 'Slime in rules and hints'), G.win],
      ['🎒', T('Рюкзак', 'Backpack'), T('Окно «Сборка»', 'Build window'), G.win],
      ['🔱', T('Трезубец', 'Trident'), T('Кнопка «Воскреснуть бесплатно» (Печать)', '"Revive for free" button (Seal)'), G.win],
      ['💀', T('Череп', 'Skull'), T('Окно «Ты пал!»', '"You fell!" window'), G.win],
      ['❤️', T('Сердце (эмодзи)', 'Heart (emoji)'), T('HP в окне выбора после этапа', 'HP in the after-stage pick'), G.win],
      ['🍀', T('Клевер', 'Clover'), T('Подпись: сработал Клевер', 'Label: Clover triggered'), G.win],
      ['💠', T('Камень философа', 'Diamond with dot'), T('Подпись: сработал Философский камень', "Label: Philosopher's Stone triggered"), G.win],
      ['👆', T('Палец', 'Pointing hand'), T('Подсказки обучения', 'Tutorial hints'), G.win],
    ].map(([icon, name, desc, group], i) => ({ id: 'ui_' + (i + 1), name, icon, desc, island: null, st: { later: false, label: /<svg/.test(icon) ? 'SVG' : 'emoji' }, params: {}, group }));
  };
  // Item icons straight from the data, so this list follows any rename or new item.
  const DATA_ICONS = () => [
    ['junk', T('Мусор', 'Junk')], ['tubes', T('Колбы', 'Tubes')], ['potions', T('Зелья', 'Potions')],
    ['mods', T('Моды', 'Mods')], ['finds', T('Находки', 'Finds')], ['relics', T('Реликвии', 'Relics')], ['boosters', T('Бустеры', 'Boosts')],
    ['lab', T('Лаборатория', 'Lab')], ['worlds', T('Миры', 'Worlds')], ['shop', T('Магазин', 'Shop')],
  ].flatMap(([k, group]) => {
    const src = k === 'shop' ? D().shop.products.concat(D().shop.coinPacks) : Array.isArray(D()[k]) ? D()[k] : Object.keys(D()[k]).map(id => Object.assign({ id }, D()[k][id]));
    return src.filter(it => it.icon && !PAINTED.test(it.icon)).map(it => ({
      id: it.id || String(it.n), name: it.name || it.id, icon: it.icon, desc: it.desc || '', island: null, st: { later: false, label: 'emoji' }, params: {}, group: T(`Данные: ${group}`, `Data: ${group}`),
    }));
  });

  const CATS = [
    { id: 'icons', label: T('Все иконки', 'All icons'), raw: () => ({ ui: UI_ICONS().map(e => ({ name: e.name, desc: e.desc, group: e.group })), data: DATA_ICONS().map(e => ({ id: e.id, icon: e.icon, group: e.group })) }), list: () => UI_ICONS().concat(DATA_ICONS()) },
    { id: 'elements', label: T('Стихии', 'Elements'), raw: () => D().elements, list: () => fromMap(D().elements, (e, it) => { e.icon = `<span class="cat-mark" style="background:${esc(it.css)}">${UI.elIco(e.id)}</span>`; return e; }) },
    { id: 'junk', label: T('Мусор', 'Junk'), raw: () => D().junk, list: () => fromMap(D().junk) },
    { id: 'tubes', label: T('Колбы', 'Tubes'), raw: () => D().tubes, list: () => fromMap(D().tubes) },
    { id: 'potions', label: T('Зелья', 'Potions'), raw: () => ({ potions: D().potions, potionStart: D().potionStart }), list: () => fromMap(D().potions, e => { e.params.inStartBelt = (D().potionStart || []).indexOf(e.id) >= 0; return e; }) },
    { id: 'mods', label: T('Моды', 'Mods'), raw: () => D().mods, list: () => fromMap(D().mods) },
    { id: 'finds', label: T('Находки', 'Finds'), raw: () => D().finds, list: () => fromMap(D().finds) },
    {
      id: 'relics', label: T('Реликвии', 'Relics'), raw: () => ({ relics: D().relics, rarity: D().rarity }),
      list: () => {
        const R = D().rarity || {}, order = Object.keys(R);
        return fromMap(D().relics, (e, it) => {
          const r = R[it.rarity] || {};
          e.island = r.unlock || 1; e.group = r.name || it.rarity;
          e.rank = order.indexOf(it.rarity);
          e.params = params(it, { rarity: 1 });
          e.params.rarity = T(`${it.rarity} (вес ${r.weight}, с острова ${r.unlock})`, `${it.rarity} (weight ${r.weight}, from island ${r.unlock})`);
          return e;
        }).sort((a, b) => a.rank - b.rank);
      },
    },
    { id: 'rarity', label: T('Редкость', 'Rarity'), raw: () => D().rarity, list: () => fromMap(D().rarity) },
    { id: 'boosters', label: T('Бустеры', 'Boosts'), raw: () => D().boosters, list: () => fromMap(D().boosters) },
    {
      id: 'lab', label: T('Лаборатория', 'Lab'), raw: () => D().lab,
      list: () => fromMap(D().lab, (e, it) => { e.params.totalCost = it.costs.reduce((s, c) => s + c, 0); return e; }),
    },
    {
      id: 'enemies', label: T('Враги', 'Enemies'), raw: () => D().enemies,
      list: () => fromMap(D().enemies, (e, it) => { e.icon = art(it.id); e.island = it.world * 2 - 1; return e; }),
    },
    {
      id: 'bosses', label: T('Боссы', 'Bosses'), raw: () => D().bosses,
      list: () => fromMap(D().bosses, (e, it) => { e.icon = art(it.id); e.island = it.islands[0]; return e; }),
    },
    {
      id: 'islands', label: T('Острова', 'Islands'), raw: () => D().islands,
      list: () => D().islands.map(it => {
        const w = (D().worlds || [])[it.world - 1] || {};
        const p = params(it);
        p.regulars = it.regulars.map(id => ((D().enemies || {})[id] || {}).name || id).join(', ');
        const u = (D().unlocks || {})[it.n];
        if (u) p.opens = fmt(openedBy(u));
        return { id: it.id, name: `${it.n}. ${it.name}`, icon: w.icon || '🏝', desc: u && u.note, island: it.n, st: IN_GAME, params: p, group: T('Мир ', 'World ') + it.world };
      }),
    },
    {
      id: 'worlds', label: T('Миры', 'Worlds'), raw: () => D().worlds,
      list: () => D().worlds.map(w => ({ id: w.id, name: `${w.n}. ${w.name}`, icon: w.icon, desc: w.desc, island: w.n * 2 - 1, st: IN_GAME, params: params(w, { n: 1 }), group: '' })),
    },
    {
      id: 'unlocks', label: T('Открытия', 'Unlocks'), raw: () => D().unlocks,
      list: () => Object.keys(D().unlocks).map(n => {
        const u = D().unlocks[n];
        return { id: 'island_' + n, name: T(`Остров ${n}`, `Island ${n}`), icon: '🔓', desc: u.note, island: +n, st: IN_GAME, params: openedBy(u), group: '' };
      }),
    },
    { id: 'economy', label: T('Экономика', 'Economy'), raw: () => D().economy, list: () => fromParams(D().economy) },
    {
      id: 'daily', label: T('Ежедневка', 'Daily'), raw: () => D().daily,
      list: () => D().daily.map((d, i) => ({ id: 'day_' + (i + 1), name: T(`День ${i + 1}`, `Day ${i + 1}`), icon: '🎁', desc: '', island: null, st: IN_GAME, params: d, group: '' })),
    },
    {
      id: 'quests', label: T('Задания', 'Quests'), raw: () => ({ quests: D().quests, questsPerDay: D().questsPerDay, questReward: D().questReward }),
      list: () => D().quests.map(q => ({ id: q.id, name: q.id, icon: '📜', desc: q.text, island: null, st: IN_GAME, params: params(q, { text: 1 }), group: '' })),
    },
    {
      id: 'shop', label: T('Магазин', 'Shop'), raw: () => D().shop,
      list: () => {
        const mk = (it, g) => Object.assign(fromMap({ [it.id]: it })[0], { group: g, island: null });
        return D().shop.products.map(p => mk(p, T('Товары за деньги', 'Real-money items'))).concat(D().shop.coinPacks.map(p => mk(p, T('Пачки монет за кристаллы', 'Coin packs for gems'))));
      },
    },
    { id: 'seal', label: T('Печать', 'Seal'), raw: () => D().seal, list: () => fromParams(D().seal) },
    {
      id: 'misc', label: T('Прочее', 'Misc'), raw: () => ({ startDeck: D().startDeck, combo: D().combo, potionStart: D().potionStart }),
      list: () => fromParams({ startDeck: D().startDeck, combo: D().combo, potionStart: D().potionStart }).map(e => { e.params = { value: fmt(e.params.value) }; return e; }),
    },
  ];

  const cat = id => CATS.find(c => c.id === id) || CATS[0];

  function matches(e, q) {
    if (!q) return true;
    const hay = [e.id, e.name, e.desc, e.st.label, e.group, Object.keys(e.params).map(k => k + ' ' + fmt(e.params[k])).join(' ')].join(' ').toLowerCase();
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

  function card(e) {
    const kv = Object.keys(e.params).map(k => `<span class="cat-kv"><b>${esc(k)}</b>${esc(fmt(e.params[k]))}</span>`).join('');
    return `<div class="panel tight cat-card${e.st.later ? ' later' : ''}">
      <div class="cat-head">
        ${e.icon ? `<span class="cat-ico">${e.icon}</span>` : ''}
        <div class="cat-title"><b>${esc(e.name)}</b><span class="cat-id">${esc(e.id)}</span></div>
        <div class="cat-tags">
          <span class="tag ${e.st.later ? 'tag-gold' : 'tag-ok'}">${esc(e.st.label)}</span>
          ${e.island ? `<span class="tag">${T('ост.', 'isl.')} ${e.island}</span>` : ''}
        </div>
      </div>
      ${e.desc ? `<p class="cat-desc">${esc(e.desc)}</p>` : ''}
      ${kv ? `<div class="cat-kvs">${kv}</div>` : ''}
    </div>`;
  }

  UI.screen('catalog', {
    chrome: { tabs: false },
    mount(el, params) {
      const back = params.back;
      el.innerHTML = `<div class="scr-head"><button class="btn-icon" data-a="back" aria-label="${T('Назад', 'Back')}">${UI.ico.left}</button><h1>🗂 ${T('Каталог', 'Catalog')}</h1><span class="tag" data-r="total"></span></div>
        <div class="seg" data-r="tabs"></div>
        <div class="row cat-tools">
          <input class="cat-search" type="search" placeholder="${T('Поиск: id, имя, поле…', 'Search: id, name, field…')}" value="${esc(query)}" data-a="q">
        </div>
        <div class="row cat-tools wrap">
          <span class="tiny dim cat-counts" data-r="counts"></span>
          <button class="btn btn-sm" data-a="copyCat">JSON: ${T('категория', 'category')}</button>
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
        const later = all.filter(e => e.st.later).length;
        $('counts').textContent = T(`всего ${all.length} · в v1 ${all.length - later} · later ${later}`, `total ${all.length} · in v1 ${all.length - later} · later ${later}`) + (query ? T(` · найдено ${shown.length}`, ` · found ${shown.length}`) : '');
        $('total').textContent = String(all.length);
        let g = null, html = '';
        shown.forEach(e => {
          if (e.group !== g) { g = e.group; if (g) html += `<div class="sec-title">${esc(g)}</div>`; }
          html += card(e);
        });
        $('list').innerHTML = html || `<p class="center dim">${T('Ничего не найдено', 'Nothing found')}</p>`;
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
