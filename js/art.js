/* Evolution Lab: our own simple SVG art (no publisher art). One line-icon per trait, drawn on a
   48x48 grid, plus food tokens, the watering hole and the species board pieces. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvoArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // trait -> family: attack (red), defend (blue), feed (green)
  const FAMILY = {
    Carnivore: 'attack', Ambush: 'attack', 'Pack Hunting': 'attack', Intelligence: 'feed',
    Burrowing: 'defend', Climbing: 'defend', 'Defensive Herding': 'defend', 'Hard Shell': 'defend',
    Horns: 'defend', Symbiosis: 'defend', 'Warning Call': 'defend',
    Cooperation: 'feed', 'Fat Tissue': 'feed', Fertile: 'feed', Foraging: 'feed', 'Long Neck': 'feed', Scavenger: 'feed',
  };
  const INK = { attack: '#8a2f22', defend: '#24507f', feed: '#2f6a2b' };
  const PAPER = { attack: '#f6d9cf', defend: '#d6e4f3', feed: '#dcebcf' };

  // stroke paths (fill none) and a few filled bits, 48x48
  const P = {
    Carnivore: '<path d="M8 12h32v6c0 3-2 5-5 5H13c-3 0-5-2-5-5z"/><path d="M14 23l3 10 3-10M28 23l3 10 3-10"/><path d="M10 40c6-4 22-4 28 0"/>',
    Ambush: '<path d="M6 30c6-12 30-12 36 0c-6 8-30 8-36 0z"/><circle cx="24" cy="29" r="5" class="f"/><path d="M8 42l4-8M16 44l2-9M32 44l-2-9M40 42l-4-8"/>',
    'Pack Hunting': '<g class="f"><circle cx="12" cy="14" r="3"/><circle cx="20" cy="10" r="3"/><circle cx="28" cy="14" r="3"/><ellipse cx="20" cy="22" rx="7" ry="5"/><circle cx="26" cy="32" r="2.4"/><circle cx="32" cy="29" r="2.4"/><circle cx="38" cy="32" r="2.4"/><ellipse cx="32" cy="39" rx="5.5" ry="4"/></g>',
    Burrowing: '<path d="M4 30h40"/><path d="M12 30c0-9 24-9 24 0"/><path d="M17 30c0 7 14 7 14 0" stroke-dasharray="3 3"/><path d="M6 38h6M20 40h8M36 38h6"/>',
    Climbing: '<path d="M24 44V8"/><path d="M24 18l-10-6M24 26l11-7M24 34l-9-5"/><path d="M10 44h28"/><circle cx="14" cy="12" r="3" class="f"/><circle cx="35" cy="19" r="3" class="f"/>',
    'Defensive Herding': '<g class="f"><circle cx="24" cy="10" r="4"/><circle cx="36" cy="18" r="4"/><circle cx="36" cy="32" r="4"/><circle cx="24" cy="40" r="4"/><circle cx="12" cy="32" r="4"/><circle cx="12" cy="18" r="4"/></g><circle cx="24" cy="25" r="5"/>',
    'Hard Shell': '<path d="M6 32c0-14 36-14 36 0z"/><path d="M14 32l4-10h12l4 10M18 22l6-6 6 6M24 16v-1"/><path d="M4 32h40"/>',
    Horns: '<path d="M14 30c-8-4-10-14-6-22c2 8 6 12 12 14"/><path d="M34 30c8-4 10-14 6-22c-2 8-6 12-12 14"/><path d="M16 26h16v8c0 6-4 9-8 9s-8-3-8-9z"/>',
    Symbiosis: '<circle cx="18" cy="24" r="10"/><circle cx="30" cy="24" r="10"/><path d="M24 16v16"/>',
    'Warning Call': '<path d="M8 20h6l8-7v22l-8-7H8z" class="f"/><path d="M28 18c3 3 3 9 0 12M33 14c6 6 6 14 0 20M38 10c8 8 8 20 0 28"/>',
    Cooperation: '<path d="M6 26h14l4-4 4 4h14"/><path d="M12 18l-6 8 6 8M36 18l6 8-6 8"/><circle cx="24" cy="12" r="3" class="f"/><circle cx="24" cy="38" r="3" class="f"/>',
    'Fat Tissue': '<path d="M24 6c8 10 12 16 12 23a12 12 0 0 1-24 0c0-7 4-13 12-23z"/><path d="M18 30a6 6 0 0 0 6 6"/>',
    Fertile: '<ellipse cx="22" cy="27" rx="11" ry="14"/><path d="M38 8v12M32 14h12"/>',
    Foraging: '<path d="M10 38C10 20 22 10 38 10c0 16-10 28-28 28z"/><path d="M10 38L30 18"/><path d="M18 30h6M22 26v-6"/>',
    'Long Neck': '<path d="M30 44V20c0-6-2-10-6-12h-8l-4 4 4 3h6v29"/><circle cx="17" cy="11" r="1.5" class="f"/><path d="M14 44h22"/>',
    Scavenger: '<path d="M14 34l20-20"/><circle cx="11" cy="33" r="4"/><circle cx="15" cy="37" r="4"/><circle cx="33" cy="11" r="4"/><circle cx="37" cy="15" r="4"/>',
    Intelligence: '<path d="M24 8c-8 0-13 6-13 13c0 5 3 8 5 10v6h16v-6c2-2 5-5 5-10c0-7-5-13-13-13z"/><path d="M18 42h12M20 20c2-2 6-2 8 0M24 20v10"/>',
  };
  function icon(trait, o) {
    o = o || {};
    const fam = FAMILY[trait] || 'feed';
    const ink = o.ink || INK[fam];
    return '<svg class="ti ' + (o.cls || '') + '" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="' + ink +
      '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><style>.f{fill:' + ink + ';stroke:none}</style>' + (P[trait] || '') + '</svg>';
  }
  // A plant (green) or meat (red) food token; n>1 draws a small stack label
  function food(kind, size) {
    const s = size || 16;
    const c = kind === 'meat' ? '#d0574a' : kind === 'fat' ? '#e9c46a' : '#5fae5a';
    const d = kind === 'meat' ? '#7d231b' : kind === 'fat' ? '#8b6a14' : '#2c5c28';
    return '<svg class="tok" width="' + s + '" height="' + s + '" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="' + c +
      '" stroke="' + d + '" stroke-width="1.5"/>' + (kind === 'meat' ? '<path d="M6 12c2-5 6-6 8-4" stroke="' + d + '" stroke-width="1.6" fill="none"/>' :
      kind === 'fat' ? '<path d="M10 5c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="' + d + '" opacity=".55"/>' :
      '<path d="M6 13c0-5 4-8 8-8c0 5-3 8-8 8zM6 13l5-5" stroke="' + d + '" stroke-width="1.4" fill="none"/>') + '</svg>';
  }
  // The watering hole: a pond whose water level rises with the food in it
  function pond(n) {
    const lvl = Math.min(1, n / 20);
    return '<svg class="pond" viewBox="0 0 200 90" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
      '<defs><radialGradient id="pg" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#4f9ad6"/><stop offset="1" stop-color="#1f4f7a"/></radialGradient></defs>' +
      '<ellipse cx="100" cy="48" rx="96" ry="40" fill="#3a5a2c"/><ellipse cx="100" cy="48" rx="88" ry="34" fill="#6b5634"/>' +
      '<ellipse cx="100" cy="48" rx="' + (40 + 44 * lvl).toFixed(1) + '" ry="' + (14 + 17 * lvl).toFixed(1) + '" fill="url(#pg)" style="transition:all .5s"/>' +
      '<path d="M18 30c4-8 8-8 10 0M26 24c2-7 6-7 6 2M170 66c3-8 8-8 10 0M178 60c2-7 6-7 6 2" stroke="#7fbf5a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  }
  // small numbered dial used for body size and population on the species board
  function dial(kind, n) {
    const col = kind === 'body' ? '#f0b354' : '#6ea8fe';
    return '<span class="dial d-' + kind + '" style="--c:' + col + '"><b>' + n + '</b></span>';
  }
  return { icon, food, pond, dial, FAMILY, INK, PAPER };
});
