var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc, Fx = PS.Fx, Snd = PS.Snd;
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
  const iconOf = c => UI.elIco(c) || colorDef(c).sym || colorDef(c).icon;
  function layerBg(c) {
    const k = colorDef(c).css;
    const dots = c === 'slime' ? 'radial-gradient(circle at 22% 70%, #ffffff40 0 2.5px, #0000 3px), radial-gradient(circle at 68% 35%, #ffffff38 0 3px, #0000 3.5px), ' : '';
    return dots + k;
  }
  const turnsTxt = n => n + ' ' + T.pl(n, ['ход', 'хода', 'ходов'], ['turn', 'turns']);

  const INTENT = {
    atk: [T('удар', 'attack'), '⚔️'], stone: [T('камни в колбы', 'stones in tubes'), '🪨'], spores: [T('слизь в очередь', 'slime in queue'), '🍄'], freeze: [T('заморозит колбу', 'freezes a tube'), '❄️'],
    steal: [T('украдёт слой', 'steals a layer'), '🤏'], swap: [T('поменяет цвета', 'swaps colors'), '🔀'], shield: [T('щит', 'shield'), '🛡'], buff: [T('усилит удар', 'powers up'), '💪'], heal: [T('лечение', 'heal'), '💚'],
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

  // Grass islet under the enemy (approved battle mockup)
  const ISLET = '<svg class="bt-islet" viewBox="22 134 146 50" aria-hidden="true"><defs><linearGradient id="isTuft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7cf7a"/><stop offset="1" stop-color="#6aa452"/></linearGradient><linearGradient id="isDirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a62"/><stop offset="1" stop-color="#8f5a44"/></linearGradient></defs><path d="M30 150q65 50 130 0z" fill="url(#isDirt)"/><path d="M70 168l-6 12 12-6zM118 172l4 10 6-12z" fill="#8f5a44"/><ellipse cx="95" cy="150" rx="68" ry="14" fill="url(#isTuft)"/><path d="M32 148l4-9 4 9M150 148l4-10 4 10M60 156l3-7 3 7M128 157l3-7 3 7" fill="#86c46a" stroke="#6aa452" stroke-width="1" stroke-linejoin="round"/><ellipse cx="95" cy="148" rx="54" ry="7" fill="rgba(60,40,60,.25)"/></svg>';

  function skeleton() {
    S.el.innerHTML = `
      <div class="bt-top">
        <button class="btn-icon" data-a="pause" aria-label="${T('Пауза', 'Pause')}">${UI.ico.pause}</button>
        <div class="bt-sbar"></div>
        <button class="btn-icon" data-a="build" aria-label="${T('Сборка', 'Build')}">${UI.ico.bag}</button>
      </div>
      <div class="bt-enemy">
        <div class="bt-arena">
          <div class="bt-chips"></div>
          <div class="bt-mon">${ISLET}<div class="bt-mon-body"></div><div class="bt-mon-shadow"></div><div class="bt-bubble"></div></div>
          <div class="bt-intent"></div>
        </div>
        <div class="bt-einfo">
          <div class="bt-ename"></div>
          <div class="bt-bar"><div class="bar bar-enemy"><div class="bar-ghost"></div><div class="bar-fill"></div><div class="bt-shieldbar"></div><span class="bar-label"></span></div></div>
          <div class="bt-ehint"></div>
        </div>
      </div>
      <div class="bt-player">
        <span class="bt-heart">${UI.ico.heart(28)}</span>
        <div class="bar bar-hp"><div class="bar-ghost"></div><div class="bar-fill"></div><span class="bar-label"></span></div>
        <span class="bt-shield" data-tip="${T('<b>Щит</b><br>Поглощает урон от атаки врага и сгорает после неё.', '<b>Shield</b><br>Blocks damage from the enemy attack, then breaks.')}">${UI.ico.shield(13)}<b>0</b></span>
        <div class="bt-combo" data-tip="${T('<b>Комбо</b><br>Закрытия подряд усиливают эффект: ×1,5 → ×2 → ×3. Ход без закрытия сбрасывает комбо.', '<b>Combo</b><br>Back-to-back closes boost effects: ×1.5 → ×2 → ×3. A turn without a close resets the combo.')}"><div class="cl">${T('комбо', 'combo')}</div><div class="cv">×1</div></div>
      </div>
      <div class="bt-field"><div class="bt-row" data-row="0"></div><div class="bt-row" data-row="1"></div></div>
      <div class="bt-queue"></div>
      <div class="bt-bottom"><div class="bt-belt"></div><button class="btn btn-blue bt-drain" data-a="drain"></button></div>`;
  }

  function renderTop() {
    const R = S.R, isl = UI.island(R.island);
    $('.bt-sbar').innerHTML = UI.stageBar({ n: R.island, current: Math.min(isl.stages, R.stage + 1), best: PS.Meta.profile.best[R.island] || 0, compact: true })
      + `<div class="bt-stage-lbl">${T(`Остров ${R.island} · этап ${Math.min(isl.stages, R.stage + 1)} из ${isl.stages}`, `Island ${R.island} · stage ${Math.min(isl.stages, R.stage + 1)} of ${isl.stages}`)}</div>`;
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
    mon.querySelector('.bt-mon-body').innerHTML = UI.enemyArt(m.e.id, { rage: S.vm.rage, patched: m.e.patched });
    mon.classList.remove('dead', 'flee');
    mon.classList.toggle('gone', m.e && S.R.battle.status !== 'active' && S.R.battle.status !== 'lost');
    if (enter) Fx.animClass(mon, 'enter', 560);
    const encs = S.R.boss ? S.R.boss.encounters : 1;
    const heals = m.e.cycle.some(c => c.t === 'heal') ? Math.max(0, D().economy.enemyHeals - (m.e.heals || 0)) : null;
    $('.bt-ename').innerHTML = `${m.boss ? `<span class="tag tag-hard" data-tip="<b>${esc(m.def.name || m.e.name)}</b><br>${esc(m.def.desc || '')}">${UI.ico.crown(16)} ${T('Босс', 'Boss')}</span>` : ''}
      ${m.boss && encs > 1 ? `<span class="tag">${T(`встреча ${m.enc + 1}/${encs}`, `fight ${m.enc + 1}/${encs}`)}</span>` : ''}
      ${heals != null ? `<span class="tag" data-tip="${T(`Враг лечится не больше ${D().economy.enemyHeals} раз за бой`, `Enemy heals at most ${D().economy.enemyHeals} times per fight`)}">💚 ${heals}</span>` : ''}`;
  }

  function setBar(bar, v, max, label) {
    const pct = Math.max(0, Math.min(100, max ? v / max * 100 : 0)) + '%';
    bar.querySelector('.bar-fill').style.width = pct;
    const g = bar.querySelector('.bar-ghost');
    if (g) g.style.width = pct;
    bar.querySelector('.bar-label').textContent = label;
  }

  function renderEnemyBars() {
    const vm = S.vm, B = S.R.battle;
    if (!B) return;
    const bar = $('.bt-einfo .bar');
    setBar(bar, vm.eHp, vm.eMax, `${Math.max(0, vm.eHp)} / ${vm.eMax}${vm.eShield > 0 ? '  🛡' + vm.eShield : ''}`);
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
    if (vm.eShield > 0) out.push(['c-shield', `🛡 ${vm.eShield}`, T('Щит врага поглощает урон. Яд идёт насквозь.', 'Enemy shield blocks damage. Poison goes through.')]);
    const pz = e.poison.reduce((s, p) => s + p.tick, 0);
    if (pz) out.push(['c-poison', `${UI.elBadge('poison')} ${pz}`, T(`Яд: ${pz} урона за ход, мимо щита. Осталось до ${turnsTxt(Math.max.apply(null, e.poison.map(p => p.turns)))}.`, `Poison: ${pz} damage per turn, ignores shield. Up to ${turnsTxt(Math.max.apply(null, e.poison.map(p => p.turns)))} left.`)]);
    if (vm.frozen > 0) out.push(['c-ice', `${UI.elBadge('ice')} ${vm.frozen}`, T(`Враг заморожен ещё на ${turnsTxt(vm.frozen)}: таймер стоит, по нему +50% урона.`, `Enemy frozen for ${turnsTxt(vm.frozen)} more: timer paused, +50% damage to it.`)]);
    if (vm.buff > 1) out.push(['c-buff', '💪 ×2', T('Следующая атака врага ×2.', 'Next enemy attack ×2.')]);
    if (vm.rage) out.push(['c-rage', T('😡 ярость', '😡 rage'), T('Ярость: действует на 1 ход раньше.', 'Rage: acts 1 turn sooner.')]);
    if (B.burn && B.burn.length) out.push(['c-rage', `🔥 ${B.burn.reduce((s, b) => s + b.dmg, 0)}`, T('Поджог: урон тебе каждый ход, мимо щита.', 'Burn: damages you every turn, ignores shield.')]);
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
    el.innerHTML = `<div class="il">${esc(label)}</div><div class="iv">${intentValue(it, vm.buff)}</div>
      ${!paused && vm.timer <= 6 ? `<div class="bt-pips">${'<i></i>'.repeat(Math.max(1, vm.timer))}</div>` : ''}<div class="it">${foot}</div>`;
  }

  function renderPlayer() {
    const vm = S.vm;
    setBar($('.bt-player .bar'), vm.pHp, vm.pMax, `${Math.max(0, vm.pHp)} / ${vm.pMax}`);
    const sh = $('.bt-shield');
    sh.querySelector('b').textContent = Math.max(0, vm.pShield);
    sh.classList.toggle('zero', !(vm.pShield > 0));
    renderCombo();
  }

  function renderCombo() {
    const B = S.R.battle, c = $('.bt-combo');
    const n = inBattle() ? S.vm.combo || 0 : 0;
    const k = B ? PS.Combat.kOf(B, Math.min(n, D().combo.length - 1)) : 1;
    c.classList.toggle('hot', n > 0);
    c.querySelector('.cv').textContent = '×' + kfmt(k);
  }

  // opts: {fill: {tube, n}, drop: tubeIdx | 'all'}
  function renderTubes(tubes, opts) {
    opts = opts || {};
    const B = S.R.battle;
    if (!B) return;
    tubes = tubes || B.field.tubes;
    const rows = PS.Field.layout({ tubes, filled: B.field.filled }).rows;
    const bombN = {};
    tubes.forEach((t, i) => { if (t.kind === 'bomb') PS.Field.neighbors({ tubes, filled: B.field.filled }, i).forEach(j => { bombN[j] = true; }); });
    rows.forEach((row, r) => {
      const host = $(`.bt-row[data-row="${r}"]`);
      host.innerHTML = '';
      row.forEach(i => {
        const t = tubes[i];
        const w = document.createElement('div');
        w.className = 'bt-tw' + (bombN[i] ? ' bomb-n' : '');
        w.dataset.i = i;
        const n = t.layers.length;
        const fresh = opts.drop === 'all' || opts.drop === i;
        const sp = opts.fill && opts.fill.tube === i ? opts.fill.n : 0;
        // Equal neighbours read as one body of liquid: one icon at the middle of each run (carried by its bottom layer).
        let run = 0;
        const layers = t.layers.map((c, k) => {
          if (k === 0 || c !== t.layers[k - 1]) { run = 1; while (t.layers[k + run] === c) run++; }
          const first = k === 0 || c !== t.layers[k - 1];
          const cls = 'bt-layer' + (k === n - 1 ? ' top' : '') + (fresh ? ' drop' : '') + (sp && k >= n - sp ? ' fill' : '');
          return `<div class="${cls}" style="background:${layerBg(c)}">${first ? `<i${sp && k + run === n ? ' class="late"' : ''} style="--run:${run}">${iconOf(c)}</i>` : ''}</div>`;
        }).join('');
        const td = D().tubes[t.kind] || {};
        w.innerHTML = `<div class="bt-tube k-${t.kind}" style="--cap:${t.cap}"><div class="bt-liq">${layers}</div>${t.frozen ? `<div class="bt-ice">❄ ${t.frozen}</div>` : ''}</div>
          <div class="bt-ttag"${t.kind !== 'plain' ? ` data-tip="<b>${esc(td.name)}</b><br>${esc(td.desc)}"` : ''}>${t.kind !== 'plain' ? td.icon : ''}</div>`;
        host.appendChild(w);
      });
    });
    S.shownTubes = tubes;
    refreshSel();
  }

  function fit() {
    if (!S || !S.R.battle) return;
    const f = $('.bt-field'), tubes = S.shownTubes || S.R.battle.field.tubes;
    const rows = PS.Field.layout({ tubes, filled: S.R.battle.field.filled }).rows;
    const caps = rows.map(r => r.length ? Math.max.apply(null, r.map(i => tubes[i].cap)) : 0);
    const totalCap = caps.reduce((a, b) => a + b, 0) || 8;
    const over = rows.filter(r => r.length).length * 34 + 30;
    const lh = Math.max(14, Math.min(30, Math.floor((f.clientHeight - over) / totalCap)));
    S.el.style.setProperty('--lh', lh + 'px');
    S.lh = lh;
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
      html += `<button class="bt-pot pt-${g.id}${g.id === armedId ? ' armed' : ''}" data-pot="${g.idx}" data-tip="<b>${esc(p.icon + ' ' + p.name)}${g.n > 1 ? ' ×' + g.n : ''}</b><br>${esc(p.desc)}" aria-label="${esc(p.name)}">${UI.ico[g.id] && (g.id === 'undo' || g.id === 'heal') ? UI.ico[g.id] : p.icon}${g.n > 1 ? `<span class="bt-pot-n">${g.n}</span>` : ''}</button>`;
    });
    for (let i = list.length; i < (R.beltSize || 3); i++) html += `<div class="bt-pot empty" aria-label="${T('Пустой слот пояса', 'Empty belt slot')}">+</div>`;
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
    renderTubes();
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

  const effTarget = kind => kind === 'shield' || kind === 'slime' ? $('.bt-shield') : kind === 'heal' || kind === 'self' ? $('.bt-player .bar') : monEl();
  const flySrc = () => (S.flyFrom != null && tubeEl(S.flyFrom)) || $('.bt-field');

  // Nothing flies between tubes: the source level drops while its top icon fades, then the target level rises and the icon of the
  // run it lands in fades back in at the run's new middle.
  async function animPour(ev) {
    Snd.play('pour');
    const aw = tubeEl(ev.from);
    if (aw) {
      [...aw.querySelectorAll('.bt-layer')].slice(-ev.n).forEach(L => L.classList.add('out'));
      const icons = aw.querySelectorAll('.bt-layer i');
      if (icons.length) icons[icons.length - 1].classList.add('gone');
      await sleep(200);
    }
    renderTubes(ev.tubes, ev.swallow ? {} : { fill: { tube: ev.to, n: ev.n } });
    await sleep(ev.swallow ? 0 : 260);
  }

  async function animDrainTube(i) {
    const w = tubeEl(i);
    if (!w) return;
    w.querySelector('.bt-liq').classList.add('drain');
    await sleep(240);
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
      renderEnemyBars(); renderIntent(); renderPlayer(); renderTubes(B.field.tubes, { drop: 'all' }); renderQueue(); renderBelt(); fit();
      if (ev.boss) { Fx.bigPop(ev.final ? T('Босс!', 'Boss!') : T(`Босс · встреча ${ev.encounter + 1}`, `Boss · fight ${ev.encounter + 1}`), '#ff9a8a'); Snd.play('hurt'); return 900; }
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
      renderTubes(ev.tubes);
      const w = tubeEl(ev.tube);
      if (w) {
        const t = w.querySelector('.bt-tube');
        t.style.setProperty('--glow', colorDef(ev.color).css);
        t.classList.add('closed');
        t.insertAdjacentHTML('beforeend', '<div class="bt-cork"></div>');
        Fx.burstAt(t, colorDef(ev.color).css, 16, 50);
      }
      Snd.play(ev.color === 'stone' ? 'stone' : 'close', ev.step);
      if (ev.cascade) Fx.bigPop(T('Каскад!', 'Cascade!'));
      await sleep(280);
    },
    combo(ev) {
      S.vm.combo = ev.step + 1;
      renderCombo();
      Fx.bigPop(T('Комбо ×', 'Combo ×') + kfmt(ev.k));
      Snd.play('combo');
      Fx.shake($('.bt-field'), 3 + ev.step * 2);
      Fx.animClass($('.bt-combo'), 'wiggle', 320);
      return 250;
    },
    async effect(ev) {
      const vm = S.vm, color = ev.color === 'slime' ? '#5bb8ff' : colorDef(ev.color).css;
      if (ev.kind === 'self' || ev.kind === 'stone') return 0;
      const from = ev.source === 'firebomb' ? $('.bt-belt') : flySrc();
      await Fx.fly(from, effTarget(ev.kind), color, { size: 22 });
      if (ev.kind === 'shield' || ev.kind === 'slime') {
        vm.pShield += ev.value; renderPlayer(); Snd.play('shield');
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
      if (ev.absorbed) hitNum($('.bt-shield'), '🛡-' + ev.absorbed, '#a7dcff');
      if (ev.dmg > 0) {
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
      await animDrainTube(ev.tube);
      renderTubes(ev.tubes, { drop: ev.tube });
      if (ev.queue) renderQueue(ev.queue);
      Snd.play('drop');
      await sleep(380);
    },
    stones(ev) { renderTubes(ev.tubes); Fx.burstAt(tubeEl(ev.tube), colorDef('stone').css, 18, 50); Snd.play('stone'); return 260; },
    bomb(ev) {
      (ev.targets || []).forEach(t => Fx.burstAt(tubeEl(t.tube), '#ffb347', 16, 50));
      Fx.burstAt(tubeEl(ev.tube), '#ff7a3d', 24, 70);
      Snd.play('hit');
      renderTubes(ev.tubes);
      return 320;
    },
    turn(ev) {
      if (ev.free) {
        const why = { sieve: T('Сито', 'Sieve'), catalyst: T('Катализатор', 'Catalyst'), lucky_clover: T('🍀 Клевер', '🍀 Clover'), philosopher_stone: T('💠 Камень', '💠 Stone'), dead_end: T('Тупик', 'Dead end') }[ev.reason] || '';
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
          renderTubes(ev.tubes);
          break;
        case 'freeze':
          Snd.play('freeze');
          if (ev.target >= 0) await Fx.fly(mon, tubeEl(ev.target), '#a9ecff', { size: 20 });
          renderTubes(ev.tubes);
          break;
        case 'steal':
          if (ev.target) {
            const from = tubeEl(ev.target.tube);
            renderTubes(ev.tubes, ev.target.refilled != null ? { drop: ev.target.refilled } : null);
            await Fx.fly(from, mon, colorDef(ev.target.color).css, { size: 18 });
          } else renderTubes(ev.tubes);
          Snd.play('bad');
          break;
        case 'swap':
          Snd.play('zap');
          await Fx.shake($('.bt-field'), 10);
          renderTubes(ev.tubes);
          if (ev.target) hitNum($('.bt-field'), `${UI.elBadge(ev.target.a) || iconOf(ev.target.a)} ⇄ ${UI.elBadge(ev.target.b) || iconOf(ev.target.b)}`, '#ffe08a', true);
          break;
        case 'spores':
          Snd.play('poison');
          await Fx.fly(mon, $('.bt-queue'), colorDef('slime').css, { size: 18 });
          if (ev.queue) renderQueue(ev.queue);
          break;
        case 'buff': S.vm.buff = 2; renderEnemyBars(); hitNum(mon, '💪 ×2', '#ffb08a', true); Snd.play('hurt'); break;
        case 'atk': S.vm.buff = 1; break;
      }
      await sleep(120);
    },
    rage() { S.vm.rage = true; renderMonster(false); renderEnemyBars(); renderIntent(); Fx.bigPop(T('Ярость!', 'Rage!'), '#ff7a6b'); Snd.play('hurt'); Fx.shake($('.bt-arena'), 8); return 800; },
    dead_end() { Fx.animClass($('.bt-drain'), 'wiggle', 320); Snd.play('bad'); return 100; },
    async drain(ev) {
      S.mode = null;
      Snd.play('pour');
      await animDrainTube(ev.tube);
      renderTubes(ev.tubes, ev.refilled ? { drop: ev.tube } : null);
      renderBelt();
      if (ev.free) hitNum($('.bt-drain'), T('даром', 'free'), '#ffe08a');
      await sleep(200);
    },
    potion(ev) {
      const p = UI.item('potions', ev.id);
      renderBelt();
      Snd.play('buy');
      hitNum($('.bt-belt'), p.icon, '#fff', true);
      if (ev.id === 'undo') { renderAll(); Fx.bigPop(T('↶ Отмена', '↶ Undo')); return 500; }
      if (ev.tubes) renderTubes(ev.tubes, ev.id === 'shake' || ev.id === 'flask' ? { drop: ev.tube } : null);
      if (ev.id === 'flask') fit();
      if (ev.id === 'sleep') { S.vm.timer += D().potions.sleep.delay; renderIntent(); hitNum($('.bt-intent'), '💤 +' + D().potions.sleep.delay, '#c9d6ff'); }
      if (ev.id === 'combo') Fx.bigPop(T('✨ Следующее — ×2', '✨ Next one ×2'));
      if (ev.id === 'firebomb') S.flyFrom = null;
      return 300;
    },
    relic(ev) { const r = UI.item('relics', ev.id); hitNum($('.bt-player'), r.icon, '#ffcb4f', true); return 150; },
    twist(ev) {
      if (ev.tubes) renderTubes(ev.tubes);
      if (ev.twist === 'stonefall') { Snd.play('stone'); UI.toast(T('🪨 Камнепад: камень упал в колбу', '🪨 Rockfall: a stone dropped into a tube')); return 400; }
      if (ev.twist === 'burn') { hitNum($('.bt-player'), T(`🔥 Поджог ${ev.dmg}×${ev.turns}`, `🔥 Burn ${ev.dmg}×${ev.turns}`), '#ff9a5a'); renderChips(); return 300; }
      if (ev.twist === 'frozenStart') { Snd.play('freeze'); return 300; }
      return 0;
    },
    async enemy_dead() {
      const mon = monEl();
      Snd.play('hit');
      Fx.burstAt(mon, '#ffcf4a', 26, 90);
      mon.classList.add('dead');
      await sleep(750);
    },
    // No caption on purpose: the boss just staggers and runs off; the tutorial explains it the first time.
    async boss_fled() {
      const mon = monEl();
      Snd.play('hit');
      Fx.animClass(mon, 'hurt', 350);
      await sleep(380);
      mon.classList.add('flee');
      Snd.play('swipe');
      Fx.burstAt(mon, '#e6dcc4', 16, 70);
      await sleep(900);
    },
    async player_dead() { Fx.vignette('#000'); Snd.play('lose'); await sleep(700); },
    stage_clear() { if (S.R.phase !== 'won') Fx.bigPop(T('Этап пройден!', 'Stage clear!')); return 500; },
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
      Fx.bigPop(T('Воскрешение!', 'Revived!'));
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
    let icon = '❔', name = '', desc = '', tags = '', cls = '', side = '';
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
        if (o.tube) { const t = D().tubes[o.tube]; icon = t.icon; name = `${f.name}: ${t.name}`; desc = t.desc; }
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
      case 'tube': { const t = D().tubes[o.id]; icon = t.icon; name = T(`Слот ${o.slot + 1}: ${t.name}`, `Slot ${o.slot + 1}: ${t.name}`); desc = t.desc; break; }
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
      replace_tube: [T('Слоты заняты', 'Slots full'), pend ? T(`Какую колбу заменить на ${D().tubes[pend].icon} ${esc(D().tubes[pend].name)}?`, `Which tube to swap for ${D().tubes[pend].icon} ${esc(D().tubes[pend].name)}?`) : T('Какую колбу заменить?', 'Which tube to replace?')],
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
    const gems = PS.Meta.profile.gems;
    const freeBtn = !o.free ? '' : seal
      ? `<button class="btn btn-cta" data-a="free">${T('🔱 Воскреснуть бесплатно', '🔱 Revive for free')}</button>`
      : `<button class="btn btn-green btn-ad" data-a="free" ${UI.ads.online ? '' : 'disabled'}>${UI.ads.online ? T('Воскреснуть за рекламу', 'Revive (watch ad)') : T('Реклама недоступна', 'Ad unavailable')}</button>`;
    const html = `<div class="ov-hero">💀</div><h2 class="ov-title">${T('Ты пал!', 'You fell!')}</h2>
      <p class="ov-text">${o.free ? T(`Воскресни с ${Math.round(D().economy.revive.hp * 100)}% HP — поле останется как было. Воскрешение — одно за попытку.`, `Revive with ${Math.round(D().economy.revive.hp * 100)}% HP — the field stays as it was. One revive per run.`) : T('Воскрешение в этой попытке уже использовано.', 'Revive already used this run.')}</p>
      <div class="ov-actions col">${freeBtn}
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
    ['🧪', T('Переливание', 'Pouring'), T('<p>Тапни колбу, затем куда лить. Льётся весь верхний одноцветный блок — <b>на такой же цвет</b> или <b>в пустую колбу</b>.</p><p>Каждое переливание — ход.</p>', '<p>Tap a tube, then where to pour. The whole same-color top block pours — <b>onto the same color</b> or <b>into an empty tube</b>.</p><p>Every pour is a turn.</p>')],
    ['✨', T('Закрытие', 'Closing'), T('<p>Колба, полная одного цвета, <b>закрывается</b>: срабатывает эффект цвета, на её место приходят слои из очереди.</p><p>' + UI.elBadge('fire') + ' огонь — урон · ' + UI.elBadge('water') + ' вода — щит · ' + UI.elBadge('life') + ' жизнь — лечение. Долгое нажатие на что угодно — подробности.</p>', '<p>A tube full of one color <b>closes</b>: the color\'s effect fires and new layers drop in from the queue.</p><p>' + UI.elBadge('fire') + ' fire — damage · ' + UI.elBadge('water') + ' water — shield · ' + UI.elBadge('life') + ' life — heal. Long-press anything for details.</p>')],
    ['🔥', T('Комбо', 'Combo'), T('<p>Закрытия ход за ходом растят комбо: <b>×1,5 → ×2 → ×3</b>. Ход без закрытия его сбрасывает.</p><p>Если новые слои сами закрыли колбу — <b>каскад</b>, без траты хода.</p>', '<p>Closes turn after turn build a combo: <b>×1.5 → ×2 → ×3</b>. A turn without a close resets it.</p><p>If new layers close a tube on their own, that\'s a <b>cascade</b> — no turn spent.</p>')],
    ['⚔️', T('Враг', 'Enemy'), T('<p>Над врагом — его следующее действие и <b>через сколько ходов</b> оно наступит. Щит поглощает урон и сгорает после атаки.</p><p>Побитый босс может убежать и вернуться на следующей встрече с половиной здоровья. На последнем этапе острова он бьётся до конца.</p>', '<p>Above the enemy: its next move and <b>how many turns</b> until it happens. Shield blocks damage, then breaks after the attack.</p><p>A beaten boss may flee and come back next fight with half its HP. On the island\'s last stage it fights to the end.</p>')],
    ['🪨', T('Мусор', 'Junk'), T('<p>🪨 Камень и 🫧 слизь льются только на такой же мусор или в пустую колбу.</p><p>Закрытие соседней колбы разбивает камни. Полная колба слизи даёт щит.</p>', '<p>🪨 Stone and 🫧 slime pour only onto the same junk or into an empty tube.</p><p>Closing a neighboring tube breaks stones. A full tube of slime gives a shield.</p>')],
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
    const finds = R.filter ? itemTile(d.finds.filter.icon, d.finds.filter.name, '', `<b>${d.finds.filter.name}</b><br>${d.finds.filter.desc}`) : '';
    const relics = R.relics.map(id => {
      const r = UI.item('relics', id), rr = d.rarity[r.rarity] || {};
      return itemTile(r.icon, r.name, esc(rr.name || ''), `<b>${r.name}</b><br>${r.desc}`, ' r-' + r.rarity);
    }).join('');
    const tubes = R.slots.map(k => { const t = d.tubes[k]; return itemTile(t.icon, t.name, '', `<b>${t.name}</b><br>${t.desc}`); }).join('');
    const pots = beltStacks(beltList()).map(g => { const p = UI.item('potions', g.id); return itemTile(p.icon, p.name, g.n > 1 ? '×' + g.n : '', `<b>${p.name}</b><br>${p.desc}`); }).join('');
    const empty = t => `<div class="bt-empty">${t}</div>`;
    UI.overlay(`<button class="btn-icon ov-x" data-close>✕</button><h2 class="ov-title">🎒 ${T('Сборка', 'Build')}</h2>
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
      skeleton();
      el.addEventListener('click', e => {
        const tw = e.target.closest('.bt-tw');
        if (tw && !e.target.closest('.bt-ttag')) { onTube(+tw.dataset.i); return; }
        const pot = e.target.closest('[data-pot]');
        if (pot) { onPotion(+pot.dataset.pot); return; }
        const a = e.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'drain') onDrain();
        else if (a.dataset.a === 'pause') { Snd.play('select'); showPause(); }
        else if (a.dataset.a === 'build') { Snd.play('select'); showBuild(); }
      });
      S.onResize = () => { if (S && !S.dead) fit(); };
      window.addEventListener('resize', S.onResize);
      const tut = Tut();
      if (tut) tut.attach({ R, el, tubeEl, getSel: () => (S ? S.sel : null) });
      UI.debug = UI.debug || {};
      UI.debug.onWin = debugWin;

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
      window.removeEventListener('resize', S.onResize);
      const tut = Tut();
      if (tut) tut.detach();
      if (UI.debug && UI.debug.onWin === debugWin) UI.debug.onWin = null;
    },
  });
})();
