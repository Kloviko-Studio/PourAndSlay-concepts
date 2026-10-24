var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;

  UI.screen('cleared', {
    chrome: { tab: null, tabs: false },
    mount(el, params) {
      const R = params.run, res = UI.finishOnce(params);
      const n = R.island, isl = UI.island(n);
      const runCoins = R.coins || 0, firstBonus = Math.max(0, res.coins - runCoins);
      // Only gameplay novelties get a card (max 2 per island); lab upgrades and relic rarity are one quiet line.
      const quiet = u => u.kind === 'lab' || u.kind === 'relicRarity';
      const ORDER = ['colors', 'tubes', 'potions', 'mods', 'finds'], rank = u => ORDER.indexOf(u.kind);
      const unlocked = (res.unlocked || []).filter(u => !quiet(u)).sort((a, b) => rank(a) - rank(b)).map(UI.unlockLabel).filter(Boolean);
      const also = res.firstClear ? (res.unlocked || []).filter(quiet).map(UI.unlockLabel).filter(Boolean) : [];
      const labNew = also.filter(u => u.kind === 'lab'), restNew = also.filter(u => u.kind !== 'lab');
      const alsoText = [labNew.length ? `🧪 Лаборатория: ${labNew.map(u => esc(u.name)).join(', ')}` : '']
        .concat(restNew.map(u => `${u.icon} ${esc(u.name)}`)).filter(Boolean).join(' · ');
      const hasNext = res.firstClear && n < UI.islandCount();
      let doubled = false, step = 0;

      function finish() {
        if (hasNext) UI.go('main', { n: n + 1, opened: true });
        else UI.go('main', { n });
      }

      function victory() {
        UI.setTheme('day', (UI.world(n) || {}).palette);
        el.innerHTML = `
          <div class="res-head"><h1 class="res-title">Победа!</h1>
            <div class="res-sub">Мир ${isl.world} · Остров ${n} · ${esc(isl.name)} — пройден</div></div>
          <div class="panel">${UI.stageBar({ n, best: isl.stages, current: isl.stages })}</div>
          <div class="gap"></div>
          <div class="panel">
            <div class="res-coins"><span class="ico">🪙</span><span data-coins>${UI.fmt(res.coins)}</span></div>
            <div class="res-line"><span class="muted">За попытку</span><b class="c-gold" data-run>${UI.fmt(runCoins)} 🪙</b></div>
            ${firstBonus ? `<div class="res-line"><span class="muted">Первое прохождение</span><b class="c-gold">+${UI.fmt(firstBonus)} 🪙</b></div>` : ''}
            ${res.gems ? `<div class="res-line"><span class="muted">Кристаллы</span><b class="c-gem" data-gems>+${res.gems} 💎</b></div>` : ''}
            ${alsoText ? `<div class="small muted" style="margin-top:8px">Также открыто: ${alsoText}</div>` : ''}
            ${runCoins > 0 && UI.ads.online ? '<div class="gap"></div><button class="btn btn-green btn-ad btn-block" data-a="x2">×2 монет за попытку</button>' : ''}
          </div>
          <div class="res-actions"><button class="btn btn-cta btn-lg btn-block" data-a="next">${unlocked.length ? 'Дальше' : 'На главный'}</button></div>`;
        PS.Snd.play('win');
        PS.Fx.confetti(60);
        const coinsEl = el.querySelector('[data-coins]');
        setTimeout(() => {
          UI.flyCurrency(coinsEl, 'coins', 8);
          const g = el.querySelector('[data-gems]');
          if (g) setTimeout(() => UI.flyCurrency(g, 'gems', 4), 300);
        }, 500);
        const x2 = el.querySelector('[data-a=x2]');
        if (x2) x2.onclick = async () => {
          if (doubled || !(await UI.ads.show('rewarded'))) return;
          doubled = true;
          PS.Meta.addCoins(runCoins);
          coinsEl.textContent = UI.fmt(res.coins + runCoins);
          el.querySelector('[data-run]').textContent = UI.fmt(runCoins * 2) + ' 🪙';
          x2.disabled = true; x2.textContent = '×2 получено';
          PS.Fx.bigPop('×2');
          UI.flyCurrency(coinsEl, 'coins', 8);
        };
        el.querySelector('[data-a=next]').onclick = () => { PS.Snd.play('select'); next(); };
      }

      function unlockCard(u, i) {
        el.innerHTML = `
          <div class="res-head"><div class="isl-label">Открыто ${i + 1} из ${unlocked.length}</div></div>
          <div class="spacer"></div>
          <div class="panel gold unlock-card" style="overflow:hidden">
            <div class="rays"></div>
            <div class="u-lbl">Открыто</div>
            <div class="u-ico">${u.icon}</div>
            <h2 class="u-name">${esc(u.name)}</h2>
            ${u.desc ? `<p class="ov-text">${esc(u.desc)}</p>` : ''}
            <div class="small dim" style="margin-top:8px">${u.kind === 'lab' ? 'Уже в Лаборатории' : 'Появится в выборе и в Коллекции'}</div>
          </div>
          <div class="spacer"></div>
          <div class="res-actions"><button class="btn btn-cta btn-lg btn-block" data-a="next">${i + 1 < unlocked.length ? 'Дальше' : 'К новому острову'}</button></div>`;
        PS.Snd.play('unlock');
        PS.Fx.burstAt(el.querySelector('.u-ico'), '#ffcb4f', 22, 90);
        el.querySelector('[data-a=next]').onclick = () => { PS.Snd.play('select'); next(); };
      }

      function next() {
        step++;
        // Replays skip the unlock cards and the "island opened" animation.
        if (!res.firstClear || step > unlocked.length) { finish(); return; }
        unlockCard(unlocked[step - 1], step - 1);
      }
      victory();
    },
  });
})();
