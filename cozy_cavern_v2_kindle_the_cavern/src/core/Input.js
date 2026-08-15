export class Input {
  constructor(domElement) {
    this.keys = new Set();
    this.pressed = new Set();
    this.wheel = 0;

    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE'].includes(e.code)) e.preventDefault();
    }, { passive: false });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // Camera rotation is intentionally disabled in Cozy Cavern. Do not capture
    // mouse buttons here; left/right click remain free for future world/UI actions.
    domElement.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  down(...codes) { return codes.some((code) => this.keys.has(code)); }
  consume(code) { const hit = this.pressed.has(code); this.pressed.delete(code); return hit; }
  endFrame() { this.wheel = 0; this.pressed.clear(); }
}
