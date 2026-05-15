import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { InputSystem } from './core/InputSystem.js';
import { InteractionSystem } from './core/InteractionSystem.js';
import { ChamberScene } from './scenes/chamberScene.js';
import { VoidScene } from './scenes/voidScene.js';
import { ExampleScene } from './scenes/ExampleScene.js';
import { CrystalCavernScene } from './scenes/crystalCavernScene.js';
import { RetroConsoleScene } from './scenes/retroConsoleScene.js';
import { CombatZoneScene } from './scenes/CombatZoneScene.js';
import {
  ScanChamberScene,
  SCAN_CHAMBER_ALIAS,
  MAIN_WORLD_SCENE_ID,
} from './scenes/ScanChamberScene.js';
import { AcademyDimension } from './scenes/AcademyDimension.js';
import { FlashcardChamber } from './scenes/FlashcardChamber.js';
import { LessonHall } from './scenes/LessonHall.js';
import { QuizArena } from './scenes/QuizArena.js';
import { AcademyController } from './academy/AcademyController.js';
import {
  ACADEMY_SCENE_ID,
  FLASHCARD_CHAMBER_SCENE_ID,
  LESSON_HALL_SCENE_ID,
  QUIZ_ARENA_SCENE_ID,
} from './scenes/academySceneIds.js';
import { CombatHUD } from './combat/CombatHUD.js';
import { AnchorManager } from './anchors/AnchorManager.js';
import { modelManager } from './core/ModelManager.js';
import { SAMPLE_ROBOT_GLB } from './assets/modelUrls.js';
import { UIOverlay } from './ui/UIOverlay.js';
import { DialogueManager } from './dialogue/DialogueManager.js';
import { SocialService } from './social/SocialService.js';
import { SocialUI } from './social/SocialUI.js';
import { YourPlaceScene, YOUR_PLACE_SCENE_ID } from './scenes/YourPlaceScene.js';

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

const uiOverlay = new UIOverlay(container);
const dialogueManager = new DialogueManager({
  uiOverlay,
  getPlayer: () => sceneManager.currentScene?.player ?? null,
});
sceneManager.dialogueManager = dialogueManager;

const socialService = new SocialService();
sceneManager.socialService = socialService;

const socialUI = new SocialUI(container, socialService, {
  onVisitFriend: async (username) => {
    try {
      await socialService.visitFriendPortal(sceneManager, username);
      await afterSceneSwitch(YOUR_PLACE_SCENE_ID);
    } catch (err) {
      console.warn('[Social]', err.message);
    }
  },
  onVisitOwnPlace: async () => {
    await socialService.visitOwnPlacePortal(sceneManager);
    await afterSceneSwitch(YOUR_PLACE_SCENE_ID);
  },
});

dialogueManager.onPauseChange = (paused) => {
  if (paused) {
    cameraController.setInputActive(false);
    interactionSystem.setEnabled(true);
    document.exitPointerLock?.();
  } else if (sceneManager.currentScene?.player) {
    setTraversalInputActive(true);
    if (sceneManager.currentSceneId === 'example') {
      webglRenderer.domElement.requestPointerLock?.();
    }
  } else {
    setTraversalInputActive(true);
  }
};

interactionSystem.onClick((target) => {
  const scene = sceneManager.currentScene;

  if (dialogueManager.isActive) {
    if (target?.metadata?.type === 'npc') {
      scene?.onInteractClick?.(target);
    } else {
      dialogueManager.next();
    }
  } else {
    scene?.onInteractClick?.(target);
  }

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
sceneManager.registerScene('crystal_cave', new CrystalCavernScene());
sceneManager.registerScene('retro_console', new RetroConsoleScene());

const combatZoneScene = new CombatZoneScene();
const combatHud = new CombatHUD(container);
combatZoneScene.setCombatHud(combatHud);
sceneManager.registerScene('combat_zone', combatZoneScene);

const scanChamberScene = new ScanChamberScene();
scanChamberScene.mountScanUI(container, uiOverlay);
sceneManager.registerScene('scan_chamber', scanChamberScene);
sceneManager.registerSceneAlias(SCAN_CHAMBER_ALIAS, 'scan_chamber');
sceneManager.registerSceneAlias(MAIN_WORLD_SCENE_ID, 'example');

const academyController = new AcademyController(container);
academyController.init().catch((err) => console.warn('[Academy] init failed:', err));

const academyDimension = new AcademyDimension();
academyDimension.mountAcademy(academyController, uiOverlay);
sceneManager.registerScene(ACADEMY_SCENE_ID, academyDimension);

const flashcardChamber = new FlashcardChamber();
flashcardChamber.mountAcademy(academyController);
sceneManager.registerScene(FLASHCARD_CHAMBER_SCENE_ID, flashcardChamber);

const lessonHall = new LessonHall();
lessonHall.mountAcademy(academyController);
sceneManager.registerScene(LESSON_HALL_SCENE_ID, lessonHall);

const quizArena = new QuizArena();
quizArena.mountAcademy(academyController);
sceneManager.registerScene(QUIZ_ARENA_SCENE_ID, quizArena);

const ACADEMY_SCENES = new Set([
  ACADEMY_SCENE_ID,
  FLASHCARD_CHAMBER_SCENE_ID,
  LESSON_HALL_SCENE_ID,
  QUIZ_ARENA_SCENE_ID,
]);

const yourPlaceScene = new YourPlaceScene();
yourPlaceScene.mountUI(uiOverlay);
sceneManager.registerScene(YOUR_PLACE_SCENE_ID, yourPlaceScene);

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
 * @param {string} resolvedSceneId
 */
async function afterSceneSwitch(resolvedSceneId) {
  interactionSystem.rebuildTargets();
  syncCameraToScene();
  socialService.onSceneChange(resolvedSceneId);

  const isCombat = resolvedSceneId === 'combat_zone';
  const isScan = resolvedSceneId === 'scan_chamber';
  const isAcademy = ACADEMY_SCENES.has(resolvedSceneId);
  const isYourPlace = resolvedSceneId === YOUR_PLACE_SCENE_ID;
  const isChamber = resolvedSceneId === 'chamber';

  interactionSystem.setEnabled(!isCombat);
  setTraversalInputActive(true);

  if (isCombat) combatHud.show();
  else combatHud.hide();

  if (isScan) {
    scanChamberScene.mountScanUI(container, uiOverlay);
    scanChamberScene.scanUI?.show();
  } else {
    scanChamberScene.scanUI?.hide();
  }

  if (isAcademy) {
    academyController.show();
    if (resolvedSceneId === ACADEMY_SCENE_ID) uiOverlay.showAcademyBanner();
    else uiOverlay.hideAcademyBanner();
  } else {
    academyController.hide();
    uiOverlay.hideAcademyBanner();
  }

  if (isYourPlace) {
    uiOverlay.hideAcademyBanner();
    uiOverlay.hideScanChamberBanner();
    const target = socialService.getVisitTarget();
    uiOverlay.showYourPlaceBanner(
      target?.ownerDisplayName ?? 'Your Place',
    );
  } else {
    uiOverlay.hideYourPlaceBanner();
  }

  if (isChamber) {
    socialUI.show();
  } else {
    socialUI.hide();
  }

  if (sceneManager.currentScene?.player) {
    webglRenderer.domElement.requestPointerLock?.();
  }
}

/**
 * @param {string} id
 * @param {Parameters<SceneManager['transitionTo']>[1]} [options]
 */
async function switchScene(id, options) {
  if (dialogueManager.isActive) return;
  setTraversalInputActive(false);
  await sceneManager.transitionViaPortal(id, {
    ...options,
    preservePlayer: sceneManager.currentScene?.player != null,
    transition: options?.transition ?? 'fade',
    duration: options?.duration ?? 0.8,
  });
  const resolved = sceneManager.resolveSceneId(id);
  await afterSceneSwitch(resolved);
}

async function boot() {
  setTraversalInputActive(false);
  await sceneManager.start('chamber');
  socialService.onSceneChange('chamber');
  socialUI.show();
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
  if (code === 'Digit4') {
    switchScene('crystal_cave', { transition: 'warp', duration: 0.85 });
  }
  if (code === 'Digit5') {
    switchScene('retro_console', { transition: 'warp', duration: 0.85 });
  }
  if (code === 'Digit6') {
    switchScene('combat_zone', { transition: 'warp', duration: 0.85 });
  }
  if (code === 'Digit7') {
    switchScene('scan_chamber', { transition: 'warp', duration: 0.85 });
  }
  if (code === 'Digit8') {
    switchScene(ACADEMY_SCENE_ID, { transition: 'warp', duration: 0.85 });
  }
  if (code === 'Digit9') {
    socialUI.root.classList.toggle('hidden');
  }
  if (code === 'Digit0') {
    socialService.prepareVisitOwnPlace();
    switchScene(YOUR_PLACE_SCENE_ID, { transition: 'warp', duration: 0.85 });
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
  if (dialogueManager.isActive && (code === 'Space' || code === 'Enter')) {
    dialogueManager.next();
    return;
  }
  if (code === 'KeyG') {
    const scene = sceneManager.currentScene;
    if (scene?.requestNewDimension) {
      scene.requestNewDimension();
    } else if (scene?._generateMultiverse) {
      scene._generateMultiverse();
    } else if (sceneManager.currentSceneId === 'example') {
      sceneManager.generateAndLoad(Date.now(), {
        preservePlayer: true,
        transition: 'warp',
        duration: 0.9,
      });
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
    setTraversalInputActive(false);
  }

  dialogueManager.update(delta);
  socialService.update(delta);
  sceneManager.update(delta);
  if (!dialogueManager.isActive) {
    cameraController.update(delta);
  }
  interactionSystem.update(delta);
  sceneManager.render();

  inputSystem.update();
}

animate();
