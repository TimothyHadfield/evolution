# Evolution Lab: progress

## START HERE
Read in this order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md`.
Last updated: 2026-10-20 (sound & effects).

## Goal right now
Evolution (North Star Games, base game, 2nd edition) as a site with:
- play against Easy / Medium / Hard computers or friends online;
- odds at each decision;
- study notes with points lost;
- a Lab of trait data from simulation.

Live: https://timothyhadfield.github.io/evolution/

## Status
| Part | State |
|---|---|
| Deck (129 cards, 17 traits, exact food numbers) | Done, tested |
| Rules engine (2017 rulebook, Quick Play variant, 2–6 players) | Done, 33 tests |
| Computers (Easy, Medium, Hard) | Done. 2 players: Hard beats Easy 99%, Medium 73%; Medium beats Easy 77% (1,400 games). At a 4-player table against three Medium: Hard wins 52% (fair share 25%) |
| Odds (hole forecast, food needed, threat map) | Done |
| Lab (traits, pairs, "Can it eat?", food deck) | Done (600 Hard games) |
| Study (notes against Hard, score race, rounds) | Done |
| Online seats (shared `_online` layer, re-copied at 0b193d8) | Done: 7 node tests + two headless WebKit browsers played a full game with a reload mid-game, same result on both, no console errors |
| QA pass (fresh agent, 2026-10-20) | 6 findings, all fixed except: deck emptying exactly at 0 during a deal doesn't end the game that round (rule reading: there were enough cards) |
| Sound & effects (2026-10-20) | Done. `js/fx.js` (shared `_fx` copy, never edit) + `js/game-fx.js` (event map). Settings > "Sound & effects". 8 tests in `tests/fx.test.js`, 3 mutations seen failing |
| Design pass (2026-10-20) | Done. 4–6 players on phone: opponents in two compact columns, no scrolling (measured 175/175 px at 393 px). Opponent trait icons on family colours, gold phase title on your turn, red glowing prey while attacking, open trait slots, soft-hyphen trait names, bigger desktop board. Screens: scratchpad `design/evolution/before` + `after` |

## Authorized next steps
- (none beyond the brief)

## Standing instructions (Tim's words)
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game"
- "Really work on the webdesign… art, fitting it with an iphone and computer… make sure that everything works properlly without errors"
- "Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)

## Sound map (event → sound, animation)
Driven by `EvoFx.diff(prevView, nextView, me)` on every table render, so computers and online players sound the same as on this device (theirs at 0.8 volume, never louder). My own card plays sound when I tap (they are planned locally), not again on Done.
| Event | Sound | Animation |
|---|---|---|
| New game | `shuffle`, then `cardDeal` per card | cards fly from the Deck pill into the hand |
| Deal at a round start / cards drawn for an extinct species | `cardDeal` per new card (max 7) | same fly-in |
| Food card placed at the watering hole (me on tap, others on change) | `cardSlide` | my card glides to the hole; face-down pile pops |
| Trait card played onto a species (tuck) | `tuck` (defined here) | card glides to the species, species pops |
| New species board | `place` | card glides to the +; board pops in |
| Body size / population +1 | `grow` (body lower pitch) | species pops |
| Discard a trait / Undo | `cardSlide` | — |
| Reveal: food cards (and traits) flip | `cardFlip` × food cards (max 4) | "+N"/"−N" floats on the food number |
| Plant food taken (also Long Neck, Intelligence) | `crunch` (defined here) | eater pops, "+N" floats |
| Cooperation / chain feeding | `pop`, rising pitch per extra species | each pops in turn, "+1" floats |
| Carnivore attack | `snap` (defined here) then `hit`; meat eaten = `crunch` lower | prey shakes (or its owner's row if it died) |
| Horns | `hit` (higher, softer) | attacker shakes |
| Scavenger | `pop` | scavenger pops |
| Species extinct | `extinct` (defined here; max 2 sounds per step) | owner's row flashes red |
| Starving | `miss` (max 2 per step) | — |
| Becomes MY turn (not every turn) | `turn` | phase title pulses |
| Illegal tap / rejected move | `error` | species shakes |
| Big moment (my carnivore eats 4+ meat, my species reaches 6) | `celebrate big` | sparkles at the species |
| Game over | `drumroll` while totals count up, then `celebrate win` (my colour) or `lose` | confetti / dim |
One step's sounds are squeezed into ~1.8 s (0.8 s before a result) so sound never lags the table.

## Traps
- `bank_Evolution.html` in the parent folder is a different project. Don't touch it.
- The online layer is a copy. Re-copy `_online/online.js` when `_online` changes. Never edit it here.
- In the online public view, `canPass` is always false (the view is for seat −1). The screen works it out from `feedOptions` itself.
- The game-over card (`#over`) covers only the play view, so the tabs stay usable. Tapping its dark backdrop hides it.
- Before 1.1, the computers put Carnivore on body-1 species and never grew them, so carnivores starved (Lab showed 0.03 food a round). `choosePlays` now grows a carnivore until it has prey. Watch for this if bots change.
- `js/fx.js` is a byte-for-byte copy of `_fx/fx.js`. Never edit it; re-copy it. Game sounds the library lacks go in `js/game-fx.js` `define()`.
- fx.js injects its own `.switch`/`.seg` styles; `#set-fx` rules in index.html put the site's own look back. Check Settings if fx.js is re-copied.
- fx.js before 1.0.1 moved confetti per frame, so it crawled in headless WebKit; 1.0.3 (copied here) is time-based. Keep the copy current.
- Local port 8473 is often taken by other game sites. Use another port for local serving.
- A local test server must send `charset=utf-8`, or the log shows "Youâ€™s" (GitHub Pages already does).
- Phone layout: the opps row is `minmax(0, max-content)` and the hand row takes the free space. With 4+ players, `.opps.many` (two columns) and `#game.crowd` turn on. If opponent minis grow, re-measure at 393 px with 6 players.

## Decisions
- 2nd edition, 2017 rulebook; the 1st printing is parked.
- Quick Play is a Settings switch, forced on at 6 players.
- Simplifications:
  - Intelligence only on your own feeding turn;
  - leaf-trait order fixed (Fertile → Fat Tissue → Long Neck);
  - Scavengers take meat clockwise from the attacker.
- Meat is capped at hunger plus fat room (reasoned).

## NOT verified
- On Tim's real iPhone (only checked in WebKit at 393 px).
- A full online game between two real phones.
- Whether food numbers changed in printings after 2017.
- How the sounds actually sound (headless browsers have no audio): only checked by node tests with a fake AudioContext.
- Confetti and animations on a real iPhone (checked in WebKit at 393 px only).
- Sounds in a real two-phone online game (same diff code as local, reasoned).
- Page with storage blocked (fx.js and the app both wrap storage in try/catch; reasoned, not run).

## Rejected / parked
- ~~Flight, Climate, Oceans~~: no public card lists to cross-check.
- ~~1st printing deck~~: only 3 traits' old values are known.
