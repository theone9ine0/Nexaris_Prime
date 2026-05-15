import mathLesson from './data/lessons/math_algebra.json';
import scienceLesson from './data/lessons/science_atoms.json';

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   text: string,
 *   image?: string,
 *   diagram?: string,
 *   modelUrl?: string,
 * }} LessonSection
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   subject: string,
 *   sections: LessonSection[],
 * }} LessonModule
 */

const BUNDLED_LESSONS = {
  math_algebra: mathLesson,
  science_atoms: scienceLesson,
};

/**
 * PR50 — lesson module loader with section navigation.
 */
export class LessonManager {
  constructor() {
    /** @type {LessonModule | null} */
    this.lesson = null;
    this.sectionIndex = 0;
  }

  /**
   * @param {string} id
   * @returns {Promise<LessonModule>}
   */
  async loadLesson(id) {
    const lesson = BUNDLED_LESSONS[id];
    if (!lesson) throw new Error(`Unknown lesson: ${id}`);
    this.lesson = /** @type {LessonModule} */ (structuredClone(lesson));
    this.sectionIndex = 0;
    return this.lesson;
  }

  /**
   * @returns {LessonSection | null}
   */
  getCurrentSection() {
    if (!this.lesson?.sections.length) return null;
    return this.lesson.sections[this.sectionIndex] ?? null;
  }

  /**
   * @returns {LessonSection | null}
   */
  nextSection() {
    if (!this.lesson) return null;
    if (this.sectionIndex < this.lesson.sections.length - 1) {
      this.sectionIndex++;
    }
    return this.getCurrentSection();
  }

  /**
   * @returns {LessonSection | null}
   */
  previousSection() {
    if (!this.lesson) return null;
    if (this.sectionIndex > 0) {
      this.sectionIndex--;
    }
    return this.getCurrentSection();
  }

  /**
   * @returns {{ current: number, total: number, percent: number }}
   */
  getProgress() {
    const total = this.lesson?.sections.length ?? 0;
    const current = total ? this.sectionIndex + 1 : 0;
    return {
      current,
      total,
      percent: total ? Math.round((current / total) * 100) : 0,
    };
  }

  listLessonIds() {
    return Object.keys(BUNDLED_LESSONS);
  }
}
