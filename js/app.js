/* Evolution Lab: the screens. One store object (localStorage 'evolution:v1'), render*() functions
   writing template strings, one delegated click handler per view. The game lives in EvoEngine as a
   JSON state; a "table" object is the seat transport (this device, or an online room). */
(function () {
  'use strict';
  const VERSION = '1.2 · 2026-10-20';
  const { DECK, TRAITS, TEXT, FOOD } = EvoCards;
  const E = EvoEngine, B = EvoBots, O = EvoOdds, A = EvoArt;
  const KEY = 'evolution:v1';
  let ME = 0;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#f0b354', '#6ea8fe', '#e98bd0', '#6ee7a8', '#c9a0ff', '#ff9f7a'];
  const LEVELS = ['easy', 'medium', 'hard'];
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  const cut = (s, n) => Array.from(s).slice(0, n).join(''); // never splits an emoji in half
  const T = id => DECK[id].trait;
  const STRENGTH = window.EvoStrength || null;

  // ------------------------------------------------------------------ sound & effects (js/fx.js + js/game-fx.js)
  const FXL = window.FX || null, GFX = window.EvoFx || null;
  const TB = window.TABLE || null;
  const fxEnv = { table: TB, wait: (ms, fn) => (ms ? setTimeout(fn, ms) : fn()), el: s => document.querySelector(s), all: s => Array.from(document.querySelectorAll(s)) };
  function fxClasses() {
    if (!FXL) return;
    const s = FXL.settings;
    document.body.classList.toggle('fx-still', !s.animations);
    document.body.classList.toggle('fx-fast', s.animSpeed === 'fast');
  }
  if (FXL) { FXL.init({ game: 'evolution', accent: '#6ea8fe', onChange: fxClasses }); if (GFX) GFX.define(FXL); fxClasses(); }
  const sfx = (name, o) => { if (FXL) FXL.play(name, o); };
  // a card glides from the hand to where it was played (a copy; the real card re-renders in place)
  function fxFly(from, to) { return FXL && from && to ? FXL.flyTo(from, to, { duration: 360, fade: true }) : Promise.resolve(); }

  // ------------------------------------------------------------------ storage
  function fresh() {
    return { v: 1, settings: { opps: 2, level: 'hard', odds: true, hints: true, threat: true, quick: false, speed: 'normal', name: '' }, game: null, last: null, online: false };
  }
  const store = (function () {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        const out = Object.assign(fresh(), s, { settings: Object.assign(fresh().settings, s.settings || {}) });
        const st = out.settings, def = fresh().settings;
        if (![1, 2, 3, 4, 5].includes(st.opps)) st.opps = def.opps;
        if (!LEVELS.includes(st.level)) st.level = def.level;
        if (!['slow', 'normal', 'fast'].includes(st.speed)) st.speed = def.speed;
        st.odds = st.odds !== false; st.hints = st.hints !== false; st.threat = st.threat !== false; st.quick = st.quick === true;
        st.name = typeof st.name === 'string' ? cut(st.name, 20) : '';
        return out;
      }
    } catch (e) { /* private mode or bad JSON: start fresh */ }
    return fresh();
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* full or blocked: keep playing */ } }

  // ------------------------------------------------------------------ tables (seat transports)
  function LocalTable(game) { this.game = game; }
  LocalTable.prototype.view = function () { return E.view(this.game.state, ME); };
  LocalTable.prototype.act = function (action) {
    const before = this.game.state;
    const note = noteFor(before, action);
    this.game.state = E.apply(before, ME, action);
    if (note) { this.game.notes.push(note); if (this.game.notes.length > 300) this.game.notes.shift(); }
    save();
    return true;
  };
  let table = null;
  if (store.game && store.game.state) {
    try { table = new LocalTable(store.game); table.view(); } catch (e) { table = null; store.game = null; save(); }
  }

  // Study notes: how each of my choices compares with what the Hard computer would do
  function noteFor(s, action) {
    try {
      if (s.phase === 'feed' && s.turn === ME) {
        const best = B.decide(s, ME, 'hard');
        const vMine = B.rate(s, ME, action), vBest = B.rate(s, ME, best);
        return { r: s.round, k: 'feed', mine: describe(s, action), best: describe(s, best), lost: Math.max(0, vBest - vMine) };
      }
      if (s.phase === 'food' && action.t === 'food') {
        const best = B.decide(s, ME, 'hard');
        return { r: s.round, k: 'food', mine: 'Food card: ' + T(action.card) + ' (' + fmtFood(DECK[action.card].food) + ')', best: 'Food card: ' + T(best.card) + ' (' + fmtFood(DECK[best.card].food) + ')', same: best.card === action.card || DECK[best.card].trait === DECK[action.card].trait && DECK[best.card].food === DECK[action.card].food };
      }
      if (s.phase === 'play' && action.t === 'play') {
        return { r: s.round, k: 'play', mine: action.moves.length ? action.moves.map(m => describeMove(s, m)).join(' · ') : 'Played no cards' };
      }
    } catch (e) { /* notes are extras */ }
    return null;
  }
  const fmtFood = f => (f > 0 ? '+' : '') + f;
  function spName(s, id) {
    const loc = E.findSp(s, id);
    if (!loc) return 'a species';
    const sp = loc.sp;
    const who = loc.p === ME ? 'your' : esc(s.players[loc.p].name) + '’s';
    return who + ' ' + sp.body + '/' + sp.pop + (sp.traits.length ? ' ' + sp.traits.map(T).join('+') : '');
  }
  function describe(s, a) {
    if (!a) return '—';
    if (a.t === 'pass') return 'Stop feeding';
    if (a.t === 'eat') return 'Eat plant food with ' + spName(s, a.s);
    if (a.t === 'intel') return 'Intelligence food for ' + spName(s, a.s);
    if (a.t === 'attack') return 'Attack ' + spName(s, a.target) + ' with ' + spName(s, a.s);
    return a.t;
  }
  function describeMove(s, m) {
    const t = T(m.card);
    if (m.t === 'drop') return 'Discard ' + t + ' from a species';
    if (m.t === 'species') return t + ' → new species';
    if (m.t === 'body') return t + ' → body +1';
    if (m.t === 'pop') return t + ' → population +1';
    return t + ' as a trait';
  }

  // ------------------------------------------------------------------ online table
  function OnlineTable(room) { this.online = true; this.room = room; this.snap = room.view(); }
  OnlineTable.prototype.view = function () { return EvoOnlineGame.viewFromSnap(this.snap); };
  OnlineTable.prototype.act = function (action) {
    net.busy = true; net.sentV = this.snap.v; clearTimeout(net.timer);
    net.timer = setTimeout(() => { net.busy = false; renderPlay(); }, 8000);
    this.room.act(action).then(r => { if (!r.ok) { unbusy(); sfx('error'); toast(r.message); renderPlay(); } });
    return true;
  };
  const net = { room: null, snap: null, busy: false, sentV: null, timer: null, savedLast: false, connecting: false };
  function loadOnline() {
    if (net.room) return Promise.resolve(net.room);
    return import(new URL('js/online.js?v=2', location.href).href).then(mod => {
      if (net.room) return net.room;
      net.room = mod.createOnline({ game: EvoOnlineGame.game, gameId: 'evolution', botDelayMs: 700 });
      net.room.on('change', onNet);
      net.room.on('error', msg => { unbusy(); toast(String(msg)); if (ui.tab === 'play') renderPlay(); });
      return net.room;
    });
  }
  function unbusy() { net.busy = false; clearTimeout(net.timer); }
  function backToLocal() {
    ME = 0; net.savedLast = false;
    table = store.game && store.game.state ? new LocalTable(store.game) : null;
  }
  function onNet(snap) {
    net.snap = snap;
    if (net.busy && snap.v !== net.sentV) unbusy();
    if (snap.status === 'playing' || snap.status === 'finished') {
      if (!table || !table.online) { table = new OnlineTable(net.room); resetSel(); net.savedLast = false; ui.fxFresh = snap.status === 'playing'; }
      table.snap = snap;
      ME = snap.mySeat >= 0 ? snap.mySeat : 0;
      if (snap.status === 'finished' && snap.pub && !net.savedLast) { net.savedLast = true; store.last = { view: EvoOnlineGame.viewFromSnap(snap), notes: [], online: true }; save(); }
    } else if (table && table.online) backToLocal();
    if (snap.status === 'closed' || snap.status === 'left') {
      store.online = false; save();
      if (snap.status === 'closed') toast('The room was closed');
    }
    if (ui.tab === 'play') renderPlay();
  }
  function leaveOnline() {
    const r = net.room;
    store.online = false; ui.online = false; save();
    backToLocal(); resetSel();
    if (r) r.leave().catch(() => {});
    renderPlay();
  }
  async function onlineBtn(k) {
    if (k === 'open') { ui.online = true; try { history.pushState({ tab: 'play', on: 1 }, '', '#play'); } catch (e) { /* file:// */ } renderPlay(); loadOnline().catch(() => toast('Online play couldn’t load. Check your internet.')); return; }
    if (k === 'back') {
      if (net.snap && net.snap.status === 'lobby') { confirmBox('Leave this room?', 'Leave', leaveOnline); return; }
      if (history.state && history.state.on) { history.back(); return; } // the same as the phone's Back
      ui.online = false; renderPlay(); return;
    }
    if (k === 'start') {
      if (net.connecting) return;
      net.connecting = true; renderPlay();
      const r = await net.room.start();
      net.connecting = false;
      if (!r.ok) toast(r.message);
      renderPlay(); return;
    }
    if (k !== 'create' && k !== 'join') return;
    const nameEl = $('#on-name');
    if (nameEl) { store.settings.name = cut(nameEl.value.trim(), 20); save(); }
    const name = store.settings.name || 'Player';
    const codeEl = $('#on-code');
    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
    if (k === 'join' && code.length !== 5) { toast('Room codes have 5 letters'); return; }
    if (net.connecting) return;
    net.connecting = true; renderPlay();
    let r;
    try {
      const room = await loadOnline();
      if (k === 'create') {
        const seats = ['human'].concat(new Array(store.settings.opps).fill('empty'));
        r = await room.createRoom({ name, seats, options: { level: store.settings.level, quick: store.settings.quick } });
      } else r = await room.joinRoom(code, name);
    } catch (e) { r = { ok: false, message: 'Online play couldn’t load. Check your internet.' }; }
    net.connecting = false;
    if (r.ok) { store.online = true; save(); } else toast(r.message);
    renderPlay();
  }

  // ------------------------------------------------------------------ ui state
  const ui = { hideOver: false, online: false, tab: 'play', sel: null, mode: 'trait', draft: [], feedSel: null, target: null, needCard: null, prevLog: 0, botTimer: null, gen: 0, labTab: 'traits', calc: null, studyRound: null };
  function resetSel() { ui.sel = null; ui.mode = 'trait'; ui.draft = []; ui.feedSel = null; ui.target = null; ui.needCard = null; }
  function restoreDraft() {
    try {
      const g = store.game, d = g && g.draft;
      if (d && Array.isArray(d.moves) && g.state.phase === 'play' && d.r === g.state.round && E.toAct(g.state).indexOf(ME) >= 0) ui.draft = d.moves.slice(0, 60);
    } catch (e) { ui.draft = []; }
  }
  restoreDraft();
  // the same game open in two tabs: whatever one tab saves, the other picks up (no move is ever undone)
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue || (table && table.online)) return;
    try {
      const s = JSON.parse(e.newValue);
      if (!s || s.v !== 1) return;
      store.game = s.game || null; store.last = s.last || null;
      Object.assign(store.settings, s.settings || {});
      table = store.game && store.game.state ? new LocalTable(store.game) : null;
      if (table) table.view();
    } catch (x) { return; }
    clearTimeout(ui.botTimer); ui.gen++; resetSel(); restoreDraft(); ui.hideOver = false;
    render();
  });
  // a tab in the background doesn't play the computers' turns; they carry on when you come back
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ui.tab === 'play' && isLocal()) renderPlay(); });
  // turning the phone or resizing the window: fit the table again to the new screen
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (ui.tab === 'play' && table && ui.fit && ui.fit.key.split(':')[0] !== innerWidth + 'x' + innerHeight) renderPlay(); }, 200); });

  // ------------------------------------------------------------------ small helpers
  function heat(x, lo, hi) { const f = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return 'hsl(' + Math.round(f * 130) + ', 70%, 62%)'; }
  const pct = x => Math.round(x * 100) + '%';
  const qBtn = text => '<button class="q" data-q="' + esc(text) + '" aria-label="Why?">?</button>';
  function toast(msg) {
    msg = String(msg || '');
    // the browser's own words when the online code can't download (no internet) mean nothing to a player
    if (/importing a module|module script|failed to fetch|load failed|networkerror/i.test(msg)) msg = 'Online play couldn’t load. Check your internet.';
    if ([...document.querySelectorAll('.toast')].some(t => t.textContent === msg)) return; // the same note once
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }
  function confirmBox(msg, yes, onYes) {
    const back = document.createElement('div');
    back.className = 'confirm-back';
    back.innerHTML = '<div class="panel"><p style="margin:0 0 14px">' + esc(msg) + '</p><div class="row" style="justify-content:flex-end">' +
      '<button class="btn ghost" data-c="no">Cancel</button><button class="btn primary" data-c="yes">' + esc(yes) + '</button></div></div>';
    back.addEventListener('click', e => {
      const b = e.target.closest('[data-c]');
      if (e.target === back || b) { back.remove(); overlayClosed(); if (b && b.dataset.c === 'yes') onYes(); }
    });
    document.body.appendChild(back);
    overlayOpened();
  }
  // Back closes an open sheet or question instead of leaving the page: each one gets a history entry,
  // which is taken back off when it is closed another way
  function overlayOpen() { return !!($('#sheet') || document.querySelector('.confirm-back:not(#over)')); }
  function overlayOpened() {
    if (ui.ovHist) return;
    try { history.pushState({ tab: ui.tab, ov: 1 }, '', location.hash || '#' + ui.tab); ui.ovHist = true; } catch (e) { /* file:// */ }
  }
  function overlayClosed() {
    setTimeout(() => {
      if (!ui.ovHist || overlayOpen()) return;
      ui.ovHist = false; ui.skipPop = true;
      try { history.back(); } catch (e) { ui.skipPop = false; }
    }, 0);
  }
  function sheet(title, html, onClick) {
    const old = $('#sheet'); if (old) old.remove(); // one sheet replaces another on the same history entry
    const back = document.createElement('div');
    back.className = 'sheet-back'; back.id = 'sheet';
    back.innerHTML = '<div class="sheet"><div class="row"><h3 class="grow">' + esc(title) + '</h3><button class="btn small ghost" data-close>Close</button></div><div class="scroll">' + html + '</div></div>';
    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('[data-close]')) { closeSheet(); return; }
      if (onClick) onClick(e);
    });
    document.body.appendChild(back);
    overlayOpened();
  }
  function closeSheet() { const s = $('#sheet'); if (s) { s.remove(); overlayClosed(); } }
  // soft hyphens so long one-word trait names break cleanly on small cards instead of being cut off
  const SOFT = { Intelligence: 'Intelli­gence', Cooperation: 'Cooper­ation', Burrowing: 'Burrow­ing', Carnivore: 'Carni­vore', Scavenger: 'Scav­enger', Symbiosis: 'Sym­biosis' };
  const tName = t => esc(SOFT[t] || t);
  function famStyle(t) { const f = A.FAMILY[t] || 'feed'; return '--paper:' + A.PAPER[f] + ';--ink:' + A.INK[f]; }

  // a trait card face (id = deck id, or -1 for a face-down card)
  function cardFace(id, o) {
    o = o || {};
    if (id < 0) return '<div class="tc tbl-card tbl-back evo-back ' + (o.cls || '') + '"' + (o.style ? ' style="' + o.style + '"' : '') + (o.attr || '') + '></div>';
    const c = DECK[id];
    return '<div class="tc tbl-card ' + (o.cls || '') + '" style="' + famStyle(c.trait) + (o.delay ? ';animation-delay:' + o.delay + 'ms' : '') + (o.style ? ';' + o.style : '') + '"' + (o.attr || '') + '>' +
      faceInner(c.trait, c.food, o.big) + '</div>';
  }
  // what is printed on a trait card: name across the top, the drawing, the rules text (big cards), the food leaf bottom right
  function faceInner(t, food, big) {
    return '<span class="tn">' + tName(t) + '</span><span class="art">' + A.icon(t) + '</span>' + (big ? '<span class="tx">' + esc(TEXT[t] || '') + '</span>' : '') +
      (food != null ? '<span class="fd' + (food < 0 ? ' neg' : '') + '">' + fmtFood(food) + '</span>' : '');
  }
  // turn a face-down card over in 3-D: it turns edge-on, the face is swapped in, it turns back flat.
  // (no backface trick, so it looks the same in every browser)
  function turnOver(el, id, delay) {
    setTimeout(() => {
      if (!el.isConnected || !el.animate) return;
      const half = Math.round(190 * (FXL && FXL.settings.animSpeed === 'fast' ? 0.55 : 1));
      const a = el.animate([{ transform: 'perspective(320px) rotateY(0deg)' }, { transform: 'perspective(320px) rotateY(90deg)' }], { duration: half, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = () => {
        if (!el.isConnected) return;
        const t = document.createElement('template');
        t.innerHTML = cardFace(id, { style: el.style.zIndex ? 'z-index:' + el.style.zIndex : '' });
        const face = t.content.firstElementChild;
        el.replaceWith(face);
        face.animate([{ transform: 'perspective(320px) rotateY(-90deg)' }, { transform: 'none' }], { duration: half, easing: 'ease-out' });
      };
    }, delay);
  }
  function bigTrait(t, foodVal) {
    return '<div class="tc tbl-card big" style="' + famStyle(t) + '">' + faceInner(t, foodVal, true) + '</div>';
  }

  // ------------------------------------------------------------------ tabs + back button
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    showTab(b.dataset.tab, true);
  });
  function showTab(tab, push) {
    if (!['play', 'lab', 'study', 'settings'].includes(tab)) tab = 'play';
    const from = ui.tab;
    ui.tab = tab;
    const ov = ui.ovHist; ui.ovHist = false; // a sheet's history entry becomes the new tab's entry
    const s = $('#sheet'); if (s) s.remove();
    document.querySelectorAll('.confirm-back:not(#over)').forEach(b => b.remove());
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
    try {
      if (push && ov) history.replaceState({ tab }, '', '#' + tab);
      else if (push && tab !== from) history.pushState({ tab }, '', '#' + tab);
      else if (ov) { ui.skipPop = true; history.back(); }
    } catch (e) { /* file:// */ }
    render();
  }
  window.addEventListener('popstate', e => {
    if (ui.skipPop) { ui.skipPop = false; return; }
    if (overlayOpen()) { ui.ovHist = false; const box = document.querySelector('.confirm-back:not(#over)'); if (box) box.remove(); const s = $('#sheet'); if (s) s.remove(); return; }
    const st = e.state || {};
    // Back from the online screen goes to the setup screen it came from
    if (ui.tab === 'play' && ui.online && !st.on && !(table && table.online)) {
      if (net.snap && net.snap.status === 'lobby') { try { history.pushState({ tab: 'play', on: 1 }, '', '#play'); } catch (x) { /* file:// */ } confirmBox('Leave this room?', 'Leave', leaveOnline); return; }
      ui.online = false; if ((st.tab || 'play') === 'play') { renderPlay(); return; }
    }
    showTab(st.tab || (location.hash.slice(1) || 'play'), false); });

  // help bubbles
  document.addEventListener('click', e => {
    const old = $('.qpop');
    const q = e.target.closest('[data-q]');
    if (old) old.remove();
    if (!q || (old && old.dataset.for === q.dataset.q)) return;
    const pop = document.createElement('div');
    pop.className = 'qpop'; pop.textContent = q.dataset.q; pop.dataset.for = q.dataset.q;
    document.body.appendChild(pop);
    const r = q.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
  });

  function render() {
    if (ui.tab === 'play') renderPlay();
    else if (ui.tab === 'lab') renderLab();
    else if (ui.tab === 'study') renderStudy();
    else renderSettings();
  }

  // ================================================================== PLAY
  const vPlay = $('#v-play');
  function renderPlay() { if (table) renderGame(); else if (ui.online) renderOnline(); else renderSetup(); }

  function renderSetup() {
    const st = store.settings;
    const sample = [DECK.findIndex(c => c.trait === 'Carnivore'), DECK.findIndex(c => c.trait === 'Long Neck'), DECK.findIndex(c => c.trait === 'Hard Shell')];
    vPlay.innerHTML = '<div class="setup home">' +
      '<div class="hero"><img src="icon.svg" alt=""><div><h1>Evolution Lab</h1><p>Grow species, feed them, out-evolve the table.</p></div></div>' +
      '<div class="art-strip">' + sample.filter(i => i >= 0).map((id, k) => cardFace(id, { cls: 'deal', delay: k * 90 })).join('') + '</div>' +
      '<div class="panel p-comp"><span class="label">Computers</span>' +
      '<div class="seg" data-set="opps">' + [1, 2, 3, 4, 5].map(n => '<button aria-pressed="' + (st.opps === n) + '" data-v="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="row"><span class="label grow">Level</span>' + qBtn(strengthNote()) + '</div>' +
      '<div class="seg" data-set="level">' + LEVELS.map(l => '<button aria-pressed="' + (st.level === l) + '" data-v="' + l + '">' + cap(l) + '</button>').join('') + '</div>' +
      '<button class="btn primary" data-go="start" style="width:100%">Start game</button></div>' +
      '<div class="panel"><div class="row"><span class="label grow">With friends</span></div>' +
      '<button class="btn" data-on="open" style="width:100%">Play online</button></div>' +
      (store.last ? '<button class="btn ghost small" data-go="study">Review last game</button>' : '') +
      '</div>';
  }
  function strengthNote() {
    const S = window.EvoStrength;
    if (!S) return 'Easy plays at random, Medium follows simple habits, Hard reads the threats and the food supply.';
    return 'Measured over ' + S.games + ' computer-vs-computer games (' + S.date + '): Hard beats Easy ' + S.hardEasy + ' of the time, Hard beats Medium ' + S.hardMedium + ', Medium beats Easy ' + S.mediumEasy + ' (2 players).' + (S.hardTable4 ? ' At a 4-player table against three Medium computers, Hard wins ' + S.hardTable4 + ' (an even share would be 25%).' : '');
  }

  function renderOnline() {
    const s = net.snap;
    const st = s ? s.status : 'none';
    let body;
    if (net.connecting && st !== 'lobby') body = '<div class="panel"><b>Connecting…</b><p class="muted small" style="margin:0">Talking to the game server.</p></div>';
    else if (st === 'joining') body = '<div class="panel"><b>Joining…</b><p class="muted small" style="margin:0">Waiting for the host to give you a seat.</p></div>';
    else if (st === 'lobby') {
      const host = s.isHost;
      const o = s.options || {};
      const seats = s.seats.map((x, i) => {
        const who = x.kind === 'human' ? esc(x.name || 'Player') + (i === s.mySeat ? ' <span class="muted">(you)</span>' : '') + (x.online ? '' : ' <span class="muted">· away</span>') :
          x.kind === 'computer' ? 'Computer' : '<span class="muted">Open seat</span>';
        let b = '';
        if (host && i !== s.mySeat) b = x.kind === 'empty' ? '<button class="btn small" data-seat="' + i + '" data-kind="computer">Computer</button>' :
          '<button class="btn small ghost" data-seat="' + i + '" data-kind="empty">' + (x.kind === 'human' ? 'Remove' : 'Open') + '</button>';
        return '<div class="seatrow"><span class="dot" style="background:' + COLORS[i % 6] + '"></span><span class="grow">' + who + '</span>' + b + '</div>';
      }).join('');
      body = '<div class="panel" style="align-items:center;gap:4px"><span class="label">Room code</span><div class="code-big">' + esc(s.code) + '</div>' +
        '<p class="muted small" style="margin:0;text-align:center">Friends open this site, tap Play online and type the code.</p></div>' +
        '<div class="panel"><span class="label">Seats</span><div class="seats">' + seats + '</div>' +
        (host ? '<button class="btn primary" data-on="start" style="width:100%"' + (net.connecting ? ' disabled' : '') + '>' + (net.connecting ? 'Starting…' : 'Start') + '</button>' +
          '<p class="muted small" style="margin:0">Open seats become ' + esc(cap(o.level || 'hard')) + ' computers.</p>' :
          '<p class="muted small" style="margin:0">Waiting for the host to start…</p>') + '</div>';
    } else {
      body = '<div class="panel"><span class="label">Your name</span><input class="txt" id="on-name" maxlength="20" autocomplete="off" placeholder="Name" value="' + esc(store.settings.name || '') + '">' +
        '<button class="btn primary" data-on="create" style="width:100%"' + (net.connecting ? ' disabled' : '') + '>New room · ' + (store.settings.opps + 1) + ' seats</button>' +
        '<div class="row"><input class="txt code" id="on-code" maxlength="5" autocomplete="off" autocapitalize="characters" placeholder="CODE"><button class="btn" data-on="join"' + (net.connecting ? ' disabled' : '') + '>Join</button></div>' +
        '<p class="muted small" style="margin:0">Seats and computer level come from the setup screen. Open seats become computers.</p></div>';
    }
    vPlay.innerHTML = '<div class="setup"><div class="row"><button class="btn small ghost" data-on="back">Back</button><span class="label grow" style="text-align:right">Online</span></div>' + body + '</div>';
  }

  vPlay.addEventListener('click', e => {
    const t = e.target;
    const seg = t.closest('[data-set] button');
    if (seg) {
      const k = seg.parentElement.dataset.set; const v = seg.dataset.v;
      store.settings[k] = k === 'opps' ? +v : v; save(); renderPlay(); return;
    }
    const on = t.closest('[data-on]');
    if (on) { onlineBtn(on.dataset.on); return; }
    const seatB = t.closest('[data-seat]');
    if (seatB && net.room) { net.room.setSeat(+seatB.dataset.seat, seatB.dataset.kind).then(r => { if (!r.ok) toast(r.message); }); return; }
    const go = t.closest('[data-go]');
    if (go) { goBtn(go.dataset.go); return; }
    gameClick(e);
  });

  function goBtn(k) {
    if (k === 'start') return startLocal();
    if (k === 'study') return showTab('study', true);
    if (k === 'new') {
      if (table && table.online) { confirmBox('Leave the online room?', 'Leave', leaveOnline); return; }
      return startLocal();
    }
    if (k === 'menu') return openMenu();
    if (k === 'log') return openLog();
    if (k === 'hint') return showHint();
  }
  function startLocal() {
    clearTimeout(ui.botTimer); ui.gen++;
    const st = store.settings;
    const players = [{ name: st.name || 'You', bot: null }];
    for (let i = 0; i < st.opps; i++) players.push({ name: 'Computer ' + (i + 1), bot: st.level });
    const state = E.newGame({ seed: (Math.random() * 4294967296) >>> 0, players, quick: st.quick, stepBots: true });
    store.game = { state, notes: [], level: st.level };
    ME = 0;
    table = new LocalTable(store.game);
    resetSel(); ui.prevLog = 0; ui.hideOver = false; ui.fxFresh = true;
    save();
    renderPlay();
  }

  // ------------------------------------------------------------------ the table
  function curView() { return table.view(); }
  const isLocal = () => table && !table.online;

  function renderGame() {
    const v = curView();
    if (!v || !v.players) { vPlay.innerHTML = '<div class="setup"><div class="panel"><b>Connecting…</b></div></div>'; return; }
    const me = v.players[ME];
    const myTurn = v.toAct.indexOf(ME) >= 0 && !(table.online && net.busy);
    const dv = draftView(v);
    const threat = store.settings.threat ? O.threatMap(v) : [];
    const dangerTo = id => threat.filter(x => x.ok && x.tid === id && x.tp !== x.cp).length;
    const canEat = id => threat.filter(x => x.ok && x.cid === id).length;
    // species as they were on the last drawn table (to turn just-revealed traits over)
    const pv = ui.fxTable === table ? ui.fxPrev : null;
    ui.prevSp = null;
    if (pv && pv.round === v.round && TB && TB.animOn()) { ui.prevSp = {}; pv.players.forEach(pl => pl.species.forEach(sp => { ui.prevSp[sp.id] = sp; })); }

    // --- status
    const phaseTxt = v.over ? 'Game over' : v.phase === 'food' ? 'Pick a food card' : v.phase === 'play' ? 'Play cards' : v.phase === 'feed' ? (v.turn === ME ? 'Your feeding turn' : esc(v.players[v.turn] ? v.players[v.turn].name : '') + ' is feeding') : '';
    const status = '<div class="status"><span class="pill">R' + v.round + (v.lastRound ? ' · last' : '') + '</span>' +
      '<span class="ph grow' + (myTurn && !v.over ? ' me' : '') + '">' + phaseTxt + '</span>' +
      (store.settings.hints && !v.over && myTurn && isLocal() ? '<button class="icon-btn" data-go="hint" aria-label="Hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg></button>' : '') +
      '<button class="icon-btn" id="btn-sheet-log" data-go="log" aria-label="Log"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg></button>' +
      '<button class="icon-btn" data-go="menu" aria-label="Menu"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div>';

    // --- opponents
    const opps = v.players.map((pl, p) => {
      if (p === ME) return '';
      const turn = v.phase === 'feed' && v.turn === p;
      const st = v.phase === 'food' ? (pl.foodPicked ? 'ready' : 'choosing') : v.phase === 'play' ? (pl.done ? 'ready' : 'playing') : '';
      return '<div class="opp' + (turn ? ' turn' : '') + '" data-p="' + p + '"><div class="oh"><span class="plate"><span class="dot" style="background:' + COLORS[p % 6] + '"></span><span class="nmx">' + esc(pl.name) + '</span></span>' +
        (v.first === p ? '<span class="fp" title="Feeds first">1st</span>' : '') +
        '<span class="st">' + st + '</span><span class="grow"></span>' + backsHtml(pl.handSize) + (pl.bag != null ? bagHtml(pl.bag, 'Food bag') : '') + '</div>' +
        '<div class="ospc">' + (pl.species.length ? pl.species.map(sp => miniSp(sp, p, v)).join('') : '<span class="muted small">no species</span>') + '</div></div>';
    }).join('');

    // --- watering hole + odds
    let oddsTxt = '';
    if (store.settings.odds && !v.over && (v.phase === 'food' || v.phase === 'play')) {
      const myF = v.me && v.me.foodCard != null && v.me.foodCard >= 0 ? DECK[v.me.foodCard].food : ui.sel != null && v.phase === 'food' ? DECK[ui.sel].food : 0;
      const fc = O.holeForecast(v, myF);
      const need = O.plantDemand(dv);
      oddsTxt = '<div class="odds">Next <b>~' + fc.mean.toFixed(1) + '</b> <span class="muted">' + fc.lo + '–' + fc.hi + '</span><br>Need <b>' + needAfter(dv) + '</b></div>';
    } else if (store.settings.odds && v.phase === 'feed') {
      oddsTxt = '<div class="odds">Need <b>' + O.plantDemand(v) + '</b></div>';
    }
    const cur = v.hist && v.hist[v.hist.length - 1];
    const placed = v.players.map((pl, p) => (pl.foodPicked ? (v.phase === 'feed' && cur && cur.foodCards ? null : -1) : null));
    // the food cards lie on the watering hole face down; at the reveal they turn over (3-D) one by one
    const prevV = ui.fxTable === table ? ui.fxPrev : null;
    // the food cards turn over one by one when feeding starts; a computer's move that redraws the
    // table mid-reveal keeps the cards that have not turned yet face down, still waiting their turn
    if (v.phase === 'feed' && cur && cur.foodCards && cur.foodCards.length && prevV && prevV.round === v.round && prevV.phase !== 'feed' && TB && TB.animOn())
      ui.reveal = { round: v.round, t0: performance.now() };
    const revAt = k => 160 + k * 150;
    const revEl = ui.reveal && v.phase === 'feed' && ui.reveal.round === v.round ? performance.now() - ui.reveal.t0 : Infinity;
    const revealing = revEl < Infinity && cur && cur.foodCards && cur.foodCards.some((id, k) => revEl < revAt(k));
    const fcards = v.phase === 'feed' && cur && cur.foodCards ? cur.foodCards.map((id, k) => { const down = revEl < revAt(k);
      return cardFace(down ? -1 : id, { style: 'z-index:' + (20 - k), attr: down ? ' data-reveal="' + id + '" data-at="' + Math.round(revAt(k) - revEl) + '"' : '' }); }).join('') : placed.filter(x => x === -1).map((x, k) => cardFace(-1, { style: 'z-index:' + (20 - k) })).join('');
    const hole = '<div class="hole"><div class="deckw"><div id="deck" title="Draw pile" aria-label="Draw pile: ' + v.deckSize + ' cards"></div></div>' +
      '<div class="wh" data-go-hole="1"><div class="pondw">' + A.pond(v.hole) + '<div class="ptoks">' + pondTokens(v.hole) + '</div><div class="hnw"><div class="hn num">' + v.hole + '</div><div class="hl">Food</div></div></div>' +
      '<div class="fcards">' + fcards + '</div>' + oddsTxt + '</div>' +
      '<div class="discw"><div id="discard" title="Discard pile" aria-label="Discard pile: ' + v.discardSize + ' cards"></div></div></div>';

    // --- my species
    const mySp = dv.species;
    const selCard = ui.sel != null && v.phase === 'play' && myTurn;
    const feedMine = v.phase === 'feed' && myTurn;
    const fo = feedMine ? (table.online ? E.feedOptions(rebuildFor(v), ME) : E.feedOptions(table.game.state, ME)) : [];
    const mine = (selCard ? '<button class="newsp can" data-new="L" aria-label="New species on the left">+</button>' : '') +
      mySp.map((sp, i) => bigSp(sp, i, v, { can: (selCard && canPlayOn(sp, ui.sel, ui.mode)) || (feedMine && fo.some(o => o.s === sp.id) && ui.feedSel !== sp.id) || (feedMine && ui.feedSel != null && fo.some(o => o.s === ui.feedSel && o.target === sp.id)), prey: feedMine && ui.feedSel != null && fo.some(o => o.t === 'attack' && o.s === ui.feedSel && o.target === sp.id), sel: ui.feedSel === sp.id, tgt: ui.target === sp.id, danger: dangerTo(sp.id), eats: canEat(sp.id), flip: flipped(sp) })).join('') +
      (selCard ? '<button class="newsp can" data-new="R" aria-label="New species on the right">+</button>' : '') +
      (!mySp.length && !selCard ? '<span class="muted small" style="margin:auto">No species. Play a card as a new species.</span>' : '') +
      '<div class="side-bits">' + (v.first === ME ? '<span class="fp" title="You feed first">1st</span>' : '') + (v.me && v.me.bag != null ? bagHtml(v.me.bag, 'Your food bag') : '') + '</div>';

    // --- hand
    const handCards = dv.hand.map((id, k) => cardFace(id, { style: '--z:' + (dv.hand.length - k), cls: (ui.sel === id || (ui.needCard && ui.needCard.cards && ui.needCard.cards.indexOf(id) >= 0) ? 'sel is-up ' : ''), attr: ' data-card="' + id + '"' }));
    const hand = TB ? '' : handCards.join('');

    // --- actions
    const acts = actionBar(v, myTurn, fo, dv);

    // --- side panel (laptop)
    const side = '<div id="g-side"><div class="panel threatbox"><div class="row"><span class="label grow">Who can eat whom</span>' + qBtn('Each line is a carnivore that can attack right now, as the table looks. Face-down traits are not counted until they are revealed.') + '</div><div class="scroll" style="margin-top:6px">' + threatTable(v, threat) + '</div></div>' +
      '<div class="panel logbox"><span class="label">Log</span><div class="scroll" style="margin-top:6px">' + logHtml(v) + '</div></div></div>';

    // my planned (not yet sent) plays survive a reload
    if (isLocal()) {
      const d = v.phase === 'play' && ui.draft.length ? { r: v.round, moves: ui.draft } : null;
      if (JSON.stringify(d) !== JSON.stringify(store.game.draft || null)) { store.game.draft = d; save(); }
    }
    const fitKey = innerWidth + 'x' + innerHeight + ':' + v.players.length;
    if (!ui.fit || ui.fit.key !== fitKey) ui.fit = { key: fitKey, tight: false };
    vPlay.innerHTML = '<div id="game" class="' + (v.players.length >= 4 ? 'crowd' : '') + (ui.fit.tight ? ' tight' : '') + '">' + status + '<div class="opps' + (v.players.length >= 4 ? ' many' : '') + '">' + opps + '</div>' + hole + '<div class="mine" id="mine">' + mine + '</div>' +
      '<div class="hand" id="hand">' + hand + '</div><div class="acts">' + acts + '</div>' + side + '</div>' + (v.over && !ui.hideOver ? overPanel(v) : '');
    fitTable(v);
    layTable(v, handCards, revealing);
    afterRender(v);
    fxStep(v);
  }
  // a small phone that can't show every opponent: switch the whole table a size smaller (same frame, no
  // flicker) and keep it that way for this screen size and table, so nothing shrinks and grows back
  function fitTable(v) {
    const g = $('#game'), o = g && g.querySelector('.opps');
    if (!o) return;
    if (!ui.fit.tight && innerWidth < 900 && o.scrollHeight > o.clientHeight + 1) { ui.fit.tight = true; g.classList.add('tight'); }
    zoomTable(v, g);
  }
  // fill the table: the opponents' places, my boards and my hand grow (same look, bigger) into
  // whatever wood is left empty, as large as still fits without scrolling. The size is kept until
  // the screen or the table's contents change (never on a tap), so nothing jumps while you play.
  function zoomTable(v, g) {
    const o = g.querySelector('.opps'), mine = g.querySelector('.mine'), hand = g.querySelector('.hand');
    const desk = innerWidth >= 900;
    const screen = ui.fit.key + (ui.fit.tight ? 't' : '');
    // a new search only when the screen or the number of species changes (each try costs a layout pass);
    // otherwise the last size stays, with one check that it still fits
    const key = screen + '|' + (v.over ? 'o' : '') + '|' + v.players.map(pl => pl.species.length).join(',');
    const set = z => { o.style.zoom = z.o; mine.style.zoom = z.m; hand.style.zoom = z.h; };
    // room the hand needs: one card held up plus its tilt (empty hands keep the same room)
    const probe = document.createElement('i'); probe.className = 'tc'; hand.appendChild(probe);
    const cw = parseFloat(getComputedStyle(probe).getPropertyValue('--card-w')) || 60; probe.remove();
    const handNeed = h => (cw * 88 / 63 + 26) * h;
    // room for the + buttons that appear beside my boards while placing cards (kept all round, so my
    // boards don't change size between the phases)
    const plusRoom = v.over ? 0 : 2 * 52;
    // a bigger table must never cut a player's name that fits at normal size
    const cutNames = () => [...o.querySelectorAll('.nmx')].map(n => n.scrollWidth > n.clientWidth + 1);
    let cut0 = ui.zoom && ui.zoom.key === key && ui.zoom.cut0;
    if (!cut0) { set({ o: 1, m: 1, h: 1 }); cut0 = cutNames(); }
    const ok = (z, loose) => {
      set(z);
      if (cutNames().some((c, i) => c && !cut0[i])) return false;
      if (g.scrollHeight > g.clientHeight + 1) return false;
      if (o.scrollHeight > o.clientHeight + 2 || o.scrollWidth > o.clientWidth + 2) return false;
      for (const s of o.querySelectorAll('.ospc')) if (s.scrollWidth > s.clientWidth + 2) return false;
      if (mine.scrollHeight > mine.clientHeight + 1) return false;
      if (z.m > 1 && !loose) { // (loose: my own planned new boards may slide sideways rather than shrink the table on a tap)
        const kids = [...mine.children].filter(k => k.offsetWidth), mr = mine.getBoundingClientRect();
        if (kids.length) {
          const w = kids[kids.length - 1].getBoundingClientRect().right - kids[0].getBoundingClientRect().left;
          if (w + plusRoom * z.m > mr.width - 4) return false;
        }
      }
      if (desk) { const hole = g.querySelector('.hole'), wh = hole && hole.querySelector('.wh'); return !wh || hole.getBoundingClientRect().height >= wh.getBoundingClientRect().height + 4; }
      // the hand's box is its grid row (the fan sets its own height later): it must hold a held card
      return hand.getBoundingClientRect().height >= handNeed(z.h) - 1;
    };
    const caps = desk ? { o: 1.6, m: 1.25, h: 1 } : { o: 1.7, m: 1.35, h: 1.3 };
    const prevH = hand.style.minHeight;
    if (!desk) { hand.style.height = ''; hand.style.minHeight = '0px'; hand.style.alignSelf = 'stretch'; } // measure the row, not the last fan
    const last = ui.zoom && ui.zoom.screen === screen ? { o: ui.zoom.o, m: ui.zoom.m, h: ui.zoom.h } : null;
    const lastOk = !!last && ok(last, ui.zoom.key === key);
    let best = lastOk ? last : { o: 1, m: 1, h: 1 };
    ui.zoomSearches = ui.zoomSearches || 0;
    if (!(lastOk && ui.zoom.key === key) && (lastOk || ok(best))) {
      ui.zoomSearches++;
      // largest size that still fits, found by halving: first all three together, then whatever room
      // is left goes to each part alone (the opponents' pieces first)
      const q = x => Math.round(x * 20) / 20;
      const search = (mk, lo, hi, tries) => {
        for (let n = 0; n < tries && q(hi) - q(lo) > 0.04; n++) {
          const mid = q((lo + hi) / 2) > q(lo) ? q((lo + hi) / 2) : q(lo) + 0.05;
          if (ok(mk(mid))) { lo = mid; best = mk(mid); } else hi = mid - 0.05;
        }
      };
      const b0 = best;
      search(x => ({ o: Math.max(b0.o, Math.min(x, caps.o)), m: Math.max(b0.m, Math.min(x, caps.m)), h: Math.max(b0.h, Math.min(x, caps.h)) }), Math.min(b0.o, b0.m, b0.h), Math.max(caps.o, caps.m, caps.h), 4);
      for (const [k, n] of [['o', 3], ['m', 1], ['h', 1]]) { const b1 = best; search(x => Object.assign({}, b1, { [k]: x }), best[k], caps[k], n); }
    }
    hand.style.minHeight = prevH; hand.style.alignSelf = '';
    best = { o: +best.o.toFixed(2), m: +best.m.toFixed(2), h: +best.h.toFixed(2) };
    ui.zoom = Object.assign({ key, screen, cut0 }, best);
    set(best);
  }
  // the physical bits: deck thickness, the messy discard pile, the held fan, flips at the reveal
  function layTable(v, handCards, revealing) {
    if (!TB) return;
    TB.deck($('#deck'), v.deckSize, { cls: 'evo-back', perCard: 0.08, max: 9 });
    TB.pile($('#discard'), discardCards(v), { seed: 'evo-discard', max: 4, rot: 13, off: 3 });
    if (ui.fan && ui.fan.disconnect) ui.fan.disconnect();
    const hb = $('#hand');
    // the redrawn hand goes straight to its place (no slide in from the left edge on every tap)
    hb.classList.add('settle');
    ui.fan = TB.fan(hb, handCards, { pick: false, spread: 0.8, lift: 14, maxRot: 8, minHeight: 60 });
    // a huge hand (a hoarder's 25-40 cards): held wider than the screen and slid sideways, so every card
    // keeps a strip you can tap, instead of squeezing them into slivers
    const cs = ui.fan && ui.fan.cards;
    if (cs && cs.length > 1) {
      const cw = cs[0].offsetWidth, step = parseFloat(cs[1].style.getPropertyValue('--x')) - parseFloat(cs[0].style.getPropertyValue('--x'));
      const MIN = 16;
      if (step < MIN) {
        if (ui.fan.disconnect) ui.fan.disconnect();
        hb.classList.remove('tbl-fan'); hb.classList.add('wide'); hb.innerHTML = '<div class="fanrow"></div>';
        const row = hb.firstChild;
        row.style.width = Math.ceil(cw + MIN * (cs.length - 1) + 24) + 'px';
        ui.fan = TB.fan(row, handCards, { pick: false, spread: 0.8, lift: 14, maxRot: 3, minHeight: 60 });
        // the hand stays slid where you left it when the table redraws (tapping a card never moves it)
        hb.scrollLeft = ui.handScroll || 0;
        hb.addEventListener('scroll', () => { ui.handScroll = hb.scrollLeft; }, { passive: true });
      }
    }
    void hb.offsetWidth; hb.classList.remove('settle');
    if (revealing) document.querySelectorAll('.hole .fcards [data-reveal]').forEach(el => turnOver(el, +el.dataset.reveal, +el.dataset.at));
  }
  // the newest discards we know (food cards of earlier rounds), face up
  function discardCards(v) {
    if (!v.discardSize) return [];
    const cur = v.hist && v.hist[v.hist.length - 1];
    const ids = [];
    (v.hist || []).forEach(h => { if (v.phase === 'feed' && h === cur) return; (h.foodCards || []).forEach(id => ids.push(id)); });
    return ids.slice(-Math.min(4, v.discardSize)).map(id => cardFace(id)); // never more cards than the pile holds
  }
  // plant food tokens heaped in the pond (up to 14 drawn; the number says the rest)
  function pondTokens(n) {
    let out = '';
    for (let i = 0; i < Math.min(n, 22); i++) {
      const a = i * 2.39996, r = Math.sqrt(i + 0.5) / Math.sqrt(22.5);
      out += '<i class="ftk" style="left:' + (50 + Math.cos(a) * r * 36).toFixed(1) + '%;top:' + (52 + Math.sin(a) * r * 30).toFixed(1) + '%"></i>';
    }
    return out;
  }
  // a player's hand seen from across the table: a small fan of card backs and the count
  function backsHtml(n) {
    const k = Math.min(n, 5);
    let out = '';
    for (let i = 0; i < k; i++) out += '<i style="--r:' + (k > 1 ? (-14 + 28 * i / (k - 1)) : 0).toFixed(0) + 'deg"></i>';
    return '<span class="ohand" title="Cards in hand" aria-label="' + n + ' cards in hand">' + out + '<b>' + n + '</b></span>';
  }
  // the cloth food bag (1 point per food inside)
  function bagHtml(n, label) {
    return '<span class="bag" title="' + label + '" aria-label="' + label + ': ' + n + '"><svg viewBox="0 0 20 22" aria-hidden="true"><path d="M6.5 5.2C5.6 3 7 1.6 10 1.6s4.4 1.4 3.5 3.6c4 2 6 6 6 9.4 0 4.6-4.3 6-9.5 6S.5 19.2.5 14.6c0-3.4 2-7.4 6-9.4z" fill="#b48d58" stroke="#5a4220" stroke-width="1"/>' +
      '<path d="M6.3 5.6c2.4.9 5 .9 7.4 0" stroke="#5a4220" stroke-width="1.3" fill="none"/><path d="M4 12c1-2 2-3 3-3.6M15 11c-.5-1.5-1.3-2.4-2.2-3" stroke="rgba(255,240,210,.35)" stroke-width="1" fill="none"/></svg><b>' + n + '</b></span>';
  }
  // what changed since the last drawn table -> sounds + animations (computers and online players too)
  function fxStep(v) {
    const fresh = !!ui.fxFresh; ui.fxFresh = false;
    const prev = ui.fxTable === table ? ui.fxPrev : null;
    ui.fxTable = table; ui.fxPrev = v;
    if (!FXL || !GFX) return;
    const ev = GFX.diff(prev, v, ME, { fresh, colors: COLORS });
    if (ev.length) GFX.perform(ev, FXL, fxEnv);
  }
  function needAfter(dv) { return O.plantDemand(dv); }

  // the board as it will look with my planned (not yet sent) plays
  function draftView(v) {
    const me = v.players[ME];
    const out = { hand: v.me ? v.me.hand.slice() : [], species: E.clone(me.species), players: null };
    if (v.phase === 'play' && v.me && v.me.foodCard != null) {
      // my food card already left my hand
    }
    if (v.phase === 'food' && v.me) { /* hand as is */ }
    let made = 0;
    for (const m of ui.draft) {
      if (m.t === 'drop') { const sp = out.species.find(x => x.id === m.s); if (sp) { sp.traits = sp.traits.filter(x => x !== m.card); sp.hidden = sp.hidden.filter(x => x !== m.card); } continue; }
      const k = out.hand.indexOf(m.card);
      if (k < 0) continue;
      out.hand.splice(k, 1);
      if (m.t === 'species') { made++; const ns = { id: -made, body: 1, pop: 1, food: 0, fat: 0, traits: [], hidden: [], fresh: true }; if (m.side === 'L') out.species.unshift(ns); else out.species.push(ns); continue; }
      const sp = out.species.find(x => x.id === m.s);
      if (!sp) continue;
      if (m.t === 'body') { sp.body++; sp.bumpB = true; } else if (m.t === 'pop') { sp.pop++; sp.bumpP = true; } else if (m.t === 'trait') { sp.hidden.push(m.card); }
    }
    out.players = v.players.map((pl, p) => (p === ME ? Object.assign({}, pl, { species: out.species }) : pl));
    return out;
  }
  function canPlayOn(sp, card, mode) {
    if (mode === 'body') return sp.body < E.MAX;
    if (mode === 'pop') return sp.pop < E.MAX;
    const list = sp.traits.concat(sp.hidden);
    return list.length < curMax() && !list.some(id => id >= 0 && T(id) === T(card));
  }
  function curMax() { try { return curView().maxTraits || 3; } catch (e) { return 3; } }
  // rebuild a minimal engine-like state from a view (online: for option lists on my own turn)
  function rebuildFor(v) {
    return { hole: v.hole, players: v.players.map((pl, p) => ({ hand: p === ME && v.me ? v.me.hand.slice() : new Array(pl.handSize).fill(0), species: pl.species.map(sp => Object.assign({}, sp, { hidden: [] })) })) };
  }

  function bigSp(sp, i, v, o) {
    const carn = sp.traits.some(id => T(id) === 'Carnivore');
    const fatT = sp.traits.some(id => T(id) === 'Fat Tissue');
    let slots = '';
    for (let k = 0; k < sp.pop; k++) slots += k < sp.food ? '<i class="ftk' + (carn ? ' meat' : '') + '"></i>' : '<span class="slot"></span>';
    if (fatT) for (let k = 0; k < sp.body; k++) slots += k < sp.fat ? '<i class="ftk fat"></i>' : '<span class="slot fatslot"></span>';
    const nTr = sp.traits.length + sp.hidden.length;
    const trs = sp.traits.map(id => traitChip(id, false, o.flip)).concat(sp.hidden.map(id => traitChip(id, true))).join('') +
      '<div class="tr empty"></div>'.repeat(Math.max(0, Math.min(3, v.maxTraits || 3) - nTr)); // open trait slots
    const cls = ['sp', carn ? 'carnivore' : '', o.can ? 'can' : '', o.prey && !o.tgt ? 'prey' : '', o.sel ? 'sel' : '', o.tgt ? 'sel tgt' : '', sp.food >= sp.pop && v.phase === 'feed' ? 'fed' : '', sp.fresh ? 'popin' : ''].join(' ');
    return '<div class="' + cls + '" data-sp="' + sp.id + '">' +
      (o.danger && store.settings.threat ? '<span class="flag danger" title="Carnivores that can eat it">' + o.danger + '</span>' : '') +
      (o.eats && store.settings.threat ? '<span class="flag carn" title="Species it can eat">' + o.eats + '</span>' : '') +
      '<div class="trs">' + trs + '</div><div class="board"><div class="fr">' + slots + '</div>' + track('Body', 'b', sp.body) + track('Pop', 'p', sp.pop) + '</div></div>';
  }
  // traits of this species that were face down on the last drawn table and are face up now
  function flipped(sp) {
    const a = ui.prevSp && ui.prevSp[sp.id];
    if (!a || !a.hidden.length) return [];
    return sp.traits.filter(id => a.traits.indexOf(id) < 0);
  }
  // a 1-6 track printed on the board with a wooden cube on the current space
  function track(label, k, n) {
    let cells = '';
    for (let i = 1; i <= 6; i++) cells += i === n ? '<i class="on"><b class="cube ' + k + '">' + i + '</b></i>' : '<i>' + i + '</i>';
    return '<div class="trk" aria-label="' + label + ' ' + n + '"><span class="tl">' + label + '</span>' + cells + '</div>';
  }
  // a trait card tucked above a board (only its top shows); flip = it just turned face up
  function traitChip(id, fresh, flip) {
    if (id < 0) return '<div class="tr hid"><span>face down</span></div>';
    const t = T(id);
    const k = flip ? flip.indexOf(id) : -1;
    return '<div class="tr' + (fresh ? ' new' : '') + (k >= 0 ? ' flipin' : '') + '" style="' + famStyle(t) + (k >= 0 ? ';animation-delay:' + (200 + k * 120) + 'ms' : '') + '">' + A.icon(t) + '<span>' + tName(t) + '</span></div>';
  }
  function miniSp(sp, p, v) {
    const carn = sp.traits.some(id => T(id) === 'Carnivore');
    const fatT = sp.traits.some(id => T(id) === 'Fat Tissue');
    let dots = '';
    for (let k = 0; k < sp.pop; k++) dots += '<i class="' + (k < sp.food ? 'on' + (carn ? ' meat' : '') : '') + '"></i>';
    if (fatT) for (let k = 0; k < sp.fat; k++) dots += '<i class="fat"></i>';
    const flip = flipped(sp);
    const ics = sp.traits.map(id => '<span class="ic' + (flip.indexOf(id) >= 0 ? ' flipin' : '') + '" style="' + famStyle(T(id)) + '" title="' + esc(T(id)) + '">' + A.icon(T(id)) + '</span>').join('') + sp.hidden.map(() => '<span class="hidden" title="Face down"></span>').join('');
    const can = ui.feedSel != null && v.phase === 'feed' && v.turn === ME && isTarget(sp.id);
    return '<div class="msp' + (carn ? ' carnivore' : '') + (can ? ' can' : '') + (ui.target === sp.id ? ' tgt' : '') + '" data-sp="' + sp.id + '" data-owner="' + p + '"><div class="ics">' + ics + '</div>' +
      '<div class="mb"><div class="bp" aria-label="Body ' + sp.body + ', population ' + sp.pop + '"><b class="cube b">' + sp.body + '</b><b class="cube p">' + sp.pop + '</b></div><div class="fdots">' + dots + '</div></div></div>';
  }
  function isTarget(id) {
    const v = curView();
    const fo = table.online ? E.feedOptions(rebuildFor(v), ME) : E.feedOptions(table.game.state, ME);
    return fo.some(o => o.t === 'attack' && o.s === ui.feedSel && o.target === id);
  }

  function actionBar(v, myTurn, fo, dv) {
    if (v.over) return '<button class="btn" data-go="study">Study</button><button class="btn primary" data-go="new">New game</button>';
    if (table.online && net.busy) return '<span class="msg">Sending…</span>';
    if (!myTurn) {
      const who = v.toAct.filter(p => p !== ME).map(p => v.players[p].name);
      if (v.phase === 'play' && !v.quick && who.length) return '<span class="msg"><b>' + esc(who[0]) + '</b> is playing cards…</span>';
      return '<span class="msg">Waiting for <b>' + esc(who.slice(0, 2).join(', ') || 'the table') + (who.length > 2 ? ' +' + (who.length - 2) : '') + '</b>…</span>';
    }
    if (v.phase === 'food') {
      // no cards at all (the deck and the discards ran dry): nothing to place, the round goes on
      if (!dv.hand.length) return '<span class="msg"><b>No cards</b> to place as food.</span><button class="btn primary" data-act="nofood">Go on</button>';
      if (ui.sel == null) return '<span class="msg"><b>Pick a food card.</b> Its number goes into the watering hole.</span>';
      const f = DECK[ui.sel].food;
      return '<span class="msg">Adds <b>' + fmtFood(f) + '</b> plant food</span><button class="btn primary" data-act="food">Use as food</button>';
    }
    if (v.phase === 'play') {
      const n = ui.draft.length;
      if (ui.sel != null) {
        return '<div class="seg grow" data-mode>' + [['trait', 'Trait'], ['body', 'Body +1'], ['pop', 'Pop +1']].map(([k, l]) => '<button aria-pressed="' + (ui.mode === k) + '" data-mode="' + k + '">' + l + '</button>').join('') + '</div>';
      }
      return (n ? '<button class="btn" data-act="undo">Undo</button>' : '<span class="msg">Tap a card, then a species. <b>+</b> makes a new one.</span>') +
        '<button class="btn primary" data-act="done">' + (n ? 'Done (' + n + ')' : 'Done') + '</button>';
    }
    if (v.phase === 'feed') {
      const canPass = !fo.some(o => o.must); // same rule as the engine's canPass (works online too)
      if (ui.needCard) {
        const n = ui.needCard;
        const left = n.t === 'intel' ? 1 : n.ignore.length - n.cards.length;
        return '<span class="msg"><b>Pick ' + left + ' card' + (left > 1 ? 's' : '') + ' to discard</b>' + (n.t === 'attack' ? ' (Intelligence: ' + esc(n.ignore.join(' + ')) + ')' : '') + '</span><button class="btn" data-act="cancel">Cancel</button>';
      }
      if (ui.feedSel == null) return '<span class="msg"><b>Tap a species</b> to feed it.' + (canPass ? '' : ' You must feed.') + '</span>' + (canPass ? '<button class="btn" data-act="pass">Pass</button>' : '');
      const sp = dv.species.find(x => x.id === ui.feedSel);
      const opts = fo.filter(o => o.s === ui.feedSel);
      const btns = [];
      const eat = opts.find(o => o.t === 'eat');
      if (eat) btns.push('<button class="btn primary" data-act="eat">Eat ' + Math.min(sp && sp.traits.some(id => T(id) === 'Foraging') ? 2 : 1, v.hole) + '</button>');
      const intel = opts.find(o => o.t === 'intel');
      if (intel) btns.push('<button class="btn" data-act="intel">Smart +2</button>');
      if (opts.some(o => o.t === 'attack')) {
        if (ui.target == null) return '<span class="msg"><b>Tap a species to attack.</b> Outlined = can be eaten.</span><button class="btn" data-act="cancel">Cancel</button>';
        const att = opts.find(o => o.target === ui.target);
        const tl = findInView(v, ui.target);
        return '<span class="msg">Eat <b>' + (tl ? tl.sp.body : '?') + ' meat</b>' + (att && att.ignore.length ? ' · costs ' + att.ignore.length + ' card' + (att.ignore.length > 1 ? 's' : '') : '') + (tl && tl.sp.traits.some(id => T(id) === 'Horns') && !(att && att.ignore.indexOf('Horns') >= 0) ? ' · Horns: −1 pop' : '') + '</span>' +
          '<button class="btn" data-act="cancel">Cancel</button><button class="btn red" data-act="attack">Attack</button>';
      }
      return btns.join('') + '<button class="btn" data-act="cancel">Cancel</button>';
    }
    return '';
  }
  function findInView(v, id) {
    for (let p = 0; p < v.players.length; p++) { const sp = v.players[p].species.find(x => x.id === id); if (sp) return { p, sp }; }
    return null;
  }

  function threatTable(v, threat) {
    const rows = threat.filter(x => x.ok);
    if (!rows.length) return '<p class="muted small" style="margin:0">No carnivore can attack anything right now.</p>';
    return '<table class="tm"><tr><th>Carnivore</th><th>can eat</th></tr>' + rows.map(x => {
      const C = v.players[x.cp].species[x.ci], Tg = v.players[x.tp].species[x.ti];
      const nm = p => (p === ME ? 'You' : esc(v.players[p].name));
      return '<tr><td><span class="dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + COLORS[x.cp % 6] + '"></span> ' + nm(x.cp) + ' ' + C.body + '/' + C.pop + '</td><td' + (x.tp === ME ? ' style="color:var(--bad)"' : '') + '>' + nm(x.tp) + ' ' + Tg.body + '/' + Tg.pop + ' → ' + Tg.body + ' meat</td></tr>';
    }).join('') + '</table>';
  }
  function logHtml(v) {
    const items = v.log.slice(-60).reverse();
    return '<ul class="log">' + items.map(l => '<li class="' + (l.p === ME ? 'me' : '') + '"><span class="r">R' + l.r + '</span>' + esc(l.t.replace(/^You’s/, 'Your').replace(/ You’s /g, ' your ').replace(/^You (play|pass|eat|use)(e?s)\b/, 'You $1')) + '</li>').join('') + '</ul>';
  }
  function openLog() { const v = curView(); sheet('Log', logHtml(v) + (store.settings.threat ? '<div class="label" style="margin-top:12px">Who can eat whom</div>' + threatTable(v, O.threatMap(v)) : '')); }

  function overPanel(v) {
    const r = v.result;
    if (!r) return '';
    const rows = v.players.map((pl, p) => ({ p, pl, sc: r.scores[p] })).sort((a, b) => b.sc.total - a.sc.total);
    return '<div class="confirm-back" id="over"><div class="panel" style="max-width:420px"><div class="row"><b class="grow" style="font-size:18px">' +
      (r.winners.indexOf(ME) >= 0 ? (r.winners.length > 1 ? 'Shared win!' : 'You win!') : r.winners.length > 1 ? r.winners.map(p => esc(v.players[p].name)).join(' and ') + ' share the win' : esc(v.players[r.winners[0]].name) + ' wins') + '</b></div>' +
      '<table class="turns" style="margin:10px 0"><tr><th>Player</th><th>Food</th><th>Pop</th><th>Traits</th><th>Total</th></tr>' +
      rows.map(x => '<tr' + (r.winners.indexOf(x.p) >= 0 ? ' class="win"' : '') + '><td>' + esc(x.p === ME ? 'You' : x.pl.name) + '</td><td class="n">' + x.sc.food + '</td><td class="n">' + x.sc.pop + '</td><td class="n">' + x.sc.traits + '</td><td><b data-tot="' + x.sc.total + '">' + x.sc.total + '</b></td></tr>').join('') +
      '</table><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-go="study">Study</button><button class="btn primary" data-go="new">New game</button></div></div></div>';
  }

  function afterRender(v) {
    // computer feeding turns on this device: one every ~0.7 s so you can follow them
    clearTimeout(ui.botTimer);
    if (isLocal() && !v.over && !document.hidden) {
      const s = table.game.state;
      const bots = E.toAct(s).filter(p => s.players[p].bot);
      if (bots.length) {
        const gen = ui.gen;
        const ms = { slow: 1200, normal: 700, fast: 250 }[store.settings.speed] || 700;
        ui.botTimer = setTimeout(() => {
          if (gen !== ui.gen || !isLocal()) return;
          const st = table.game.state;
          const b = E.toAct(st).filter(p => st.players[p].bot)[0];
          if (b == null) return;
          table.game.state = E.apply(st, b, B.decide(st, b, st.players[b].bot));
          save();
          if (ui.tab === 'play') renderPlay();
        }, ms);
      }
    }
    if (v.over) markOver(v);
    // new log lines from other players flash briefly in the status line (they also stay in the log)
    ui.prevLog = v.log.length;
  }
  function markOver(v) {
    if (isLocal() && store.game && !store.game.saved) {
      store.game.saved = true;
      store.last = { view: E.view(table.game.state, ME), notes: store.game.notes.slice(), level: store.game.level };
      save();
    }
  }

  // ------------------------------------------------------------------ game clicks
  function gameClick(e) {
    const t = e.target;
    if (!table) return;
    const v = curView();
    const myTurn = v.toAct.indexOf(ME) >= 0 && !(table.online && net.busy);
    if (t.id === 'over') { ui.hideOver = true; renderPlay(); return; }
    if (t.closest('[data-go-hole]')) { holeSheet(v); return; }
    const actB = t.closest('[data-act]');
    if (actB) { if (Date.now() < (ui.tapLock || 0)) return; doAct(actB.dataset.act, v); return; }
    const modeB = t.closest('[data-mode] button[data-mode]');
    if (modeB) { ui.mode = modeB.dataset.mode; renderPlay(); return; }
    const card = t.closest('[data-card]');
    if (card) {
      const id = +card.dataset.card;
      if (ui.needCard && myTurn) { pickDiscard(id); return; }
      if (!myTurn || (v.phase !== 'food' && v.phase !== 'play')) { cardSheet(id); return; }
      ui.sel = ui.sel === id ? null : id;
      if (v.phase === 'play' && ui.sel != null) ui.mode = 'trait';
      sfx('click');
      renderPlay(); return;
    }
    const nw = t.closest('[data-new]');
    if (nw && ui.sel != null) {
      // a new species board goes down on the table
      fxFly($('#hand [data-card="' + ui.sel + '"]'), nw); sfx('place');
      ui.draft.push({ t: 'species', card: ui.sel, side: nw.dataset.new }); ui.sel = null; renderPlay(); return;
    }
    const spEl = t.closest('[data-sp]');
    if (spEl) {
      const id = +spEl.dataset.sp;
      const owner = spEl.dataset.owner != null ? +spEl.dataset.owner : ME;
      if (v.phase === 'play' && myTurn && ui.sel != null && owner === ME) {
        const dv = draftView(v);
        const sp = dv.species.find(x => x.id === id);
        if (!sp) return;
        if (!canPlayOn(sp, ui.sel, ui.mode)) { sfx('error'); if (FXL) FXL.shake(spEl); toast(ui.mode === 'trait' ? (sp.traits.length + sp.hidden.length >= curMax() ? 'At most ' + curMax() + ' traits per species' : 'It already has that trait') : 'Already at 6'); return; }
        // trait: tucked face down under the board; body / population: the board grows
        const mode = ui.mode;
        sfx(mode === 'trait' ? 'tuck' : 'grow', mode === 'body' ? { pitch: 0.85 } : undefined);
        fxFly($('#hand [data-card="' + ui.sel + '"]'), spEl).then(() => { const el = $('#mine [data-sp="' + id + '"]'); if (el && FXL) FXL.pop(el); });
        ui.draft.push({ t: mode, card: ui.sel, s: id }); ui.sel = null; renderPlay(); return;
      }
      if (v.phase === 'play' && myTurn && ui.sel == null && owner === ME) { dropSheet(v, id); return; }
      if (v.phase === 'feed' && myTurn) {
        const fo = table.online ? E.feedOptions(rebuildFor(v), ME) : E.feedOptions(table.game.state, ME);
        if (ui.feedSel != null && fo.some(o => o.s === ui.feedSel && o.t === 'attack' && o.target === id)) { ui.target = id; renderPlay(); return; }
        if (owner === ME && fo.some(o => o.s === id)) {
          ui.feedSel = id; ui.target = null;
          const opts = fo.filter(o => o.s === id);
          // a plant eater with only one way to eat: eat right away (one tap)
          if (opts.length === 1 && opts[0].t === 'eat') { send({ t: 'eat', s: id }); return; }
          renderPlay(); return;
        }
      }
      speciesSheet(v, id); return;
    }
  }
  function dropSheet(v, id) {
    const sp = draftView(v).species.find(x => x.id === id);
    if (!sp || !(sp.traits.length + sp.hidden.length)) { speciesSheet(v, id); return; }
    sheet('Discard a trait?', '<p class="muted small" style="margin-top:0">Free during your turn, to make room for a new one.</p><div class="choices">' +
      sp.traits.concat(sp.hidden).map(c => '<button class="btn" data-drop="' + c + '">Discard ' + esc(T(c)) + '</button>').join('') + '</div>', e => {
      const b = e.target.closest('[data-drop]');
      if (!b) return;
      closeSheet(); sfx('cardSlide'); ui.draft.push({ t: 'drop', s: id, card: +b.dataset.drop }); renderPlay();
    });
  }
  function doAct(k, v) {
    if (k === 'food' && ui.sel != null) {
      // my food card slides face down to the watering hole
      const c = ui.sel; ui.sel = null;
      sfx('cardSlide'); fxFly($('#hand [data-card="' + c + '"]'), $('.hole .fcards') || $('.hole'));
      send({ t: 'food', card: c }); return;
    }
    if (k === 'nofood') { send({ t: 'food' }); return; }
    if (k === 'undo') { if (ui.draft.length) sfx('cardSlide', { pitch: 0.8 }); ui.draft.pop(); renderPlay(); return; }
    if (k === 'done') {
      const moves = ui.draft.slice();
      ui.draft = []; ui.sel = null;
      send({ t: 'play', moves }); return;
    }
    if (k === 'pass') { send({ t: 'pass' }); return; }
    if (k === 'cancel') { ui.feedSel = null; ui.target = null; ui.needCard = null; ui.sel = null; renderPlay(); return; }
    if (k === 'eat') { send({ t: 'eat', s: ui.feedSel }); return; }
    if (k === 'intel') { ui.needCard = { t: 'intel', s: ui.feedSel }; renderPlay(); return; }
    if (k === 'attack') {
      const fo = table.online ? E.feedOptions(rebuildFor(v), ME) : E.feedOptions(table.game.state, ME);
      const o = fo.find(x => x.t === 'attack' && x.s === ui.feedSel && x.target === ui.target);
      if (!o) return;
      if (o.ignore.length) { ui.needCard = { t: 'attack', s: o.s, target: o.target, ignore: o.ignore, cards: [] }; renderPlay(); return; }
      send({ t: 'attack', s: ui.feedSel, target: ui.target }); return;
    }
  }
  // Intelligence: collect the cards to discard (1 for food, one per switched-off trait for an attack)
  function pickDiscard(card) {
    const n = ui.needCard;
    if (n.t === 'intel') { send({ t: 'intel', s: n.s, card }); return; }
    if (n.cards.indexOf(card) >= 0) n.cards = n.cards.filter(c => c !== card); else n.cards.push(card);
    if (n.cards.length >= n.ignore.length) { send({ t: 'attack', s: n.s, target: n.target, ignore: n.ignore, cards: n.cards.slice() }); return; }
    renderPlay();
  }
  function send(action) {
    try {
      ui.gen++; ui.tapLock = Date.now() + 450;
      table.act(action);
      resetSel();
    } catch (err) { sfx('error'); toast(err.message || 'That move isn’t allowed'); resetSel(); }
    renderPlay(); // the bite (snap + shake on the prey) comes from fxStep, the same for every player's attacks
  }

  function showHint() {
    if (!isLocal()) return;
    const s = table.game.state;
    const a = B.decide(s, ME, 'hard');
    if (s.phase === 'food') { ui.sel = a.card; renderPlay(); toast('Hard computer would feed with ' + T(a.card) + ' (' + fmtFood(DECK[a.card].food) + ')'); return; }
    if (s.phase === 'play') {
      sheet('Hard computer’s plan', a.moves.length ? '<ul class="log">' + a.moves.map(m => '<li class="me">' + esc(describeMove(s, m)) + (m.s != null && m.t !== 'species' ? ' · on ' + spName(s, m.s < 0 ? -1 : m.s) : '') + '</li>').join('') + '</ul>' : '<p class="muted">Keep your cards this round.</p>');
      return;
    }
    toast('Hard computer: ' + describe(s, a).replace(/<[^>]+>/g, ''));
    if (a.s != null) { ui.feedSel = a.s; ui.target = a.target != null ? a.target : null; renderPlay(); }
  }

  function openMenu() {
    const online = table && table.online;
    sheet('Game', '<div class="choices">' +
      '<button class="btn" data-m="rules">How to play</button>' +
      (online ? '<button class="btn" data-m="leave">Leave the room</button>' : '<button class="btn" data-m="new">New game</button>') +
      (!online ? '<button class="btn" data-m="quit">Quit to setup</button>' : '') + '</div>', e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      closeSheet();
      if (b.dataset.m === 'rules') rulesSheet();
      if (b.dataset.m === 'new') confirmBox('Start a new game?', 'New game', startLocal);
      if (b.dataset.m === 'leave') confirmBox('Leave the online room?', 'Leave', leaveOnline);
      if (b.dataset.m === 'quit') confirmBox('End this game?', 'End', () => { clearTimeout(ui.botTimer); ui.gen++; store.game = null; table = null; save(); renderPlay(); });
    });
  }
  function rulesSheet() {
    sheet('How to play', '<div class="small" style="display:flex;flex-direction:column;gap:8px">' + RULES_HTML + '</div>');
  }
  const RULES_HTML =
    '<p style="margin:0"><b>Goal:</b> most points at the end = food eaten + population of living species + traits on living species.</p>' +
    '<p style="margin:0"><b>1. Deal:</b> 3 cards, plus 1 per species you have.</p>' +
    '<p style="margin:0"><b>2. Food card:</b> everyone puts one card face down at the watering hole.</p>' +
    '<p style="margin:0"><b>3. Play cards:</b> one player at a time, from the first player (Quick Play: all at once). A card becomes a face-down trait (up to 3 per species, 2 with two players, no doubles), a new species at either end, or +1 body size or +1 population (max 6). You may also discard a trait you have.</p>' +
    '<p style="margin:0"><b>4. Reveal:</b> traits flip up; Fertile, Fat Tissue and Long Neck act; then the food cards add (or remove) plant food.</p>' +
    '<p style="margin:0"><b>5. Feed:</b> in turn order, feed one species at a time: 1 plant food from the watering hole, or a Carnivore attacks a smaller species (even your own) for meat. If a hungry species of yours can eat, you must feed it; otherwise you may pass.</p>' +
    '<p style="margin:0"><b>6. End of round:</b> unfed population starves (a species at 0 goes extinct: draw 1 card per trait it had); eaten food goes in your bag. The game ends after the round in which the deck runs out. Ties: most traits, then most population.</p>';

  function cardSheet(id) {
    const c = DECK[id];
    sheet(c.trait, '<div style="display:flex;justify-content:center;padding:6px 0">' + bigTrait(c.trait, c.food) + '</div>' + traitStatsHtml(c.trait));
  }
  function speciesSheet(v, id) {
    const loc = findInView(v, id);
    if (!loc) return;
    const sp = loc.sp;
    const thr = O.threatMap(v).filter(x => x.tid === id);
    const by = thr.filter(x => x.ok);
    const not = thr.filter(x => !x.ok);
    const nm = p => (p === ME ? 'Your' : esc(v.players[p].name) + '’s');
    sheet((loc.p === ME ? 'Your' : v.players[loc.p].name + '’s') + ' species', '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + sp.traits.map(t => bigTrait(T(t))).join('') + '</div>' +
      '<p class="small"><b>Body ' + sp.body + ' · Population ' + sp.pop + ' · Food ' + sp.food + (sp.fat ? ' · Fat ' + sp.fat : '') + '</b></p>' +
      '<div class="label">Can be eaten by</div>' + (by.length ? '<ul class="log">' + by.map(x => '<li class="me">' + nm(x.cp) + ' ' + v.players[x.cp].species[x.ci].body + '/' + v.players[x.cp].species[x.ci].pop + ' Carnivore</li>').join('') + '</ul>' : '<p class="muted small" style="margin:2px 0">Nobody right now.</p>') +
      (not.length ? '<div class="label" style="margin-top:8px">Safe from</div><ul class="log">' + not.map(x => '<li>' + nm(x.cp) + ' ' + v.players[x.cp].species[x.ci].body + '/' + v.players[x.cp].species[x.ci].pop + ': ' + esc(x.why) + '</li>').join('') + '</ul>' : ''));
  }
  function holeSheet(v) {
    const myF = v.me && v.me.foodCard != null && v.me.foodCard >= 0 ? DECK[v.me.foodCard].food : 0;
    const fc = O.holeForecast(v, myF);
    const need = O.plantDemand(draftView(v));
    const max = Math.max(...fc.list.map(x => x.p), 0.01);
    const bars = fc.list.filter(x => x.p > 0.002).map(x => '<div class="row small" style="gap:6px"><span class="num" style="width:26px;text-align:right">' + x.h + '</span><div class="grow" style="height:10px;background:var(--bg-soft);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:' + (x.p / max * 100).toFixed(1) + '%;background:' + (x.h >= need ? 'var(--good)' : 'var(--bad)') + '"></i></div><span class="num" style="width:40px;text-align:right">' + pct(x.p) + '</span></div>').join('');
    const done = v.phase === 'feed' || v.over;
    sheet('Watering hole', done ? '<p>The food cards are revealed: ' + v.hole + ' plant food left. Plant need: ' + O.plantDemand(v) + '.</p>' :
      '<p class="small" style="margin-top:0">Now <b>' + v.hole + '</b>. The ' + fc.others + ' hidden food card' + (fc.others === 1 ? '' : 's') + ' average <b>' + fmtFood(+fc.meanCard.toFixed(2)) + '</b> each (cards you haven’t seen). ' +
      'Chance of enough for every plant eater (' + need + '): <b>' + pct(fc.pAtLeast(need)) + '</b> ' + qBtn('Assumes each player picked their food card at random from cards you have not seen. Real players often choose low cards when they own Carnivores and high cards when they eat plants.') + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:3px">' + bars + '</div><p class="muted small">Green = enough plant food for everyone.</p>');
  }

  // ================================================================== LAB
  const vLab = $('#v-lab');
  function traitStatsHtml(t) {
    const L = window.EvoLab;
    const foods = FOOD[t] || [];
    let html = '<p class="small" style="margin:6px 0">' + foods.length + ' cards in the deck. Food numbers: ' + foods.slice().sort((a, b) => a - b).map(fmtFood).join(', ') + '.</p>';
    if (L && L.traits[t]) {
      const x = L.traits[t];
      html += '<p class="small" style="margin:4px 0">In ' + L.games + ' Hard-vs-Hard games, a species with ' + esc(t) + ' ate <b>' + x.food.toFixed(2) + '</b> food a round (all species: ' + L.base.food.toFixed(2) + ') and lived <b>' + x.life.toFixed(1) + '</b> rounds (all: ' + L.base.life.toFixed(1) + ').</p>';
    }
    return html;
  }
  vLab.addEventListener('click', e => {
    const t = e.target;
    const tab = t.closest('[data-lt]');
    if (tab) { ui.labTab = tab.dataset.lt; renderLab(); return; }
    const tr = t.closest('[data-trait]');
    if (tr) { const tt = tr.dataset.trait; sheet(tt, '<div style="display:flex;justify-content:center;padding:6px 0">' + bigTrait(tt) + '</div>' + traitStatsHtml(tt)); return; }
    const pair = t.closest('[data-pair]');
    if (pair) { pairSheet(pair.dataset.pair); return; }
    const cb = t.closest('[data-calc]');
    if (cb) { calcClick(cb.dataset.calc); return; }
  });
  function renderLab() {
    const tabs = [['traits', 'Traits'], ['pairs', 'Pairs'], ['attack', 'Can it eat?'], ['food', 'Food deck']];
    let body = '';
    if (ui.labTab === 'pairs') body = pairsHtml();
    else if (ui.labTab === 'attack') body = calcHtml();
    else if (ui.labTab === 'food') body = foodHtml();
    else body = traitsHtml();
    vLab.innerHTML = '<div class="lab"><div class="seg">' + tabs.map(([k, l]) => '<button aria-pressed="' + (ui.labTab === k) + '" data-lt="' + k + '">' + l + '</button>').join('') + '</div><div class="body">' + body + '</div></div>';
  }
  function traitsHtml() {
    const L = window.EvoLab;
    const rows = TRAITS.map(t => ({ t, x: L && L.traits[t] && L.traits[t].n >= L.minN ? L.traits[t] : null }));
    if (L) rows.sort((a, b) => (b.x ? b.x.food : 0) - (a.x ? a.x.food : 0));
    const lo = L ? Math.min(...rows.map(r => r.x ? r.x.food : 9)) : 0, hi = L ? Math.max(...rows.map(r => r.x ? r.x.food : 0)) : 1;
    return '<div class="panel"><div class="row"><span class="label grow">Food a round, by trait</span>' + qBtn('From simulated games between Hard computers: average food eaten per round by species that carry the trait. Traits that protect (like Hard Shell) score by keeping the species alive, so look at "lived" too.') + '</div>' +
      rows.map(r => '<div class="trow" data-trait="' + esc(r.t) + '"><span class="ic" style="' + famStyle(r.t) + ';background:var(--paper)">' + A.icon(r.t) + '</span><span class="nm">' + esc(r.t) + '</span>' +
        (r.x ? '<span class="bar"><i style="width:' + ((r.x.food - lo) / (hi - lo + 1e-9) * 100).toFixed(0) + '%;background:' + heat(r.x.food, lo, hi) + '"></i></span><span class="v">' + r.x.food.toFixed(2) + '</span><span class="v muted" style="width:48px">' + r.x.life.toFixed(1) + 'r</span>' : '<span class="grow muted small">' + (L ? 'too few examples' : FOOD[r.t].length + ' cards') + '</span>') + '</div>').join('') +
      (L ? '<p class="muted small" style="margin:6px 0 0">' + L.games + ' games · r = rounds a species lived</p>' : '') + '</div>';
  }
  function pairsHtml() {
    const L = window.EvoLab;
    if (!L || !L.pairs) return '<div class="panel muted">No data yet.</div>';
    const n = TRAITS.length;
    let lo = Infinity, hi = -Infinity;
    for (const k in L.pairs) { const d = L.pairs[k].lift; if (L.pairs[k].n >= L.minN) { lo = Math.min(lo, d); hi = Math.max(hi, d); } }
    const lim = Math.max(Math.abs(lo), Math.abs(hi), 0.1);
    let cells = '<div class="hdr"></div>' + TRAITS.map(t => '<div class="hdr" title="' + esc(t) + '">' + A.icon(t) + '</div>').join('');
    TRAITS.forEach((a, i) => {
      cells += '<div class="hdr" title="' + esc(a) + '">' + A.icon(a) + '</div>';
      TRAITS.forEach((b, j) => {
        if (i === j) { cells += '<div class="c" style="background:#222838"></div>'; return; }
        const k = i < j ? a + '|' + b : b + '|' + a;
        const x = L.pairs[k];
        if (!x || x.n < L.minN) { cells += '<div class="c" style="background:#1d2130"></div>'; return; }
        cells += '<div class="c" data-pair="' + esc(k) + '" style="background:' + heat(x.lift, -lim, lim) + '">' + (Math.abs(x.lift) >= 0.1 ? (x.lift > 0 ? '+' : '−') : '') + '</div>';
      });
    });
    const top = Object.keys(L.pairs).filter(k => L.pairs[k].n >= L.minN).sort((a, b) => L.pairs[b].lift - L.pairs[a].lift).slice(0, 6);
    return '<div class="panel"><div class="row"><span class="label grow">Trait pairs on one species</span>' + qBtn('Green = the two traits together ate more food per round than you would expect from each trait alone (simulated Hard-vs-Hard games). Grey = too few examples. Tap a square for numbers.') + '</div>' +
      '<div class="heat" style="grid-template-columns:repeat(' + (n + 1) + ',minmax(0,1fr));margin-top:8px">' + cells + '</div></div>' +
      '<div class="panel"><span class="label">Best pairs</span>' + top.map(k => '<div class="trow" data-pair="' + esc(k) + '"><span class="nm" style="width:auto;flex:1">' + esc(k.replace('|', ' + ')) + '</span><span class="v" style="color:' + heat(L.pairs[k].lift, -lim, lim) + '">' + (L.pairs[k].lift > 0 ? '+' : '') + L.pairs[k].lift.toFixed(2) + '</span></div>').join('') + '</div>';
  }
  function pairSheet(k) {
    const L = window.EvoLab; const x = L && L.pairs[k];
    if (!x) return;
    const [a, b] = k.split('|');
    sheet(a + ' + ' + b, '<div style="display:flex;gap:8px;justify-content:center">' + bigTrait(a) + bigTrait(b) + '</div>' +
      '<p class="small">Together: <b>' + x.food.toFixed(2) + '</b> food a round over ' + x.n + ' species. Expected from each alone: ' + (x.food - x.lift).toFixed(2) + '. Difference: <b>' + (x.lift > 0 ? '+' : '') + x.lift.toFixed(2) + '</b>.</p>');
  }
  // the real-table companion: settle "can it eat that?" arguments
  function calcState() {
    if (!ui.calc) ui.calc = { a: { body: 3, pop: 2, traits: ['Carnivore'] }, d: { body: 2, pop: 2, traits: [] }, left: [], right: [], rightBody: 1 };
    return ui.calc;
  }
  function calcHtml() {
    const c = calcState();
    const ATT = ['Carnivore', 'Ambush', 'Climbing', 'Pack Hunting', 'Intelligence'];
    const DEF = ['Hard Shell', 'Climbing', 'Burrowing', 'Defensive Herding', 'Horns', 'Symbiosis'];
    const side = (k, title, list) => '<div class="side"><span class="label">' + title + '</span>' +
      '<div class="stepper">Body <button data-calc="' + k + '.body.-">−</button><b>' + c[k].body + '</b><button data-calc="' + k + '.body.+">+</button></div>' +
      '<div class="stepper">Pop <button data-calc="' + k + '.pop.-">−</button><b>' + c[k].pop + '</b><button data-calc="' + k + '.pop.+">+</button></div>' +
      (k === 'd' ? '<div class="stepper">Food <button data-calc="d.food.-">−</button><b>' + (c.d.food || 0) + '</b><button data-calc="d.food.+">+</button></div>' : '') +
      '<div class="tpick">' + list.map(t => '<button aria-pressed="' + (c[k].traits.indexOf(t) >= 0) + '" data-calc="' + k + '.t.' + esc(t) + '">' + A.icon(t) + esc(t) + '</button>').join('') + '</div></div>';
    const r = calcResult(c);
    return '<div class="panel"><div class="row"><span class="label grow">At the real table</span>' + qBtn('Set up the attacker and the target to check whether the attack is allowed, with the reason. Uses the same rules as the game engine.') + '</div>' +
      '<div class="verdict ' + (r.ok ? 'yes' : 'no') + '" style="margin:6px 0">' + (r.ok ? 'Yes, it can attack' : 'No') + '</div><p class="small" style="margin:0 0 8px">' + esc(r.ok ? calcEats(c, r) : r.why) + '</p>' +
      '<div class="calc">' + side('a', 'Carnivore', ATT) + side('d', 'Target', DEF) + '</div>' +
      '<div class="row small" style="margin-top:8px;flex-wrap:wrap"><span class="muted">Target’s neighbours:</span>' +
      '<div class="tpick"><button aria-pressed="' + (c.left.indexOf('Warning Call') >= 0) + '" data-calc="n.left">' + A.icon('Warning Call') + 'Warning Call left</button>' +
      '<button aria-pressed="' + (c.right.indexOf('Warning Call') >= 0) + '" data-calc="n.right">' + A.icon('Warning Call') + 'Warning Call right</button></div>' +
      '<div class="stepper">Right size <button data-calc="rb.-">−</button><b>' + c.rightBody + '</b><button data-calc="rb.+">+</button></div></div></div>';
  }
  function calcClick(k) {
    const c = calcState();
    const parts = k.split('.');
    if (parts[0] === 'n') { const arr = c[parts[1]]; const i = arr.indexOf('Warning Call'); if (i >= 0) arr.splice(i, 1); else arr.push('Warning Call'); }
    else if (parts[0] === 'rb') c.rightBody = Math.max(1, Math.min(6, c.rightBody + (parts[1] === '+' ? 1 : -1)));
    else if (parts[1] === 't') { const list = c[parts[0]].traits; const t = parts.slice(2).join('.'); const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); else if (t !== 'Carnivore') list.push(t); }
    else { const o = c[parts[0]]; const f = parts[1]; const lo = f === 'food' ? 0 : 1; o[f] = Math.max(lo, Math.min(f === 'food' ? o.pop : 6, (o[f] || 0) + (parts[2] === '+' ? 1 : -1))); if (o.food > o.pop) o.food = o.pop; }
    renderLab();
  }
  function calcEats(c, r) {
    const horns = c.d.traits.indexOf('Horns') >= 0 && !(r.intel && r.intel.indexOf('Horns') >= 0);
    const hunger = Math.max(0, c.a.pop - (horns ? 1 : 0));
    const meat = Math.min(c.d.body, hunger);
    return (r.intel ? 'With Intelligence: discard ' + r.intel.length + ' card' + (r.intel.length > 1 ? 's' : '') + ' to switch off ' + r.intel.join(' + ') + '. ' : '') +
      (meat ? 'It eats ' + meat + ' meat' + (meat < c.d.body ? ' (as much as it is hungry for)' : '') : 'It dies to Horns before it eats') + (horns ? ', and loses 1 population to Horns.' : '.');
  }
  // build a tiny engine state from the calculator and ask the engine
  function calcResult(c) {
    const idOf = t => DECK.findIndex(x => x.trait === t);
    const mk = (o, food) => ({ id: 0, body: o.body, pop: o.pop, food: Math.min(food || 0, o.pop), fat: 0, traits: o.traits.map(idOf), hidden: [] });
    const A1 = mk(c.a); A1.id = 1;
    const D = mk(c.d, c.d.food); D.id = 2;
    const row = [];
    if (c.left.length) row.push({ id: 3, body: 1, pop: 1, food: 0, fat: 0, traits: [idOf('Warning Call')], hidden: [] });
    row.push(D);
    row.push({ id: 4, body: c.rightBody, pop: 1, food: 0, fat: 0, traits: c.right.length ? [idOf('Warning Call')] : [], hidden: [] });
    const s = { players: [{ species: [A1] }, { species: row }] };
    const ti = row.indexOf(D);
    const why = E.attackBlock(s, 0, 0, 1, ti);
    if (why && c.a.traits.indexOf('Intelligence') >= 0) {
      const need = E.intelNeeded(s, 0, 0, 1, ti, 7);
      if (need && need.length) return { ok: true, why: '', intel: need };
    }
    return { ok: !why, why };
  }
  function foodHtml() {
    const all = DECK.map(c => c.food);
    const vals = [...new Set(all)].sort((a, b) => a - b);
    const cnt = vals.map(x => all.filter(y => y === x).length);
    const mx = Math.max(...cnt);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const L = window.EvoLab;
    const W = 320, H = 120, bw = W / vals.length;
    const svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '">' + vals.map((x, i) => '<rect x="' + (i * bw + 2).toFixed(1) + '" y="' + (H - cnt[i] / mx * H).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="' + (cnt[i] / mx * H).toFixed(1) + '" rx="2" fill="' + (x < 0 ? '#d0574a' : '#5fae5a') + '"/>' +
      '<text x="' + (i * bw + bw / 2).toFixed(1) + '" y="' + (H + 13) + '" fill="#969db4" font-size="10" text-anchor="middle">' + fmtFood(x) + '</text>' +
      '<text x="' + (i * bw + bw / 2).toFixed(1) + '" y="' + (H - cnt[i] / mx * H - 3).toFixed(1) + '" fill="#e8eaf0" font-size="9" text-anchor="middle">' + cnt[i] + '</text>').join('') + '</svg>';
    const byN = [2, 3, 4, 5, 6].map(n => { const d = O.sumDist(all, n); const m = d.reduce((a, x) => a + x.sum * x.p, 0); const p0 = d.reduce((a, x) => a + (x.sum <= 0 ? x.p : 0), 0); return { n, m, p0 }; });
    return '<div class="panel"><div class="row"><span class="label grow">Food numbers in the deck</span>' + qBtn('Every card has a food number. The cards placed at the watering hole each round add up to the plant food for that round.') + '</div>' +
      '<div class="chart" style="margin-top:8px">' + svg + '</div><p class="small" style="margin:6px 0 0">' + DECK.length + ' cards · average <b>' + fmtFood(+mean.toFixed(2)) + '</b> per card</p></div>' +
      '<div class="panel"><div class="row"><span class="label grow">Plant food per round</span>' + qBtn('If every player picked a random card as food. Exact math over the whole deck.') + '</div>' +
      '<table class="turns"><tr><th>Players</th><th>Average food</th><th>No food at all</th>' + (L && L.holeByN ? '<th>Hard computers</th>' : '') + '</tr>' + byN.map(x => '<tr><td>' + x.n + '</td><td class="n">' + x.m.toFixed(1) + '</td><td class="n">' + pct(x.p0) + '</td>' + (L && L.holeByN && L.holeByN[x.n] != null ? '<td class="n">' + L.holeByN[x.n].toFixed(1) + '</td>' : (L && L.holeByN ? '<td></td>' : '')) + '</tr>').join('') + '</table></div>';
  }

  // ================================================================== STUDY
  const vStudy = $('#v-study');
  vStudy.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && g.dataset.go === 'play') showTab('play', true); });
  function renderStudy() {
    const live = isLocal() && store.game && store.game.state;
    const src = store.last && (!live || store.game.saved) ? store.last : live ? { view: E.view(store.game.state, ME), notes: store.game.notes } : null;
    if (!src) { vStudy.innerHTML = '<div class="setup"><div class="panel"><b>Nothing to study yet</b><p class="muted small" style="margin:0">Play a game; each round’s numbers and your choices next to the Hard computer’s show up here.</p><button class="btn primary" data-go="play">Play</button></div></div>'; return; }
    const v = src.view, notes = src.notes || [];
    const me = ME < v.players.length ? ME : 0;
    const feedN = notes.filter(n => n.k === 'feed');
    const lost = feedN.reduce((a, n) => a + n.lost, 0);
    const agree = feedN.filter(n => n.lost < 0.01).length;
    const foodAgree = notes.filter(n => n.k === 'food' && n.same).length, foodN = notes.filter(n => n.k === 'food').length;
    const sc = v.over && v.result ? v.result.scores[me] : null;
    const head = '<div class="panel s-head"><div class="sum"><span class="big">' + (v.over ? (v.result.winners.indexOf(me) >= 0 ? 'Won' : 'Lost') : 'Round ' + v.round) + '</span>' +
      (sc ? '<span>' + sc.total + ' points (' + sc.food + ' food · ' + sc.pop + ' pop · ' + sc.traits + ' traits)</span>' : '') + '</div>' +
      (feedN.length ? '<p class="small" style="margin:6px 0 0">Feeding: you matched the Hard computer <b>' + agree + ' of ' + feedN.length + '</b> times; points lost <b style="color:' + heat(-lost, -6, 0) + '">' + lost.toFixed(1) + '</b> ' + qBtn('Points lost = how much better the Hard computer’s choice looked than yours, judged one step ahead (food now, population safe, rivals’ food). Small numbers are noise.') + '</p>' : '') +
      (foodN ? '<p class="small" style="margin:4px 0 0">Food cards: same pick as Hard <b>' + foodAgree + ' of ' + foodN + '</b>.</p>' : '') + '</div>';
    const chart = '<div class="panel s-chart"><span class="label">Score race</span><div class="chart">' + raceSvg(v) + '</div></div>';
    const rounds = (v.hist || []).filter(h => h.scores);
    const list = '<div class="s-list scroll"><table class="turns"><tr><th>R</th><th>Food in</th><th>You ate</th><th>Lost</th><th>Your choices</th></tr>' +
      rounds.map(h => {
        const ns = notes.filter(n => n.r === h.round);
        return '<tr><td class="n">' + h.round + '</td><td class="n">' + (h.added == null ? '' : fmtFood(h.added)) + '</td><td class="n">' + (h.eaten ? h.eaten[me] : '') + '</td><td class="n">' + (h.popLost ? h.popLost[me] : '') + '</td><td>' +
          ns.map(n => n.k === 'feed' ? (n.lost < 0.01 ? '<span class="ok">✓</span> ' + n.mine : '<span class="no">−' + n.lost.toFixed(1) + '</span> ' + n.mine + '<br><span class="muted">Hard: ' + n.best + '</span>') :
            n.k === 'food' ? (n.same ? '<span class="ok">✓</span> ' : '') + esc(n.mine) + (n.same ? '' : '<br><span class="muted">Hard: ' + esc(n.best) + '</span>') : esc(n.mine)).join('<br>') + '</td></tr>';
      }).join('') + '</table></div>';
    vStudy.innerHTML = '<div class="study">' + head + chart + list + '</div>';
  }
  function raceSvg(v) {
    const rounds = (v.hist || []).filter(h => h.scores);
    if (rounds.length < 1) return '<p class="muted small">After the first round.</p>';
    const W = 340, H = 150, n = v.players.length;
    const mx = Math.max(5, ...rounds.map(h => Math.max(...h.scores)));
    const x = i => 24 + (rounds.length === 1 ? 0 : i * (W - 34) / (rounds.length - 1));
    const y = val => H - 8 - val / mx * (H - 20);
    let out = '<svg viewBox="0 0 ' + W + ' ' + H + '"><line x1="24" y1="' + (H - 8) + '" x2="' + W + '" y2="' + (H - 8) + '" stroke="#2a3042"/>';
    out += '<text x="2" y="' + (y(mx) + 4) + '" fill="#969db4" font-size="10">' + mx + '</text>';
    for (let p = 0; p < n; p++) {
      const pts = rounds.map((h, i) => x(i).toFixed(1) + ',' + y(h.scores[p]).toFixed(1)).join(' ');
      out += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[p % 6] + '" stroke-width="' + (p === ME ? 3 : 1.6) + '" stroke-linejoin="round"/>';
    }
    return out + '</svg><div class="row small" style="flex-wrap:wrap;gap:4px 10px">' + v.players.map((pl, p) => '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + COLORS[p % 6] + '"></span> ' + esc(p === ME ? 'You' : pl.name) + '</span>').join('') + '</div>';
  }

  // ================================================================== SETTINGS
  const vSet = $('#v-settings');
  function renderSettings() {
    const st = store.settings;
    const sw = (k, title, sub) => '<label class="setrow"><span class="grow"><b>' + title + '</b><span>' + sub + '</span></span><span class="switch"><input type="checkbox" data-sw="' + k + '"' + (st[k] ? ' checked' : '') + '><span></span></span></label>';
    vSet.innerHTML = '<div class="set scroll"><div class="panel">' +
      sw('odds', 'Food odds', 'Watering-hole forecast on the table') +
      sw('threat', 'Threat marks', 'Red count = carnivores that can eat it') +
      sw('hints', 'Hint button', 'Shows what the Hard computer would do') +
      sw('quick', 'Quick Play', 'Everyone plays cards at once (always on with 6)') +
      '<div class="setrow"><span class="grow"><b>Computer speed</b><span>Feeding turns on this device</span></span></div>' +
      '<div class="seg" data-speed>' + ['slow', 'normal', 'fast'].map(k => '<button aria-pressed="' + (st.speed === k) + '" data-v="' + k + '">' + cap(k) + '</button>').join('') + '</div>' +
      '<div class="setrow"><span class="grow"><b>Name</b><span>Shown to friends online</span></span><input class="txt" id="set-name" maxlength="20" style="width:140px" value="' + esc(st.name) + '" placeholder="You"></div></div>' +
      '<div class="panel" id="set-fx"><span class="label">Sound &amp; effects</span></div>' +
      '<div class="panel"><div class="row"><span class="label grow">Rules</span></div><div class="small" style="display:flex;flex-direction:column;gap:6px;margin-top:6px">' + RULES_HTML + '</div>' +
      '<p class="muted small" style="margin:8px 0 0">Base game, 2nd printing (2015): 129 cards, 17 traits, 2–6 players. Our own words and drawings.</p></div>' +
      '<div class="panel"><div class="row"><span class="label grow">How strong are the computers?</span></div><p class="small" style="margin:6px 0 0">' + esc(strengthNote()) + '</p></div>' +
      '<p class="ver">Evolution Lab ' + VERSION + ' · <a href="../">All games</a></p></div>';
    if (FXL) FXL.renderSettings($('#set-fx'));
  }
  vSet.addEventListener('change', e => {
    const k = e.target.dataset.sw;
    if (k) { store.settings[k] = e.target.checked; save(); }
    if (e.target.id === 'set-name') { store.settings.name = cut(e.target.value.trim(), 20); save(); }
  });
  vSet.addEventListener('click', e => {
    const b = e.target.closest('[data-speed] button');
    if (b) { store.settings.speed = b.dataset.v; save(); renderSettings(); }
  });

  // ------------------------------------------------------------------ boot
  const startTab = (location.hash || '').slice(1);
  try { history.replaceState({ tab: 'play' }, '', location.pathname + location.search); } catch (e) { /* file:// */ }
  if (['lab', 'study', 'settings'].includes(startTab)) showTab(startTab, true); else showTab('play', false);
  if (store.online) {
    ui.online = true;
    loadOnline().then(room => room.resume()).then(ok => { if (!ok) { store.online = false; ui.online = false; save(); } renderPlay(); }).catch(() => { store.online = false; ui.online = false; save(); renderPlay(); });
  }
  window.__evo = { store, E, B, get table() { return table; },
    // tests: draw the online lobby from a made-up room (the real one needs the server)
    lobby(snap) { net.snap = snap; ui.online = true; renderPlay(); } };
})();
