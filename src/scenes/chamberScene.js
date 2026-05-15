import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { NEXARIS_EFFECTS_PRESET } from '../effects/index.js';
import { PortalManager } from '../portals/PortalManager.js';
import { SCAN_CHAMBER_SCENE_ID } from './ScanChamberScene.js';
import { ACADEMY_SCENE_ID } from './academySceneIds.js';
import { YOUR_PLACE_SCENE_ID } from '../social/types.js';

/**
 * Primary chamber dimension: orb, PR1 shards, PR2 clusters.
 */
export class ChamberScene extends SceneBase {
  constructor() {
    super('chamber');
    this.cameraPosition.set(0, 0, 4);
    this.scene.background = new THREE.Color(0x000000);
    this._orb = null;
    this._glow = null;
  }

  _buildContent() {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        emissive: 0x44aaff,
        emissiveIntensity: 2.5,
        metalness: 0.1,
        roughness: 0.2,
      }),
    );
    this.scene.add(orb);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x66bbff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    this.scene.add(glow);
    this._orb = orb;
    this._glow = glow;

    this.scene.add(new THREE.AmbientLight(0x111122, 0.45));
    const keyLight = new THREE.PointLight(0x88ccff, 3, 12);
    keyLight.position.set(2, 2, 3);
    this.scene.add(keyLight);

    this.shardManager.createShard({
      id: 'shard_alpha',
      color: 0x5588ff,
      position: { x: -1.4, y: 0.5, z: 0.8 },
      rotation: { y: -0.3 },
      animation: 'both',
    });

    this.shardManager.createShard({
      id: 'shard_beta',
      color: 0x66bbff,
      position: { x: 1.3, y: 0.35, z: 0.6 },
      rotation: { y: 0.35 },
      scale: 1.15,
      animation: 'pulse',
    });

    this.shardManager.createShard({
      id: 'shard_gamma',
      color: 0x77ccff,
      position: { x: 0, y: -0.55, z: 1.0 },
      animation: 'glow',
    });

    this.shardManager.createShard({
      id: 'shard_delta',
      color: 0x88ddff,
      position: { x: -0.9, y: -0.2, z: 0.45 },
      rotation: { z: 0.1 },
      animation: 'both',
    });

    this.shardManager.createShard({
      id: 'shard_epsilon',
      color: 0x99eeff,
      position: { x: 0.85, y: 0.75, z: 0.7 },
      scale: { x: 0.85, y: 1.2, z: 1 },
      animation: 'pulse',
    });

    this.shardManager.createVideoShard({
      id: 'video_youtube',
      mode: 'youtube',
      youtubeId: 'LXbSed9PqqA',
      title: 'Nexaris trailer',
      position: { x: 0, y: 1.0, z: 1.5 },
      rotation: { y: 0.05 },
      width: 1.6,
      height: 0.9,
      autoplay: true,
      loop: true,
      mute: true,
      animation: 'none',
    });

    this.shardManager.createVideoShard({
      id: 'video_mp4',
      mode: 'mp4',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Big Buck Bunny',
      position: { x: -2.2, y: 0.2, z: 1.1 },
      rotation: { y: 0.2 },
      width: 1.4,
      height: 0.79,
      autoplay: true,
      loop: true,
      mute: true,
      animation: 'none',
    });

    this.clusterManager.createCluster({
      id: 'cluster_circle',
      layout: 'circle',
      layoutOptions: { radius: 1.1 },
      position: { x: -2.5, y: 0.5, z: -2.5 },
      animation: ['rotate', 'drift'],
      shardSpecs: [
        { id: 'c1_a', color: 0x4466aa, animation: 'pulse' },
        { id: 'c1_b', color: 0x5577bb, animation: 'glow' },
        { id: 'c1_c', color: 0x6688cc, animation: 'pulse' },
        { id: 'c1_d', color: 0x7799dd, animation: 'glow' },
      ],
    });

    this.clusterManager.createCluster({
      id: 'cluster_spiral',
      layout: 'spiral',
      layoutOptions: { radius: 1.3 },
      position: { x: 2.2, y: 0.3, z: -2.8 },
      animation: ['pulse', 'drift'],
      shardSpecs: [
        { id: 'c2_a', color: 0x5588cc, animation: 'both' },
        { id: 'c2_b', color: 0x6699dd, animation: 'both' },
        { id: 'c2_c', color: 0x77aaee, animation: 'both' },
      ],
    });

    this.clusterManager.createCluster({
      id: 'cluster_grid',
      layout: 'grid',
      layoutOptions: { spacing: 0.75 },
      position: { x: 0, y: -1.2, z: -3.2 },
      animation: ['rotate', 'pulse'],
      shardSpecs: [
        { id: 'c3_a', color: 0x445588, animation: 'none' },
        { id: 'c3_b', color: 0x556699, animation: 'none' },
        { id: 'c3_c', color: 0x6677aa, animation: 'none' },
        { id: 'c3_d', color: 0x7788bb, animation: 'none' },
        { id: 'c3_e', color: 0x8899cc, animation: 'none' },
      ],
    });
  }

  onEnter() {
    super.onEnter();
    this._setupHubPortals();
  }

  _setupHubPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;

    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'portal_scan_chamber',
      targetSceneId: SCAN_CHAMBER_SCENE_ID,
      position: new THREE.Vector3(-1.4, 1.1, -3.5),
      color: 0x66ddff,
      colorOuter: 0xffffff,
      radius: 0.95,
      frameStyle: 'crystal',
      label: 'SCAN CHAMBER',
    });
    this.portalManager.createPortal({
      id: 'portal_academy',
      targetSceneId: ACADEMY_SCENE_ID,
      position: new THREE.Vector3(1.4, 1.1, -3.5),
      color: 0xaa88ff,
      colorOuter: 0xffffff,
      radius: 0.95,
      frameStyle: 'arch',
      label: 'ACADEMY',
    });
    const social = this.sceneManagerRef?.socialService;

    this.portalManager.createPortal({
      id: 'portal_your_place',
      position: new THREE.Vector3(-2.2, 1.1, -2.5),
      color: 0xffaa88,
      colorOuter: 0xffffff,
      radius: 0.85,
      frameStyle: 'ring',
      label: 'YOUR PLACE',
      onActivate: async () => {
        if (!social) return;
        await social.visitOwnPlacePortal(this.sceneManagerRef);
      },
    });
    this.portalManager.createPortal({
      id: 'portal_visit_friend',
      position: new THREE.Vector3(2.2, 1.1, -2.5),
      color: 0xff88cc,
      colorOuter: 0xffffff,
      radius: 0.85,
      frameStyle: 'crystal',
      label: 'VISIT FRIEND',
      onActivate: async () => {
        if (!social) {
          console.warn('[Chamber] Social service unavailable');
          return;
        }
        try {
          await social.visitFriendPortal(this.sceneManagerRef);
        } catch (err) {
          console.warn('[Chamber] Visit friend:', err.message);
        }
      },
    });

    this.interactionSystem?.rebuildTargets();
  }

  configureEffects(effects) {
    effects.applyPreset(NEXARIS_EFFECTS_PRESET);

    if (this._orb) {
      effects.applyObjectEffect('orb', this._orb, {
        glow: true,
        bloom: true,
        pulseGlow: true,
        emissive: 0x44aaff,
        emissiveIntensity: 2.5,
      });
    }
    if (this._glow) {
      effects.applyObjectEffect('orb_glow', this._glow, { glow: true, bloom: true });
    }

    const alpha = this.shardManager.getShard('shard_alpha');
    const beta = this.shardManager.getShard('shard_beta');
    if (alpha) {
      effects.applyShardEffect('shard_alpha', alpha, {
        glow: true,
        bloom: true,
        emissive: 0x5588ff,
        emissiveIntensity: 0.85,
      });
    }
    if (beta) {
      effects.applyShardEffect('shard_beta', beta, {
        glow: true,
        pulseGlow: true,
        emissive: 0x66bbff,
        emissiveIntensity: 1.0,
      });
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    const time = this._elapsed;
    if (this._orb) {
      this._orb.position.y = Math.sin(time * 0.8) * 0.08;
      this._orb.rotation.y = time * 0.25;
    }
    if (this._glow && this._orb) {
      this._glow.position.copy(this._orb.position);
      this._glow.rotation.y = time * 0.15;
    }
  }
}
