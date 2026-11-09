// Climate games between computers: legality over many seeded games + the level ladder.
// node tools/climate-sim.js [games per pairing=200] [version=climate]
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const N = +process.argv[2] || 200;
const version = process.argv[3] || 'climate';
function play(seed, levels) {
  const players = levels.map((l, i) => ({ name: l + i, bot: l }));
  return E.newGame({ seed, players, version });
}
function pairing(a, b, n) {
  let wa = 0, wb = 0, rounds = 0;
  for (let g = 0; g < n; g++) {
    // swap seats every other game so seat order doesn't decide
    const lv = g % 2 ? [b, a] : [a, b];
    const s = play(1000 + g, lv);
    if (!s.over) throw new Error('game ' + g + ' never ended');
    rounds += s.round;
    const w = s.result.winners;
    const share = 1 / w.length;
    for (const p of w) { if (lv[p] === a) wa += share; else wb += share; }
  }
  return { a, b, aWin: (100 * wa / n).toFixed(1) + '%', bWin: (100 * wb / n).toFixed(1) + '%', rounds: (rounds / n).toFixed(1) };
}
function table(lead, rest, size, n) {
  let w = 0;
  for (let g = 0; g < n; g++) {
    const seat = g % size;
    const lv = Array.from({ length: size }, (_, i) => (i === seat ? lead : rest));
    const s = play(5000 + g, lv);
    if (s.result.winners.indexOf(seat) >= 0) w += 1 / s.result.winners.length;
  }
  return { lead, rest, size, leadWin: (100 * w / n).toFixed(1) + '%', fair: (100 / size).toFixed(0) + '%' };
}
const t0 = Date.now();
console.log(version, N, 'games per pairing');
console.log(pairing('hard', 'easy', N));
console.log(pairing('hard', 'medium', N));
console.log(pairing('medium', 'easy', N));
console.log(table('hard', 'medium', 4, Math.round(N / 2)));
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(0));
