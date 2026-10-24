// ATLANTIS — main orchestrator.
// 3D island (base) + DOM card combat (sim worlds) + economy/UI.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioEngine } from './audio.js';
import { FX } from './effects.js';
import { buildIsland, updateDayNight } from './island.js';
import { CHARACTERS } from './characters.js';
import { Combat } from './combat.js';
import {
  loadState, saveState, tickIdle, checkAchievements, buyUpgrade, UPGRADES,
  addPrismarin, spendPrismarin, spendEyes, ownCard, deckCards, ACHIEVEMENTS,
  loadStateFromServer, saveStateToServer,
} from './economy.js';
import { CARD_DB, RARITY, rollCardDrop } from './cards.js';
import { TG, initAuth, setOnChange, loadConfig } from './telegram.js';

class Game {
  constructor() {
    this.state = loadState();
    this.mode = 'island';
    this.simDepth = 1;

    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1a2448, 40, 130);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(28, 22, 28);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 70;
    this.controls.target.set(0, 2, 0);

    this.audio = new AudioEngine();
    this.fx = new FX(this.scene, this.camera);

    // island
    this.island = buildIsland(this.scene, this.state, this.renderer);
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hovered = null;

    // combat
    this.combat = new Combat(this);

    this.clock = new THREE.Clock();
    this.lastTopbarCheck = Date.now();
    this.lastServerSave = Date.now();
    this._audioInited = false;

    this.bindInput();
    this.bindUI();
    window.addEventListener('resize', () => this.onResize());

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---- Telegram auth + cloud save ----
  async initTG() {
    try {
      await loadConfig();
      await initAuth();
    } catch (e) { console.warn('TG init failed', e); }
    setOnChange(() => { this.onTGChange(); });
    this.renderLoginUI();
  }

  async onTGChange() {
    if (TG.ready) {
      // load server save and merge
      try {
        const serverState = await loadStateFromServer(TG);
        if (serverState) {
          this.state = serverState;
          this.renderTopbar();
          this.flash(`Привет, ${TG.user.first_name || TG.user.username || 'путешественник'}! Синхронизация завершена.`);
        }
      } catch (e) { console.warn('Server load failed', e); }
    }
    this.renderLoginUI();
  }

  async syncServer() {
    if (TG.ready && Date.now() - this.lastServerSave > 8000) {
      this.lastServerSave = Date.now();
      await saveStateToServer(TG, this.state);
    }
  }

  renderLoginUI() {
    const el = document.getElementById('login-status');
    if (!el) return;
    if (TG.ready && TG.user) {
      const name = TG.user.first_name || TG.user.username || 'путешественник';
      el.innerHTML = `<span class="tg-online">●</span> ${escapeHtml(name)}`;
      el.title = `Telegram: ${TG.user.username || '(без юзернейма)'}\nID: ${TG.userId}`;
    } else {
      el.innerHTML = `<span class="tg-off">○</span> <button id="tg-login-btn" class="tg-login-link">Войти через Telegram</button>`;
      const btn = document.getElementById('tg-login-btn');
      if (btn) btn.addEventListener('click', async () => {
        // Render the widget and show a modal-like overlay
        const overlay = document.createElement('div');
        overlay.id = 'tg-login-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
          <div style="background:#1a1a2e;padding:32px 48px;border-radius:16px;text-align:center;max-width:400px;">
            <h3 style="color:#4dd0ff;margin-bottom:16px;">Войти через Telegram</h3>
            <p style="color:#8a9ac8;margin-bottom:24px;">Нажмите на кнопку ниже для авторизации</p>
            <div id="tg-widget-container" style="display:flex;justify-content:center;"></div>
            <button id="tg-close-btn" style="margin-top:20px;background:none;border:1px solid #8a9ac8;color:#8a9ac8;padding:8px 24px;border-radius:8px;cursor:pointer;font-family:Rubik,sans-serif;">Закрыть</button>
          </div>`;
        document.body.appendChild(overlay);

        // Render the widget
        const { TG } = await import('./telegram.js');
        const widget = document.createElement('telegram-login-widget');
        widget.setAttribute('data-bot-name', TG.config.botName || 'AtlantisCodeGame_bot');
        widget.setAttribute('data-size', 'large');
        widget.setAttribute('data-onauth', 'onTelegramAuth(user)');
        widget.setAttribute('data-request-access', 'write');
        widget.setAttribute('data-userpic', 'false');
        widget.setAttribute('data-style', 'bubbles');
        widget.setAttribute('data-corner-radius', '12');
        document.getElementById('tg-widget-container').appendChild(widget);

        // Load widget script
        if (!window.TelegramLoginWidget) {
          const s = document.createElement('script');
          s.async = true;
          s.src = 'https://telegram.org/js/telegram-widget.js?2';
          s.onload = () => { /* widget will render */ };
          document.head.appendChild(s);
        }

        document.getElementById('tg-close-btn').addEventListener('click', () => {
          overlay.remove();
        });
      });
    }
  }

  // ---- audio init on first gesture ----
  initAudioOnce() {
    if (this._audioInited) return;
    this._audioInited = true;
    this.audio.init();
    this.audio.resume();
    this.audio.loadAll().then(() => {
      if (this.mode === 'island') this.audio.setMusic('menu');
    });
  }

  // ---- input ----
  bindInput() {
    this.canvas.addEventListener('pointerdown', () => this.initAudioOnce(), { once: true });
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  onPointerMove(e) {
    if (this.mode !== 'island') return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.island.buildings.filter((b) => b.userData.building), true);
    let found = null;
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.building) o = o.parent;
      if (o) found = o.userData.building;
    }
    if (found !== this.hovered) {
      this.hovered = found;
      this.canvas.style.cursor = found ? 'pointer' : 'grab';
    }
  }

  onClick(e) {
    if (this.mode !== 'island') return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.island.buildings.filter((b) => b.userData.building), true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.building) o = o.parent;
      if (o) this.openBuilding(o.userData.building);
    }
  }

  // ---- UI wiring ----
  bindUI() {
    document.getElementById('enter-sim').addEventListener('click', () => this.enterSim());
    document.getElementById('sim-depth').addEventListener('change', (e) => { this.simDepth = parseInt(e.target.value, 10); });
    document.getElementById('btn-upgrades').addEventListener('click', () => this.openUpgrades());
    document.getElementById('btn-shop').addEventListener('click', () => this.openShop());
    document.getElementById('btn-achievements').addEventListener('click', () => this.openAchievements());
    document.getElementById('btn-roulette').addEventListener('click', () => this.openRoulette());
    document.getElementById('btn-deck').addEventListener('click', () => this.openDeck());
    document.getElementById('btn-save').addEventListener('click', () => { saveState(this.state); this.flash('Прогресс сохранён'); });
    document.getElementById('hero-create').addEventListener('click', () => this.openHeroCreate());
    document.getElementById('hero-confirm').addEventListener('click', () => this.confirmHero());
    document.getElementById('hero-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.confirmHero(); });
    // combat controls (delegated, since combat re-renders)
    document.getElementById('end-turn').addEventListener('click', () => this.combat.endTurnBtn());
    document.getElementById('flee').addEventListener('click', () => this.combat.flee());
  }

  // ---- building panel ----
  openBuilding(id) {
    const def = CHARACTERS[id];
    if (!def) return;
    this.audio.ui('click');
    const s = this.state;
    let action = '';
    if (id === 'theo') action = `<button class="btn btn-primary" id="b-action">Открыть кейс</button>`;
    else if (id === 'carrion') action = `<div class="stat-line">Рейтинг: ${this.rating()}</div><div class="stat-line">Прогонов: ${s.stats.runs} · побед: ${s.stats.wins}</div>`;
    else if (id === 'yarilyk') action = `<div class="stat-line">Достижения: ${s.achievements.length} / ${ACHIEVEMENTS.length}</div><div class="stat-line">Глаза стража: ${s.eyes}</div>`;
    else if (id === 'grisha') action = `<button class="btn btn-primary" id="b-action">Крутить рулетку (10 Глаз)</button>`;
    else if (id === 'kemet') action = s.island.reactor ? `<div class="stat-line">Реактор включён. Свет включён.</div>` : `<button class="btn btn-primary" id="b-action">Включить реактор (200 Призмарина)</button>`;
    else if (id === 'tramplin') action = `<div class="stat-line">Карты: ${Object.keys(s.cards.owned).length}</div><div class="stat-line">Запечатано (Lv10): ${s.cards.sealed.length}</div>`;
    else if (id === 'erri') action = `<button class="btn btn-primary" id="b-action">Купить карту (10 Призмарина)</button>`;
    else if (id === 'lauf') action = `<div class="stat-line">Обмен: 1 карта / 24ч, равноценная редкость.</div>`;
    else {
      const inc = s.buildings.income[id] || 0;
      action = `<div class="stat-line">Пассивный доход: ${inc} Призм/ч</div>`;
    }
    const panel = document.getElementById('building-panel');
    panel.innerHTML = `
      <div class="bp-head">
        <div class="bp-avatar" style="background:${def.color ? '#' + (typeof def.color === 'number' ? def.color.toString(16).padStart(6, '0') : def.color) : '#888'}"></div>
        <div>
          <div class="bp-name">${def.name}</div>
          <div class="bp-title">${def.title} · ярус ${def.tier}</div>
        </div>
        <button class="bp-close" id="building-close">✕</button>
      </div>
      <div class="bp-look">${def.look}</div>
      <div class="bp-pers">${def.personality}</div>
      <div class="bp-line">${def.line(s)}</div>
      <div class="bp-action">${action}</div>`;
    panel.classList.remove('hidden');
    const bAction = document.getElementById('b-action');
    if (bAction) bAction.addEventListener('click', () => this.buildingAction(id));
    document.getElementById('building-close').onclick = () => this.closeBuilding();
  }

  closeBuilding() { document.getElementById('building-panel').classList.add('hidden'); }

  buildingAction(id) {
    const s = this.state;
    if (id === 'theo') this.openCase();
    else if (id === 'grisha') this.rouletteSpin();
    else if (id === 'kemet' && !s.island.reactor) {
      if (buyUpgrade(s, 'reactor')) { this.audio.buy(); this.flash('Реактор включён! Факелы → лампы.'); this.island.islandState.reactor = true; checkAchievements(s); }
      else this.flash('Недостаточно Призмарина');
    } else if (id === 'erri') this.buyCard();
  }

  // ---- card case (Theo) ----
  openCase() {
    const s = this.state;
    const id = rollCardDrop(s.cards.sealed);
    ownCard(s, id);
    this.audio.pickup();
    this.flash(`Кейс открыт! Получена: ${CARD_DB[id].name}`);
  }

  buyCard() {
    const s = this.state;
    if (spendPrismarin(s, 10)) {
      const id = rollCardDrop(s.cards.sealed);
      ownCard(s, id);
      this.audio.buy();
      this.flash(`Куплена карта: ${CARD_DB[id].name}`);
    } else this.flash('Недостаточно Призмарина');
  }

  // ---- sim world entry ----
  enterSim() {
    this.initAudioOnce();
    this.audio.ui('confirm');
    this.mode = 'combat';
    this.audio.setMusic('combat');
    document.getElementById('island-ui').classList.add('hidden');
    this.combat.start(this.simDepth, (won) => this.onRunEnd(won));
  }

  onRunEnd(won) {
    this.mode = 'island';
    this.audio.setMusic('menu');
    document.getElementById('island-ui').classList.remove('hidden');
    this.renderTopbar();
    saveState(this.state);
  }

  // ---- upgrades / shop / achievements / roulette / deck ----
  openUpgrades() {
    const s = this.state;
    let html = '<div class="ov-title">УЛУЧШЕНИЯ ОСТРОВА</div><div class="ov-list">';
    for (const [id, u] of Object.entries(UPGRADES)) {
      const can = u.check(s);
      html += `<div class="ov-item ${can ? '' : 'disabled'}">
        <div><b>${u.name}</b><br><span class="ov-desc">${u.desc}</span></div>
        <div class="ov-cost">${u.cost} Призм</div>
        ${can ? `<button class="btn btn-ghost" data-up="${id}">Купить</button>` : '<span class="done">✓</span>'}
      </div>`;
    }
    html += '</div><button class="btn btn-ghost" id="ov-close">Закрыть</button>';
    this.showOverlay(html, () => {
      document.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
        if (buyUpgrade(s, b.dataset.up)) { this.audio.buy(); checkAchievements(s); this.island.islandState.reactor = s.island.reactor; this.flash('Улучшение приобретено'); this.openUpgrades(); }
        else this.flash('Недостаточно Призмарина');
      }));
      document.getElementById('ov-close').onclick = () => this.hideOverlay();
    });
  }

  openShop() {
    const s = this.state;
    let html = '<div class="ov-title">МАГАЗИН КАРТ</div><div class="ov-list">';
    const owned = Object.keys(s.cards.owned);
    if (!owned.length) html += '<div class="ov-desc">Карты пока не получены. Откройте кейс у Тео или купите у Эрри.</div>';
    for (const id of owned.slice(0, 16)) {
      const c = CARD_DB[id];
      const lvl = s.cards.owned[id].level;
      html += `<div class="ov-item">
        <div><b style="color:${RARITY[c.rarity].color}">${c.name}</b> <span class="lvl">Lv${lvl}</span><br><span class="ov-desc">${c.desc}</span></div>
        <div class="ov-cost">${RARITY[c.rarity].name}</div>
      </div>`;
    }
    html += '</div><button class="btn btn-ghost" id="ov-close">Закрыть</button>';
    this.showOverlay(html, () => { document.getElementById('ov-close').onclick = () => this.hideOverlay(); });
  }

  openAchievements() {
    const s = this.state;
    let html = '<div class="ov-title">ДОСТИЖЕНИЯ ЯРИКА</div><div class="ov-list">';
    for (const a of ACHIEVEMENTS) {
      const got = s.achievements.includes(a.id);
      html += `<div class="ov-item ${got ? 'done-row' : ''}">
        <div><b>${a.name}</b><br><span class="ov-desc">${a.desc}</span></div>
        <div class="ov-cost">${got ? '✓' : `+${a.reward} Глаз`}</div>
      </div>`;
    }
    html += '</div><button class="btn btn-ghost" id="ov-close">Закрыть</button>';
    this.showOverlay(html, () => { document.getElementById('ov-close').onclick = () => this.hideOverlay(); });
  }

  openRoulette() {
    const s = this.state;
    let html = '<div class="ov-title">РУЛЕТКА ГРИШИ <span class="sub">37% честный шанс</span></div>
      <div class="roulette"><div class="wheel">🎰</div></div>
      <div class="ov-cost">Ставка: 10 Глаз стража</div>
      <button class="btn btn-primary" id="rv-spin">Крутить</button>
      <button class="btn btn-ghost" id="ov-close">Закрыть</button>';
    this.showOverlay(html, () => {
      document.getElementById('rv-spin').onclick = () => this.rouletteSpin();
      document.getElementById('ov-close').onclick = () => this.hideOverlay();
    });
  }

  rouletteSpin() {
    const s = this.state;
    if (spendEyes(s, 10)) {
      this.audio.ui('confirm');
      const win = Math.random() < 0.37;
      const prize = win ? (20 + Math.floor(Math.random() * 40)) : 0;
      if (prize) addPrismarin(s, prize);
      this.flash(win ? `Выигрыш! +${prize} Призмарина` : 'Проигрыш. Колесо не лжёт.');
    } else this.flash('Недостаточно Глаз стража');
  }

  openDeck() {
    const s = this.state;
    const deck = deckCards(s);
    let html = '<div class="ov-title">КОЛОДА БЕЗЫМЯННОГО <span class="sub">8 карт</span></div><div class="deck-list">';
    deck.forEach((id) => {
      const c = CARD_DB[id];
      html += `<div class="deck-card rarity-${c.rarity}">
        <span class="dc-cost">${c.cost}</span>
        <b style="color:${RARITY[c.rarity].color}">${c.name}</b>
        <span class="dc-type">${c.type}</span>
      </div>`;
    });
    html += '</div><button class="btn btn-ghost" id="ov-close">Закрыть</button>';
    this.showOverlay(html, () => { document.getElementById('ov-close').onclick = () => this.hideOverlay(); });
  }

  openHeroCreate() {
    document.getElementById('hero-create').classList.remove('hidden');
    document.getElementById('hero-name').value = this.state.hero.name === 'Безымянный' ? '' : this.state.hero.name;
  }

  confirmHero() {
    const name = document.getElementById('hero-name').value.trim();
    if (name) {
      this.state.hero.name = name;
      this.flash(`Слегка с собой, ${name}.`);
    }
    document.getElementById('hero-create').classList.add('hidden');
    saveState(this.state);
  }

  // ---- overlay helpers ----
  showOverlay(html, after) {
    document.getElementById('overlay-content').innerHTML = html;
    document.getElementById('overlay').classList.remove('hidden');
    if (after) after();
  }
  hideOverlay() { document.getElementById('overlay').classList.add('hidden'); }

  // ---- stats ----
  rating() {
    return Math.floor(this.state.stats.runs * 10 + this.state.stats.wins * 50 + this.state.stats.bestDepth * 20);
  }

  flash(msg) {
    const f = document.getElementById('flash');
    if (!f) return;
    f.textContent = msg;
    f.classList.remove('hidden');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => f.classList.add('hidden'), 2000);
  }

  renderTopbar() {
    const s = this.state;
    document.getElementById('tb-prismarin').textContent = Math.floor(s.prismarin).toLocaleString('ru-RU');
    document.getElementById('tb-eyes').textContent = s.eyes;
    document.getElementById('tb-hero').textContent = s.hero.name;
    document.getElementById('tb-rating').textContent = this.rating();
  }

  // ---- main loop ----
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.controls.update();
    this.island.animate(dt);

    // day/night (real-time hour)
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    updateDayNight(this.island, hour, this.state.island.reactor);

    // idle income tick
    tickIdle(this.state, dt);

    // periodic topbar + save
    const nowMs = Date.now();
    if (nowMs - this.lastTopbarCheck > 2000) {
      this.lastTopbarCheck = nowMs;
      this.renderTopbar();
      if (Math.random() < 0.05) saveState(this.state);
    }
    // cloud sync
    this.syncServer();

    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game;
  game.renderTopbar();
  game.initTG();
  if (game.state.hero.name === 'Безымянный') {
    document.getElementById('hero-create').classList.remove('hidden');
  }
});
