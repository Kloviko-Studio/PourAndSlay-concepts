var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
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

      el.innerHTML = `
        <div class="scr-head"><button class="btn-icon" data-a="back" aria-label="Назад">‹</button><h1>Старт острова</h1></div>
        <div class="panel">
          <div class="start-hero">
            <div class="start-boss">${boss ? UI.enemyArt(bossId) : ''}<span class="tag tag-hard">Босс</span></div>
            <div class="grow">
              <div class="isl-label">Мир ${isl.world} · Остров ${n}</div>
              <h2 class="isl-name" style="font-size:22px">${esc(isl.name)}</h2>
              <div class="muted small">${boss ? esc(boss.name) : ''}</div>
              <div class="row wrap" style="margin-top:6px">${isl.tier === 'hard' ? '<span class="tag tag-hard">☠ Сложный · +25% 🪙</span>' : ''}
                ${p.best[n] ? `<span class="tag tag-gold">🚩 Рекорд: ${p.best[n] >= isl.stages ? 'пройден' : 'этап ' + p.best[n]}</span>` : ''}</div>
            </div>
          </div>
          ${UI.stageBar({ n, best: p.best[n] || 0 })}
          <div class="row between small muted" style="padding:0 4px"><span>Старт</span><span>${isl.stages} ${PS.U.plural(isl.stages, 'этап', 'этапа', 'этапов')} · ${(isl.bossAt || []).length} ${PS.U.plural((isl.bossAt || []).length, 'встреча', 'встречи', 'встреч')} с боссом</span></div>
        </div>
        <div class="sec-title">Бусты на попытку</div>
        <div class="col" data-boosts>${ids.map(id => {
          const b = UI.item('boosters', id);
          return `<button class="boost" data-b="${id}" data-tip="<b>${esc(b.name)}</b><br>${esc(b.desc)}">
            <span class="boost-ico">${b.icon}</span><span class="grow"><span class="card-title" style="font-size:15px">${esc(b.name)}</span><br><span class="card-desc">${esc(b.desc)}</span></span>
            <span class="boost-price">💎${b.gems}</span><span class="boost-chk"></span></button>`;
        }).join('')}</div>
        <div class="start-total"><span class="muted">Итого</span><b data-total class="c-gem">💎 0</b></div>
        <div class="spacer"></div>
        <button class="btn btn-cta btn-lg btn-block" data-a="go">Начать</button>`;

      const totalOf = () => Object.keys(picked).filter(k => picked[k]).reduce((s, id) => s + (PS.DATA.boosters[id].gems || 0), 0);
      const go = el.querySelector('[data-a=go]');
      function sync() {
        const t = totalOf();
        el.querySelector('[data-total]').textContent = '💎 ' + t;
        el.querySelectorAll('[data-b]').forEach(b => {
          b.classList.toggle('on', !!picked[b.dataset.b]);
          b.querySelector('.boost-chk').textContent = picked[b.dataset.b] ? '✓' : '';
        });
        const short = t > p.gems;
        go.className = 'btn btn-lg btn-block ' + (short ? 'btn-gem' : 'btn-cta');
        go.innerHTML = short ? `Не хватает 💎${t - p.gems} — в магазин` : (t ? `Начать <span class="price">· 💎${t}</span>` : 'Начать');
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
        if (t && !PS.Meta.spendGems(t)) { UI.toast('Не хватает кристаллов'); return; }
        PS.Snd.play('win');
        UI.startRun(n, Object.keys(picked).filter(k => picked[k]));
      };
      sync();
    },
  });
})();
