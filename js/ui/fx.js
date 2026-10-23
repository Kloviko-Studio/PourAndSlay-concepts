var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const layer = () => document.getElementById('fx');
  function h(cls, html) { const e = document.createElement('div'); e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function shade(hex, p) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16), t = Math.abs(p) / 100, f = p < 0 ? 0 : 255;
    const ch = s => Math.round(s + (f - s) * t);
    return '#' + ((1 << 24) | (ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).slice(1);
  }

  // Never block game flow on .finished alone: a background tab stops producing frames and the promise would hang forever.
  const settle = (anim, ms) => Promise.race([anim.finished.catch(() => {}), sleep(ms + 80)]);
  function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  const pt = p => (p && p.getBoundingClientRect ? centerOf(p) : p);

  function spark(x, y, color, dist = 50, size = 7, dur = 550) {
    const s = h('spark');
    s.style.width = s.style.height = size + 'px';
    s.style.background = color;
    layer().appendChild(s);
    const a = Math.random() * Math.PI * 2, d = dist * (.4 + Math.random() * .8);
    const an = s.animate([
      { transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(1)`, opacity: 1 },
      { transform: `translate(${x - size / 2 + Math.cos(a) * d}px, ${y - size / 2 + Math.sin(a) * d}px) scale(.2)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.2,.8,.4,1)' });
    settle(an, dur).then(() => s.remove());
  }
  function burstAt(el, color, n, dist) { const c = centerOf(el); burst(c.x, c.y, color, n, dist); }
  function burst(x, y, color, n = 14, dist = 60) {
    for (let i = 0; i < n; i++) spark(x, y, i % 3 ? color : '#fff', dist, 5 + Math.floor(Math.random() * 5));
  }
  // from/to: {x, y} or elements. Resolves on arrival.
  function fly(from, to, color, { size = 22, dur = 430, arc = -70, trail = true } = {}) {
    from = pt(from); to = pt(to);
    const o = h('orb');
    o.style.width = o.style.height = size + 'px';
    o.style.background = `radial-gradient(circle at 35% 35%, #fff, ${color} 45%, ${shade(color, -35)})`;
    o.style.boxShadow = `0 0 16px 5px ${color}99`;
    layer().appendChild(o);
    const x0 = from.x - size / 2, y0 = from.y - size / 2, dx = to.x - from.x, dy = to.y - from.y;
    const anim = o.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.5)` },
      { transform: `translate(${x0 + dx / 2}px, ${y0 + dy / 2 + arc}px) scale(1.15)`, offset: .5 },
      { transform: `translate(${x0 + dx}px, ${y0 + dy}px) scale(.9)` },
    ], { duration: dur, easing: 'ease-in' });
    const iv = trail ? setInterval(() => { const c = centerOf(o); spark(c.x, c.y, color, 10, 6, 350); }, 35) : 0;
    return settle(anim, dur).then(() => { clearInterval(iv); o.remove(); if (trail) burst(to.x, to.y, color); });
  }
  function floatNum(el, text, color, big = false) {
    const c = pt(el);
    const s = h('num' + (big ? ' big' : ''), text);
    s.style.color = color;
    layer().appendChild(s);
    const x = c.x + (Math.random() * 40 - 20);
    const an = s.animate([
      { transform: `translate(${x}px, ${c.y}px) translate(-50%, -50%) scale(.5)`, opacity: 0 },
      { transform: `translate(${x}px, ${c.y - 20}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: .2 },
      { transform: `translate(${x}px, ${c.y - 70}px) translate(-50%, -50%) scale(1)`, opacity: 0 },
    ], { duration: 1000, easing: 'ease-out' });
    return settle(an, 1000).then(() => s.remove());
  }
  function bigPop(text, color) {
    const s = h('pop', text);
    if (color) s.style.color = color;
    layer().appendChild(s);
    const an = s.animate([
      { transform: 'translate(-50%, -50%) scale(.3) rotate(-8deg)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.2) rotate(3deg)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%, -50%) scale(1) rotate(0)', opacity: 1, offset: .7 },
      { transform: 'translate(-50%, -80%) scale(.9)', opacity: 0 },
    ], { duration: 1000 });
    return settle(an, 1000).then(() => s.remove());
  }
  function shake(el, power = 6) {
    if (!el) return Promise.resolve();
    const an = el.animate([0, 1, 2, 3, 4].map(i => ({ transform: i === 4 ? 'none' : `translate(${(Math.random() * 2 - 1) * power}px, ${(Math.random() * 2 - 1) * power}px)` })), { duration: 300 });
    return settle(an, 300);
  }
  function vignette(color) {
    const v = document.getElementById('vignette');
    if (!v) return Promise.resolve();
    v.style.setProperty('--vig', color || '#e04a3a');
    return settle(v.animate([{ opacity: 0 }, { opacity: .8 }, { opacity: 0 }], { duration: 450 }), 450);
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

  PS.Fx = { settle, sleep, centerOf, spark, burst, burstAt, fly, floatNum, bigPop, shake, vignette, animClass, confetti, shade };
})();
