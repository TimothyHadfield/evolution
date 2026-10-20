// The Evolution engine behind the shared online module's game interface (_online/README.md).
// Run: node tests/online.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createLocal } from '../js/online.js';
const require = createRequire(import.meta.url);
const { game, viewFromSnap } = require('../js/online-game.js');
const E = require('../js/engine.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + (i + 1) }));
const clone = x => JSON.parse(JSON.stringify(x));

// 1. All seats human, every move made by game.bot through JSON copies (the online path).
{
  let games = 0, moves = 0;
  for (let g = 0; g < 20; g++) {
    const n = 2 + (g % 5);
    let s = game.setup(n, { quick: g % 2 === 1 }, mulberry(g + 11), humans(n));
    assert.equal(s.quick, n === 6 || g % 2 === 1, 'Quick Play option respected');
    while (!game.isOver(s)) {
      const seat = game.toAct(s)[0];
      assert.ok(seat != null, 'someone must act');
      s = game.apply(clone(s), seat, clone(game.bot({ state: s, pub: game.publicView(s), mine: game.privateView(s, seat) }, seat)));
      assert.ok(++moves < 200000, 'runaway');
    }
    assert.deepEqual(game.toAct(s), []);
    const pub = game.publicView(s);
    assert.ok(pub.over && pub.result && pub.result.winners.length >= 1);
    games++;
  }
  ok(games + ' online-path games (2-6 seats, both play variants) end cleanly; ' + moves + ' moves');
}

// 2. Illegal moves throw.
{
  const s = game.setup(3, {}, mulberry(3), humans(3));
  assert.equal(s.phase, 'food');
  const seat = 0;
  assert.throws(() => game.apply(clone(s), seat, { t: 'food', card: 999 }));
  assert.throws(() => game.apply(clone(s), seat, { t: 'eat', s: 1 }));
  assert.throws(() => game.apply(clone(s), seat, {}), /Bad move/);
  assert.throws(() => game.apply(clone(s), seat, null), /Bad move/);
  let t = s;
  for (let p = 0; p < 3; p++) t = game.apply(clone(t), p, { t: 'food', card: t.players[p].hand[0] });
  const notFirst = (t.first + 1) % 3;
  assert.throws(() => game.apply(clone(t), notFirst, { t: 'play', moves: [] }), /Not your turn/);
  assert.throws(() => game.apply(clone(t), t.first, { t: 'play', moves: [{ t: 'trait', card: t.players[notFirst].hand[0], s: t.players[t.first].species[0].id }] }));
  ok('moves out of turn, cards not in hand and malformed moves throw');
}

// 3. Secrecy.
{
  for (let g = 0; g < 8; g++) {
    const rng = mulberry(100 + g);
    let s = game.setup(3, {}, rng, humans(3));
    for (let step = 0; step < 15 * (g + 1) && !game.isOver(s); step++) {
      const seat = game.toAct(s)[0];
      s = game.apply(clone(s), seat, game.bot({ state: s }, seat));
    }
    const pub = game.publicView(s);
    const pubJ = JSON.stringify(pub);
    assert.ok(!/"seed"|"deck"|"hand"|"discard"|"me"/.test(pubJ), 'public view leaks nothing hidden');
    pub.players.forEach((pl, p) => {
      if (!s.over) assert.equal(pl.bag, null, 'food behind the screen is hidden');
      pl.species.forEach(sp => assert.ok(sp.hidden.every(x => x === -1), 'face-down traits hidden'));
    });
    if (s.phase === 'food' || s.phase === 'play') assert.deepEqual(pub.hist[pub.hist.length - 1].foodCards, [], 'face-down food cards hidden');
    for (let j = 0; j < 3; j++) {
      const pv = game.privateView(s, j);
      assert.deepEqual(Object.keys(pv).sort(), ['hidden', 'me']);
      assert.deepEqual(pv.me.hand, s.players[j].hand, 'own hand only');
    }
  }
  ok('public view: no seed, deck, hands, bags, face-down traits or food cards; private view: own only');
}

// 4. The screens' view equals the local engine view, seat for seat.
{
  let s = game.setup(3, {}, mulberry(5), humans(3));
  for (let i = 0; i < 9; i++) { const seat = game.toAct(s)[0]; s = game.apply(clone(s), seat, game.bot({ state: s }, seat)); }
  for (const seat of [0, 1, 2]) {
    const v = clone(viewFromSnap({ pub: game.publicView(s), mine: game.privateView(s, seat), mySeat: seat }));
    const w = clone(E.view(s, seat));
    // the public view cannot know whose turn may pass; the screen works that out itself
    delete v.canPass; delete w.canPass;
    assert.deepEqual(v, w);
  }
  ok('snapshot view equals the local engine view seat for seat');
}

// 5. Computers chosen before the start never wait on the network.
{
  let s = game.setup(4, { level: 'medium' }, mulberry(9), [{ kind: 'human', name: 'A' }, { kind: 'computer' }, { kind: 'human', name: 'B' }, { kind: 'computer' }]);
  assert.equal(s.players[1].bot, 'medium');
  while (!game.isOver(s)) {
    const seat = game.toAct(s)[0];
    assert.ok(seat === 0 || seat === 2, 'computer seat asked to move: ' + seat);
    s = game.apply(clone(s), seat, game.bot({ state: s }, seat));
  }
  ok('pre-chosen computers play inside the engine; level option respected');
}

// 6. createLocal plays a human + computer game to finished.
{
  const room = createLocal({ game, seats: ['human', 'computer', 'computer'], options: {}, botDelayMs: 0, rng: mulberry(21) });
  let last = null;
  room.on('change', snap => { last = snap; });
  room.on('error', e => { throw e; });
  room.start();
  let guard = 0;
  while (last.status !== 'finished') {
    const r = room.act(game.bot({ state: room.state }, last.mySeat));
    assert.ok(r.ok, r.message);
    assert.ok(++guard < 5000);
  }
  assert.ok(last.pub.over);
  ok('createLocal room plays to finished (' + guard + ' human moves)');
}

// 7. Junk options give a normal game.
{
  const s = game.setup(3, { level: 'godlike', quick: 'yes' }, mulberry(1), humans(3));
  assert.equal(s.quick, false);
  const t = game.setup(3, { level: 'godlike' }, mulberry(1), [{ kind: 'computer' }, { kind: 'human' }, { kind: 'human' }]);
  assert.equal(t.players[0].bot, 'hard');
  ok('junk options fall back to defaults');
}

console.log(pass + ' passed');
