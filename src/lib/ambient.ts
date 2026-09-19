import { useSyncExternalStore } from 'react';

/* ───────────────────────────────────────────────────────────────
   Musique d'ambiance, générée en direct (Web Audio) : aucun fichier à
   télécharger, aucun droit d'auteur. Nappes douces en accords de 9e
   (ré, si mineur, sol, la), basse ronde, quelques notes de cloche dans
   un écho, le tout dans une réverbération. Volume bas, fondu de 5 s.
   Les navigateurs interdisent le son avant une interaction : la musique
   démarre au premier clic ou à la première touche, sauf si le visiteur
   l'a coupée (choix mémorisé). En pause quand l'onglet est caché.
   ─────────────────────────────────────────────────────────────── */

const VOLUME = 0.4;
const CHORD_LEN = 9;   // durée d'un accord (s)
const STEP = 0.5;      // grille des notes de cloche (s)
const KEY = 'florian-sound';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const CHORDS = [
  { bass: 38, pad: [54, 57, 61, 64, 69] }, // Ré maj9
  { bass: 47, pad: [50, 54, 57, 61, 66] }, // Si m9
  { bass: 43, pad: [50, 54, 57, 59, 66] }, // Sol maj9
  { bass: 45, pad: [52, 57, 59, 64, 66] }, // La 6/9 sus
];
const BELLS = [74, 76, 78, 81, 83, 86, 88]; // pentatonique de ré

type Ctx = AudioContext;

class Engine {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private pad!: GainNode;
  private bass!: GainNode;
  private bells!: GainNode;
  private timer = 0;
  private suspendTimer = 0;
  private nextChord = 0;
  private nextStep = 0;
  private chord = 0;
  playing = false;

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.05; comp.release.value = 0.4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    // Réverbération : réponse impulsionnelle de bruit qui décroît (5 s)
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(5, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(this.master);

    // Nappes : filtre passe-bas qui respire lentement
    this.pad = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 780; filter.Q.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.045; lfoDepth.gain.value = 320;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();
    this.pad.connect(filter);
    filter.connect(this.master);
    filter.connect(reverb);

    // Basse
    this.bass = ctx.createGain();
    this.bass.connect(this.master);

    // Cloches : écho filtré + réverbération
    this.bells = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 2400;
    this.bells.connect(this.master);
    this.bells.connect(reverb);
    this.bells.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(reverb);
    tone.connect(this.master);
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  private playChord(t: number) {
    const ctx = this.ctx!;
    const { bass, pad } = CHORDS[this.chord++ % CHORDS.length];
    const end = t + CHORD_LEN;
    pad.forEach((note, i) => {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.034, t + 3.5);
      env.gain.setValueAtTime(0.034, end);
      env.gain.linearRampToValueAtTime(0, end + 4);
      env.connect(this.pad);
      (['sawtooth', 'triangle'] as OscillatorType[]).forEach((type, k) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = hz(note);
        osc.detune.value = (k ? -1 : 1) * (4 + i * 1.5);
        osc.connect(env);
        osc.start(t);
        osc.stop(end + 4.1);
      });
    });
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.13, t + 2.5);
    env.gain.setValueAtTime(0.13, end);
    env.gain.linearRampToValueAtTime(0, end + 3);
    env.connect(this.bass);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz(bass);
    osc.connect(env);
    osc.start(t);
    osc.stop(end + 3.1);
  }

  private playBell(t: number) {
    const ctx = this.ctx!;
    const f = hz(BELLS[Math.floor(Math.random() * BELLS.length)]);
    const env = ctx.createGain();
    const level = 0.03 + Math.random() * 0.025;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    env.connect(this.bells);
    // Petite modulation de fréquence : timbre de cloche douce
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const depth = ctx.createGain();
    carrier.frequency.value = f;
    mod.frequency.value = f * 2;
    depth.gain.setValueAtTime(f * 0.9, t);
    depth.gain.exponentialRampToValueAtTime(1, t + 1.5);
    mod.connect(depth).connect(carrier.frequency);
    carrier.connect(env);
    [carrier, mod].forEach((o) => { o.start(t); o.stop(t + 3.3); });
  }

  private schedule = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    const ahead = ctx.currentTime + 1.2;
    while (this.nextChord < ahead) { this.playChord(this.nextChord); this.nextChord += CHORD_LEN; }
    while (this.nextStep < ahead) {
      if (Math.random() < 0.28) this.playBell(this.nextStep + Math.random() * 0.04);
      this.nextStep += STEP;
    }
  };

  start() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    clearTimeout(this.suspendTimer);
    void ctx.resume();
    const now = ctx.currentTime;
    if (this.nextChord < now) { this.nextChord = now + 0.05; this.nextStep = now + 2.5; }
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(VOLUME, now + 5);
    if (!this.timer) this.timer = window.setInterval(this.schedule, 300);
    this.schedule();
    this.playing = true;
  }

  stop() {
    const ctx = this.ctx;
    this.playing = false;
    if (!ctx) return;
    const now = ctx.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 1.2);
    clearInterval(this.timer);
    this.timer = 0;
    this.suspendTimer = window.setTimeout(() => { if (!this.playing) void ctx.suspend(); }, 1400);
  }
}

/* ——— État partagé (plusieurs boutons : en-tête et menu mobile) ——— */
const engine = new Engine();
const listeners = new Set<() => void>();
let wanted = true;
try { wanted = localStorage.getItem(KEY) !== 'off'; } catch { /* stockage indisponible */ }
let snapshot = { wanted, playing: false };
const emit = () => {
  snapshot = { wanted, playing: engine.playing };
  listeners.forEach((fn) => fn());
};

export const sound = {
  toggle() {
    wanted = !wanted;
    try { localStorage.setItem(KEY, wanted ? 'on' : 'off'); } catch { /* stockage indisponible */ }
    if (wanted) engine.start(); else engine.stop();
    emit();
  },
};

let armed = false;
/* Démarre la musique à la première interaction (clic, toucher, touche) si elle est voulue ;
   met en pause quand l'onglet est caché. */
export function armSound() {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const onGesture = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('[data-sound-toggle]')) return; // le bouton gère lui-même
    window.removeEventListener('click', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    if (wanted && !engine.playing) { engine.start(); emit(); }
  };
  window.addEventListener('click', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
  document.addEventListener('visibilitychange', () => {
    const ctx = engine.ctx;
    if (!ctx || !engine.playing) return;
    if (document.hidden) void ctx.suspend(); else void ctx.resume();
  });
}

export function useSound() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => snapshot,
    () => snapshot,
  );
}
