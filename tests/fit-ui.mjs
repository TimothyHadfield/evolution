// Fit pass (2026-11-27): late game, 6 players, everyone with 4-5 species carrying 3 traits, a big hand.
// Checks, in Safari's engine (WebKit), that everything needed to decide is on screen and readable:
// my species' trait names, Body/Pop numbers and food, my hand's cards, the watering hole's food count,
// the opponents' body/pop cubes and hand/bag counts. No page scroll, no sideways scroll, no errors.
// Tim: "make sure the user can actually see the full screen and everything".
// Run: node tests/fit-ui.mjs   (SHOTS=<folder> also saves a screenshot per case; EVO_URL=<url> checks another copy)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = require(ROOT + '/js/engine.js');
const B = require(ROOT + '/js/bots.js');
const C = require(ROOT + '/js/cards.js');

const pwPath = process.env.EVO_PW || path.join(os.homedir(), '.claude/tools/node_modules/playwright/index.mjs');
if (!fs.existsSync(pwPath)) { console.log('fit-ui: SKIPPED (Playwright not found at ' + pwPath + ')'); process.exit(0); }
const pw = (await import(pathToFileURL(pwPath).href)).default;
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// a real game played by Hard computers to round 3, then packed: every player gets `per[p]` species with
// 3 traits each (the longest trait names first), body/pop 3-6, some food eaten; my hand gets `hand` cards
function crowded(n, per, hand, phase) {
  // (seat 0 is a person, moved here by the Hard computer's choice, so the engine stops at each of my turns)
  const players = Array.from({ length: n }, (_, i) => ({ name: i ? ['Computer 1', 'Computer 2', 'Computer 3', 'Computer 4', 'Computer 5'][i - 1] : 'You', bot: i ? 'hard' : null }));
  let s = E.newGame({ seed: 21, players, quick: false, stepBots: true });
  const step = () => { const ta = E.toAct(s); if (ta[0] == null) return false; s = E.apply(s, ta[0], B.decide(s, ta[0], 'hard')); return true; };
  for (let g = 0; !s.over && g < 5000; g++) { if (s.round >= 3 && s.phase === phase && E.toAct(s).indexOf(0) >= 0) break; if (!step()) break; }
  if (s.over || s.phase !== phase || E.toAct(s).indexOf(0) < 0) throw new Error('fixture: never reached my ' + phase + ' turn in round 3+');
  // trait cards come from the deck, then the discard pile (round 3 leaves ~50 in the deck, the table needs ~90)
  s.deck = s.deck.concat(s.discard || []); s.discard = [];
  const card = name => { const k = s.deck.findIndex(id => C.CARD[id] && C.CARD[id].trait === name); return k < 0 ? null : s.deck.splice(k, 1)[0]; };
  const long = ['Defensive Herding', 'Warning Call', 'Intelligence', 'Cooperation', 'Pack Hunting', 'Hard Shell', 'Fat Tissue', 'Long Neck', 'Scavenger', 'Symbiosis', 'Burrowing', 'Climbing', 'Foraging', 'Fertile', 'Ambush', 'Horns', 'Carnivore'];
  let t = 0;
  s.players.forEach((pl, p) => {
    while (pl.species.length < per[p]) pl.species.push({ id: s.nextId++, body: 1, pop: 1, food: 0, fat: 0, traits: [], hidden: [], born: 1 });
    pl.species.length = per[p];
    pl.species.forEach((sp, i) => {
      // put the old traits back in the deck, then 3 new ones (never two alike on one species)
      sp.traits.concat(sp.hidden).forEach(id => s.deck.push(id)); sp.traits = []; sp.hidden = [];
      for (let g = 0; sp.traits.length < 3 && g < 200; g++) { const c = card(long[t++ % long.length]); if (c != null && sp.traits.every(x => C.CARD[x].trait !== C.CARD[c].trait)) sp.traits.push(c); else if (c != null) s.deck.push(c); }
      if (sp.traits.length < 3) throw new Error('fixture: ran out of trait cards');
      sp.body = 3 + ((i + p) % 4); sp.pop = 3 + ((i * 2 + p) % 4); sp.food = phase === 'feed' ? Math.min(sp.pop, (i + p) % 3) : 0; sp.fat = 0;
    });
  });
  const me = s.players[0];
  while (me.hand.length < hand && s.deck.length) me.hand.push(s.deck.pop());
  me.hand.length = Math.min(me.hand.length, hand);
  s.hole = 14;
  return JSON.stringify({ v: 1, settings: { opps: n - 1, level: 'hard', odds: true, hints: true, threat: true, quick: false, speed: 'fast', name: '' }, game: { state: s, notes: [], level: 'hard' }, last: null, online: false });
}

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
let server, BASE = process.env.EVO_URL;
if (!BASE) {
  server = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
  });
  await new Promise(res => server.listen(+process.env.PORT || 0, '127.0.0.1', res));
  BASE = 'http://127.0.0.1:' + server.address().port + '/';
}

const browser = await pw[process.env.EVO_ENGINE || 'webkit'].launch({ headless: true });
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); } }
async function open(w, h, store) {
  const phone = w < 900;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(v => { try { if (!sessionStorage.getItem('s')) { localStorage.setItem('evolution:v1', v); localStorage.setItem('coach:evolution', '{"offered":1,"done":1}'); sessionStorage.setItem('s', '1'); } } catch (e) {} Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); }, store);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // a first-visit offer (guided game) is not part of the table
  await page.evaluate(() => document.querySelectorAll('.coach-offer, .coach-back').forEach(e => e.remove()));
  return { ctx, page, errs };
}

// on-screen sizes (CSS zoom included) of everything a player reads to decide
const measure = page => page.evaluate(() => {
  const zoomOf = el => { let z = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) z *= parseFloat(getComputedStyle(e).zoom) || 1; return z; };
  const fs = el => parseFloat(getComputedStyle(el).fontSize) * zoomOf(el);
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const min = (sel, f) => { const a = [...document.querySelectorAll(sel)].filter(vis).map(f); return a.length ? +Math.min(...a).toFixed(1) : null; };
  const H = innerHeight, W = innerWidth;
  const off = sel => [...document.querySelectorAll(sel)].filter(vis).filter(el => { const r = el.getBoundingClientRect(); return r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1; }).length;
  // my trait names: cut (ellipsis / clipped) so they can't be read
  const cutTr = [...document.querySelectorAll('#mine .tr:not(.empty):not(.hid) span')].filter(vis).filter(s => s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 2 || s.getBoundingClientRect().bottom > s.closest('.tr').getBoundingClientRect().bottom + 1).map(s => s.textContent);
  // hand: the strip of each card left visible by the card lying on it (the fan stacks each card on the one to its right)
  const hc = [...document.querySelectorAll('#hand .tc')].filter(vis).map(c => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
  let strip = hc.length ? 1e9 : null; for (let i = 1; i < hc.length; i++) strip = Math.min(strip, hc[i].left - hc[i - 1].left);
  if (hc.length === 1) strip = hc[0].width;
  const de = document.documentElement, o = document.querySelector('.opps');
  return {
    myTrait: min('#mine .tr:not(.empty):not(.hid) span', fs), myCube: min('#mine .trk .cube', fs), myTrackNum: min('#mine .trk i', fs), myTrackLbl: min('#mine .trk .tl', fs),
    myFood: min('#mine .fr .ftk, #mine .fr .slot', el => el.getBoundingClientRect().height), mySp: document.querySelectorAll('#mine .sp').length,
    cutTr, handName: min('#hand .tc .tn', fs), handFood: min('#hand .tc .fd', fs), handStrip: strip == null ? null : Math.round(strip), handN: hc.length,
    holeN: min('.hole .hn', fs), oppCube: min('.msp .cube', fs), oppIcon: min('.msp .ics .ic', el => el.getBoundingClientRect().height),
    oppHand: min('.ohand b', fs), oppBag: min('.opp .bag b', fs), oppName: min('.opp .nmx', fs),
    nameCut: [...document.querySelectorAll('.opp .nmx')].filter(vis).filter(n => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 2).map(n => n.textContent),
    offscreen: off('#mine .sp, #hand .tc, .hole .wh, .opp, .acts .btn'),
    zoom: ['.opps', '.mine', '.hand'].map(s => { const e = document.querySelector(s); return e && +e.style.zoom; }),
    pageScroll: de.scrollHeight > innerHeight + 1, overflowX: de.scrollWidth > innerWidth + 1, oppsScroll: o ? o.scrollHeight - o.clientHeight : 0,
  };
});

// late game, 6 players: me with 5 species, opponents with 4-5, all with 3 traits; 9 cards in my hand
const LATE6 = crowded(6, [5, 5, 4, 5, 4, 5], 9, 'feed');
const LATE6P = crowded(6, [5, 5, 4, 5, 4, 5], 9, 'play');
// my row grows: 6 species of mine at 3 players
const WIDE3 = crowded(3, [6, 4, 4], 7, 'feed');
const SIZES = [[393, 659], [320, 568], [659, 393], [1280, 800], [1440, 900]];
const want = {
  myTrait: 10, myCube: 12, myTrackNum: 9, myFood: 9, handName: 10, handFood: 12, holeN: 12, oppCube: 12, oppIcon: 12, oppHand: 12, oppBag: 12,
};
// before the fit pass (393x659, 6 players): hand names 6.8, food 7.8, opponents' cubes 9, my 5th board off screen,
// opponents' area scrolled 20 px (219 px at 320x568)
// round 1 (2026-11-28): hand names 7.8, food 9.7, opponents' cubes 9.6 with ~100 px of empty wood beside them;
// round 2 uses that slack: phone portrait now wants the full 10 px names and 12 px numbers
const PHONE = { oppIcon: 11 };
const SMALL = { myTrait: 8, myCube: 9.5, myTrackNum: 7, myFood: 8.5, handName: 7.5, handFood: 9.5, oppCube: 6.5, oppIcon: 6.5, oppHand: 8.5, oppBag: 8.5 };
for (const [label, st] of [['late game, 6 players, feeding', LATE6], ['late game, 6 players, playing cards', LATE6P], ['6 species of mine, 3 players', WIDE3]]) {
  for (const [w, h] of SIZES) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(w + 'x' + h)) continue;
    await test(label + ' at ' + w + 'x' + h + ': everything readable and on screen', async () => {
      const { ctx, page, errs } = await open(w, h, st);
      const m = await measure(page);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, label.replace(/[^a-z0-9]+/gi, '-') + '-' + w + 'x' + h + '.png') });
      await ctx.close();
      const bad = [];
      // a phone can't hold this packed a table at full size: my own boards stay at full size, the held hand
      // and the opponents' minis are allowed a little under (a tap opens any card or species big)
      // (an iPhone SE or a phone held sideways is smaller still: every board of mine stays in view, a size down)
      const small = w < 900 && (w < 360 || h < 600);
      const W = w < 900 ? Object.assign({}, want, PHONE, small ? SMALL : {}) : want;
      for (const k in W) if (m[k] != null && m[k] < W[k] - 0.05) bad.push(k + ' ' + m[k] + ' px (want >= ' + W[k] + ')');
      // opponents' names ("Computer 1".."Computer 5") must stay whole, or the number that tells them apart is lost
      if (m.nameCut.length) bad.push('names cut: ' + m.nameCut.join(', '));
      if (m.cutTr.length) bad.push('trait names cut: ' + m.cutTr.join(', '));
      if (m.handStrip != null && m.handN > 1 && m.handStrip < 16) bad.push('hand strip ' + m.handStrip + ' px');
      if (m.offscreen) bad.push(m.offscreen + ' pieces off screen');
      if (m.pageScroll || m.overflowX || m.oppsScroll > 2) bad.push('scrolls: page ' + m.pageScroll + ', sideways ' + m.overflowX + ', opponents ' + m.oppsScroll);
      if (errs.length) bad.push('errors: ' + errs.join(' | '));
      if (process.env.VERBOSE) console.log('   ' + JSON.stringify(m));
      if (bad.length) throw new Error(bad.join('; '));
    });
  }
}

await browser.close();
if (server) server.close();
console.log('fit-ui: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
