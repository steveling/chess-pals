// Plays the computer levels against each other and times the owl. Run: node scripts/test-ai.js
global.Chess = require('../js/chess.js');
const ChessAI = require('../js/ai.js');

function play(white, black, maxPlies = 160) {
  const g = new Chess.Game();
  let worst = 0;
  while (!g.result && g.history.length < maxPlies) {
    const lvl = g.turn === 'w' ? white : black;
    const t = Date.now();
    const m = ChessAI.pick(Chess.toFen(g.state), lvl);
    worst = Math.max(worst, Date.now() - t);
    if (!g.play(m)) throw new Error('illegal move from ' + lvl);
  }
  return { result: g.result ? (g.result.winner || 'draw') + ' by ' + g.result.reason : 'unfinished', plies: g.history.length, worst };
}

// Mate in one must be found by the owl and beaver.
for (const lvl of ['beaver', 'owl']) {
  const m = ChessAI.pick('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', lvl);
  console.log(lvl, 'mate in one:', Chess.sqName(m.from) + Chess.sqName(m.to), m.to === Chess.sqFromName('a8') ? 'ok' : 'FAIL');
}
console.log('owl vs sloth', play('owl', 'sloth'));
console.log('beaver vs sloth', play('beaver', 'sloth'));
console.log('owl vs beaver', play('owl', 'beaver'));
