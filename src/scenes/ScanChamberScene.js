import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';
import { PortalManager } from '../portals/PortalManager.js';
import { AvatarScanManager, scanSession } from '../scan/AvatarScanManager.js';
import { ScanUI } from '../scan/ScanUI.js';
import { ScanningRig } from './assets/scan/ScanningRig.js';
import { createScanFloorMaterial } from './assets/scan/ScanShader.js';
import { ScanAmbience } from './assets/scan/ScanAmbience.js';

/** Canonical scene id */
export const SCAN_CHAMBER_SCENE_ID = 'scan_chamber';
/** PR44 alias */
export const SCAN_CHAMBER_ALIAS = 'ScanChamberScene';
/** Hub exit target (Example / main world) */
export const MAIN_WORLD_SCENE_ID = 'main_world';

/**
 * PR43 / PR44 — cinematic scan chamber dimension with portal exit.
 */
export class ScanChamberScene extends SceneBase {
  constructor() {
    super(SCAN_CHAMBER_SCENE_ID);
    this.cameraPosition.set(2.8, 2.2, 6.5);
    this.spawnPoint.set(0, 0, 0);

    this.inputSystem = null;
    this.cameraController = null;
    this.interactionSystem = null;
    this._animationSystem = null;
    this._effectsManager = null;

    this.scanManager = null;
    this.scanUI = null;
    this._scanRig = null;
    this._floorMat = null;
    this._previewMesh = null;
    this._previewPod = null;
    this._rimLights = [];
    this._ambience = new ScanAmbience();
    this._elapsed = 0;
    this._scanning = false;
    this._inspectMode = false;
    this._inspectAngle = 0;
    this._faceTransition = 0;
    this._faceStylizing = false;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x020408);
    this.scene.fog = new THREE.FogExp2(0x020408, 0.045);

    this.scene.add(new THREE.AmbientLight(0x223355, 0.35));
    const key = new THREE.DirectionalLight(0xcce8ff, 0.9);
    key.position.set(4, 12, 6);
    this.scene.add(key);

    this._floorMat = createScanFloorMaterial();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), this._floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.2, 0.18, 40),
      new THREE.MeshStandardMaterial({
        color: 0x0e1830,
        emissive: 0x2266bb,
        emissiveIntensity: 0.45,
        metalness: 0.92,
        roughness: 0.12,
      }),
    );
    platform.position.y = 0.09;
    this.scene.add(platform);
    this._platform = platform;

    this._scanRig = new ScanningRig({ platformY: 0.1 });
    this.scene.add(this._scanRig.root);

    this._buildHoloPanels();
    this._buildRimLights();

    this.scanManager = new AvatarScanManager({ modelManager });
  }

  _buildHoloPanels() {
    this._holoPanels = new THREE.Group();
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });

    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.8), panelMat);
      panel.position.set(side * 4.2, 1.6, 0);
      panel.rotation.y = side * -Math.PI * 0.35;
      this._holoPanels.add(panel);
    }

    this.scene.add(this._holoPanels);
  }

  _buildRimLights() {
    const colors = [0x66aaff, 0xaa66ff, 0x44ccff];
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(colors[i], 1.2, 8);
      const angle = (i / 3) * Math.PI * 2;
      light.position.set(Math.cos(angle) * 3, 2, Math.sin(angle) * 3);
      this.scene.add(light);
      this._rimLights.push(light);
    }
  }

  /**
   * @param {HTMLElement} container
   * @param {import('../ui/UIOverlay.js').UIOverlay} [uiOverlay]
   */
  mountScanUI(container, uiOverlay = null) {
    if (this.scanUI) return;

    this._uiOverlay = uiOverlay;
    this.scanUI = new ScanUI(container, {
      onPhotosChange: (set) => {
        const previews = this.scanManager?.loadPhotos(set) ?? {};
        this.scanUI?.updatePreviews(previews);
        this._ambience.uiBeep();
      },
      onUploadAll: () => this.scanUI?.triggerUploadDialog(),
      onGenerate: () => this._runScanPipeline(),
      onExport: () => {
        this.scanManager?.downloadVRM();
        this._ambience.uiBeep();
      },
      onEnterWorld: () => this._exitToWorld(),
      onStylizeFace: () => this._runFaceStylize(),
    });

    this.scanManager.onProgress = (p, msg) => {
      this.scanUI?.setProgress(p, msg);
      this._scanRig?.update(0, { scanning: true, intensity: p });
      if (p > 0.2 && p < 0.95) this._ambience.pulseScan(p);
    };
  }

  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    this._ambience.setActive(true);
    this.scanUI?.show();
    this._uiOverlay?.showScanChamberBanner?.();
    this._setupPortals();
    this.cameraController?.clearFollowTarget();
    this.cameraController?.applyScenePose(
      this.cameraPosition,
      new THREE.Vector3(0, 1, 0),
    );
  }

  onExit(nextSceneId) {
    this._ambience.setActive(false);
    this.scanUI?.hide();
    this._uiOverlay?.hideScanChamberBanner?.();
    this._removePreviewMesh();
    this._inspectMode = false;
    super.onExit(nextSceneId);
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
    this._effectsManager = effectsManager;

    if (effectsManager?.applyPreset) {
      effectsManager.applyPreset({
        bloom: { strength: 0.55, radius: 0.6, threshold: 0.18 },
      });
    }
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;

    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'portal_enter_nexaris',
      targetSceneId: MAIN_WORLD_SCENE_ID,
      position: new THREE.Vector3(0, 1.35, -5.2),
      color: 0xaaddff,
      colorOuter: 0xffffff,
      radius: 1.15,
      frameStyle: 'arch',
      shaderVariant: 0,
      label: 'ENTER NEXARIS',
    });

    this.interactionSystem?.rebuildTargets();
  }

  async _runScanPipeline() {
    if (!this.scanManager || !this._animationSystem) return;

    this._scanning = true;
    this._inspectMode = false;
    this._removePlayer();
    this._removePreviewMesh();

    try {
      const mesh = await this.scanManager.generateMesh();
      mesh.position.copy(this.spawnPoint);
      this.scene.add(mesh);
      this._previewMesh = mesh;

      await this.scanManager.generateTexture();
      await this.scanManager.buildScannedVRM();

      this._removePreviewMesh();
      await this._spawnScannedAvatar();

      this._ambience.completeChime();
      this.scanUI?.setComplete();
    } catch (err) {
      console.warn('[ScanChamberScene] Scan failed:', err);
      this.scanUI?.setStatus(`Scan failed: ${err.message}`);
      this.scanUI?.hideProgress();
    } finally {
      this._scanning = false;
    }
  }

  async _spawnScannedAvatar() {
    if (!this.scanManager?.scanUrl || !this.inputSystem) return;

    const { vrm, object, animations } = await modelManager.cloneVRM(this.scanManager.scanUrl);

    let clips = animations;
    if (!clips.length) {
      await modelManager.loadModel(SAMPLE_ROBOT_GLB);
      clips = modelManager.getCached(SAMPLE_ROBOT_GLB)?.animations ?? [];
    }

    object.position.set(0, 0, 0);
    this.scene.add(object);

    const avatar = new AvatarController({
      object,
      vrm,
      animations: clips,
      inputSystem: this.inputSystem,
      cameraController: this.cameraController,
      mixerManager: this._animationSystem.mixerManager,
      animationSystem: this._animationSystem,
      modelManager,
      groundY: 0,
      scanSource: this.scanManager.scanUrl,
    });

    avatar.inspectMode = true;
    avatar.metadata = {
      title: 'Scanned Avatar',
      type: 'avatar',
      payload: { scanId: this.scanManager.scanId, stylized: true },
    };

    this.scanManager.applyScanToVRM(vrm, avatar.vrmAvatar);
    await this.scanManager.applyCustomizationToAvatar(avatar);

    this._previewPod = object;
    this.setPlayer(avatar);
    this._inspectMode = true;

    this.effectsManager?.applyObjectEffect?.('scan_avatar_glow', object, {
      glow: true,
      bloom: true,
      emissive: 0x88ccff,
      emissiveIntensity: 0.45,
    });

    this.interactionSystem?.rebuildTargets();
    this.scanUI?.setStylizeEnabled(true);
  }

  async _runFaceStylize() {
    if (!this.scanManager?.hasFrontPhoto() || this._faceStylizing) return;

    this._faceStylizing = true;
    this._faceTransition = 0;

    try {
      if (!this.player?.vrmAvatar?.vrm) {
        this.scanUI?.setStatus('Generate avatar body first, then stylize face.');
        return;
      }

      this.scanUI?.setProgress(0.05, 'Stylizing anime face…');
      this._scanRig?.update(0, { scanning: true, intensity: 0.85 });
      this._ambience.pulseScan(0.5);

      const vrm = this.player.vrmAvatar.vrm;
      const result = await this.scanManager.stylizeFace(vrm, this.player.vrmAvatar);

      if (result?.canvas) {
        this.scanUI?.setFacePreview(result.canvas.toDataURL('image/png'));
      }

      this._faceTransition = 1;
      this.player.vrmAvatar?.previewFaceExpression('happy', 0.6);
      this.scanUI?.setStatus('Stylized face applied! Fictional anime look — not a realistic copy.');
      this._ambience.completeChime();
    } catch (err) {
      console.warn('[ScanChamberScene] Face stylize failed:', err);
      this.scanUI?.setStatus(`Face stylize failed: ${err.message}`);
      this.scanUI?.hideProgress();
    } finally {
      this._faceStylizing = false;
      this._scanRig?.update(0, { scanning: false, intensity: 0 });
    }
  }

  async _exitToWorld() {
    if (!this.sceneManagerRef) return;

    scanSession.lastScanUrl = this.scanManager?.scanUrl ?? scanSession.lastScanUrl;
    scanSession.lastScanId = this.scanManager?.scanId ?? scanSession.lastScanId;
    scanSession.lastStitchedCanvas = this.scanManager?.stitchedCanvas ?? null;
    scanSession.lastFaceStylization = this.scanManager?.faceStylizationResult?.params ?? scanSession.lastFaceStylization;
    scanSession.lastFaceTextureCanvas = this.scanManager?.faceStylizationResult?.canvas ?? scanSession.lastFaceTextureCanvas;

    const target = this.sceneManagerRef.resolveSceneId?.(MAIN_WORLD_SCENE_ID) ?? 'example';

    if (this.player) {
      this.player.inspectMode = false;
    }

    await this.sceneManagerRef.transitionViaPortal(target, {
      preservePlayer: true,
      transition: 'warp',
      duration: 1,
    });
  }

  _removePreviewMesh() {
    if (!this._previewMesh) return;
    this._previewMesh.removeFromParent();
    this._previewMesh.traverse((c) => {
      if (c.isMesh) {
        c.geometry?.dispose();
        c.material?.dispose();
      }
    });
    this._previewMesh = null;
  }

  _removePlayer() {
    if (this.player) {
      this.player.dispose();
      this.setPlayer(null);
      this._previewPod = null;
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    this._elapsed += deltaTime;

    if (this._floorMat?.uniforms?.uTime) {
      this._floorMat.uniforms.uTime.value = this._elapsed;
    }

    this._scanRig?.update(deltaTime, {
      scanning: this._scanning,
      intensity: this.scanManager?.progress ?? 0,
    });

    if (this._holoPanels) {
      this._holoPanels.rotation.y = Math.sin(this._elapsed * 0.2) * 0.05;
    }

    if (this._faceTransition > 0 && this._faceTransition < 1) {
      this._faceTransition = Math.min(1, this._faceTransition + deltaTime * 0.5);
    }

    if (this._inspectMode && this._previewPod) {
      this._inspectAngle += deltaTime * 0.35;
      const faceEase = this._faceTransition > 0 ? THREE.MathUtils.smoothstep(this._faceTransition, 0, 1) : 1;
      this._previewPod.rotation.y = this._inspectAngle;
      this._previewPod.scale.setScalar(0.92 + faceEase * 0.08);

      const orbitR = 5.5;
      const camY = 2.2 + Math.sin(this._elapsed * 0.4) * 0.15;
      const camX = Math.sin(this._inspectAngle * 0.5) * orbitR * 0.35;
      const camZ = orbitR + Math.cos(this._inspectAngle * 0.5) * 0.5;
      this.cameraPosition.set(camX, camY, camZ);
    }
  }

  dispose() {
    this._ambience.dispose();
    this._scanRig?.dispose();
    this._floorMat?.dispose();
    this.scanUI?.dispose();
    this.scanManager?.dispose();
    super.dispose();
  }
}
