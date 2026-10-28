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

  // Motion is kept to a minimum on purpose: particles, flying orbs and shakes read as noise, so these stay as no-ops for their callers.
  function burstAt() {}
  function burst() {}
  function fly() { return Promise.resolve(); }
  function shake() { return Promise.resolve(); }
  function floatNum(el, text, color, big = false) {
    const c = pt(el);
    const s = h('num' + (big ? ' big' : ''), text);
    s.style.color = color;
    layer().appendChild(s);
    const at = dy => `translate(${c.x}px, ${c.y - dy}px) translate(-50%, -50%)`;
    const an = s.animate([
      { transform: at(0), opacity: 0 },
      { transform: at(8), opacity: 1, offset: .2 },
      { transform: at(30), opacity: 0 },
    ], { duration: 900, easing: 'ease-out' });
    return settle(an, 900).then(() => s.remove());
  }
  function bigPop(text, color) {
    const s = h('pop', text);
    if (color) s.style.color = color;
    layer().appendChild(s);
    const an = s.animate([{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 900 });
    return settle(an, 900).then(() => s.remove());
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
