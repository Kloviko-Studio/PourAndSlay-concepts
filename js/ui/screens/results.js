var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;

  // params: {run: R, result?: Meta.finishRun output}. Without result the screen finishes the run itself.
  UI.finishOnce = function (params) {
    if (!params.result) {
      params.result = PS.Meta.finishRun(params.run, UI.now());
      UI.topbar();
    }
    return params.result;
  };

  // Cheapest affordable lab upgrade, for the "Хватает на" hint.
  UI.labAffordable = function () {
    const ids = Object.keys(PS.DATA.lab || {}).filter(id => PS.Meta.canBuyLab(id));
    if (!ids.length) return null;
    ids.sort((a, b) => PS.Meta.labCost(a) - PS.Meta.labCost(b));
    return ids[0];
  };

  UI.screen('results', {
    chrome: { tab: null, tabs: false },
    mount(el, params) {
      const R = params.run, res = UI.finishOnce(params);
      const n = R.island, isl = UI.island(n);
      const reached = Math.min(isl.stages, (R.stage || 0) + 1);
      const best = PS.Meta.profile.best[n] || reached;
      let doubled = false;
      PS.Snd.play('lose');

      const labId = UI.labAffordable();
      const lab = labId ? UI.item('lab', labId) : null;
      el.innerHTML = `
        <div class="res-head"><h1 class="res-title lose">${T('Попытка окончена', 'Run over')}</h1>
          <div class="res-sub">${T('Остров', 'Island')} ${n} · ${esc(isl.name)}</div></div>
        <div class="panel">
          <div class="row between"><b>${T('Дистанция', 'Distance')}</b><span class="muted">${T(`этап ${reached} из ${isl.stages}`, `stage ${reached} of ${isl.stages}`)}</span></div>
          ${UI.stageBar({ n, best, current: reached, newBest: res.newBest })}
          ${res.newBest ? `<div class="center res-best"><span class="tag tag-gold">${T('Новый рекорд!', 'New best!')}</span></div>` : `<div class="center small dim res-best">${T(`Рекорд: этап ${best}`, `Best: stage ${best}`)}</div>`}
        </div>
        <div class="gap"></div>
        <div class="panel center">
          <div class="muted small">${T('Заработано за попытку', 'Earned this run')}</div>
          <div class="res-coins"><span class="ico">${UI.ico.coin(40)}</span><span data-coins>${UI.fmt(res.coins)}</span></div>
          ${res.coins > 0 && UI.ads.online ? `<button class="btn btn-green btn-ad btn-block" data-a="x2">${T('×2 за рекламу', '×2 for an ad')}</button>` : ''}
        </div>
        ${lab ? `<div class="gap"></div><button class="card res-hint" data-a="labhint"><span class="card-ico">${lab.icon}</span>
          <span class="card-body"><span class="card-desc">${T('Хватает на:', 'You can afford:')}</span><span class="card-title">${esc(lab.name)} ${PS.Meta.labTier(labId) + 1}</span></span><span class="c-gold">›</span></button>` : ''}
        <div class="res-actions">
          <button class="btn btn-cta btn-lg btn-block" data-a="again">${T('Ещё раз', 'Try again')}</button>
          <div class="row"><button class="btn" data-a="lab">⚗️ ${T('Лаборатория', 'Lab')}</button><button class="btn btn-ghost" data-a="main">${T('Главный', 'Home')}</button></div>
        </div>`;

      const x2 = el.querySelector('[data-a=x2]');
      if (x2) x2.onclick = async () => {
        if (doubled) return;
        if (!(await UI.ads.show('rewarded'))) return;
        doubled = true;
        PS.Meta.addCoins(res.coins);
        const c = el.querySelector('[data-coins]');
        c.textContent = UI.fmt(res.coins * 2);
        x2.disabled = true; x2.textContent = T('×2 получено', '×2 claimed');
        PS.Fx.bigPop('×2');
        UI.flyCurrency(c, 'coins', 8);
      };
      const on = (a, fn) => { const b = el.querySelector(`[data-a=${a}]`); if (b) b.onclick = () => { PS.Snd.play('select'); fn(); }; };
      on('again', () => UI.go('start', { n }));
      on('lab', () => UI.go('lab'));
      on('labhint', () => UI.go('lab', { focus: labId }));
      on('main', () => UI.go('main', { n }));

      const now = UI.now();
      if (!params.adShown && PS.Meta.shouldInterstitial(now, { island: n })) {
        params.adShown = true;
        setTimeout(() => { if (UI.current() === 'results') UI.ads.show('interstitial'); }, 900);
      }
    },
  });
})();
