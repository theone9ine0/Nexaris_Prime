/**
 * PR44 — optional scan chamber ambience hooks (placeholder for audio assets).
 */
export class ScanAmbience {
  constructor() {
    this.enabled = true;
    this._ctx = null;
    this._humOsc = null;
    this._gain = null;
  }

  /**
   * @param {boolean} active
   */
  setActive(active) {
    if (!this.enabled) return;
    if (active) this._startHum();
    else this._stopHum();
  }

  /**
   * @param {number} intensity 0–1
   */
  pulseScan(intensity = 1) {
    if (!this.enabled || !this._ctx) return;
    this._beep(220 + intensity * 80, 0.08, 0.04);
  }

  /**
   * UI interaction beep.
   */
  uiBeep() {
    if (!this.enabled) return;
    this._ensureContext();
    this._beep(520, 0.06, 0.03);
  }

  completeChime() {
    if (!this.enabled) return;
    this._ensureContext();
    this._beep(660, 0.12, 0.05);
    setTimeout(() => this._beep(880, 0.15, 0.04), 80);
  }

  _ensureContext() {
    if (this._ctx) return;
    try {
      this._ctx = new AudioContext();
    } catch {
      this.enabled = false;
    }
  }

  _startHum() {
    this._ensureContext();
    if (!this._ctx || this._humOsc) return;

    this._humOsc = this._ctx.createOscillator();
    this._humOsc.type = 'sine';
    this._humOsc.frequency.value = 55;

    this._gain = this._ctx.createGain();
    this._gain.gain.value = 0.018;

    this._humOsc.connect(this._gain);
    this._gain.connect(this._ctx.destination);
    this._humOsc.start();
  }

  _stopHum() {
    try {
      this._humOsc?.stop();
      this._humOsc?.disconnect();
    } catch {
      // already stopped
    }
    this._humOsc = null;
    this._gain = null;
  }

  /**
   * @param {number} freq
   * @param {number} duration
   * @param {number} volume
   */
  _beep(freq, duration, volume) {
    if (!this._ctx) return;
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(this._ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
    osc.stop(this._ctx.currentTime + duration);
  }

  dispose() {
    this._stopHum();
    this._ctx?.close();
    this._ctx = null;
  }
}
