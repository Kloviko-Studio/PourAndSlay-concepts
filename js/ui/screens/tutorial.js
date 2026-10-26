var PS = globalThis.PS || (globalThis.PS = {});
// Tutorial layer over the battle screen: island-1 guided hints and one-time "first appearance" hints.
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
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
        // Clamped so the hand stays on screen for targets at the edges (combo chip, drain button).
        if (opts.hand !== false) html += `<div class="tut-hand" style="left:${Math.min(window.innerWidth - 44, r.left + r.width * .62)}px;top:${Math.min(window.innerHeight - 46, r.bottom - Math.min(26, r.height * .35))}px">👆</div>`;
      }
      const H = window.innerHeight, up = r ? r.top : 0, down = r ? H - r.bottom : 0;
      // Untargeted hints sit at the bottom so they never cover a window's title and cards.
      let pos = opts.pos || 'bottom:12px';
      // Field targets get the bubble above the field so it never hides the other row of tubes.
      const field = r && opts.target && opts.target.closest ? opts.target.closest('.bt-field') : null;
      if (field) pos = `bottom:${Math.max(12, H - field.getBoundingClientRect().top + 8)}px`;
      else if (r && Math.max(up, down) < 190) pos = 'bottom:12px';
      else if (r) pos = down > up ? `top:${Math.min(H - 190, r.bottom + 46)}px` : `bottom:${Math.max(12, H - r.top + 14)}px`;
      html += `<div class="tut-bubble" style="${pos}">${opts.title ? `<div class="tt">${opts.title}</div>` : ''}<div class="tx">${opts.text}</div>
        ${block ? `<button class="btn btn-cta btn-sm" data-ok>${opts.button || T('Понятно', 'Got it')}</button>` : ''}</div>`;
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
      ? [n === 0 ? T('Нажми на колбу — возьмёшь верхний слой.', 'Tap a tube to pick up its top layer.') : n === 1 ? T('Ещё раз: выбери колбу.', 'Again: pick a tube.') : T('Последний раз: выбери колбу.', 'One last time: pick a tube.'), T('Переливание', 'Pouring')]
      : [T('Теперь нажми, куда налить. Лить можно на такой же цвет или в пустую колбу.', 'Now tap where to pour. Pour onto the same color or into an empty tube.'), T('Куда налить', 'Where to pour')];
    show({ target: ctx.tubeEl(i), title: texts[1], text: texts[0], block: false });
  }

  // ---------- public ----------
  const Tut = PS.Tutorial = {
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
          if (!seen('close')) queue.push({ key: 'close', target: '.bt-enemy', title: T('Колба закрыта!', 'Tube closed!'), text: T('Полная колба одного цвета закрывается, срабатывает её эффект, а на место приходят слои из очереди.', 'A full tube of one color closes: its effect fires and new layers drop in from the queue.') });
          if (e.color === 'fire' && !seen('fire')) queue.push({ key: 'fire', target: '.bt-einfo', title: T('🔥 Огонь', '🔥 Fire'), text: T('Огонь бьёт врага. Сведи его HP к нулю — и этап пройден.', 'Fire hits the enemy. Bring its HP to zero to clear the stage.') });
          if (e.color === 'water' && !seen('water')) queue.push({ key: 'water', target: '.bt-shield', title: T('💧 Вода = щит', '💧 Water = shield'), text: T('Щит поглощает урон от атаки врага и сгорает после неё.', 'Shield blocks damage from the enemy attack, then breaks.') });
          if (e.color === 'life' && !seen('life')) queue.push({ key: 'life', target: '.bt-player .bar', title: T('🌿 Жизнь = лечение', '🌿 Life = heal'), text: T('Жизнь восстанавливает HP. HP переходит между этапами.', 'Life restores HP. Your HP carries over between stages.') });
        }
        if (e.type === 'boss_fled' && !seen('bossfled')) queue.push({ key: 'bossfled', target: '.bt-sbar', title: T('Ещё увидимся!', 'See you later!'), text: T('Побитый босс может убежать. Он вернётся на следующей встрече с половиной здоровья — и с пластырем. На последнем этапе острова он бьётся до конца.', 'A beaten boss may flee. It comes back next fight with half its HP — and a band-aid. On the island\'s last stage it fights to the end.') });
        if (e.type === 'rage' && !seen('rage')) queue.push({ key: 'rage', target: '.bt-intent', title: T('Ярость!', 'Rage!'), text: T('Финальный босс ранен — теперь он действует на 1 ход раньше. Торопись!', 'The final boss is hurt — now it acts 1 turn sooner. Hurry!') });
      });
      if (guided() && R.phase === 'battle') {
        const st = R.stage;
        if (st === 0 && (flags().pours || 0) >= 1 && !seen('timer') && evs.some(e => e.type === 'turn')) {
          queue.push({ key: 'timer', target: '.bt-intent', title: T('Таймер врага', 'Enemy timer'), text: T('Над врагом — его следующее действие и через сколько ходов оно наступит. Каждое переливание — ход.', 'Above the enemy: its next move and how many turns until it happens. Every pour is a turn.') });
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
      await Tut.flush();
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
        if (st === 1 && !seen('combo')) steps.push({ key: 'combo', target: '.bt-combo', title: T('Комбо', 'Combo'), text: T('Закрывай колбы ход за ходом — эффект растёт: ×1,5 → ×2 → ×3. Ход без закрытия сбрасывает комбо.', 'Close tubes turn after turn and effects grow: ×1.5 → ×2 → ×3. A turn without a close resets the combo.') });
        if (st === 2 && !seen('drain')) steps.push({ key: 'drain', target: '.bt-drain', title: T('Слить колбу', 'Drain a tube'), text: T('Нажми «Слить», затем колбу — она опустеет. Стоит 3 HP и ход. Если ходов нет (тупик) — даром.', 'Tap “Drain”, then a tube to empty it. Costs 3 HP and a turn. Free when you\'re out of moves (dead end).') });
        if (st === 2 && !seen('potions')) steps.push({ key: 'potions', target: '.bt-belt', title: T('Зелья', 'Potions'), text: T('Тапни зелье, чтобы выпить. ↶ Отмена откатит последний ход, ❤ вылечит. Долгое нажатие — описание.', 'Tap a potion to drink it. ↶ Undo takes back your last turn, ❤ heals. Long-press for details.') });
        if (b.enemy.boss && !seen('boss')) steps.push({ key: 'boss', target: '.bt-einfo', title: T('Босс!', 'Boss!'), text: T('Хозяин острова: сильнее обычных врагов и действует хитрее. Победи его, чтобы пройти остров.', 'The island\'s master: tougher and trickier than regular enemies. Beat it to clear the island.') });
      }
      const F = b.field;
      const find = f => F.tubes.findIndex(f);
      let j = find(t => t.layers.some(x => JUNK[x]));
      if (j >= 0 && !seen('junk')) steps.push({ key: 'junk', target: ctx.tubeEl(j), title: T('Мусор', 'Junk'), text: T('🪨 Камень и 🫧 слизь льются только на такой же мусор или в пустую колбу. Полная колба камней рассыпается, слизи — даёт щит. Закрытие соседней колбы разбивает камни.', '🪨 Stone and 🫧 slime pour only onto the same junk or into an empty tube. A full tube of stone crumbles; of slime, gives a shield. Closing a neighboring tube breaks stones.') });
      j = find(t => t.frozen > 0);
      if (j >= 0 && !seen('frozen')) steps.push({ key: 'frozen', target: ctx.tubeEl(j), title: T('Колба заморожена', 'Tube frozen'), text: T('Из неё и в неё нельзя лить, пока не оттает. Число — сколько ходов осталось.', 'No pouring in or out until it thaws. The number shows turns left.') });
      F.tubes.forEach((t, i) => {
        const c = t.layers.find(x => !JUNK[x] && !START[x]);
        if (c && !seen('color_' + c)) {
          const cd = D().colors[c];
          if (cd && !steps.some(s => s.key === 'color_' + c)) steps.push({ key: 'color_' + c, target: ctx.tubeEl(i), title: T(`Новый цвет: ${cd.icon} ${esc(cd.name)}`, `New color: ${cd.icon} ${esc(cd.name)}`), text: esc(cd.desc) });
        }
        if (t.kind !== 'plain' && !seen('tube_' + t.kind)) {
          const td = D().tubes[t.kind];
          if (td && !steps.some(s => s.key === 'tube_' + t.kind)) steps.push({ key: 'tube_' + t.kind, target: ctx.tubeEl(i), title: T(`Особая колба: ${td.icon} ${esc(td.name)}`, `Special tube: ${td.icon} ${esc(td.name)}`), text: esc(td.desc) });
        }
      });
      if (b.stuck && !seen('deadend')) steps.push({ key: 'deadend', target: '.bt-drain', title: T('Тупик', 'Dead end'), text: T('Ходов нет. Слей любую колбу — сейчас это бесплатно и не тратит ход.', 'No moves left. Drain any tube — right now it\'s free and costs no turn.') });
      if (!steps.length) return;
      queue = queue.concat(steps);
      await Tut.flush();
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
          Tut.once('boosters', { target: '[data-boosts]', title: T('Бусты', 'Boosts'), text: T('Перед островом можно взять бусты за 💎 — они действуют одну попытку. Не обязательно: жми «Начать».', 'Before an island you can grab boosts for 💎 — they last one run. Optional: just hit “Start”.'), hand: false });
        }, 450);
      }
      if (name === 'results' && !seen('lab') && P().stats.runs >= 1) {
        const labHint = () => {
          if (UI.current() !== 'results' || seen('lab')) return;
          // The results screen may open an interstitial; the hint would sit above the ad, so wait for it to close.
          if (document.querySelector('#overlays .ov')) { setTimeout(labHint, 400); return; }
          Tut.once('lab', { target: '.scr-results [data-a=lab]', title: T('Лаборатория', 'Lab'), text: T('Монеты остаются после попытки. Трать их в Лаборатории на вечные улучшения — и попробуй снова.', 'You keep your coins after a run. Spend them in the Lab on permanent upgrades — then try again.') });
        };
        setTimeout(labHint, 1100);
      }
    } catch (e) { console.warn(e); }
  };
})();
