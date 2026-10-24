// 3D Atlantis island: flooded world, buildings on tiers, real-time day/night.
// Torches glow at night; after reactor unlock, lamps replace them.

import * as THREE from 'three';
import { CHARACTERS, buildAvatar } from './characters.js';
import { gridTexture } from './utils.js';

// day/night phase from real-time hour (0-24)
export function dayPhase(hour) {
  if (hour >= 6 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

const SKY = {
  morning: { top: 0x2a4a8a, mid: 0x6a8ab0, bottom: 0xffd9a0, sun: 0xffe8c0, ambient: 0.6, sunInt: 0.9 },
  day: { top: 0x1a3a7a, mid: 0x4a7ab0, bottom: 0x9ad0ff, sun: 0xffffff, ambient: 0.85, sunInt: 1.1 },
  evening: { top: 0x3a1a4a, mid: 0x8a3a5a, bottom: 0xff8a4a, sun: 0xff9a5a, ambient: 0.5, sunInt: 0.7 },
  night: { top: 0x05060f, mid: 0x101830, bottom: 0x1a2448, sun: 0x6a8aff, ambient: 0.25, sunInt: 0.2 },
};

// building placement on the island (x, z, tier)
const BUILDING_SLOTS = [
  { id: 'theo', x: 0, z: 6, tier: 1 },
  { id: 'carrion', x: -7, z: 3, tier: 2 },
  { id: 'erri', x: 7, z: 3, tier: 2 },
  { id: 'born', x: -9, z: -4, tier: 2 },
  { id: 'yarilyk', x: 4, z: -6, tier: 3 },
  { id: 'tramplin', x: -3, z: -8, tier: 3 },
  { id: 'phantom', x: 9, z: -5, tier: 3 },
  { id: 'ryazha', x: -6, z: -9, tier: 3 },
  { id: 'kompik', x: 0, z: -10, tier: 3 },
  { id: 'kemet', x: -4, z: 8, tier: 4 },
  { id: 'scaler', x: 5, z: 8, tier: 4 },
  { id: 'fraegid', x: -8, z: 8, tier: 4 },
  { id: 'misha', x: 8, z: 8, tier: 4 },
  { id: 'lauf', x: 0, z: -13, tier: 5 },
];

// procedural building structures
function makeBuildingMesh(def) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.2, emissive: def.color, emissiveIntensity: 0.08 });
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.5, metalness: 0.3 });

  let h = 2, w = 2, d = 2;
  if (def.id === 'theo') { w = 3; h = 2.5; }
  else if (def.id === 'carrion') { w = 3; h = 3.5; }
  else if (def.id === 'yarilyk') { w = 2.5; h = 2; }
  else if (def.id === 'kemet') { w = 2.5; h = 3; }
  else if (def.id === 'tramplin') { w = 2.5; h = 3; }
  else if (def.id === 'phantom') { w = 3; h = 3; }
  else if (def.id === 'fraegid') { w = 2.5; h = 2.5; }
  else if (def.id === 'misha') { w = 2; h = 1.8; }
  else if (def.id === 'lauf') { w = 1.8; h = 1.8; }
  else if (def.id === 'erri') { w = 2.5; h = 2; }
  else if (def.id === 'born') { w = 2.5; h = 1.5; }
  else if (def.id === 'kompik') { w = 2; h = 2; }
  else if (def.id === 'scaler') { w = 2.5; h = 2; }
  else if (def.id === 'ryazha') { w = 2.5; h = 2.5; }

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h / 2;
  group.add(body);

  // roof / feature per building
  if (def.id === 'carrion') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, 1.5, 4), accentMat);
    roof.position.y = h + 0.75; roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.02), new THREE.MeshStandardMaterial({ color: 0xff2233 }));
    flag.position.y = h + 2.4; group.add(flag);
  } else if (def.id === 'yarilyk') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 1.2, 6), accentMat);
    roof.position.y = h + 0.6; group.add(roof);
  } else if (def.id === 'theo') {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), accentMat);
    antenna.position.y = h + 1; group.add(antenna);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
    dish.position.y = h + 1.9; dish.rotation.x = Math.PI; group.add(dish);
  } else if (def.id === 'kemet') {
    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 12), new THREE.MeshStandardMaterial({ color: 0x220033, emissive: 0x9933ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 }));
    reactor.position.y = h + 0.75; group.add(reactor);
  } else if (def.id === 'tramplin') {
    for (let i = 0; i < 4; i++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.6), accentMat);
      book.position.set(-0.5 + i * 0.35, h + 0.25, 0.3);
      book.rotation.y = i * 0.3;
      group.add(book);
    }
  } else if (def.id === 'phantom') {
    // water wheels
    for (let i = 0; i < 2; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.15, 12), accentMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(i === 0 ? -1.2 : 1.2, 1.5, 0);
      group.add(wheel);
      group.userData.wheels = group.userData.wheels || [];
      group.userData.wheels.push(wheel);
    }
  } else if (def.id === 'fraegid') {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    door.position.set(0, 0.6, d / 2 + 0.05); group.add(door);
  } else if (def.id === 'misha') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0xff88aa }));
    roof.position.y = h + 0.4; roof.rotation.y = Math.PI / 4; group.add(roof);
  } else if (def.id === 'scaler') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.6, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
    dome.position.y = h; group.add(dome);
  } else if (def.id === 'erri') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.05), accentMat);
    sign.position.set(0, h + 0.4, d / 2 + 0.1); group.add(sign);
  } else if (def.id === 'ryazha') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xffaa22 }));
    sign.position.set(0, h + 0.5, d / 2 + 0.1); group.add(sign);
  } else if (def.id === 'kompik') {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x22ff22, emissiveIntensity: 0.5 }));
    monitor.position.y = h + 0.5; group.add(monitor);
  } else if (def.id === 'lauf') {
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.05), new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x66aaff, emissiveIntensity: 0.4 }));
    screen.position.set(0, h + 0.4, d / 2 + 0.05); group.add(screen);
  } else if (def.id === 'born') {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.8, 0.1), accentMat);
    fence.position.y = 0.4; group.add(fence);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export function buildIsland(scene, state, renderer) {
  // sky dome
  const skyGeo = new THREE.SphereGeometry(250, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x1a3a7a) }, mid: { value: new THREE.Color(0x4a7ab0) }, bottom: { value: new THREE.Color(0x9ad0ff) }, glow: { value: new THREE.Color(0x4a7ab0) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 top, mid, bottom, glow;
      varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 col = mix(bottom, mid, smoothstep(-0.5, 0.05, h));
        col = mix(col, top, smoothstep(0.0, 0.75, h));
        col += glow * exp(-abs(h) * 4.0) * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // stars
  const starPos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const r = 200, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.9 + 0.05);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x99bbff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);

  // island disc (partially submerged)
  const tex = gridTexture();
  const islandGeo = new THREE.CylinderGeometry(22, 24, 2, 48);
  const island = new THREE.Mesh(islandGeo, new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9, metalness: 0.1 }));
  island.position.y = -0.5;
  island.receiveShadow = true;
  scene.add(island);

  // flooded lower ring (water around island)
  const waterGeo = new THREE.CircleGeometry(60, 48);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a4a7a, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85, emissive: 0x0a2a4a, emissiveIntensity: 0.3 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.4;
  water.receiveShadow = true;
  scene.add(water);

  // flooded ruins (broken pillars)
  for (let i = 0; i < 8; i++) {
    const th = Math.random() * Math.PI * 2;
    const rad = 26 + Math.random() * 10;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3 + Math.random() * 3, 8), new THREE.MeshStandardMaterial({ color: 0x4a5a5a, roughness: 0.9 }));
    pillar.position.set(Math.cos(th) * rad, 1, Math.sin(th) * rad);
    pillar.rotation.z = (Math.random() - 0.5) * 0.3;
    scene.add(pillar);
  }

  // lights
  const hemi = new THREE.HemisphereLight(0x8899bb, 0x223322, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  scene.add(sun);

  // buildings
  const buildings = [];
  const torches = [];
  for (const slot of BUILDING_SLOTS) {
    const def = CHARACTERS[slot.id];
    const b = makeBuildingMesh(def);
    b.position.set(slot.x, 0, slot.z);
    b.userData.building = slot.id;
    b.userData.def = def;
    scene.add(b);
    buildings.push(b);

    // avatar in front
    const avatar = buildAvatar(scene, def, { pos: new THREE.Vector3(slot.x, 0, slot.z + 1.5), scale: 0.9 });
    avatar.userData.building = slot.id;
    buildings.push(avatar);

    // torch (warm emissive sphere) — visible at night
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
    torch.position.set(slot.x, 2.2, slot.z + 1.2);
    scene.add(torch);
    torches.push(torch);
  }

  // griffa's secret door (in floor near yarilyk) — unmarked
  const secretDoor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }));
  secretDoor.position.set(4, 0.05, -6.5);
  secretDoor.userData.secret = 'grisha';
  secretDoor.userData.building = 'grisha';
  secretDoor.userData.def = CHARACTERS.grisha;
  scene.add(secretDoor);
  buildings.push(secretDoor);

  // state refs
  const islandState = {
    sky, skyMat, stars, water, sun, hemi, buildings, torches,
    waterMat, secretDoor,
    reactor: state.island.reactor,
  };

  // animation: water bob, wheel spin
  let t = 0;
  const animate = (dt) => {
    t += dt;
    water.position.y = -0.4 + Math.sin(t * 0.5) * 0.05;
    for (const b of buildings) {
      if (b.userData.wheels) for (const w of b.userData.wheels) w.rotation.x += dt * 1.5;
    }
  };

  return { islandState, animate, skyMat, sun, stars, torches, buildings, water, hemi };
}

// update day/night based on real hour
export function updateDayNight(island, hour, reactor) {
  const phase = dayPhase(hour);
  const cfg = SKY[phase];
  island.skyMat.uniforms.top.value.setHex(cfg.top);
  island.skyMat.uniforms.mid.value.setHex(cfg.mid);
  island.skyMat.uniforms.bottom.value.setHex(cfg.bottom);
  island.skyMat.uniforms.glow.value.setHex(cfg.sun);
  island.sun.color.setHex(cfg.sun);
  island.sun.intensity = cfg.sunInt;
  island.hemi.intensity = cfg.ambient;
  // star opacity at night
  island.stars.material.opacity = phase === 'night' ? 0.9 : phase === 'evening' ? 0.3 : 0;
  // sun angle
  const sunAngle = ((hour - 6) / 12) * Math.PI; // 6am -> 18h
  island.sun.position.set(Math.cos(sunAngle) * 40, Math.sin(sunAngle) * 50 + 5, 20);
  // torches vs lamps
  const nightFactor = phase === 'night' ? 1 : phase === 'evening' ? 0.6 : 0.15;
  for (const torch of island.torches) {
    const lamp = reactor;
    torch.material.color.setHex(lamp ? 0x88bbff : 0xffaa44);
    torch.scale.setScalar(lamp ? 0.9 : 1);
    torch.visible = nightFactor > 0.2;
  }
}
