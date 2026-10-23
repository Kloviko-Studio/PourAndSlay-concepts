var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI;

  UI.screen('daily', {
    chrome: { tab: 'main', tabs: false },
    mount(el) {
      function render() {
        const now = UI.now(), d = PS.Meta.daily(now), P = PS.Meta.P();
        const days = PS.DATA.daily;
        // d.day is the next day to claim; once claimed today, the highlighted day is the one just taken.
        const today = d.canClaim ? d.day : (d.day + days.length - 1) % days.length;
        const cells = days.map((r, i) => {
          const done = i < today || (i === today && !d.canClaim);
          const v = r.coins ? `${UI.fmt(Math.round(r.coins * P))} 🪙` : `${r.gems} 💎`;
          return `<div class="day${done ? ' done' : ''}${i === today && d.canClaim ? ' today' : ''}${i === days.length - 1 ? ' big' : ''}">
            <span class="d-n">День ${i + 1}</span><span class="d-ico">${r.gems ? (i === days.length - 1 ? '💎💎' : '💎') : (i >= 4 ? '💰' : '🪙')}</span><span class="d-v ${r.gems ? 'c-gem' : 'c-gold'}">${v}</span></div>`;
        }).join('');
        const rw = d.reward, rwText = rw.coins ? `${UI.fmt(rw.coins)} 🪙` : `${rw.gems} 💎`;
        el.innerHTML = `
          <div class="scr-head"><button class="btn-icon" data-a="back">‹</button><h1>🎁 Подарок дня</h1></div>
          <div class="panel"><div class="daily-grid">${cells}</div>
            <p class="small dim center" style="margin-top:10px">Цикл 7 дней. Пропуск дня не сбрасывает цикл.</p></div>
          <div class="spacer"></div>
          ${d.canClaim ? `
            <div class="center" style="margin:14px 0 10px"><div class="muted small">Сегодня</div><div class="res-coins" data-rw>${rwText}${d.autoDouble ? ' <span class="tag tag-gold">×2 Печать</span>' : ''}</div></div>
            <div class="col">
              ${!d.autoDouble && UI.ads.online ? '<button class="btn btn-green btn-ad btn-lg btn-block" data-a="x2">×2 за рекламу</button>' : ''}
              <button class="btn btn-cta btn-lg btn-block" data-a="claim">Забрать${d.autoDouble ? ' ×2' : ''}</button></div>` :
            `<div class="panel soft center"><b>Награда получена</b><div class="muted small">Возвращайся завтра — ⏳ <span data-t>${UI.hhmm(msToMidnight())}</span></div></div>
             <div class="gap"></div><button class="btn btn-block" data-a="back2">На главный</button>`}`;
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
          PS.Fx.bigPop(out.coins ? `+${UI.fmt(out.coins)} 🪙` : `+${out.gems} 💎`);
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
