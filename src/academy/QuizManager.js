import mathQuiz from './data/quizzes/math_quiz.json';
import scienceQuiz from './data/quizzes/science_quiz.json';

/**
 * @typedef {{
 *   id: string,
 *   type: 'multiple_choice' | 'true_false' | 'fill_blank',
 *   prompt: string,
 *   options?: string[],
 *   answer: string | boolean,
 * }} QuizQuestion
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   subject: string,
 *   questions: QuizQuestion[],
 * }} Quiz
 */

const BUNDLED_QUIZZES = {
  math_quiz: mathQuiz,
  science_quiz: scienceQuiz,
};

/**
 * PR50 — quiz engine with scoring.
 */
export class QuizManager {
  constructor() {
    /** @type {Quiz | null} */
    this.quiz = null;
    this.questionIndex = 0;
    this.correctCount = 0;
    this.answered = 0;
    this.finished = false;
    /** @type {boolean | null} */
    this.lastCorrect = null;
  }

  /**
   * @param {string} id
   * @returns {Promise<Quiz>}
   */
  async startQuiz(id) {
    const quiz = BUNDLED_QUIZZES[id];
    if (!quiz) throw new Error(`Unknown quiz: ${id}`);
    this.quiz = /** @type {Quiz} */ (structuredClone(quiz));
    this.questionIndex = 0;
    this.correctCount = 0;
    this.answered = 0;
    this.finished = false;
    this.lastCorrect = null;
    return this.quiz;
  }

  /**
   * @returns {QuizQuestion | null}
   */
  getCurrentQuestion() {
    if (!this.quiz || this.finished) return null;
    return this.quiz.questions[this.questionIndex] ?? null;
  }

  /**
   * @param {string | boolean} answer
   * @returns {{ correct: boolean, finished: boolean, score: ReturnType<QuizManager['getScore']> }}
   */
  submitAnswer(answer) {
    const q = this.getCurrentQuestion();
    if (!q) {
      return { correct: false, finished: true, score: this.getScore() };
    }

    let correct = false;
    if (q.type === 'true_false') {
      correct = Boolean(answer) === Boolean(q.answer);
    } else if (q.type === 'fill_blank') {
      correct =
        String(answer).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
    } else {
      correct = String(answer) === String(q.answer);
    }

    this.lastCorrect = correct;
    this.answered++;
    if (correct) this.correctCount++;

    this.questionIndex++;
    if (this.questionIndex >= (this.quiz?.questions.length ?? 0)) {
      this.finished = true;
    }

    return { correct, finished: this.finished, score: this.getScore() };
  }

  /**
   * @returns {{ correct: number, total: number, percent: number, grade: string }}
   */
  getScore() {
    const total = this.quiz?.questions.length ?? 0;
    const correct = this.correctCount;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    let grade = 'C';
    if (percent >= 90) grade = 'A';
    else if (percent >= 75) grade = 'B';
    else if (percent >= 60) grade = 'C';
    else grade = 'D';
    return { correct, total, percent, grade };
  }

  listQuizIds() {
    return Object.keys(BUNDLED_QUIZZES);
  }
}
