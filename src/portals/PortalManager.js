import * as THREE from 'three';
import { Portal } from './Portal.js';

/**
 * @typedef {import('./Portal.js').PortalOptions} PortalOptions
 * @typedef {import('../core/SceneManager.js').SceneManager} SceneManager
 */

/**
 * PR14 — tracks and updates portals within a scene.
 */
export class PortalManager {
  /**
   * @param {THREE.Scene} scene
   * @param {SceneManager | null} [sceneManager]
   */
  constructor(scene, sceneManager = null) {
    this.scene = scene;
    this.sceneManager = sceneManager;
    /** @type {Set<Portal>} */
    this.portals = new Set();
  }

  /**
   * @param {Omit<PortalOptions, 'sceneManager'>} options
   * @returns {Portal}
   */
  createPortal(options) {
    const portal = new Portal({
      ...options,
      sceneManager: options.sceneManager ?? this.sceneManager,
    });
    portal.addTo(this.scene);
    this.portals.add(portal);
    return portal;
  }

  /**
   * @param {Portal} portal
   */
  removePortal(portal) {
    if (!this.portals.has(portal)) return;
    portal.dispose();
    this.portals.delete(portal);
  }

  /**
   * @returns {Portal[]}
   */
  getPortals() {
    return [...this.portals];
  }

  /**
   * @param {number} elapsed
   */
  update(elapsed) {
    for (const portal of this.portals) {
      portal.update(elapsed);
    }
  }

  dispose() {
    for (const portal of [...this.portals]) {
      this.removePortal(portal);
    }
  }
}
