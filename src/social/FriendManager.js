import { YOUR_PLACE_SCENE_ID } from './types.js';

const STORAGE_KEY = 'nexaris_social_friends_v1';

/** @type {import('./types.js').FriendRecord[]} */
const SEED_FRIENDS = [
  {
    username: 'NovaExplorer',
    avatarReference: null,
    online: true,
    lastVisitedDimension: 'academy',
    yourPlaceSceneId: YOUR_PLACE_SCENE_ID,
    presenceTag: 'in_academy',
    dimensionLabel: 'Nexaris Academy',
  },
  {
    username: 'PixelSage',
    avatarReference: null,
    online: false,
    lastVisitedDimension: 'example',
    yourPlaceSceneId: YOUR_PLACE_SCENE_ID,
    presenceTag: 'idle',
    dimensionLabel: 'Offline',
  },
  {
    username: 'CircuitMage',
    avatarReference: null,
    online: true,
    lastVisitedDimension: 'combat_zone',
    yourPlaceSceneId: YOUR_PLACE_SCENE_ID,
    presenceTag: 'in_combat',
    dimensionLabel: 'Combat Zone',
  },
  {
    username: 'ShardWeaver',
    avatarReference: null,
    online: true,
    lastVisitedDimension: 'your_place',
    yourPlaceSceneId: YOUR_PLACE_SCENE_ID,
    presenceTag: 'in_my_place',
    dimensionLabel: 'Your Place',
  },
];

/**
 * PR52 — friend list with persistence.
 */
export class FriendManager {
  constructor() {
    /** @type {Map<string, import('./types.js').FriendRecord>} */
    this._friends = new Map();
    this._load();
    if (this._friends.size === 0) {
      for (const f of SEED_FRIENDS) {
        this._friends.set(f.username.toLowerCase(), { ...f });
      }
      this._save();
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const f of arr) {
        if (f?.username) this._friends.set(f.username.toLowerCase(), f);
      }
    } catch {
      // ignore
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this._friends.values()]));
    } catch (err) {
      console.warn('[FriendManager] Save failed:', err);
    }
  }

  persist() {
    this._save();
  }

  /**
   * @param {string} username
   * @returns {boolean}
   */
  addFriend(username) {
    const key = username.trim().toLowerCase();
    if (!key || this._friends.has(key)) return false;

    this._friends.set(key, {
      username: username.trim(),
      avatarReference: null,
      online: Math.random() > 0.35,
      lastVisitedDimension: 'example',
      yourPlaceSceneId: YOUR_PLACE_SCENE_ID,
      presenceTag: 'in_dimension',
      dimensionLabel: 'Main World',
    });
    this._save();
    return true;
  }

  /**
   * @param {string} username
   * @returns {boolean}
   */
  removeFriend(username) {
    const ok = this._friends.delete(username.trim().toLowerCase());
    if (ok) this._save();
    return ok;
  }

  /**
   * @returns {import('./types.js').FriendRecord[]}
   */
  getFriends() {
    return [...this._friends.values()].sort((a, b) => a.username.localeCompare(b.username));
  }

  /**
   * @param {string} username
   * @returns {import('./types.js').FriendRecord | null}
   */
  getFriend(username) {
    return this._friends.get(username.trim().toLowerCase()) ?? null;
  }

  /**
   * @param {string} username
   * @param {boolean} online
   */
  setStatus(username, online) {
    const f = this.getFriend(username);
    if (!f) return;
    f.online = online;
    if (!online) {
      f.presenceTag = 'idle';
      f.dimensionLabel = 'Offline';
    }
    this._save();
  }

  /**
   * @param {string} username
   * @returns {import('./types.js').OnlineStatus}
   */
  getFriendStatus(username) {
    const f = this.getFriend(username);
    return f?.online ? 'online' : 'offline';
  }

  /**
   * @param {string} username
   * @param {Partial<import('./types.js').FriendRecord>} patch
   */
  updateFriend(username, patch) {
    const f = this.getFriend(username);
    if (!f) return;
    Object.assign(f, patch);
    this._save();
  }
}
