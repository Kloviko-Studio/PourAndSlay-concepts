var PS = globalThis.PS || (globalThis.PS = {});
// Debug tool: step through every mob on the real, fully-dressed battle screen for its island
// (arena backdrop, ground, HP bars, tube field) instead of a bare art swatch like the catalog.
(function () {
  'use strict';
  const UI = PS.UI, T = PS.T, esc = UI.esc;
  const D = () => PS.DATA;

  // Each regular enemy and boss once, at the first (lowest-numbered) island it appears on —
  // a boss's later islands and a boss's "returning" plastered look are skipped on purpose.
  function buildList() {
    const d = D(), out = [];
    const firstIsland = test => { const isl = d.islands.find(test); return isl ? isl.n : null; };
    Object.keys(d.enemies).forEach(id => {
      const n = firstIsland(isl => isl.regulars.indexOf(id) >= 0);
      if (n) out.push({ id, boss: false, island: n });
    });
    Object.keys(d.bosses).forEach(id => {
      const n = firstIsland(isl => isl.boss === id);
      if (n) out.push({ id, boss: true, island: n });
    });
    out.sort((a, b) => a.island - b.island || (a.boss ? 1 : 0) - (b.boss ? 1 : 0));
    return out;
  }

  // A throwaway run whose first stage is forced to `item`'s mob, then rendered by the real battle screen.
  function openScene(item) {
    const out = PS.Run.create(PS.Meta.ctx(UI.now()), item.island, []);
    const R = out.R;
    R.preview = true; // skip the tutorial overlay: this run is a static diorama, not a playable stage.
    R.stages[0] = { type: item.boss ? 'boss' : 'regular', enemy: item.id, encounter: 0 };
    PS.Run.startStage(R, 0, []);
    UI.go('battle', { run: R });
  }

  UI.watchScenes = function (back) {
    const list = buildList();
    if (!list.length) return;
    let i = 0;
    const bar = UI.h('div', 'watch-bar');
    UI.$('overlays').appendChild(bar);
    document.body.classList.add('watch-mode');

    function close() {
      bar.remove();
      document.body.classList.remove('watch-mode');
      UI.go('settings', { back });
    }
    function label(item) {
      const d = item.boss ? D().bosses[item.id] : D().enemies[item.id];
      const isl = UI.island(item.island);
      return `${esc(d.name)} — ${esc(isl.name)}`;
    }
    function show() {
      const item = list[i];
      openScene(item);
      bar.innerHTML = `
        <button class="watch-btn" data-w="prev" aria-label="${T('Предыдущий моб', 'Previous mob')}">${UI.ico.left}</button>
        <div class="watch-label">${i + 1}/${list.length} · ${label(item)}</div>
        <button class="watch-btn" data-w="next" aria-label="${T('Следующий моб', 'Next mob')}">${UI.ico.right}</button>
        <button class="watch-btn watch-close" data-w="close" aria-label="${T('Закрыть', 'Close')}">${UI.ico.close}</button>`;
      bar.querySelector('[data-w=prev]').onclick = () => { PS.Snd.play('select'); i = (i - 1 + list.length) % list.length; show(); };
      bar.querySelector('[data-w=next]').onclick = () => { PS.Snd.play('select'); i = (i + 1) % list.length; show(); };
      bar.querySelector('[data-w=close]').onclick = () => { PS.Snd.play('select'); close(); };
    }
    show();
  };
})();
