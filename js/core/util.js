var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Half rounds up, as the content spec requires; float noise is stripped first
  // so 90 * 0.35 = 31.499999999999996 still rounds to 32.
  const round = v => Math.floor(Math.round(v * 1e6) / 1e6 + 0.5);
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
