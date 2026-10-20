# Evolution Lab: session log

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
