var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';

  // Spec: tier cost = base * growth^(tier-1), rounded to 5.
  function geo(base, growth, n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(Math.round(base * Math.pow(growth, i) / 5) * 5);
    return a;
  }

  var D = {};

  D.elements = {
    fire: {
      id: 'fire', name: 'Огонь', gen: 'огня', role: 'damage', unlock: 1,
      base: { dmg: 6 }, boost: { dmg: 3 }, boostMax: 3, css: '#f07a52', dark: '#c85a36',
      desc: 'Прямой урон: 6. Усиление: +3 урона за шаг.'
    },
    water: {
      id: 'water', name: 'Вода', gen: 'воды', role: 'defense', unlock: 1,
      base: { shield: 6 }, boost: { shield: 3 }, boostMax: 3, css: '#5aa2ea', dark: '#3a7cc4',
      desc: 'Щит: 6. Поглощает урон и сгорает после атаки врага. Усиление: +3 щита.'
    },
    life: {
      id: 'life', name: 'Жизнь', gen: 'жизни', role: 'heal', unlock: 1,
      base: { heal: 4 }, boost: { heal: 2 }, boostMax: 3, css: '#7cc463', dark: '#4f9a44',
      desc: 'Лечение: 4 HP. Усиление: +2 HP.'
    },
    poison: {
      id: 'poison', name: 'Яд', gen: 'яда', role: 'dot', unlock: 2,
      base: { tick: 2, turns: 4 }, boost: { tick: 1 }, boostMax: 3, css: '#b58ae0', dark: '#8a5bb8',
      desc: 'Заряд: 2 урона за ход, 4 хода. Идёт сквозь щит врага. Усиление: +1 урон за ход.'
    },
    lightning: {
      id: 'lightning', name: 'Молния', gen: 'молнии', role: 'tempo', unlock: 4,
      base: { dmg: 4, delay: 1, delayK2: 2 }, boost: { dmg: 2 }, boostMax: 3, css: '#f2c441', dark: '#c99a1c',
      desc: 'Урон: 4 и враг действует на 1 ход позже (на 2 при комбо ×2 и выше). Усиление: +2 урона.'
    },
    ice: {
      id: 'ice', name: 'Лёд', gen: 'льда', role: 'setup', unlock: 6,
      base: { freeze: 2, freezeK2: 3, vuln: 0.5 }, boost: { freeze: 1 }, boostMax: 3, css: '#8adbe0', dark: '#5aaab4',
      desc: 'Враг заморожен на 2 хода (3 при комбо ×2+): таймер стоит, яд тикает. По замороженному +50% урона. Усиление: +1 ход.'
    },
    dark: {
      id: 'dark', name: 'Тьма', gen: 'тьмы', role: 'risk', unlock: 8,
      base: { dmg: 12, self: 3 }, boost: { dmg: 4 }, boostMax: 3, css: '#8a78b8', dark: '#5b4a82',
      desc: 'Урон: 12, себе 3 урона мимо щита. Усиление: +4 урона.'
    },
    mirror: {
      id: 'mirror', name: 'Зеркало', gen: 'зеркала', role: 'flex', unlock: 9,
      base: { fallbackShield: 4 }, boost: null, boostMax: 0, css: '#e88fb2', dark: '#c0628a',
      desc: 'Повторяет эффект последнего закрытого цвета с текущим комбо. Если закрытий не было — 4 щита.'
    }
  };

  D.junk = {
    stone: {
      id: 'stone', name: 'Камень', css: '#b8afa5', dark: '#8a8076',
      desc: 'Кладётся только на камень или в пустую колбу. Закрытие соседней колбы разбивает камни в ней. Эффекта нет, но комбо растёт.'
    },
    slime: {
      id: 'slime', name: 'Слизь', css: '#b7c46a', dark: '#8e9a45', shield: 3,
      desc: 'Кладётся только на слизь или в пустую колбу. Закрытие: 3 щита (не растёт от комбо).'
    }
  };

  D.startDeck = ['fire', 'water', 'life'];
  D.combo = [1, 1.5, 2, 3];

  D.potions = {
    undo: { id: 'undo', name: 'Отмена', unlock: 1, weight: 10, desc: 'Откатывает последний ход целиком: поле, очередь, комбо, HP, щит, врага, яд и таймеры.' },
    heal: { id: 'heal', name: 'Лечение', unlock: 1, weight: 10, pct: 0.25, desc: 'Лечит 25% от максимума HP.' },
    flask: { id: 'flask', name: 'Пустая склянка', unlock: 1, weight: 8, desc: '+1 пустая колба до конца боя.' },
    solvent: { id: 'solvent', name: 'Растворитель', unlock: 1, weight: 8, desc: 'Убирает верхний слой выбранной колбы (цвет или мусор).' },
    shake: { id: 'shake', name: 'Встряска', unlock: null, later: 'v1.2', weight: 6, desc: 'Перемешивает слои выбранной колбы.' },
    sleep: { id: 'sleep', name: 'Сонное зелье', unlock: 1, weight: 6, delay: 3, desc: 'Действие врага наступит на 3 хода позже.' },
    firebomb: { id: 'firebomb', name: 'Огненная бомба', unlock: 7, weight: 5, mult: 3, desc: 'Урон = 3 × текущий урон закрытия огня (без комбо).' },
    combo: { id: 'combo', name: 'Эликсир комбо', unlock: null, later: 'v1.2', weight: 5, k: 2, desc: 'Следующее закрытие сразу с комбо ×2, дальше комбо растёт как обычно.' }
  };
  D.potionStart = ['undo', 'heal'];

  D.mods = {
    tough: { id: 'tough', name: 'Крепкий алхимик', cap: 3, unlock: 1, maxHp: 10, heal: 10, desc: '+10 к макс. HP и +10 HP.' },
    apron: { id: 'apron', name: 'Кожаный фартук', cap: 3, unlock: 1, pct: 0.10, desc: '−10% урона от атак врага.' },
    caustic: { id: 'caustic', name: 'Едкая смесь', cap: 3, unlock: 1, dmg: 2, desc: '+2 урона огню, молнии и тьме.' },
    bubble: { id: 'bubble', name: 'Пузырь', cap: 3, unlock: 1, shield: 6, desc: '+6 щита в начале каждого боя.' },
    prep: { id: 'prep', name: 'Заготовка', cap: 3, unlock: 1, dmg: 6, desc: '6 урона врагу в начале каждого боя.' },
    thorns: { id: 'thorns', name: 'Шипы', cap: 3, unlock: 1, dmg: 3, desc: 'Враг получает 3 урона за каждую свою атаку.' },
    leech: { id: 'leech', name: 'Кровопийца', cap: 3, unlock: 2, pct: 0.10, desc: '10% нанесённого урона лечит (округление вверх).' },
    combo_master: { id: 'combo_master', name: 'Мастер комбо', cap: 2, unlock: null, later: 'v1.2', add: 0.25, desc: '+0,25 к множителям комбо после первого (×1,75 → ×2,25 → ×3,25).' },
    potion_pick: { id: 'potion_pick', name: 'Зелье на выбор', cap: 0, unlock: 1, choices: 3, desc: 'Выбери 1 из 3 зелий. Не предлагается при полном поясе.' }
  };

  D.finds = {
    new_color: { id: 'new_color', name: 'Новая стихия', unlock: 1, desc: 'Добавь открытую стихию, которой нет в колоде. При 5 стихиях — замени выбранную (её усиления пропадают).' },
    boost_color: { id: 'boost_color', name: 'Усиление стихии', unlock: 1, cap: 3, desc: '+1 шаг усиления выбранной стихии колоды (до 3 на стихию, кроме зеркала).' },
    special_tube: { id: 'special_tube', name: 'Особая колба', unlock: 1, desc: 'Случайная открытая особая колба в пустой слот; если пустых нет — заменить выбранную.' },
    extra_slot: { id: 'extra_slot', name: 'Лишний слот', unlock: 5, maxSlots: 5, desc: '+1 пустая колба в каждом бою (всего слотов до 5).' },
    filter: { id: 'filter', name: 'Фильтр', unlock: 1, cap: 1, pct: 0.5, requires: 'junkEnemy', desc: 'Камней и спор от врагов и мусора в очереди вдвое меньше.' }
  };

  D.tubes = {
    plain: { id: 'plain', name: 'Обычная колба', cap: 4, desc: 'Обычная колба на 4 слоя.' },
    amp: { id: 'amp', name: 'Усилитель', unlock: 3, mult: 2, desc: 'Эффект закрытия ×2.' },
    catalyst: { id: 'catalyst', name: 'Катализатор', unlock: 5, desc: 'Закрытие в ней не тратит ход.' },
    sieve: { id: 'sieve', name: 'Сито', unlock: 3, desc: 'Камень и слизь, налитые в неё, исчезают; такое переливание не тратит ход.' },
    bomb: { id: 'bomb', name: 'Бомба', unlock: 7, targets: 2, desc: 'При закрытии сбивает верхний слой у двух соседних колб (соседи подсвечиваются).' },
    vial: { id: 'vial', name: 'Пробирка', unlock: 10, cap: 2, desc: '2 слоя любых цветов вперемешку, никогда не закрывается.' }
  };

  D.rarity = {
    common: { id: 'common', name: 'Обычная', weight: 60, unlock: 1 },
    rare: { id: 'rare', name: 'Редкая', weight: 30, unlock: 5 },
    legendary: { id: 'legendary', name: 'Легендарная', weight: 10, unlock: 8 }
  };

  function R(id, name, rarity, requires, desc, params) {
    var r = { id: id, name: name, rarity: rarity, requires: requires, desc: desc };
    for (var k in params) r[k] = params[k];
    return r;
  }
  D.relics = {};
  [
    R('hot_crucible', 'Раскалённый тигель', 'common', null, 'Огонь +4 урона.', { dmg: 4 }),
    R('hourglass', 'Песочные часы', 'common', null, 'Первое действие врага в каждом бою на 2 хода позже.', { delay: 2 }),
    R('lucky_clover', 'Счастливый клевер', 'common', null, '15% шанс, что ход не тратится.', { chance: 0.15 }),
    R('golden_stopper', 'Золотая пробка', 'common', null, '+25% монет в этой попытке.', { coinsPct: 0.25 }),
    R('alchemist_heart', 'Сердце алхимика', 'common', null, 'Закрытие на ×2 и выше лечит 3 HP.', { heal: 3, minK: 2 }),
    R('stone_heart', 'Каменное сердце', 'common', { enemy: 'stone' }, 'Каждый разбитый или собранный камень — 4 урона врагу.', { dmg: 4 }),
    R('sponge', 'Губка', 'common', { enemy: 'spores' }, 'Полная колба слизи даёт 10 щита вместо 3.', { shield: 10 }),
    R('blood_retort', 'Кровавый реторт', 'common', { color: 'dark' }, 'Тьма не ранит, а лечит 2 HP.', { heal: 2 }),
    R('storm_rod', 'Громоотвод', 'common', { color: 'lightning' }, 'Молния задерживает врага на 2 хода (на 3 при комбо ×2+).', { delay: 2, delayK2: 3 }),
    R('trap', 'Капкан', 'common', { enemy: 'fieldSpoiler' }, 'Каждый раз, когда враг портит поле (камни, споры, кража, заморозка, обмен), он получает 8 урона.', { dmg: 8 }),
    R('mirror_shield', 'Зеркальный щит', 'rare', { color: 'water' }, 'Остаток щита после атаки врага бьёт его на столько же.', { ratio: 1 }),
    R('crystal_ward', 'Кристальный оберег', 'rare', { color: 'water' }, 'После атаки врага сгорает только половина щита.', { burn: 0.5 }),
    R('frost_crown', 'Ледяная корона', 'rare', { color: 'ice' }, 'По замороженному врагу +100% урона вместо +50%.', { vuln: 1.0 }),
    R('poison_ivy', 'Ядовитый плющ', 'rare', { color: 'poison' }, 'Заряды яда действуют 8 ходов вместо 4.', { turns: 8 }),
    R('void_lens', 'Пустотная линза', 'rare', { color: 'mirror' }, 'Зеркало повторяет эффект дважды.', { times: 2 }),
    R('bandolier', 'Патронташ', 'rare', null, 'В начале каждого боя случайное зелье, если есть место в поясе.', { count: 1 }),
    R('cascade_chute', 'Каскадный жёлоб', 'rare', null, 'Каскадное закрытие поднимает комбо на 2 ступени.', { steps: 2 }),
    R('patient_mage', 'Терпеливый маг', 'rare', null, 'Комбо сбрасывается только после 2 ходов подряд без закрытия.', { grace: 2 }),
    R('philosopher_stone', 'Философский камень', 'legendary', null, 'После каждого действия врага следующее переливание бесплатно.', { free: 1 }),
    R('great_cauldron', 'Великий котёл', 'legendary', null, 'Закрытие на ×3 срабатывает дважды.', { minK: 3, times: 2 }),
    R('phoenix_feather', 'Перо феникса', 'legendary', null, 'Один раз за попытку при смерти — воскрешение с 30% HP.', { hp: 0.3 })
  ].forEach(function (r) { D.relics[r.id] = r; });

  D.lab = {
    vitality: { id: 'vitality', name: 'Прочная склянка', tiers: 8, costs: geo(20, 1.6, 8), unlock: 1, per: { maxHp: 5 }, desc: '+5 к макс. HP за ступень.' },
    essence_fire: { id: 'essence_fire', name: 'Эссенция огня', tiers: 5, costs: geo(30, 1.7, 5), unlock: 1, per: { color: 'fire', dmg: 1 }, desc: 'Огонь +1 за ступень.' },
    essence_water: { id: 'essence_water', name: 'Эссенция воды', tiers: 5, costs: geo(30, 1.7, 5), unlock: 1, per: { color: 'water', shield: 1 }, desc: 'Вода +1 за ступень.' },
    essence_life: { id: 'essence_life', name: 'Эссенция жизни', tiers: 5, costs: geo(30, 1.7, 5), unlock: 1, per: { color: 'life', heal: 1 }, desc: 'Жизнь +1 за ступень.' },
    start_shield: { id: 'start_shield', name: 'Защитная пробка', tiers: 4, costs: geo(40, 1.7, 4), unlock: 1, per: { shield: 3 }, desc: '+3 щита в начале каждого боя за ступень.' },
    belt: { id: 'belt', name: 'Пояс зелий', tiers: 2, costs: [80, 300], unlock: 2, per: [{ startPotion: 1 }, { beltSlot: 1 }], desc: 'Ступень 1: +1 случайное зелье на старте. Ступень 2: +1 слот пояса.' },
    intuition: { id: 'intuition', name: 'Чутьё', tiers: 1, costs: [400], unlock: 3, per: { choices: 1 }, desc: '4 варианта выбора вместо 3.' },
    second_wind: { id: 'second_wind', name: 'Второе дыхание', tiers: 2, costs: [120, 300], unlock: 3, per: { healAfter: 0.05 }, desc: '+5% к лечению после этапа за ступень.' },
    mastery: { id: 'mastery', name: 'Алхимическое мастерство', tiers: 4, costs: geo(150, 1.8, 4), unlock: 6, per: { effectPct: 0.05 }, desc: '+5% ко всем эффектам цветов за ступень.' },
    slot: { id: 'slot', name: 'Лишний слот', tiers: 2, costs: [300, 700], unlock: 5, per: { slots: 1 }, desc: '+1 пустая колба за ступень.' },
    thrift: { id: 'thrift', name: 'Бережливость', tiers: 3, costs: geo(100, 2, 3), unlock: 4, per: { coinsPct: 0.10 }, desc: '+10% монет за ступень.' }
  };

  D.boosters = {
    booster_potion: { id: 'booster_potion', name: 'Зелье на выбор', gems: 13, desc: 'Любое открытое зелье в пояс.' },
    booster_flask: { id: 'booster_flask', name: 'Запасная колба', gems: 20, slots: 1, desc: '+1 пустая колба в каждом бою.' },
    booster_vitality: { id: 'booster_vitality', name: 'Крепость', gems: 13, maxHp: 20, desc: '+20 к макс. HP на попытку.' },
    booster_first_strike: { id: 'booster_first_strike', name: 'Первый удар', gems: 10, mult: 2, desc: '×2 урона всех эффектов на первом этапе.' }
  };

  function E(id, name, world, archetype, hp, cycle, desc) {
    return { id: id, name: name, world: world, archetype: archetype, hp: hp, cycle: cycle, art: id, desc: desc };
  }
  function c(t, v, turns) { return { t: t, v: v, turns: turns }; }

  D.enemies = {};
  [
    E('slime', 'Слизень', 1, 'attacker', 18, [c('atk', 5, 3)], 'Бьёт на 5 каждые 3 хода.'),
    E('gremlin', 'Гремлин-вор', 1, 'thief', 20, [c('atk', 4, 2), c('steal', 0, 2)], 'Бьёт на 4, ворует слои.'),
    E('beetle', 'Колючий жук', 1, 'shaman', 22, [c('shield', 6, 2), c('atk', 6, 3)], 'Прикрывается щитом 6, бьёт на 6.'),
    E('golem', 'Каменный голем', 2, 'mason', 28, [c('stone', 2, 3), c('atk', 9, 3)], 'Сыплет камни, бьёт на 9.'),
    E('boulder', 'Валун-катун', 2, 'attacker', 34, [c('atk', 14, 5)], 'Редкий, но тяжёлый удар: 14.'),
    E('mole', 'Скальный крот', 2, 'thief', 24, [c('steal', 0, 2), c('atk', 6, 3)], 'Ворует слои, бьёт на 6.'),
    E('frost_spirit', 'Инейный дух', 3, 'froster', 24, [c('freeze', 3, 2), c('atk', 5, 2)], 'Замораживает колбы на 3 хода, бьёт на 5.'),
    E('ice_wolf', 'Ледяной волк', 3, 'attacker', 22, [c('atk', 4, 2)], 'Быстрые укусы: 4 каждые 2 хода.'),
    E('snow_golem', 'Снежный голем', 3, 'mason', 30, [c('stone', 2, 2), c('shield', 6, 2), c('atk', 7, 3)], 'Камни, щит 6 и удар на 7.'),
    E('mycelium', 'Грибница', 4, 'sporer', 26, [c('spores', 2, 2), c('atk', 6, 3)], 'Превращает слои очереди в слизь, бьёт на 6.'),
    E('toad_shaman', 'Мухомор-шаман', 4, 'shaman', 28, [c('shield', 8, 2), c('buff', 0, 1), c('atk', 7, 3)], 'Щит 8, усиливает следующую атаку ×2, бьёт на 7.'),
    E('rot_slime', 'Гнилой слизень', 4, 'sporer', 24, [c('atk', 5, 2), c('spores', 1, 2)], 'Бьёт на 5, гноит очередь.'),
    E('imp', 'Огненный бес', 5, 'attacker', 26, [c('atk', 6, 2)], 'Бьёт на 6 каждые 2 хода.'),
    E('lava_golem', 'Лавовый голем', 5, 'mason', 34, [c('stone', 3, 3), c('atk', 10, 3)], 'Сыплет 3 камня, бьёт на 10.'),
    E('ash_trickster', 'Пепельный плут', 5, 'thief', 26, [c('swap', 0, 3), c('atk', 8, 3)], 'Меняет цвета местами, бьёт на 8.')
  ].forEach(function (e) { D.enemies[e.id] = e; });

  function B(id, name, islands, hp, cycle, extra, final, desc) {
    return { id: id, name: name, islands: islands, world: Math.ceil(islands[0] / 2), hp: hp, cycle: cycle, extra: extra, final: !!final, art: id, desc: desc };
  }
  D.bosses = {};
  [
    B('slime_king', 'Король слизней', [1, 2], 36, [c('atk', 7, 3), c('spores', 2, 2), c('atk', 9, 3)], c('shield', 6, 2), false, 'Бьёт, гноит очередь. На втором острове ещё и щит.'),
    B('ancient_golem', 'Древний голем', [3, 4], 48, [c('stone', 3, 2), c('atk', 12, 4), c('shield', 12, 2)], c('buff', 0, 1), false, 'Камни, тяжёлые удары и щит 12.'),
    B('ice_queen', 'Ледяная королева', [5, 6], 40, [c('freeze', 3, 2), c('atk', 8, 3), c('shield', 8, 2), c('atk', 10, 3)], c('steal', 0, 2), false, 'Морозит колбы и закрывается щитом.'),
    B('mycelium_mother', 'Матка грибницы', [7, 8], 46, [c('spores', 3, 2), c('atk', 9, 3), c('heal', 6, 2)], c('stone', 2, 2), false, 'Гноит очередь и лечится.'),
    B('lava_serpent', 'Лавовый змей', [9], 50, [c('atk', 10, 3), c('stone', 2, 2), c('buff', 0, 1), c('atk', 8, 2)], null, false, 'Жжёт, сыплет камни, усиливает удар.'),
    B('trickster', 'Алхимик-обманщик', [10], 54, [c('atk', 8, 3), c('swap', 0, 2), c('shield', 10, 2), c('buff', 0, 1), c('atk', 7, 3)], null, true, 'Финальный босс: путает цвета, щитится, усиливает удар.')
  ].forEach(function (b) { D.bosses[b.id] = b; });

  // Tags drive relic/find "requires" without the core scanning cycles.
  function tagsOf(cycle, extra) {
    var all = extra ? cycle.concat([extra]) : cycle, tags = [];
    function add(t) { if (tags.indexOf(t) < 0) tags.push(t); }
    all.forEach(function (a) {
      if (a.t === 'stone') { add('stone'); add('junkEnemy'); add('fieldSpoiler'); }
      else if (a.t === 'spores') { add('spores'); add('junkEnemy'); add('fieldSpoiler'); }
      else if (a.t === 'freeze' || a.t === 'steal' || a.t === 'swap') add('fieldSpoiler');
    });
    return tags;
  }
  Object.keys(D.enemies).forEach(function (k) { D.enemies[k].tags = tagsOf(D.enemies[k].cycle, null); });
  Object.keys(D.bosses).forEach(function (k) {
    var b = D.bosses[k];
    b.tags = tagsOf(b.cycle, null);
    b.tagsExtra = tagsOf(b.cycle, b.extra);
  });

  D.worlds = [
    { n: 1, id: 'meadows', name: 'Изумрудные Луга', nameEn: 'Emerald Meadows', theme: 'day', twist: null, boss: 'slime_king',
      palette: { sky: '#bfe6f5', ground: '#7fc46a', accent: '#f6d36b' }, desc: 'Особенностей нет — обучение.' },
    { n: 2, id: 'crags', name: 'Гремящие Скалы', nameEn: 'Rumbling Crags', theme: 'day', twist: { type: 'stonefall', every: 8 }, boss: 'ancient_golem',
      palette: { sky: '#f3d7b0', ground: '#a89684', accent: '#e58a4d' }, desc: 'Каждые 8 ходов на поле падает 1 камень.' },
    { n: 3, id: 'frost', name: 'Хрустальные Льды', nameEn: 'Crystal Frost', theme: 'day', twist: { type: 'frozenStart', turns: 3 }, boss: 'ice_queen',
      palette: { sky: '#d4eefa', ground: '#e8f4fb', accent: '#6fb8e0' }, desc: 'В начале боя одна случайная колба заморожена на 3 хода.' },
    { n: 4, id: 'gloomwood', name: 'Сумрачная Чаща', nameEn: 'Gloomwood', theme: 'night', twist: { type: 'slimeQueue', pct: 0.1 }, boss: 'mycelium_mother',
      palette: { sky: '#1f2646', ground: '#3b5a4a', accent: '#c58bd9' }, desc: '10% слоёв очереди — слизь.' },
    { n: 5, id: 'ashlands', name: 'Пепельные Земли', nameEn: 'Ashlands', theme: 'night', twist: { type: 'burn', dmg: 1, turns: 2 }, boss: 'lava_serpent',
      palette: { sky: '#2a1a24', ground: '#5a3a34', accent: '#ff7a3d' }, desc: 'Атаки врагов поджигают: 1 урон за ход, 2 хода, мимо щита.' }
  ];
  D.worlds[4].bossFinal = 'trickster';

  function I(n, id, world, name, nameEn, tier, stages, bossAt, regulars, M, A, final) {
    return { n: n, id: id, world: world, name: name, nameEn: nameEn, tier: tier, stages: stages, bossAt: bossAt, boss: n === 10 ? 'trickster' : D.worlds[world - 1].boss,
      regulars: regulars, M: M, A: A, final: !!final, hard: tier === 'hard' };
  }
  D.islands = [
    I(1, 'sunny_shallows', 1, 'Солнечные Отмели', 'Sunny Shallows', 'easy', 4, [4], ['slime'], 1.0, 0),
    I(2, 'slime_bog', 1, 'Трясина Слизней', 'Slime Bog', 'medium', 6, [3, 6], ['slime', 'gremlin', 'beetle'], 1.6, 4),
    I(3, 'golem_gorge', 2, 'Ущелье Големов', 'Golem Gorge', 'medium', 8, [4, 8], ['golem', 'boulder', 'mole'], 1.6, 2),
    I(4, 'ancients_peak', 2, 'Пик Древнего', "Ancient's Peak", 'hard', 12, [4, 8, 12], ['golem', 'boulder', 'mole'], 2.0, 2),
    I(5, 'rime_harbor', 3, 'Инейная Гавань', 'Rime Harbor', 'medium', 8, [4, 8], ['frost_spirit', 'ice_wolf', 'snow_golem'], 2.3, 5),
    I(6, 'queens_palace', 3, 'Дворец Королевы', "Queen's Palace", 'medium', 10, [5, 10], ['frost_spirit', 'ice_wolf', 'snow_golem'], 2.6, 5),
    I(7, 'toadstool_mire', 4, 'Мухоморная Топь', 'Toadstool Mire', 'hard', 14, [5, 10, 14], ['mycelium', 'toad_shaman', 'rot_slime'], 2.25, 7),
    I(8, 'mycelium_heart', 4, 'Сердце Грибницы', 'Mycelium Heart', 'medium', 10, [5, 10], ['mycelium', 'toad_shaman', 'rot_slime'], 2.5, 7),
    I(9, 'lava_steps', 5, 'Лавовые Ступени', 'Lava Steps', 'medium', 12, [4, 8, 12], ['imp', 'lava_golem', 'ash_trickster'], 2.5, 1),
    I(10, 'tricksters_tower', 5, 'Башня Обманщика', "Trickster's Tower", 'hard', 15, [5, 10, 15], ['imp', 'lava_golem', 'ash_trickster'], 2.8, 4, true)
  ];
  // P scales packs, daily and quest coins; pinned apart from M so enemy tuning does not shift the economy.
  [1.0, 1.25, 1.5, 1.9, 2.0, 2.3, 2.7, 2.8, 3.1, 3.5].forEach((p, i) => { D.islands[i].P = p; });

  // At most 2 gameplay novelties per island (one card each after the previous island); lab and relic rarity open quietly.
  // Finds like new_color / special_tube / filter sit in the starting pool but only show up once they have something to offer.
  D.unlocks = {
    1: { elements: ['fire', 'water', 'life'], potions: ['undo', 'heal', 'flask', 'solvent', 'sleep'], mods: ['tough', 'apron', 'caustic', 'bubble', 'potion_pick', 'prep', 'thorns'], finds: ['boost_color', 'new_color', 'special_tube', 'filter'], tubes: [], lab: ['vitality', 'essence_fire', 'essence_water', 'essence_life', 'start_shield'], relicRarity: 'common', note: 'Обучение: огонь, вода, жизнь' },
    2: { elements: ['poison'], potions: [], mods: ['leech'], finds: [], tubes: [], lab: ['belt'], relicRarity: null, note: 'Новая стихия: яд' },
    3: { elements: [], potions: [], mods: [], finds: [], tubes: ['amp', 'sieve'], lab: ['intuition', 'second_wind'], relicRarity: null, note: 'Особые колбы: Усилитель и Сито' },
    4: { elements: ['lightning'], potions: [], mods: [], finds: [], tubes: [], lab: ['thrift'], relicRarity: null, note: 'Новая стихия: молния' },
    5: { elements: [], potions: [], mods: [], finds: ['extra_slot'], tubes: ['catalyst'], lab: ['slot'], relicRarity: 'rare', note: 'Катализатор и Лишний слот' },
    6: { elements: ['ice'], potions: [], mods: [], finds: [], tubes: [], lab: ['mastery'], relicRarity: null, note: 'Новая стихия: лёд' },
    7: { elements: [], potions: ['firebomb'], mods: [], finds: [], tubes: ['bomb'], lab: [], relicRarity: null, note: 'Бомба и Огненная бомба' },
    8: { elements: ['dark'], potions: [], mods: [], finds: [], tubes: [], lab: [], relicRarity: 'legendary', note: 'Новая стихия: тьма' },
    9: { elements: ['mirror'], potions: [], mods: [], finds: [], tubes: [], lab: [], relicRarity: null, note: 'Новая стихия: зеркало' },
    10: { elements: [], potions: [], mods: [], finds: [], tubes: ['vial'], lab: [], relicRarity: null, note: 'Пробирка' }
  };

  D.economy = {
    player: { hp: 50 }, cap: 4, filledMin: 5, slots: { base: 3, max: 5 }, belt: { base: 3, max: 4 }, deckMax: 5,
    drain: { hp: 3 }, heal: { regular: 0.10, boss: 0.25 }, potionDrop: 0.20, relicInPick: { chance: 0.15, from: 4 },
    picks: { choices: 3, minMod: 1, minFind: 1 }, emptyPoolCoins: 15,
    // [a, b] = a + b*i, i = island number; first = per island number (20 * i)
    coins: { reg: [4, 2], flee: [8, 3], kill: [15, 5], first: 20, hardMult: 1.25 },
    gems: { start: 30, first: 5, firstHard: 10, adGift: 2, adGiftPerDay: 3, questsAll: 5 },
    // lives: stored free revives (daily gift); with a full stock the gift's coins are given instead
    revive: { hp: 0.5, gems: 20, perRun: 1 }, lives: { max: 5 }, reroll: { gems: 7, mult: 2 }, skip: [5, 1],
    // A beaten boss leaves and comes back next encounter with returnHp of its max HP (and a plaster).
    boss: { returnHp: 0.5, rageAt: 0.33, rageTimer: 1 },
    enemyHeals: 3,
    interstitial: { fromIsland: 3, minSec: 180 },
    ads: { resultsMult: 2, dailyMult: 2 },
    // Pack, daily and quest coins are multiplied by P of the max open island.
    scaleP: ['coinPacks', 'daily', 'quests']
  };

  D.daily = [{ coins: 30 }, { coins: 50 }, { gems: 5 }, { lives: 1, coins: 80 }, { coins: 100 }, { coins: 120 }, { gems: 15 }];

  // n = [a, b] -> a + b*i; scaleP: n additionally scaled for coin amounts. {color} filled from deck at generation.
  D.quests = [
    { id: 'close_color', text: 'Закрой {n} колб {color}', event: 'close', filter: { color: '$deck' }, n: [8, 2], requires: null },
    { id: 'kill', text: 'Победи {n} врагов', event: 'kill', filter: null, n: [3, 1], requires: null },
    { id: 'boss_reach', text: 'Дойди до встречи с боссом', event: 'boss_reach', filter: null, n: [1, 0], requires: null },
    { id: 'combo3', text: 'Собери комбо ×3', event: 'combo', filter: { k: 3 }, n: [1, 0], requires: null },
    { id: 'close_junk', text: 'Закрой {n} колб мусора', event: 'close', filter: { junk: true }, n: [3, 1], requires: { island: 3 } },
    { id: 'potions', text: 'Используй {n} зелий', event: 'potion', filter: null, n: [2, 1], requires: null },
    { id: 'stages', text: 'Пройди {n} этапов за день', event: 'stage', filter: null, n: [4, 1], requires: null },
    { id: 'lab_spend', text: 'Потрать {n} монет в Лаборатории', event: 'lab_spend', filter: null, n: [60, 30], scaleP: true, requires: { lab: true } }
  ];
  D.questsPerDay = 3;
  D.questReward = { coins: 40, perP: true };

  D.shop = {
    products: [
      { id: 'gems_small', name: 'Горсть кристаллов', price: '$0,99', usd: 0.99, gems: 80 },
      { id: 'gems_medium', name: 'Мешочек кристаллов', price: '$4,99', usd: 4.99, gems: 450 },
      { id: 'gems_large', name: 'Сундук кристаллов', price: '$9,99', usd: 9.99, gems: 1000 },
      { id: 'gems_huge', name: 'Сокровищница', price: '$19,99', usd: 19.99, gems: 2200 },
      { id: 'no_ads', name: 'Без рекламы', price: '$3,99', usd: 3.99, desc: 'Навсегда убирает рекламу между забегами. Реклама за награды остаётся по желанию.' },
      { id: 'starter', name: 'Стартовый набор', price: '$1,99', usd: 1.99, gems: 150, coins: 600, hours: 48, afterIsland: 2, once: true, desc: '150 💎 и 600 🪙. Разово, 48 часов после острова 2.' },
      { id: 'seal', name: 'Печать алхимика', price: '$4,99', usd: 4.99, days: 30, desc: '30 дней: +50% монет, ежедневная награда ×2, воскрешение без рекламы, нет рекламы между забегами.' }
    ],
    coinPacks: [
      { id: 'coins_small', name: 'Малая пачка', gems: 20, coins: 150 },
      { id: 'coins_medium', name: 'Средняя пачка', gems: 50, coins: 400 },
      { id: 'coins_large', name: 'Большая пачка', gems: 120, coins: 1000 }
    ]
  };

  D.seal = { days: 30, coinsMult: 1.5, dailyMult: 2 };

  PS.DATA = D;
})();
