var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc, Fx = PS.Fx, Snd = PS.Snd;
  const D = () => PS.DATA;
  const Tut = () => PS.Tutorial || null;
  const sleep = ms => UI.sleep(ms / (UI.speed || 1));
  const plural = (n, a, b, c) => PS.U.plural(n, a, b, c);
  const kfmt = k => String(Math.round(k * 100) / 100).replace('.', ',');
  const TUBE_POTIONS = { solvent: true, shake: true };
  const JUNK = { stone: true, slime: true };

  let S = null;

  // ---------- content helpers ----------
  const colorDef = c => D().colors[c] || D().junk[c] || { css: '#888888', icon: '?', name: c };
  const iconOf = c => colorDef(c).sym || colorDef(c).icon;
  function layerBg(c) {
    const k = colorDef(c).css, sh = Fx.shade;
    const dots = c === 'slime' ? 'radial-gradient(circle at 22% 70%, #ffffff30 0 2.5px, #0000 3px), radial-gradient(circle at 68% 35%, #ffffff28 0 3px, #0000 3.5px), ' : '';
    return `${dots}linear-gradient(180deg, #ffffff22, #0000 35%, #0000003a), linear-gradient(90deg, ${sh(k, -28)} 0%, ${k} 26%, ${sh(k, 32)} 46%, ${k} 68%, ${sh(k, -24)} 100%)`;
  }
  const turnsTxt = n => n + ' ' + plural(n, 'ход', 'хода', 'ходов');

  const INTENT = {
    atk: ['удар', '⚔️'], stone: ['камни в колбы', '🪨'], spores: ['слизь в очередь', '🍄'], freeze: ['заморозит колбу', '❄️'],
    steal: ['украдёт слой', '🤏'], swap: ['поменяет цвета', '🔀'], shield: ['щит', '🛡'], buff: ['усилит удар', '💪'], heal: ['лечение', '💚'],
  };
  const INTENT_TIP = {
    atk: 'Ударит по тебе. Щит поглощает урон и сгорает после атаки.', stone: 'Положит камни в колбы. Камни разбиваются, когда закрываешь соседнюю колбу.',
    spores: 'Превратит слои очереди в слизь.', freeze: 'Заморозит колбу: из неё и в неё нельзя лить.', steal: 'Украдёт верхний слой одной колбы.',
    swap: 'Поменяет местами два цвета на всём поле.', shield: 'Закроется щитом — он поглощает урон (яд идёт насквозь).', buff: 'Следующая атака будет ×2.', heal: 'Вылечит себя.',
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
    const k = 1, v = PS.Combat.effectValue(B, c, k, kind || 'plain'), cd = D().colors[c];
    switch (c) {
      case 'fire': case 'lightning': case 'dark': return `${v} урона`;
      case 'water': return `${v} щита`;
      case 'life': return `${v} лечения`;
      case 'poison': return `${v}/ход × ${(B.relics || []).indexOf('poison_ivy') >= 0 ? D().relics.poison_ivy.turns : cd.base.turns}`;
      case 'ice': return `заморозка ${turnsTxt(v)}`;
      case 'mirror': return 'повтор последнего';
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
      <div class="bt-top">
        <button class="btn-icon" data-a="pause" aria-label="Пауза">⏸</button>
        <div class="bt-sbar"></div>
        <button class="btn-icon" data-a="build" aria-label="Сборка">🎒</button>
      </div>
      <div class="bt-enemy">
        <div class="bt-arena">
          <div class="bt-chips"></div>
          <div class="bt-mon"><div class="bt-mon-body"></div><div class="bt-mon-shadow"></div><div class="bt-bubble"></div></div>
          <div class="bt-intent"></div>
        </div>
        <div class="bt-einfo">
          <div class="bt-ename"></div>
          <div class="bt-bar"><div class="bar bar-enemy"><div class="bar-ghost"></div><div class="bar-fill"></div><div class="bt-shieldbar"></div><span class="bar-label"></span></div></div>
          <div class="bt-ehint"></div>
        </div>
      </div>
      <div class="bt-player">
        <span class="bt-heart">❤️</span>
        <div class="bar bar-hp"><div class="bar-ghost"></div><div class="bar-fill"></div><span class="bar-label"></span></div>
        <span class="bt-shield" data-tip="<b>Щит</b><br>Поглощает урон от атаки врага и сгорает после неё.">🛡 <b>0</b></span>
        <div class="bt-combo" data-tip="<b>Комбо</b><br>Закрытия подряд усиливают эффект: ×1,5 → ×2 → ×3. Ход без закрытия сбрасывает комбо."><div class="cl">комбо</div><div class="cv">×1</div></div>
      </div>
      <div class="bt-field"><div class="bt-row" data-row="0"></div><div class="bt-row" data-row="1"></div></div>
      <div class="bt-queue"></div>
      <div class="bt-bottom"><div class="bt-belt"></div><button class="btn bt-drain" data-a="drain"></button></div>`;
  }

  function renderTop() {
    const R = S.R, isl = UI.island(R.island);
    $('.bt-sbar').innerHTML = UI.stageBar({ n: R.island, current: Math.min(isl.stages, R.stage + 1), best: PS.Meta.profile.best[R.island] || 0, compact: true })
      + `<div class="bt-stage-lbl">Остров ${R.island} · этап ${Math.min(isl.stages, R.stage + 1)} из ${isl.stages}</div>`;
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
    $('.bt-ename').innerHTML = `${m.boss ? '<span class="tag tag-hard">☠ Босс</span>' : ''}<span class="nm" data-tip="<b>${esc(m.def.name || m.e.name)}</b><br>${esc(m.def.desc || '')}">${esc(m.def.name || m.e.name)}</span>
      ${m.boss && encs > 1 ? `<span class="tag">встреча ${m.enc + 1}/${encs}</span>` : ''}
      ${heals != null ? `<span class="tag" data-tip="Враг лечится не больше ${D().economy.enemyHeals} раз за бой">💚 ${heals}</span>` : ''}`;
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
    if (pv.rageAt != null && !vm.rage) { mark = { at: pv.rageAt, cls: ' rage' }; hint.textContent = `ярость при ${pv.rageAt} HP`; hint.dataset.tip = '<b>Ярость</b><br>Раненый финальный босс действует на 1 ход раньше.'; }
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
    if (vm.eShield > 0) out.push(['c-shield', `🛡 ${vm.eShield}`, 'Щит врага поглощает урон. Яд идёт насквозь.']);
    const pz = e.poison.reduce((s, p) => s + p.tick, 0);
    if (pz) out.push(['c-poison', `☠ ${pz}`, `Яд: ${pz} урона за ход, мимо щита. Осталось до ${turnsTxt(Math.max.apply(null, e.poison.map(p => p.turns)))}.`]);
    if (vm.frozen > 0) out.push(['c-ice', `❄ ${vm.frozen}`, `Враг заморожен ещё на ${turnsTxt(vm.frozen)}: таймер стоит, по нему +50% урона.`]);
    if (vm.buff > 1) out.push(['c-buff', '💪 ×2', 'Следующая атака врага ×2.']);
    if (vm.rage) out.push(['c-rage', '😡 ярость', 'Ярость: действует на 1 ход раньше.']);
    if (B.burn && B.burn.length) out.push(['c-rage', `🔥 ${B.burn.reduce((s, b) => s + b.dmg, 0)}`, 'Поджог: урон тебе каждый ход, мимо щита.']);
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
    const foot = paused ? `заморожен · ${vm.frozen}` : vm.timer <= 1 ? 'следующий ход!' : `через ${turnsTxt(vm.timer)}`;
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

  // opts: {splash: {tube, n}, drop: tubeIdx | 'all'}
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
        const sp = opts.splash && opts.splash.tube === i ? opts.splash.n : 0;
        const layers = t.layers.map((c, k) => {
          const cls = 'bt-layer' + (k === n - 1 ? ' top' : '') + (fresh ? ' drop' : '') + (sp && k >= n - sp ? ' splash' : '');
          return `<div class="${cls}" style="background:${layerBg(c)}${fresh ? `;animation-delay:${k * 60}ms` : ''}"><i>${iconOf(c)}</i></div>`;
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
    const B = S.R.battle;
    if (!B) { $('.bt-queue').innerHTML = ''; return; }
    queue = queue || B.field.queue;
    $('.bt-queue').innerHTML = `<span class="bt-q-lbl">Дальше:</span>` + queue.map((p, i) =>
      `<div class="bt-qv${i === 0 ? ' next' : ''}">${p.map(c => `<i style="background:${colorDef(c).css}"></i>`).join('')}</div>`).join('');
    $('.bt-queue').dataset.tip = '<b>Очередь</b><br>Слои, которые придут в закрытую колбу. Первая порция подсвечена.';
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
      html += `<button class="bt-pot${g.id === armedId ? ' armed' : ''}" data-pot="${g.idx}" data-tip="<b>${esc(p.icon + ' ' + p.name)}${g.n > 1 ? ' ×' + g.n : ''}</b><br>${esc(p.desc)}">${p.icon}${g.n > 1 ? `<span class="bt-pot-n">${g.n}</span>` : ''}</button>`;
    });
    for (let i = list.length; i < (R.beltSize || 3); i++) html += '<div class="bt-pot empty">·</div>';
    $('.bt-belt').innerHTML = html;
    const dr = $('.bt-drain'), B = R.battle;
    const stuck = inBattle() && B.stuck;
    const armed = S.mode && S.mode.type === 'drain';
    dr.className = 'btn bt-drain' + (stuck ? ' btn-cta stuck' : '') + (armed ? ' armed' : '');
    dr.innerHTML = armed ? '👇 Выбери колбу' : stuck ? '🚰 Тупик — слей даром' : '🚰 Слить';
    dr.dataset.tip = `<b>Слить колбу</b><br>Нажми, затем колбу — она опустеет. ${D().economy.drain.hp} HP и ход. В тупике — даром.`;
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

  async function animPour(ev) {
    const aw = tubeEl(ev.from), bw = tubeEl(ev.to);
    if (!aw || !bw) { renderTubes(ev.tubes); return; }
    const moving = [...aw.querySelectorAll('.bt-layer')].slice(-ev.n);
    const bLiq = bw.querySelector('.bt-liq').getBoundingClientRect();
    const bLen = bw.querySelectorAll('.bt-layer').length;
    const dir = Fx.centerOf(bw).x > Fx.centerOf(aw).x ? 1 : -1;
    aw.style.setProperty('--tilt', dir * 20 + 'deg');
    aw.classList.add('pouring');
    Snd.play('pour');
    await sleep(100);
    const fx = document.getElementById('fx'), lh = S.lh || 24;
    const all = moving.map((L, k) => {
      const r = L.getBoundingClientRect(), g = L.cloneNode(true);
      g.classList.add('bt-ghost');
      g.classList.remove('top', 'drop', 'splash');
      Object.assign(g.style, { width: r.width + 'px', height: r.height + 'px', animationDelay: '' });
      fx.appendChild(g);
      L.style.visibility = 'hidden';
      const tx = bLiq.left + (bLiq.width - r.width) / 2;
      const ty = ev.swallow ? bLiq.bottom - lh : bLiq.bottom - (bLen + k + 1) * lh;
      const peak = Math.min(r.top, ty) - 46, d = 250 + k * 40;
      const an = g.animate([
        { transform: `translate(${r.left}px, ${r.top}px)` },
        { transform: `translate(${(r.left + tx) / 2}px, ${peak}px) scaleX(.8)`, offset: .5 },
        { transform: `translate(${tx}px, ${ty}px)`, opacity: ev.swallow ? 0 : 1 },
      ], { duration: d, easing: 'ease-in-out' });
      return Fx.settle(an, d).then(() => g.remove());
    });
    await Promise.all(all);
    aw.classList.remove('pouring');
    renderTubes(ev.tubes, { splash: { tube: ev.to, n: ev.n } });
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
      if (ev.boss) { Fx.bigPop(ev.final ? 'Босс!' : `Босс · встреча ${ev.encounter + 1}`, '#ff9a8a'); Snd.play('hurt'); return 900; }
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
      if (ev.cascade) Fx.bigPop('Каскад!');
      await sleep(280);
    },
    combo(ev) {
      S.vm.combo = ev.step + 1;
      renderCombo();
      Fx.bigPop('Комбо ×' + kfmt(ev.k));
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
      } else if (ev.kind === 'poison') { Snd.play('poison'); hitNum(monEl(), `☠ ${ev.value}×${ev.turns}`, '#a6e35a'); renderChips(); }
      else if (ev.kind === 'freeze') { Snd.play('freeze'); vm.frozen = ev.value; renderEnemyBars(); renderIntent(); }
      else if (ev.kind === 'delay') { Snd.play('zap'); vm.timer += ev.value; renderIntent(); hitNum($('.bt-intent'), '⚡+' + ev.value, '#ffe36a'); }
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
        const why = { sieve: 'Сито', catalyst: 'Катализатор', lucky_clover: '🍀 Клевер', philosopher_stone: '💠 Камень', dead_end: 'Тупик' }[ev.reason] || '';
        hitNum($('.bt-field'), `Ход бесплатно${why ? ' · ' + why : ''}`, '#ffe08a');
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
          if (ev.target) hitNum($('.bt-field'), `${iconOf(ev.target.a)} ⇄ ${iconOf(ev.target.b)}`, '#ffe08a', true);
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
    rage() { S.vm.rage = true; renderMonster(false); renderEnemyBars(); renderIntent(); Fx.bigPop('Ярость!', '#ff7a6b'); Snd.play('hurt'); Fx.shake($('.bt-arena'), 8); return 800; },
    dead_end() { Fx.animClass($('.bt-drain'), 'wiggle', 320); Snd.play('bad'); return 100; },
    async drain(ev) {
      S.mode = null;
      Snd.play('pour');
      await animDrainTube(ev.tube);
      renderTubes(ev.tubes, ev.refilled ? { drop: ev.tube } : null);
      renderBelt();
      if (ev.free) hitNum($('.bt-drain'), 'даром', '#ffe08a');
      await sleep(200);
    },
    potion(ev) {
      const p = UI.item('potions', ev.id);
      renderBelt();
      Snd.play('buy');
      hitNum($('.bt-belt'), p.icon, '#fff', true);
      if (ev.id === 'undo') { renderAll(); Fx.bigPop('↶ Отмена'); return 500; }
      if (ev.tubes) renderTubes(ev.tubes, ev.id === 'shake' || ev.id === 'flask' ? { drop: ev.tube } : null);
      if (ev.id === 'flask') fit();
      if (ev.id === 'sleep') { S.vm.timer += D().potions.sleep.delay; renderIntent(); hitNum($('.bt-intent'), '💤 +' + D().potions.sleep.delay, '#c9d6ff'); }
      if (ev.id === 'combo') Fx.bigPop('✨ Следующее — ×2');
      if (ev.id === 'firebomb') S.flyFrom = null;
      return 300;
    },
    relic(ev) { const r = UI.item('relics', ev.id); hitNum($('.bt-player'), r.icon, '#ffcb4f', true); return 150; },
    twist(ev) {
      if (ev.tubes) renderTubes(ev.tubes);
      if (ev.twist === 'stonefall') { Snd.play('stone'); UI.toast('🪨 Камнепад: камень упал в колбу'); return 400; }
      if (ev.twist === 'burn') { hitNum($('.bt-player'), `🔥 Поджог ${ev.dmg}×${ev.turns}`, '#ff9a5a'); renderChips(); return 300; }
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
    stage_clear() { if (S.R.phase !== 'won') Fx.bigPop('Этап пройден!'); return 500; },
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
      UI.toast(`Найдено зелье: ${p.icon} ${p.name}`);
      return 400;
    },
    revived() {
      syncVm(); renderPlayer();
      Fx.bigPop('Воскрешение!');
      Snd.play('heal');
      Fx.burstAt($('.bt-player'), '#8af0a0', 22, 80);
      return 700;
    },
  };

  function track(evs) {
    const now = UI.now(), T = (e, d) => PS.Meta.track(e, d, now);
    evs.forEach(e => {
      switch (e.type) {
        case 'close': T('close', { color: e.color, junk: !!e.junk }); break;
        case 'combo': T('combo', { k: e.k }); break;
        case 'potion': T('potion'); break;
        case 'kill': T('kill'); break;
        case 'boss_reach': T('boss_reach'); break;
        case 'stage_clear': T('stage'); break;
      }
    });
  }

  function save() { PS.Meta.profile.activeRun = S.R; UI.save(); }

  function play(evs) {
    const token = S;
    token.busy = true;
    token.el.classList.add('locked');
    prepare(evs);
    const T = Tut();
    if (T) T.onEvents(evs);
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
    const T = Tut();
    if (T) await T.flush();
    if (S !== token || token.dead) return;
    const R = S.R;
    if (R.phase === 'battle') {
      S.busy = false;
      S.el.classList.remove('locked');
      if (T) setTimeout(() => { if (S === token && !token.dead && !token.busy) T.idle(); }, 0);
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
    const T = Tut();
    if (T) T.onAction(a, evs);
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
    const T = Tut();
    if (T && !T.allowTube(i)) { wiggle(i); return; }
    const R = S.R, F = R.battle.field, t = F.tubes[i];
    if (S.mode) {
      const a = S.mode.type === 'drain' ? { type: 'drain', tube: i } : { type: 'potion', idx: S.mode.idx, tube: i };
      if (!doAct(a)) { wiggle(i); Snd.play('bad'); }
      return;
    }
    if (S.sel == null) {
      if (!t.layers.length || t.frozen) { wiggle(i); Snd.play('bad'); return; }
      S.sel = i; Snd.play('select'); refreshSel();
      if (T) T.onSelect(i);
      return;
    }
    if (S.sel === i) { S.sel = null; refreshSel(); if (T) T.onSelect(null); return; }
    if (doAct({ type: 'pour', from: S.sel, to: i })) return;
    Snd.play('bad');
    if (t.layers.length && !t.frozen && !(T && T.locked())) { wiggle(S.sel); S.sel = i; refreshSel(); }
    else wiggle(i);
  }

  function onPotion(idx) {
    if (!S || S.busy || !inBattle()) return;
    const T = Tut();
    if (T && T.locked()) return;
    const B = S.R.battle, id = B.potions[idx];
    if (!id) return;
    S.sel = null;
    if (TUBE_POTIONS[id]) {
      const same = S.mode && S.mode.type === 'potion' && S.mode.idx === idx;
      S.mode = same ? null : { type: 'potion', idx };
      Snd.play('select');
      renderBelt(); refreshSel();
      if (S.mode) UI.toast(`${UI.item('potions', id).icon} Выбери колбу`);
      return;
    }
    const a = { type: 'potion', idx };
    if (!doAct(a)) {
      Snd.play('bad');
      Fx.animClass(S.el.querySelector(`[data-pot="${idx}"]`), 'wiggle', 320);
      UI.toast(id === 'undo' ? 'Нечего отменять' : id === 'combo' ? 'Эликсир уже действует' : 'Сейчас нельзя');
    }
  }

  function onDrain() {
    if (!S || S.busy || !inBattle()) return;
    const T = Tut();
    if (T && T.locked()) return;
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
        icon = m.icon; name = m.name; desc = m.desc; tags = '<span class="tag tag-bonus">Бонус</span>';
        if (have && m.cap) side = `<span class="stack-n">${have + 1}/${m.cap}</span>`;
        break;
      }
      case 'find': {
        const f = it('finds', o.id);
        icon = f.icon; name = f.name; desc = f.desc; tags = '<span class="tag tag-find">Находка</span>';
        if (o.color) {
          const c = D().colors[o.color];
          icon = c.icon;
          if (o.id === 'new_color') { name = `${f.name}: ${c.name}`; desc = c.desc; }
          else {
            const lvl = R.deck[o.color] || 0, key = Object.keys(c.boost || {})[0];
            name = `Усиление: ${c.name}`;
            desc = `${c.name} +${c.boost[key]} (шаг ${lvl + 1}/${f.cap || 3}). Сейчас: ${colorValue(o.color)}.`;
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
      case 'potion': { const p = it('potions', o.id); icon = p.icon; name = p.name; desc = p.desc; tags = '<span class="tag">Зелье</span>'; break; }
      case 'coins': icon = '🪙'; name = `${o.v} монет`; desc = 'Подходящих наград не осталось — возьми монеты.'; break;
      case 'color': {
        const c = D().colors[o.id], lvl = R.deck[o.id] || 0;
        icon = c.icon; name = c.name; desc = lvl ? `Усиления (${lvl}) пропадут.` : 'Без усилений.';
        break;
      }
      case 'tube': { const t = D().tubes[o.id]; icon = t.icon; name = `Слот ${o.slot + 1}: ${t.name}`; desc = t.desc; break; }
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
      pick: ['Выбери бонус', 'Действует до конца острова'],
      relic: ['Реликвия босса', 'Сильный пассивный эффект до конца острова'],
      potion_pick: ['Выбери зелье', 'Зелье ляжет в пояс'],
      replace_color: ['Колода полна', pend ? `Какой цвет заменить на ${D().colors[pend].icon} ${esc(D().colors[pend].name)}?` : 'Какой цвет заменить?'],
      replace_tube: ['Слоты заняты', pend ? `Какую колбу заменить на ${D().tubes[pend].icon} ${esc(D().tubes[pend].name)}?` : 'Какую колбу заменить?'],
    };
    const [title, subt] = titles[off.kind] || ['Выбор', ''];
    const price = PS.Run.rerollPrice(R);
    const skipV = sub ? 0 : PS.U.round(PS.U.lin(D().economy.skip, R.island) * PS.Run.coinMult(R));
    const html = `<h2 class="ov-title">${title}</h2><p class="ov-text">${subt}</p>
      ${sub ? '' : `<div class="bt-ov-hp"><span>❤️</span><div class="bar bar-hp"><div class="bar-fill" style="width:${R.hp / R.maxHp * 100}%"></div><span class="bar-label">${R.hp} / ${R.maxHp}</span></div></div>`}
      <div class="cards">${off.options.map((o, i) => cardHtml(o, i, off)).join('')}</div>
      <div class="ov-actions">${sub ? '' : `<button class="btn btn-gem" data-a="reroll">Переброс 💎${price}</button>`}
        <button class="btn btn-ghost" data-a="skip">${sub ? 'Отмена' : `Пропустить +${skipV} 🪙`}</button></div>`;
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
        if (!PS.Meta.spendGems(price)) { Snd.play('bad'); UI.toast(`Не хватает 💎 — нужно ${price}`); return; }
        done = true;
        close(); S.ov = null;
        Snd.play('gem');
        const evs = PS.Run.reroll(R);
        save();
        showOffer();
      };
    }
    const T = Tut();
    if (T) {
      if (off.kind === 'pick' && T.guided()) T.once('pick', { target: card.querySelector('.cards'), title: 'Выбор после этапа', text: 'Возьми один бонус: он действует до конца острова. Бонус — модификатор, Находка — меняет колоду или колбы. Долгое нажатие — подробности.', hand: false });
      if (off.kind === 'relic') T.once('relic', { target: card.querySelector('.cards'), title: 'Реликвия', text: 'После встречи с боссом — реликвия: сильный эффект до конца острова. Рамка показывает редкость.', hand: false });
    }
  }

  function showRevive() {
    const R = S.R, o = PS.Run.reviveOptions(R), now = UI.now();
    const seal = PS.Meta.sealActive(now);
    const gems = PS.Meta.profile.gems;
    const freeBtn = !o.free ? '' : seal
      ? '<button class="btn btn-cta" data-a="free">🔱 Воскреснуть бесплатно</button>'
      : `<button class="btn btn-green btn-ad" data-a="free" ${UI.ads.online ? '' : 'disabled'}>${UI.ads.online ? 'Воскреснуть за рекламу' : 'Реклама недоступна'}</button>`;
    const html = `<div class="ov-hero">💀</div><h2 class="ov-title">Ты пал!</h2>
      <p class="ov-text">${o.free ? `Воскресни с ${Math.round(D().economy.revive.hp * 100)}% HP — поле останется как было. Воскрешение — одно за попытку.` : 'Воскрешение в этой попытке уже использовано.'}</p>
      <div class="ov-actions col">${freeBtn}
        ${o.gemsPrice != null ? `<button class="btn btn-gem${gems < o.gemsPrice ? ' disabled' : ''}" data-a="gems">Воскреснуть 💎${o.gemsPrice}</button>` : ''}
        <button class="btn ${o.free ? 'btn-ghost' : 'btn-cta'}" data-a="giveup">${o.free ? 'Сдаться' : 'К итогам'}</button></div>
      ${seal || !o.free ? '' : '<button class="bt-seal-link" data-a="seal">🔱 С Печатью алхимика — без рекламы</button>'}`;
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
      if (!PS.Meta.spendGems(o.gemsPrice)) { Snd.play('bad'); UI.toast(`Не хватает 💎 — нужно ${o.gemsPrice}`); return; }
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
    const T = Tut();
    if (T) T.once('revive', { target: card, title: 'Воскрешение', text: 'Можно вернуться в бой один раз за попытку — за рекламу или за кристаллы. Или сдаться — монеты за попытку останутся.', hand: false });
  }

  const RULES = [
    ['🧪', 'Переливание', '<p>Тапни колбу, затем куда лить. Льётся весь верхний одноцветный блок — <b>на такой же цвет</b> или <b>в пустую колбу</b>.</p><p>Каждое переливание — ход.</p>'],
    ['✨', 'Закрытие', '<p>Колба, полная одного цвета, <b>закрывается</b>: срабатывает эффект цвета, на её место приходят слои из очереди.</p><p>🔥 огонь — урон · 💧 вода — щит · 🌿 жизнь — лечение. Долгое нажатие на что угодно — подробности.</p>'],
    ['🔥', 'Комбо', '<p>Закрытия ход за ходом растят комбо: <b>×1,5 → ×2 → ×3</b>. Ход без закрытия его сбрасывает.</p><p>Если новые слои сами закрыли колбу — <b>каскад</b>, без траты хода.</p>'],
    ['⚔️', 'Враг', '<p>Над врагом — его следующее действие и <b>через сколько ходов</b> оно наступит. Щит поглощает урон и сгорает после атаки.</p><p>Побитый босс может убежать и вернуться на следующей встрече с половиной здоровья. На последнем этапе острова он бьётся до конца.</p>'],
    ['🪨', 'Мусор', '<p>🪨 Камень и 🫧 слизь льются только на такой же мусор или в пустую колбу.</p><p>Закрытие соседней колбы разбивает камни. Полная колба слизи даёт щит.</p>'],
    ['🚰', 'Слив и зелья', '<p><b>Слить</b> — нажми кнопку, затем колбу: она опустеет за 3 HP и ход. В <b>тупике</b> — даром.</p><p>Зелья на поясе — тап, чтобы выпить. Некоторые просят выбрать колбу.</p>'],
  ];
  function showRules() {
    let i = 0;
    const close = UI.overlay('<div class="bt-rules-host"></div>', { cls: 'bt-ov' });
    const host = close.card.querySelector('.bt-rules-host');
    const draw = () => {
      const r = RULES[i];
      host.innerHTML = `<div class="bt-rules"><div class="r-ico">${r[0]}</div><h2 class="ov-title">${r[1]}</h2>${r[2]}</div>
        <div class="bt-rules-nav"><button class="btn btn-ghost btn-sm" data-n="-1" ${i ? '' : 'disabled'}>‹ Назад</button><span class="small dim">${i + 1} / ${RULES.length}</span>
        ${i < RULES.length - 1 ? '<button class="btn btn-sm" data-n="1">Дальше ›</button>' : '<button class="btn btn-cta btn-sm" data-close>Понятно</button>'}</div>`;
      host.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { Snd.play('select'); i = Math.max(0, Math.min(RULES.length - 1, i + +b.dataset.n)); draw(); });
    };
    draw();
  }

  function showPause() {
    if (S.busy) return;
    const R = S.R;
    UI.overlay(`<h2 class="ov-title">Пауза</h2><p class="ov-text">Остров ${R.island} · этап ${R.stage + 1}</p><div class="ov-actions col">
      <button class="btn btn-cta" data-close>Продолжить</button>
      <button class="btn" data-close="rules">📖 Как играть</button>
      <button class="btn" data-close="settings">⚙ Настройки</button>
      <button class="btn btn-ghost" data-close="main">На главный</button></div>
      <p class="tiny dim" style="margin-top:10px">Попытка сохранится — можно продолжить позже.</p>`, { cls: 'bt-ov', onClose: v => {
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
      const cd = d.colors[c], lvl = R.deck[c];
      return itemTile(cd.icon, cd.name + (lvl ? ` +${lvl}` : ''), esc(colorValue(c)), `<b>${cd.name}</b>${lvl ? ` · усиление ${lvl}` : ''}<br>${cd.desc}`);
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
    UI.overlay(`<button class="btn-icon ov-x" data-close>✕</button><h2 class="ov-title">🎒 Сборка</h2>
      <div class="tiny dim center">Долгое нажатие — подробности</div>
      <div class="bt-sec">Цвета</div><div class="bt-items">${deck}</div>
      <div class="bt-sec">Бонусы</div>${mods || finds ? `<div class="bt-items">${mods}${finds}</div>` : empty('Пока нет — бери их после этапов.')}
      <div class="bt-sec">Реликвии</div>${relics ? `<div class="bt-items">${relics}</div>` : empty('Реликвии дают за встречи с боссом.')}
      <div class="bt-sec">Пустые колбы</div><div class="bt-items">${tubes}</div>
      <div class="bt-sec">Зелья · ${beltList().length}/${R.beltSize}</div>${pots ? `<div class="bt-items">${pots}</div>` : empty('Пояс пуст.')}`, { cls: 'sheet bt-build' });
  }

  // ---------- debug ----------
  // Run has no "win now" hook, so the win goes through a real action: a free firebomb against a 1-HP enemy.
  // That keeps Run.endBattle (coins, offers, boss flee/kill, island end) on its normal path.
  function debugWin() {
    if (!S || S.dead) return;
    if (S.busy) { UI.play([], { done: () => { setTimeout(debugWin, 0); } }); return; }
    const R = S.R, B = R.battle;
    if (R.phase !== 'battle' || !B || B.status !== 'active') { UI.toast('Сейчас нет боя'); return; }
    const T = Tut();
    if (T) T.hide();
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
      const T = Tut();
      if (T) T.attach({ R, el, tubeEl, getSel: () => (S ? S.sel : null) });
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
      const T = Tut();
      if (T) T.detach();
      if (UI.debug && UI.debug.onWin === debugWin) UI.debug.onWin = null;
    },
  });
})();
