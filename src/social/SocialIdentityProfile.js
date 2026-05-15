import { YOUR_PLACE_SCENE_ID } from './types.js';

const STORAGE_KEY = 'nexaris_social_identity_v1';

/**
 * PR51 — local player social identity (username, avatar, personal dimension).
 */
export class SocialIdentityProfile {
  /**
   * @returns {import('./types.js').SocialIdentityProfile}
   */
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.username) return parsed;
      }
    } catch {
      // ignore
    }
    return {
      username: 'NexarisTraveler',
      avatarReference: null,
      yourPlaceSceneId: YOUR_PLACE_SCENE_ID,
      displayTitle: 'My Place',
    };
  }

  /**
   * @param {import('./types.js').SocialIdentityProfile} profile
   */
  static save(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn('[SocialIdentityProfile] Save failed:', err);
    }
  }

  constructor() {
    /** @type {import('./types.js').SocialIdentityProfile} */
    this.data = SocialIdentityProfile.load();
  }

  get username() {
    return this.data.username;
  }

  get avatarReference() {
    return this.data.avatarReference;
  }

  get yourPlaceSceneId() {
    return this.data.yourPlaceSceneId ?? YOUR_PLACE_SCENE_ID;
  }

  /**
   * @param {string} username
   */
  setUsername(username) {
    const trimmed = username.trim();
    if (!trimmed) return;
    this.data.username = trimmed;
    SocialIdentityProfile.save(this.data);
  }

  /**
   * @param {string | null} ref
   */
  setAvatarReference(ref) {
    this.data.avatarReference = ref;
    SocialIdentityProfile.save(this.data);
  }

  persist() {
    SocialIdentityProfile.save(this.data);
  }
}
