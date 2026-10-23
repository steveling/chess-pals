// Chess rules. Pure logic, no screen stuff, so the computer player and the tests can use it too.
//
// The board is an array of 64 squares. Square 0 is a8 (top left from White's side), 7 is h8,
// 56 is a1 and 63 is h1. A piece is one letter: uppercase is White, lowercase is Black
// (P pawn, N knight, B bishop, R rook, Q queen, K king). An empty square is null.
//
// Every official rule is here: castling (with all its conditions), en passant, promotion,
// check, checkmate, stalemate, the fifty-move rule, threefold repetition and
// not-enough-pieces-to-checkmate. Draws by repetition and fifty moves are called automatically,
// as most chess apps do, so nobody has to know to claim them.

const Chess = (() => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const LINE = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const typeOf = (p) => (p ? p.toUpperCase() : null);
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const rowOf = (sq) => sq >> 3;
  const colOf = (sq) => sq & 7;
  const at = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
  const sqName = (sq) => FILES[colOf(sq)] + (8 - rowOf(sq));
  const sqFromName = (n) => at(8 - Number(n[1]), FILES.indexOf(n[0]));

  // Where each rook starts, and which castling right it carries.
  const ROOK_RIGHTS = { 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };

  // ---------- positions ----------

  function fromFen(fen) {
    const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    let sq = 0;
    for (const ch of placement) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) sq += Number(ch);
      else board[sq++] = ch;
    }
    return {
      board,
      turn: turn || 'w',
      castling: castle && castle !== '-' ? castle : '',
      ep: ep && ep !== '-' ? sqFromName(ep) : -1,
      half: Number(half) || 0,
      full: Number(full) || 1,
    };
  }

  function toFen(s) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = s.board[r * 8 + c];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p;
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    return `${out} ${s.turn} ${s.castling || '-'} ${s.ep >= 0 ? sqName(s.ep) : '-'} ${s.half} ${s.full}`;
  }

  // The part of a position that counts for repetition: pieces, whose turn, castling rights,
  // and en passant only when a capture is actually possible (that is the official rule).
  function positionKey(s) {
    const ep = s.ep >= 0 && legalMoves(s).some((m) => m.flag === 'ep') ? sqName(s.ep) : '-';
    return toFen(s).split(' ').slice(0, 3).join(' ') + ' ' + ep;
  }

  // ---------- attacks ----------

  // Is square sq attacked by any piece of color by?
  function isAttacked(board, sq, by) {
    const r = rowOf(sq), c = colOf(sq);
    const up = by === 'w' ? 1 : -1; // White pawns attack toward row - 1, so they sit at row + 1.
    const pawn = by === 'w' ? 'P' : 'p';
    for (const dc of [-1, 1]) {
      const s = at(r + up, c + dc);
      if (s >= 0 && board[s] === pawn) return true;
    }
    const knight = by === 'w' ? 'N' : 'n';
    for (const [dr, dc] of KNIGHT) {
      const s = at(r + dr, c + dc);
      if (s >= 0 && board[s] === knight) return true;
    }
    const king = by === 'w' ? 'K' : 'k';
    for (const [dr, dc] of KING) {
      const s = at(r + dr, c + dc);
      if (s >= 0 && board[s] === king) return true;
    }
    const slide = (dirs, kinds) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = board[rr * 8 + cc];
          if (p) {
            if (colorOf(p) === by && kinds.includes(typeOf(p))) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    };
    return slide(DIAG, 'BQ') || slide(LINE, 'RQ');
  }

  function kingSquare(board, color) {
    const k = color === 'w' ? 'K' : 'k';
    return board.indexOf(k);
  }

  function inCheck(s, color = s.turn) {
    const k = kingSquare(s.board, color);
    return k >= 0 && isAttacked(s.board, k, other(color));
  }

  // ---------- moves ----------

  // Moves that follow how the pieces move, before checking whether they leave the king in check.
  function pseudoMoves(s, onlyFrom = -1) {
    const moves = [];
    const { board, turn } = s;
    const add = (from, to, flag) => {
      const piece = board[from];
      const captured = flag === 'ep' ? board[to + (turn === 'w' ? 8 : -8)] : board[to];
      if (typeOf(piece) === 'P' && (rowOf(to) === 0 || rowOf(to) === 7)) {
        for (const promo of 'QRBN') moves.push({ from, to, piece, captured, promo, flag: 'promo' });
      } else {
        moves.push({ from, to, piece, captured, flag });
      }
    };

    for (let from = 0; from < 64; from++) {
      if (onlyFrom >= 0 && from !== onlyFrom) continue;
      const p = board[from];
      if (!p || colorOf(p) !== turn) continue;
      const r = rowOf(from), c = colOf(from);
      const t = typeOf(p);

      if (t === 'P') {
        const dir = turn === 'w' ? -1 : 1;
        const startRow = turn === 'w' ? 6 : 1;
        const one = at(r + dir, c);
        if (one >= 0 && !board[one]) {
          add(from, one);
          const two = at(r + 2 * dir, c);
          if (r === startRow && !board[two]) add(from, two, 'double');
        }
        for (const dc of [-1, 1]) {
          const to = at(r + dir, c + dc);
          if (to < 0) continue;
          if (board[to] && colorOf(board[to]) !== turn) add(from, to);
          else if (to === s.ep) add(from, to, 'ep');
        }
      } else if (t === 'N' || t === 'K') {
        for (const [dr, dc] of t === 'N' ? KNIGHT : KING) {
          const to = at(r + dr, c + dc);
          if (to >= 0 && colorOf(board[to]) !== turn) add(from, to);
        }
        if (t === 'K') addCastles(s, from, moves);
      } else {
        const dirs = t === 'B' ? DIAG : t === 'R' ? LINE : DIAG.concat(LINE);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const to = rr * 8 + cc;
            if (board[to]) {
              if (colorOf(board[to]) !== turn) add(from, to);
              break;
            }
            add(from, to);
            rr += dr; cc += dc;
          }
        }
      }
    }
    return moves;
  }

  // Castling: the king and rook have not moved (rights still held), the squares between them are
  // empty, the king is not in check, and it does not pass through or land on an attacked square.
  function addCastles(s, from, moves) {
    const { board, turn, castling } = s;
    const home = turn === 'w' ? 60 : 4;
    if (from !== home) return;
    const enemy = other(turn);
    const king = board[from];
    const rook = turn === 'w' ? 'R' : 'r';
    const kSide = turn === 'w' ? 'K' : 'k';
    const qSide = turn === 'w' ? 'Q' : 'q';
    if (!castling.includes(kSide) && !castling.includes(qSide)) return;
    if (isAttacked(board, home, enemy)) return;

    if (castling.includes(kSide) && board[home + 3] === rook &&
        !board[home + 1] && !board[home + 2] &&
        !isAttacked(board, home + 1, enemy) && !isAttacked(board, home + 2, enemy)) {
      moves.push({ from, to: home + 2, piece: king, captured: null, flag: 'castleK' });
    }
    if (castling.includes(qSide) && board[home - 4] === rook &&
        !board[home - 1] && !board[home - 2] && !board[home - 3] &&
        !isAttacked(board, home - 1, enemy) && !isAttacked(board, home - 2, enemy)) {
      moves.push({ from, to: home - 2, piece: king, captured: null, flag: 'castleQ' });
    }
  }

  // Play a move and return the new position (the old one is left alone).
  function makeMove(s, m) {
    const board = s.board.slice();
    const { turn } = s;
    board[m.to] = m.promo ? (turn === 'w' ? m.promo : m.promo.toLowerCase()) : board[m.from];
    board[m.from] = null;
    if (m.flag === 'ep') board[m.to + (turn === 'w' ? 8 : -8)] = null;
    if (m.flag === 'castleK') { board[m.to - 1] = board[m.to + 1]; board[m.to + 1] = null; }
    if (m.flag === 'castleQ') { board[m.to + 1] = board[m.to - 2]; board[m.to - 2] = null; }

    let castling = s.castling;
    if (castling) {
      if (typeOf(m.piece) === 'K') castling = castling.replace(turn === 'w' ? /[KQ]/g : /[kq]/g, '');
      for (const sq of [m.from, m.to]) if (ROOK_RIGHTS[sq]) castling = castling.replace(ROOK_RIGHTS[sq], '');
    }

    return {
      board,
      turn: other(turn),
      castling,
      ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
      half: typeOf(m.piece) === 'P' || m.captured ? 0 : s.half + 1,
      full: turn === 'b' ? s.full + 1 : s.full,
    };
  }

  function legalMoves(s, onlyFrom = -1) {
    return pseudoMoves(s, onlyFrom).filter((m) => !inCheck(makeMove(s, m), s.turn));
  }

  // ---------- endings ----------

  // Not enough pieces left for anyone to checkmate: king vs king, king and one bishop or knight
  // vs king, or kings with bishops that all stand on the same color of square.
  function insufficientMaterial(board) {
    const rest = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p || typeOf(p) === 'K') continue;
      if ('PRQ'.includes(typeOf(p))) return false;
      rest.push({ t: typeOf(p), shade: (rowOf(sq) + colOf(sq)) % 2 });
    }
    if (rest.length <= 1) return true;
    if (rest.every((x) => x.t === 'B')) return rest.every((x) => x.shade === rest[0].shade);
    return false;
  }

  // ---------- notation ----------

  function san(s, m, legal = legalMoves(s)) {
    let out;
    if (m.flag === 'castleK') out = 'O-O';
    else if (m.flag === 'castleQ') out = 'O-O-O';
    else {
      const t = typeOf(m.piece);
      const capture = !!m.captured;
      if (t === 'P') {
        out = (capture ? FILES[colOf(m.from)] + 'x' : '') + sqName(m.to);
        if (m.promo) out += '=' + m.promo;
      } else {
        const twins = legal.filter((o) => o.to === m.to && o.from !== m.from && typeOf(o.piece) === t);
        let dis = '';
        if (twins.length) {
          const sameCol = twins.some((o) => colOf(o.from) === colOf(m.from));
          const sameRow = twins.some((o) => rowOf(o.from) === rowOf(m.from));
          if (!sameCol) dis = FILES[colOf(m.from)];
          else if (!sameRow) dis = String(8 - rowOf(m.from));
          else dis = sqName(m.from);
        }
        out = t + dis + (capture ? 'x' : '') + sqName(m.to);
      }
    }
    const next = makeMove(s, m);
    if (inCheck(next)) out += legalMoves(next).length ? '+' : '#';
    return out;
  }

  const uci = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');

  // ---------- a whole game ----------

  // Keeps the history so it can tell repetitions, undo, and say how the game ended.
  class Game {
    constructor(fen = START_FEN) {
      this.startFen = fen;
      this.state = fromFen(fen);
      this.history = []; // { move, san, before }
      this.keys = [positionKey(this.state)];
      this.result = null;
      this.updateResult();
    }

    get turn() { return this.state.turn; }
    get board() { return this.state.board; }
    moves(from = -1) { return this.result ? [] : legalMoves(this.state, from); }
    inCheck() { return inCheck(this.state); }
    lastMove() { return this.history.length ? this.history[this.history.length - 1].move : null; }

    play(m) {
      const legal = legalMoves(this.state);
      const found = legal.find((o) => o.from === m.from && o.to === m.to &&
        (o.promo || null) === (m.promo || null));
      if (!found || this.result) return null;
      const entry = { move: found, san: san(this.state, found, legal), before: this.state };
      this.state = makeMove(this.state, found);
      this.history.push(entry);
      this.keys.push(positionKey(this.state));
      this.updateResult();
      return entry;
    }

    playUci(text) {
      const from = sqFromName(text.slice(0, 2)), to = sqFromName(text.slice(2, 4));
      const promo = text[4] ? text[4].toUpperCase() : undefined;
      return this.play({ from, to, promo });
    }

    undo() {
      const entry = this.history.pop();
      if (!entry) return null;
      this.state = entry.before;
      this.keys.pop();
      this.result = null;
      this.updateResult();
      return entry;
    }

    // Ends the game by agreement or resignation (not decided by the board).
    end(result) { this.result = result; }

    updateResult() {
      const s = this.state;
      const legal = legalMoves(s);
      if (!legal.length) {
        this.result = inCheck(s)
          ? { winner: other(s.turn), reason: 'checkmate' }
          : { winner: null, reason: 'stalemate' };
      } else if (insufficientMaterial(s.board)) {
        this.result = { winner: null, reason: 'material' };
      } else if (s.half >= 100) {
        this.result = { winner: null, reason: 'fifty' };
      } else if (this.keys.filter((k) => k === this.keys[this.keys.length - 1]).length >= 3) {
        this.result = { winner: null, reason: 'repetition' };
      } else {
        this.result = null;
      }
    }

    uciList() { return this.history.map((h) => uci(h.move)); }
  }

  return {
    START_FEN, Game, fromFen, toFen, legalMoves, pseudoMoves, makeMove, inCheck, isAttacked,
    kingSquare, insufficientMaterial, san, uci, sqName, sqFromName, colorOf, typeOf, other,
    rowOf, colOf,
  };
})();

if (typeof module !== 'undefined') module.exports = Chess;
