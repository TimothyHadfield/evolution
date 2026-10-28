// The guided first game, played through in Safari's engine (WebKit, iPhone 15 size): the offer on a fresh
// visit, every coach step reachable by tapping what it points at, the round ends with the attack, the bubble
// never covers its target, no page errors, and the guided game is never counted in My stats.
// Also: Rules sheet opens from the setup screen and its tabs wrap (no sideways scroll); Undo takes back a move.
// Run: node tests/tutorial-ui.mjs [--shots dir]   (needs Playwright: ~/.claude/tools/node_modules)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwPath = process.env.EVO_PW || path.join(os.homedir(), '.claude/tools/node_modules/playwright/index.mjs');
if (!fs.existsSync(pwPath)) { console.log('tutorial-ui: SKIPPED (Playwright not found)'); process.exit(0); }
const pw = (await import(pathToFileURL(pwPath).href)).default;
const shotDir = process.argv.indexOf('--shots') > 0 ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const BASE = 'http://127.0.0.1:' + server.address().port + '/?nosw';

let passed = 0, failed = 0;
const ok = (cond, name, extra) => { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); } };
const errors = [];
const browser = await pw.webkit.launch();
try {
  const ctx = await browser.newContext({ ...pw.devices['iPhone 15'], viewport: { width: 393, height: 659 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  // ---- offer, once
  await page.waitForSelector('.coach-offer', { timeout: 5000 }).catch(() => {});
  ok(await page.$('.coach-offer') !== null, 'fresh visit: the guided game is offered');
  let n = 0;
  const shot = async name => { if (shotDir) await page.screenshot({ path: path.join(shotDir, String(++n).padStart(2, '0') + '-' + name + '.png') }); };
  await shot('offer');
  await page.click('.coach-offer [data-o="yes"]');
  await page.waitForSelector('.coach-bubble');
  const step = () => page.evaluate(() => window.__evo.tour.current());
  const bubble = () => page.evaluate(() => { const b = document.querySelector('.coach-bubble'); const w = document.querySelector('.coach-layer'); return b && !(w && w.classList.contains('coach-off')) ? b.innerText : ''; });
  // bubble inside the screen and not over the step's target
  const placement = () => page.evaluate(() => {
    const b = document.querySelector('.coach-bubble'), ring = document.querySelector('.coach-ring');
    if (!b) return 'no bubble';
    const r = b.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return 'off screen ' + JSON.stringify(r);
    const layer = document.querySelector('.coach-layer');
    if (ring && layer && !layer.classList.contains('coach-nohole')) {
      const q = ring.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)), iy = Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top));
      if (q.width * q.height < innerWidth * innerHeight * 0.6 && ix * iy > 0.25 * q.width * q.height) return 'covers target';
    }
    return '';
  });
  const wait = ms => page.waitForTimeout(ms);
  const next = async () => { await page.click('.coach-bubble [data-coach="next"]'); await wait(250); };
  const bad = [];
  const check = async label => { await page.waitForTimeout(350); const p = await placement(); if (p) bad.push(label + ': ' + p); if (!(await bubble())) bad.push(label + ': bubble hidden'); await shot(label); };
  const waitFor = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await wait(150); } return false; };

  for (const k of ['intro', 'mine', 'opps', 'hole']) { await check(k); await next(); }
  const S = await page.evaluate(() => window.EvoTutorial.SCRIPT);
  await check('food-card');
  await page.click('#hand [data-card="' + S.food + '"]'); await wait(300);
  await check('use-as-food');
  await page.click('.acts [data-act="food"]');
  ok(await waitFor(() => window.__evo.store.game.state.phase === 'play'), 'food card placed, play phase');
  await wait(500);
  await check('new-species');
  await page.click('#hand [data-card="' + S.species + '"]'); await wait(250);
  await page.click('.newsp[data-new="R"]'); await wait(450);
  await check('carnivore');
  await page.click('#hand [data-card="' + S.carn + '"]'); await wait(250);
  await page.click('#mine [data-sp="-1"]'); await wait(450);
  await check('body');
  await page.click('#hand [data-card="' + S.body + '"]'); await wait(250);
  await page.click('.acts [data-mode="body"]'); await wait(200);
  await page.click('#mine [data-sp="-1"]'); await wait(450);
  await check('done');
  await page.click('.acts [data-act="done"]');
  ok(await waitFor(() => window.__evo.store.game.state.phase === 'feed'), 'cards played, feeding');
  await wait(1200);
  await check('reveal');
  await next();
  ok(/plant eater/.test(await bubble()), 'coach asks to feed the plant eater', await bubble());
  await check('feed');
  const plant = await page.evaluate(() => window.__evo.store.game.state.players[0].species.find(sp => !sp.traits.some(id => window.EvoCards.DECK[id].trait === 'Carnivore')).id);
  await page.click('#mine [data-sp="' + plant + '"]');
  ok(await waitFor(() => { const s = window.__evo.store.game.state; return s.phase === 'feed' && s.turn === 0 && s.players[0].species.some(sp => sp.food > 0); }, 10000), 'plant eater fed, my turn again');
  await wait(600);
  ok(/Attack/.test(await bubble()) || /Carnivore/.test(await bubble()), 'coach asks for the attack', await bubble());
  await check('attack');
  const carn = await page.evaluate(() => window.__evo.store.game.state.players[0].species.find(sp => sp.traits.some(id => window.EvoCards.DECK[id].trait === 'Carnivore')).id);
  await page.click('#mine [data-sp="' + carn + '"]'); await wait(300);
  await page.click('.opps .msp.can'); await wait(300);
  await page.click('.acts [data-act="attack"]');
  ok(await waitFor(() => window.__evo.store.game.state.log.some(l => l.k === 'atk' && l.p === 0)), 'my Carnivore attacked');
  await wait(900);
  await check('after-attack'); await next();
  await check('bag'); await next();
  await check('last');
  ok(/Play on/.test(await bubble()), 'last step says play on', await bubble());
  await page.click('.coach-bubble [data-coach="next"]'); await wait(300);
  ok(await step() < 0 || !(await bubble()), 'tutorial finished');
  ok(bad.length === 0, 'bubble on screen and off its target at every step', bad.join('; '));
  // ---- the guided game is never counted, even if it ends or is left
  const counted = await page.evaluate(() => { window.__evo.store.game.moved = true; return window.Profile.stats().games; });
  await page.evaluate(() => window.__evo.showTab('play', true));
  ok(counted === 0, 'guided game not counted in My stats');
  // ---- Undo vs the computer: a normal game, food card, Undo puts it back
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('evolution:v1')); s.game = null; localStorage.setItem('evolution:v1', JSON.stringify(s)); });
  await page.goto(BASE + '&r=1');
  await page.waitForSelector('[data-go="start"]');
  await page.click('[data-go="start"]');
  await page.waitForSelector('#hand .tc');
  await wait(1500);
  const h0 = await page.evaluate(() => window.__evo.store.game.state.players[0].hand.slice());
  ok(await page.$('.status [data-go="undo"][disabled]') !== null, 'Undo shown, disabled before any move');
  await page.click('#hand [data-card="' + h0[0] + '"]'); await wait(200);
  await page.click('.acts [data-act="food"]'); await wait(500);
  ok(await page.$('.status [data-go="undo"]:not([disabled])') !== null, 'Undo enabled after a move');
  await page.click('.status [data-go="undo"]'); await wait(400);
  const after = await page.evaluate(() => ({ hand: window.__evo.store.game.state.players[0].hand.slice(), phase: window.__evo.store.game.state.phase, helped: window.__evo.store.game.helped }));
  ok(after.phase === 'food' && JSON.stringify(after.hand) === JSON.stringify(h0) && after.helped === true, 'Undo: back to the food card, game marked as helped', JSON.stringify(after));
  await shot('undo');
  // ---- rules sheet from the setup screen: tabs wrap, no sideways scroll
  await page.evaluate(() => window.__evo.openRules());
  await page.waitForSelector('.coach-rules');
  const nav = await page.evaluate(() => { const n = document.querySelector('.coach-rules-nav'); return { sw: n.scrollWidth, cw: n.clientWidth, doc: document.documentElement.scrollWidth }; });
  ok(nav.sw <= nav.cw + 1 && nav.doc <= 393, 'rules tabs wrap, no sideways scroll', JSON.stringify(nav));
  await shot('rules');
  await page.click('.coach-rules-nav [data-sec="6"]'); await wait(400); await shot('rules-traits');
  ok(errors.length === 0, 'no page errors', errors.join(' | '));
} finally {
  await browser.close();
  server.close();
}
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
