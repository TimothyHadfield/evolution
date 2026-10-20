# Evolution Lab: progress

## START HERE
Read in this order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md`.
Last updated: 2026-10-20 (design pass).

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
| Design pass (2026-10-20) | Done. 4–6 players on phone: opponents in two compact columns, no scrolling (measured 175/175 px at 393 px). Opponent trait icons on family colours, gold phase title on your turn, red glowing prey while attacking, open trait slots, soft-hyphen trait names, bigger desktop board. Screens: scratchpad `design/evolution/before` + `after` |

## Authorized next steps
- (none beyond the brief)

## Standing instructions (Tim's words)
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game"
- "Really work on the webdesign… art, fitting it with an iphone and computer… make sure that everything works properlly without errors"
- "Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."

## Traps
- `bank_Evolution.html` in the parent folder is a different project. Don't touch it.
- The online layer is a copy. Re-copy `_online/online.js` when `_online` changes. Never edit it here.
- In the online public view, `canPass` is always false (the view is for seat −1). The screen works it out from `feedOptions` itself.
- The game-over card (`#over`) covers only the play view, so the tabs stay usable. Tapping its dark backdrop hides it.
- Before 1.1, the computers put Carnivore on body-1 species and never grew them, so carnivores starved (Lab showed 0.03 food a round). `choosePlays` now grows a carnivore until it has prey. Watch for this if bots change.
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

## Rejected / parked
- ~~Flight, Climate, Oceans~~: no public card lists to cross-check.
- ~~1st printing deck~~: only 3 traits' old values are known.
