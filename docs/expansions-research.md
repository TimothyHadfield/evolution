# Evolution expansions: research (2026-11-09)

Tim's ask: "Also could you build all expansion versions with flight, event cards, and varius other cards? Allow the user to choose if they're using expansion or varius versions. Make sure game machanics are still functional."

Machine-readable data: [expansions-data.json](expansions-data.json). Base game data stays in `js/cards.js`.

## Summary

| Product | What it is | Buildable with exact data? | What's missing |
|---|---|---|---|
| **Flight** (2015 KS / 2016) | Expansion: Avian species, Cliff, 4 traits, extra Carnivores, 2 event types | **Yes** (rules: exact, 2 sources incl. official rulebook; food: exact, 1 source + rulebook spot-check) | An independent second scan of all 48 cards (none exists online that I could reach) |
| **Climate** standalone + **Conversion Pack** (2016) | Climate board, 6 new traits, climate icons, 30 events | **Yes**: traits and all 30 events exact, 2 sources; event setup from the rulebook | — |
| **Promo Pack I** | 7 × Unstable DNA (+ alt-art boards) | **Yes** (exact, 1 source) | — |
| **Promo Pack II** (2015) | 7 promo traits/events | **Yes for 5 of 7** (exact, 1 source); Invasive Species and Rapid Mutation food **missing** | Per-copy food of those two (default −1..5, flagged) |
| **Promo Pack III** (2016) | 6 traits, Plant micro-expansion, 9 scenario cards | **Partial**: all 9 scenarios + Plant rules yes, trait food **missing** | Per-copy food of all 6 traits (default −1..5, flagged); Plant fill formula |
| Single promos (Gigantism, ESP, Night Prowler, Hibernation) | One card each | **Partial** | Whether 7-copy sets exist |
| **The Beginning** (2018) | Separate simplified family game | **Partial** (rules complete) | Count of each of 10 traits in 88 cards |
| **Oceans** (2020) | Separate North Star game in the series | **No**: a new game, not an add-on | Would be its own project |
| **Random Mutations** | Different game (Rightgames, Russia) | **No** | Not North Star, not compatible |
| **New World** (2023) | Different game (Rightgames) | **No** | Not North Star, not compatible |
| **"Variations"** | Not found as a product | n/a | Closest: PP3 scenario cards + Climate no-events variant |
| Aquatic Deck (in a TTS mod) | Fan-made | No (not official) | — |

**Recommended options for the site:** Base · +Flight · Climate (base + conversion) · promo toggles (PP I, PP II, PP III scenarios). Flight and Climate should not be offered together (designers' guidance); Plant micro-expansion is not compatible with Flight.

## How the data was obtained

- Card faces were read from Tabletop Simulator saves on Steam Workshop, mainly **mod 937109867** ("Evolution + Expansions") and **mod 2425085506** ("Evolution Climate semi-scripted"). The saves were fetched with the Steam API, decoded from BSON, and the card sheets cropped and read by eye.
- Rules come from official North Star PDFs and rules summaries (ultraboardgames, rulespal).
- Confidence:
  - **exact**: read from the card images.
  - **exact (2 sources)**: two independent mods agree.
  - **partial**: name and effect known, per-copy numbers not.
- This disproves the older note in rules-check.md ("Parked: Flight/Climate have no public card lists").

## Cross-check pass (2026-11-09, second round)

| Item | Result | Label |
|---|---|---|
| Flight food numbers (48 deck cards) | Every TTS mod with Flight (937, 916, 1803181337, 896622326, 2041385428, 2135629760) uses one **byte-identical** image (SHA1 74AF0B5B…), so it counts as one source. Mod 896's separate Dropbox scan is dead. The North Star print-and-play page returns 429. The **official 2015 Flight rulebook** (found as a PDF inside mod 2041385428) shows 8 sample cards, and all of them fit the lists: Brood Parasite 5, Dive-Bomb 4 and 2, Camouflage −1, Good Eyesight −1, Nesting 0, Seed Dispersal 1 and −1. | exact, 1 source (+ rulebook spot-check) |
| Flight's 12 Flight cards | The rulebook picture matches the card text and shows **no food number**. | exact, 2 sources |
| Flight "set aside 40 cards" | The official rulebook says: *"Remove 40 cards from the deck and place them off to the side. These cards will be used at the end of the game instead of shuffling the discard pile."* | exact, 2 sources |
| Climate events (all 30) | Mod 2425's separately made sheets (5×3 grid, different file) agree with mod 937 on every card: zone, name, sizes, icons, leaf and target zone. | exact, 2 sources |
| Climate event setup | The rulebook says: shuffle the Cold and Hot decks separately, put the top card of each face-up under its named zone, and always keep **1 cold + 1 hot** face-up. A triggered card goes to the **bottom of its deck** and is replaced from the same deck; the new card can't trigger until next round. At most 1 event triggers per round. | exact, 1 source (official) |
| Pest food | The card scan clearly shows −1..5. Rulespal's single "−4" comes from a page that admits it used low-res scans, so it is probably a misread. | exact, 1 source |
| Invasive Species food | The only scan repeats one −1 face 7 times. | missing |
| Rapid Mutation food | No TTS mod has the card; rulespal shows one copy at −1. | missing |
| PP3 traits' food (6 traits) | The only scan repeats one face per trait (all "1"). Rulespal shows no numbers. | missing |
| PP3 9th scenario | **Radioactive Atmosphere**: draw 2 cards per species instead of 1 (rulespal). | exact, 1 source |

Default for the missing promo food numbers: −1, 0, 1, 2, 3, 4, 5. Every other 7-card promo and Flight trait uses that spread (reasoned); flag it in the UI or the code.

## Flight

**Sources:**
- **Official 2015 rulebook PDF**, embedded in TTS mod 2041385428 ([link](https://steamusercontent-a.akamaihd.net/ugc/1029576743442596773/19637A42B84D25D110ED0D83240B65F4EE0B8A45/)). It confirms every rule below.
- [ultraboardgames rules](https://www.ultraboardgames.com/evolution/flight.php)
- [rulespal rulebook](https://rulespal.com/evolution-flight/rulebook)
- [official print-and-play](https://northstargames.com/products/make-your-own-copy-of-evolution-flight)
- Mod 937 sheet 664 (indices 9–56) and sheets 671/672

**Components:** 48 deck cards (34 traits + 14 events), 12 Flight cards (kept out of the deck), 12 Avian boards, and the Cliff board.

| Card | Kind | Copies | Food per copy | Effect (paraphrased) |
|---|---|---|---|---|
| Brood Parasite | trait | 7 | −1,0,1,2,3,4,5 | Avian with another Avian: before reveal, +1 pop and take 1 plant/meat from bank. Land: nothing. |
| Camouflage | trait (defence) | 7 | −1..5 | Carnivore needs Good Eyesight to attack. |
| Good Eyesight | trait | 7 | −1..5 | Carnivore: negates Camouflage. Non-Carnivore: before reveal, take 2 food from Watering Hole. |
| Nesting | trait | 7 | −1..5 | Per pop gained: Land takes 1 plant (bank or WH); Avian takes 2 meat. |
| Carnivore | trait | 6 | −4,−3,−2,−1,7,8 | Extra Carnivores. |
| Dive-Bomb | event | 7 | −1..5 | Discard in Play Cards after reveal: feed one of your Avians (Carnivore attacks; non-Carnivore takes 2 plant from WH, Cliff or bank); draw a card. |
| Seed Dispersal | event | 7 | −1..5 | Discard in Play Cards after reveal: add food to WH = number of Avians in play; draw a card. |
| Flight | species card ×12 | — | none | Only Carnivores with Flight can attack it; non-Carnivore may eat from the Cliff; Carnivore with Flight may discard a card to negate Warning Call, Symbiosis or Climbing on its next attack. Scores 1. |

**Rules:**
- Setup: shuffle the 48 cards into the deck, then remove 40 cards and set them aside. When the deck runs out, those 40 cards are used for the final round **instead of shuffling the discard pile**.
- Brood Parasite's population gain triggers Cooperation, Nesting and Foraging.
- If Dive-Bomb or Seed Dispersal draws another event, that event may be played at once.
- Avian species:
  - A new Avian costs 2 cards. It starts at population 1, body size 1, with Flight.
  - Maximum body size is 3.
  - **Upkeep:** an Avian first eats food equal to its body size. That food goes back to the bank and is not scored.
- Flight card:
  - It uses one of the 3 trait slots, scores 1 point, and can be negated by Intelligence.
  - Swapping Flight out makes the species a Land species, permanently.
- **Cliff:**
  - When the food cards are revealed, it gets plant food equal to the number of players.
  - Only Avians may eat from it, and never in the same feeding turn as the Watering Hole.
  - Cooperation and Foraging still trigger.
- Events are discarded from hand for an immediate effect.
- Simultaneous triggers resolve in turn order.

## Climate (standalone) and Climate Conversion Pack

**Sources:**
- [Climate rulebook PDF](https://cdn.shopify.com/s/files/1/0283/4324/files/Evolution-Climate-Rules-web.pdf)
- Mod 937 sheets 661/662/669/670
- Mod 2425 sheets 4/4959 and the board image

**Deck:** 177 cards = the base 2nd-edition deck minus Ambush, Burrowing, Defensive Herding and Carnivore (the **91** cards left are unchanged, with no icons), plus the **86** conversion cards below.
- Check: 129 − 7 − 7 − 7 − 17 = 91.
- Notation: S = suns, C = snowflakes, so `−3S3` means food −3 with 3 suns.
- Mods 937 and 2425 agree on every card.

| Trait | Copies | Copies (food + icons) | Effect |
|---|---|---|---|
| Ambush | 7 | −3S3, −2C2, 3S2, 2C1, 0C1, 1S1, −1S1 | Base, plus it ignores one defensive trait against Migratory |
| Burrowing | 7 | 5S3, 4C2, 1S2, 2C1, 3C1, 3S1, 4S1 | Base, plus it prevents 1 heat and 1 cold loss |
| Defensive Herding | 7 | 2C3, 8C2, 3S2, 4C1, 6C1, 5S1, 7S1 | Base, plus it prevents 1 cold loss |
| Carnivore | 23 | 3S4, 2S4, 3C4, 4C4, 2C3, 1S2, 6C2, 4C1×3, 5C1×2, 6C1, 3S1×3, 2S1×3, 1S1×2, 0S1×2 | Base |
| Cooling Frills | 7 | −4S3, −2C2, 9S2, 7C1, 2C1, 0S1, 5S1 | +2 body size when attacked; prevents 3 heat loss |
| Heavy Fur | 7 | 10C3, −5C2, 8S2, 6C1, −1C1, −3S1, 1S1 | Prevents 4 cold loss; +1 heat loss in Tropical, Hot and Scorching |
| Hibernation | 7 | −3C3, 8C2, −1S2, 1C1, 4C1, 3S1, 6S1 | Ignores up to 2 unfed population when checking hunger (they don't starve); prevents 1 cold loss |
| Migratory | 7 | 5C3, 0C2, 4S2, 2C1, 3C1, 1S1, 2S1 | After feeding, if the Watering Hole is empty, take up to 2 plant food from the bank; prevents 1 heat and 1 cold loss |
| Mud Wallowing | 7 | 7S3, 5C2, −2S2, 0C1, 3C1, 3S1, 2S1 | The attacker discards a card before each attack; prevents 1 heat loss |
| Nocturnal | 7 | −1S3, 1C2, 6S2, 4C1, 2C1, 2S1, 3S1 | Free feeding before your turn if no Carnivore in play could attack it; prevents 1 heat loss |

**Climate board** (marker starts at Temperate):

| Zone | Body sizes hit | Pop lost | Leaf 2–3p | Leaf 4–6p |
|---|---|---|---|---|
| Ice Age | 1–6 | 4 cold | −15 | −30 |
| Freezing | 1–4 | 2 cold | −8 | −16 |
| Cold | 1–2 | 1 cold | −4 | −8 |
| Cool | – | – | −2 | −4 |
| Temperate | – | – | 0 | 0 |
| Warm | – | – | +2 | +4 |
| Tropical | 5–6 | 1 heat | +6 | +12 |
| Hot | 3–6 | 2 heat | +3 | +6 |
| Scorching | 1–6 | 4 heat | −10 | −20 |

**Events** (15 cold + 15 hot; exact, 2 sources). Each card sits under its named zone and triggers only when the marker is there. There is always **1 cold + 1 hot** face-up, and at most 1 triggers per round. A triggered card goes to the bottom of its deck and is replaced from that same deck. Full list in the JSON.
- Cold deck: Meteorite 1, Volcanic Eruption 3, Glacial Thaw 2, Heat Wave 5, Cold Snap 4.
- Hot deck: Meteorite 1, Volcanic Eruption 2, Desertification 2, Wildfire 3, Heat Wave 4, Cold Snap 3.
- **Heat Wave / Cold Snap:** replace that zone's effect this round with the card's own sizes, loss and leaf.
- **Meteorite:** no positive plant food for the rest of the game.
- **Volcanic Eruption:** at the end of feeding, move the marker to the named zone.
- **Glacial Thaw:** +3 suns next round.
- **Desertification:** no positive food this round; every species above body size 1 loses 1 body size.
- **Wildfire:** every species without Burrowing loses 1 population; this round's food is held back until the next Deal.

**Rule changes:**
- Deal 4 + 1 per species.
- Maximum 4 traits per species (3 at 2 players).
- Deck trimmed by player count:
  - 2 players: remove half the deck.
  - 3 players: remove 60 cards.
  - 4 players: remove 30 cards.
  - 5–6 players: remove none.
  - The removed cards become the restock deck.
- You may cycle cards to the bottom of the deck after playing cards.
- New phase, **Modify Environment:**
  1. "Before reveal" traits trigger.
  2. Reveal the food cards. The marker moves 1 zone toward whichever of suns or snowflakes is more numerous.
  3. The event in the marker's zone triggers.
  4. Climate population loss, applied simultaneously, minus each species' protections.
  5. Plant food = sum of the food cards + the zone's leaf value (can be negative).
  6. Replace the triggered event.
- Variant: play without events.

## Promo packs

- **Promo Pack I:**
  - Unstable DNA ×7, food −1..5 (mod 937). When the food cards are revealed, gain a new species if food was left on the Watering Hole from the previous round.
  - Also includes 6 alternate-art boards.
- **Promo Pack II** ([boardmatch](https://boardmatch.app/en/game/181592), [rulespal](https://rulespal.com/evolution-promo-pack-ii/rulebook)), 7 each:
  - Last Stand (event, −1..5)
  - Pest (−1..5; rulespal's single −4 is probably a misread)
  - Pounce (event, −1..5)
  - Quills (−1..5)
  - Sharp Teeth (−1..5)
  - Invasive Species (event, **food unknown**)
  - Rapid Mutation (**food unknown**; effect: on reveal, draw 3, swap this trait for one from your hand, then discard 2)
- **Promo Pack III** ([nemestats](https://nemestats.com/GameDefinition/Details/123959), [rules PDF](https://cdn.shopify.com/s/files/1/0283/4324/files/promo_pack_iii_rules_pdf.pdf)):
  - **Traits:** Claws, Coprophagia, Insectivore, Mimicry, Timid, Trampling (×7 each, per-copy food **unknown**).
  - **Plant micro-expansion:** Plant boards replace the Watering Hole.
  - **9 scenario cards** (all known; the 9th, Radioactive Atmosphere, means draw 2 cards per species instead of 1):
    - Cretaceous Period: no trait limit
    - Darwinian Selection: players may never look at their hand
    - Great Permian Extinction: 1 trait maximum
    - Land of Plenty: start with 10 cards
    - Plant Life Explosion: double the leftover food
    - Runaway Warming: + suns (Climate)
    - Snowball Earth: + snowflakes (Climate)
    - Teeming Hordes: start at population 2
- **Promo usage rules** (PP3 PDF):
  - Swap each promo trait in for a same-color base trait. Never remove Carnivores.
  - Rapid Mutation: add 2 extra traits instead.
  - Remove Fertile when using Invasive Species.
  - Pounce + Last Stand count as one swap.
  - Camouflage/Good Eyesight and Warning Call/Ambush go in or out in pairs.
- **Single promos:**
  - Gigantism (0, C2)
  - ESP (2, C1)
  - Night Prowler (−1, C3)
  - Hibernation (8, C2)
  - Digital-only packs (Biodiversity, Alone and Unafraid, Arms Race) are not physical cards.

## Separate games (not add-ons)

- **The Beginning** (2018; [rules PDF](https://cdn.shopify.com/s/files/1/0283/4324/files/Evolution-The-Beginning-Rules-Web.pdf)): an 88-card simplified family game with turn-based play and no food numbers.
  - Traits: Burrowing, Flight, Nocturnal, Speed, Defensive Horns, Carnivore, Long Neck, Scavenger, Fat Tissue, Fertile.
  - The full rules are in the JSON.
  - The trait counts are unknown.
- **Oceans** (North Star, 2020; [Wikipedia](https://en.wikipedia.org/wiki/Oceans_(board_game))): its own game with Surface and Deep decks and a Reef. Not combinable with Evolution.
- **Random Mutations** ([Wikipedia](https://en.wikipedia.org/wiki/Evolution:_Random_Mutations)) and **New World** ([Meeple Mountain](https://www.meeplemountain.com/reviews/evolution-new-world/), 2023): Rightgames' separate Russian line, not North Star.
- **"Variations":** no such product found (searched BGG-derived sites, North Star, rulespal and TTS). Treated as the PP3 scenarios plus the Climate no-events variant.

## NOT verified / open

- **Flight food numbers:** one scan only (every mod reuses the same file). The official rulebook's 8 sample cards agree.
- **Missing promo food numbers:** Invasive Species, Rapid Mutation and all 6 PP3 traits. Default is −1..5, flagged.
- **Pest:** use −1..5. Rulespal's −4 is probably a misread (reasoned).
- **Radioactive Atmosphere:** one source (rulespal).
- **Plant micro-expansion:** the exact fill formula (the "pop 4 → 5 food" example).
- **The Beginning:** per-trait card counts.
