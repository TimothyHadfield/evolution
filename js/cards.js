/* Evolution Lab: the cards (Evolution, North Star Games, 2nd edition 2015+, 2017 rulebook), plus
   Evolution: Flight and the promo packs. Facts only (trait names, copies, food numbers); every effect
   text below is our own words. Base: 129 cards, 17 Carnivore + 7 of each other trait.
   Sources and cross-checks: docs/rules-check.md. */
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
  // DECK[id] = {id, trait, food}; ids are stable (trait order, then food order). DECK is the base deck only.
  const DECK = [];
  for (const t of TRAITS) for (const f of FOOD[t]) DECK.push({ id: DECK.length, trait: t, food: f });

  // ---------------------------------------------------------------- expansions (docs/expansions-research.md)
  // ALL[id] = every card any game can hold. Ids never change: 0-128 base, 129-176 Flight deck cards,
  // 177-188 the 12 Flight cards (kept out of the deck, no food number), 189-286 promo packs.
  // Evolution: Climate's cards are 1000-1085 (CLIMATE_DECK below, not in ALL; CARD holds every id).
  const ALL = DECK.slice();
  const ONE = [-1, 0, 1, 2, 3, 4, 5];          // the spread every 7-copy expansion/promo trait uses
  const SETS = {};                            // set key -> card ids
  function add(set, trait, foods, o) {
    SETS[set] = SETS[set] || [];
    for (const f of foods) { const c = Object.assign({ id: ALL.length, trait, food: f, set }, o || {}); ALL.push(c); SETS[set].push(c.id); }
  }
  // Flight (2015 rulebook + card scan, exact): 34 traits + 14 events go into the deck
  add('flight', 'Brood Parasite', ONE);
  add('flight', 'Camouflage', ONE);
  add('flight', 'Good Eyesight', ONE);
  add('flight', 'Nesting', ONE);
  add('flight', 'Carnivore', [-4, -3, -2, -1, 7, 8]);
  add('flight', 'Dive-Bomb', ONE, { event: true });
  add('flight', 'Seed Dispersal', ONE, { event: true });
  add('flightCards', 'Flight', new Array(12).fill(null)); // ride on Avian boards, never in the deck
  // Promo Pack I (exact)
  add('pp1', 'Unstable DNA', ONE);
  // Promo Pack II, exact food numbers
  add('pp2', 'Last Stand', ONE, { event: true });
  add('pp2', 'Pest', ONE);
  add('pp2', 'Pounce', ONE, { event: true });
  add('pp2', 'Quills', ONE);
  add('pp2', 'Sharp Teeth', ONE);
  // Promo Pack II, food numbers NOT known: the usual -1..5 spread (estimated, said so in the picker)
  add('pp2x', 'Invasive Species', ONE, { event: true, est: true });
  add('pp2x', 'Rapid Mutation', ONE, { est: true });
  // Promo Pack III traits, food numbers NOT known (estimated)
  for (const t of ['Claws', 'Coprophagia', 'Insectivore', 'Mimicry', 'Timid', 'Trampling']) add('pp3x', t, ONE, { est: true });
  const FLIGHT_CARDS = SETS.flightCards;

  Object.assign(TEXT, {
    'Brood Parasite': 'Avian only: before the food cards are revealed, if you have another Avian species, +1 population and 1 food from the bank. No effect on a land species.',
    'Camouflage': 'Only a Carnivore with Good Eyesight can attack it.',
    'Good Eyesight': 'Carnivore: may attack Camouflage. Plant eater: before the food cards are revealed, takes 2 plant food from the watering hole.',
    'Nesting': 'Each time it gains population: a land species takes 1 plant food from the bank; an Avian takes 2 meat from the bank.',
    'Dive-Bomb': 'Event. After traits are revealed, discard it to feed one of your Avians at once (a Carnivore attacks; a plant eater takes 2 plant food from the watering hole, the cliff or the bank). Then draw a card.',
    'Seed Dispersal': 'Event. After traits are revealed, discard it: the watering hole gets 1 plant food per Avian species in play. Then draw a card.',
    'Flight': 'Comes with every Avian board. Only a Carnivore with Flight can attack it. A plant eater may eat at the cliff. A Carnivore may discard a card to switch off Warning Call, Symbiosis or Climbing for its next attack.',
    'Unstable DNA': 'When the food cards are revealed, if food was left in the watering hole from last round, you get a new species.',
    'Last Stand': 'Event. When a Carnivore attacks your species, discard it: the attacker loses 1 population instead and the attack fails. Then draw a card.',
    'Pest': 'When it becomes fully fed, 3 plant food is removed from the watering hole.',
    'Pounce': 'Event. After traits are revealed, discard it: your land Carnivore attacks at once, ignoring one defending trait. Then draw a card.',
    'Quills': 'A Carnivore that attacks it can not attack again this round.',
    'Sharp Teeth': 'Discard a card on your feeding turn: a Carnivore may attack any size on its next attack; a plant eater takes 1 plant food from the bank.',
    'Invasive Species': 'Event. After traits are revealed, discard it onto one of your plant eaters: this round it gains 1 population each time another species is attacked.',
    'Rapid Mutation': 'When traits are revealed: draw 3 cards, swap this card for a trait from your hand, then discard 2 cards.',
    'Claws': 'Counts as 2 bigger when it attacks or is attacked. Before the food cards are revealed, may discard a card to have Climbing this round.',
    'Coprophagia': 'Instead of eating at the watering hole, may take food back out of your own food bag.',
    'Insectivore': 'Before each of your feeding turns, takes 1 meat from the bank if the watering hole has food.',
    'Mimicry': 'Before the food cards are revealed, copies a trait of another species for this round; then Mimicry is discarded.',
    'Timid': 'Can not be attacked. May not eat at the watering hole until your other species are fed.',
    'Trampling': 'Each time it eats at the watering hole, 2 more plant food is removed from it.',
  });
  const card = id => CARD[id]; // every id, Climate's too (CARD is built below)
  // the deck a game starts with. exp = {v: 'base' | 'flight' | 'climate', promos: ['pp1','pp2','pp2x','pp3x']}
  // Promo cards are ADDED to the deck (the promo sheet's same-colour swap needs card colours we don't have).
  function buildDeck(exp) {
    const v = (exp && exp.v) || 'base';
    let ids = null;
    if (v === 'climate' && api.climateDeck) ids = api.climateDeck(exp); // Evolution: Climate plugs in here
    if (!ids) ids = DECK.map(c => c.id).concat(v === 'flight' ? SETS.flight : []);
    for (const k of (exp && exp.promos) || []) if (PROMOS[k]) ids = ids.concat(SETS[k]);
    return ids;
  }
  const PROMOS = { pp1: 'Promo Pack I', pp2: 'Promo Pack II', pp2x: 'Promo Pack II (estimated)', pp3x: 'Promo Pack III traits (estimated)' };
  // Promo Pack III scenario cards that work in this engine (Climate-only ones and Darwinian Selection are not built)
  const SCENARIOS = {
    'Cretaceous Period': 'No limit on traits per species.',
    'Great Permian Extinction': 'At most 1 trait per species.',
    'Land of Plenty': 'Everyone starts the game with 10 cards.',
    'Plant Life Explosion': 'Food left in the watering hole doubles at the end of each round.',
    'Teeming Hordes': 'New species start at population 2.',
    'Radioactive Atmosphere': 'Deal 2 cards per species instead of 1.',
  };
  const EVENTS = ['Dive-Bomb', 'Seed Dispersal', 'Last Stand', 'Pounce', 'Invasive Species'];
  const isEvent = id => !!(ALL[id] && ALL[id].event);
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

  // every card by id: base 0-128, Flight + promos 129-286 (ALL), Climate 1000-1085. Look cards up here.
  const CARD = {};
  for (const c of ALL) CARD[c.id] = c;
  for (const c of CLIMATE_DECK) CARD[c.id] = c;
  // the card ids a game shuffles without promos: 'climate' = base minus the replaced traits + the Climate cards
  function deckIds(version) {
    if (version === 'climate') return DECK.filter(c => CLIMATE_OUT.indexOf(c.trait) < 0).map(c => c.id).concat(CLIMATE_DECK.map(c => c.id));
    return DECK.map(c => c.id).concat(version === 'flight' ? SETS.flight : []);
  }
  // one trait's food numbers in a game's deck (for "N cards in the deck"); exp = a game's exp or a version name
  function foodsOf(t, exp) { return buildDeck(typeof exp === 'string' ? { v: exp } : exp).map(id => CARD[id]).filter(c => c.trait === t).map(c => c.food); }
  // the same, with the expansion defences (Flight, Camouflage, Quills, Timid); used only in games that hold them
  const XDEFENSES = DEFENSES.concat(['Flight', 'Camouflage', 'Quills', 'Timid']);
  const ALL_TRAITS = [...new Set(ALL.map(c => c.trait).concat(CLIMATE_DECK.map(c => c.trait)))];
  const api = { FOOD, TEXT, TRAITS, DECK, DEFENSES, ALL, SETS, FLIGHT_CARDS, PROMOS, SCENARIOS, EVENTS, XDEFENSES, ALL_TRAITS, card, buildDeck, isEvent,
    climateDeck: exp => deckIds('climate'), CARD, deckIds, foodsOf, CLIMATE_DECK, CLIMATE_TEXT, CLIMATE_TRAITS, CLIMATE_OUT };
  return api;
});
