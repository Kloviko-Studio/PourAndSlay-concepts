var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  let timer = null;

  const hhmm = UI.hhmm;

  UI.screen('shop', {
    chrome: { tab: 'shop' },
    mount(el, params) {
      const p = PS.Meta.profile, D = PS.DATA;
      const prod = id => D.shop.products.find(x => x.id === id) || {};
      function render() {
        const now = UI.now();
        const seal = PS.Meta.sealActive(now), days = PS.Meta.sealDaysLeft(now);
        const giftLeft = PS.Meta.adGiftLeft(now), giftMax = D.economy.gems.adGiftPerDay;
        const gems = D.shop.products.filter(x => /^gems_/.test(x.id));
        const best = { gems_450: '+12%', gems_1000: '+25%', gems_2200: '+37%' };
        const starter = PS.Meta.starterAvailable(now) ? prod('starter') : null;
        const noAds = prod('no_ads');
        el.innerHTML = `
          <div class="scr-head"><h1>🛒 Магазин</h1></div>
          <button class="panel shop-banner" data-a="seal"><span class="sb-ico">🔱</span><span class="grow" style="text-align:left">
            <span class="card-title c-gold">Печать алхимика</span><br>
            <span class="card-desc">${seal ? `Активна: осталось ${days} дн.` : '+50% монет, награда ×2, без рекламы'}</span></span>
            <span class="btn btn-sm btn-cta">${seal ? 'Открыть' : esc(prod('seal').price)}</span></button>
          ${starter ? `<div class="gap"></div><div class="panel shop-banner starter"><span class="sb-ico">🎁</span><span class="grow">
            <span class="card-title">Стартовый набор</span><br><span class="card-desc" style="color:#ffe3c4">${starter.gems} 💎 + ${starter.coins} 🪙 · ⏳ <span data-timer>${hhmm(PS.Meta.starterLeftMs ? PS.Meta.starterLeftMs(now) : 0)}</span></span></span>
            <button class="btn btn-sm btn-cta" data-buy="starter">${esc(starter.price)}</button></div>` : ''}
          <div class="sec-title">Бесплатно</div>
          <div class="card"><div class="card-ico">🎬</div><div class="card-body"><div class="card-title">${D.economy.gems.adGift} 💎 за рекламу</div>
            <div class="card-desc">Сегодня: ${giftMax - giftLeft}/${giftMax}</div></div>
            <div class="card-side">${UI.ads.online ? `<button class="btn btn-sm btn-green btn-ad" data-a="gift" ${giftLeft > 0 ? '' : 'disabled'}>${giftLeft > 0 ? 'Смотреть' : 'Завтра'}</button>` : '<span class="tag">Нет сети</span>'}</div></div>
          <div class="sec-title" data-focus="gems">Кристаллы</div>
          <div class="shop-grid">${gems.map(g => `<div class="panel tight prod">${best[g.id] ? `<span class="tag tag-new p-bonus">${best[g.id]}</span>` : ''}
            <span class="p-ico">${g.icon || '💎'}</span><span class="p-amt">${UI.fmt(g.gems)} 💎</span><span class="p-name">${esc(g.name)}</span>
            <button class="btn btn-sm btn-cta" data-buy="${g.id}">${esc(g.price)}</button></div>`).join('')}</div>
          <div class="sec-title" data-focus="coins">Монеты за кристаллы</div>
          <div class="shop-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${D.shop.coinPacks.map(c => `<div class="panel tight prod">
            <span class="p-ico">${c.icon || '🪙'}</span><span class="p-amt coin">${UI.fmt(PS.Meta.coinPackAmount ? PS.Meta.coinPackAmount(c.id) : c.coins)} 🪙</span><span class="p-name">${esc(c.name || '')}</span>
            <button class="btn btn-sm btn-gem" data-pack="${c.id}">💎${c.gems}</button></div>`).join('')}</div>
          <div class="sec-title">Прочее</div>
          <div class="card"><div class="card-ico">🚫</div><div class="card-body"><div class="card-title">${esc(noAds.name || 'Без рекламы')}</div><div class="card-desc">${esc(noAds.desc || '')}</div></div>
            <div class="card-side">${p.noAds ? '<span class="tag tag-ok">Куплено</span>' : `<button class="btn btn-sm btn-cta" data-buy="no_ads">${esc(noAds.price)}</button>`}</div></div>
          <div class="center tiny dim" style="margin:14px 0 4px">Демо: покупки начисляются сразу, без оплаты</div>`;

        el.querySelector('[data-a=seal]').onclick = () => { PS.Snd.play('select'); UI.go('seal', { back: 'shop' }); };
        const gift = el.querySelector('[data-a=gift]');
        if (gift) gift.onclick = async () => {
          if (PS.Meta.adGiftLeft(UI.now()) <= 0) return;
          if (!(await UI.ads.show('rewarded'))) return;
          if (PS.Meta.claimAdGift(UI.now())) {
            PS.Snd.play('gem');
            keep(render);
            UI.flyCurrency(el.querySelector('[data-a=gift]') || el, 'gems', 3);
          }
        };
        el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
          const id = b.dataset.buy;
          if (!PS.Meta.buy(id, UI.now())) { PS.Snd.play('bad'); return; }
          PS.Snd.play('buy');
          const it = prod(id);
          UI.toast(`Куплено: ${it.name || id}`);
          const from = PS.Fx.centerOf(b);
          keep(render);
          if (it.gems) UI.flyCurrency(from, 'gems', 8);
          if (it.coins) UI.flyCurrency(from, 'coins', 8);
        });
        el.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => {
          const c = PS.DATA.shop.coinPacks.find(x => x.id === b.dataset.pack);
          if (p.gems < c.gems) { PS.Snd.play('bad'); PS.Fx.animClass(b, 'wiggle', 320); UI.toast('Не хватает кристаллов'); return; }
          if (!PS.Meta.buyCoinPack(c.id)) { PS.Snd.play('bad'); return; }
          PS.Snd.play('buy');
          UI.flyCurrency(b, 'coins', 8);
          keep(render);
        });
      }
      function keep(fn) { const t = el.scrollTop; fn(); el.scrollTop = t; UI.topbar(); }
      render();
      if (params.focus) {
        const f = el.querySelector(`[data-focus="${params.focus}"]`);
        if (f) el.scrollTop = Math.max(0, f.offsetTop - 8);
      }
      timer = setInterval(() => {
        const t = el.querySelector('[data-timer]');
        if (t && PS.Meta.starterLeftMs) t.textContent = hhmm(PS.Meta.starterLeftMs(UI.now()));
      }, 1000);
    },
    unmount() { clearInterval(timer); },
  });
})();
