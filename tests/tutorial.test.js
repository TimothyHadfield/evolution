// The stacked first game (js/tutorial.js) and the My stats rules (js/evoprofile.js), in plain node.
// Run: node tests/tutorial.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const TU = require('../js/tutorial.js');
const EP = require('../js/evoprofile.js');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.stack || e)); } }

const S = TU.SCRIPT;
test('tutorial deal: my 4 scripted cards, the computer plant-eater cards, no card twice, 89 cards in play', () => {
  const s = TU.build(E, 'You');
  assert.deepStrictEqual(s.players[0].hand.slice().sort((a, b) => a - b), [S.food, S.species, S.carn, S.body].sort((a, b) => a - b));
  assert.deepStrictEqual(s.players[1].hand.slice().sort((a, b) => a - b), TU.CPU.slice().sort((a, b) => a - b));
  const all = s.deck.concat(s.players[0].hand, s.players[1].hand);
  assert.strictEqual(new Set(all).size, all.length);
  assert.strictEqual(all.length, C.DECK.length - 40);
  assert.strictEqual(s.first, 0);
  assert.strictEqual(s.players[1].bot, 'easy');
  assert.ok(s.players[1].hand.every(id => C.DEFENSES.indexOf(C.DECK[id].trait) < 0 && C.DECK[id].trait !== 'Carnivore'));
});

test('tutorial script holds: food, new Carnivore of body 2, plant eater eats, the Carnivore can attack', () => {
  let s = TU.build(E, 'You');
  s = E.apply(s, 0, { t: 'food', card: S.food });
  assert.strictEqual(s.phase, 'play'); assert.deepStrictEqual(E.toAct(s), [0]);
  s = E.apply(s, 0, { t: 'play', moves: [{ t: 'species', card: S.species, side: 'R' }, { t: 'trait', card: S.carn, s: -1 }, { t: 'body', card: S.body, s: -1 }] });
  assert.strictEqual(s.phase, 'feed'); assert.strictEqual(s.turn, 0);
  const plant = s.players[0].species[0], carn = s.players[0].species[1];
  assert.ok(E.isCarn(carn) && carn.body === 2);
  assert.ok(s.hole > 0);
  s = E.apply(s, 0, { t: 'eat', s: plant.id });
  for (let g = 0; g < 20 && s.turn !== 0 && !s.over; g++) { const b = E.toAct(s)[0]; s = E.apply(s, b, B.decide(s, b, 'easy')); }
  assert.strictEqual(s.turn, 0);
  const att = E.feedOptions(s, 0).find(o => o.t === 'attack' && o.s === carn.id && !o.ignore.length && E.findSp(s, o.target).p === 1);
  assert.ok(att, 'a prey for the new Carnivore');
  s = E.apply(s, 0, { t: 'attack', s: carn.id, target: att.target });
  assert.ok(s.log.some(l => l.k === 'atk' && l.p === 0));
});

test('tutorial: the same scripted game every time', () => {
  assert.strictEqual(JSON.stringify(TU.build(E, 'You')), JSON.stringify(TU.build(E, 'You')));
});

test('tutorial steps: 16, every action step has a target', () => {
  const st = TU.steps({ v: () => null, me: 0, draft: () => [], sel: () => null, mode: () => 'trait', myTurn: () => false });
  assert.strictEqual(st.length, 16);
  st.forEach(x => assert.ok(x.text || x.html));
  st.filter(x => x.until).forEach(x => assert.ok(x.target));
});

test('rules: 7 sections, every trait listed once', () => {
  const r = TU.rules(C.TEXT, t => '<i>' + t + '</i>');
  assert.strictEqual(r.sections.length, 7);
  const html = r.sections.map(x => x.html).join('');
  C.TRAITS.forEach(t => assert.strictEqual(html.split('<b>' + t + '</b>').length - 1, 1, t));
});

// ---- My stats
function finished(winners) {
  const s = { over: true, round: 7, players: [{ species: [{ pop: 6 }, { pop: 2 }], bag: 30 }, { species: [], bag: 10 }], result: { winners, scores: [{ total: 45, food: 41 }, { total: 20, food: 10 }] } };
  return s;
}
test('profile: a win vs Hard is rated at Hard with the end-of-game facts', () => {
  const r = EP.result({ st: finished([0]), me: 0, level: 'hard', helped: false });
  assert.strictEqual(r.mode, 'computer'); assert.strictEqual(r.level, 'hard'); assert.strictEqual(r.won, true);
  assert.strictEqual(r.extra.maxPop, 6); assert.strictEqual(r.extra.food, 41); assert.ok(!r.extra.quit);
});
test('profile: Undo or Hint = "with help", not rated', () => {
  const r = EP.result({ st: finished([0]), me: 0, level: 'hard', helped: true });
  assert.strictEqual(r.mode, 'help'); assert.strictEqual(r.level, null);
});
test('profile: leaving a game unfinished is a loss', () => {
  const s = finished([0]); s.over = false; s.result = null;
  const r = EP.result({ st: s, me: 0, level: 'medium' });
  assert.strictEqual(r.won, false); assert.strictEqual(r.extra.quit, true);
});
test('profile: shared win is a draw; level ladder Easy < Medium < Hard', () => {
  assert.strictEqual(EP.result({ st: finished([0, 1]), me: 0, level: 'easy' }).draw, true);
  const L = EP.LEVELS.map(l => l.rating);
  assert.ok(L[0] < L[1] && L[1] < L[2]);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
