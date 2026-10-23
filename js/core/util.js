var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Half rounds up, as the content spec requires.
  const round = v => Math.floor(v + 0.5);
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  const lin = (ab, i) => ab[0] + ab[1] * i;
  const dayKey = now => { const d = new Date(now); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  PS.U = { clone, clamp, round, plural, lin, dayKey };
})();
