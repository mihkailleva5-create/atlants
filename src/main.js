import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadModels, models } from './models.js';
import { AudioEngine } from './audio.js';
import { FX } from './effects.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Character } from './character.js';
import { WaveManager, rollShop } from './waves.js';
import { HUD } from './hud.js';
import { rand, clamp, distXZ, lerp, chance } from './utils.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.world = buildWorld(this.scene);
    this.fx = new FX(this.scene, this.camera);
    this.audio = new AudioEngine();
    this.hud = new HUD();

    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.state = 'loading';
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboT = 0;
    this.timeScale = 1;
    this.slowmoT = 0;
    this.slowmoScale = 1;
    this.yaw = 0;
    this.pitch = -0.12;
    this.menuT = 0;
    this.menuParts = [];
    this.dyingT = 0;
    this._audioInited = false;

    this.input = { forward: false, back: false, left: false, right: false, fire: false, reload: false, dash: false };
    this.firing = false;

    this.clock = new THREE.Clock();
    this._ray = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- boot / menu ----------
  async boot() {
    await loadModels((k) => this.hud.setLoadingProgress(k * 0.85, 'Загрузка 3D-моделей…'));
    this.hud.setLoadingProgress(1, 'Готово');
    setTimeout(() => this.enterMenu(), 350);
  }

  enterMenu() {
    this.state = 'menu';
    this.hud.hideLoading();
    this.hud.showMenu();
    this.buildMenuScene();
  }

  buildMenuScene() {
    const add = (char) => { this.menuParts.push(char); return char; };
    this.menuRobot = add(new Character(this.scene, models.robot, {
      pos: new THREE.Vector3(0, 0, 0), tint: 0x18a0c8, emissiveIntensity: 0.35,
    }));
    // pedestals
    for (const [x, z] of [[-9, -7], [9, -7]]) {
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.4, 2, 12),
        new THREE.MeshStandardMaterial({ color: 0x141a2c, emissive: 0x1a2c4a, emissiveIntensity: 0.5, roughness: 0.6 })
      );
      ped.position.set(x, 1, z);
      this.scene.add(ped);
      this.menuParts.push({ root: ped });
    }
    this.menuDuck = add(new Character(this.scene, models.duck, {
      pos: new THREE.Vector3(-9, 2, -7), tint: 0xffcc33, emissiveIntensity: 0.5,
    }));
    this.menuMichelle = add(new Character(this.scene, models.michelle, {
      pos: new THREE.Vector3(9, 2, -7), tint: 0xaa44ff, emissiveIntensity: 0.4,
    }));
    this.menuMichelle.play('sambadance');
    this.menuMichelle.setLoop('sambadance');
    this.menuMichelle.root.scale.setScalar(0.9);

    this.menuParrot = add(new Character(this.scene, models.parrot, {
      pos: new THREE.Vector3(0, 6, 0), tint: 0xff4444, emissiveIntensity: 0.6,
    }));
    this.menuParrot.root.scale.setScalar(1.8);
    this.menuParrot.play('parrot_a_');
    this.menuParrot.setLoop('parrot_a_');

    this.menuFlamingo = add(new Character(this.scene, models.flamingo, {
      pos: new THREE.Vector3(0, 4, 0), tint: 0xff77aa, emissiveIntensity: 0.5,
    }));
    this.menuFlamingo.root.scale.setScalar(1.5);
    this.menuFlamingo.play('flamingo_flya_');
    this.menuFlamingo.setLoop('flamingo_flya_');
  }

  clearMenuScene() {
    for (const c of this.menuParts) {
      this.scene.remove(c.root);
    }
    this.menuParts = [];
  }

  updateMenu(dt) {
    this.menuT += dt;
    if (this.menuRobot) {
      this.menuRobot.update(dt);
      const cycle = this.menuT % 8;
      if (cycle < 0.6) this.menuRobot.play('wave', 0.1, true);
      else if (cycle > 7.4) this.menuRobot.play('thumbsup', 0.1, true);
      else this.menuRobot.play('idle');
    }
    if (this.menuParrot) {
      const a = this.menuT * 0.5;
      this.menuParrot.root.position.set(Math.cos(a) * 9, 5.5 + Math.sin(this.menuT * 2) * 1, Math.sin(a) * 9);
      this.menuParrot.root.rotation.y = -a + Math.PI / 2;
      this.menuParrot.update(dt);
    }
    if (this.menuFlamingo) {
      const b = -this.menuT * 0.35 + 2;
      this.menuFlamingo.root.position.set(Math.cos(b) * 15, 3.5 + Math.sin(this.menuT * 1.5) * 0.8, Math.sin(b) * 15);
      this.menuFlamingo.update(dt);
    }
    if (this.menuMichelle) this.menuMichelle.update(dt);
    if (this.menuDuck) this.menuDuck.update(dt);

    const ca = this.menuT * 0.12;
    this.camera.position.set(Math.cos(ca) * 22, 11, Math.sin(ca) * 22);
    this.camera.lookAt(0, 2.5, 0);
  }

  // ---------- game flow ----------
  initAudioOnce() {
    if (this._audioInited) return;
    this._audioInited = true;
    this.audio.init();
    this.audio.resume();
    this.audio.loadAll().then(() => {
      if (this.state === 'menu') this.audio.setMusic('menu');
      else this.audio.setMusic(this.audio.musicMode);
    });
  }

  startGame() {
    this.initAudioOnce();
    this.clearMenuScene();
    this.clearEntities();
    this.fx.clear();
    this.player = new Player(this, new THREE.Vector3(0, 0, 0));
    this.waveM = new WaveManager(this);
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboT = 0;
    this.state = 'playing';
    this.hud.startGame();
    try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ }
    this.waveM.start(1);
  }

  clearEntities() {
    for (const e of this.enemies) this.scene.remove(e.root);
    for (const b of this.bullets) this.scene.remove(b.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.pause(true);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.pause(false);
    try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ }
  }

  openShop() {
    if (this.state !== 'playing') return;
    this.state = 'shop';
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    const cards = rollShop(this);
    this.hud.showShop(cards, (card) => this.applyCard(card), () => this.closeShop());
  }

  applyCard(card) {
    if (!card) { this.closeShop(); return; }
    if (card.weapon) {
      this.player.weapons.unlock(card.id);
      this.player.weapons.switch(card.id);
    } else {
      card.apply(this.player);
    }
    this.audio.buy();
    this.closeShop();
  }

  closeShop() {
    this.state = 'playing';
    this.hud.hideShop();
    this.waveM.start(this.waveM.wave + 1);
  }

  onPlayerDeath() {
    if (this.state === 'dying' || this.state === 'gameover') return;
    this.state = 'dying';
    this.dyingT = 1.8;
    this.audio.gameOver();
    this.fx.explosion(this.player.pos.clone().setY(1.4), 9, 0x66f0ff);
    this.fx.debris(this.player.pos.clone().setY(1), 0x66f0ff);
    this.fx.shake(0.8);
    this.slowmo(0.35, 2.5);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  slowmo(scale, dur) {
    this.slowmoScale = scale;
    this.slowmoT = dur;
  }

  onEnemyKilled(e) {
    this.kills++;
    this.combo++;
    this.comboT = 3;
    const mult = Math.min(5, 1 + Math.floor(this.combo / 5) * 0.5);
    const gain = Math.round(e.type.score * (1 + 0.1 * (this.waveM.wave - 1)) * mult);
    this.score += gain;
    this.fx.number(e.root.position.clone().setY(e.eyeY + 1.2), '+' + gain, '#7fffd4');
    if (this.player.stats.lifesteal > 0) {
      this.player.heal(this.player.stats.maxHp * this.player.stats.lifesteal);
    }
    if (chance(e.type.drop)) this.spawnPickup('health', e.root.position.clone());
    if (e.type.boss) {
      this.slowmo(0.4, 1.2);
      this.fx.shake(0.6);
    }
  }

  // ---------- spawning ----------
  spawnEnemy(type, pos) {
    this.enemies.push(new Enemy(this, type, pos, this.waveM.wave));
  }

  randomSpawnPos() {
    const th = rand(0, Math.PI * 2);
    const rad = this.world.radius - 6;
    return new THREE.Vector3(Math.cos(th) * rad, 0, Math.sin(th) * rad);
  }

  spawnPickup(type, pos) {
    const color = type === 'health' ? 0x22ff66 : 0xffcc33;
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0x062014, emissive: color, emissiveIntensity: 1.2, roughness: 0.3 })
    );
    mesh.position.copy(pos).setY(1.2);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.fx.glow, color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.setScalar(2.2);
    mesh.add(sprite);
    this.scene.add(mesh);
    this.pickups.push({ mesh, type, bobT: rand(0, 6) });
  }

  spawnBullet(pos, dir, w) {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: w.color })
    );
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);
    this.bullets.push({
      mesh, vel: dir.clone().multiplyScalar(42), life: 4,
      dmg: w.dmg, radius: w.radius, color: w.color,
    });
  }

  explodeAOE(pos, radius, dmg) {
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const d = distXZ(pos.x, pos.z, e.root.position.x, e.root.position.z);
      if (d < radius) e.takeDamage(dmg * (1 - (d / radius) * 0.6));
    }
  }

  rayEnemies(origin, dir, maxDist) {
    this._ray.set(origin, dir);
    this._ray.far = maxDist;
    const roots = this.enemies.filter((e) => e.state !== 'dead').map((e) => e.root);
    const hits = this._ray.intersectObjects(roots, true);
    return hits
      .map((h) => ({ point: h.point.clone(), enemy: h.object.userData.enemy }))
      .filter((h) => h.enemy && h.enemy.state !== 'dead');
  }

  collide(x, z, r) {
    let nx = x, nz = z;
    for (const p of this.world.props) {
      const d = Math.hypot(nx - p.x, nz - p.z);
      const min = p.r + r;
      if (d < min && d > 0.001) {
        const k = min - d;
        nx += ((nx - p.x) / d) * k;
        nz += ((nz - p.z) / d) * k;
      }
    }
    const dist = Math.hypot(nx, nz);
    const max = this.world.radius - r;
    if (dist > max && dist > 0.001) {
      nx = (nx / dist) * max;
      nz = (nz / dist) * max;
    }
    return { x: nx, z: nz };
  }

  // ---------- update ----------
  updatePlaying(dt) {
    this.input.fire = this.firing;
    this.wave = this.waveM.wave;
    this.player.update(dt, this.input);
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.waveM.update(dt);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateCamera(dt);
  }

  updateDying(dt) {
    this.dyingT -= dt;
    this.player.update(dt, this.input);
    this.updateCamera(dt);
    if (this.dyingT <= 0) {
      this.state = 'gameover';
      this.audio.setMusic('menu');
      this.hud.showGameOver({ wave: this.waveM.wave, kills: this.kills, score: this.score });
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      // steer toward nearest enemy
      let best = null, bestD = 30;
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        const d = distXZ(b.mesh.position.x, b.mesh.position.z, e.root.position.x, e.root.position.z);
        if (d < bestD) { best = e; bestD = d; }
      }
      if (best) {
        const to = best.root.position.clone().sub(b.mesh.position);
        to.y = 0;
        const tl = to.length();
        if (tl > 0.001) {
          to.multiplyScalar(1 / tl);
          const cur = b.vel.clone();
          cur.y = 0;
          const cl = cur.length();
          if (cl > 0.001) {
            cur.multiplyScalar(1 / cl);
            if (cur.dot(to) > 0.2) {
              cur.lerp(to, Math.min(1, dt * 3));
              cur.normalize();
              b.vel.x = cur.x * 42;
              b.vel.z = cur.z * 42;
            }
          }
        }
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt * 10;
      if (chance(dt * 24)) this.fx.sparks(b.mesh.position.clone(), 2, b.color, 3);

      let hit = false;
      if (b.mesh.position.y < 0.4) hit = true;
      if (b.life <= 0) hit = true;
      if (!hit) {
        for (const e of this.enemies) {
          if (e.state === 'dead') continue;
          if (distXZ(b.mesh.position.x, b.mesh.position.z, e.root.position.x, e.root.position.z) < e.hitR + 0.5 &&
              Math.abs(b.mesh.position.y - e.root.position.y) < 3.5) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        this.fx.explosion(b.mesh.position, b.radius + 1.5, b.color);
        this.fx.shake(0.4);
        this.audio.explosion(true);
        this.explodeAOE(b.mesh.position, b.radius, b.dmg);
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.bullets.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.bobT += dt;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 1.2 + Math.sin(p.bobT * 2) * 0.3;
      const d = distXZ(p.mesh.position.x, p.mesh.position.z, this.player.pos.x, this.player.pos.z);
      if (d < 4.5) {
        const dx = this.player.pos.x - p.mesh.position.x;
        const dz = this.player.pos.z - p.mesh.position.z;
        const dl = Math.hypot(dx, dz) || 1;
        p.mesh.position.x += (dx / dl) * dt * 10;
        p.mesh.position.z += (dz / dl) * dt * 10;
      }
      if (d < 1.6) {
        if (p.type === 'health') {
          this.player.heal(35);
          this.fx.number(p.mesh.position.clone(), '+35 HP', '#22ff66');
        }
        this.audio.pickup();
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  updateCamera(dt) {
    const p = this.player.pos;
    const dist = 7.2;
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.camera.position.copy(p).add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(dir, -dist);
    this.camera.position.add(this.fx.shakeOffset);
    this.camera.lookAt(p.x, p.y + 2.2, p.z);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- input ----------
  bindInput() {
    const setKey = (code, v) => {
      switch (code) {
        case 'KeyW': this.input.forward = v; break;
        case 'KeyS': this.input.back = v; break;
        case 'KeyA': this.input.left = v; break;
        case 'KeyD': this.input.right = v; break;
        case 'KeyR': this.input.reload = v; break;
      }
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      setKey(e.code, true);
      if (e.code === 'Space') { this.input.dash = true; e.preventDefault(); }
      if (this.player) {
        if (e.code === 'Digit1') this.player.weapons.switch('blaster');
        if (e.code === 'Digit2') this.player.weapons.switch('scatter');
        if (e.code === 'Digit3') this.player.weapons.switch('rockets');
        if (e.code === 'Digit4') this.player.weapons.switch('minigun');
      }
      if (e.code === 'KeyP') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resumeGame();
      }
    });
    window.addEventListener('keyup', (e) => setKey(e.code, false));

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.state === 'playing') {
        this.firing = true;
        if (!document.pointerLockElement) {
          try { this.canvas.requestPointerLock(); } catch (err) { /* ignore */ }
        }
      }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.firing = false; });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && this.state === 'playing') {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = clamp(this.pitch - e.movementY * 0.0022, -0.5, 0.35);
      }
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'playing' || !this.player) return;
      this.player.weapons.cycle(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.state === 'playing') this.pause();
    });
    // one-time audio unlock on first gesture (menu music)
    document.addEventListener('pointerdown', () => this.initAudioOnce(), { once: true });

    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('go-restart').addEventListener('click', () => this.startGame());
    document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());
    const creditsBtn = document.getElementById('credits-btn');
    if (creditsBtn) {
      creditsBtn.addEventListener('click', () => this.hud.el.credits.classList.toggle('hidden'));
    }
  }

  // ---------- main loop ----------
  loop() {
    requestAnimationFrame(this.loop);
    const dtRaw = Math.min(this.clock.getDelta(), 0.05);

    if (this.slowmoT > 0) {
      this.slowmoT -= dtRaw;
      this.timeScale = lerp(this.timeScale, this.slowmoScale, Math.min(1, dtRaw * 4));
      if (this.slowmoT <= 0) this.timeScale = 1;
    } else {
      this.timeScale = lerp(this.timeScale, 1, Math.min(1, dtRaw * 5));
    }
    const dt = dtRaw * this.timeScale;

    switch (this.state) {
      case 'menu': this.updateMenu(dt); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'dying': this.updateDying(dtRaw); break;
      default: break;
    }
    this.fx.update(dtRaw);
    this.hud.update(this);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game;
  game.boot();
});
