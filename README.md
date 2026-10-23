# Chess Pals

Real chess with friendly pieces, for a grown-up and a kid on one phone. A Pocket Giggles game.

Plain static site, no build step: open `index.html` from any web server.

## How it plays

- **Play a Pal:** two players on one phone. Each picks an animal and a name, and each player has
  their own helper switch, so a 7-year-old can play with help while the grown-up plays without.
  "Pick for us" flips for who gets White; after each game, Play Again swaps colors.
  Seating options: side by side, across the table (the far player's bar and the Black pieces face
  them), or pass the phone (the board turns to whoever's move it is).
- **Play the Computer:** three buddies. Sleepy Sloth (mostly random, never looks ahead), Busy
  Beaver (looks two moves ahead, slips up on purpose now and then) and Clever Owl (looks three
  moves ahead and finishes trades). Beating a buddy earns its badge on the title screen. The
  computer thinks in a Web Worker (`js/ai-worker.js`) so the screen never freezes.
- **Moving:** tap a piece then a square, or drag it.

## Real rules

Every official rule is in `js/chess.js`: castling with all its conditions, en passant, promotion
(pick any of the four pieces), check, checkmate, stalemate, the fifty-move rule, threefold
repetition and not-enough-pieces-to-checkmate. Repetition and fifty-move draws are called
automatically rather than claimed. You can't make an illegal move; the game says why instead
("that would leave your King in danger").

`node scripts/test-rules.js` checks the move generator against the standard perft counts
(start position to depth 4, Kiwipete, and three other tricky positions) plus mate, stalemate,
draws, castling, en passant and promotion. `node scripts/test-ai.js` plays the buddies against
each other.

## The helper (🐣)

Turned on per player. While it's that player's turn:

- dots show where the picked-up piece can go, and red rings show captures;
- a card explains how the picked-up piece moves;
- pieces that could be lost (free to take, attacked by something cheaper, or more attackers than
  defenders) get a worried face and a red glow;
- 💡 Hint asks the Owl for a good move and makes that piece bounce.

Special moves (castling, en passant) are explained in a sentence the first time they happen.
↩️ Oops takes back the last move (against the computer, your move and its reply).

## Saving

Players, settings, wins, badges and the game in progress live only in the phone's browser
(`localStorage`, key `cp:save`). Close the page mid-game and Keep Playing picks it up.
No ads, accounts or tracking.

## Layout

- `index.html`: all screens and the ordered list of scripts.
- `css/style.css` the look · `css/pieces.css` piece colors and faces.
- `js/chess.js` rules · `js/ai.js` computer buddies (+ `js/ai-worker.js`) · `js/pieces.js` piece
  drawings and tips · `js/sound.js` synthesized sounds · `js/store.js` saving, avatars, buddies,
  board themes · `js/board.js` board drawing, animation, taps and drags · `js/main.js` screens and flow.
- `sw.js`: lets the game open offline after the first visit (network first, so updates show up
  right away).

The scripts are plain files sharing one global scope, loaded in the order listed in `index.html`.

## Develop

```sh
python3 -m http.server 4173   # then open http://localhost:4173/
node scripts/test-rules.js
```

## Deploying

Hosted on Cloudflare (Workers static assets) like Capy Island and Zoom Garage. Create a Worker
named `chess-pals` connected to this repo with Workers Builds (deploy command:
`npx wrangler deploy`, config in `wrangler.jsonc`), then add `chess.pocketgiggles.com` as a
custom domain. `.assetsignore` lists files that are never served.
