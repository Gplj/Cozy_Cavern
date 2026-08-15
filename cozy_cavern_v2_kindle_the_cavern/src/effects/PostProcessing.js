import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const BLOOM_LAYER = 1;

export function enableBloom(object) {
  object.traverse((child) => child.layers.enable(BLOOM_LAYER));
}

const MixShader = {
  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: null }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(baseTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);
      gl_FragColor = base + bloom;
    }
  `
};

export function createPostProcessing(renderer, scene, camera) {
  const bloomLayer = new THREE.Layers();
  bloomLayer.set(BLOOM_LAYER);

  // During the bloom render we keep every ordinary mesh present, but render it
  // black. That means it still writes depth and correctly occludes glowing objects
  // behind it. The previous layer-only approach removed non-bloom meshes from this
  // pass entirely, which allowed crystal glow to be composited through the player.
  const darkMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    depthTest: true,
    depthWrite: true,
    toneMapped: false
  });
  const savedMaterials = new Map();

  const darkenNonBloom = (obj) => {
    if (!obj.isMesh || !obj.material || bloomLayer.test(obj.layers)) return;
    savedMaterials.set(obj.uuid, obj.material);
    obj.material = darkMaterial;
  };

  const restoreMaterial = (obj) => {
    const original = savedMaterials.get(obj.uuid);
    if (!original) return;
    obj.material = original;
    savedMaterials.delete(obj.uuid);
  };

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.58, 0.52, 0.58);
  bloom.threshold = 0.16;
  bloom.strength = 0.66;
  bloom.radius = 0.48;
  bloomComposer.addPass(bloom);

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(MixShader.uniforms),
      vertexShader: MixShader.vertexShader,
      fragmentShader: MixShader.fragmentShader,
      depthWrite: false,
      depthTest: false
    }),
    'baseTexture'
  );
  mixPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture;
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());

  function render() {
    // Render bloom candidates while ordinary geometry remains as a black depth mask.
    scene.traverse(darkenNonBloom);
    bloomComposer.render();
    scene.traverse(restoreMaterial);

    // Then render the untouched scene and add only the bloom texture on top.
    finalComposer.render();
  }

  function setSize(width, height) {
    bloomComposer.setSize(width, height);
    finalComposer.setSize(width, height);
  }

  return { render, setSize, bloom };
}
