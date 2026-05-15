/**
 * Procedural sprite sheet texture for stylized combat VFX.
 * @param {number} [size]
 * @returns {HTMLCanvasElement}
 */
export function createCombatSpriteSheet(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size * 4;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const frames = [
    (c) => drawSpark(c, size),
    (c) => drawRing(c, size, size),
    (c) => drawBurst(c, size, size * 2),
    (c) => drawTrail(c, size, size * 3),
  ];

  for (let i = 0; i < frames.length; i++) {
    ctx.save();
    ctx.translate(i * size, 0);
    frames[i](ctx);
    ctx.restore();
  }

  return canvas;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} s
 */
function drawSpark(ctx, s) {
  const cx = s * 0.5;
  const cy = s * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.45);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(120, 220, 255, 0.9)');
  grad.addColorStop(1, 'rgba(80, 120, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  ctx.strokeStyle = 'rgba(255, 240, 180, 0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4);
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} s
 * @param {number} ox
 */
function drawRing(ctx, s, ox) {
  const cx = ox + s * 0.5;
  const cy = s * 0.5;
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.38);
  grad.addColorStop(0, 'rgba(180, 240, 255, 0.5)');
  grad.addColorStop(1, 'rgba(40, 80, 200, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} s
 * @param {number} ox
 */
function drawBurst(ctx, s, ox) {
  const cx = ox + s * 0.5;
  const cy = s * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.48);
  grad.addColorStop(0, 'rgba(255, 200, 120, 1)');
  grad.addColorStop(0.4, 'rgba(255, 100, 200, 0.7)');
  grad.addColorStop(1, 'rgba(120, 40, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} s
 * @param {number} ox
 */
function drawTrail(ctx, s, ox) {
  const cx = ox + s * 0.5;
  const cy = s * 0.5;
  const grad = ctx.createLinearGradient(cx - s * 0.3, cy, cx + s * 0.35, cy);
  grad.addColorStop(0, 'rgba(80, 180, 255, 0)');
  grad.addColorStop(0.5, 'rgba(200, 255, 255, 0.95)');
  grad.addColorStop(1, 'rgba(120, 80, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, cy - s * 0.12, s, s * 0.24);
}
