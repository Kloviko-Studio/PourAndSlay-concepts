var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;

  UI.screen('seal', {
    chrome: { tab: 'shop', tabs: false },
    mount(el, params) {
      function render() {
        const now = UI.now(), active = PS.Meta.sealActive(now), days = PS.Meta.sealDaysLeft(now);
        const prod = PS.DATA.shop.products.find(x => x.id === 'seal') || {}, S = PS.DATA.seal || {};
        const perks = [
          ['🪙', `+${Math.round(((S.coinsMult || 1.5) - 1) * 100)}% монет за попытки`],
          ['🎁', `Ежедневная награда ×${S.dailyMult || 2} без рекламы`],
          ['🪶', 'Бесплатное воскрешение без рекламы, 1 раз за попытку'],
          ['🚫', 'Нет рекламы между забегами'],
        ];
        el.innerHTML = `
          <div class="scr-head"><button class="btn-icon" data-a="back" aria-label="Назад">${UI.ico.left}</button><h1>Печать алхимика</h1></div>
          <div class="seal-hero"><div class="s-ico">🔱</div>
            ${active ? `<span class="tag tag-gold">Активна · осталось ${days} ${PS.U.plural(days, 'день', 'дня', 'дней')}</span>` : `<div class="muted">${S.days || 30} дней привилегий</div>`}</div>
          <div class="panel gold">${perks.map(p => `<div class="perk"><span class="p-i">${p[0]}</span><span>${p[1]}</span></div>`).join('')}</div>
          <div class="spacer"></div>
          ${active ? '<p class="center muted small" style="margin:14px 0">Продлить можно после окончания срока.</p><button class="btn btn-block btn-lg" data-a="back2">Отлично</button>'
            : `<div class="gap"></div><button class="btn btn-cta btn-lg btn-block" data-a="buy">Купить · ${esc(prod.price || '')}</button>
               <p class="center tiny dim" style="margin-top:8px">Демо: покупка начисляется сразу</p>`}`;
        const back = () => { PS.Snd.play('select'); UI.go(['shop', 'battle', 'lab', 'collection'].indexOf(params.back) >= 0 ? params.back : 'main'); };
        el.querySelector('[data-a=back]').onclick = back;
        const b2 = el.querySelector('[data-a=back2]'); if (b2) b2.onclick = back;
        const buy = el.querySelector('[data-a=buy]');
        if (buy) buy.onclick = () => {
          if (!PS.Meta.buy('seal', UI.now())) { PS.Snd.play('bad'); return; }
          PS.Snd.play('unlock');
          PS.Fx.confetti(40);
          PS.Fx.bigPop('Печать активна!');
          UI.topbar();
          render();
        };
      }
      render();
    },
  });
})();
