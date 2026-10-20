# Evolution Lab: progress

## START HERE
Read in this order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md`.
Last updated: 2026-10-20 (first build).

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
| Computers (Easy, Medium, Hard) | Done. 2 players: Hard beats Easy 89%, Medium 70%; Medium beats Easy 83% (1,400 games). At a 4-player table against three Medium: Hard wins 29% (fair share 25%) |
| Odds (hole forecast, food needed, threat map) | Done |
| Lab (traits, pairs, "Can it eat?", food deck) | Done (600 Hard games) |
| Study (notes against Hard, score race, rounds) | Done |
| Online seats (shared `_online` layer) | Done, local tests. A two-browser test may still be NOT verified (see below) |

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
- Local port 8473 is often taken by other game sites. Use another port for local serving.

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
