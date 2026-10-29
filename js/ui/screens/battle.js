var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc, Snd = PS.Snd;
  const Fx = PS.Fx;
  const bigPop = (text, color) => Fx.bigPop(text, color, '24%');
  const T = PS.T;
  const D = () => PS.DATA;
  const Tut = () => PS.Tutorial || null;
  const sleep = ms => UI.sleep(ms / (UI.speed || 1));
  const kfmt = k => String(Math.round(k * 100) / 100).replace('.', T(',', '.'));
  const TUBE_POTIONS = { solvent: true, shake: true };
  const JUNK = { stone: true, slime: true };

  let S = null;

  // ---------- content helpers ----------
  const colorDef = c => D().elements[c] || D().junk[c] || { css: '#888888', icon: '?', name: c };
  const iconOf = c => UI.elIco(c);
  function layerBg(c) {
    const tex = D().elements[c] || D().junk[c] ? `;background-image:url(img/texture/tubes/liquid_${c}.webp)` : '';
    return `background-color:${colorDef(c).css}${tex}`;
  }
  const turnsTxt = n => n + ' ' + T.pl(n, ['ход', 'хода', 'ходов'], ['turn', 'turns']);
  // One tube's glass, liquid, ice and cork; the catalog's tube showcase draws with it too.
  // o.fill: the last n layers rise in and their run's icon fades in after them; o.drop: layers from this index up fall in from the mouth;
  // o.flash: indexes of recoloured layers; o.runs: runs on screen before (runKey), whose icons stay while the others fade in;
  // o.iceIn: the ice is new; o.cork / o.glow: a closed tube.
  UI.tubeHtml = function (t, o) {
    o = o || {};
    const n = t.layers.length, sp = o.fill || 0, dr = o.drop;
    // Equal neighbours read as one body of liquid: one icon at the middle of each run (carried by its bottom layer).
    let run = 0;
    const layers = t.layers.map((c, k) => {
      if (k === 0 || c !== t.layers[k - 1]) { run = 1; while (t.layers[k + run] === c) run++; }
      const first = k === 0 || c !== t.layers[k - 1];
      const drops = dr != null && k >= dr;
      const cls = 'bt-layer' + (k === n - 1 ? ' top' : '') + (sp && k >= n - sp ? ' fill' : '') + (drops ? ' drop' : '') + (o.flash && o.flash.has(k) ? ' flash' : '');
      let ic = '';
      if (first) {
        const fade = sp && k + run === n ? 'late' : o.runs && !drops && !o.runs.has(runKey(k, run, c)) ? 'fresh' : '';
        ic = `<i${fade ? ` class="${fade}"` : ''} style="--run:${run}">${iconOf(c)}</i>`;
      }
      return `<div class="${cls}" style="--k:${k};${drops ? `--d:${k - dr};` : ''}${sp && k >= n - sp ? `--j:${k - n + sp};` : ''}${layerBg(c)}">${ic}</div>`;
    }).join('');
    return `<div class="bt-tube k-${t.kind}${o.glow ? ' closed' : ''}" style="--cap:${t.cap}${o.glow ? `;--glow:${o.glow}` : ''}"><div class="bt-liq">${layers}</div>` +
      `${t.frozen ? `<div class="bt-ice${o.iceIn ? ' in' : ''}">${UI.elIco('freeze')} ${t.frozen}</div>` : ''}${o.cork ? '<div class="bt-cork"></div>' : ''}</div>`;
  };
  const runKey = (k, run, c) => k + ':' + run + ':' + c;
  function runsOf(layers) {
    const out = new Set();
    for (let k = 0; k < layers.length;) { let r = 1; while (layers[k + r] === layers[k]) r++; out.add(runKey(k, r, layers[k])); k += r; }
    return out;
  }

  const INTENT = {
    atk: [T('удар', 'attack'), UI.intentIco('atk')], stone: [T('камни в колбы', 'stones in tubes'), UI.intentIco('stone')], spores: [T('слизь в очередь', 'slime in queue'), UI.intentIco('spores')], freeze: [T('заморозит колбу', 'freezes a tube'), UI.intentIco('freeze')],
    steal: [T('украдёт слой', 'steals a layer'), UI.intentIco('steal')], swap: [T('поменяет цвета', 'swaps colors'), UI.intentIco('swap')], shield: [T('щит', 'shield'), UI.intentIco('shield')], buff: [T('усилит удар', 'powers up'), UI.intentIco('buff')], heal: [T('лечение', 'heal'), UI.intentIco('heal')],
  };
  const INTENT_TIP = {
    atk: T('Ударит по тебе. Щит поглощает урон и сгорает после атаки.', 'Hits you. Shield blocks the damage, then breaks.'), stone: T('Положит камни в колбы. Камни разбиваются, когда закрываешь соседнюю колбу.', 'Drops stones into tubes. Stones break when you close a neighboring tube.'),
    spores: T('Превратит слои очереди в слизь.', 'Turns queued layers into slime.'), freeze: T('Заморозит колбу: из неё и в неё нельзя лить.', 'Freezes a tube: no pouring in or out.'), steal: T('Украдёт верхний слой одной колбы.', 'Steals the top layer of one tube.'),
    swap: T('Поменяет местами два цвета на всём поле.', 'Swaps two colors across the whole field.'), shield: T('Закроется щитом — он поглощает урон (яд идёт насквозь).', 'Raises a shield that blocks damage (poison goes through).'), buff: T('Следующая атака будет ×2.', 'Next attack deals ×2.'), heal: T('Вылечит себя.', 'Heals itself.'),
  };
  function intentValue(it, buff) {
    if (!it) return '';
    const [, ico] = INTENT[it.t] || ['', it.t];
    if (it.t === 'atk') return `${ico} ${it.v * (buff || 1)}`;
    if (it.t === 'stone' || it.t === 'spores') return `${ico}×${it.v}`;
    if (it.t === 'shield' || it.t === 'heal') return `${ico} ${it.v}`;
    if (it.t === 'buff') return `${ico}×2`;
    return ico;
  }

  // Effect numbers for tooltips; between battles the stale battle copy is overlaid with the run's current build.
  function valB() {
    const R = S.R, B = R.battle;
    if (!B) return null;
    if (R.phase === 'battle') return B;
    return Object.assign({}, B, { deck: R.deck, mods: R.mods, relics: R.relics, combo: 0, lastColor: null, enemy: Object.assign({}, B.enemy, { frozen: 0 }) });
  }
  function colorValue(c, kind) {
    const B = valB();
    if (!B) return '';
    const k = 1, v = PS.Combat.effectValue(B, c, k, kind || 'plain'), cd = D().elements[c];
    switch (c) {
      case 'fire': case 'lightning': case 'dark': return T(`${v} урона`, `${v} damage`);
      case 'water': return T(`${v} щита`, `${v} shield`);
      case 'life': return T(`${v} лечения`, `${v} heal`);
      case 'poison': return `${v}/${T('ход', 'turn')} × ${(B.relics || []).indexOf('poison_ivy') >= 0 ? D().relics.poison_ivy.turns : cd.base.turns}`;
      case 'ice': return T(`заморозка ${turnsTxt(v)}`, `freeze for ${turnsTxt(v)}`);
      case 'mirror': return T('повтор последнего', 'repeats last');
    }
    return String(v);
  }

  // ---------- view model (numbers shown while events play) ----------
  function inBattle() { return S.R.phase === 'battle' && !!S.R.battle; }
  function syncVm() {
    const R = S.R, B = R.battle, vm = S.vm;
    const live = B && (R.phase === 'battle' || R.phase === 'revive');
    vm.pHp = live ? B.player.hp : R.hp;
    vm.pMax = live ? B.player.maxHp : R.maxHp;
    vm.pShield = live ? B.player.shield : 0;
    if (B) {
      const pv = PS.Combat.preview(B);
      vm.eHp = B.enemy.hp; vm.eMax = B.enemy.maxHp; vm.eShield = B.enemy.shield;
      vm.intent = pv.intent; vm.timer = pv.timer; vm.frozen = pv.frozen; vm.rage = pv.rage; vm.buff = pv.buff;
      vm.combo = B.combo;
    }
  }

  // ---------- DOM ----------
  const $ = sel => S.el.querySelector(sel);
  const tubeEl = i => S && S.el.querySelector(`.bt-tw[data-i="${i}"]`);
  const monEl = () => $('.bt-mon');

  function skeleton() {
    S.el.innerHTML = `
      <div class="bt-scene">
      <div class="bt-top">
        <button class="btn-icon" data-a="pause" aria-label="${T('Пауза', 'Pause')}">${UI.ico.pause}</button>
        <div class="bt-stage"></div>
        <button class="btn-icon" data-a="build" aria-label="${T('Сборка', 'Build')}">${UI.ico.bag}</button>
      </div>
      <div class="bt-enemy">
        <div class="bt-arena">
          <div class="bt-mon"><div class="bt-mon-shadow"></div><div class="bt-mon-body"></div><div class="bt-bubble"></div></div>
        </div>
        <div class="bt-chips"></div>
        <div class="bt-enemy-hud"><div class="bt-portrait" aria-hidden="true"></div>
        <div class="bt-einfo">
          <div class="bt-ename"></div><div class="bt-ehint"></div>
          <div class="bt-bar"><div class="bar bar-enemy"><div class="bar-ghost"></div><div class="bar-fill"></div><div class="bt-shieldbar"></div><span class="bar-label"></span></div></div>
        </div><div class="bt-intent"></div></div>
      </div>
      </div>
      <div class="bt-ground">
      <div class="bt-player">
        <span class="bt-heart">${UI.ico.heart(28)}</span>
        <div class="bar bar-hp"><div class="bar-ghost"></div><div class="bar-fill"></div><div class="bt-pshield"></div>
          <span class="bar-label"><span class="bar-txt"></span></span></div>
        <span class="bt-shield zero" data-tip="${T('<b>Щит</b><br>Поглощает урон от атаки врага и сгорает после неё.', '<b>Shield</b><br>Blocks damage from the enemy attack, then breaks.')}">${UI.ico.shield(16)}<b>0</b></span>
        <div class="bt-combo" data-tip="${T('<b>Комбо</b><br>Закрытия подряд усиливают эффект: ×1,5 → ×2 → ×3. Ход без закрытия сбрасывает комбо.', '<b>Combo</b><br>Back-to-back closes boost effects: ×1.5 → ×2 → ×3. A turn without a close resets the combo.')}">×1</div>
      </div>
      <div class="bt-field">
        <div class="bt-row" data-row="0"></div><div class="bt-row" data-row="1"></div><div class="bt-queue"></div></div>
      <div class="bt-bottom"><div class="bt-belt"></div><button class="btn btn-blue bt-drain" data-a="drain"></button></div>
      </div>`;
  }

  function renderTop() {
    const R = S.R, isl = UI.island(R.island) || { stages: 1, bossAt: [] };
    $('.bt-stage').innerHTML = PS.BattleLayout.progress(R.island, R.stage + 1, isl.stages, isl.bossAt, UI.art('boss', 14));
  }

  function enemyMeta() {
    const B = S.R.battle;
    if (!B) return null;
    const e = B.enemy, st = S.R.stages[S.R.stage] || {};
    const def = e.boss ? D().bosses[e.id] : D().enemies[e.id];
    return { e, def: def || {}, boss: e.boss, enc: st.encounter || 0 };
  }

  function renderMonster(enter) {
    const m = enemyMeta();
    if (!m) return;
    const mon = monEl();
    // Runs after every move; rebuilding an unchanged svg would re-parse it and re-attach the painted picture each time.
    const art = UI.enemyArt(m.e.id, { rage: S.vm.rage, patched: m.e.patched }), body = mon.querySelector('.bt-mon-body');
    if (body._art !== art) { body.innerHTML = art; body._art = art; }
    const portrait = $('.bt-portrait');
    if (portrait._id !== m.e.id) { portrait.innerHTML = UI.enemyArt(m.e.id, {}); portrait._id = m.e.id; }
    mon.classList.remove('dead', 'flee');
    mon.classList.toggle('gone', m.e && S.R.battle.status !== 'active' && S.R.battle.status !== 'lost');
    if (enter) Fx.animClass(mon, 'enter', 560);
    const encs = S.R.boss ? S.R.boss.encounters : 1;
    const heals = m.e.cycle.some(c => c.t === 'heal') ? Math.max(0, D().economy.enemyHeals - (m.e.heals || 0)) : null;
    $('.bt-ename').innerHTML = `${m.boss && encs > 1 ? `<span class="tag">${T(`встреча ${m.enc + 1}/${encs}`, `fight ${m.enc + 1}/${encs}`)}</span>` : ''}
      ${heals != null ? `<span class="tag" data-tip="${T(`Враг лечится не больше ${D().economy.enemyHeals} раз за бой`, `Enemy heals at most ${D().economy.enemyHeals} times per fight`)}">💚 ${heals}</span>` : ''}`;
  }

  function setBar(bar, v, max, label) {
    const off = (Math.max(0, Math.min(100, max ? v / max * 100 : 0)) - 100) + '%';
    bar.querySelector('.bar-fill').style.setProperty('--off', off);
    const g = bar.querySelector('.bar-ghost');
    if (g) g.style.setProperty('--off', off);
    (bar.querySelector('.bar-txt') || bar.querySelector('.bar-label')).textContent = label;
  }

  function renderEnemyBars() {
    const vm = S.vm, B = S.R.battle;
    if (!B) return;
    const bar = $('.bt-einfo .bar');
    setBar(bar, vm.eHp, vm.eMax, `${Math.max(0, vm.eHp)} / ${vm.eMax}`);
    bar.querySelector('.bt-shieldbar').style.width = vm.eShield > 0 ? Math.min(100, vm.eShield / vm.eMax * 100) + '%' : '0';
    const pv = PS.Combat.preview(B);
    $('.bt-einfo .bt-bar').querySelectorAll('.bt-mark').forEach(x => x.remove());
    const hint = $('.bt-ehint');
    let mark = null;
    if (pv.rageAt != null && !vm.rage) { mark = { at: pv.rageAt, cls: ' rage' }; hint.textContent = T(`ярость при ${pv.rageAt} HP`, `rage at ${pv.rageAt} HP`); hint.dataset.tip = T('<b>Ярость</b><br>Раненый финальный босс действует на 1 ход раньше.', '<b>Rage</b><br>A wounded final boss acts 1 turn sooner.'); }
    else { hint.textContent = ''; delete hint.dataset.tip; }
    if (mark && vm.eMax) {
      const i = document.createElement('i');
      i.className = 'bt-mark' + mark.cls;
      i.style.left = (mark.at / vm.eMax * 100) + '%';
      $('.bt-einfo .bt-bar').appendChild(i);
    }
    const mon = monEl();
    mon.classList.toggle('frozen', vm.frozen > 0);
    mon.classList.toggle('buffed', vm.buff > 1);
    mon.classList.toggle('shielded', vm.eShield > 0);
    renderChips();
  }

  function renderChips() {
    const vm = S.vm, B = S.R.battle, e = B.enemy, out = [];
    if (vm.eShield > 0) out.push(['c-shield', `${UI.ico.shield(14)} ${vm.eShield}`, T('Щит врага поглощает урон. Яд идёт насквозь.', 'Enemy shield blocks damage. Poison goes through.')]);
    const pz = e.poison.reduce((s, p) => s + p.tick, 0);
    if (pz) out.push(['c-poison', `${UI.elBadge('poison')} ${pz}`, T(`Яд: ${pz} урона за ход, мимо щита. Осталось до ${turnsTxt(Math.max.apply(null, e.poison.map(p => p.turns)))}.`, `Poison: ${pz} damage per turn, ignores shield. Up to ${turnsTxt(Math.max.apply(null, e.poison.map(p => p.turns)))} left.`)]);
    if (vm.frozen > 0) out.push(['c-ice', `${UI.elBadge('ice')} ${vm.frozen}`, T(`Враг заморожен ещё на ${turnsTxt(vm.frozen)}: таймер стоит, по нему +50% урона.`, `Enemy frozen for ${turnsTxt(vm.frozen)} more: timer paused, +50% damage to it.`)]);
    if (vm.buff > 1) out.push(['c-buff', `${UI.inlineArt('gameplay/intents/intent_buff')} ×2`, T('Следующая атака врага ×2.', 'Next enemy attack ×2.')]);
    if (vm.rage) out.push(['c-rage', `${UI.inlineArt('gameplay/intents/status_rage')} ${T('ярость', 'rage')}`, T('Ярость: действует на 1 ход раньше.', 'Rage: acts 1 turn sooner.')]);
    if (B.burn && B.burn.length) out.push(['c-rage', `${UI.inlineArt('gameplay/intents/status_burn')} ${B.burn.reduce((s, b) => s + b.dmg, 0)}`, T('Поджог: урон тебе каждый ход, мимо щита.', 'Burn: damages you every turn, ignores shield.')]);
    $('.bt-chips').innerHTML = out.map(c => `<span class="bt-chip ${c[0]}" data-tip="${esc(c[2])}">${c[1]}</span>`).join('');
  }

  function renderIntent() {
    const vm = S.vm, el = $('.bt-intent'), it = vm.intent;
    const st = S.R.battle && S.R.battle.status;
    if (!it || (st !== 'active' && st !== 'lost')) { el.hidden = true; return; }
    el.hidden = false;
    const [label] = INTENT[it.t] || [it.t];
    const paused = vm.frozen > 0;
    el.className = 'bt-intent' + (paused ? ' paused' : '') + (!paused && vm.timer <= 1 && it.t === 'atk' ? ' danger' : '');
    const foot = paused ? T(`заморожен · ${vm.frozen}`, `frozen · ${vm.frozen}`) : vm.timer <= 1 ? T('следующий ход!', 'next turn!') : T(`через ${turnsTxt(vm.timer)}`, `in ${turnsTxt(vm.timer)}`);
    el.dataset.tip = `<b>${esc(label)}</b><br>${esc(INTENT_TIP[it.t] || '')}`;
    const short = { atk: T('Удар', 'Attack'), stone: T('Камни', 'Stones'), spores: T('Слизь', 'Slime'), freeze: T('Лёд', 'Freeze'), steal: T('Кража', 'Steal'), swap: T('Смена', 'Swap'), shield: T('Щит', 'Shield'), buff: T('Усиление', 'Buff'), heal: T('Лечение', 'Heal') };
    el.dataset.tip += '<br>' + esc(foot);
    el.setAttribute('aria-label', label + ', ' + foot);
    const count = paused ? vm.frozen : Math.max(1, vm.timer);
    el.innerHTML = `<div class="il">${esc(paused ? T('Лёд', 'Frozen') : short[it.t] || label)}</div><div class="iv">${intentValue(it, vm.buff)}</div><div class="it">${count}</div>`;
  }

  function renderPlayer() {
    const vm = S.vm, hp = Math.max(0, vm.pHp), sh = Math.max(0, vm.pShield), pct = v => (vm.pMax ? Math.min(100, v / vm.pMax * 100) : 0) + '%';
    setBar($('.bt-player .bar'), vm.pHp, vm.pMax, `${hp} / ${vm.pMax}`);
    // The shield covers the tip of the green: the part of HP the next hit takes from the shield first.
    const ps = $('.bt-pshield');
    ps.style.left = pct(Math.max(0, hp - sh)); ps.style.width = pct(Math.min(sh, hp));
    const el = $('.bt-shield');
    el.querySelector('b').textContent = sh;
    el.classList.toggle('zero', !sh);
    renderCombo();
  }

  function renderCombo() {
    const B = S.R.battle, c = $('.bt-combo');
    const n = inBattle() ? S.vm.combo || 0 : 0;
    const k = B ? PS.Combat.kOf(B, Math.min(n, D().combo.length - 1)) : 1;
    c.classList.toggle('hot', n > 0);
    c.textContent = '×' + kfmt(k);
  }

  // ---------- tubes ----------
  // Every tube keeps its DOM until its contents change, and a change plays from what is on screen to the new state:
  // layers poured off or removed collapse, layers added on top rise (pour) or drop in (stones, refills), recoloured ones flash,
  // and a whole new set first drains the old one away. S.tv[i] = {el, t: snapshot, sig, pend, final}.
  const snap = t => ({ kind: t.kind, cap: t.cap, frozen: t.frozen, layers: t.layers.slice() });
  const sigOf = t => t.kind + '|' + t.cap + '|' + t.frozen + '|' + t.layers.join(',');
  const DROP = 260, DROP_STEP = 35, OUT = 200;
  const dropMs = n => DROP + Math.max(0, n - 1) * DROP_STEP;

  function drawTube(i, t, o) {
    const v = S.tv[i];
    if (v.pend) { clearTimeout(v.pend); v.pend = 0; }
    // A special tube is told apart by its glass; a long press on it explains what it does.
    v.el.dataset.kind = t.kind;
    if (t.kind !== 'plain') { const td = UI.item('tubes', t.kind); v.el.dataset.tip = `<b>${esc(td.name)}</b><br>${esc(td.desc)}`; }
    else delete v.el.dataset.tip;
    v.el.innerHTML = UI.tubeHtml(t, o);
    v.t = snap(t); v.sig = sigOf(t);
  }
  // The state counts as shown now and is drawn once the collapse on screen has played; a newer change draws it at once first.
  function drawLater(i, t, o, ms) {
    const v = S.tv[i];
    v.t = snap(t); v.sig = sigOf(t); v.final = t;
    v.pend = setTimeout(() => { v.pend = 0; if (S && S.tv && S.tv[i] === v) drawTube(i, t, o); }, ms / (UI.speed || 1));
  }
  function flush(i) {
    const v = S.tv[i];
    if (v && v.pend) drawTube(i, v.final, {});
  }
  // Marks layers of tube i (indexes into what is shown) to collapse; icons of runs that lose layers fade, since their middle moves.
  function collapse(i, gone) {
    const v = S.tv[i], L = v.el.querySelectorAll('.bt-layer'), was = v.t.layers;
    // a block off the top just sinks; anything taken from lower down collapses so the layers above settle
    const low = was.length - gone.length, top = gone.every(k => k >= low);
    gone.forEach(k => { if (!L[k]) return; if (top) L[k].style.setProperty('--j', k - low); L[k].classList.add(top ? 'off' : 'out'); });
    for (let k = 0; k < was.length;) {
      let r = 1;
      while (was[k + r] === was[k]) r++;
      if (gone.some(g => g >= k && g < k + r)) { const ic = L[k] && L[k].querySelector('i'); if (ic) ic.classList.add('gone'); }
      k += r;
    }
  }
  // Indexes of `was` to drop so that the rest reads `now`, or null when `now` is not what is left of `was`.
  function removed(was, now) {
    const out = [];
    let j = 0;
    was.forEach((c, k) => { if (j < now.length && c === now[j]) j++; else out.push(k); });
    return j === now.length ? out : null;
  }
  function uncork(i) {
    const tb = S.tv[i].el.querySelector('.bt-tube');
    if (tb && tb.querySelector('.bt-cork')) { tb.classList.remove('closed', 'closing'); tb.classList.add('opening'); }
  }

  // Shows `tubes` (default: the field) and returns how long the changes take to play, in ms.
  // opt.add: 'drop' makes layers added on top fall in instead of rising; opt.enter: every tube fills from empty; opt.instant: no motion.
  function renderTubes(tubes, opt) {
    const B = S.R.battle;
    if (!B) return 0;
    opt = opt || {};
    tubes = tubes || B.field.tubes;
    const L = { tubes, filled: B.field.filled }, rows = PS.Field.layout(L).rows;
    const key = rows.map(r => r.join(',')).join('/');
    if (!S.tv || S.tvKey !== key) {
      // Re-attached nodes would replay their old animations, so after a layout change every tube is drawn afresh.
      const prev = S.tv || [];
      S.tv = [];
      rows.forEach((row, r) => {
        const host = $(`.bt-row[data-row="${r}"]`);
        host.textContent = '';
        row.forEach(i => {
          let v = prev[i];
          if (v) { if (v.pend) { clearTimeout(v.pend); v.pend = 0; } v.sig = ''; }
          else {
            const w = document.createElement('div');
            w.className = 'bt-tw';
            w.dataset.i = i;
            v = { el: w, t: null, sig: '' };
            if (prev.length && !opt.instant && !opt.enter) { w.classList.add('appear'); setTimeout(() => w.classList.remove('appear'), 400); }
          }
          S.tv[i] = v;
          host.appendChild(v.el);
        });
      });
      S.tvKey = key;
    }
    const bombN = {};
    tubes.forEach((t, i) => { if (t.kind === 'bomb') PS.Field.neighbors(L, i).forEach(j => { bombN[j] = true; }); });
    let ms = 0;
    tubes.forEach((t, i) => {
      const v = S.tv[i];
      if (!v) return;
      v.el.classList.toggle('bomb-n', !!bombN[i]);
      if (v.sig === sigOf(t) && !opt.enter) return;
      flush(i);
      const o = v.sig ? v.t : null, iceIn = !!(o && !o.frozen && t.frozen);
      if (opt.enter) { drawTube(i, t, { drop: 0 }); ms = Math.max(ms, dropMs(t.layers.length)); return; }
      if (opt.instant || !o) { drawTube(i, t, {}); return; }
      if (o.kind !== t.kind || o.cap !== t.cap) { drawTube(i, t, { drop: 0, iceIn }); ms = Math.max(ms, dropMs(t.layers.length)); return; }
      const was = o.layers, now = t.layers, runs = runsOf(was);
      if (now.length > was.length && was.every((c, k) => now[k] === c)) {
        const add = now.length - was.length;
        if (opt.add === 'drop') { drawTube(i, t, { drop: was.length, runs, iceIn }); ms = Math.max(ms, dropMs(add)); }
        else { drawTube(i, t, { fill: add, runs, iceIn }); ms = Math.max(ms, 260); }
        return;
      }
      const gone = now.length < was.length ? removed(was, now) : null;
      if (gone) { collapse(i, gone); drawLater(i, t, { runs, iceIn }, OUT); ms = Math.max(ms, OUT + 20); return; }
      if (now.length === was.length) {
        const f = new Set();
        was.forEach((c, k) => { if (now[k] !== c) f.add(k); });
        drawTube(i, t, { flash: f, runs, iceIn });
        ms = Math.max(ms, f.size ? 400 : 0);
        return;
      }
      // a whole new set of layers: the old ones drain away, then the new ones fall in
      if (was.length) { uncork(i); collapse(i, was.map((c, k) => k)); drawLater(i, t, { drop: 0, iceIn }, OUT); ms = Math.max(ms, OUT + dropMs(now.length)); }
      else { drawTube(i, t, { drop: 0, iceIn }); ms = Math.max(ms, dropMs(now.length)); }
    });
    S.shownTubes = tubes;
    refreshSel();
    return ms;
  }

  function fit() {
    if (!S || S.dead || !S.R.battle) return;
    const tubes = S.shownTubes || S.R.battle.field.tubes;
    const rows = PS.Field.layout({ tubes, filled: S.R.battle.field.filled }).rows;
    S.lh = PS.BattleLayout.fit(S.el, tubes, rows, S.lh);
    syncEarth(S.el);
  }

  // An island with its own layers draws its ground as one layer behind the HUD and the field, starting where the enemy stands; created once, moved after every fit.
  // Absolute, so a url() set inline does not depend on which stylesheet reads the variable.
  const artUrl = (n, file) => new URL(`img/battle/island_${String(n).padStart(2, '0')}/${file}.webp`, document.baseURI).href;

  function syncEarth(root) {
    if (!root.classList.contains('bt-art')) return;
    let earth = root.querySelector('.bt-earth');
    if (!earth) {
      earth = document.createElement('div');
      earth.className = 'bt-earth';
      earth.setAttribute('aria-hidden', 'true');
      earth.innerHTML = `<img class="bt-earth-cap" src="${artUrl(root.dataset.island, 'ground_cap')}" alt="" draggable="false">`;
      root.prepend(earth);
    }
    const r = root.getBoundingClientRect(), mon = root.querySelector('.bt-mon').getBoundingClientRect(), top = root.querySelector('.bt-top').getBoundingClientRect();
    // the enemy sprites leave about 3% of their height transparent under the feet
    const y = Math.max(top.bottom - r.top + 4, mon.bottom - r.top - mon.height * 0.03);
    root.style.setProperty('--earth-y', y + 'px');
    // The cap is 1536×512 drawn at full width; its stone top runs from 31% to 40% of its height. The feet go at 43%, at the front of
    // that top, so the stone shows behind them and the enemy reads as standing on the ground rather than perched on a wall.
    root.style.setProperty('--cap-lift', (r.width * 512 / 1536 * 0.43) + 'px');
  }

  function renderQueue(queue) {
    // Not shown any more; the empty element stays as the target of spore flights.
    $('.bt-queue').innerHTML = '';
  }

  function beltList() { const R = S.R; return (R.phase === 'battle' && R.battle ? R.battle.potions : R.potions) || []; }
  function beltStacks(list) {
    const out = [];
    list.forEach((id, idx) => { const g = out.find(x => x.id === id); if (g) g.n++; else out.push({ id, idx, n: 1 }); });
    return out;
  }
  function renderBelt() {
    const R = S.R, list = beltList();
    const armedId = S.mode && S.mode.type === 'potion' ? list[S.mode.idx] : null;
    let html = '';
    // Same potions stack into one icon; a tap uses the first copy in the belt.
    beltStacks(list).forEach(g => {
      const p = UI.item('potions', g.id);
      html += `<button class="bt-pot pt-${g.id}${g.id === armedId ? ' armed' : ''}" data-pot="${g.idx}" data-tip="<b>${esc(p.icon + ' ' + p.name)}${g.n > 1 ? ' ×' + g.n : ''}</b><br>${esc(p.desc)}" aria-label="${esc(p.name)}">${p.icon}${g.n > 1 ? `<span class="bt-pot-n">${g.n}</span>` : ''}</button>`;
    });
    for (let i = list.length; i < (R.beltSize || 3); i++) html += `<button class="bt-pot empty" data-a="buypot" aria-label="${T('Купить зелье', 'Buy a potion')}">+</button>`;
    $('.bt-belt').innerHTML = html;
    const dr = $('.bt-drain'), B = R.battle;
    const stuck = inBattle() && B.stuck;
    const armed = S.mode && S.mode.type === 'drain';
    dr.className = 'btn bt-drain ' + (stuck ? 'btn-cta stuck' : 'btn-blue') + (armed ? ' armed' : '');
    dr.innerHTML = UI.ico.drop;
    dr.setAttribute('aria-label', T('Слить колбу', 'Drain a tube'));
    dr.dataset.tip = T(`<b>Слить колбу</b><br>Нажми, затем колбу — она опустеет. ${D().economy.drain.hp} HP и ход. В тупике — даром.`, `<b>Drain a tube</b><br>Tap, then a tube to empty it. ${D().economy.drain.hp} HP and a turn. Free at a dead end.`);
  }

  function refreshSel() {
    if (!S) return;
    S.el.querySelectorAll('.bt-tw').forEach(w => {
      const i = +w.dataset.i, t = (S.shownTubes || [])[i];
      w.classList.toggle('sel', S.sel === i);
      w.classList.toggle('hint', !!S.mode && !!t && t.layers.length > 0);
    });
  }

  function renderAll() {
    syncVm();
    renderTop();
    renderMonster(false);
    renderEnemyBars();
    renderIntent();
    renderPlayer();
    renderTubes(null, { instant: true });
    renderQueue();
    renderBelt();
    fit();
    S.el.classList.toggle('locked', !!S.busy);
  }

  // ---------- event playback ----------
  function prepare(evs) {
    evs.forEach((e, i) => {
      if (e.type !== 'stage_start') return;
      let dmg = 0;
      for (let j = i + 1; j < evs.length && evs[j].type !== 'stage_start'; j++) if (evs[j].type === 'enemy_hit') dmg += evs[j].dmg + evs[j].absorbed;
      e._eHp = dmg;
    });
  }

  // The shield badge sits in the HP bar and is hidden while there is no shield, so the first one flies to the bar itself.
  const shieldEl = () => S.vm.pShield > 0 ? $('.bt-shield') : $('.bt-player .bar');
  const effTarget = kind => kind === 'shield' || kind === 'slime' ? shieldEl() : kind === 'heal' || kind === 'self' ? $('.bt-player .bar') : monEl();
  const flySrc = () => (S.flyFrom != null && tubeEl(S.flyFrom)) || $('.bt-field');

  // The source tube flies over the target and tips; a stream falls from its lip while its level drops and the target's rises,
  // then it flies back. Only transforms move, on the tube's own layer.
  const TIP_DEG = 105, TIP = TIP_DEG * Math.PI / 180, TRAVEL = 150;
  async function animPour(ev) {
    Snd.play('pour');
    const aw = tubeEl(ev.from), bw = tubeEl(ev.to);
    if (!aw || !bw) { renderTubes(ev.tubes); return; }
    flush(ev.from); flush(ev.to);
    const A = aw.querySelector('.bt-tube').getBoundingClientRect(), Bt = bw.querySelector('.bt-tube').getBoundingClientRect();
    const lift = new DOMMatrix(getComputedStyle(aw).transform).m42;
    const lip = A.width / 2, len = A.height, tx = Bt.left + Bt.width / 2, mouth = Bt.top - 6;
    let side = tx >= A.left + lip ? 1 : -1;
    // the tipped body sticks out away from the target; flip it when that would leave the screen
    const ox = sd => tx - sd * Math.cos(TIP) * lip, end = sd => ox(sd) - sd * Math.sin(TIP) * len;
    if (end(side) < 0 || end(side) > window.innerWidth) side = -side;
    const dx = ox(side) - (A.left + lip), dy = mouth - Math.sin(TIP) * lip - (A.top - lift);
    const layoutToken = S, restoreTube = PS.BattleLayout.floatTube(S.el, aw);
    aw.classList.add('pouring');
    aw.style.transform = `translate(${dx}px, ${dy}px) rotate(${side * TIP_DEG}deg)`;
    await sleep(TRAVEL);
    const liq = bw.querySelector('.bt-liq').getBoundingClientRect();
    const surface = liq.bottom - (ev.swallow ? 0 : S.tv[ev.to].t.layers.length * S.lh);
    const ms = Math.max(260, renderTubes(ev.tubes));
    stream(tx, mouth, surface, Math.max(4, liq.width * .3), colorDef(ev.color).css, ms);
    await sleep(ms);
    aw.style.transform = '';
    setTimeout(() => { restoreTube(); if (S === layoutToken && !layoutToken.dead) fit(); }, TRAVEL + 40);
    await sleep(TRAVEL * .4);
  }
  function stream(x, y0, y1, w, color, ms) {
    const fx = document.getElementById('fx');
    if (!fx || y1 <= y0) return;
    const el = document.createElement('div'), h = y1 - y0, left = x - w / 2;
    el.className = 'stream';
    el.style.cssText = `width:${w}px;height:${h}px;background:linear-gradient(90deg, rgba(255,255,255,.45), transparent 45%), ${color}`;
    fx.appendChild(el);
    const an = el.animate([
      { transform: `translate(${left}px, ${y0}px) scaleY(0)` },
      { transform: `translate(${left}px, ${y0}px) scaleY(1)`, offset: .3 },
      { transform: `translate(${left}px, ${y0}px) scaleY(1)`, offset: .7 },
      { transform: `translate(${left}px, ${y1}px) scaleY(0)` },
    ], { duration: ms / (UI.speed || 1), easing: 'ease-in-out' });
    Fx.settle(an, ms).then(() => el.remove());
  }

  function hitNum(el, text, color, big) { if (el) Fx.floatNum(el, text, color, big); }

  const H = {
    stage_start(ev) {
      const B = S.R.battle;
      S.sel = null; S.mode = null;
      syncVm();
      S.vm.eHp = B.enemy.hp + (ev._eHp || 0);
      S.vm.pShield = 0;
      S.flyFrom = null;
      renderTop();
      renderMonster(true);
      renderEnemyBars(); renderIntent(); renderPlayer(); renderQueue(); renderBelt();
      renderTubes(B.field.tubes, { instant: true }); fit();
      renderTubes(B.field.tubes, { enter: true });
      if (ev.boss) { bigPop(ev.final ? T('Босс!', 'Boss!') : T(`Босс · встреча ${ev.encounter + 1}`, `Boss · fight ${ev.encounter + 1}`), '#ff9a8a'); Snd.play('hurt'); return 900; }
      Snd.play('drop');
      return 550;
    },
    pour(ev) {
      const nx = S.events[S.evIdx + 1];
      ev.swallow = !!(nx && nx.type === 'swallow');
      return animPour(ev);
    },
    swallow(ev) { Fx.burstAt(tubeEl(ev.tube), '#c9d3ee', 12, 40); Snd.play('drop'); return 150; },
    async close(ev) {
      S.flyFrom = ev.tube;
      const ms = renderTubes(ev.tubes);
      if (ms) await sleep(ms);
      flush(ev.tube);
      const w = tubeEl(ev.tube);
      if (w) {
        const t = w.querySelector('.bt-tube');
        t.style.setProperty('--glow', colorDef(ev.color).css);
        t.classList.add('closed', 'closing');
        t.insertAdjacentHTML('beforeend', '<div class="bt-cork"></div>');
        Fx.burstAt(t, colorDef(ev.color).css, 16, 50);
      }
      Snd.play(ev.color === 'stone' ? 'stone' : 'close', ev.step);
      if (ev.cascade) bigPop(T('Каскад!', 'Cascade!'));
      await sleep(260);
    },
    combo(ev) {
      S.vm.combo = ev.step + 1;
      renderCombo();
      bigPop(T('Комбо ×', 'Combo ×') + kfmt(ev.k));
      Snd.play('combo');
      Fx.animClass($('.bt-combo'), 'bump', 320);
      return 250;
    },
    async effect(ev) {
      const vm = S.vm, color = ev.color === 'slime' ? '#5bb8ff' : colorDef(ev.color).css;
      if (ev.kind === 'self' || ev.kind === 'stone') return 0;
      const from = ev.source === 'firebomb' ? $('.bt-belt') : flySrc();
      await Fx.fly(from, effTarget(ev.kind), color, { size: 22 });
      if (ev.kind === 'shield' || ev.kind === 'slime') {
        vm.pShield += ev.value; renderPlayer(); Snd.play('shield');
        Fx.animClass($('.bt-shield'), 'bump', 320);
        hitNum($('.bt-shield'), '🛡+' + ev.value, '#a7dcff');
      } else if (ev.kind === 'poison') { Snd.play('poison'); hitNum(monEl(), `${UI.elBadge('poison')} ${ev.value}×${ev.turns}`, '#a6e35a'); renderChips(); }
      else if (ev.kind === 'freeze') { Snd.play('freeze'); vm.frozen = ev.value; renderEnemyBars(); renderIntent(); }
      else if (ev.kind === 'delay') { Snd.play('zap'); vm.timer += ev.value; renderIntent(); hitNum($('.bt-intent'), UI.elBadge('lightning') + '+' + ev.value, '#ffe36a'); }
      return 60;
    },
    enemy_hit(ev) {
      const vm = S.vm, mon = monEl();
      vm.eHp -= ev.dmg; vm.eShield -= ev.absorbed;
      renderEnemyBars();
      if (ev.dmg > 0) { Fx.animClass(mon, 'hurt', 350); Snd.play('hit'); hitNum(mon, '-' + ev.dmg, ev.source === 'poison' ? '#a6e35a' : '#ffd9d2', ev.dmg >= 15); }
      if (ev.absorbed > 0) { hitNum($('.bt-einfo'), '🛡-' + ev.absorbed, '#a7dcff'); if (!ev.dmg) Snd.play('shield'); }
      if (ev.source !== 'poison' && ev.dmg >= 10) Fx.shake($('.bt-arena'), 5);
      return 260;
    },
    player_hit(ev) {
      const vm = S.vm;
      vm.pHp -= ev.dmg; vm.pShield -= ev.absorbed;
      renderPlayer();
      if (ev.absorbed) hitNum($('.bt-player .bar'), '🛡-' + ev.absorbed, '#a7dcff');
      if (ev.dmg > 0) {
        Fx.animClass($('.bt-player .bar'), 'hit', 400);
        hitNum($('.bt-player .bar'), '-' + ev.dmg, '#ff8a7a', ev.dmg >= 10);
        Snd.play('hurt'); UI.vibrate(40);
        if (ev.source !== 'dark' && ev.source !== 'drain') { Fx.vignette(); Fx.shake(document.getElementById('app'), 6); }
      } else if (ev.absorbed) Snd.play('shield');
      return 320;
    },
    heal(ev) {
      if (!ev.v) return 0;
      S.vm.pHp = Math.min(S.vm.pMax, S.vm.pHp + ev.v);
      renderPlayer();
      hitNum($('.bt-player .bar'), '+' + ev.v, '#8af0a0');
      Snd.play('heal');
      return 200;
    },
    shield(ev) { S.vm.pShield = ev.v; renderPlayer(); hitNum($('.bt-shield'), '🛡+' + ev.v, '#a7dcff'); Snd.play('shield'); return 250; },
    shield_burn(ev) { S.vm.pShield = Math.max(0, S.vm.pShield - ev.v); renderPlayer(); return 120; },
    enemy_shield(ev) { S.vm.eShield += ev.v; renderEnemyBars(); hitNum(monEl(), '🛡+' + ev.v, '#a7dcff'); Snd.play('shield'); return 300; },
    enemy_shield_burn(ev) { S.vm.eShield = Math.max(0, S.vm.eShield - ev.v); renderEnemyBars(); return 120; },
    enemy_heal(ev) { S.vm.eHp += ev.v; renderEnemyBars(); renderMonster(false); hitNum(monEl(), '+' + ev.v, '#8af0a0'); Snd.play('heal'); return 300; },
    poison_tick() { Snd.play('poison'); return 120; },
    burn_tick() { hitNum($('.bt-player .bar'), '🔥', '#ff9a5a'); return 150; },
    refill: async ev => {
      const ms = renderTubes(ev.tubes, { add: 'drop' });
      if (ev.queue) renderQueue(ev.queue);
      Snd.play('drop');
      await sleep(Math.max(200, ms));
    },
    stones(ev) { Fx.burstAt(tubeEl(ev.tube), colorDef('stone').css, 18, 50); Snd.play('stone'); return Math.max(260, renderTubes(ev.tubes)); },
    bomb(ev) {
      (ev.targets || []).forEach(t => Fx.burstAt(tubeEl(t.tube), '#ffb347', 16, 50));
      Fx.burstAt(tubeEl(ev.tube), '#ff7a3d', 24, 70);
      Snd.play('hit');
      return Math.max(320, renderTubes(ev.tubes));
    },
    turn(ev) {
      if (ev.free) {
        const why = { sieve: T('Сито', 'Sieve'), catalyst: T('Катализатор', 'Catalyst'), lucky_clover: UI.item('relics', 'lucky_clover').icon + ' ' + T('Клевер', 'Clover'), philosopher_stone: UI.item('relics', 'philosopher_stone').icon + ' ' + T('Камень', 'Stone'), dead_end: T('Тупик', 'Dead end') }[ev.reason] || '';
        hitNum($('.bt-field'), `${T('Ход бесплатно', 'Free turn')}${why ? ' · ' + why : ''}`, '#ffe08a');
        return 120;
      }
      if (S.vm.frozen > 0) return 0;
      S.vm.timer = Math.max(0, S.vm.timer - 1);
      renderIntent();
      return 0;
    },
    frozen_enemy(ev) { S.vm.frozen = ev.turns; renderEnemyBars(); renderIntent(); return ev.tick ? 200 : 100; },
    intent(ev) {
      S.vm.intent = { t: ev.t, v: ev.v }; S.vm.timer = ev.timer;
      renderIntent();
      Fx.animClass($('.bt-intent'), 'wiggle', 320);
      return 150;
    },
    async enemy_act(ev) {
      const mon = monEl();
      Fx.animClass(mon, 'attack', 450);
      await sleep(220);
      const stoneC = colorDef('stone').css;
      switch (ev.t) {
        case 'stone':
          Snd.play('stone');
          await Promise.all((ev.target || []).map((j, k) => sleep(k * 90).then(() => Fx.fly(mon, tubeEl(j), stoneC, { size: 16, dur: 380 }))));
          await sleep(renderTubes(ev.tubes, { add: 'drop' }));
          break;
        case 'freeze':
          Snd.play('freeze');
          if (ev.target >= 0) await Fx.fly(mon, tubeEl(ev.target), '#a9ecff', { size: 20 });
          await sleep(renderTubes(ev.tubes));
          break;
        case 'steal':
          if (ev.target) {
            const from = tubeEl(ev.target.tube), ms = renderTubes(ev.tubes);
            await Promise.all([Fx.fly(from, mon, colorDef(ev.target.color).css, { size: 18 }), sleep(ms)]);
          } else renderTubes(ev.tubes);
          Snd.play('bad');
          break;
        case 'swap':
          Snd.play('zap');
          await sleep(renderTubes(ev.tubes));
          if (ev.target) hitNum($('.bt-field'), `${UI.elBadge(ev.target.a) || iconOf(ev.target.a)} ${UI.inlineArt('gameplay/intents/intent_swap')} ${UI.elBadge(ev.target.b) || iconOf(ev.target.b)}`, '#ffe08a', true);
          break;
        case 'spores':
          Snd.play('poison');
          await Fx.fly(mon, $('.bt-queue'), colorDef('slime').css, { size: 18 });
          hitNum($('.bt-field'), `${UI.elBadge('slime')} ×${ev.v}`, '#b9e86a');
          if (ev.queue) renderQueue(ev.queue);
          break;
        case 'buff': S.vm.buff = 2; renderEnemyBars(); hitNum(mon, '💪 ×2', '#ffb08a', true); Snd.play('hurt'); break;
        case 'atk': S.vm.buff = 1; break;
      }
      await sleep(120);
    },
    rage() { S.vm.rage = true; renderMonster(false); renderEnemyBars(); renderIntent(); bigPop(T('Ярость!', 'Rage!'), '#ff7a6b'); Snd.play('hurt'); Fx.shake($('.bt-arena'), 8); return 800; },
    dead_end() { Fx.animClass($('.bt-drain'), 'wiggle', 320); Snd.play('bad'); return 100; },
    async drain(ev) {
      S.mode = null;
      Snd.play('pour');
      const ms = renderTubes(ev.tubes);
      renderBelt();
      if (ev.free) hitNum($('.bt-drain'), T('даром', 'free'), '#ffe08a');
      await sleep(Math.max(200, ms));
    },
    potion(ev) {
      const p = UI.item('potions', ev.id);
      renderBelt();
      Snd.play('buy');
      hitNum($('.bt-belt'), p.icon, '#fff', true);
      if (ev.id === 'undo') { const ms = renderTubes(S.R.battle.field.tubes); renderAll(); bigPop(T('↶ Отмена', '↶ Undo')); return Math.max(500, ms); }
      let ms = 300;
      if (ev.tubes) ms = Math.max(ms, renderTubes(ev.tubes));
      if (ev.id === 'flask') fit();
      if (ev.id === 'sleep') { S.vm.timer += D().potions.sleep.delay; renderIntent(); hitNum($('.bt-intent'), '💤 +' + D().potions.sleep.delay, '#c9d6ff'); }
      if (ev.id === 'combo') bigPop(T('✨ Следующее — ×2', '✨ Next one ×2'));
      if (ev.id === 'firebomb') S.flyFrom = null;
      return ms;
    },
    relic(ev) { const r = UI.item('relics', ev.id); hitNum($('.bt-player'), r.icon, '#ffcb4f', true); return 150; },
    twist(ev) {
      if (ev.tubes) renderTubes(ev.tubes, { add: 'drop' });
      if (ev.twist === 'stonefall') { Snd.play('stone'); UI.toastHtml(UI.elBadge('stone') + ' ' + T('Камнепад: камень упал в колбу', 'Rockfall: a stone dropped into a tube')); return 400; }
      if (ev.twist === 'burn') { hitNum($('.bt-player'), T(`🔥 Поджог ${ev.dmg}×${ev.turns}`, `🔥 Burn ${ev.dmg}×${ev.turns}`), '#ff9a5a'); renderChips(); return 300; }
      if (ev.twist === 'frozenStart') { Snd.play('freeze'); return 300; }
      return 0;
    },
    async enemy_dead() {
      const mon = monEl();
      Snd.play('hit');
      Fx.burstAt(mon, '#ffcf4a', 26, 90);
      mon.classList.add('dead');
      $('.bt-intent').hidden = true;
      await sleep(750);
    },
    // No caption on purpose: the boss just staggers and runs off; the tutorial explains it the first time.
    async boss_fled() {
      const mon = monEl();
      Snd.play('hit');
      Fx.animClass(mon, 'hurt', 350);
      await sleep(380);
      mon.classList.add('flee');
      $('.bt-intent').hidden = true;
      Snd.play('swipe');
      Fx.burstAt(mon, '#e6dcc4', 16, 70);
      await sleep(900);
    },
    async player_dead() { Fx.vignette('#000'); Snd.play('lose'); await sleep(700); },
    stage_clear() { if (S.R.phase !== 'won') bigPop(T('Этап пройден!', 'Stage clear!')); return 500; },
    coins(ev) { if (ev.v) { hitNum($('.bt-arena'), `+${ev.v} 🪙`, '#ffcf4a', true); Snd.play('coin'); } return 350; },
    heal_after(ev) {
      S.vm.pMax = S.R.maxHp; S.vm.pShield = 0;
      if (ev.v) { S.vm.pHp = Math.min(S.vm.pMax, S.vm.pHp + ev.v); hitNum($('.bt-player .bar'), '+' + ev.v, '#8af0a0', true); Snd.play('heal'); }
      renderPlayer();
      return 500;
    },
    potion_found(ev) {
      const p = UI.item('potions', ev.id);
      renderBelt();
      hitNum($('.bt-belt'), p.icon, '#fff', true);
      UI.toast(T(`Найдено зелье: ${p.icon} ${p.name}`, `Found a potion: ${p.icon} ${p.name}`));
      return 400;
    },
    revived() {
      syncVm(); renderPlayer();
      bigPop(T('Воскрешение!', 'Revived!'));
      Snd.play('heal');
      Fx.burstAt($('.bt-player'), '#8af0a0', 22, 80);
      return 700;
    },
  };

  function track(evs) {
    const now = UI.now(), tr = (e, d) => PS.Meta.track(e, d, now);
    evs.forEach(e => {
      switch (e.type) {
        case 'close': tr('close', { color: e.color, junk: !!e.junk }); break;
        case 'combo': tr('combo', { k: e.k }); break;
        case 'potion': tr('potion'); break;
        case 'kill': tr('kill'); break;
        case 'boss_reach': tr('boss_reach'); break;
        case 'stage_clear': tr('stage'); break;
      }
    });
  }

  function save() { PS.Meta.profile.activeRun = S.R; UI.save(); }

  function play(evs) {
    const token = S;
    token.busy = true;
    token.el.classList.add('locked');
    prepare(evs);
    const tut = Tut();
    if (tut) tut.onEvents(evs);
    const handlers = {};
    Object.keys(H).forEach(k => {
      handlers[k] = ev => {
        if (S !== token || token.dead) return 0;
        token.evIdx = evs.indexOf(ev);
        return H[k](ev);
      };
    });
    token.events = evs;
    handlers.done = () => (S === token && !token.dead ? afterPlay() : null);
    return UI.play(evs, handlers);
  }

  async function afterPlay() {
    const token = S;
    syncVm();
    renderAll();
    const tut = Tut();
    if (tut) await tut.flush();
    if (S !== token || token.dead) return;
    const R = S.R;
    if (R.phase === 'battle') {
      S.busy = false;
      S.el.classList.remove('locked');
      if (tut) setTimeout(() => { if (S === token && !token.dead && !token.busy) tut.idle(); }, 0);
    } else if (R.phase === 'reward') showOffer();
    else if (R.phase === 'revive') showRevive();
    else if (R.phase === 'won' || R.phase === 'lost') finish();
  }

  function questSnap() {
    const q = PS.Meta.profile.quests;
    return q && q.list ? { date: q.date, list: q.list.map(x => ({ progress: x.progress, done: x.done })) } : null;
  }
  function restoreQuests(snap) {
    const q = PS.Meta.profile.quests;
    if (!snap || !q || q.date !== snap.date) return;
    q.list.forEach((x, i) => { if (!x.claimed && snap.list[i]) { x.progress = snap.list[i].progress; x.done = snap.list[i].done; } });
  }

  function doAct(a) {
    if (S.busy || !PS.Run.canAct(S.R, a)) return false;
    const B0 = S.R.battle;
    const undo = a.type === 'potion' && B0 && B0.potions[a.idx] === 'undo';
    const snap = a.type === 'pour' || a.type === 'drain' ? questSnap() : null;
    const evs = PS.Run.act(S.R, a);
    // Quest progress is counted from events, so whatever the undone move counted is rolled back with it.
    if (undo && evs.some(e => e.type === 'potion' && e.id === 'undo')) restoreQuests(S.qSnap);
    S.qSnap = snap;
    save();
    track(evs);
    S.sel = null; S.mode = null;
    refreshSel();
    const tut = Tut();
    if (tut) tut.onAction(a, evs);
    play(evs);
    return true;
  }

  function finish() {
    if (S.finished) return;
    S.finished = true;
    const R = S.R, token = S;
    setTimeout(() => {
      if (S !== token || token.dead) return;
      const result = PS.Meta.finishRun(R, UI.now());
      UI.go(R.phase === 'won' ? 'cleared' : 'results', { run: R, result });
    }, R.phase === 'won' ? 500 : 250);
  }

  // ---------- input ----------
  function wiggle(i) { const w = tubeEl(i); if (w) Fx.animClass(w, 'wiggle', 320); }

  function onTube(i) {
    if (!S || S.busy || !inBattle()) return;
    const tut = Tut();
    if (tut && !tut.allowTube(i)) { wiggle(i); return; }
    const R = S.R, F = R.battle.field, t = F.tubes[i];
    if (S.mode) {
      const a = S.mode.type === 'drain' ? { type: 'drain', tube: i } : { type: 'potion', idx: S.mode.idx, tube: i };
      if (!doAct(a)) { wiggle(i); Snd.play('bad'); }
      return;
    }
    if (S.sel == null) {
      if (!t.layers.length || t.frozen) { wiggle(i); Snd.play('bad'); return; }
      S.sel = i; Snd.play('select'); refreshSel();
      if (tut) tut.onSelect(i);
      return;
    }
    if (S.sel === i) { S.sel = null; refreshSel(); if (tut) tut.onSelect(null); return; }
    if (doAct({ type: 'pour', from: S.sel, to: i })) return;
    Snd.play('bad');
    if (t.layers.length && !t.frozen && !(tut && tut.locked())) { wiggle(S.sel); S.sel = i; refreshSel(); }
    else wiggle(i);
  }

  function onPotion(idx) {
    if (!S || S.busy || !inBattle()) return;
    const tut = Tut();
    if (tut && tut.locked()) return;
    const B = S.R.battle, id = B.potions[idx];
    if (!id) return;
    S.sel = null;
    if (TUBE_POTIONS[id]) {
      const same = S.mode && S.mode.type === 'potion' && S.mode.idx === idx;
      S.mode = same ? null : { type: 'potion', idx };
      Snd.play('select');
      renderBelt(); refreshSel();
      if (S.mode) UI.toast(`${UI.item('potions', id).icon} ${T('Выбери колбу', 'Pick a tube')}`);
      return;
    }
    const a = { type: 'potion', idx };
    if (!doAct(a)) {
      Snd.play('bad');
      Fx.animClass(S.el.querySelector(`[data-pot="${idx}"]`), 'wiggle', 320);
      UI.toast(id === 'undo' ? T('Нечего отменять', 'Nothing to undo') : id === 'combo' ? T('Эликсир уже действует', 'Elixir already active') : T('Сейчас нельзя', 'Can\'t do that now'));
    }
  }

  // Tapping an empty belt slot buys a potion for gems (ADR 0010): each kind once per battle, every further buy in the run costs double.
  function showBuyPotion() {
    if (!S || S.busy || !inBattle()) return;
    const tut = Tut();
    if (tut && tut.locked()) return;
    const R = S.R, B = R.battle, price = PS.Run.potionBuyPrice(R), gems = PS.Meta.profile.gems;
    Snd.play('select');
    const rows = PS.Run.unlockedPool(R, 'potions').map(id => {
      const p = UI.item('potions', id), had = (B.bought || []).indexOf(id) >= 0, ok = PS.Run.canBuyPotion(R, id) && gems >= price;
      return `<button class="boost${ok ? '' : ' capped'}" data-buy="${id}" ${PS.Run.canBuyPotion(R, id) ? '' : 'disabled'}>
        <span class="boost-ico">${p.icon}</span><span class="grow"><span class="card-title" style="font-size:15px">${esc(p.name)}</span><br><span class="card-desc">${esc(p.desc)}</span></span>
        <span class="boost-price">${had ? `<span class="dim">${T('куплено', 'bought')}</span>` : `<span class="price">${UI.ico.gem(18)}${price}</span>`}</span></button>`;
    }).join('');
    const close = UI.overlay(`<button class="btn-icon ov-x" data-close>${UI.ico.close}</button><h2 class="ov-title">${T('Купить зелье', 'Buy a potion')}</h2>
      <p class="ov-text">${T(`Каждое зелье — раз за бой; каждая следующая покупка до конца острова — ×${D().economy.potionBuy.mult}. Ход не тратится.`, `Each potion once per fight; every next buy on this island costs ×${D().economy.potionBuy.mult}. Doesn't use a turn.`)}</p>
      <div class="col">${rows}</div>`, { cls: 'sheet' });
    close.card.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const id = b.dataset.buy;
      if (!S || S.busy || !PS.Run.canBuyPotion(R, id)) return;
      if (!PS.Meta.spendGems(price)) { Snd.play('bad'); UI.toast(T(`Не хватает 💎 — нужно ${price}`, `Not enough 💎 — need ${price}`)); return; }
      PS.Run.buyPotion(R, id);
      close();
      save();
      renderBelt();
      Snd.play('gem');
      hitNum($('.bt-belt'), UI.item('potions', id).icon, '#fff', true);
    });
  }

  function onDrain() {
    if (!S || S.busy || !inBattle()) return;
    const tut = Tut();
    if (tut && tut.locked()) return;
    S.sel = null;
    S.mode = S.mode && S.mode.type === 'drain' ? null : { type: 'drain' };
    Snd.play('select');
    renderBelt(); refreshSel();
  }

  // ---------- windows ----------
  function cardHtml(o, i, off) {
    const R = S.R;
    let icon = '', name = '', desc = '', tags = '', cls = '', side = '';
    const it = (k, id) => UI.item(k, id);
    switch (o.type) {
      case 'mod': {
        const m = it('mods', o.id), have = R.mods[o.id] || 0;
        icon = m.icon; name = m.name; desc = m.desc; tags = `<span class="tag tag-bonus">${T('Бонус', 'Bonus')}</span>`;
        if (have && m.cap) side = `<span class="stack-n">${have + 1}/${m.cap}</span>`;
        break;
      }
      case 'find': {
        const f = it('finds', o.id);
        icon = f.icon; name = f.name; desc = f.desc; tags = `<span class="tag tag-find">${T('Находка', 'Find')}</span>`;
        if (o.color) {
          const c = D().elements[o.color];
          icon = UI.elBadge(o.color);
          if (o.id === 'new_color') { name = `${f.name}: ${c.name}`; desc = c.desc; }
          else {
            const lvl = R.deck[o.color] || 0, key = Object.keys(c.boost || {})[0];
            name = T(`Усиление: ${c.name}`, `Empower: ${c.name}`);
            desc = T(`${c.name} +${c.boost[key]} (шаг ${lvl + 1}/${f.cap || 3}). Сейчас: ${colorValue(o.color)}.`, `${c.name} +${c.boost[key]} (step ${lvl + 1}/${f.cap || 3}). Now: ${colorValue(o.color)}.`);
          }
        }
        if (o.tube) { const t = it('tubes', o.tube); icon = t.icon; name = `${f.name}: ${t.name}`; desc = t.desc; }
        break;
      }
      case 'relic': {
        const r = it('relics', o.id), rr = D().rarity[r.rarity] || {};
        icon = r.icon; name = r.name; desc = r.desc; cls = ' r-' + r.rarity;
        tags = `<span class="tag tag-r-${r.rarity}">${esc(rr.name || '')}</span>`;
        break;
      }
      case 'potion': { const p = it('potions', o.id); icon = p.icon; name = p.name; desc = p.desc; tags = `<span class="tag">${T('Зелье', 'Potion')}</span>`; break; }
      case 'coins': icon = '🪙'; name = T(`${o.v} монет`, `${o.v} coins`); desc = T('Подходящих наград не осталось — возьми монеты.', 'No fitting rewards left — take coins.'); break;
      case 'color': {
        const c = D().elements[o.id], lvl = R.deck[o.id] || 0;
        icon = UI.elBadge(o.id); name = c.name; desc = lvl ? T(`Усиления (${lvl}) пропадут.`, `Empowers (${lvl}) will be lost.`) : T('Без усилений.', 'No empowers.');
        break;
      }
      case 'tube': { const t = it('tubes', o.id); icon = t.icon; name = T(`Слот ${o.slot + 1}: ${t.name}`, `Slot ${o.slot + 1}: ${t.name}`); desc = t.desc; break; }
    }
    return `<button class="card${cls}" data-opt="${i}" data-tip="<b>${esc(name)}</b><br>${esc(desc)}"><span class="card-ico">${icon}</span>
      <span class="card-body">${tags ? `<span class="tags">${tags}</span>` : ''}<span class="card-title">${esc(name)}</span><span class="card-desc">${esc(desc)}</span></span>
      ${side ? `<span class="card-side">${side}</span>` : ''}</button>`;
  }

  function showOffer() {
    const R = S.R, off = R.offer;
    if (!off) return;
    const sub = off.kind === 'potion_pick' || off.kind === 'replace_color' || off.kind === 'replace_tube';
    const pend = off.pending;
    const titles = {
      pick: [T('Выбери бонус', 'Pick a bonus'), T('Действует до конца острова', 'Lasts until the end of the island')],
      relic: [T('Реликвия босса', 'Boss relic'), T('Сильный пассивный эффект до конца острова', 'Strong passive effect for the rest of the island')],
      potion_pick: [T('Выбери зелье', 'Pick a potion'), T('Зелье ляжет в пояс', 'It goes on your belt')],
      replace_color: [T('Колода полна', 'Deck full'), pend ? T(`Какую стихию заменить на ${UI.elBadge(pend)} ${esc(D().elements[pend].name)}?`, `Which element to swap for ${UI.elBadge(pend)} ${esc(D().elements[pend].name)}?`) : T('Какую стихию заменить?', 'Which element to replace?')],
      replace_tube: [T('Слоты заняты', 'Slots full'), pend ? T(`Какую колбу заменить на ${UI.item('tubes', pend).icon} ${esc(D().tubes[pend].name)}?`, `Which tube to swap for ${UI.item('tubes', pend).icon} ${esc(D().tubes[pend].name)}?`) : T('Какую колбу заменить?', 'Which tube to replace?')],
    };
    const [title, subt] = titles[off.kind] || [T('Выбор', 'Choose'), ''];
    const price = PS.Run.rerollPrice(R);
    const skipV = sub ? 0 : PS.U.round(PS.U.lin(D().economy.skip, R.island) * PS.Run.coinMult(R));
    const html = `<h2 class="ov-title">${title}</h2><p class="ov-text">${subt}</p>
      ${sub ? '' : `<div class="bt-ov-hp"><span>❤️</span><div class="bar bar-hp"><div class="bar-fill" style="width:${R.hp / R.maxHp * 100}%"></div><span class="bar-label">${R.hp} / ${R.maxHp}</span></div></div>`}
      <div class="cards">${off.options.map((o, i) => cardHtml(o, i, off)).join('')}</div>
      <div class="ov-actions">${sub ? '' : `<button class="btn btn-gem" data-a="reroll">${T('Переброс', 'Reroll')} 💎${price}</button>`}
        <button class="btn btn-ghost" data-a="skip">${sub ? T('Отмена', 'Cancel') : T(`Пропустить +${skipV} 🪙`, `Skip +${skipV} 🪙`)}</button></div>`;
    const close = UI.overlay(html, { cls: 'bt-ov', dismiss: false });
    S.ov = close;
    const card = close.card;
    const token = S;
    let done = false;
    const run = (fn, sound) => {
      if (done || S !== token) return;
      done = true;
      close();
      S.ov = null;
      Snd.play(sound || 'select');
      const evs = fn();
      save(); track(evs);
      play(evs);
    };
    card.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => run(() => PS.Run.choose(R, +b.dataset.opt), 'buy'));
    card.querySelector('[data-a=skip]').onclick = () => run(() => PS.Run.skip(R));
    const rr = card.querySelector('[data-a=reroll]');
    if (rr) {
      if (PS.Meta.profile.gems < price) rr.classList.add('disabled');
      rr.onclick = () => {
        if (done) return;
        if (!PS.Meta.spendGems(price)) { Snd.play('bad'); UI.toast(T(`Не хватает 💎 — нужно ${price}`, `Not enough 💎 — need ${price}`)); return; }
        done = true;
        close(); S.ov = null;
        Snd.play('gem');
        const evs = PS.Run.reroll(R);
        save();
        showOffer();
      };
    }
    const tut = Tut();
    if (tut) {
      if (off.kind === 'pick' && tut.guided()) tut.once('pick', { target: card.querySelector('.cards'), title: T('Выбор после этапа', 'Stage reward'), text: T('Возьми один бонус: он действует до конца острова. Бонус — модификатор, Находка — меняет колоду или колбы. Долгое нажатие — подробности.', 'Take one: it lasts until the end of the island. A Bonus is a modifier; a Find changes your deck or tubes. Long-press for details.'), hand: false });
      if (off.kind === 'relic') tut.once('relic', { target: card.querySelector('.cards'), title: T('Реликвия', 'Relic'), text: T('После встречи с боссом — реликвия: сильный эффект до конца острова. Рамка показывает редкость.', 'Each boss fight drops a relic: a strong effect for the rest of the island. The frame shows its rarity.'), hand: false });
    }
  }

  function showRevive() {
    const R = S.R, o = PS.Run.reviveOptions(R), now = UI.now();
    const seal = PS.Meta.sealActive(now);
    const gems = PS.Meta.profile.gems, lives = PS.Meta.profile.lives || 0;
    const lifeBtn = o.free && lives > 0 ? `<button class="btn btn-cta" data-a="life">${T(`Воскреснуть ❤️ (есть ${lives})`, `Revive ❤️ (${lives} left)`)}</button>` : '';
    const freeBtn = !o.free ? '' : seal
      ? `<button class="btn btn-cta" data-a="free">${T('🔱 Воскреснуть бесплатно', '🔱 Revive for free')}</button>`
      : `<button class="btn btn-green btn-ad" data-a="free" ${UI.ads.online ? '' : 'disabled'}>${UI.ads.online ? T('Воскреснуть за рекламу', 'Revive (watch ad)') : T('Реклама недоступна', 'Ad unavailable')}</button>`;
    const html = `<div class="ov-hero">💀</div><h2 class="ov-title">${T('Ты пал!', 'You fell!')}</h2>
      <p class="ov-text">${o.free ? T(`Воскресни с ${Math.round(D().economy.revive.hp * 100)}% HP — поле останется как было. Воскрешение — одно за попытку.`, `Revive with ${Math.round(D().economy.revive.hp * 100)}% HP — the field stays as it was. One revive per run.`) : T('Воскрешение в этой попытке уже использовано.', 'Revive already used this run.')}</p>
      <div class="ov-actions col">${lifeBtn}${freeBtn}
        ${o.gemsPrice != null ? `<button class="btn btn-gem${gems < o.gemsPrice ? ' disabled' : ''}" data-a="gems">${T('Воскреснуть', 'Revive')} 💎${o.gemsPrice}</button>` : ''}
        <button class="btn ${o.free ? 'btn-ghost' : 'btn-cta'}" data-a="giveup">${o.free ? T('Сдаться', 'Give up') : T('К итогам', 'Results')}</button></div>
      ${seal || !o.free ? '' : `<button class="bt-seal-link" data-a="seal">${T('🔱 С Печатью алхимика — без рекламы', '🔱 Alchemist\'s Seal: no ads')}</button>`}`;
    const close = UI.overlay(html, { cls: 'bt-ov', dismiss: false });
    S.ov = close;
    const card = close.card, token = S;
    let done = false;
    const revive = src => {
      if (done || S !== token) return;
      done = true;
      close(); S.ov = null;
      const evs = PS.Run.revive(R, src);
      save(); track(evs);
      play(evs);
    };
    const lb = card.querySelector('[data-a=life]');
    if (lb) lb.onclick = () => {
      if (done || !PS.Meta.useLife()) return;
      revive('life');
    };
    const fb = card.querySelector('[data-a=free]');
    if (fb) fb.onclick = async () => {
      if (done) return;
      if (seal) { revive('free'); return; }
      fb.disabled = true;
      const ok = await UI.ads.show('rewarded');
      if (ok) revive('free'); else fb.disabled = false;
    };
    const gb = card.querySelector('[data-a=gems]');
    if (gb) gb.onclick = () => {
      if (done) return;
      if (!PS.Meta.spendGems(o.gemsPrice)) { Snd.play('bad'); UI.toast(T(`Не хватает 💎 — нужно ${o.gemsPrice}`, `Not enough 💎 — need ${o.gemsPrice}`)); return; }
      Snd.play('gem');
      revive('gems');
    };
    card.querySelector('[data-a=giveup]').onclick = () => {
      if (done) return;
      done = true;
      close(); S.ov = null;
      PS.Run.giveUp(R);
      save();
      finish();
    };
    const sl = card.querySelector('[data-a=seal]');
    if (sl) sl.onclick = () => { if (done) return; done = true; close(); S.ov = null; save(); UI.go('seal', { back: 'battle' }); };
    const tut = Tut();
    if (tut) tut.once('revive', { target: card, title: T('Воскрешение', 'Revive'), text: T('Можно вернуться в бой один раз за попытку — за рекламу или за кристаллы. Или сдаться — монеты за попытку останутся.', 'You can jump back in once per run — for an ad or gems. Or give up — you keep the run\'s coins.'), hand: false });
  }

  const RULES = [
    [UI.item('tubes', 'plain').icon, T('Переливание', 'Pouring'), T('<p>Тапни колбу, затем куда лить. Льётся весь верхний одноцветный блок — <b>на такой же цвет</b> или <b>в пустую колбу</b>.</p><p>Каждое переливание — ход.</p>', '<p>Tap a tube, then where to pour. The whole same-color top block pours — <b>onto the same color</b> or <b>into an empty tube</b>.</p><p>Every pour is a turn.</p>')],
    [UI.inlineArt('ui/rule_close'), T('Закрытие', 'Closing'), T('<p>Колба, полная одного цвета, <b>закрывается</b>: срабатывает эффект цвета, на её место приходят слои из очереди.</p><p>' + UI.elBadge('fire') + ' огонь — урон · ' + UI.elBadge('water') + ' вода — щит · ' + UI.elBadge('life') + ' жизнь — лечение. Долгое нажатие на что угодно — подробности.</p>', '<p>A tube full of one color <b>closes</b>: the color\'s effect fires and new layers drop in from the queue.</p><p>' + UI.elBadge('fire') + ' fire — damage · ' + UI.elBadge('water') + ' water — shield · ' + UI.elBadge('life') + ' life — heal. Long-press anything for details.</p>')],
    [UI.item('mods', 'combo_master').icon, T('Комбо', 'Combo'), T('<p>Закрытия ход за ходом растят комбо: <b>×1,5 → ×2 → ×3</b>. Ход без закрытия его сбрасывает.</p><p>Если новые слои сами закрыли колбу — <b>каскад</b>, без траты хода.</p>', '<p>Closes turn after turn build a combo: <b>×1.5 → ×2 → ×3</b>. A turn without a close resets it.</p><p>If new layers close a tube on their own, that\'s a <b>cascade</b> — no turn spent.</p>')],
    ['⚔️', T('Враг', 'Enemy'), T('<p>Над врагом — его следующее действие и <b>через сколько ходов</b> оно наступит. Щит поглощает урон и сгорает после атаки.</p><p>Побитый босс может убежать и вернуться на следующей встрече с половиной здоровья. На последнем этапе острова он бьётся до конца.</p>', '<p>Above the enemy: its next move and <b>how many turns</b> until it happens. Shield blocks damage, then breaks after the attack.</p><p>A beaten boss may flee and come back next fight with half its HP. On the island\'s last stage it fights to the end.</p>')],
    [UI.elBadge('stone'), T('Мусор', 'Junk'), T(`<p>${UI.elBadge('stone')} Камень и ${UI.elBadge('slime')} слизь льются только на такой же мусор или в пустую колбу.</p><p>Закрытие соседней колбы разбивает камни. Полная колба слизи даёт щит.</p>`, `<p>${UI.elBadge('stone')} Stone and ${UI.elBadge('slime')} slime pour only onto the same junk or into an empty tube.</p><p>Closing a neighboring tube breaks stones. A full tube of slime gives a shield.</p>`)],
    ['🚰', T('Слив и зелья', 'Drain & potions'), T('<p><b>Слить</b> — нажми кнопку, затем колбу: она опустеет за 3 HP и ход. В <b>тупике</b> — даром.</p><p>Зелья на поясе — тап, чтобы выпить. Некоторые просят выбрать колбу.</p>', '<p><b>Drain</b>: tap the button, then a tube. It empties for 3 HP and a turn. At a <b>dead end</b> it\'s free.</p><p>Tap a potion on your belt to drink it. Some ask you to pick a tube.</p>')],
  ];
  function showRules() {
    let i = 0;
    const close = UI.overlay('<div class="bt-rules-host"></div>', { cls: 'bt-ov' });
    const host = close.card.querySelector('.bt-rules-host');
    const draw = () => {
      const r = RULES[i];
      host.innerHTML = `<div class="bt-rules"><div class="r-ico">${r[0]}</div><h2 class="ov-title">${r[1]}</h2>${r[2]}</div>
        <div class="bt-rules-nav"><button class="btn btn-ghost btn-sm" data-n="-1" ${i ? '' : 'disabled'}>${T('‹ Назад', '‹ Back')}</button><span class="small dim">${i + 1} / ${RULES.length}</span>
        ${i < RULES.length - 1 ? `<button class="btn btn-sm" data-n="1">${T('Дальше ›', 'Next ›')}</button>` : `<button class="btn btn-cta btn-sm" data-close>${T('Понятно', 'Got it')}</button>`}</div>`;
      host.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { Snd.play('select'); i = Math.max(0, Math.min(RULES.length - 1, i + +b.dataset.n)); draw(); });
    };
    draw();
  }

  function showPause() {
    if (S.busy) return;
    const R = S.R;
    UI.overlay(`<h2 class="ov-title">${T('Пауза', 'Paused')}</h2><p class="ov-text">${T(`Остров ${R.island} · этап ${R.stage + 1}`, `Island ${R.island} · stage ${R.stage + 1}`)}</p><div class="ov-actions col">
      <button class="btn btn-cta" data-close>${T('Продолжить', 'Resume')}</button>
      <button class="btn" data-close="rules">${T('📖 Как играть', '📖 How to play')}</button>
      <button class="btn" data-close="settings">${T('⚙ Настройки', '⚙ Settings')}</button>
      <button class="btn btn-ghost" data-close="main">${T('На главный', 'Main menu')}</button></div>
      <p class="tiny dim" style="margin-top:10px">${T('Попытка сохранится — можно продолжить позже.', 'Your run is saved — you can continue later.')}</p>`, { cls: 'bt-ov', onClose: v => {
      if (v === 'rules') showRules();
      if (v === 'settings') { save(); UI.go('settings', { back: 'battle' }); }
      if (v === 'main') { save(); UI.go('main', { n: R.island }); }
    } });
  }

  function itemTile(icon, name, val, tip, cls) {
    return `<div class="bt-it${cls || ''}" data-tip="${esc(tip)}"><span class="ii">${icon}</span><span class="grow"><div class="in">${esc(name)}</div>${val ? `<div class="iv">${val}</div>` : ''}</span></div>`;
  }

  function showBuild() {
    const R = S.R, d = D();
    const deck = Object.keys(R.deck).map(c => {
      const cd = d.elements[c], lvl = R.deck[c];
      return itemTile(UI.elBadge(c), cd.name + (lvl ? ` +${lvl}` : ''), esc(colorValue(c)), `<b>${cd.name}</b>${lvl ? T(` · усиление ${lvl}`, ` · empower ${lvl}`) : ''}<br>${cd.desc}`);
    }).join('');
    const mods = Object.keys(R.mods).filter(id => R.mods[id]).map(id => {
      const m = UI.item('mods', id);
      return itemTile(m.icon, m.name, m.cap ? `${R.mods[id]}/${m.cap}` : '×' + R.mods[id], `<b>${m.name}</b><br>${m.desc}`);
    }).join('');
    const finds = R.filter ? itemTile(UI.item('finds', 'filter').icon, d.finds.filter.name, '', `<b>${d.finds.filter.name}</b><br>${d.finds.filter.desc}`) : '';
    const relics = R.relics.map(id => {
      const r = UI.item('relics', id), rr = d.rarity[r.rarity] || {};
      return itemTile(r.icon, r.name, esc(rr.name || ''), `<b>${r.name}</b><br>${r.desc}`, ' r-' + r.rarity);
    }).join('');
    const tubes = R.slots.map(k => { const t = UI.item('tubes', k); return itemTile(t.icon, t.name, '', `<b>${t.name}</b><br>${t.desc}`); }).join('');
    const pots = beltStacks(beltList()).map(g => { const p = UI.item('potions', g.id); return itemTile(p.icon, p.name, g.n > 1 ? '×' + g.n : '', `<b>${p.name}</b><br>${p.desc}`); }).join('');
    const empty = t => `<div class="bt-empty">${t}</div>`;
    UI.overlay(`<button class="btn-icon ov-x" data-close>${UI.ico.close}</button><h2 class="ov-title">🎒 ${T('Сборка', 'Build')}</h2>
      <div class="tiny dim center">${T('Долгое нажатие — подробности', 'Long-press for details')}</div>
      <div class="bt-sec">${T('Стихии', 'Elements')}</div><div class="bt-items">${deck}</div>
      <div class="bt-sec">${T('Бонусы', 'Bonuses')}</div>${mods || finds ? `<div class="bt-items">${mods}${finds}</div>` : empty(T('Пока нет — бери их после этапов.', 'None yet — pick them up after stages.'))}
      <div class="bt-sec">${T('Реликвии', 'Relics')}</div>${relics ? `<div class="bt-items">${relics}</div>` : empty(T('Реликвии дают за встречи с боссом.', 'Relics drop from boss fights.'))}
      <div class="bt-sec">${T('Пустые колбы', 'Empty tubes')}</div><div class="bt-items">${tubes}</div>
      <div class="bt-sec">${T('Зелья', 'Potions')} · ${beltList().length}/${R.beltSize}</div>${pots ? `<div class="bt-items">${pots}</div>` : empty(T('Пояс пуст.', 'Belt is empty.'))}`, { cls: 'sheet bt-build' });
  }

  // ---------- debug ----------
  // Run has no "win now" hook, so the win goes through a real action: a free firebomb against a 1-HP enemy.
  // That keeps Run.endBattle (coins, offers, boss flee/kill, island end) on its normal path.
  function debugWin() {
    if (!S || S.dead) return;
    if (S.busy) { UI.play([], { done: () => { setTimeout(debugWin, 0); } }); return; }
    const R = S.R, B = R.battle;
    if (R.phase !== 'battle' || !B || B.status !== 'active') { UI.toast(T('Сейчас нет боя', 'No battle right now')); return; }
    const tut = Tut();
    if (tut) tut.hide();
    const e = B.enemy;
    e.shield = 0;
    e.hp = 1;
    B.potions.push('firebomb');
    const idx = B.potions.length - 1;
    const evs = PS.Run.act(R, { type: 'potion', idx });
    B.stats.potionsUsed = Math.max(0, B.stats.potionsUsed - 1);
    save();
    track(evs.filter(x => x.type !== 'potion'));
    S.sel = null; S.mode = null;
    play(evs);
  }

  // ---------- screen ----------
  UI.screen('battle', {
    chrome: { topbar: false, tabs: false, tab: null },
    mount(el, params) {
      const R = params.run || (PS.Meta.profile && PS.Meta.profile.activeRun);
      if (!R) { setTimeout(() => UI.go('main'), 0); return; }
      const w = UI.world(R.island) || {};
      UI.setTheme(w.theme === 'night' ? 'night' : 'day', w.palette);
      S = { el, R, sel: null, mode: null, busy: false, dead: false, vm: {}, lh: 24 };
      el.dataset.world = w.n || 1;
      el.dataset.island = R.island;
      // An island with its own battle layers draws them from img/battle/island_<NN>/ (docs/art/battle-locations.md).
      const art = (UI.island(R.island) || {}).battleArt;
      el.classList.toggle('bt-art', !!art);
      if (art) ['arena_backdrop', 'dungeon_bg'].forEach((f, k) => el.style.setProperty(k ? '--dungeon-art' : '--arena-art', `url("${artUrl(R.island, f)}")`));
      skeleton();
      el.addEventListener('click', e => {
        const tw = e.target.closest('.bt-tw');
        if (tw) { onTube(+tw.dataset.i); return; }
        const pot = e.target.closest('[data-pot]');
        if (pot) { onPotion(+pot.dataset.pot); return; }
        const a = e.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'drain') onDrain();
        else if (a.dataset.a === 'pause') { Snd.play('select'); showPause(); }
        else if (a.dataset.a === 'build') { Snd.play('select'); showBuild(); }
        else if (a.dataset.a === 'buypot') showBuyPotion();
      });
      S.onResize = () => { if (S && !S.dead) fit(); };
      S.stopLayout = PS.BattleLayout.watch(el, S.onResize);
      const tut = Tut();
      if (tut) tut.attach({ R, el, tubeEl, getSel: () => (S ? S.sel : null) });
      UI.debug = UI.debug || {};
      UI.debug.onWin = debugWin;
      UI.debug.render = () => { if (S && !S.dead && !S.busy) renderAll(); };

      syncVm();
      if (params.events && !params.played) {
        params.played = true;
        track(params.events);
        renderAll();
        play(params.events);
      } else {
        renderAll();
        S.busy = true;
        requestAnimationFrame(() => { if (S && !S.dead) { fit(); afterPlay(); } });
      }
    },
    unmount() {
      if (!S) return;
      S.dead = true;
      if (S.ov) { S.ov(); S.ov = null; }
      if (S.stopLayout) S.stopLayout();
      const tut = Tut();
      if (tut) tut.detach();
      if (UI.debug && UI.debug.onWin === debugWin) UI.debug.onWin = null;
    },
  });
})();
