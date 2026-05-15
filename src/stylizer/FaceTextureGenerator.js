import * as THREE from 'three';

/**
 * Procedural toon face texture (512²) — anime style, non-photorealistic.
 */
export class FaceTextureGenerator {
  /**
   * @param {import('./types.js').StylizedFaceParams} params
   * @param {number} [size=512]
   * @returns {{ canvas: HTMLCanvasElement, texture: THREE.CanvasTexture }}
   */
  static generate(params, size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');

    const { base, shadow, highlight } = params.skinGradient;

    const grad = ctx.createRadialGradient(size * 0.5, size * 0.42, size * 0.05, size * 0.5, size * 0.45, size * 0.48);
    grad.addColorStop(0, FaceTextureGenerator._hex(highlight));
    grad.addColorStop(0.55, FaceTextureGenerator._hex(base));
    grad.addColorStop(1, FaceTextureGenerator._hex(shadow));

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = FaceTextureGenerator._hex(shadow);
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.72, size * 0.22, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (params.blushIntensity > 0) {
      ctx.globalAlpha = params.blushIntensity * 0.35;
      ctx.fillStyle = '#ff8899';
      ctx.beginPath();
      ctx.ellipse(size * 0.32, size * 0.52, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(size * 0.68, size * 0.52, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const eyeY = size * 0.38;
    const eyeSpacing = params.eyeVariant === 'wide' ? 0.2 : params.eyeVariant === 'round' ? 0.16 : 0.18;
    const eyeW = params.eyeVariant === 'wide' ? 0.14 : 0.11;
    const eyeH = params.eyeVariant === 'round' ? 0.13 : 0.1;

    FaceTextureGenerator._drawAnimeEye(ctx, size * (0.5 - eyeSpacing), eyeY, eyeW * size, eyeH * size, params.eyeColor);
    FaceTextureGenerator._drawAnimeEye(ctx, size * (0.5 + eyeSpacing), eyeY, eyeW * size, eyeH * size, params.eyeColor);

    FaceTextureGenerator._drawEyebrows(ctx, size, params);
    FaceTextureGenerator._drawNose(ctx, size);
    FaceTextureGenerator._drawMouth(ctx, size);

    ctx.strokeStyle = 'rgba(80, 120, 180, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    return { canvas, texture };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} w
   * @param {number} h
   * @param {number} irisHex
   */
  static _drawAnimeEye(ctx, cx, cy, w, h, irisHex) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.5, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    const irisGrad = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.35);
    irisGrad.addColorStop(0, FaceTextureGenerator._hex(irisHex, 1.2));
    irisGrad.addColorStop(0.7, FaceTextureGenerator._hex(irisHex));
    irisGrad.addColorStop(1, '#1a2233');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.32, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.05, w * 0.12, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.12, cy - h * 0.12, w * 0.1, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.08, cy + h * 0.08, w * 0.04, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(20, 30, 50, 0.85)';
    ctx.lineWidth = Math.max(1.5, w * 0.04);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.48, h * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} size
   * @param {import('./types.js').StylizedFaceParams} params
   */
  static _drawEyebrows(ctx, size, params) {
    const y = size * 0.3;
    const curve = params.eyebrowStyle === 'sharp' ? 8 : params.eyebrowStyle === 'gentle' ? 3 : 5;
    ctx.strokeStyle = FaceTextureGenerator._hex(params.hairColor, 0.7);
    ctx.lineWidth = params.eyebrowStyle === 'sharp' ? 3.5 : 2.5;
    ctx.lineCap = 'round';

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(size * (0.5 + side * 0.2), y);
      ctx.quadraticCurveTo(size * (0.5 + side * 0.14), y - curve, size * (0.5 + side * 0.08), y + 2);
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} size
   */
  static _drawNose(ctx, size) {
    ctx.strokeStyle = 'rgba(60, 50, 70, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.48);
    ctx.lineTo(size * 0.5, size * 0.54);
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} size
   */
  static _drawMouth(ctx, size) {
    ctx.strokeStyle = 'rgba(180, 90, 110, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.62, size * 0.04, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  /**
   * @param {number} hex
   * @param {number} [lighten=0]
   */
  static _hex(hex, lighten = 0) {
    const c = new THREE.Color(hex);
    if (lighten) c.offsetHSL(0, 0, lighten);
    return `#${c.getHexString()}`;
  }
}
