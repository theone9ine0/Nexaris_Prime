import { FlashcardManager } from './FlashcardManager.js';
import { LessonManager } from './LessonManager.js';
import { QuizManager } from './QuizManager.js';
import { SRSEngine } from './SRSEngine.js';
import { AcademyUI } from './AcademyUI.js';
import { academySession } from './academySession.js';

const DECK_LABELS = {
  math_basics: 'Math Basics',
  science_intro: 'Science Intro',
  programming_basics: 'Programming',
};

/**
 * PR50 — wires managers + UI for academy dimensions.
 */
export class AcademyController {
  /**
   * @param {HTMLElement | null} container
   */
  constructor(container) {
    this.srs = new SRSEngine();
    academySession.srsProgress = this.srs.progress;

    this.flashcards = new FlashcardManager({ srs: this.srs });
    this.lessons = new LessonManager();
    this.quizzes = new QuizManager();

    this.ui = new AcademyUI(container, {
      onFlashcardFlip: () => this._flipCard(),
      onFlashcardCorrect: () => this._rateCard(true),
      onFlashcardIncorrect: () => this._rateCard(false),
      onLessonNext: () => this._lessonNav(1),
      onLessonPrev: () => this._lessonNav(-1),
      onQuizSubmit: (ans) => this._submitQuiz(ans),
      onDeckChange: (id) => this.loadDeck(id),
    });

    this._fxCallback = null;
  }

  /**
   * @param {(type: string, payload?: unknown) => void} cb
   */
  onEffect(cb) {
    this._fxCallback = cb;
  }

  async init() {
    await this.loadDeck(academySession.activeDeckId);
    await this.lessons.loadLesson(academySession.activeLessonId);
    await this.quizzes.startQuiz(academySession.activeQuizId);
    this._refreshLessonUI();
    this._refreshQuizUI();
    this._refreshProgress();
  }

  /**
   * @param {string} deckId
   */
  async loadDeck(deckId) {
    academySession.activeDeckId = deckId;
    await this.flashcards.loadDeck(deckId);
    const card = this.flashcards.getNextCard();
    this.ui.setDeckOptions(
      this.flashcards.listDeckIds().map((id) => ({ id, label: DECK_LABELS[id] ?? id })),
      deckId,
    );
    this.ui.showFlashcard(card?.front ?? 'No cards', false);
    this._refreshProgress();
  }

  _flipCard() {
    const flipped = this.flashcards.flip();
    const card = this.flashcards.currentCard;
    if (card) {
      this.ui.showFlashcard(flipped ? card.back : card.front, flipped);
    }
    this._fxCallback?.('flip');
  }

  /**
   * @param {boolean} correct
   */
  _rateCard(correct) {
    const { card } = correct ? this.flashcards.markCorrect() : this.flashcards.markIncorrect();
    this.ui.showFlashcard(card?.front ?? 'Deck complete!', false);
    this._refreshProgress();
    this._fxCallback?.(correct ? 'correct' : 'incorrect');
  }

  /**
   * @param {number} dir
   */
  _lessonNav(dir) {
    const section = dir > 0 ? this.lessons.nextSection() : this.lessons.previousSection();
    if (section) this._refreshLessonUI();
    this._fxCallback?.('lesson_nav');
  }

  _refreshLessonUI() {
    const section = this.lessons.getCurrentSection();
    if (section) {
      this.ui.showLesson(section, this.lessons.getProgress());
    }
  }

  _refreshQuizUI() {
    const q = this.quizzes.getCurrentQuestion();
    if (q) this.ui.showQuizQuestion(q);
    else if (this.quizzes.finished) {
      this.ui.showQuizResult(this.quizzes.getScore());
    }
  }

  /**
   * @param {string} quizId
   */
  async startQuiz(quizId) {
    academySession.activeQuizId = quizId;
    await this.quizzes.startQuiz(quizId);
    this._refreshQuizUI();
    this.ui.showPanel('quiz');
  }

  /**
   * @param {string | boolean} answer
   */
  _submitQuiz(answer) {
    const { correct, finished } = this.quizzes.submitAnswer(answer);
    this.ui.flashAnswerFeedback(correct);
    this._fxCallback?.(correct ? 'quiz_correct' : 'quiz_wrong');

    if (finished) {
      this.ui.showQuizResult(this.quizzes.getScore());
      this._fxCallback?.('quiz_complete', this.quizzes.getScore());
    } else {
      this._refreshQuizUI();
    }
  }

  _refreshProgress() {
    this.ui.updateProgress(this.srs.getStats());
  }

  show() {
    this.ui.show();
    this._refreshProgress();
  }

  hide() {
    this.ui.hide();
  }

  dispose() {
    this.ui.dispose();
  }
}
