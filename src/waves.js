import { shuffle } from './utils.js';

// ---------- upgrades ----------
export const UPGRADES = [
  { id: 'dmg',    name: 'Наученные пули',      desc: 'Урон +35%',                     apply: (p) => { p.weapons.mods.dmg *= 1.35; } },
  { id: 'rate',   name: 'Пулемётный механизм', desc: 'Скорость стрельбы +25%',       apply: (p) => { p.weapons.mods.rate *= 1.25; } },
  { id: 'pellets', name: 'Шквал',               desc: 'Выстрелов в salvo +1',         apply: (p) => { p.weapons.mods.pellets += 1; } },
  { id: 'spread', name: 'Лазерная наводка',     desc: 'Разброс -30%',                 apply: (p) => { p.weapons.mods.spread *= 0.7; } },
  { id: 'pierce', name: 'Пробитие',             desc: 'Пули проходят +1 врага',       apply: (p) => { p.weapons.mods.pierce += 1; } },
  { id: 'explosive', name: 'Взрывные заряды',   desc: 'Пули взрываются (рад. 4)',     apply: (p) => { p.weapons.mods.explosive = 4; p.weapons.mods.explosiveRadius = 4; } },
  { id: 'maxhp',  name: 'Армированная броня',   desc: 'Макс. здоровье +50 и лечение',  apply: (p) => { p.stats.maxHp += 50; p.stats.hp += 50; } },
  { id: 'reload', name: 'Быстрая перезарядка',  desc: 'Перезарядка -35%',             apply: (p) => { p.weapons.mods.reload *= 0.65; } },
  { id: 'lifesteal', name: 'Поглотитель',        desc: '+8% здоровья за каждого убитого', apply: (p) => { p.stats.lifesteal += 0.08; } },
  { id: 'speed',  name: 'Сервоприводы',         desc: 'Скорость движения +15%',        apply: (p) => { p.stats.speed *= 1.15; } },
  { id: 'crit',   name: 'Крит-сектор',          desc: 'Шанс крита +20% (×2 урон)',    apply: (p) => { p.weapons.mods.crit += 0.2; } },
  { id: 'dashdmg', name: 'Щит дальнего боя',     desc: 'Даш наносит +30 урона',        apply: (p) => { p.stats.dashDmg += 30; } },
];

export const WEAPON_CARDS = [
  { id: 'scatter', name: 'Дробовик',  desc: '6 pellets per shot — медленный, но ковёр',  weapon: true, wave: 1 },
  { id: 'rockets', name: 'Ракеты',    desc: 'Взрывное оружие с облаком урона',          weapon: true, wave: 3 },
  { id: 'minigun', name: 'Миниган',   desc: '120 патронов и трассирующий шквал',         weapon: true, wave: 6 },
];

export function rollShop(game) {
  const cards = [];
  const p = game.player.weapons;
  for (const w of WEAPON_CARDS) {
    if (!p.has(w.id) && game.wave >= w.wave) cards.push({ ...w });
  }
  const pool = shuffle([...UPGRADES]);
  while (cards.length < 3 && pool.length) cards.push(pool.pop());
  return cards.slice(0, 3);
}

// ---------- wave composition ----------
function composition(n) {
  if (n % 5 === 0) {
    const list = ['boss'];
    const m = 4 + Math.floor(n / 5) * 2;
    for (let i = 0; i < m; i++) list.push('drone');
    return list;
  }
  const count = 4 + Math.floor(n * 1.7);
  const list = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let type = 'grunt';
    if (n >= 6 && r < 0.16) type = 'brute';
    else if (n >= 4 && r < 0.38) type = 'brute';
    else if (n >= 3 && r < 0.55) type = 'turret';
    else if (n >= 2 && r < 0.8) type = 'drone';
    list.push(type);
  }
  return list;
}

export class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.queue = [];
    this.timer = 0;
    this.cleared = false;
    this.boss = false;
  }

  start(n) {
    this.wave = n;
    this.cleared = false;
    this.boss = n % 5 === 0;
    const comp = composition(n);
    this.queue = comp.map((type, i) => ({ type, delay: 0.5 + i * 0.45 }));
    if (this.boss) {
      this.game.hud.banner('БОСС', 'ВАРБОТ ПОВИНЕН СТОЯТЬ НА СТРАЖЕ', 3);
      this.game.audio.bossRoar();
      this.game.audio.setMusic('boss');
      this.game.fx.shake(0.6);
      this.game.slowmo(0.55, 0.9);
    } else {
      this.game.hud.banner('ВОЛНА ' + n, 'ИСТРЕБИ ВСЕХ', 2.5);
      this.game.audio.waveStart();
      this.game.audio.setMusic('game');
    }
  }

  update(dt) {
    if (this.queue.length) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const s = this.queue.shift();
        this.game.spawnEnemy(s.type, this.game.randomSpawnPos());
        this.timer = this.queue.length ? Math.max(0.25, s.delay) : 0;
      }
    }
    const alive = this.game.enemies.filter((e) => e.state !== 'dead').length;
    if (!this.cleared && this.queue.length === 0 && alive === 0) {
      this.cleared = true;
      this.onClear();
    }
  }

  onClear() {
    const g = this.game;
    g.audio.countdownTick(true);
    g.player.heal(20);
    g.hud.banner('ВОЛНА ОТБИТА', '+20 ЗДОРОВЬЯ', 2);
    setTimeout(() => { if (g.state === 'playing') g.openShop(); }, 1400);
  }
}
