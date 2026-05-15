import * as THREE from 'three';

export const ANCHOR_VERSION = 1;

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 *   z: number,
 * }} Vec3
 */

/**
 * @typedef {{
 *   id: string,
 *   title?: string,
 *   content?: string,
 *   color?: number,
 *   position: Vec3,
 *   rotation: Vec3,
 *   scale: Vec3 | number,
 *   animation?: string,
 * }} ShardSnapshot
 */

/**
 * @typedef {{
 *   id: string,
 *   layout?: string,
 *   layoutOptions?: { radius?: number, spacing?: number },
 *   position: Vec3,
 *   rotation: Vec3,
 *   scale: Vec3 | number,
 *   animation?: string[] | string,
 *   shardSpecs: ShardSnapshot[],
 * }} ClusterSnapshot
 */

/**
 * @typedef {{
 *   version: number,
 *   id: string,
 *   sceneId: string | null,
 *   label?: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   camera: {
 *     position: Vec3,
 *     rotation: Vec3,
 *     fov: number,
 *   },
 *   shards: ShardSnapshot[],
 *   clusters: ClusterSnapshot[],
 * }} AnchorSnapshot
 */

/**
 * @param {THREE.Vector3 | THREE.Euler} v
 * @returns {Vec3}
 */
export function vec3From(v) {
  return { x: v.x, y: v.y, z: v.z };
}

/**
 * @param {THREE.Vector3} scale
 * @returns {Vec3 | number}
 */
export function scaleFrom(scale) {
  if (
    Math.abs(scale.x - scale.y) < 1e-6 &&
    Math.abs(scale.y - scale.z) < 1e-6
  ) {
    return scale.x;
  }
  return vec3From(scale);
}

/**
 * @param {import('../world/Shard.js').Shard} shard
 * @returns {ShardSnapshot}
 */
export function serializeShard(shard) {
  /** @type {ShardSnapshot} */
  const snap = {
    id: shard.id,
    title: shard.title ?? undefined,
    content: shard.content ?? undefined,
    position: vec3From(shard.root.position),
    rotation: vec3From(shard.root.rotation),
    scale: scaleFrom(shard.root.scale),
    animation: shard.animation,
  };

  const color = getShardColor(shard);
  if (color !== undefined) {
    snap.color = color;
  }

  return snap;
}

/**
 * @param {import('../world/Cluster.js').Cluster} cluster
 * @returns {ClusterSnapshot}
 */
export function serializeCluster(cluster) {
  return {
    id: cluster.id,
    layout: cluster.layout,
    layoutOptions: { ...cluster.layoutOptions },
    position: vec3From(cluster.root.position),
    rotation: vec3From(cluster.root.rotation),
    scale: scaleFrom(cluster.root.scale),
    animation:
      cluster.animations.length === 0
        ? 'none'
        : [...cluster.animations],
    shardSpecs: cluster.shards.map((s) => serializeShard(s)),
  };
}

/**
 * @param {import('../world/Shard.js').Shard} shard
 * @returns {number | undefined}
 */
export function getShardColor(shard) {
  const mat = shard._material;
  if (!mat) return undefined;
  if (mat.map) return undefined;
  if (mat.color?.isColor) {
    return mat.color.getHex();
  }
  return undefined;
}

/**
 * @param {{
 *   sceneId: string | null,
 *   anchorId: string,
 *   label?: string,
 *   camera: THREE.PerspectiveCamera,
 *   shardManager?: import('../shards/ShardManager.js').ShardManager,
 *   clusterManager?: import('../world/ClusterManager.js').ClusterManager,
 * }} source
 * @returns {AnchorSnapshot}
 */
export function captureSnapshot(source) {
  const shards = [];
  const clusters = [];

  if (source.clusterManager) {
    for (const cluster of source.clusterManager.getAllClusters()) {
      clusters.push(serializeCluster(cluster));
    }
  }

  if (source.shardManager) {
    for (const shard of source.shardManager.getAllShards()) {
      shards.push(serializeShard(shard));
    }
  }

  const now = new Date().toISOString();

  return {
    version: ANCHOR_VERSION,
    id: source.anchorId,
    sceneId: source.sceneId,
    label: source.label,
    createdAt: now,
    updatedAt: now,
    camera: {
      position: vec3From(source.camera.position),
      rotation: vec3From(source.camera.rotation),
      fov: source.camera.fov,
    },
    shards,
    clusters,
  };
}

/**
 * @param {unknown} data
 * @returns {AnchorSnapshot}
 */
export function parseAnchorJson(data) {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid anchor JSON');
  }
  if (!parsed.id) {
    throw new Error('Anchor JSON requires id');
  }
  if (parsed.version !== ANCHOR_VERSION) {
    throw new Error(`Unsupported anchor version: ${parsed.version}`);
  }
  return /** @type {AnchorSnapshot} */ (parsed);
}
