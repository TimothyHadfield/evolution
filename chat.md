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
