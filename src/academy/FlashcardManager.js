import mathDeck from './data/decks/math_basics.json';
import scienceDeck from './data/decks/science_intro.json';
import programmingDeck from './data/decks/programming_basics.json';
import { SRSEngine } from './SRSEngine.js';

/** @typedef {{ id: string, front: string, back: string, image?: string, tags?: string[], difficulty?: number }} Flashcard */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   subject: string,
 *   tags?: string[],
 *   cards: Flashcard[],
 * }} FlashcardDeck
 */

const BUNDLED_DECKS = {
  math_basics: mathDeck,
  science_intro: scienceDeck,
  programming_basics: programmingDeck,
};

/**
 * PR50 — flashcard deck loader with SRS-driven queue.
 */
export class FlashcardManager {
  /**
   * @param {{ srs?: SRSEngine }} [options]
   */
  constructor(options = {}) {
    this.srs = options.srs ?? new SRSEngine();
    /** @type {FlashcardDeck | null} */
    this.deck = null;
    /** @type {string[]} */
    this._queue = [];
    this._queueIndex = 0;
    /** @type {Flashcard | null} */
    this.currentCard = null;
    this._flipped = false;
  }

  /**
   * @param {string} id
   * @returns {Promise<FlashcardDeck>}
   */
  async loadDeck(id) {
    const deck = BUNDLED_DECKS[id];
    if (!deck) {
      throw new Error(`Unknown flashcard deck: ${id}`);
    }
    this.deck = /** @type {FlashcardDeck} */ (structuredClone(deck));
    this._queue = this.srs.getDueCardIds(this.deck.id, this.deck.cards);
    this._queueIndex = 0;
    this.currentCard = null;
    this._flipped = false;
    return this.deck;
  }

  /**
   * @returns {Flashcard | null}
   */
  getNextCard() {
    if (!this.deck?.cards.length) return null;

    if (this._queueIndex >= this._queue.length) {
      this._queue = this.srs.getDueCardIds(this.deck.id, this.deck.cards);
      this._queueIndex = 0;
    }

    const cardId = this._queue[this._queueIndex];
    this.currentCard = this.deck.cards.find((c) => c.id === cardId) ?? this.deck.cards[0];
    this._flipped = false;
    return this.currentCard;
  }

  /**
   * @returns {boolean}
   */
  isFlipped() {
    return this._flipped;
  }

  flip() {
    this._flipped = !this._flipped;
    return this._flipped;
  }

  /**
   * @returns {{ card: Flashcard | null, srs: import('./SRSEngine.js').SRSCardState | null }}
   */
  markCorrect() {
    return this._mark(true);
  }

  /**
   * @returns {{ card: Flashcard | null, srs: import('./SRSEngine.js').SRSCardState | null }}
   */
  markIncorrect() {
    return this._mark(false);
  }

  /**
   * @param {boolean} correct
   */
  _mark(correct) {
    if (!this.deck || !this.currentCard) {
      return { card: null, srs: null };
    }

    const srs = this.srs.recordReview(this.deck.id, this.currentCard.id, correct);
    this._queueIndex++;
    const next = this.getNextCard();
    return { card: next, srs };
  }

  /**
   * @returns {string[]}
   */
  listDeckIds() {
    return Object.keys(BUNDLED_DECKS);
  }
}
