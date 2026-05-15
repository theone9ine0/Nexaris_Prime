import { SCENE_PRESENCE_MAP } from './types.js';

/**
 * PR52 — presence tags and periodic friend status simulation.
 */
export class SocialPresence {
  /**
   * @param {import('./FriendManager.js').FriendManager} friendManager
   */
  constructor(friendManager) {
    this.friendManager = friendManager;
    this.localUsername = '';
    this.localSceneId = 'chamber';
    this.localTag = 'in_dimension';
    this.localLabel = 'Nexaris Chamber';
    this._elapsed = 0;
    this._tickInterval = 4;
    /** @type {Set<(payload: unknown) => void>} */
    this._listeners = new Set();
  }

  /**
   * @param {(payload: { friends: import('./types.js').FriendRecord[] }) => void} fn
   */
  onUpdate(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * @param {string} username
   * @param {string} sceneId
   */
  setLocalPresence(username, sceneId) {
    this.localUsername = username;
    this.localSceneId = sceneId;
    const mapped = SCENE_PRESENCE_MAP[sceneId];
    if (mapped) {
      this.localTag = mapped.tag;
      this.localLabel = mapped.label;
    } else {
      this.localTag = 'in_dimension';
      this.localLabel = sceneId;
    }
    this._notify();
  }

  /**
   * @param {number} deltaTime
   */
  tick(deltaTime) {
    this._elapsed += deltaTime;
    if (this._elapsed < this._tickInterval) return;
    this._elapsed = 0;
    this._simulateFriendPresence();
    this._notify();
  }

  _simulateFriendPresence() {
    const scenes = Object.keys(SCENE_PRESENCE_MAP);
    for (const friend of this.friendManager.getFriends()) {
      if (Math.random() > 0.25) continue;

      if (Math.random() < 0.08) {
        friend.online = !friend.online;
        if (!friend.online) {
          friend.presenceTag = 'idle';
          friend.dimensionLabel = 'Offline';
          continue;
        }
      }

      if (!friend.online) continue;

      const sceneId = scenes[Math.floor(Math.random() * scenes.length)];
      const mapped = SCENE_PRESENCE_MAP[sceneId];
      friend.lastVisitedDimension = sceneId;
      friend.presenceTag = mapped.tag;
      friend.dimensionLabel = mapped.label;
    }
    this.friendManager.persist();
  }

  /**
   * @param {import('./types.js').FriendRecord} friend
   * @returns {string}
   */
  static formatFriendStatus(friend) {
    if (!friend.online) return 'Offline';
    switch (friend.presenceTag) {
      case 'in_combat':
        return 'In Combat';
      case 'in_academy':
        return 'In Academy';
      case 'in_my_place':
        return 'In My Place';
      case 'in_scan':
        return 'In Scan Chamber';
      case 'in_dimension':
        return friend.dimensionLabel ? `In Dimension: ${friend.dimensionLabel}` : 'Exploring';
      default:
        return friend.dimensionLabel ?? 'Online';
    }
  }

  /**
   * @returns {string}
   */
  getLocalStatusLine() {
    if (this.localTag === 'in_combat') return 'In Combat';
    if (this.localTag === 'in_academy') return 'In Academy';
    if (this.localTag === 'in_my_place') return 'In My Place';
    if (this.localTag === 'in_scan') return 'In Scan Chamber';
    return `In Dimension: ${this.localLabel}`;
  }

  _notify() {
    const friends = this.friendManager.getFriends();
    for (const fn of this._listeners) {
      fn({ friends, localStatus: this.getLocalStatusLine() });
    }
  }
}
