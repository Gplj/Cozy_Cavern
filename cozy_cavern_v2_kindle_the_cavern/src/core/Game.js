import * as THREE from 'three';
import { AssetLoader } from './AssetLoader.js';
import { Input } from './Input.js';
import { Player } from '../player/Player.js';
import { HearthRoom } from '../world/HearthRoom.js';
import { createPostProcessing } from '../effects/PostProcessing.js';
import { GameState } from '../systems/GameState.js';
import { GameplaySystem } from '../systems/GameplaySystem.js';
import { HUD } from '../ui/HUD.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.time = 0;
    // CAMERA DECISION (patch 0.6): Cozy Cavern deliberately uses a fixed-angle
    // follow camera. The original game used a static viewpoint, and playtesting
    // showed free/MMO orbit controls added confusion without improving the core loop.
    // Keep yaw/pitch/distance centralized here so a future project can swap in an
    // OrbitCamera/MMOCamera strategy without coupling mouse-look back into Player.
    this.cameraYaw = 0.1;
    this.cameraPitch = 0.69;
    this.cameraDistance = 7.6;
    this.cameraTarget = new THREE.Vector3();
    this.cameraDesired = new THREE.Vector3();
  }

  async start() {
    this.renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b0d);
    this.scene.fog = new THREE.FogExp2(0x0a0d10, 0.030);

    this.camera = new THREE.PerspectiveCamera(46, innerWidth/innerHeight, 0.08, 80);
    this.camera.position.set(5,5,7);

    this.input = new Input(this.renderer.domElement);
    this.addGlobalLighting();

    const text = document.querySelector('#loadingText');
    const bar = document.querySelector('#loadingBar');
    this.assets = new AssetLoader((p, key) => {
      bar.style.width = `${Math.round(p*100)}%`;
      text.textContent = `Loading ${key.replace(/[A-Z]/g, m => ` ${m.toLowerCase()}`)}…`;
    });
    await this.assets.loadAll();

    this.room = new HearthRoom(this.scene, this.assets);
    this.player = new Player(this.assets.gltf('adventurer'), this.input, document.querySelector('#animDebug'));
    this.player.teleport(this.room.spawnPoint);
    this.scene.add(this.player.root);

    // No invisible player light: the explorer should be lit by the cavern itself.
    // A carried lantern can reintroduce a player-bound light later as an explicit mechanic.

    this.state = new GameState();
    this.hud = new HUD();
    this.gameplay = new GameplaySystem({ input:this.input, player:this.player, world:this.room, state:this.state, hud:this.hud });

    this.postProcessing = createPostProcessing(this.renderer, this.scene, this.camera);

    document.querySelector('#loading').classList.add('hidden');
    document.querySelector('#hud').classList.remove('hidden');

    addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  addGlobalLighting() {
    const hemi = new THREE.HemisphereLight(0x89a9c4, 0x18120e, 0.74);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x9bbde2, 1.25);
    moon.position.set(-5, 9, 5);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1536,1536);
    moon.shadow.camera.left = -8; moon.shadow.camera.right = 8;
    moon.shadow.camera.top = 16; moon.shadow.camera.bottom = -8;
    moon.shadow.camera.near = .5; moon.shadow.camera.far = 32;
    this.scene.add(moon);
    const fill = new THREE.DirectionalLight(0x5b74a7, .38);
    fill.position.set(6,4,5);
    this.scene.add(fill);
  }

  updateCameraInput() {
    // Fixed-angle follow camera: mouse movement never changes yaw or pitch.
    // Wheel zoom remains available so players can choose atmosphere vs. overview.
    if (this.input.wheel) this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + this.input.wheel*.55, 5.0, 11.5);
  }

  updateCameraTransform(dt) {
    this.cameraTarget.copy(this.player.root.position).add(new THREE.Vector3(0, .85, 0));
    const cp = Math.cos(this.cameraPitch), sp = Math.sin(this.cameraPitch);
    this.cameraDesired.set(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * cp * this.cameraDistance,
      this.cameraTarget.y + sp * this.cameraDistance,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * cp * this.cameraDistance
    );
    const k = 1 - Math.exp(-dt * 6.5);
    this.camera.position.lerp(this.cameraDesired, k);
    this.camera.lookAt(this.cameraTarget);
  }

  frame() {
    const dt = Math.min(.05, this.clock.getDelta());
    this.time += dt;

    this.updateCameraInput();
    this.player.update(dt, this.cameraYaw, this.room.collision);
    this.gameplay.update(dt);
    this.room.update(this.time, dt);
    this.updateCameraTransform(dt);
    this.postProcessing.render();
    this.input.endFrame();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w,h,false);
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
    this.postProcessing?.setSize(w,h);
  }
}
