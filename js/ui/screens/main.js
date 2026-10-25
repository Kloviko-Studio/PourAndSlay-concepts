var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const TIER = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };
  // Hand-drawn key art (full-screen sky + floating island); islands without one use the generated SVG.
  const ISLAND_IMG = { 1: 'img/island-1.png' };
  let idx = 0, root = null;

  const total = () => UI.islandCount();
  const P = () => PS.Meta.profile;

  function islandState(n) {
    const p = P(), R = p.activeRun;
    return {
      locked: n > p.maxIsland,
      cleared: !!p.cleared[n],
      runHere: !!(R && R.island === n),
      runElsewhere: !!(R && R.island !== n),
      best: p.best[n] || 0,
    };
  }

  function nextUnlockText(n) {
    const list = UI.unlockList(n + 1).filter(u => u.kind !== 'lab');
    if (!list.length) {
      const u = (PS.DATA.unlocks || {})[n + 1];
      return u && u.note ? esc(u.note) : '';
    }
    const order = ['colors', 'tubes', 'relicRarity', 'potions', 'finds', 'mods'];
    list.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    return list.slice(0, 2).map(u => { const l = UI.unlockLabel(u); return `${l.icon} ${esc(l.name)}`; }).join(', ') + (list.length > 2 ? ' и др.' : '');
  }

  function stagesWord(n) { return n + ' ' + PS.U.plural(n, 'этап', 'этапа', 'этапов'); }

  function renderInfo() {
    const n = idx + 1, card = root.querySelector('.isl-card'), act = root.querySelector('.main-actions'), head = root.querySelector('.isl-head'), side = root.querySelector('.side-wrap');
    const soon = n > total();
    const p = P();
    if (soon) {
      UI.setTheme('night');
      head.innerHTML = `<div class="isl-label">Скоро</div><h2 class="isl-name">Новые острова</h2>`;
      card.innerHTML = `<div class="isl-meta" style="text-shadow:none;padding:4px 0 8px">Готовим следующие миры. Пока прокачай Лабораторию и побей свои рекорды!</div>`;
      side.innerHTML = sideBtns();
      act.innerHTML = `<div class="main-locked">Скоро новые острова</div>`;
    } else {
      const isl = UI.island(n), w = UI.world(n) || {}, st = islandState(n);
      UI.setTheme(w.theme === 'night' ? 'night' : 'day', w.palette);
      const tags = [];
      if (st.cleared) tags.push('<span class="tag tag-ok">✓ Пройден</span>');
      if (!st.cleared && !st.locked && n < total()) {
        const t = nextUnlockText(n);
        if (t) tags.push(`<span class="tag tag-gold">Откроется: ${t}</span>`);
      }
      if (isl.final) tags.push('<span class="tag tag-hard">👑 Финал</span>');
      const R = p.activeRun;
      const cur = st.runHere ? (R.stage || 0) + 1 : 0;
      head.innerHTML = `
        <div class="isl-label"><span class="st" aria-hidden="true">★</span>Мир ${isl.world} · Остров ${n}<span class="st" aria-hidden="true">★</span></div>
        <h2 class="isl-name">${st.locked ? 'Остров закрыт' : esc(isl.name)}</h2>
        <div class="isl-meta">${esc(w.name || '')}</div>`;
      const tier = isl.tier === 'hard' ? 'hard' : isl.tier === 'medium' ? 'gold' : 'ok';
      card.innerHTML = `
        <div class="isl-row"><span class="lft"><span class="tag tag-${tier}">${TIER[isl.tier] || TIER.easy}</span>${stagesWord(isl.stages)}</span>
          <span class="rec">${st.best ? 'Рекорд: ' + (st.best >= isl.stages ? 'пройден' : 'этап ' + st.best) : ''}</span></div>
        ${UI.stageBar({ n, best: st.locked ? 0 : st.best, current: cur })}
        <div class="isl-tags">${st.locked ? '' : tags.join('')}</div>`;

      let main;
      if (st.locked) main = `<div class="main-locked">🔒 Пройди остров ${n - 1}</div>`;
      else if (st.runHere) main = `<button class="btn btn-cta main-cta" data-a="continue"><span class="stack">Продолжить<span class="sub">этап ${cur} из ${isl.stages}</span></span></button>`;
      else main = `<button class="btn btn-cta main-cta" data-a="play">${st.cleared ? 'Перепройти' : 'Играть'}</button>`;
      side.innerHTML = sideBtns();
      act.innerHTML = main;
    }
    bindActions();
    const [l, r] = root.querySelectorAll('.isl-arrow');
    l.disabled = idx <= 0;
    r.disabled = idx >= total();
  }

  function sideBtns() {
    const now = UI.now();
    const d = PS.Meta.daily(now);
    const qs = PS.Meta.quests(now);
    const left = qs.filter(q => !q.done).length;
    const claimable = qs.filter(q => q.done && !q.claimed).length;
    const total = qs.length;
    return `<button class="side-btn gift" data-a="daily" aria-label="Подарок дня${d.canClaim ? ', есть награда' : ''}">${UI.ico.gift}<span class="sl">Подарок</span>${d.canClaim ? '<span class="badge"></span>' : ''}</button>
      <button class="side-btn quest" data-a="quests" aria-label="Задания, выполнено ${total - left} из ${total}">${UI.ico.quests}<span class="sl">${total - left} / ${total}</span>${claimable ? '<span class="badge"></span>' : ''}</button>`;
  }

  function bindActions() {
    const n = idx + 1;
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      PS.Snd.play('select');
      if (a === 'daily') UI.go('daily');
      else if (a === 'quests') UI.go('quests');
      else if (a === 'continue') UI.continueRun();
      else if (a === 'play') {
        const st = islandState(n);
        if (st.runElsewhere) {
          const R = P().activeRun;
          const ok = await UI.confirm('Начать здесь?', `Идёт забег на острове ${R.island}. Начать здесь — сдаться там. Монеты сохранятся.`, 'Начать здесь', 'Отмена');
          if (!ok) return;
          UI.go('start', { n, abandon: true });
        } else UI.go('start', { n });
      }
    });
  }

  function setIdx(i, animate) {
    i = Math.max(0, Math.min(total(), i));
    const changed = i !== idx;
    idx = i;
    const track = root.querySelector('.isl-track');
    track.style.transition = animate ? 'transform .35s cubic-bezier(.25,.9,.3,1)' : 'none';
    track.style.transform = `translateX(${-idx * 100}%)`;
    if (changed && animate) PS.Snd.play('swipe');
    renderInfo();
    if (changed && animate) root.querySelector('.isl-card').animate([{ opacity: .3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
  }

  function bindSwipe(view) {
    const track = view.querySelector('.isl-track');
    let x0 = null, y0 = 0, dx = 0, w = 1, horiz = null, id = null;
    view.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; horiz = null; w = view.clientWidth || 1; id = e.pointerId;
      track.style.transition = 'none';
    });
    view.addEventListener('pointermove', e => {
      if (x0 == null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (horiz == null && (Math.abs(dx) > 8 || Math.abs(e.clientY - y0) > 8)) {
        horiz = Math.abs(dx) > Math.abs(e.clientY - y0);
        if (horiz) try { view.setPointerCapture(id); } catch (err) { /* old browsers */ }
      }
      if (!horiz) return;
      // rubber band at the ends
      const edge = (idx === 0 && dx > 0) || (idx === total() && dx < 0);
      track.style.transform = `translateX(calc(${-idx * 100}% + ${edge ? dx / 3 : dx}px))`;
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null;
      if (horiz && Math.abs(dx) > Math.min(60, w * 0.18)) setIdx(idx + (dx < 0 ? 1 : -1), true);
      else setIdx(idx, true);
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
  }

  function onKey(e) {
    if (UI.current() !== 'main' || document.querySelector('.ov')) return;
    if (e.key === 'ArrowLeft') setIdx(idx - 1, true);
    if (e.key === 'ArrowRight') setIdx(idx + 1, true);
  }

  function maybeStarterOffer(now) {
    const p = P();
    p.uiFlags = p.uiFlags || {};
    if (p.uiFlags.starterShown || !PS.Meta.starterAvailable(now)) return;
    p.uiFlags.starterShown = true;
    UI.save();
    const prod = PS.DATA.shop.products.find(x => x.id === 'starter') || {};
    UI.overlay(`<div class="ov-hero">🎁</div><h2 class="ov-title">Стартовый набор</h2>
      <p class="ov-text">Только 48 часов: <b class="c-gem">${prod.gems || 150} 💎</b> и <b class="c-gold">${prod.coins || 600} 🪙</b></p>
      <div class="ov-actions"><button class="btn btn-ghost" data-close>Позже</button><button class="btn btn-cta" data-close="buy">${esc(prod.price || 'Купить')}</button></div>`,
    { onClose: v => {
      if (v !== 'buy') return;
      if (PS.Meta.buy('starter', UI.now())) { PS.Snd.play('buy'); UI.toast('Набор получен!'); UI.topbar(); }
    } });
  }

  UI.screen('main', {
    chrome: { tab: 'main', theme: 'day' },
    mount(el, params) {
      root = el;
      const p = P(), N = total();
      let start = params.n || (p.activeRun ? p.activeRun.island : p.maxIsland);
      idx = Math.max(0, Math.min(N, start - 1));
      let slides = '';
      for (let n = 1; n <= N; n++) {
        const locked = n > p.maxIsland;
        const img = ISLAND_IMG[n];
        slides += `<div class="isl-slide${locked ? ' locked' : ''}">${img ? `<img class="isl-img" src="${img}" alt="${esc(UI.island(n).name)}" draggable="false">` : `<div class="isl-art">${UI.islandArt(n)}</div>`}</div>`;
      }
      slides += '<div class="isl-slide soon"><div class="isl-art">☁️</div></div>';
      el.innerHTML = `
        <div class="isl-view"><div class="isl-track">${slides}</div>
          <button class="isl-arrow l" aria-label="Предыдущий остров">${UI.ico.left}</button><button class="isl-arrow r" aria-label="Следующий остров">${UI.ico.right}</button></div>
        <div class="isl-head"></div>
        <div class="side-wrap"></div>
        <div class="spacer"></div>
        <div class="isl-card"></div>
        <div class="main-actions"></div>`;
      const [l, r] = el.querySelectorAll('.isl-arrow');
      l.onclick = () => setIdx(idx - 1, true);
      r.onclick = () => setIdx(idx + 1, true);
      bindSwipe(el.querySelector('.isl-view'));
      document.addEventListener('keydown', onKey);
      setIdx(idx, false);

      if (params.opened) {
        // "Открыт остров N": slide in from the previous island.
        setIdx(idx - 1, false);
        setTimeout(() => {
          setIdx(idx + 1, true);
          const slide = el.querySelectorAll('.isl-slide')[idx];
          slide.classList.add('locked');
          setTimeout(() => {
            slide.classList.remove('locked');
            slide.querySelector('.isl-art, .isl-img').animate([{ filter: 'brightness(3)' }, { filter: 'none' }], { duration: 700 });
            PS.Snd.play('unlock');
            PS.Fx.confetti(50);
            PS.Fx.bigPop('Открыт остров ' + (idx + 1) + '!');
            setTimeout(() => { if (root === el && !document.querySelector('.ov')) maybeStarterOffer(UI.now()); }, 1400);
          }, 450);
        }, 350);
      } else maybeStarterOffer(UI.now());
    },
    unmount() { document.removeEventListener('keydown', onKey); root = null; },
  });
})();
