/**
 * PR15 / PR37 — HUD overlay: dialogue box, typewriter text, choice buttons.
 */
export class UIOverlay {
  /**
   * @param {HTMLElement | null} [container]
   */
  constructor(container = document.getElementById('app')) {
    this.container = container;

    this.root = document.createElement('div');
    this.root.className = 'ui-overlay';

    this.panel = document.createElement('div');
    this.panel.className = 'dialogue-panel hidden';

    this.speakerEl = document.createElement('div');
    this.speakerEl.className = 'dialogue-speaker';

    this.textEl = document.createElement('div');
    this.textEl.className = 'dialogue-text';

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'dialogue-hint hidden';
    this.hintEl.textContent = 'Click or Space to continue';

    this.choicesEl = document.createElement('div');
    this.choicesEl.className = 'dialogue-choices hidden';

    this.panel.append(this.speakerEl, this.textEl, this.hintEl, this.choicesEl);
    this.scanBanner = document.createElement('div');
    this.scanBanner.className = 'scan-chamber-banner hidden';
    this.scanBanner.innerHTML =
      '<strong>Scan Chamber</strong> — Upload 360° photos · Generate stylized avatar · Exit via portal';

    this.academyBanner = document.createElement('div');
    this.academyBanner.className = 'academy-banner hidden';
    this.academyBanner.innerHTML =
      '<strong>Nexaris Academy</strong> — Flashcards · Lessons · Quizzes · Portals to chambers';

    this.root.appendChild(this.panel);
    this.root.appendChild(this.scanBanner);
    this.root.appendChild(this.academyBanner);
    this.container?.appendChild(this.root);

    this._fullText = '';
    this._typedChars = 0;
    this._charsPerSecond = 42;
    this._typing = false;
    this._onTypingComplete = null;
    /** @type {((index: number) => void) | null} */
    this._choiceCallback = null;
  }

  /**
   * @param {string} speaker
   * @param {string} text
   * @param {{ onComplete?: () => void }} [options]
   */
  showLine(speaker, text, options = {}) {
    this.panel?.classList.remove('hidden');
    this.choicesEl?.classList.add('hidden');
    this.hintEl?.classList.add('hidden');
    if (this.speakerEl) this.speakerEl.textContent = speaker;
    this._fullText = text;
    this._typedChars = 0;
    this._typing = true;
    this._onTypingComplete = options.onComplete ?? null;
    if (this.textEl) this.textEl.textContent = '';
  }

  /**
   * @param {{ text: string }[]} choices
   * @param {(index: number) => void} onChoose
   */
  showChoices(choices, onChoose) {
    if (!this.choicesEl) return;
    this._typing = false;
    this.hintEl?.classList.add('hidden');
    this.choicesEl.classList.remove('hidden');
    this.choicesEl.innerHTML = '';
    this._choiceCallback = onChoose;

    for (let i = 0; i < choices.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dialogue-choice-btn';
      btn.textContent = choices[i].text;
      const index = i;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._choiceCallback?.(index);
      });
      this.choicesEl.appendChild(btn);
    }
  }

  showContinueHint() {
    this.hintEl?.classList.remove('hidden');
  }

  hideContinueHint() {
    this.hintEl?.classList.add('hidden');
  }

  completeTyping() {
    this._typing = false;
    this._typedChars = this._fullText.length;
    if (this.textEl) this.textEl.textContent = this._fullText;
    const cb = this._onTypingComplete;
    this._onTypingComplete = null;
    cb?.();
  }

  get isTyping() {
    return this._typing;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this._typing) return;
    this._typedChars += this._charsPerSecond * deltaTime;
    const count = Math.min(Math.floor(this._typedChars), this._fullText.length);
    if (this.textEl) {
      this.textEl.textContent = this._fullText.slice(0, count);
    }
    if (count >= this._fullText.length) {
      this._typing = false;
      const cb = this._onTypingComplete;
      this._onTypingComplete = null;
      cb?.();
    }
  }

  showScanChamberBanner() {
    this.scanBanner?.classList.remove('hidden');
  }

  hideScanChamberBanner() {
    this.scanBanner?.classList.add('hidden');
  }

  showAcademyBanner() {
    this.academyBanner?.classList.remove('hidden');
  }

  hideAcademyBanner() {
    this.academyBanner?.classList.add('hidden');
  }

  hideDialogue() {
    this.panel?.classList.add('hidden');
    this.choicesEl?.classList.add('hidden');
    this.hintEl?.classList.add('hidden');
    this._typing = false;
    this._choiceCallback = null;
    if (this.textEl) this.textEl.textContent = '';
    if (this.speakerEl) this.speakerEl.textContent = '';
  }

  dispose() {
    this.root.remove();
  }
}
