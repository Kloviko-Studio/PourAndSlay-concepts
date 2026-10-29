var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (s, k) => parseFloat(s[k]) || 0;

  // The fill counts cleared encounters. The label names the encounter being played.
  function progress(island, current, total, bossAt, crown) {
    total = Math.max(1, Math.floor(Number(total) || 1));
    current = clamp(Math.floor(Number(current) || 1), 1, total);
    const cleared = current - 1, en = PS.T.lang() === 'en';
    const label = `${en ? 'Island' : 'Остров'} ${island} · ${current} / ${total}`;
    const marks = [...new Set(bossAt || [])].filter(n => Number.isInteger(n) && n > 0 && n <= total);
    const tip = marks.map(n => `${en ? 'Boss' : 'Босс'}: ${n}`).join(' · ');
    return `<div class="bt-stage-lbl"><span class="bt-stage-island">${en ? 'Island' : 'Остров'} ${island}</span><span> · ${current} / ${total}</span></div><div class="bt-sbar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${cleared}" aria-valuetext="${en ? 'Cleared' : 'Пройдено'} ${cleared} / ${total}" data-tip="${tip}"><div class="bt-sbar-track"><i class="bt-sbar-fill" style="width:${cleared / total * 100}%"></i>${marks.map(n => `<span aria-hidden="true" class="bt-sbar-boss${n < current ? ' passed' : ''}${n === current ? ' current' : ''}" style="left:${n / total * 100}%">${crown}</span>`).join('')}</div></div>`;
  }

  // Only presentation changes. Tube indices, the two rows, capacities and game state remain intact.
  function fit(el, tubes, rows, previousLh) {
    if (!el || !el.isConnected || el.querySelector('.bt-tw.pouring')) return previousLh;
    const field = el.querySelector('.bt-field'), arena = el.querySelector('.bt-arena');
    if (!field || !arena) return previousLh;
    const used = rows.filter(r => r.length), fc = getComputedStyle(field);
    const available = Math.max(44, field.clientWidth - num(fc, 'paddingLeft') - num(fc, 'paddingRight'));
    const gap = 4;
    const metrics = tubes.map((t, i) => {
      const w = el.querySelector(`.bt-tw[data-i="${i}"]`);
      const cs = w && getComputedStyle(w);
      const p = k => cs ? parseFloat(cs.getPropertyValue(k)) || 0 : 0;
      return { w, gw: p('--gw') || 212, gl: p('--gl'), gr: p('--gr'), gt: p('--gt') || 67, gb: p('--gb') || 33 };
    });
    const footprint = (i, body) => Math.max(44, Math.ceil(body * (1 + (metrics[i].gl + metrics[i].gr) / metrics[i].gw) + 4));
    const rowWidth = (r, body) => r.reduce((s, i) => s + footprint(i, body), 0) + gap * Math.max(0, r.length - 1);
    let lo = 30, hi = 58;
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      if (used.every(r => rowWidth(r, mid) <= available)) lo = mid; else hi = mid;
    }
    const body = Math.floor(lo * 10) / 10;
    el.style.setProperty('--tube-w', body + 'px');
    metrics.forEach((m, i) => { if (m.w) m.w.style.setProperty('--tube-hit', footprint(i, body) + 'px'); });
    const overflowX = used.some(r => rowWidth(r, body) > available + 1);
    el.classList.toggle('bt-field-wide', overflowX);
    field.setAttribute('tabindex', '0');
    field.setAttribute('aria-label', PS.T('Поле колб', 'Tube field'));
    const totalCap = used.reduce((s, r) => s + Math.max(...r.map(i => tubes[i].cap)), 0) || 8;
    const overhead = num(fc, 'paddingTop') + num(fc, 'paddingBottom') + num(fc, 'rowGap') * Math.max(0, used.length - 1)
      + used.reduce((sum, r) => sum + Math.max(...r.map(i => (metrics[i].gt + metrics[i].gb) * body / metrics[i].gw + 4)), 0);
    const scene = el.querySelector('.bt-scene'), ground = el.querySelector('.bt-ground'), gc = getComputedStyle(ground);
    const fixed = scene.offsetHeight - arena.offsetHeight + num(gc, 'paddingTop') + num(gc, 'paddingBottom')
      + num(gc, 'rowGap') * 2 + el.querySelector('.bt-player').offsetHeight + el.querySelector('.bt-bottom').offsetHeight;
    const height = el.clientHeight;
    const desiredArena = clamp(height * .255, 96, 226);
    // First reduce scenery; keep liquid layers >= 18px whenever the viewport permits it.
    let arenaH = Math.floor(clamp(height - fixed - overhead - totalCap * 18, height < 460 ? 0 : 48, desiredArena));
    // Once the layers already reach their 30px cap the field has nothing to do with more height, so the enemy gets it.
    const spare = height - fixed - overhead - totalCap * 30 - arenaH;
    if (spare > 0) arenaH = Math.floor(Math.min(arenaH + spare, clamp(height * .34, 96, 300)));
    el.style.setProperty('--arena-h', arenaH + 'px');
    el.classList.toggle('bt-scenery-hidden', arenaH < 36);
    const lh = Math.floor(clamp((field.clientHeight - overhead) / totalCap, 16, 30));
    el.style.setProperty('--lh', lh + 'px');
    el.dataset.fieldScroll = overflowX || overhead + totalCap * lh > field.clientHeight + 1 ? 'true' : 'false';
    return lh;
  }

  function watch(el, callback) {
    let frame = 0, dead = false;
    const schedule = () => {
      if (!dead && !frame) frame = requestAnimationFrame(() => { frame = 0; if (!dead) callback(); });
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (ro) ['.bt-scene', '.bt-bottom'].forEach(s => { const n = el.querySelector(s); if (n) ro.observe(n); });
    if (ro) ro.observe(el);
    window.addEventListener('resize', schedule);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    document.fonts && document.fonts.ready.then(schedule);
    el.querySelectorAll('img').forEach(img => { if (!img.complete) img.addEventListener('load', schedule, { once: true }); });
    return () => {
      dead = true; if (frame) cancelAnimationFrame(frame); if (ro) ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', schedule);
    };
  }
  // Keep the real animated node (not a screenshot clone) above the scrolling board.
  // A silent placeholder retains its exact row position until the animation ends.
  function floatTube(el, tube) {
    const r = tube.getBoundingClientRect(), base = el.getBoundingClientRect();
    const lift = new DOMMatrix(getComputedStyle(tube).transform).m42;
    const previous = tube.style.cssText;
    const placeholder = tube.cloneNode(false);
    placeholder.removeAttribute('data-i'); placeholder.removeAttribute('data-tip');
    placeholder.className = 'bt-tw bt-pour-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.cssText = previous;
    Object.assign(placeholder.style, { visibility: 'hidden', width: r.width + 'px', height: r.height + 'px', transform: 'none' });
    tube.before(placeholder);
    const layer = document.createElement('div');
    layer.className = 'bt-pour-layer'; el.appendChild(layer); layer.appendChild(tube);
    Object.assign(tube.style, { position: 'absolute', left: r.left - base.left + 'px', top: r.top - base.top - lift + 'px', width: r.width + 'px' });
    let restored = false;
    return () => {
      if (restored) return; restored = true;
      if (placeholder.parentNode) placeholder.replaceWith(tube);
      tube.style.cssText = previous; tube.classList.remove('pouring'); layer.remove();
    };
  }
  PS.BattleLayout = { progress, fit, watch, floatTube };
})();
