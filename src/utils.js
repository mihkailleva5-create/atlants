import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const distXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

export function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Procedural neon grid texture for the arena floor
export function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0d18';
  g.fillRect(0, 0, 512, 512);
  // subtle radial glow in center
  const rg = g.createRadialGradient(256, 256, 40, 256, 256, 320);
  rg.addColorStop(0, 'rgba(20,60,90,0.5)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(50,190,255,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i <= 16; i++) {
    const p = i * 32;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
  }
  g.strokeStyle = 'rgba(120,230,255,0.55)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
  g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.anisotropy = 4;
  return t;
}

// Soft radial glow texture for sprites
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
