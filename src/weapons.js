import * as THREE from 'three';
import { rand, chance } from './utils.js';

export const WEAPONS = {
  blaster: { name: 'Бластер',  dmg: 14, rate: 0.13, mag: 30,  reload: 1.0, spread: 0.012, pellets: 1, auto: true,  color: 0x66f0ff, proj: false },
  scatter: { name: 'Дробовик', dmg: 12, rate: 0.6,  mag: 8,   reload: 1.5, spread: 0.17,  pellets: 6, auto: false, color: 0xffb347, proj: false },
  rockets: { name: 'Ракеты',   dmg: 65, rate: 0.72, mag: 4,   reload: 2.4, spread: 0.03,  pellets: 1, auto: false, color: 0xff5577, proj: true,  radius: 7 },
  minigun: { name: 'Миниган',  dmg: 10, rate: 0.062,mag: 120, reload: 2.6, spread: 0.05,  pellets: 1, auto: true,  color: 0xffe066, proj: false },
};

export const WEAPON_ORDER = ['blaster', 'scatter', 'rockets', 'minigun'];

export class WeaponSystem {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.current = 'blaster';
    this.owned = new Set(['blaster']);
    this.mag = { blaster: 30, scatter: 8, rockets: 4, minigun: 120 };
    this.cooldown = 0;
    this.reloadT = 0;
    this.pending = false;
    this.prevWant = false;
    this.mods = {
      dmg: 1, rate: 1, spread: 1, pellets: 1, pierce: 0,
      explosive: 0, explosiveRadius: 0, crit: 0.05, reload: 1,
    };
  }

  get weapon() { return WEAPONS[this.current]; }
  has(id) { return this.owned.has(id); }
  available() { return WEAPON_ORDER.filter((k) => this.has(k)); }

  unlock(id) { this.owned.add(id); }

  switch(id) {
    if (!this.has(id) || id === this.current) return;
    this.current = id;
    this.cooldown = 0.2;
    this.reloadT = 0;
    this.game.audio.ui('click');
  }

  cycle(dir) {
    const a = this.available();
    const i = a.indexOf(this.current);
    if (i < 0) return;
    this.switch(a[(i + dir + a.length) % a.length]);
  }

  startReload() {
    if (this.reloadT > 0) return;
    const w = this.weapon;
    if (this.mag[this.current] >= w.mag) return;
    this.reloadT = w.reload * this.mods.reload;
    this.game.audio.reload();
  }

  update(dt, input) {
    this.cooldown -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.mag[this.current] = this.weapon.mag;
    }
    if (input.reload && this.reloadT <= 0) this.startReload();

    const w = this.weapon;
    const want = input.fire;
    if (want) {
      if (w.auto) this.pending = true;
      else if (!this.prevWant) this.pending = true;
    }
    this.prevWant = want;

    if (this.pending && this.cooldown <= 0 && this.reloadT <= 0) {
      this.pending = false;
      if (this.mag[this.current] > 0) this.fire();
      else { this.game.audio.empty(); this.startReload(); }
    }
    if (!want) this.pending = false;
  }

  fire() {
    const g = this.game;
    const w = this.weapon;
    this.cooldown = w.rate / this.mods.rate;
    this.mag[this.current]--;

    const camDir = g.camera.getWorldDirection(new THREE.Vector3());
    const muzzle = new THREE.Vector3().copy(this.player.pos).setY(2.4).addScaledVector(camDir, 0.6);
    const pellets = Math.round(w.pellets * this.mods.pellets);

    for (let i = 0; i < pellets; i++) {
      const dir = camDir.clone();
      dir.x += rand(-1, 1) * w.spread * this.mods.spread;
      dir.y += rand(-1, 1) * w.spread * this.mods.spread * 0.5;
      dir.z += rand(-1, 1) * w.spread * this.mods.spread;
      dir.normalize();

      const hits = g.rayEnemies(muzzle, dir, 320);
      const end = muzzle.clone().addScaledVector(dir, 140);
      let remaining = this.mods.pierce + 1;

      for (const h of hits) {
        if (remaining <= 0) break;
        const e = h.enemy;
        if (!e || e.state === 'dead') continue;
        remaining--;
        const crit = chance(this.mods.crit);
        const dmg = w.dmg * this.mods.dmg * (crit ? 2 : 1);
        e.takeDamage(dmg, crit, h.point);
        g.fx.number(h.point, Math.round(dmg), crit ? '#ffd700' : '#ffffff');
        g.fx.hitMarker(crit);
        if (this.mods.explosive > 0) {
          g.fx.explosion(h.point, this.mods.explosiveRadius || 4, w.color);
          g.explodeAOE(h.point, this.mods.explosiveRadius || 4, w.dmg * this.mods.dmg * 0.6);
        }
        end.copy(h.point);
      }
      g.fx.tracer(muzzle, end, w.color);
    }
    g.fx.muzzle(muzzle, camDir, w.color);
    g.audio.shoot(this.current);
    if (w.proj) {
      g.spawnBullet(muzzle, dir.clone(), w);
    }
  }
}
