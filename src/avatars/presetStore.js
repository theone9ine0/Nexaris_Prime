const STORAGE_KEY = 'nexaris_avatar_presets';
const PRESET_VERSION = 1;

/**
 * @typedef {import('./AvatarCustomizer.js').AvatarCustomizationConfig} AvatarCustomizationConfig
 */

/**
 * In-memory + localStorage preset storage for avatar customization.
 */
export class AvatarPresetStore {
  /**
   * @param {string} [storageKey]
   */
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    /** @type {Map<string, AvatarCustomizationConfig>} */
    this._presets = new Map();
    this._loadFromStorage();
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data?.presets) return;
      for (const [name, config] of Object.entries(data.presets)) {
        this._presets.set(name, config);
      }
    } catch {
      // ignore corrupt storage
    }
  }

  _persist() {
    const presets = Object.fromEntries(this._presets.entries());
    localStorage.setItem(
      this.storageKey,
      JSON.stringify({ version: PRESET_VERSION, presets }),
    );
  }

  /**
   * @param {string} name
   * @param {AvatarCustomizationConfig} config
   */
  savePreset(name, config) {
    if (!name) throw new Error('savePreset requires name');
    this._presets.set(name, structuredClone(config));
    this._persist();
  }

  /**
   * @param {string} name
   * @returns {AvatarCustomizationConfig | null}
   */
  loadPreset(name) {
    return this._presets.get(name) ?? null;
  }

  /**
   * @returns {string[]}
   */
  listPresets() {
    return [...this._presets.keys()].sort();
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  deletePreset(name) {
    const removed = this._presets.delete(name);
    if (removed) this._persist();
    return removed;
  }
}

export const avatarPresetStore = new AvatarPresetStore();
