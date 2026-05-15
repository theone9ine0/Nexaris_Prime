import * as THREE from 'three';
import { Shard } from './Shard.js';
import {
  createYouTubeCss3dObject,
  setYouTubePlayback,
  parseYouTubeId,
  CSS3D_PIXELS_PER_UNIT,
} from './YouTubeShard.js';

/** @typedef {'youtube' | 'mp4'} VideoShardMode */

/**
 * @typedef {import('./Shard.js').ShardOptions & {
 *   mode: VideoShardMode,
 *   youtubeId?: string,
 *   src?: string,
 *   autoplay?: boolean,
 *   loop?: boolean,
 *   mute?: boolean,
 *   cssScene?: THREE.Scene | null,
 *   maxVideoWidth?: number,
 *   maxVideoHeight?: number,
 * }} VideoShardOptions
 */

const DEFAULT_MAX_W = 854;
const DEFAULT_MAX_H = 480;

/**
 * PR13 — Shard that plays YouTube (CSS3D) or MP4/WebM (VideoTexture) in-world.
 */
export class VideoShard extends Shard {
  /**
   * @param {VideoShardOptions} options
   */
  constructor(options) {
    const mode = options.mode;
    if (!mode || (mode !== 'youtube' && mode !== 'mp4')) {
      throw new Error('VideoShard requires mode: "youtube" | "mp4"');
    }

    const autoplay = options.autoplay !== false;
    const loop = options.loop !== false;
    const mute = options.mute !== false;
    const width = options.width ?? 1.6;
    const height = options.height ?? 0.9;

    if (mode === 'mp4') {
      const prepared = VideoShard._createMp4Texture(options);
      super({
        ...options,
        texture: prepared.texture,
        animation: options.animation ?? 'none',
        title: options.title,
        type: options.type ?? 'video',
        payload: { mode: 'mp4', src: options.src },
      });

      this.videoMode = mode;
      this.autoplay = autoplay;
      this.loop = loop;
      this.mute = mute;
      this._cssScene = options.cssScene ?? null;
      this._video = prepared.video;
      this._videoTexture = prepared.texture;
      this._iframe = null;
      this.cssObject = null;
      this._youtubePlaying = false;
      this._mp4Playing = autoplay && !prepared.video.paused;
    } else {
      super({
        ...options,
        color: 0x0a0a12,
        animation: options.animation ?? 'none',
        title: options.title,
        type: options.type ?? 'video',
        payload: {
          mode: 'youtube',
          youtubeId: parseYouTubeId(options.youtubeId ?? ''),
        },
        width,
        height,
      });

      this.videoMode = mode;
      this.autoplay = autoplay;
      this.loop = loop;
      this.mute = mute;
      this._cssScene = options.cssScene ?? null;
      this._video = null;
      this._videoTexture = null;
      this._iframe = null;
      this.cssObject = null;
      this._youtubePlaying = autoplay;
      this._mp4Playing = false;

      this._material.opacity = 0.08;
      this._material.transparent = true;
      this._setupYouTube(options, width, height);
    }

    this.metadata.type = 'video';
    this.metadata.payload = {
      mode: this.videoMode,
      youtubeId: options.youtubeId,
      src: options.src,
    };
  }

  /**
   * @param {VideoShardOptions} options
   * @returns {{ video: HTMLVideoElement, texture: THREE.VideoTexture }}
   */
  static _createMp4Texture(options) {
    if (!options.src) {
      throw new Error('VideoShard mp4 mode requires options.src');
    }

    const maxW = options.maxVideoWidth ?? DEFAULT_MAX_W;
    const maxH = options.maxVideoHeight ?? DEFAULT_MAX_H;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.loop = options.loop !== false;
    video.muted = options.mute !== false;
    video.autoplay = options.autoplay !== false;
    video.playsInline = true;
    video.preload = 'metadata';
    video.width = maxW;
    video.height = maxH;
    video.src = options.src;

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    if (video.autoplay) {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }

    return { video, texture };
  }

  /**
   * @param {VideoShardOptions} options
   * @param {number} width
   * @param {number} height
   */
  _setupYouTube(options, width, height) {
    const youtubeId = parseYouTubeId(options.youtubeId ?? '');
    if (!youtubeId) {
      throw new Error('VideoShard youtube mode requires youtubeId');
    }

    const { iframe, cssObject } = createYouTubeCss3dObject(youtubeId, width, height, {
      autoplay: this.autoplay,
      loop: this.loop,
      mute: this.mute,
    });

    this._iframe = iframe;
    this.cssObject = cssObject;
    this._youtubePlaying = this.autoplay;
  }

  /**
   * @param {THREE.Scene | null} cssScene
   */
  setCssScene(cssScene) {
    if (this.cssObject && this._cssScene && this._cssScene !== cssScene) {
      this._cssScene.remove(this.cssObject);
    }
    this._cssScene = cssScene;
    if (this.cssObject && cssScene && !cssScene.children.includes(this.cssObject)) {
      cssScene.add(this.cssObject);
      this._syncCssObject();
    }
  }

  addTo(parent) {
    super.addTo(parent);
    if (this.cssObject && this._cssScene) {
      this._cssScene.add(this.cssObject);
      this._syncCssObject();
    }
  }

  removeFrom(parent) {
    if (this.cssObject && this._cssScene) {
      this._cssScene.remove(this.cssObject);
    }
    super.removeFrom(parent);
  }

  onClick() {
    super.onClick();
    this.togglePlayback();
  }

  togglePlayback() {
    if (this.videoMode === 'mp4' && this._video) {
      if (this._video.paused) {
        this._video.play().catch(() => {});
        this._mp4Playing = true;
      } else {
        this._video.pause();
        this._mp4Playing = false;
      }
      return;
    }

    if (this.videoMode === 'youtube' && this._iframe) {
      this._youtubePlaying = !this._youtubePlaying;
      setYouTubePlayback(this._iframe, this._youtubePlaying);
    }
  }

  isPlaying() {
    if (this.videoMode === 'mp4') {
      return this._video ? !this._video.paused : false;
    }
    return this._youtubePlaying;
  }

  _syncCssObject() {
    if (!this.cssObject) return;

    this.root.updateWorldMatrix(true, false);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    this.root.matrixWorld.decompose(position, quaternion, scale);

    this.cssObject.position.copy(position);
    this.cssObject.quaternion.copy(quaternion);
    this.cssObject.scale.set(
      scale.x / CSS3D_PIXELS_PER_UNIT,
      scale.y / CSS3D_PIXELS_PER_UNIT,
      scale.z,
    );
  }

  /**
   * @param {number} deltaTime
   */
  updateAnimation(deltaTime) {
    super.updateAnimation(deltaTime);

    if (this._videoTexture && this._video && !this._video.paused) {
      this._videoTexture.needsUpdate = true;
    }

    if (this.cssObject) {
      this._syncCssObject();
    }
  }

  dispose() {
    if (this.cssObject && this._cssScene) {
      this._cssScene.remove(this.cssObject);
    }
    if (this.cssObject?.element?.parentNode) {
      this.cssObject.element.remove();
    }
    this.cssObject = null;
    this._iframe = null;

    if (this._video) {
      this._video.pause();
      this._video.removeAttribute('src');
      this._video.load();
      this._video = null;
    }

    if (this._videoTexture) {
      this._videoTexture.dispose();
      this._videoTexture = null;
    }

    super.dispose();
  }
}
