// Rules tests for the Evolution engine. Run: node tests/engine.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const O = require('../js/odds.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); }
}

// ---------- helpers: build a feeding-phase table by hand
const used = new Set();
function card(t) { const c = C.DECK.find(x => x.trait === t && !used.has(x.id)); used.add(c.id); return c.id; }
function sp(body, pop, traits, extra) { return Object.assign({ id: 0, body, pop, food: 0, fat: 0, traits: (traits || []).map(card), hidden: [], born: 1 }, extra || {}); }
// rows: one array of species per player
function table(rows, o) {
  o = o || {};
  used.clear();
  const s = E.newGame({ seed: 7, players: rows.map((_, i) => ({ name: 'P' + i })) });
  let id = 100;
  s.players.forEach((pl, p) => {
    pl.species = rows[p].map(f => { const x = f(); x.id = id++; return x; });
    pl.hand = (o.hands && o.hands[p] || []).map(card);
    pl.bag = 0;
  });
  s.phase = 'feed'; s.turn = o.turn || 0; s.passes = 0; s.hole = o.hole == null ? 10 : o.hole; s.first = 0;
  return s;
}
const S = (s, p, i) => s.players[p].species[i];

// ================= deck
test('deck: 129 cards, 17 traits, 17 Carnivores and 7 of each other', () => {
  assert.strictEqual(C.DECK.length, 129);
  assert.strictEqual(C.TRAITS.length, 17);
  for (const t of C.TRAITS) assert.strictEqual(C.DECK.filter(c => c.trait === t).length, t === 'Carnivore' ? 17 : 7, t);
});
test('deck: food histogram -3..9 matches the 2nd printing', () => {
  const h = [];
  for (let f = -3; f <= 9; f++) h.push(C.DECK.filter(c => c.food === f).length);
  assert.deepStrictEqual(h, [2, 3, 4, 7, 10, 15, 25, 25, 18, 11, 6, 2, 1]);
});
test('deck: per-trait food totals (Long Neck 42, Ambush 0, Carnivore 51)', () => {
  const tot = t => C.DECK.filter(c => c.trait === t).reduce((a, c) => a + c.food, 0);
  assert.strictEqual(tot('Long Neck'), 42); assert.strictEqual(tot('Ambush'), 0); assert.strictEqual(tot('Pack Hunting'), 0);
  assert.strictEqual(tot('Carnivore'), 51); assert.strictEqual(tot('Fertile'), 33);
});
test('deck: sample cards from the rulebook exist', () => {
  for (const [t, f] of [['Ambush', -3], ['Burrowing', 3], ['Carnivore', 1], ['Cooperation', 0], ['Defensive Herding', 2], ['Fat Tissue', 0], ['Fertile', 5], ['Intelligence', -2], ['Long Neck', 7]])
    assert.ok(C.DECK.some(c => c.trait === t && c.food === f), t + ' ' + f);
});

// ================= setup
test('setup: 2 players remove 40 cards and allow 2 traits', () => {
  const s = E.newGame({ seed: 3, players: [{}, {}] });
  assert.strictEqual(s.removed, 40); assert.strictEqual(s.maxTraits, 2);
  const inPlay = s.deck.length + s.players.reduce((a, p) => a + p.hand.length, 0);
  assert.strictEqual(inPlay, 89);
});
test('setup: 3 players deal 4 cards each (3 + 1 species), 3 traits allowed', () => {
  const s = E.newGame({ seed: 3, players: [{}, {}, {}] });
  assert.strictEqual(s.maxTraits, 3);
  s.players.forEach(p => { assert.strictEqual(p.hand.length, 4); assert.strictEqual(p.species.length, 1); assert.strictEqual(p.species[0].body, 1); });
  assert.strictEqual(s.deck.length, 129 - 12);
});
test('setup: 6 players force Quick Play', () => {
  assert.strictEqual(E.newGame({ seed: 1, players: [{}, {}, {}, {}, {}, {}] }).quick, true);
  assert.strictEqual(E.newGame({ seed: 1, players: [{}, {}, {}] }).quick, false);
});
test('play phase: one player at a time unless Quick Play', () => {
  let s = E.newGame({ seed: 5, players: [{}, {}, {}] });
  for (let p = 0; p < 3; p++) s = E.apply(s, p, { t: 'food', card: s.players[p].hand[0] });
  assert.strictEqual(s.phase, 'play');
  assert.deepStrictEqual(E.toAct(s), [s.first]);
  assert.throws(() => E.apply(s, (s.first + 1) % 3, { t: 'play', moves: [] }));
  let q = E.newGame({ seed: 5, players: [{}, {}, {}], quick: true });
  for (let p = 0; p < 3; p++) q = E.apply(q, p, { t: 'food', card: q.players[p].hand[0] });
  assert.strictEqual(E.toAct(q).length, 3);
});
test('play: max 6 body, no duplicate trait, trait limit', () => {
  let s = E.newGame({ seed: 9, players: [{}, {}, {}] });
  for (let p = 0; p < 3; p++) s = E.apply(s, p, { t: 'food', card: s.players[p].hand[0] });
  const p = s.first, pl = s.players[p], spid = pl.species[0].id;
  pl.species[0].body = 6;
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [{ t: 'body', card: pl.hand[0], s: spid }] }), /6/);
  pl.species[0].traits = [C.DECK.find(c => c.trait === 'Climbing').id];
  const cl = C.DECK.filter(c => c.trait === 'Climbing')[1].id;
  pl.hand[0] = cl;
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [{ t: 'trait', card: cl, s: spid }] }), /already/);
  pl.species[0].traits = ['Horns', 'Burrowing', 'Symbiosis'].map(t => C.DECK.find(c => c.trait === t).id);
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [{ t: 'trait', card: pl.hand[1], s: spid }] }), /at most 3/);
});
test('play: a bad move list changes nothing', () => {
  let s = E.newGame({ seed: 9, players: [{}, {}, {}] });
  for (let p = 0; p < 3; p++) s = E.apply(s, p, { t: 'food', card: s.players[p].hand[0] });
  const p = s.first, before = JSON.stringify(s);
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [{ t: 'species', card: s.players[p].hand[0], side: 'R' }, { t: 'pop', card: 999, s: -1 }] }));
  assert.strictEqual(JSON.stringify(s), before);
});

// ================= attacks
const carn = (b, p, more) => () => sp(b, p, ['Carnivore'].concat(more || []));
test('attack: needs a bigger body; Hard Shell adds 4', () => {
  const s = table([[carn(3, 2)], [() => sp(3, 1), () => sp(2, 1), () => sp(1, 1, ['Hard Shell'])]]);
  assert.ok(E.attackBlock(s, 0, 0, 1, 0)); // equal size
  assert.strictEqual(E.attackBlock(s, 0, 0, 1, 1), '');
  assert.ok(/Hard Shell/.test(E.attackBlock(s, 0, 0, 1, 2)));
});
test('attack: Pack Hunting adds population to size', () => {
  const s = table([[carn(2, 3, ['Pack Hunting'])], [() => sp(4, 1)]]);
  assert.strictEqual(E.attackBlock(s, 0, 0, 1, 0), '');
});
test('attack: Climbing, Burrowing, Defensive Herding, Symbiosis, Warning Call/Ambush', () => {
  const s = table([[carn(6, 2), carn(6, 2, ['Climbing']), carn(6, 2, ['Ambush'])],
    [() => sp(1, 1, ['Climbing']), () => sp(1, 1, ['Burrowing'], { food: 1 }), () => sp(1, 2, ['Defensive Herding']), () => sp(1, 1, ['Symbiosis']), () => sp(2, 1), () => sp(1, 1, ['Warning Call']), () => sp(1, 1)]]);
  assert.ok(E.attackBlock(s, 0, 0, 1, 0)); assert.strictEqual(E.attackBlock(s, 0, 1, 1, 0), '');
  assert.ok(E.attackBlock(s, 0, 0, 1, 1)); S(s, 1, 1).food = 0; assert.strictEqual(E.attackBlock(s, 0, 0, 1, 1), '');
  assert.ok(E.attackBlock(s, 0, 0, 1, 2)); S(s, 0, 0).pop = 3; assert.strictEqual(E.attackBlock(s, 0, 0, 1, 2), '');
  assert.ok(/Symbiosis/.test(E.attackBlock(s, 0, 0, 1, 3)));
  assert.ok(/Warning/.test(E.attackBlock(s, 0, 0, 1, 6))); assert.strictEqual(E.attackBlock(s, 0, 2, 1, 6), '');
  assert.ok(/Warning/.test(E.attackBlock(s, 0, 0, 1, 4)));
});
test('attack: a Carnivore may eat its own species but not itself', () => {
  const s = table([[carn(3, 1), () => sp(1, 1)], [() => sp(5, 1)]]);
  assert.strictEqual(E.attackBlock(s, 0, 0, 0, 1), '');
  assert.ok(E.attackBlock(s, 0, 0, 0, 0));
});
test('attack: meat = prey body; prey extinct at 0 draws 1 card per trait', () => {
  let s = table([[carn(5, 3)], [() => sp(3, 1, ['Fertile']), () => sp(1, 1)]]);
  const target = S(s, 1, 0).id, h0 = s.players[1].hand.length;
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target });
  assert.strictEqual(S(s, 0, 0).food, 3);
  assert.strictEqual(s.players[1].species.length, 1);
  assert.strictEqual(s.players[1].hand.length, h0 + 1);
});
test('attack: meat is capped by hunger (no Fat Tissue)', () => {
  let s = table([[carn(5, 2)], [() => sp(4, 2)]]);
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id });
  assert.strictEqual(S(s, 0, 0).food, 2);
});
test('attack: Horns costs the attacker 1 population first', () => {
  let s = table([[carn(5, 3)], [() => sp(2, 2, ['Horns'])]]);
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id });
  assert.strictEqual(S(s, 0, 0).pop, 2); assert.strictEqual(S(s, 0, 0).food, 2); assert.strictEqual(S(s, 1, 0).pop, 1);
});
test('attack: Horns on a population-1 attacker kills it and it eats nothing', () => {
  let s = table([[carn(5, 1), () => sp(1, 1)], [() => sp(2, 2, ['Horns'])]]);
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id });
  assert.strictEqual(s.players[0].species.length, 1);
  assert.strictEqual(S(s, 1, 0).pop, 1);
});
test('attack: prey food above its new population goes behind the screen', () => {
  let s = table([[carn(5, 3)], [() => sp(2, 2, [], { food: 2 })]]);
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id });
  assert.strictEqual(S(s, 1, 0).food, 1); assert.strictEqual(s.players[1].bag, 1);
});
test('Scavenger: 1 meat per population lost (Horns counts twice)', () => {
  let s = table([[carn(5, 3)], [() => sp(2, 3, ['Horns'])], [() => sp(1, 3, ['Scavenger'])]]);
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id });
  assert.strictEqual(S(s, 2, 0).food, 2);
});
test('Scavenger: a Carnivore that is a Scavenger also scavenges its own kill', () => {
  let s = table([[carn(5, 6, ['Scavenger'])], [() => sp(2, 3)]]);
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id });
  assert.strictEqual(S(s, 0, 0).food, 3);
});
test('Intelligence: discard a card per switched-off trait', () => {
  let s = table([[carn(6, 2, ['Intelligence'])], [() => sp(2, 1, ['Climbing', 'Hard Shell']), () => sp(6, 3)]], { hands: [['Horns', 'Horns', 'Horns']] });
  const o = E.feedOptions(s, 0).find(x => x.t === 'attack');
  assert.deepStrictEqual(o.ignore.slice().sort(), ['Climbing', 'Hard Shell']);
  assert.throws(() => E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id, ignore: o.ignore, cards: [s.players[0].hand[0]] }));
  s = E.apply(s, 0, { t: 'attack', s: S(s, 0, 0).id, target: S(s, 1, 0).id, ignore: o.ignore, cards: s.players[0].hand.slice(0, 2) });
  assert.strictEqual(s.players[0].hand.length, 1);
  assert.strictEqual(s.players[1].species.length, 1);
});
test('Intelligence: plant eater takes 2 from the bank and keeps its turn', () => {
  let s = table([[() => sp(2, 4, ['Intelligence'])], [() => sp(1, 1)]], { hands: [['Horns']], hole: 3 });
  s = E.apply(s, 0, { t: 'intel', s: S(s, 0, 0).id, card: s.players[0].hand[0] });
  assert.strictEqual(S(s, 0, 0).food, 2); assert.strictEqual(s.hole, 3); assert.strictEqual(s.turn, 0);
});

// ================= feeding
test('feeding: must feed a hungry species that can eat; pass is refused', () => {
  const s = table([[() => sp(1, 1)], [() => sp(1, 1)]], { hole: 2 });
  assert.strictEqual(E.canPass(s, 0), false);
  assert.throws(() => E.apply(s, 0, { t: 'pass' }), /must/);
});
test('feeding: a Carnivore must attack even its own species if that is all it can eat', () => {
  const s = table([[carn(3, 1), () => sp(1, 1, [], { food: 1 })], [() => sp(5, 1, [], { food: 1 })]], { hole: 0 });
  const opts = E.feedOptions(s, 0);
  assert.ok(opts.some(o => o.t === 'attack' && o.must));
  assert.strictEqual(E.canPass(s, 0), false);
});
test('feeding: Foraging takes 2, Cooperation passes 1 to the right (chains)', () => {
  let s = table([[() => sp(1, 3, ['Foraging', 'Cooperation']), () => sp(1, 3, ['Cooperation']), () => sp(1, 3)], [() => sp(1, 1)]], { hole: 10 });
  s = E.apply(s, 0, { t: 'eat', s: S(s, 0, 0).id });
  assert.deepStrictEqual(s.players[0].species.map(x => x.food), [2, 1, 1]);
  assert.strictEqual(s.hole, 6);
});
test('feeding: Fat Tissue stores food after full, up to body size', () => {
  let s = table([[() => sp(2, 1, ['Fat Tissue'], { food: 1 })], [() => sp(1, 1, [], { food: 1 })]], { hole: 5 });
  s = E.apply(s, 0, { t: 'eat', s: S(s, 0, 0).id });
  assert.strictEqual(S(s, 0, 0).fat, 1);
});
test('end of round: starve to food eaten, food to the bag, extinct at 0, first player moves', () => {
  let s = table([[() => sp(1, 3, [], { food: 1 }), () => sp(1, 2)], [() => sp(1, 1, [], { food: 1 })]], { hole: 0 });
  const first = s.first;
  s.passes = 0; s = E.apply(s, 0, { t: 'pass' });
  assert.strictEqual(s.round, 2);
  assert.strictEqual(s.players[0].bag, 1);
  // first species at pop 1 survives, second extinct (then a new one is not given: player still has one)
  assert.strictEqual(s.players[0].species.length, 1);
  assert.strictEqual(s.players[0].species[0].pop, 1);
  assert.strictEqual(s.first, (first + 1) % 2);
});
test('reveal: Fertile (needs food in the hole), Fat Tissue feeds, Long Neck from the bank', () => {
  let s = E.newGame({ seed: 11, players: [{}, {}, {}], quick: true });
  for (let p = 0; p < 3; p++) s = E.apply(s, p, { t: 'food', card: s.players[p].hand[0] });
  used.clear();
  s.hole = 2;
  s.players[0].species = [sp(2, 2, ['Fertile']), sp(2, 3, ['Fat Tissue'], { fat: 2 }), sp(1, 2, ['Long Neck'])];
  s.players[0].species.forEach((x, i) => { x.id = 500 + i; });
  for (let p = 0; p < 3; p++) s = E.apply(s, p, { t: 'play', moves: [] });
  const [f, ft, ln] = s.players[0].species;
  assert.strictEqual(f.pop, 3); assert.strictEqual(ft.food, 2); assert.strictEqual(ft.fat, 0); assert.strictEqual(ln.food, 1);
});
// rulebook p.6: "If a player has more than 1 of these cards in play, they choose the order in which their traits activate."
// Fertile + Fat Tissue on one species: Fertile first moves one more stored food onto the board.
function leafTable(bot) {
  let s = E.newGame({ seed: 11, players: [{ bot: bot || null }, {}, {}], quick: true });
  for (let p = 0; p < 3; p++) if (s.phase === 'food' && E.toAct(s).indexOf(p) >= 0) s = E.apply(s, p, { t: 'food', card: s.players[p].hand[0] });
  used.clear();
  s.hole = 2;
  s.players[0].species = [sp(4, 1, ['Fertile', 'Fat Tissue'], { fat: 4 })];
  s.players[0].species[0].id = 600;
  for (let p = 1; p < 3; p++) s.players[p].species.forEach(x => { x.traits = []; x.hidden = []; });
  for (let p = 0; p < 3; p++) if (E.toAct(s).indexOf(p) >= 0) s = E.apply(s, p, { t: 'play', moves: [] });
  return s;
}
test('reveal: the owner chooses the order of their leaf traits when it changes the result', () => {
  const s = leafTable();
  assert.strictEqual(s.phase, 'leaf');
  assert.deepStrictEqual(E.toAct(s), [0]);
  const opts = E.view(s, 0).leaf[0];
  assert.strictEqual(opts.length, 2);
  assert.deepStrictEqual(opts[0].order.map(a => a.t), ['Fertile', 'Fat Tissue']);
  assert.deepStrictEqual(opts[1].order.map(a => a.t), ['Fat Tissue', 'Fertile']);
  assert.ok(E.view(s, -1).leaf, 'the choice is public (traits are face up)');
  assert.deepStrictEqual(E.view(s, 1).hist[E.view(s, 1).hist.length - 1].foodCards, [], 'food cards stay face down while choosing');
  assert.throws(() => E.apply(s, 1, { t: 'leaf', k: 0 }), /turn/);
  assert.throws(() => E.apply(s, 0, { t: 'leaf', k: 5 }), /order/);
  const a = E.apply(s, 0, { t: 'leaf', k: 0 }), b = E.apply(s, 0, { t: 'leaf', k: 1 });
  assert.strictEqual(a.phase, 'feed'); assert.strictEqual(b.phase, 'feed');
  const x = a.players[0].species[0], y = b.players[0].species[0];
  assert.deepStrictEqual([x.pop, x.food, x.fat], [2, 2, 2]);
  assert.deepStrictEqual([y.pop, y.food, y.fat], [2, 1, 3]);
});
test('reveal: computers take the best leaf order without stopping; no choice when every order gives the same result', () => {
  const s = leafTable('hard');
  assert.strictEqual(s.phase, 'feed');
  const x = s.players[0].species[0];
  assert.deepStrictEqual([x.pop, x.food, x.fat], [2, 2, 2]);
  // Fertile alone on one species and Long Neck on another: order can't matter
  let t = E.newGame({ seed: 11, players: [{}, {}, {}], quick: true });
  for (let p = 0; p < 3; p++) t = E.apply(t, p, { t: 'food', card: t.players[p].hand[0] });
  used.clear(); t.hole = 2;
  t.players[0].species = [sp(2, 2, ['Fertile']), sp(1, 2, ['Long Neck'])];
  t.players[0].species.forEach((q, i) => { q.id = 700 + i; });
  for (let p = 0; p < 3; p++) t = E.apply(t, p, { t: 'play', moves: [] });
  assert.strictEqual(t.phase, 'feed');
});
test('scoring: bag + population + traits; ties broken by traits', () => {
  const s = table([[() => sp(1, 2, ['Horns', 'Climbing'])], [() => sp(1, 4)]]);
  s.players[0].bag = 5; s.players[1].bag = 5;
  assert.deepStrictEqual(E.score(s, 0), { food: 5, pop: 2, traits: 2, total: 9 });
  assert.strictEqual(E.score(s, 1).total, 9);
  s.lastRound = true; s.hole = 0; s.players.forEach(pl => pl.species.forEach(x => { x.food = x.pop; }));
  s.players[0].bag = 3; s.players[1].bag = 1; // 3+2+2 = 1+4+4 = 9: tie, more traits wins
  const t = E.apply(s, 0, { t: 'pass' });
  assert.ok(t.over);
  assert.deepStrictEqual(t.result.winners, [0]);
});
test('views hide hands, bags, face-down traits and the seed', () => {
  const s = E.newGame({ seed: 4, players: [{}, {}, {}] });
  s.players[1].species[0].hidden = [5];
  const v = E.view(s, 0);
  assert.strictEqual(JSON.stringify(v).indexOf('"seed"'), -1);
  assert.strictEqual(v.players[1].bag, null);
  assert.deepStrictEqual(v.players[1].species[0].hidden, [-1]);
  assert.ok(!('hand' in v.players[1]));
});

// ================= odds
test('odds: sumDist equals brute force', () => {
  const foods = [3, -1, 0, 4, 4, 2, 7];
  const d = O.sumDist(foods, 3);
  const bf = {};
  let n = 0;
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) for (let k = j + 1; k < 7; k++) { const x = foods[i] + foods[j] + foods[k]; bf[x] = (bf[x] || 0) + 1; n++; }
  for (const x in bf) assert.ok(Math.abs((d.find(e => e.sum === +x) || { p: 0 }).p - bf[x] / n) < 1e-9, 'sum ' + x);
});

// ================= whole games
test('bots: 60 full games at every table size, no illegal moves, JSON round trip', () => {
  for (let g = 0; g < 60; g++) {
    const n = 2 + (g % 5), lv = ['easy', 'medium', 'hard'][g % 3];
    let s = E.newGame({ seed: 1000 + g, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: lv })), quick: g % 2 === 0 });
    s = JSON.parse(JSON.stringify(s));
    assert.ok(s.over, 'game ' + g + ' finished');
    assert.ok(s.round >= 3 && s.round < 40, 'rounds ' + s.round);
    const cards = s.deck.length + s.discard.length + s.players.reduce((a, pl) => a + pl.hand.length + pl.species.reduce((b, x) => b + x.traits.length + x.hidden.length, 0), 0);
    assert.strictEqual(cards, 129 - s.removed, 'cards conserved in game ' + g);
  }
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
