/**
 * Mock texture stitching from multi-angle photos (canvas composite).
 */
export class MockTextureStitcher {
  /**
   * @param {import('../types.js').PhotoPreviewSet} previewUrls
   * @param {{ size?: number }} [options]
   * @returns {Promise<HTMLCanvasElement>}
   */
  async stitch(previewUrls, options = {}) {
    const size = options.size ?? 512;
    await this._delay(650);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#1a2844');
    grad.addColorStop(0.5, '#334466');
    grad.addColorStop(1, '#1a2844');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const slots = [
      { key: 'front', x: 0.25, y: 0.28, w: 0.5, h: 0.44 },
      { key: 'left', x: 0.02, y: 0.3, w: 0.22, h: 0.4 },
      { key: 'right', x: 0.76, y: 0.3, w: 0.22, h: 0.4 },
      { key: 'back', x: 0.25, y: 0.02, w: 0.5, h: 0.22 },
      { key: 'top', x: 0.35, y: 0.72, w: 0.3, h: 0.2 },
      { key: 'expression', x: 0.68, y: 0.72, w: 0.28, h: 0.22 },
    ];

    for (const slot of slots) {
      const url = previewUrls[/** @type {keyof typeof previewUrls} */ (slot.key)];
      if (!url) continue;
      await this._drawPhoto(ctx, url, size, slot);
    }

    ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, size - 8, size - 8);

    return canvas;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} url
   * @param {number} size
   * @param {{ x: number, y: number, w: number, h: number }} rect
   */
  async _drawPhoto(ctx, url, size, rect) {
    try {
      const img = await this._loadImage(url);
      const x = rect.x * size;
      const y = rect.y * size;
      const w = rect.w * size;
      const h = rect.h * size;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const scale = Math.max(w / img.width, h / img.height) * 1.1;
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.filter = 'saturate(1.15) contrast(1.05) brightness(1.05)';
      ctx.drawImage(img, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh);
      ctx.filter = 'none';

      ctx.fillStyle = 'rgba(80, 160, 255, 0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    } catch {
      // skip failed image load
    }
  }

  /**
   * @param {string} url
   * @returns {Promise<HTMLImageElement>}
   */
  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  _delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
