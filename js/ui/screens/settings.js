var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, T = PS.T;
  const VERSION = T('концепт v2', 'concept v2') + ' · 0.2.0';

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
          <div class="scr-head"><button class="btn-icon" data-a="back" aria-label="${T('Назад', 'Back')}">${UI.ico.left}</button><h1>⚙ ${T('Настройки', 'Settings')}</h1></div>
          <div class="panel">
            ${sw('sound', T('Звук', 'Sound'), '🔊')}${sw('music', T('Музыка', 'Music'), '🎵')}${sw('vibro', T('Вибрация', 'Vibration'), '📳')}
            <div class="set-row"><span>🌐</span><span class="grow">${T('Язык', 'Language')}</span><select class="inp" data-a="lang" aria-label="${T('Язык', 'Language')}"><option value="en"${T.lang() === 'en' ? ' selected' : ''}>English</option><option value="ru"${T.lang() === 'ru' ? ' selected' : ''}>Русский</option><option disabled>Українська — ${T('скоро', 'soon')}</option><option disabled>Español — ${T('скоро', 'soon')}</option></select></div>
          </div>
          <div class="gap"></div>
          <div class="panel">
            <button class="set-row" style="width:100%" data-a="restore"><span>♻️</span><span class="grow" style="text-align:left">${T('Восстановить покупки', 'Restore purchases')}</span><span class="dim">›</span></button>
            <button class="set-row" style="width:100%" data-a="privacy"><span>🛡</span><span class="grow" style="text-align:left">${T('Реклама и приватность', 'Ads & privacy')}</span><span class="dim">›</span></button>
            <button class="set-row" style="width:100%" data-a="policy"><span>📄</span><span class="grow" style="text-align:left">${T('Политика конфиденциальности', 'Privacy policy')}</span><span class="dim">›</span></button>
            <button class="set-row" style="width:100%" data-a="support"><span>✉️</span><span class="grow" style="text-align:left">${T('Поддержка', 'Support')}</span><span class="dim">›</span></button>
            <button class="set-row c-bad" style="width:100%" data-a="reset"><span>🗑</span><span class="grow" style="text-align:left">${T('Сбросить прогресс', 'Reset progress')}</span><span class="dim">›</span></button>
          </div>
          <div class="sec-title">${T('Отладка', 'Debug')}</div>
          <div class="panel debug">
            <div class="row wrap">
              <button class="btn btn-sm" data-d="coins">+500 🪙</button>
              <button class="btn btn-sm btn-gem" data-d="gems">+100 💎</button>
              <button class="btn btn-sm" data-d="islands">${T('Открыть все острова', 'Unlock all islands')}</button>
              <button class="btn btn-sm btn-green" data-d="win" ${p.activeRun ? '' : 'disabled'}>${T('Выиграть бой', 'Win fight')}</button>
              <button class="btn btn-sm btn-purple" data-d="seal">${T('Печать', 'Seal')}: ${seal ? T('вкл', 'on') : T('выкл', 'off')}</button>
              <button class="btn btn-sm btn-purple" data-d="noads">${T('Без рекламы', 'No ads')}: ${p.noAds ? T('вкл', 'on') : T('выкл', 'off')}</button>
              <button class="btn btn-sm" data-d="day">${T('+1 день', '+1 day')}</button>
              <button class="btn btn-sm" data-d="ads">${T('Сеть', 'Network')}: ${UI.ads.online ? T('есть', 'on') : T('нет', 'off')}</button>
              <button class="btn btn-sm" data-d="catalog">${T('Каталог контента', 'Content catalog')}</button>
              <button class="btn btn-sm btn-danger" data-d="reset">${T('Сбросить прогресс', 'Reset progress')}</button>
            </div>
            <div class="tiny dim" style="margin-top:8px">${T('Сдвиг времени', 'Time shift')}: ${Math.round(UI.timeShift / 86400000)} ${T('дн.', 'd')} · ${T('сессий', 'sessions')}: ${p.sessions || 0}</div>
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
        el.querySelector('[data-a=lang]').onchange = e => { UI.save(); T.set(e.target.value); };
        on('[data-a=restore]', () => UI.toast(T('Покупки восстановлены (демо)', 'Purchases restored (demo)')));
        on('[data-a=privacy]', () => UI.alert(T('Реклама и приватность', 'Ads & privacy'), T('Здесь откроется окно согласия на персонализированную рекламу (GDPR). В демо — заглушка.', 'The personalized ads consent (GDPR) opens here. Placeholder in the demo.')));
        on('[data-a=policy]', () => UI.alert(T('Политика конфиденциальности', 'Privacy policy'), T('Ссылка на политику появится в релизной сборке.', 'The policy link comes with the release build.')));
        on('[data-a=support]', () => UI.alert(T('Поддержка', 'Support'), T('Пишите нам', 'Write to us') + ': support@pourandslay.example'));
        const reset = async () => {
          if (!(await UI.confirm(T('Сбросить прогресс?', 'Reset progress?'), T('Острова, Лаборатория, монеты и кристаллы будут потеряны. Отменить нельзя.', 'Islands, Lab upgrades, coins and gems will be lost. This can’t be undone.'), T('Сбросить', 'Reset'), T('Отмена', 'Cancel')))) return;
          PS.Meta.reset(UI.now());
          UI.timeShift = 0;
          UI.toast(T('Прогресс сброшен', 'Progress reset'));
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
          UI.toast(T('Все острова открыты', 'All islands unlocked'));
          render();
        });
        on('[data-d=seal]', () => { if (dbg.toggleSeal) dbg.toggleSeal(UI.now()); UI.topbar(); render(); });
        on('[data-d=noads]', () => { if (dbg.toggleNoAds) dbg.toggleNoAds(); render(); });
        on('[data-d=day]', () => { UI.timeShift += 86400000; UI.toast(T('Время +1 день', 'Time +1 day')); UI.topbar(); render(); });
        on('[data-d=ads]', () => { UI.ads.online = !UI.ads.online; render(); });
        on('[data-d=win]', () => {
          if (!p.activeRun) return;
          UI.go('battle', { run: p.activeRun, resumed: true });
          setTimeout(() => { if (!UI.debug.winBattle()) UI.toast(T('Экран боя не поддерживает «Выиграть бой»', 'The battle screen doesn’t support "Win fight"')); }, 300);
        });
      }
      render();
    },
  });
})();
