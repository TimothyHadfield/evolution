// Leaf-trait order and the Videos tab, in Safari's engine (WebKit, iPhone 393x659).
// Rulebook p.6: a player with more than one leaf trait (Fertile, Fat Tissue, Long Neck) chooses their order.
// Run: node tests/leaf-ui.mjs   (needs Playwright: ~/.claude/tools/node_modules, or EVO_PW=<path to playwright index.mjs>)
// EVO_URL=<url> checks another copy of the site (e.g. the live one) instead of this folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = require(ROOT + '/js/cards.js');
const E = require(ROOT + '/js/engine.js');
require(ROOT + '/js/bots.js');

const pwPath = process.env.EVO_PW || path.join(os.homedir(), '.claude/tools/node_modules/playwright/index.mjs');
if (!fs.existsSync(pwPath)) { console.log('leaf-ui: SKIPPED (Playwright not found at ' + pwPath + ')'); process.exit(0); }
const pw = (await import(pathToFileURL(pwPath).href)).default;

// You + 2 Hard computers, Quick Play. Your one species: body 4, population 1, 4 food stored on Fat Tissue, plus Fertile.
// Fertile first -> population 2, 2 food on the board, 2 stored; Fat Tissue first -> population 2, 1 food, 3 stored.
function leafStore() {
  let s = E.newGame({ seed: 11, quick: true, stepBots: true, players: [{ name: 'You' }, { name: 'Computer 1', bot: 'hard' }, { name: 'Computer 2', bot: 'hard' }] });
  s = E.apply(s, 0, { t: 'food', card: s.players[0].hand[0] });
  const pickT = t => C.DECK.find(c => c.trait === t && s.players.every(pl => pl.hand.indexOf(c.id) < 0) && s.deck.indexOf(c.id) >= 0).id;
  const f = pickT('Fertile'), ft = pickT('Fat Tissue');
  s.deck = s.deck.filter(id => id !== f && id !== ft);
  s.players[0].species = [{ id: 600, body: 4, pop: 1, food: 0, fat: 4, traits: [f, ft], hidden: [], born: 1 }];
  s.removed = (s.removed || 0) + 2; // two cards taken from the deck onto the table
  s.hole = 2;
  return JSON.stringify({ v: 1, settings: { opps: 2, level: 'hard', odds: true, hints: true, threat: true, quick: true, speed: 'fast', name: '' }, game: { state: s, notes: [], level: 'hard', gid: 'leaf', moved: true }, last: null, online: false });
}

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
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
const SHOTS = process.env.EVO_SHOTS || '';

const browser = await pw.webkit.launch({ headless: true });
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  PASS  ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e && e.message)); }
}
async function open(store, w, h) {
  const ctx = await browser.newContext({ ...pw.devices['iPhone 15'], viewport: { width: w || 393, height: h || 659 } });
  // computers wait (as in a background tab) so the table stays as set
  await ctx.addInitScript(v => { try { if (v && !sessionStorage.getItem('s')) { localStorage.setItem('evolution:v1', v); localStorage.setItem('coach-offer:evo-first', 'true'); sessionStorage.setItem('s', '1'); } } catch (e) {} Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); }, store || '');
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/access control checks/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
const sp0 = page => page.evaluate(() => { const s = window.__evo.store.game.state; const x = s.players[0].species[0]; return { phase: s.phase, r: [x.pop, x.food, x.fat] }; });
// visible above the bottom tab bar, inside the screen width
const onScreen = (page, sel) => page.evaluate(sel => {
  const el = document.querySelector(sel); if (!el) return 'missing ' + sel;
  const r = el.getBoundingClientRect(); const tab = !el.closest('#sheet') && document.querySelector('nav.tabs'); const lim = tab && tab.getBoundingClientRect().top > 0 ? tab.getBoundingClientRect().top : innerHeight; // sheets cover the tab bar
  return r.width > 0 && r.bottom <= lim + 0.5 && r.right <= innerWidth + 0.5 && r.left >= -0.5 ? '' : sel + ' off screen ' + JSON.stringify([r.left, r.top, r.right, r.bottom, lim]);
}, sel);
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 ? 'page scrolls sideways' : '');

await test('leaf order: you choose it when it matters (Best order + Other order on screen, the other order works, Undo brings the choice back)', async () => {
  const { ctx, page, errs } = await open(leafStore());
  try {
    // play no cards: the reveal comes, and your leaf traits need an order
    await page.click('.acts [data-act=done]');
    await page.waitForTimeout(400);
    let st = await sp0(page);
    if (st.phase !== 'leaf') throw new Error('phase ' + st.phase + ' (want leaf)');
    for (const sel of ['.acts [data-act=leafbest]', '.acts [data-act=leafmore]']) { const m = await onScreen(page, sel); if (m) throw new Error(m); }
    const ph = await page.textContent('.status .ph');
    if (!/leaf/i.test(ph)) throw new Error('status says ' + ph);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/leaf-bar-393.png' });
    await page.click('.acts [data-act=leafmore]');
    await page.waitForTimeout(300);
    const n = await page.$$eval('#sheet [data-leaf]', b => b.length);
    if (n !== 2) throw new Error(n + ' choices in the sheet (want 2)');
    const m2 = await onScreen(page, '#sheet [data-leaf="1"]'); if (m2) throw new Error(m2);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/leaf-sheet-393.png' });
    await page.click('#sheet [data-leaf="1"]');
    await page.waitForTimeout(400);
    st = await sp0(page);
    if (st.phase !== 'feed' || st.r.join() !== '2,1,3') throw new Error('after the other order: ' + JSON.stringify(st));
    // Undo: back to the choice
    await page.click('[data-go=undo]');
    await page.waitForTimeout(400);
    st = await sp0(page);
    if (st.phase !== 'leaf') throw new Error('after Undo: ' + JSON.stringify(st));
    await page.click('.acts [data-act=leafbest]');
    await page.waitForTimeout(400);
    st = await sp0(page);
    if (st.phase !== 'feed' || st.r.join() !== '2,2,2') throw new Error('after Best order: ' + JSON.stringify(st));
    // a reload keeps the game
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    st = await sp0(page);
    if (st.phase !== 'feed' || st.r.join() !== '2,2,2') throw new Error('after reload: ' + JSON.stringify(st));
    const o = await noOverflow(page); if (o) throw new Error(o);
    if (errs.length) throw new Error(errs.join(' | '));
  } finally { await ctx.close(); }
});

for (const [w, h] of [[393, 659], [320, 568]]) await test('rules sheet: Videos tab with 2-5 YouTube links, new tab, readable on the cream paper (' + w + 'x' + h + ')', async () => {
  const { ctx, page, errs } = await open(null, w, h);
  try {
    await page.evaluate(() => window.__evo.openRules());
    await page.waitForTimeout(400);
    const nav = page.locator('.coach-rules-nav button', { hasText: 'Videos' });
    if (!(await nav.count())) throw new Error('no Videos tab');
    await nav.first().click();
    await page.waitForTimeout(600);
    const links = await page.$$eval('.coach-rules .vids a', as => as.map(a => { const r = a.getBoundingClientRect(); const c = getComputedStyle(a).color.match(/\d+/g).map(Number);
      return { href: a.href, target: a.target, rel: a.rel, vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, lum: (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 }; }));
    if (links.length < 2 || links.length > 5) throw new Error(links.length + ' links');
    for (const l of links) {
      if (!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(l.href)) throw new Error('bad link ' + l.href);
      if (l.target !== '_blank' || !/noopener/.test(l.rel)) throw new Error('not a new tab: ' + l.href);
      if (!l.vis) throw new Error('link not in view: ' + l.href);
      if (l.lum > 0.45) throw new Error('link too light on cream: ' + l.lum.toFixed(2));
    }
    if (SHOTS) await page.screenshot({ path: SHOTS + '/videos-' + w + '.png' });
    const o = await noOverflow(page); if (o) throw new Error(o);
    if (errs.length) throw new Error(errs.join(' | '));
  } finally { await ctx.close(); }
});

await browser.close();
if (server) server.close();
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
