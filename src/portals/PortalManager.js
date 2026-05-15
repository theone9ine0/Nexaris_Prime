import * as THREE from 'three';
import { Portal } from './Portal.js';
import { ProceduralPortal } from './ProceduralPortal.js';
import { getPortalThemeForDimension } from './portalThemes.js';
import { proceduralSceneIdFromSeed } from '../multiverse/proceduralSceneId.js';
import { SeededRandom } from '../multiverse/SeededRandom.js';

/**
 * @typedef {import('./Portal.js').PortalOptions} PortalOptions
 * @typedef {import('../core/SceneManager.js').SceneManager} SceneManager
 * @typedef {import('../multiverse/GeneratedScene.js').GeneratedScene} GeneratedScene
 */

/**
 * PR14 / PR14.5 — tracks static and procedural portals within a scene.
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
    /** @type {Set<Portal>} */
    this.proceduralPortals = new Set();
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
   * @param {Omit<PortalOptions, 'sceneManager' | 'isProcedural'> & {
   *   targetSeed: number,
   *   visualTheme?: string,
   * }} options
   * @returns {Portal}
   */
  createProceduralPortal(options) {
    const targetSceneId =
      options.targetSceneId ?? proceduralSceneIdFromSeed(options.targetSeed);
    const portal = ProceduralPortal.create({
      ...options,
      targetSceneId,
      sceneManager: this.sceneManager,
    });
    portal.addTo(this.scene);
    this.portals.add(portal);
    this.proceduralPortals.add(portal);
    return portal;
  }

  /**
   * @param {GeneratedScene | import('../scenes/SceneBase.js').SceneBase} parentScene
   * @param {number} [parentSeed]
   * @returns {Portal}
   */
  createRandomPortal(parentScene, parentSeed) {
    const baseSeed =
      parentSeed ??
      /** @type {GeneratedScene} */ (parentScene).seed ??
      Date.now();
    const rng = new SeededRandom((baseSeed ^ (performance.now() | 0)) >>> 0);
    const targetSeed = rng.int(0, 0xffffffff);
    const templateId =
      /** @type {GeneratedScene} */ (parentScene).template?.id ?? 'floatingIslands';
    const theme = getPortalThemeForDimension(templateId);

    return this.createProceduralPortal({
      id: `portal_random_${targetSeed}`,
      targetSeed,
      position: new THREE.Vector3(
        rng.range(-7, 7),
        rng.range(0.8, 2.2),
        rng.range(-7, 7),
      ),
      radius: rng.range(0.75, 1.15) * theme.radiusScale,
      visualTheme: templateId,
      frameStyle: theme.frameStyle,
      color: theme.color,
      colorOuter: theme.colorOuter,
    });
  }

  /**
   * Regenerate procedural portals for a dimension (keeps static portals).
   * @param {GeneratedScene} generatedScene
   * @param {number} parentSeed
   * @param {import('../multiverse/MultiverseGenerator.js').MultiverseGenerator} generator
   */
  regenerateProceduralPortals(generatedScene, parentSeed, generator) {
    for (const portal of [...this.proceduralPortals]) {
      this.removePortal(portal);
    }
    const rng = new SeededRandom(parentSeed);
    const portals = generator.generatePortals(
      generatedScene,
      rng,
      generatedScene.template,
      parentSeed,
      this,
    );
    generatedScene.portals = portals;
  }

  removePortal(portal) {
    if (!this.portals.has(portal)) return;
    portal.dispose();
    this.portals.delete(portal);
    this.proceduralPortals.delete(portal);
  }

  getPortals() {
    return [...this.portals];
  }

  getProceduralPortals() {
    return [...this.proceduralPortals];
  }

  update(elapsed) {
    for (const portal of this.portals) {
      portal.update(elapsed);
    }
  }

  dispose() {
    for (const portal of [...this.portals]) {
      this.removePortal(portal);
    }
    this.proceduralPortals.clear();
  }
}
