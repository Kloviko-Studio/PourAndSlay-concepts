// Plays real battles through the UI in headless Chrome on a throttled CPU and reports how smooth each move was.
// Needs the dev server on :5180 and Chrome installed.
//   node tools/playtest.mjs [--moves 40] [--island 3] [--cpu 4] [--frames outDir] [--god]
// The run seed is fixed (--seed), so two builds play the same game and their costs compare.
// --css "rules" injects extra CSS (e.g. to switch one animation off and see what it costs).
// --win N finishes the fight on move N (the debug win), to look at a kill and the next stage coming in.
// --tutorial keeps the hints on and the bot does what each one asks (try it with --island 1).
// --potions makes every fourth move a potion (each kind in turn, put on the belt first).
// --god gives the player 999 HP, so the bot lives long enough to meet every enemy move and later stages.
// --frames saves a screencast of the first moves and of every long one, so the animations can be checked frame by frame.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GOD = process.argv.includes('--god'), POTIONS = process.argv.includes('--potions'), TUT = process.argv.includes('--tutorial');
const WIN = +arg('win', -1), CSS = arg('css', ''), SEED = +arg('seed', 1700000000000);
const MOVES = +arg('moves', 40), ISLAND = +arg('island', 3), CPU = +arg('cpu', 4), FRAMES = arg('frames', null);
const APP = 'http://localhost:5180/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'ps-playtest-chrome');
const PORT = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let page;
for (let i = 0; i < 40 && !page; i++) {
  await sleep(250);
  try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { /* not up yet */ }
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0, frameN = 0, recording = false;
const pending = new Map(), errors = [];
ws.addEventListener('message', m => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Page.screencastFrame') {
    send('Page.screencastFrameAck', { sessionId: d.params.sessionId });
    if (recording) fs.writeFileSync(path.join(FRAMES, String(frameN++).padStart(4, '0') + '.jpg'), Buffer.from(d.params.data, 'base64'));
  }
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
async function ev(js) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); ${js} })()`, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(2500);
await ev(`
  PS.Meta.reset(Date.now());
  const p = PS.Meta.profile;
  p.maxIsland = ${ISLAND}; for (let i = 1; i < ${ISLAND}; i++) p.cleared[i] = true;
  p.settings.sound = false; p.settings.music = false; p.noAds = true; p.stats.runs = 5;
  Object.assign(p.tutorial, { boosters: true, lab: true });
  PS.Meta.save();`);
await send('Page.navigate', { url: APP });
await sleep(2500);
await send('Emulation.setCPUThrottlingRate', { rate: CPU });
// --css "rules" adds a stylesheet, to measure what one animation costs by switching it off
if (CSS) await ev(`const st = document.createElement('style'); st.textContent = ${JSON.stringify(CSS)}; document.head.appendChild(st);`);
await ev(`${TUT ? '' : 'PS.Tutorial = null;'} document.querySelectorAll('.ov').forEach(o => o.remove()); { const dn = Date.now; Date.now = () => ${SEED}; PS.UI.startRun(${ISLAND}); Date.now = dn; } await W(3000);
  if (${GOD}) { const R = PS.Meta.profile.activeRun; R.hp = R.maxHp = 999; Object.assign(R.battle.player, { hp: 999, maxHp: 999 }); PS.UI.continueRun(); await W(1500); }`);

// In-page bot: a pour that closes a tube beats one onto the same colour, which beats one into an empty tube; never undo the last pour.
await ev(`
  const W2 = ms => new Promise(r => setTimeout(r, ms));
  let last = null;
  function pick(F) {
    let best = null;
    for (let a = 0; a < F.tubes.length; a++) for (let b = 0; b < F.tubes.length; b++) {
      const n = PS.Field.pourAmount(F, a, b);
      if (!n || (last && last.a === b && last.b === a)) continue;
      const tb = F.tubes[b], ta = F.tubes[a];
      const closes = tb.layers.length + n === tb.cap && (!tb.layers.length || tb.layers.every(x => x === ta.layers[ta.layers.length - 1]));
      const whole = n === ta.layers.length;
      const s = (closes ? 100 : 0) + (tb.layers.length ? 20 : whole ? -30 : 0) + n;
      if (!best || s > best.s) best = { a, b, s };
    }
    return best;
  }
  const tw = i => document.querySelector('.bt-tw[data-i="' + i + '"]');
  const POTS = ['shake', 'solvent', 'flask', 'undo', 'heal', 'sleep', 'combo', 'firebomb'];
  let potN = 0, moveN = 0;
  window.__move = async function (win) {
    const R = PS.Meta.profile.activeRun;
    if (!R) return { phase: 'none' };
    const frames = [], longs = [];
    let prev = performance.now(), on = true;
    const loop = t => { frames.push(t - prev); prev = t; if (on) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const po = new PerformanceObserver(l => l.getEntries().forEach(e => longs.push(Math.round(e.duration))));
    po.observe({ type: 'longtask' });
    const t0 = performance.now();
    let what = R.phase;
    // a hint first: press its button, or tap what its ring points at
    const hint = document.querySelector('.tut-bubble'), btn = hint && hint.querySelector('.btn'), ring = document.querySelector('.tut-ring:not(.soft)');
    if (btn) { what = 'hint ok'; btn.click(); }
    else if (ring) {
      const rr = ring.getBoundingClientRect(), hit = document.elementsFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2).map(e => e.closest && e.closest('.bt-tw,[data-a],[data-pot],[data-opt]')).find(Boolean);
      if (hit) { what = 'hint tap'; hit.click(); }
      else { what = 'hint ?'; const c = document.querySelector('.tut-catch'); if (c) c.click(); }
    }
    else if (win && R.phase === 'battle') { what = 'win'; PS.UI.debug.onWin(); }
    else if (${POTIONS} && R.phase === 'battle' && ++moveN % 4 === 0) {
      const B = R.battle, id = POTS[potN++ % POTS.length];
      B.potions = [id];
      PS.UI.debug.render();
      what = 'potion ' + id;
      document.querySelector('[data-pot="0"]').click(); await W2(120);
      if (id === 'shake' || id === 'solvent') {
        const i = B.field.tubes.findIndex(t => t.layers.length > 1 && !t.frozen);
        if (i >= 0) document.querySelector('.bt-tw[data-i="' + i + '"]').click();
      }
    }
    else if (R.phase === 'battle') {
      const m = pick(R.battle.field);
      if (m) { what = 'pour ' + m.a + '>' + m.b; last = m; tw(m.a).click(); await W2(120); tw(m.b).click(); }
      else {
        const F = R.battle.field, i = F.tubes.findIndex(t => t.layers.length && !t.frozen);
        what = 'drain ' + i; last = null;
        document.querySelector('[data-a=drain]').click(); await W2(120); tw(i).click();
      }
    } else if (R.phase === 'reward') { const c = document.querySelector('.ov [data-opt="0"]'); if (c) c.click(); what = 'reward'; }
    else if (R.phase === 'revive') { const g = document.querySelector('.ov [data-a=giveup]'); if (g) g.click(); what = 'giveup'; }
    await W2(60);
    // a blocking hint holds the event queue until it is answered, so it ends the wait too
    while (PS.UI.busy && !document.querySelector('.tut-bubble')) await W2(30);
    on = false; po.disconnect();
    // what the screen shows must match the field once the move has played
    await W2(300);
    const RB = PS.Meta.profile.activeRun && PS.Meta.profile.activeRun.battle;
    const off = [];
    if (RB && document.querySelector('.scr-battle')) RB.field.tubes.forEach((t, i) => {
      const shown = [...document.querySelectorAll('.bt-tw[data-i="' + i + '"] .bt-layer')].map(l => (l.getAttribute('style').match(/liquid_([a-z]+)/) || [])[1]);
      if (shown.join(',') !== t.layers.join(',')) off.push(i + ':' + shown.join(',') + '≠' + t.layers.join(','));
    });
    const ms = frames.slice(1).sort((x, y) => x - y);
    return { what, phase: PS.Meta.profile.activeRun ? PS.Meta.profile.activeRun.phase : 'over', ms: Math.round(performance.now() - t0),
      p95: Math.round(ms[Math.floor(ms.length * .95)] || 0), max: Math.round(ms[ms.length - 1] || 0), janky: ms.filter(x => x > 50).length, frames: ms.length, longs, off };
  };`);

if (FRAMES) { fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true }); await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 }); }
await send('Performance.enable');
const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map(m => [m.name, m.value]));
const m0 = await metrics();
const rows = [];
for (let i = 0; i < MOVES; i++) {
  recording = !!FRAMES;
  const f0 = frameN;
  const r = await ev(`return await __move(${i === WIN});`);
  rows.push(r);
  console.log(String(i).padStart(3), r.what.padEnd(10), r.phase.padEnd(7), `${r.ms}ms`.padStart(7), `p95 ${r.p95}`.padStart(8), `max ${r.max}`.padStart(8), `janky ${r.janky}/${r.frames}`, r.longs.length ? 'long ' + r.longs.join(',') : '', r.off.length ? 'MISMATCH ' + r.off.join(' ') : '', recording ? `frames ${f0}-${frameN - 1}` : '');
  // keep the screencast of the first moves and of every busy one (closes, enemy turns, stage changes); drop the rest
  if (recording && i >= 6 && r.ms < 2500 && r.what !== 'reward' && r.what !== 'win') { for (let k = f0; k < frameN; k++) fs.rmSync(path.join(FRAMES, String(k).padStart(4, '0') + '.jpg'), { force: true }); frameN = f0; }
  if (r.phase === 'over' || r.phase === 'none' || r.phase === 'won' || r.phase === 'lost') break;
  await sleep(150);
}
if (FRAMES) await send('Page.stopScreencast');
const m1 = await metrics();
const all = rows.filter(r => r.what.startsWith('pour') || r.what.startsWith('drain'));
const avg = k => Math.round(all.reduce((s, r) => s + r[k], 0) / (all.length || 1));
console.log(`\n${all.length} moves at ${CPU}x CPU: avg ${avg('ms')}ms, avg p95 frame ${avg('p95')}ms, worst frame ${Math.max(0, ...all.map(r => r.max))}ms, janky frames ${all.reduce((s, r) => s + r.janky, 0)}`);
const per = k => Math.round((m1[k] - m0[k]) * 1000 / (rows.length || 1));
console.log(`main thread per move: script ${per('ScriptDuration')}ms, style ${per('RecalcStyleDuration')}ms, layout ${per('LayoutDuration')}ms, all tasks ${per('TaskDuration')}ms; layouts ${Math.round((m1.LayoutCount - m0.LayoutCount) / (rows.length || 1))}, style recalcs ${Math.round((m1.RecalcStyleCount - m0.RecalcStyleCount) / (rows.length || 1))}`);
const bad = rows.filter(r => r.off.length).length;
console.log(bad ? `${bad} moves left the screen out of sync with the field` : 'screen matched the field after every move');
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
ws.close();
chrome.kill();
