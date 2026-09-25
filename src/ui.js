/* ui.js — واجهة عربية RTL */
export class UI {
  constructor() {
    this.startScreen = document.getElementById('start-screen');
    this.successScreen = document.getElementById('success-screen');
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.hint = document.getElementById('hint');
    this.crosshair = document.getElementById('crosshair');
  }

  onStart(cb) { this.startBtn.addEventListener('click', cb); }
  onRestart(cb) { this.restartBtn.addEventListener('click', () => window.location.reload()); if (cb) this.restartBtn.addEventListener('click', cb); }

  hideStart() {
    this.startScreen.classList.add('hidden');
    this.crosshair.classList.remove('hidden');
  }

  showHint(text, ms = 4000) {
    this.hint.textContent = text;
    this.hint.classList.remove('hidden');
    if (ms > 0) {
      clearTimeout(this._hintT);
      this._hintT = setTimeout(() => this.hint.classList.add('hidden'), ms);
    }
  }

  hideHint() { this.hint.classList.add('hidden'); }

  showSuccess() {
    this.successScreen.classList.remove('hidden');
    this.crosshair.classList.add('hidden');
    // خروج من Pointer Lock لإظهار المؤشر
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
}
