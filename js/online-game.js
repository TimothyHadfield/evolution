/* The Evolution engine as the shared online module's `game` object (see _online/README.md).
   Computers chosen before the start are answered inside the engine (no extra Firestore writes);
   game.bot only covers a seat handed to a computer mid-game. publicView never holds the seed, the
   deck order, anyone's hand, food bag, face-down traits or face-down food card. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'), require('./bots.js'));
  } else root.EvoOnlineGame = factory(root.EvoEngine, root.EvoBots);
})(typeof self !== 'undefined' ? self : this, function (E, B) {
  'use strict';
  const LEVELS = ['easy', 'medium', 'hard'];
  const game = {
    id: 'evolution',
    minSeats: 2,
    maxSeats: 6,
    // options: {level: 'easy'|'medium'|'hard', quick: Quick Play variant}
    setup(nSeats, options, rng, seats) {
      const o = options || {};
      const level = LEVELS.indexOf(o.level) >= 0 ? o.level : 'hard';
      const players = [];
      for (let i = 0; i < nSeats; i++) {
        const s = (seats && seats[i]) || { kind: 'computer' };
        players.push({ name: Array.from(String(s.name || (s.kind === 'computer' ? 'Computer ' + (i + 1) : 'Player ' + (i + 1)))).slice(0, 24).join(''), bot: s.kind === 'computer' ? level : null });
      }
      return E.newGame({ seed: Math.floor(rng() * 4294967296) >>> 0, players, quick: o.quick === true });
    },
    toAct(state) { return E.toAct(state); },
    apply(state, seat, action) {
      if (!action || typeof action !== 'object') throw new Error('Bad move');
      return E.apply(state, seat, action);
    },
    publicView(state) {
      const v = E.view(state, -1);
      delete v.me;
      return v;
    },
    // my hand, my bag, my food card and my own face-down traits (by species id)
    privateView(state, seat) {
      const pl = state.players[seat];
      if (!pl) return {};
      const hidden = {};
      for (const sp of pl.species) if (sp.hidden.length) hidden[sp.id] = sp.hidden.slice();
      return { me: { hand: pl.hand.slice(), foodCard: pl.foodCard, bag: pl.bag }, hidden };
    },
    bot(ctx, seat) { return B.decide(ctx.state, seat, 'hard'); },
    isOver(state) { return !!state.over; },
  };
  // the screens use the same shape as EvoEngine.view(state, seat)
  function viewFromSnap(snap) {
    const pub = snap.pub;
    if (!pub) return null;
    const seat = snap.mySeat;
    const mine = snap.mine || {};
    const v = Object.assign({}, pub, { seat, me: mine.me || { hand: [], foodCard: null, bag: 0 } });
    v.players = pub.players.map((pl, p) => {
      if (p !== seat) return pl;
      const hid = mine.hidden || {};
      return Object.assign({}, pl, { bag: mine.me ? mine.me.bag : pl.bag,
        species: pl.species.map(sp => Object.assign({}, sp, { hidden: hid[sp.id] ? hid[sp.id].slice() : sp.hidden.map(() => -1) })) });
    });
    return v;
  }
  return { game, viewFromSnap };
});
