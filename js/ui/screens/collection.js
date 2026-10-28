var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
  let tab = 'elements';

  const TABS = [
    { id: 'elements', label: T('Стихии', 'Elements') }, { id: 'potions', label: T('Зелья', 'Potions') }, { id: 'relics', label: T('Реликвии', 'Relics') },
    { id: 'tubes', label: T('Колбы', 'Tubes') }, { id: 'enemies', label: T('Враги', 'Enemies') },
  ];

  // Every entry: {key (Meta seen-key or null), island (opens on), icon html, name, desc, cls}
  function entries(kind) {
    const D = PS.DATA;
    if (kind === 'relics') {
      return Object.keys(D.relics || {}).map(id => {
        const r = D.relics[id], rar = (D.rarity || {})[r.rarity] || {};
        return { key: 'relicRarity:' + r.rarity, island: rar.unlock || 1, icon: UI.item('relics', id).icon, name: r.name, desc: r.desc, cls: 'r-' + r.rarity, sub: rar.name };
      }).sort((a, b) => a.island - b.island);
    }
    if (kind === 'enemies') {
      const out = [];
      Object.keys(D.enemies || {}).forEach(id => {
        const e = D.enemies[id];
        out.push({ key: null, island: e.world * 2 - 1, icon: UI.enemyArt(id), name: e.name, desc: e.desc, cls: '' });
      });
      Object.keys(D.bosses || {}).forEach(id => {
        const b = D.bosses[id];
        out.push({ key: null, island: (b.islands || [b.world * 2 - 1])[0], icon: UI.enemyArt(id), name: b.name, desc: b.desc, cls: 'r-legendary', sub: b.final ? T('Финальный босс', 'Final boss') : T('Босс', 'Boss') });
      });
      return out.sort((a, b) => a.island - b.island);
    }
    const src = D[kind] || {};
    return Object.keys(src).filter(id => !src[id].later).map(id => {
      const it = src[id];
      return { key: kind + ':' + id, island: it.unlock || 1, icon: UI.item(kind, id).icon, name: it.name, desc: it.desc, cls: '' };
    }).sort((a, b) => a.island - b.island);
  }

  const isNew = e => !!(e.key && PS.Meta.isNew && PS.Meta.isNew(e.key));
  const isOpen = e => e.island <= PS.Meta.profile.maxIsland;

  UI.collectionNewCount = () => TABS.reduce((s, t) => s + entries(t.id).filter(e => isOpen(e) && isNew(e)).length, 0);

  UI.screen('collection', {
    chrome: { tab: 'collection' },
    mount(el, params) {
      if (params.tab) tab = params.tab;
      function render() {
        const list = entries(tab);
        const counts = {};
        TABS.forEach(t => { counts[t.id] = entries(t.id).filter(e => isOpen(e) && isNew(e)).length; });
        const open = list.filter(isOpen).length;
        el.innerHTML = `<div class="scr-head"><h1>📖 ${T('Коллекция', 'Collection')}</h1><span class="tag">${open}/${list.length}</span></div>
          <div class="seg">${TABS.map(t => `<button data-t="${t.id}" class="${t.id === tab ? 'on' : ''}">${t.label}${counts[t.id] ? `<span class="badge">${counts[t.id]}</span>` : ''}</button>`).join('')}</div>
          <div class="coll-grid">${list.map((e, i) => {
            const o = isOpen(e);
            return `<button class="coll-it ${o ? e.cls : 'locked'}" data-i="${i}">${o && isNew(e) ? '<span class="badge">!</span>' : ''}
              <span class="c-ico">${e.icon}</span><span class="c-name">${o ? esc(e.name) : '???'}</span>${o ? '' : `<span class="tiny dim">${T('Остров', 'Island')} ${e.island}</span>`}</button>`;
          }).join('')}</div>`;
        el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { PS.Snd.play('select'); tab = b.dataset.t; render(); el.scrollTop = 0; });
        el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
          const e = list[+b.dataset.i];
          PS.Snd.play('select');
          if (!isOpen(e)) { UI.toast(T(`Откроется на острове ${e.island}`, `Unlocks on island ${e.island}`)); return; }
          UI.overlay(`<div class="ov-hero" style="width:110px;height:110px;margin:0 auto 8px;display:grid;place-items:center">${e.icon}</div>
            <h2 class="ov-title">${esc(e.name)}</h2>${e.sub ? `<div class="tag ${e.cls === 'r-legendary' ? 'tag-gold' : ''}">${esc(e.sub)}</div>` : ''}
            <p class="ov-text">${esc(e.desc || '')}</p><div class="ov-actions"><button class="btn btn-cta" data-close>${T('Понятно', 'Got it')}</button></div>`);
        });
        // Badges are shown on this visit, then cleared for the next one.
        list.filter(e => isOpen(e) && isNew(e)).forEach(e => { if (PS.Meta.markSeen) PS.Meta.markSeen(e.key); });
        UI.tabs.badges();
      }
      render();
    },
  });
})();
