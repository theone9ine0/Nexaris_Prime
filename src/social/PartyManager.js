const STORAGE_KEY = 'nexaris_social_party_v1';
const MAX_PARTY_SIZE = 4;

/**
 * PR52 — local party state (1–4 members, shared destination).
 */
export class PartyManager {
  constructor() {
    /** @type {import('./types.js').PartyState | null} */
    this.party = PartyManager.load();
  }

  /**
   * @returns {import('./types.js').PartyState | null}
   */
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }

  _save() {
    try {
      if (this.party) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.party));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[PartyManager] Save failed:', err);
    }
  }

  /**
   * @param {string} leader
   * @returns {import('./types.js').PartyState}
   */
  createParty(leader) {
    this.party = {
      leader,
      members: [leader],
      destination: null,
    };
    this._save();
    return this.party;
  }

  /**
   * @param {string} username
   * @returns {boolean}
   */
  inviteToParty(username) {
    if (!this.party) return false;
    const name = username.trim();
    if (!name || this.party.members.includes(name)) return false;
    if (this.party.members.length >= MAX_PARTY_SIZE) return false;

    this.party.members.push(name);
    this._save();
    return true;
  }

  /**
   * @param {string} username
   */
  leaveParty(username) {
    if (!this.party) return;

    const name = username.trim();
    this.party.members = this.party.members.filter((m) => m !== name);

    if (this.party.members.length === 0 || this.party.leader === name) {
      this.disbandParty();
      return;
    }

    if (this.party.leader === name) {
      this.party.leader = this.party.members[0];
    }
    this._save();
  }

  disbandParty() {
    this.party = null;
    this._save();
  }

  /**
   * @param {string} sceneId
   */
  setPartyDestination(sceneId) {
    if (!this.party) return;
    this.party.destination = sceneId;
    this._save();
  }

  /**
   * @returns {boolean}
   */
  isInParty(username) {
    return this.party?.members.includes(username) ?? false;
  }

  /**
   * @returns {import('./types.js').PartyState | null}
   */
  getParty() {
    return this.party ? { ...this.party, members: [...this.party.members] } : null;
  }
}
