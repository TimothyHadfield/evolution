/* Evolution Lab: the base-game deck (Evolution, North Star Games, 2nd edition 2015+, 2017 rulebook).
   Facts only (trait names, copies, food numbers); every effect text below is our own words.
   129 cards: 17 Carnivore + 7 of each other trait. Sources and cross-checks: docs/rules-check.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvoCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // trait -> the food number printed on each copy (one entry per card)
  const STD = [1, 2, 3, 3, 4, 4, 5];          // the six defensive traits share this spread
  const GROW = [2, 3, 4, 5, 6, 6, 7];         // Fertile, Foraging, Scavenger
  const FOOD = {
    'Ambush': [-3, -2, -1, 0, 1, 2, 3],
    'Burrowing': STD.slice(),
    'Carnivore': [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6],
    'Climbing': STD.slice(),
    'Cooperation': [0, 3, 3, 4, 4, 5, 5],
    'Defensive Herding': [2, 3, 4, 5, 6, 7, 8],
    'Fat Tissue': [-1, 0, 3, 4, 4, 5, 5],
    'Fertile': GROW.slice(),
    'Foraging': GROW.slice(),
    'Hard Shell': STD.slice(),
    'Horns': STD.slice(),
    'Intelligence': [-2, -1, 0, 4, 5, 6, 7],
    'Long Neck': [3, 4, 5, 6, 7, 8, 9],
    'Pack Hunting': [-3, -2, -1, 0, 1, 2, 3],
    'Scavenger': GROW.slice(),
    'Symbiosis': STD.slice(),
    'Warning Call': STD.slice(),
  };
  // our own short wording of each trait
  const TEXT = {
    'Ambush': 'When this Carnivore attacks, Warning Call does not stop it.',
    'Burrowing': 'Safe from attacks while it has eaten its fill (food equal to its population).',
    'Carnivore': 'Eats only meat: attacks a species with a smaller body size for meat equal to that size. Never eats plants.',
    'Climbing': 'Only a Carnivore that also has Climbing can attack it.',
    'Cooperation': 'Each time it takes food, your species just to its right takes 1 of the same food from the same place.',
    'Defensive Herding': 'Only a Carnivore with a bigger population can attack it.',
    'Fat Tissue': 'Can keep eating after it is full, storing up to its body size. Stored food feeds it before the next reveal.',
    'Fertile': 'Before the food cards are revealed, if food is left in the watering hole, +1 population.',
    'Foraging': 'Every time it takes plant food, it takes 1 more from the same place.',
    'Hard Shell': 'Counts as 4 bigger when a Carnivore checks if it can attack.',
    'Horns': 'A Carnivore that attacks it loses 1 population first.',
    'Intelligence': 'Discard a card: a plant eater takes 2 plant food from the bank; a Carnivore ignores one defending trait for this attack.',
    'Long Neck': 'Before the food cards are revealed, takes 1 plant food from the bank.',
    'Pack Hunting': 'Attacks as if its body size were body size plus population.',
    'Scavenger': 'Whenever any species loses population to an attack, takes 1 meat from the bank.',
    'Symbiosis': 'Safe from attacks while your species just to its right has a bigger body size.',
    'Warning Call': 'Your species on either side of it can only be attacked by a Carnivore with Ambush.',
  };
  const TRAITS = Object.keys(FOOD);
  // DECK[id] = {id, trait, food}; ids are stable (trait order, then food order)
  const DECK = [];
  for (const t of TRAITS) for (const f of FOOD[t]) DECK.push({ id: DECK.length, trait: t, food: f });
  // traits a Carnivore may switch off with Intelligence (the ones that stop or punish an attack)
  // (Cooling Frills and Mud Wallowing are Climate cards; they never appear in a base game)
  const DEFENSES = ['Burrowing', 'Climbing', 'Defensive Herding', 'Hard Shell', 'Horns', 'Symbiosis', 'Warning Call', 'Cooling Frills', 'Mud Wallowing'];

  // ================================================================== EVOLUTION: CLIMATE (separate block)
  // Climate standalone / Conversion Pack (2016). Sources: docs/expansions-research.md + docs/rules-check.md
  // ("Climate"). Deck = the base deck minus every Ambush, Burrowing, Defensive Herding and Carnivore card
  // (91 cards kept, unchanged, no icons) + the 86 cards below. Ids start at 1000 so they never clash with
  // other expansions' ids. Each card: food number + climate icons (sun = pushes warmer, snow = colder).
  const CLIMATE_FOOD = { // trait -> [[food, 'S'|'C', icons], ...] one entry per copy (mods 937 + 2425 agree)
    'Ambush': [[-3, 'S', 3], [-2, 'C', 2], [3, 'S', 2], [2, 'C', 1], [0, 'C', 1], [1, 'S', 1], [-1, 'S', 1]],
    'Burrowing': [[5, 'S', 3], [4, 'C', 2], [1, 'S', 2], [2, 'C', 1], [3, 'C', 1], [3, 'S', 1], [4, 'S', 1]],
    'Defensive Herding': [[2, 'C', 3], [8, 'C', 2], [3, 'S', 2], [4, 'C', 1], [6, 'C', 1], [5, 'S', 1], [7, 'S', 1]],
    'Carnivore': [[3, 'S', 4], [2, 'S', 4], [3, 'C', 4], [4, 'C', 4], [2, 'C', 3], [1, 'S', 2], [6, 'C', 2], [4, 'C', 1], [4, 'C', 1], [4, 'C', 1],
      [5, 'C', 1], [5, 'C', 1], [6, 'C', 1], [3, 'S', 1], [3, 'S', 1], [3, 'S', 1], [2, 'S', 1], [2, 'S', 1], [2, 'S', 1], [1, 'S', 1], [1, 'S', 1], [0, 'S', 1], [0, 'S', 1]],
    'Cooling Frills': [[-4, 'S', 3], [-2, 'C', 2], [9, 'S', 2], [7, 'C', 1], [2, 'C', 1], [0, 'S', 1], [5, 'S', 1]],
    'Heavy Fur': [[10, 'C', 3], [-5, 'C', 2], [8, 'S', 2], [6, 'C', 1], [-1, 'C', 1], [-3, 'S', 1], [1, 'S', 1]],
    'Hibernation': [[-3, 'C', 3], [8, 'C', 2], [-1, 'S', 2], [1, 'C', 1], [4, 'C', 1], [3, 'S', 1], [6, 'S', 1]],
    'Migratory': [[5, 'C', 3], [0, 'C', 2], [4, 'S', 2], [2, 'C', 1], [3, 'C', 1], [1, 'S', 1], [2, 'S', 1]],
    'Mud Wallowing': [[7, 'S', 3], [5, 'C', 2], [-2, 'S', 2], [0, 'C', 1], [3, 'C', 1], [3, 'S', 1], [2, 'S', 1]],
    'Nocturnal': [[-1, 'S', 3], [1, 'C', 2], [6, 'S', 2], [4, 'C', 1], [2, 'C', 1], [2, 'S', 1], [3, 'S', 1]],
  };
  const CLIMATE_OUT = ['Ambush', 'Burrowing', 'Defensive Herding', 'Carnivore']; // base cards replaced by the kit
  const CLIMATE_DECK = [];
  for (const t of Object.keys(CLIMATE_FOOD)) for (const [f, k, n] of CLIMATE_FOOD[t])
    CLIMATE_DECK.push({ id: 1000 + CLIMATE_DECK.length, trait: t, food: f, sun: k === 'S' ? n : 0, snow: k === 'C' ? n : 0 });
  // our own words for the new traits, and for the base traits whose Climate cards add a climate line
  const CLIMATE_TEXT = {
    'Cooling Frills': 'Counts as 2 bigger when a Carnivore checks if it can attack. Blocks 3 heat loss.',
    'Heavy Fur': 'Blocks 4 cold loss. In Tropical, Hot and Scorching it loses 1 more to heat.',
    'Hibernation': 'Up to 2 unfed population don’t count as hungry and don’t starve. Blocks 1 cold loss.',
    'Migratory': 'After all feeding, if the watering hole is empty, takes 2 plant food from the bank. Blocks 1 heat and 1 cold loss.',
    'Mud Wallowing': 'A Carnivore must discard a card from its owner’s hand before each attack on it. Blocks 1 heat loss.',
    'Nocturnal': 'Before each of your feeding turns, feeds once for free if no Carnivore could attack it. Blocks 1 heat loss.',
    'Ambush': 'When this Carnivore attacks, Warning Call does not stop it. Against a Migratory species it also ignores one defending trait.',
    'Burrowing': 'Safe from attacks while it isn’t hungry. Blocks 1 heat and 1 cold loss.',
    'Defensive Herding': 'Only a Carnivore with a bigger population can attack it. Blocks 1 cold loss.',
  };
  const CLIMATE_TRAITS = ['Cooling Frills', 'Heavy Fur', 'Hibernation', 'Migratory', 'Mud Wallowing', 'Nocturnal'];

  // every card by id (base 0-128 and every expansion card); look cards up here, not in DECK
  const CARD = {};
  for (const c of DECK) CARD[c.id] = c;
  for (const c of CLIMATE_DECK) CARD[c.id] = c;
  // the card ids a game shuffles: 'climate' = base minus the replaced traits + the Climate cards
  function deckIds(version) {
    if (version === 'climate') return DECK.filter(c => CLIMATE_OUT.indexOf(c.trait) < 0).map(c => c.id).concat(CLIMATE_DECK.map(c => c.id));
    return DECK.map(c => c.id);
  }
  // one trait's food numbers in a game's deck (for "N cards in the deck")
  function foodsOf(t, version) { return deckIds(version).map(id => CARD[id]).filter(c => c.trait === t).map(c => c.food); }
  return { FOOD, TEXT, TRAITS, DECK, DEFENSES, CARD, deckIds, foodsOf, CLIMATE_DECK, CLIMATE_TEXT, CLIMATE_TRAITS, CLIMATE_OUT };
});
