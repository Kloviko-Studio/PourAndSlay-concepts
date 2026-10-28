var PS = globalThis.PS || (globalThis.PS = {});
// Concept build: English by default, Russian kept as an option in Settings.
// The product build should start from the phone language (navigator.language) instead of 'en'.
(function () {
  'use strict';
  const KEY = 'ps.lang', LANGS = ['en', 'ru'];
  let lang = 'en';
  try { const s = globalThis.localStorage && localStorage.getItem(KEY); if (LANGS.indexOf(s) >= 0) lang = s; } catch (e) { /* storage blocked: default */ }

  // UI copy lives next to its markup as T('рус', 'eng'), so both languages stay readable in place.
  const T = (ru, en) => (lang === 'ru' ? ru : en);
  // ru: [one, few, many]; en: [one, other]
  T.pl = (n, ru, en) => (lang === 'ru' ? PS.U.plural(n, ru[0], ru[1], ru[2]) : (Math.abs(n) === 1 ? en[0] : en[1]));
  T.lang = () => lang;
  T.langs = LANGS;
  // Screens render once per language, so switching reloads instead of re-rendering everything live.
  T.set = function (l) {
    if (LANGS.indexOf(l) < 0 || l === lang) return;
    try { localStorage.setItem(KEY, l); } catch (e) { /* not persisted */ }
    location.reload();
  };

  // data.js is written in Russian; PS.DATA_EN overrides its player-facing fields.
  function applyData() {
    const D = PS.DATA, E = PS.DATA_EN;
    if (lang !== 'en' || !D || !E) return;
    const merge = (dst, src) => { if (dst && src) Object.keys(src).forEach(k => { dst[k] = src[k]; }); };
    ['elements', 'junk', 'potions', 'mods', 'finds', 'tubes', 'rarity', 'relics', 'lab', 'boosters', 'enemies', 'bosses'].forEach(sec => {
      if (E[sec] && D[sec]) Object.keys(E[sec]).forEach(id => merge(D[sec][id], E[sec][id]));
    });
    D.worlds.forEach(w => { w.name = w.nameEn || w.name; merge(w, (E.worlds || {})[w.id]); });
    D.islands.forEach(i => { i.name = i.nameEn || i.name; });
    Object.keys(E.unlockNotes || {}).forEach(n => { if (D.unlocks[n]) D.unlocks[n].note = E.unlockNotes[n]; });
    D.quests.forEach(q => { if (E.quests && E.quests[q.id]) q.text = E.quests[q.id]; });
    D.shop.products.forEach(p => merge(p, (E.products || {})[p.id]));
    D.shop.coinPacks.forEach(p => merge(p, (E.coinPacks || {})[p.id]));
  }
  applyData();
  if (globalThis.document) document.documentElement.lang = lang;

  PS.T = T;
})();
