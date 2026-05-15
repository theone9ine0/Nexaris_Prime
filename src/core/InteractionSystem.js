import * as THREE from 'three';

/**
 * Objects that participate in raycast interaction (e.g. {@link import('../shards/Shard.js').Shard}).
 * @typedef {{
 *   id: string,
 *   mesh: THREE.Mesh,
 *   onHoverEnter?: () => void,
 *   onHoverExit?: () => void,
 *   onClick?: () => void,
 *   onSelect?: () => void,
 *   onDeselect?: () => void,
 * }} Interactive
 */

/**
 * @typedef {{
 *   camera: THREE.PerspectiveCamera,
 *   domElement: HTMLElement,
 *   inputSystem: import('./InputSystem.js').InputSystem,
 *   getScene?: () => import('../scenes/SceneBase.js').SceneBase | null,
 *   recursive?: boolean,
 * }} InteractionSystemOptions
 */

/**
 * PR12 — raycast hover, click, and selection for shards and future interactives.
 */
export class InteractionSystem {
  /**
   * @param {InteractionSystemOptions} options
   */
  constructor(options) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.inputSystem = options.inputSystem;
    this.getScene = options.getScene ?? (() => null);
    this.recursive = options.recursive ?? true;

    this.enabled = true;

    /** @type {Interactive | null} */
    this.hoveredObject = null;
    /** @type {Interactive | null} */
    this.selectedObject = null;

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    /** @type {THREE.Mesh[]} */
    this._meshTargets = [];
    /** @type {Map<THREE.Object3D, Interactive>} */
    this._meshToInteractive = new Map();

    this._mouseWasDown = false;

    /** @type {Set<(object: Interactive) => void>} */
    this._onHoverEnter = new Set();
    /** @type {Set<(object: Interactive) => void>} */
    this._onHoverExit = new Set();
    /** @type {Set<(object: Interactive) => void>} */
    this._onClick = new Set();
    /** @type {Set<(object: Interactive) => void>} */
    this._onSelect = new Set();
  }

  /**
   * @param {(object: Interactive) => void} callback
   */
  onHoverEnter(callback) {
    this._onHoverEnter.add(callback);
  }

  /**
   * @param {(object: Interactive) => void} callback
   */
  onHoverExit(callback) {
    this._onHoverExit.add(callback);
  }

  /**
   * @param {(object: Interactive) => void} callback
   */
  onClick(callback) {
    this._onClick.add(callback);
  }

  /**
   * @param {(object: Interactive) => void} callback
   */
  onSelect(callback) {
    this._onSelect.add(callback);
  }

  /**
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this._clearHover();
      this._mouseWasDown = false;
    }
  }

  /**
   * Release hover and selection (e.g. on scene change).
   */
  reset() {
    this._clearHover();
    this._clearSelection();
    this._meshTargets = [];
    this._meshToInteractive.clear();
  }

  /**
   * Gather interactive meshes from the active scene.
   */
  rebuildTargets() {
    this._meshTargets = [];
    this._meshToInteractive.clear();

    const interactives = InteractionSystem.collectInteractives(this.getScene());
    for (const object of interactives) {
      if (!object.mesh) continue;
      this._meshTargets.push(object.mesh);
      this._meshToInteractive.set(object.mesh, object);
      object.mesh.userData.interactive = object;
    }
  }

  /**
   * @param {import('../scenes/SceneBase.js').SceneBase | null} scene
   * @returns {Interactive[]}
   */
  static collectInteractives(scene) {
    if (!scene) return [];

    /** @type {Interactive[]} */
    const list = [];
    const seen = new Set();

    const add = (obj) => {
      if (!obj?.mesh || seen.has(obj.id)) return;
      seen.add(obj.id);
      list.push(obj);
    };

    for (const shard of scene.shardManager?.getAllShards() ?? []) {
      add(shard);
    }

    for (const cluster of scene.clusterManager?.getAllClusters() ?? []) {
      for (const shard of cluster.shards) {
        add(shard);
      }
    }

    for (const portal of scene.portalManager?.getPortals() ?? []) {
      if (portal._interactive) {
        add(portal._interactive);
      }
    }

    scene.scene?.traverse((child) => {
      const interactive = child.userData?.interactive;
      if (interactive?.mesh && !seen.has(interactive.id ?? child.uuid)) {
        seen.add(interactive.id ?? child.uuid);
        list.push(interactive);
      }
    });

    return list;
  }

  /**
   * @param {number} _deltaTime
   */
  update(_deltaTime) {
    if (!this.enabled) {
      this._mouseWasDown = this.inputSystem.isMouseDown(0);
      return;
    }

    const scene = this.getScene();
    if (!scene) {
      this._clearHover();
      this._mouseWasDown = false;
      return;
    }

    if (this._meshTargets.length === 0) {
      this.rebuildTargets();
    }

    this._updatePointerNdc();
    this._raycaster.setFromCamera(this._pointer, this.camera);

    const hits = this._raycaster.intersectObjects(this._meshTargets, this.recursive);
    const hit = hits.length > 0 ? this._resolveInteractive(hits[0].object) : null;

    if (hit !== this.hoveredObject) {
      if (this.hoveredObject) {
        this.hoveredObject.onHoverExit?.();
        for (const cb of this._onHoverExit) {
          cb(this.hoveredObject);
        }
      }
      this.hoveredObject = hit;
      if (hit) {
        hit.onHoverEnter?.();
        for (const cb of this._onHoverEnter) {
          cb(hit);
        }
      }
    }

    const mouseDown = this.inputSystem.isMouseDown(0);
    const clickEdge = mouseDown && !this._mouseWasDown;
    this._mouseWasDown = mouseDown;

    if (clickEdge) {
      if (hit) {
        hit.onClick?.();
        for (const cb of this._onClick) {
          cb(hit);
        }
        this._setSelected(hit);
      } else {
        this._clearSelection();
      }
    }
  }

  /**
   * @param {Interactive} object
   */
  _setSelected(object) {
    if (this.selectedObject === object) return;

    if (this.selectedObject) {
      this.selectedObject.onDeselect?.();
    }

    this.selectedObject = object;
    object.onSelect?.();
    for (const cb of this._onSelect) {
      cb(object);
    }
  }

  _clearSelection() {
    if (!this.selectedObject) return;
    this.selectedObject.onDeselect?.();
    this.selectedObject = null;
  }

  _clearHover() {
    if (!this.hoveredObject) return;
    this.hoveredObject.onHoverExit?.();
    for (const cb of this._onHoverExit) {
      cb(this.hoveredObject);
    }
    this.hoveredObject = null;
  }

  _updatePointerNdc() {
    if (document.pointerLockElement === this.domElement) {
      this._pointer.set(0, 0);
      return;
    }

    const { x, y } = this.inputSystem.mousePosition;
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this._pointer.set(0, 0);
      return;
    }

    this._pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * @param {THREE.Object3D} object
   * @returns {Interactive | null}
   */
  _resolveInteractive(object) {
    let current = object;
    while (current) {
      if (current.userData?.interactive) {
        return current.userData.interactive;
      }
      const mapped = this._meshToInteractive.get(current);
      if (mapped) return mapped;
      current = current.parent;
    }
    return null;
  }

  dispose() {
    this.reset();
    this._onHoverEnter.clear();
    this._onHoverExit.clear();
    this._onClick.clear();
    this._onSelect.clear();
    this.enabled = false;
  }
}
