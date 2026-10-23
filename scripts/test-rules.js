// Checks the rules engine against well-known move counts ("perft") and a few special endings.
// Run: node scripts/test-rules.js
const Chess = require('../js/chess.js');

function perft(s, depth) {
  if (depth === 0) return 1;
  const moves = Chess.legalMoves(s);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(Chess.makeMove(s, m), depth - 1);
  return n;
}

const cases = [
  ['start', Chess.START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

let fail = 0;
const ok = (cond, label) => { if (!cond) { fail++; console.log('FAIL', label); } else console.log('ok  ', label); };

for (const [name, fen, counts] of cases) {
  const s = Chess.fromFen(fen);
  counts.forEach((want, i) => {
    const got = perft(s, i + 1);
    ok(got === want, `${name} depth ${i + 1}: ${got} (want ${want})`);
  });
}

// Fool's mate.
let g = new Chess.Game();
['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach((m) => g.playUci(m));
ok(g.result && g.result.reason === 'checkmate' && g.result.winner === 'b', "fool's mate");
ok(g.history[3].san === 'Qh4#', 'mate notation Qh4#');

// Stalemate.
g = new Chess.Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
ok(g.result && g.result.reason === 'stalemate', 'stalemate');

// Threefold repetition.
g = new Chess.Game();
['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'].forEach((m) => g.playUci(m));
ok(g.result && g.result.reason === 'repetition', 'threefold repetition');

// Insufficient material.
g = new Chess.Game('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1');
ok(g.result && g.result.reason === 'material', 'K+B vs K is a draw');
g = new Chess.Game('8/8/8/4k3/8/8/2N5/4K2R w - - 0 1');
ok(!g.result, 'K+N+R vs K plays on');

// Fifty-move rule.
g = new Chess.Game('8/8/8/4k3/8/8/8/R3K3 w - - 99 80');
g.playUci('a1a2');
ok(g.result && g.result.reason === 'fifty', 'fifty-move rule');

// En passant + notation.
g = new Chess.Game();
['e2e4', 'a7a6', 'e4e5', 'd7d5'].forEach((m) => g.playUci(m));
const ep = g.playUci('e5d6');
ok(ep && ep.move.flag === 'ep' && ep.san === 'exd6' && !g.board[Chess.sqFromName('d5')], 'en passant');

// Castling through check is not allowed.
g = new Chess.Game('4k3/8/8/8/8/8/5r2/4K2R w K - 0 1');
ok(!g.moves().some((m) => m.flag === 'castleK'), 'no castling through attacked square');
g = new Chess.Game('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
const c = g.playUci('e1c1');
ok(c && c.san === 'O-O-O' && g.board[Chess.sqFromName('d1')] === 'R', 'queenside castle');

// Promotion with check.
g = new Chess.Game('k7/4P3/8/8/8/8/8/4K3 w - - 0 1');
const pr = g.playUci('e7e8q');
ok(pr && pr.san === 'e8=Q+' && g.board[Chess.sqFromName('e8')] === 'Q', 'promotion e8=Q+');

// Undo.
g.undo();
ok(g.board[Chess.sqFromName('e7')] === 'P' && g.turn === 'w', 'undo');

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nall rules tests passed');
