var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI;
  const T = PS.T;

  UI.screen('daily', {
    chrome: { tab: 'main', tabs: false },
    mount(el) {
      function render() {
        const now = UI.now(), d = PS.Meta.daily(now), P = PS.Meta.P();
        const lives = PS.Meta.profile.lives || 0, max = PS.DATA.economy.lives.max;
        const amount = x => x.lives ? `${x.lives} ❤️` : x.coins ? `${UI.fmt(x.coins)} 🪙` : `${x.gems} 💎`;
        const days = PS.DATA.daily;
        // d.day is the next day to claim; once claimed today, the highlighted day is the one just taken.
        const today = d.canClaim ? d.day : (d.day + days.length - 1) % days.length;
        const cells = days.map((r, i) => {
          const done = i < today || (i === today && !d.canClaim);
          // Claimed days show what was actually received; P may have grown since.
          const got = done && (PS.Meta.profile.daily.got || {})[i];
          // a lives day pays its coins instead while the stock is full
          const life = got ? !!got.lives : r.lives && lives < max;
          const v = got ? amount(got) : life ? `${r.lives} ❤️` : r.coins ? `${UI.fmt(Math.round(r.coins * P))} 🪙` : `${r.gems} 💎`;
          const ico = life ? '❤️' : r.gems ? (i === days.length - 1 ? UI.inlineArt('shop/gems_medium') : '💎') : (i >= 4 ? '💰' : '🪙');
          return `<div class="day${done ? ' done' : ''}${i === today && d.canClaim ? ' today' : ''}${i === days.length - 1 ? ' big' : ''}">
            <span class="d-n">${T('День', 'Day')} ${i + 1}</span><span class="d-ico">${ico}</span><span class="d-v ${life ? 'c-hp' : r.gems ? 'c-gem' : 'c-gold'}">${v}</span></div>`;
        }).join('');
        const rwText = amount(d.reward);
        el.innerHTML = `
          <div class="scr-head"><button class="btn-icon" data-a="back" aria-label="${T('Назад', 'Back')}">${UI.ico.left}</button><h1>🎁 ${T('Подарок дня', 'Daily Gift')}</h1></div>
          <div class="panel"><div class="daily-grid">${cells}</div>
            <p class="small dim center" style="margin-top:10px">${T('Цикл 7 дней. Пропуск дня не сбрасывает цикл.', "7-day cycle. Missing a day won't reset it.")}</p>
            <div class="daily-lives" data-tip="${T(`<b>Жизни</b><br>Бесплатное воскрешение без рекламы. Копятся до ${max}; воскреснуть можно по-прежнему один раз за попытку.`, `<b>Lives</b><br>A free revive, no ad. Stack up to ${max}; still one revive per run.`)}">❤️ ${T('Жизни', 'Lives')}: <b>${lives} / ${max}</b></div></div>
          <div class="spacer"></div>
          ${d.canClaim ? `
            <div class="center" style="margin:14px 0 10px"><div class="muted small">${T('Сегодня', 'Today')}</div><div class="res-coins" data-rw>${rwText}${d.autoDouble ? ` <span class="tag tag-gold">${T('×2 Печать', '×2 Seal')}</span>` : ''}</div></div>
            <div class="col">
              ${!d.autoDouble && UI.ads.online ? `<button class="btn btn-green btn-ad btn-lg btn-block" data-a="x2">${T('×2 за рекламу', '×2 for an ad')}</button>` : ''}
              <button class="btn btn-cta btn-lg btn-block" data-a="claim">${T('Забрать', 'Claim')}${d.autoDouble ? ' ×2' : ''}</button></div>` :
            `<div class="panel soft center"><b>${T('Награда получена', 'Reward claimed')}</b><div class="muted small">${T('Возвращайся завтра', 'Come back tomorrow')} — ⏳ <span data-t>${UI.hhmm(msToMidnight())}</span></div></div>
             <div class="gap"></div><button class="btn btn-block" data-a="back2">${T('На главный', 'Home')}</button>`}`;
        const on = (a, fn) => { const b = el.querySelector(`[data-a=${a}]`); if (b) b.onclick = fn; };
        on('back', () => { PS.Snd.play('select'); UI.go('main'); });
        on('back2', () => { PS.Snd.play('select'); UI.go('main'); });
        const claim = async double => {
          if (double && !(await UI.ads.show('rewarded'))) return;
          const from = PS.Fx.centerOf(el.querySelector('[data-rw]') || el);
          const out = PS.Meta.claimDaily(UI.now(), double);
          if (!out) return;
          PS.Snd.play('win');
          if (out.coins) UI.flyCurrency(from, 'coins', 8);
          if (out.gems) UI.flyCurrency(from, 'gems', 6);
          PS.Fx.bigPop('+' + amount(out));
          render();
        };
        on('claim', () => claim(false));
        on('x2', () => claim(true));
      }
      const msToMidnight = UI.msToMidnight;
      render();
      this.t = setInterval(() => { const t = el.querySelector('[data-t]'); if (t) t.textContent = UI.hhmm(msToMidnight()); }, 1000);
    },
    unmount() { clearInterval(this.t); },
  });
})();
