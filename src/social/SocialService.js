import { SocialIdentityProfile } from './SocialIdentityProfile.js';
import { FriendManager } from './FriendManager.js';
import { PartyManager } from './PartyManager.js';
import { SocialPresence } from './SocialPresence.js';
import { socialSession } from './socialSession.js';
import { YOUR_PLACE_SCENE_ID } from './types.js';

/**
 * PR52 — orchestrates identity, friends, party, and presence.
 */
export class SocialService {
  constructor() {
    this.identity = new SocialIdentityProfile();
    this.friends = new FriendManager();
    this.party = new PartyManager();
    this.presence = new SocialPresence(this.friends);

    if (!this.party.getParty()) {
      this.party.createParty(this.identity.username);
    }
  }

  get localUsername() {
    return this.identity.username;
  }

  /**
   * @param {string} sceneId
   */
  onSceneChange(sceneId) {
    this.presence.setLocalPresence(this.identity.username, sceneId);
    if (this.party.getParty()) {
      this.party.setPartyDestination(sceneId);
    }
  }

  /**
   * Visit selected or named friend (portal / UI).
   * @param {import('../core/SceneManager.js').SceneManager} sceneManager
   * @param {string} [username]
   */
  async visitFriendPortal(sceneManager, username) {
    const { sceneId } = this.prepareVisitFriend(username);
    await sceneManager.transitionViaPortal(sceneId, {
      preservePlayer: sceneManager.currentScene?.player != null,
      transition: 'warp',
      duration: 0.85,
    });
  }

  /**
   * @param {import('../core/SceneManager.js').SceneManager} sceneManager
   */
  async visitOwnPlacePortal(sceneManager) {
    const { sceneId } = this.prepareVisitOwnPlace();
    await sceneManager.transitionViaPortal(sceneId, {
      preservePlayer: sceneManager.currentScene?.player != null,
      transition: 'warp',
      duration: 0.85,
    });
  }

  /**
   * @param {string} username
   */
  selectFriend(username) {
    socialSession.selectedFriendUsername = username;
  }

  /**
   * @returns {import('./types.js').FriendRecord | null}
   */
  getSelectedFriend() {
    if (!socialSession.selectedFriendUsername) return null;
    return this.friends.getFriend(socialSession.selectedFriendUsername);
  }

  /**
   * Visit a friend's personal dimension via portal.
   * @param {string} [username]
   * @returns {{ sceneId: string, friend: import('./types.js').FriendRecord | null }}
   */
  prepareVisitFriend(username) {
    const friend = username
      ? this.friends.getFriend(username)
      : this.getSelectedFriend();

    if (!friend) {
      throw new Error('Select a friend to visit');
    }

    socialSession.visitTarget = {
      username: friend.username,
      isOwnPlace: false,
      ownerDisplayName: `${friend.username}'s Place`,
    };
    socialSession.selectedFriendUsername = friend.username;

    return {
      sceneId: friend.yourPlaceSceneId ?? YOUR_PLACE_SCENE_ID,
      friend,
    };
  }

  /**
   * Visit your own place.
   */
  prepareVisitOwnPlace() {
    socialSession.visitTarget = {
      username: this.identity.username,
      isOwnPlace: true,
      ownerDisplayName: this.identity.data.displayTitle ?? 'Your Place',
    };
    return { sceneId: this.identity.yourPlaceSceneId };
  }

  /**
   * @returns {import('./types.js').VisitTarget | null}
   */
  getVisitTarget() {
    return socialSession.visitTarget;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.presence.tick(deltaTime);
  }

  /**
   * @param {(payload: unknown) => void} fn
   */
  onPresenceUpdate(fn) {
    return this.presence.onUpdate(fn);
  }
}
