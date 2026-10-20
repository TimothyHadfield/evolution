// Sound + animation tests: the event -> sound map over real engine views, the Sound / Animations
// switches (real fx.js with a fake AudioContext and fake elements), and the end-of-game celebration.
// Run: node tests/fx.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const X = require('../js/game-fx.js');

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
  pending.push(Promise.resolve().then(fn).then(() => { passed++; }, e => { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.stack || e)); }));
}

// ---------- a spy FX and a no-wait scheduler
function spyFX() {
  const calls = { play: [], anim: [], celebrate: [] };
  const anim = k => (el, ...a) => { calls.anim.push([k, el, a]); return Promise.resolve(); };
  return {
    calls,
    settings: { animations: true, animSpeed: 'normal' },
    play(name, o) { calls.play.push([name, o || {}]); return true; },
    define() { return true; },
    celebrate(o) { calls.celebrate.push(o); return Promise.resolve(); },
    pop: anim('pop'), shake: anim('shake'), pulse: anim('pulse'), flash: anim('flash'), flyTo: anim('flyTo'),
    floatText: anim('floatText'), countUp: anim('countUp'),
  };
}
const fakeEl = name => ({ name, getBoundingClientRect: () => ({ left: 10, top: 10, width: 60, height: 80 }), animate() { return {}; } });
const now = { wait: (ms, fn) => fn(), el: sel => fakeEl(sel), all: sel => [fakeEl(sel)] };

// ---------- play a real game, one engine step at a time, diffing views like the screen does
function playGame(seed, n, level) {
  const players = [{ name: 'You', bot: null }];
  for (let i = 1; i < n; i++) players.push({ name: 'Computer ' + i, bot: level });
  let s = E.newGame({ seed, players, stepBots: true });
  const fx = spyFX();
  let prev = E.view(s, 0);
  X.perform(X.diff(null, prev, 0, { fresh: true }), fx, now);
  let steps = 0;
  while (!s.over && steps++ < 3000) {
    const p = E.toAct(s)[0];
    s = E.apply(s, p, B.decide(s, p, p === 0 ? 'hard' : s.players[p].bot));
    const v = E.view(s, 0);
    X.perform(X.diff(prev, v, 0), fx, now);
    prev = v;
  }
  return { s, fx, names: new Set(fx.calls.play.map(c => c[0])) };
}

test('scripted games: the right sound names fire for what happens', () => {
  const all = new Set();
  let attacks = 0, extinct = 0, starve = 0;
  for (const seed of [11, 12, 13, 14]) {
    const g = playGame(seed, 3, 'hard');
    g.names.forEach(n => all.add(n));
    attacks += g.s.hist.reduce((a, h) => a + h.attacks, 0);
    extinct += g.s.hist.reduce((a, h) => a + h.extinct, 0);
    starve += g.s.log.filter(l => /starves/.test(l.t)).length;
  }
  for (const n of ['shuffle', 'cardDeal', 'cardSlide', 'tuck', 'place', 'cardFlip', 'crunch', 'turn']) assert.ok(all.has(n), 'missing sound ' + n + ' (got ' + [...all].join(',') + ')');
  assert.ok(attacks > 0, 'games had attacks');
  assert.ok(all.has('snap') && all.has('hit'), 'attack sounds');
  if (extinct) assert.ok(all.has('extinct'), 'extinction sound');
  if (starve) assert.ok(all.has('miss'), 'starving sound');
  for (const n of all) assert.ok(X.KNOWN.indexOf(n) >= 0, 'unknown sound ' + n);
});

test('fresh game: shuffle, then one deal per card in my hand, flying from the deck', () => {
  const s = E.newGame({ seed: 3, players: [{ name: 'You' }, { name: 'C', bot: 'easy' }], stepBots: true });
  const v = E.view(s, 0);
  const ev = X.diff(null, v, 0, { fresh: true });
  assert.strictEqual(ev[0].snd, 'shuffle');
  assert.strictEqual(ev.filter(e => e.snd === 'cardDeal').length, v.me.hand.length);
  assert.ok(ev.filter(e => e.snd === 'cardDeal').every(e => e.anim === 'deal'));
  assert.strictEqual(X.diff(null, v, 0).length, 0, 'no sounds on a plain reload');
});

// a hand-built feeding table (same helper shape as engine.test.js)
const used = new Set();
function card(t) { const c = C.DECK.find(x => x.trait === t && !used.has(x.id)); used.add(c.id); return c.id; }
function sp(body, pop, traits, extra) { return Object.assign({ id: 0, body, pop, food: 0, fat: 0, traits: (traits || []).map(card), hidden: [], born: 1 }, extra || {}); }
function table(rows, o) {
  o = o || {};
  used.clear();
  const s = E.newGame({ seed: 7, players: rows.map((_, i) => ({ name: i ? 'P' + i : 'You' })), stepBots: true });
  let id = 100;
  s.players.forEach((pl, p) => { pl.species = rows[p].map(f => { const x = f(); x.id = id++; return x; }); pl.hand = []; pl.bag = 0; });
  s.phase = 'feed'; s.turn = o.turn || 0; s.passes = 0; s.hole = o.hole == null ? 10 : o.hole; s.first = 0;
  return s;
}

test('attack: snap, hit and a shake on the prey; extinct when it dies', () => {
  const s = table([[() => sp(4, 2, ['Carnivore'])], [() => sp(1, 1), () => sp(2, 3)]]);
  const before = E.view(s, 0);
  const after = E.view(E.apply(s, 0, { t: 'attack', s: 100, target: 101 }), 0);
  const ev = X.diff(before, after, 0);
  const names = ev.map(e => e.snd);
  assert.deepStrictEqual(names.slice(0, 2), ['snap', 'hit']);
  assert.ok(names.indexOf('extinct') > 1, 'prey with pop 1 goes extinct: ' + names);
  assert.ok(names.indexOf('crunch') > 0, 'the carnivore eats');
  assert.ok(ev.some(e => e.anim === 'shake'), 'something shakes');
  assert.ok(ev.some(e => e.anim === 'flash' && /data-p="1"/.test(e.el)), 'extinct flashes the owner row');
});

test('Cooperation chain: one crunch, then a rising pop per extra species fed', () => {
  const s = table([[() => sp(1, 2, ['Cooperation']), () => sp(1, 2, ['Cooperation']), () => sp(1, 2)], [() => sp(1, 1)]]);
  const before = E.view(s, 0);
  const after = E.view(E.apply(s, 0, { t: 'eat', s: 100 }), 0);
  const ev = X.diff(before, after, 0);
  const feed = ev.filter(e => e.snd === 'crunch' || e.snd === 'pop');
  assert.deepStrictEqual(feed.map(e => e.snd), ['crunch', 'pop', 'pop']);
  assert.ok(feed[2].pitch > feed[1].pitch, 'chain rises in pitch');
  assert.deepStrictEqual(feed.map(e => e.el), ['[data-sp="100"]', '[data-sp="101"]', '[data-sp="102"]']);
});

test('your-turn chime only when it becomes my turn', () => {
  const s = table([[() => sp(1, 2)], [() => sp(1, 2)]], { turn: 1 });
  const v1 = E.view(s, 0);
  const s2 = E.apply(s, 1, { t: 'eat', s: 101 });
  const v2 = E.view(s2, 0);
  assert.ok(X.diff(v1, v2, 0).some(e => e.snd === 'turn'), 'turn chime when it becomes mine');
  const v3 = E.view(E.apply(s2, 0, { t: 'eat', s: 100 }), 0);
  assert.ok(!X.diff(v2, v3, 0).some(e => e.snd === 'turn'), 'no chime when it stops being mine');
  assert.ok(!X.diff(v2, v2, 0).length, 'no events without a change');
});

test('computer sounds are never louder than mine', () => {
  const g = playGame(21, 3, 'hard');
  for (const [, o] of g.fx.calls.play) assert.ok(o.vol == null || o.vol <= 1, 'vol ' + o.vol);
});

test('game over celebrates with the right kind', () => {
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const g = playGame(seed, 2, 'easy');
    const end = g.fx.calls.celebrate.filter(c => c.kind !== 'big'); // 'big' = a mid-game high
    assert.strictEqual(end.length, 1, 'one end celebration');
    const won = g.s.result.winners.indexOf(0) >= 0;
    assert.strictEqual(end[0].kind, won ? 'win' : 'lose', 'seed ' + seed);
    assert.ok(g.fx.calls.anim.some(a => a[0] === 'countUp'), 'points count up');
  }
});

// ---------- the real fx.js: switches gate sound and animation
function loadRealFX() {
  const made = { nodes: 0, animate: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => { made.nodes++; return { connect() {}, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), pan: param(), type: '' }; };
  class AC { constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
    createGain() { return node(); } createOscillator() { return node(); } createBiquadFilter() { return node(); } createBufferSource() { return node(); }
    createDynamicsCompressor() { return node(); } createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; } resume() { return Promise.resolve(); } }
  const el = () => ({ style: {}, classList: { toggle() {} }, appendChild() {}, remove() {}, cloneNode() { return el(); }, removeAttribute() {}, setAttribute() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 50 }), animate() { made.animate++; const a = {}; setTimeout(() => a.onfinish && a.onfinish(), 0); return a; } });
  globalThis.AudioContext = AC;
  globalThis.document = { body: el(), head: el(), createElement: el, addEventListener() {}, getElementById: () => null };
  globalThis.getComputedStyle = () => ({ borderRadius: '0' });
  globalThis.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
  delete require.cache[require.resolve('../js/fx.js')];
  delete globalThis.FX;
  require('../js/fx.js');
  const FX = globalThis.FX;
  FX.init({ game: 'evolution-test', clicks: false });
  FX.unlock();
  return { FX, made, el };
}

test('real fx.js: Sound off = no sound, Animations off = no animation', async () => {
  const { FX, made, el } = loadRealFX();
  X.define(FX);
  const g = playGame(12, 3, 'hard');
  const events = [];
  // rebuild the same event list for the real library
  {
    let s = E.newGame({ seed: 12, players: [{ name: 'You' }, { name: 'A', bot: 'hard' }, { name: 'B', bot: 'hard' }], stepBots: true });
    let prev = E.view(s, 0);
    events.push(...X.diff(null, prev, 0, { fresh: true }));
    for (let i = 0; i < 60 && !s.over; i++) { const p = E.toAct(s)[0]; s = E.apply(s, p, B.decide(s, p, 'hard')); const v = E.view(s, 0); events.push(...X.diff(prev, v, 0)); prev = v; }
  }
  assert.ok(events.length > 10 && g.names.size > 5);
  const env = { wait: (ms, fn) => fn(), el: () => el(), all: () => [el()] };
  FX.set('sound', true); FX.set('animations', true);
  let p0 = FX.stats.plays, a0 = made.animate;
  await X.perform(events, FX, env);
  assert.ok(FX.stats.plays > p0, 'sound on: sounds play');
  assert.ok(made.animate > a0, 'animations on: elements animate');
  FX.set('sound', false);
  p0 = FX.stats.plays;
  await X.perform(events, FX, env);
  assert.strictEqual(FX.stats.plays, p0, 'sound off: nothing plays');
  FX.set('sound', true); FX.set('moves', false);
  p0 = FX.stats.plays;
  await X.perform(events.filter(e => e.snd !== 'turn' && !e.celebrate), FX, env); // alerts + celebrations have their own switches
  assert.strictEqual(FX.stats.plays, p0, 'game sounds off: no game sound plays');
  FX.set('moves', true); FX.set('animations', false);
  a0 = made.animate;
  await X.perform(events, FX, env);
  await X.perform([{ anim: 'deal', el: 'x', from: 'y' }], FX, env);
  assert.strictEqual(made.animate, a0, 'animations off: nothing animates');
  FX.set('celebrations', false);
  p0 = FX.stats.plays;
  await X.perform([{ celebrate: 'win' }], FX, env);
  assert.strictEqual(FX.stats.plays, p0, 'celebrations off: no fanfare');
  for (const n of X.CUSTOM) assert.ok(FX.sounds.indexOf(n) >= 0, 'defined ' + n);
});

Promise.all(pending).then(() => {
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
});
