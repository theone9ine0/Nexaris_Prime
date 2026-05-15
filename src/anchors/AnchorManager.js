import {
  ANCHOR_VERSION,
  captureSnapshot,
  parseAnchorJson,
} from './AnchorSerializer.js';

/**
 * @typedef {{
 *   id: string,
 *   sceneId: string | null,
 *   label?: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   shardCount: number,
 *   clusterCount: number,
 * }} AnchorInfo
 */

/**
 * Saves, loads, and lists anchored world snapshots as JSON.
 */
export class AnchorManager {
  /**
   * @param {{
   *   sceneManager: import('../core/SceneManager.js').SceneManager,
   *   persist?: boolean,
   *   storageKey?: string,
   * }} options
   */
  constructor(options) {
    this.sceneManager = options.sceneManager;
    this.persist = options.persist ?? true;
    this.storageKey = options.storageKey ?? 'nexaris_prime_anchors';

    /** @type {Map<string, import('./AnchorSerializer.js').AnchorSnapshot>} */
    this._anchors = new Map();

    if (this.persist) {
      this._loadFromStorage();
    }
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      for (const entry of list) {
        const snap = parseAnchorJson(entry);
        this._anchors.set(snap.id, snap);
      }
    } catch {
      // ignore corrupt storage
    }
  }

  _persistToStorage() {
    if (!this.persist) return;
    const list = [...this._anchors.values()];
    localStorage.setItem(this.storageKey, JSON.stringify(list));
  }

  /**
   * @returns {import('../scene/SceneManager.js').SceneManager['activeScene']}
   */
  _requireActiveWorld() {
    const world = this.sceneManager.getActiveWorld();
    if (!world.shardManager) {
      throw new Error('Active scene has no shard manager — cannot anchor');
    }
    return world;
  }

  /**
   * Capture and store the current scene state.
   * @param {string} anchorId
   * @param {{ label?: string, merge?: boolean }} [options]
   * @returns {import('./AnchorSerializer.js').AnchorSnapshot}
   */
  save(anchorId, options = {}) {
    if (!anchorId) {
      throw new Error('save requires anchorId');
    }

    const world = this._requireActiveWorld();
    const existing = this._anchors.get(anchorId);

    const snap = captureSnapshot({
      sceneId: world.sceneId,
      anchorId,
      label: options.label ?? existing?.label,
      camera: this.sceneManager.camera,
      shardManager: world.shardManager,
      clusterManager: world.clusterManager,
    });

    if (existing && options.merge) {
      snap.createdAt = existing.createdAt;
    } else if (existing) {
      snap.createdAt = existing.createdAt;
    }

    snap.updatedAt = new Date().toISOString();
    this._anchors.set(anchorId, snap);
    this._persistToStorage();
    return snap;
  }

  /**
   * Restore a saved anchor into the active scene.
   * @param {string} anchorId
   * @returns {import('./AnchorSerializer.js').AnchorSnapshot}
   */
  load(anchorId) {
    const snap = this._anchors.get(anchorId);
    if (!snap) {
      throw new Error(`Anchor not found: ${anchorId}`);
    }

    const world = this._requireActiveWorld();

    if (snap.sceneId && world.sceneId && snap.sceneId !== world.sceneId) {
      throw new Error(
        `Anchor scene "${snap.sceneId}" does not match active "${world.sceneId}"`,
      );
    }

    world.shardManager.clear();
    world.clusterManager?.clear();

    if (world.clusterManager) {
      for (const cluster of snap.clusters) {
        world.clusterManager.createCluster({
          id: cluster.id,
          layout: /** @type {'circle' | 'spiral' | 'grid'} */ (cluster.layout ?? 'circle'),
          layoutOptions: cluster.layoutOptions,
          position: cluster.position,
          rotation: cluster.rotation,
          scale: cluster.scale,
          animation: cluster.animation,
          shardSpecs: cluster.shardSpecs.map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            color: s.color,
            position: s.position,
            rotation: s.rotation,
            scale: s.scale,
            animation: /** @type {import('../world/Shard.js').ShardData['animation']} */ (
              s.animation
            ),
          })),
        });
      }
    }

    for (const shard of snap.shards) {
      world.shardManager.createShard({
        id: shard.id,
        title: shard.title,
        content: shard.content,
        color: shard.color,
        position: shard.position,
        rotation: shard.rotation,
        scale: shard.scale,
        animation: /** @type {import('../world/Shard.js').ShardData['animation']} */ (
          shard.animation
        ),
      });
    }

    const cam = snap.camera;
    this.sceneManager.camera.position.set(
      cam.position.x,
      cam.position.y,
      cam.position.z,
    );
    this.sceneManager.camera.rotation.set(
      cam.rotation.x,
      cam.rotation.y,
      cam.rotation.z,
    );
    this.sceneManager.camera.fov = cam.fov;
    this.sceneManager.camera.updateProjectionMatrix();

    this.sceneManager.rebindSystems();
    return snap;
  }

  /**
   * @returns {AnchorInfo[]}
   */
  list() {
    return [...this._anchors.values()]
      .map((snap) => ({
        id: snap.id,
        sceneId: snap.sceneId,
        label: snap.label,
        createdAt: snap.createdAt,
        updatedAt: snap.updatedAt,
        shardCount: snap.shards.length,
        clusterCount: snap.clusters.length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * @returns {string[]}
   */
  listIds() {
    return this.list().map((a) => a.id);
  }

  /**
   * @param {string} anchorId
   * @returns {import('./AnchorSerializer.js').AnchorSnapshot | undefined}
   */
  get(anchorId) {
    return this._anchors.get(anchorId);
  }

  /**
   * @param {string} anchorId
   * @returns {boolean}
   */
  has(anchorId) {
    return this._anchors.has(anchorId);
  }

  /**
   * @param {string} anchorId
   * @returns {boolean}
   */
  delete(anchorId) {
    const removed = this._anchors.delete(anchorId);
    if (removed) {
      this._persistToStorage();
    }
    return removed;
  }

  /**
   * @param {string} anchorId
   * @param {number} [space]
   * @returns {string}
   */
  toJSON(anchorId, space = 2) {
    const snap = this._anchors.get(anchorId);
    if (!snap) {
      throw new Error(`Anchor not found: ${anchorId}`);
    }
    return JSON.stringify(snap, null, space);
  }

  /**
   * @param {string} json
   * @returns {import('./AnchorSerializer.js').AnchorSnapshot}
   */
  fromJSON(json) {
    const snap = parseAnchorJson(json);
    if (snap.version !== ANCHOR_VERSION) {
      throw new Error(`Unsupported anchor version: ${snap.version}`);
    }
    snap.updatedAt = new Date().toISOString();
    if (!snap.createdAt) {
      snap.createdAt = snap.updatedAt;
    }
    this._anchors.set(snap.id, snap);
    this._persistToStorage();
    return snap;
  }

  /**
   * @returns {string}
   */
  exportAll() {
    return JSON.stringify(
      {
        version: ANCHOR_VERSION,
        anchors: [...this._anchors.values()],
      },
      null,
      2,
    );
  }

  /**
   * @param {string} json
   * @returns {number} count imported
   */
  importAll(json) {
    const parsed = JSON.parse(json);
    const anchors = parsed.anchors ?? parsed;
    if (!Array.isArray(anchors)) {
      throw new Error('importAll expects { anchors: [] } or an array');
    }
    let count = 0;
    for (const entry of anchors) {
      this.fromJSON(JSON.stringify(entry));
      count++;
    }
    return count;
  }
}
