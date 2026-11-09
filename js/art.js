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
    // expansions (Flight, promo packs)
    Flight: 'defend', Camouflage: 'defend', Quills: 'defend', Timid: 'defend', 'Last Stand': 'defend',
    'Good Eyesight': 'attack', 'Dive-Bomb': 'attack', Pounce: 'attack', 'Sharp Teeth': 'attack', Claws: 'attack',
    Nesting: 'feed', 'Brood Parasite': 'feed', 'Seed Dispersal': 'feed', 'Unstable DNA': 'feed', Pest: 'feed', 'Invasive Species': 'feed',
    'Rapid Mutation': 'feed', Coprophagia: 'feed', Insectivore: 'feed', Mimicry: 'feed', Trampling: 'feed',
    // Evolution: Climate
    'Cooling Frills': 'defend', 'Mud Wallowing': 'defend', 'Heavy Fur': 'defend',
    Hibernation: 'feed', Migratory: 'feed', Nocturnal: 'feed',
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
    // direction matters: Symbiosis and Cooperation look only to the RIGHT (arrow →); Warning Call guards BOTH sides
    Symbiosis: '<circle cx="14" cy="20" r="7"/><circle cx="32" cy="18" r="11"/><path d="M6 39h34M34 33l6 6-6 6"/>',
    'Warning Call': '<circle cx="24" cy="24" r="5" class="f"/><path d="M16 17c-4 4-4 10 0 14M10 12c-7 7-7 17 0 24M32 17c4 4 4 10 0 14M38 12c7 7 7 17 0 24"/>',
    Cooperation: '<circle cx="12" cy="18" r="6" class="f"/><circle cx="36" cy="18" r="6"/><path d="M6 37h34M34 31l6 6-6 6"/>',
    'Fat Tissue': '<path d="M24 6c8 10 12 16 12 23a12 12 0 0 1-24 0c0-7 4-13 12-23z"/><path d="M18 30a6 6 0 0 0 6 6"/>',
    Fertile: '<ellipse cx="22" cy="27" rx="11" ry="14"/><path d="M38 8v12M32 14h12"/>',
    Foraging: '<path d="M10 38C10 20 22 10 38 10c0 16-10 28-28 28z"/><path d="M10 38L30 18"/><path d="M18 30h6M22 26v-6"/>',
    'Long Neck': '<path d="M30 44V20c0-6-2-10-6-12h-8l-4 4 4 3h6v29"/><circle cx="17" cy="11" r="1.5" class="f"/><path d="M14 44h22"/>',
    Scavenger: '<path d="M14 34l20-20"/><circle cx="11" cy="33" r="4"/><circle cx="15" cy="37" r="4"/><circle cx="33" cy="11" r="4"/><circle cx="37" cy="15" r="4"/>',
    Intelligence: '<path d="M24 8c-8 0-13 6-13 13c0 5 3 8 5 10v6h16v-6c2-2 5-5 5-10c0-7-5-13-13-13z"/><path d="M18 42h12M20 20c2-2 6-2 8 0M24 20v10"/>',
    // expansions. None of these looks to one side only, so none carries an arrow
    Flight: '<path d="M24 26C18 16 10 12 4 14c4 4 8 10 20 12zM24 26c6-10 14-14 20-12c-4 4-8 10-20 12z"/><path d="M24 26v8"/><path d="M10 42h28" stroke-dasharray="3 4"/>',
    Camouflage: '<path d="M6 30c6-10 30-10 36 0c-6 8-30 8-36 0z" stroke-dasharray="4 3"/><path d="M14 30c3-3 6-3 9 0s6 3 9 0"/><path d="M12 12l4 5M24 9v6M36 12l-4 5"/>',
    'Good Eyesight': '<path d="M4 24c8-12 32-12 40 0c-8 12-32 12-40 0z"/><circle cx="24" cy="24" r="7"/><circle cx="24" cy="24" r="3" class="f"/>',
    Nesting: '<path d="M6 28c0 10 36 10 36 0"/><path d="M8 32c8 3 24 3 32 0M10 36c8 2 20 2 28 0"/><ellipse cx="18" cy="24" rx="5" ry="6" class="f"/><ellipse cx="30" cy="24" rx="5" ry="6"/>',
    'Brood Parasite': '<path d="M6 30c0 9 36 9 36 0"/><ellipse cx="16" cy="25" rx="4" ry="5"/><ellipse cx="32" cy="23" rx="7" ry="8" class="f"/><path d="M24 8l4 4-4 4"/>',
    'Dive-Bomb': '<path d="M10 6l14 18 14-18"/><path d="M24 24v14M18 32l6 8 6-8"/><path d="M8 44h32"/>',
    'Seed Dispersal': '<path d="M24 6v10"/><circle cx="24" cy="18" r="3" class="f"/><circle cx="12" cy="28" r="2.5" class="f"/><circle cx="36" cy="28" r="2.5" class="f"/><circle cx="18" cy="38" r="2.5" class="f"/><circle cx="30" cy="38" r="2.5" class="f"/><path d="M22 21l-8 5M26 21l8 5M23 22l-4 13M25 22l4 13" stroke-dasharray="2 3"/>',
    'Unstable DNA': '<path d="M14 6c0 10 20 10 20 18s-20 8-20 18"/><path d="M34 6c0 10-20 10-20 18"/><path d="M34 34v8" stroke-dasharray="3 3"/><path d="M17 12h14M17 36h8"/>',
    'Last Stand': '<path d="M24 6l14 6v10c0 10-6 16-14 20c-8-4-14-10-14-20V12z"/><path d="M24 14v14M24 33v1"/>',
    Pest: '<ellipse cx="24" cy="26" rx="8" ry="11"/><path d="M24 15v22M16 22l-8-4M16 30l-8 2M32 22l8-4M32 30l8 2M20 13l-4-6M28 13l4-6"/>',
    Pounce: '<path d="M6 38c6-16 14-22 26-22"/><path d="M26 10l8 6-8 6"/><path d="M8 42h8M24 42h16"/>',
    Quills: '<path d="M6 36c0-12 36-12 36 0z"/><path d="M12 30L8 16M18 27l-2-15M24 26V10M30 27l2-15M36 30l4-14"/>',
    'Sharp Teeth': '<path d="M6 14h36"/><path d="M10 14l4 14 4-14M18 14l6 22 6-22M30 14l4 14 4-14"/>',
    'Invasive Species': '<circle cx="14" cy="16" r="5" class="f"/><circle cx="34" cy="16" r="5" class="f"/><circle cx="24" cy="32" r="5" class="f"/><path d="M18 19l4 9M30 19l-4 9M19 16h10M10 40h28"/>',
    'Rapid Mutation': '<path d="M14 6c0 10 20 10 20 18s-20 8-20 18M34 6c0 10-20 10-20 18s20 8 20 18"/><path d="M38 20l4 4-4 4M10 20l-4 4 4 4"/>',
    Claws: '<path d="M12 10c6 6 8 16 4 30M24 8c6 6 8 18 4 32M36 10c6 6 6 16 2 28"/>',
    Coprophagia: '<path d="M12 22h24l-3 20H15z"/><path d="M16 22c0-6 16-6 16 0"/><path d="M24 4v10M19 9l5 5 5-5"/>',
    Insectivore: '<ellipse cx="24" cy="28" rx="6" ry="9" class="f"/><circle cx="24" cy="16" r="4"/><path d="M18 24l-9-4M18 30l-9 2M30 24l9-4M30 30l9 2M22 12l-4-6M26 12l4-6"/>',
    Mimicry: '<rect x="6" y="12" width="15" height="22" rx="2"/><rect x="27" y="12" width="15" height="22" rx="2" stroke-dasharray="3 3"/><path d="M13 20v6M34 20v6"/><path d="M8 42h32"/>',
    Timid: '<path d="M16 30c0-10 16-10 16 0v10H16z"/><path d="M18 22l-6-14M30 22l6-14"/><circle cx="21" cy="30" r="1.5" class="f"/><circle cx="27" cy="30" r="1.5" class="f"/><path d="M8 44h32"/>',
    Trampling: '<ellipse cx="16" cy="16" rx="6" ry="8"/><ellipse cx="32" cy="30" rx="6" ry="8"/><path d="M14 36l-6 6M22 42l-4-4M38 10l4-4"/>',
    // Evolution: Climate. Migratory travels away from the watering hole to the bank: arrows → (its direction)
    'Cooling Frills': '<path d="M6 32a18 18 0 0 1 36 0"/><path d="M24 14V6M15 17l-5-6M33 17l5-6M10 25l-7-3M38 25l7-3"/><circle cx="24" cy="34" r="6" class="f"/>',
    'Heavy Fur': '<path d="M6 14c3-4 6 4 9 0s6 4 9 0 6 4 9 0 6 4 9 0"/><path d="M6 25c3-4 6 4 9 0s6 4 9 0 6 4 9 0 6 4 9 0"/><path d="M6 36c3-4 6 4 9 0s6 4 9 0 6 4 9 0 6 4 9 0"/>',
    Hibernation: '<path d="M4 42c0-22 40-22 40 0"/><ellipse cx="24" cy="37" rx="10" ry="5" class="f"/><path d="M30 8h7l-7 8h7M38 4h4l-4 5h4"/>',
    Migratory: '<path d="M6 16l7 8-7 8M19 16l7 8-7 8M32 16l7 8-7 8"/><path d="M6 40h36"/>',
    'Mud Wallowing': '<path d="M5 34c5-5 9 2 14-2s9 2 14-2 7 1 10 0"/><ellipse cx="24" cy="40" rx="19" ry="4"/><circle cx="15" cy="20" r="3" class="f"/><circle cx="27" cy="13" r="2.6" class="f"/><circle cx="34" cy="23" r="2.2" class="f"/>',
    Nocturnal: '<path d="M28 8a16 16 0 1 0 12 26A13 13 0 0 1 28 8z"/><circle cx="10" cy="10" r="1.8" class="f"/><circle cx="17" cy="5" r="1.4" class="f"/><circle cx="40" cy="12" r="1.8" class="f"/>',
  };
  // Climate card icons: suns push the climate warmer, snowflakes colder (n = how many on the card)
  const SUN = '#d98a1c', SNOW = '#3f86c6';
  function clim(kind, size) {
    const s = size || 12;
    return kind === 'sun' ?
      '<svg class="cli sun" width="' + s + '" height="' + s + '" viewBox="0 0 20 20" aria-hidden="true" fill="' + SUN + '" stroke="' + SUN + '" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="4.2"/><path d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5M4 4l1.8 1.8M14.2 14.2 16 16M16 4l-1.8 1.8M5.8 14.2 4 16"/></svg>' :
      '<svg class="cli snow" width="' + s + '" height="' + s + '" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="' + SNOW + '" stroke-width="1.9" stroke-linecap="round"><path d="M10 1.5v17M2.6 5.8l14.8 8.4M2.6 14.2l14.8-8.4M7.5 2.8 10 5l2.5-2.2M7.5 17.2 10 15l2.5 2.2"/></svg>';
  }
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
  return { icon, food, pond, dial, clim, FAMILY, INK, PAPER };
});
