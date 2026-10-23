var PS = globalThis.PS || (globalThis.PS = {});
// Tutorial layer over the battle screen: island-1 guided hints and one-time "first appearance" hints.
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const D = () => PS.DATA;
  const P = () => PS.Meta.profile;
  const START = { fire: true, water: true, life: true };
  const JUNK = { stone: true, slime: true };

  let ctx = null;          // battle API from attach()
  let cur = null;          // {layer, resolve, forced}
  let forced = null;       // {from, to}
  let queue = [];          // pending blocking hints {key, ...}
  let showing = false;

  const flags = () => { const p = P(); if (!p.tutorial || typeof p.tutorial !== 'object') p.tutorial = {}; return p.tutorial; };
  const seen = k => !!flags()[k];
  function mark(k) { flags()[k] = true; UI.save(); }

  const guided = () => !!(ctx && ctx.R.island === 1 && !P().cleared[1]);
  const B = () => ctx && ctx.R.battle;

  // ---------- drawing ----------
  function rectOf(t) {
    if (!t) return null;
    if (typeof t === 'string') t = document.querySelector(t);
    if (!t || !t.getBoundingClientRect) return null;
    const r = t.getBoundingClientRect();
    return r.width || r.height ? r : null;
  }

  function hide() {
    if (cur) { cur.layer.remove(); const r = cur.resolve; cur = null; if (r) r(); }
  }

  // opts: {target, title, text, button, block (default true), hand (default true), soft}
  function show(opts) {
    hide();
    return new Promise(resolve => {
      const layer = document.createElement('div');
      layer.className = 'tut-layer';
      const block = opts.block !== false;
      const r = rectOf(opts.target);
      let html = block ? '<div class="tut-catch"></div>' : '';
      if (r) {
        const pad = 6;
        html += `<div class="tut-ring${opts.soft || !block ? ' soft' : ''}" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>`;
        if (opts.hand !== false) html += `<div class="tut-hand" style="left:${r.left + r.width * .62}px;top:${r.bottom - Math.min(26, r.height * .35)}px">👆</div>`;
      }
      const H = window.innerHeight, up = r ? r.top : 0, down = r ? H - r.bottom : 0;
      // Untargeted hints sit at the bottom so they never cover a window's title and cards.
      let pos = opts.pos || 'bottom:12px';
      if (r && Math.max(up, down) < 190) pos = 'bottom:12px';
      else if (r) pos = down > up ? `top:${Math.min(H - 190, r.bottom + 46)}px` : `bottom:${Math.max(12, H - r.top + 14)}px`;
      html += `<div class="tut-bubble" style="${pos}">${opts.title ? `<div class="tt">${opts.title}</div>` : ''}<div class="tx">${opts.text}</div>
        ${block ? `<button class="btn btn-cta btn-sm" data-ok>${opts.button || 'Понятно'}</button>` : ''}</div>`;
      layer.innerHTML = html;
      document.body.appendChild(layer);
      cur = { layer, resolve, forced: !block };
      const ok = layer.querySelector('[data-ok]');
      if (ok) ok.onclick = e => { e.stopPropagation(); PS.Snd.play('select'); hide(); };
    });
  }

  // ---------- forced pours (island 1, stage 1) ----------
  function bestPour() {
    const F = B().field, Fd = PS.Field, out = [];
    for (let a = 0; a < F.tubes.length; a++) for (let b = 0; b < F.tubes.length; b++) {
      const n = Fd.pourAmount(F, a, b);
      if (!n) continue;
      const ta = F.tubes[a], tb = F.tubes[b], color = ta.layers[ta.layers.length - 1];
      let s = 0;
      if (tb.layers.length + n === tb.cap && tb.layers.every(x => x === color) && tb.kind !== 'vial') s += 100;
      if (tb.layers.length) s += 10 + tb.layers.length;
      // Emptying the source down to a uniform stack sets up the next close.
      const rest = ta.layers.slice(0, ta.layers.length - n);
      if (rest.length && rest.every(x => x === rest[0])) s += 5;
      if (!JUNK[color]) s += 2;
      out.push({ from: a, to: b, s });
    }
    out.sort((x, y) => y.s - x.s);
    return out[0] || null;
  }

  function pointForced() {
    if (!forced || !ctx) return;
    const sel = ctx.getSel();
    const n = flags().pours || 0;
    const step = sel === forced.from ? 'to' : 'from';
    const i = step === 'from' ? forced.from : forced.to;
    const texts = step === 'from'
      ? [n === 0 ? 'Нажми на колбу — возьмёшь верхний слой.' : n === 1 ? 'Ещё раз: выбери колбу.' : 'Последний раз: выбери колбу.', 'Переливание']
      : ['Теперь нажми, куда налить. Лить можно на такой же цвет или в пустую колбу.', 'Куда налить'];
    show({ target: ctx.tubeEl(i), title: texts[1], text: texts[0], block: false });
  }

  // ---------- public ----------
  const T = PS.Tutorial = {
    attach(api) { ctx = api; queue = []; forced = null; },
    detach() { hide(); ctx = null; forced = null; queue = []; showing = false; },
    hide() { hide(); forced = null; },
    active: () => !!cur,
    // Battle asks before reacting to a tube tap.
    allowTube(i) {
      if (showing && !forced) return false;
      if (!forced) return true;
      const sel = ctx.getSel();
      return sel === forced.from ? i === forced.to : i === forced.from;
    },
    // Belt, drain and other field controls stay dead while a hint holds the player's attention.
    locked: () => showing || !!forced,
    onSelect() { if (forced) pointForced(); },
    onAction(a) {
      if (forced && a.type === 'pour') { flags().pours = (flags().pours || 0) + 1; UI.save(); }
      forced = null;
      hide();
    },
    onEvents(evs) {
      if (!ctx) return;
      const R = ctx.R;
      evs.forEach(e => {
        if (e.type === 'close' && !e.junk) {
          if (!seen('close')) queue.push({ key: 'close', target: '.bt-enemy', title: 'Колба закрыта!', text: 'Полная колба одного цвета закрывается, срабатывает её эффект, а на место приходят слои из очереди.' });
          if (e.color === 'fire' && !seen('fire')) queue.push({ key: 'fire', target: '.bt-einfo', title: '🔥 Огонь', text: 'Огонь бьёт врага. Сведи его HP к нулю — и этап пройден.' });
          if (e.color === 'water' && !seen('water')) queue.push({ key: 'water', target: '.bt-shield', title: '💧 Вода = щит', text: 'Щит поглощает урон от атаки врага и сгорает после неё.' });
          if (e.color === 'life' && !seen('life')) queue.push({ key: 'life', target: '.bt-player .bar', title: '🌿 Жизнь = лечение', text: 'Жизнь восстанавливает HP. HP переходит между этапами.' });
        }
        if (e.type === 'boss_fled' && !seen('bossfled')) queue.push({ key: 'bossfled', target: '.bt-sbar', title: 'Босс сбежал!', text: 'Он вернётся на следующей встрече с тем HP, что у него осталось. Добей его там.' });
        if (e.type === 'rage' && !seen('rage')) queue.push({ key: 'rage', target: '.bt-intent', title: 'Ярость!', text: 'Финальный босс ранен — теперь он действует на 1 ход раньше. Торопись!' });
      });
      if (guided() && R.phase === 'battle') {
        const st = R.stage;
        if (st === 0 && (flags().pours || 0) >= 1 && !seen('timer') && evs.some(e => e.type === 'turn')) {
          queue.push({ key: 'timer', target: '.bt-intent', title: 'Таймер врага', text: 'Над врагом — его следующее действие и через сколько ходов оно наступит. Каждое переливание — ход.' });
        }
      }
    },
    // Blocking hints queued by events; awaited before the battle routes to a window.
    async flush() {
      while (queue.length && ctx) {
        const h = queue.shift();
        if (seen(h.key)) continue;
        mark(h.key);
        showing = true;
        await show(h);
        showing = false;
      }
    },
    // Called whenever the battle becomes idle and accepts input.
    async idle() {
      if (!ctx || showing) return;
      await T.flush();
      if (!ctx) return;
      const R = ctx.R, b = B();
      if (R.phase !== 'battle' || !b || b.status !== 'active') return;
      const st = R.stage;
      const steps = [];
      if (guided()) {
        if (st === 0 && (flags().pours || 0) < 3) {
          forced = bestPour();
          if (forced) { pointForced(); return; }
        }
        if (st === 1 && !seen('combo')) steps.push({ key: 'combo', target: '.bt-combo', title: 'Комбо', text: 'Закрывай колбы ход за ходом — эффект растёт: ×1,5 → ×2 → ×3. Ход без закрытия сбрасывает комбо.' });
        if (st === 2 && !seen('drain')) steps.push({ key: 'drain', target: '.bt-drain', title: 'Слить колбу', text: 'Нажми «Слить», затем колбу — она опустеет. Стоит 3 HP и ход. Если ходов нет (тупик) — даром.' });
        if (st === 2 && !seen('potions')) steps.push({ key: 'potions', target: '.bt-belt', title: 'Зелья', text: 'Тапни зелье, чтобы выпить. ↶ Отмена откатит последний ход, ❤ вылечит. Долгое нажатие — описание.' });
        if (b.enemy.boss && !seen('boss')) steps.push({ key: 'boss', target: '.bt-einfo', title: 'Босс!', text: 'Боссы встречаются на нескольких этапах острова. Сбей ему часть HP — он сбежит и вернётся позже с остатком здоровья. На последней встрече он бьётся до конца.' });
      }
      const F = b.field;
      const find = f => F.tubes.findIndex(f);
      let j = find(t => t.layers.some(x => JUNK[x]));
      if (j >= 0 && !seen('junk')) steps.push({ key: 'junk', target: ctx.tubeEl(j), title: 'Мусор', text: '🪨 Камень и 🫧 слизь льются только на такой же мусор или в пустую колбу. Полная колба камней рассыпается, слизи — даёт щит. Закрытие соседней колбы разбивает камни.' });
      j = find(t => t.frozen > 0);
      if (j >= 0 && !seen('frozen')) steps.push({ key: 'frozen', target: ctx.tubeEl(j), title: 'Колба заморожена', text: 'Из неё и в неё нельзя лить, пока не оттает. Число — сколько ходов осталось.' });
      F.tubes.forEach((t, i) => {
        const c = t.layers.find(x => !JUNK[x] && !START[x]);
        if (c && !seen('color_' + c)) {
          const cd = D().colors[c];
          if (cd && !steps.some(s => s.key === 'color_' + c)) steps.push({ key: 'color_' + c, target: ctx.tubeEl(i), title: `Новый цвет: ${cd.icon} ${esc(cd.name)}`, text: esc(cd.desc) });
        }
        if (t.kind !== 'plain' && !seen('tube_' + t.kind)) {
          const td = D().tubes[t.kind];
          if (td && !steps.some(s => s.key === 'tube_' + t.kind)) steps.push({ key: 'tube_' + t.kind, target: ctx.tubeEl(i), title: `Особая колба: ${td.icon} ${esc(td.name)}`, text: esc(td.desc) });
        }
      });
      if (b.stuck && !seen('deadend')) steps.push({ key: 'deadend', target: '.bt-drain', title: 'Тупик', text: 'Ходов нет. Слей любую колбу — сейчас это бесплатно и не тратит ход.' });
      if (!steps.length) return;
      queue = queue.concat(steps);
      await T.flush();
    },
    // One-off hint for in-run windows (pick, relic, revive). Resolves when dismissed or immediately if seen.
    async once(key, h) {
      if (seen(key)) return;
      mark(key);
      showing = true;
      await show(Object.assign({ key }, h));
      showing = false;
    },
    guided,
    reset() { P().tutorial = {}; UI.save(); },
  };

  // Out-of-battle first-time hints hook into navigation, since those screens belong to other modules.
  const go0 = UI.go;
  UI.go = function (name, params) {
    go0.call(UI, name, params);
    if (!ctx) hide();
    try {
      if (name === 'start' && !seen('boosters')) {
        setTimeout(() => {
          if (UI.current() !== 'start' || seen('boosters')) return;
          T.once('boosters', { target: '[data-boosts]', title: 'Бусты', text: 'Перед островом можно взять бусты за 💎 — они действуют одну попытку. Не обязательно: жми «Начать».', hand: false });
        }, 450);
      }
      if (name === 'results' && !seen('lab') && P().stats.runs >= 1) {
        setTimeout(() => {
          if (UI.current() !== 'results' || seen('lab')) return;
          T.once('lab', { target: '.scr-results [data-a=lab]', title: 'Лаборатория', text: 'Монеты остаются после попытки. Трать их в Лаборатории на вечные улучшения — и попробуй снова.' });
        }, 700);
      }
    } catch (e) { console.warn(e); }
  };
})();
