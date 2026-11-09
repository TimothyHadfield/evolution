// Fluid play in Safari's engine (WebKit, iPhone 393x659, and a laptop): Tim's "pick a card, either place it on a
// species, discard pile, or watering hole, or go back and take the card back before they're finally done".
// Run: node tests/fluid-ui.mjs   (needs Playwright: ~/.claude/tools/node_modules, or EVO_PW=<path to playwright index.mjs>)
// EVO_URL=<url> checks another copy of the site; EVO_SHOTS=<dir> saves screenshots.
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
if (!fs.existsSync(pwPath)) { console.log('fluid-ui: SKIPPED (Playwright not found at ' + pwPath + ')'); process.exit(0); }
const pw = (await import(pathToFileURL(pwPath).href)).default;

// You + 2 Hard computers (one at a time). On your play turn you hold 6 cards with 6 different traits.
const HAND_T = ['Long Neck', 'Climbing', 'Horns', 'Fertile', 'Foraging', 'Burrowing'];
function fluidStore() {
  let s = E.newGame({ seed: 31, stepBots: true, players: [{ name: 'You' }, { name: 'Computer 1', bot: 'hard' }, { name: 'Computer 2', bot: 'hard' }] });
  if (s.fluid !== true || s.phase !== 'play' || E.toAct(s)[0] !== 0) throw new Error('setup: not my fluid play turn (' + s.phase + ')');
  const pl = s.players[0];
  s.deck.push(...pl.hand); pl.hand = [];
  for (const t of HAND_T) { const id = s.deck.find(x => C.DECK[x].trait === t); s.deck.splice(s.deck.indexOf(id), 1); pl.hand.push(id); }
  pl.hand.sort((a, b) => a - b);
  return { hand: HAND_T.map(t => pl.hand.find(x => C.DECK[x].trait === t)), sp: pl.species[0].id,
    json: JSON.stringify({ v: 1, settings: { opps: 2, level: 'hard', odds: true, hints: true, threat: true, quick: false, speed: 'fast', name: '' }, game: { state: s, notes: [], level: 'hard', gid: 'fluid', moved: true }, last: null, online: false }) };
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
  const phone = (w || 393) < 900;
  const ctx = await browser.newContext(phone ? { ...pw.devices['iPhone 15'], viewport: { width: w || 393, height: h || 659 } } : { viewport: { width: w, height: h } });
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
// visible above the bottom tab bar, inside the screen
const onScreen = (page, sel) => page.evaluate(sel => {
  const el = document.querySelector(sel); if (!el) return 'missing ' + sel;
  const r = el.getBoundingClientRect(); const tab = !el.closest('#sheet') && document.querySelector('nav.tabs'); const lim = tab && tab.getBoundingClientRect().top > 0 ? tab.getBoundingClientRect().top : innerHeight;
  return r.width > 0 && r.top >= -0.5 && r.bottom <= lim + 0.5 && r.right <= innerWidth + 0.5 && r.left >= -0.5 ? '' : sel + ' off screen ' + JSON.stringify([r.left, r.top, r.right, r.bottom, lim]);
}, sel);
const pageOk = page => page.evaluate(() => { const de = document.documentElement; return de.scrollWidth > innerWidth + 1 ? 'page scrolls sideways' : de.scrollHeight > innerHeight + 1 ? 'page scrolls down' : ''; });
const must = async (page, sel, why) => { if (!(await page.$(sel))) throw new Error((why || 'missing') + ': ' + sel); };
const mustNot = async (page, sel, why) => { if (await page.$(sel)) throw new Error((why || 'should be gone') + ': ' + sel); };
const plan = page => page.evaluate(() => { const g = window.__evo.store.game; return { draft: g.draft, phase: g.state.phase }; });
const tap = async (page, sel) => { await page.click(sel); await page.waitForTimeout(260); };
const card = id => '#hand [data-card="' + id + '"]';

await test('fluid play on the phone: food card on the watering hole and back, trait, discard -> body, discard -> new species, take back in the sheet, Done needs a food card, reload keeps it, Done sends it all', async () => {
  const S = fluidStore();
  const [c0, c1, c2, c3, c4, c5] = S.hand;
  const { ctx, page, errs } = await open(S.json);
  try {
    // nothing placed yet: Done waits for a food card
    await must(page, '.acts [data-act=done][disabled]', 'Done should be disabled');
    if (!/food card/i.test(await page.textContent('.acts'))) throw new Error('no food-card message: ' + await page.textContent('.acts'));
    await mustNot(page, '.acts [data-mode]', 'old Trait/Body/Pop buttons');
    // a card lifted: the species, the watering hole and the discard pile glow, all on screen
    await tap(page, card(c0));
    await must(page, card(c0) + '.is-up', 'card lifted');
    for (const sel of ['.hole .wh.can', '.hole .discw.can #discard', '#mine .sp.can', '.newsp.can[data-new=R]']) { await must(page, sel, 'glow'); const m = await onScreen(page, sel); if (m) throw new Error(m); }
    if (SHOTS) await page.screenshot({ path: SHOTS + '/fluid-selected-393.png' });
    // watering hole: it lies there face down; Done works now
    await tap(page, '.hole .wh');
    await must(page, '.hole .fcards [data-myfood]', 'my food card on the hole');
    await mustNot(page, card(c0), 'food card still in hand');
    await must(page, '.acts [data-act=done]:not([disabled])', 'Done enabled with a food card');
    // tap it: back to my hand
    await tap(page, '.hole .fcards [data-myfood]');
    await mustNot(page, '.hole .fcards [data-myfood]'); await must(page, card(c0), 'food card back in hand');
    await must(page, '.acts [data-act=done][disabled]', 'Done disabled again');
    // a trait on my species, face down; tapping it takes it back, then again onto the species
    await tap(page, card(c1)); await tap(page, '#mine [data-sp="' + S.sp + '"] .trs');
    await must(page, '#mine [data-planned="' + c1 + '"]', 'planned trait');
    await tap(page, '#mine [data-planned="' + c1 + '"]');
    await mustNot(page, '#mine [data-planned="' + c1 + '"]'); await must(page, card(c1), 'trait back in hand');
    await tap(page, card(c1)); await tap(page, '#mine [data-sp="' + S.sp + '"] .trs');
    // discard pile: Body, Pop and + glow; Cancel puts the card back; then Body +1
    await tap(page, card(c2)); await tap(page, '.hole .discw');
    for (const sel of ['#mine [data-sp="' + S.sp + '"] .trk.can[data-trk=b]', '#mine [data-sp="' + S.sp + '"] .trk.can[data-trk=p]', '.newsp.can[data-new=L]', '.newsp.can[data-new=R]']) { await must(page, sel, 'grow glow'); const m = await onScreen(page, sel); if (m) throw new Error(m); }
    await mustNot(page, card(c2), 'card on the discard pile, not in hand');
    if (SHOTS) await page.screenshot({ path: SHOTS + '/fluid-grow-393.png' });
    await tap(page, '.acts [data-act=growcancel]');
    await must(page, card(c2), 'Cancel: card back in hand'); await mustNot(page, '.trk.can');
    await tap(page, card(c2)); await tap(page, '.hole .discw'); await tap(page, '#mine [data-sp="' + S.sp + '"] [data-trk=b]');
    // discard -> new species, then discard -> its population (a play made on the new species)
    await tap(page, card(c3)); await tap(page, '.hole .discw'); await tap(page, '.newsp[data-new=R]');
    await tap(page, card(c4)); await tap(page, '.hole .discw'); await tap(page, '#mine [data-sp="-1"] [data-trk=p]');
    let p = await plan(page);
    const want = [{ t: 'trait', card: c1, s: S.sp }, { t: 'body', card: c2, s: S.sp }, { t: 'species', card: c3, side: 'R' }, { t: 'pop', card: c4, s: -1 }];
    if (JSON.stringify(p.draft.moves) !== JSON.stringify(want)) throw new Error('plan ' + JSON.stringify(p.draft));
    // the sheet: taking back the new species takes the play on it too
    await tap(page, '.hole .discw');
    const rows = await page.$$eval('#sheet [data-tb]', b => b.map(x => x.dataset.tb));
    if (rows.join() !== '0,1,2,3') throw new Error('sheet rows ' + rows);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/fluid-sheet-393.png' });
    await tap(page, '#sheet [data-tb="2"]');
    p = await plan(page);
    if (JSON.stringify(p.draft.moves) !== JSON.stringify(want.slice(0, 2))) throw new Error('after take back ' + JSON.stringify(p.draft));
    await must(page, card(c3)); await must(page, card(c4));
    await tap(page, '#sheet [data-close]');
    // food card, then reload: everything planned is still there
    await tap(page, card(c5)); await tap(page, '.hole .wh');
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
    await must(page, '.hole .fcards [data-myfood]', 'food card kept after reload');
    await must(page, '#mine [data-planned="' + c1 + '"]', 'trait kept after reload');
    const label = await page.textContent('.acts [data-act=done]');
    if (!/Done \(3\)/.test(label)) throw new Error('Done label ' + label);
    // Undo takes back the last thing placed: the food card
    await tap(page, '.acts [data-act=undo]');
    await mustNot(page, '.hole .fcards [data-myfood]'); await tap(page, card(c5)); await tap(page, '.hole .wh');
    const o = await pageOk(page); if (o) throw new Error(o);
    await tap(page, '.acts [data-act=done]');
    const st = await page.evaluate(() => { const s = window.__evo.store.game.state; const me = s.players[0]; return { done: me.done, food: me.foodCard, body: me.species[0].body, hidden: me.species[0].hidden.concat(me.species[0].traits), hand: me.hand, notes: window.__evo.store.game.notes.map(n => n.k), phase: s.phase }; });
    if (st.food !== c5 || st.body !== 2 || st.hidden.indexOf(c1) < 0 || st.hand.length !== 3) throw new Error('after Done ' + JSON.stringify(st));
    if (st.notes.join() !== 'food,play') throw new Error('study notes ' + st.notes);
    if (errs.length) throw new Error(errs.join(' | '));
  } finally { await ctx.close(); }
});

await test('fluid play on a laptop (1280x800): glows on screen, no page scroll', async () => {
  const S = fluidStore();
  const { ctx, page, errs } = await open(S.json, 1280, 800);
  try {
    await tap(page, card(S.hand[0]));
    for (const sel of ['.hole .wh.can', '.hole .discw.can #discard', '#mine .sp.can']) { const m = await onScreen(page, sel); if (m) throw new Error(m); }
    if (SHOTS) await page.screenshot({ path: SHOTS + '/fluid-selected-1280.png' });
    await tap(page, '.hole .discw');
    for (const sel of ['#mine .trk.can[data-trk=b]', '#mine .trk.can[data-trk=p]', '.newsp.can[data-new=R]']) { const m = await onScreen(page, sel); if (m) throw new Error(m); }
    if (SHOTS) await page.screenshot({ path: SHOTS + '/fluid-grow-1280.png' });
    const o = await pageOk(page); if (o) throw new Error(o);
    if (errs.length) throw new Error(errs.join(' | '));
  } finally { await ctx.close(); }
});

await browser.close();
if (server) server.close();
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
