import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

/**
 * @typedef {import('@pixiv/three-vrm').VRM} VRM
 */

/**
 * @typedef {{
 *   vrm: VRM,
 *   gltf: import('three/examples/jsm/loaders/GLTFLoader.js').GLTF,
 * }} VRMLoadResult
 */

/**
 * PR35 — GLTFLoader wrapper with {@link VRMLoaderPlugin}.
 */
export class NexarisVRMLoader {
  constructor() {
    this._loader = new GLTFLoader();
    this._loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {string} url
   * @returns {Promise<VRMLoadResult>}
   */
  async parse(buffer, url) {
    const gltf = await this._loader.parseAsync(buffer, url);
    const vrm = gltf.userData.vrm;
    if (!vrm) {
      throw new Error(`No VRM data in "${url}"`);
    }

    NexarisVRMLoader.applyVRM0Orientation(vrm);

    return { vrm, gltf };
  }

  /**
   * @param {VRM} vrm
   */
  static applyVRM0Orientation(vrm) {
    const version = vrm.meta?.metaVersion;
    if (version === '0' || version === '0.0') {
      VRMUtils.rotateVRM0(vrm);
    }
  }
}

export const nexarisVRMLoader = new NexarisVRMLoader();
