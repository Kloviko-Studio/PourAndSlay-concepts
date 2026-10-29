var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const layer = () => document.getElementById('fx');
  function h(cls, html) { const e = document.createElement('div'); e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // Never block game flow on .finished alone: a background tab stops producing frames and the promise would hang forever.
  const settle = (anim, ms) => Promise.race([anim.finished.catch(() => {}), sleep(ms + 80)]);
  function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  const pt = p => (p && p.getBoundingClientRect ? centerOf(p) : p);

  // One ring instead of a particle burst: it marks where something landed without a cloud of nodes to animate.
  function burstAt(el, color) { if (el) burst(centerOf(el).x, centerOf(el).y, color); }
  function burst(x, y, color, n, dist = 50) {
    const s = h('ring');
    const d = Math.max(36, dist * 1.2);
    s.style.width = s.style.height = d + 'px';
    s.style.borderColor = color;
    layer().appendChild(s);
    const at = k => `translate(${x - d / 2}px, ${y - d / 2}px) scale(${k})`;
    const an = s.animate([{ transform: at(.3), opacity: .9 }, { transform: at(1.1), opacity: 0 }], { duration: 380, easing: 'ease-out' });
    settle(an, 380).then(() => s.remove());
  }
  // from/to: {x, y} or elements; resolves on arrival. A single glowing drop on an arc, no trail.
  function fly(from, to, color, { size = 20, dur = 380, arc = -60 } = {}) {
    from = pt(from); to = pt(to);
    if (!from || !to) return Promise.resolve();
    const o = h('orb');
    o.style.width = o.style.height = size + 'px';
    o.style.background = `radial-gradient(circle at 35% 35%, #fff, ${color} 55%)`;
    o.style.boxShadow = `0 0 10px 3px ${color}88`;
    layer().appendChild(o);
    const x0 = from.x - size / 2, y0 = from.y - size / 2, dx = to.x - from.x, dy = to.y - from.y;
    const an = o.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: .6 },
      { transform: `translate(${x0 + dx / 2}px, ${y0 + dy / 2 + arc}px) scale(1.1)`, opacity: 1, offset: .5 },
      { transform: `translate(${x0 + dx}px, ${y0 + dy}px) scale(.8)`, opacity: 1 },
    ], { duration: dur, easing: 'cubic-bezier(.45, 0, .55, 1)' });
    return settle(an, dur).then(() => o.remove());
  }
  // Shakes read as noise; callers keep them so the timing stays, but nothing moves.
  function shake() { return Promise.resolve(); }
  function floatNum(el, text, color, big = false) {
    const c = pt(el);
    const s = h('num' + (big ? ' big' : ''), text);
    s.style.color = color;
    layer().appendChild(s);
    const at = (dy, k) => `translate(${c.x}px, ${c.y - dy}px) translate(-50%, -50%) scale(${k})`;
    const an = s.animate([
      { transform: at(0, .6), opacity: 0 },
      { transform: at(12, 1.08), opacity: 1, offset: .18 },
      { transform: at(18, 1), opacity: 1, offset: .55 },
      { transform: at(40, 1), opacity: 0 },
    ], { duration: 950, easing: 'ease-out' });
    return settle(an, 950).then(() => s.remove());
  }
  // top: where on the screen it shows (the battle keeps it over the arena, clear of the bars)
  function bigPop(text, color, top) {
    const s = h('pop', text);
    if (color) s.style.color = color;
    if (top) s.style.top = top;
    layer().appendChild(s);
    const an = s.animate([
      { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.06)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: .7 },
      { transform: 'translate(-50%, -65%) scale(.96)', opacity: 0 },
    ], { duration: 950, easing: 'ease-out' });
    return settle(an, 950).then(() => s.remove());
  }
  function vignette(color) {
    const v = document.getElementById('vignette');
    if (!v) return Promise.resolve();
    v.style.setProperty('--vig', color || '#e04a3a');
    return settle(v.animate([{ opacity: 0 }, { opacity: .4 }, { opacity: 0 }], { duration: 350 }), 350);
  }
  // Restartable CSS-class animation (e.g. .wiggle, .hurt).
  function animClass(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  function confetti(n = 40) {
    const colors = ['#ffcf4a', '#ff7a5a', '#6fe3ff', '#8cf08a', '#c79bff'];
    const w = window.innerWidth;
    for (let i = 0; i < n; i++) {
      const s = h('spark');
      const size = 6 + Math.random() * 6;
      s.style.width = size + 'px'; s.style.height = size * 1.6 + 'px'; s.style.borderRadius = '2px';
      s.style.background = colors[i % colors.length];
      layer().appendChild(s);
      const x = Math.random() * w, dur = 1400 + Math.random() * 900, rot = Math.random() * 720 - 360;
      const an = s.animate([
        { transform: `translate(${x}px, -20px) rotate(0)`, opacity: 1 },
        { transform: `translate(${x + (Math.random() * 120 - 60)}px, ${window.innerHeight * (.6 + Math.random() * .4)}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: dur, delay: Math.random() * 300, easing: 'cubic-bezier(.3,.6,.5,1)' });
      settle(an, dur + 300).then(() => s.remove());
    }
  }

  PS.Fx = { settle, sleep, centerOf, burst, burstAt, fly, floatNum, bigPop, shake, vignette, animClass, confetti };
})();
