import * as THREE from 'three';
import { CollisionWorld } from '../core/CollisionWorld.js';
import { enableBloom } from '../effects/PostProcessing.js';

const MAT = {
  floor: new THREE.MeshStandardMaterial({ color: 0x292725, roughness: 0.96, metalness: 0 }),
  floorCold: new THREE.MeshStandardMaterial({ color: 0x1d252b, roughness: 0.97, metalness: 0 }),
  grout: new THREE.MeshStandardMaterial({ color: 0x111516, roughness: 1 }),
  ember: new THREE.MeshStandardMaterial({ color: 0xff8b24, emissive: 0xff5a10, emissiveIntensity: 4.0, roughness: 0.45 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffb13d, transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending }),
  flameHot: new THREE.MeshBasicMaterial({ color: 0xffe49a, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }),
  ring: new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }),
  mount: new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.82, metalness: 0.38 }),
  brazierStone: new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: .94, metalness: .02 }),
  brazierMetal: new THREE.MeshStandardMaterial({ color: 0x554437, roughness: .62, metalness: .45 }),
  brazierDark: new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 1, metalness: .05 }),
  heartStone: new THREE.MeshStandardMaterial({ color: 0x292b2d, roughness: .92, metalness: .02 })
};

function cloneAsset(loader, key, { position=[0,0,0], rotation=0, scale=1, scaleXYZ=null, mirrorX=false, mirrorZ=false }={}) {
  const obj = loader.scene(key).clone(true);
  obj.position.set(...position);
  obj.rotation.y = rotation;
  if (scaleXYZ) obj.scale.set(...scaleXYZ); else obj.scale.setScalar(scale);
  if (mirrorX) obj.scale.x *= -1;
  if (mirrorZ) obj.scale.z *= -1;
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material = child.material.clone();
        child.material.envMapIntensity = 0.65;
      }
    }
  });
  return obj;
}

function seeded(i) {
  const x = Math.sin(i * 999.1 + 47.7) * 43758.5453;
  return x - Math.floor(x);
}

function distXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export class HearthRoom {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.animated = [];
    this.mineNodes = [];
    this.braziers = [];
    this.heart = null;
    this.collision = new CollisionWorld();
    this.spawnPoint = new THREE.Vector3(0, .01, 1.65);
    this.hearthPoint = new THREE.Vector3(0, 0, -3.45);
    this.hearthLight = null;
    this.hearthGlow = null;
    this.hearthPulse = 0;
    this.celebrate = 0;
    this.heartAwake = false;
    this.build();
  }

  build() {
    this.buildFloor();
    this.buildWalls();
    this.buildHearth();
    this.buildFurniture();
    this.buildCrystals();
    this.buildGreenery();
    this.buildGrotto();
    this.buildDeepCavern();
    this.buildBraziers();
    this.buildHeart();
    this.buildMineNodes();
    this.buildAtmosphere();
    this.buildColliders();
  }

  buildFloor() {
    const base = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 47.0), MAT.grout);
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -0.078, 17.15);
    base.receiveShadow = true;
    this.root.add(base);

    const geo = new THREE.CylinderGeometry(0.58, 0.62, 0.075, 6);
    for (let ix = -6; ix <= 6; ix++) {
      for (let iz = -5; iz <= 40; iz++) {
        const i = (ix + 8) * 43 + (iz + 9);
        if (Math.abs(ix) > 5) continue;
        const mat = (iz >= 5 && !this.heartAwake ? MAT.floorCold : MAT.floor).clone();
        const tile = new THREE.Mesh(geo, mat);
        const jx = (seeded(i) - 0.5) * 0.18;
        const jz = (seeded(i + 1) - 0.5) * 0.18;
        tile.position.set(ix * 1.02 + jx, -0.02, iz * 0.96 + jz);
        tile.scale.set(0.92 + seeded(i + 2) * 0.12, 1, 0.83 + seeded(i + 3) * 0.14);
        tile.rotation.y = seeded(i + 4) * Math.PI;
        const lift = (iz >= 5 ? 0.78 : 0.84) + seeded(i + 5) * 0.16;
        tile.material.color.multiplyScalar(lift);
        tile.receiveShadow = true;
        this.root.add(tile);
      }
    }
  }

  buildWalls() {
    // We only have one wall mesh, so variation has to come from using the *visible*
    // mirror axis plus mild scale/height/offset changes. The previous mirrorZ change
    // was effectively invisible from the room and still read like copied wallpaper.
    const wallPositions = [-4.6, -1.55, 1.55, 4.6];
    wallPositions.forEach((x, i) => {
      const v = seeded(210 + i);
      this.root.add(cloneAsset(this.assets, 'wall', {
        position: [x + (v-.5)*.10, (seeded(220+i)-.5)*.035, -5.1 + (seeded(230+i)-.5)*.06],
        rotation: Math.PI / 2 + (seeded(240+i)-.5)*.025,
        scaleXYZ: [2.05*(.95+seeded(250+i)*.10), 3.25*(.94+seeded(260+i)*.11), 3.0*(.96+seeded(270+i)*.08)],
        mirrorX: i % 2 === 1
      }));
    });

    for (const [sideIndex, x] of [-5.95, 5.95].entries()) {
      [-3.4, -0.7, 2.0].forEach((z, i) => {
        const n = sideIndex * 10 + i;
        this.root.add(cloneAsset(this.assets, 'wall', {
          position: [x + (seeded(300+n)-.5)*.06, (seeded(310+n)-.5)*.04, z + (seeded(320+n)-.5)*.14],
          rotation: (seeded(330+n)-.5)*.022,
          scaleXYZ: [1.85*(.94+seeded(340+n)*.12), 3.05*(.93+seeded(350+n)*.13), 2.7*(.95+seeded(360+n)*.10)],
          mirrorX: (i + sideIndex) % 2 === 1
        }));
      });
    }

    // The old stairs remain deliberately decorative; v2 still has a flat gameplay plane.
    this.root.add(cloneAsset(this.assets, 'stairs', { position: [4.65, 0, 4.18], rotation: Math.PI, scale: 2.3 }));
  }

  buildHearth() {
    // Rotation is intentionally -PI/2: this is the corrected facing from the first visual milestone.
    const hearth = cloneAsset(this.assets, 'fireplace', {
      position: [0, 0, -4.34], rotation: -Math.PI / 2, scale: 3.45
    });
    this.root.add(hearth);

    this.hearthLight = new THREE.PointLight(0xff8a38, 32, 9.2, 2.0);
    this.hearthLight.position.set(0, 1.25, -3.62);
    this.hearthLight.castShadow = true;
    this.hearthLight.shadow.mapSize.set(1024, 1024);
    this.hearthLight.shadow.bias = -0.002;
    this.root.add(this.hearthLight);

    this.hearthGlow = new THREE.PointLight(0xffc56a, 8, 5.0, 2);
    this.hearthGlow.position.set(0, 0.85, -3.2);
    this.root.add(this.hearthGlow);

    const ring = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.62, 64), MAT.ring.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, .018, -3.45);
    this.root.add(ring);
    this.hearthRing = ring;

    const emberGeo = new THREE.IcosahedronGeometry(0.12, 0);
    for (let i = 0; i < 7; i++) {
      const ember = new THREE.Mesh(emberGeo, MAT.ember);
      ember.scale.set(1.4 + seeded(i)*1.5, .35 + seeded(i+1)*.4, .6 + seeded(i+2));
      ember.position.set((seeded(i+3)-.5)*1.1, .13, -3.55 + (seeded(i+4)-.5)*.55);
      enableBloom(ember);
      this.root.add(ember);
    }

    for (let i = 0; i < 5; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18 + i*.025, 0.85 + i*.12, 6), i < 2 ? MAT.flameHot : MAT.flame);
      flame.position.set((i-2)*0.16, 0.58 + seeded(i)*.15, -3.58 + (seeded(i+9)-.5)*.18);
      flame.scale.x = .65 + seeded(i+12)*.35;
      enableBloom(flame);
      this.root.add(flame);
      this.animated.push({ type:'flame', obj:flame, seed:i*1.71 });
    }
  }

  buildFurniture() {
    const table = cloneAsset(this.assets, 'tableBooks', { position: [-3.55, 0, -2.72], rotation: Math.PI/2, scale: 2.35 });
    const stool = cloneAsset(this.assets, 'stool', { position: [-2.35, 0, -1.9], rotation: -0.45, scale: 1.08 });
    const chest = cloneAsset(this.assets, 'chest', { position: [3.95, 0, -2.7], rotation: -0.25, scale: 1.42 });
    const barrelA = cloneAsset(this.assets, 'barrel', { position: [4.45, 0, -1.25], rotation: 0.25, scale: 0.92 });
    const barrelB = cloneAsset(this.assets, 'barrel', { position: [5.0, 0, -0.95], rotation: -0.15, scale: 0.72 });
    const logs = cloneAsset(this.assets, 'logs', { position: [1.62, 0, -3.25], rotation: -.35, scale: 1.15 });
    const banner = cloneAsset(this.assets, 'banner', { position: [-5.38, .28, -3.22], rotation: 0, scale: 1.85 });
    this.root.add(table, stool, chest, barrelA, barrelB, logs, banner);

    // Lanterns now visibly hang from wall brackets instead of hovering in space.
    const lanterns = [
      { x:-5.02, y:.74, z:-1.25, rot:.65, wallX:-5.43 },
      { x: 5.02, y:.74, z: 1.30, rot:-.55, wallX: 5.43 }
    ];
    for (const spec of lanterns) {
      const {x,y,z,rot,wallX} = spec;
      const lantern = cloneAsset(this.assets, 'lantern', { position:[x,y,z], rotation:rot, scale:.66 });
      enableBloom(lantern);
      this.root.add(lantern);
      this.addLanternBracket(wallX, x, z, y + .70);
      const light = new THREE.PointLight(0xffb35a, 6.5, 4.2, 2);
      light.position.set(x, y + .25, z);
      enableBloom(light);
      this.root.add(light);
    }
  }

  addLanternBracket(wallX, lanternX, z, y) {
    const inward = Math.sign(lanternX - wallX) || 1;
    const armLength = Math.abs(lanternX - wallX) + .08;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLength, .055, .055), MAT.mount);
    arm.position.set((wallX + lanternX) * .5, y, z);
    arm.castShadow = true;
    this.root.add(arm);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(.055, .34, .24), MAT.mount);
    plate.position.set(wallX, y - .09, z);
    plate.castShadow = true;
    this.root.add(plate);

    const drop = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .18, 8), MAT.mount);
    drop.position.set(lanternX, y - .09, z);
    drop.castShadow = true;
    this.root.add(drop);
  }

  makeCrystal(key, x, z, rot, scale, lightStrength = 5.4) {
    const c = cloneAsset(this.assets, key, { position:[x,0,z], rotation:rot, scale });
    c.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      obj.material.emissive = new THREE.Color(0x0b4d9b);
      obj.material.emissiveIntensity = 0.65;
      if (obj.material.map) obj.material.emissiveMap = obj.material.map;
    });
    enableBloom(c);
    this.root.add(c);
    const light = new THREE.PointLight(0x3b9dff, lightStrength * scale, 4.6 * scale, 2.1);
    light.position.set(x, .72 * scale, z);
    enableBloom(light);
    this.root.add(light);
    return { object:c, light };
  }

  buildCrystals() {
    const placements = [
      ['crystalCluster', -4.45, 3.1, .9, 1.25],
      ['crystalShard', 4.18, 3.35, -.5, 1.12],
      ['crystalShard', 3.45, 2.8, .2, .72],
      ['crystalCluster', -4.92, .75, -.35, .72]
    ];
    for (const [key,x,z,rot,scale] of placements) this.makeCrystal(key,x,z,rot,scale);
  }

  buildGreenery() {
    const plants = [[-5.05,0,2.1,.6,.9],[5.05,0,2.7,-.2,.85],[-3.1,0,-3.9,1.2,.68],[2.75,0,-4.05,-1,.62]];
    for (const [x,y,z,r,s] of plants) this.root.add(cloneAsset(this.assets,'plant',{position:[x,y,z],rotation:r,scale:s}));
    const mushrooms = [[-3.65,0,3.72,.3,.7],[3.25,0,.65,-.2,.53]];
    for (const [x,y,z,r,s] of mushrooms) this.root.add(cloneAsset(this.assets,'mushroom',{position:[x,y,z],rotation:r,scale:s}));

    const vines = [[-4.7,2.55,-4.72,0,1.55],[4.55,2.45,-4.76,0,1.45],[-5.65,2.3,-1.7,Math.PI/2,1.25]];
    for (const [x,y,z,r,s] of vines) {
      const vine = cloneAsset(this.assets,'vine',{position:[x,y,z],rotation:r,scale:s});
      vine.rotation.z = Math.PI;
      this.root.add(vine);
    }
  }

  buildGrotto() {
    // A small first expedition zone connected directly to the open edge of the Hearth Room.
    // It uses the same kit rather than inventing new art so we can test the original game loop in the new look.
    [-5.9, 5.9].forEach((x, sideIndex) => {
      [5.2, 7.8, 10.4, 13.0].forEach((z, i) => {
        const n = 400 + sideIndex*20 + i;
        this.root.add(cloneAsset(this.assets, 'wall', {
          position:[x + (seeded(n)-.5)*.07, (seeded(n+1)-.5)*.055, z + (seeded(n+2)-.5)*.18],
          rotation:(seeded(n+3)-.5)*.026,
          scaleXYZ:[1.85*(.93+seeded(n+4)*.14), 3.0*(.92+seeded(n+5)*.16), 2.65*(.94+seeded(n+6)*.12)],
          mirrorX: (i + sideIndex) % 2 === 1
        }));
      });
    });
    // The original grotto end wall now becomes a threshold into the deeper route.
    // Two heavy side pieces frame a clear central opening instead of sealing the room.
    [-4.55, 4.55].forEach((x, i) => {
      const n = 500 + i;
      this.root.add(cloneAsset(this.assets, 'wall', {
        position:[x + (seeded(n)-.5)*.12, (seeded(n+1)-.5)*.05, 14.95 + (seeded(n+2)-.5)*.07],
        rotation:Math.PI/2 + (seeded(n+3)-.5)*.025,
        scaleXYZ:[2.05*(.94+seeded(n+4)*.12), 3.2*(.92+seeded(n+5)*.14), 3.0*(.95+seeded(n+6)*.10)],
        mirrorX: i % 2 === 1
      }));
    });

    // Cold-room set dressing, deliberately leaving a clear central route.
    this.makeCrystal('crystalCluster', -4.45, 7.0, .25, 1.05, 4.4);
    this.makeCrystal('crystalShard', 4.45, 8.2, -.45, .9, 4.2);
    this.makeCrystal('crystalCluster', 4.0, 12.4, .6, 1.15, 4.5);
    this.makeCrystal('crystalShard', -4.25, 13.1, -.2, .82, 3.8);

    const grottoPlants = [[-4.7,0,8.4,.3,.75],[4.75,0,10.7,-.4,.72],[-4.5,0,12.1,.8,.65]];
    for (const [x,y,z,r,s] of grottoPlants) this.root.add(cloneAsset(this.assets,'plant',{position:[x,y,z],rotation:r,scale:s}));
    this.root.add(cloneAsset(this.assets,'mushroom',{position:[3.7,0,6.55],rotation:.3,scale:.58}));
    this.root.add(cloneAsset(this.assets,'mushroom',{position:[-3.9,0,10.5],rotation:-.6,scale:.48}));

    const cold = new THREE.PointLight(0x2a6cb8, 4.0, 10.5, 2);
    cold.position.set(0, 2.1, 10.3);
    this.root.add(cold);
  }

  buildDeepCavern() {
    // Phase-two route: three compact chambers and a final Heart room. The camera is
    // fixed, so the path deliberately keeps a readable central lane and pushes tall
    // silhouettes / bright crystals toward the edges where they frame rather than hide.
    const wallZ = [15.8, 18.4, 21.0, 23.6, 26.2, 28.8, 31.4, 34.0, 36.6, 39.2];
    [-5.9, 5.9].forEach((x, sideIndex) => {
      wallZ.forEach((z, i) => {
        const n = 600 + sideIndex*40 + i;
        this.root.add(cloneAsset(this.assets, 'wall', {
          position:[x + (seeded(n)-.5)*.08, (seeded(n+1)-.5)*.07, z + (seeded(n+2)-.5)*.18],
          rotation:(seeded(n+3)-.5)*.03,
          scaleXYZ:[1.86*(.91+seeded(n+4)*.17), 3.02*(.90+seeded(n+5)*.19), 2.68*(.92+seeded(n+6)*.15)],
          mirrorX:(i + sideIndex) % 2 === 1
        }));
      });
    });

    // Broken cross-walls make the linear route feel like connected rooms instead of
    // a single hallway while preserving a generous playable opening in the center.
    const thresholds = [21.0, 27.2, 33.5];
    thresholds.forEach((z, ti) => {
      [-4.55, 4.55].forEach((x, side) => {
        const n = 740 + ti*10 + side;
        this.root.add(cloneAsset(this.assets, 'wall', {
          position:[x + (seeded(n)-.5)*.08, (seeded(n+1)-.5)*.05, z],
          rotation:Math.PI/2 + (seeded(n+2)-.5)*.03,
          scaleXYZ:[2.0*(.94+seeded(n+3)*.12), 3.15*(.90+seeded(n+4)*.18), 2.9*(.94+seeded(n+5)*.12)],
          mirrorX:(ti + side) % 2 === 1
        }));
      });
    });

    // Distinct visual landmarks for each leg of the expedition.
    this.makeCrystal('crystalCluster', 4.35, 17.2, .15, 1.08, 4.7);
    this.makeCrystal('crystalShard', -4.4, 19.55, -.4, .82, 3.8);
    this.makeCrystal('crystalCluster', -4.15, 23.15, .5, 1.18, 4.8);
    this.makeCrystal('crystalShard', 4.5, 25.55, -.2, .88, 4.0);
    this.makeCrystal('crystalCluster', 4.15, 29.2, .8, 1.22, 5.0);
    this.makeCrystal('crystalShard', -4.45, 31.55, .1, .9, 4.1);
    this.makeCrystal('crystalCluster', -4.35, 35.2, -.4, 1.32, 5.3);
    this.makeCrystal('crystalCluster', 4.25, 38.2, .35, 1.20, 5.0);

    const plants = [
      [-4.75,16.4,.5,.72],[4.65,20.0,-.2,.65],[-4.6,22.6,.7,.72],
      [4.7,26.5,-.7,.65],[-4.75,29.8,.2,.68],[4.65,32.4,.8,.72],
      [-4.55,36.7,-.3,.72],[4.6,39.0,.3,.66]
    ];
    for (const [x,z,r,scale] of plants) this.root.add(cloneAsset(this.assets,'plant',{position:[x,0,z],rotation:r,scale}));

    [[3.7,18.6,.4,.55],[-3.8,24.5,-.4,.58],[3.7,30.5,.2,.62],[-3.7,37.8,-.5,.58]].forEach(([x,z,r,scale]) => {
      this.root.add(cloneAsset(this.assets,'mushroom',{position:[x,0,z],rotation:r,scale}));
    });

    // Very low blue ambient pools keep unlit chambers readable without making them safe.
    [18.2, 24.4, 30.6, 37.0].forEach((z, i) => {
      const cold = new THREE.PointLight(0x245f9f, i === 3 ? 2.4 : 1.8, 8.5, 2);
      cold.position.set(i % 2 ? 1.4 : -1.4, 2.2, z);
      this.root.add(cold);
    });
  }

  makeBrazier(name, index, cost, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(.72, .88, .34, 8), MAT.brazierStone.clone());
    base.position.y = .17;
    base.castShadow = base.receiveShadow = true;
    group.add(base);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(.52, .62, .72, 8), MAT.brazierStone.clone());
    column.position.y = .66;
    column.castShadow = column.receiveShadow = true;
    group.add(column);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(.68, .58, .18, 8), MAT.brazierMetal.clone());
    collar.position.y = 1.04;
    collar.castShadow = true;
    group.add(collar);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.68, .48, .28, 10, 1, false), MAT.brazierMetal.clone());
    bowl.position.y = 1.24;
    bowl.castShadow = true;
    group.add(bowl);

    const coal = new THREE.Mesh(new THREE.CylinderGeometry(.47, .47, .07, 10), MAT.brazierDark.clone());
    coal.position.y = 1.405;
    group.add(coal);

    // Small bronze braces make the primitive-built object read more like the existing kit.
    for (let i=0; i<4; i++) {
      const a = i * Math.PI/2 + Math.PI/4;
      const brace = new THREE.Mesh(new THREE.BoxGeometry(.13, .48, .13), MAT.brazierMetal.clone());
      brace.position.set(Math.cos(a)*.50, .73, Math.sin(a)*.50);
      brace.rotation.y = -a;
      brace.rotation.z = Math.cos(a) * .12;
      brace.castShadow = true;
      group.add(brace);
    }

    const flames = new THREE.Group();
    flames.visible = false;
    for (let i=0; i<4; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.16 + i*.025, .68 + i*.09, 6), i < 1 ? MAT.flameHot.clone() : MAT.flame.clone());
      flame.position.set((i-1.5)*.11, 1.72 + seeded(820+index*10+i)*.09, (seeded(850+index*10+i)-.5)*.16);
      flame.scale.x = .65 + seeded(870+index*10+i)*.32;
      enableBloom(flame);
      flames.add(flame);
      this.animated.push({type:'brazierFlame',obj:flame,seed:index*2.7+i});
    }
    group.add(flames);

    const light = new THREE.PointLight(0xff9a49, 0, 10.5, 2);
    light.position.set(0, 2.0, 0);
    light.castShadow = true;
    light.shadow.mapSize.set(512,512);
    group.add(light);

    const ringMat = new THREE.MeshBasicMaterial({color:0xffb15a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.55, 4.64, 72), ringMat);
    ring.rotation.x = -Math.PI/2;
    ring.position.y = .02;
    enableBloom(ring);
    group.add(ring);

    this.root.add(group);
    const brazier = {name,index,cost,x,z,group,flames,light,ring,lit:false,pulse:0,warmRadius:4.65};
    this.braziers.push(brazier);

    // The pedestal itself should obstruct; the warm ring should not.
    this.collision.addCircle(x, z, .78, `brazier-${index}`);
    return brazier;
  }

  buildBraziers() {
    this.makeBrazier('Mosslight Brazier', 0, 6, -2.55, 18.35);
    this.makeBrazier('Amber Brazier', 1, 8, 2.55, 24.55);
    this.makeBrazier('Deepglass Brazier', 2, 10, -2.25, 30.85);
  }

  buildHeart() {
    const group = new THREE.Group();
    group.position.set(0, 0, 37.55);

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.05, .5, 10), MAT.heartStone.clone());
    lower.position.y = .25;
    lower.castShadow = lower.receiveShadow = true;
    group.add(lower);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.58, .33, 10), MAT.brazierMetal.clone());
    upper.position.y = .66;
    upper.castShadow = upper.receiveShadow = true;
    group.add(upper);

    // The actual Heart reuses the kit's excellent crystal art rather than inventing a
    // mismatched new model. Layered clusters make it feel singular and monumental.
    const crystalA = cloneAsset(this.assets, 'crystalCluster', {position:[0,.72,0],rotation:.15,scale:2.15});
    const crystalB = cloneAsset(this.assets, 'crystalCluster', {position:[.52,.72,.16],rotation:2.1,scale:1.28});
    const crystalC = cloneAsset(this.assets, 'crystalShard', {position:[-.58,.72,.22],rotation:-1.1,scale:1.45});
    const crystals = new THREE.Group();
    crystals.add(crystalA, crystalB, crystalC);
    crystals.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      obj.material = obj.material.clone();
      obj.material.emissive = new THREE.Color(0x0a3f78);
      obj.material.emissiveIntensity = .72;
      if (obj.material.map) obj.material.emissiveMap = obj.material.map;
    });
    enableBloom(crystals);
    group.add(crystals);

    const light = new THREE.PointLight(0x4fa8ff, 5.0, 10.5, 2);
    light.position.set(0, 2.2, 0);
    enableBloom(light);
    group.add(light);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(2.35,2.43,72),
      new THREE.MeshBasicMaterial({color:0x67baff,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false})
    );
    halo.rotation.x = -Math.PI/2;
    halo.position.y = .025;
    enableBloom(halo);
    group.add(halo);

    this.root.add(group);
    this.heart = {group, crystals, light, halo, x:0, z:37.55, awake:false};
    this.collision.addCircle(0, 37.55, 1.55, 'heart');
  }

  addMineNode(type, x, z, scale=1, rich=1) {
    const key = type === 'crystal' ? (rich > 1 ? 'crystalCluster' : 'crystalShard') : 'rock';
    const group = cloneAsset(this.assets, key, { position:[x,0,z], rotation:seeded(this.mineNodes.length+4)*Math.PI*2, scale });
    let light = null;
    if (type === 'crystal') {
      group.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        obj.material.emissive = new THREE.Color(0x0b57a3);
        obj.material.emissiveIntensity = .85;
        if (obj.material.map) obj.material.emissiveMap = obj.material.map;
      });
      enableBloom(group);
      light = new THREE.PointLight(0x40a7ff, 3.5 * scale, 3.8 * scale, 2);
      light.position.set(x, .65 * scale, z);
      enableBloom(light);
      this.root.add(light);
    }
    this.root.add(group);
    const maxHp = type === 'crystal' ? 4 * rich : 3 * rich;
    const node = { type, group, light, x, z, hp:maxHp, maxHp, rich, alive:true, respawn:0, hitPulse:0, baseScale:scale };
    this.mineNodes.push(node);
    return node;
  }

  buildMineNodes() {
    // First expedition nodes.
    this.addMineNode('stone', -2.9, 6.8, .82, 1);
    this.addMineNode('crystal', 2.25, 7.3, .72, 1);
    this.addMineNode('stone', 3.0, 10.15, .94, 1);
    this.addMineNode('crystal', -2.4, 10.7, .86, 1);
    this.addMineNode('stone', -1.8, 13.35, 1.05, 2);
    this.addMineNode('crystal', 1.9, 13.05, 1.05, 2);

    // Richer seams appear farther from the hearth so each brazier materially extends
    // the resource frontier instead of only acting as a checkpoint.
    this.addMineNode('crystal', 2.9, 16.7, .92, 2);
    this.addMineNode('stone', -3.3, 19.7, .92, 2);
    this.addMineNode('crystal', 2.7, 20.15, .94, 2);
    this.addMineNode('crystal', -2.9, 22.8, 1.02, 2);
    this.addMineNode('stone', 3.25, 25.9, 1.02, 2);
    this.addMineNode('crystal', -2.85, 26.75, 1.02, 2);
    this.addMineNode('crystal', 3.0, 28.5, 1.08, 2);
    this.addMineNode('crystal', 2.85, 31.65, 1.08, 3);
    this.addMineNode('stone', -3.25, 32.2, 1.10, 3);
    this.addMineNode('crystal', 2.75, 34.7, 1.18, 3);
    this.addMineNode('crystal', -2.8, 39.0, 1.10, 3);
  }

  buildColliders() {
    // Hearth room structural boundaries.
    this.collision.addBox(-5.65, 5.65, -5.25, -4.48, 'north-wall');
    this.collision.addBox(-6.2, -5.35, -4.55, 4.25, 'west-wall');
    this.collision.addBox(5.35, 6.2, -4.55, 4.25, 'east-wall');

    // Major props: simple invisible footprints are intentionally used instead of mesh collision.
    this.collision.addBox(-1.5, 1.5, -4.55, -3.03, 'fireplace');
    this.collision.addBox(-4.4, -2.55, -3.45, -2.0, 'table');
    this.collision.addCircle(-2.35, -1.9, .55, 'stool');
    this.collision.addBox(3.25, 4.72, -3.45, -2.05, 'chest');
    this.collision.addCircle(4.45, -1.25, .58, 'barrel');
    this.collision.addCircle(5.0, -.95, .5, 'barrel');
    this.collision.addCircle(-4.45, 3.1, .8, 'crystal');
    this.collision.addCircle(4.18, 3.35, .65, 'crystal');

    // Grotto walls. The same overall x-bounds continue forward, keeping the route readable.
    this.collision.addBox(-6.2, -5.35, 4.15, 14.45, 'grotto-west');
    this.collision.addBox(5.35, 6.2, 4.15, 14.45, 'grotto-east');
    // Grotto threshold is open in the middle; side wall collision continues naturally.

    // Deep route uses the same broad outer footprint. Visual cross-walls leave a central
    // opening, so only the outer rails need collision here.
    this.collision.addBox(-6.2, -5.35, 14.15, 40.35, 'deep-west');
    this.collision.addBox(5.35, 6.2, 14.15, 40.35, 'deep-east');
    this.collision.addBox(-5.65, 5.65, 40.15, 41.0, 'heart-end');

    // Only the big decorative crystal clusters obstruct. Small shards and mine nodes stay
    // nonblocking so harvesting never becomes a collision puzzle.
    this.collision.addCircle(-4.45, 7.0, .72, 'large-crystal');
    this.collision.addCircle(4.0, 12.4, .78, 'large-crystal');
    this.collision.addCircle(4.35, 17.2, .72, 'large-crystal');
    this.collision.addCircle(-4.15, 23.15, .80, 'large-crystal');
    this.collision.addCircle(4.15, 29.2, .82, 'large-crystal');
    this.collision.addCircle(-4.35, 35.2, .88, 'large-crystal');
    this.collision.addCircle(4.25, 38.2, .82, 'large-crystal');

    this.collision.bounds = { minX:-5.75, maxX:5.75, minZ:-4.7, maxZ:40.45 };

  }

  buildAtmosphere() {
    const count = 235;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i=0;i<count;i++) {
      pos[i*3] = (seeded(i*3)-.5)*11;
      pos[i*3+1] = .35 + seeded(i*3+1)*2.8;
      pos[i*3+2] = -4.0 + seeded(i*3+2)*44.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const mat = new THREE.PointsMaterial({color:0xaecfff,size:.035,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending});
    const motes = new THREE.Points(geo,mat);
    enableBloom(motes);
    this.root.add(motes);
    this.animated.push({type:'motes',obj:motes});
  }

  isWarm(position) {
    if (this.heartAwake) return true;
    // The hearth room itself acts as the sanctuary; every lit brazier adds a compact
    // refuge that makes the next leg of the expedition practical.
    if (position.z < 4.35 || distXZ(position, this.hearthPoint) < 3.1) return true;
    for (const b of this.braziers) {
      if (b.lit && Math.hypot(position.x - b.x, position.z - b.z) < b.warmRadius) return true;
    }
    return false;
  }

  warmthDrainRate(position) {
    // Cold deepens gradually rather than by hard gates. Braziers are therefore useful
    // because they reset the clock, not because an invisible wall demands them.
    const depth = Math.max(0, position.z - 5);
    return 4.15 + Math.min(4.0, depth * .105);
  }

  isNearHearth(position) { return distXZ(position, this.hearthPoint) < 2.35; }

  nearestBrazier(position, range=1.95) {
    let best = null;
    let bestD = range;
    for (const b of this.braziers) {
      const d = Math.hypot(position.x - b.x, position.z - b.z);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  nextUnlitBrazier() { return this.braziers.find((b) => !b.lit) || null; }

  isNearHeart(position, range=2.7) {
    if (!this.heart) return false;
    return Math.hypot(position.x - this.heart.x, position.z - this.heart.z) < range;
  }

  nearestMineNode(position, range=1.7) {
    let best = null;
    let bestD = range;
    for (const n of this.mineNodes) {
      if (!n.alive) continue;
      const d = Math.hypot(position.x - n.x, position.z - n.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  hitNode(node, damage=1) {
    if (!node || !node.alive) return { depleted:false, amount:0 };
    node.hp -= damage;
    node.hitPulse = .16;
    if (node.hp > 0) return { depleted:false, amount:0 };

    node.alive = false;
    node.group.visible = false;
    if (node.light) node.light.visible = false;
    node.respawn = 17 + seeded(this.mineNodes.indexOf(node) + 80) * 12;
    const amount = node.rich + (seeded(this.mineNodes.indexOf(node) + 120) > .55 ? 1 : 0);
    return { depleted:true, amount };
  }

  lightBrazier(index) {
    const b = this.braziers[index];
    if (!b || b.lit) return false;
    b.lit = true;
    b.flames.visible = true;
    b.light.intensity = 11.5;
    b.ring.material.opacity = .18;
    b.pulse = 1;
    return true;
  }

  awakenHeart() {
    if (!this.heart || this.heart.awake) return false;
    this.heart.awake = true;
    this.heartAwake = true;
    this.heart.light.color.set(0xffb45c);
    this.heart.light.intensity = 22;
    this.heart.light.distance = 17;
    this.heart.halo.material.color.set(0xffb45c);
    this.heart.halo.material.opacity = .22;
    this.heart.crystals.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      obj.material.emissive = new THREE.Color(0xff7c24);
      obj.material.emissiveIntensity = 2.4;
      if (obj.material.map) obj.material.emissiveMap = obj.material.map;
    });
    for (const b of this.braziers) if (b.lit) b.light.intensity = 13.0;
    this.celebrate = 2.2;
    return true;
  }

  pulseHearth() { this.hearthPulse = 1; }
  celebrateHearth() { this.celebrate = 1; }

  update(time, dt) {
    for (const item of this.animated) {
      if (item.type === 'flame') {
        const wobble = Math.sin(time*8.5 + item.seed);
        item.obj.scale.y = 0.86 + wobble * .12 + Math.sin(time*13 + item.seed)*.06;
        item.obj.rotation.y += dt * (.7 + item.seed*.05);
        item.obj.position.x += Math.sin(time*6.1 + item.seed) * .0008;
      } else if (item.type === 'brazierFlame') {
        const wobble = Math.sin(time*8.8 + item.seed);
        item.obj.scale.y = .88 + wobble*.13 + Math.sin(time*13.2 + item.seed)*.05;
        item.obj.rotation.y += dt * (1.0 + item.seed*.035);
      } else if (item.type === 'motes') {
        // Do not rotate the entire long particle field around world origin; once the
        // cavern became deep, that made far motes sweep tens of meters sideways.
        item.obj.rotation.y = Math.sin(time*.08) * .002;
        item.obj.position.y = Math.sin(time*.45)*.05;
      }
    }

    for (const n of this.mineNodes) {
      if (!n.alive) {
        n.respawn -= dt;
        if (n.respawn <= 0) {
          n.alive = true;
          n.hp = n.maxHp;
          n.group.visible = true;
          if (n.light) n.light.visible = true;
        }
      }
      if (n.hitPulse > 0) {
        n.hitPulse = Math.max(0, n.hitPulse - dt);
        const kick = 1 + Math.sin((n.hitPulse / .16) * Math.PI) * .13;
        n.group.scale.setScalar(n.baseScale * kick);
      } else {
        n.group.scale.setScalar(n.baseScale);
      }
    }

    for (const b of this.braziers) {
      b.pulse = Math.max(0, b.pulse - dt * 1.25);
      if (!b.lit) continue;
      b.light.intensity = 10.8 + b.pulse*5.0 + Math.sin(time*6.7 + b.index)*.55;
      b.ring.material.opacity = .15 + b.pulse*.09 + Math.sin(time*2.0 + b.index)*.018;
    }

    if (this.heart) {
      this.heart.crystals.rotation.y += dt * (this.heart.awake ? .16 : .055);
      if (!this.heart.awake) {
        this.heart.light.intensity = 4.6 + Math.sin(time*2.6)*.45;
        this.heart.halo.material.opacity = .07 + Math.sin(time*1.7)*.015;
      } else {
        this.heart.light.intensity = 20 + Math.sin(time*4.3)*1.8;
        this.heart.halo.material.opacity = .19 + Math.sin(time*2.4)*.03;
      }
    }

    this.hearthPulse = Math.max(0, this.hearthPulse - dt * 1.8);
    this.celebrate = Math.max(0, this.celebrate - dt * .35);
    if (this.hearthLight) this.hearthLight.intensity = 32 + this.hearthPulse * 12 + this.celebrate * 9 + Math.sin(time*4.6)*1.25;
    if (this.hearthGlow) this.hearthGlow.intensity = 8 + this.hearthPulse * 5 + this.celebrate * 5;
    if (this.hearthRing) this.hearthRing.material.opacity = .10 + this.hearthPulse*.12 + this.celebrate*.08 + Math.sin(time*2.2)*.018;
  }
}
