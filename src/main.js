import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { ChamberScene } from './scenes/chamberScene.js';
import { VoidScene } from './scenes/voidScene.js';
import { ExampleScene } from './scenes/ExampleScene.js';
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

const sceneManager = new SceneManager({
  renderer: webglRenderer,
  camera,
  container,
  cssRenderer,
  cssScene,
});

const cameraController = new CameraController({
  camera,
  domElement: webglRenderer.domElement,
  moveSpeed: 4,
  lookSpeed: 0.002,
  dampingFactor: 10,
});

sceneManager.registerScene('chamber', new ChamberScene());
sceneManager.registerScene('void', new VoidScene());
sceneManager.registerScene('example', new ExampleScene());

const anchorManager = new AnchorManager({ sceneManager });

const _lookTarget = new THREE.Vector3(0, 0, 0);

function syncCameraToScene() {
  const scene = sceneManager.currentScene;
  if (!scene) return;
  const pos = scene.cameraPosition ?? scene.scene.userData?.cameraPosition;
  if (pos) {
    cameraController.applyScenePose(pos, _lookTarget);
    cameraController.setOrbitTarget(_lookTarget);
  }
}

/**
 * @param {string} id
 * @param {Parameters<SceneManager['transitionTo']>[1]} [options]
 */
async function switchScene(id, options) {
  cameraController.setInputActive(false);
  await sceneManager.transitionTo(id, options);
  syncCameraToScene();
  cameraController.setInputActive(true);
}

async function boot() {
  cameraController.setInputActive(false);
  await sceneManager.start('chamber');
  syncCameraToScene();
  cameraController.setInputActive(true);
}

boot();

// Demo: 1/2/3 = scenes, O = toggle camera mode, S/L/P = anchors
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  if (e.key === '1') {
    switchScene('chamber', { transition: 'fade', duration: 0.8 });
  }
  if (e.key === '2') {
    switchScene('void', { transition: 'warp', duration: 1.0 });
  }
  if (e.key === '3') {
    switchScene('example', { transition: 'fade', duration: 0.7 });
  }
  if (e.key === 'o' || e.key === 'O') {
    cameraController.toggleMode();
  }
  if (e.key === 's' || e.key === 'S') {
    anchorManager.save('default', { label: 'Chamber snapshot' });
    console.info('[anchor] saved "default"', anchorManager.list());
  }
  if (e.key === 'l' || e.key === 'L') {
    if (anchorManager.has('default')) {
      anchorManager.load('default');
      cameraController.syncFromCamera();
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

  if (sceneManager.isTransitioning()) {
    cameraController.setInputActive(false);
  }

  sceneManager.update(delta);
  cameraController.update(delta);
  sceneManager.render();
}

animate();
