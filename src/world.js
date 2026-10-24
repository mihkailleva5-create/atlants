import * as THREE from 'three';
import { gridTexture, rand } from './utils.js';

// Builds the neon arena: skybox, starfield, grid floor, glowing rim,
// lights and cover props (with circular collision data).
export function buildWorld(scene) {
  scene.fog = new THREE.Fog(0x0a0a18, 65, 170);
  scene.background = new THREE.Color(0x0a0a18);

  // ---- sky gradient shader dome ----
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x05060f) },
      mid: { value: new THREE.Color(0x1a0b33) },
      bottom: { value: new THREE.Color(0x3a1248) },
      glow: { value: new THREE.Color(0x2b4cff) },
    },
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 top, mid, bottom, glow;
      varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 col = mix(bottom, mid, smoothstep(-0.5, 0.05, h));
        col = mix(col, top, smoothstep(0.0, 0.75, h));
        col += glow * exp(-abs(h) * 4.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 24), skyMat);
  scene.add(sky);

  // ---- stars ----
  const N = 900;
  const starPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 200, th = rand(0, Math.PI * 2), ph = Math.acos(rand(-0.15, 1));
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0x99bbff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.85, fog: false,
  }));
  scene.add(stars);

  // ---- grid floor ----
  const tex = gridTexture();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(61, 64),
    new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0x2c5a7a, emissiveIntensity: 0.9,
      roughness: 0.75, metalness: 0.15,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- glowing arena rim ----
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(61.5, 0.5, 8, 80),
    new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: 0x00e5ff, emissiveIntensity: 1.5, roughness: 0.35 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.3;
  scene.add(rim);

  for (let i = 0; i < 26; i++) {
    const th = (i / 26) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 4, 6),
      new THREE.MeshStandardMaterial({ color: 0x08121c, emissive: 0x00b8e6, emissiveIntensity: 0.8, roughness: 0.5, metalness: 0.5 })
    );
    post.position.set(Math.cos(th) * 62, 2, Math.sin(th) * 62);
    scene.add(post);
  }

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x6688cc, 0x080812, 0.7));

  const sun = new THREE.DirectionalLight(0xbfd4ff, 1.15);
  sun.position.set(35, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const p1 = new THREE.PointLight(0x00e5ff, 600, 140, 2);
  p1.position.set(-42, 22, -42);
  scene.add(p1);
  const p2 = new THREE.PointLight(0xff3df0, 500, 140, 2);
  p2.position.set(42, 22, 42);
  scene.add(p2);

  // ---- cover props ----
  const props = [];
  const propMeshes = [];
  const edgeMat = (hex) => new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.9 });

  const defs = [
    { kind: 'crate', r: 1.5 },
    { kind: 'crate', r: 1.8 },
    { kind: 'pillar', r: 1.0 },
    { kind: 'pillar', r: 1.0 },
    { kind: 'barrier', r: 3.4 },
    { kind: 'barrier', r: 3.4 },
    { kind: 'container', r: 2.0 },
    { kind: 'container', r: 2.2 },
    { kind: 'crate', r: 1.6 },
    { kind: 'pillar', r: 1.1 },
    { kind: 'barrier', r: 3.2 },
    { kind: 'container', r: 2.1 },
  ];

  const placed = [];
  for (const def of defs) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const th = rand(0, Math.PI * 2);
      const rad = rand(17, 52);
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      if (Math.hypot(x, z) < 12) continue;
      let ok = true;
      for (const p of placed) {
        if (Math.hypot(x - p.x, z - p.z) < def.r + p.r + 4) { ok = false; break; }
      }
      if (!ok) continue;
      placed.push({ x, z, r: def.r });
      let mesh;
      if (def.kind === 'crate') {
        const s = rand(1.6, 2.4);
        mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: 0x2a3548, roughness: 0.6, metalness: 0.4 }));
        mesh.position.set(x, s / 2, z);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat(0x00e5ff));
        mesh.add(edges);
      } else if (def.kind === 'pillar') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x232c40, roughness: 0.5, metalness: 0.5 }));
        mesh.position.set(x, 2.25, z);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x111824, emissive: 0xff3df0, emissiveIntensity: 1.2 }));
        cap.position.y = 2.55;
        mesh.add(cap);
      } else if (def.kind === 'barrier') {
        const len = rand(5, 7);
        mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a3548, roughness: 0.6, metalness: 0.3 }));
        mesh.position.set(x, 0.7, z);
        mesh.rotation.y = rand(0, Math.PI);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat(0x00e5ff));
        mesh.add(edges);
      } else {
        const s = rand(2.6, 3.4);
        mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), new THREE.MeshStandardMaterial({ color: 0x2c2336, roughness: 0.55, metalness: 0.4 }));
        mesh.position.set(x, s * 0.4, z);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat(0xff3df0));
        mesh.add(edges);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      props.push({ x, z, r: def.r });
      propMeshes.push(mesh);
      break;
    }
  }

  return { props, propMeshes, radius: 59, ground, rim, stars };
}
