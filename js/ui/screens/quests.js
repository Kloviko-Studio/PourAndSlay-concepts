var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  const UI = PS.UI, esc = UI.esc;

  function questText(q) {
    const t = (PS.DATA.quests || []).find(x => x.id === q.id);
    if (!t) return q.id;
    const c = q.color && PS.DATA.colors[q.color];
    return t.text.replace('{n}', q.target).replace('{color}', c ? (c.gen || c.name) : 'любого цвета');
  }

  UI.screen('quests', {
    chrome: { tab: 'main', tabs: false },
    mount(el) {
      function render() {
        const now = UI.now(), list = PS.Meta.quests(now), p = PS.Meta.profile;
        const reward = Math.round(PS.DATA.questReward.coins * PS.Meta.P());
        const allDone = list.every(q => q.claimed), bonus = PS.DATA.economy.gems.questsAll;
        el.innerHTML = `
          <div class="scr-head"><button class="btn-icon" data-a="back">‹</button><h1>📜 Задания</h1><span class="tag">⏳ <span data-t>${UI.hhmm(UI.msToMidnight())}</span></span></div>
          <div class="cards">${list.map((q, i) => {
            const pct = Math.min(100, q.progress / q.target * 100);
            const side = q.claimed ? '<span class="tag tag-ok">✓</span>'
              : q.done ? `<button class="btn btn-sm btn-cta" data-claim="${i}">Забрать</button>`
              : `<span class="q-reward">+${reward} 🪙</span>`;
            return `<div class="card${q.done && !q.claimed ? ' q-done' : ''}${q.claimed ? ' q-claimed' : ''}">
              <div class="card-ico">${q.claimed ? '✅' : q.done ? '🎉' : '📜'}</div>
              <div class="card-body"><div class="card-title" style="font-size:15px">${esc(questText(q))}</div>
                <div class="bar q-prog"><div class="bar-fill" style="width:${pct}%"></div><div class="bar-label">${Math.min(q.progress, q.target)} / ${q.target}</div></div></div>
              <div class="card-side">${side}</div></div>`;
          }).join('')}</div>
          <div class="gap"></div>
          <div class="panel ${allDone ? 'gold' : 'soft'} row"><span style="font-size:30px">💎</span>
            <div class="grow"><b>Все три задания</b><div class="small muted">${p.quests.bonusClaimed ? 'Бонус получен' : `Бонус: ${bonus} 💎`}</div></div>
            <span class="tag ${p.quests.bonusClaimed ? 'tag-ok' : ''}">${list.filter(q => q.claimed).length}/${list.length}</span></div>
          <p class="small dim center" style="margin-top:12px">Задания обновляются в полночь.</p>`;
        el.querySelector('[data-a=back]').onclick = () => { PS.Snd.play('select'); UI.go('main'); };
        el.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
          const from = PS.Fx.centerOf(b);
          const out = PS.Meta.claimQuest(+b.dataset.claim);
          if (!out) return;
          PS.Snd.play('coin');
          UI.flyCurrency(from, 'coins', 6);
          if (out.gems) { setTimeout(() => UI.flyCurrency(from, 'gems', 5), 250); PS.Fx.bigPop(`+${out.gems} 💎`); }
          render();
        });
      }
      render();
      this.t = setInterval(() => { const t = el.querySelector('[data-t]'); if (t) t.textContent = UI.hhmm(UI.msToMidnight()); }, 1000);
    },
    unmount() { clearInterval(this.t); },
  });
})();
