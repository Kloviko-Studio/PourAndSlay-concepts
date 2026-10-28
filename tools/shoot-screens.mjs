// Drives the prototype in headless Chrome and saves phone-size screenshots of every main screen for the design docs.
// Needs the dev server on :5180 and Chrome installed.
//   node tools/shoot-screens.mjs [outDir]   (default: ../pour-and-slay/docs/art/shots)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || fileURLToPath(new URL('../../pour-and-slay/docs/art/shots/', import.meta.url));
const APP = 'http://localhost:5180/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'ps-shots-chrome');
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

let page;
for (let i = 0; i < 40 && !page; i++) {
  await sleep(250);
  try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { /* not up yet */ }
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', m => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
async function ev(js) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); ${js} })()`, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'webp', quality: 88 });
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.result.data, 'base64'));
  console.log('shot', name);
}
async function load() {
  await send('Page.navigate', { url: APP });
  await sleep(2500);
  // hints would cover the screens; the tutorial getter is read at call time
  await ev(`await document.fonts.ready; PS.Tutorial = null; document.querySelectorAll('.ov').forEach(o => o.remove()); await W(300);`);
}

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await load();

// demo profile: third island open, some currency and two stored lives
await ev(`
  PS.Meta.reset(Date.now());
  const p = PS.Meta.profile;
  p.maxIsland = 3; p.cleared = { 1: true, 2: true }; p.best = { 1: 6, 2: 6, 3: 2 };
  p.coins = 1240; p.gems = 85; p.lives = 2;
  p.settings.sound = false; p.settings.music = false;
  // Russian UI, no demo interstitials, Lab open, one-time start-screen tip already seen
  localStorage.setItem('ps.lang', 'ru'); p.noAds = true; p.stats.runs = 5; p.tutorial.boosters = true; p.tutorial.lab = true;
  PS.Meta.save();`);
await load();

const go = async (name, params, wait = 900) => { await ev(`PS.UI.go(${JSON.stringify(name)}, ${JSON.stringify(params || {})}); await W(${wait});`); };
await go('main', {}, 1500); await shot('main');
await go('start', { n: 3 }); await shot('start');
await go('daily'); await shot('daily');
await go('quests'); await shot('quests');
await go('shop'); await shot('shop');
await go('lab'); await shot('lab');
await go('collection'); await shot('collection');
await go('settings'); await shot('settings');
await go('seal'); await shot('seal');
await go('catalog'); await ev(`document.querySelector('[data-t=tubes]').click(); await W(1500); document.querySelectorAll('.cat-tubes .sec-title')[1].scrollIntoView(); await W(300);`); await shot('tubes');

// Every catalog tab at full length for the content docs: the viewport grows to the list so one picture holds the whole tab.
fs.mkdirSync(path.join(OUT, 'catalog'), { recursive: true });
for (const t of await ev(`return [...document.querySelectorAll('.scr-catalog [data-t]')].map(b => b.dataset.t);`)) {
  const h = await ev(`document.querySelector('.scr-catalog [data-t=${t}]').click(); await W(600); const s = document.querySelector('.scr-catalog'); s.scrollTop = 0; return Math.ceil(s.getBoundingClientRect().top + s.scrollHeight + 16);`);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: h, deviceScaleFactor: 1.5, mobile: true });
  await ev(`await W(400); await Promise.all([...document.images].map(i => i.complete || new Promise(r => { i.onload = i.onerror = r; }))); await W(300);`);
  await shot('catalog/' + t);
}
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

// battle on island 3
await ev(`PS.UI.startRun(3); await W(2500);`); await shot('battle');
await ev(`document.querySelector('[data-a=build]').click(); await W(700);`); await shot('bag');
const resume = async () => { await load(); await ev(`PS.UI.continueRun(); await W(1800);`); };
await resume();
await ev(`document.querySelector('[data-a=pause]').click(); await W(700);`); await shot('pause');
await resume();
await ev(`PS.UI.debug.onWin(); await W(3500);`); await shot('pick');

// play on in the core until the first relic offer, then show it
const advanceTo = cond => ev(`
  const R = PS.Meta.profile.activeRun;
  for (let i = 0; i < 40 && !(${cond}); i++) {
    if (R.phase === 'reward') PS.Run.choose(R, 0);
    else if (R.phase === 'battle') {
      const B = R.battle; B.enemy.shield = 0; B.enemy.hp = 1; B.potions.push('firebomb');
      PS.Run.act(R, { type: 'potion', idx: B.potions.length - 1 });
    } else break;
  }
  PS.Meta.save(); return R.phase + ' ' + (R.offer && R.offer.kind);`);
console.log(await advanceTo(`R.phase === 'reward' && R.offer.kind === 'relic'`));
await resume(); await shot('relic');

// death: the revive dialog with the stored lives button
await ev(`
  const R = PS.Meta.profile.activeRun;
  PS.Run.choose(R, 0);
  const B = R.battle; B.status = 'lost'; B.player.hp = 0; R.hp = 0; R.phase = 'revive';
  PS.Meta.save();`);
await resume(); await shot('revive');
await ev(`document.querySelector('[data-a=giveup]').click(); await W(1800);`); await shot('results');

// a whole island won
await load();
await ev(`PS.UI.startRun(3); await W(2000);`);
console.log(await advanceTo(`R.phase === 'won'`));
await resume(); await shot('cleared');

ws.close();
chrome.kill();
