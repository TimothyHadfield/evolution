// Evolution: Climate (docs/rules-check.md "Climate"; official Climate rulebook + docs/expansions-research.md).
// Run: node tests/climate.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const CL = require('../js/climate.js');
const { game } = require('../js/online-game.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n   ') : e)); }
}
const people = n => Array.from({ length: n }, (_, i) => ({ name: 'P' + i }));
const Z = n => CL.ZONES.findIndex(z => z.name === n);
const ids = s => s.deck.concat(s.discard, s.reserve || [], ...s.players.map(pl => pl.hand.concat(pl.foodCard != null && pl.foodCard >= 0 && s.phase !== 'feed' && s.phase !== 'over' ? [pl.foodCard] : [], ...pl.species.map(x => x.traits.concat(x.hidden)))));
// a card of trait t (Climate card if it has icons wanted), not used yet in this state
// (only cards still in the deck, the set-aside pile or the discards; each handed out once per game)
let taken = new Set();
function card(s, t, o) {
  o = o || {};
  const free = new Set(s.deck.concat(s.reserve || [], s.discard));
  const pool = C.deckIds('climate').map(id => C.CARD[id]).filter(c => c.trait === t && free.has(c.id) && !taken.has(c.id) &&
    (o.food == null || c.food === o.food) && (o.sun == null || (c.sun || 0) === o.sun) && (o.snow == null || (c.snow || 0) === o.snow));
  const c = pool[0];
  if (!c) throw new Error('no card ' + t + JSON.stringify(o));
  taken.add(c.id);
  // take it out of wherever it is so card counts stay right
  for (const list of [s.deck, s.reserve || [], s.discard]) { const k = list.indexOf(c.id); if (k >= 0) list.splice(k, 1); }
  return c.id;
}
// a fresh Climate game with people only, events switched off unless asked
function climate(n, o) {
  taken = new Set();
  const s = E.newGame(Object.assign({ seed: 3, players: people(n || 2), version: 'climate', events: false }, o || {}));
  return s;
}
// put `foods[p]` as each player's food card and play no cards; returns the state after the reveal
function reveal(s, foods) {
  let t = s;
  for (let k = 0; k < t.players.length && t.phase === 'play'; k++) {
    const p = E.toAct(t)[0];
    const f = foods[p];
    if (f != null && t.players[p].hand.indexOf(f) < 0) t.players[p].hand.push(f);
    t = E.apply(t, p, { t: 'play', moves: [], food: f != null ? f : t.players[p].hand[0] });
  }
  while (t.phase === 'leaf') { const p = E.toAct(t)[0]; t = E.apply(t, p, { t: 'leaf', k: 0 }); }
  return t;
}
// a food-0 base card without icons (4 exist: Cooperation, Fat Tissue, Intelligence, Pack Hunting) keeps the sum known
function plain(s) {
  for (const t of ['Cooperation', 'Fat Tissue', 'Intelligence', 'Pack Hunting']) { try { return card(s, t, { food: 0 }); } catch (e) { /* next */ } }
  throw new Error('no food-0 card left');
}
// fed: already full (so it can't starve if the round ends at the reveal because the hole is empty)
function sp(s, p, body, pop, traits, fed) {
  const x = { id: s.nextId++, body, pop, food: fed ? pop : 0, fat: 0, traits: (traits || []).map(t => card(s, t)), hidden: [], born: 1 };
  s.players[p].species = [x];
  return x;
}

// ------------------------------------------------------------------ deck
test('deck: 177 cards = 91 base cards without Ambush/Burrowing/Defensive Herding/Carnivore + 86 Climate cards', () => {
  const d = C.deckIds('climate');
  assert.strictEqual(d.length, 177);
  assert.strictEqual(d.filter(id => id < 1000).length, 91);
  assert.strictEqual(C.CLIMATE_DECK.length, 86);
  for (const id of d.filter(id => id < 1000)) assert.ok(C.CLIMATE_OUT.indexOf(C.CARD[id].trait) < 0);
  const n = t => d.filter(id => C.CARD[id].trait === t).length;
  assert.strictEqual(n('Carnivore'), 23);
  for (const t of ['Ambush', 'Burrowing', 'Defensive Herding', 'Cooling Frills', 'Heavy Fur', 'Hibernation', 'Migratory', 'Mud Wallowing', 'Nocturnal', 'Long Neck']) assert.strictEqual(n(t), 7, t);
  assert.strictEqual(new Set(d).size, 177);
  assert.ok(C.CLIMATE_DECK.every(c => c.id >= 1000 && (c.sun > 0) !== (c.snow > 0)), 'every kit card has suns or snowflakes');
  assert.ok(d.filter(id => id < 1000).every(id => !C.CARD[id].sun && !C.CARD[id].snow), 'base cards have no icons');
});
test('deck: exact food + icons of sample cards (research table)', () => {
  const f = t => C.CLIMATE_DECK.filter(c => c.trait === t).map(c => c.food + (c.sun ? 'S' + c.sun : 'C' + c.snow)).join(' ');
  assert.strictEqual(f('Heavy Fur'), '10C3 -5C2 8S2 6C1 -1C1 -3S1 1S1');
  assert.strictEqual(f('Cooling Frills'), '-4S3 -2C2 9S2 7C1 2C1 0S1 5S1');
  assert.strictEqual(f('Nocturnal'), '-1S3 1C2 6S2 4C1 2C1 2S1 3S1');
  assert.strictEqual(C.CLIMATE_DECK.filter(c => c.trait === 'Carnivore').reduce((a, c) => a + c.food, 0), 66);
  // summed by hand from docs/expansions-data.json: 5 traits S3 C2 S2 C1 C1 S1 S1, 4 traits C3 C2 S2 C1 C1 S1 S1, Carnivore 20 suns 19 snow
  assert.strictEqual(C.CLIMATE_DECK.reduce((a, c) => a + c.sun, 0), 71);
  assert.strictEqual(C.CLIMATE_DECK.reduce((a, c) => a + c.snow, 0), 67);
});

// ------------------------------------------------------------------ setup
test('setup: set-aside cards by players (2: half, 3: 60, 4: 30, 5-6: none); traits 3 at 2 players else 4; deal 4 + 1', () => {
  const r = {};
  for (const n of [2, 3, 4, 5, 6]) {
    const s = climate(n);
    r[n] = s.reserve.length;
    assert.strictEqual(s.maxTraits, n === 2 ? 3 : 4);
    assert.ok(s.players.every(pl => pl.hand.length === 5), 'deal 4 + 1 per species');
    assert.strictEqual(ids(s).length, 177, 'every card somewhere');
    assert.strictEqual(s.climate.zone, Z('Temperate'));
    assert.strictEqual(s.version, 'climate');
  }
  assert.deepStrictEqual(r, { 2: 88, 3: 60, 4: 30, 5: 0, 6: 0 });
});
test('setup: one cold and one hot event face up, each under its zone; no events in the no-events variant', () => {
  const s = climate(3, { events: true });
  const c = s.climate;
  assert.strictEqual(CL.EVENTS[c.up.cold].deck, 'cold');
  assert.strictEqual(CL.EVENTS[c.up.hot].deck, 'hot');
  assert.strictEqual(c.cold.length, 14); assert.strictEqual(c.hot.length, 14);
  assert.strictEqual(CL.EVENTS.length, 30);
  const k = d => CL.EVENTS.filter(e => e.deck === d).reduce((a, e) => (a[e.kind] = (a[e.kind] || 0) + 1, a), {});
  assert.deepStrictEqual(k('cold'), { 'Meteorite': 1, 'Volcanic Eruption': 3, 'Heat Wave': 5, 'Cold Snap': 4, 'Glacial Thaw': 2 });
  assert.deepStrictEqual(k('hot'), { 'Meteorite': 1, 'Volcanic Eruption': 2, 'Heat Wave': 4, 'Desertification': 2, 'Wildfire': 3, 'Cold Snap': 3 });
  assert.ok(CL.EVENTS.filter(e => e.deck === 'cold').every(e => e.zone <= Z('Cool')) && CL.EVENTS.filter(e => e.deck === 'hot').every(e => e.zone >= Z('Warm')));
  const off = climate(3);
  assert.strictEqual(off.climate.up.cold, null);
});
test('deck runs out: the set-aside cards become the deck (not the discards) and it is the last round', () => {
  const s = climate(3);
  s.discard.push(...s.deck.splice(0, s.deck.length - 2));
  const disc = s.discard.length, res = s.reserve.length;
  // the round ends: everyone plays nothing, feeding passes
  let t = reveal(s, {});
  while (!t.over && t.round === 1) { const p = E.toAct(t)[0]; t = E.apply(t, p, E.canPass(t, p) ? { t: 'pass' } : E.feedOptions(t, p)[0]); }
  assert.strictEqual(t.round, 2);
  assert.ok(t.lastRound, 'last round');
  assert.strictEqual(t.reserve.length, 0);
  assert.ok(t.discard.length >= disc, 'discards were not reshuffled');
  assert.ok(t.deck.length > res - 20 && t.deck.length < res, 'dealt from the set-aside cards');
});

// ------------------------------------------------------------------ Modify Environment
test('marker: more suns -> 1 warmer, more snowflakes -> 1 colder, a tie stays; it stops at the ends', () => {
  let s = climate(2);
  let t = reveal(s, { 0: card(s, 'Heavy Fur', { food: 8 }), 1: plain(s) }); // 2 suns
  assert.strictEqual(t.climate.zone, Z('Warm'));
  s = climate(2);
  t = reveal(s, { 0: card(s, 'Heavy Fur', { food: 10 }), 1: card(s, 'Heavy Fur', { food: 1 }) }); // 3 snow vs 1 sun
  assert.strictEqual(t.climate.zone, Z('Cool'));
  s = climate(2);
  t = reveal(s, { 0: card(s, 'Heavy Fur', { food: 8 }), 1: card(s, 'Heavy Fur', { food: -5 }) }); // 2 vs 2
  assert.strictEqual(t.climate.zone, Z('Temperate'));
  s = climate(2); s.climate.zone = Z('Scorching');
  t = reveal(s, { 0: card(s, 'Heavy Fur', { food: 8 }), 1: plain(s) });
  assert.strictEqual(t.climate.zone, Z('Scorching'));
});
test('heat loss: Hot hits body 3-6 for 2; Burrowing blocks 1, Cooling Frills 3; Heavy Fur loses 1 more; others untouched', () => {
  const s = climate(4); s.climate.zone = Z('Hot');
  const a = sp(s, 0, 3, 5), b = sp(s, 1, 2, 5), c = sp(s, 2, 4, 5, ['Burrowing']), d = sp(s, 3, 6, 5, ['Heavy Fur']);
  const t = reveal(s, { 0: plain(s), 1: plain(s), 2: plain(s), 3: plain(s) });
  const pop = x => E.findSp(t, x.id).sp.pop;
  assert.deepStrictEqual([pop(a), pop(b), pop(c), pop(d)], [3, 5, 4, 2]);
  const s2 = climate(2); s2.climate.zone = Z('Scorching');
  const f = sp(s2, 0, 2, 5, ['Cooling Frills'], true), m = sp(s2, 1, 2, 6, ['Mud Wallowing'], true);
  const t2 = reveal(s2, { 0: plain(s2), 1: plain(s2) });
  assert.strictEqual(E.findSp(t2, f.id).sp.pop, 4);
  assert.strictEqual(E.findSp(t2, m.id).sp.pop, 3);
});
test('cold loss: Ice Age 4 to all; Heavy Fur blocks 4, Defensive Herding / Hibernation / Migratory 1 each, they stack; extinction draws cards', () => {
  const s = climate(3); s.climate.zone = Z('Ice Age'); s.hole = 30; // food left after -15, so feeding goes on
  const a = sp(s, 0, 6, 6, ['Heavy Fur']), b = sp(s, 1, 2, 6, ['Defensive Herding', 'Hibernation', 'Migratory']);
  const c = sp(s, 2, 3, 3, ['Long Neck']);
  const hand = s.players[2].hand.length;
  const t = reveal(s, { 0: plain(s), 1: plain(s), 2: plain(s) });
  assert.strictEqual(E.findSp(t, a.id).sp.pop, 6);
  assert.strictEqual(E.findSp(t, b.id).sp.pop, 5);
  assert.strictEqual(E.findSp(t, c.id), null, 'population 3 - 4 = extinct');
  assert.strictEqual(t.players[2].hand.length, hand + 1, '(the food card was added to the hand by the test) 1 card drawn for its 1 trait');
});
test('cold zone: Cold hits only body 1-2; Freezing 1-4 for 2', () => {
  const s = climate(2); s.climate.zone = Z('Cold');
  const a = sp(s, 0, 2, 3, [], true), b = sp(s, 1, 3, 3, [], true);
  const t = reveal(s, { 0: plain(s), 1: plain(s) });
  assert.deepStrictEqual([E.findSp(t, a.id).sp.pop, E.findSp(t, b.id).sp.pop], [2, 3]);
});
test('plant food = food cards + the zone leaf (2-3 players / 4-6 players); negative removes, never below 0', () => {
  const s = climate(2); s.climate.zone = Z('Tropical'); s.hole = 1;
  const t = reveal(s, { 0: plain(s), 1: card(s, 'Long Neck', { food: 3 }) });
  assert.strictEqual(t.hole, 1 + 3 + 6);
  const s4 = climate(4); s4.climate.zone = Z('Tropical');
  const t4 = reveal(s4, { 0: plain(s4), 1: plain(s4), 2: plain(s4), 3: plain(s4) });
  assert.strictEqual(t4.hole, 12);
  const s3 = climate(3); s3.climate.zone = Z('Freezing'); s3.hole = 5;
  const t3 = reveal(s3, { 0: plain(s3), 1: plain(s3), 2: card(s3, 'Long Neck', { food: 4 }) });
  assert.strictEqual(t3.hole, 1, '5 + 4 - 8');
  const s5 = climate(2); s5.climate.zone = Z('Ice Age'); s5.hole = 3;
  assert.strictEqual(reveal(s5, { 0: plain(s5), 1: plain(s5) }).hole, 0);
});

// ------------------------------------------------------------------ events
function withEvent(n, kind, zone, o) {
  const s = climate(n, { events: true });
  const e = CL.EVENTS.find(x => x.kind === kind && CL.ZONES[x.zone].name === zone && (!o || Object.keys(o).every(k => JSON.stringify(x[k]) === JSON.stringify(o[k]))));
  const c = s.climate;
  // put it face up (the old face-up card goes back into its deck)
  const deck = c[e.deck];
  deck.splice(deck.indexOf(e.id), 1); deck.push(c.up[e.deck]); c.up[e.deck] = e.id;
  c.zone = e.zone;
  return { s, e };
}
test('event: Heat Wave replaces the zone effect this round (sizes, loss, leaf); it goes to the bottom of its deck and is replaced', () => {
  const { s, e } = withEvent(2, 'Heat Wave', 'Cool', { sizes: [5, 6] });
  const a = sp(s, 0, 5, 4), b = sp(s, 1, 1, 4);
  const top = s.climate.cold[s.climate.cold.length - 1];
  const t = reveal(s, { 0: plain(s), 1: plain(s) });
  assert.strictEqual(E.findSp(t, a.id).sp.pop, 3);
  assert.strictEqual(E.findSp(t, b.id).sp.pop, 4, 'Cool alone hits nobody');
  assert.strictEqual(t.hole, 8, 'the card leaf (8) instead of Cool (-2)');
  assert.strictEqual(t.climate.cold[0], e.id, 'bottom of the cold deck');
  assert.strictEqual(t.climate.up.cold, top, 'replaced from the same deck');
  assert.strictEqual(t.hist[0].cl.ev, e.id);
});
test('event: Cold Snap uses the card (cold loss) in a hot zone', () => {
  const { s } = withEvent(2, 'Cold Snap', 'Hot', { sizes: [1, 2] });
  const a = sp(s, 0, 2, 3, [], true), b = sp(s, 1, 4, 3, [], true);
  const t = reveal(s, { 0: plain(s), 1: plain(s) });
  assert.deepStrictEqual([E.findSp(t, a.id).sp.pop, E.findSp(t, b.id).sp.pop], [2, 3]);
  assert.strictEqual(t.hole, 0);
});
test('event: Meteorite - no positive plant food for the rest of the game; negative totals still remove', () => {
  const { s } = withEvent(2, 'Meteorite', 'Scorching');
  s.hole = 2;
  sp(s, 0, 1, 6, ['Heavy Fur']); sp(s, 1, 1, 6, ['Cooling Frills']); // live through Scorching
  const t = reveal(s, { 0: card(s, 'Long Neck', { food: 9 }), 1: plain(s) });
  assert.ok(t.climate.meteor);
  assert.strictEqual(t.hole, 1, '9 + Scorching -10 = -1: a negative total still removes');
});
test('event: Meteorite blocks a positive total later rounds too', () => {
  const s = climate(2); s.climate.meteor = true; s.climate.zone = Z('Warm'); s.hole = 1;
  const t = reveal(s, { 0: card(s, 'Long Neck', { food: 9 }), 1: plain(s) });
  assert.strictEqual(t.hole, 1);
  const s2 = climate(2); s2.climate.meteor = true; s2.climate.zone = Z('Cool'); s2.hole = 5;
  assert.strictEqual(reveal(s2, { 0: plain(s2), 1: plain(s2) }).hole, 3);
});
test('event: Volcanic Eruption moves the marker at the end of feeding', () => {
  const { s } = withEvent(2, 'Volcanic Eruption', 'Freezing');
  sp(s, 0, 5, 3); sp(s, 1, 5, 3); s.hole = 10; // 10 - 8 (Freezing) leaves food, so feeding happens
  let t = reveal(s, { 0: plain(s), 1: plain(s) });
  assert.strictEqual(t.phase, 'feed');
  assert.strictEqual(t.climate.zone, Z('Freezing'));
  assert.strictEqual(t.climate.volcano, Z('Ice Age'));
  while (t.round === 1 && !t.over) { const p = E.toAct(t)[0]; t = E.apply(t, p, E.canPass(t, p) ? { t: 'pass' } : E.feedOptions(t, p)[0]); }
  assert.strictEqual(t.climate.zone, Z('Ice Age'));
  assert.strictEqual(t.climate.volcano, null);
});
test('event: Glacial Thaw adds 3 suns next round, then goes to the bottom of the cold deck', () => {
  const { s, e } = withEvent(2, 'Glacial Thaw', 'Cold');
  sp(s, 0, 4, 2); sp(s, 1, 4, 2);
  let t = reveal(s, { 0: plain(s), 1: plain(s) });
  assert.strictEqual(t.climate.thaw, e.id);
  assert.ok(t.climate.cold.indexOf(e.id) < 0);
  while (t.round === 1 && !t.over) { const p = E.toAct(t)[0]; t = E.apply(t, p, E.canPass(t, p) ? { t: 'pass' } : E.feedOptions(t, p)[0]); }
  t.climate.up.cold = null; // (keep the next reveal free of other events)
  t = reveal(t, { 0: card(t, 'Heavy Fur', { food: -5 }), 1: plain(t) }); // 2 snowflakes vs 3 thaw suns
  assert.strictEqual(t.climate.zone, Z('Cool'));
  assert.strictEqual(t.climate.thaw, null);
  assert.strictEqual(t.climate.cold[0], e.id);
});
test('event: Desertification shrinks every species by 1 body (not below 1) and adds no positive food', () => {
  const { s } = withEvent(2, 'Desertification', 'Hot');
  const a = sp(s, 0, 2, 2, ['Heavy Fur'], true), b = sp(s, 1, 1, 2, [], true);
  const t = reveal(s, { 0: card(s, 'Long Neck', { food: 9 }), 1: plain(s) });
  assert.strictEqual(E.findSp(t, a.id).sp.body, 1);
  assert.strictEqual(E.findSp(t, b.id).sp.body, 1);
  assert.strictEqual(t.hole, 0);
});
test('event: Wildfire - every species without Burrowing loses 1; the round\'s food waits until the next deal', () => {
  const { s } = withEvent(2, 'Wildfire', 'Warm');
  const a = sp(s, 0, 1, 3, ['Burrowing'], true), b = sp(s, 1, 1, 3, ['Cooling Frills'], true);
  const t = reveal(s, { 0: card(s, 'Long Neck', { food: 6 }), 1: plain(s) });
  assert.strictEqual(E.findSp(t, a.id).sp.pop, 3);
  assert.strictEqual(E.findSp(t, b.id).sp.pop, 2, 'not heat: Cooling Frills does not block it');
  const h = t.hist.find(x => x.cl);
  assert.strictEqual(h.cl.held, 8, 'card 6 + Warm (+2 at 2 players) held back');
  // the hole was empty, so the round ended at once: the held food came in before the next deal
  assert.strictEqual(t.round, 2);
  assert.strictEqual(t.hole, 8);
  assert.strictEqual(t.climate.aside, 0);
});
test('event: only one event a round; a card drawn this round waits for the next', () => {
  // Heat Wave (Cool) triggers; the replacement on top of the cold deck is Volcanic Eruption (Cool -> Cold): it must wait
  const { s, e } = withEvent(2, 'Heat Wave', 'Cool', { sizes: [5, 6] });
  const v = CL.EVENTS.find(x => x.kind === 'Volcanic Eruption' && CL.ZONES[x.zone].name === 'Cool');
  const d = s.climate.cold; d.splice(d.indexOf(v.id), 1); d.push(v.id);
  sp(s, 0, 1, 2, [], true); sp(s, 1, 1, 2, [], true);
  const t = reveal(s, { 0: plain(s), 1: plain(s) });
  const h = t.hist.find(x => x.cl);
  assert.strictEqual(h.cl.ev, e.id, 'the Heat Wave triggered');
  assert.strictEqual(t.climate.up.cold, v.id, 'the Volcanic Eruption is face up now');
  assert.strictEqual(t.climate.zone, Z('Cool'), 'and it did not move the marker this round');
  // and in real games, at most one event a round
  let trig = 0;
  for (let g = 0; g < 40; g++) {
    const x = E.newGame({ seed: 100 + g, players: [{ bot: 'hard' }, { bot: 'easy' }], version: 'climate', events: true });
    for (const r of x.hist) if (r.cl && r.cl.ev != null) { trig++; assert.strictEqual(typeof r.cl.ev, 'number'); }
  }
  assert.ok(trig > 0, 'events trigger in real games');
});

// ------------------------------------------------------------------ traits
test('Hibernation: 2 unfed population are not hungry, do not starve; with Burrowing it is safe when all but 2 are fed', () => {
  const s = climate(2);
  const h = sp(s, 0, 1, 3, ['Hibernation', 'Burrowing']);
  const k = sp(s, 1, 4, 3, ['Carnivore']);
  h.food = 1;
  assert.strictEqual(E.hungry(h), false);
  assert.ok(/Burrowing/.test(E.attackBlock(s, 1, 0, 0, 0)));
  h.food = 0;
  assert.strictEqual(E.hungry(h), true);
  assert.strictEqual(E.attackBlock(s, 1, 0, 0, 0), '');
  void k;
  // starvation: population 3, food 0 -> keeps 2
  const s2 = climate(2);
  const x = sp(s2, 0, 1, 3, ['Hibernation']); sp(s2, 1, 1, 1);
  let t = reveal(s2, { 0: plain(s2), 1: plain(s2) });
  while (t.round === 1 && !t.over) { const p = E.toAct(t)[0]; t = E.apply(t, p, E.canPass(t, p) ? { t: 'pass' } : E.feedOptions(t, p)[0]); }
  assert.strictEqual(E.findSp(t, x.id).sp.pop, 2);
});
test('Migratory: after feeding, with the watering hole empty, takes 2 plant food from the bank', () => {
  const s = climate(2);
  const m = sp(s, 0, 1, 3, ['Migratory']); sp(s, 1, 1, 1);
  // food cards 0 + Temperate 0: the hole is empty, so feeding ends at once and Migratory eats from the bank
  const t = reveal(s, { 0: plain(s), 1: plain(s) });
  assert.strictEqual(t.round, 2);
  assert.strictEqual(E.findSp(t, m.id).sp.pop, 2, 'fed 2 of 3, the third starved');
  assert.strictEqual(t.players[0].bag, 2);
});
test('Mud Wallowing: the attacker discards a card before each attack; without one it can not attack', () => {
  const s = climate(2);
  sp(s, 0, 4, 2, ['Carnivore']); const prey = sp(s, 1, 1, 3, ['Mud Wallowing']);
  s.phase = 'feed'; s.turn = 0; s.playTurn = -1;
  for (const pl of s.players) pl.foodCard = -1;
  let o = E.feedOptions(s, 0).find(x => x.target === prey.id);
  assert.strictEqual(o.mud, 1);
  assert.strictEqual(o.must, false);
  const c = s.players[0].hand[0], n = s.players[0].hand.length;
  assert.throws(() => E.apply(s, 0, { t: 'attack', s: s.players[0].species[0].id, target: prey.id }), /Mud Wallowing/);
  const t = E.apply(s, 0, { t: 'attack', s: s.players[0].species[0].id, target: prey.id, ignore: [], cards: [c] });
  assert.strictEqual(t.players[0].hand.length, n - 1);
  assert.ok(t.discard.indexOf(c) >= 0);
  assert.strictEqual(E.findSp(t, prey.id).sp.pop, 2);
  s.players[0].hand = [];
  assert.ok(!E.feedOptions(s, 0).some(x => x.target === prey.id));
});
test('Cooling Frills: +2 size against attacks (not more meat)', () => {
  const s = climate(2);
  sp(s, 0, 3, 2, ['Carnivore']); sp(s, 1, 1, 3, ['Cooling Frills']);
  assert.ok(/Cooling Frills/.test(E.attackBlock(s, 0, 0, 1, 0)));
  s.players[0].species[0].body = 4;
  assert.strictEqual(E.attackBlock(s, 0, 0, 1, 0), '');
});
test('Ambush against Migratory: one defending trait is ignored for free', () => {
  const s = climate(2);
  sp(s, 0, 4, 2, ['Carnivore', 'Ambush']); sp(s, 1, 1, 3, ['Migratory', 'Climbing']);
  assert.strictEqual(E.attackBlock(s, 0, 0, 1, 0), '');
  s.players[1].species[0].traits = [card(s, 'Climbing')];
  assert.ok(/Climbing/.test(E.attackBlock(s, 0, 0, 1, 0)), 'without Migratory Climbing still blocks');
  const s2 = climate(2);
  sp(s2, 0, 4, 2, ['Carnivore']); sp(s2, 1, 1, 3, ['Migratory', 'Climbing']);
  assert.ok(/Climbing/.test(E.attackBlock(s2, 0, 0, 1, 0)), 'no Ambush: blocked');
});
test('Nocturnal: a free feeding before each of your feeding turns when no Carnivore could attack it', () => {
  const s = climate(2);
  const n = sp(s, 0, 1, 3, ['Nocturnal']); sp(s, 1, 1, 1);
  s.first = 0; s.hole = 0;
  let t = reveal(s, { 0: card(s, 'Long Neck', { food: 6 }), 1: plain(s) });
  // first feeding turn: the free feeding happened first (1), then my feeding
  assert.strictEqual(E.findSp(t, n.id).sp.food, 1);
  const s2 = climate(2);
  const n2 = sp(s2, 0, 1, 3, ['Nocturnal']); sp(s2, 1, 3, 2, ['Carnivore']);
  s2.first = 0;
  const t2 = reveal(s2, { 0: card(s2, 'Long Neck', { food: 6 }), 1: plain(s2) });
  assert.strictEqual(E.findSp(t2, n2.id).sp.food, 0, 'a Carnivore could attack it');
});

// ------------------------------------------------------------------ play: cycling, views, base untouched
test('cycling: after playing, cards go under the deck and as many are drawn; at most the deck size; not in base games', () => {
  const s = climate(2);
  const p = s.first, h = s.players[p].hand.slice();
  const t = E.apply(s, p, { t: 'play', moves: [], food: h[0], cycle: [h[1], h[2]] });
  assert.strictEqual(t.players[p].hand.length, h.length - 1);
  assert.deepStrictEqual(t.deck.slice(0, 2).sort(), [h[1], h[2]].sort(), 'at the bottom');
  assert.strictEqual(ids(t).length, 177);
  assert.throws(() => E.apply(s, p, { t: 'play', moves: [], food: h[0], cycle: [h[0]] }));
  const s2 = climate(2); s2.deck.splice(0, s2.deck.length - 1);
  assert.throws(() => E.apply(s2, s2.first, { t: 'play', moves: [], food: s2.players[s2.first].hand[0], cycle: s2.players[s2.first].hand.slice(1, 3) }), /deck holds only 1/);
  const b = E.newGame({ seed: 3, players: people(2) });
  assert.throws(() => E.apply(b, b.first, { t: 'play', moves: [], food: b.players[b.first].hand[0], cycle: [b.players[b.first].hand[1]] }));
});
test('view: version + public climate board; no event deck order, no seed; base view has none', () => {
  const s = climate(3, { events: true });
  const v = E.view(s, 0);
  assert.strictEqual(v.version, 'climate');
  assert.strictEqual(v.climate.zone, Z('Temperate'));
  assert.ok(v.climate.up.cold != null && v.climate.up.hot != null);
  assert.ok(!('cold' in v.climate) && !('hot' in v.climate));
  assert.strictEqual(JSON.stringify(v).indexOf('"seed"'), -1);
  assert.strictEqual(E.view(E.newGame({ seed: 3, players: people(3) }), 0).climate, undefined);
});
test('a base game is unchanged: no climate, 129 cards, 3 + 1 dealt', () => {
  const s = E.newGame({ seed: 3, players: people(3) });
  assert.strictEqual(s.climate, undefined);
  assert.strictEqual(s.version, undefined);
  assert.ok(s.players.every(pl => pl.hand.length === 4));
  assert.strictEqual(s.maxTraits, 3);
});

test('odds: the watering-hole forecast adds the zone’s food and uses the Climate deck; a Meteorite stops positive totals', () => {
  const O = require('../js/odds.js');
  const s = climate(4); s.climate.zone = Z('Tropical'); s.hole = 50; // (far from 0, so nothing is cut off at 0)
  const v = E.view(s, 0);
  assert.strictEqual(v.climate.leaf, 12);
  const f = O.holeForecast(v, 0);
  assert.strictEqual(O.unseenFoods(v).length, 177 - 5, 'the whole Climate deck minus my 5 cards');
  const b = O.holeForecast(Object.assign({}, v, { climate: undefined }), 0);
  assert.ok(Math.abs(f.mean - b.mean - 12) < 1e-9, 'shifted by +12');
  s.climate.meteor = true;
  const m = O.holeForecast(E.view(s, 0), 0);
  assert.strictEqual(m.hi, 50, 'nothing is added after a Meteorite (the zone and cards are positive here)');
});

// ------------------------------------------------------------------ computers + online
test('computers: 150 seeded Climate games (2-6 players, events on and off, all levels) end, every move legal, cards conserved', () => {
  const lv = ['easy', 'medium', 'hard'];
  let rounds = 0;
  for (let g = 0; g < 150; g++) {
    const n = 2 + (g % 5);
    const s = E.newGame({ seed: 7000 + g, version: 'climate', events: g % 4 !== 3, quick: g % 3 === 0, players: Array.from({ length: n }, (_, i) => ({ name: 'C' + i, bot: lv[(g + i) % 3] })) });
    assert.ok(s.over, 'game ' + g + ' ended');
    assert.strictEqual(ids(s).length, 177, 'cards in game ' + g);
    rounds += s.round;
  }
  assert.ok(rounds / 150 > 4 && rounds / 150 < 12, 'rounds ' + rounds / 150);
});
test('online adapter: a Climate room plays to the end through JSON copies; public view hides decks', () => {
  const clone = x => JSON.parse(JSON.stringify(x));
  let rng = 0.37; const r = () => (rng = (rng * 9301 + 49297) % 233280 / 233280);
  let s = game.setup(3, { version: 'climate' }, r, people(3).map(p => ({ kind: 'human', name: p.name })));
  assert.strictEqual(s.version, 'climate');
  assert.ok(s.climate.events);
  let moves = 0;
  while (!game.isOver(s)) {
    const seat = game.toAct(s)[0];
    const pub = game.publicView(s);
    assert.ok(pub.climate && !pub.climate.cold && !pub.reserve);
    s = game.apply(clone(s), seat, clone(game.bot({ state: s, pub, mine: game.privateView(s, seat) }, seat)));
    assert.ok(++moves < 50000);
  }
  const base = game.setup(2, {}, r, people(2).map(p => ({ kind: 'human', name: p.name })));
  assert.strictEqual(base.climate, undefined);
});
test('bots: Hard plays the food card that moves the climate away from what hurts it', () => {
  const s = climate(2); s.climate.zone = Z('Warm');
  sp(s, 0, 6, 4); // big species: Tropical (5-6) would cost it
  const p = 0;
  assert.ok(B.warmthCost(s, p) > 0);
  s.players[p].hand = [card(s, 'Heavy Fur', { food: 8 }), card(s, 'Heavy Fur', { food: 6 })]; // sun 2 vs snow 1, similar food
  s.phase = 'play'; s.playTurn = p; s.first = p;
  const a = B.decide(s, p, 'hard');
  assert.strictEqual(C.CARD[a.food].snow, 1);
});

console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
