/* Evolution Lab: computer players. Three levels, strength measured by tools/measure-levels.js.
   easy   = legal but careless (random feeding, random card use)
   medium = simple habits (grow, feed the hungriest, attack the biggest target it can)
   hard   = reads the table: carnivore threats, food supply, trait values; tries each feeding
            option on a copy of the game and keeps the one that leaves it furthest ahead.
   bots only look at what their seat could see at a real table (no hands, no face-down cards,
   no deck order), except where noted for the shared food math (the deck's food totals are public). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'), require('./engine.js'));
  else root.EvoBots = factory(root.EvoCards, root.EvoEngine);
})(typeof self !== 'undefined' ? self : this, function (Cards, E) {
  'use strict';
  const { DECK } = Cards;
  const T = id => DECK[id].trait;
  const has = E.has;

  // a tiny private random stream so bots never touch the game's seed
  function brng(s, p, salt) {
    let a = (s.seed ^ (p * 2654435761) ^ (salt * 40503)) | 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ------------------------------------------------------------------ table reading
  const MEAN_FOOD = DECK.reduce((a, c) => a + c.food, 0) / DECK.length;
  function carnivores(s, except) {
    const out = [];
    s.players.forEach((pl, p) => pl.species.forEach((sp, i) => { if (p !== except && E.isCarn(sp)) out.push({ p, i, sp }); }));
    return out;
  }
  // how many enemy carnivores could attack species i of player p (as the table looks now)
  function threat(s, p, i) {
    let n = 0;
    for (const c of carnivores(s, p)) if (!E.attackBlock(s, c.p, c.i, p, i)) n++;
    return n;
  }
  // plant food I can expect this round per mouth
  function plantOutlook(s) {
    let mouths = 0;
    s.players.forEach(pl => pl.species.forEach(sp => { if (!E.isCarn(sp)) mouths += sp.pop; }));
    const supply = s.hole + s.players.length * MEAN_FOOD;
    return mouths ? supply / mouths : 3;
  }

  // ------------------------------------------------------------------ value of a trait on a species
  function traitValue(s, p, sp, i, t, lv) {
    const thr = threat(s, p, i) + (lv === 'hard' ? carnivores(s, p).length * 0.25 : 0);
    const row = s.players[p].species;
    const out = plantOutlook(s);
    const carn = E.isCarn(sp);
    let v = 0.7; // each trait is a point at the end if the species lives
    switch (t) {
      case 'Carnivore': {
        if (carn || sp.traits.length + sp.hidden.length > 1) return -5;
        let targets = 0;
        s.players.forEach((pl, q) => pl.species.forEach(x => { if (x !== sp && x.body < sp.body + 1 && q !== p) targets++; }));
        v += targets * 0.5 + (out < 1.2 ? 1.2 : 0) + (sp.body >= 3 ? 0.8 : -1) - (sp.pop > 2 ? 0 : 0.2);
        if (!targets) v -= 3;
        break;
      }
      case 'Ambush': case 'Pack Hunting': v += carn ? 1.3 : -2; break;
      case 'Scavenger': v += carnivores(s, -1).length * 0.5 + (carn ? 0.6 : 0); break;
      case 'Foraging': v += carn ? -2 : sp.pop >= 2 ? 1.0 : 0.4; break;
      case 'Long Neck': v += carn ? -2 : 1.2; break;
      case 'Fertile': v += s.hole > 0 || out > 1.5 ? 1.0 : 0.3; break;
      case 'Fat Tissue': v += 0.25 * sp.body; break;
      case 'Cooperation': v += row[i + 1] ? 1.1 : 0.2; break;
      case 'Intelligence': v += 0.5; break;
      case 'Hard Shell': v += thr * 1.6; break;
      case 'Climbing': v += thr * 1.4; break;
      case 'Burrowing': v += thr * 1.0; break;
      case 'Horns': v += thr * 0.9; break;
      case 'Defensive Herding': v += thr * 1.0; break;
      case 'Symbiosis': v += row[i + 1] && row[i + 1].body > sp.body ? thr * 1.2 : 0; break;
      case 'Warning Call': v += ((row[i - 1] ? threat(s, p, i - 1) : 0) + (row[i + 1] ? threat(s, p, i + 1) : 0)) * 0.9; break;
    }
    return v;
  }

  // ------------------------------------------------------------------ food card
  function chooseFood(s, p, lv) {
    const pl = s.players[p];
    const r = brng(s, p, s.round * 7 + 1);
    if (lv === 'easy') return { t: 'food', card: pick(r, pl.hand) };
    // the card worth least in hand; plant eaters like high food numbers, carnivores like low
    const herb = pl.species.filter(sp => !E.isCarn(sp)).reduce((a, sp) => a + sp.pop, 0);
    const carnPop = pl.species.filter(sp => E.isCarn(sp)).reduce((a, sp) => a + sp.pop, 0);
    let best = null, bv = Infinity;
    for (const id of pl.hand) {
      const t = T(id);
      let keep = 0.6;
      pl.species.forEach((sp, i) => { if (!E.has(sp, t)) keep = Math.max(keep, traitValue(s, p, sp, i, t, lv)); });
      const f = DECK[id].food;
      const v = keep - (lv === 'hard' ? 0.25 : 0.15) * f * (herb >= carnPop ? 1 : -0.6);
      if (v < bv) { bv = v; best = id; }
    }
    return { t: 'food', card: best };
  }

  // ------------------------------------------------------------------ play phase: build a list of moves
  function choosePlays(s, p, lv) {
    const r = brng(s, p, s.round * 7 + 2);
    const work = E.clone(s);
    const pl = work.players[p];
    const moves = [];
    const tryMove = m => {
      try { simPlay(work, pl, m); moves.push(m); return true; } catch (e) { return false; }
    };
    if (lv === 'easy') {
      // play about half the hand at random
      const n = Math.floor(pl.hand.length / 2);
      for (let k = 0; k < n && pl.hand.length; k++) {
        const card = pick(r, pl.hand);
        const sp = pick(r, pl.species);
        const kind = pick(r, ['trait', 'trait', 'body', 'pop', 'species']);
        tryMove(kind === 'species' ? { t: 'species', card, side: r() < 0.5 ? 'L' : 'R' } : { t: kind, card, s: sp && sp.id });
      }
      return { t: 'play', moves };
    }
    const out = plantOutlook(s);
    let guard = 0;
    while (pl.hand.length > (lv === 'hard' ? 1 : 2) && guard++ < 20) {
      let best = null, bv = lv === 'hard' ? 0.55 : 0.8;
      const nSp = pl.species.length;
      for (const card of pl.hand) {
        const t = T(card);
        // new species
        const vNew = (nSp < 2 ? 2.4 : nSp < 4 ? 1.6 - 0.25 * nSp : 0.3) * (out > 1 ? 1 : 0.6);
        if (vNew > bv) { bv = vNew; best = { t: 'species', card, side: 'R' }; }
        pl.species.forEach((sp, i) => {
          const carn = E.isCarn(sp);
          // population: worth it if food per mouth looks fine (carnivores: if meat is around)
          if (sp.pop < E.MAX) {
            const vp = carn ? 0.6 : (out >= 1.3 ? 1.3 : out >= 1 ? 0.9 : 0.3) - (threat(s, p, i) ? 0.3 : 0);
            if (vp > bv) { bv = vp; best = { t: 'pop', card, s: sp.id }; }
          }
          // body size: escape a carnivore, or a carnivore that bites bigger
          if (sp.body < E.MAX) {
            let vb = 0.25;
            if (lv === 'hard') {
              for (const c of carnivores(s, p)) {
                const atk = c.sp.body + (has(c.sp, 'Pack Hunting') ? c.sp.pop : 0);
                if (atk === sp.body + 1) vb += 0.9;
              }
              if (carn) vb += 0.7;
              if (has(sp, 'Fat Tissue')) vb += 0.2;
            } else vb += threat(s, p, i) ? 0.7 : 0;
            if (vb > bv) { bv = vb; best = { t: 'body', card, s: sp.id }; }
          }
          // trait
          const list = sp.traits.concat(sp.hidden);
          if (list.length < s.maxTraits && !list.some(id => T(id) === t)) {
            const vt = traitValue(work, p, sp, i, t, lv);
            if (vt > bv) { bv = vt; best = { t: 'trait', card, s: sp.id }; }
          }
        });
      }
      if (!best || !tryMove(best)) break;
    }
    return { t: 'play', moves };
  }
  // a cheap copy of the engine's play rules for planning (the engine re-checks everything)
  function simPlay(s, pl, m) {
    const k = pl.hand.indexOf(m.card);
    if (k < 0) throw new Error('x');
    if (m.t === 'species') {
      // a species made in this same list is named -1, -2, ... (the engine maps it to its real id)
      pl._made = (pl._made || 0) + 1;
      const ns = { id: -pl._made, body: 1, pop: 1, food: 0, fat: 0, traits: [], hidden: [] };
      if (m.side === 'L') pl.species.unshift(ns); else pl.species.push(ns);
    } else {
      const sp = pl.species.find(x => x.id === m.s);
      if (!sp) throw new Error('x');
      if (m.t === 'body') { if (sp.body >= E.MAX) throw new Error('x'); sp.body++; }
      else if (m.t === 'pop') { if (sp.pop >= E.MAX) throw new Error('x'); sp.pop++; }
      else if (m.t === 'trait') { const list = sp.traits.concat(sp.hidden); if (list.length >= s.maxTraits || list.some(id => T(id) === T(m.card))) throw new Error('x'); sp.hidden.push(m.card); }
      else throw new Error('x');
    }
    pl.hand.splice(k, 1);
  }

  // ------------------------------------------------------------------ feeding
  // position value for seat p: food already in hand (bag + eaten this round) + safe population + traits
  function evalFor(s, p) {
    const sc = E.score(s, p);
    let v = sc.total;
    for (const sp of s.players[p].species) v += Math.min(sp.food, sp.pop) * 1.0 - Math.max(0, sp.pop - sp.food) * 0.35 + sp.fat * 0.5;
    return v;
  }
  // the k cards this seat would miss least (for Intelligence discards)
  function worstCards(s, p, k) {
    const pl = s.players[p];
    const val = id => { let v = 0.4; pl.species.forEach((sp, i) => { if (!has(sp, T(id))) v = Math.max(v, traitValue(s, p, sp, i, T(id), 'medium')); }); return v; };
    return pl.hand.slice().sort((a, b) => val(a) - val(b)).slice(0, k);
  }
  function chooseFeed(s, p, lv) {
    const opts = E.feedOptions(s, p);
    const passOk = E.canPass(s, p);
    if (!opts.length) return { t: 'pass' };
    const r = brng(s, p, s.round * 7 + 3 + s.log.length);
    // Intelligence needs cards to discard: the ones worth least
    const fill = o => {
      if (o.t === 'intel') return { t: 'intel', s: o.s, card: worstCards(s, p, 1)[0] };
      if (o.t === 'attack') return o.ignore.length ? { t: 'attack', s: o.s, target: o.target, ignore: o.ignore, cards: worstCards(s, p, o.ignore.length) } : { t: 'attack', s: o.s, target: o.target };
      return { t: o.t, s: o.s };
    };
    if (lv === 'easy') {
      const feeds = opts.filter(o => o.t !== 'intel');
      if (!feeds.length) return { t: 'pass' };
      return fill(pick(r, feeds));
    }
    if (lv === 'medium') {
      // plants first for the hungriest; then bite the biggest rival it can; own species only when forced
      const eats = opts.filter(o => o.t === 'eat');
      if (eats.length) {
        let b = eats[0], bn = -1;
        for (const o of eats) { const sp = E.findSp(s, o.s).sp; const n = sp.pop - sp.food; if (n > bn) { bn = n; b = o; } }
        if (bn > 0 || !passOk) return fill(b);
      }
      const atks = opts.filter(o => o.t === 'attack' && !o.ignore.length && E.findSp(s, o.target).p !== p);
      if (atks.length) {
        let b = atks[0], bb = -1;
        for (const o of atks) { const tb = E.findSp(s, o.target).sp.body; if (tb > bb) { bb = tb; b = o; } }
        if (E.hungry(E.findSp(s, b.s).sp) || !passOk) return fill(b);
      }
      if (passOk) return { t: 'pass' };
      const forced = opts.find(o => o.must) || opts.find(o => o.t !== 'intel');
      return fill(forced);
    }
    // hard: try every option on a copy (computers inside the copy are switched off) and score it
    let best = null, bv = -Infinity;
    const cands = opts.map(fill);
    if (passOk) cands.push({ t: 'pass' });
    for (const o of cands) {
      let ns;
      try { ns = E.applyRaw(s, p, o); } catch (e) { continue; }
      let v = valueAfter(ns, p);
      if (o.t === 'intel') v -= 0.6; // a card spent
      if (o.ignore && o.ignore.length) v -= 0.6 * o.ignore.length;
      if (v > bv) { bv = v; best = o; }
    }
    return best || fill(opts.find(o => o.must) || opts[0]);
  }
  function valueAfter(ns, p) {
    let opp = 0;
    for (let q = 0; q < ns.players.length; q++) if (q !== p) opp = Math.max(opp, evalFor(ns, q));
    return evalFor(ns, p) - 0.6 * opp;
  }
  // how good a feeding action looks to the Hard computer (one step ahead); used for Study notes
  function rate(s, p, o) {
    let ns;
    try { ns = E.applyRaw(s, p, o); } catch (e) { return -Infinity; }
    return valueAfter(ns, p) - (o.t === 'intel' ? 0.6 : 0) - (o.ignore && o.ignore.length ? 0.6 * o.ignore.length : 0);
  }

  // ------------------------------------------------------------------ entry point
  function decide(s, p, level) {
    const lv = level || s.players[p].bot || 'hard';
    if (s.phase === 'food') return chooseFood(s, p, lv);
    if (s.phase === 'play') return choosePlays(s, p, lv);
    return chooseFeed(s, p, lv);
  }
  E.setBot((s, p) => decide(s, p, s.players[p].bot));
  return { decide, rate, traitValue, threat, plantOutlook, MEAN_FOOD };
});
