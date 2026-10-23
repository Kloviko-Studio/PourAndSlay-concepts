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
    return Math.abs(v) >= 10000 ? v.toLocaleString('ru-RU') : String(v);
  };
  const hhmm = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    return `${hh}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const D = () => PS.DATA || {};
  const P = () => (PS.Meta && PS.Meta.profile) || null;
  const has = (o, fn) => !!(o && typeof o[fn] === 'function');

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
      const names = { common: 'Обычные реликвии', rare: 'Редкие реликвии', legendary: 'Легендарные реликвии' };
      return { icon: '🏺', name: names[u.id] || 'Реликвии', desc: 'Новые реликвии в наградах за босса.' };
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
  // opts: {rage}
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

  // ---------- stage strip (shared by main, start, results, battle) ----------
  // opts: {n, current (1-based stage in progress, 0 = none), best, compact}
  UI.stageBar = function (opts) {
    const isl = UI.island(opts.n) || { stages: 1, bossAt: [] };
    const S = isl.stages || 1, bossAt = isl.bossAt || [];
    // Stage k sits at the middle of its segment, so "reached stage k" reads as distance travelled.
    const pos = k => (k <= 0 ? 0 : (k - 0.5) / S * 100).toFixed(2) + '%';
    const best = Math.min(opts.best || 0, S), cur = Math.min(opts.current || 0, S);
    let marks = '';
    for (let k = 1; k <= S; k++) {
      const boss = bossAt.indexOf(k) >= 0;
      const passed = cur ? k < cur : k <= best;
      marks += `<i class="sbar-mark${boss ? ' boss' : ''}${passed ? ' passed' : ''}${k === cur ? ' cur' : ''}" style="left:${pos(k)}">${boss ? '☠' : ''}</i>`;
    }
    const flag = best > 0 && (best < S || opts.showFlagAtEnd) ? `<b class="sbar-flag${opts.newBest ? ' new' : ''}" style="left:${pos(best)}" title="Рекорд">🚩</b>` : '';
    const pin = cur ? `<b class="sbar-pin" style="left:${pos(cur)}"></b>` : '';
    return `<div class="sbar${opts.compact ? ' compact' : ''}"><div class="sbar-track">
      <div class="sbar-best" style="width:${pos(best)}"></div><div class="sbar-fill" style="width:${pos(cur)}"></div>
      ${marks}${flag}${pin}<i class="sbar-end">🏁</i></div></div>`;
  };

  // ---------- router ----------
  UI.screen = function (name, impl) { screens[name] = impl; };
  UI.go = function (name, params) {
    const impl = screens[name];
    if (!impl) { console.warn('No screen', name); UI.toast('Экран «' + name + '» ещё не готов'); return; }
    const host = $('screen');
    const prev = cur;
    if (prev && prev.impl.unmount) { try { prev.impl.unmount(prev.el); } catch (e) { console.error(e); } }
    const el = h('div', 'scr scr-' + name);
    cur = { name, impl, el, params: params || {} };
    document.body.dataset.screen = name;
    const chrome = Object.assign({ topbar: true, tabs: true, tab: null, theme: 'navy' }, impl.chrome || {});
    $('topbar').hidden = !chrome.topbar;
    $('tabs').hidden = !chrome.tabs;
    UI.setTheme(chrome.theme);
    UI.tabs.render(chrome.tab);
    host.appendChild(el);
    try { impl.mount(el, cur.params); } catch (e) { console.error(e); el.innerHTML = `<div class="scr-error">Ошибка экрана: ${esc(e.message)}</div>`; }
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
      <button class="tb-seal${seal ? ' on' : ''}" data-act="seal" aria-label="Печать алхимика">
        <span class="tb-seal-ico">🔱</span><span class="tb-seal-txt">${seal ? days + ' дн.' : 'Печать'}</span></button>
      <div class="tb-mid">
        <button class="pill pill-coin" data-act="coins"><span class="pill-ico">🪙</span><b data-cur="coins">${fmt(p.coins)}</b><span class="pill-plus">+</span></button>
        <button class="pill pill-gem" data-act="gems"><span class="pill-ico">💎</span><b data-cur="gems">${fmt(p.gems)}</b><span class="pill-plus">+</span></button>
      </div>
      <button class="btn-icon tb-gear" data-act="settings" aria-label="Настройки">⚙</button>`;
    bar.querySelector('[data-act=seal]').onclick = () => { PS.Snd.play('select'); UI.go('seal'); };
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
    { id: 'shop', label: 'Магазин', icon: '🛒' },
    { id: 'lab', label: 'Лаборатория', icon: '⚗️' },
    { id: 'main', label: 'Мир', icon: '🏝️' },
    { id: 'collection', label: 'Коллекция', icon: '📖' },
  ];
  UI.tabs = {
    active: null,
    render(active) {
      const nav = $('tabs');
      if (!nav) return;
      if (active !== undefined) this.active = active;
      nav.innerHTML = TABS.map(t => `<button class="tab${t.id === this.active ? ' on' : ''}" data-tab="${t.id}">
        <span class="tab-ico">${t.icon}</span><span class="tab-lbl">${t.label}</span><span class="badge" data-badge="${t.id}" hidden></span></button>`).join('');
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
        <div class="ov-actions"><button class="btn btn-ghost" data-close="no">${cancel || 'Отмена'}</button>
        <button class="btn btn-cta" data-close="yes">${ok || 'Да'}</button></div>`, { onClose: v => res(v === 'yes') });
    });
  };
  UI.alert = function (title, text, ok) {
    return new Promise(res => {
      UI.overlay(`<h2 class="ov-title">${title}</h2>${text ? `<p class="ov-text">${text}</p>` : ''}
        <div class="ov-actions"><button class="btn btn-cta" data-close>${ok || 'Понятно'}</button></div>`, { onClose: () => res() });
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
        const close = UI.overlay(`<div class="ad-box"><div class="ad-tag">Реклама (демо)</div>
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
    if (R.phase !== 'lost') R.phase = 'lost';
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
