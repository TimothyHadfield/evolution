// Edge cases for the Evolution engine: empty deck and discard, empty hands, shared wins, and
// "every game ends". Run: node tests/edge.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const B = require('../js/bots.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); }
}
const bots = (n, lv) => Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: lv }));

test('deck and discard both empty at the deal: that round is the last (the game still ends)', () => {
  // a 3-player game whose deal finds no cards anywhere (every card is in hands or on species)
  let s = E.newGame({ seed: 5, players: [{ name: 'Me' }, { name: 'B1' }, { name: 'B2' }] });
  const t = E.clone(s);
  // pretend the round just ended with every remaining card out of play
  t.phase = 'feed'; t.turn = 0; t.passes = 0;
  t.players.forEach(pl => { pl.hand = []; pl.foodCard = null; pl.species.forEach(sp => { sp.food = sp.pop; }); });
  t.deck = []; t.discard = []; t.lastRound = false; t.lastNext = false; t.hole = 0;
  // (all humans, so apply stops at the next decision instead of playing on forever)
  const u = E.apply(t, 0, { t: 'pass' });
  assert.strictEqual(u.round, s.round + 1);
  assert.ok(u.lastRound, 'the round dealt with no cards is the last one');
});

test('a player with no cards at the food step places nothing and the round goes on', () => {
  let s = E.newGame({ seed: 9, players: [{ name: 'Me' }, { name: 'C', bot: 'hard' }], stepBots: true });
  assert.strictEqual(s.phase, 'food');
  s.discard.push(...s.players[0].hand); s.players[0].hand = [];
  const v = E.view(s, 0);
  assert.deepStrictEqual(v.toAct, [0]);
  const t = E.apply(s, 0, { t: 'food' });
  assert.strictEqual(t.players[0].foodCard, -1);
  assert.notStrictEqual(t.phase, 'food');
});

test('three-way tie on points and traits goes to population; full tie is a shared win', () => {
  const s = E.newGame({ seed: 3, players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  const mk = (body, pop, n) => ({ id: 0, body, pop, food: pop, fat: 0, traits: [], hidden: [], born: 1 });
  let id = 500;
  s.players.forEach(pl => { pl.hand = []; pl.foodCard = null; });
  s.players[0].species = [mk(1, 3)]; s.players[0].bag = 5;
  s.players[1].species = [mk(1, 4)]; s.players[1].bag = 4;
  s.players[2].species = [mk(1, 4)]; s.players[2].bag = 4;
  s.players.forEach(pl => pl.species.forEach(x => { x.id = id++; }));
  s.phase = 'feed'; s.turn = 0; s.passes = 0; s.hole = 0; s.lastRound = true;
  const t = E.apply(s, 0, { t: 'pass' });
  assert.ok(t.over);
  // 8 each, no traits; B and C have more population
  assert.deepStrictEqual(t.result.winners, [1, 2]);
});

test('600 computer games at every table size and level all end, cards conserved', () => {
  for (let g = 0; g < 600; g++) {
    const n = 2 + (g % 5), lv = ['easy', 'medium', 'hard'][g % 3];
    const s = E.newGame({ seed: 77000 + g, players: bots(n, lv), quick: g % 2 === 0 });
    assert.ok(s.over, 'game ' + g + ' ended');
    assert.ok(s.result && s.result.winners.length >= 1, 'winner in game ' + g);
    const cards = s.deck.length + s.discard.length + s.players.reduce((a, pl) => a + pl.hand.length + pl.species.reduce((b, x) => b + x.traits.length + x.hidden.length, 0), 0);
    assert.strictEqual(cards, 129 - s.removed, 'cards conserved in game ' + g);
    assert.ok(s.hist.every(h => h.holeEnd == null || h.holeEnd >= 0), 'hole never negative');
  }
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
