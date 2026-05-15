/**
 * @typedef {import('./types.js').VisitTarget} VisitTarget
 */

/** Cross-scene social visit state (PR52). */
export const socialSession = {
  /** @type {VisitTarget | null} */
  visitTarget: null,
  /** @type {string | null} */
  selectedFriendUsername: null,
};
