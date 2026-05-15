/**
 * @typedef {'front' | 'left' | 'right' | 'back' | 'top' | 'expression'} PhotoSlot
 */

/**
 * @typedef {Partial<Record<PhotoSlot, File | Blob>>} PhotoSet
 */

/**
 * @typedef {Partial<Record<PhotoSlot, string>>} PhotoPreviewSet
 */

/**
 * @typedef {{
 *   height: number,
 *   shoulderWidth: number,
 *   stylization: number,
 * }} BodyEstimate
 */

/**
 * @typedef {{
 *   scanId: string,
 *   scanUrl: string,
 *   bodyEstimate: BodyEstimate,
 *   texture?: THREE.CanvasTexture,
 * }} ScanResult
 */

export const REQUIRED_PHOTO_SLOTS = ['front', 'left', 'right', 'back'];

export const OPTIONAL_PHOTO_SLOTS = ['top', 'expression'];
