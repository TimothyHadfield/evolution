# Evolution: rules check

**Edition built:** Evolution, North Star Games, **2nd edition (2015 onward), 2017 rulebook** (the one with food screens). This is the base game only: 129 trait cards, 17 traits, 2–6 players.

Status: every number below is asserted by `tests/engine.test.js`.
- Each rule has at least two sources.
- The "Could not confirm" list at the end gives the rules we decided by reasoning.

## Sources
| # | Source | Used for |
|---|---|---|
| R | Official 2017 rulebook PDF: https://cdn.shopify.com/s/files/1/0283/4324/files/Evolution-Rules-Web_1.pdf (mirror: https://aadl.org/files/catalog_guides/games-rules-evolution-eng.pdf) | Phases, feeding, traits, scoring, 2 and 6 players, sample card values |
| S | Card faces in the Tabletop Simulator mod of the 2nd-edition deck: https://steamcommunity.com/sharedfiles/filedetails/?id=2066510123 | Every food number on every card |
| H | Food-value histogram of the 2nd printing: https://boardgamegeek.com/thread/1327445, confirmed by the designer in https://boardgamegeek.com/thread/1362641 | Cross-check of all 129 food numbers |
| T | Per-trait totals: https://boardgamegeek.com/thread/1425118 | Cross-check (Long Neck 42, Ambush 0, Pack Hunting 0) |
| C | Card counts (17 Carnivore + 7 of each other trait): rulebook component list, and the designer in https://boardgamegeek.com/thread/1253070 | Deck size |
| D | Designer rulings (Dominic Crapuchettes): Intelligence https://boardgamegeek.com/thread/1269546, Foraging https://boardgamegeek.com/thread/1258842, Cooperation and Fat Tissue https://boardgamegeek.com/thread/1410770 | Trait timing |
| N | North Star's 2nd-edition changes page: https://www.northstargames.com/pages/evolution-2nd-edition-changes | Hard Shell +4, Pack Hunting = population |

## The deck (sources S + H + T + C, test "deck: …")
| Trait | Copies | Food numbers |
|---|---|---|
| Carnivore | 17 | 0,0,1,1,2,2,2,3,3,3,4,4,4,5,5,6,6 |
| Ambush, Pack Hunting | 7 each | −3,−2,−1,0,1,2,3 |
| Burrowing, Climbing, Hard Shell, Horns, Symbiosis, Warning Call | 7 each | 1,2,3,3,4,4,5 |
| Cooperation | 7 | 0,3,3,4,4,5,5 |
| Defensive Herding | 7 | 2,3,4,5,6,7,8 |
| Fat Tissue | 7 | −1,0,3,4,4,5,5 |
| Fertile, Foraging, Scavenger | 7 each | 2,3,4,5,6,6,7 |
| Intelligence | 7 | −2,−1,0,4,5,6,7 |
| Long Neck | 7 | 3,4,5,6,7,8,9 |

- Histogram of food values −3..9: 2,3,4,7,10,15,25,25,18,11,6,2,1. It matches source H exactly.
- Every sample card printed in the rulebook appears under the right trait.

## Rules (source in brackets; all in the tests)
- **Setup** [R]: one species per player (body size 1, population 1); random first player.
  - 2 players: remove 40 random cards; at most 2 traits per species.
  - 6 players: Quick Play is required.
- **Deal** [R]: 3 cards, plus 1 for each species you have. A player with no species gets a new one first.
- **Food cards** [R]: each player places one card face down at once.
- **Play cards** [R]: in turn order from the first player, one player at a time. With Quick Play (an optional variant [R]), everyone plays at once. Ways to play a card:
  - as a face-down trait (at most 3, no duplicates);
  - as a new species at either end;
  - as +1 body size or +1 population (maximum 6).
  - You may also discard a trait you already have.
- **Reveal** [R]:
  - Traits flip face up.
  - Fertile adds +1 population if the watering hole has food.
  - Fat Tissue moves stored food onto the species.
  - Long Neck takes 1 from the bank.
  - Then the food cards are added up. The hole never goes below 0.
- **Feeding** [R]: clockwise from the first player, one feeding per turn.
  - If a hungry species of yours can eat, you must feed. A Carnivore with only your own species to eat must attack it.
  - Passing doesn't end your feeding: you can still feed on later turns.
  - The round ends once everyone has passed or can't feed.
- **Attack** [R + N]:
  - The Carnivore must be bigger than the prey. Hard Shell adds 4 to the prey's size; Pack Hunting adds the attacker's population to its own size.
  - Defences:
    - Climbing: the attacker also needs Climbing.
    - Burrowing: safe once it has eaten its fill.
    - Defensive Herding: the attacker needs a bigger population.
    - Symbiosis: safe while its right neighbour has a bigger body.
    - Warning Call (on either neighbour): the attacker needs Ambush.
  - What happens:
    - Horns: the attacker loses 1 population first.
    - The prey loses 1 population.
    - The attacker takes meat equal to the prey's body size, up to its hunger.
- **Scavenger** [R + D]: takes 1 meat from the bank for every population lost to an attack, the attacker's own loss to Horns included.
- **Cooperation** [R + D]: the species to the right takes 1 of the same food from the same place, and it chains. Fat Tissue food sets it off; moving stored fat back does not.
- **Foraging** [R + D]: +1 plant food every time it takes plant food, from any source.
- **Intelligence** [R + D]: discard a card for an effect.
  - Plant eater: take 2 plant food from the bank.
  - Carnivore: switch off one defensive trait, all copies of it, for this attack. One card per trait.
  - It is a free extra on top of the normal feeding.
- **Food above population after an attack** [R]: goes behind the food screen.
- **Extinction** [R]: the player draws one card for each trait the species had. Its food is already scored.
- **End of round** [R]:
  - Population drops to the food eaten.
  - Food goes behind the screen.
  - Species at 0 go extinct.
  - The first-player marker passes left.
- **Game end** [R]: the deck runs out while dealing → this round is the last. If it runs out from extinction draws → the next round is the last. If the deck AND the discard pile are both empty when a card is needed, that counts as the deck running out (test `tests/edge.test.js`; before this the game could never end).
- **Score** [R]: food behind the screen + population of living species + traits on living species. Ties go to more trait points, then more population points.

- **Leaf traits' order** [R p.6, checked 2026-10-28]: "If a player has more than 1 of these cards in play, they choose the order in which their traits activate." The engine tries every order of a player's leaf cards (up to 6 cards) and, when the orders give different results, asks a person to pick one (phase `leaf`, action `{t:'leaf', k}`; the best order is listed first). Computers take the best order. Tests: `tests/engine.test.js` "reveal: the owner chooses…" (seen failing on the old engine), `tests/leaf-ui.mjs`, `tests/online.test.mjs` 1b. Measured in 300 computer games: order changed the result in 23 of 1,944 player-reveals with 2+ leaf cards; the old fixed order was never worse.
- **Intelligence timing** [R p.12, checked 2026-10-28]: "discard one or more cards from their hand during any of their feeding turns", "in addition to the player's normal feeding turn and as many times as you want". The engine already does exactly this (own feeding turn, repeatable). An earlier designer post (source D) allowed it any time; the 2017 rulebook we build narrows it to your feeding turns, so no change.

## Simplifications
- **Scavenger order:** Scavengers take meat clockwise from the attacker. The food bank is unlimited, so the order can't change a result (reasoned).

## Could not confirm (decided by reasoning)
- **Can a Carnivore take more meat than its hunger?** The rulebook says no species holds more food than its population, unless it has Fat Tissue. We cap meat at hunger plus fat room.
- **Later printings:** whether any food number changed after 2017. The Climate reprints use different numbers, so this site does not mix in Climate cards.

## Parked
- **Flight, Climate and Oceans**, each with its reason:
  - Flight adds new boards and 47 cards.
  - Climate is a standalone game with 177 cards and a climate track.
  - Oceans is a different game.
  - None of the three has a full public card list we could cross-check, so building one would mean guessing numbers.
- **1st printing (2014)**: higher numbers on Long Neck, Defensive Herding and Carnivore, Hard Shell +3, and Pack Hunting +3. Only three traits' values are published (thread 1362641), so a full 1st-printing deck can't be checked.
