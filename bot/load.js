// Loads data + core into this Node process the same way the browser does (classic scripts sharing globalThis.PS).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/data.js', 'js/core/rng.js', 'js/core/util.js', 'js/core/field.js', 'js/core/combat.js', 'js/core/run.js', 'js/core/meta.js'];

module.exports = function load(only) {
  globalThis.PS = {};
  for (const f of only || FILES) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  }
  return globalThis.PS;
};
