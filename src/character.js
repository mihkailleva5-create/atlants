import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { TAU, lerpAngle } from './utils.js';

// A cloneable animated character built from a loaded GLB.
// Uses SkeletonUtils.clone so every instance gets its own skeleton
// (plain .clone() would share bones between all copies).
export class Character {
  constructor(scene, gltf, opts = {}) {
    this.root = clone(gltf.scene);
    if (opts.scale) this.root.scale.setScalar(opts.scale);
    this.root.position.copy(opts.pos || new THREE.Vector3());

    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = new Map();
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      this.actions.set(clip.name.toLowerCase(), a);
    }

    this.baseEmissive = opts.emissiveIntensity ?? 0.35;
    this.tint = opts.tint ?? 0x000000;
    if (opts.tint != null) this.applyTint(this.tint, this.baseEmissive);

    this.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    scene.add(this.root);
    this.current = null;
    this.rotY = 0;
    this.dead = false;
  }

  applyTint(hex, intensity) {
    this.tint = hex;
    this.baseEmissive = intensity;
    this.root.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material.clone ? o.material.clone() : o.material;
        if (!m.emissive) m.emissive = new THREE.Color(0x000000);
        m.emissive.setHex(hex);
        m.emissiveIntensity = intensity;
        o.material = m;
      }
    });
  }

  find(...names) {
    for (const n of names) {
      const a = this.actions.get(n.toLowerCase());
      if (a) return a;
    }
    return null;
  }

  play(name, fade = 0.12, once = false) {
    const a = typeof name === 'string' ? this.find(name) : name;
    if (!a) return;
    if (this.current && this.current !== a) {
      try { this.current.fadeOut(fade); } catch (e) { /* ignore */ }
    }
    a.loop = !once;
    a.clampWhenFinished = once;
    a.reset();
    try { a.fadeIn(fade).play(); } catch (e) { a.play(); }
    this.current = a;
  }

  setLoop(name) {
    const a = this.find(name);
    if (a) { a.loop = true; a.clampWhenFinished = false; a.play(); }
  }

  setEmissive(k) {
    this.root.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) {
        o.material.emissiveIntensity = (this.baseEmissive || 0) * k;
      }
    });
  }

  faceToAngle(angle, dt, speed = 12) {
    this.rotY = lerpAngle(this.rotY, angle, Math.min(1, speed * dt));
    this.root.rotation.y = this.rotY;
  }

  setVisible(v) { this.root.visible = v; }

  update(dt) { this.mixer.update(dt); }
}
