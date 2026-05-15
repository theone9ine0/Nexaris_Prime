import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { SceneManager } from './scene/index.js';
import { createChamberScene } from './scenes/chamberScene.js';
import { createVoidScene } from './scenes/voidScene.js';
import { AnchorManager } from './anchors/AnchorManager.js';

const container = document.getElementById('app');

const cssScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 4);

const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
webglRenderer.setSize(window.innerWidth, window.innerHeight);
webglRenderer.setClearColor(0x000000, 1);
container.appendChild(webglRenderer.domElement);

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.inset = '0';
cssRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(cssRenderer.domElement);

// PR1 shards | PR2 clusters | PR3 effects | PR4 animation | PR26 scene (src/scene/)
const sceneManager = new SceneManager({
  renderer: webglRenderer,
  camera,
  container,
  cssRenderer,
  cssScene,
});

sceneManager.register('chamber', createChamberScene);
sceneManager.register('void', createVoidScene);

const anchorManager = new AnchorManager({ sceneManager });

async function boot() {
  await sceneManager.start('chamber');
}

boot();

// Demo: 1/2 = scenes, S = save anchor, L = load anchor, P = print JSON
window.addEventListener('keydown', (e) => {
  if (e.key === '1') {
    sceneManager.goTo('chamber', { transition: 'fade', duration: 0.8 });
  }
  if (e.key === '2') {
    sceneManager.goTo('void', { transition: 'warp', duration: 1.0 });
  }
  if (e.key === 's' || e.key === 'S') {
    anchorManager.save('default', { label: 'Chamber snapshot' });
    console.info('[anchor] saved "default"', anchorManager.list());
  }
  if (e.key === 'l' || e.key === 'L') {
    if (anchorManager.has('default')) {
      anchorManager.load('default');
      console.info('[anchor] loaded "default"');
    } else {
      console.warn('[anchor] no "default" — press S to save first');
    }
  }
  if (e.key === 'p' || e.key === 'P') {
    if (anchorManager.has('default')) {
      console.info(anchorManager.toJSON('default'));
    }
  }
});

function onResize() {
  const { innerWidth: w, innerHeight: h } = window;
  sceneManager.setSize(w, h);
}

window.addEventListener('resize', onResize);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  sceneManager.update(delta);
  sceneManager.render();
}

animate();
