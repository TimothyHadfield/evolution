# Evolution: rules check

**Edition built:** Evolution, North Star Games, **2nd edition (2015 onward), 2017 rulebook** (the one with food screens). The base game is 129 trait cards, 17 traits, 2–6 players. Flight and the promo packs are optional (section "Flight and the promo packs").

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
- **Food cards** [R]: each player places one card face down at once. (This site places it during your play turn instead; see "Food card in the play turn" below.)
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
- **Food card in the play turn** (Tim's chosen variant, 2026-11-09; the rulebook [R] has everyone place food cards first, at once). Tim: "make the card playing stage more fluid for the user so that they can choose to do any order of the playing cards, upgrading, etc. ... Basically keep everything the same except allow the user to choose when they place it in the watering hole". Engine: new games carry `s.fluid` (default on; old saves without it keep the two-step flow). Rounds start straight in `play`; the play action is `{t:'play', moves, food}`, and `food` is required while you held cards, must be in your hand and can't be a card a move uses (empty hand: no food card). Food cards stay hidden until the reveal, and the hole sum is unchanged. Computers pick the food card first (same choice as before), then their plays from the rest. The guided first game stays two-step. Daily, vs-computer and online games are fluid. Tests: `tests/fluid.test.js` (11, 10 seen failing on the old engine), `tests/fluid-ui.mjs` (seen failing on the old code). Ladder, 400 games per pairing, classic → fluid: Hard>Easy 98.5 → 98.5%, Hard>Medium 72.8 → 73.0%, Medium>Easy 77.4 → 77.4%, Hard at 4 players 51.5 → 53.0%, at 3 players 57.5 → 57.0%.

## Flight and the promo packs (built 2026-11-09; tests: `tests/flight.test.js`, 36, every one seen failing on the old engine)
Sources, details in [expansions-research.md](expansions-research.md):
| # | Source | Used for |
|---|---|---|
| F | Official Evolution: Flight 2015 rulebook PDF (in TTS mod 2041385428): https://steamusercontent-a.akamaihd.net/ugc/1029576743442596773/19637A42B84D25D110ED0D83240B65F4EE0B8A45/ | Every Flight rule below |
| F2 | https://www.ultraboardgames.com/evolution/flight.php and https://rulespal.com/evolution-flight/rulebook | Cross-check of the Flight rules |
| FS | Flight card scan (TTS mod 937, sheet 664) + the rulebook's 8 sample cards | Flight food numbers |
| P2 | https://rulespal.com/evolution-promo-pack-ii/rulebook and https://boardmatch.app/en/game/181592 | Promo Pack II cards and food numbers |
| P3 | Promo Pack III rules PDF: https://cdn.shopify.com/s/files/1/0283/4324/files/promo_pack_iii_rules_pdf.pdf (+ https://nemestats.com/GameDefinition/Details/123959) | Promo Pack III traits, scenarios |

- **Versions** (setup picker): Base, Base + Flight, Climate (one choice, so Flight and Climate are never together). Add-ons: Promo Pack I, Promo Pack II, Promo Pack II extras (estimated), Promo Pack III traits (estimated), one scenario. Old saves without `exp` are the base game (test "old base saves…"). The Daily and the guided game stay base.
- **Deck** [F, FS]: base 129 + 48 Flight cards = 177 (34 traits + 14 events; Flight Carnivores −4,−3,−2,−1,7,8; the rest −1..5). The 12 Flight cards stay beside the board. Ids 0–128 never moved (test "deck sizes…").
- **Set-up** [F Set-Up 3]: 40 cards are set aside; when the deck runs out they are used for the final round instead of shuffling the discards (tests "Flight set-up…", "when the deck runs out…").
- **Cliff** [F, F2]: gets plant food equal to the number of players when the food cards are revealed; only an Avian plant eater eats there, one food per feeding (tests "the cliff gets…", "only an Avian…").
- **Avian species** [F]: costs 2 cards; population 1, body 1, a Flight card on it; body size at most 3; first eats food equal to its body size (upkeep, back to the bank, never scored) (tests "an Avian species costs…", "body size stops at 3", "Avian upkeep…").
- **Flight card** [F]: only a Carnivore with Flight may attack it; a Carnivore with Flight may discard a card to switch off Warning Call, Symbiosis or Climbing; it fills a trait slot and scores 1; swapping it out makes a land species for good; a dead Avian's Flight card goes back beside the board (tests "Flight defends…", "…switch off Warning Call…", "dropping Flight…", "a dead Avian's Flight card…").
- **Brood Parasite, Camouflage, Good Eyesight, Nesting** [F, F2]: as printed; Brood Parasite and a plant eater's Good Eyesight act with the leaf traits, in turn order from the first player [F "Timing issues"]. Nesting's land food comes from the bank (the rulebook allows bank or watering hole; the bank is never worse, reasoned).
- **Events** [F]: Dive-Bomb and Seed Dispersal are discarded after traits are revealed (the event step, players in turn order), then you draw 1; an event drawn this way may be played at once. Event cards are never traits (tests "event step: …", "event cards are never played as traits").
- **Promo Pack I** [P2/P3 lists, exact]: Unstable DNA (test "Unstable DNA…").
- **Promo Pack II** [P2, exact food numbers]: Last Stand (the attack waits while the owner decides), Pest, Pounce (one defending trait ignored for free), Quills, Sharp Teeth (tests named after each).
- **Promo Pack II extras, Promo Pack III traits** [P2, P3]: Invasive Species, Rapid Mutation, Claws, Coprophagia, Insectivore, Mimicry, Timid, Trampling. **Food numbers are not published: estimated −1..5**, labelled "estimated food numbers" in the picker and Card info.
- **Promo cards are added to the deck**, not swapped for same-colour base cards as the P3 sheet says: we don't have the card colours (reasoned; listed as a design choice).
- **Scenarios** [P3]: Cretaceous Period, Great Permian Extinction, Land of Plenty, Plant Life Explosion, Teeming Hordes, Radioactive Atmosphere (one source, rulespal). Test "scenarios: …".
- **Not built**: Darwinian Selection (never looking at your hand doesn't fit a phone screen), Runaway Warming and Snowball Earth (Climate only), the Plant micro-expansion (fill formula not confirmed), the single promos (Gigantism, ESP, Night Prowler, Hibernation: one source each, no rules text).
- **Computers**: every new card and action; 25 seeded games across 5 versions end with every card accounted for (test "computers play legal moves…"). Ladder, 300 games each (Easy / Medium / Hard win share): Flight 0.7 / 12.8 / 86.5%, Flight + all promos 0.3 / 2.3 / 97.3%, Base + all promos 0.8 / 8.5 / 90.7% (base alone 1.3 / 28.3 / 70.3%).
- **Online**: rooms carry the version; the public view shows the cliff and version and never the hands, seed or set-aside cards (test "online: a Flight room…").

## Evolution: Climate (version `climate`, checked 2026-11-09)
Sources: **[CR]** the official [Climate rulebook PDF](https://cdn.shopify.com/s/files/1/0283/4324/files/Evolution-Climate-Rules-web.pdf); **[TTS]** card faces from Tabletop Simulator mods 937109867 and 2425085506 (two sources agree on every event); the full write-up and card table are in `docs/expansions-research.md` and `docs/expansions-data.json`. Code: `js/climate.js` (rules), small commented hooks in `js/engine.js`, cards 1000–1085 at the end of `js/cards.js`. All tests are in `tests/climate.test.js` (32); 30 of them failed on the pre-Climate code, and a 9-mutation run of `climate.js` was caught every time.
- **Deck** [CR, TTS]: base deck minus Ambush, Burrowing, Defensive Herding and Carnivore (91 cards) + the 86 Climate cards = 177. Every card has 0–2 suns or snowflakes. Test "deck: 177 cards…", "deck: exact food + icons…".
- **Setup** [CR]: set aside cards by players (2: half the deck, 3: 60, 4: 30, 5–6: none); max traits 3 at 2 players, else 4; deal 4 + 1 per species. Test "setup: set-aside cards…".
- **Deck runs out** [CR]: the set-aside cards become the deck (not the discards) and the round is the last. Test "deck runs out…".
- **Swap** [CR]: after playing, a player may put cards under the deck and draw as many (at most the deck size). Base games refuse it. Test "cycling…".
- **Marker** [CR]: after the reveal, more suns → 1 zone warmer, more snowflakes → 1 colder, a tie stays; it stops at the ends. Test "marker…".
- **Zones** [CR]: 9 zones, each with the body sizes it hits, the population loss and a leaf of food for 2–3 or 4–6 players. A negative leaf removes food, never below 0. Tests "heat loss…", "cold loss…", "cold zone…", "plant food = food cards + the zone leaf…".
- **Protections** [CR, TTS]: Burrowing blocks 1 heat; Cooling Frills 3 heat; Heavy Fur 4 cold and loses 1 more to heat; Defensive Herding, Hibernation and Migratory block 1 cold each, and they stack. Extinction from climate loss draws cards as usual. Tests "heat loss…", "cold loss…".
- **Events** [CR, TTS]: 30 cards (cold and hot decks shuffled apart), 1 cold + 1 hot face up under their zones. When the marker lands on an event's zone it replaces that zone's effect for the round, then goes to the bottom of its deck and is replaced; the new card can't trigger until next round; at most 1 event a round. Special cards: Meteorite (no positive plant food for the rest of the game), Volcanic Eruption (moves the marker after feeding), Glacial Thaw (3 extra suns next round), Desertification (every species −1 body, not below 1; no positive food), Wildfire (species without Burrowing lose 1; the round's food waits for the next deal). Tests "setup: one cold and one hot event…" and every "event: …" test.
- **New traits** [CR, TTS]: Hibernation (up to 2 unfed population are not hungry and don't starve), Migratory (after feeding, with the hole empty, takes 2 plant food from the bank), Mud Wallowing (the attacker discards a card per attack), Cooling Frills (+2 size against attacks, not more meat), Heavy Fur (cold protection), Nocturnal (a free feeding before each of your feeding turns when no Carnivore could attack it). Changed: Ambush ignores one defending trait for free. Tests named after each trait.
- **Simplifications in this build** (reasoned; listed for Tim):
  - Nocturnal is applied automatically (no choice of which species; the threatening Carnivore is the biggest rival, no cards spent).
  - A Mud Wallowing attack is never forced on a hungry Carnivore that can't pay.
  - Heavy Fur's extra heat loss applies only in the hot zones (6–8).
  - Desertification also caps Fat Tissue; Wildfire also holds back a negative total.
  - Migratory with Foraging can take 3.
  - At 2 players the set-aside pile is floor(177/2) = 88.
  - Events are on by default; `events:false` is the no-events variant [CR].
  - Computers never Swap. The forecast in the watering hole uses only the current zone.
  - The attack log may name "Intelligence" for Ambush's free ignore.
- **Computers**: 150 seeded Climate games at 2–6 players end with every move legal and all cards accounted for (test "computers: 150…"). Ladder, 400 games per pairing (`node tools/climate-sim.js 400 climate`): Hard>Easy 99.0%, Hard>Medium 69.0%, Medium>Easy 77.3%, Hard vs three Mediums 52.0% (fair share 25%). Base games are unchanged (300 seeded games identical to the previous engine).
- **Merged with Flight** (2026-11-09): one version setting `exp = {v, promos, scen}` (Climate adds `events`); one card lookup `EvoCards.CARD` for ids 0–286 and 1000–1085. The promo packs are greyed out under Climate with "not with Climate" (they lean on Flight's event step, and Last Stand/Pounce don't know Mud Wallowing's cost; no designer guidance on mixing them; reasoned). Scenarios stay allowed with Climate; scenario trait limits apply after Climate's own limit.

## Simplifications
- **Scavenger order:** Scavengers take meat clockwise from the attacker. The food bank is unlimited, so the order can't change a result (reasoned).

## Could not confirm (decided by reasoning)
- **Can a Carnivore take more meat than its hunger?** The rulebook says no species holds more food than its population, unless it has Fat Tissue. We cap meat at hunger plus fat room.
- **Later printings:** whether any food number changed after 2017. The Climate reprints use different numbers, so this site does not mix in Climate cards.

## Parked
- ~~**Flight**~~: built 2026-11-09 from the card scan and the 2015 rulebook (see "Flight and the promo packs" above).
- ~~**Climate**~~: built 2026-11-09 (see "Evolution: Climate" above).
- **Oceans** stays parked (a different game).
- **1st printing (2014)**: higher numbers on Long Neck, Defensive Herding and Carnivore, Hard Shell +3, and Pack Hunting +3. Only three traits' values are published (thread 1362641), so a full 1st-printing deck can't be checked.
