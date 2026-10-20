/* Evolution Lab: the numbers layer. Exact math from what a seat can see:
   - watering hole: the food the hidden food cards will add, as a probability distribution
     (each unseen card is equally likely to be any other player's food card; a fair "they picked
     at random" baseline, shown with a ? that says so)
   - threat map: which carnivore can eat which species right now, and why not */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'), require('./engine.js'));
  else root.EvoOdds = factory(root.EvoCards, root.EvoEngine);
})(typeof self !== 'undefined' ? self : this, function (Cards, E) {
  'use strict';
  const { DECK } = Cards;

  // the food numbers this seat has not seen: whole deck minus my hand, my food card,
  // traits face up on any board, my own face-down traits, and food cards revealed earlier
  function unseenFoods(v) {
    const seen = new Set();
    const me = v.me || { hand: [] };
    for (const id of me.hand) seen.add(id);
    if (me.foodCard != null && me.foodCard >= 0) seen.add(me.foodCard);
    v.players.forEach(pl => pl.species.forEach(sp => { sp.traits.forEach(id => seen.add(id)); sp.hidden.forEach(id => { if (id >= 0) seen.add(id); }); }));
    (v.hist || []).forEach(h => (h.foodCards || []).forEach(id => seen.add(id)));
    const out = [];
    for (const c of DECK) if (!seen.has(c.id)) out.push(c.food);
    return out;
  }

  // distribution of the sum of k cards drawn without replacement from `foods`
  // (k is at most 5, values small: exact dynamic programming over counts)
  function sumDist(foods, k) {
    const cnt = {};
    for (const f of foods) cnt[f] = (cnt[f] || 0) + 1;
    const vals = Object.keys(cnt).map(Number);
    // dp over values: map "picked,sum" -> number of ways
    let dp = new Map([['0,0', 1]]);
    for (const val of vals) {
      const c = cnt[val];
      const next = new Map();
      for (const [key, ways] of dp) {
        const [pk, sm] = key.split(',').map(Number);
        let comb = 1;
        for (let j = 0; j <= Math.min(c, k - pk); j++) {
          if (j > 0) comb = comb * (c - j + 1) / j;
          const nk = (pk + j) + ',' + (sm + j * val);
          next.set(nk, (next.get(nk) || 0) + ways * comb);
        }
      }
      dp = next;
    }
    const dist = new Map();
    let total = 0;
    for (const [key, ways] of dp) {
      const [pk, sm] = key.split(',').map(Number);
      if (pk !== k) continue;
      dist.set(sm, (dist.get(sm) || 0) + ways); total += ways;
    }
    const arr = [...dist.entries()].sort((a, b) => a[0] - b[0]).map(([s, w]) => ({ sum: s, p: w / total }));
    return arr;
  }

  // what the watering hole will hold after the reveal, from seat v.seat's point of view
  // myFood = the food number of my chosen (or considered) card, or null if not chosen
  function holeForecast(v, myFood) {
    const others = v.players.filter((pl, p) => p !== v.seat && (pl.handSize > 0 || pl.foodPicked)).length;
    const foods = unseenFoods(v);
    const dist = sumDist(foods, Math.min(others, foods.length));
    const base = v.hole + (myFood || 0);
    const after = new Map();
    for (const d of dist) { const h = Math.max(0, base + d.sum); after.set(h, (after.get(h) || 0) + d.p); }
    const list = [...after.entries()].sort((a, b) => a[0] - b[0]).map(([h, p]) => ({ h, p }));
    const mean = list.reduce((a, x) => a + x.h * x.p, 0);
    const q = f => { let c = 0; for (const x of list) { c += x.p; if (c >= f) return x.h; } return list.length ? list[list.length - 1].h : 0; };
    const meanCard = foods.length ? foods.reduce((a, b) => a + b, 0) / foods.length : 0;
    return { list, mean, lo: q(0.1), hi: q(0.9), meanCard, others, pAtLeast: n => list.reduce((a, x) => a + (x.h >= n ? x.p : 0), 0) };
  }

  // plant mouths: how much plant food every non-carnivore still needs this round
  function plantDemand(v) {
    let need = 0;
    v.players.forEach(pl => pl.species.forEach(sp => {
      const carn = sp.traits.some(id => DECK[id].trait === 'Carnivore');
      if (!carn) need += Math.max(0, sp.pop - sp.food);
    }));
    return need;
  }

  // threat map from a view: for each species, the carnivores that can attack it now.
  // Works on a view (face-down traits count as unknown = ignored, like at the table).
  function threatMap(v) {
    const s = { players: v.players.map(pl => ({ species: pl.species.map(sp => ({ id: sp.id, body: sp.body, pop: sp.pop, food: sp.food, fat: sp.fat, traits: sp.traits.slice(), hidden: [] })) })) };
    const out = [];
    s.players.forEach((pl, cp) => pl.species.forEach((C, ci) => {
      if (!E.isCarn(C)) return;
      s.players.forEach((tl, tp) => tl.species.forEach((T, ti) => {
        if (tp === cp && ti === ci) return;
        const why = E.attackBlock(s, cp, ci, tp, ti);
        out.push({ cp, ci, cid: C.id, tp, ti, tid: T.id, ok: !why, why });
      }));
    }));
    return out;
  }

  return { unseenFoods, sumDist, holeForecast, plantDemand, threatMap };
});
