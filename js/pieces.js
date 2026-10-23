// The pieces: the real chess shapes (so what he learns works on any chess set), with friendly faces.
// Each piece is a small SVG. Faces look worried when the piece is in danger and the king
// gets nervous in check (see .is-worried in css/style.css).

const Pieces = (() => {
  // Shared bits.
  const base = `
    <rect class="pc-body" x="18" y="80" width="64" height="12" rx="6"/>
    <rect class="pc-shade" x="24" y="72" width="52" height="10" rx="5"/>`;

  // A face centered at (x, y). size scales it a little for bigger heads.
  function face(x, y, k = 1, extra = '') {
    const ex = 6.5 * k, er = 3.6 * k, pr = 2 * k;
    return `
    <g class="pc-face">
      <g class="pc-eyes">
        <ellipse class="pc-eye" cx="${x - ex}" cy="${y}" rx="${er}" ry="${er * 1.12}"/>
        <ellipse class="pc-eye" cx="${x + ex}" cy="${y}" rx="${er}" ry="${er * 1.12}"/>
        <circle class="pc-pupil" cx="${x - ex + 0.6}" cy="${y + 0.6}" r="${pr}"/>
        <circle class="pc-pupil" cx="${x + ex + 0.6}" cy="${y + 0.6}" r="${pr}"/>
      </g>
      <path class="pc-brow" d="M${x - ex - 4 * k} ${y - 5 * k} L${x - ex + 3 * k} ${y - 8 * k} M${x + ex + 4 * k} ${y - 5 * k} L${x + ex - 3 * k} ${y - 8 * k}"/>
      <ellipse class="pc-cheek" cx="${x - ex - 3 * k}" cy="${y + 6 * k}" rx="${3 * k}" ry="${2 * k}"/>
      <ellipse class="pc-cheek" cx="${x + ex + 3 * k}" cy="${y + 6 * k}" rx="${3 * k}" ry="${2 * k}"/>
      <path class="pc-mouth pc-happy" d="M${x - 4.5 * k} ${y + 6 * k} Q${x} ${y + 10.5 * k} ${x + 4.5 * k} ${y + 6 * k}"/>
      <ellipse class="pc-mouth pc-oh" cx="${x}" cy="${y + 8 * k}" rx="${2.4 * k}" ry="${3 * k}"/>
      ${extra}
    </g>`;
  }

  const SHAPES = {
    P: () => `${base}
      <path class="pc-body" d="M33 74 C35 60 40 52 43 46 h14 C60 52 65 60 67 74 Z"/>
      <rect class="pc-shade" x="36" y="43" width="28" height="7" rx="3.5"/>
      <circle class="pc-body" cx="50" cy="30" r="15"/>
      ${face(50, 29, 0.85)}`,

    R: () => `${base}
      <path class="pc-body" d="M29 74 L33 42 h34 L71 74 Z"/>
      <path class="pc-body" d="M25 16 h11 v8 h7 v-8 h14 v8 h7 v-8 h11 v26 H25 Z"/>
      <rect class="pc-shade" x="25" y="38" width="50" height="6" rx="2"/>
      ${face(50, 55, 1)}`,

    N: () => `${base}
      <path class="pc-body" d="M32 74 C31 63 36 57 41 51 C35 52 27 53 22 48 C18 43 24 33 33 27 L36 13 L44 23 C59 21 72 32 71 50 C70 61 67 67 68 74 Z"/>
      <path class="pc-mane" d="M46 23 C60 25 69 36 67 56 C66 63 64 68 65 74"/>
      <g class="pc-face">
        <g class="pc-eyes">
          <ellipse class="pc-eye" cx="42" cy="35" rx="4.4" ry="5"/>
          <circle class="pc-pupil" cx="41" cy="36" r="2.4"/>
        </g>
        <path class="pc-brow" d="M36 30 Q40 25 47 28"/>
        <circle class="pc-nostril" cx="25.5" cy="44" r="1.8"/>
        <ellipse class="pc-cheek" cx="36" cy="44" rx="3" ry="2"/>
        <path class="pc-mouth pc-happy" d="M24 49 Q29 52 34 49"/>
        <ellipse class="pc-mouth pc-oh" cx="28" cy="50" rx="2.2" ry="2.6"/>
      </g>`,

    B: () => `${base}
      <path class="pc-body" d="M36 74 L39 60 h22 L64 74 Z"/>
      <rect class="pc-shade" x="34" y="56" width="32" height="7" rx="3.5"/>
      <path class="pc-body" d="M50 19 C64 28 70 42 63 57 H37 C30 42 36 28 50 19 Z"/>
      <path class="pc-slit" d="M57 25 L49 36"/>
      <circle class="pc-body" cx="50" cy="13" r="6"/>
      ${face(50, 43, 0.85)}`,

    Q: () => `${base}
      <path class="pc-body" d="M31 74 C29 60 34 48 50 46 C66 48 71 60 69 74 Z"/>
      <path class="pc-crown" d="M29 48 L24 22 L37 35 L44 15 L50 31 L56 15 L63 35 L76 22 L71 48 Z"/>
      <circle class="pc-gem" cx="24" cy="20" r="4.2"/>
      <circle class="pc-gem" cx="44" cy="13" r="4.2"/>
      <circle class="pc-gem" cx="56" cy="13" r="4.2"/>
      <circle class="pc-gem" cx="76" cy="20" r="4.2"/>
      ${face(50, 59, 0.95)}`,

    K: () => `${base}
      <path class="pc-body" d="M31 74 C29 60 34 48 50 46 C66 48 71 60 69 74 Z"/>
      <path class="pc-crown" d="M29 48 L29 26 L39 35 L50 24 L61 35 L71 26 L71 48 Z"/>
      <rect class="pc-crown" x="46.5" y="4" width="7" height="21" rx="2"/>
      <rect class="pc-crown" x="41" y="9.5" width="18" height="7" rx="2"/>
      ${face(50, 58, 0.95, '<path class="pc-stache" d="M42 64.5 Q46 61 50 63.5 Q54 61 58 64.5 Q54 66.5 50 65 Q46 66.5 42 64.5 Z"/>')}`,
  };

  const NAMES = { P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King' };

  // How each piece moves, said simply. Shown when a learning player picks up a piece.
  const TIPS = {
    P: 'Pawns march forward one square (two on their very first move) and capture one square diagonally.',
    N: 'Knights jump in an L: two squares one way, then one to the side. They can hop over pieces!',
    B: 'Bishops slide diagonally as far as they like, and always stay on the same color.',
    R: 'Rooks slide straight up, down, left or right as far as they like.',
    Q: 'The Queen is the strongest! She slides any direction: straight or diagonal.',
    K: 'The King steps one square any direction. Keep him safe: if he is trapped, the game is over!',
  };

  const POINTS = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

  function svg(piece) {
    const t = piece.toUpperCase();
    const color = piece === t ? 'w' : 'b';
    return `<svg class="pc pc--${color} pc--${t}" viewBox="0 0 100 100" aria-hidden="true">${SHAPES[t]()}</svg>`;
  }

  return { svg, NAMES, TIPS, POINTS };
})();
