var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;

  const FX = {
    maxHp: v => T(`+${v} к макс. HP`, `+${v} max HP`), dmg: v => T(`+${v} урона`, `+${v} damage`), shield: v => T(`+${v} щита`, `+${v} shield`), heal: v => T(`+${v} лечения`, `+${v} heal`),
    startPotion: v => T(`+${v} зелье на старте`, `+${v} starting ${v === 1 ? 'potion' : 'potions'}`), beltSlot: v => T(`+${v} слот пояса`, `+${v} belt ${v === 1 ? 'slot' : 'slots'}`), choices: v => T(`${3 + v} варианта выбора`, `${3 + v} picks to choose from`),
    healAfter: v => T(`+${Math.round(v * 100)}% к лечению`, `+${Math.round(v * 100)}% heal`), effectPct: v => T(`+${Math.round(v * 100)}% к эффектам`, `+${Math.round(v * 100)}% effects`),
    slots: v => `+${v} ${T.pl(v, ['колба', 'колбы', 'колб'], ['tube', 'tubes'])}`, coinsPct: v => T(`+${Math.round(v * 100)}% монет`, `+${Math.round(v * 100)}% coins`),
  };
  // per is {key: perTier} or an array of per-tier objects (each tier adds its own entry).
  function effectAt(def, tier) {
    if (tier <= 0) return '—';
    const sum = {};
    const add = o => Object.keys(o).forEach(k => { if (typeof o[k] === 'number') sum[k] = (sum[k] || 0) + o[k]; });
    if (Array.isArray(def.per)) def.per.slice(0, tier).forEach(add);
    else if (def.per) { const o = {}; Object.keys(def.per).forEach(k => { if (typeof def.per[k] === 'number') o[k] = def.per[k] * tier; }); add(o); }
    const parts = Object.keys(sum).map(k => (FX[k] ? FX[k](Math.round(sum[k] * 1000) / 1000) : `${k} +${sum[k]}`));
    return parts.join(', ') || T(`ступень ${tier}`, `tier ${tier}`);
  }

  UI.screen('lab', {
    chrome: { tab: 'lab' },
    mount(el, params) {
      const p = PS.Meta.profile;
      function render() {
        const ids = Object.keys(PS.DATA.lab || {});
        ids.sort((a, b) => (PS.DATA.lab[a].unlock || 1) - (PS.DATA.lab[b].unlock || 1));
        el.innerHTML = `<div class="scr-head"><h1>⚗️ ${T('Лаборатория', 'Lab')}</h1></div>
          ${!PS.Meta.labOpen() ? `<div class="lab-lock">${T('Откроется после первой попытки', 'Opens after your first run')}</div>` : p.activeRun ? `<div class="lab-lock">${T('Покупки — после попытки', 'Upgrades open after the run')}</div>` : ''}
          <div class="cards">${ids.map(id => {
            const def = PS.DATA.lab[id], tier = PS.Meta.labTier(id), cost = PS.Meta.labCost(id);
            const locked = (def.unlock || 1) > p.maxIsland, max = tier >= def.tiers;
            let tiers = '';
            for (let i = 0; i < def.tiers; i++) tiers += `<i class="${i < tier ? 'on' : ''}"></i>`;
            let side;
            if (locked) side = `<span class="tag">🔒 ${T(`С острова ${def.unlock}`, `Island ${def.unlock}`)}</span>`;
            else if (max) side = `<span class="tag tag-ok">${T('Максимум', 'Max')}</span>`;
            else side = `<button class="btn btn-sm lab-btn ${PS.Meta.canBuyLab(id) ? 'btn-cta' : ''}" data-buy="${id}" ${p.activeRun || !PS.Meta.labOpen() ? 'disabled' : ''}><span class="price">${UI.ico.coin(18)}${UI.fmt(cost)}</span></button>`;
            return `<div class="card${locked ? ' locked' : ''}" data-id="${id}" data-tip="<b>${esc(def.name)}</b><br>${esc(def.desc)}">
              <div class="card-ico">${def.icon}</div>
              <div class="card-body"><span class="card-title">${esc(def.name)}</span>
                ${locked ? `<div class="card-desc">${esc(def.desc)}</div>` : `<div class="lab-fx">${tier ? `${esc(effectAt(def, tier))}${max ? '' : ' → '}` : ''}${max ? '' : `<b>${esc(effectAt(def, tier + 1))}</b>`}</div>`}
                <div class="row lab-lvl"><div class="tiers">${tiers}</div><span class="stack-n">${tier}/${def.tiers}</span></div></div>
              <div class="card-side">${side}</div></div>`;
          }).join('')}</div>`;
        el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
          const id = b.dataset.buy;
          if (!PS.Meta.canBuyLab(id)) {
            PS.Snd.play('bad'); PS.Fx.animClass(b, 'wiggle', 320);
            if (!p.activeRun && PS.Meta.labOpen()) UI.toast(T('Не хватает монет', 'Not enough coins'));
            return;
          }
          PS.Meta.buyLab(id, UI.now());
          PS.Snd.play('buy');
          const card = b.closest('.card');
          PS.Fx.burstAt(card.querySelector('.card-ico'), '#ffcb4f', 16, 50);
          const top = el.scrollTop;
          render();
          el.scrollTop = top;
          UI.topbar();
          const fresh = el.querySelector(`[data-id="${id}"] .card-ico`);
          if (fresh) fresh.animate([{ transform: 'scale(1.3)' }, { transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        });
      }
      render();
      if (params.focus) {
        const c = el.querySelector(`[data-id="${params.focus}"]`);
        if (c) { c.scrollIntoView({ block: 'center' }); c.animate([{ boxShadow: '0 0 0 3px #ffcb4f' }, { boxShadow: '0 0 0 0 #ffcb4f00' }], { duration: 1400 }); }
      }
    },
  });
})();
