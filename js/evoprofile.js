/* Evolution Lab: this game's part of the player profile (shared kit js/profile.js, never edit that one here):
   the computer levels' ratings, the achievements, the Daily game and turning a finished game into a result.

   One result per game vs computers. Quitting after your first move counts as a loss. A game where you used
   Undo or Hint counts as "with help" and isn't rated. The guided first game is never counted.
   Plain script: window.EvoProfile in the browser, module.exports in node (tests/profile.test.js). */
(function (root) {
  'use strict';
  // Elo of each level from measured 2-player games (tools/measure-levels.js; js/strength-data.js):
  // difference = 400·log10(p / (1 − p)) for the head-to-head win share p, rounded to 10. Easy anchored at 1200.
  //   Medium beats Easy 77%  -> +210.   Hard beats Medium 73% -> +170.
  const LEVELS = [{ id: 'easy', name: 'Easy', rating: 1200 }, { id: 'medium', name: 'Medium', rating: 1410 }, { id: 'hard', name: 'Hard', rating: 1580 }];
  const RANK = { easy: 0, medium: 1, hard: 2 };

  const won = c => !!(c.last && c.last.won);
  const ex = c => (c.last && c.last.extra) || {};
  const ACH = [
    { id: 'first', title: 'First win', desc: 'Win a game of Evolution', test: c => c.stats.wins >= 1 },
    { id: 'medium', title: 'Survivor', desc: 'Win against Medium computers', test: c => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'Top of the food chain', desc: 'Win against Hard computers', test: c => won(c) && c.last.level === 'hard' },
    { id: 'big', title: 'Thriving herd', desc: 'End a game with a species at population 6', test: c => !ex(c).quit && ex(c).maxPop >= 6 },
    { id: 'many', title: 'Diversity', desc: 'End a game with 5 living species', test: c => !ex(c).quit && ex(c).species >= 5 },
    { id: 'feast', title: 'Feast', desc: 'Score 40 or more food points in one game', test: c => !ex(c).quit && ex(c).food >= 40 },
    { id: 'crowd', title: 'Crowded watering hole', desc: 'Win a game with 6 players', test: c => won(c) && ex(c).players >= 6 },
    { id: 'streak', title: 'Natural selection', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily grazer', desc: '3-day Daily streak', test: c => c.daily.streak >= 3 },
  ];

  // Today's Daily game: the same deal for everyone that day. Standard rules, you + 2 Medium computers.
  const DAILY = { level: 'medium', computers: 2 };

  function init(onDaily) {
    if (!root.Profile) return false;
    root.Profile.init({
      game: 'evolution', levels: LEVELS, achievements: ACH, draws: true,
      modes: { computer: { name: 'vs computer' }, help: { name: 'With help' } },
      daily: { title: 'Daily game', onPlay: () => onDaily && onDaily() },
    });
    return true;
  }

  /** A finished (or abandoned) local game -> Profile.recordResult input.
   *  g: { st: engine state, me, level, helped, daily } */
  function result(g) {
    const st = g.st, me = g.me || 0;
    const over = !!st.over && !!st.result;
    const win = over ? st.result.winners : [];
    let w = false, draw = false;
    if (win.indexOf(me) >= 0) { if (win.length > 1) draw = true; else w = true; }
    const mode = g.helped ? 'help' : 'computer';
    const pl = st.players[me] || { species: [], bag: 0 };
    const sc = over ? st.result.scores[me] : null;
    const extra = { players: st.players.length, rounds: st.round || 0, species: pl.species.length,
      maxPop: pl.species.reduce((a, sp) => Math.max(a, sp.pop), 0), food: sc ? sc.food : pl.bag || 0 };
    if (!over) extra.quit = true;
    return { mode, level: mode === 'computer' ? (RANK[g.level] != null ? g.level : null) : null, won: w, draw, score: sc ? sc.total : 0, daily: !!g.daily, extra };
  }

  const api = { LEVELS, ACH, DAILY, RANK, init, result };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EvoProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
