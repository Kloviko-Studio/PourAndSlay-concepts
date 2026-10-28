var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';

  const screens = {};
  let cur = null;          // {name, impl, el, params}
  let toastTimer = null;
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => {
    const v = Math.round(n || 0);
    return Math.abs(v) >= 10000 ? v.toLocaleString(T.lang() === 'ru' ? 'ru-RU' : 'en-US') : String(v);
  };
  const hhmm = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    return `${hh}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const D = () => PS.DATA || {};
  const P = () => (PS.Meta && PS.Meta.profile) || null;
  const has = (o, fn) => !!(o && typeof o[fn] === 'function');
  const T = PS.T;

  const UI = PS.UI = {
    h, esc, fmt, sleep, $,
    timeShift: 0,          // debug: shifts "now" to test daily/quests rollover
    now: () => Date.now() + UI.timeShift,
    speed: 1,
    save() { if (has(PS.Meta, 'save')) PS.Meta.save(); },
    hhmm,
    msToMidnight() { const n = new Date(UI.now()), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; },
    current: () => (cur ? cur.name : null),
    currentParams: () => (cur ? cur.params : null),
  };

  // ---------- items: one lookup for every kind of content ----------
  const KINDS = {
    colors: 'colors', color: 'colors', potions: 'potions', potion: 'potions', mods: 'mods', mod: 'mods',
    finds: 'finds', find: 'finds', tubes: 'tubes', tube: 'tubes', lab: 'lab', relics: 'relics', relic: 'relics',
    enemies: 'enemies', enemy: 'enemies', bosses: 'bosses', boss: 'bosses', boosters: 'boosters', booster: 'boosters',
  };
  UI.item = function (kind, id) {
    const k = KINDS[kind] || kind, src = D()[k];
    const it = src && src[id];
    if (!it) return { id, kind: k, icon: '❔', name: String(id), desc: '' };
    return Object.assign({ kind: k, id, icon: '❔', name: String(id), desc: '' }, it);
  };
  // Meta.newUnlocks gives {kind, id}; relicRarity is a pseudo-item, so it gets its own label.
  UI.unlockLabel = function (u) {
    if (!u) return null;
    if (typeof u === 'string') {
      const i = u.indexOf(':');
      if (i < 0) return { icon: '✨', name: u, desc: '' };
      u = { kind: u.slice(0, i), id: u.slice(i + 1) };
    }
    if (u.kind === 'relicRarity') {
      const names = { common: T('Обычные реликвии', 'Common relics'), rare: T('Редкие реликвии', 'Rare relics'), legendary: T('Легендарные реликвии', 'Legendary relics') };
      return { icon: '🏺', name: names[u.id] || T('Реликвии', 'Relics'), desc: T('Новые реликвии в наградах за босса.', 'New relics in boss rewards.') };
    }
    const it = UI.item(u.kind, u.id);
    return { icon: it.icon, name: it.name, desc: it.desc, kind: it.kind, id: it.id };
  };
  UI.unlockList = function (n) {
    if (has(PS.Meta, 'newUnlocks')) return PS.Meta.newUnlocks(n);
    const u = (D().unlocks || {})[n], out = [];
    if (!u) return out;
    Object.keys(u).forEach(kind => {
      if (kind === 'note') return;
      const v = u[kind];
      if (Array.isArray(v)) v.forEach(id => out.push({ kind, id }));
      else if (typeof v === 'string') out.push({ kind, id: v });
    });
    return out;
  };

  UI.island = n => (D().islands || [])[n - 1] || null;
  UI.world = n => {
    const isl = UI.island(n);
    return isl ? (D().worlds || []).find(w => w.n === isl.world) || null : null;
  };
  UI.islandCount = () => (D().islands || []).length;

  // ---------- art with graceful fallbacks (PS.Art is written by another module) ----------
  function fallbackIsland(n) {
    const w = UI.world(n) || {}, pal = w.palette || {};
    const g = pal.ground || '#6cc46b', a = pal.accent || '#ffcf4a';
    return `<svg viewBox="0 0 240 200" class="art-island-svg"><ellipse cx="120" cy="180" rx="70" ry="9" fill="#0003"/>
      <path d="M30 92 Q120 70 210 92 Q190 150 120 172 Q50 150 30 92Z" fill="#8a5a3b"/><path d="M60 118 Q120 160 180 118 L150 150 Q120 175 90 150Z" fill="#6b4329"/>
      <ellipse cx="120" cy="92" rx="92" ry="22" fill="${g}"/><ellipse cx="110" cy="86" rx="60" ry="12" fill="#ffffff22"/>
      <circle cx="80" cy="70" r="16" fill="${g}" stroke="#0002" stroke-width="3"/><rect x="77" y="78" width="6" height="14" fill="#6b4329"/>
      <path d="M140 88 L150 52 L160 88Z" fill="${a}"/><circle cx="150" cy="50" r="4" fill="#fff"/></svg>`;
  }
  UI.islandArt = function (n, opts) {
    const isl = UI.island(n);
    try { if (PS.Art && PS.Art.island) { const s = PS.Art.island(isl ? isl.world : 1, n, opts); if (s) return s; } } catch (e) { console.warn(e); }
    return fallbackIsland(n);
  };
  // opts: {rage, patched}
  UI.enemyArt = function (id, opts) {
    const D_ = D(), boss = !!(D_.bosses || {})[id];
    const it = (D_.enemies || {})[id] || (D_.bosses || {})[id] || {};
    try {
      if (PS.Art) {
        const fn = boss ? PS.Art.boss : PS.Art.enemy;
        const s = fn && fn(it.art || id, opts);
        if (s) return s;
      }
    } catch (e) { console.warn(e); }
    return `<div class="art-fallback">${it.icon || '👾'}</div>`;
  };

  // ---------- icons: SVGs from the approved cloud-pastel mockups, used as-is ----------
  const stroke = (w, c) => `fill="none" stroke="${c || '#3a4a5a'}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  UI.ico = {
    coin: s => `<svg width="${s || 26}" height="${s || 26}" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11" fill="#ffd36b" stroke="#e8a93a" stroke-width="2"/><circle cx="13" cy="13" r="6.5" fill="none" stroke="#f0b94a" stroke-width="2"/><ellipse cx="9" cy="7.8" rx="3" ry="1.6" fill="#fff" opacity=".75"/></svg>`,
    gem: s => `<svg width="${s || 26}" height="${s || 26}" viewBox="0 0 26 26" aria-hidden="true"><path d="M6 4h14l5 7-12 13L1 11z" fill="#9fe6f0" stroke="#45a9bd" stroke-width="2" stroke-linejoin="round"/><path d="M1 11h24M8 4l5 20M18 4l-5 20" fill="none" stroke="#fff" stroke-width="1.2" opacity=".75"/><path d="M7.5 6.5h3l-1.5 3z" fill="#fff" opacity=".8"/></svg>`,
    crown: s => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l-1-9 5 4 4-6 4 6 5-4-1 9z" fill="#ffd36b" stroke="#e8a93a" stroke-width="1.5" stroke-linejoin="round"/><rect x="4" y="17" width="16" height="3" rx="1.5" fill="#e8a93a"/><circle cx="12" cy="13" r="1.4" fill="#f0584a"/></svg>`,
    check: s => `<svg width="${s || 14}" height="${s || 14}" viewBox="0 0 24 24" ${stroke(4, '#fff')} aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
    left: `<svg width="18" height="18" viewBox="0 0 24 24" ${stroke(3)} aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
    right: `<svg width="18" height="18" viewBox="0 0 24 24" ${stroke(3)} aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" ${stroke(3.4)} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    lock: '<svg width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/><path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#c9d3dc" stroke-width="2.2" stroke-linecap="round"/><rect x="4" y="10" width="16" height="12" rx="3.5" fill="#ffd36b" stroke="#fff" stroke-width="1.6"/><rect x="5.5" y="11.5" width="13" height="3" rx="1.5" fill="#fff" opacity=".45"/><circle cx="12" cy="15.6" r="1.7" fill="#c4881a"/><path d="M12 16.5v2.4" stroke="#c4881a" stroke-width="1.8" stroke-linecap="round"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#3a4a5a" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="2.5"/><rect x="14" y="4" width="5" height="16" rx="2.5"/></svg>',
    bag: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l2 12H4z" fill="#ffd6c2" stroke="#3a4a5a" stroke-width="2" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="#3a4a5a" stroke-width="2" stroke-linecap="round"/></svg>`,
    heart: s => `<svg width="${s || 28}" height="${s || 28}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8.5-5.3-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.7 12 21 12 21z" fill="#ff8f8f" stroke="#fff" stroke-width="2.2"/><ellipse cx="8" cy="9.5" rx="2" ry="1.2" fill="#fff" opacity=".8"/></svg>`,
    shield: s => `<svg width="${s || 13}" height="${s || 13}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" fill="#5aa2ea"/></svg>`,
    drop: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z" fill="#fff"/></svg>',
    undo: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b4fb0" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    heal: '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 2.5h5M10.5 2.5v5l-5 8a4 4 0 0 0 3.4 6h6.2a4 4 0 0 0 3.4-6l-5-8v-5" fill="#fff" stroke="#e05a6a" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 15.5h10l1 1.5a3 3 0 0 1-2.6 4.5H8.6A3 3 0 0 1 6 17z" fill="#ff8f8f"/><path d="M12 15.8s-2.2-1.4-2.2-2.9a1.2 1.2 0 0 1 2.2-.7 1.2 1.2 0 0 1 2.2.7c0 1.5-2.2 2.9-2.2 2.9z" fill="#fff"/></svg>',
    // white marks on the colour layers; colours without one keep their emoji
    mark: {
      fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1 3.6 5.5 5.6 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.8 1.8-4.3 2-7 1.5 1.1 2.8 2.6 2.8 4.1.7-2.8.7-5 .7-7.7z" fill="#fff"/></svg>',
      water: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4.5 6 7.6 6 11.2a6 6 0 0 1-12 0C6 10.6 9 7.5 12 3z" fill="#fff"/></svg>',
      life: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 11 5 19 5c0 8-5 14-14 14z" fill="#fff"/><path d="M5.5 18.5l8-8" stroke="#6fbb57" stroke-width="1.8" stroke-linecap="round"/></svg>',
    },
  };
  const ICO = UI.ico;
  // Painted icons for the top bar, bottom tabs and main-screen buttons.
  UI.art = (name, s) => `<img class="art-ico" src="img/icons/main_screen/${name}.webp" width="${s}" height="${s}" alt="" draggable="false">`;
  const icoCoin = UI.art('coin', 28), icoGem = UI.art('diamond', 28);

  // ---------- stage strip (shared by main, start, results, battle) ----------
  // opts: {n, current (1-based stage in progress, 0 = none), best, compact}
  UI.stageBar = function (opts) {
    const isl = UI.island(opts.n) || { stages: 1, bossAt: [] };
    const S = isl.stages || 1, bossAt = isl.bossAt || [];
    // First stage at the left edge, last at the right: the final boss must read as the end of the line.
    const pos = k => (k <= 0 ? 0 : S === 1 ? 100 : (k - 1) / (S - 1) * 100).toFixed(2) + '%';
    const best = Math.min(opts.best || 0, S), cur = Math.min(opts.current || 0, S);
    let marks = '';
    for (let k = 1; k <= S; k++) {
      const boss = bossAt.indexOf(k) >= 0;
      const passed = cur ? k < cur : k <= best;
      marks += `<i class="sbar-mark${boss ? ' boss' : ''}${passed ? ' passed' : ''}${k === cur ? ' cur' : ''}" style="left:${pos(k)}">${boss ? ICO.crown(18) : ''}</i>`;
    }
    // The record is the faded part of the line; a separate flag only collided with labels above the strip.
    const pin = cur ? `<b class="sbar-pin" style="left:${pos(cur)}"></b>` : '';
    return `<div class="sbar${opts.compact ? ' compact' : ''}"><div class="sbar-track">
      <div class="sbar-best" style="width:${pos(best)}"></div><div class="sbar-fill" style="width:${pos(cur)}"></div>
      ${marks}${pin}</div></div>`;
  };

  // ---------- router ----------
  UI.screen = function (name, impl) { screens[name] = impl; };
  UI.go = function (name, params) {
    const impl = screens[name];
    if (!impl) { console.warn('No screen', name); UI.toast(T('Экран «' + name + '» ещё не готов', 'Screen "' + name + '" isn\'t ready yet')); return; }
    const host = $('screen');
    const prev = cur;
    if (prev && prev.impl.unmount) { try { prev.impl.unmount(prev.el); } catch (e) { console.error(e); } }
    const prevRect = prev ? prev.el.getBoundingClientRect() : null;
    const el = h('div', 'scr scr-' + name);
    cur = { name, impl, el, params: params || {} };
    document.body.dataset.screen = name;
    const chrome = Object.assign({ topbar: true, tabs: true, tab: null, theme: 'navy' }, impl.chrome || {});
    $('topbar').hidden = !chrome.topbar;
    $('tabs').hidden = !chrome.tabs;
    UI.setTheme(chrome.theme);
    UI.tabs.render(chrome.tab);
    if (prev) {
      // Pin the outgoing screen: showing/hiding the topbar and tabs resizes #screen and would make it jump during the fade.
      Object.assign(prev.el.style, { top: prevRect.top - host.getBoundingClientRect().top + 'px', bottom: 'auto', height: prevRect.height + 'px', pointerEvents: 'none' });
    }
    host.appendChild(el);
    try { impl.mount(el, cur.params); } catch (e) { console.error(e); el.innerHTML = `<div class="scr-error">${T('Ошибка экрана', 'Screen error')}: ${esc(e.message)}</div>`; }
    UI.topbar();
    if (prev) {
      const old = prev.el;
      const a = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' });
      PS.Fx.settle(a, 160).then(() => old.remove());
      el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  };
  UI.refresh = function () { if (cur) UI.go(cur.name, cur.params); };

  // theme: 'day' | 'night' | 'navy'; optional sky colours from world palette
  UI.setTheme = function (theme, pal) {
    document.body.dataset.theme = theme || 'navy';
    const s = document.body.style;
    if (pal && pal.sky) s.setProperty('--sky-tint', pal.sky); else s.removeProperty('--sky-tint');
  };

  // ---------- topbar ----------
  UI.topbar = function () {
    const p = P(), bar = $('topbar');
    if (!bar || !p) return;
    const now = UI.now();
    const seal = has(PS.Meta, 'sealActive') && PS.Meta.sealActive(now);
    const days = seal && has(PS.Meta, 'sealDaysLeft') ? PS.Meta.sealDaysLeft(now) : 0;
    bar.innerHTML = `
      <button class="tb-seal${seal ? ' on' : ''}" data-act="seal" aria-label="${T('Печать алхимика', "Alchemist's Seal")}">
        <span class="tb-seal-ico">${UI.art('seal', 28)}</span><span class="tb-seal-txt">${seal ? days + T(' дн.', 'd') : T('Печать', 'Seal')}</span></button>
      <div class="tb-mid">
        <button class="pill pill-coin" data-act="coins" aria-label="${T(`Монеты: ${fmt(p.coins)}. Магазин`, `Coins: ${fmt(p.coins)}. Shop`)}"><span class="pill-ico">${icoCoin}</span><b data-cur="coins">${fmt(p.coins)}</b></button>
        <button class="pill pill-gem" data-act="gems" aria-label="${T(`Кристаллы: ${fmt(p.gems)}. Магазин`, `Gems: ${fmt(p.gems)}. Shop`)}"><span class="pill-ico">${icoGem}</span><b data-cur="gems">${fmt(p.gems)}</b></button>
      </div>
      <button class="pill tb-gear" data-act="settings" aria-label="${T('Настройки', 'Settings')}">${UI.art('settings', 30)}</button>`;
    bar.querySelector('[data-act=seal]').onclick = () => { PS.Snd.play('select'); UI.go('seal', { back: UI.current() }); };
    bar.querySelector('[data-act=coins]').onclick = () => { PS.Snd.play('select'); UI.go('shop', { focus: 'coins' }); };
    bar.querySelector('[data-act=gems]').onclick = () => { PS.Snd.play('select'); UI.go('shop', { focus: 'gems' }); };
    bar.querySelector('[data-act=settings]').onclick = () => { PS.Snd.play('select'); UI.go('settings', { back: UI.current() }); };
    UI.tabs.badges();
  };
  // Animated counter bump without re-rendering the whole bar.
  UI.bumpCurrency = function (kind) {
    const el = document.querySelector(`#topbar [data-cur=${kind}]`);
    if (!el || !P()) return;
    el.textContent = fmt(P()[kind]);
    el.parentNode.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 300 });
  };
  UI.currencyTarget = kind => document.querySelector(`#topbar .pill-${kind === 'gems' ? 'gem' : 'coin'} .pill-ico`);
  // Coins/gems fly from an element into the topbar pill.
  UI.flyCurrency = function (fromEl, kind, count) {
    const to = UI.currencyTarget(kind);
    if (!fromEl || !to || $('topbar').hidden) { UI.topbar(); return Promise.resolve(); }
    const a = fromEl.getBoundingClientRect ? PS.Fx.centerOf(fromEl) : fromEl, b = PS.Fx.centerOf(to);
    const n = Math.max(1, Math.min(count || 6, 10)), color = kind === 'gems' ? '#7fe6ff' : '#ffcf4a';
    const all = [];
    for (let i = 0; i < n; i++) {
      all.push(sleep(i * 60).then(() => PS.Fx.fly({ x: a.x + (Math.random() * 40 - 20), y: a.y }, b, color, { size: 14, dur: 520, arc: -60, trail: false }))
        .then(() => { PS.Snd.play('coin'); UI.bumpCurrency(kind); }));
    }
    return Promise.all(all).then(() => UI.topbar());
  };

  // ---------- bottom tabs ----------
  const TABS = [
    { id: 'shop', label: T('Магазин', 'Shop'), icon: UI.art('market', 34) },
    { id: 'lab', label: T('Лаборатория', 'Lab'), icon: UI.art('laboratory', 34) },
    { id: 'main', label: T('Мир', 'World'), icon: UI.art('world', 36) },
    { id: 'collection', label: T('Коллекция', 'Collection'), icon: UI.art('collection', 34) },
  ];
  UI.tabs = {
    active: null,
    render(active) {
      const nav = $('tabs');
      if (!nav) return;
      if (active !== undefined) this.active = active;
      nav.innerHTML = TABS.map(t => `<button class="tab${t.id === this.active ? ' on' : ''}" data-tab="${t.id}">
        <span class="tab-in"><span class="tab-ico">${t.icon}</span><span class="tab-lbl">${t.label}</span></span><span class="badge" data-badge="${t.id}" hidden></span></button>`).join('');
      nav.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        const id = b.dataset.tab;
        PS.Snd.play('select');
        if (id === UI.current() && id !== 'main') return;
        UI.go(id);
      });
      this.badges();
    },
    badges() {
      const nav = $('tabs'), p = P();
      if (!nav || !p) return;
      const set = (id, v, dot) => {
        const b = nav.querySelector(`[data-badge=${id}]`);
        if (!b) return;
        b.hidden = !v;
        b.className = 'badge' + (dot ? ' badge-dot' : '');
        b.textContent = dot ? '' : v;
      };
      const newN = UI.collectionNewCount ? UI.collectionNewCount() : 0;
      set('collection', newN, false);
      const labIds = Object.keys(D().lab || {});
      set('lab', !p.activeRun && has(PS.Meta, 'canBuyLab') && labIds.some(id => PS.Meta.canBuyLab(id)), true);
      const gift = has(PS.Meta, 'adGiftLeft') && PS.Meta.adGiftLeft(UI.now()) > 0;
      set('shop', gift, true);
    },
    show(v) { $('tabs').hidden = !v; },
  };

  // ---------- overlays ----------
  // content: html string or element. Elements with [data-close] close it.
  // opts: {cls, onClose, dismiss (tap backdrop closes, default true), card (wrap in .ov-card, default true)}
  UI.overlay = function (content, opts) {
    opts = opts || {};
    const ov = h('div', 'ov' + (opts.cls ? ' ' + opts.cls : ''));
    const card = opts.card === false ? ov : h('div', 'ov-card');
    if (typeof content === 'string') card.innerHTML = content; else if (content) card.appendChild(content);
    if (card !== ov) ov.appendChild(card);
    let closed = false;
    function close(val) {
      if (closed) return;
      closed = true;
      const a = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
      PS.Fx.settle(a, 150).then(() => ov.remove());
      if (opts.onClose) opts.onClose(val);
    }
    ov.addEventListener('click', e => {
      const c = e.target.closest('[data-close]');
      if (c && ov.contains(c)) { PS.Snd.play('select'); close(c.dataset.close || null); return; }
      if (e.target === ov && opts.dismiss !== false) close(null);
    });
    $('overlays').appendChild(ov);
    close.el = ov;
    close.card = card;
    return close;
  };
  UI.confirm = function (title, text, ok, cancel) {
    return new Promise(res => {
      UI.overlay(`<h2 class="ov-title">${title}</h2>${text ? `<p class="ov-text">${text}</p>` : ''}
        <div class="ov-actions"><button class="btn btn-ghost" data-close="no">${cancel || T('Отмена', 'Cancel')}</button>
        <button class="btn btn-cta" data-close="yes">${ok || T('Да', 'Yes')}</button></div>`, { onClose: v => res(v === 'yes') });
    });
  };
  UI.alert = function (title, text, ok) {
    return new Promise(res => {
      UI.overlay(`<h2 class="ov-title">${title}</h2>${text ? `<p class="ov-text">${text}</p>` : ''}
        <div class="ov-actions"><button class="btn btn-cta" data-close>${ok || T('Понятно', 'Got it')}</button></div>`, { onClose: () => res() });
    });
  };

  UI.toast = function (text, ms) {
    const box = $('toasts');
    if (!box) return;
    const t = h('div', 'toast', esc(text));
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    clearTimeout(toastTimer);
    setTimeout(() => {
      const a = t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 250 });
      PS.Fx.settle(a, 250).then(() => t.remove());
    }, ms || 1900);
  };

  UI.vibrate = function (ms) {
    const p = P();
    if (p && p.settings && p.settings.vibro === false) return;
    try { if (navigator.vibrate) navigator.vibrate(ms || 30); } catch (e) { /* unsupported */ }
  };

  // ---------- long-press tooltip: any element with data-tip="<html>" ----------
  let tipTimer = null, tipEl = null;
  function hideTip() { clearTimeout(tipTimer); if (tipEl) { tipEl.remove(); tipEl = null; } }
  UI.tip = function (target, html) {
    hideTip();
    tipEl = h('div', 'tip', html);
    document.body.appendChild(tipEl);
    const r = target.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    const y = r.top - th - 10 > 8 ? r.top - th - 10 : r.bottom + 10;
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
    UI.vibrate(15);
  };
  function initTips() {
    document.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-tip]');
      if (!t) { hideTip(); return; }
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => { UI.tip(t, t.dataset.tip); t.dataset.tipShown = '1'; }, 420);
    });
    ['pointerup', 'pointercancel', 'scroll'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(tipTimer); setTimeout(hideTip, ev === 'pointerup' ? 1200 : 0); }, true));
    // A long press must not also fire the element's tap action.
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-tip-shown]');
      if (t) { delete t.dataset.tipShown; e.stopPropagation(); e.preventDefault(); }
    }, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest('[data-tip]')) e.preventDefault(); });
  }

  // ---------- ads stub ----------
  UI.ads = {
    online: true,
    // kind: 'rewarded' | 'interstitial'. Resolves true when the reward is earned.
    show(kind) {
      return new Promise(res => {
        const inter = kind === 'interstitial';
        const close = UI.overlay(`<div class="ad-box"><div class="ad-tag">${T('Реклама (демо)', 'Ad (demo)')}</div>
          <div class="ad-ico">${inter ? '📺' : '🎬'}</div><div class="ad-bar"><i></i></div>
          ${inter ? '<button class="btn-icon ad-x" data-close="x" hidden>✕</button>' : ''}</div>`,
        { cls: 'ov-ad', dismiss: false, card: true, onClose: v => res(!inter || v === 'x' ? true : true) });
        const bar = close.el.querySelector('.ad-bar i');
        bar.animate([{ width: '0%' }, { width: '100%' }], { duration: 1500, fill: 'forwards' });
        setTimeout(() => {
          if (inter) { const x = close.el.querySelector('.ad-x'); if (x) x.hidden = false; }
          else {
            if (has(PS.Meta, 'markRewarded')) PS.Meta.markRewarded(UI.now());
            close(true);
          }
        }, 1500);
        if (inter && has(PS.Meta, 'markInterstitial')) PS.Meta.markInterstitial(UI.now());
      });
    },
  };

  // ---------- event player ----------
  // Plays core events one by one. handlers[type](ev) may return a Promise or a delay in ms;
  // handlers['*'] catches the rest; handlers.done() runs after the last event.
  // Calls are queued, so a second play() waits for the first to finish.
  let chain = Promise.resolve();
  UI.busy = false;
  UI.play = function (events, handlers) {
    handlers = handlers || {};
    const run = async () => {
      UI.busy = true;
      try {
        for (const ev of events || []) {
          const fn = handlers[ev.type] || handlers['*'];
          if (!fn) continue;
          let r;
          try { r = fn(ev); } catch (e) { console.error('play', ev.type, e); }
          if (r && typeof r.then === 'function') await r;
          else if (typeof r === 'number' && r > 0) await sleep(r / UI.speed);
        }
        if (handlers.done) await handlers.done();
      } finally { UI.busy = false; }
    };
    chain = chain.then(run, run);
    return chain;
  };

  // ---------- run helpers used by several screens ----------
  // Starting elsewhere forfeits the active run; its coins are kept (Meta.finishRun credits them).
  UI.abandonActiveRun = function () {
    const p = P();
    if (!p || !p.activeRun) return null;
    const R = p.activeRun;
    try { if (PS.Run && PS.Run.giveUp) PS.Run.giveUp(R); } catch (e) { console.warn(e); }
    if (R.phase !== 'lost' && R.phase !== 'won') R.phase = 'lost';
    const res = PS.Meta.finishRun(R, UI.now());
    p.activeRun = null;
    UI.save();
    return res;
  };
  UI.startRun = function (n, boosters) {
    const p = P();
    const out = PS.Run.create(PS.Meta.ctx(UI.now()), n, boosters || []);
    p.activeRun = out.R;
    UI.save();
    UI.go('battle', { run: out.R, events: out.events });
    return out;
  };
  UI.continueRun = function () {
    const p = P();
    if (p && p.activeRun) UI.go('battle', { run: p.activeRun, resumed: true });
  };

  UI.init = function () {
    initTips();
    UI.tabs.render('main');
    UI.topbar();
  };
})();
