// Runs the computer player off the main thread so the board stays smooth while it thinks.
importScripts('chess.js', 'ai.js');

self.onmessage = (e) => {
  const { id, fen, level, recent } = e.data;
  const m = ChessAI.pick(fen, level, recent);
  self.postMessage({ id, move: m && { from: m.from, to: m.to, promo: m.promo } });
};
