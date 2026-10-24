import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const models = {
  robot: null,
  soldier: null,
  xbot: null,
  michelle: null,
  duck: null,
  parrot: null,
  flamingo: null,
};

const loader = new GLTFLoader();

const ENTRIES = {
  robot: 'models/RobotExpressive.glb',
  soldier: 'models/Soldier.glb',
  xbot: 'models/Xbot.glb',
  michelle: 'models/Michelle.glb',
  duck: 'models/duck.glb',
  parrot: 'models/Parrot.glb',
  flamingo: 'models/Flamingo.glb',
};

export function loadModels(onProgress) {
  const keys = Object.keys(ENTRIES);
  let done = 0;
  const loadOne = (k) => new Promise((res) => {
    loader.load(
      ENTRIES[k],
      (g) => { models[k] = g; done++; onProgress && onProgress(done / keys.length); res(); },
      undefined,
      (err) => { console.error('Model load failed:', k, err); res(); }
    );
  });
  return Promise.all(keys.map(loadOne)).then(() => models);
}
