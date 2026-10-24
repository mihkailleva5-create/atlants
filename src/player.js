import * as THREE from 'three';
import { Character } from './character.js';
import { models } from './models.js';
import { WeaponSystem } from './weapons.js';
import { distXZ, clamp } from './utils.js';

export class Player {
  constructor(game, pos) {
    this.game = game;
    this.char = new Character(game.scene, models.robot, {
      pos,
      tint: 0x18a0c8,
      emissiveIntensity: 0.35,
    });
    this.pos = this.char.root.position;
    this.dead = false;

    this.stats = {
      hp: 120,
      maxHp: 120,
      speed: 6.2,
      dashCd: 1.4,
      dashTime: 0,
      dashDmg: 0,
      lifesteal: 0,
    };
    this.invuln = 0;
    this.hurt = 0;
    this.dashTime = 0;
    this.dashCdT = 0;
    this.dashHits = new Set();

    this.weapons = new WeaponSystem(game, this);
    this._tmp = new THREE.Vector3();
  }

  get hp() { return this.stats.hp; }

  update(dt, input) {
    if (this.dead) {
      this.char.update(dt);
      return;
    }
    const g = this.game;

    // camera-relative movement
    const camDir = g.camera.getWorldDirection(this._tmp);
    const yaw = Math.atan2(camDir.x, camDir.z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = fz, rz = -fx; // right vector

    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let mz = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const mlen = Math.hypot(mx, mz);
    if (mlen > 0) { mx /= mlen; mz /= mlen; }
    const dx = fx * mz + rx * mx;
    const dz = fz * mz + rz * mx;

    const speed = this.stats.speed * (this.dashTime > 0 ? 3.6 : 1);
    let nx = this.pos.x + dx * speed * dt;
    let nz = this.pos.z + dz * speed * dt;
    const c = g.collide(nx, nz, 1.0);
    this.pos.x = c.x;
    this.pos.z = c.z;
    this.pos.y = 0;

    // face aim direction
    const aimH = g.camera.getWorldDirection(this._tmp).clone();
    aimH.y = 0;
    aimH.normalize();
    this.char.faceToAngle(Math.atan2(aimH.x, aimH.z), dt, 12);

    // animations
    const sp = Math.hypot(dx, dz) * speed;
    if (this.dashTime > 0) this.char.play('running', 0.08);
    else if (sp > 0.9) this.char.play(sp > 4.3 ? 'running' : 'walking', 0.1);
    else this.char.play('idle', 0.1);

    // dash
    if (input.dash) {
      input.dash = false;
      if (this.dashCdT <= 0 && this.dashTime <= 0) {
        this.dashTime = 0.32;
        this.dashCdT = this.stats.dashCd;
        this.invuln = 0.35;
        this.dashHits = new Set();
        g.fx.dashBurst(this.pos.clone());
        g.audio.dash();
      }
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      g.fx.trail(this.pos.clone());
      for (const e of g.enemies) {
        if (e.state === 'dead' || this.dashHits.has(e)) continue;
        if (distXZ(e.root.position.x, e.root.position.z, this.pos.x, this.pos.z) < 2.9 + e.hitR) {
          e.takeDamage(this.stats.dashDmg || 20, false, e.root.position.clone());
          this.dashHits.add(e);
        }
      }
    }
    this.dashCdT -= dt;
    this.invuln -= dt;

    if (this.hurt > 0) {
      this.hurt -= dt;
      this.char.setEmissive(2.2 * clamp(this.hurt / 0.35, 0, 1));
    } else {
      this.char.setEmissive(1);
    }

    this.weapons.update(dt, input);
    this.char.update(dt);
  }

  takeDamage(dmg) {
    if (this.dead || this.invuln > 0) return false;
    this.stats.hp -= dmg;
    this.hurt = 0.35;
    this.game.audio.hurt();
    this.game.fx.sparks(this.pos.clone().setY(2.2), 8, 0xff4444, 7);
    this.game.fx.shake(0.22);
    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.die();
    }
    return true;
  }

  heal(v) {
    if (this.dead) return;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + v);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.char.play(['death', 'idle'], 0.1, true);
    this.game.onPlayerDeath();
  }
}
