// Evolution: Flight and the promo packs, one test per rule (sources: docs/rules-check.md, "Flight" and
// "Promo cards"). Also: deck counts per version, old base saves, computers legal in every version, an
// online room with Flight. Run: node tests/flight.test.js   (EVO_JS=<folder> runs it against other engine files)
'use strict';
const assert = require('assert');
const path = require('path');
const DIR = process.env.EVO_JS || path.join(__dirname, '..', 'js');
const C = require(path.join(DIR, 'cards.js'));
const E = require(path.join(DIR, 'engine.js'));
const B = require(path.join(DIR, 'bots.js'));
const OG = require(path.join(DIR, 'online-game.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); }
}
const ALL = C.ALL || C.DECK;
// card ids by trait name; each call hands out the next copy (so two species never share one card)
const used = {};
function cardOf(t) {
  const list = ALL.filter(c => c.trait === t).map(c => c.id);
  if (!list.length) throw new Error('No ' + t + ' card in this engine');
  const k = (used[t] = (used[t] || 0) + 1) - 1;
  return list[k % list.length];
}
const FLIGHT = { v: 'flight' };
const humans = n => Array.from({ length: n }, (_, i) => ({ name: 'P' + i }));
const cur = s => s.hist[s.hist.length - 1];

// a species from a short description: {traits:['Carnivore', ...], av, up, body, pop, food, ...}
function mkSp(s, r) {
  const o = Object.assign({ id: s.nextId++, body: 1, pop: 1, food: 0, fat: 0, born: 1 }, r);
  o.traits = (r.traits || []).map(t => (typeof t === 'number' ? t : cardOf(t)));
  o.hidden = [];
  if (r.av) o.up = r.up || 0;
  return o;
}
// a game set up by hand. rows[p] = species of player p; hands[p] = trait names (or ids) in hand
function setUp(exp, rows, hands, o) {
  o = o || {};
  const s = E.newGame({ seed: o.seed || 21, players: humans(rows.length), exp });
  s.first = 0;
  s.players.forEach((pl, p) => {
    s.discard.push(...pl.hand);
    pl.hand = ((hands && hands[p]) || []).map(t => (typeof t === 'number' ? t : cardOf(t)));
    pl.foodCard = null; pl.done = false;
    pl.species = rows[p].map(r => mkSp(s, r));
  });
  s.hole = o.hole || 0;
  if (o.cliff != null) s.cliff = o.cliff;
  cur(s).holeStart = o.holeStart || 0;
  if (o.feed) {
    s.phase = 'feed'; s.turn = 0; s.passes = 0; s.playTurn = -1;
    s.players.forEach(pl => { pl.foodCard = -1; pl.done = true; });
    if (o.fseq) { s.fseq = 0; s.insSeq = -1; }
  } else { s.phase = 'play'; s.playTurn = 0; }
  return s;
}
// play on to `until` (phase): plays[p] = card moves for p's play turn; the food card is the first
// other card in hand (a non-event card if there is one); event steps answered Done, leaf orders best-first
function drive(s, until, plays) {
  plays = plays || {};
  for (let g = 0; g < 60 && s.phase !== until && !s.over; g++) {
    const p = E.toAct(s)[0];
    if (p == null) throw new Error('Nobody to act in ' + s.phase);
    if (s.phase === 'play') {
      const m = plays[p] || [];
      const h = s.players[p].hand.filter(c => !m.some(x => x.card === c || (x.cards && x.cards.indexOf(c) >= 0)));
      const food = h.find(c => !(C.isEvent && C.isEvent(c))) != null ? h.find(c => !(C.isEvent && C.isEvent(c))) : h[0];
      s = E.apply(s, p, { t: 'play', moves: m, food });
    } else if (s.phase === 'event') s = E.apply(s, p, { t: 'evdone' });
    else if (s.phase === 'leaf') s = E.apply(s, p, { t: 'leaf', k: 0 });
    else throw new Error('Stuck in ' + s.phase);
  }
  assert.strictEqual(s.phase, until, 'reached the ' + until + ' step');
  return s;
}
const sp = (s, p, i) => s.players[p].species[i];

// ------------------------------------------------------------------ decks and set-up
test('deck sizes: base 129, Flight 177 (+12 Flight cards kept out), promo packs add their cards', () => {
  assert.strictEqual(C.buildDeck({ v: 'base' }).length, 129);
  assert.strictEqual(C.buildDeck({ v: 'flight' }).length, 177);
  assert.strictEqual(C.FLIGHT_CARDS.length, 12);
  assert.ok(C.FLIGHT_CARDS.every(id => ALL[id].trait === 'Flight' && C.buildDeck({ v: 'flight' }).indexOf(id) < 0));
  assert.strictEqual(C.buildDeck({ v: 'base', promos: ['pp1'] }).length, 129 + 7);
  assert.strictEqual(C.buildDeck({ v: 'base', promos: ['pp2'] }).length, 129 + 35);
  assert.strictEqual(C.buildDeck({ v: 'flight', promos: ['pp1', 'pp2', 'pp2x', 'pp3x'] }).length, 177 + 7 + 35 + 14 + 42);
  // Flight's printed food numbers (34 traits + 14 events): Carnivore -4,-3,-2,-1,7,8
  assert.deepStrictEqual(ALL.filter(c => c.set === 'flight' && c.trait === 'Carnivore').map(c => c.food), [-4, -3, -2, -1, 7, 8]);
  // base ids never moved
  for (let i = 0; i < 129; i++) assert.strictEqual(ALL[i], C.DECK[i]);
});

test('Flight set-up: cliff empty, 12 Flight cards beside the board, 40 cards set aside for the end', () => {
  for (const n of [2, 3, 5]) {
    const s = E.newGame({ seed: 4 + n, players: humans(n), exp: FLIGHT });
    assert.strictEqual(s.cliff, 0);
    assert.strictEqual(s.flights.length, 12);
    assert.strictEqual(s.reserve.length, 40);
    const inPlay = s.deck.length + s.reserve.length + s.discard.length + s.players.reduce((a, pl) => a + pl.hand.length, 0);
    assert.strictEqual(inPlay, 177 - s.removed, n + ' players: every card accounted for');
  }
});

test('the cliff gets 1 plant food per player when the food cards are revealed', () => {
  let s = setUp(FLIGHT, [[{}], [{}], [{}]], [['Horns'], ['Horns'], ['Horns']], { cliff: 0 });
  s = drive(s, 'feed');
  assert.strictEqual(s.cliff, 3);
});

// ------------------------------------------------------------------ Avian species
test('an Avian species costs 2 cards: population 1, body 1, a Flight card on it', () => {
  let s = setUp(FLIGHT, [[{}], [{}]], [['Horns', 'Climbing', 'Burrowing'], ['Horns']]);
  const [a, b] = s.players[0].hand;
  s = E.apply(s, 0, { t: 'play', moves: [{ t: 'avian', cards: [a, b] }], food: s.players[0].hand[2] });
  const av = sp(s, 0, 1);
  assert.ok(av.av, 'an Avian board');
  assert.strictEqual(av.pop, 1); assert.strictEqual(av.body, 1);
  assert.strictEqual(ALL[av.traits[0]].trait, 'Flight');
  assert.strictEqual(s.flights.length, 11);
  assert.ok(s.discard.indexOf(a) >= 0 && s.discard.indexOf(b) >= 0);
  // not in a base game
  const t = setUp({ v: 'base' }, [[{}], [{}]], [['Horns', 'Climbing', 'Burrowing'], ['Horns']]);
  assert.throws(() => E.apply(t, 0, { t: 'play', moves: [{ t: 'avian', cards: t.players[0].hand.slice(0, 2) }], food: t.players[0].hand[2] }));
});

test('an Avian body size stops at 3 (a land species goes on to 6)', () => {
  const s = setUp(FLIGHT, [[{ av: true, body: 3, up: 0, traits: ['Flight'] }, { body: 3 }], [{}]], [['Horns', 'Climbing'], ['Horns']]);
  const [c1, c2] = s.players[0].hand;
  assert.throws(() => E.apply(s, 0, { t: 'play', moves: [{ t: 'body', card: c1, s: sp(s, 0, 0).id }], food: c2 }), /3/);
  const t = E.apply(s, 0, { t: 'play', moves: [{ t: 'body', card: c1, s: sp(s, 0, 1).id }], food: c2 });
  assert.strictEqual(sp(t, 0, 1).body, 4);
});

test('Avian upkeep: food equal to its body size first, then its population; upkeep is never scored', () => {
  let s = setUp(FLIGHT, [[{ av: true, body: 2, pop: 1, traits: ['Flight'] }], [{ pop: 6 }]], null, { feed: true, hole: 10 });
  assert.strictEqual(E.needFood(sp(s, 0, 0)), 3);
  s = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 0).id });
  assert.strictEqual(sp(s, 0, 0).up, 1); assert.strictEqual(sp(s, 0, 0).food, 0);
  // fed: 2 upkeep + 1 on the population; the round ends with the other player fed too
  let t = setUp(FLIGHT, [[{ av: true, body: 2, pop: 1, up: 2, food: 1, traits: ['Flight'] }], [{ pop: 1, food: 1 }]], null, { feed: true, hole: 0 });
  t = E.apply(t, 0, { t: 'pass' });
  assert.strictEqual(t.players[0].bag, 1, 'only the population food is scored');
  assert.strictEqual(sp(t, 0, 0).up, 0); assert.strictEqual(sp(t, 0, 0).pop, 1);
});

test('only an Avian plant eater may eat at the cliff', () => {
  let s = setUp(FLIGHT, [[{ pop: 2 }, { av: true, pop: 2, traits: ['Flight'] }], [{ pop: 6 }]], null, { feed: true, hole: 5, cliff: 3 });
  assert.throws(() => E.apply(s, 0, { t: 'eat', s: sp(s, 0, 0).id, src: 'cliff' }));
  s = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 1).id, src: 'cliff' });
  assert.strictEqual(s.cliff, 2); assert.strictEqual(s.hole, 5);
  assert.strictEqual(sp(s, 0, 1).up, 1);
});

test('Flight defends: only a Carnivore with Flight may attack an Avian', () => {
  const s = setUp(FLIGHT, [[{ body: 4, traits: ['Carnivore'] }, { av: true, body: 2, up: 2, traits: ['Flight', 'Carnivore'] }], [{ av: true, body: 1, traits: ['Flight'] }]], null, { feed: true, hole: 0 });
  assert.match(E.attackBlock(s, 0, 0, 1, 0), /Flight/);
  assert.strictEqual(E.attackBlock(s, 0, 1, 1, 0), '');
});

test('a Carnivore with Flight discards a card to switch off Warning Call (also Symbiosis, Climbing)', () => {
  let s = setUp(FLIGHT, [[{ av: true, body: 3, up: 3, traits: ['Flight', 'Carnivore'] }], [{ body: 1, pop: 2 }, { body: 1, traits: ['Warning Call'] }, { pop: 6 }]], [['Horns'], []], { feed: true, hole: 5 });
  const card = s.players[0].hand[0];
  assert.throws(() => E.apply(s, 0, { t: 'attack', s: sp(s, 0, 0).id, target: sp(s, 1, 0).id }), /Warning Call/);
  assert.throws(() => E.apply(s, 0, { t: 'attack', s: sp(s, 0, 0).id, target: sp(s, 1, 0).id, ignore: ['Horns'], cards: [card] }));
  s = E.apply(s, 0, { t: 'attack', s: sp(s, 0, 0).id, target: sp(s, 1, 0).id, ignore: ['Warning Call'], cards: [card] });
  assert.strictEqual(sp(s, 1, 0).pop, 1);
  assert.strictEqual(s.players[0].hand.length, 0);
});

test('Nesting: gaining population takes food from the bank (land 1 plant, Avian 2 meat, upkeep first)', () => {
  const s = setUp(FLIGHT, [[{ traits: ['Nesting'] }, { av: true, pop: 1, traits: ['Flight', 'Nesting'] }], [{}]], [['Horns', 'Climbing', 'Burrowing'], ['Horns']]);
  const [c1, c2, c3] = s.players[0].hand;
  const t = E.apply(s, 0, { t: 'play', moves: [{ t: 'pop', card: c1, s: sp(s, 0, 0).id }, { t: 'pop', card: c2, s: sp(s, 0, 1).id }], food: c3 });
  assert.strictEqual(sp(t, 0, 0).pop, 2); assert.strictEqual(sp(t, 0, 0).food, 1);
  assert.strictEqual(sp(t, 0, 1).pop, 2); assert.strictEqual(sp(t, 0, 1).up, 1); assert.strictEqual(sp(t, 0, 1).food, 1);
});

test('Brood Parasite: an Avian with another Avian beside it gains 1 population and 1 food', () => {
  let s = setUp(FLIGHT, [[{ av: true, traits: ['Flight', 'Brood Parasite'] }, { av: true, traits: ['Flight'] }], [{}]], [['Horns'], ['Horns']]);
  s = drive(s, 'feed');
  assert.strictEqual(sp(s, 0, 0).pop, 2); assert.strictEqual(sp(s, 0, 0).up, 1);
  let t = setUp(FLIGHT, [[{ av: true, traits: ['Flight', 'Brood Parasite'] }, { traits: ['Brood Parasite'] }], [{}]], [['Horns'], ['Horns']]);
  t = drive(t, 'feed');
  assert.strictEqual(sp(t, 0, 0).pop, 1, 'no other Avian');
  assert.strictEqual(sp(t, 0, 1).pop, 1, 'no effect on a land species');
});

test('Good Eyesight: a plant eater takes 2 plant food from the watering hole before the reveal', () => {
  let s = setUp(FLIGHT, [[{ pop: 3, traits: ['Good Eyesight'] }], [{ pop: 6 }]], [['Horns'], ['Horns']], { hole: 5 });
  s = drive(s, 'feed');
  assert.strictEqual(sp(s, 0, 0).food, 2);
  // a Carnivore with it may attack Camouflage
  const t = setUp(FLIGHT, [[{ body: 3, traits: ['Carnivore'] }, { body: 3, traits: ['Carnivore', 'Good Eyesight'] }], [{ traits: ['Camouflage'] }]], null, { feed: true });
  assert.match(E.attackBlock(t, 0, 0, 1, 0), /Camouflage/);
  assert.strictEqual(E.attackBlock(t, 0, 1, 1, 0), '');
});

test('event step: Dive-Bomb feeds an Avian 2 plant food from the bank; the card is discarded and you draw 1', () => {
  let s = setUp(FLIGHT, [[{ av: true, pop: 2, traits: ['Flight'] }], [{}]], [['Dive-Bomb', 'Horns'], ['Horns']]);
  const db = s.players[0].hand.find(c => ALL[c].trait === 'Dive-Bomb');
  s = drive(s, 'event');
  assert.deepStrictEqual(E.toAct(s), [0]);
  s = E.apply(s, 0, { t: 'ev', card: db, s: sp(s, 0, 0).id, src: 'bank' });
  assert.strictEqual(sp(s, 0, 0).up, 1); assert.strictEqual(sp(s, 0, 0).food, 1);
  assert.ok(s.discard.indexOf(db) >= 0);
  assert.strictEqual(s.players[0].hand.length, 1, 'drew a card');
});

test('event step: Seed Dispersal adds 1 plant food to the watering hole per Avian in play', () => {
  let s = setUp(FLIGHT, [[{ av: true, traits: ['Flight'] }, { av: true, traits: ['Flight'] }], [{ av: true, traits: ['Flight'] }, {}]], [['Seed Dispersal', 'Horns'], ['Horns']], { hole: 2 });
  const sd = s.players[0].hand.find(c => ALL[c].trait === 'Seed Dispersal');
  s = drive(s, 'event');
  s = E.apply(s, 0, { t: 'ev', card: sd });
  // nothing else to play, so the round moves on to the food cards
  assert.strictEqual(s.phase, 'feed');
  assert.strictEqual(s.hole, 5 + cur(s).added);
});

test('event cards are never played as traits', () => {
  const s = setUp(FLIGHT, [[{}], [{}]], [['Seed Dispersal', 'Horns'], ['Horns']]);
  const sd = s.players[0].hand.find(c => ALL[c].trait === 'Seed Dispersal');
  assert.throws(() => E.apply(s, 0, { t: 'play', moves: [{ t: 'trait', card: sd, s: sp(s, 0, 0).id }], food: s.players[0].hand.find(c => c !== sd) }), /event/);
});

test('when the deck runs out, the 40 set-aside cards are used (not the discards) and that round is the last', () => {
  let s = setUp(FLIGHT, [[{ pop: 1, traits: ['Horns', 'Climbing'] }, { pop: 1, food: 1 }], [{ pop: 1, food: 1 }]], null, { feed: true, hole: 0 });
  const reserve = s.reserve.slice();
  const disc = s.discard.slice();
  s.deck = [];
  s = E.apply(s, 0, { t: 'pass' }); // the hungry species starves: extinct, draws 2, then the next deal
  assert.strictEqual(s.reserve.length, 0);
  assert.ok(disc.every(c => s.discard.indexOf(c) >= 0), 'discards were not shuffled back');
  assert.ok(s.players[0].hand.every(c => reserve.indexOf(c) >= 0), 'new cards came from the set-aside 40');
  assert.ok(s.lastRound, 'last round');
});

test('a dead Avian’s Flight card goes back beside the board, not to the discards', () => {
  let s = E.newGame({ seed: 3, players: humans(2), exp: FLIGHT });
  const f = s.flights.pop();
  s = setUp(FLIGHT, [[{ av: true, traits: [f] }, { pop: 1, food: 1 }], [{ pop: 1, food: 1 }]], null, { feed: true, hole: 0 });
  s.flights = s.flights.filter(x => x !== f);
  assert.strictEqual(s.flights.length, 11);
  s = E.apply(s, 0, { t: 'pass' });
  assert.strictEqual(s.flights.length, 12);
  assert.strictEqual(s.discard.indexOf(f), -1);
});

test('dropping Flight (to make room) turns the board into a land species for good', () => {
  const s = setUp(FLIGHT, [[{ av: true, traits: ['Flight'] }], [{}]], [['Horns', 'Climbing'], ['Horns']]);
  const f = sp(s, 0, 0).traits[0];
  const [c1, c2] = s.players[0].hand;
  s.flights = s.flights.filter(x => x !== f);
  const t = E.apply(s, 0, { t: 'play', moves: [{ t: 'drop', card: f, s: sp(s, 0, 0).id }, { t: 'trait', card: c1, s: sp(s, 0, 0).id }], food: c2 });
  assert.ok(!sp(t, 0, 0).av);
  assert.ok(t.flights.indexOf(f) >= 0);
});

// ------------------------------------------------------------------ promo cards
const PP2 = { v: 'base', promos: ['pp2'] };
test('Last Stand: the attack waits for the owner; played, the attacker loses 1 population and eats nothing', () => {
  let s = setUp(PP2, [[{ body: 3, pop: 2, traits: ['Carnivore'] }], [{ body: 1, pop: 2 }, { pop: 6 }]], [[], ['Last Stand']], { feed: true, hole: 5 });
  const ls = s.players[1].hand[0];
  s = E.apply(s, 0, { t: 'attack', s: sp(s, 0, 0).id, target: sp(s, 1, 0).id });
  assert.strictEqual(s.phase, 'react');
  assert.deepStrictEqual(E.toAct(s), [1]);
  const let_ = E.apply(s, 1, { t: 'react', card: null });
  assert.strictEqual(sp(let_, 1, 0).pop, 1); assert.strictEqual(sp(let_, 0, 0).food, 1);
  s = E.apply(s, 1, { t: 'react', card: ls });
  assert.strictEqual(sp(s, 0, 0).pop, 1); assert.strictEqual(sp(s, 0, 0).food, 0);
  assert.strictEqual(sp(s, 1, 0).pop, 2);
  assert.strictEqual(s.phase, 'feed');
});

test('Pounce: a land Carnivore attacks in the event step, ignoring one defending trait', () => {
  let s = setUp(PP2, [[{ body: 3, traits: ['Carnivore'] }], [{ body: 1, pop: 2, traits: ['Climbing'] }]], [['Pounce', 'Horns'], ['Horns']]);
  const pc = s.players[0].hand.find(c => ALL[c].trait === 'Pounce');
  s = drive(s, 'event');
  const opt = E.eventOptions(s, 0).find(o => o.card === pc);
  assert.deepStrictEqual(opt.ignore, ['Climbing']);
  s = E.apply(s, 0, opt);
  assert.strictEqual(sp(s, 1, 0).pop, 1); assert.strictEqual(sp(s, 0, 0).food, 1);
});

test('Sharp Teeth: a plant eater discards a card for 1 plant food; a Carnivore discards one to attack any size', () => {
  let s = setUp(PP2, [[{ pop: 2, traits: ['Sharp Teeth'] }, { body: 1, pop: 2, traits: ['Carnivore', 'Sharp Teeth'] }], [{ body: 4, pop: 2 }]], [['Horns', 'Climbing'], []], { feed: true, hole: 5 });
  const [c1, c2] = s.players[0].hand;
  const t = E.apply(s, 0, { t: 'teeth', s: sp(s, 0, 0).id, card: c1 });
  assert.strictEqual(sp(t, 0, 0).food, 1); assert.strictEqual(t.hole, 5);
  assert.ok(E.attackBlock(s, 0, 1, 1, 0));
  s = E.apply(s, 0, { t: 'attack', s: sp(s, 0, 1).id, target: sp(s, 1, 0).id, ignore: ['Size'], cards: [c2] });
  assert.strictEqual(sp(s, 1, 0).pop, 1);
});

test('Quills: a Carnivore that attacks it can not attack again this round', () => {
  let s = setUp(PP2, [[{ body: 3, pop: 3, traits: ['Carnivore'] }], [{ body: 1, pop: 3, traits: ['Quills'] }, { pop: 6 }]], null, { feed: true, hole: 5 });
  s = E.apply(s, 0, { t: 'attack', s: sp(s, 0, 0).id, target: sp(s, 1, 0).id });
  assert.match(E.attackBlock(s, 0, 0, 1, 0), /Quills/);
});

test('Pest: when it becomes fully fed, 3 plant food leaves the watering hole', () => {
  let s = setUp(PP2, [[{ pop: 1, traits: ['Pest'] }], [{ pop: 6 }]], null, { feed: true, hole: 10 });
  s = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 0).id });
  assert.strictEqual(s.hole, 6);
});

test('Unstable DNA: food left in the watering hole from last round makes a new species at the reveal', () => {
  const PP1 = { v: 'base', promos: ['pp1'] };
  let s = setUp(PP1, [[{ traits: ['Unstable DNA'] }], [{}]], [['Horns'], ['Horns']], { hole: 3, holeStart: 3 });
  s = drive(s, 'feed');
  assert.strictEqual(s.players[0].species.length, 2);
  let t = setUp(PP1, [[{ traits: ['Unstable DNA'] }], [{}]], [['Horns'], ['Horns']], { hole: 0, holeStart: 0 });
  t = drive(t, 'feed');
  assert.strictEqual(t.players[0].species.length, 1);
});

const PP2X = { v: 'base', promos: ['pp2x'] };
test('Invasive Species: this round its plant eater grows each time another species is attacked', () => {
  let s = setUp(PP2X, [[{ pop: 1 }, { body: 1, pop: 3 }], [{ body: 3, traits: ['Carnivore'] }]], [['Invasive Species', 'Long Neck'], ['Long Neck']]);
  const iv = s.players[0].hand.find(c => ALL[c].trait === 'Invasive Species');
  s = drive(s, 'event');
  s = E.apply(s, 0, { t: 'ev', card: iv, s: sp(s, 0, 0).id });
  s = drive(s, 'feed');
  assert.strictEqual(s.turn, 0);
  s = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 1).id });
  s = E.apply(s, 1, { t: 'attack', s: sp(s, 1, 0).id, target: sp(s, 0, 1).id });
  assert.strictEqual(sp(s, 0, 0).pop, 2);
});

test('Rapid Mutation: revealed, draw 3; swap it for a trait from your hand; discard 2', () => {
  let s = setUp(PP2X, [[{}], [{}]], [['Rapid Mutation', 'Burrowing', 'Horns'], ['Long Neck']]);
  const rm = s.players[0].hand.find(c => ALL[c].trait === 'Rapid Mutation');
  const horns = s.players[0].hand.find(c => ALL[c].trait === 'Horns');
  s = drive(s, 'event', { 0: [{ t: 'trait', card: rm, s: sp(s, 0, 0).id }] });
  assert.strictEqual(s.players[0].hand.length, 4, '1 left + 3 drawn');
  assert.throws(() => E.apply(s, 0, { t: 'evdone' }));
  const rest = s.players[0].hand.filter(c => c !== horns);
  s = E.apply(s, 0, { t: 'mutate', s: sp(s, 0, 0).id, card: horns, discard: rest.slice(0, 2) });
  assert.deepStrictEqual(sp(s, 0, 0).traits, [horns]);
  assert.strictEqual(s.players[0].hand.length, 1);
  assert.ok(s.discard.indexOf(rm) >= 0);
});

const PP3 = { v: 'base', promos: ['pp3x'] };
test('Claws: 2 bigger when it attacks or is attacked; may discard a card for Climbing this round', () => {
  const s = setUp(PP3, [[{ body: 2, traits: ['Carnivore', 'Claws'] }, { body: 2, traits: ['Carnivore'] }], [{ body: 3 }, { body: 1, traits: ['Claws'] }]], null, { feed: true });
  assert.strictEqual(E.attackBlock(s, 0, 0, 1, 0), '');
  assert.ok(E.attackBlock(s, 0, 1, 1, 0));
  assert.ok(E.attackBlock(s, 0, 1, 1, 1), 'body 1 + 2 = 3 is too big for body 2');
  let t = setUp(PP3, [[{ traits: ['Claws'] }], [{}]], [['Horns', 'Burrowing'], ['Horns']]);
  t = drive(t, 'event');
  t = E.apply(t, 0, { t: 'claws', s: sp(t, 0, 0).id, card: t.players[0].hand[0] });
  assert.ok(E.has(sp(t, 0, 0), 'Climbing'));
});

test('Mimicry: copies another species’ trait for the round, then is discarded', () => {
  let s = setUp(PP3, [[{ traits: ['Mimicry'] }], [{ traits: ['Climbing'] }]], [['Horns'], ['Horns']]);
  const climb = sp(s, 1, 0).traits[0], mim = sp(s, 0, 0).traits[0];
  s = drive(s, 'event');
  s = E.apply(s, 0, { t: 'mimic', s: sp(s, 0, 0).id, from: climb });
  assert.ok(E.has(sp(s, 0, 0), 'Climbing'));
  s = drive(s, 'feed');
  s.players.forEach(pl => pl.species.forEach(x => { x.food = x.pop; }));
  s = E.apply(s, s.turn, { t: 'pass' });
  assert.strictEqual(s.round, 2);
  assert.ok(!E.has(sp(s, 0, 0), 'Climbing'));
  assert.strictEqual(sp(s, 0, 0).traits.indexOf(mim), -1);
  assert.ok(s.discard.indexOf(mim) >= 0);
});

test('Timid: can not be attacked, and eats at the watering hole only after your other species are fed', () => {
  const s = setUp(PP3, [[{ traits: ['Timid'] }, { pop: 1 }], [{ body: 4, traits: ['Carnivore'] }]], null, { feed: true, hole: 5 });
  assert.throws(() => E.apply(s, 0, { t: 'eat', s: sp(s, 0, 0).id }), /Timid/);
  assert.match(E.attackBlock(s, 1, 0, 0, 0), /Timid/);
  const t = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 1).id });
  assert.ok(t.hole === 4);
});

test('Trampling: each time it eats at the watering hole, 2 more plant food is removed', () => {
  let s = setUp(PP3, [[{ pop: 3, traits: ['Trampling'] }], [{ pop: 6 }]], null, { feed: true, hole: 10 });
  s = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 0).id });
  assert.strictEqual(s.hole, 7);
});

test('Insectivore: before each of your feeding turns, 1 meat from the bank while the watering hole has food', () => {
  let s = setUp(PP3, [[{ pop: 3 }], [{ pop: 3, traits: ['Insectivore'] }]], null, { feed: true, hole: 5, fseq: true });
  s = E.apply(s, 0, { t: 'eat', s: sp(s, 0, 0).id });
  assert.strictEqual(sp(s, 1, 0).food, 1);
});

test('Coprophagia: instead of the watering hole, takes food back out of your own food bag', () => {
  let s = setUp(PP3, [[{ pop: 3, traits: ['Coprophagia'] }], [{ pop: 6 }]], null, { feed: true, hole: 5 });
  s.players[0].bag = 3;
  s = E.apply(s, 0, { t: 'copro', s: sp(s, 0, 0).id });
  assert.strictEqual(sp(s, 0, 0).food, 1); assert.strictEqual(s.players[0].bag, 2); assert.strictEqual(s.hole, 5);
});

// ------------------------------------------------------------------ scenarios (Promo Pack III)
test('scenarios: Teeming Hordes, Land of Plenty, Radioactive Atmosphere, Cretaceous, Permian, Plant Life Explosion', () => {
  const g = scen => E.newGame({ seed: 8, players: humans(3), exp: { v: 'base', scen } });
  assert.strictEqual(g('Teeming Hordes').players[0].species[0].pop, 2);
  assert.ok(g('Land of Plenty').players.every(pl => pl.hand.length === 10));
  assert.ok(g('Radioactive Atmosphere').players.every(pl => pl.hand.length === 5));
  assert.strictEqual(g('Cretaceous Period').maxTraits, 99);
  assert.strictEqual(g('Great Permian Extinction').maxTraits, 1);
  let s = setUp({ v: 'base', scen: 'Plant Life Explosion' }, [[{ pop: 1, food: 1 }], [{ pop: 1, food: 1 }]], null, { feed: true, hole: 3 });
  s = E.apply(s, 0, { t: 'pass' });
  assert.strictEqual(cur(s).holeStart, 6);
});

// ------------------------------------------------------------------ old saves, computers, online
test('old base saves (no exp) still load and play the same game as a base game', () => {
  const play = s => {
    for (let g = 0; g < 5000 && !s.over; g++) { const p = E.toAct(s)[0]; s = E.apply(s, p, B.decide(s, p, ['easy', 'medium', 'hard'][p % 3])); }
    return s;
  };
  for (const seed of [1, 2, 3]) {
    const a = E.newGame({ seed, players: humans(3) });
    const old = JSON.parse(JSON.stringify(a)); delete old.exp; // a save from before expansions
    assert.strictEqual(E.view(old, 0).exp.v, 'base');
    const ra = play(a), rb = play(old);
    assert.ok(ra.over && rb.over);
    assert.deepStrictEqual(ra.result, rb.result);
  }
});

test('computers play legal moves in every version; every card is accounted for at the end', () => {
  const exps = [FLIGHT, { v: 'flight', promos: ['pp1', 'pp2', 'pp2x', 'pp3x'] }, { v: 'base', promos: ['pp1', 'pp2', 'pp2x', 'pp3x'] },
    { v: 'base', promos: ['pp2'], scen: 'Teeming Hordes' }, { v: 'flight', scen: 'Land of Plenty' }];
  let games = 0;
  for (let g = 0; g < 25; g++) {
    const exp = exps[g % exps.length], n = 2 + (g % 4), lv = ['easy', 'medium', 'hard'][g % 3];
    let s = E.newGame({ seed: 900 + g, players: humans(n), exp, quick: g % 2 === 1 });
    const total = C.buildDeck(s.exp).length + (s.flights ? s.flights.length : 0);
    for (let k = 0; k < 20000 && !s.over; k++) { const p = E.toAct(s)[0]; s = E.apply(s, p, B.decide(s, p, lv)); }
    assert.ok(s.over, 'game ' + g + ' ends');
    const inPlay = s.deck.length + s.discard.length + (s.reserve ? s.reserve.length : 0) + (s.flights ? s.flights.length : 0) +
      s.players.reduce((a, pl) => a + pl.hand.length + pl.species.reduce((b, x) => b + x.traits.length + x.hidden.length, 0), 0);
    assert.strictEqual(inPlay, total - s.removed, 'game ' + g + ' cards');
    games++;
  }
  assert.strictEqual(games, 25);
});

test('online: a Flight room sets up, shows the cliff and version publicly, hides hands, and plays to the end', () => {
  const rng = (a => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(77);
  const seats = [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }, { kind: 'human', name: 'C' }];
  let s = OG.game.setup(3, { exp: { v: 'flight', promos: ['pp2'] } }, rng, seats);
  assert.strictEqual(s.exp.v, 'flight');
  let sawCliff = false, sawReact = false;
  for (let k = 0; k < 20000 && !OG.game.isOver(s); k++) {
    const pub = OG.game.publicView(s);
    assert.strictEqual(pub.exp.v, 'flight');
    const js = JSON.stringify(pub);
    assert.strictEqual(js.indexOf('"seed"'), -1); assert.strictEqual(js.indexOf('"reserve"'), -1); assert.strictEqual(js.indexOf('"hand"'), -1);
    if (pub.cliff > 0) sawCliff = true;
    if (s.phase === 'react') { sawReact = true; assert.ok(pub.pending); }
    const seat = OG.game.toAct(s)[0];
    const v = OG.viewFromSnap({ pub, mySeat: seat, mine: OG.game.privateView(s, seat) });
    assert.deepStrictEqual(v.me.hand, s.players[seat].hand);
    s = OG.game.apply(JSON.parse(JSON.stringify(s)), seat, OG.game.bot({ state: s, pub, mine: OG.game.privateView(s, seat) }, seat));
  }
  assert.ok(OG.game.isOver(s));
  assert.ok(sawCliff, 'the cliff filled');
  void sawReact;
});

console.log('flight tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
