import npcIntro from './dialogues/npc_intro.json';
import npcMore from './dialogues/npc_more.json';

/**
 * @typedef {{
 *   text: string,
 *   next?: string,
 * }} DialogueChoice
 */

/**
 * @typedef {{
 *   speaker: string,
 *   text: string,
 *   choices?: DialogueChoice[],
 *   next?: string,
 *   emote?: boolean | string,
 *   expression?: string,
 * }} DialogueLine
 */

/**
 * @typedef {{
 *   id: string,
 *   lines: DialogueLine[],
 * }} DialogueData
 */

/**
 * @typedef {import('../npc/NPC.js').NPC} NPC
 * @typedef {import('../ui/UIOverlay.js').UIOverlay} UIOverlay
 */

/**
 * @typedef {{
 *   uiOverlay: UIOverlay,
 *   getPlayer?: () => import('../avatars/AvatarController.js').AvatarController | null,
 * }} DialogueManagerOptions
 */

const BUNDLED_DIALOGUES = {
  npc_intro: npcIntro,
  npc_more: npcMore,
};

/**
 * PR37 — branching dialogue with UI typewriter and world pause.
 */
export class DialogueManager {
  /**
   * @param {DialogueManagerOptions} options
   */
  constructor(options) {
    if (!options.uiOverlay) {
      throw new Error('DialogueManager requires uiOverlay');
    }
    this.ui = options.uiOverlay;
    this.getPlayer = options.getPlayer ?? (() => null);

    /** @type {Map<string, DialogueData>} */
    this._cache = new Map(Object.entries(BUNDLED_DIALOGUES));

    /** @type {NPC | null} */
    this._npc = null;
    /** @type {DialogueData | null} */
    this._dialogue = null;
    this._lineIndex = 0;
    this._awaitingChoice = false;
    this._active = false;

    /** @type {Set<(payload: unknown) => void>} */
    this._onLineStart = new Set();
    /** @type {Set<(payload: unknown) => void>} */
    this._onLineEnd = new Set();
    /** @type {Set<(payload: unknown) => void>} */
    this._onChoice = new Set();

    /** @type {((paused: boolean) => void) | null} */
    this.onPauseChange = null;
  }

  get isActive() {
    return this._active;
  }

  /**
   * @param {(payload: unknown) => void} fn
   */
  on(event, fn) {
    if (event === 'onLineStart') this._onLineStart.add(fn);
    else if (event === 'onLineEnd') this._onLineEnd.add(fn);
    else if (event === 'onChoice') this._onChoice.add(fn);
  }

  /**
   * @param {(payload: unknown) => void} fn
   */
  off(event, fn) {
    if (event === 'onLineStart') this._onLineStart.delete(fn);
    else if (event === 'onLineEnd') this._onLineEnd.delete(fn);
    else if (event === 'onChoice') this._onChoice.delete(fn);
  }

  _emit(set, payload) {
    for (const fn of set) fn(payload);
  }

  /**
   * @param {string} id
   * @returns {Promise<DialogueData>}
   */
  async loadDialogue(id) {
    const cached = this._cache.get(id);
    if (cached) return cached;

    const url = new URL(`./dialogues/${id}.json`, import.meta.url);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Dialogue not found: ${id}`);
    }
    const data = /** @type {DialogueData} */ (await res.json());
    this._cache.set(id, data);
    return data;
  }

  /**
   * @param {NPC} npc
   * @param {string} dialogueId
   */
  async startDialogue(npc, dialogueId) {
    if (this._active) {
      this.endDialogue();
    }

    const dialogue = await this.loadDialogue(dialogueId);
    this._npc = npc;
    this._dialogue = dialogue;
    this._lineIndex = 0;
    this._awaitingChoice = false;
    this._active = true;

    const player = this.getPlayer();
    npc.enterDialogue?.(player?.object ?? null);
    this._setPaused(true);
    this._presentLine();
  }

  /**
   * Advance dialogue (click / space).
   */
  next() {
    if (!this._active || this._awaitingChoice) return;

    if (this.ui.isTyping) {
      this.ui.completeTyping();
      return;
    }

    const line = this._currentLine();
    if (line?.choices?.length) {
      return;
    }

    if (line?.next === 'end') {
      this.endDialogue();
      return;
    }

    this._lineIndex += 1;
    if (!this._dialogue || this._lineIndex >= this._dialogue.lines.length) {
      this.endDialogue();
      return;
    }
    this._presentLine();
  }

  /**
   * @param {number} optionIndex
   */
  async choose(optionIndex) {
    if (!this._active || !this._awaitingChoice) return;

    const line = this._currentLine();
    const choice = line?.choices?.[optionIndex];
    if (!choice) return;

    this._awaitingChoice = false;
    this.ui.hideContinueHint();

    this._emit(this._onChoice, {
      npc: this._npc,
      choice,
      optionIndex,
      dialogueId: this._dialogue?.id,
    });

    if (choice.next === 'end') {
      this.endDialogue();
      return;
    }

    if (choice.next) {
      this._dialogue = await this.loadDialogue(choice.next);
      this._lineIndex = 0;
      this._presentLine();
    }
  }

  endDialogue() {
    if (!this._active) return;

    const npc = this._npc;
    this._active = false;
    this._awaitingChoice = false;
    this._dialogue = null;
    this._lineIndex = 0;
    this._npc = null;

    this.ui.hideDialogue();
    npc?.exitDialogue?.();
    this._setPaused(false);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.ui.update(deltaTime);
  }

  /**
   * @returns {DialogueLine | null}
   */
  _currentLine() {
    return this._dialogue?.lines[this._lineIndex] ?? null;
  }

  _presentLine() {
    const line = this._currentLine();
    if (!line) {
      this.endDialogue();
      return;
    }

    const speaker =
      line.speaker === 'Player'
        ? 'You'
        : line.speaker === 'NPC'
          ? (this._npc?.speakerName ?? this._npc?.metadata?.title ?? 'NPC')
          : line.speaker;

    this._emit(this._onLineStart, {
      npc: this._npc,
      line,
      lineIndex: this._lineIndex,
      dialogueId: this._dialogue?.id,
    });

    this._applyLineEffects(line);

    this.ui.showLine(speaker, line.text, {
      onComplete: () => this._onLineTyped(line),
    });
  }

  /**
   * @param {DialogueLine} line
   */
  _onLineTyped(line) {
    this._emit(this._onLineEnd, {
      npc: this._npc,
      line,
      lineIndex: this._lineIndex,
      dialogueId: this._dialogue?.id,
    });

    if (line.choices?.length) {
      this._awaitingChoice = true;
      this.ui.showChoices(line.choices, (index) => {
        this.choose(index);
      });
      return;
    }

    if (line.next === 'end') {
      this.ui.showContinueHint();
      return;
    }

    const isLast =
      this._dialogue != null && this._lineIndex >= this._dialogue.lines.length - 1;
    if (isLast) {
      this.ui.showContinueHint();
    } else {
      this.ui.showContinueHint();
    }
  }

  /**
   * @param {DialogueLine} line
   */
  _applyLineEffects(line) {
    const npc = this._npc;
    if (!npc) return;

    if (line.expression) {
      npc.playExpression?.(line.expression, 0.5);
    }

    if (line.emote) {
      npc.playDialogueEmote?.();
    }
  }

  /**
   * @param {boolean} paused
   */
  _setPaused(paused) {
    const player = this.getPlayer();
    if (player) {
      player.dialoguePaused = paused;
    }
    this.onPauseChange?.(paused);
  }
}
