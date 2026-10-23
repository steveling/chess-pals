// Little synthesized sounds (no audio files). Quiet, short, and switchable.

const Sound = (() => {
  let ctx = null;
  let on = true;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.18, slide = 0 } = {}) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime + start;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const sounds = {
    pick: () => tone(660, 0, 0.07, { type: 'triangle', vol: 0.1 }),
    move: () => { tone(220, 0, 0.09, { type: 'triangle', vol: 0.22, slide: 0.7 }); tone(440, 0, 0.05, { vol: 0.06 }); },
    capture: () => { tone(520, 0, 0.12, { type: 'square', vol: 0.07, slide: 1.8 }); tone(180, 0.03, 0.12, { type: 'triangle', vol: 0.2, slide: 0.6 }); },
    castle: () => { sounds.move(); setTimeout(sounds.move, 120); },
    check: () => { tone(880, 0, 0.12, { vol: 0.14 }); tone(880, 0.16, 0.16, { vol: 0.14 }); },
    nope: () => tone(160, 0, 0.14, { type: 'sawtooth', vol: 0.05, slide: 0.8 }),
    promo: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, { type: 'triangle', vol: 0.12 })),
    win: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, { type: 'triangle', vol: 0.14 })),
    draw: () => [523, 494, 523].forEach((f, i) => tone(f, i * 0.14, 0.2, { type: 'triangle', vol: 0.12 })),
    sad: () => [392, 370, 349].forEach((f, i) => tone(f, i * 0.18, 0.26, { type: 'triangle', vol: 0.1 })),
    hint: () => [784, 988].forEach((f, i) => tone(f, i * 0.08, 0.12, { vol: 0.1 })),
  };

  return {
    play(name) { if (on && sounds[name]) try { sounds[name](); } catch (e) {} },
    set(v) { on = v; },
    unlock() { if (on) ac(); },
  };
})();
