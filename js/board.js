// Draws the board and pieces and turns taps and drags into square numbers for main.js.
// Pieces are separate elements that slide between squares, so every move animates.

const Board = (() => {
  let boardEl, piecesEl, ghostEl, wrapEl;
  let bottom = 'w'; // which color sits at the bottom of the screen
  let els = new Array(64).fill(null); // piece element on each square
  let squares = [];
  let handlers = { press: () => false, release: () => {} };
  let drag = null;
  let blinkSeed = 0;

  // Screen position (0..7 across, 0..7 down) of a board square.
  function pos(sq) {
    const r = sq >> 3, c = sq & 7;
    return bottom === 'w' ? { x: c, y: r } : { x: 7 - c, y: 7 - r };
  }

  function sqAtPoint(clientX, clientY) {
    const rect = boardEl.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return bottom === 'w' ? y * 8 + x : (7 - y) * 8 + (7 - x);
  }

  function init(opts) {
    boardEl = opts.board;
    piecesEl = opts.pieces;
    ghostEl = opts.ghost;
    wrapEl = opts.wrap;
    handlers = opts;
    squares = [];
    boardEl.innerHTML = '';
    for (let sq = 0; sq < 64; sq++) {
      const d = document.createElement('div');
      d.className = 'sq ' + (((sq >> 3) + (sq & 7)) % 2 ? 'sq--dark' : 'sq--light');
      d.dataset.sq = sq;
      boardEl.appendChild(d);
      squares.push(d);
    }
    placeSquares();

    wrapEl.addEventListener('pointerdown', onDown);
    wrapEl.addEventListener('pointermove', onMove);
    wrapEl.addEventListener('pointerup', onUp);
    wrapEl.addEventListener('pointercancel', cancelDrag);
    wrapEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function placeSquares() {
    for (let sq = 0; sq < 64; sq++) {
      const { x, y } = pos(sq);
      const d = squares[sq];
      d.style.setProperty('--x', x);
      d.style.setProperty('--y', y);
      // Letters along the bottom edge and numbers up the left edge, from this player's side.
      let label = '';
      if (y === 7) label += `<i class="coord coord--file">${'abcdefgh'[sq & 7]}</i>`;
      if (x === 0) label += `<i class="coord coord--rank">${8 - (sq >> 3)}</i>`;
      d.innerHTML = label + '<span class="mark"></span>';
    }
  }

  function makePiece(p, sq) {
    const el = document.createElement('div');
    el.className = 'piece piece--' + (p === p.toUpperCase() ? 'w' : 'b');
    el.dataset.p = p;
    el.innerHTML = Pieces.svg(p);
    el.style.setProperty('--blink', `${-((blinkSeed++ * 1.37) % 6).toFixed(2)}s`);
    place(el, sq);
    return el;
  }

  function place(el, sq) {
    const { x, y } = pos(sq);
    el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
  }

  // Draw a whole position from scratch (start, undo, loading a saved game).
  function render(board) {
    piecesEl.innerHTML = '';
    els = new Array(64).fill(null);
    piecesEl.classList.add('no-anim');
    for (let sq = 0; sq < 64; sq++) {
      if (!board[sq]) continue;
      els[sq] = makePiece(board[sq], sq);
      piecesEl.appendChild(els[sq]);
    }
    void piecesEl.offsetWidth;
    piecesEl.classList.remove('no-anim');
  }

  // Slide the pieces for one move (entry from Chess.Game.play).
  function animate(entry, turnBefore, instant = false) {
    const m = entry.move;
    const capSq = m.flag === 'ep' ? m.to + (turnBefore === 'w' ? 8 : -8) : m.to;
    const victim = m.captured ? els[capSq] : null;
    if (victim) {
      els[capSq] = null;
      victim.classList.add('is-captured');
      setTimeout(() => victim.remove(), 420);
    }
    const el = els[m.from];
    els[m.from] = null;
    if (el) {
      el.classList.add('is-moving');
      if (instant) { // dropped by a finger: it is already there, no slide
        el.style.transition = 'none';
        place(el, m.to);
        void el.offsetWidth;
        el.style.transition = '';
      } else place(el, m.to);
      setTimeout(() => el.classList.remove('is-moving'), 300);
      if (m.promo) {
        const p = turnBefore === 'w' ? m.promo : m.promo.toLowerCase();
        setTimeout(() => {
          el.dataset.p = p;
          el.innerHTML = Pieces.svg(p);
          el.classList.add('is-promoted');
          setTimeout(() => el.classList.remove('is-promoted'), 700);
        }, 260);
      }
    }
    els[m.to] = el;
    if (m.flag === 'castleK' || m.flag === 'castleQ') {
      const rFrom = m.flag === 'castleK' ? m.to + 1 : m.to - 2;
      const rTo = m.flag === 'castleK' ? m.to - 1 : m.to + 1;
      const rook = els[rFrom];
      els[rFrom] = null;
      els[rTo] = rook;
      if (rook) setTimeout(() => place(rook, rTo), 140);
    }
  }

  function setBottom(color) {
    if (color === bottom) return;
    bottom = color;
    placeSquares();
    for (let sq = 0; sq < 64; sq++) if (els[sq]) place(els[sq], sq);
  }

  // marks: { selected, dots:[], caps:[], last:[], check, hint:[], worried:Set, danger:Set }
  function setMarks(marks) {
    const has = (list, sq) => !!(list && list.includes(sq));
    for (let sq = 0; sq < 64; sq++) {
      const d = squares[sq];
      d.classList.toggle('is-selected', marks.selected === sq);
      d.classList.toggle('is-last', has(marks.last, sq));
      d.classList.toggle('is-dot', has(marks.dots, sq));
      d.classList.toggle('is-cap', has(marks.caps, sq));
      d.classList.toggle('is-check', marks.check === sq);
      d.classList.toggle('is-hint', has(marks.hint, sq));
      d.classList.toggle('is-danger', !!(marks.danger && marks.danger.has(sq)));
      const el = els[sq];
      if (el) {
        el.classList.toggle('is-worried', !!(marks.worried && marks.worried.has(sq)));
        el.classList.toggle('is-lifted', marks.selected === sq);
      }
    }
  }

  function shake(sq) {
    const el = els[sq];
    if (!el) return;
    el.classList.remove('is-shaking');
    void el.offsetWidth;
    el.classList.add('is-shaking');
    setTimeout(() => el.classList.remove('is-shaking'), 450);
  }

  function bounce(sq) {
    const el = els[sq];
    if (!el) return;
    el.classList.remove('is-bouncing');
    void el.offsetWidth;
    el.classList.add('is-bouncing');
    setTimeout(() => el.classList.remove('is-bouncing'), 900);
  }

  // ---------- touch / mouse ----------

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const sq = sqAtPoint(e.clientX, e.clientY);
    if (sq < 0) return;
    e.preventDefault();
    const canDrag = handlers.press(sq);
    drag = { from: sq, x: e.clientX, y: e.clientY, active: false, canDrag, id: e.pointerId };
    try { wrapEl.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id || !drag.canDrag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.active && Math.hypot(dx, dy) < 8) return;
    const el = els[drag.from];
    if (!el) return;
    if (!drag.active) {
      drag.active = true;
      ghostEl.innerHTML = el.innerHTML;
      ghostEl.className = 'drag-ghost ' + [...el.classList].filter((c) => c.startsWith('piece--')).join(' ');
      ghostEl.hidden = false;
      el.classList.add('is-dragging');
    }
    const rect = wrapEl.getBoundingClientRect();
    const size = rect.width / 8;
    ghostEl.style.width = ghostEl.style.height = size * 1.25 + 'px';
    ghostEl.style.transform = `translate(${e.clientX - rect.left - size * 0.625}px, ${e.clientY - rect.top - size * 1.0}px)`;
    const over = sqAtPoint(e.clientX, e.clientY);
    squares.forEach((d, i) => d.classList.toggle('is-over', i === over));
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    const sq = sqAtPoint(e.clientX, e.clientY);
    endDragVisual();
    drag = null;
    handlers.release(sq, d.active, d.from);
  }

  function endDragVisual() {
    ghostEl.hidden = true;
    squares.forEach((d) => d.classList.remove('is-over'));
    els.forEach((el) => el && el.classList.remove('is-dragging'));
  }

  function cancelDrag() {
    endDragVisual();
    drag = null;
  }

  return { init, render, animate, setBottom, setMarks, shake, bounce, cancelDrag, getBottom: () => bottom };
})();
