import { WEAPONS } from './weapons.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      hpBar: document.getElementById('hp-bar'),
      hpText: document.getElementById('hp-text'),
      waveLabel: document.getElementById('wave-label'),
      enemiesLeft: document.getElementById('enemies-left'),
      score: document.getElementById('score'),
      combo: document.getElementById('combo'),
      weaponName: document.getElementById('weapon-name'),
      ammo: document.getElementById('ammo'),
      dashCd: document.getElementById('dash-cd'),
      slots: document.getElementById('weapon-slots'),
      banner: document.getElementById('banner'),
      bannerMain: document.getElementById('banner-main'),
      bannerSub: document.getElementById('banner-sub'),
      dashText: document.getElementById('dash-text'),
      vignette: document.getElementById('vignette'),
      menu: document.getElementById('menu'),
      shop: document.getElementById('shop'),
      shopCards: document.getElementById('shop-cards'),
      shopSkip: document.getElementById('shop-skip'),
      gameover: document.getElementById('gameover'),
      goStats: document.getElementById('go-stats'),
      goRestart: document.getElementById('go-restart'),
      pause: document.getElementById('pause'),
      loading: document.getElementById('loading'),
      loadingBar: document.getElementById('loading-bar'),
      loadingText: document.getElementById('loading-text'),
      creditsBtn: document.getElementById('credits-btn'),
      credits: document.getElementById('credits'),
    };
    this._bannerTimer = 0;
    this._shopOpen = false;
    this._cards = null;
    this._onPick = null;
    this._onSkip = null;
    this._slotsSig = '';
  }

  show(el) { el.classList.remove('hidden'); }
  hide(el) { el.classList.add('hidden'); }

  setLoadingProgress(k, text) {
    this.el.loadingBar.style.width = Math.round(k * 100) + '%';
    if (text) this.el.loadingText.textContent = text;
  }

  hideLoading() { this.hide(this.el.loading); }

  showMenu() {
    this.hide(this.el.hud);
    this.show(this.el.menu);
  }

  startGame() {
    this.hide(this.el.menu);
    this.hide(this.el.shop);
    this.hide(this.el.gameover);
    this.hide(this.el.pause);
    this.show(this.el.hud);
    this._renderSlots(null);
  }

  pause(on) {
    if (on) this.show(this.el.pause);
    else this.hide(this.el.pause);
  }

  banner(text, sub, dur = 2.5) {
    const b = this.el.banner;
    this.el.bannerMain.textContent = text;
    this.el.bannerSub.textContent = sub || '';
    b.classList.remove('hidden');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.add('hidden'), dur * 1000);
  }

  _renderSlots(weapons) {
    const sig = weapons ? (weapons.current + '|' + [...weapons.owned].sort().join(',')) : '';
    if (sig === this._slotsSig) return;
    this._slotsSig = sig;
    const el = this.el.slots;
    el.innerHTML = '';
    const order = ['blaster', 'scatter', 'rockets', 'minigun'];
    for (let i = 0; i < order.length; i++) {
      const k = order[i];
      const d = document.createElement('div');
      d.className = 'slot' + (weapons && weapons.has(k) ? ' owned' : ' locked');
      d.textContent = (i + 1) + ' ' + WEAPONS[k].name;
      el.appendChild(d);
    }
  }

  update(game) {
    if (game.state !== 'playing' && game.state !== 'dying') return;
    const p = game.player;
    const hpK = p.stats.hp / p.stats.maxHp;
    this.el.hpBar.style.width = Math.max(0, hpK * 100) + '%';
    this.el.hpBar.className = hpK < 0.3 ? 'low' : '';
    this.el.hpText.textContent = Math.ceil(p.stats.hp) + ' / ' + Math.round(p.stats.maxHp);

    const w = p.weapons;
    this.el.weaponName.textContent = w.weapon.name;
    const reloading = w.reloadT > 0;
    const left = reloading ? 0 : w.mag[w.current];
    this.el.ammo.textContent = reloading ? 'перезарядка…' : left + ' / ' + w.weapon.mag;
    this._renderSlots(w);

    const cdK = 1 - clamp01(p.dashCdT / p.stats.dashCd);
    this.el.dashCd.style.width = Math.round(cdK * 100) + '%';
    this.el.dashText.textContent = cdK >= 1 ? 'готов' : p.dashCdT.toFixed(1) + 'с';

    this.el.waveLabel.textContent = 'ВОЛНА ' + game.wave;
    const alive = game.enemies.filter((e) => e.state !== 'dead').length + game.waveM.queue.length;
    this.el.enemiesLeft.textContent = 'Осталось врагов: ' + alive;

    this.el.score.textContent = game.score.toLocaleString('ru-RU');
    const mult = 1 + Math.floor(game.combo / 5) * 0.5;
    this.el.combo.textContent = game.combo > 1 ? (mult.toFixed(1) + ' (x' + game.combo + ')') : '—';

    this.el.vignette.style.opacity = hpK < 0.35 ? (0.35 - hpK) / 0.35 * 0.7 : 0;
  }

  showShop(cards, onPick, onSkip) {
    this._shopOpen = true;
    this._cards = cards;
    this._onPick = onPick;
    this._onSkip = onSkip;
    this.el.shopCards.innerHTML = '';
    cards.forEach((card, i) => {
      const d = document.createElement('div');
      d.className = 'card';
      d._card = card;
      d.innerHTML = `
        <div class="card-key">${i + 1}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.desc}</div>`;
      d.addEventListener('click', () => this._pick(i));
      this.el.shopCards.appendChild(d);
    });
    this.el.shopSkip.onclick = () => this._skip();
    this.show(this.el.shop);
  }

  _pick(i) {
    if (!this._shopOpen) return;
    this._shopOpen = false;
    this.hide(this.el.shop);
    const card = this._cards ? this._cards[i] : null;
    if (this._onPick) this._onPick(card);
  }

  _skip() {
    if (!this._shopOpen) return;
    this._shopOpen = false;
    this.hide(this.el.shop);
    if (this._onSkip) this._onSkip();
  }

  hideShop() { this._shopOpen = false; this.hide(this.el.shop); }

  showGameOver(stats) {
    this.hide(this.el.hud);
    this.el.goStats.innerHTML =
      `<div class="go-stat"><span>Волна</span><b>${stats.wave}</b></div>
       <div class="go-stat"><span>Убито</span><b>${stats.kills}</b></div>
       <div class="go-stat"><span>Очки</span><b>${stats.score.toLocaleString('ru-RU')}</b></div>`;
    this.show(this.el.gameover);
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
