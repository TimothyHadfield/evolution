// Table visibility checks in Safari's engine (WebKit, Playwright): the table fills the empty wood,
// opponents' pieces are big enough to read, nothing moves when you tap, no page scroll.
// Run: node tests/layout.test.mjs   (needs Playwright: ~/.claude/tools/node_modules, or EVO_PW=<path to playwright index.mjs>)
// EVO_URL=<url> checks another copy of the site (e.g. the live one) instead of this folder.
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

const pwPath = process.env.EVO_PW || path.join(os.homedir(), '.claude/tools/node_modules/playwright/index.mjs');
if (!fs.existsSync(pwPath)) { console.log('layout: SKIPPED (Playwright not found at ' + pwPath + ')'); process.exit(0); }
const pw = (await import(pathToFileURL(pwPath).href)).default;

// a real game: every seat a Hard computer until pred holds on a turn of seat 0, then seat 0 is "You"
function game(n, seed, pred, phase) {
  const players = Array.from({ length: n }, (_, i) => ({ name: i ? 'Computer ' + i : 'You', bot: 'hard' }));
  let s = E.newGame({ seed, players, quick: false, stepBots: true });
  const step = () => { const ta = E.toAct(s); if (ta[0] == null) return false; s = E.apply(s, ta[0], B.decide(s, ta[0], 'hard')); return true; };
  for (let g = 0; !s.over && g < 5000; g++) { if (E.toAct(s).indexOf(0) >= 0 && pred(s)) break; if (!step()) break; }
  s.players[0].bot = null; // from here seat 0 is "You" (the engine stops at your turns)
  for (let g = 0; phase && !s.over && g < 5000; g++) { if (s.phase === phase && E.toAct(s).indexOf(0) >= 0) break; if (!step()) break; }
  return JSON.stringify({ v: 1, settings: { opps: n - 1, level: 'hard', odds: true, hints: true, threat: true, quick: false, speed: 'fast', name: '' }, game: { state: s, notes: [], level: 'hard' }, last: null, online: false });
}

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
let server, BASE = process.env.EVO_URL;
if (!BASE) {
  server = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
  });
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  BASE = 'http://127.0.0.1:' + server.address().port + '/';
}

const browser = await pw[process.env.EVO_ENGINE || 'webkit'].launch({ headless: true }); // EVO_ENGINE=chromium for Chrome
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); }
}
async function open(w, h, store) {
  const phone = w < 900;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  // the computers wait (as in a background tab) so the table stays the seeded one
  await ctx.addInitScript(v => { try { if (!sessionStorage.getItem('s')) { localStorage.setItem('evolution:v1', v); sessionStorage.setItem('s', '1'); } } catch (e) {} Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); }, store);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
// on-screen size of the smallest opponent body/population cube, plus page health
const health = page => page.evaluate(() => {
  const cubes = [...document.querySelectorAll('.msp .cube')].map(c => c.getBoundingClientRect().height);
  const de = document.documentElement;
  return { cube: Math.min(...cubes), pageScroll: de.scrollHeight > innerHeight + 1, overflowX: de.scrollWidth > innerWidth + 1,
    oppsScroll: (o => o.scrollHeight - o.clientHeight)(document.querySelector('.opps')) };
});

const S4 = game(4, 7, s => s.round >= 3 && s.phase === 'feed');
const S2 = game(2, 14, s => s.round >= 4 && s.phase === 'feed');
const SP = game(4, 6, s => s.round >= 3, 'play');

await test('4 players, iPhone 393x659: opponents grow into the empty wood (cubes >= 16 px), no scroll', async () => {
  const { ctx, page, errs } = await open(393, 659, S4);
  const m = await health(page);
  await ctx.close();
  if (!(m.cube >= 16)) throw new Error('opponent cube ' + m.cube.toFixed(1) + ' px (want >= 16)');
  if (m.pageScroll || m.overflowX || m.oppsScroll > 2) throw new Error('scrolls: ' + JSON.stringify(m));
  if (errs.length) throw new Error(errs.join(' | '));
});

await test('2 players, iPhone 393x659: the one opponent is drawn big (cubes >= 20 px)', async () => {
  const { ctx, page } = await open(393, 659, S2);
  const m = await health(page);
  await ctx.close();
  if (!(m.cube >= 20)) throw new Error('opponent cube ' + m.cube.toFixed(1) + ' px (want >= 20)');
  if (m.pageScroll || m.overflowX) throw new Error('scrolls: ' + JSON.stringify(m));
});

await test('4 players, laptop 1280x800: opponents fill the spare height (cubes >= 26 px), no scroll', async () => {
  const { ctx, page } = await open(1280, 800, S4);
  const m = await health(page);
  await ctx.close();
  if (!(m.cube >= 26)) throw new Error('opponent cube ' + m.cube.toFixed(1) + ' px (want >= 26)');
  if (m.pageScroll || m.overflowX) throw new Error('scrolls: ' + JSON.stringify(m));
});

// nothing of an opponent is cut off: every name reads in full, every species is inside the table
const S6 = game(6, 12, s => s.round >= 5 && s.phase === 'feed');
for (const [w, h, st, n] of [[393, 659, S4, 4], [320, 568, S4, 4], [659, 393, S4, 4], [1440, 900, S6, 6], [1280, 800, S6, 6]]) {
  await test(n + ' players at ' + w + 'x' + h + ': opponents\' names and species are never cut off', async () => {
    const { ctx, page } = await open(w, h, st);
    const bad = await page.evaluate(() => {
      const out = [], or = document.querySelector('.opps').getBoundingClientRect();
      document.querySelectorAll('.opp').forEach(op => {
        const nm = op.querySelector('.nmx');
        if (nm.scrollWidth > nm.clientWidth + 1) out.push('name "' + nm.textContent + '" cut (' + nm.clientWidth + ' of ' + nm.scrollWidth + ' px)');
        op.querySelectorAll('.msp').forEach(m => { const r = m.getBoundingClientRect(); if (r.right > or.right + 1 || r.right > op.getBoundingClientRect().right + 4) out.push(nm.textContent + ' species cut at x=' + Math.round(r.right)); });
      });
      return out;
    });
    await ctx.close();
    if (bad.length) throw new Error(bad.join('; '));
  });
}

for (const [w, h] of [[1280, 800], [393, 659]]) {
  await test('tapping a hand card at ' + w + 'x' + h + ': the hand and the table stay exactly where they were', async () => {
    const { ctx, page } = await open(w, h, SP);
    const snap = () => page.evaluate(() => ({
      xs: [...document.querySelectorAll('#hand .tc')].map(c => Math.round(c.getBoundingClientRect().left)),
      z: ['.opps', '.mine', '.hand'].map(s => document.querySelector(s).style.zoom).join(','),
      mine: Math.round(document.querySelector('#mine .sp').getBoundingClientRect().width) }));
    const a = await snap();
    await page.click('#hand .tc', { force: true });
    await page.waitForTimeout(60);
    const b = await snap();
    const sel = await page.evaluate(() => document.querySelectorAll('#hand .tc.sel').length);
    await ctx.close();
    if (sel !== 1) throw new Error('the tap did not select a card');
    if (a.xs.join() !== b.xs.join()) throw new Error('hand cards moved: ' + a.xs.join() + ' -> ' + b.xs.join());
    if (a.z !== b.z || a.mine !== b.mine) throw new Error('table resized on tap: ' + JSON.stringify([a, b]));
  });
}

await browser.close();
if (server) server.close();
console.log('layout: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
