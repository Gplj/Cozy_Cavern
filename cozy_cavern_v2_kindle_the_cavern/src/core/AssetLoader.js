import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSETS } from './assets.js';

export class AssetLoader {
  constructor(onProgress = () => {}) {
    this.loader = new GLTFLoader();
    this.onProgress = onProgress;
    this.assets = new Map();
  }

  async loadAll() {
    const entries = Object.entries(ASSETS);
    let done = 0;
    await Promise.all(entries.map(async ([key, url]) => {
      const gltf = await this.loader.loadAsync(url);
      this.assets.set(key, gltf);
      done += 1;
      this.onProgress(done / entries.length, key);
    }));
    return this;
  }

  gltf(key) {
    const value = this.assets.get(key);
    if (!value) throw new Error(`Asset not loaded: ${key}`);
    return value;
  }

  scene(key) { return this.gltf(key).scene; }
}
