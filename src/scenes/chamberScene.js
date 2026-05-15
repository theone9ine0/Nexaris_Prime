import * as THREE from 'three';
import { ShardManager } from '../shards/ShardManager.js';
import { ClusterManager } from '../clusters/ClusterManager.js';
import { NEXARIS_EFFECTS_PRESET } from '../effects/index.js';

/**
 * Primary chamber: background orb + PR1 test shards in front of the orb.
 * @param {import('../scene/SceneManager.js').SceneContext} _ctx
 * @returns {import('../scene/SceneManager.js').SceneInstance}
 */
export function createChamberScene(_ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.userData.cameraPosition = new THREE.Vector3(0, 0, 4);

  // Background orb (rendered behind shards)
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
  scene.add(orb);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x66bbff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  scene.add(glow);

  scene.add(new THREE.AmbientLight(0x111122, 0.45));
  const keyLight = new THREE.PointLight(0x88ccff, 3, 12);
  keyLight.position.set(2, 2, 3);
  scene.add(keyLight);

  const shardManager = new ShardManager(scene);
  const clusterManager = new ClusterManager(scene);

  // PR1 test shards — in front of orb (camera at +Z looks toward -Z; higher Z = closer)
  shardManager.createShard({
    id: 'shard_alpha',
    color: 0x5588ff,
    position: { x: -1.4, y: 0.5, z: 0.8 },
    rotation: { y: -0.3 },
    animation: 'both',
  });

  shardManager.createShard({
    id: 'shard_beta',
    color: 0x66bbff,
    position: { x: 1.3, y: 0.35, z: 0.6 },
    rotation: { y: 0.35 },
    scale: 1.15,
    animation: 'pulse',
  });

  shardManager.createShard({
    id: 'shard_gamma',
    color: 0x77ccff,
    position: { x: 0, y: -0.55, z: 1.0 },
    animation: 'glow',
  });

  shardManager.createShard({
    id: 'shard_delta',
    color: 0x88ddff,
    position: { x: -0.9, y: -0.2, z: 0.45 },
    rotation: { z: 0.1 },
    animation: 'both',
  });

  shardManager.createShard({
    id: 'shard_epsilon',
    color: 0x99eeff,
    position: { x: 0.85, y: 0.75, z: 0.7 },
    scale: { x: 0.85, y: 1.2, z: 1 },
    animation: 'pulse',
  });

  // PR2 test clusters — behind PR1 shards, each layout + group animation
  clusterManager.createCluster({
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

  clusterManager.createCluster({
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

  clusterManager.createCluster({
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

  return {
    scene,
    shardManager,
    clusterManager,
    _orb: orb,
    _glow: glow,

    configureEffects(effects) {
      effects.applyPreset(NEXARIS_EFFECTS_PRESET);

      // Per-object glow / selective bloom
      effects.applyObjectEffect('orb', orb, {
        glow: true,
        bloom: true,
        pulseGlow: true,
        emissive: 0x44aaff,
        emissiveIntensity: 2.5,
      });
      effects.applyObjectEffect('orb_glow', glow, { glow: true, bloom: true });

      const alpha = shardManager.getShard('shard_alpha');
      const beta = shardManager.getShard('shard_beta');
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
    },

    update(_delta, time) {
      orb.position.y = Math.sin(time * 0.8) * 0.08;
      glow.position.copy(orb.position);
      orb.rotation.y = time * 0.25;
      glow.rotation.y = time * 0.15;
    },

    dispose() {
      shardManager.clear();
      clusterManager.clear();
    },
  };
}
