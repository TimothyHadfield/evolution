# Evolution Lab: session log

## 2026-10-20: edge pass (builder agent)
- **Asked** (Tim, through the manager): make each game perfect in scenarios it doesn't expect or that are a little weird. Plus: 6 players at 320 px scrolled; setup scrolled in phone landscape.
- **Built:** engine ends the game when deck and discard are both empty; `.tight` fit tier; landscape table grid and two-column setup; Back closes sheets; planned plays survive reload; two-tab sync; computers pause in a hidden tab; shared-win heading; real-size discard pile; wide scrolling hand; empty-hand "Go on"; emoji-safe names; plain offline message. Kit re-copied (cmp equal).
- **Verified:** engine 33, fx 8, online 7, edge 4 pass (edge test seen hanging/failing on old code first). WebKit layout run at 320×568, 393×659, 659×393, 568×320, 640×400, 1280, 1920 and behave run 41/41, both repeated on live 0c96243.
- **Open:** 6 players at 568×320 still scrolls inside the opponents' area; real iPhone.

## 2026-10-20: real-table look (builder agent)
- **Asked** (Tim, through the manager): make every game look like the real board/cards laid out on a real table, as if seen through the player's glasses.
- **Built:** wood table; opponents' seats across the top; Watering Hole board with deck stack and messy discard pile; my species boards with cube tracks, food tokens and tucked trait cards; my hand as a fan; deal from the deck; food cards turn over one by one; score-pad end screen; sideways-phone layout. Shared `_table` kit copied in; fx.js re-copied (1.0.3).
- **Verified:** engine 33, fx 8, online 7 tests pass. Headless WebKit at 320, 393, 659×393, 1280: no page scroll on the table, no overflow, no console errors. Effects speed tap leaves the game's Speed alone (measured). Deal ghosts start at the deck; reveal turns 3 cards in sequence (WebKit + Chrome). Two read-only review rounds against `real.md`.
- **Open:** real iPhone check.

## 2026-10-20: first build (builder agent, phase 2 brief)
- **Asked** (Tim, through the manager): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Phase 2: regular play against computers or online players that matches the in-person game exactly, with good art, iPhone and laptop layouts, and no errors.
- **Decided:**
  - Base game, 2nd edition (2017 rulebook).
  - The deck was researched from card scans and cross-checked against the published histogram.
  - Quick Play is a Settings switch.
  - Flight, Climate, Oceans and the 1st printing are parked (no checkable card lists).
- **Built:**
  - engine, bots (Easy, Medium, Hard), odds, Lab (traits, pairs, "Can it eat?", food deck), Study, Settings;
  - online seats via `_online`;
  - own SVG art and icon.
- **Verified:**
  - 33 engine tests, each mutation seen failing;
  - 7 online tests;
  - WebKit UI play-throughs at 393 px and 1280 px (see progress.md).
- **Open:** see progress.md NOT verified.

## 2026-10-20: design pass (builder agent)
- **Asked** (Tim, through the manager): "review them again for design improvements especially visually".
- **Built:**
  - 6-player phone fit (opponents in two compact columns);
  - readable opponent minis, a gold phase title on your turn, a red prey glow, open trait slots, soft-hyphen names;
  - a bigger desktop board, overlapped face-down food cards, a highlighted winner row, 40 px tap areas.
- **Verified:** 33 + 7 tests; WebKit before/after shots of 13 states at 393 px and 1440 px; no page scroll, no overflow, no console errors; nothing moves when a card is tapped or played.
- **Open:** a real iPhone check.

## 2026-10-20: sound & effects (builder agent)
- **Asked** (Tim, through the manager): "add opptional sounds … win celebrations, and other fun annimations … customizable in the settings".
- **Built:** shared `fx.js` copied in; `js/game-fx.js` turns each table change into sounds + animations (map in progress.md); tap sounds for my own plays; end-of-game count-up + win/lose celebration; "Sound & effects" section in Settings; Animations off also stops the table's own CSS motion.
- **Verified:** `tests/fx.test.js` 8 passed (scripted real games, attack/extinct/Cooperation chain, your-turn chime, Sound/Game sounds/Animations/Celebrations off with the real fx.js); 3 mutations each failed a test; 33 + 7 old tests green. WebKit shots at 393 px and 1440 px: Settings, mid-game "+1" float, win screen; no console errors, no overflow, no page scroll.
- **Open:** see NOT verified (real audio, a real iPhone).
