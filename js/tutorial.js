/* Evolution Lab: the guided first game and the rules sheet (uses the shared js/coach.js).
   - build(E, name): a stacked first game, you against one Easy computer (2 players). Only the starting hands,
     the deck order and the first player are set; the rules engine is untouched. With SEED, the scripted plays
     below leave the computer with a species your new Carnivore can eat (tests/tutorial.test.js checks it).
   - SCRIPT: the cards you are asked to play in round 1.
   - steps(ctx): the coach's script, driven by the game's own state.
   - rules(TEXT, icon): the base-game rules in our own words, as sheet sections. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.EvoTutorial = factory(root.EvoCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  const { DECK } = Cards;
  const card = (t, f) => DECK.find(c => c.trait === t && c.food === f).id;
  // round 1: a big food card, a card to start a second species, a Carnivore for it and a card to grow it
  const SCRIPT = { food: card('Defensive Herding', 8), species: card('Ambush', -3), carn: card('Carnivore', 2), body: card('Climbing', 1) };
  // the computer gets plant-eater cards only (no defences, no Carnivore), all with plant food on them
  const CPU = [card('Fat Tissue', 4), card('Cooperation', 3), card('Scavenger', 5), card('Foraging', 6)];
  const SEED = 1; // replaced by the seed search below if it ever stops holding (see tests/tutorial.test.js)
  const LEVEL = 'easy';

  function build(E, name, seed) {
    const players = [{ name: name || 'You', bot: null }, { name: 'Computer', bot: null }];
    const s = E.newGame({ seed: seed == null ? SEED : seed, players, quick: false, stepBots: true });
    const want = [[SCRIPT.food, SCRIPT.species, SCRIPT.carn, SCRIPT.body], CPU];
    const wanted = want[0].concat(want[1]);
    // every card in play (deck + hands); a wanted card left out of a 2-player game swaps in for an unwanted one
    let pool = s.deck.concat(s.players[0].hand, s.players[1].hand);
    for (const id of wanted) if (pool.indexOf(id) < 0) { const k = pool.findIndex(x => wanted.indexOf(x) < 0); pool[k] = id; }
    pool = pool.filter(x => wanted.indexOf(x) < 0);
    s.deck = pool;
    s.players[0].hand = want[0].slice().sort((a, b) => a - b);
    s.players[1].hand = want[1].slice().sort((a, b) => a - b);
    s.first = 0;
    s.log = s.log.filter(l => !/goes first/.test(l.t));
    s.log.push({ r: 1, p: -1, t: 'Round 1. ' + s.players[0].name + ' goes first.', k: 'sys' });
    s.players[1].bot = LEVEL;
    return s;
  }

  // ---- the coach's script. ctx: { v() table view or null, me, draft() planned plays, sel() picked card,
  //      mode() Trait/Body/Pop, myTurn() }
  function steps(ctx) {
    const v = () => ctx.v();
    const ph = () => { const x = v(); return x ? x.phase : ''; };
    const r1 = () => { const x = v(); return !!x && x.round === 1; };
    const turnMine = () => ctx.myTurn();
    const draft = () => ctx.draft() || [];
    const planned = t => draft().some(m => m.t === t);
    const mineSp = () => { const x = v(); return x ? x.players[ctx.me].species : []; };
    const carn = () => mineSp().find(sp => sp.traits.some(id => DECK[id].trait === 'Carnivore'));
    const plant = () => mineSp().find(sp => !sp.traits.some(id => DECK[id].trait === 'Carnivore'));
    const attacked = () => { const x = v(); return !!x && x.log.some(l => l.k === 'atk' && l.p === ctx.me); };
    const handCard = id => () => document.querySelector('#hand [data-card="' + id + '"]');
    const feedOn = () => r1() && ph() === 'feed';
    return [
      { title: 'Your first game', html: 'You against one computer. Grow species, feed them, and score the most points: <b>food eaten + population + traits</b>. I’ll show you one round.' },
      { target: '#mine', text: 'Your species. Body size and Population are the two tracks. Each round it must eat one food for each population, or it shrinks.' },
      { target: '#v-play .opps', text: 'The computer’s species sit across the table. Tap any species to read it.' },
      { target: '#v-play .hole .wh', text: 'The watering hole. Plant food lands here each round, and plant eaters take it one at a time.' },
      // ---- food card
      { target: handCard(SCRIPT.food), title: 'Food card', html: 'Everyone puts one card face down as food. Its number (the leaf, bottom right) is plant food. Tap <b>Defensive Herding</b>: +8 is a lot of food.',
        when: () => r1() && ph() === 'food' && turnMine(), until: () => ctx.sel() === SCRIPT.food || ph() !== 'food', skipIf: () => !r1() || ph() !== 'food' },
      { target: '#v-play .acts', html: 'Tap <b>Use as food</b>.', when: () => ph() === 'food', until: () => ph() !== 'food', skipIf: () => !r1() || ph() !== 'food' },
      // ---- play cards
      { target: [handCard(SCRIPT.species), '#v-play .newsp'], title: 'Play cards', html: 'Now your cards. Any card can start a <b>new species</b>: tap <b>Ambush</b>, then a <b>+</b> beside your board.',
        when: () => r1() && ph() === 'play' && turnMine(), until: () => planned('species') || ph() !== 'play', skipIf: () => !r1() || ph() !== 'play' },
      { target: [handCard(SCRIPT.carn), '#mine'], html: 'A card can also be a <b>trait</b>. Tap <b>Carnivore</b>, then tap your <b>new</b> species. Traits go face down until everyone has played.',
        when: () => ph() === 'play' && turnMine(), until: () => draft().some(m => m.card === SCRIPT.carn) || ph() !== 'play', skipIf: () => !r1() || ph() !== 'play' },
      { target: [handCard(SCRIPT.body), '#mine'], html: 'A Carnivore can only eat a species with a <b>smaller body</b>. Tap <b>Climbing</b>, choose <b>Body +1</b>, then tap your new species.',
        when: () => ph() === 'play' && turnMine(), until: () => planned('body') || ph() !== 'play', skipIf: () => !r1() || ph() !== 'play' },
      { target: '#v-play .acts', html: 'Tap <b>Done</b>. The computer plays its cards next.', when: () => ph() === 'play' && turnMine(), until: () => ph() !== 'play' || !turnMine(), skipIf: () => !r1() || ph() !== 'play' },
      // ---- reveal + feeding
      { target: '#v-play .hole .wh', title: 'Reveal', html: 'Traits turned face up and the food cards were added to the watering hole.', when: feedOn, skipIf: () => !r1(), next: true },
      { target: () => { const sp = plant(); return sp && document.querySelector('#mine [data-sp="' + sp.id + '"]'); }, title: 'Feeding', html: 'Players feed one species at a time. Tap your <b>plant eater</b>: it takes 1 plant food.',
        when: () => feedOn() && turnMine(), until: () => { const sp = plant(); return !sp || sp.food > 0 || !feedOn(); }, skipIf: () => !feedOn() },
      { target: () => [document.querySelector('#mine .sp.carnivore'), document.querySelector('#v-play .opps')].filter(Boolean), title: 'Attack', html: 'Your Carnivore eats meat. Tap it, tap the computer’s species with the red outline, then tap <b>Attack</b>.',
        when: () => feedOn() && turnMine() && !!carn(), until: () => attacked() || !feedOn(), skipIf: () => !feedOn() || !carn() },
      { target: '#mine', html: 'It ate meat equal to the prey’s body size, and the prey lost 1 population.', when: () => attacked(), skipIf: () => !attacked() },
      { target: () => document.querySelector('#mine .bag'), html: 'At the end of the round, all eaten food goes into your bag: <b>1 point each</b>. A species that didn’t eat enough shrinks.' },
      { title: 'Your game now', html: 'Play on against the computer. The game ends after the round in which the deck runs out. Rules are under <b>⋯ → How to play</b>.' },
    ];
  }

  // ---- the rules, in our own words
  function rules(TEXT, icon) {
    const tr = t => '<tr><td>' + icon(t) + ' <b>' + t + '</b></td><td>' + TEXT[t] + '</td></tr>';
    const group = (title, list) => '<h4>' + title + '</h4><table>' + list.map(tr).join('') + '</table>';
    return {
      title: 'How to play Evolution',
      intro: 'Base game, 2nd edition rules (2017 rulebook), 2–6 players. Our own words.',
      sections: [
        { id: 'goal', title: 'Goal', short: 'Goal', html: '<p>Score the most points. At the end you get <b>1 point for each food</b> in your bag, <b>1 for each population</b> of your living species, and <b>1 for each trait</b> on your living species.</p><p class="tip">Ties: most trait points, then most population.</p>' },
        { id: 'setup', title: 'Setup', short: 'Setup', html: '<p>Everyone starts with one species: body size 1, population 1. A random player goes first.</p><ul><li>2 players: 40 cards are set aside and a species holds at most 2 traits.</li><li>6 players: Quick Play is used.</li></ul>' },
        { id: 'round', title: 'A round', short: 'Round', html: '<ol><li><b>Deal:</b> 3 cards, plus 1 for each species you have. A player with no species gets a new one.</li><li><b>Food card:</b> everyone puts one card face down at the watering hole.</li><li><b>Play cards:</b> one player at a time from the first player (Quick Play: everyone at once).</li><li><b>Reveal:</b> traits turn face up, then the food cards are added up.</li><li><b>Feed:</b> one species at a time, round the table.</li><li><b>End:</b> hungry species shrink; food goes into the bags; the first player passes left.</li></ol>' },
        { id: 'cards', title: 'Playing cards', short: 'Cards', html: '<p>Each card can be played as:</p><ul><li>a <b>trait</b> on one of your species, face down (at most 3, never two of the same);</li><li>a <b>new species</b> at either end of your row;</li><li><b>+1 body size</b> or <b>+1 population</b> (6 at most).</li></ul><p>You may also discard a trait you have, to make room.</p><p class="tip">The number on each card is its plant food when you use it as your food card.</p>' },
        { id: 'feed', title: 'Feeding', short: 'Feeding', html: '<p>From the first player, each player feeds <b>one species</b>, then the next player goes.</p><ul><li>A plant eater takes 1 plant food from the watering hole.</li><li>A Carnivore attacks a species with a <b>smaller body size</b> (even your own) and eats meat equal to the prey’s body size. The prey loses 1 population.</li><li>A species is fed when its food equals its population.</li></ul><p>If a hungry species of yours can eat, you must feed it. Otherwise you may pass. The round ends when everyone has passed or can’t eat.</p>' },
        { id: 'end', title: 'End of the round and the game', short: 'End', html: '<ul><li>A species’ population drops to the food it ate. At 0 it goes extinct, and you draw a card for each trait it had.</li><li>The food on each species goes into your bag.</li><li>The game ends after the round in which the deck runs out.</li></ul>' },
        { id: 'traits', title: 'Traits', short: 'Traits', html: group('Hunting', ['Carnivore', 'Ambush', 'Pack Hunting', 'Intelligence']) + group('Defence', ['Burrowing', 'Climbing', 'Defensive Herding', 'Hard Shell', 'Horns', 'Symbiosis', 'Warning Call']) + group('Feeding and growth', ['Cooperation', 'Fat Tissue', 'Fertile', 'Foraging', 'Long Neck', 'Scavenger']) },
      ],
    };
  }

  return { SEED, LEVEL, SCRIPT, CPU, build, steps, rules };
});
