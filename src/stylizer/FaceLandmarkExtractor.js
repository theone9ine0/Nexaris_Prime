import * as THREE from 'three';

/**
 * Heuristic landmark + color extraction from a front photo.
 * Uses region sampling only — no ML, no realistic reconstruction.
 */
export class FaceLandmarkExtractor {
  /**
   * @param {File | Blob | HTMLImageElement | string} photo
   * @returns {Promise<{
   *   landmarks: import('./types.js').FaceLandmark[],
   *   skinTone: number,
   *   hairColor: number,
   *   eyeColor: number,
   *   eyebrowCurve: number,
   *   faceWidth: number,
   *   faceHeight: number,
   *   eyeSpacing: number,
   *   eyeSize: number,
   *   imageData: ImageData,
   *   width: number,
   *   height: number,
   * }>}
   */
  static async extract(photo) {
    const { canvas, ctx, width, height } = await FaceLandmarkExtractor._loadToCanvas(photo);
    const imageData = ctx.getImageData(0, 0, width, height);

    const skinTone = FaceLandmarkExtractor._sampleRegion(imageData, 0.42, 0.38, 0.22, 0.28);
    const hairColor = FaceLandmarkExtractor._sampleRegion(imageData, 0.35, 0.02, 0.3, 0.18);
    const eyeColor = FaceLandmarkExtractor._blendSamples([
      FaceLandmarkExtractor._sampleRegion(imageData, 0.32, 0.32, 0.12, 0.1),
      FaceLandmarkExtractor._sampleRegion(imageData, 0.56, 0.32, 0.12, 0.1),
    ]);

    const faceBlob = FaceLandmarkExtractor._estimateFaceBounds(imageData);
    const landmarks = FaceLandmarkExtractor._buildLandmarkGrid(faceBlob, width, height);

    const leftEye = landmarks[17] ?? landmarks[0];
    const rightEye = landmarks[22] ?? landmarks[5];
    const eyeSpacing = Math.abs(leftEye.x - rightEye.x);
    const eyeSize = THREE.MathUtils.clamp(faceBlob.w * 0.12, 0.05, 0.18);

    return {
      landmarks,
      skinTone,
      hairColor,
      eyeColor,
      eyebrowCurve: THREE.MathUtils.clamp(0.35 + (landmarks[19].y - landmarks[17].y) * 2, 0.2, 0.9),
      faceWidth: faceBlob.w,
      faceHeight: faceBlob.h,
      eyeSpacing: THREE.MathUtils.clamp(eyeSpacing, 0.15, 0.45),
      eyeSize: THREE.MathUtils.clamp(eyeSize, 0.04, 0.2),
      imageData,
      width,
      height,
    };
  }

  /**
   * @param {File | Blob | HTMLImageElement | string} photo
   */
  static async _loadToCanvas(photo) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');

    let img;
    if (photo instanceof HTMLImageElement) {
      img = photo;
    } else {
      img = new Image();
      img.crossOrigin = 'anonymous';
      const url =
        typeof photo === 'string'
          ? photo
          : URL.createObjectURL(photo instanceof Blob ? photo : photo);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      if (typeof photo !== 'string') URL.revokeObjectURL(url);
    }

    const size = 256;
    const scale = size / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    canvas.width = Math.round((img.naturalWidth || img.width) * scale);
    canvas.height = Math.round((img.naturalHeight || img.height) * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return { canvas, ctx, width: canvas.width, height: canvas.height };
  }

  /**
   * @param {ImageData} imageData
   * @param {number} nx
   * @param {number} ny
   * @param {number} nw
   * @param {number} nh
   * @returns {number}
   */
  static _sampleRegion(imageData, nx, ny, nw, nh) {
    const { width, height, data } = imageData;
    const x0 = Math.floor(nx * width);
    const y0 = Math.floor(ny * height);
    const x1 = Math.floor((nx + nw) * width);
    const y1 = Math.floor((ny + nh) * height);

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * width + x) * 4;
        const a = data[i + 3];
        if (a < 32) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }

    if (count === 0) return 0xffccaa;
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * @param {number[]} samples
   */
  static _blendSamples(samples) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const hex of samples) {
      r += (hex >> 16) & 0xff;
      g += (hex >> 8) & 0xff;
      b += hex & 0xff;
    }
    r = Math.round(r / samples.length);
    g = Math.round(g / samples.length);
    b = Math.round(b / samples.length);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Brightness centroid for rough face bounds (normalized 0–1).
   * @param {ImageData} imageData
   */
  static _estimateFaceBounds(imageData) {
    const { width, height, data } = imageData;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let found = false;

    for (let y = Math.floor(height * 0.1); y < height * 0.9; y += 3) {
      for (let x = Math.floor(width * 0.15); x < width * 0.85; x += 3) {
        const i = (y * width + x) * 4;
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (lum > 60 && lum < 220 && data[i + 3] > 128) {
          found = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!found) {
      return { cx: 0.5, cy: 0.45, w: 0.5, h: 0.65 };
    }

    const cx = (minX + maxX) / 2 / width;
    const cy = (minY + maxY) / 2 / height;
    const w = (maxX - minX) / width;
    const h = (maxY - minY) / height;
    return { cx, cy, w: THREE.MathUtils.clamp(w, 0.35, 0.75), h: THREE.MathUtils.clamp(h, 0.45, 0.85) };
  }

  /**
   * Simplified 68-style landmark layout (normalized coords).
   * @param {{ cx: number, cy: number, w: number, h: number }} blob
   * @param {number} width
   * @param {number} height
   * @returns {import('./types.js').FaceLandmark[]}
   */
  static _buildLandmarkGrid(blob, width, height) {
    const landmarks = [];
    const { cx, cy, w, h } = blob;

    const add = (nx, ny) => {
      landmarks.push({
        x: THREE.MathUtils.clamp(cx + (nx - 0.5) * w, 0, 1),
        y: THREE.MathUtils.clamp(cy + (ny - 0.5) * h, 0, 1),
        z: 0,
      });
    };

    for (let i = 0; i < 17; i++) add(0.15 + (i / 16) * 0.7, 0.12 + Math.sin((i / 16) * Math.PI) * 0.04);
    for (let i = 0; i < 5; i++) add(0.28 + i * 0.04, 0.35);
    for (let i = 0; i < 5; i++) add(0.68 - i * 0.04, 0.35);
    add(0.36, 0.34);
    add(0.37, 0.36);
    add(0.38, 0.38);
    add(0.64, 0.34);
    add(0.63, 0.36);
    add(0.62, 0.38);
    add(0.5, 0.48);
    add(0.48, 0.58);
    add(0.5, 0.62);
    add(0.52, 0.58);
    add(0.42, 0.55);
    add(0.58, 0.55);

    while (landmarks.length < 68) {
      const t = landmarks.length / 68;
      add(0.5 + Math.sin(t * Math.PI * 4) * 0.01, 0.5 + Math.cos(t * Math.PI * 2) * 0.01);
    }

    return landmarks.slice(0, 68).map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z ?? 0,
    }));
  }
}
