const STORAGE_KEY = 'nexaris_academy_srs_v1';

/**
 * @typedef {{
 *   cardId: string,
 *   deckId: string,
 *   box: number,
 *   ease: number,
 *   interval: number,
 *   repetitions: number,
 *   nextReview: number,
 *   streak: number,
 *   lastReview: number,
 * }} SRSCardState
 */

/**
 * @typedef {{
 *   version: number,
 *   cards: Record<string, SRSCardState>,
 *   totalReviews: number,
 *   correctStreak: number,
 * }} SRSProgress
 */

/**
 * PR50 — simplified SM-2 spaced repetition with localStorage persistence.
 */
export class SRSEngine {
  constructor() {
    /** @type {SRSProgress} */
    this.progress = SRSEngine.load();
  }

  /**
   * @returns {SRSProgress}
   */
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && parsed.cards) return parsed;
      }
    } catch {
      // ignore corrupt save
    }
    return { version: 1, cards: {}, totalReviews: 0, correctStreak: 0 };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch (err) {
      console.warn('[SRSEngine] Save failed:', err);
    }
  }

  /**
   * @param {string} deckId
   * @param {string} cardId
   * @returns {SRSCardState}
   */
  getOrCreate(deckId, cardId) {
    const key = `${deckId}:${cardId}`;
    if (!this.progress.cards[key]) {
      this.progress.cards[key] = {
        cardId,
        deckId,
        box: 1,
        ease: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: Date.now(),
        streak: 0,
        lastReview: 0,
      };
    }
    return this.progress.cards[key];
  }

  /**
   * @param {string} deckId
   * @param {{ id: string }[]} cards
   * @returns {string[]} card ids due for review
   */
  getDueCardIds(deckId, cards) {
    const now = Date.now();
    const due = [];
    const later = [];

    for (const card of cards) {
      const state = this.getOrCreate(deckId, card.id);
      if (state.nextReview <= now) due.push(card.id);
      else later.push(card.id);
    }

    if (due.length === 0 && later.length > 0) {
      return [...later].sort((a, b) => {
        const sa = this.getOrCreate(deckId, a);
        const sb = this.getOrCreate(deckId, b);
        return sa.nextReview - sb.nextReview;
      });
    }

    return due.length ? due : cards.map((c) => c.id);
  }

  /**
   * SM-2 simplified: quality 0–5 mapped from correct/incorrect.
   * @param {string} deckId
   * @param {string} cardId
   * @param {boolean} correct
   */
  recordReview(deckId, cardId, correct) {
    const state = this.getOrCreate(deckId, cardId);
    const now = Date.now();
    state.lastReview = now;
    this.progress.totalReviews++;

    if (correct) {
      this.progress.correctStreak++;
      state.streak++;
      state.repetitions++;

      if (state.repetitions === 1) state.interval = 1;
      else if (state.repetitions === 2) state.interval = 3;
      else state.interval = Math.round(state.interval * state.ease);

      state.ease = Math.min(3, state.ease + 0.1);
      state.box = Math.min(5, state.box + 1);
    } else {
      this.progress.correctStreak = 0;
      state.streak = 0;
      state.repetitions = 0;
      state.interval = 1;
      state.ease = Math.max(1.3, state.ease - 0.2);
      state.box = 1;
    }

    state.nextReview = now + state.interval * 24 * 60 * 60 * 1000;
    this.save();
    return state;
  }

  /**
   * @returns {{ totalReviews: number, correctStreak: number, mastered: number }}
   */
  getStats() {
    let mastered = 0;
    for (const state of Object.values(this.progress.cards)) {
      if (state.box >= 4) mastered++;
    }
    return {
      totalReviews: this.progress.totalReviews,
      correctStreak: this.progress.correctStreak,
      mastered,
    };
  }

  reset() {
    this.progress = { version: 1, cards: {}, totalReviews: 0, correctStreak: 0 };
    this.save();
  }
}
