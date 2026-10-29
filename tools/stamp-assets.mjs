// Stamps every css/js link in index.html with a hash of the file, so a deploy never mixes fresh scripts with stale cached styles.
//   node tools/stamp-assets.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = root + 'index.html';
const html = fs.readFileSync(index, 'utf8');
const out = html.replace(/((?:href|src)=")((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g, (_, attr, file) => {
  const hash = crypto.createHash('sha1').update(fs.readFileSync(root + file)).digest('hex').slice(0, 8);
  return `${attr}${file}?v=${hash}"`;
});
if (out !== html) fs.writeFileSync(index, out);
console.log(out === html ? 'index.html already up to date' : 'index.html stamped');
