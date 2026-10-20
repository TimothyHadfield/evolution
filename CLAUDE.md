# Evolution Lab: project rules

A study and play site for the board game **Evolution** (North Star Games, 2nd edition, 2017 rulebook, base game).

- Live: https://timothyhadfield.github.io/evolution/
- Repo: TimothyHadfield/evolution (public). It is unrelated to `bank_Evolution.html` in the parent folder; never touch that file.

**Start with `progress.md`.**

## How it is built
- **Stack:** a static GitHub Pages site. No build step: plain UMD files in `js/`, shared by the browser and node.
- **Engine:** `js/engine.js` is pure functions over JSON state, with a seeded RNG in `state.seed`.
  - `apply(state, seat, action)` throws on illegal moves.
  - Computers are answered inside the engine (`players[i].bot`).
- **Data:** `js/cards.js` holds the deck. Only facts are copied from the game (names, counts, numbers); all text and art are our own.
- **Online:** `js/online.js` is a copy of `Board and Card Games/_online/online.js`. Never edit it here; re-copy it.
  - `js/online-game.js` is the game adapter (gameId `evolution`).
- **Generated data:**
  - `node tools/build-lab.js 600` writes `js/lab-data.js`.
  - `node tools/measure-levels.js 400` writes `js/strength-data.js`.
- **Tests:** `node tests/engine.test.js && node tests/online.test.mjs`.
- **Cache:** bump `?v=` on the script tags in `index.html` with each deploy.

## Rules for this project
- Every rule change needs three things:
  - a source in `docs/rules-check.md`;
  - a test;
  - a check that the test fails on the old code.
- Hub colours, system-ui, no page scroll on the main screens, bottom tabs on phone. Tim decides looks and wording.
- Never write inside any `.claude` folder.
- Use explicit `git add` paths.
