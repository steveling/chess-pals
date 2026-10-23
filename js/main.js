// Screens and game flow: setup, whose turn, helpers for learning players, the computer, endings.

(() => {
  const $ = (id) => document.getElementById(id);
  const { colorOf, typeOf, other } = Chess;

  let game = null;      // Chess.Game
  let G = null;         // save.game: who is playing and the moves so far
  let selected = -1;
  let hint = null;      // [from, to]
  let busy = false;     // a piece is flying, the computer is thinking, or a pick is open
  let thinking = false;
  let pendingPromo = null;
  let deselectOnRelease = false;
  let cpuReq = 0;
  let worker = null;
  let toastTimer = 0;
  let taught = new Set(); // special moves already explained this game

  // ---------- small helpers ----------

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
    $('toast').classList.remove('is-on');
  }
  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }

  function toast(text, ms = 2400) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), ms);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  function applyTheme() {
    const th = THEMES[save.settings.theme] || THEMES.meadow;
    const app = document.documentElement;
    app.style.setProperty('--light', th.light);
    app.style.setProperty('--dark', th.dark);
    document.querySelectorAll('[data-themes]').forEach((box) => {
      box.innerHTML = Object.entries(THEMES).map(([k, t]) => `
        <button type="button" class="theme ${k === save.settings.theme ? 'is-on' : ''}" data-theme="${k}" aria-label="${t.name} board">
          <i style="background:${t.light}"></i><i style="background:${t.dark}"></i><i style="background:${t.dark}"></i><i style="background:${t.light}"></i>
          <span>${t.name}</span>
        </button>`).join('');
    });
  }

  function applySound() {
    Sound.set(save.settings.sound);
    document.querySelectorAll('[data-sound]').forEach((b) => {
      const label = save.settings.sound ? 'Sound on' : 'Sound off';
      b.setAttribute('aria-label', label);
      b.textContent = b.classList.contains('corner-btn') ? (save.settings.sound ? '🔊' : '🔇') : `${save.settings.sound ? '🔊' : '🔇'} ${label}`;
    });
  }

  // ---------- title ----------

  function renderTitle() {
    $('btnContinue').hidden = !(save.game && !save.game.over && save.game.moves.length);
    $('titleArt').innerHTML = ['N', 'q', 'K', 'p'].map((p, i) =>
      `<div class="title-piece" style="--i:${i}">${Pieces.svg(p)}</div>`).join('');
    const sb = ['a', 'b'].map((k) => {
      const p = save.players[k];
      const badges = save.beaten[k].map((l) => BUDDIES[l].emoji).join('');
      return `<div class="score"><span class="score__av">${p.avatar}</span><span class="score__name">${esc(p.name)}</span>
        <span class="score__wins">🏆 ${save.wins[k]}</span>${badges ? `<span class="score__badges" title="Computer buddies beaten">${badges}</span>` : ''}</div>`;
    }).join('');
    $('scoreboard').innerHTML = sb;
  }

  // ---------- setup: a pal on the same phone ----------

  function nextAvatar(current, taken) {
    let i = AVATARS.indexOf(current);
    do { i = (i + 1) % AVATARS.length; } while (AVATARS[i] === taken);
    return AVATARS[i];
  }

  function helpToggle(key) {
    const on = save.players[key].help;
    return `<button type="button" class="help-toggle ${on ? 'is-on' : ''}" data-help="${key}" aria-pressed="${on}">
      <b>${on ? '🐣' : '💪'}</b><span>${on ? 'Helper on' : 'No helper'}</span>
      <small>${on ? 'shows moves, warns about danger, hints' : 'just the board'}</small></button>`;
  }

  function renderFriend() {
    ['a', 'b'].forEach((k) => {
      const p = save.players[k];
      const white = (k === 'a') === save.friend.aIsWhite;
      const card = document.querySelector(`#scr-friend [data-player="${k}"]`);
      card.innerHTML = `
        <button type="button" class="avatar-btn" data-avatar="${k}" aria-label="Change animal">${p.avatar}</button>
        <div class="player-card__mid">
          <input class="name-input" data-name="${k}" value="${esc(p.name)}" maxlength="10" autocomplete="off" spellcheck="false" aria-label="Name" />
          <span class="color-chip color-chip--${white ? 'w' : 'b'}"><i>${Pieces.svg(white ? 'K' : 'k')}</i>${white ? 'White · goes first' : 'Black'}</span>
        </div>
        ${helpToggle(k)}`;
    });
    document.querySelectorAll('#segSeating button').forEach((b) => b.setAttribute('aria-checked', b.dataset.v === save.friend.seating));
    applyTheme();
  }

  // ---------- setup: the computer ----------

  function renderCpu() {
    const who = save.cpu.who;
    $('cpuWho').innerHTML = ['a', 'b'].map((k) => `
      <button type="button" class="who-btn ${k === who ? 'is-on' : ''}" data-who="${k}">
        <b>${save.players[k].avatar}</b>${esc(save.players[k].name)}</button>`).join('');
    $('cpuHelp').innerHTML = helpToggle(who);
    $('buddies').innerHTML = Object.entries(BUDDIES).map(([k, b]) => {
      const beat = save.beaten[who].includes(k);
      return `<button type="button" class="buddy ${k === save.cpu.level ? 'is-on' : ''}" data-level="${k}">
        <b class="buddy__emoji">${b.emoji}</b>
        <span class="buddy__name">${b.name}</span>
        <span class="buddy__stars">${'★'.repeat(b.stars)}<i>${'★'.repeat(3 - b.stars)}</i></span>
        <span class="buddy__blurb">${b.blurb}</span>
        ${beat ? '<span class="buddy__beat">🏅 Beaten!</span>' : ''}
      </button>`;
    }).join('');
    document.querySelectorAll('#segColor button').forEach((b) => b.setAttribute('aria-checked', b.dataset.v === save.cpu.color));
    applyTheme();
  }

  // ---------- starting and loading games ----------

  function snap(key) {
    const p = save.players[key];
    return { key, name: p.name, avatar: p.avatar, help: p.help };
  }

  function startFriend() {
    const a = snap('a'), b = snap('b');
    G = { mode: 'friend', white: save.friend.aIsWhite ? a : b, black: save.friend.aIsWhite ? b : a,
      seating: save.friend.seating, moves: [], over: false };
    begin();
  }

  function startCpu(colorChoice = save.cpu.color) {
    const human = snap(save.cpu.who);
    const buddy = BUDDIES[save.cpu.level];
    const cpu = { key: 'cpu', name: buddy.name, avatar: buddy.emoji, help: false };
    const hc = colorChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    G = { mode: 'cpu', level: save.cpu.level, human: hc, white: hc === 'w' ? human : cpu,
      black: hc === 'w' ? cpu : human, seating: 'side', moves: [], over: false };
    begin();
  }

  function begin() {
    save.game = G;
    persist();
    game = new Chess.Game();
    taught = new Set();
    enterGame();
    const first = G.white;
    toast(`${first.avatar} ${first.name} has White, so goes first!`);
  }

  function resume() {
    G = save.game;
    game = new Chess.Game();
    const kept = [];
    for (const u of G.moves) { if (!game.playUci(u)) break; kept.push(u); }
    G.moves = kept;
    if (G.result && !game.result) game.end(G.result);
    taught = new Set();
    enterGame();
  }

  function enterGame() {
    show('scr-game');
    selected = -1; hint = null; busy = false; thinking = false; pendingPromo = null;
    cpuReq++;
    $('scr-game').classList.toggle('is-across', G.mode === 'friend' && G.seating === 'across');
    Board.setBottom(bottomColor());
    Board.render(game.board);
    refresh();
    maybeCpu();
  }

  // ---------- who is who ----------

  const side = (color) => (color === 'w' ? G.white : G.black);
  const isCpu = (color) => G.mode === 'cpu' && color !== G.human;
  const humanTurn = () => !isCpu(game.turn);
  const helpOn = (color) => !isCpu(color) && side(color).help;

  function bottomColor() {
    if (G.mode === 'cpu') return G.human;
    if (G.seating === 'flip') return game.result ? Board.getBottom() : game.turn;
    return 'w';
  }

  // ---------- drawing the game ----------

  function captured(byColor) {
    return game.history.map((h) => h.move.captured).filter((p) => p && colorOf(p) !== byColor)
      .sort((x, y) => Pieces.POINTS[typeOf(y)] - Pieces.POINTS[typeOf(x)]);
  }

  function points(byColor) { return captured(byColor).reduce((n, p) => n + Pieces.POINTS[typeOf(p)], 0); }

  function renderBar(el, color) {
    const s = side(color);
    const turn = !game.result && game.turn === color;
    const caps = captured(color);
    const diff = points(color) - points(other(color));
    let status = '';
    if (game.result) {
      if (game.result.winner === color) status = '🏆 Winner!';
      else if (!game.result.winner) status = '🤝 Tie';
    } else if (turn) {
      if (isCpu(color)) status = thinking ? 'Thinking<span class="dots"><i>.</i><i>.</i><i>.</i></span>' : '';
      else status = game.inCheck() ? '⚠️ Check! Save your King!' : (G.mode === 'cpu' ? 'Your turn!' : `${esc(s.name)}'s turn!`);
    }
    el.className = `bar bar--${el.id === 'barTop' ? 'top' : 'bottom'} ${turn ? 'is-turn' : ''} bar--${color}`;
    el.innerHTML = `
      <span class="bar__av">${s.avatar}</span>
      <span class="bar__who">
        <span class="bar__name">${esc(s.name)} <i class="bar__king">${Pieces.svg(color === 'w' ? 'K' : 'k')}</i></span>
        <span class="bar__status">${status}</span>
      </span>
      <span class="bar__caps">${caps.map((p) => `<i>${Pieces.svg(p)}</i>`).join('')}${diff > 0 ? `<b>+${diff}</b>` : ''}</span>`;
  }

  function renderBars() {
    const bottom = Board.getBottom();
    renderBar($('barBottom'), bottom);
    renderBar($('barTop'), other(bottom));
  }

  // How many pieces of color `by` attack square sq directly.
  function countHits(board, sq, by) {
    const blocker = by === 'w' ? 'x' : 'X'; // stands in for the others: still blocks, never attacks
    let n = 0;
    for (let s = 0; s < 64; s++) {
      if (s === sq || colorOf(board[s]) !== by) continue;
      const test = board.map((p, t) => (t !== s && colorOf(p) === by ? blocker : p));
      if (Chess.isAttacked(test, sq, by)) n++;
    }
    return n;
  }

  // Pieces of `color` that could be lost: taken for free, by something cheaper,
  // or by more attackers than defenders.
  function dangerSquares(color) {
    const s = game.state;
    const enemy = other(color);
    const caps = Chess.pseudoMoves({ ...s, turn: enemy, ep: -1 }).filter((m) => m.captured);
    const out = new Set();
    for (let sq = 0; sq < 64; sq++) {
      const p = s.board[sq];
      if (!p || colorOf(p) !== color || typeOf(p) === 'K') continue;
      const hits = caps.filter((m) => m.to === sq);
      if (!hits.length) continue;
      const cheapest = Math.min(...hits.map((m) => Pieces.POINTS[typeOf(m.piece)] || 0));
      const defenders = countHits(s.board, sq, color);
      const attackers = countHits(s.board, sq, enemy);
      if (!defenders || cheapest < Pieces.POINTS[typeOf(p)] || attackers > defenders) out.add(sq);
    }
    return out;
  }

  function refresh() {
    const marks = { selected, hint: hint || [] };
    const last = game.lastMove();
    if (last) marks.last = [last.from, last.to];
    const worried = new Set();
    if (game.inCheck()) {
      marks.check = Chess.kingSquare(game.board, game.turn);
      worried.add(marks.check);
    }
    if (game.result && game.result.reason === 'checkmate') {
      const k = Chess.kingSquare(game.board, other(game.result.winner));
      worried.add(k);
      marks.check = k;
    }
    if (!game.result && humanTurn() && helpOn(game.turn)) {
      const d = dangerSquares(game.turn);
      d.forEach((sq) => worried.add(sq));
      marks.danger = d;
    }
    marks.worried = worried;
    if (selected >= 0) {
      const targets = game.moves(selected);
      if (helpOn(game.turn)) {
        marks.dots = targets.filter((m) => !m.captured).map((m) => m.to);
        marks.caps = targets.filter((m) => m.captured).map((m) => (m.flag === 'ep' ? m.to : m.to));
      }
    }
    Board.setMarks(marks);
    renderBars();
    renderActions();
    renderTip();
  }

  function renderActions() {
    const over = !!game.result;
    const undo = $('btnUndo'), hintBtn = $('btnHint');
    if (over) {
      undo.innerHTML = '<b>🔁</b>Again';
      undo.disabled = false;
      hintBtn.innerHTML = '<b>🏠</b>Home';
      hintBtn.hidden = false;
      hintBtn.disabled = false;
      return;
    }
    undo.innerHTML = '<b>↩️</b>Oops!';
    hintBtn.innerHTML = '<b>💡</b>Hint';
    const humanMoves = G.mode === 'cpu' ? game.history.some((h, i) => (i % 2 === 0 ? 'w' : 'b') === G.human) : game.history.length > 0;
    undo.disabled = !humanMoves || busy;
    hintBtn.hidden = !(humanTurn() && helpOn(game.turn));
    hintBtn.disabled = busy;
  }

  function renderTip() {
    const tip = $('tip');
    if (selected < 0 || !helpOn(game.turn) || game.result) { tip.classList.remove('is-on'); return; }
    const t = typeOf(game.board[selected]);
    tip.innerHTML = `<i>${Pieces.svg(game.board[selected])}</i><span><b>${Pieces.NAMES[t]}</b> ${Pieces.TIPS[t]}</span>`;
    const atTop = G.mode === 'friend' && G.seating === 'across' && game.turn !== Board.getBottom();
    tip.classList.toggle('tip--top', atTop);
    tip.classList.add('is-on');
  }

  // ---------- tapping and dragging ----------

  function targetsFrom(sq) { return sq >= 0 ? game.moves(sq) : []; }

  function onPress(sq) {
    deselectOnRelease = false;
    if (game.result) return false;
    if (busy) {
      if (thinking) toast(`Shh… ${side(game.turn).avatar} is thinking!`, 1400);
      return false;
    }
    if (!humanTurn()) return false;
    const p = game.board[sq];
    if (selected >= 0 && targetsFrom(selected).some((m) => m.to === sq)) {
      tryMove(selected, sq, false);
      return false;
    }
    if (p && colorOf(p) === game.turn) {
      if (selected === sq) deselectOnRelease = true;
      else select(sq);
      return true;
    }
    if (selected >= 0) {
      explainNo(selected, sq);
      return false;
    }
    if (p) {
      const mine = game.turn === 'w' ? 'White' : 'Black';
      toast(`It's ${esc(side(game.turn).name)}'s turn: tap a ${mine} piece!`, 1800);
    }
    return false;
  }

  function onRelease(sq, dragged, from) {
    if (dragged) {
      if (sq >= 0 && sq !== from) {
        if (targetsFrom(from).some((m) => m.to === sq)) tryMove(from, sq, true);
        else explainNo(from, sq);
      }
      return;
    }
    if (deselectOnRelease && sq === from) {
      selected = -1;
      refresh();
    }
  }

  function select(sq) {
    selected = sq;
    hint = hint && hint[0] === sq ? hint : null;
    Sound.play('pick');
    const moves = game.moves(sq);
    if (!moves.length && helpOn(game.turn)) {
      const name = Pieces.NAMES[typeOf(game.board[sq])];
      toast(game.inCheck() ? `This ${name} can't help the King right now.` : `This ${name} is stuck! Try another piece.`, 2000);
    }
    refresh();
  }

  function explainNo(from, to) {
    const p = game.board[from];
    const name = Pieces.NAMES[typeOf(p)];
    const shape = Chess.pseudoMoves(game.state, from).some((m) => m.to === to);
    Sound.play('nope');
    Board.shake(from);
    if (shape) {
      toast(game.inCheck()
        ? 'Your King is in check! First you have to keep him safe.'
        : 'Careful! That would leave your King in danger, so it isn\'t allowed.', 2800);
    } else if (typeOf(p) === 'K' && Math.abs(to - from) === 2) {
      toast('Castling isn\'t allowed right now (the King has moved, is in check, or the path is blocked or watched).', 3200);
    } else {
      toast(`The ${name} can't move there.`, 1600);
    }
  }

  function tryMove(from, to, instant) {
    const options = game.moves(from).filter((m) => m.to === to);
    if (!options.length) return;
    if (options.length > 1) { // promotion: pick a piece
      pendingPromo = { from, to, instant };
      openPromo(game.turn);
      return;
    }
    commit(options[0], instant);
  }

  function openPromo(color) {
    busy = true;
    $('promoGrid').innerHTML = 'QRBN'.split('').map((t) => {
      const p = color === 'w' ? t : t.toLowerCase();
      return `<button type="button" class="promo-btn" data-promo="${t}"><i>${Pieces.svg(p)}</i>${Pieces.NAMES[t]}</button>`;
    }).join('');
    $('promoSheet').classList.toggle('is-flipped', G.mode === 'friend' && G.seating === 'across' && color !== Board.getBottom());
    openModal('mdPromo');
  }

  // ---------- making moves ----------

  function commit(m, instant = false) {
    const turnBefore = game.turn;
    const mover = side(turnBefore);
    const entry = game.play({ from: m.from, to: m.to, promo: m.promo });
    if (!entry) return;
    G.moves.push(Chess.uci(entry.move));
    selected = -1;
    hint = null;
    busy = true;
    Board.animate(entry, turnBefore, instant);

    const check = game.inCheck();
    const fx = entry.move;
    if (fx.promo) Sound.play('promo');
    else if (fx.flag === 'castleK' || fx.flag === 'castleQ') Sound.play('castle');
    else if (fx.captured) Sound.play('capture');
    else Sound.play('move');
    if (check && !game.result) setTimeout(() => Sound.play('check'), 180);

    // Teach the special rules the first time they happen.
    const teach = helpOn('w') || helpOn('b');
    let msg = '';
    if (fx.flag === 'castleK' || fx.flag === 'castleQ') {
      msg = teach && !taught.has('castle') ? '🏰 Castling! The King steps two squares and the Rook hops over to guard him.' : '🏰 Castled!';
      taught.add('castle');
    } else if (fx.flag === 'ep') {
      msg = teach && !taught.has('ep') ? '🥷 En passant! A pawn that rushes two squares can be caught by a pawn beside it, but only right away.' : '🥷 En passant!';
      taught.add('ep');
    } else if (fx.promo) {
      msg = `🎉 The pawn became a ${Pieces.NAMES[fx.promo]}!`;
    }
    if (check && !game.result) {
      const victim = side(game.turn);
      msg = (msg ? msg + ' ' : '') + `⚠️ Check! ${victim.avatar} ${victim.name}, protect your King!`;
    }
    if (msg) toast(msg, msg.length > 60 ? 3800 : 2400);
    else if (fx.captured && mover && helpOn(turnBefore) && !isCpu(turnBefore)) {
      toast(`Got a ${Pieces.NAMES[typeOf(fx.captured)]}! +${Pieces.POINTS[typeOf(fx.captured)]}`, 1400);
    }

    persist();
    setTimeout(() => {
      if (game.result) { busy = false; finish(); return; }
      const flip = G.mode === 'friend' && G.seating === 'flip';
      if (flip) {
        setTimeout(() => {
          Board.setBottom(game.turn);
          busy = false;
          refresh();
        }, 450);
        refresh();
        return;
      }
      busy = false;
      refresh();
      maybeCpu();
    }, 300);
    refresh();
  }

  // ---------- the computer ----------

  function getWorker() {
    if (worker === false) return null;
    if (worker) return worker;
    try {
      worker = new Worker('js/ai-worker.js');
      worker.onerror = () => { worker = false; };
    } catch (e) { worker = false; }
    return worker || null;
  }

  function askAI(level, onMove) {
    const id = ++cpuReq;
    const fen = Chess.toFen(game.state);
    const recent = game.keys.map((k) => k.split(' ').slice(0, 3).join(' '));
    const done = (move) => { if (id === cpuReq) onMove(move); };
    const w = getWorker();
    if (w) {
      const handler = (e) => {
        if (e.data.id !== id) return;
        w.removeEventListener('message', handler);
        done(e.data.move);
      };
      w.addEventListener('message', handler);
      w.postMessage({ id, fen, level, recent });
      // If the worker never answers (some browsers block it on file://), think here instead.
      setTimeout(() => {
        if (id === cpuReq && worker === false) done(ChessAI.pick(fen, level, recent));
      }, 300);
    } else {
      setTimeout(() => done(ChessAI.pick(fen, level, recent)), 30);
    }
  }

  function maybeCpu() {
    if (game.result || !isCpu(game.turn)) return;
    busy = true;
    thinking = true;
    refresh();
    const started = Date.now();
    askAI(G.level, (move) => {
      const wait = Math.max(0, 750 - (Date.now() - started));
      setTimeout(() => {
        thinking = false;
        if (!move || game.result) { busy = false; refresh(); return; }
        commit(move);
      }, wait);
    });
  }

  function askHint() {
    if (busy || !humanTurn() || game.result) return;
    busy = true;
    $('btnHint').disabled = true;
    toast('💡 Thinking of a good move…', 3000);
    askAI('owl', (m) => {
      busy = false;
      if (!m) { refresh(); return; }
      hint = [m.from, m.to];
      selected = m.from;
      Sound.play('hint');
      const name = Pieces.NAMES[typeOf(game.board[m.from])];
      toast(`💡 Try moving this ${name} to the glowing square!`, 2600);
      Board.bounce(m.from);
      refresh();
    });
  }

  // ---------- undo ----------

  function undo() {
    if (!game.history.length || game.result) return;
    cpuReq++;
    thinking = false;
    busy = false;
    if (G.mode === 'cpu') {
      do { game.undo(); G.moves.pop(); } while (game.history.length && game.turn !== G.human);
      if (game.turn !== G.human) { /* computer had White and we went all the way back */ }
    } else {
      game.undo();
      G.moves.pop();
    }
    selected = -1;
    hint = null;
    persist();
    Board.setBottom(bottomColor());
    Board.render(game.board);
    toast('↩️ Move taken back.', 1200);
    refresh();
    maybeCpu();
  }

  // ---------- endings ----------

  const REASONS = {
    stalemate: (g) => `Stalemate! ${side(g.state.turn).name}'s King isn't in check, but has no safe move, so the game is a tie.`,
    material: () => 'Nobody has enough pieces left to checkmate, so it\'s a tie.',
    fifty: () => '50 moves each with no captures and no pawn moves, so it\'s a tie.',
    repetition: () => 'The same position came up three times, so it\'s a tie.',
    agreed: () => 'You agreed to call it a tie. Good game!',
  };

  function finish() {
    const r = game.result;
    G.over = true;
    G.result = r;
    const winner = r.winner ? side(r.winner) : null;
    const loser = r.winner ? side(other(r.winner)) : null;
    if (winner && save.wins[winner.key] !== undefined) {
      save.wins[winner.key]++;
      if (G.mode === 'cpu' && !save.beaten[winner.key].includes(G.level)) {
        save.beaten[winner.key].push(G.level);
        G.newBadge = true;
      }
    }
    persist();
    refresh();

    let hero, title, text;
    const cpuWon = winner && winner.key === 'cpu';
    if (!winner) {
      hero = `${G.white.avatar}🤝${G.black.avatar}`;
      title = 'It\'s a tie!';
      text = REASONS[r.reason](game);
      Sound.play('draw');
    } else {
      hero = cpuWon ? winner.avatar : `${winner.avatar}🏆`;
      if (r.reason === 'checkmate') {
        title = 'Checkmate!';
        text = cpuWon
          ? `${winner.name} wins this time. Even chess champions lost lots of games while learning. Rematch?`
          : `${winner.name} wins! The ${r.winner === 'w' ? 'Black' : 'White'} King is trapped with nowhere to go.`;
      } else {
        title = `${winner.name} wins!`;
        text = `${loser.name} gave up this game. Good try, ${loser.name}!`;
      }
      if (G.mode === 'cpu' && !cpuWon) {
        title = `You beat ${loser.name}! 🎉`;
        if (G.newBadge) text += ` New badge: ${BUDDIES[G.level].emoji}!`;
      }
      if (cpuWon) Sound.play('sad');
      else { Sound.play('win'); confetti(); }
    }
    $('endHero').textContent = hero;
    $('endTitle').textContent = title;
    $('endText').textContent = text;
    $('btnAgain').textContent = G.mode === 'friend' ? 'PLAY AGAIN ⇅' : 'PLAY AGAIN';
    setTimeout(() => openModal('mdEnd'), r.reason === 'checkmate' ? 1100 : 500);
  }

  function playAgain() {
    closeModal('mdEnd');
    if (G.mode === 'friend') {
      // Swap colors so both players get to go first.
      save.friend.aIsWhite = !(G.white.key === 'a');
      const a = snap('a'), b = snap('b');
      G = { mode: 'friend', white: save.friend.aIsWhite ? a : b, black: save.friend.aIsWhite ? b : a,
        seating: G.seating, moves: [], over: false };
      begin();
    } else {
      startCpu(save.cpu.color);
    }
  }

  function confetti() {
    const box = $('confetti');
    const colors = ['#ffc93c', '#ff6fae', '#43c59e', '#5f9fd6', '#b388ff', '#fff'];
    box.innerHTML = Array.from({ length: 70 }, (_, i) => {
      const c = colors[i % colors.length];
      return `<i style="--x:${Math.random() * 100}vw;--d:${(Math.random() * 0.8).toFixed(2)}s;--r:${Math.floor(Math.random() * 720)}deg;--t:${(2.2 + Math.random() * 1.6).toFixed(2)}s;background:${c}"></i>`;
    }).join('');
    setTimeout(() => { box.innerHTML = ''; }, 4500);
  }

  // ---------- menu: tie, give up, moves list ----------

  function confirm(title, text, yes) {
    $('cfTitle').textContent = title;
    $('cfText').textContent = text;
    $('cfYes').onclick = () => { closeModal('mdConfirm'); yes(); };
    openModal('mdConfirm');
  }

  function renderMoves() {
    const rows = [];
    for (let i = 0; i < game.history.length; i += 2) {
      rows.push(`<li><b>${i / 2 + 1}.</b> <span>${game.history[i].san}</span> <span>${game.history[i + 1] ? game.history[i + 1].san : ''}</span></li>`);
    }
    $('movesList').innerHTML = rows.length ? `<ol>${rows.join('')}</ol>` : '<p>No moves yet.</p>';
  }

  function offerDraw() {
    closeModal('mdMenu');
    if (game.result) return;
    if (G.mode === 'cpu') {
      const cpuColor = other(G.human);
      const s = { ...game.state, turn: cpuColor };
      const cpuScore = ChessAI.evaluate(s);
      if (cpuScore > 80) { toast(`${side(cpuColor).avatar} ${side(cpuColor).name} wants to keep playing! 😄`); return; }
      game.end({ winner: null, reason: 'agreed' });
      finish();
      return;
    }
    confirm('Call it a tie?', 'Do both players agree to end the game as a tie?', () => {
      game.end({ winner: null, reason: 'agreed' });
      finish();
    });
  }

  function resign() {
    closeModal('mdMenu');
    if (game.result) return;
    const quitter = G.mode === 'cpu' ? G.human : game.turn;
    const q = side(quitter), w = side(other(quitter));
    confirm('Give up?', `${q.name} gives up and ${w.name} wins this game.`, () => {
      cpuReq++;
      thinking = false;
      busy = false;
      game.end({ winner: other(quitter), reason: 'resign' });
      finish();
    });
  }

  function goHome() {
    cpuReq++;
    thinking = false;
    busy = false;
    persist();
    renderTitle();
    show('scr-title');
  }

  // ---------- how to play ----------

  function renderHelp() {
    const pieces = 'KQRBNP'.split('').map((t) => `
      <div class="help-piece">
        <i>${Pieces.svg(t)}</i>
        <div><b>${Pieces.NAMES[t]}</b>${t !== 'K' ? ` <small>worth ${Pieces.POINTS[t]}</small>` : ''}<p>${Pieces.TIPS[t]}</p></div>
      </div>`).join('');
    $('helpBody').innerHTML = `${pieces}
      <h3>Special moves</h3>
      <p><b>🏰 Castling.</b> Once per game the King can move two squares toward a Rook, and the Rook hops over next to him. Only if neither has moved yet, nothing is in between, and the King is not in check or crossing a watched square.</p>
      <p><b>🎉 Promotion.</b> A pawn that reaches the far side turns into a Queen, Rook, Bishop or Knight.</p>
      <p><b>🥷 En passant.</b> If a pawn rushes two squares and lands right beside your pawn, your pawn can capture it as if it had moved one square, but only on the very next move.</p>
      <h3>Winning</h3>
      <p><b>⚠️ Check</b> means the King is being attacked. You must get him safe right away: move him, block, or capture the attacker.</p>
      <p><b>🏆 Checkmate</b> means the King is in check and there is no way out. That wins the game!</p>
      <p><b>🤝 Ties.</b> Stalemate (no legal move but not in check), not enough pieces to checkmate, the same position three times, or 50 moves each with no capture or pawn move.</p>
      <h3>Helpers</h3>
      <p>With the 🐣 helper on, dots show where a piece can go, worried faces warn when a piece can be captured, and 💡 Hint suggests a move.</p>`;
  }

  // ---------- wiring ----------

  function wire() {
    Board.init({
      board: $('board'), pieces: $('pieces'), ghost: $('dragGhost'), wrap: $('boardWrap'),
      press: onPress, release: onRelease,
    });

    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

    $('btnContinue').onclick = resume;
    $('btnFriend').onclick = () => { renderFriend(); show('scr-friend'); };
    $('btnCpu').onclick = () => { renderCpu(); show('scr-cpu'); };
    $('btnHowTo').onclick = () => { renderHelp(); openModal('mdHelp'); };
    document.querySelectorAll('[data-home]').forEach((b) => (b.onclick = goHome));

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-theme]');
      if (t) { save.settings.theme = t.dataset.theme; persist(); applyTheme(); }
      const snd = e.target.closest('[data-sound]');
      if (snd) { save.settings.sound = !save.settings.sound; persist(); applySound(); Sound.play('pick'); }
      const av = e.target.closest('[data-avatar]');
      if (av) {
        const k = av.dataset.avatar, o = k === 'a' ? 'b' : 'a';
        save.players[k].avatar = nextAvatar(save.players[k].avatar, save.players[o].avatar);
        persist(); Sound.play('pick'); renderFriend();
      }
      const hp = e.target.closest('[data-help]');
      if (hp) {
        const k = hp.dataset.help;
        save.players[k].help = !save.players[k].help;
        persist(); Sound.play('pick');
        if (!$('scr-friend').hidden) renderFriend(); else renderCpu();
      }
      const who = e.target.closest('[data-who]');
      if (who) { save.cpu.who = who.dataset.who; persist(); renderCpu(); }
      const lvl = e.target.closest('[data-level]');
      if (lvl) { save.cpu.level = lvl.dataset.level; persist(); Sound.play('pick'); renderCpu(); }
    });

    document.addEventListener('input', (e) => {
      const n = e.target.closest('[data-name]');
      if (!n) return;
      const v = n.value.toUpperCase().replace(/[^A-Z0-9 \-']/g, '').slice(0, 10);
      if (n.value !== v) n.value = v;
      save.players[n.dataset.name].name = v.trim() || (n.dataset.name === 'a' ? 'PLAYER 1' : 'PLAYER 2');
      persist();
    });

    $('btnSwap').onclick = () => { save.friend.aIsWhite = !save.friend.aIsWhite; persist(); Sound.play('pick'); renderFriend(); };
    $('btnCoin').onclick = () => {
      save.friend.aIsWhite = Math.random() < 0.5;
      persist(); renderFriend();
      const w = save.players[save.friend.aIsWhite ? 'a' : 'b'];
      Sound.play('promo');
      toast(`🎲 ${w.avatar} ${w.name} gets White and goes first!`);
    };
    $('segSeating').onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      save.friend.seating = b.dataset.v; persist(); renderFriend();
    };
    $('segColor').onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      save.cpu.color = b.dataset.v; persist(); renderCpu();
    };
    $('btnStartFriend').onclick = startFriend;
    $('btnStartCpu').onclick = () => startCpu();

    $('btnUndo').onclick = () => (game.result ? playAgain() : undo());
    $('btnHint').onclick = () => (game.result ? goHome() : askHint());
    $('btnMenu').onclick = () => {
      $('movesList').hidden = true;
      const over = !!game.result;
      $('mnDraw').hidden = over;
      $('mnResign').hidden = over;
      applyTheme();
      openModal('mdMenu');
    };
    $('mnClose').onclick = () => closeModal('mdMenu');
    $('mnHowTo').onclick = () => { renderHelp(); openModal('mdHelp'); };
    $('mnMoves').onclick = () => { renderMoves(); $('movesList').hidden = !$('movesList').hidden; };
    $('mnDraw').onclick = offerDraw;
    $('mnResign').onclick = resign;
    $('mnHome').onclick = () => { closeModal('mdMenu'); goHome(); };
    $('helpClose').onclick = () => closeModal('mdHelp');
    $('cfNo').onclick = () => closeModal('mdConfirm');

    $('promoGrid').onclick = (e) => {
      const b = e.target.closest('[data-promo]');
      if (!b || !pendingPromo) return;
      const { from, to, instant } = pendingPromo;
      pendingPromo = null;
      closeModal('mdPromo');
      busy = false;
      commit({ from, to, promo: b.dataset.promo }, instant);
    };

    $('btnAgain').onclick = playAgain;
    $('btnSeeBoard').onclick = () => closeModal('mdEnd');
    $('btnEndHome').onclick = () => { closeModal('mdEnd'); goHome(); };

    // Tap outside a sheet closes it (except the promotion pick, which needs an answer).
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => {
      if (e.target === m && m.id !== 'mdPromo') m.hidden = true;
    }));
  }

  wire();
  applyTheme();
  applySound();
  renderTitle();
  show('scr-title');

  // For testing in a browser console.
  window.ChessPals = { get game() { return game; }, get G() { return G; } };
})();
