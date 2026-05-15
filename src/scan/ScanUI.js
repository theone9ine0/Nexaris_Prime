import { REQUIRED_PHOTO_SLOTS, OPTIONAL_PHOTO_SLOTS } from './types.js';

const SLOT_LABELS = {
  front: 'Front',
  left: 'Left profile',
  right: 'Right profile',
  back: 'Back',
  top: 'Top (optional)',
  expression: 'Expression (optional)',
};

/**
 * DOM upload panel for the scan chamber.
 */
export class ScanUI {
  /**
   * @param {HTMLElement | null} [container]
   * @param {{
   *   onPhotosChange?: (files: import('./types.js').PhotoSet) => void,
   *   onUploadAll?: () => void,
   *   onGenerate?: () => void,
   *   onExport?: () => void,
   *   onEnterWorld?: () => void,
   *   onStylizeFace?: () => void,
   * }} [callbacks]
   */
  constructor(container = document.getElementById('app'), callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'scan-ui hidden';

    const title = document.createElement('h2');
    title.className = 'scan-ui-title';
    title.textContent = 'Avatar Photogrammetry';

    const subtitle = document.createElement('p');
    subtitle.className = 'scan-ui-subtitle';
    subtitle.textContent =
      'Upload 360° body photos + front face. Nexaris builds a fictional anime-stylized VRM (non-realistic).';

    this.facePreviewWrap = document.createElement('div');
    this.facePreviewWrap.className = 'scan-face-preview hidden';
    const faceLabel = document.createElement('span');
    faceLabel.className = 'scan-face-preview-label';
    faceLabel.textContent = 'Stylized face preview';
    this.facePreviewImg = document.createElement('img');
    this.facePreviewImg.className = 'scan-face-preview-img';
    this.facePreviewImg.alt = 'Stylized face';
    this.facePreviewWrap.append(faceLabel, this.facePreviewImg);

    this.slotsEl = document.createElement('div');
    this.slotsEl.className = 'scan-slots';

    /** @type {Map<string, HTMLInputElement>} */
    this._inputs = new Map();
    /** @type {Map<string, HTMLImageElement>} */
    this._previews = new Map();

    for (const slot of [...REQUIRED_PHOTO_SLOTS, ...OPTIONAL_PHOTO_SLOTS]) {
      this.slotsEl.appendChild(this._createSlot(slot));
    }

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'scan-status';
    this.statusEl.textContent = 'Awaiting photos…';

    this.progressEl = document.createElement('div');
    this.progressEl.className = 'scan-progress hidden';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'scan-progress-fill';
    this.progressEl.appendChild(this.progressFill);

    const actions = document.createElement('div');
    actions.className = 'scan-actions';

    this.uploadBtn = document.createElement('button');
    this.uploadBtn.type = 'button';
    this.uploadBtn.className = 'scan-btn';
    this.uploadBtn.textContent = 'Upload Photos';
    this.uploadBtn.addEventListener('click', () => this.callbacks.onUploadAll?.());

    this.generateBtn = document.createElement('button');
    this.generateBtn.type = 'button';
    this.generateBtn.className = 'scan-btn scan-btn-primary';
    this.generateBtn.textContent = 'Generate Avatar';
    this.generateBtn.disabled = true;
    this.generateBtn.addEventListener('click', () => this.callbacks.onGenerate?.());

    this.stylizeBtn = document.createElement('button');
    this.stylizeBtn.type = 'button';
    this.stylizeBtn.className = 'scan-btn scan-btn-stylize';
    this.stylizeBtn.textContent = 'Stylize Face';
    this.stylizeBtn.disabled = true;
    this.stylizeBtn.title = 'Anime-style face from your front photo (fictional, not realistic)';
    this.stylizeBtn.addEventListener('click', () => this.callbacks.onStylizeFace?.());

    this.exportBtn = document.createElement('button');
    this.exportBtn.type = 'button';
    this.exportBtn.className = 'scan-btn';
    this.exportBtn.textContent = 'Export VRM';
    this.exportBtn.disabled = true;
    this.exportBtn.addEventListener('click', () => this.callbacks.onExport?.());

    this.worldBtn = document.createElement('button');
    this.worldBtn.type = 'button';
    this.worldBtn.className = 'scan-btn scan-btn-accent';
    this.worldBtn.textContent = 'Enter Main World';
    this.worldBtn.disabled = true;
    this.worldBtn.addEventListener('click', () => this.callbacks.onEnterWorld?.());

    actions.append(
      this.uploadBtn,
      this.generateBtn,
      this.stylizeBtn,
      this.exportBtn,
      this.worldBtn,
    );

    this.root.append(
      title,
      subtitle,
      this.facePreviewWrap,
      this.slotsEl,
      this.statusEl,
      this.progressEl,
      actions,
    );
    this.container?.appendChild(this.root);
  }

  /**
   * @param {string} slot
   */
  _createSlot(slot) {
    const wrap = document.createElement('label');
    wrap.className = 'scan-slot';

    const label = document.createElement('span');
    label.className = 'scan-slot-label';
    label.textContent = SLOT_LABELS[/** @type {keyof typeof SLOT_LABELS} */ (slot)] ?? slot;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'scan-slot-input';
    input.addEventListener('change', () => this._onSlotChange());

    const preview = document.createElement('img');
    preview.className = 'scan-slot-preview';
    preview.alt = slot;

    this._inputs.set(slot, input);
    this._previews.set(slot, preview);

    wrap.append(label, input, preview);
    return wrap;
  }

  _onSlotChange() {
    this.callbacks.onPhotosChange?.(this.getPhotoSet());
    this._validate();
  }

  /**
   * @returns {import('./types.js').PhotoSet}
   */
  getPhotoSet() {
    /** @type {import('./types.js').PhotoSet} */
    const set = {};
    for (const [slot, input] of this._inputs) {
      const file = input.files?.[0];
      if (file) set[/** @type {import('./types.js').PhotoSlot} */ (slot)] = file;
    }
    return set;
  }

  _validate() {
    const set = this.getPhotoSet();
    const ready = REQUIRED_PHOTO_SLOTS.every((s) => set[s]);
    const hasFront = !!set.front;
    this.generateBtn.disabled = !ready;
    this.stylizeBtn.disabled = !hasFront;
    if (ready) {
      this.setStatus('Ready to generate stylized avatar.');
    } else if (hasFront) {
      this.setStatus('Front face ready — generate body or stylize face after scan.');
    } else {
      const missing = REQUIRED_PHOTO_SLOTS.filter((s) => !set[s]);
      this.setStatus(`Need: ${missing.join(', ')}`);
    }
  }

  /**
   * @param {string} dataUrl
   */
  setFacePreview(dataUrl) {
    this.facePreviewImg.src = dataUrl;
    this.facePreviewWrap.classList.remove('hidden');
  }

  hideFacePreview() {
    this.facePreviewImg.removeAttribute('src');
    this.facePreviewWrap.classList.add('hidden');
  }

  /**
   * @param {boolean} enabled
   */
  setStylizeEnabled(enabled) {
    const set = this.getPhotoSet();
    this.stylizeBtn.disabled = !enabled && !set.front;
  }

  /**
   * @param {string} message
   */
  setStatus(message) {
    this.statusEl.textContent = message;
  }

  /**
   * @param {number} progress 0–1
   * @param {string} [label]
   */
  setProgress(progress, label) {
    this.progressEl.classList.remove('hidden');
    this.progressFill.style.width = `${Math.min(100, progress * 100)}%`;
    if (label) this.setStatus(label);
  }

  hideProgress() {
    this.progressEl.classList.add('hidden');
  }

  /**
   * @param {import('./types.js').PhotoPreviewSet} previews
   */
  updatePreviews(previews) {
    for (const [slot, img] of this._previews) {
      const url = previews[/** @type {import('./types.js').PhotoSlot} */ (slot)];
      if (url) {
        img.src = url;
        img.classList.add('has-image');
      } else {
        img.removeAttribute('src');
        img.classList.remove('has-image');
      }
    }
  }

  setComplete() {
    this.exportBtn.disabled = false;
    this.worldBtn.disabled = false;
    this.stylizeBtn.disabled = !this.getPhotoSet().front;
    this.generateBtn.disabled = true;
    this.hideProgress();
    this.setStatus('Avatar generated! Stylize face or enter the main world.');
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  /** Open file picker for first empty required slot. */
  triggerUploadDialog() {
    for (const slot of REQUIRED_PHOTO_SLOTS) {
      const input = this._inputs.get(slot);
      if (input && !input.files?.[0]) {
        input.click();
        return;
      }
    }
    this._inputs.get(REQUIRED_PHOTO_SLOTS[0])?.click();
  }

  dispose() {
    this.root.remove();
  }
}
