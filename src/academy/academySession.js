/**
 * Shared academy state across dimensions (PR50).
 */
export const academySession = {
  activeDeckId: 'math_basics',
  activeLessonId: 'math_algebra',
  activeQuizId: 'math_quiz',
  /** @type {import('./SRSEngine.js').SRSProgress | null} */
  srsProgress: null,
};
