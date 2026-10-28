/* Evolution Lab: what the table sounds and moves like. diff(prev, next, me) compares two views
   (EvoEngine.view or an online snapshot view) and lists what happened as events, in order, each
   with a sound from fx.js (or one of the few defined here) and an optional animation. The same
   function serves this device and online rooms, so every player hears every move, computers too.
   perform(events, FX, env) plays them one after another (env finds elements and waits). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvoFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CUSTOM = ['tuck', 'crunch', 'snap', 'grow', 'extinct'];
  const KNOWN = ['shuffle', 'cardDeal', 'cardSlide', 'cardFlip', 'place', 'pop', 'hit', 'miss', 'turn', 'drumroll', 'error', 'click'].concat(CUSTOM);
  const MAX_EVENTS = 18;

  // a few sounds the shared library doesn't have (all synthesised, category "moves")
  function define(FX) {
    if (!FX || !FX.define) return;
    // a trait card slid face down under a species board: papery slide, soft thump
    FX.define('tuck', k => { k.noise({ f: 2200, f2: 1200, q: 1, dur: 0.12, a: 0.02, vol: 0.38 }); k.tone({ f: 170, f2: 95, dur: 0.06, vol: 0.14, at: 0.1 }); }, 'moves');
    // a bite of plant food: three short crisp crunches over a low chew
    FX.define('crunch', k => {
      [0, 0.055, 0.115].forEach((at, i) => k.noise({ f: k.rnd(1700, 3100), q: 1.4, dur: k.rnd(0.03, 0.05), vol: 0.36 - i * 0.06, at }));
      k.noise({ f: 650, filter: 'lowpass', dur: 0.14, vol: 0.2 });
    }, 'moves');
    // jaws closing: a sharp click and a falling clack
    FX.define('snap', k => {
      k.noise({ f: 3500, filter: 'highpass', dur: 0.018, vol: 0.5 });
      k.tone({ f: 950, f2: 220, dur: 0.06, vol: 0.14, type: 'square', lp: 2600 });
      k.noise({ f: 2400, q: 2, dur: 0.025, vol: 0.32, at: 0.06 });
    }, 'moves');
    // a species grows (body size or population +1): two quick rising notes
    FX.define('grow', k => { k.tone({ f: 523, f2: 784, dur: 0.09, vol: 0.13, type: 'triangle' }); k.tone({ f: 784, f2: 1047, dur: 0.11, vol: 0.1, type: 'triangle', at: 0.07 }); }, 'moves');
    // a species dies out: a long low fall with a dull rumble
    FX.define('extinct', k => {
      k.tone({ f: 330, f2: 82, dur: 0.9, vol: 0.16, type: 'triangle', lp: 1200 });
      k.noise({ f: 420, f2: 110, filter: 'lowpass', dur: 0.8, a: 0.1, vol: 0.24 });
    }, 'moves');
  }

  // ------------------------------------------------------------------ helpers
  const same = (a, b) => a && b && a.r === b.r && a.p === b.p && a.t === b.t;
  // log lines in `next` that `prev` didn't have (views carry the last 80 lines)
  function newLines(a, b) {
    a = a || []; b = b || [];
    if (b.length < 80) return b.slice(Math.min(a.length, b.length));
    const k = Math.min(4, a.length);
    if (!k) return b.slice(-12);
    for (let i = b.length - k; i >= 0; i--) {
      let ok = true;
      for (let j = 0; j < k; j++) if (!same(b[i + j], a[a.length - k + j])) { ok = false; break; }
      if (ok) return b.slice(i + k);
    }
    return b.slice(-12);
  }
  function spMap(v) {
    const m = {};
    v.players.forEach((pl, p) => pl.species.forEach((sp, i) => { m[sp.id] = { p, i, sp }; }));
    return m;
  }
  const nTraits = sp => sp.traits.length + sp.hidden.length;
  const spSel = id => '[data-sp="' + id + '"]';
  const areaSel = (p, me) => (p === me ? '#mine' : '.opp[data-p="' + p + '"]');

  // ------------------------------------------------------------------ the event map
  // o.fresh = a game that just started on this screen (shuffle + deal); o.colors = seat colours
  function diff(prev, next, me, o) {
    o = o || {};
    const ev = [];
    if (!next || !next.players) return ev;
    const V = p => (p === me ? undefined : 0.8); // other players' moves a little quieter
    const deal = ids => ids.slice(0, 7).forEach(id => ev.push({ snd: 'cardDeal', anim: 'deal', el: '#hand [data-card="' + id + '"]', from: '#deck', gap: 85 }));
    const myHand = v => (v && v.me && Array.isArray(v.me.hand) ? v.me.hand : []);
    if (!prev || !prev.players || prev.players.length !== next.players.length || next.round < prev.round) {
      if (o.fresh && !next.over) { ev.push({ snd: 'shuffle', gap: 480 }); deal(myHand(next)); }
      return ev;
    }
    const sameRound = next.round === prev.round;
    const P = spMap(prev), N = spMap(next);
    const lines = newLines(prev.log, next.log);
    const fertile = {};
    lines.forEach(l => { if (/Fertile species grows/.test(l.t)) fertile[l.p] = (fertile[l.p] || 0) + 1; });

    // food gained per species this step (only within one round: food is banked at the round's end)
    const gain = {};
    if (sameRound) for (const id in N) { const a = P[id]; if (a) { const g = (N[id].sp.food + N[id].sp.fat) - (a.sp.food + a.sp.fat); if (g > 0) gain[id] = g; } }
    const fedGroup = (p, snd, pitch) => {
      const ids = next.players[p] ? next.players[p].species.map(sp => sp.id).filter(id => gain[id]) : [];
      if (!ids.length) { ev.push({ snd, pitch, vol: V(p) }); return null; }
      ids.forEach((id, i) => {
        // the eater crunches; every species that eats along with it (Cooperation, Long Neck chains) pops, rising
        ev.push(i === 0 ? { snd, pitch, vol: V(p), anim: 'pop', el: spSel(id), float: '+' + gain[id], color: 'var(--good)', gap: 140 }
          : { snd: 'pop', pitch: 1 + 0.18 * i, vol: V(p), anim: 'pop', el: spSel(id), float: '+' + gain[id], color: 'var(--good)', gap: 120 });
        delete gain[id];
      });
      return ids[0];
    };

    // who placed a food card face down at the watering hole (mine sounded when I tapped)
    const placed = next.players.map((pl, p) => p !== me && pl.foodPicked && (!sameRound || !prev.players[p].foodPicked) ? p : -1).filter(p => p >= 0);
    const placeFood = () => placed.splice(0).forEach(p => ev.push({ snd: 'cardSlide', vol: V(p), anim: 'pop', el: '.hole .fcards', gap: 120 }));
    const newCards = myHand(next).filter(id => myHand(prev).indexOf(id) < 0);
    let dealt = false;

    // a player's card plays, seen on their species (mine sounded while I planned them)
    const cardPlays = (p, n) => {
      if (p === me || !next.players[p]) return;
      const out = [];
      let fert = fertile[p] || 0;
      for (const sp of next.players[p].species) {
        const a = P[sp.id];
        if (!a) { out.push({ snd: 'place', vol: V(p), anim: 'pop', el: spSel(sp.id) }); continue; }
        for (let k = nTraits(a.sp); k < nTraits(sp); k++) out.push({ snd: 'tuck', vol: V(p), anim: 'pop', el: spSel(sp.id) });
        for (let k = a.sp.body; k < sp.body; k++) out.push({ snd: 'grow', pitch: 0.85, vol: V(p), anim: 'pop', el: spSel(sp.id) });
        if (sameRound) for (let k = a.sp.pop; k < sp.pop; k++) { if (fert > 0) { fert--; continue; } out.push({ snd: 'grow', vol: V(p), anim: 'pop', el: spSel(sp.id) }); }
      }
      if (!out.length) for (let k = 0; k < Math.min(n, 3); k++) out.push({ snd: 'tuck', vol: V(p) });
      ev.push(...out.slice(0, 5));
    };

    for (const l of lines) {
      const t = l.t, p = l.p;
      let m;
      if (l.k === 'sys' && /^Round \d+/.test(t)) {
        if (newCards.length) { deal(newCards); dealt = true; }
        placeFood();
      } else if (/reshuffled/.test(t)) {
        ev.push({ snd: 'shuffle', gap: 450 });
      } else if ((m = /^Food cards add ([+-]?\d+)/.exec(t))) {
        // the food cards (and the new traits) flip face up; the number lands in the watering hole
        const add = +m[1];
        const h = next.hist && next.hist[next.hist.length - 1];
        const n = Math.max(1, Math.min(4, h && h.foodCards ? h.foodCards.length : 1));
        for (let k = 0; k < n; k++) ev.push(k === 0 ? { snd: 'cardFlip', anim: 'pop', el: '.hole .hn', float: (add >= 0 ? '+' : '−') + Math.abs(add), color: add >= 0 ? 'var(--good)' : 'var(--bad)', gap: 90 } : { snd: 'cardFlip', pitch: 1 + 0.06 * k, gap: 90 });
      } else if ((m = / plays (\d+) cards?\./.exec(t))) {
        cardPlays(p, +m[1]);
      } else if (/Fertile species grows/.test(t)) {
        ev.push({ snd: 'grow', vol: V(p) });
      } else if (/Long Neck eats/.test(t)) {
        fedGroup(p, 'crunch', 1.1);
      } else if (/uses Intelligence/.test(t)) {
        ev.push({ snd: 'cardSlide', vol: V(p), gap: 150 });
        fedGroup(p, 'crunch');
      } else if (/ eats \d+ plant food/.test(t)) {
        fedGroup(p, 'crunch');
      } else if (l.k === 'atk') {
        // every species that lost population to it shakes (the prey; the attacker too with Horns)
        const hurt = sameRound ? Object.keys(N).filter(id => P[id] && N[id].sp.pop < P[id].sp.pop) : [];
        // jaws close on the prey (another player's species first; the attacker only loses one to Horns)
        const gone = sameRound ? Object.keys(P).filter(id => !N[id]) : [];
        const prey = hurt.filter(id => N[id].p !== p)[0] || gone.map(id => P[id]).filter(x => x.p !== p).map(x => '@' + x.p)[0] || hurt[0] || (gone[0] ? '@' + P[gone[0]].p : null);
        // several attacks in one step (catching up after a hidden tab): which prey is which is unclear, so no jaws
        const preyEl = prey == null || lines.filter(x => x.k === 'atk').length > 1 ? null : prey[0] === '@' ? areaSel(+prey.slice(1), me) : spSel(prey);
        ev.push(preyEl ? { snd: 'snap', vol: V(p), anim: 'bite', el: preyEl, gap: 120 } : { snd: 'snap', vol: V(p), gap: 120 });
        ev.push({ snd: 'hit', vol: V(p), gap: 200 });
        hurt.forEach(id => ev.push({ anim: 'shake', el: spSel(id), gap: 0 }));
        // prey eaten to the last one is already gone from the table: shake its owner's row instead
        if (sameRound) Object.keys(P).filter(id => !N[id]).map(id => P[id].p).filter((q, i, a) => a.indexOf(q) === i)
          .forEach(q => ev.push({ anim: 'shake', el: areaSel(q, me), gap: 0 }));
      } else if (/^Horns:/.test(t)) {
        ev.push({ snd: 'hit', pitch: 1.4, vol: 0.6, gap: 150 });
      } else if ((m = /^The Carnivore eats (\d+) meat/.exec(t))) {
        const id = fedGroup(p, 'crunch', 0.7);
        if (p === me && +m[1] >= 4) ev.push({ celebrate: 'big', el: id != null ? spSel(id) : null, gap: 200 });
      } else if (/Scavenger takes/.test(t)) {
        fedGroup(p, 'pop', 1.2);
      } else if (l.k === 'ext') {
        ev.push({ snd: 'extinct', vol: V(p), anim: 'extinct', el: areaSel(p, me), color: 'var(--bad)', gap: 300 });
      } else if (/starves to population/.test(t)) {
        ev.push({ snd: 'miss', vol: V(p), gap: 120 });
      }
    }
    if (newCards.length && !dealt) deal(newCards); // cards drawn for an extinct species
    placeFood();

    // a species of mine reaching population or body size 6: a small sparkle
    if (!next.over) next.players[me] && next.players[me].species.forEach(sp => {
      const a = P[sp.id];
      if (a && ((sp.pop === 6 && a.sp.pop < 6) || (sp.body === 6 && a.sp.body < 6))) ev.push({ celebrate: 'big', el: spSel(sp.id), gap: 150 });
    });
    // many species starving or dying at once: two sounds of each kind, the rest only animate
    const seen = {};
    ev.forEach(e => { if (e.snd === 'miss' || e.snd === 'extinct') { seen[e.snd] = (seen[e.snd] || 0) + 1; if (seen[e.snd] > 2) { delete e.snd; e.gap = 40; } } });
    for (let i = ev.length - 1; i >= 0; i--) if (!ev[i].snd && !ev[i].anim && !ev[i].celebrate) ev.splice(i, 1);
    if (ev.length > MAX_EVENTS) ev.splice(MAX_EVENTS);
    // keep one step's sounds within ~1.8 s so the table never lags behind the game (0.8 s before a result)
    const budget = next.over ? 800 : 1800;
    const total = ev.reduce((a, e) => a + (e.gap != null ? e.gap : 110), 0);
    if (total > budget) ev.forEach(e => { e.gap = Math.max(40, Math.round((e.gap != null ? e.gap : 110) * budget / total)); });

    const mine = v => !v.over && Array.isArray(v.toAct) && v.toAct.indexOf(me) >= 0;
    if (mine(next) && !mine(prev)) ev.push({ snd: 'turn', anim: 'pulse', el: '.status .ph' });

    if (next.over && !prev.over && next.result) {
      const r = next.result;
      const won = r.winners.indexOf(me) >= 0;
      const rows = next.players.map((pl, p) => p).sort((a, b) => r.scores[b].total - r.scores[a].total);
      ev.push({ snd: 'drumroll', anim: 'count', el: '#over [data-tot]', vals: rows.map(p => r.scores[p].total), gap: 700 });
      ev.push({ celebrate: won ? 'win' : 'lose', colors: o.colors ? (won ? [o.colors[me % o.colors.length], '#f0b354', '#6ee7a8', '#e8eaf0'] : null) : null });
    }
    return ev;
  }

  // ------------------------------------------------------------------ playing the events
  // a card arriving from the draw pile into its place in the hand (transform + opacity only).
  // With the table kit (env.table) a card back leaves the top of the deck stack and the real card
  // shows when it lands; the held fan keeps its own tilt.
  function dealIn(el, from, FX, k, TB) {
    const st = FX.settings || {};
    const show = () => { if (el && el.style) el.style.visibility = ''; };
    if (!st.animations || !el || !from) { show(); return Promise.resolve(); }
    if (TB && TB.deal) {
      if (el.style) el.style.visibility = 'hidden';
      return Promise.resolve(TB.deal(from, el, { duration: Math.round(380 * k), cls: 'evo-back' })).then(show, show);
    }
    if (!el.animate || !from.getBoundingClientRect) return Promise.resolve();
    const a = el.getBoundingClientRect(), b = from.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    return new Promise(res => {
      let an;
      try { an = el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.35)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: Math.round(380 * k), easing: 'cubic-bezier(.3,.7,.3,1)' }); } catch (e) { return res(); }
      const fin = () => res();
      an.onfinish = fin; an.oncancel = fin; setTimeout(fin, 380 * k + 150);
    });
  }
  // ---- the two big moments, drawn here in our own SVG/CSS (only with animations on and no reduced motion)
  const moving = FX => {
    if (!FX || !FX.settings || !FX.settings.animations) return false;
    try { if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) { /* ignore */ }
    return typeof document !== 'undefined' && !!document.body;
  };
  function over(el, css) {
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'evo-moment';
    d.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:none;z-index:2147483000;' + (css || '');
    document.body.appendChild(d);
    return { d, r };
  }
  const anim = (node, frames, ms, o) => new Promise(res => {
    let a; try { a = node.animate(frames, Object.assign({ duration: ms, fill: 'forwards' }, o || {})); } catch (e) { return res(); }
    const fin = () => res(); a.onfinish = fin; a.oncancel = fin; setTimeout(fin, ms + 150);
  });
  // jaws: an upper and a lower row of teeth swing shut over the prey, then a red flash and a quick shake
  function bite(el, FX, k) {
    if (!el || !el.getBoundingClientRect || !moving(FX)) return Promise.resolve();
    const { d, r } = over(el, 'overflow:visible');
    const s = Math.max(44, Math.min(120, Math.min(r.width, r.height) * 1.1));
    const teeth = up => '<svg viewBox="0 0 100 40" width="' + s + '" height="' + (s * 0.4) + '" style="position:absolute;left:50%;top:50%;margin-left:' + (-s / 2) + 'px;overflow:visible;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))">' +
      '<path d="' + (up ? 'M2 2Q50 -6 98 2L98 8L88 30L78 8L66 34L54 8L42 34L30 8L20 30L10 8L2 8Z' : 'M2 38Q50 46 98 38L98 32L88 12L78 32L66 6L54 32L42 6L30 32L20 12L10 32L2 32Z') +
      '" fill="#fbf7ee" stroke="#5a1e16" stroke-width="3" stroke-linejoin="round"/></svg>';
    d.innerHTML = '<div class="u">' + teeth(true) + '</div><div class="l">' + teeth(false) + '</div>';
    const u = d.firstChild.firstChild, l = d.lastChild.firstChild;
    u.style.marginTop = (-s * 0.4 - s * 0.05) + 'px'; l.style.marginTop = (s * 0.05) + 'px';
    const ms = Math.round(300 * k);
    const shut = (node, dir) => anim(node, [{ transform: 'translateY(' + (dir * s * 0.45) + 'px) rotate(' + (dir * 8) + 'deg)', opacity: 0 },
      { transform: 'translateY(' + (dir * s * 0.4) + 'px) rotate(' + (dir * 8) + 'deg)', opacity: 1, offset: 0.25 },
      { transform: 'translateY(' + (dir * s * 0.06) + 'px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(' + (dir * s * 0.1) + 'px)', opacity: 0 }], ms, { easing: 'cubic-bezier(.5,0,.6,1)' });
    const red = document.createElement('div');
    red.style.cssText = 'position:absolute;inset:0;border-radius:8px;background:radial-gradient(circle,rgba(220,60,40,.55),rgba(220,60,40,0) 70%);opacity:0';
    d.appendChild(red);
    return Promise.all([shut(u, -1), shut(l, 1), anim(red, [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], ms + 120)]).then(() => d.remove(), () => d.remove());
  }
  // extinction: the row darkens, a puff of dust bursts out and settles, "Extinct" rises and fades
  function extinct(el, FX, k, color) {
    if (!el || !el.getBoundingClientRect || !moving(FX)) return FX && FX.flash && el ? FX.flash(el, color) : Promise.resolve();
    const { d, r } = over(el, 'overflow:visible;border-radius:10px');
    const ms = Math.round(1100 * k);
    const shade = document.createElement('div');
    shade.style.cssText = 'position:absolute;inset:0;border-radius:inherit;background:radial-gradient(ellipse at 50% 60%,rgba(40,20,14,.7),rgba(120,40,30,.35) 60%,rgba(0,0,0,0));opacity:0';
    d.appendChild(shade);
    const ps = [anim(shade, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.8, offset: 0.6 }, { opacity: 0 }], ms)];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      const sz = 5 + (i * 7) % 9, ang = (i / n) * Math.PI * 2 + (i % 3) * 0.2, dist = Math.min(r.width, 220) * (0.28 + ((i * 5) % 7) / 18);
      p.style.cssText = 'position:absolute;left:50%;top:55%;width:' + sz + 'px;height:' + sz + 'px;margin:' + (-sz / 2) + 'px;border-radius:50%;background:' + (i % 2 ? '#8b6b4a' : '#bfa27a') + ';opacity:0';
      d.appendChild(p);
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.45;
      ps.push(anim(p, [{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: 'translate(' + dx * 0.6 + 'px,' + dy * 0.6 + 'px) scale(1.2)', opacity: 0.85, offset: 0.3 },
        { transform: 'translate(' + dx + 'px,' + (dy + 14) + 'px) scale(.8)', opacity: 0 }], ms, { easing: 'cubic-bezier(.2,.7,.4,1)' }));
    }
    const t = document.createElement('div');
    t.textContent = 'Extinct';
    t.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:900;font-size:' + Math.max(18, Math.min(30, r.height * 0.3)) + 'px;letter-spacing:.06em;text-transform:uppercase;color:#f2d7cf;text-shadow:0 2px 6px rgba(0,0,0,.8),0 0 2px #5a1e16;white-space:nowrap;opacity:0';
    d.appendChild(t);
    ps.push(anim(t, [{ transform: 'translate(-50%,-30%) scale(.8)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.65 }, { transform: 'translate(-50%,-90%)', opacity: 0 }], ms));
    return Promise.all(ps).then(() => d.remove(), () => d.remove());
  }

  function fire(e, FX, env, k) {
    try {
      if (e.snd) { const o = {}; if (e.vol != null) o.vol = e.vol; if (e.pitch != null) o.pitch = e.pitch; FX.play(e.snd, o); }
      const el = e.el ? env.el(e.el) : null;
      if (e.celebrate) return FX.celebrate({ kind: e.celebrate, colors: e.colors || undefined, at: el || undefined }) || Promise.resolve();
      const ps = [];
      if (e.anim === 'deal') ps.push(dealIn(el, env.el(e.from), FX, k, env.table));
      else if (e.anim === 'count') env.all(e.el).forEach((x, i) => { if (e.vals && e.vals[i] != null) ps.push(FX.countUp(x, 0, e.vals[i], { duration: 800 })); });
      else if (e.anim === 'flash' && el) ps.push(FX.flash(el, e.color));
      else if (e.anim === 'bite') ps.push(bite(el, FX, k));
      else if (e.anim === 'extinct') ps.push(extinct(el, FX, k, e.color));
      else if (e.anim && el && FX[e.anim]) ps.push(FX[e.anim](el));
      if (e.float && el) ps.push(FX.floatText(el, e.float, e.color));
      return Promise.all(ps);
    } catch (err) { return Promise.resolve(); }
  }
  function perform(events, FX, env) {
    if (!events || !events.length || !FX) return Promise.resolve();
    const k = FX.settings && FX.settings.animSpeed === 'fast' ? 0.55 : 1;
    // cards still to be dealt stay out of the hand until their card leaves the deck
    if (env.table && FX.settings && FX.settings.animations) events.forEach(e => {
      if (e.anim !== 'deal') return;
      const el = env.el(e.el);
      if (el && el.style) { el.style.visibility = 'hidden'; setTimeout(() => { el.style.visibility = ''; }, 4000); }
    });
    let t = 0;
    return Promise.all(events.map(e => {
      const at = Math.round(t * k);
      t += e.gap != null ? e.gap : 110;
      return new Promise(res => env.wait(at, () => { Promise.resolve(fire(e, FX, env, k)).then(res, res); }));
    }));
  }

  return { diff, perform, define, newLines, CUSTOM, KNOWN };
});
