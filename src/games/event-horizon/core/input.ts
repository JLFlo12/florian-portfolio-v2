/** Clavier + souris. Les déplacements utilisent la position physique des touches
 *  (ZQSD sur AZERTY = WASD sur QWERTY) ; les raccourcis utilisent la lettre tapée. */
export class Input {
  private codes = new Set<string>();
  private pressed: string[] = [];
  private dragX = 0;
  private dragY = 0;
  private wheel = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContext);
  }

  down(code: string) { return this.codes.has(code); }

  /** Touches pressées depuis le dernier appel (lettre en minuscule, ou nom de touche). */
  consume() {
    const keys = this.pressed;
    this.pressed = [];
    return keys;
  }

  takePointer() {
    const d = { x: this.dragX, y: this.dragY, wheel: this.wheel };
    this.dragX = 0; this.dragY = 0; this.wheel = 0;
    return d;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.codes.add(e.code);
    if (!e.repeat) this.pressed.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.codes.delete(e.code); };
  private onBlur = () => { this.codes.clear(); this.dragging = false; };
  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragX += e.clientX - this.lastX; this.dragY += e.clientY - this.lastY;
    this.lastX = e.clientX; this.lastY = e.clientY;
  };
  private onPointerUp = () => { this.dragging = false; };
  private onWheel = (e: WheelEvent) => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); };
  private onContext = (e: Event) => e.preventDefault();

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.onContext);
  }
}
