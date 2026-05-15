/**
 * PR50 — DOM panels for flashcards, lessons, quizzes, and progress.
 */
export class AcademyUI {
  /**
   * @param {HTMLElement | null} [container]
   * @param {{
   *   onFlashcardCorrect?: () => void,
   *   onFlashcardIncorrect?: () => void,
   *   onFlashcardFlip?: () => void,
   *   onLessonNext?: () => void,
   *   onLessonPrev?: () => void,
   *   onQuizSubmit?: (answer: string | boolean) => void,
   *   onDeckChange?: (deckId: string) => void,
   * }} [callbacks]
   */
  constructor(container = document.getElementById('app'), callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'academy-ui hidden';

    this.progressEl = document.createElement('div');
    this.progressEl.className = 'academy-progress';
    this.progressEl.innerHTML =
      '<span class="academy-progress-label">Academy Progress</span><span class="academy-progress-stats">—</span>';

    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'academy-tabs';
    for (const tab of ['flashcard', 'lesson', 'quiz']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'academy-tab';
      btn.dataset.tab = tab;
      btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      btn.addEventListener('click', () => this.showPanel(tab));
      this.tabsEl.appendChild(btn);
    }

    this._buildFlashcardPanel();
    this._buildLessonPanel();
    this._buildQuizPanel();

    this.root.append(this.progressEl, this.tabsEl, this.flashcardPanel, this.lessonPanel, this.quizPanel);
    this.container?.appendChild(this.root);
    this.showPanel('flashcard');
  }

  _buildFlashcardPanel() {
    this.flashcardPanel = document.createElement('div');
    this.flashcardPanel.className = 'academy-panel';
    this.flashcardPanel.dataset.panel = 'flashcard';

    this.deckSelect = document.createElement('select');
    this.deckSelect.className = 'academy-select';
    this.deckSelect.addEventListener('change', () => {
      this.callbacks.onDeckChange?.(this.deckSelect.value);
    });

    this.cardFace = document.createElement('div');
    this.cardFace.className = 'academy-flashcard';
    this.cardFace.textContent = 'Load a deck to begin';
    this.cardFace.addEventListener('click', () => this.callbacks.onFlashcardFlip?.());

    const actions = document.createElement('div');
    actions.className = 'academy-actions';
    const wrongBtn = document.createElement('button');
    wrongBtn.type = 'button';
    wrongBtn.className = 'academy-btn academy-btn-wrong';
    wrongBtn.textContent = 'Incorrect';
    wrongBtn.addEventListener('click', () => this.callbacks.onFlashcardIncorrect?.());
    const rightBtn = document.createElement('button');
    rightBtn.type = 'button';
    rightBtn.className = 'academy-btn academy-btn-correct';
    rightBtn.textContent = 'Correct';
    rightBtn.addEventListener('click', () => this.callbacks.onFlashcardCorrect?.());
    actions.append(wrongBtn, rightBtn);

    this.flashcardPanel.append(this.deckSelect, this.cardFace, actions);
  }

  _buildLessonPanel() {
    this.lessonPanel = document.createElement('div');
    this.lessonPanel.className = 'academy-panel hidden';
    this.lessonPanel.dataset.panel = 'lesson';

    this.lessonTitle = document.createElement('h3');
    this.lessonTitle.className = 'academy-lesson-title';
    this.lessonBody = document.createElement('div');
    this.lessonBody.className = 'academy-lesson-body';
    this.lessonDiagram = document.createElement('pre');
    this.lessonDiagram.className = 'academy-lesson-diagram hidden';

    const nav = document.createElement('div');
    nav.className = 'academy-actions';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'academy-btn';
    prev.textContent = 'Previous';
    prev.addEventListener('click', () => this.callbacks.onLessonPrev?.());
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'academy-btn academy-btn-primary';
    next.textContent = 'Next';
    next.addEventListener('click', () => this.callbacks.onLessonNext?.());
    nav.append(prev, next);

    this.lessonPanel.append(this.lessonTitle, this.lessonBody, this.lessonDiagram, nav);
  }

  _buildQuizPanel() {
    this.quizPanel = document.createElement('div');
    this.quizPanel.className = 'academy-panel hidden';
    this.quizPanel.dataset.panel = 'quiz';

    this.quizPrompt = document.createElement('div');
    this.quizPrompt.className = 'academy-quiz-prompt';
    this.quizOptions = document.createElement('div');
    this.quizOptions.className = 'academy-quiz-options';
    this.quizFill = document.createElement('input');
    this.quizFill.type = 'text';
    this.quizFill.className = 'academy-quiz-fill hidden';
    this.quizFill.placeholder = 'Type your answer…';
    this.quizFill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.callbacks.onQuizSubmit?.(this.quizFill.value);
    });
    const submitFill = document.createElement('button');
    submitFill.type = 'button';
    submitFill.className = 'academy-btn academy-btn-primary hidden';
    submitFill.textContent = 'Submit';
    submitFill.dataset.role = 'fill-submit';
    submitFill.addEventListener('click', () => this.callbacks.onQuizSubmit?.(this.quizFill.value));

    this.quizScore = document.createElement('div');
    this.quizScore.className = 'academy-quiz-score hidden';

    this.quizPanel.append(this.quizPrompt, this.quizOptions, this.quizFill, submitFill, this.quizScore);
  }

  /**
   * @param {'flashcard' | 'lesson' | 'quiz'} name
   */
  showPanel(name) {
    for (const panel of [this.flashcardPanel, this.lessonPanel, this.quizPanel]) {
      panel.classList.toggle('hidden', panel.dataset.panel !== name);
    }
    for (const btn of this.tabsEl.querySelectorAll('.academy-tab')) {
      btn.classList.toggle('active', btn.dataset.tab === name);
    }
  }

  /**
   * @param {{ totalReviews: number, correctStreak: number, mastered: number }} stats
   */
  updateProgress(stats) {
    this.progressEl.querySelector('.academy-progress-stats').textContent =
      `Reviews: ${stats.totalReviews} · Streak: ${stats.correctStreak} · Mastered: ${stats.mastered}`;
  }

  /**
   * @param {{ id: string, label: string }[]} decks
   * @param {string} selectedId
   */
  setDeckOptions(decks, selectedId) {
    this.deckSelect.innerHTML = '';
    for (const d of decks) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label;
      if (d.id === selectedId) opt.selected = true;
      this.deckSelect.appendChild(opt);
    }
  }

  /**
   * @param {string} text
   * @param {boolean} flipped
   */
  showFlashcard(text, flipped = false) {
    this.cardFace.textContent = text;
    this.cardFace.classList.toggle('flipped', flipped);
  }

  /**
   * @param {{ title: string, text: string, diagram?: string }} section
   * @param {{ current: number, total: number }} progress
   */
  showLesson(section, progress) {
    this.lessonTitle.textContent = `${section.title} (${progress.current}/${progress.total})`;
    this.lessonBody.textContent = section.text;
    if (section.diagram) {
      this.lessonDiagram.textContent = section.diagram;
      this.lessonDiagram.classList.remove('hidden');
    } else {
      this.lessonDiagram.classList.add('hidden');
    }
  }

  /**
   * @param {import('./QuizManager.js').QuizQuestion} question
   */
  showQuizQuestion(question) {
    this.quizScore.classList.add('hidden');
    this.quizPrompt.textContent = question.prompt;
    this.quizOptions.innerHTML = '';
    this.quizFill.classList.add('hidden');
    const fillSubmit = this.quizPanel.querySelector('[data-role="fill-submit"]');
    fillSubmit?.classList.add('hidden');

    if (question.type === 'fill_blank') {
      this.quizFill.classList.remove('hidden');
      this.quizFill.value = '';
      fillSubmit?.classList.remove('hidden');
      return;
    }

    if (question.type === 'true_false') {
      for (const val of [true, false]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'academy-btn';
        btn.textContent = val ? 'True' : 'False';
        btn.addEventListener('click', () => this.callbacks.onQuizSubmit?.(val));
        this.quizOptions.appendChild(btn);
      }
      return;
    }

    for (const opt of question.options ?? []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'academy-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => this.callbacks.onQuizSubmit?.(opt));
      this.quizOptions.appendChild(btn);
    }
  }

  /**
   * @param {{ correct: number, total: number, percent: number, grade: string }} score
   */
  showQuizResult(score) {
    this.quizOptions.innerHTML = '';
    this.quizFill.classList.add('hidden');
    this.quizPrompt.textContent = 'Quiz complete!';
    this.quizScore.classList.remove('hidden');
    this.quizScore.textContent = `Score: ${score.correct}/${score.total} (${score.percent}%) — Grade ${score.grade}`;
  }

  /**
   * @param {boolean} correct
   */
  flashAnswerFeedback(correct) {
    this.quizPrompt.classList.toggle('academy-feedback-correct', correct);
    this.quizPrompt.classList.toggle('academy-feedback-wrong', !correct);
    setTimeout(() => {
      this.quizPrompt.classList.remove('academy-feedback-correct', 'academy-feedback-wrong');
    }, 600);
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  dispose() {
    this.root.remove();
  }
}
