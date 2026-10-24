// Card database + deck/combat logic. Slay-the-Spire style turn-based card combat.
// 6 rarity tiers, ~26 cards covering attack / skill / heal / special.

export const RARITY = {
  common: { name: 'Обычная', color: '#9aa7b8', weight: 50 },
  uncommon: { name: 'Необычная', color: '#4fd06a', weight: 30 },
  rare: { name: 'Редкая', color: '#4aa3ff', weight: 15 },
  epic: { name: 'Эпическая', color: '#b061ff', weight: 4 },
  legendary: { name: 'Легендарная', color: '#ffae3b', weight: 1 },
  mythic: { name: 'Мифическая', color: '#ff5b6e', weight: 0.2 },
};

export const TYPE = {
  attack: { name: 'Атака', icon: '⚔' },
  skill: { name: 'Умение', icon: '🛡' },
  heal: { name: 'Исцеление', icon: '✚' },
  special: { name: 'Специальное', icon: '✦' },
};

// Each card: effect(state) mutates combat state.
export const CARD_DB = {
  // ---- common ----
  strike: { name: 'Удар', type: 'attack', cost: 1, rarity: 'common', desc: '6 урона.', effect: (s) => s.attack(6) },
  punch: { name: 'Пунш', type: 'attack', cost: 0, rarity: 'common', desc: '4 урона.', effect: (s) => s.attack(4) },
  defend: { name: 'Защита', type: 'skill', cost: 1, rarity: 'common', desc: '5 блока.', effect: (s) => s.block(5) },
  small_repair: { name: 'Малый ремонт', type: 'heal', cost: 1, rarity: 'common', desc: 'Восстановить 6 HP.', effect: (s) => s.heal(6) },

  // ---- uncommon ----
  heavy_strike: { name: 'Мощный удар', type: 'attack', cost: 2, rarity: 'uncommon', desc: '12 урона.', effect: (s) => s.attack(12) },
  shield_wall: { name: 'Стена щитов', type: 'skill', cost: 2, rarity: 'uncommon', desc: '12 блока.', effect: (s) => s.block(12) },
  needles: { name: 'Иглы', type: 'attack', cost: 1, rarity: 'uncommon', desc: '3×3 урона (3 раза по 3).', effect: (s) => { s.attack(3); s.attack(3); s.attack(3); } },
  regen: { name: 'Регенерация', type: 'skill', cost: 1, rarity: 'uncommon', desc: '+5 HP в начале ходов (3 хода).', effect: (s) => s.regen(5, 3) },
  medkit: { name: 'Аптечка', type: 'heal', cost: 1, rarity: 'uncommon', desc: 'Восстановить 14 HP.', effect: (s) => s.heal(14) },

  // ---- rare ----
  rocket: { name: 'Ракета', type: 'attack', cost: 2, rarity: 'rare', desc: '20 урона.', effect: (s) => s.attack(20) },
  barrage: { name: 'Шквал', type: 'attack', cost: 2, rarity: 'rare', desc: '8 урона дважды.', effect: (s) => { s.attack(8); s.attack(8); } },
  reflection: { name: 'Отражение', type: 'skill', cost: 2, rarity: 'rare', desc: '15 блока. При получении урона нанести 5 обратно.', effect: (s) => s.reflect(15, 5) },
  first_aid: { name: 'Походная медбаза', type: 'heal', cost: 2, rarity: 'rare', desc: 'Восстановить 28 HP.', effect: (s) => s.heal(28) },
  rally: { name: 'Ралли', type: 'skill', cost: 2, rarity: 'rare', desc: '+3 энергии в этом ходу.', effect: (s) => s.energy(3) },

  // ---- epic ----
  death_blow: { name: 'Смертельный удар', type: 'attack', cost: 3, rarity: 'epic', desc: '25 урона. +15 дополнительно, если враг ниже 50%.', effect: (s) => { s.attack(25); if (s.enemy.hp < s.enemy.maxHp * 0.5) s.attack(15); } },
  chain: { name: 'Цепь', type: 'attack', cost: 2, rarity: 'epic', desc: '10 урона всем врагам (в этом симуляторе — основном).', effect: (s) => s.attack(10) },
  guardian: { name: 'Хранитель', type: 'skill', cost: 2, rarity: 'epic', desc: '20 блока и увеличено защитное добавление.', effect: (s) => s.guard(20) },
  vampire_blade: { name: 'Клинок Бессмертного', type: 'attack', cost: 2, rarity: 'epic', desc: '18 урона. Вернуть 5 HP.', effect: (s) => { s.attack(18); s.heal(5); } },

  // ---- legendary ----
  phoenix: { name: 'Сердце Феникса', type: 'heal', cost: 3, rarity: 'legendary', desc: 'Восстановить 45 HP. Возрождение после смерти (1 раз).', effect: (s) => { s.heal(45); s.revive(); } },
  wrath: { name: 'Гнев Безымянного', type: 'attack', cost: 4, rarity: 'legendary', desc: '40 урона.', effect: (s) => s.attack(40) },
  infinite_armor: { name: 'Безграничная броня', type: 'skill', cost: 3, rarity: 'legendary', desc: '40 блока.', effect: (s) => s.block(40) },

  // ---- mythic ----
  purge: { name: 'Чистка системы', type: 'special', cost: 5, rarity: 'mythic', desc: '60 урона. Мгновенно убивает не-босса ниже 30%.', effect: (s) => { s.attack(60); if (s.enemy.hp < s.enemy.maxHp * 0.3 && !s.enemy.boss) s.killEnemy(); } },
  code_breaker: { name: 'Взлом кода', type: 'special', cost: 4, rarity: 'mythic', desc: '25 урона. При убийстве +10 энергии на следующий ход.', effect: (s) => { s.attack(25); s.energyNext(10); } },
};

// Starter deck (3 basic cards per lore: attack, skill, heal)
export const STARTER_DECK = ['strike', 'strike', 'defend', 'small_repair'];

// ---- combat state + effects ----
export function createCombat(deckIds, enemy) {
  const state = {
    playerHP: 60,
    playerMaxHP: 60,
    playerBlock: 0,
    energy: 3,
    maxEnergy: 3,
    hand: [],
    deck: shuffle(deckIds.slice()),
    discard: [],
    enemy: { ...enemy },
    turn: 1,
    over: false,
    victory: false,
    reviveUsed: true,
    regenStacks: 0,
    regenAmount: 0,
    reflect: 0,
    energyBonusNext: 0,
    guardBoost: 0,
  };
  drawHand(state, 4);
  return state;
}

export function drawHand(state, n) {
  while (state.hand.length < n && state.deck.length) {
    state.hand.push(state.deck.pop());
  }
}

export function endTurn(state) {
  // enemy intent resolution
  const e = state.enemy;
  if (e.intent && e.intent.type !== 'none') {
    if (e.intent.type === 'attack') {
      let dmg = e.intent.value;
      // player block absorbs
      if (state.playerBlock > 0) {
        const absorbed = Math.min(state.playerBlock, dmg);
        state.playerBlock -= absorbed;
        dmg -= absorbed;
      }
      if (dmg > 0) {
        state.playerHP -= dmg;
        // reflect
        if (state.reflect > 0) {
          let back = Math.min(state.reflect, e.hp);
          e.hp -= back;
          state.reflect -= back;
        }
      }
    } else if (e.intent.type === 'block') {
      e.block = (e.block || 0) + e.intent.value;
    }
  }
  e.block = 0; // enemy block resets each turn

  // regen at start of next player turn handled in newTurn
  state.discard.push(...state.hand);
  state.hand = [];
  state.energy = state.maxEnergy + (state.energyBonusNext || 0);
  state.energyBonusNext = 0;
  state.turn++;
  state.playerBlock = 0;
  if (state.playerHP <= 0) {
    if (state.reviveUsed) {
      state.over = true;
      state.victory = false;
    } else {
      state.playerHP = Math.max(1, Math.round(state.playerMaxHP * 0.5));
      state.reviveUsed = true;
    }
  }
  drawHand(state, 4);
  return state;
}

export function newTurn(state) {
  if (state.regenStacks > 0) {
    state.playerHP = Math.min(state.playerMaxHP, state.playerHP + state.regenAmount);
    state.regenStacks--;
  }
  // re-roll enemy intent for the upcoming turn
  const e = state.enemy;
  if (e._intentFn) e.intent = e._intentFn();
  return state;
}

// attach effect methods
const proto = {
  attack(dmg) {
    const e = this.enemy;
    let d = dmg;
    if (e.block > 0) {
      const absorbed = Math.min(e.block, d);
      e.block -= absorbed;
      d -= absorbed;
    }
    e.hp -= d;
  },
  block(n) {
    this.playerBlock += n + this.guardBoost;
  },
  heal(n) {
    this.playerHP = Math.min(this.playerMaxHP, this.playerHP + n);
  },
  energy(n) {
    this.energy += n;
  },
  energyNext(n) {
    this.energyBonusNext = (this.energyBonusNext || 0) + n;
  },
  regen(n, turns) {
    this.regenAmount = n;
    this.regenStacks = turns;
  },
  reflect(block, back) {
    this.playerBlock += block;
    this.reflect = back;
  },
  guard(block) {
    this.playerBlock += block;
    this.guardBoost += 2;
  },
  revive() {
    this.reviveUsed = false;
    this._reviveReady = true;
  },
  killEnemy() {
    this.enemy.hp = 0;
  },
};
// bind proto methods onto state objects via wrapper
export function makeState(state) {
  for (const k of Object.keys(proto)) state[k] = proto[k].bind(state);
  return state;
}

export function cardById(id) { return CARD_DB[id]; }
export function cardName(id) { return CARD_DB[id]?.name || id; }
export function rarityOf(id) { return CARD_DB[id]?.rarity || 'common'; }

// weighted random card drop; exclude sealed cards (Tramplin Lv10)
export function rollCardDrop(exclude = []) {
  const excluded = new Set(exclude);
  const entries = Object.entries(CARD_DB).filter(([id]) => !excluded.has(id));
  if (!entries.length) return Object.keys(CARD_DB)[0];
  let total = 0;
  for (const [, c] of entries) total += RARITY[c.rarity].weight;
  let r = Math.random() * total;
  for (const [id, c] of entries) {
    r -= RARITY[c.rarity].weight;
    if (r <= 0) return id;
  }
  return entries[0][0];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Enemy archetypes for sim worlds
export const ENEMIES = {
  slime: { name: 'Слизень кода', hp: 30, maxHp: 30, intent: () => ({ type: 'attack', value: 8 }), boss: false },
  guard: { name: 'Сторожевая аномалия', hp: 55, maxHp: 55, intent: () => ({ type: 'attack', value: 14 }), boss: false },
  drone: { name: 'Дрон-охранник', hp: 40, maxHp: 40, intent: () => ({ type: 'attack', value: 10 }), boss: false },
  turret: { name: 'Турельный модуль', hp: 70, maxHp: 70, intent: () => ({ type: 'block', value: 8 }), boss: false },
  anomaly: { name: 'Аномалия системы', hp: 120, maxHp: 120, intent: () => ({ type: 'attack', value: 20 }), boss: true },
  nameless: { name: 'Призрак Безымянного', hp: 160, maxHp: 160, intent: () => ({ type: 'attack', value: 26 }), boss: true },
};

export function makeEnemy(id) {
  const base = ENEMIES[id];
  return { id, name: base.name, hp: base.hp, maxHp: base.hp, block: 0, intent: base.intent(), _intentFn: base.intent, boss: base.boss };
}

// a sim world = sequence of encounters
export function makeSimWorld(depth) {
  const pool = ['slime', 'guard', 'drone', 'turret'];
  const fights = [];
  const count = 3 + Math.floor(depth / 2);
  for (let i = 0; i < count; i++) {
    fights.push(makeEnemy(pool[Math.floor(Math.random() * pool.length)]));
  }
  // boss at the end
  fights.push(makeEnemy(depth >= 5 ? 'nameless' : 'anomaly'));
  return fights;
}
