// Needs the prototype server on :5180 and Chrome. Run: node tools/test-battle-ui.mjs [--lang ru]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const language = process.argv[process.argv.indexOf('--lang') + 1] === 'ru' ? 'ru' : 'en';
const match = process.argv.includes('--match') ? process.argv[process.argv.indexOf('--match') + 1] : '';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-battle-test-'));
const port = 9336;
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
let ws, seq = 0;
const pending = new Map(), errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
chrome.on('error', error => errors.push(error.message));

async function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, response => { clearTimeout(timer); response.error ? reject(new Error(response.error.message)) : resolve(response); });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(source) {
  const response = await send('Runtime.evaluate', {
    expression: `(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); ${source} })()`,
    awaitPromise: true, returnByValue: true,
  });
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result.result.value;
}
let passed = 0;
async function check(name, source) {
  if (match && !name.includes(match)) return;
  await evaluate(source);
  passed++;
  console.log('ok ', name);
}

try {
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(100);
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === 'page'); } catch {}
  }
  assert.ok(page, 'Chrome did not start');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', message => {
    const response = JSON.parse(message.data);
    if (response.id && pending.has(response.id)) { pending.get(response.id)(response); pending.delete(response.id); }
    if (response.method === 'Runtime.exceptionThrown') errors.push(response.params.exceptionDetails.exception?.description || response.params.exceptionDetails.text);
    if (response.method === 'Runtime.consoleAPICalled' && response.params.type === 'error') {
      const message = response.params.args.map(arg => arg.value ?? arg.description).join(' ');
      if (!message.includes('battle-ui-test deliberate failure')) errors.push(message);
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:5180/' });
  await sleep(1000);
  await evaluate(`localStorage.setItem('ps.lang', '${language}');`);
  await send('Page.navigate', { url: 'http://localhost:5180/' });
  await sleep(1500);
  await evaluate(`
    await document.fonts.ready;
    window.originalTutorial = PS.Tutorial;
    window.ensure = (ok, text) => { if (!ok) throw new Error(text); };
    window.idle = async () => {
      const deadline = performance.now() + 15000;
      do {
        document.querySelectorAll('.tut-bubble [data-ok]').forEach(button => button.click());
        await W(20);
      } while ((PS.UI.busy || document.querySelector('.tut-bubble')) && performance.now() < deadline);
      ensure(!PS.UI.busy, 'Event queue stuck');
    };
    window.start = async (island = 3, tutorial = false, speed = 8) => {
      PS.Tutorial = originalTutorial;
      PS.UI.go('main');
      PS.Meta.reset(1700000000000);
      const p = PS.Meta.profile;
      p.maxIsland = 10; p.cleared = { 1: true }; p.noAds = true; p.stats.runs = 5;
      p.settings.sound = false; p.settings.music = false;
      Object.assign(p.tutorial, { boosters: true, lab: true });
      if (!tutorial) PS.Tutorial = null;
      PS.UI.speed = speed;
      PS.UI.startRun(island);
      await idle(); await W(100);
      return p.activeRun;
    };
    window.setupPour = async (speed = 8) => {
      const R = await start(3, false, speed), B = R.battle;
      B.field.tubes.forEach(t => { t.layers = []; t.frozen = 0; });
      B.field.tubes[0].layers = ['fire', 'water'];
      B.field.tubes[1].layers = ['water'];
      B.field.tubes[2].layers = ['life', 'fire', 'life', 'fire'];
      B.field.minLayers = 0; B.enemy.timer = 50;
      B.field.queue = Array.from({ length: 3 }, () => ['life', 'water', 'fire', 'life']);
      PS.UI.debug.render(); await W(200);
      return R;
    };
    window.tapTube = i => [...document.querySelectorAll('.scr-battle')].at(-1).querySelector('.bt-tw[data-i="' + i + '"]').click();
    window.checkField = () => {
      const B = PS.Meta.profile.activeRun.battle;
      ensure(!document.querySelector('.bt-pour-layer,.bt-pour-placeholder'), 'Flight left detached nodes');
      ensure(document.querySelectorAll('.scr-battle .bt-tw[data-i]').length === B.field.tubes.length, 'Tube disappeared');
      B.field.tubes.forEach((t, i) => {
        const el = document.querySelector('.scr-battle .bt-tw[data-i="' + i + '"]');
        const shown = [...el.querySelectorAll('.bt-layer')].map(layer => (layer.style.cssText.match(/liquid_([a-z]+)/) || [])[1]);
        ensure(shown.join(',') === t.layers.join(','), 'Layers out of sync: ' + i);
        ensure(el.style.position !== 'absolute', 'Tube did not return to row: ' + i);
      });
    };
  `);
  await check('stage entry ignores early taps and unlocks the field afterwards', `
    await setupPour(1); const { R } = PS.UI.startRun(3), B = R.battle;
    let move;
    for (let from = 0; from < B.field.tubes.length && !move; from++) {
      for (let to = 0; to < B.field.tubes.length; to++) {
        if (PS.Field.pourAmount(B.field, from, to)) { move = { from, to }; break; }
      }
    }
    ensure(move, 'No legal starting move');
    ensure([...document.querySelectorAll('.bt-field')].at(-1).inert, 'Field was not locked during entry');
    tapTube(move.from); tapTube(move.to); await idle();
    ensure(B.turn === 0, 'Entry taps were deferred');
    ensure(!document.querySelector('.bt-field').inert, 'Field stayed locked after entry');
    tapTube(move.from); tapTube(move.to); await idle(); checkField();
    ensure(B.turn === 1, 'Starting move did not work after entry');
  `);
  await check('early taps do not defer a second pour behind closing effects', `
    const R = await setupPour(1), B = R.battle;
    B.field.tubes[0].layers = ['fire']; B.field.tubes[1].layers = Array(3).fill('fire');
    B.field.tubes[2].layers = ['water']; B.enemy.hp = B.enemy.maxHp = 100;
    PS.UI.debug.render(); tapTube(0); tapTube(1); await W(80); tapTube(2); tapTube(3);
    await idle(); await W(250); checkField();
    ensure(B.turn === 1 && B.field.tubes[3].layers.length === 0, 'Early input executed a deferred pour');
    tapTube(2); tapTube(3); await idle(); checkField();
    ensure(B.turn === 2 && B.field.tubes[3].layers[0] === 'water', 'Pour did not respond when the field became ready');
  `);
  for (const speed of [1, 4, 8]) await check(`early source taps are ignored at speed ${speed}`, `
    const R = await setupPour(${speed}); tapTube(0); await W(40); tapTube(1); await W(120 / ${speed}); tapTube(0); tapTube(3);
    await idle(); await W(220); checkField();
    ensure(R.battle.turn === 1 && R.battle.field.tubes[0].layers[0] === 'fire', 'Early taps queued a move');
    tapTube(0); tapTube(3); await idle(); checkField();
    ensure(R.battle.turn === 2 && R.battle.field.tubes[3].layers[0] === 'fire', 'Field did not unlock');
  `);
  await check('sieve context stays correct and early taps are not queued', `
    const R = await setupPour(), act = PS.Run.act, events = [];
    Object.assign(R.battle.field.tubes[0], { layers: ['stone'] });
    Object.assign(R.battle.field.tubes[1], { kind: 'sieve', layers: [] });
    R.battle.field.tubes[2].layers = ['fire']; PS.UI.debug.render();
    PS.Run.act = (...args) => { const result = act(...args); events.push(result); return result; };
    try { tapTube(0); tapTube(1); tapTube(2); tapTube(3); await idle(); }
    finally { PS.Run.act = act; }
    ensure(events.length === 1, 'Early taps queued a move during sieve animation');
    ensure(events[0][0].swallow === true, 'Sieve used a later move for lookahead'); checkField();
    tapTube(2); tapTube(3); await idle(); checkField();
  `);
  await check('undo and flask stay unused during a pour and work after it', `
    const R = await setupPour(); R.battle.potions = ['undo', 'flask']; PS.UI.debug.render();
    tapTube(0); tapTube(1); document.querySelector('[data-pot="0"]').click();
    document.querySelector('[data-pot="1"]').click(); await idle();
    ensure(R.battle.potions.join(',') === 'undo,flask', 'Early potion tap was applied');
    document.querySelector('[data-potion-id="undo"]').click(); await idle();
    document.querySelector('[data-potion-id="flask"]').click(); await idle(); await W(220); checkField();
    ensure(R.battle.field.tubes.length === 9, 'Flask did not add a tube');
    ensure(R.battle.field.tubes[0].layers.join(',') === 'fire,water', 'Undo did not restore layers');
  `);
  await check('early potion taps are not spent or deferred', `
    const R = await setupPour(), B = R.battle;
    B.player.hp = 20; B.player.maxHp = 50; B.enemy.hp = 200; B.enemy.maxHp = 200;
    B.potions = ['heal', 'firebomb']; PS.UI.debug.render();
    document.querySelector('[data-pot="0"]').click(); document.querySelector('[data-pot="1"]').click();
    await idle(); ensure(B.player.hp === 33 && B.enemy.hp === 200, 'Early second potion was applied');
    ensure(B.potions.join(',') === 'firebomb', 'Early second potion was spent');
    document.querySelector('[data-potion-id="firebomb"]').click(); await idle();
    ensure(B.enemy.hp === 182 && B.potions.length === 0, 'Potion did not work after unlock'); checkField();
  `);
  for (const [width, height] of [[375, 812], [320, 568]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await check(`shield close does not shift layout at ${width}x${height}`, `
      const R = await setupPour(4), B = R.battle;
      B.field.tubes[0].layers = ['water']; B.field.tubes[1].layers = Array(3).fill('water');
      B.player.shield = 0; PS.UI.debug.render(); await W(200);
      const samples = []; let recording = true;
      const frame = () => {
        const el = document.querySelector('.scr-battle'), box = el.querySelector('.bt-field').getBoundingClientRect();
        samples.push([box.top, box.height, parseFloat(el.style.getPropertyValue('--earth-y')), el.querySelector('.bt-player .bar').getBoundingClientRect().width]);
        if (recording) requestAnimationFrame(frame);
      };
      frame(); tapTube(0); tapTube(1); await idle(); await W(150); recording = false;
      for (let i = 0; i < 4; i++) ensure(Math.max(...samples.map(s => s[i])) - Math.min(...samples.map(s => s[i])) < .1, 'Shield shifted layout metric ' + i);
      checkField();
    `);
  }
  for (const action of ['atk', 'stone', 'spores', 'freeze', 'steal', 'swap', 'shield', 'buff', 'heal']) await check(`enemy action ${action}`, `
    const R = await setupPour(), e = R.battle.enemy;
    e.cycle = [{ t: '${action}', v: 1, turns: 1 }]; e.intent = e.cycle[0]; e.timer = 1;
    tapTube(0); tapTube(1); await idle(); await W(200); checkField();
  `);
  await check('navigation cancels a flight without touching the next battle', `
    await setupPour(1); tapTube(0); tapTube(1); await W(80);
    PS.UI.go('main'); await W(100); await start(); await idle(); checkField();
  `);
  await check('boss flee, relic selection and final victory with tutorial', `
    const R = await start(2, true), stages = [];
    for (let i = 0; i < 12 && R.phase === 'battle'; i++) {
      const boss = R.battle.enemy.boss;
      PS.UI.debug.onWin(); await idle();
      if (R.phase === 'reward') {
        ensure(document.querySelector('[data-opt]'), 'Reward missing after boss');
        if (boss) ensure(R.offer.kind === 'relic', 'Boss relic missing');
        stages.push(R.stage); document.querySelector(boss ? '[data-opt="0"]' : '[data-a="skip"]').click(); await idle();
      }
    }
    await W(700); ensure(PS.UI.current() === 'cleared', 'Final boss did not open victory');
    ensure(stages.length === 5, 'Run did not advance through every stage');
  `);
  await check('death, life revive and give up route to the right windows', `
    const R = await setupPour(), B = R.battle; PS.Meta.profile.lives = 1;
    B.player.hp = 1; B.enemy.cycle = [{ t: 'atk', v: 10, turns: 1 }];
    B.enemy.intent = B.enemy.cycle[0]; B.enemy.timer = 1; PS.UI.debug.render();
    tapTube(0); tapTube(1); await idle();
    ensure(R.phase === 'revive' && document.querySelector('[data-a="life"]'), 'Revive window missing');
    document.querySelector('[data-a="life"]').click(); await idle();
    ensure(R.phase === 'battle' && B.player.hp > 0, 'Life revive did not resume battle'); checkField();
    B.player.hp = 1; B.enemy.timer = 1; PS.UI.debug.render(); tapTube(0); tapTube(3); await idle();
    ensure(R.phase === 'revive', 'Second death did not show results action');
    document.querySelector('[data-a="giveup"]').click(); await W(600);
    ensure(PS.UI.current() === 'results', 'Give up did not open results');
  `);
  await check('long tutorial hint remains inside the small viewport', `
    await start(2, true);
    const hint = PS.Tutorial.once('viewport-test', { target: '.bt-sbar', title: 'Long hint', text: 'Battle hint. '.repeat(150) });
    await W(350);
    const bubble = document.querySelector('.tut-bubble');
    const rect = bubble.getBoundingClientRect();
    ensure(rect.top >= 0 && rect.bottom <= innerHeight, 'Hint extends outside viewport');
    bubble.querySelector('[data-ok]').scrollIntoView({ block: 'end' });
    bubble.querySelector('[data-ok]').click(); await hint;
  `);
  await check('build tap during boss death cannot cover the victory screen', `
    const R = await start(1); PS.Run.startStage(R, R.stages.length - 1, []);
    PS.UI.continueRun(); await idle(); PS.UI.debug.onWin();
    document.querySelector('[data-a="build"]').click(); await idle(); await W(650);
    ensure(PS.UI.current() === 'cleared', 'Victory did not open');
    ensure(!document.querySelector('.bt-build'), 'Build window stranded above victory');
  `);
  await check('build window closes when leaving battle', `
    await start(); document.querySelector('[data-a="build"]').click();
    ensure(document.querySelector('.bt-build'), 'Build did not open while idle');
    PS.UI.go('main'); await W(200);
    ensure(!document.querySelector('.bt-build'), 'Build leaked into the next screen');
  `);
  for (const island of [1, 3, 4, 5, 6, 7, 8, 9, 10]) await check(`final boss victory on island ${island}`, `
    const R = await start(${island}); PS.Run.startStage(R, R.stages.length - 1, []);
    PS.UI.continueRun(); await idle(); PS.UI.debug.onWin(); await idle(); await W(650);
    ensure(PS.UI.current() === 'cleared', 'Victory screen missing on island ${island}');
  `);
  await check('async effect failure still opens boss relic reward', `
    const R = await start(2), stage = R.stages.findIndex(s => s.type === 'boss');
    PS.Run.startStage(R, stage, []); PS.UI.continueRun(); await idle();
    const fly = PS.Fx.fly;
    PS.Fx.fly = async () => { throw new Error('battle-ui-test deliberate failure'); };
    try { PS.UI.debug.onWin(); await idle(); } finally { PS.Fx.fly = fly; }
    ensure(R.phase === 'reward' && document.querySelector('[data-opt]'), 'Effect failure stranded boss reward');
    document.querySelector('[data-a="skip"]').click(); await idle(); checkField();
  `);
  assert.ok(passed, 'No matching checks');
  assert.deepEqual(errors, [], 'Browser errors');
  console.log(`${passed} battle UI checks passed (${language}); no unexpected browser errors`);
} finally {
  if (ws) ws.close();
  chrome.kill();
  for (const resolve of pending.values()) resolve({ error: { message: 'Browser closed' } });
  if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir())) {
    await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 1000).unref(); } });
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}
