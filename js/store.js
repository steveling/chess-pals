// Players, settings, wins and the game in progress, kept in this browser only (localStorage).

const SAVE_KEY = 'cp:save';

const AVATARS = ['🐻', '🦊', '🐼', '🐯', '🐸', '🦄', '🐵', '🐨', '🦁', '🐙', '🐧', '🦖'];

// The computer buddies (levels in js/ai.js).
const BUDDIES = {
  sloth: { name: 'Sleepy Sloth', emoji: '🦥', stars: 1, blurb: 'Just learning too. Takes it easy.' },
  beaver: { name: 'Busy Beaver', emoji: '🦫', stars: 2, blurb: 'Thinks a little. Sometimes slips up.' },
  owl: { name: 'Clever Owl', emoji: '🦉', stars: 3, blurb: 'Thinks ahead. A real challenge!' },
};

const THEMES = {
  meadow: { name: 'Meadow', light: '#eef3d2', dark: '#7fb069' },
  ocean: { name: 'Ocean', light: '#e4f1fb', dark: '#5f9fd6' },
  candy: { name: 'Candy', light: '#ffeef4', dark: '#ee8fb4' },
  wood: { name: 'Wood', light: '#f4dfba', dark: '#b8865a' },
};

function defaultSave() {
  return {
    v: 1,
    settings: { sound: true, theme: 'meadow' },
    players: {
      a: { name: 'GROWN-UP', avatar: '🐻', help: false },
      b: { name: 'KIDDO', avatar: '🦊', help: true },
    },
    friend: { aIsWhite: true, seating: 'side' },
    cpu: { who: 'b', level: 'sloth', color: 'w' },
    wins: { a: 0, b: 0 },
    beaten: { a: [], b: [] }, // computer buddies each player has beaten
    game: null,
  };
}

function mergeSave(base, stored) {
  if (!stored || typeof stored !== 'object') return base;
  for (const k of Object.keys(base)) {
    const b = base[k];
    const s = stored[k];
    if (s === undefined) continue;
    if (b && typeof b === 'object' && !Array.isArray(b)) base[k] = mergeSave(b, s);
    else base[k] = s;
  }
  return base;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return mergeSave(defaultSave(), JSON.parse(raw));
  } catch (e) {}
  return defaultSave();
}

let save = loadSave();

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
