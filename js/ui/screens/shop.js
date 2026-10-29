var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
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
        const best = { gems_medium: '+12%', gems_large: '+25%', gems_huge: '+37%' };
        const starter = PS.Meta.starterAvailable(now) ? prod('starter') : null;
        const noAds = prod('no_ads');
        el.innerHTML = `
          <div class="scr-head"><h1>🛒 ${T('Магазин', 'Shop')}</h1></div>
          <button class="panel shop-banner" data-a="seal"><span class="sb-ico">🔱</span><span class="grow" style="text-align:left">
            <span class="card-title c-gold">${T('Печать алхимика', "Alchemist's Seal")}</span><br>
            <span class="card-desc">${seal ? T(`Активна: осталось ${days} дн.`, `Active: ${days}d left`) : T('+50% монет, награда ×2, без рекламы', '+50% coins, ×2 rewards, no ads')}</span></span>
            <span class="btn btn-sm btn-cta">${seal ? T('Открыть', 'Open') : esc(prod('seal').price)}</span></button>
          ${starter ? `<div class="gap"></div><div class="panel shop-banner starter"><span class="sb-ico">🎁</span><span class="grow">
            <span class="card-title">${T('Стартовый набор', 'Starter Pack')}</span><br><span class="card-desc">${starter.gems} 💎 + ${starter.coins} 🪙 · ⏳ <span data-timer>${hhmm(PS.Meta.starterLeftMs ? PS.Meta.starterLeftMs(now) : 0)}</span></span></span>
            <button class="btn btn-sm btn-cta" data-buy="starter">${esc(starter.price)}</button></div>` : ''}
          <div class="sec-title">${T('Бесплатно', 'Free')}</div>
          <div class="card"><div class="card-ico">🎬</div><div class="card-body"><div class="card-title">${D.economy.gems.adGift} 💎 ${T('за рекламу', 'for an ad')}</div>
            <div class="card-desc">${T('Сегодня', 'Today')}: ${giftMax - giftLeft}/${giftMax}</div></div>
            <div class="card-side">${UI.ads.online ? `<button class="btn btn-sm btn-green btn-ad" data-a="gift" ${giftLeft > 0 ? '' : 'disabled'}>${giftLeft > 0 ? T('Смотреть', 'Watch') : T('Завтра', 'Tomorrow')}</button>` : `<span class="tag">${T('Нет сети', 'Offline')}</span>`}</div></div>
          <div class="sec-title" data-focus="gems">${T('Кристаллы', 'Gems')}</div>
          <div class="shop-grid">${gems.map(g => `<div class="panel tight prod">${best[g.id] ? `<span class="tag tag-new p-bonus">${best[g.id]}</span>` : ''}
            <span class="p-ico">${UI.shopIco(g.id)}</span><span class="p-amt">${UI.fmt(g.gems)}</span><span class="p-name">${esc(g.name)}</span>
            <button class="btn btn-sm btn-cta" data-buy="${g.id}">${esc(g.price)}</button></div>`).join('')}</div>
          <div class="sec-title" data-focus="coins">${T('Монеты за кристаллы', 'Coins for gems')}</div>
          <div class="shop-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${D.shop.coinPacks.map(c => `<div class="panel tight prod">
            <span class="p-ico">${UI.shopIco(c.id)}</span><span class="p-amt coin">${UI.fmt(PS.Meta.coinPackAmount ? PS.Meta.coinPackAmount(c.id) : c.coins)}</span><span class="p-name">${esc(c.name || '')}</span>
            <button class="btn btn-sm btn-gem" data-pack="${c.id}"><span class="price">${UI.ico.gem(18)}${c.gems}</span></button></div>`).join('')}</div>
          <div class="sec-title">${T('Прочее', 'Other')}</div>
          <div class="card"><div class="card-ico">${UI.shopIco('no_ads')}</div><div class="card-body"><div class="card-title">${esc(noAds.name || T('Без рекламы', 'No Ads'))}</div><div class="card-desc">${esc(noAds.desc || '')}</div></div>
            <div class="card-side">${p.noAds ? `<span class="tag tag-ok">${T('Куплено', 'Owned')}</span>` : `<button class="btn btn-sm btn-cta" data-buy="no_ads">${esc(noAds.price)}</button>`}</div></div>
          <div class="center tiny dim" style="margin:14px 0 4px">${T('Демо: покупки начисляются сразу, без оплаты', 'Demo: purchases are instant and free')}</div>`;

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
          UI.toast(T(`Куплено: ${it.name || id}`, `Purchased: ${it.name || id}`));
          const from = PS.Fx.centerOf(b);
          keep(render);
          if (it.gems) UI.flyCurrency(from, 'gems', 8);
          if (it.coins) UI.flyCurrency(from, 'coins', 8);
        });
        el.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => {
          const c = PS.DATA.shop.coinPacks.find(x => x.id === b.dataset.pack);
          if (p.gems < c.gems) { PS.Snd.play('bad'); PS.Fx.animClass(b, 'wiggle', 320); UI.toast(T('Не хватает кристаллов', 'Not enough gems')); return; }
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
