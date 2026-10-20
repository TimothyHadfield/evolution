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
  const DEFENSES = ['Burrowing', 'Climbing', 'Defensive Herding', 'Hard Shell', 'Horns', 'Symbiosis', 'Warning Call'];
  return { FOOD, TEXT, TRAITS, DECK, DEFENSES };
});
