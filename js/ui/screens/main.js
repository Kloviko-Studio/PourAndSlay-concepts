var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;
  const T = PS.T;
  const TIER = { easy: T('Лёгкий', 'Easy'), medium: T('Средний', 'Medium'), hard: T('Сложный', 'Hard') };
  // Hand-drawn islands on a transparent background; islands past this use the generated SVG.
  const ISLAND_IMGS = 10;
  // Drifting clouds: picture, top (% of the screen), width (px), seconds per pass, opacity.
  const CLOUDS = [
    [1, 9, 170, 140, .95], [4, 21, 210, 190, .8], [2, 34, 130, 120, .7],
    [6, 50, 230, 210, .55], [3, 64, 150, 160, .6], [5, 80, 190, 175, .75],
  ];
  // Night-sky stars: picture, left / top (% of the screen), size (px).
  const STARS = [
    [1, 8, 6, 18], [2, 27, 13, 12], [4, 46, 4, 10], [3, 64, 10, 16], [2, 86, 7, 14],
    [4, 15, 24, 11], [1, 78, 22, 13], [2, 5, 38, 9], [3, 92, 36, 12], [4, 34, 30, 8],
    [2, 58, 27, 10], [1, 22, 50, 10], [4, 88, 52, 9], [3, 70, 44, 8],
  ];
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

  function renderInfo() {
    const n = idx + 1, card = root.querySelector('.isl-card'), act = root.querySelector('.main-actions'), head = root.querySelector('.isl-head'), side = root.querySelector('.side-wrap');
    const soon = n > total();
    const p = P();
    const nav = (label, inner) => `<div class="isl-row"><button class="isl-nav" data-a="prev" aria-label="${T('Предыдущий остров', 'Previous island')}"${idx <= 0 ? ' disabled' : ''}>${UI.ico.left}</button>
      <span class="lft">${label}</span><button class="isl-nav" data-a="next" aria-label="${T('Следующий остров', 'Next island')}"${idx >= total() ? ' disabled' : ''}>${UI.ico.right}</button></div>${inner}`;
    if (soon) {
      UI.setTheme('night');
      head.innerHTML = `<h2 class="isl-name">${T('Новые острова', 'New islands')}</h2><div class="isl-meta">${T('Скоро', 'Coming soon')}</div>`;
      card.innerHTML = nav(T('Скоро', 'Coming soon'), `<div class="isl-soon">${T('Готовим следующие миры. Пока прокачай Лабораторию и побей свои рекорды!', 'New worlds are brewing. Meanwhile, upgrade your Lab and beat your best!')}</div>`);
      side.innerHTML = sideBtns();
      act.innerHTML = `<div class="main-locked">${T('Скоро новые острова', 'New islands coming soon')}</div>`;
    } else {
      const isl = UI.island(n), w = UI.world(n) || {}, st = islandState(n);
      UI.setTheme(w.theme === 'night' ? 'night' : 'day', w.palette);
      const tags = [];
      if (st.cleared) tags.push(`<span class="tag tag-ok">✓ ${T('Пройден', 'Cleared')}</span>`);
      if (isl.final) tags.push(`<span class="tag tag-hard">👑 ${T('Финал', 'Finale')}</span>`);
      const R = p.activeRun;
      const cur = st.runHere ? (R.stage || 0) + 1 : 0;
      head.innerHTML = `
        <h2 class="isl-name">${st.locked ? T('Остров закрыт', 'Island locked') : esc(isl.name)}</h2>
        <div class="isl-meta">${esc(w.name || '')}</div>`;
      const tier = isl.tier === 'hard' ? 'hard' : isl.tier === 'medium' ? 'gold' : 'ok';
      card.innerHTML = nav(`<span class="tag tag-${tier}">${TIER[isl.tier] || TIER.easy}</span>${T('Остров', 'Island')} ${n}`,
        `${UI.stageBar({ n, best: st.locked ? 0 : st.best, current: cur })}<div class="isl-tags">${st.locked ? '' : tags.join('')}</div>`);

      let main;
      if (st.locked) main = `<div class="main-locked">🔒 ${T(`Пройди остров ${n - 1}`, `Clear island ${n - 1}`)}</div>`;
      else if (st.runHere) main = `<button class="btn btn-cta main-cta" data-a="continue"><span class="stack">${T('Продолжить', 'Continue')}<span class="sub">${T(`этап ${cur} из ${isl.stages}`, `stage ${cur} of ${isl.stages}`)}</span></span></button>`;
      else main = `<button class="btn btn-cta main-cta" data-a="play">${st.cleared ? T('Перепройти', 'Replay') : T('Играть', 'Play')}</button>`;
      side.innerHTML = sideBtns();
      act.innerHTML = main;
    }
    bindActions();
    layout();
  }

  // Centres the island in the free sky between the title and the card.
  function layout() {
    if (!root) return;
    const view = root.querySelector('.isl-view'), v = view.getBoundingClientRect();
    if (!v.height) return;
    const top = root.querySelector('.isl-head').getBoundingClientRect().bottom - v.top + 12;
    const bot = root.querySelector('.isl-card').getBoundingClientRect().top - v.top - 12;
    view.style.setProperty('--gap-t', top + 'px');
    view.style.setProperty('--gap-b', v.height - bot + 'px');
  }

  function sky() {
    // Negative delays start each cloud mid-pass, so the sky is already full when the menu opens.
    const clouds = CLOUDS.map(([k, top, w, dur, op], i) =>
      `<div class="cloud-lane" style="top:${top}%;animation-duration:${dur}s;animation-delay:${-dur * ((i * 0.37 + 0.15) % 1)}s"><img class="cloud" src="img/sky/cloud_${k}.png" style="width:${w}px;--op:${op}" alt="" draggable="false"></div>`).join('');
    const stars = STARS.map(([k, x, y, w], i) =>
      `<img class="star" src="img/sky/star_0${k}.png" style="left:${x}%;top:${y}%;width:${w}px;animation-duration:${2.4 + (i * 0.7) % 2.2}s;animation-delay:${-(i * 0.9) % 3}s" alt="" draggable="false">`).join('');
    return `<div class="main-sky" aria-hidden="true"><div class="sky-day"></div><div class="sky-night">${stars}</div>${clouds}</div>`;
  }

  function sideBtns() {
    const now = UI.now();
    const d = PS.Meta.daily(now);
    const qs = PS.Meta.quests(now);
    const left = qs.filter(q => !q.done).length;
    const claimable = qs.filter(q => q.done && !q.claimed).length;
    const total = qs.length;
    return `<button class="side-btn gift" data-a="daily" aria-label="${T('Подарок дня', 'Daily Gift')}${d.canClaim ? T(', есть награда', ', reward ready') : ''}">${UI.ico.gift}<span class="sl">${T('Подарок', 'Gift')}</span>${d.canClaim ? '<span class="badge"></span>' : ''}</button>
      <button class="side-btn quest" data-a="quests" aria-label="${T(`Задания, выполнено ${total - left} из ${total}`, `Quests, ${total - left} of ${total} done`)}">${UI.ico.quests}<span class="sl">${total - left} / ${total}</span>${claimable ? '<span class="badge"></span>' : ''}</button>`;
  }

  function bindActions() {
    const n = idx + 1;
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'prev' || a === 'next') { setIdx(idx + (a === 'next' ? 1 : -1), true); return; }
      PS.Snd.play('select');
      if (a === 'daily') UI.go('daily');
      else if (a === 'quests') UI.go('quests');
      else if (a === 'continue') UI.continueRun();
      else if (a === 'play') {
        const st = islandState(n);
        if (st.runElsewhere) {
          const R = P().activeRun;
          const ok = await UI.confirm(T('Начать здесь?', 'Start here?'), T(`Идёт забег на острове ${R.island}. Начать здесь — сдаться там. Монеты сохранятся.`, `You have a run on island ${R.island}. Starting here gives it up. You keep the coins.`), T('Начать здесь', 'Start here'), T('Отмена', 'Cancel'));
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
    UI.overlay(`<div class="ov-hero">🎁</div><h2 class="ov-title">${T('Стартовый набор', 'Starter Pack')}</h2>
      <p class="ov-text">${T('Только 48 часов:', '48 hours only:')} <b class="c-gem">${prod.gems || 150} 💎</b> ${T('и', 'and')} <b class="c-gold">${prod.coins || 600} 🪙</b></p>
      <div class="ov-actions"><button class="btn btn-ghost" data-close>${T('Позже', 'Later')}</button><button class="btn btn-cta" data-close="buy">${esc(prod.price || T('Купить', 'Buy'))}</button></div>`,
    { onClose: v => {
      if (v !== 'buy') return;
      if (PS.Meta.buy('starter', UI.now())) { PS.Snd.play('buy'); UI.toast(T('Набор получен!', 'Pack claimed!')); UI.topbar(); }
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
        slides += `<div class="isl-slide${locked ? ' locked' : ''}">${n <= ISLAND_IMGS ? `<img class="isl-img" src="img/islands/island_${n}.png" alt="${esc(UI.island(n).name)}" draggable="false">` : `<div class="isl-art">${UI.islandArt(n)}</div>`}<div class="isl-lock">${UI.ico.lock}</div></div>`;
      }
      slides += '<div class="isl-slide soon"><div class="isl-art">☁️</div></div>';
      el.innerHTML = `${sky()}
        <div class="isl-view"><div class="isl-track">${slides}</div></div>
        <div class="isl-head"></div>
        <div class="side-wrap"></div>
        <div class="spacer"></div>
        <div class="isl-card"></div>
        <div class="main-actions"></div>`;
      bindSwipe(el.querySelector('.isl-view'));
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', layout);
      if (document.fonts) document.fonts.ready.then(layout);
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
            PS.Fx.bigPop(T(`Открыт остров ${idx + 1}!`, `Island ${idx + 1} unlocked!`));
            setTimeout(() => { if (root === el && !document.querySelector('.ov')) maybeStarterOffer(UI.now()); }, 1400);
          }, 450);
        }, 350);
      } else maybeStarterOffer(UI.now());
    },
    unmount() { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', layout); root = null; },
  });
})();
