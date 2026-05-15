import * as THREE from 'three';
import { SceneBase } from '../scenes/SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';
import { PortalManager } from '../portals/PortalManager.js';
import { AvatarScanManager, scanSession } from './AvatarScanManager.js';
import { ScanUI } from './ScanUI.js';

/**
 * PR43 — holographic scan chamber with photo upload and VRM preview.
 */
export class ScanChamberScene extends SceneBase {
  constructor() {
    super('scan_chamber');
    this.cameraPosition.set(0, 1.6, 5.5);
    this.spawnPoint.set(0, 0, 1.2);

    this.inputSystem = null;
    this.cameraController = null;
    this.interactionSystem = null;
    this._animationSystem = null;
    this._effectsManager = null;

    /** @type {AvatarScanManager | null} */
    this.scanManager = null;
    /** @type {ScanUI | null} */
    this.scanUI = null;
    /** @type {THREE.Group | null} */
    this._previewMesh = null;
    /** @type {THREE.Object3D | null} */
    this._scannerRing = null;
    this._scanPhase = 0;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x04060f);
    this.scene.fog = new THREE.Fog(0x04060f, 8, 28);

    this.scene.add(new THREE.AmbientLight(0x334466, 0.5));
    const key = new THREE.DirectionalLight(0xaaccff, 1);
    key.position.set(2, 8, 4);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0c1220,
        metalness: 0.6,
        roughness: 0.4,
        emissive: 0x112244,
        emissiveIntensity: 0.25,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2, 0.15, 32),
      new THREE.MeshStandardMaterial({
        color: 0x1a2844,
        emissive: 0x2266aa,
        emissiveIntensity: 0.35,
        metalness: 0.7,
        roughness: 0.25,
      }),
    );
    platform.position.y = 0.08;
    this.scene.add(platform);

    this._scannerRing = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.06, 16, 64),
      new THREE.MeshBasicMaterial({
        color: 0x44ccff,
        transparent: true,
        opacity: 0.55,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.4;
    this._scannerRing.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.03, 12, 48),
      new THREE.MeshBasicMaterial({
        color: 0xaa66ff,
        transparent: true,
        opacity: 0.35,
      }),
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 1.4;
    this._scannerRing.add(ring2);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 3, 8),
      new THREE.MeshStandardMaterial({
        color: 0x223355,
        emissive: 0x4488ff,
        emissiveIntensity: 0.4,
      }),
    );
    pillar.position.y = 1.5;
    this._scannerRing.add(pillar);

    this.scene.add(this._scannerRing);

    this.scanManager = new AvatarScanManager({ modelManager });
  }

  /**
   * @param {HTMLElement} container
   */
  mountScanUI(container) {
    if (this.scanUI) return;

    this.scanUI = new ScanUI(container, {
      onPhotosChange: (set) => {
        const previews = this.scanManager?.loadPhotos(set) ?? {};
        this.scanUI?.updatePreviews(previews);
      },
      onGenerate: () => this._runScanPipeline(),
      onExport: () => this.scanManager?.downloadVRM(),
      onEnterWorld: () => this._exitToWorld(),
    });

    this.scanManager.onProgress = (p, msg) => {
      this.scanUI?.setProgress(p, msg);
    };
  }

  onEnter() {
    super.onEnter();
    this.scanUI?.show();
    this._setupPortals();
  }

  onExit() {
    this.scanUI?.hide();
    this._removePreviewMesh();
    super.onExit();
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
    this._effectsManager = effectsManager;
    this.sceneManagerRef = this.sceneManagerRef;
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;

    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'portal_to_example',
      targetSceneId: 'example',
      position: new THREE.Vector3(0, 1.2, -4.5),
      color: 0x66ffaa,
      radius: 0.85,
      frameStyle: 'arch',
    });
    this.interactionSystem?.rebuildTargets();
  }

  async _runScanPipeline() {
    if (!this.scanManager || !this._animationSystem) return;

    try {
      this._removePreviewMesh();
      this._removePlayer();

      const { mesh } = await this.scanManager.generateMesh();
      mesh.position.copy(this.spawnPoint);
      this.scene.add(mesh);
      this._previewMesh = mesh;

      await this.scanManager.generateTexture();
      await this.scanManager.buildScannedVRM();

      this._removePreviewMesh();
      await this._spawnScannedAvatar();

      this.scanUI?.setComplete();
    } catch (err) {
      console.warn('[ScanChamberScene] Scan failed:', err);
      this.scanUI?.setStatus(`Scan failed: ${err.message}`);
      this.scanUI?.hideProgress();
    }
  }

  async _spawnScannedAvatar() {
    if (!this.scanManager?.scanUrl || !this.inputSystem || !this.cameraController) {
      return;
    }

    const { vrm, object, animations } = await modelManager.cloneVRM(this.scanManager.scanUrl);

    let clips = animations;
    if (!clips.length) {
      await modelManager.loadModel(SAMPLE_ROBOT_GLB);
      clips = modelManager.getCached(SAMPLE_ROBOT_GLB)?.animations ?? [];
    }

    object.position.copy(this.spawnPoint);
    object.scale.setScalar(1);
    this.scene.add(object);

    this.scanManager.applyScanToVRM(vrm);

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

    avatar.metadata = {
      title: 'Scanned Avatar',
      type: 'avatar',
      payload: { scanId: this.scanManager.scanId, stylized: true },
    };

    avatar.vrmAvatar?.setLookAtTarget(this.cameraController.camera);
    await this.scanManager.applyCustomizationToAvatar(avatar);

    this.setPlayer(avatar);
    this.cameraController.followTarget(avatar.object, {
      offset: new THREE.Vector3(0, 2.2, 5),
      lookAtOffset: new THREE.Vector3(0, 1.2, 0),
    });

    this.effectsManager?.applyObjectEffect?.('scan_avatar_glow', object, {
      glow: true,
      bloom: true,
      emissive: 0x66aaff,
      emissiveIntensity: 0.35,
    });

    this.interactionSystem?.rebuildTargets();
  }

  async _exitToWorld() {
    if (!this.sceneManagerRef) return;
    scanSession.lastScanUrl = this.scanManager?.scanUrl ?? scanSession.lastScanUrl;
    scanSession.lastScanId = this.scanManager?.scanId ?? scanSession.lastScanId;

    await this.sceneManagerRef.transitionViaPortal('example', {
      preservePlayer: true,
      transition: 'warp',
      duration: 0.9,
    });
  }

  _removePreviewMesh() {
    if (this._previewMesh) {
      this._previewMesh.removeFromParent();
      this._previewMesh.traverse((c) => {
        if (c.isMesh) {
          c.geometry?.dispose();
          c.material?.dispose();
        }
      });
      this._previewMesh = null;
    }
  }

  _removePlayer() {
    if (this.player) {
      this.player.dispose();
      this.setPlayer(null);
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    this._scanPhase += deltaTime;

    if (this._scannerRing) {
      this._scannerRing.rotation.y = this._scanPhase * 0.35;
      const pulse = 1 + Math.sin(this._scanPhase * 2) * 0.04;
      this._scannerRing.scale.setScalar(pulse);
    }
  }

  dispose() {
    this.scanUI?.dispose();
    this.scanManager?.dispose();
    super.dispose();
  }
}
