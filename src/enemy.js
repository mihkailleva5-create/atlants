import * as THREE from 'three';
import { Character } from './character.js';
import { models } from './models.js';
import { rand, distXZ, chance, clamp } from './utils.js';

export const ENEMY_TYPES = {
  grunt:  { model: 'soldier', hp: 46,  speed: 3.5, dmg: 8,  ranged: true,  range: 36, fireCd: 1.8, hitChance: 0.8,  color: 0xff2d4d, scale: 1,   eye: 1.8, score: 100, drop: 0.10, hitR: 1.1 },
  brute:  { model: 'xbot',    hp: 150, speed: 2.6, dmg: 26, ranged: false, range: 0,  fireCd: 0,   hitChance: 0,    color: 0xff6a00, scale: 1.7, eye: 3.0, score: 260, drop: 0.25, hitR: 2.0 },
  drone:  { model: null,      hp: 34,  speed: 4.8, dmg: 7,  ranged: true,  range: 42, fireCd: 1.3, hitChance: 0.7,  color: 0xff44ff, scale: 1,   eye: 2.0, score: 120, drop: 0.08, hitR: 1.0, fly: true, primitive: 'drone' },
  turret: { model: null,      hp: 80,  speed: 0,   dmg: 13, ranged: true,  range: 34, fireCd: 1.5, hitChance: 0.9,  color: 0xff0066, scale: 1,   eye: 2.2, score: 160, drop: 0.15, hitR: 1.6, primitive: 'turret' },
  boss:   { model: 'xbot',    hp: 900, speed: 2.4, dmg: 38, ranged: true,  range: 50, fireCd: 1.1, hitChance: 1.0,  color: 0xff0022, scale: 2.8, eye: 5.0, score: 2500, drop: 1, hitR: 4.2, boss: true },
};

export class Enemy {
  constructor(game, typeKey, pos, wave) {
    this.game = game;
    this.typeKey = typeKey;
    this.type = ENEMY_TYPES[typeKey];
    this.scale = this.type.scale;
    this.state = 'spawn';
    this.spawnT = 0.6;
    this.deadT = 0;
    this.hurt = 0;
    this.t = rand(0, 10);
    this.shootCd = rand(0.6, 1.6);
    this.meleeCd = 0;
    this.slamT = 5;
    this.slaming = 0;
    this.minionT = 8;
    this.phase2 = false;
    this.char = null;
    this._tmp = new THREE.Vector3();

    // HP scaling with wave
    let hp = this.type.hp;
    if (this.type.boss) hp *= 1 + 0.2 * (Math.floor(wave / 5) - 1);
    else hp *= 1 + 0.16 * (wave - 1);
    this.hp = hp;
    this.maxHp = hp;
    this.dmg = this.type.dmg * (1 + 0.08 * (wave - 1));
    this.speed = this.type.speed * (1 + 0.02 * (wave - 1));
    this.hitR = this.type.hitR * this.scale;
    this.eyeY = this.type.eye * this.scale;

    this.root = new THREE.Group();
    this.root.position.copy(pos);

    if (this.type.primitive === 'drone') this.buildDrone();
    else if (this.type.primitive === 'turret') this.buildTurret();
    else this.buildCharacter();

    this.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.enemy = this; }
    });
    this.game.scene.add(this.root);
  }

  buildCharacter() {
    const gltf = models[this.type.model];
    // scale is applied on the enemy group (spawn anim), not the inner char root
    this.char = new Character(this.game.scene, gltf, {
      pos: new THREE.Vector3(),
      tint: this.type.color,
      emissiveIntensity: 0.5,
    });
    // Character adds its own root to the scene; reparent into our group
    this.game.scene.remove(this.char.root);
    this.char.root.position.set(0, 0, 0);
    this.char.root.rotation.set(0, 0, 0);
    this.root.add(this.char.root);
  }

  buildDrone() {
    const color = this.type.color;
    const g = this.root;
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({ color: 0x1a1020, emissive: color, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.7 })
    );
    g.add(core);
    this._droneCore = core;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.08, 6, 20),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    this._droneRing = ring;
    this._rotors = [];
    for (let i = 0; i < 4; i++) {
      const th = (i / 4) * Math.PI * 2;
      const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.05, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x222233, emissive: color, emissiveIntensity: 0.4 })
      );
      rotor.position.set(Math.cos(th) * 0.85, 0.15, Math.sin(th) * 0.85);
      rotor.rotation.y = th;
      g.add(rotor);
      this._rotors.push(rotor);
    }
  }

  buildTurret() {
    const color = this.type.color;
    const g = this.root;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a1020, emissive: color, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.5 })
    );
    base.position.y = 0.4;
    g.add(base);
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a0a14, emissive: color, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.6 })
    );
    body.position.y = 1.5;
    g.add(body);
    this._turretHead = new THREE.Group();
    this._turretHead.position.y = 1.5;
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 1.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.7 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.7;
    this._turretHead.add(barrel);
    g.add(this._turretHead);
  }

  // ---- helpers ----
  hasLOS(target) {
    const from = this.root.position.clone().setY(this.eyeY);
    const dir = target.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    const ray = new THREE.Raycaster(from, dir, 0, dist);
    const hits = ray.intersectObjects(this.game.world.propMeshes, false);
    return hits.length === 0;
  }

  shoot(player) {
    const from = this.root.position.clone().setY(this.eyeY);
    const target = player.pos.clone().setY(2.2);
    const dir = target.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    dir.x += rand(-1, 1) * 0.03;
    dir.z += rand(-1, 1) * 0.03;
    dir.normalize();
    this.game.fx.tracer(from, target, this.type.color);
    this.game.audio.enemyShoot();
    const chanceHit = this.type.hitChance * (1 - clamp(dist / this.type.range, 0, 1) * 0.3);
    if (chance(chanceHit)) player.takeDamage(this.dmg);
  }

  takeDamage(dmg, crit, point) {
    if (this.state === 'dead') return;
    this.hp -= dmg;
    this.hurt = 0.25;
    const pos = point ? point.clone() : this.root.position.clone().setY(this.eyeY);
    this.game.fx.sparks(pos, crit ? 10 : 6, this.type.color, crit ? 10 : 6);
    this.game.audio.hit(crit);
    if (this.char) this.char.setEmissive(2.5);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deadT = 1.6;
    if (this.char) {
      this.char.play(['death', 'idle'], 0.1, true);
      this.char.root.rotation.x = -0.45;
    } else {
      this.root.visible = false;
    }
    const p = this.root.position.clone().setY(1.2);
    this.game.fx.debris(this.root.position.clone().setY(1), this.type.color);
    this.game.fx.explosion(p, this.type.boss ? 10 : 3.5, this.type.color);
    this.game.fx.shake(this.type.boss ? 0.9 : 0.25);
    this.game.audio.explosion(this.type.boss);
    this.game.onEnemyKilled(this);
  }

  remove() {
    this.removed = true;
    this.game.scene.remove(this.root);
    // materials are per-instance clones (tinted); geometry is shared with the
    // model registry, so it must NOT be disposed here.
    this.root.traverse((o) => {
      if (o.isMesh && o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  // ---- AI ----
  update(dt) {
    this.t += dt;
    const g = this.game;
    const player = g.player;

    if (this.state === 'dead') {
      this.deadT -= dt;
      if (this.deadT <= 0) this.remove();
      if (this.char) this.char.update(dt);
      return;
    }

    if (this.state === 'spawn') {
      this.spawnT -= dt;
      const k = clamp(1 - this.spawnT / 0.6, 0, 1);
      const s = this.scale * (0.2 + 0.8 * (1 - Math.pow(1 - k, 3)));
      this.root.scale.setScalar(s);
      if (this.spawnT <= 0) {
        this.root.scale.setScalar(this.scale);
        this.state = 'chase';
      }
      return;
    }

    if (!player || player.dead) return;

    const dx = player.pos.x - this.root.position.x;
    const dz = player.pos.z - this.root.position.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const ux = dx / dist, uz = dz / dist;

    // ---- movement ----
    let mx = 0, mz = 0;
    if (this.type.fly) {
      const desired = this.type.range * 0.62;
      if (dist > desired + 4) { mx = ux; mz = uz; }
      else if (dist < desired - 4) { mx = -ux; mz = -uz; }
      mx += -uz * Math.sin(this.t * 1.4) * 0.9;
      mz += ux * Math.sin(this.t * 1.4) * 0.9;
    } else if (this.type.ranged) {
      const desired = this.type.range * 0.55;
      if (dist > desired) { mx = ux; mz = uz; }
      else { mx = -uz * Math.sin(this.t * 1.1); mz = ux * Math.sin(this.t * 1.1); }
    } else {
      if (dist > 1.7) { mx = ux; mz = uz; }
    }
    const mlen = Math.hypot(mx, mz);
    if (mlen > 0) { mx /= mlen; mz /= mlen; }

    let nx = this.root.position.x + mx * this.speed * dt;
    let nz = this.root.position.z + mz * this.speed * dt;

    // props collision
    const c = g.collide(nx, nz, this.hitR);
    nx = c.x; nz = c.z;

    // enemy separation
    for (const e of g.enemies) {
      if (e === this || e.state === 'dead') continue;
      const ex = e.root.position.x - nx, ez = e.root.position.z - nz;
      const d = Math.hypot(ex, ez);
      const min = this.hitR + e.hitR;
      if (d < min && d > 0.001) {
        nx -= (ex / d) * (min - d) * 0.5;
        nz -= (ez / d) * (min - d) * 0.5;
      }
    }

    this.root.position.x = clamp(nx, -g.world.radius, g.world.radius);
    this.root.position.z = clamp(nz, -g.world.radius, g.world.radius);
    if (this.type.fly) {
      this.root.position.y = 5.5 + Math.sin(this.t * 2) * 1.2;
    } else {
      this.root.position.y = 0;
    }

    // face player
    const ang = Math.atan2(dx, dz);
    if (this.char) this.char.faceToAngle(ang, dt, 8);
    else this.root.rotation.y = ang;

    // animations
    if (this.char) {
      const moving = mlen > 0;
      this.char.play(moving ? (this.speed > 4 ? 'run' : 'walk') : 'idle', 0.1);
    }
    if (this._rotors) {
      for (const r of this._rotors) r.rotation.y += dt * 30;
      this._droneRing.rotation.z += dt * 2;
    }
    if (this._turretHead) {
      this._turretHead.rotation.y = Math.atan2(dx, dz);
    }

    // hurt flash decay
    if (this.hurt > 0) {
      this.hurt -= dt;
      if (this.char) this.char.setEmissive(2.5 * clamp(this.hurt / 0.25, 0, 1));
    } else if (this.char) this.char.setEmissive(1);

    // ---- attacks ----
    if (this.type.ranged) {
      if (dist < this.type.range && this.hasLOS(player.pos.clone().setY(2))) {
        this.shootCd -= dt;
        if (this.shootCd <= 0) {
          this.shoot(player);
          this.shootCd = this.type.fireCd * (this.phase2 ? 0.55 : 1) * rand(0.85, 1.2);
        }
      }
    }
    if (!this.type.fly && !this.type.ranged) {
      if (dist < 2.2 * this.scale + 1.0) {
        this.meleeCd -= dt;
        if (this.meleeCd <= 0) {
          player.takeDamage(this.dmg);
          this.meleeCd = 0.9;
          g.fx.sparks(player.pos.clone().setY(2), 8, 0xff4444, 7);
          g.fx.shake(0.2);
        }
      }
    }

    // ---- boss extras ----
    if (this.type.boss) {
      if (!this.phase2 && this.hp < this.maxHp * 0.5) {
        this.phase2 = true;
        this.speed *= 1.3;
        g.audio.bossRoar();
        g.fx.shake(0.5);
      }
      this.slamT -= dt;
      if (this.slamT <= 0 && this.slaming <= 0) {
        this.slaming = 0.75;
        g.fx.ring(this.root.position.clone().setY(0.1), 15, 0xff0022, 0.75);
      }
      if (this.slaming > 0) {
        this.slaming -= dt;
        if (this.slaming <= 0) {
          const d = distXZ(this.root.position.x, this.root.position.z, player.pos.x, player.pos.z);
          if (d < 15) player.takeDamage(34);
          g.fx.explosion(this.root.position.clone().setY(1), 12, 0xff3322);
          g.fx.shake(0.7);
          g.audio.explosion(false);
          this.slamT = 5.5;
        }
      }
      this.minionT -= dt;
      if (this.minionT <= 0) {
        this.minionT = 10;
        for (let i = 0; i < 2; i++) {
          const th = rand(0, Math.PI * 2);
          g.spawnEnemy('drone', this.root.position.clone().add(new THREE.Vector3(Math.cos(th) * 6, 0, Math.sin(th) * 6)));
        }
      }
    }

    if (this.char) this.char.update(dt);
  }
}
