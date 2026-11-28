# Evolution Lab: session log

## 2026-11-28: fit pass round 2 (builder agent, from group manager B)
- Asked: use the spare width on the crowded phone (opponent lines ended ~100 px short) so hand names reach 10 px and opponent cubes 12 px; fix the 320x568 inner scroll.
- Built (a867d05, live): opponent lines with the name on one line, icons two high, cubes 18px/15px font, hand counts 16px; hand grows first to 10 px names; rows at 320 shrink to the width instead of wrapping; 2-3 opponent packed table sits closer. app v22, pwa 23.
- Verified: tightened fit-ui failed 5/15 on round-1 main → 15/15; all suites green (leaf-ui 2/3, same as main); live phone-view 393 + desktop: no errors, no overflow. Shots: scratchpad `evo-fit/r2`.
- Open: 320 still small; mid-word trait-name breaks on narrow boards.

## 2026-11-27/28: fit pass (builder agent, portfolio fit wave)
- Asked: spacing/size/fit only at 393x659, 320x568, 659x393, 1280x800, 1440x900; crowded = late game, 6 players, 5 species x 3 traits; numbers ≥12, names ≥10, taps ≥36, no scroll.
- Built (15841c1, live): phone opponents one per line when shorter; my boards flex into one row (container queries drop trait icons when narrow); bigger hand names/food and opponent pieces; laptop `--hmax` narrows the hand as species grow, `fixBoards`/`--spw` keep boards steady per zoom and when + slots appear. app v21, pwa 22.
- Verified: new `tests/fit-ui.mjs` 14/15 fail on old code → 15/15; engine 35, online 8, fx 10, edge 4, fluid 11, climate 32, flight 36, tutorial 9, layout 13, fluid-ui 2, tutorial-ui 18, pwa-check 18; leaf-ui 2/3 (same fail on main). Live phone-view 393: 0 errors, no overflow. Shots: scratchpad `evo-fit/before` + `after`.
- Open: phone crowded text under 10/12 px targets; 320x568 6p opponents scroll inside ~93 px (see NOT verified).

## 2026-11-25/26: laptop table overlap, then tininess redesign (main chat)
- **Asked:** "the top section with the other computers playing ... interlap with the watering hole plate and the watering hole plate is weird and off centered"; then "evolution feels extreamly poorly designed right now with spacing and size and whatnot. So much is so tiny it's hard to read"; then "prepare md files for chat reset".
- **Built:** 8ccbadb desktop zoom can shrink (overlap fix; not a recent regression, measured on 3 old builds). Then the redesign: my hand beside my boards on laptop, bigger watering-hole food cards, narrower side panel under 1200px, + room checked at every desktop size (see progress Decisions 2026-11-26). Also earlier this session: Catan lesson wave pieces (end-of-game reveal, attack toast here).
- **Verified:** all 12 suites green on the working tree (counts in progress START HERE); WebKit shots at 1280×650, 1536×730, 1280×800 (hand tap), 393×659 (phone unchanged).
- **Open:** small vertical shift when + slots appear on tap; 1024×680 opponents smallish; Tim's own laptop look.

## 2026-10-28: kit sweep 2: coach 1.2.0 (offer place auto, avoids Start; old offer-bottom override removed), pwa 1.4.0 (data-version 14); engine/edge/fx/tutorial/online/layout/tutorial-ui + pwa-check 18/18 green; leaf-ui 1 fail, same on main.

## 2026-10-28: wave 3 "just make the games better" (builder agent)
- **Asked** (Tim, through the manager): "Go ahead and go through each project adding features or changing things that you think should be changed… links to youtube videos… variations… Just make the games better." Brief: videos, the two rule shortcuts, cards/variants if real lists exist, settings/iPhone.
- **Built:** leaf-trait order chosen by the owner (rulebook p.6), asked only when it changes the result; computers take the best order. Intelligence timing checked: already the 2017 rule. Videos tab (4 videos). No cards/house rules (none qualify).
- **Verified:** engine 35 (2 new, seen failing), online 8 (1 new), tutorial 9, edge 4, fx 10, layout 10, tutorial-ui 18, leaf-ui 3 (new; fails on the live build), pwa-check 18/18. All-computer games identical to the old engine (300/300). Ladder 99/73/77%. Shots at 393, 320, 659×393, 1280, 1440 (6 and 3 players, setup, settings).
- **Open:** real iPhone; real two-phone online leaf choice.

## 2026-10-27: improvement pass (builder agent)
- **Asked** (Tim, through the manager): "start building every single improvement you can think of after your competitor analysis… make our boardgames the best in every single metric". Known gap: no tutorial (the official app's guided tutorial is its strong point).
- **Built:** guided first game (stacked round, 16 coach steps) + Rules sheet (`_coach`); My stats, 9 achievements, Daily game (`_profile`); Undo vs computer (Hint/Undo = counted, not rated; leaving after a move = loss; guided never counts); home-screen install + offline (`_pwa`); card scenes by family; jaws on prey; extinction moment.
- **Verified:** engine 33, edge 4, fx 10 (2 new, seen failing on old code), tutorial 9, online 7, layout 10, tutorial-ui 18 (WebKit iPhone), pwa-check 18/18. Setup fits 393×659 without scrolling; laptop 1440 checked. Ladder at 3/4/6 players measured (300 games each). One read-only reviewer: 3 findings (old saves recorded late, stale Daily blocked today's, bite on wrong prey in batched attacks), all fixed, the first two seen failing on the old code.
- **Open:** Tim's calls (achievement names, Daily setup, wording, simplifications); real iPhone.

## 2026-10-20: visibility pass (builder agent)
- **Asked** (Tim, through the manager): cards/board too small to see; fill the screen with the board, make dense parts readable.
- **Built:** `zoomTable` grows opponents, my boards and hand into empty wood (never cutting names/species); hand stays put on tap (`.settle`); desktop opponent rows wrap; laptop food cards overlap less; bigger phone food numbers; extra tap room on prey.
- **Verified:** engine 33, online 7, fx 8, edge 4, layout 10 (WebKit + Chrome); layout tests seen failing on the old build and on live before merge. Taps on prey hit in WebKit + Chrome at 393, 320, 659×393, 1280. One read-only reviewer; its two regressions (cut name, clipped species) fixed.
- **Open:** 6 players on phone still small (packed); real iPhone.

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
