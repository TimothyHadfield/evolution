// Fluid play (Tim's variant, docs/rules-check.md): the food card is placed during your own play turn,
// in the same action as your card plays ({t:'play', moves, food}). Run: node tests/fluid.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const { game } = require('../js/online-game.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); }
}
const people = n => Array.from({ length: n }, (_, i) => ({ name: 'P' + i }));
const cardsIn = s => s.deck.length + s.discard.length + s.players.reduce((a, pl) => a + pl.hand.length + (pl.foodCard != null && pl.foodCard >= 0 && s.phase !== 'feed' && s.phase !== 'over' ? 1 : 0) + pl.species.reduce((b, x) => b + x.traits.length + x.hidden.length, 0), 0);

test('fluid: a new game starts in the play step (no separate food step), first player first', () => {
  const s = E.newGame({ seed: 5, players: people(3) });
  assert.strictEqual(s.fluid, true);
  assert.strictEqual(s.phase, 'play');
  assert.deepStrictEqual(E.toAct(s), [s.first]);
  assert.ok(s.players.every(pl => pl.foodCard === null));
  assert.strictEqual(E.view(s, 0).fluid, true);
});

test('fluid: holding cards, the food card is required; it leaves the hand and stays face down', () => {
  const s = E.newGame({ seed: 5, players: people(3) });
  const p = s.first, h = s.players[p].hand;
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [] }), /food card/);
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [], food: 999 }));
  const t = E.apply(s, p, { t: 'play', moves: [], food: h[1] });
  assert.strictEqual(t.players[p].foodCard, h[1]);
  assert.strictEqual(t.players[p].hand.indexOf(h[1]), -1);
  assert.strictEqual(t.phase, 'play');
  assert.deepStrictEqual(E.toAct(t), [(p + 1) % 3]);
  const v = E.view(t, (p + 1) % 3);
  assert.strictEqual(v.players[p].foodPicked, true);
  assert.strictEqual(v.players[(p + 2) % 3].foodPicked, false);
  assert.deepStrictEqual(v.hist[v.hist.length - 1].foodCards, [], 'food cards hidden until the reveal');
  assert.strictEqual(cardsIn(t), 129);
});

test('fluid: the food card can not also be played; a bad play changes nothing', () => {
  const s = E.newGame({ seed: 9, players: people(3) });
  const p = s.first, h = s.players[p].hand, sid = s.players[p].species[0].id, before = JSON.stringify(s);
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [{ t: 'body', card: h[0], s: sid }], food: h[0] }), /food card/);
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [{ t: 'species', card: h[0], side: 'R' }, { t: 'pop', card: h[1], s: -1 }], food: h[1] }));
  assert.strictEqual(JSON.stringify(s), before);
  const t = E.apply(s, p, { t: 'play', moves: [{ t: 'species', card: h[0], side: 'R' }, { t: 'pop', card: h[1], s: -1 }], food: h[2] });
  assert.strictEqual(t.players[p].species.length, 2);
  assert.strictEqual(t.players[p].species[1].pop, 2);
  assert.strictEqual(t.players[p].foodCard, h[2]);
});

test('fluid: playing every card leaves no food card: refused', () => {
  const s = E.newGame({ seed: 9, players: people(3) });
  const p = s.first, h = s.players[p].hand, sid = s.players[p].species[0].id;
  assert.throws(() => E.apply(s, p, { t: 'play', moves: h.map(c => ({ t: 'pop', card: c, s: sid })).slice(0, 4) }), /food card/);
});

test('fluid: an empty hand plays with no food card (foodCard -1); a food card from nowhere is refused', () => {
  const s = E.newGame({ seed: 9, players: people(3) });
  const p = s.first;
  s.discard.push(...s.players[p].hand); s.players[p].hand = [];
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [], food: 5 }));
  const t = E.apply(s, p, { t: 'play', moves: [] });
  assert.strictEqual(t.players[p].foodCard, -1);
  const u = E.apply(s, p, { t: 'play', moves: [], food: null });
  assert.strictEqual(u.players[p].foodCard, -1);
});

test('fluid: the food cards add up at the reveal exactly as before (quick and one at a time)', () => {
  for (const quick of [false, true]) {
    let s = E.newGame({ seed: 21, players: people(3), quick });
    const hole0 = s.hole;
    let sum = 0;
    if (quick) assert.strictEqual(E.toAct(s).length, 3);
    for (let k = 0; k < 3; k++) {
      const p = E.toAct(s)[0];
      const f = s.players[p].hand[0];
      sum += C.DECK[f].food;
      s = E.apply(s, p, { t: 'play', moves: [], food: f });
    }
    assert.notStrictEqual(s.phase, 'play');
    if (s.phase === 'feed') assert.strictEqual(s.hole, Math.max(0, hole0 + sum), 'quick ' + quick);
    const h = s.hist[s.hist.length - 1];
    assert.strictEqual(h.foodCards.length, 3);
  }
});

test('fluid: Quick Play takes plays in any seat order', () => {
  let s = E.newGame({ seed: 4, players: people(3), quick: true });
  for (const p of [2, 0, 1]) s = E.apply(s, p, { t: 'play', moves: [], food: s.players[p].hand[0] });
  assert.strictEqual(s.round >= 1 && s.phase !== 'play', true);
});

test('classic: fluid:false and an old save (no fluid flag) keep the separate food step', () => {
  let s = E.newGame({ seed: 5, players: people(3), fluid: false });
  assert.strictEqual(s.phase, 'food');
  for (let p = 0; p < 3; p++) s = E.apply(s, p, { t: 'food', card: s.players[p].hand[0] });
  assert.strictEqual(s.phase, 'play');
  assert.throws(() => E.apply(s, s.first, { t: 'play', moves: [], food: s.players[s.first].hand[0] }), /already/);
  s = E.apply(s, s.first, { t: 'play', moves: [] });
  // an old save: built before fluid existed (no flag at all), round 2 still has the food step
  let o = E.newGame({ seed: 8, players: people(2), fluid: false });
  delete o.fluid;
  o = JSON.parse(JSON.stringify(o));
  for (let p = 0; p < 2; p++) o = E.apply(o, p, { t: 'food', card: o.players[p].hand[0] });
  while (o.round === 1 && !o.over) { const p = E.toAct(o)[0]; o = E.apply(o, p, B.decide(o, p, 'medium')); }
  assert.strictEqual(o.phase, 'food');
  assert.strictEqual(E.view(o, 0).fluid, false);
});

test('bots: fluid plays are legal over 300 seeded games (every level and table size; food never reused)', () => {
  let plays = 0;
  for (let g = 0; g < 300; g++) {
    const n = 2 + (g % 5), lv = ['easy', 'medium', 'hard'][g % 3];
    let s = E.newGame({ seed: 4000 + g, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i })), quick: g % 2 === 0 });
    let guard = 0;
    while (!s.over && guard++ < 20000) {
      const p = E.toAct(s)[0];
      const a = B.decide(s, p, lv);
      if (s.phase === 'play') {
        plays++;
        assert.strictEqual(s.phase === 'food', false);
        if (s.players[p].hand.length) assert.ok(a.food != null && s.players[p].hand.indexOf(a.food) >= 0, 'food card from the hand');
        assert.ok(!a.moves.some(m => m.card === a.food), 'food card not also played');
      }
      s = E.apply(s, p, a);
    }
    assert.ok(s.over, 'game ' + g + ' ended');
    const cards = s.deck.length + s.discard.length + s.players.reduce((a, pl) => a + pl.hand.length + pl.species.reduce((b, x) => b + x.traits.length + x.hidden.length, 0), 0);
    assert.strictEqual(cards, 129 - s.removed, 'cards conserved in game ' + g);
  }
  assert.ok(plays > 1000);
});

test('bots: computer seats inside the engine play fluid games to the end', () => {
  for (let g = 0; g < 30; g++) {
    const s = E.newGame({ seed: 9000 + g, players: Array.from({ length: 2 + (g % 5) }, (_, i) => ({ name: 'C' + i, bot: ['easy', 'medium', 'hard'][g % 3] })), quick: g % 2 === 1 });
    assert.ok(s.over && s.fluid);
  }
});

test('online: new rooms are fluid; a seat handed to the computer answers a fluid play; {fluid:false} keeps the food step', () => {
  const rng = (a => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(77);
  const humans = [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }, { kind: 'human', name: 'C' }];
  const s = game.setup(3, {}, rng, humans);
  assert.strictEqual(s.fluid, true); assert.strictEqual(s.phase, 'play');
  const seat = game.toAct(s)[0];
  const a = game.bot({ state: s }, seat);
  assert.strictEqual(a.t, 'play'); assert.ok(a.food != null);
  const t = game.apply(JSON.parse(JSON.stringify(s)), seat, JSON.parse(JSON.stringify(a)));
  assert.strictEqual(t.players[seat].foodCard, a.food);
  assert.strictEqual(game.publicView(t).fluid, true);
  assert.strictEqual(game.setup(3, { fluid: false }, rng, humans).phase, 'food');
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
