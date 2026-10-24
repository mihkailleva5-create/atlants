// Card combat — DOM overlay battle system (Slay the Spire style).
// Runs over the 3D island; sim-world backdrop is CSS.

import { RARITY, TYPE, createCombat, makeState, endTurn, newTurn, cardById, rollCardDrop, makeEnemy } from './cards.js';
import { addPrismarin, addEyes, ownCard, checkAchievements, cardLevel, deckCards } from './economy.js';

const ENEMY_AVATAR = {
  slime: '🟢', guard: '🤖', drone: '🛸', turret: '🔫', anomaly: '👁️', nameless: '👤',
};

export class Combat {
  constructor(game) {
    this.game = game;
    this.state = null;
    this.world = null; // sim world = array of enemies
    this.fightIdx = 0;
    this.depth = 1;
    this.onEnd = null;
    this.el = document.getElementById('combat');
    this.handEl = document.getElementById('combat-hand');
    this.enemyEl = document.getElementById('combat-enemy');
    this.playerEl = document.getElementById('combat-player');
    this.rewardEl = document.getElementById('combat-reward');
    this.logEl = document.getElementById('combat-log');
  }

  start(depth, onEnd) {
    this.depth = depth;
    this.world = makeWorld(depth);
    this.fightIdx = 0;
    this.onEnd = onEnd;
    this.game.audio.setMusic('combat');
    this.beginFight();
  }

  beginFight() {
    const enemy = this.world[this.fightIdx];
    const deck = deckCards(this.game.state);
    this.state = makeState(createCombat(deck, enemy));
    this.render();
    this.el.classList.remove('hidden');
  }

  render() {
    const s = this.state;
    const e = s.enemy;
    // enemy
    this.enemyEl.innerHTML = `
      <div class="ce-avatar">${ENEMY_AVATAR[e.id] || '👾'}</div>
      <div class="ce-name">${e.name}${e.boss ? ' <span class="boss-tag">БОСС</span>' : ''}</div>
      <div class="ce-hp"><div class="bar"><div class="fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div><span>${Math.max(0, Math.ceil(e.hp))} / ${e.maxHp}</span></div>
      ${e.block > 0 ? `<div class="ce-block">🛡 ${e.block}</div>` : ''}
      <div class="ce-intent">${intentHtml(e.intent)}</div>`;
    // player
    this.playerEl.innerHTML = `
      <div class="cp-hp"><div class="bar"><div class="fill hp" style="width:${(s.playerHP / s.playerMaxHP) * 100}%"></div></div><span>${Math.max(0, Math.ceil(s.playerHP))} / ${s.playerMaxHP}</span></div>
      ${s.playerBlock > 0 ? `<div class="cp-block">🛡 ${s.playerBlock}</div>` : ''}
      <div class="cp-energy">${energyOrbs(s)}</div>
      <div class="cp-deck">колода ${s.deck.length} · сброс ${s.discard.length} · ход ${s.turn}</div>`;
    // hand
    this.handEl.innerHTML = '';
    s.hand.forEach((id, i) => {
      const c = cardById(id);
      if (!c) return;
      const lvl = cardLevel(this.game.state, id);
      const div = document.createElement('div');
      div.className = `card rarity-${c.rarity} ${s.energy < c.cost ? 'disabled' : ''}`;
      div.innerHTML = `
        <div class="card-cost">${c.cost}</div>
        <div class="card-type">${TYPE[c.type].icon} ${TYPE[c.type].name}</div>
        <div class="card-name">${c.name}${lvl > 1 ? ` <span class="lvl">Lv${lvl}</span>` : ''}</div>
        <div class="card-desc">${c.desc}</div>`;
      div.addEventListener('click', () => this.playCard(i));
      this.handEl.appendChild(div);
    });
    // log
    if (this.logEl) this.logEl.textContent = this.logEl.textContent;
  }

  playCard(i) {
    const s = this.state;
    const id = s.hand[i];
    const c = cardById(id);
    if (!c) return;
    if (s.energy < c.cost) { this.flash('Недостаточно энергии'); return; }
    s.energy -= c.cost;
    s.hand.splice(i, 1);
    // apply effect
    try { c.effect(s); } catch (err) { console.error(err); }
    s.discard.push(id);
    this.render();
    // check enemy dead
    if (s.enemy.hp <= 0) {
      this.onEnemyDead();
    }
  }

  endTurnBtn() {
    const s = this.state;
    if (s.over) return;
    endTurn(s);
    newTurn(s);
    this.render();
    if (s.over) {
      this.onPlayerDead();
    } else if (s.playerHP <= 0 && s._reviveReady) {
      s._reviveReady = false;
      this.flash('Возрождение Феникса!');
    }
  }

  onEnemyDead() {
    const s = this.state;
    s.over = true;
    s.victory = true;
    this.game.state.stats.kills++;
    this.flash(`${s.enemy.name} уничтожен!`);
    // rewards
    const prism = 10 + this.fightIdx * 5 + (s.enemy.boss ? 40 : 0);
    addPrismarin(this.game.state, prism);
    // card drop chance
    const dropChance = s.enemy.boss ? 1 : 0.5;
    let dropped = null;
    if (Math.random() < dropChance) {
      dropped = rollCardDrop(this.game.state.cards.sealed);
      ownCard(this.game.state, dropped);
    }
    // eye chance small
    let eye = 0;
    if (Math.random() < 0.05) { eye = 1; addEyes(this.game.state, eye); }
    this.showReward(prism, dropped, eye, s.enemy.boss);
  }

  onPlayerDead() {
    const s = this.state;
    s.over = true;
    s.victory = false;
    this.flash('Система вас одолела…');
    this.showReward(0, null, 0, false, true);
  }

  showReward(prism, dropped, eye, boss, lost) {
    this.rewardEl.innerHTML = `
      <div class="rw-title">${lost ? 'ПОРАЖЕНИЕ' : boss ? 'БОСС ПОБЕДЕН' : 'ВРАГ АННИГИЛИРОВАН'}</div>
      ${lost ? '<div class="rw-line">Мир-симуляция поглотила вас. Вернитесь к острову.</div>' : ''}
      ${prism > 0 ? `<div class="rw-line">Призмарин: <b>+${prism}</b></div>` : ''}
      ${dropped ? `<div class="rw-line">Новая карта: <b style="color:${RARITY[cardById(dropped).rarity].color}">${cardById(dropped).name}</b> (${RARITY[cardById(dropped).rarity].name})</div>` : ''}
      ${eye > 0 ? `<div class="rw-line">Глаз стража: <b>+${eye}</b></div>` : ''}
      <div class="rw-actions">
        ${!lost && this.fightIdx < this.world.length - 1
          ? `<button id="rw-next" class="btn btn-primary">Следующий сектор</button>`
          : (!lost ? `<button id="rw-done" class="btn btn-primary">Завершить прогону</button>` : `<button id="rw-back" class="btn btn-primary">Вернуться на остров</button>`)}
      </div>`;
    this.rewardEl.classList.remove('hidden');
    const next = document.getElementById('rw-next');
    if (next) next.addEventListener('click', () => this.nextFight());
    const done = document.getElementById('rw-done');
    if (done) done.addEventListener('click', () => this.finishRun(true));
    const back = document.getElementById('rw-back');
    if (back) back.addEventListener('click', () => this.finishRun(false));
  }

  nextFight() {
    this.fightIdx++;
    this.rewardEl.classList.add('hidden');
    this.beginFight();
  }

  finishRun(won) {
    if (won) {
      this.game.state.stats.wins++;
      this.game.state.stats.bestDepth = Math.max(this.game.state.stats.bestDepth, this.depth);
      // completion bonus
      addPrismarin(this.game.state, 30 + this.depth * 10);
    }
    this.game.state.stats.runs++;
    checkAchievements(this.game.state);
    this.el.classList.add('hidden');
    this.rewardEl.classList.add('hidden');
    this.onEnd && this.onEnd(won);
  }

  flee() {
    this.finishRun(false);
  }

  flash(msg) {
    const f = document.getElementById('combat-flash');
    if (!f) return;
    f.textContent = msg;
    f.classList.remove('hidden');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => f.classList.add('hidden'), 1600);
  }
}

function intentHtml(intent) {
  if (!intent || intent.type === 'none') return '<span class="intent none">—</span>';
  if (intent.type === 'attack') return `<span class="intent atk">⚔ ${intent.value}</span>`;
  if (intent.type === 'block') return `<span class="intent blk">🛡 ${intent.value}</span>`;
  return '<span class="intent">?</span>';
}

function energyOrbs(s) {
  let html = '';
  for (let i = 0; i < s.maxEnergy; i++) {
    html += `<span class="energy ${i < s.energy ? 'on' : ''}">⚡</span>`;
  }
  return html;
}

function makeWorld(depth) {
  const pool = ['slime', 'guard', 'drone', 'turret'];
  const fights = [];
  const count = 3 + Math.floor((depth - 1) / 2);
  for (let i = 0; i < count; i++) {
    fights.push(makeEnemy(pool[Math.floor(Math.random() * pool.length)]));
  }
  fights.push(makeEnemy(depth >= 5 ? 'nameless' : 'anomaly'));
  return fights;
}
