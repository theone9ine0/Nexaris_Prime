import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/** Pixels per world unit for CSS3D sizing. */
export const CSS3D_PIXELS_PER_UNIT = 200;

/**
 * Extract a YouTube video id from a raw id or URL.
 * @param {string} input
 * @returns {string}
 */
export function parseYouTubeId(input) {
  if (!input) return '';
  if (/^[\w-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.slice(1).split('/')[0];
    }
    const v = url.searchParams.get('v');
    if (v) return v;
    const embed = url.pathname.match(/\/embed\/([\w-]{11})/);
    if (embed) return embed[1];
  } catch {
    // not a URL
  }

  return input;
}

/**
 * Build an embed URL with autoplay, loop, mute, and JS API for play/pause.
 * @param {string} videoId
 * @param {{ autoplay?: boolean, loop?: boolean, mute?: boolean }} [options]
 */
export function buildYouTubeEmbedUrl(videoId, options = {}) {
  const autoplay = options.autoplay !== false ? 1 : 0;
  const loop = options.loop !== false ? 1 : 0;
  const mute = options.mute !== false ? 1 : 0;
  const params = new URLSearchParams({
    enablejsapi: '1',
    controls: '0',
    autoplay: String(autoplay),
    mute: String(mute),
    loop: String(loop),
    playlist: videoId,
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * @param {string} videoId
 * @param {number} width world units
 * @param {number} height world units
 * @param {{ autoplay?: boolean, loop?: boolean, mute?: boolean }} [options]
 * @returns {{ element: HTMLDivElement, iframe: HTMLIFrameElement, cssObject: CSS3DObject }}
 */
export function createYouTubeCss3dObject(videoId, width, height, options = {}) {
  const id = parseYouTubeId(videoId);
  const pxW = Math.round(width * CSS3D_PIXELS_PER_UNIT);
  const pxH = Math.round(height * CSS3D_PIXELS_PER_UNIT);

  const element = document.createElement('di' + 'v');
  element.className = 'video-shard-youtube';
  element.style.width = `${pxW}px`;
  element.style.height = `${pxH}px`;
  element.style.overflow = 'hidden';
  element.style.borderRadius = '4px';
  element.style.background = '#000';
  element.style.pointerEvents = 'none';

  const iframe = document.createElement('iframe');
  iframe.src = buildYouTubeEmbedUrl(id, options);
  iframe.width = String(pxW);
  iframe.height = String(pxH);
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.title = 'YouTube video';

  element.appendChild(iframe);

  const cssObject = new CSS3DObject(element);
  cssObject.scale.set(1 / CSS3D_PIXELS_PER_UNIT, 1 / CSS3D_PIXELS_PER_UNIT, 1);
  cssObject.name = `youtube:${id}`;

  return { element, iframe, cssObject };
}

/**
 * PostMessage play/pause for YouTube iframe (requires enablejsapi=1).
 * @param {HTMLIFrameElement} iframe
 * @param {boolean} play
 */
export function setYouTubePlayback(iframe, play) {
  const cmd = play ? 'playVideo' : 'pauseVideo';
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func: cmd, args: [] }),
    '*',
  );
}
