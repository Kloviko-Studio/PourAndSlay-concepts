# Документация

Спеки v1 (контент, экраны, решения, план) живут в репозитории игры: `Kloviko-Studio/PourAndSlay`, папка `docs/`. Здесь — решения по HTML-прототипу.

## Решения

| № | Решение | Статус |
|---|---|---|
| [0001](decisions/0001-base-combat-as-core.md) | Ядро игры — базовый бой | принято |
| [0002](decisions/0002-heroes-as-future-extension.md) | «Колбы-герои» — кандидат на продолжение | отложено |
| [0003](decisions/0003-run-structure-growing-levels.md) | Забег из уровней с растущим числом врагов | заменено 0004 |
| [0004](decisions/0004-linear-levels-roguelike-inside.md) | Линейные уровни, рогалик внутри уровня, вечная Лаборатория | заменено спеками v1 |
| [0005](decisions/0005-concept-v2-multifile.md) | Концепт v2 — несколько файлов вместо одного | принято |

## Прототип

`index.html` в корне — концепт v2 всей v1 (он же страница GitHub Pages). Открывается двойным кликом, сервер не нужен. Устройство — [v2/ARCHITECTURE.md](v2/ARCHITECTURE.md). Бот и тесты ядра — `node bot/sim.js`, `node bot/test-*.js`. Первый прототип сохранён в `legacy/v1.html`.
