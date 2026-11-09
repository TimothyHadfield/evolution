/* Evolution Lab: Evolution: Climate (standalone 2016 / Climate Conversion Pack) rules.
   Everything Climate-only lives here; js/engine.js calls in through small hooks marked "Climate hook".
   Sources: the official Climate rulebook (Evolution-Climate-Rules-web.pdf) + docs/expansions-research.md;
   every rule is listed in docs/rules-check.md ("Climate").

   Round in a Climate game: Deal (4 + 1 per species) -> food card + play cards (fluid, as base) ->
   leaf traits -> Modify Environment:
     1 the marker moves one zone toward whichever of suns / snowflakes is more numerous on the food cards
     2 the face-up event under the marker's zone triggers (at most one a round)
     3 every species loses population to heat or cold at once (minus its protections)
     4 plant food = the food cards' numbers + the zone's leaf number (can be negative)
     5 a triggered event is replaced from its own deck
   -> Feeding -> end of feeding (Migratory, Volcanic Eruption).

   state.climate = { zone, events (on/off), cold: [event ids, top = last], hot: [...], up: {cold, hot},
                     thaw (Glacial Thaw waiting on the hole: its id or null), meteor, volcano (zone or null),
                     aside (Wildfire food held for the next round), tick, night } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.EvoClimate = factory(root.EvoCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  const CARD = Cards.CARD;
  const ALL = [1, 2, 3, 4, 5, 6];
  // the climate board, coldest to hottest (leaf = [2-3 players, 4-6 players]); marker starts at Temperate
  const ZONES = [
    { name: 'Ice Age', type: 'cold', sizes: ALL, loss: 4, leaf: [-15, -30] },
    { name: 'Freezing', type: 'cold', sizes: [1, 2, 3, 4], loss: 2, leaf: [-8, -16] },
    { name: 'Cold', type: 'cold', sizes: [1, 2], loss: 1, leaf: [-4, -8] },
    { name: 'Cool', type: '', sizes: [], loss: 0, leaf: [-2, -4] },
    { name: 'Temperate', type: '', sizes: [], loss: 0, leaf: [0, 0] },
    { name: 'Warm', type: '', sizes: [], loss: 0, leaf: [2, 4] },
    { name: 'Tropical', type: 'heat', sizes: [5, 6], loss: 1, leaf: [6, 12] },
    { name: 'Hot', type: 'heat', sizes: [3, 4, 5, 6], loss: 2, leaf: [3, 6] },
    { name: 'Scorching', type: 'heat', sizes: ALL, loss: 4, leaf: [-10, -20] },
  ];
  const START = 4;
  const Z = n => ZONES.findIndex(z => z.name === n);
  // the 30 event cards (ids 0-14 cold deck, 15-29 hot deck); zone = where it lies face up
  const ev = (deck, zone, kind, x) => Object.assign({ deck, zone: Z(zone), kind }, x || {});
  const HW = (sizes, loss, leaf) => ({ type: 'heat', sizes, loss, leaf });
  const CS = (sizes, loss, leaf) => ({ type: 'cold', sizes, loss, leaf });
  const EVENTS = [
    ev('cold', 'Ice Age', 'Meteorite'),
    ev('cold', 'Freezing', 'Volcanic Eruption', { to: Z('Ice Age') }),
    ev('cold', 'Cool', 'Volcanic Eruption', { to: Z('Cold') }),
    ev('cold', 'Freezing', 'Heat Wave', HW([2, 3, 4, 5, 6], 1, 10)),
    ev('cold', 'Ice Age', 'Heat Wave', HW([4, 5, 6], 2, 10)),
    ev('cold', 'Cool', 'Heat Wave', HW([5, 6], 1, 8)),
    ev('cold', 'Cold', 'Heat Wave', HW([3, 4, 5, 6], 2, 5)),
    ev('cold', 'Cold', 'Heat Wave', HW([3, 4, 5, 6], 1, 10)),
    ev('cold', 'Freezing', 'Cold Snap', CS(ALL, 5, -25)),
    ev('cold', 'Cool', 'Cold Snap', CS([1], 2, -5)),
    ev('cold', 'Cold', 'Cold Snap', CS([1, 2, 3, 4, 5], 2, -10)),
    ev('cold', 'Cold', 'Glacial Thaw'),
    ev('cold', 'Cold', 'Cold Snap', CS([1, 2, 3], 1, -8)),
    ev('cold', 'Cold', 'Volcanic Eruption', { to: Z('Freezing') }),
    ev('cold', 'Freezing', 'Glacial Thaw'),
    ev('hot', 'Scorching', 'Meteorite'),
    ev('hot', 'Tropical', 'Volcanic Eruption', { to: Z('Cold') }),
    ev('hot', 'Scorching', 'Volcanic Eruption', { to: Z('Cold') }),
    ev('hot', 'Warm', 'Heat Wave', HW([2, 3, 4, 5, 6], 1, 10)),
    ev('hot', 'Tropical', 'Heat Wave', HW(ALL, 2, -5)),
    ev('hot', 'Hot', 'Heat Wave', HW([2, 3, 4, 5, 6], 3, -5)),
    ev('hot', 'Tropical', 'Desertification'),
    ev('hot', 'Hot', 'Desertification'),
    ev('hot', 'Tropical', 'Heat Wave', HW([2, 3, 4, 5, 6], 2, 0)),
    ev('hot', 'Warm', 'Wildfire'),
    ev('hot', 'Tropical', 'Wildfire'),
    ev('hot', 'Hot', 'Wildfire'),
    ev('hot', 'Warm', 'Cold Snap', CS([], 0, -3)),
    ev('hot', 'Tropical', 'Cold Snap', CS([1], 2, -5)),
    ev('hot', 'Hot', 'Cold Snap', CS([1, 2], 1, -4)),
  ].map((e, id) => Object.assign({ id }, e));
  // our own short words for each event
  const EVENT_TEXT = {
    'Meteorite': 'From now on no plant food is added when the round’s total is positive (a negative total still removes food). For the rest of the game.',
    'Volcanic Eruption': 'At the end of feeding the marker jumps to the zone named on the card.',
    'Glacial Thaw': 'Next round, 3 extra suns count toward moving the marker.',
    'Desertification': 'Every species shrinks 1 body size (not below 1). No plant food is added this round if the total is positive.',
    'Wildfire': 'Every species without Burrowing loses 1 population (not heat, nothing blocks it). This round’s plant food waits until the next deal.',
    'Heat Wave': 'This round, the card’s heat loss and leaf number replace the zone’s.',
    'Cold Snap': 'This round, the card’s cold loss and leaf number replace the zone’s.',
  };
  // heat / cold loss each trait blocks (the Climate cards' text)
  const PROTECT = {
    'Burrowing': { heat: 1, cold: 1 }, 'Migratory': { heat: 1, cold: 1 }, 'Defensive Herding': { cold: 1 }, 'Hibernation': { cold: 1 },
    'Heavy Fur': { cold: 4 }, 'Cooling Frills': { heat: 3 }, 'Mud Wallowing': { heat: 1 }, 'Nocturnal': { heat: 1 },
  };

  let E = null; // the engine's internals, set by bind() (has, take, attack, extinct, ...)
  function bind(engine) { E = engine; }

  // ------------------------------------------------------------------ setup (inside newGame)
  // 2 players: half the deck set aside, 3: 60, 4: 30, 5-6: none; the set-aside cards become the deck when
  // it runs out (5-6 players reshuffle the discards as usual). Max 4 traits a species (3 with 2 players).
  function setup(s, o) {
    const n = s.players.length;
    s.version = 'climate';
    s.maxTraits = n === 2 ? 3 : 4;
    const out = n === 2 ? Math.floor(s.deck.length / 2) : n === 3 ? 60 : n === 4 ? 30 : 0;
    s.reserve = s.deck.splice(0, out);
    s.removed = out;
    const cold = E.shuffle(s, EVENTS.filter(e => e.deck === 'cold').map(e => e.id));
    const hot = E.shuffle(s, EVENTS.filter(e => e.deck === 'hot').map(e => e.id));
    const on = !(o && o.events === false);
    s.climate = { zone: START, events: on, cold, hot, up: on ? { cold: cold.pop(), hot: hot.pop() } : { cold: null, hot: null },
      thaw: null, meteor: false, volcano: null, aside: 0, tick: 0, night: -1 };
  }
  const dealBase = () => 4;
  const leafOf = (s, z) => ZONES[z].leaf[s.players.length >= 4 ? 1 : 0];

  // ------------------------------------------------------------------ traits
  const hib = sp => (E.has(sp, 'Hibernation') ? 2 : 0);
  function protect(sp, type) {
    let n = 0;
    for (const t in PROTECT) if (PROTECT[t][type] && E.has(sp, t)) n += PROTECT[t][type];
    return n;
  }
  // climate loss of one species under effect eff ({type, sizes, loss}); zone = where the marker is
  function lossOf(sp, eff, zone) {
    if (!eff || !eff.loss || eff.sizes.indexOf(sp.body) < 0) return 0;
    let n = eff.loss;
    // Heavy Fur: 1 more heat loss in the three hottest zones
    if (eff.type === 'heat' && zone >= 6 && E.has(sp, 'Heavy Fur')) n += 1;
    return Math.max(0, n - protect(sp, eff.type));
  }
  // Mud Wallowing: the attacker's owner discards a card before each attack (unless it is switched off)
  function mudCost(T, ignore) { return E.has(T, 'Mud Wallowing', ignore) ? 1 : 0; }
  // Ambush against a Migratory species: one defending trait is ignored for free. Returns the ignore list
  // to use (the given one plus the free trait): the first trait that opens the attack, else one that
  // costs the attacker (Horns, then Mud Wallowing).
  function withAmbush(s, cp, ci, tp, ti, ignore, block0) {
    const C = s.players[cp].species[ci], T = s.players[tp].species[ti];
    ignore = ignore || [];
    if (!C || !T || !E.has(C, 'Ambush') || !E.has(T, 'Migratory', ignore)) return ignore;
    const row = s.players[tp].species;
    const on = t => E.has(T, t, ignore);
    const cand = Cards.DEFENSES.filter(t => on(t) && t !== 'Warning Call');
    if (block0(s, cp, ci, tp, ti, ignore)) {
      for (const t of cand) if (!block0(s, cp, ci, tp, ti, ignore.concat([t]))) return ignore.concat([t]);
      return ignore;
    }
    void row;
    for (const t of ['Horns', 'Mud Wallowing']) if (cand.indexOf(t) >= 0) return ignore.concat([t]);
    return ignore;
  }

  // ------------------------------------------------------------------ Modify Environment (at the reveal)
  // sum = the food cards' numbers; returns the plant food to add to the watering hole now
  function modify(s, sum) {
    const c = s.climate;
    const H = E.cur(s);
    const rec = { from: c.zone, to: c.zone, sun: 0, snow: 0, thaw: false, ev: null, eff: null, lost: [], sum, leaf: 0, added: 0, held: 0 };
    // 1. the marker moves toward the side with more icons (Glacial Thaw adds 3 suns once)
    for (const pl of s.players) if (pl.foodCard >= 0) { const k = CARD[pl.foodCard]; rec.sun += k.sun || 0; rec.snow += k.snow || 0; }
    if (c.thaw != null) { rec.sun += 3; rec.thaw = true; c.cold.unshift(c.thaw); c.thaw = null; }
    if (rec.sun > rec.snow && c.zone < ZONES.length - 1) c.zone++;
    else if (rec.snow > rec.sun && c.zone > 0) c.zone--;
    rec.to = c.zone;
    E.log(s, -1, 'Climate: ' + rec.sun + ' sun' + (rec.sun === 1 ? '' : 's') + ', ' + rec.snow + ' snowflake' + (rec.snow === 1 ? '' : 's') +
      (rec.to === rec.from ? '. The climate stays ' : '. The climate moves to ') + ZONES[c.zone].name + '.', 'sys');
    // 2. the face-up event in this zone (at most one a round)
    let eff = { type: ZONES[c.zone].type, sizes: ZONES[c.zone].sizes, loss: ZONES[c.zone].loss, leaf: leafOf(s, c.zone) };
    let noGain = c.meteor, hold = false, trig = null;
    if (c.events) for (const side of ['cold', 'hot']) { const id = c.up[side]; if (id != null && EVENTS[id].zone === c.zone && trig == null) trig = id; }
    if (trig != null) {
      const e = EVENTS[trig];
      rec.ev = trig;
      E.log(s, -1, 'Climate event: ' + e.kind + '!', 'sys');
      if (e.kind === 'Heat Wave' || e.kind === 'Cold Snap') eff = { type: e.type, sizes: e.sizes, loss: e.loss, leaf: e.leaf };
      else if (e.kind === 'Meteorite') { c.meteor = true; noGain = true; }
      else if (e.kind === 'Volcanic Eruption') c.volcano = e.to;
      else if (e.kind === 'Desertification') {
        noGain = true;
        s.players.forEach((pl, p) => pl.species.forEach(sp => {
          if (sp.body > 1) { sp.body--; if (sp.fat > sp.body) { pl.bag += sp.fat - sp.body; sp.fat = sp.body; } }
        }));
      } else if (e.kind === 'Wildfire') {
        hold = true;
        eachSpecies(s, (p, sp) => (E.has(sp, 'Burrowing') ? 0 : 1), rec, 'fire');
      }
    }
    rec.eff = eff;
    // 3. heat / cold loss, every species at once
    if (eff.loss) eachSpecies(s, (p, sp) => lossOf(sp, eff, c.zone), rec, eff.type);
    // 4. plant food: the cards' total plus the zone's (or the card's) leaf number
    rec.leaf = eff.leaf;
    let total = sum + eff.leaf;
    if (noGain && total > 0) total = 0;
    if (hold) { c.aside += total; rec.held = total; total = 0; }
    rec.added = total;
    if (eff.leaf) E.log(s, -1, ZONES[c.zone].name + (trig != null && eff !== null && (EVENTS[trig].kind === 'Heat Wave' || EVENTS[trig].kind === 'Cold Snap') ? ' (' + EVENTS[trig].kind + ')' : '') + ': ' + (eff.leaf > 0 ? '+' : '') + eff.leaf + ' plant food.', 'sys');
    if (noGain && sum + eff.leaf > 0) E.log(s, -1, (c.meteor ? 'Meteorite' : 'Desertification') + ': no plant food is added.', 'sys');
    if (hold) E.log(s, -1, 'Wildfire: ' + rec.held + ' plant food waits until the next deal.', 'sys');
    // 5. a triggered event goes to the bottom of its deck (Glacial Thaw lies on the hole for a round) and is replaced
    if (trig != null) {
      const e = EVENTS[trig], deck = c[e.deck];
      if (e.kind === 'Glacial Thaw') c.thaw = trig; else deck.unshift(trig);
      c.up[e.deck] = deck.pop();
    }
    H.cl = rec;
    c.tick++; c.night = -1;
    return total;
  }
  // every species loses f(p, sp) population at the same moment; extinct ones go after everyone has lost
  function eachSpecies(s, f, rec, why) {
    const hits = [];
    s.players.forEach((pl, p) => pl.species.forEach(sp => { const n = f(p, sp); if (n > 0) hits.push([p, sp, n]); }));
    for (const [p, sp, n0] of hits) {
      const n = Math.min(n0, sp.pop);
      const pl = s.players[p];
      sp.pop -= n;
      E.cur(s).popLost[p] += n;
      if (sp.food > sp.pop) { pl.bag += sp.food - sp.pop; sp.food = Math.max(0, sp.pop); }
      rec.lost.push([p, sp.id, n, why]);
      E.log(s, p, E.pname(s, p) + '’s ' + sp.body + '/' + (sp.pop + n) + ' species loses ' + n + ' population to ' + (why === 'fire' ? 'the wildfire' : why) + '.');
    }
    for (const [p, sp] of hits) if (sp.pop <= 0) E.extinct(s, p, sp);
  }

  // ------------------------------------------------------------------ feeding
  // Nocturnal: before each of your feeding turns, a Nocturnal species feeds once for free if no Carnivore
  // in play could attack it (Intelligence counts only when its owner holds enough cards; a fed Carnivore
  // can't attack). A plant eater takes 1 from the watering hole; a Carnivore attacks the biggest rival it
  // can without spending cards (simplification: the free feeding is always taken when it helps).
  function beforeTurn(s) {
    const c = s.climate;
    if (!c || s.turn < 0 || c.night === c.tick) return;
    c.night = c.tick;
    const p = s.turn;
    for (const sp of s.players[p].species.slice()) {
      if (!E.has(sp, 'Nocturnal') || sp.pop <= 0 || E.needFood(sp) <= 0) continue;
      const loc = E.findSp(s, sp.id);
      if (!loc || threatened(s, loc.p, loc.i)) continue;
      if (!E.isCarn(sp)) {
        if (s.hole > 0) { const n = E.take(s, p, sp, 1, 'plant', 'hole'); if (n) E.log(s, p, E.pname(s, p) + '’s Nocturnal species feeds at night: ' + n + ' plant food.'); }
      } else {
        let best = null;
        s.players.forEach((op, tp) => { if (tp !== p) op.species.forEach((T, ti) => {
          if (!E.attackBlock(s, p, loc.i, tp, ti) && !mudCost(T, withAmbush(s, p, loc.i, tp, ti, [], E.attackBlock0)) && (!best || T.body > best.T.body)) best = { tp, ti, T };
        }); });
        if (best) { E.log(s, p, E.pname(s, p) + '’s Nocturnal Carnivore hunts at night.'); E.attack(s, p, loc.i, best.tp, best.ti, withAmbush(s, p, loc.i, best.tp, best.ti, [], E.attackBlock0)); }
      }
    }
  }
  function threatened(s, tp, ti) {
    for (let cp = 0; cp < s.players.length; cp++) {
      const row = s.players[cp].species, hand = s.players[cp].hand.length;
      for (let ci = 0; ci < row.length; ci++) {
        const C = row[ci];
        if (!E.isCarn(C) || (cp === tp && ci === ti) || E.canTake(C) <= 0) continue;
        const need = E.intelNeeded(s, cp, ci, tp, ti, hand);
        if (!need) continue;
        const eff = withAmbush(s, cp, ci, tp, ti, need, E.attackBlock0);
        if (need.length + mudCost(s.players[tp].species[ti], eff) <= hand) return true;
      }
    }
    return false;
  }
  // after the last feeding: Migratory takes 2 plant food from the bank if the hole is empty; a Volcanic
  // Eruption moves the marker
  function afterFeeding(s) {
    const c = s.climate;
    if (s.hole <= 0) {
      for (let k = 0; k < s.players.length; k++) {
        const p = (s.first + k) % s.players.length;
        for (const sp of s.players[p].species.slice()) if (E.has(sp, 'Migratory') && sp.pop > 0) {
          const n = E.take(s, p, sp, 2, 'plant', 'bank');
          if (n) E.log(s, p, E.pname(s, p) + '’s Migratory species takes ' + n + ' plant food from the bank.');
        }
      }
    }
    if (c.volcano != null) {
      c.zone = c.volcano; c.volcano = null;
      E.log(s, -1, 'Volcanic Eruption: the climate jumps to ' + ZONES[c.zone].name + '.', 'sys');
    }
  }
  // before the deal: food a Wildfire held back goes to the watering hole
  function beforeDeal(s) {
    const c = s.climate;
    if (!c || !c.aside) return;
    const before = s.hole;
    s.hole = Math.max(0, s.hole + c.aside);
    E.log(s, -1, 'After the wildfire: ' + (s.hole - before >= 0 ? '+' : '') + (s.hole - before) + ' plant food to the watering hole.', 'sys');
    c.aside = 0;
  }

  // ------------------------------------------------------------------ Play Cards: cycling
  // After playing cards, a player may put cards from hand on the bottom of the deck and draw as many from
  // the top (never more than the deck holds). pl = the player's copy being changed.
  function cycle(s, pl, cards) {
    if (!Array.isArray(cards) || !cards.length) return null;
    if (new Set(cards).size !== cards.length || cards.some(c => pl.hand.indexOf(c) < 0)) throw new Error('You can only put back cards in your hand');
    if (cards.length > s.deck.length) throw new Error('The deck holds only ' + s.deck.length + ' cards');
    return () => {
      for (const c of cards) pl.hand.splice(pl.hand.indexOf(c), 1);
      for (const c of cards) s.deck.unshift(c);
      for (let i = 0; i < cards.length; i++) pl.hand.push(s.deck.pop());
      pl.hand.sort((a, b) => a - b);
    };
  }

  // ------------------------------------------------------------------ what everyone sees
  function view(s) {
    const c = s.climate;
    return { zone: c.zone, leaf: leafOf(s, c.zone), events: c.events, up: { cold: c.up.cold, hot: c.up.hot }, thaw: c.thaw != null, meteor: c.meteor, volcano: c.volcano, aside: c.aside,
      reserve: (s.reserve || []).length, coldLeft: c.cold.length, hotLeft: c.hot.length };
  }
  // what the zone does (for screens and bots): {type, sizes, loss, leaf}
  function zoneEffect(nPlayers, z) { const Zn = ZONES[z]; return { type: Zn.type, sizes: Zn.sizes, loss: Zn.loss, leaf: Zn.leaf[nPlayers >= 4 ? 1 : 0] }; }

  return { ZONES, EVENTS, EVENT_TEXT, PROTECT, START, bind, setup, dealBase, hib, protect, lossOf, mudCost, withAmbush, modify, beforeTurn, threatened,
    afterFeeding, beforeDeal, cycle, view, zoneEffect, leafOf };
});
