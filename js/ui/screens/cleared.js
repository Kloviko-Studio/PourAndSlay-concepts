var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;

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
      const alsoText = [labNew.length ? `⚗️ ${T('Лаборатория', 'Lab')}: ${labNew.map(u => esc(u.name)).join(', ')}` : '']
        .concat(restNew.map(u => `${u.icon} ${esc(u.name)}`)).filter(Boolean).join(' · ');
      const hasNext = res.firstClear && n < UI.islandCount();
      let doubled = false, step = 0;

      function finish() {
        if (hasNext) UI.go('main', { n: n + 1, opened: true });
        // After the last island the main screen lands on the "coming soon" card.
        else UI.go('main', { n: res.firstClear ? n + 1 : n });
      }

      function victory() {
        const w = UI.world(n) || {};
        UI.setTheme(w.theme === 'night' ? 'night' : 'day', w.palette);
        el.innerHTML = `
          <div class="res-head"><h1 class="res-title">${T('Победа!', 'Victory!')}</h1>
            <div class="res-sub">${T(`Остров ${n} · ${esc(isl.name)} — пройден`, `Island ${n} · ${esc(isl.name)} — cleared`)}</div></div>
          <div class="panel">${UI.stageBar({ n, best: isl.stages, current: isl.stages })}</div>
          <div class="gap"></div>
          <div class="panel">
            <div class="res-coins"><span class="ico">${UI.ico.coin(40)}</span><span data-coins>${UI.fmt(res.coins)}</span></div>
            <div class="res-line"><span class="muted">${T('За попытку', 'This run')}</span><b class="c-gold price" data-run>${UI.fmt(runCoins)}${UI.ico.coin(18)}</b></div>
            ${firstBonus ? `<div class="res-line"><span class="muted">${T('Первое прохождение', 'First clear')}</span><b class="c-gold price">+${UI.fmt(firstBonus)}${UI.ico.coin(18)}</b></div>` : ''}
            ${res.gems ? `<div class="res-line"><span class="muted">${T('Кристаллы', 'Gems')}</span><b class="c-gem price" data-gems>+${res.gems}${UI.ico.gem(18)}</b></div>` : ''}
            ${alsoText ? `<div class="small muted" style="margin-top:8px">${T('Также открыто:', 'Also unlocked:')} ${alsoText}</div>` : ''}
            ${runCoins > 0 && UI.ads.online ? `<div class="gap"></div><button class="btn btn-green btn-ad btn-block" data-a="x2">${T('×2 монет за попытку', '×2 run coins')}</button>` : ''}
          </div>
          <div class="res-actions"><button class="btn btn-cta btn-lg btn-block" data-a="next">${unlocked.length ? T('Дальше', 'Next') : T('На главный', 'Home')}</button></div>`;
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
          el.querySelector('[data-run]').innerHTML = UI.fmt(runCoins * 2) + UI.ico.coin(18);
          x2.disabled = true; x2.textContent = T('×2 получено', '×2 claimed');
          PS.Fx.bigPop('×2');
          UI.flyCurrency(coinsEl, 'coins', 8);
        };
        el.querySelector('[data-a=next]').onclick = () => { PS.Snd.play('select'); next(); };
      }

      function unlockCard(u, i) {
        el.innerHTML = `
          <div class="res-head"><div class="isl-label">${T(`Открыто ${i + 1} из ${unlocked.length}`, `Unlocked ${i + 1} of ${unlocked.length}`)}</div></div>
          <div class="spacer"></div>
          <div class="panel gold unlock-card" style="overflow:hidden">
            <div class="rays"></div>
            <div class="u-lbl">${T('Открыто', 'Unlocked')}</div>
            <div class="u-ico">${u.icon}</div>
            <h2 class="u-name">${esc(u.name)}</h2>
            ${u.desc ? `<p class="ov-text">${esc(u.desc)}</p>` : ''}
            <div class="small dim" style="margin-top:8px">${u.kind === 'lab' ? T('Уже в Лаборатории', 'Now in the Lab') : T('Появится в выборе и в Коллекции', 'Now in your picks and Collection')}</div>
          </div>
          <div class="spacer"></div>
          <div class="res-actions"><button class="btn btn-cta btn-lg btn-block" data-a="next">${i + 1 < unlocked.length ? T('Дальше', 'Next') : T('К новому острову', 'To the new island')}</button></div>`;
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
