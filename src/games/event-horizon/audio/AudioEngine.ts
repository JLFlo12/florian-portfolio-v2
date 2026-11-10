const KEY = 'event-horizon-muted';
const VOLUME = 0.55;

export interface AudioFrame {
  /** Poussée des moteurs, 0 à 1.5. */
  power: number;
  /** Proximité du trou noir, 0 (loin) à 1 (horizon). */
  dread: number;
  /** Vitesse rapportée à la vitesse de croisière maximale. */
  speed: number;
  /** À l'intérieur du vaisseau : les moteurs s'entendent à travers la structure. 0 dehors, 1 près du réacteur. */
  inside?: number;
}

/**
 * Tout le son est synthétisé en direct (Web Audio) : aucun fichier, aucun droit d'auteur.
 * Dans le vide rien ne porte le son, donc on n'entend que le vaisseau (moteurs, coque,
 * électronique de bord) et une nappe grave qui tient lieu de bande-son près du trou noir.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private echo!: GainNode;
  private noise!: AudioBuffer;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private rumble: OscillatorNode[] = [];
  private droneGain!: GainNode;
  private drone: OscillatorNode[] = [];
  private windGain!: GainNode;
  private paused = false;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem(KEY) === '1'; } catch { /* stockage indisponible */ }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** À appeler depuis un clic ou une touche : les navigateurs refusent le son avant. */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : VOLUME;
    this.master.connect(ctx.destination);

    // Écho long et sourd pour les signaux : l'impression d'un grand volume vide
    this.echo = ctx.createGain();
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.47;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.5;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1400;
    this.echo.connect(delay).connect(damp).connect(feedback).connect(delay);
    damp.connect(this.master);

    // Bruit brun, réutilisé par les moteurs, la coque et le compteur de radiations
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const loop = (filterType: BiquadFilterType, frequency: number, q = 0.7) => {
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
      return { filter, gain };
    };
    const tones = (frequencies: number[], type: OscillatorType, cutoff: number) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.connect(gain).connect(this.master);
      const oscillators = frequencies.map((f) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = f;
        osc.connect(filter);
        osc.start();
        return osc;
      });
      return { gain, oscillators };
    };

    // Moteurs : souffle filtré + grondement transmis par la structure
    const engine = loop('lowpass', 220);
    this.engineGain = engine.gain;
    this.engineFilter = engine.filter;
    const rumble = tones([41, 61.7, 82.4], 'sawtooth', 150);
    this.rumbleGain = rumble.gain;
    this.rumble = rumble.oscillators;
    // Bourdonnement de bord, à peine audible : sans lui le silence paraît artificiel
    this.windGain = loop('bandpass', 140, 0.5).gain;
    this.windGain.gain.value = 0.05;
    // Nappe du trou noir : fréquences très graves presque à l'unisson, qui battent lentement
    const drone = tones([36, 37.1, 54.3, 72.9], 'sine', 400);
    this.droneGain = drone.gain;
    this.drone = drone.oscillators;
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else if (!this.paused) void this.ctx.resume();
  };

  setMuted(muted: boolean) {
    this.muted = muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* stockage indisponible */ }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : VOLUME, this.ctx.currentTime, 0.05);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend(); else void this.ctx.resume();
  }

  update(frame: AudioFrame) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const power = Math.min(frame.power, 1.5);
    const inside = frame.inside;
    const muffle = inside === undefined ? 1 : 0.28;
    this.engineGain.gain.setTargetAtTime((0.04 + power * 0.42) * (inside === undefined ? 1 : 0.6), t, 0.25);
    this.engineFilter.frequency.setTargetAtTime((160 + power * 900 + frame.speed * 500) * muffle, t, 0.3);
    this.rumbleGain.gain.setTargetAtTime(0.012 + power * 0.085 + (inside ?? 0) * 0.11, t, 0.3);
    this.windGain.gain.setTargetAtTime(inside === undefined ? 0.05 : 0.1, t, 0.4);
    this.rumble.forEach((osc, i) => osc.frequency.setTargetAtTime([41, 61.7, 82.4][i] * (1 + power * 0.22 + frame.speed * 0.25), t, 0.4));
    const d = frame.dread;
    this.droneGain.gain.setTargetAtTime(d * d * 0.5, t, 0.8);
    // Plus on descend, plus la nappe s'affaisse
    this.drone.forEach((osc, i) => osc.frequency.setTargetAtTime([36, 37.1, 54.3, 72.9][i] * (1 - d * 0.22), t, 1.2));
  }

  private tone(frequency: number, duration: number, gain: number, type: OscillatorType = 'sine', echo = false, slideTo?: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    if (echo) g.connect(this.echo);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private burst(frequency: number, q: number, duration: number, gain: number, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.08, duration * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(g).connect(this.master);
    source.start(t, Math.random() * 2);
    source.stop(t + duration + 0.05);
  }

  /** Balayage du scanner : une note par étape, de plus en plus haute. */
  scanTick(progress: number) { this.tone(620 + progress * 520, 0.07, 0.05, 'sine'); }

  scanDone() {
    this.tone(784, 0.5, 0.07, 'sine', true);
    this.tone(1175, 0.9, 0.06, 'sine', true, undefined, 0.14);
  }

  deny() { this.tone(150, 0.22, 0.07, 'square', false, 110); }

  /** Signal capté : trois notes isolées, loin dans l'écho. */
  signal() {
    [0, 0.5, 1.35].forEach((delay, i) => this.tone([523, 523, 392][i], 0.5, 0.06, 'sine', true, undefined, delay));
  }

  /** Contact inconnu : un seul coup de sonar, légèrement faux. */
  contact() { this.tone(207, 2.4, 0.09, 'sine', true, 196); }

  /** La coque travaille sous les forces de marée. */
  creak() {
    this.burst(90 + Math.random() * 60, 9, 1.1 + Math.random() * 0.8, 0.5, 55 + Math.random() * 30);
    this.tone(48 + Math.random() * 14, 1.4, 0.06, 'sawtooth', false, 38);
  }

  /** Coup sourd contre la coque, sans cause. */
  knock() {
    this.tone(70, 0.3, 0.2, 'sine', false, 34);
    this.burst(300, 2, 0.08, 0.25);
  }

  /** Un pas sur le plancher métallique. */
  step() {
    this.burst(170 + Math.random() * 70, 1.4, 0.07, 0.34);
    this.tone(62 + Math.random() * 12, 0.09, 0.05, 'sine', false, 40);
  }

  /** Un grain du compteur de radiations. */
  click() { this.burst(2600 + Math.random() * 1800, 3, 0.018, 0.5); }

  /** Charge du saut : une note qui monte pendant toute la durée, puis le choc de l'arrivée. */
  jump(duration: number) {
    this.tone(55, duration, 0.13, 'sawtooth', false, 440);
    this.tone(82, duration, 0.07, 'sine', true, 1320);
    this.tone(60, 1.8, 0.3, 'sine', true, 28, duration);
    setTimeout(() => this.burst(180, 0.8, 1.2, 0.5, 60), duration * 1000);
  }

  /** Chute vers l'horizon : tout descend, puis plus rien. */
  ending(duration: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(220, duration, 0.1, 'sine', true, 27);
    this.tone(331, duration, 0.05, 'sine', true, 20);
    this.droneGain.gain.cancelScheduledValues(t);
    this.droneGain.gain.setTargetAtTime(0.75, t, duration / 3);
    this.master.gain.setValueAtTime(this.muted ? 0 : VOLUME, t + duration - 0.5);
    this.master.gain.linearRampToValueAtTime(0, t + duration);
  }

  /** Rétablit le volume après la fin. */
  restore() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : VOLUME, t, 0.4);
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.ctx?.close();
    this.ctx = null;
  }
}
