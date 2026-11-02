const assert = require('assert');
const { UI } = require('./load.js')(['js/data.js', 'js/core/util.js', 'js/i18n.js', 'js/ui/app.js']);

(async () => {
  const errors = [], order = [], originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    await UI.play([{ type: 'sync' }, { type: 'async' }, { type: 'next' }], {
      sync() { throw new Error('sync failure'); },
      async: async () => { throw new Error('async failure'); },
      next() { order.push('next'); },
      done() { order.push('done'); },
    });
    assert.deepStrictEqual(order, ['next', 'done']);
    assert.deepStrictEqual(errors.map(e => e[1]), ['sync', 'async']);
    assert.strictEqual(UI.busy, false);

    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = UI.play([{ type: 'wait' }], { wait: () => gate, done: () => order.push('first') });
    const second = UI.play([], { done: () => order.push('second') });
    await Promise.resolve();
    assert.strictEqual(UI.busy, true);
    release();
    await Promise.all([first, second]);
    assert.deepStrictEqual(order.slice(-2), ['first', 'second']);

    await assert.rejects(UI.play([], { done() { throw new Error('done failure'); } }), /done failure/);
    await UI.play([], { done: () => order.push('recovered') });
    assert.strictEqual(order.at(-1), 'recovered');
    assert.strictEqual(UI.busy, false);
  } finally { console.error = originalError; }
  console.log('UI event queue: sync/async failures, completion, serialization and recovery passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
