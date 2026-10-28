var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
  const ORDER = ['booster_potion', 'booster_flask', 'booster_vitality', 'booster_first_strike'];

  UI.screen('start', {
    chrome: { tab: 'main', tabs: false },
    mount(el, params) {
      const n = params.n || 1, isl = UI.island(n), w = UI.world(n) || {};
      const p = PS.Meta.profile;
      UI.setTheme(w.theme === 'night' ? 'night' : 'day', w.palette);
      const bossId = isl.boss || w.boss;
      const boss = bossId ? UI.item('bosses', bossId) : null;
      const ids = ORDER.filter(id => PS.DATA.boosters && PS.DATA.boosters[id]).concat(Object.keys(PS.DATA.boosters || {}).filter(id => ORDER.indexOf(id) < 0));
      const picked = {};
      const E = PS.DATA.economy, slotsFull = E.slots.base + PS.Meta.labTier('slot') * PS.DATA.lab.slot.per.slots >= E.slots.max;
      const capped = id => id === 'booster_flask' && slotsFull;

      el.innerHTML = `
        <div class="scr-head"><button class="btn-icon" data-a="back" aria-label="${T('Назад', 'Back')}">${UI.ico.left}</button><h1>${T('Старт острова', 'Island start')}</h1></div>
        <div class="panel">
          <div class="start-hero">
            <div class="start-boss">${boss ? UI.enemyArt(bossId) : ''}<span class="tag tag-hard">${T('Босс', 'Boss')}</span></div>
            <div class="grow">
              <div class="isl-label">${T('Остров', 'Island')} ${n}</div>
              <h2 class="isl-name">${esc(isl.name)}</h2>
              <div class="muted small">${boss ? esc(boss.name) : ''}</div>
              ${isl.tier === 'hard' ? `<div class="row wrap" style="margin-top:6px"><span class="tag tag-hard">☠ ${T('Сложный · +25% монет', 'Hard · +25% coins')}</span></div>` : ''}
            </div>
          </div>
          <div class="start-bar">${UI.stageBar({ n, best: p.best[n] || 0 })}</div>
        </div>
        <div class="sec-title">${T('Бусты на попытку', 'Boosts for this run')}</div>
        <div class="col" data-boosts>${ids.map(id => {
          const b = UI.item('boosters', id);
          return `<button class="boost${capped(id) ? ' capped' : ''}" data-b="${id}" ${capped(id) ? 'disabled' : ''} data-tip="<b>${esc(b.name)}</b><br>${esc(b.desc)}">
            <span class="boost-ico">${b.icon}</span><span class="grow"><span class="card-title" style="font-size:15px">${esc(b.name)}</span><br><span class="card-desc">${esc(b.desc)}</span></span>
            <span class="boost-price">${capped(id) ? `<span class="dim">${T('макс. колб', 'max tubes')}</span>` : `<span class="price">${UI.ico.gem(18)}${b.gems}</span>`}</span><span class="boost-chk"></span></button>`;
        }).join('')}</div>
        <div class="start-total"><span class="muted">${T('Итого', 'Total')}</span><b data-total class="c-gem price"></b></div>
        <div class="spacer"></div>
        <button class="btn btn-cta btn-lg btn-block" data-a="go">${T('Начать', 'Start')}</button>`;

      const totalOf = () => Object.keys(picked).filter(k => picked[k]).reduce((s, id) => s + (PS.DATA.boosters[id].gems || 0), 0);
      const go = el.querySelector('[data-a=go]');
      function sync() {
        const t = totalOf();
        el.querySelector('[data-total]').innerHTML = UI.ico.gem(18) + t;
        el.querySelectorAll('[data-b]').forEach(b => {
          b.classList.toggle('on', !!picked[b.dataset.b]);
          b.querySelector('.boost-chk').innerHTML = picked[b.dataset.b] ? UI.ico.check(14) : '';
        });
        const short = t > p.gems;
        go.className = 'btn btn-lg btn-block ' + (short ? 'btn-gem' : 'btn-cta');
        go.innerHTML = short ? T(`Не хватает <span class="price">${UI.ico.gem(20)}${t - p.gems}</span> — в магазин`, `Need <span class="price">${UI.ico.gem(20)}${t - p.gems}</span> more — Shop`) : (t ? `${T('Начать', 'Start')} <span class="price">· ${UI.ico.gem(22)}${t}</span>` : T('Начать', 'Start'));
      }
      el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
        picked[b.dataset.b] = !picked[b.dataset.b];
        PS.Snd.play(picked[b.dataset.b] ? 'gem' : 'select');
        sync();
      });
      el.querySelector('[data-a=back]').onclick = () => { PS.Snd.play('select'); UI.go('main', { n }); };
      go.onclick = () => {
        const t = totalOf();
        if (t > p.gems) { UI.go('shop', { focus: 'gems' }); return; }
        if (params.abandon || (p.activeRun && p.activeRun.island !== n)) UI.abandonActiveRun();
        if (t && !PS.Meta.spendGems(t)) { UI.toast(T('Не хватает кристаллов', 'Not enough gems')); return; }
        PS.Snd.play('win');
        UI.startRun(n, Object.keys(picked).filter(k => picked[k]));
      };
      sync();
    },
  });
})();
