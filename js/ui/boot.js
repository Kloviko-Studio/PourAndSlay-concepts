var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI;
  const T = PS.T;

  function continuePrompt(R) {
    const isl = UI.island(R.island) || { stages: 1, name: '' };
    UI.overlay(`<div class="ov-hero">⚗️</div><h2 class="ov-title">${T('Продолжить забег?', 'Continue run?')}</h2>
      <p class="ov-text">${T('Остров', 'Island')} ${R.island} · ${UI.esc(isl.name)}<br>${T(`этап ${(R.stage || 0) + 1} из ${isl.stages}`, `stage ${(R.stage || 0) + 1} of ${isl.stages}`)}</p>
      ${UI.stageBar({ n: R.island, current: (R.stage || 0) + 1, best: PS.Meta.profile.best[R.island] || 0 })}
      <div class="ov-actions"><button class="btn btn-ghost" data-close="later">${T('Позже', 'Later')}</button><button class="btn btn-cta" data-close="go">${T('Продолжить', 'Continue')}</button></div>`,
    { onClose: v => { if (v === 'go') UI.continueRun(); } });
  }

  const Boot = PS.Boot = {
    // Routes from a loaded profile; also used after "reset progress".
    start() {
      const p = PS.Meta.profile;
      PS.Snd.on = p.settings.sound !== false;
      document.getElementById('overlays').innerHTML = '';
      const neverPlayed = !p.cleared[1] && !p.activeRun && !Object.keys(p.best || {}).length && !(p.stats && p.stats.runs);
      if (neverPlayed) {
        // First launch goes straight into island 1; the tutorial layer hooks into the battle screen.
        UI.startRun(1, []);
        return;
      }
      UI.go('main');
      if (p.activeRun) setTimeout(() => continuePrompt(p.activeRun), 250);
    },
  };

  function fatal(msg) {
    document.getElementById('screen').innerHTML = `<div class="scr-error">${msg}</div>`;
  }

  function splash() {
    const s = document.createElement('div');
    s.className = 'splash';
    s.innerHTML = `<div class="logo"><div class="logo-t">Pour<br><span>&amp;</span> Slay</div><div class="logo-s">${T('алхимия · монстры', 'alchemy · monsters')}</div></div>`;
    document.body.appendChild(s);
    return s;
  }

  function init() {
    if (!PS.DATA || !PS.Meta || !PS.UI) { fatal(T('Не загрузились данные или ядро игры.', "Game data or core didn't load.")); return; }
    const sp = splash();
    try {
      PS.Meta.load(UI.now());
    } catch (e) { console.error(e); fatal(T('Ошибка загрузки профиля: ', 'Profile load error: ') + UI.esc(e.message)); return; }
    UI.init();
    // Browsers only allow audio after a user gesture.
    document.addEventListener('pointerdown', () => PS.Snd.init(), { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) UI.save(); });
    window.addEventListener('pagehide', () => UI.save());
    setTimeout(() => {
      try { Boot.start(); } catch (e) { console.error(e); fatal(T('Ошибка запуска: ', 'Startup error: ') + UI.esc(e.message)); }
      const a = sp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
      PS.Fx.settle(a, 350).then(() => sp.remove());
    }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
