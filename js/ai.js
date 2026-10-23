// The computer buddies. Each one is a level:
//   sloth  (Sleepy Sloth)  mostly random, grabs a free piece now and then, never looks ahead.
//   beaver (Busy Beaver)   looks two moves ahead, makes the odd silly move on purpose.
//   owl    (Clever Owl)    looks three moves ahead and finishes trades; a good game for a grown-up beginner.
// Used inside ai-worker.js (so the screen never freezes) and directly as a fallback.

const ChessAI = (() => {
  const VALUE = { P: 100, N: 300, B: 320, R: 500, Q: 900, K: 0 };

  // Small bonuses for good squares, from White's side (index 0 = a8). Black reads them mirrored.
  const PST = {
    P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    // In the endgame the king should walk to the middle.
    KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };

  const MATE = 100000;

  // Score from the point of view of the side to move.
  function evaluate(s) {
    const { board } = s;
    let heavy = 0;
    for (const p of board) if (p && 'QRBN'.includes(p.toUpperCase())) heavy += VALUE[p.toUpperCase()];
    const endgame = heavy <= 1600;
    let score = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p) continue;
      const t = p.toUpperCase();
      const white = p === t;
      const idx = white ? sq : (7 - (sq >> 3)) * 8 + (sq & 7);
      const table = t === 'K' && endgame ? PST.KE : PST[t];
      const v = VALUE[t] + table[idx];
      score += white ? v : -v;
    }
    return s.turn === 'w' ? score : -score;
  }

  // Try captures of big pieces by small pieces first; it makes the search much faster.
  function order(moves) {
    const key = (m) => (m.captured ? 10 * VALUE[m.captured.toUpperCase()] - VALUE[m.piece.toUpperCase()] + 10000 : 0)
      + (m.promo === 'Q' ? 9000 : 0);
    return moves.sort((a, b) => key(b) - key(a));
  }

  let nodes = 0;
  const NODE_LIMIT = 250000;

  // Keep looking at captures after the last move so trades are finished before judging.
  function quiesce(s, alpha, beta, depth) {
    nodes++;
    const stand = evaluate(s);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0 || nodes > NODE_LIMIT) return alpha;
    const caps = order(Chess.legalMoves(s).filter((m) => m.captured || m.promo === 'Q'));
    for (const m of caps) {
      const score = -quiesce(Chess.makeMove(s, m), -beta, -alpha, depth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function search(s, depth, alpha, beta, ply, useQ) {
    nodes++;
    const moves = Chess.legalMoves(s);
    if (!moves.length) return Chess.inCheck(s) ? -MATE + ply : 0;
    if (s.half >= 100 || Chess.insufficientMaterial(s.board)) return 0;
    if (depth === 0) return useQ ? quiesce(s, alpha, beta, 4) : evaluate(s);
    for (const m of order(moves)) {
      const score = -search(Chess.makeMove(s, m), depth - 1, -beta, -alpha, ply + 1, useQ);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // Score every root move, then pick: best for the owl, best-ish with some slips for the beaver.
  function rootScores(s, depth, useQ, avoidKeys) {
    nodes = 0;
    const out = [];
    const deadline = Date.now() + 2000; // on a slow phone, later (less promising) moves get a quicker look
    for (const m of order(Chess.legalMoves(s))) {
      const next = Chess.makeMove(s, m);
      const d = Date.now() > deadline ? Math.min(depth, 2) : depth;
      let score = -search(next, d - 1, -MATE - 1, MATE + 1, 1, useQ);
      // Do not walk into a repetition draw when ahead.
      if (avoidKeys && avoidKeys.has(Chess.toFen(next).split(' ').slice(0, 3).join(' ')) && score > 0) score -= 150;
      out.push({ m, score });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function pick(fen, level, recent = []) {
    const s = Chess.fromFen(fen);
    const moves = Chess.legalMoves(s);
    if (!moves.length) return null;
    const avoid = new Set(recent);

    if (level === 'sloth') {
      // Takes a free-looking piece about half the time, otherwise wanders. Always queens a pawn.
      const promos = moves.filter((m) => m.promo === 'Q');
      if (promos.length) return promos[0];
      const caps = moves.filter((m) => m.captured);
      if (caps.length && Math.random() < 0.5) return caps[Math.floor(Math.random() * caps.length)];
      const quiet = moves.filter((m) => !m.promo || m.promo === 'Q');
      return quiet[Math.floor(Math.random() * quiet.length)];
    }

    if (level === 'beaver') {
      const scored = rootScores(s, 2, false, avoid).filter((x) => !x.m.promo || x.m.promo === 'Q');
      // One move in five is a so-so move (but never one that loses on the spot to mate).
      if (Math.random() < 0.2 && scored.length > 2) {
        const okay = scored.filter((x) => x.score > -MATE / 2).slice(1, 5);
        if (okay.length) return okay[Math.floor(Math.random() * okay.length)].m;
      }
      const best = scored[0].score;
      const near = scored.filter((x) => x.score >= best - 15);
      return near[Math.floor(Math.random() * near.length)].m;
    }

    // owl
    const scored = rootScores(s, 3, true, avoid);
    const best = scored[0].score;
    const near = scored.filter((x) => x.score >= best - 8);
    return near[Math.floor(Math.random() * near.length)].m;
  }

  return { pick, evaluate };
})();

if (typeof module !== 'undefined') module.exports = ChessAI;
