import * as THREE from 'three';
import { SeededRandom } from './SeededRandom.js';
import { initNoise, fbm2D } from './noise.js';
import { DIMENSION_TEMPLATES } from './templates/index.js';
import { GeneratedScene } from './GeneratedScene.js';
import { PortalManager } from '../portals/PortalManager.js';
import { getPortalThemeForDimension } from '../portals/portalThemes.js';
import { proceduralSceneIdFromSeed } from './proceduralSceneId.js';

const WORLD_SIZE = 22;
const TERRAIN_SEGMENTS = 24;

/**
 * @typedef {import('./templates/index.js').DimensionTemplate} DimensionTemplate
 * @typedef {import('../core/SceneManager.js').SceneManager} SceneManager
 */

/**
 * @typedef {{
 *   scene: GeneratedScene,
 *   id: string,
 *   seed: number,
 *   templateId: string,
 * }} GenerateResult
 */

/**
 * PR29 — procedural dimension generator.
 */
export class MultiverseGenerator {
  /**
   * @param {{ sceneManager?: SceneManager }} [options]
   */
  constructor(options = {}) {
    this.sceneManager = options.sceneManager ?? null;
    this._counter = 0;
    /** @type {string[]} */
    this._generatedIds = [];
    this.maxCachedScenes = 5;
  }

  /**
   * @param {number} [seed]
   * @returns {GenerateResult}
   */
  generate(seed) {
    const t0 = performance.now();
    const resolvedSeed = (seed ?? Date.now()) >>> 0;
    const rng = new SeededRandom(resolvedSeed);
    initNoise(resolvedSeed);

    const template = rng.pick(DIMENSION_TEMPLATES);
    const id = proceduralSceneIdFromSeed(resolvedSeed);

    const terrainRoot = new THREE.Group();
    terrainRoot.name = 'terrain';
    const propsRoot = new THREE.Group();
    propsRoot.name = 'props';

    const scene = new GeneratedScene(id, {
      seed: resolvedSeed,
      template,
      terrainRoot,
      propsRoot,
      portals: [],
    });
    scene.sceneManagerRef = this.sceneManager;

    this.generateTerrain(scene, rng, template, terrainRoot);
    this.generateProps(scene, rng, template, propsRoot);
    scene.build();
    this.generateShards(scene, rng, template);
    this.generateNPCs(scene, rng, template);

    scene.portalManager = new PortalManager(scene.scene, this.sceneManager);
    const portals = this.generatePortals(
      scene,
      rng,
      template,
      resolvedSeed,
      scene.portalManager,
    );
    scene.portals = portals;

    const elapsed = performance.now() - t0;
    if (elapsed > 200) {
      console.warn(`[MultiverseGenerator] Generation took ${elapsed.toFixed(1)}ms (target <200ms)`);
    }

    this._trackGeneratedId(id);
    return { scene, id, seed: resolvedSeed, templateId: template.id };
  }

  /**
   * @param {GeneratedScene} scene
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {THREE.Group} root
   */
  generateTerrain(scene, rng, template, root) {
    switch (template.terrain) {
      case 'floating':
        this._terrainFloatingIslands(rng, template, root);
        break;
      case 'cavern':
        this._terrainCavernFloor(rng, template, root);
        break;
      case 'void':
        this._terrainVoidPlatforms(rng, template, root);
        break;
      case 'grid':
      default:
        this._terrainGrid(rng, template, root);
        break;
    }
  }

  /**
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {THREE.Group} root
   */
  _terrainFloatingIslands(rng, template, root) {
    const mat = new THREE.MeshStandardMaterial({
      color: template.palette.ground,
      roughness: 0.85,
      metalness: 0.1,
    });

    const islandCount = rng.int(4, 9);
    for (let i = 0; i < islandCount; i++) {
      const x = rng.range(-WORLD_SIZE * 0.4, WORLD_SIZE * 0.4);
      const z = rng.range(-WORLD_SIZE * 0.4, WORLD_SIZE * 0.4);
      const y = rng.range(0.5, 4);
      const w = rng.range(2, 5);
      const h = rng.range(0.4, 1.2);

      const island = new THREE.Mesh(
        new THREE.CylinderGeometry(w, w * 0.85, h, 8),
        mat,
      );
      island.position.set(x, y, z);
      island.receiveShadow = true;
      island.castShadow = true;
      root.add(island);
    }

    const main = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 5.5, 0.8, 12),
      mat,
    );
    main.position.set(0, 0, 0);
    main.receiveShadow = true;
    root.add(main);
  }

  /**
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {THREE.Group} root
   */
  _terrainCavernFloor(rng, template, root) {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = fbm2D(x * 0.12, z * 0.12, 3) * 1.8;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();

    const floor = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: template.palette.ground,
        roughness: 0.9,
        metalness: 0.15,
        flatShading: true,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    for (let i = 0; i < rng.int(3, 6); i++) {
      const stalactite = new THREE.Mesh(
        new THREE.ConeGeometry(rng.range(0.3, 0.8), rng.range(2, 5), 6),
        new THREE.MeshStandardMaterial({
          color: template.palette.accent,
          emissive: template.palette.accent,
          emissiveIntensity: 0.2,
          roughness: 0.4,
        }),
      );
      stalactite.position.set(
        rng.range(-8, 8),
        rng.range(3, 6),
        rng.range(-8, 8),
      );
      root.add(stalactite);
    }
  }

  /**
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {THREE.Group} root
   */
  _terrainGrid(rng, template, root) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
      new THREE.MeshStandardMaterial({
        color: template.palette.ground,
        roughness: 0.7,
        metalness: 0.35,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    const grid = new THREE.GridHelper(WORLD_SIZE, 22, template.palette.accent, template.palette.accent);
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    grid.position.y = 0.02;
    root.add(grid);

    const steps = 8;
    const step = WORLD_SIZE / steps;
    for (let gx = -steps; gx <= steps; gx++) {
      for (let gz = -steps; gz <= steps; gz++) {
        const h = fbm2D(gx * 0.35, gz * 0.35, 2);
        if (h < 0.2) continue;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(step * 0.85, h * 1.5, step * 0.85),
          new THREE.MeshStandardMaterial({
            color: template.palette.ground,
            emissive: template.palette.accent,
            emissiveIntensity: h * 0.15,
          }),
        );
        block.position.set(gx * step, h * 0.75, gz * step);
        root.add(block);
      }
    }
  }

  /**
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {THREE.Group} root
   */
  _terrainVoidPlatforms(rng, template, root) {
    const mat = new THREE.MeshStandardMaterial({
      color: template.palette.ground,
      roughness: 0.95,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
    });

    const center = new THREE.Mesh(new THREE.CircleGeometry(5, 24), mat);
    center.rotation.x = -Math.PI / 2;
    root.add(center);

    for (let i = 0; i < rng.int(5, 10); i++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(rng.range(1.5, 3), 0.15, rng.range(1.5, 3)),
        mat,
      );
      slab.position.set(
        rng.range(-9, 9),
        rng.range(-0.5, 2),
        rng.range(-9, 9),
      );
      slab.rotation.y = rng.range(0, Math.PI);
      root.add(slab);
    }
  }

  /**
   * @param {GeneratedScene} scene
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {THREE.Group} root
   */
  generateProps(scene, rng, template, root) {
    const count = Math.floor(template.propDensity * 40);
    for (let i = 0; i < count; i++) {
      const type = rng.pick(template.propTypes);
      const mesh = this._createPropMesh(type, template, rng);
      mesh.position.set(
        rng.range(-WORLD_SIZE * 0.42, WORLD_SIZE * 0.42),
        0,
        rng.range(-WORLD_SIZE * 0.42, WORLD_SIZE * 0.42),
      );
      mesh.rotation.y = rng.range(0, Math.PI * 2);
      mesh.scale.setScalar(rng.range(0.6, 1.4));
      root.add(mesh);
    }
  }

  /**
   * @param {string} type
   * @param {DimensionTemplate} template
   * @param {SeededRandom} rng
   * @returns {THREE.Mesh}
   */
  _createPropMesh(type, template, rng) {
    const accent = template.palette.accent;
    const ground = template.palette.ground;

    switch (type) {
      case 'tree': {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x4a3020 }),
        );
        trunk.position.y = 0.6;
        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(0.9, 1.6, 7),
          new THREE.MeshStandardMaterial({ color: ground }),
        );
        leaves.position.y = 1.6;
        const g = new THREE.Group();
        g.add(trunk, leaves);
        return /** @type {THREE.Mesh} */ (g);
      }
      case 'crystal':
        return new THREE.Mesh(
          new THREE.OctahedronGeometry(rng.range(0.25, 0.7), 0),
          new THREE.MeshStandardMaterial({
            color: accent,
            emissive: accent,
            emissiveIntensity: 0.45,
            roughness: 0.2,
            metalness: 0.5,
          }),
        );
      case 'console':
        return new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.5, 0.8),
          new THREE.MeshStandardMaterial({
            color: 0x222233,
            emissive: accent,
            emissiveIntensity: 0.35,
          }),
        );
      case 'ruins':
        return new THREE.Mesh(
          new THREE.BoxGeometry(rng.range(0.8, 2), rng.range(0.5, 2.5), rng.range(0.8, 2)),
          new THREE.MeshStandardMaterial({ color: ground, roughness: 0.95 }),
        );
      case 'artifact':
        return new THREE.Mesh(
          new THREE.TorusKnotGeometry(0.25, 0.08, 48, 8),
          new THREE.MeshStandardMaterial({
            color: accent,
            emissive: accent,
            emissiveIntensity: 0.5,
          }),
        );
      case 'rock':
      default:
        return new THREE.Mesh(
          new THREE.DodecahedronGeometry(rng.range(0.3, 0.9), 0),
          new THREE.MeshStandardMaterial({ color: ground, roughness: 0.95 }),
        );
    }
  }

  /**
   * @param {GeneratedScene} scene
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   */
  generateShards(scene, rng, template) {
    const count = rng.int(template.shardCount[0], template.shardCount[1]);
    const anim = template.shardAnimation;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const dist = rng.range(3, WORLD_SIZE * 0.38);
      scene.shardManager.createShard({
        id: `${scene.id}_shard_${i}`,
        color: template.palette.accent,
        position: {
          x: Math.cos(angle) * dist,
          y: rng.range(0.4, 2.5),
          z: Math.sin(angle) * dist,
        },
        animation: anim,
      });
    }
  }

  /**
   * @param {GeneratedScene} scene
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   */
  generateNPCs(scene, rng, template) {
    const count = rng.int(template.npcCount[0], template.npcCount[1]);
    /** @type {object[]} */
    const specs = [];

    for (let i = 0; i < count; i++) {
      specs.push({
        id: `${scene.id}_npc_${i}`,
        position: new THREE.Vector3(
          rng.range(-8, 8),
          0,
          rng.range(-8, 8),
        ),
        scale: rng.range(0.85, 1.05),
        state: rng.pick(['idle', 'wander', 'wander']),
        wanderRadius: rng.range(2.5, 5),
        tint: rng.int(0x444444, 0xffffff),
      });
    }

    scene.scene.userData.generatedNPCs = specs;
  }

  /**
   * @param {GeneratedScene} scene
   * @param {SeededRandom} rng
   * @param {DimensionTemplate} template
   * @param {number} parentSeed
   * @param {PortalManager} [portalManager]
   * @returns {import('../portals/Portal.js').Portal[]}
   */
  generatePortals(scene, rng, template, parentSeed, portalManager) {
    const count = rng.int(template.portalCount[0], template.portalCount[1]);
    const theme = getPortalThemeForDimension(template.id);
    const manager =
      portalManager ??
      scene.portalManager ??
      new PortalManager(scene.scene, this.sceneManager);

    /** @type {import('../portals/Portal.js').Portal[]} */
    const portals = [];

    const frameStyles = ['ring', 'arch', 'crystal', 'void', 'cyber'];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.range(0.2, 0.8);
      const dist = rng.range(5, 9);
      const targetSeed = ((parentSeed + i * 2654435761) ^ 0x9e3779b9) >>> 0;
      const targetSceneId = proceduralSceneIdFromSeed(targetSeed);
      const radius = rng.range(0.75, 1.15) * theme.radiusScale;
      const accentTint = template.palette.accent ^ (i * 0x111111);

      const portal = manager.createProceduralPortal({
        id: `${scene.id}_portal_${i}`,
        position: new THREE.Vector3(
          Math.cos(angle) * dist,
          rng.range(0.8, 2.2),
          Math.sin(angle) * dist,
        ),
        targetSceneId,
        targetSeed,
        radius,
        color: accentTint,
        colorOuter: theme.colorOuter,
        visualTheme: template.id,
        frameStyle: rng.pick(frameStyles),
      });
      portals.push(portal);
    }

    if (!scene.portalManager) {
      scene.portalManager = manager;
    }

    return portals;
  }

  /**
   * @param {string} id
   */
  _trackGeneratedId(id) {
    this._generatedIds.push(id);
    while (this._generatedIds.length > this.maxCachedScenes) {
      const oldId = this._generatedIds.shift();
      if (oldId) {
        this.sceneManager?.unregisterScene(oldId);
      }
    }
  }
}
