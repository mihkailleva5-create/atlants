// Economy + progression state. Persists to localStorage.
// Prismarin = main currency, Eyes of Guard = rare cosmetic/roulette currency.

const SAVE_KEY = 'atlantis_save_v1';

export const STARTING_PRISMARIN = 50;

export function defaultState() {
  return {
    prismarin: STARTING_PRISMARIN,
    eyes: 0,
    hero: {
      name: 'Безымянный',
      gender: 'neutral',
      hairColor: '#3a4a6a',
    },
    island: {
      // tier unlocked levels
      levels: { theo: 1, carrion: 1, yarilyk: 1, erri: 1, born: 1 },
      reactor: false, // unlocks electric lamps
      drained: 0,      // flooded area drained (visual progress)
    },
    cards: {
      // owned card ids with level (Tramplin upgrades up to 10)
      owned: {},
      deck: ['strike', 'strike', 'defend', 'small_repair'], // 8-card deck (padded)
      sealed: [], // cards at level 10 that no longer drop
    },
    achievements: [],
    stats: {
      runs: 0,
      wins: 0,
      kills: 0,
      bestDepth: 0,
    },
    buildings: {
      // idle income per building (Prismarin/hour)
      income: { erri: 2, born: 3, phantom: 4, ryazha: 5, kompik: 6, scaler: 7, fraegid: 8, misha: 9 },
      levels: { erri: 1, born: 1, phantom: 1, ryazha: 1, kompik: 1, scaler: 1, fraegid: 1, misha: 1 },
    },
    lastSave: Date.now(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    // merge defaults to handle new fields
    return { ...defaultState(), ...s, hero: { ...defaultState().hero, ...s.hero }, island: { ...defaultState().island, ...s.island }, cards: { ...defaultState().cards, ...s.cards }, stats: { ...defaultState().stats, ...s.stats }, buildings: { ...defaultState().buildings, ...s.buildings } };
  } catch (e) {
    return defaultState();
  }
}

export function saveState(s) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch (e) { /* ignore */ }
}

// ---- currency helpers ----
export function addPrismarin(s, n) { s.prismarin = Math.max(0, s.prismarin + n); return s.prismarin; }
export function spendPrismarin(s, n) {
  if (s.prismarin < n) return false;
  s.prismarin -= n;
  return true;
}
export function addEyes(s, n) { s.eyes = Math.max(0, s.eyes + n); return s.eyes; }
export function spendEyes(s, n) {
  if (s.eyes < n) return false;
  s.eyes -= n;
  return true;
}

// ---- card ownership ----
export function ownCard(s, id) {
  if (!s.cards.owned[id]) s.cards.owned[id] = { count: 1, level: 1 };
  else s.cards.owned[id].count++;
  return s.cards.owned[id];
}
export function cardLevel(s, id) {
  return s.cards.owned[id]?.level || 0;
}
export function upgradeCard(s, id) {
  const c = s.cards.owned[id];
  if (!c) return false;
  if (c.count < 2) return false; // need duplicate to combine
  if (c.level >= 10) return false;
  c.count--;
  c.level++;
  if (c.level >= 10 && !s.cards.sealed.includes(id)) s.cards.sealed.push(id);
  return true;
}

// ---- deck ----
export function deckCards(s) {
  // pad/trim to 8
  let deck = s.cards.deck.slice();
  while (deck.length < 8) deck.push('strike');
  return deck.slice(0, 8);
}
export function addToDeck(s, id) {
  if (!s.cards.owned[id]) return false;
  if (s.cards.deck.includes(id) && s.cards.deck.filter((x) => x === id).length >= 4) return false;
  if (s.cards.deck.length >= 8) return false;
  s.cards.deck.push(id);
  return true;
}
export function removeFromDeck(s, idx) {
  if (idx < 0 || idx >= s.cards.deck.length) return false;
  s.cards.deck.splice(idx, 1);
  return true;
}

// ---- achievements ----
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Первая кровь', desc: 'Убить первого врага в симуляции.', check: (s) => s.stats.kills >= 1, reward: 5 },
  { id: 'win_one', name: 'Победа над системой', desc: 'Одолеть один мир-симуляцию.', check: (s) => s.stats.wins >= 1, reward: 10 },
  { id: 'depth_5', name: 'Глубина 5', desc: 'Достигнуть 5-го уровня симуляции.', check: (s) => s.stats.bestDepth >= 5, reward: 20 },
  { id: 'collect_10', name: 'Собиратель кода', desc: 'Собрать 10 разных карт.', check: (s) => Object.keys(s.cards.owned).length >= 10, reward: 15 },
  { id: 'reactor_on', name: 'Свет в рынке', desc: 'Включить Реактор.', check: (s) => s.island.reactor, reward: 25 },
  { id: 'level_5', name: 'Прокачанный цикл', desc: 'Довести 5 карт до 5-го уровня.', check: (s) => Object.values(s.cards.owned).filter((c) => c.level >= 5).length >= 5, reward: 30 },
];

export function checkAchievements(s) {
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements.includes(a.id) && a.check(s)) {
      s.achievements.push(a.id);
      addEyes(s, a.reward);
      newly.push(a);
    }
  }
  return newly;
}

// ---- idle income ----
export function tickIdle(s, dt) {
  // dt in seconds; income per hour
  const perSec = Object.entries(s.buildings.income).reduce((sum, [id, base]) => {
    const lvl = s.buildings.levels[id] || 1;
    return sum + base * lvl * (s.island.reactor ? 1.25 : 1);
  }, 0) / 3600;
  const gain = perSec * dt;
  if (gain > 0) {
    addPrismarin(s, gain);
  }
}

// ---- upgrades ----
export const UPGRADES = {
  reactor: { name: 'Реактор', desc: 'Включить электросеть: факелы → лампы. Баффы поселения.', cost: 200, check: (s) => !s.island.reactor, apply: (s) => { s.island.reactor = true; } },
  drain_1: { name: 'Осушение: пляж', desc: 'Слить воду с пляжа, +1 уровень свободы.', cost: 80, check: (s) => s.island.drained < 1, apply: (s) => { s.island.drained++; } },
  drain_2: { name: 'Осушение: гавань', desc: 'Слить воду с гавани.', cost: 250, check: (s) => s.island.drained < 2, apply: (s) => { s.island.drained++; } },
};

export function buyUpgrade(s, id) {
  const u = UPGRADES[id];
  if (!u || !u.check(s)) return false;
  if (!spendPrismarin(s, u.cost)) return false;
  u.apply(s);
  return true;
}
