/* Evolution Lab: the rules engine (Evolution 2nd edition, 2017 rulebook + designer errata).
   Pure functions over a JSON state; one seeded random stream lives in state.seed, so
   apply(state, seat, action) is deterministic. Every rule is listed with its source in docs/rules-check.md.

   Round = 1 deal (a species for anyone with none; 3 cards + 1 per species)
         -> 2 food (everyone puts a card face down at the watering hole, at once)
         -> 3 play (clockwise from the first player, one turn each; Quick Play: everyone at once)
         -> 4 reveal (traits flip; Fertile, Fat Tissue, Long Neck; food cards add plant food)
         -> 5 feeding (clockwise, one feeding per turn, you must feed if a hungry species can eat)
         -> end (population drops to food eaten, food behind the screen, first player passes left)
   Fluid play (state.fluid, every new game unless newGame({fluid:false})): steps 2 and 3 are one step.
   Each player places their food card during their own play turn, in the same action as their card
   plays ({t:'play', moves, food}); Tim's chosen variant (docs/rules-check.md). Saves from before it
   have no state.fluid and keep the two steps.
   Computer seats are answered inside the engine (players[i].bot), so an online room never waits on
   a network move for them. state.stepBots leaves computer FEEDING turns to the screen (so you can
   watch them one at a time on this device). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'), require('./flight.js'));
  else root.EvoEngine = factory(root.EvoCards, root.EvoFlight);
})(typeof self !== 'undefined' ? self : this, function (Cards, Flight) {
  'use strict';
  // every card id any game can hold (base 0-128, expansions after); the base deck alone is Cards.DECK
  const DECK = Cards.ALL;
  const MAX = 6;
  // the expansion rules of this game (state.exp; saves from before it are the base game)
  const BASE_EXP = { v: 'base', promos: [], scen: null };
  const X = s => s.exp || BASE_EXP;
  const clone = x => JSON.parse(JSON.stringify(x));
  let BOT = null; // set by bots.js: function(state, seat) -> action
  function setBot(fn) { BOT = fn; }

  // ------------------------------------------------------------------ random (mulberry32 on state.seed)
  function rand(s) {
    let a = (s.seed = (s.seed + 0x6d2b79f5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(s, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  // ------------------------------------------------------------------ helpers
  const trait = id => DECK[id].trait;
  // has(species, trait, ignore) - ignore = list of trait names switched off by Intelligence.
  // sp.tmp = traits a species holds for this round only (Mimicry, Claws' Climbing)
  const has = (sp, t, ignore) => !(ignore && ignore.indexOf(t) >= 0) && (sp.traits.some(id => trait(id) === t) || !!(sp.tmp && sp.tmp.indexOf(t) >= 0));
  const isCarn = sp => has(sp, 'Carnivore');
  const fatRoom = sp => (has(sp, 'Fat Tissue') ? Math.max(0, sp.body - sp.fat) : 0);
  // Flight: an Avian (sp.av) must first eat food equal to its body size (upkeep, sp.up, never scored)
  const maxBody = sp => (sp.av ? 3 : MAX);
  const upNeed = sp => (sp.av ? Math.max(0, sp.body - (sp.up || 0)) : 0);
  const needFood = sp => Math.max(0, sp.pop - sp.food) + upNeed(sp);   // "hungry" in the rules
  const canTake = sp => needFood(sp) + fatRoom(sp);       // food it may still take (Fat Tissue counts)
  const hungry = sp => needFood(sp) > 0;
  // one food onto a species: Avian upkeep first, then population, then Fat Tissue
  function addFood(sp) { if (upNeed(sp) > 0) sp.up = (sp.up || 0) + 1; else if (sp.food < sp.pop) sp.food++; else sp.fat++; }
  // an Avian's body grew: food already on its population moves down to the upkeep spaces (Flight rulebook, Nesting)
  function settleUp(sp) { while (sp.av && upNeed(sp) > 0 && sp.food > 0) { sp.food--; sp.up = (sp.up || 0) + 1; } }
  function findSp(s, id) {
    for (let p = 0; p < s.players.length; p++) {
      const i = s.players[p].species.findIndex(x => x.id === id);
      if (i >= 0) return { p, i, sp: s.players[p].species[i] };
    }
    return null;
  }
  function log(s, p, text, kind) { s.log.push({ r: s.round, p, t: text, k: kind || '' }); if (s.log.length > 300) s.log.splice(0, s.log.length - 300); }
  const pname = (s, p) => s.players[p].name;
  const cur = s => s.hist[s.hist.length - 1];

  // ------------------------------------------------------------------ setup
  // o = {seed, players:[{name, bot}], quick (Quick Play variant), fluid (food card placed in the play turn;
  //      default on), stepBots, trace}
  // o.exp = {v: 'base' | 'flight' | 'climate', promos: [promo set keys], scen: scenario name or null}
  function cleanExp(e) {
    e = e || {};
    const v = ['base', 'flight', 'climate'].indexOf(e.v) >= 0 ? e.v : 'base';
    const promos = (Array.isArray(e.promos) ? e.promos : []).filter((k, i, a) => Cards.PROMOS[k] && a.indexOf(k) === i);
    const scen = e.scen && Cards.SCENARIOS[e.scen] ? e.scen : null;
    return Object.assign({}, e, { v, promos, scen });
  }
  function newGame(o) {
    o = o || {};
    const n = Math.max(2, Math.min(6, (o.players || []).length || 2));
    const exp = cleanExp(o.exp);
    const s = {
      v: 1, seed: (o.seed >>> 0) || 1, round: 0, phase: 'deal', first: 0, turn: -1, playTurn: -1, passes: 0, fluid: o.fluid !== false,
      deck: [], discard: [], hole: 0, nextId: 1, log: [], lastRound: false, lastNext: false, over: false, result: null,
      // 2 players: 40 cards out, 2 traits per species. 6 players: Quick Play is required.
      quick: n === 6 ? true : !!o.quick, maxTraits: n === 2 ? 2 : 3, removed: 0,
      hist: [], stepBots: !!o.stepBots, trace: o.trace ? { rounds: [], life: [] } : null,
      exp, players: [],
    };
    if (exp.scen === 'Cretaceous Period') s.maxTraits = 99;
    if (exp.scen === 'Great Permian Extinction') s.maxTraits = 1;
    for (let i = 0; i < n; i++) {
      const pl = (o.players && o.players[i]) || {};
      s.players.push({ name: Array.from(String(pl.name || 'Player ' + (i + 1))).slice(0, 24).join(''), bot: pl.bot || null,
        hand: [], bag: 0, species: [], foodCard: null, done: false, eaten: 0 });
    }
    s.deck = shuffle(s, Cards.buildDeck(exp));
    if (n === 2) { s.deck.splice(0, 40); s.removed = 40; }
    if (Flight) Flight.setup(s, n); // Flight: the cliff, the 12 Flight cards, 40 cards set aside for the end
    s.first = Math.floor(rand(s) * n);
    startRound(s);
    autoplay(s);
    return s;
  }
  // Teeming Hordes (scenario): new species start at population 2
  function newSpecies(s) { return { id: s.nextId++, body: 1, pop: X(s).scen === 'Teeming Hordes' ? 2 : 1, food: 0, fat: 0, traits: [], hidden: [], born: s.round }; }

  // draw k cards; returns true if the deck ran out (reshuffled, or no cards left anywhere)
  function draw(s, p, k) {
    const pl = s.players[p];
    let reshuffled = false;
    for (let i = 0; i < k; i++) {
      if (!s.deck.length && s.reserve && s.reserve.length) {
        // Flight: the 40 cards set aside at the start are used instead of shuffling the discard pile
        s.deck = s.reserve; s.reserve = []; reshuffled = true;
      }
      if (!s.deck.length) {
        // no discards to reshuffle either: the deck has still run out, so the game must end
        if (!s.discard.length) { reshuffled = true; break; }
        s.deck = shuffle(s, s.discard); s.discard = []; reshuffled = true;
      }
      pl.hand.push(s.deck.pop());
    }
    pl.hand.sort((a, b) => a - b);
    return reshuffled;
  }

  // ------------------------------------------------------------------ round flow
  function startRound(s) {
    s.round++;
    if (s.lastNext) { s.lastRound = true; s.lastNext = false; }
    s.hist.push({ round: s.round, holeStart: s.hole, foodCards: [], added: 0, eaten: s.players.map(() => 0), popLost: s.players.map(() => 0), attacks: 0, extinct: 0 });
    // 1. deal: a new species for anyone with none, then 3 cards + 1 per species, from the first player
    s.players.forEach(pl => { if (!pl.species.length) pl.species.push(newSpecies(s)); });
    // scenarios: Land of Plenty = 10 cards in the first deal; Radioactive Atmosphere = 2 cards per species
    const scen = X(s).scen;
    for (let k = 0; k < s.players.length; k++) {
      const p = (s.first + k) % s.players.length;
      const nDeal = scen === 'Land of Plenty' && s.round === 1 ? 10 : 3 + s.players[p].species.length * (scen === 'Radioactive Atmosphere' ? 2 : 1);
      if (draw(s, p, nDeal)) {
        s.lastRound = true;
        log(s, -1, 'The deck ran out while dealing: discards reshuffled. This is the last round.', 'sys');
      }
    }
    for (const pl of s.players) { pl.foodCard = null; pl.done = false; }
    s.phase = 'food';
    s.turn = -1; s.playTurn = -1; s.passes = 0;
    log(s, -1, 'Round ' + s.round + (s.lastRound ? ' (last round)' : '') + '. ' + pname(s, s.first) + ' goes first.', 'sys');
    // fluid: no separate food step; each player's food card comes with their play
    if (s.fluid) { s.phase = 'play'; s.playTurn = s.first; }
    else if (s.players.every(pl => !pl.hand.length)) toPlay(s);
  }

  // ------------------------------------------------------------------ who acts now
  function toAct(s) {
    if (s.over) return [];
    if (s.phase === 'food') return s.players.map((pl, i) => (pl.foodCard === null ? i : -1)).filter(i => i >= 0);
    if (s.phase === 'play') return s.quick ? s.players.map((pl, i) => (!pl.done ? i : -1)).filter(i => i >= 0) : (s.playTurn >= 0 ? [s.playTurn] : []);
    if (s.phase === 'feed') return s.turn >= 0 ? [s.turn] : [];
    if (s.phase === 'leaf') return s.leaf ? Object.keys(s.leaf).map(Number).sort((a, b) => a - b) : [];
    if (s.phase === 'event') return s.ev && s.ev.turn >= 0 ? [s.ev.turn] : [];        // expansion events (flight.js)
    if (s.phase === 'react') return s.pending ? [s.pending.tp] : [];                  // Last Stand (flight.js)
    return [];
  }

  // ------------------------------------------------------------------ attack legality
  // '' if Carnivore (cp,ci) may attack (tp,ti), else a plain reason. ignore = trait names that
  // Intelligence switched off for this attack (one card each).
  function attackBlock(s, cp, ci, tp, ti, ignore) {
    const C = s.players[cp].species[ci], T = s.players[tp].species[ti];
    if (!C || !T) return 'No such species';
    if (C === T) return 'A Carnivore can’t eat itself';
    if (!isCarn(C)) return 'Not a Carnivore';
    if (C.noAtk) return 'Quills: it can’t attack again this round';
    const tHas = t => has(T, t, ignore);
    // Claws: 2 bigger when it attacks or is attacked. Sharp Teeth ('Size' switched off): any size
    const atk = C.body + (has(C, 'Pack Hunting') ? C.pop : 0) + (has(C, 'Claws') ? 2 : 0);
    const def = T.body + (tHas('Hard Shell') ? 4 : 0) + (tHas('Claws') ? 2 : 0);
    if (atk <= def && !(ignore && ignore.indexOf('Size') >= 0)) return tHas('Hard Shell') ? 'Hard Shell: needs size over ' + def : 'Too big: needs size over ' + def;
    if (tHas('Timid')) return 'Timid: it can’t be attacked';
    if (tHas('Flight') && !has(C, 'Flight')) return 'Flight: attacker needs Flight';
    if (tHas('Camouflage') && !has(C, 'Good Eyesight')) return 'Camouflage: attacker needs Good Eyesight';
    if (tHas('Climbing') && !has(C, 'Climbing')) return 'Climbing: attacker needs Climbing';
    if (tHas('Burrowing') && T.food >= T.pop) return 'Burrowing: it has eaten its fill';
    if (tHas('Defensive Herding') && C.pop <= T.pop) return 'Defensive Herding: needs more population';
    const row = s.players[tp].species;
    const left = row[ti - 1], right = row[ti + 1];
    if (tHas('Symbiosis') && right && right.body > T.body) return 'Symbiosis: its right neighbour is bigger';
    if (!has(C, 'Ambush') && !(ignore && ignore.indexOf('Warning Call') >= 0) &&
      ((left && has(left, 'Warning Call')) || (right && has(right, 'Warning Call')))) return 'Warning Call next to it: attacker needs Ambush';
    return '';
  }
  // what a Carnivore can switch off by discarding one card per trait:
  //   Intelligence: any defending trait; Flight (expansion): Warning Call, Symbiosis or Climbing;
  //   Sharp Teeth (promo): 'Size' = the body size rule, for this attack
  const FLIGHT_NEG = ['Warning Call', 'Symbiosis', 'Climbing'];
  function canIgnore(C, t) {
    return (has(C, 'Intelligence') && Cards.XDEFENSES.indexOf(t) >= 0) || (has(C, 'Flight') && FLIGHT_NEG.indexOf(t) >= 0) || (t === 'Size' && has(C, 'Sharp Teeth'));
  }
  // the fewest traits Intelligence (or Flight / Sharp Teeth) must switch off to allow the attack (null = impossible)
  function intelNeeded(s, cp, ci, tp, ti, maxCards) {
    if (!attackBlock(s, cp, ci, tp, ti)) return [];
    const C = s.players[cp].species[ci];
    if (!(has(C, 'Intelligence') || has(C, 'Flight') || has(C, 'Sharp Teeth')) || maxCards <= 0) return null;
    const T = s.players[tp].species[ti];
    const row = s.players[tp].species;
    const cand = Cards.XDEFENSES.filter(t => has(T, t) || (t === 'Warning Call' && ((row[ti - 1] && has(row[ti - 1], t)) || (row[ti + 1] && has(row[ti + 1], t))))).concat(['Size']);
    // Horns / Quills do not block; switching them off only spares the attacker (left to the player)
    const blockers = cand.filter(t => t !== 'Horns' && t !== 'Quills' && canIgnore(C, t));
    for (let size = 1; size <= Math.min(maxCards, blockers.length); size++) {
      const combos = [];
      (function rec(start, acc) {
        if (acc.length === size) { combos.push(acc.slice()); return; }
        for (let i = start; i < blockers.length; i++) { acc.push(blockers[i]); rec(i + 1, acc); acc.pop(); }
      })(0, []);
      for (const c of combos) if (!attackBlock(s, cp, ci, tp, ti, c)) return c;
    }
    return null;
  }

  // ------------------------------------------------------------------ feeding options
  // Every legal feeding action for player p right now:
  //   {t:'eat', s}                         1 plant food from the watering hole
  //   {t:'attack', s, target, ignore:[..]}  ignore = traits Intelligence must switch off (one card each)
  //   {t:'intel', s}                       free extra: discard a card, 2 plant food from the bank
  // Each option says whether it feeds a hungry species (must-feed rule).
  function feedOptions(s, p) {
    const out = [];
    const pl = s.players[p];
    const handN = pl.hand.length;
    // Timid (promo): may not eat at the watering hole while another species of yours is hungry
    const timidWait = sp => has(sp, 'Timid') && pl.species.some(x => x !== sp && !has(x, 'Timid') && hungry(x));
    pl.species.forEach((sp, i) => {
      if (canTake(sp) <= 0) return;
      const must = hungry(sp);
      if (!isCarn(sp)) {
        if (s.hole > 0 && !timidWait(sp)) out.push({ t: 'eat', s: sp.id, must });
        // Flight: an Avian plant eater may eat at the cliff instead
        if (sp.av && s.cliff > 0) out.push({ t: 'eat', s: sp.id, src: 'cliff', must });
        if (has(sp, 'Intelligence') && handN) out.push({ t: 'intel', s: sp.id, must: false });
        if (has(sp, 'Sharp Teeth') && handN) out.push({ t: 'teeth', s: sp.id, must: false });
        if (has(sp, 'Coprophagia') && pl.bag > 0) out.push({ t: 'copro', s: sp.id, must: false });
      } else {
        s.players.forEach((op, tp) => op.species.forEach((T, ti) => {
          if (tp === p && ti === i) return;
          const need = intelNeeded(s, p, i, tp, ti, handN);
          if (need) out.push({ t: 'attack', s: sp.id, target: T.id, ignore: need, must: must && need.length === 0 });
        }));
      }
    });
    return out;
  }
  // you may stop (pass) only when no hungry species of yours can eat without Intelligence
  const canPass = (s, p) => !feedOptions(s, p).some(o => o.must);

  // ------------------------------------------------------------------ apply
  function apply(s0, seat, action) {
    const s = applyRaw(s0, seat, action);
    autoplay(s);
    return s;
  }
  // the same move without letting computers answer afterwards (bots use it to look ahead)
  function applyRaw(s0, seat, action) {
    if (!action || typeof action !== 'object' || typeof action.t !== 'string') throw new Error('Bad move');
    const s = clone(s0);
    if (s.over) throw new Error('The game is over');
    if (toAct(s).indexOf(seat) < 0) throw new Error('Not your turn');
    act(s, seat, action);
    return s;
  }

  function act(s, seat, a) {
    const pl = s.players[seat];
    if (s.phase === 'food') {
      if (a.t !== 'food') throw new Error('Pick a food card first');
      if (!pl.hand.length && a.card == null) { pl.foodCard = -1; }
      else {
        const k = pl.hand.indexOf(a.card);
        if (k < 0) throw new Error('Not in your hand');
        pl.hand.splice(k, 1);
        pl.foodCard = a.card;
      }
      if (s.players.every(x => x.foodCard !== null)) toPlay(s);
      return;
    }
    if (s.phase === 'play') {
      if (a.t !== 'play' || !Array.isArray(a.moves)) throw new Error('Bad move');
      if (a.moves.length > 60) throw new Error('Too many moves');
      // validate on a copy first so a bad list changes nothing
      const test = clone(pl);
      const made = [];
      const disc = [];
      for (const m of a.moves) playOne(s, test, m, made, disc);
      if (s.fluid) placeFood(test, pl.hand.length > 0, a.food);
      else if (a.food != null) throw new Error('The food cards are already placed');
      s.players[seat] = test;
      s.discard.push(...disc);
      if (Flight) Flight.afterPlays(s, seat, a.moves, made); // Nesting on a face-up board that gained population
      test.done = true;
      const nCards = a.moves.filter(m => m.t !== 'drop').length;
      log(s, seat, pname(s, seat) + ' plays ' + nCards + ' card' + (nCards === 1 ? '' : 's') + '.');
      if (s.players.every(x => x.done)) reveal(s);
      else if (!s.quick) s.playTurn = (s.playTurn + 1) % s.players.length;
      return;
    }
    if (s.phase === 'feed') return feed(s, seat, a);
    if (s.phase === 'leaf') return chooseLeaf(s, seat, a);
    if (s.phase === 'event' && Flight) return Flight.eventAct(s, seat, a);
    if (s.phase === 'react' && Flight) return Flight.react(s, seat, a);
    throw new Error('Nothing to do now');
  }

  // fluid play: the food card goes face down at the watering hole with the play. Anyone who began the
  // turn holding a card must place one, and it can't be a card the same turn already played.
  function placeFood(pl, required, card) {
    if (card == null) {
      if (required) throw new Error('Put a food card at the watering hole');
      pl.foodCard = -1;
      return;
    }
    const k = pl.hand.indexOf(card);
    if (k < 0) throw new Error(required ? 'That food card is not in your hand (or was played already)' : 'You have no cards to place as food');
    pl.hand.splice(k, 1);
    pl.foodCard = card;
  }
  function toPlay(s) {
    for (const pl of s.players) if (pl.foodCard === null) pl.foodCard = -1;
    s.phase = 'play';
    s.playTurn = s.first;
  }

  // one card play inside your play turn. m = {t:'species'|'body'|'pop'|'trait'|'drop', card, s, side}
  // m.s may be -1, -2 ... = the 1st, 2nd ... species you made earlier in this same turn.
  function playOne(s, pl, m, made, disc) {
    if (!m || typeof m !== 'object') throw new Error('Bad move');
    const sid = typeof m.s === 'number' && m.s < 0 ? made[-m.s - 1] : m.s;
    const sp = m.t === 'species' || m.t === 'avian' ? null : pl.species.find(x => x.id === sid);
    if (m.t !== 'species' && m.t !== 'avian' && !sp) throw new Error('No such species');
    if (m.t === 'drop') {
      // discard one of your own traits for nothing (to make room); face-down ones too
      let k = sp.traits.indexOf(m.card), list = sp.traits;
      if (k < 0) { k = sp.hidden.indexOf(m.card); list = sp.hidden; }
      if (k < 0) throw new Error('No such trait');
      list.splice(k, 1);
      // Flight: swapping Flight out turns the board into a land species for good; the card goes back to the box
      if (trait(m.card) === 'Flight') { sp.av = false; sp.up = 0; s.flights.push(m.card); } else disc.push(m.card);
      if (trait(m.card) === 'Fat Tissue' && sp.fat) { pl.bag += sp.fat; sp.fat = 0; } // stored food is scored
      return;
    }
    if (m.t === 'avian') {
      // Flight: discard 2 cards for an Avian species (population 1, body size 1, a Flight card on it)
      if (X(s).v !== 'flight') throw new Error('Avian species need the Flight expansion');
      const cs = Array.isArray(m.cards) ? m.cards : [];
      if (cs.length !== 2 || cs[0] === cs[1] || cs.some(c => pl.hand.indexOf(c) < 0)) throw new Error('An Avian species costs 2 cards from your hand');
      if (!s.flights || !s.flights.length) throw new Error('All 12 Flight cards are in play');
      if (s.maxTraits < 1) throw new Error('No room for the Flight card');
      const ns = Object.assign(newSpecies(s), { av: true, up: 0 });
      ns.traits.push(s.flights.pop());
      made.push(ns.id);
      if (m.side === 'L') pl.species.unshift(ns); else pl.species.push(ns);
      for (const c of cs) { pl.hand.splice(pl.hand.indexOf(c), 1); disc.push(c); }
      return;
    }
    const k = pl.hand.indexOf(m.card);
    if (k < 0) throw new Error('That card is not in your hand');
    if (m.t === 'species') {
      const ns = newSpecies(s);
      made.push(ns.id);
      if (m.side === 'L') pl.species.unshift(ns); else pl.species.push(ns);
      disc.push(m.card);
    } else if (m.t === 'body') {
      if (sp.body >= maxBody(sp)) throw new Error('Body size is already ' + maxBody(sp) + (sp.av ? ' (an Avian’s largest)' : ''));
      sp.body++; disc.push(m.card); settleUp(sp);
    } else if (m.t === 'pop') {
      if (sp.pop >= MAX) throw new Error('Population is already 6');
      sp.pop++; disc.push(m.card);
    } else if (m.t === 'trait') {
      const t = trait(m.card);
      if (Cards.isEvent(m.card)) throw new Error(t + ' is an event card: it is never played as a trait');
      const list = sp.traits.concat(sp.hidden);
      if (list.length >= s.maxTraits) throw new Error('A species holds at most ' + s.maxTraits + ' traits');
      if (list.some(id => trait(id) === t)) throw new Error('It already has ' + t);
      sp.hidden.push(m.card);
    } else throw new Error('Bad move');
    pl.hand.splice(k, 1);
  }

  // ------------------------------------------------------------------ taking food
  // species sp of player p takes n food of `kind` ('plant'|'meat') from `source` ('hole'|'bank').
  // Foraging: +1 more plant from the same place each time. Cooperation: the species just to the
  // right takes 1 of the same food from the same place (and can pass it on again).
  function take(s, p, sp, n, kind, source) {
    if (kind === 'plant' && isCarn(sp)) return 0;
    let want = n + (kind === 'plant' && has(sp, 'Foraging') ? 1 : 0);
    // sources: 'hole' (watering hole), 'cliff' (Flight), 'bag' (your own food bag: Coprophagia), 'bank' (unlimited)
    if (source === 'hole') want = Math.min(want, s.hole);
    if (source === 'cliff') want = Math.min(want, s.cliff || 0);
    if (source === 'bag') want = Math.min(want, s.players[p].bag);
    const wasHungry = hungry(sp);
    let got = 0;
    while (got < want && canTake(sp) > 0) { addFood(sp); got++; }
    if (source === 'hole') s.hole -= got;
    if (source === 'cliff') s.cliff -= got;
    if (source === 'bag') s.players[p].bag -= got;
    if (got > 0) {
      // Trampling: 2 more plant food is removed from the watering hole; Pest: fully fed = 3 removed
      if (source === 'hole' && has(sp, 'Trampling') && s.hole > 0) { const k = Math.min(2, s.hole); s.hole -= k; log(s, p, 'Trampling removes ' + k + ' plant food from the watering hole.'); }
      if (wasHungry && !hungry(sp) && has(sp, 'Pest') && s.hole > 0) { const k = Math.min(3, s.hole); s.hole -= k; log(s, p, 'Pest: ' + k + ' plant food is removed from the watering hole.'); }
      cur(s).eaten[p] += got; s.players[p].eaten += got;
      if (has(sp, 'Cooperation')) {
        const row = s.players[p].species;
        const nx = row[row.indexOf(sp) + 1];
        if (nx) take(s, p, nx, 1, kind, source);
      }
    }
    return got;
  }

  // ------------------------------------------------------------------ reveal
  function reveal(s) {
    s.playTurn = -1;
    // new traits flip face up
    const flippedNow = [];
    s.players.forEach((pl, p) => pl.species.forEach(sp => { for (const id of sp.hidden) flippedNow.push({ p, s: sp.id, id }); sp.traits = sp.traits.concat(sp.hidden); sp.hidden = []; }));
    // expansions: event cards may be played now, after the traits are revealed (Flight rulebook)
    if (Flight && Flight.startEvents(s, flippedNow)) return;
    leafStart(s);
  }
  function leafStart(s) {
    // expansion games: before-reveal traits (Good Eyesight takes from the shared watering hole) go player
    // by player in turn order from the first player (Flight rulebook, "Timing issues")
    if (Flight && Flight.leafInTurn(s)) return leafNext(s, 0);
    // leaf traits, before the food cards. Each player's own traits only touch their own species
    // (Long Neck takes from the bank, Cooperation passes along their own row), so players are
    // independent. Rulebook: a player with more than one of these chooses their order. When the
    // order changes the result, a person picks one of the different results (s.leaf); computers
    // take the first one, which is the best for the owner (Fertile, then Fat Tissue, then Long Neck).
    s.phase = 'leaf';
    s.leaf = {};
    eachInOrder(s, p => {
      const opts = leafChoices(s, p);
      if (opts.length > 1 && !s.players[p].bot) s.leaf[p] = opts;
      else for (const a of opts[0].order) leafOne(s, p, a);
    });
    if (!Object.keys(s.leaf).length) revealFood(s);
  }
  // one player after another (k = place in turn order); stops at a person whose order changes the result
  function leafNext(s, k) {
    s.phase = 'leaf'; s.leaf = {};
    for (; k < s.players.length; k++) {
      const p = (s.first + k) % s.players.length;
      const opts = leafChoices(s, p);
      if (opts.length > 1 && !s.players[p].bot) { s.leaf[p] = opts; s.leafAt = k; return; }
      for (const a of opts[0].order) leafOne(s, p, a);
    }
    s.leafAt = null;
    revealFood(s);
  }
  // the different results player p can get by ordering their leaf traits (the best order first)
  function leafChoices(s, p) {
    const acts = leafActs(s, p);
    // best order: growth and stored fat first, then Good Eyesight (watering hole), then Long Neck (bank)
    const rank = a => (a.t === 'Long Neck' ? 2 : a.t === 'Good Eyesight' ? 1 : 0);
    const best = acts.slice().sort((a, b) => rank(a) - rank(b));
    // more than 6 leaf cards: too many orders to list (720+); keep the best order
    if (acts.length < 2 || acts.length > 6) return [{ order: best }];
    const out = [], seen = {};
    const tryOrder = order => {
      const pl = s.players[p];
      // a small copy holding only what leaf traits touch
      const m = { round: s.round, hole: s.hole, log: [], hist: [{ eaten: s.players.map(() => 0) }], exp: s.exp,
        players: s.players.map((q, i) => (i === p ? { name: q.name, eaten: 0, bag: q.bag, species: clone(pl.species) } : null)) };
      for (const a of order) leafOne(m, p, a);
      const res = m.players[p].species.map(x => Object.assign({ id: x.id, pop: x.pop, food: x.food, fat: x.fat }, x.av ? { up: x.up || 0 } : {}));
      const k = JSON.stringify(res);
      if (!seen[k]) { seen[k] = 1; out.push({ order: order.slice(), res }); }
    };
    tryOrder(best);
    (function perm(rest, acc) {
      if (!rest.length) return tryOrder(acc);
      for (let i = 0; i < rest.length; i++) { acc.push(rest[i]); perm(rest.slice(0, i).concat(rest.slice(i + 1)), acc); acc.pop(); }
    })(acts, []);
    return out;
  }
  // a person's leaf order: {t:'leaf', k} = the k-th result in s.leaf[seat]
  function chooseLeaf(s, seat, a) {
    const opts = s.leaf && s.leaf[seat];
    if (a.t !== 'leaf' || !opts) throw new Error('Choose the order of your leaf traits');
    const o = opts[a.k];
    if (!Number.isInteger(a.k) || !o) throw new Error('No such order');
    if (a.k > 0) log(s, seat, pname(s, seat) + ' orders leaf traits: ' + o.order.map(x => x.t).join(', ') + '.');
    for (const x of o.order) leafOne(s, seat, x);
    delete s.leaf[seat];
    if (s.leafAt != null) return leafNext(s, s.leafAt + 1);
    if (!Object.keys(s.leaf).length) revealFood(s);
  }
  // the food cards turn over and feeding starts
  function revealFood(s) {
    const H = cur(s);
    s.leaf = null;
    let sum = 0;
    s.players.forEach(pl => { if (pl.foodCard >= 0) { sum += DECK[pl.foodCard].food; H.foodCards.push(pl.foodCard); s.discard.push(pl.foodCard); } });
    s.hole = Math.max(0, s.hole + sum);
    H.added = sum;
    log(s, -1, 'Food cards add ' + (sum >= 0 ? '+' : '') + sum + '. Watering hole: ' + s.hole + '.', 'sys');
    if (Flight) Flight.onFoodReveal(s); // the cliff fills; Unstable DNA
    s.phase = 'feed';
    s.turn = s.first;
    s.passes = 0;
    settleTurn(s);
  }
  // the leaf-icon traits of player p that act before the food cards, one entry per card:
  // {s: species id, t: 'Fertile' | 'Fat Tissue' | 'Long Neck'} (species left to right, Fertile, Fat Tissue, Long Neck)
  // (expansions add Brood Parasite and a plant eater's Good Eyesight)
  const LEAF = ['Fertile', 'Brood Parasite', 'Fat Tissue', 'Good Eyesight', 'Long Neck'];
  function leafActs(s, p) {
    const out = [];
    for (const sp of s.players[p].species) for (const t of LEAF) if (has(sp, t) && !(t === 'Good Eyesight' && isCarn(sp)) && !(t === 'Brood Parasite' && !sp.av)) out.push({ s: sp.id, t });
    return out;
  }
  // a species gains population; Nesting (Flight) then takes food: land 1 plant, Avian 2 meat, from the bank
  function gainPop(s, p, sp, why) {
    if (sp.pop >= MAX) return false;
    sp.pop++;
    if (has(sp, 'Nesting')) {
      const got = sp.av ? take(s, p, sp, 2, 'meat', 'bank') : take(s, p, sp, 1, 'plant', 'bank');
      if (got) log(s, p, pname(s, p) + '’s Nesting takes ' + got + (sp.av ? ' meat' : ' plant food') + ' from the bank.');
    }
    return true;
  }
  // one leaf trait takes effect (Fertile reads the watering hole, which no leaf trait changes)
  function leafOne(s, p, a) {
    const sp = s.players[p].species.find(x => x.id === a.s);
    if (!sp) return;
    if (a.t === 'Fertile') {
      if (s.hole > 0 && sp.pop < MAX) { gainPop(s, p, sp); log(s, p, pname(s, p) + '’s Fertile species grows to population ' + sp.pop + '.'); }
    } else if (a.t === 'Fat Tissue') {
      if (sp.fat > 0) { const m = Math.min(sp.fat, needFood(sp)); sp.fat -= m; for (let i = 0; i < m; i++) addFood(sp); }
    } else if (a.t === 'Brood Parasite') {
      // Flight: only an Avian, and only while you have another Avian: +1 population and 1 food from the bank
      if (sp.av && s.players[p].species.some(x => x !== sp && x.av) && sp.pop < MAX) {
        gainPop(s, p, sp);
        const got = take(s, p, sp, 1, isCarn(sp) ? 'meat' : 'plant', 'bank');
        log(s, p, pname(s, p) + '’s Brood Parasite grows to population ' + sp.pop + (got ? ' and takes ' + got + ' food from the bank' : '') + '.');
      }
    } else if (a.t === 'Good Eyesight') {
      if (!isCarn(sp) && s.hole > 0 && canTake(sp) > 0) { const got = take(s, p, sp, 2, 'plant', 'hole'); if (got) log(s, p, pname(s, p) + '’s Good Eyesight takes ' + got + ' plant food from the watering hole.'); }
    } else if (a.t === 'Long Neck') {
      if (canTake(sp) > 0) { const got = take(s, p, sp, 1, 'plant', 'bank'); if (got) log(s, p, pname(s, p) + '’s Long Neck eats ' + got + ' from the bank.'); }
    }
  }
  function eachInOrder(s, f) { for (let k = 0; k < s.players.length; k++) f((s.first + k) % s.players.length); }

  // ------------------------------------------------------------------ feeding
  function feed(s, p, a) {
    const pl = s.players[p];
    if (a.t === 'pass') {
      if (!canPass(s, p)) throw new Error('A hungry species can still eat: you must feed it');
      log(s, p, pname(s, p) + ' passes.');
      s.passes++;
      return nextTurn(s);
    }
    const loc = findSp(s, a.s);
    if (!loc || loc.p !== p) throw new Error('Not your species');
    const sp = loc.sp;
    if (canTake(sp) <= 0) throw new Error('That species is full');
    if (a.t === 'intel') {
      // a free extra on your turn: discard a card, take 2 plant food from the bank
      if (isCarn(sp) || !has(sp, 'Intelligence')) throw new Error('Needs Intelligence (and not a Carnivore)');
      const k = pl.hand.indexOf(a.card);
      if (k < 0) throw new Error('Pick a card to discard');
      pl.hand.splice(k, 1); s.discard.push(a.card);
      const n = take(s, p, sp, 2, 'plant', 'bank');
      log(s, p, pname(s, p) + ' uses Intelligence: discards a card, takes ' + n + ' plant food from the bank.');
      return settleTurn(s); // still your turn: you feed (or pass) as usual
    }
    if (a.t === 'teeth') {
      // Sharp Teeth (promo), plant eater: discard a card, 1 plant food from the bank (a free extra, like Intelligence)
      if (isCarn(sp) || !has(sp, 'Sharp Teeth')) throw new Error('Needs Sharp Teeth (and not a Carnivore)');
      const k = pl.hand.indexOf(a.card);
      if (k < 0) throw new Error('Pick a card to discard');
      pl.hand.splice(k, 1); s.discard.push(a.card);
      const n = take(s, p, sp, 1, 'plant', 'bank');
      log(s, p, pname(s, p) + ' uses Sharp Teeth: discards a card, takes ' + n + ' plant food from the bank.');
      return settleTurn(s);
    }
    if (a.t === 'eat') {
      if (isCarn(sp)) throw new Error('Carnivores never eat plant food');
      if (a.src === 'cliff') {
        if (!sp.av) throw new Error('Only an Avian species can eat at the cliff');
        if (!(s.cliff > 0)) throw new Error('The cliff is empty');
        const n = take(s, p, sp, 1, 'plant', 'cliff');
        log(s, p, pname(s, p) + ' eats ' + n + ' plant food at the cliff' + (n > 1 ? ' (Foraging)' : '') + '.');
      } else {
        if (s.hole <= 0) throw new Error('The watering hole is empty');
        if (!feedOptions(s, p).some(o => o.t === 'eat' && o.s === sp.id && !o.src)) throw new Error('Timid: your other species eat first');
        const n = take(s, p, sp, 1, 'plant', 'hole');
        log(s, p, pname(s, p) + ' eats ' + n + ' plant food' + (n > 1 ? ' (Foraging)' : '') + '.');
      }
    } else if (a.t === 'copro') {
      // Coprophagia (promo): instead of the watering hole, 1 food back out of your own food bag
      if (isCarn(sp) || !has(sp, 'Coprophagia') || !(pl.bag > 0)) throw new Error('Needs Coprophagia and food in your bag');
      const n = take(s, p, sp, 1, 'plant', 'bag');
      log(s, p, pname(s, p) + ' takes ' + n + ' food back out of the food bag (Coprophagia).');
    } else if (a.t === 'attack') {
      const tl = findSp(s, a.target);
      if (!tl) throw new Error('No such target');
      const ignore = Array.isArray(a.ignore) ? a.ignore.filter((t, i, arr) => typeof t === 'string' && arr.indexOf(t) === i) : [];
      const cards = Array.isArray(a.cards) ? a.cards : [];
      if (ignore.length) {
        if (!(has(sp, 'Intelligence') || has(sp, 'Flight') || has(sp, 'Sharp Teeth'))) throw new Error('Needs Intelligence');
        if (ignore.some(t => !canIgnore(sp, t))) throw new Error('Intelligence only switches off defending traits');
        if (cards.length !== ignore.length || new Set(cards).size !== cards.length || cards.some(c => pl.hand.indexOf(c) < 0)) throw new Error('Discard one card for each trait you switch off');
      }
      const why = attackBlock(s, p, loc.i, tl.p, tl.i, ignore);
      if (why) throw new Error(why);
      for (const c of cards.slice(0, ignore.length)) { pl.hand.splice(pl.hand.indexOf(c), 1); s.discard.push(c); }
      // Last Stand (promo): the prey's owner may answer first; the feeding goes on once they have
      if (Flight && Flight.lastStandAsk(s, p, sp.id, tl.sp.id, ignore, 'feed')) return;
      attack(s, p, loc.i, tl.p, tl.i, ignore);
    } else throw new Error('Bad move');
    s.passes = 0;
    nextTurn(s);
  }

  function attack(s, p, ci, tp, ti, ignore) {
    const C = s.players[p].species[ci], T = s.players[tp].species[ti];
    const H = cur(s);
    H.attacks++;
    log(s, p, pname(s, p) + '’s Carnivore (' + C.body + '/' + C.pop + ') attacks ' + (tp === p ? 'its own' : pname(s, tp) + '’s') + ' ' + T.body + '/' + T.pop + (ignore.length ? ', using Intelligence on ' + ignore.join(' + ') : '') + '.', 'atk');
    const losses = [];
    // Horns: the attacker loses 1 population before it eats
    if (has(T, 'Horns', ignore)) {
      loseOne(s, p, C);
      losses.push(1);
      log(s, p, 'Horns: the attacker loses 1 population.');
    }
    loseOne(s, tp, T);
    losses.push(1);
    const meat = T.body;
    let got = 0;
    if (C.pop > 0) got = take(s, p, C, meat, 'meat', 'bank');
    if (got) log(s, p, 'The Carnivore eats ' + got + ' meat.');
    // Scavenger: 1 meat from the bank for every population lost to the attack
    for (let k = 0; k < losses.length; k++) {
      for (let j = 0; j < s.players.length; j++) {
        const q = (p + j) % s.players.length;
        for (const sp of s.players[q].species.slice()) {
          if (sp.pop > 0 && has(sp, 'Scavenger') && canTake(sp) > 0) {
            const n = take(s, q, sp, 1, 'meat', 'bank');
            if (n) log(s, q, pname(s, q) + '’s Scavenger takes 1 meat.');
          }
        }
      }
    }
    // Quills (promo): this Carnivore can't attack again this round. Invasive Species (promo): +1 population
    if (has(T, 'Quills', ignore) && C.pop > 0) { C.noAtk = true; log(s, p, 'Quills: that Carnivore can’t attack again this round.'); }
    s.players.forEach((pl, q) => pl.species.forEach(x => { if (x.inv && x !== T && x.pop > 0 && gainPop(s, q, x)) log(s, q, pname(s, q) + '’s Invasive Species grows to population ' + x.pop + '.'); }));
    if (T.pop <= 0) extinct(s, tp, T);
    if (C.pop <= 0) extinct(s, p, C);
  }
  // one population lost to an attack; food above the new population goes behind the screen
  function loseOne(s, p, sp) {
    sp.pop--;
    cur(s).popLost[p]++;
    if (sp.food > sp.pop) { s.players[p].bag += sp.food - sp.pop; sp.food = sp.pop; }
  }

  function extinct(s, p, sp) {
    const row = s.players[p].species;
    const i = row.indexOf(sp);
    if (i < 0) return;
    row.splice(i, 1);
    const pl = s.players[p];
    pl.bag += sp.food + sp.fat; // food on a dead species is still scored
    const lost = sp.traits.concat(sp.hidden);
    for (const id of lost) (trait(id) === 'Flight' ? s.flights : s.discard).push(id); // Flight cards go back to the box
    cur(s).extinct++;
    if (s.trace) s.trace.life.push([sp.traits.map(trait).sort().join('|'), s.round - (sp.born || 1) + 1, 0]);
    log(s, p, pname(s, p) + '’s species goes extinct' + (lost.length ? ': draws ' + lost.length + ' card' + (lost.length > 1 ? 's' : '') : '') + '.', 'ext');
    if (draw(s, p, lost.length) && !s.lastRound) {
      s.lastNext = true;
      log(s, -1, 'The deck ran out: discards reshuffled. Next round is the last.', 'sys');
    }
  }

  // after a feeding: next player clockwise
  function nextTurn(s) {
    s.turn = (s.turn + 1) % s.players.length;
    if (s.fseq != null) s.fseq++;
    settleTurn(s);
  }
  // skip players with nothing they could do; end the round once everyone in a row has passed
  function settleTurn(s) {
    const n = s.players.length;
    for (let guard = 0; guard < 4 * n + 4; guard++) {
      if (s.passes >= n) return endRound(s);
      if (Flight) Flight.turnStart(s); // Insectivore: before each of your feeding turns
      const opts = feedOptions(s, s.turn);
      if (opts.length) return; // this player decides (feed, or pass if allowed)
      s.passes++;
      s.turn = (s.turn + 1) % n;
      if (s.fseq != null) s.fseq++;
    }
    endRound(s);
  }

  // ------------------------------------------------------------------ end of round
  function endRound(s) {
    s.turn = -1;
    const H = cur(s);
    s.players.forEach((pl, p) => {
      for (const sp of pl.species.slice()) {
        if (s.trace) s.trace.rounds.push([sp.traits.map(trait).sort().join('|'), sp.food, sp.pop, p]);
        if (sp.food < sp.pop) { H.popLost[p] += sp.pop - sp.food; log(s, p, pname(s, p) + '’s ' + sp.body + '/' + sp.pop + ' species starves to population ' + sp.food + '.'); sp.pop = sp.food; }
        pl.bag += sp.food;
        sp.food = 0;
        if (sp.av) sp.up = 0; // Avian upkeep food goes back to the bank, never into the bag
        if (sp.pop <= 0) extinct(s, p, sp);
      }
    });
    if (Flight) Flight.endRound(s); // this round's extras end (Mimicry, Claws, Quills, Invasive Species)
    H.holeEnd = s.hole;
    if (X(s).scen === 'Plant Life Explosion' && s.hole > 0) { s.hole *= 2; log(s, -1, 'Plant Life Explosion: the watering hole doubles to ' + s.hole + '.', 'sys'); }
    H.scores = s.players.map((_, p) => score(s, p).total);
    if (s.lastRound) return finish(s);
    s.first = (s.first + 1) % s.players.length;
    startRound(s);
  }
  // points: food behind the screen + population and traits of living species (+ stored fat at the end)
  function score(s, p) {
    const pl = s.players[p];
    const pop = pl.species.reduce((a, sp) => a + sp.pop, 0);
    const traits = pl.species.reduce((a, sp) => a + sp.traits.length + sp.hidden.length, 0);
    const fat = pl.species.reduce((a, sp) => a + sp.fat, 0);
    return { food: pl.bag + fat, pop, traits, total: pl.bag + fat + pop + traits };
  }
  function finish(s) {
    s.over = true; s.phase = 'over';
    if (s.trace) s.players.forEach(pl => pl.species.forEach(sp => s.trace.life.push([sp.traits.map(trait).sort().join('|'), s.round - (sp.born || 1) + 1, 1])));
    const scores = s.players.map((_, p) => score(s, p));
    const best = Math.max(...scores.map(x => x.total));
    let tied = scores.map((x, p) => (x.total === best ? p : -1)).filter(p => p >= 0);
    // ties: most trait points, then most population points; still tied = shared win
    if (tied.length > 1) { const m = Math.max(...tied.map(p => scores[p].traits)); tied = tied.filter(p => scores[p].traits === m); }
    if (tied.length > 1) { const m = Math.max(...tied.map(p => scores[p].pop)); tied = tied.filter(p => scores[p].pop === m); }
    s.result = { scores, winners: tied };
    log(s, -1, 'Game over. ' + tied.map(p => pname(s, p)).join(' and ') + (tied.length > 1 ? ' share the win' : ' wins') + ' with ' + best + '.', 'sys');
  }

  // ------------------------------------------------------------------ computers inside the engine
  function autoplay(s) {
    let guard = 0;
    while (!s.over && guard++ < 20000) {
      if (s.stepBots && s.phase === 'feed') return;
      const bots = toAct(s).filter(p => s.players[p].bot);
      if (!bots.length || !BOT) return;
      const p = bots[0];
      act(s, p, BOT(s, p));
    }
  }

  // ------------------------------------------------------------------ views
  // What seat `seat` may see (-1 = public). Hides hands, food behind screens, face-down traits,
  // face-down food cards, the deck order and the random seed.
  function view(s, seat) {
    const hidingFood = s.phase === 'food' || s.phase === 'play' || s.phase === 'leaf' || s.phase === 'event' || (s.phase === 'react' && !!s.pending && s.pending.after === 'event');
    const last = cur(s);
    const v = {
      exp: clone(X(s)), cliff: s.cliff || 0, reserveSize: s.reserve ? s.reserve.length : 0, flightsLeft: s.flights ? s.flights.length : 0,
      ev: s.phase === 'event' && s.ev ? { turn: s.ev.turn } : null,
      mut: s.phase === 'event' && s.mut ? clone(s.mut) : null, mimicked: s.phase === 'event' && s.mimicked ? clone(s.mimicked) : null, // public: Rapid Mutation draws, Mimicry used
      pending: s.phase === 'react' && s.pending ? clone(s.pending) : null,
      round: s.round, phase: s.phase, fluid: !!s.fluid, first: s.first, turn: s.turn, playTurn: s.playTurn, hole: s.hole,
      deckSize: s.deck.length, discardSize: s.discard.length, quick: s.quick, maxTraits: s.maxTraits, removed: s.removed,
      lastRound: s.lastRound, lastNext: s.lastNext, over: s.over, result: s.over ? s.result : null, toAct: toAct(s), log: s.log.slice(-80), leaf: s.phase === 'leaf' && s.leaf ? clone(s.leaf) : null,
      canPass: s.phase === 'feed' && s.turn === seat ? canPass(s, seat) : false,
      hist: s.hist.map(h => ({ round: h.round, added: hidingFood && h === last ? null : h.added, eaten: h.eaten, popLost: h.popLost, attacks: h.attacks,
        extinct: h.extinct, scores: h.scores || null, foodCards: hidingFood && h === last ? [] : h.foodCards.slice() })),
      seat,
      players: s.players.map((pl, p) => ({
        name: pl.name, bot: !!pl.bot, handSize: pl.hand.length, done: pl.done, foodPicked: pl.foodCard !== null,
        bag: s.over || p === seat ? pl.bag : null,
        species: pl.species.map(sp => Object.assign({ id: sp.id, body: sp.body, pop: sp.pop, food: sp.food, fat: sp.fat, traits: sp.traits.slice(),
          hidden: p === seat ? sp.hidden.slice() : sp.hidden.map(() => -1) },
          // expansion bits only when present, so base-game views look exactly as before
          sp.av ? { av: true, up: sp.up || 0 } : {}, sp.tmp && sp.tmp.length ? { tmp: sp.tmp.slice() } : {}, sp.noAtk ? { noAtk: true } : {}, sp.inv ? { inv: true } : {})),
      })),
    };
    if (seat >= 0 && s.players[seat]) {
      const me = s.players[seat];
      v.me = { hand: me.hand.slice(), foodCard: me.foodCard, bag: me.bag };
    }
    return v;
  }

  const api = { newGame, apply, applyRaw, toAct, view, feedOptions, canPass, attackBlock, intelNeeded, score, setBot, leafActs, leafOne,
    hungry, canTake, needFood, isCarn, has, trait, MAX, rand, shuffle, clone, findSp, maxBody, upNeed, canIgnore, X };
  // the expansion rules (js/flight.js) work on the same state with these engine pieces
  if (Flight) Flight.bind({ X, has, isCarn, trait, take, gainPop, attack, attackBlock, intelNeeded, canTake, hungry, needFood, draw, log, pname, findSp,
    newSpecies, nextTurn, leafStart, extinct, loseOne, cur, eachInOrder, settleUp, canIgnore, Cards, MAX });
  if (Flight) api.eventOptions = Flight.eventOptions;
  return api;
});
