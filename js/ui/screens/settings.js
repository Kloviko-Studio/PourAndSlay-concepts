var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI;
  const VERSION = 'концепт v2 · 0.2.0';

  // The battle screen registers PS.UI.debug.onWin(); settings only asks for it.
  UI.debug = UI.debug || {};
  UI.debug.winBattle = function () {
    if (typeof UI.debug.onWin === 'function') { UI.debug.onWin(); return true; }
    return false;
  };

  UI.screen('settings', {
    chrome: { tabs: false },
    mount(el, params) {
      const p = PS.Meta.profile;
      const back = params.back && params.back !== 'settings' ? params.back : 'main';
      function goBack() {
        PS.Snd.play('select');
        if (back === 'battle' && p.activeRun) UI.go('battle', { run: p.activeRun, resumed: true });
        else UI.go(back === 'battle' ? 'main' : back);
      }
      function render() {
        const now = UI.now(), seal = PS.Meta.sealActive(now);
        const sw = (k, label, ico) => `<div class="set-row"><span>${ico}</span><span class="grow">${label}</span><button class="switch${p.settings[k] !== false ? ' on' : ''}" data-sw="${k}" aria-label="${label}"></button></div>`;
        el.innerHTML = `
          <div class="scr-head"><button class="btn-icon" data-a="back">‹</button><h1>⚙ Настройки</h1></div>
          <div class="panel">
            ${sw('sound', 'Звук', '🔊')}${sw('music', 'Музыка', '🎵')}${sw('vibro', 'Вибрация', '📳')}
            <div class="set-row"><span>🌐</span><span class="grow">Язык</span><select class="inp" data-a="lang"><option>Русский</option><option disabled>English — скоро</option><option disabled>Українська — скоро</option><option disabled>Español — скоро</option></select></div>
          </div>
          <div class="gap"></div>
          <div class="panel">
            <button class="set-row" style="width:100%" data-a="restore"><span>♻️</span><span class="grow" style="text-align:left">Восстановить покупки</span><span class="dim">›</span></button>
            <button class="set-row" style="width:100%" data-a="privacy"><span>🛡</span><span class="grow" style="text-align:left">Реклама и приватность</span><span class="dim">›</span></button>
            <button class="set-row" style="width:100%" data-a="policy"><span>📄</span><span class="grow" style="text-align:left">Политика конфиденциальности</span><span class="dim">›</span></button>
            <button class="set-row" style="width:100%" data-a="support"><span>✉️</span><span class="grow" style="text-align:left">Поддержка</span><span class="dim">›</span></button>
            <button class="set-row c-bad" style="width:100%" data-a="reset"><span>🗑</span><span class="grow" style="text-align:left">Сбросить прогресс</span><span class="dim">›</span></button>
          </div>
          <div class="sec-title">Отладка</div>
          <div class="panel debug">
            <div class="row wrap">
              <button class="btn btn-sm" data-d="coins">+500 🪙</button>
              <button class="btn btn-sm btn-gem" data-d="gems">+100 💎</button>
              <button class="btn btn-sm" data-d="islands">Открыть все острова</button>
              <button class="btn btn-sm btn-green" data-d="win" ${p.activeRun ? '' : 'disabled'}>Выиграть бой</button>
              <button class="btn btn-sm btn-purple" data-d="seal">Печать: ${seal ? 'вкл' : 'выкл'}</button>
              <button class="btn btn-sm btn-purple" data-d="noads">Без рекламы: ${p.noAds ? 'вкл' : 'выкл'}</button>
              <button class="btn btn-sm" data-d="day">+1 день</button>
              <button class="btn btn-sm" data-d="ads">Сеть: ${UI.ads.online ? 'есть' : 'нет'}</button>
              <button class="btn btn-sm" data-d="catalog">Каталог контента</button>
              <button class="btn btn-sm btn-danger" data-d="reset">Сбросить прогресс</button>
            </div>
            <div class="tiny dim" style="margin-top:8px">Сдвиг времени: ${Math.round(UI.timeShift / 86400000)} дн. · сессий: ${p.sessions || 0}</div>
          </div>
          <p class="center tiny dim" style="margin:14px 0 4px">Pour &amp; Slay · ${VERSION}</p>`;

        el.querySelector('[data-a=back]').onclick = goBack;
        el.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
          const k = b.dataset.sw;
          p.settings[k] = p.settings[k] === false;
          if (k === 'sound') PS.Snd.on = p.settings.sound;
          UI.save();
          PS.Snd.play('select');
          if (k === 'vibro') UI.vibrate(40);
          b.classList.toggle('on', p.settings[k]);
        });
        const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.onclick = () => { PS.Snd.play('select'); fn(b); }; };
        on('[data-a=restore]', () => UI.toast('Покупки восстановлены (демо)'));
        on('[data-a=privacy]', () => UI.alert('Реклама и приватность', 'Здесь откроется окно согласия на персонализированную рекламу (GDPR). В демо — заглушка.'));
        on('[data-a=policy]', () => UI.alert('Политика конфиденциальности', 'Ссылка на политику появится в релизной сборке.'));
        on('[data-a=support]', () => UI.alert('Поддержка', 'Пишите нам: support@pourandslay.example'));
        const reset = async () => {
          if (!(await UI.confirm('Сбросить прогресс?', 'Острова, Лаборатория, монеты и кристаллы будут потеряны. Отменить нельзя.', 'Сбросить', 'Отмена'))) return;
          PS.Meta.reset(UI.now());
          UI.timeShift = 0;
          UI.toast('Прогресс сброшен');
          PS.Boot.start();
        };
        on('[data-a=reset]', reset);
        on('[data-d=reset]', reset);
        on('[data-d=catalog]', () => UI.go('catalog', { back: params.back }));
        const dbg = PS.Meta.debug || {};
        on('[data-d=coins]', () => { dbg.addCoins ? dbg.addCoins(500) : PS.Meta.addCoins(500); UI.topbar(); UI.toast('+500 🪙'); });
        on('[data-d=gems]', () => { dbg.addGems ? dbg.addGems(100) : PS.Meta.addGems(100); UI.topbar(); UI.toast('+100 💎'); });
        on('[data-d=islands]', () => {
          if (dbg.unlockAll) dbg.unlockAll(); else { p.maxIsland = UI.islandCount(); UI.save(); }
          UI.toast('Все острова открыты');
          render();
        });
        on('[data-d=seal]', () => { if (dbg.toggleSeal) dbg.toggleSeal(UI.now()); UI.topbar(); render(); });
        on('[data-d=noads]', () => { if (dbg.toggleNoAds) dbg.toggleNoAds(); render(); });
        on('[data-d=day]', () => { UI.timeShift += 86400000; UI.toast('Время +1 день'); UI.topbar(); render(); });
        on('[data-d=ads]', () => { UI.ads.online = !UI.ads.online; render(); });
        on('[data-d=win]', () => {
          if (!p.activeRun) return;
          UI.go('battle', { run: p.activeRun, resumed: true });
          setTimeout(() => { if (!UI.debug.winBattle()) UI.toast('Экран боя не поддерживает «Выиграть бой»'); }, 300);
        });
      }
      render();
    },
  });
})();
