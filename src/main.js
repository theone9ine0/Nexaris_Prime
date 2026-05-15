import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { InputSystem } from './core/InputSystem.js';
import { InteractionSystem } from './core/InteractionSystem.js';
import { ChamberScene } from './scenes/chamberScene.js';
import { VoidScene } from './scenes/voidScene.js';
import { ExampleScene } from './scenes/ExampleScene.js';
import { AnchorManager } from './anchors/AnchorManager.js';
import { modelManager } from './core/ModelManager.js';
import { SAMPLE_ROBOT_GLB } from './assets/modelUrls.js';

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
webglRenderer.domElement.style.position = 'relative';
webglRenderer.domElement.style.zIndex = '0';
container.appendChild(webglRenderer.domElement);

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.inset = '0';
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '1';
container.appendChild(cssRenderer.domElement);

const inputSystem = new InputSystem({ domElement: webglRenderer.domElement });

const cameraController = new CameraController({
  camera,
  domElement: webglRenderer.domElement,
  inputSystem,
  moveSpeed: 4,
  lookSpeed: 0.002,
  dampingFactor: 10,
});

const sceneManager = new SceneManager({
  renderer: webglRenderer,
  camera,
  container,
  cssRenderer,
  cssScene,
  inputSystem,
  cameraController,
});

const interactionSystem = new InteractionSystem({
  camera,
  domElement: webglRenderer.domElement,
  inputSystem,
  getScene: () => sceneManager.currentScene,
});

sceneManager.interactionSystem = interactionSystem;

interactionSystem.onClick((target) => {
  const scene = sceneManager.currentScene;
  scene?.onInteractClick?.(target);

  const playing = typeof target.isPlaying === 'function' ? target.isPlaying() : null;
  console.info(
    '[interaction] click',
    target.id ?? target.metadata?.title,
    target.metadata,
    playing != null ? { playing } : {},
  );
});

modelManager.preload([SAMPLE_ROBOT_GLB]).catch(() => {});

sceneManager.registerScene('chamber', new ChamberScene());
sceneManager.registerScene('void', new VoidScene());
sceneManager.registerScene('example', new ExampleScene());

const anchorManager = new AnchorManager({ sceneManager });

const _lookTarget = new THREE.Vector3(0, 0, 0);

function syncCameraToScene() {
  const scene = sceneManager.currentScene;
  if (!scene) return;
  if (scene.player) {
    cameraController.followTarget(scene.player.object);
    return;
  }
  const pos = scene.cameraPosition ?? scene.scene.userData?.cameraPosition;
  if (pos) {
    cameraController.clearFollowTarget();
    cameraController.applyScenePose(pos, _lookTarget);
    cameraController.setOrbitTarget(_lookTarget);
  }
}

function setTraversalInputActive(active) {
  cameraController.setInputActive(active);
  interactionSystem.setEnabled(active);
  if (!active) {
    inputSystem.clearFrameState();
    interactionSystem.reset();
  }
}

/**
 * @param {string} id
 * @param {Parameters<SceneManager['transitionTo']>[1]} [options]
 */
async function switchScene(id, options) {
  setTraversalInputActive(false);
  await sceneManager.transitionTo(id, options);
  interactionSystem.rebuildTargets();
  syncCameraToScene();
  setTraversalInputActive(true);
  if (sceneManager.currentSceneId === 'example') {
    webglRenderer.domElement.requestPointerLock?.();
  }
}

async function boot() {
  setTraversalInputActive(false);
  await sceneManager.start('chamber');
  interactionSystem.rebuildTargets();
  syncCameraToScene();
  setTraversalInputActive(true);
}

boot();

inputSystem.on('keyDown', ({ code }) => {
  if (code === 'Digit1') {
    switchScene('chamber', { transition: 'fade', duration: 0.8 });
  }
  if (code === 'Digit2') {
    switchScene('void', { transition: 'warp', duration: 1.0 });
  }
  if (code === 'Digit3') {
    switchScene('example', { transition: 'fade', duration: 0.7 });
  }
  if (code === 'KeyO' && !sceneManager.currentScene?.player) {
    cameraController.toggleMode();
  }
  if (code === 'KeyS') {
    anchorManager.save('default', { label: 'Chamber snapshot' });
    console.info('[anchor] saved "default"', anchorManager.list());
  }
  if (code === 'KeyL') {
    if (anchorManager.has('default')) {
      anchorManager.load('default');
      cameraController.syncFromCamera();
      console.info('[anchor] loaded "default"');
    } else {
      console.warn('[anchor] no "default" — press S to save first');
    }
  }
  if (code === 'KeyP' && anchorManager.has('default')) {
    console.info(anchorManager.toJSON('default'));
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
    setTraversalInputActive(false);
  }

  sceneManager.update(delta);
  cameraController.update(delta);
  interactionSystem.update(delta);
  sceneManager.render();

  inputSystem.update();
}

animate();
