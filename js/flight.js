/* Evolution Lab: the expansion rules (Evolution: Flight 2015 rulebook, Promo Packs I-III).
   Sources for every rule: docs/rules-check.md ("Flight" and "Promo cards"). The engine (js/engine.js) keeps
   the core rules and calls in here at a few points; base games (no state.exp, or exp.v 'base' with no
   promos) never change here, so old saves and base results stay exactly the same.

   What lives here:
   - setup: the cliff, the 12 Flight cards (kept out of the deck), 40 cards set aside for the final round
   - the event step: after traits are revealed and before the leaf traits, each player in turn order may
     play event cards (Dive-Bomb, Seed Dispersal, Pounce, Invasive Species), resolve Rapid Mutation, choose
     a Mimicry copy or pay for Claws' Climbing. Action shapes:
       {t:'ev', card, s, src | target, ignore, cards}   an event card
       {t:'mutate', s, card, discard:[a,b]}              Rapid Mutation (card = trait from hand, or null)
       {t:'mimic', s, from}                               Mimicry copies trait card `from` this round
       {t:'claws', s, card}                               Claws: discard a card, Climbing this round
       {t:'evdone'}                                       done with events
   - Last Stand: an attack on a species whose owner holds Last Stand stops (phase 'react') until the
     owner answers {t:'react', card | null}
   - Nesting after card plays, the cliff and Unstable DNA at the food reveal, Insectivore, end of round. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.EvoFlight = factory(root.EvoCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  let K = null; // engine pieces, given by engine.js
  function bind(k) { K = k; }
  const T = id => Cards.ALL[id].trait;
  const isFlight = s => K.X(s).v === 'flight';
  const plain = s => { const x = K.X(s); return x.v === 'base' && !x.promos.length; }; // a base game: nothing here acts
  const findCard = (hand, t) => hand.find(id => T(id) === t);

  // ------------------------------------------------------------------ setup
  function setup(s, n) {
    if (s.exp.v !== 'flight') return;
    s.cliff = 0;
    s.flights = Cards.FLIGHT_CARDS.slice();
    // "Remove 40 cards from the deck and place them off to the side. These cards will be used at the end
    // of the game instead of shuffling the discard pile." (Flight rulebook, Set-Up 3)
    s.reserve = s.deck.splice(0, 40);
  }
  // a card drawn outside the deal (events, Rapid Mutation): running out makes the next round the last
  function drawMid(s, p, k) {
    if (K.draw(s, p, k) && !s.lastRound) { s.lastNext = true; K.log(s, -1, 'The deck ran out. Next round is the last.', 'sys'); }
  }
  // Nesting for a population gained by playing a card (the engine's gainPop covers every other gain)
  function nest(s, p, sp) {
    const got = sp.av ? K.take(s, p, sp, 2, 'meat', 'bank') : K.take(s, p, sp, 1, 'plant', 'bank');
    if (got) K.log(s, p, K.pname(s, p) + '’s Nesting takes ' + got + (sp.av ? ' meat' : ' plant food') + ' from the bank.');
  }
  function afterPlays(s, p, moves, made) {
    if (plain(s)) return;
    const row = s.players[p].species;
    for (const m of moves) {
      if (m.t !== 'pop') continue;
      const sid = typeof m.s === 'number' && m.s < 0 ? made[-m.s - 1] : m.s;
      const sp = row.find(x => x.id === sid);
      if (sp && K.has(sp, 'Nesting')) nest(s, p, sp); // face-up Nesting only (a card played this turn is still face down)
    }
    for (const sp of row) K.settleUp(sp);
  }

  // ------------------------------------------------------------------ the event step
  function startEvents(s, flipped) {
    if (plain(s)) return false;
    s.mut = [];
    s.mimicked = {};
    // Rapid Mutation: when it is revealed, draw 3 cards; the owner then swaps it and discards 2
    for (const f of flipped) if (T(f.id) === 'Rapid Mutation') { drawMid(s, f.p, 3); s.mut.push({ p: f.p, s: f.s, card: f.id }); K.log(s, f.p, K.pname(s, f.p) + '’s Rapid Mutation draws 3 cards.'); }
    return evNext(s, 0);
  }
  function evNext(s, k) {
    for (; k < s.players.length; k++) {
      const p = (s.first + k) % s.players.length;
      if (hasWork(s, p)) { s.phase = 'event'; s.ev = { k, turn: p }; return true; }
    }
    s.ev = null; s.mut = null;
    return false;
  }
  const hasWork = (s, p) => eventOptions(s, p).some(o => o.t !== 'evdone');
  // after an event action: the same player goes on while they still have something to play
  function evContinue(s, p) {
    if (s.phase !== 'event' || !s.ev || s.ev.turn !== p) return;
    if (hasWork(s, p)) return;
    if (!evNext(s, s.ev.k + 1)) { s.phase = 'leaf'; K.leafStart(s); }
  }
  // every legal event-step action for player p (works on a view-built state too: needs hand, species, hole, cliff)
  function eventOptions(s, p) {
    const pl = s.players[p];
    const out = [];
    if (!pl) return out;
    const mine = pl.species;
    const mut = (s.mut || []).find(m => m.p === p && mine.some(x => x.id === m.s && x.traits.indexOf(m.card) >= 0));
    if (mut) {
      // Rapid Mutation first: swap it for a trait card from your hand (not an event, not one it already has)
      const sp = mine.find(x => x.id === mut.s);
      const others = sp.traits.filter(id => id !== mut.card).map(T);
      const seen = {};
      for (const c of pl.hand) if (!Cards.isEvent(c) && others.indexOf(T(c)) < 0 && !seen[T(c)]) { seen[T(c)] = 1; out.push({ t: 'mutate', s: sp.id, card: c }); }
      if (!out.length) out.push({ t: 'mutate', s: sp.id, card: null });
      return out;
    }
    const seenEv = {};
    for (const c of pl.hand) {
      const t = T(c);
      if (!Cards.isEvent(c) || seenEv[t]) continue;
      seenEv[t] = 1;
      if (t === 'Dive-Bomb') {
        mine.forEach((sp, i) => {
          if (!sp.av || K.canTake(sp) <= 0) return;
          if (!K.isCarn(sp)) {
            out.push({ t: 'ev', card: c, s: sp.id, src: 'bank' });
            if (s.hole > 0) out.push({ t: 'ev', card: c, s: sp.id, src: 'hole' });
            if (s.cliff > 0) out.push({ t: 'ev', card: c, s: sp.id, src: 'cliff' });
          } else s.players.forEach((op, tp) => op.species.forEach((X, ti) => { if (!(tp === p && ti === i) && !K.attackBlock(s, p, i, tp, ti)) out.push({ t: 'ev', card: c, s: sp.id, target: X.id }); }));
        });
      } else if (t === 'Seed Dispersal') out.push({ t: 'ev', card: c });
      else if (t === 'Pounce') {
        mine.forEach((sp, i) => {
          if (sp.av || !K.isCarn(sp) || K.canTake(sp) <= 0) return;
          s.players.forEach((op, tp) => op.species.forEach((X, ti) => {
            if (tp === p && ti === i) return;
            const free = pounceIgnore(s, p, i, tp, ti);
            if (free) out.push({ t: 'ev', card: c, s: sp.id, target: X.id, ignore: free });
          }));
        });
      } else if (t === 'Invasive Species') mine.forEach(sp => { if (!K.isCarn(sp) && !sp.inv) out.push({ t: 'ev', card: c, s: sp.id }); });
    }
    // Mimicry: copy one face-up trait of another species for this round (once per round)
    mine.forEach(sp => {
      if (!K.has(sp, 'Mimicry') || (s.mimicked && s.mimicked[sp.id])) return;
      const seen = {};
      s.players.forEach(op => op.species.forEach(X => {
        if (X === sp) return;
        for (const id of X.traits) { const t = T(id); if (seen[t] || t === 'Mimicry' || t === 'Flight' || K.has(sp, t)) continue; seen[t] = 1; out.push({ t: 'mimic', s: sp.id, from: id }); }
      }));
    });
    // Claws: discard a card for Climbing this round
    if (pl.hand.length) mine.forEach(sp => { if (K.has(sp, 'Claws') && !K.has(sp, 'Climbing')) out.push({ t: 'claws', s: sp.id }); });
    out.push({ t: 'evdone' });
    return out;
  }
  // Pounce ignores one defending trait for free: [] = no need, [t] = the one to switch off, null = still impossible
  function pounceIgnore(s, p, i, tp, ti) {
    const X = s.players[tp].species[ti];
    if (!K.attackBlock(s, p, i, tp, ti)) return K.has(X, 'Horns') ? ['Horns'] : [];
    const row = s.players[tp].species;
    for (const t of Cards.XDEFENSES) {
      const there = K.has(X, t) || (t === 'Warning Call' && ((row[ti - 1] && K.has(row[ti - 1], t)) || (row[ti + 1] && K.has(row[ti + 1], t))));
      if (there && !K.attackBlock(s, p, i, tp, ti, [t])) return [t];
    }
    return null;
  }

  function eventAct(s, p, a) {
    const pl = s.players[p];
    const own = id => { const sp = pl.species.find(x => x.id === id); if (!sp) throw new Error('Not your species'); return sp; };
    const pending = (s.mut || []).find(m => m.p === p && pl.species.some(x => x.id === m.s && x.traits.indexOf(m.card) >= 0));
    if (a.t === 'evdone') {
      if (pending) throw new Error('Rapid Mutation: swap it for a card from your hand first');
      if (!evNext(s, s.ev.k + 1)) { s.phase = 'leaf'; K.leafStart(s); }
      return;
    }
    if (a.t === 'mutate') {
      if (!pending || pending.s !== a.s) throw new Error('No Rapid Mutation to resolve');
      const sp = own(a.s);
      const opts = eventOptions(s, p).filter(o => o.t === 'mutate');
      if (!opts.some(o => o.card === a.card || (o.card != null && a.card != null && T(o.card) === T(a.card) && pl.hand.indexOf(a.card) >= 0))) throw new Error('Pick a trait card from your hand it does not have');
      const dis = Array.isArray(a.discard) ? a.discard : [];
      const handAfter = pl.hand.filter(c => c !== a.card);
      const need = Math.min(2, handAfter.length);
      if (dis.length !== need || new Set(dis).size !== dis.length || dis.some(c => handAfter.indexOf(c) < 0)) throw new Error('Discard ' + need + ' card' + (need === 1 ? '' : 's'));
      sp.traits.splice(sp.traits.indexOf(pending.card), 1);
      s.discard.push(pending.card);
      if (a.card != null) { pl.hand.splice(pl.hand.indexOf(a.card), 1); sp.traits.push(a.card); }
      for (const c of dis) { pl.hand.splice(pl.hand.indexOf(c), 1); s.discard.push(c); }
      s.mut = s.mut.filter(m => m !== pending);
      K.log(s, p, K.pname(s, p) + '’s Rapid Mutation becomes ' + (a.card != null ? T(a.card) : 'nothing') + '; 2 cards discarded.');
      return evContinue(s, p);
    }
    if (pending) throw new Error('Rapid Mutation: swap it for a card from your hand first');
    if (a.t === 'mimic') {
      const sp = own(a.s);
      if (!eventOptions(s, p).some(o => o.t === 'mimic' && o.s === a.s && o.from === a.from)) throw new Error('Mimicry can’t copy that');
      sp.tmp = (sp.tmp || []).concat([T(a.from)]);
      s.mimicked[sp.id] = 1;
      K.log(s, p, K.pname(s, p) + '’s Mimicry copies ' + T(a.from) + ' this round.');
      return evContinue(s, p);
    }
    if (a.t === 'claws') {
      const sp = own(a.s);
      if (!K.has(sp, 'Claws') || K.has(sp, 'Climbing')) throw new Error('Needs Claws (and no Climbing yet)');
      const k = pl.hand.indexOf(a.card);
      if (k < 0) throw new Error('Pick a card to discard');
      pl.hand.splice(k, 1); s.discard.push(a.card);
      sp.tmp = (sp.tmp || []).concat(['Climbing']);
      K.log(s, p, K.pname(s, p) + '’s Claws: discards a card for Climbing this round.');
      return evContinue(s, p);
    }
    if (a.t !== 'ev') throw new Error('Play an event card or tap Done');
    const k = pl.hand.indexOf(a.card);
    if (k < 0 || !Cards.isEvent(a.card)) throw new Error('That event card is not in your hand');
    const t = T(a.card);
    let attackFrom = null; // {sp, target, ignore, cards}
    if (t === 'Dive-Bomb') {
      const sp = own(a.s);
      if (!sp.av) throw new Error('Dive-Bomb feeds one of your Avian species');
      if (K.canTake(sp) <= 0) throw new Error('That species is full');
      if (K.isCarn(sp)) {
        const ignore = Array.isArray(a.ignore) ? a.ignore : [], cards = Array.isArray(a.cards) ? a.cards : [];
        if (ignore.some(x => !K.canIgnore(sp, x))) throw new Error('It can’t switch that trait off');
        if (cards.length !== ignore.length || cards.some(c => c === a.card || pl.hand.indexOf(c) < 0) || new Set(cards).size !== cards.length) throw new Error('Discard one card for each trait you switch off');
        attackFrom = { sp, target: a.target, ignore, cards };
      } else if (['bank', 'hole', 'cliff'].indexOf(a.src) < 0 || (a.src === 'hole' && !(s.hole > 0)) || (a.src === 'cliff' && !(s.cliff > 0))) throw new Error('Take the food from the watering hole, the cliff or the bank');
    } else if (t === 'Pounce') {
      const sp = own(a.s);
      if (sp.av || !K.isCarn(sp)) throw new Error('Pounce is for a land Carnivore');
      if (K.canTake(sp) <= 0) throw new Error('That Carnivore is full');
      const ignore = Array.isArray(a.ignore) ? a.ignore.slice(0, 1) : [];
      attackFrom = { sp, target: a.target, ignore, cards: [] };
    } else if (t === 'Invasive Species') {
      const sp = own(a.s);
      if (K.isCarn(sp)) throw new Error('Invasive Species goes on a plant eater');
    } else if (t !== 'Seed Dispersal') throw new Error(t + ' is played when a Carnivore attacks you');
    if (attackFrom) {
      const tl = K.findSp(s, attackFrom.target);
      if (!tl) throw new Error('No such target');
      const ci = pl.species.indexOf(attackFrom.sp);
      const why = K.attackBlock(s, p, ci, tl.p, tl.i, attackFrom.ignore);
      if (why) throw new Error(why);
    }
    // the card goes to the discard pile and takes effect at once
    pl.hand.splice(k, 1); s.discard.push(a.card);
    if (t === 'Dive-Bomb' && !attackFrom) {
      const sp = own(a.s);
      const got = K.take(s, p, sp, 2, 'plant', a.src);
      K.log(s, p, K.pname(s, p) + ' plays Dive-Bomb: the Avian takes ' + got + ' plant food from the ' + (a.src === 'hole' ? 'watering hole' : a.src) + '.');
    } else if (t === 'Seed Dispersal') {
      const n = s.players.reduce((x, q) => x + q.species.filter(sp => sp.av).length, 0);
      s.hole += n;
      K.log(s, p, K.pname(s, p) + ' plays Seed Dispersal: +' + n + ' plant food in the watering hole (1 per Avian).');
    } else if (t === 'Invasive Species') {
      own(a.s).inv = true;
      K.log(s, p, K.pname(s, p) + ' plays Invasive Species: that species grows each time another species is attacked this round.');
    }
    drawMid(s, p, 1);
    if (attackFrom) {
      for (const c of attackFrom.cards) { pl.hand.splice(pl.hand.indexOf(c), 1); s.discard.push(c); }
      K.log(s, p, K.pname(s, p) + ' plays ' + t + '.');
      const tl = K.findSp(s, attackFrom.target);
      if (lastStandAsk(s, p, attackFrom.sp.id, tl.sp.id, attackFrom.ignore, 'event')) return;
      K.attack(s, p, pl.species.indexOf(attackFrom.sp), tl.p, tl.i, attackFrom.ignore);
    }
    evContinue(s, p);
  }

  // ------------------------------------------------------------------ Last Stand (Promo Pack II)
  function lastStandAsk(s, p, cid, tid, ignore, after) {
    const tl = K.findSp(s, tid);
    if (!tl || tl.p === p || !findCard(s.players[tl.p].hand, 'Last Stand')) return false;
    s.pending = { p, c: cid, tp: tl.p, t: tid, ignore: ignore.slice(), after, back: s.phase };
    s.phase = 'react';
    return true;
  }
  function react(s, seat, a) {
    const P = s.pending;
    if (!P || a.t !== 'react') throw new Error('Play Last Stand or let the attack happen');
    if (a.card != null && (s.players[seat].hand.indexOf(a.card) < 0 || T(a.card) !== 'Last Stand')) throw new Error('That is not a Last Stand card in your hand');
    s.pending = null; s.phase = P.back;
    const cl = K.findSp(s, P.c), tl = K.findSp(s, P.t);
    if (cl && tl) {
      if (a.card != null) {
        const pl = s.players[seat];
        pl.hand.splice(pl.hand.indexOf(a.card), 1); s.discard.push(a.card);
        K.cur(s).attacks++;
        K.log(s, seat, K.pname(s, seat) + ' plays Last Stand: the attacking Carnivore loses 1 population and gets nothing.', 'atk');
        K.loseOne(s, P.p, cl.sp);
        if (cl.sp.pop <= 0) K.extinct(s, P.p, cl.sp);
        drawMid(s, seat, 1);
      } else K.attack(s, P.p, cl.i, tl.p, tl.i, P.ignore);
    }
    if (P.after === 'feed') { s.passes = 0; return K.nextTurn(s); }
    evContinue(s, P.p);
  }

  // ------------------------------------------------------------------ reveal, feeding turns, end of round
  function leafInTurn(s) { return !plain(s); }
  function onFoodReveal(s) {
    if (plain(s)) return;
    s.fseq = 0; s.insSeq = -1;
    // "Each turn when the Food Cards are revealed, place Plant Food on the Cliff equal to the number of players."
    if (isFlight(s)) { s.cliff = (s.cliff || 0) + s.players.length; K.log(s, -1, 'The cliff gets ' + s.players.length + ' plant food (now ' + s.cliff + ').', 'sys'); }
    // Unstable DNA: food was left in the watering hole from last round -> a new species
    if (K.cur(s).holeStart > 0) K.eachInOrder(s, p => {
      const pl = s.players[p];
      const n = pl.species.filter(sp => K.has(sp, 'Unstable DNA')).length;
      for (let i = 0; i < n; i++) { pl.species.push(K.newSpecies(s)); K.log(s, p, K.pname(s, p) + '’s Unstable DNA makes a new species.'); }
    });
  }
  // Insectivore: before each of your feeding turns, 1 meat from the bank if the watering hole has food
  function turnStart(s) {
    if (s.fseq == null || s.insSeq === s.fseq) return;
    s.insSeq = s.fseq;
    if (!(s.hole > 0) || s.turn < 0) return;
    for (const sp of s.players[s.turn].species) if (K.has(sp, 'Insectivore') && K.canTake(sp) > 0) {
      const got = K.take(s, s.turn, sp, 1, 'meat', 'bank');
      if (got) K.log(s, s.turn, K.pname(s, s.turn) + '’s Insectivore takes 1 meat from the bank.');
    }
  }
  function endRound(s) {
    if (plain(s)) return;
    s.players.forEach(pl => pl.species.forEach(sp => {
      // Mimicry is discarded after the round it copied a trait
      if (s.mimicked && s.mimicked[sp.id]) { const k = sp.traits.findIndex(id => T(id) === 'Mimicry'); if (k >= 0) s.discard.push(sp.traits.splice(k, 1)[0]); }
      delete sp.tmp; delete sp.noAtk; delete sp.inv;
    }));
    s.mimicked = null; s.fseq = null; s.insSeq = null;
  }

  return { bind, setup, afterPlays, startEvents, eventOptions, eventAct, lastStandAsk, react, leafInTurn, onFoodReveal, turnStart, endRound, pounceIgnore };
});
