import * as THREE from 'three';
import { rand, clamp, glowTexture } from './utils.js';

// All temporary visual effects. Everything is fade-lifetime based and
// auto-removed, so the scene never leaks.
export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.fades = [];
    this.shakeAmt = 0;
    this.shakeOffset = new THREE.Vector3();
    this._glow = null;
    this._tmp = new THREE.Vector3();
  }

  get glow() {
    if (!this._glow) this._glow = glowTexture();
    return this._glow;
  }

  addFade(obj, life, update, dom = false) {
    const f = { obj, life, max: life, update, dom };
    this.fades.push(f);
    return f;
  }

  update(dt) {
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const f = this.fades[i];
      f.life -= dt;
      if (f.update) f.update(dt, f);
      if (f.life <= 0) {
        if (f.dom) f.obj.remove();
        else {
          this.scene.remove(f.obj);
          if (f.obj.geometry) f.obj.geometry.dispose();
          const m = f.obj.material;
          if (m) { if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose(); }
        }
        this.fades.splice(i, 1);
      }
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.6);
    this.shakeOffset.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.shakeAmt * 0.4);
  }

  clear() {
    for (const f of this.fades) {
      if (f.dom) f.obj.remove();
      else this.scene.remove(f.obj);
    }
    this.fades = [];
    this.shakeAmt = 0;
  }

  shake(amt) { this.shakeAmt = Math.min(1.3, this.shakeAmt + amt); }

  // ---------- particles & props ----------

  muzzle(pos, dir, color) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.copy(pos).addScaledVector(dir, 0.4);
    sp.scale.setScalar(1.1);
    this.scene.add(sp);
    const light = new THREE.PointLight(color, 12, 10, 2);
    light.position.copy(sp.position);
    this.scene.add(light);
    this.addFade(sp, 0.07, (dt, f) => {
      const k = f.life / f.max;
      sp.material.opacity = 0.95 * k;
      sp.scale.setScalar(1.1 * (1 + (1 - k) * 1.2));
      light.intensity = 12 * k;
    });
  }

  tracer(a, b, color) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.1) return;
    const geo = new THREE.CylinderGeometry(0.02, 0.02, len, 5);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(m);
    this.addFade(m, 0.06, (dt, f) => { mat.opacity = 0.9 * (f.life / f.max); });
  }

  sparks(pos, count = 10, color = 0xffcc66, speed = 8) {
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      const v = new THREE.Vector3(rand(-1, 1), rand(0, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.3, speed));
      vel.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.addFade(pts, 0.5, (dt, f) => {
      const posAttr = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        vel[i].y -= 9 * dt;
        posAttr.array[i * 3] += vel[i].x * dt;
        posAttr.array[i * 3 + 1] += vel[i].y * dt;
        posAttr.array[i * 3 + 2] += vel[i].z * dt;
      }
      posAttr.needsUpdate = true;
      mat.opacity = clamp(f.life / f.max, 0, 1);
    });
  }

  explosion(pos, radius = 5, color = 0xff7733) {
    const light = new THREE.PointLight(color, 25, radius * 4, 2);
    light.position.copy(pos);
    this.scene.add(light);
    this.addFade(light, 0.4, (dt, f) => { light.intensity = 25 * (f.life / f.max); });

    const s = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    s.position.copy(pos);
    this.scene.add(s);
    this.addFade(s, 0.4, (dt, f) => {
      const k = 1 - f.life / f.max;
      s.scale.setScalar(radius * (0.25 + k * 1.3));
      s.material.opacity = 0.8 * (1 - k);
    });

    this.sparks(pos, Math.min(26, 10 + radius * 3), color, radius * 3);

    // ground shockwave ring
    if (pos.y < 3) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.12, 6, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.position.set(pos.x, 0.15, pos.z);
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
      this.addFade(ring, 0.45, (dt, f) => {
        const k = 1 - f.life / f.max;
        ring.scale.setScalar(radius * (0.3 + k * 1.4));
        ring.material.opacity = 0.8 * (1 - k);
      });
    }
    this.shake(radius * 0.07);
  }

  debris(pos, color) {
    const n = 8;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const r = rand(0.12, 0.4);
      let geo;
      const kind = Math.floor(rand(0, 3));
      if (kind === 0) geo = new THREE.BoxGeometry(r, r, r);
      else if (kind === 1) geo = new THREE.SphereGeometry(r * 0.7, 6, 6);
      else geo = new THREE.CylinderGeometry(r * 0.5, r * 0.5, r * 1.6, 6);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.6 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos).add(new THREE.Vector3(rand(-0.6, 0.6), rand(0, 1.2), rand(-0.6, 0.6)));
      const vel = new THREE.Vector3(rand(-1, 1), rand(2, 7), rand(-1, 1)).multiplyScalar(rand(4, 10));
      const ang = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(rand(4, 10));
      this.scene.add(m);
      parts.push({ m, vel, ang });
      this.addFade(m, 1.4, (dt, f) => {
        vel.y -= 14 * dt;
        m.position.addScaledVector(vel, dt);
        m.rotation.x += ang.x * dt; m.rotation.y += ang.y * dt; m.rotation.z += ang.z * dt;
        mat.opacity = clamp(f.life / f.max, 0, 1); mat.transparent = true;
        if (m.position.y < 0.2) { m.position.y = 0.2; vel.set(0, 0, 0); ang.multiplyScalar(0.9); }
      });
    }
  }

  ring(pos, radius, color, life = 0.7) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.15, 6, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.addFade(ring, life, (dt, f) => {
      const k = 1 - f.life / f.max;
      ring.scale.setScalar(radius * (0.2 + k));
      ring.material.opacity = 0.9 * (1 - k);
    });
  }

  trail(pos) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color: 0x66f0ff, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.copy(pos).setY(1.2);
    sp.scale.setScalar(1.3);
    this.scene.add(sp);
    this.addFade(sp, 0.3, (dt, f) => {
      const k = f.life / f.max;
      sp.material.opacity = 0.7 * k;
      sp.scale.setScalar(1.3 * (1 + (1 - k) * 0.6));
    });
  }

  dashBurst(pos) {
    this.ring(pos, 3.2, 0x66f0ff, 0.5);
    this.sparks(pos.clone().setY(1), 14, 0x66f0ff, 9);
  }

  portal(pos, color) {
    this.ring(pos.clone().setY(0.1), 2.4, color, 0.55);
    this.sparks(pos.clone().setY(1), 8, color, 5);
  }

  // ---------- screen-space ----------

  number(worldPos, text, color) {
    const el = document.createElement('div');
    el.className = 'dmg-num';
    el.textContent = text;
    el.style.color = color;
    const layer = document.getElementById('damage-numbers');
    if (!layer) return;
    layer.appendChild(el);
    this.addFade(el, 0.9, (dt, f) => {
      const v = worldPos.clone().project(this.camera);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight - (1 - f.life / f.max) * 70;
      el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      el.style.opacity = Math.min(1, (f.life / f.max) * 1.6);
    }, true);
  }

  hitMarker(crit) {
    const el = document.getElementById('hitmarker');
    if (!el) return;
    el.className = 'hitmarker show' + (crit ? ' crit' : '');
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => { el.className = 'hitmarker'; }, 120);
  }
}


