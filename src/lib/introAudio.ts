/* ═══════════════════════════════════════════════════════════════
   MOTEUR AUDIO CINÉMATIQUE POUR L'INTRO (Web Audio API)
   Synthèse sonore 100 % procédurale : 0 Mo à télécharger, zéro latence,
   haute dynamique, calibrée pour l'expérience cinématographique.
   Inspirée des codes du sound-design de cinéma (Hans Zimmer, Denis Villeneuve) :
   infra-basses "Braaam", résonances cristallines, déchirure cinétique,
   vortex d'aspiration spatiale et accord de résolution.
   ═══════════════════════════════════════════════════════════════ */

type AudioCtx = AudioContext;

class IntroAudioEngine {
  private ctx: AudioCtx | null = null;
  private master: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWet: GainNode | null = null;
  private heartbeatTimer: number | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;
  private tensionFilter: BiquadFilterNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private isMuted = false;

  private init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.85;

    // Limiteur / compresseur de sécurité cinématographique
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    // Réverbération spatiale procédurale (4.2s de décroissance immersive)
    try {
      const reverb = ctx.createConvolver();
      reverb.buffer = this.buildImpulse(ctx, 4.2, 2.8);
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      reverb.connect(wet);
      wet.connect(master);
      this.reverbNode = reverb;
      this.reverbWet = wet;
    } catch {
      // Fallback sans convolver si mémoire basse
    }

    return ctx;
  }

  private buildImpulse(ctx: AudioCtx, duration: number, decay: number) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  /** Lance le son d'ignition au clic : sub-bass "Braaam" profond + nappe éthérée */
  ignite() {
    const ctx = this.init();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    // 1. Sub-bass "Braaam" (impact cinématographique d'ouverture)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const subFilter = ctx.createBiquadFilter();

    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(62, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 1.8);

    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(160, t);
    subFilter.frequency.exponentialRampToValueAtTime(50, t + 2.2);
    subFilter.Q.value = 4.5;

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.exponentialRampToValueAtTime(0.75, t + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.master);
    subOsc.start(t);
    subOsc.stop(t + 2.7);

    // 2. Chœur éthéré spatial (fréquences célestes en accord de Ré)
    const notes = [293.66, 440, 587.33, 739.99]; // D4, A4, D5, F#5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (idx % 2 === 0 ? 0.4 : -0.4), t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.08 / (idx + 1), t + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 4.5);

      osc.connect(gain);
      gain.connect(this.master!);
      if (this.reverbNode) gain.connect(this.reverbNode);
      osc.start(t);
      osc.stop(t + 4.6);
    });

    // 3. Démarre la nappe de tension continue qui s'intensifiera avec l'approche
    this.startTension(t);
  }

  private startTension(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t); // A2

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, t);
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 1.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    if (this.reverbNode) gain.connect(this.reverbNode);
    osc.start(t);

    this.tensionOsc = osc;
    this.tensionGain = gain;
    this.tensionFilter = filter;

    // Battement de cœur très subtil au début (44 bpm)
    this.scheduleHeartbeat(1.36);
  }

  private scheduleHeartbeat(intervalSec: number) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ctx || !this.master) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(54, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.12);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.25);
    }, intervalSec * 1000);
  }

  /** Évolution dynamique de la tension pendant l'approche des deux mains (0 à 1) */
  setTension(progress: number) {
    if (!this.ctx || !this.tensionFilter || !this.tensionGain) return;
    const t = this.ctx.currentTime;
    // Ouvre le filtre et monte la résonance au fur et à mesure que les doigts se rapprochent
    const freq = 180 + Math.pow(progress, 2) * 620;
    this.tensionFilter.frequency.setTargetAtTime(freq, t, 0.1);
    this.tensionGain.gain.setTargetAtTime(0.06 + progress * 0.14, t, 0.1);
  }

  /** Le moment du contact (5.2s) : étincelle de vie, carillon harmonique céleste et sub-impact */
  touch() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 1. Carillon d'or pur (harmoniques cristallines de l'étincelle divine)
    const chimes = [587.33, 880, 1174.66, 1760, 2349.32]; // D5, A5, D6, A6, D7
    chimes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.012);

      gain.gain.setValueAtTime(0.001, t + i * 0.012);
      gain.gain.exponentialRampToValueAtTime(0.22 / (i * 0.7 + 1), t + i * 0.012 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8 + i * 0.2);

      osc.connect(gain);
      gain.connect(this.master!);
      if (this.reverbNode) gain.connect(this.reverbNode);
      osc.start(t + i * 0.012);
      osc.stop(t + 3.2);
    });

    // 2. Onde de choc thermique subtile (sub warm touch)
    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(68, t);
    sub.frequency.exponentialRampToValueAtTime(42, t + 0.8);
    sGain.gain.setValueAtTime(0.35, t);
    sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    sub.connect(sGain);
    sGain.connect(this.master);
    sub.start(t);
    sub.stop(t + 0.95);

    // 3. Drone de caresse réverbéré (maintien de la lueur)
    const drone = ctx.createOscillator();
    const dGain = ctx.createGain();
    drone.type = 'triangle';
    drone.frequency.setValueAtTime(146.83, t); // D3
    dGain.gain.setValueAtTime(0.001, t);
    dGain.gain.exponentialRampToValueAtTime(0.12, t + 0.3);
    dGain.gain.linearRampToValueAtTime(0.08, t + 1.8);
    drone.connect(dGain);
    dGain.connect(this.master);
    if (this.reverbNode) dGain.connect(this.reverbNode);
    drone.start(t);
    this.droneOscs.push(drone);
  }

  /** Séparation brusque (7.2s) : onde de choc tellurique et déchirure de l'espace */
  split() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Coupe les drones antérieurs immédiatement
    this.droneOscs.forEach((o) => {
      try { o.stop(t + 0.05); } catch { /* déjà arrêté */ }
    });
    this.droneOscs = [];
    if (this.tensionOsc) {
      try { this.tensionOsc.stop(t + 0.05); } catch { /* déjà arrêté */ }
      this.tensionOsc = null;
    }

    // 1. Impact sub-lourd cinématique (38 Hz sub drop avec claquement d'attaque)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.35);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(280, t);
    subFilter.frequency.exponentialRampToValueAtTime(45, t + 1.5);
    subFilter.Q.value = 6;

    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.master);
    sub.start(t);
    sub.stop(t + 2.3);

    // 2. Déchirure cinétique (bruit blanc filtré à balayage rapide)
    const noiseLength = ctx.sampleRate * 0.9;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLength, 1.8);

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(220, t + 0.8);
    noiseFilter.Q.value = 2.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    if (this.reverbNode) noiseGain.connect(this.reverbNode);
    noiseSource.start(t);

    // 3. Chute aux enfers : plainte harmonique tragique descendante (la main gauche qui sombre dans les abysses)
    const lament = ctx.createOscillator();
    const lGain = ctx.createGain();
    const lFilter = ctx.createBiquadFilter();
    lament.type = 'sawtooth';
    lament.frequency.setValueAtTime(220, t + 0.05); // A3
    lament.frequency.exponentialRampToValueAtTime(55, t + 2.0); // Chute vers A1 dans le gouffre
    lFilter.type = 'lowpass';
    lFilter.frequency.setValueAtTime(500, t + 0.05);
    lFilter.frequency.exponentialRampToValueAtTime(110, t + 2.0);
    lFilter.Q.value = 4;
    lGain.gain.setValueAtTime(0.001, t + 0.05);
    lGain.gain.linearRampToValueAtTime(0.24, t + 0.35);
    lGain.gain.exponentialRampToValueAtTime(0.001, t + 2.1);
    lament.connect(lFilter);
    lFilter.connect(lGain);
    lGain.connect(this.master);
    if (this.reverbNode) lGain.connect(this.reverbNode);
    lament.start(t + 0.05);
    lament.stop(t + 2.2);

    // 4. Ascension au paradis : chœur céleste montant et carillon d'or blanc (la main droite s'élève au ciel)
    const heavenNotes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    heavenNotes.forEach((freq, idx) => {
      const hOsc = ctx.createOscillator();
      const hGain = ctx.createGain();
      hOsc.type = 'sine';
      hOsc.frequency.setValueAtTime(freq, t + 0.15);
      hOsc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 3.2); // élévation douce et sereine vers les cieux
      hGain.gain.setValueAtTime(0.001, t + 0.15);
      hGain.gain.linearRampToValueAtTime(0.08 / (idx + 1), t + 0.9);
      hGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
      hOsc.connect(hGain);
      hGain.connect(this.master!);
      if (this.reverbNode) hGain.connect(this.reverbNode);
      hOsc.start(t + 0.15);
      hOsc.stop(t + 3.4);
    });

    // 5. Traversée cosmique (vent spatial et souffle à travers les braises)
    this.playTransitWhoosh(t + 0.25);
  }

  private playTransitWhoosh(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const dur = 2.2;
    const noiseLength = ctx.sampleRate * dur;
    const noiseBuffer = ctx.createBuffer(2, noiseLength, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = noiseBuffer.getChannelData(c);
      for (let i = 0; i < noiseLength; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / noiseLength);
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, t);
    filter.frequency.exponentialRampToValueAtTime(950, t + 1.0);
    filter.frequency.exponentialRampToValueAtTime(120, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    if (this.reverbNode) gain.connect(this.reverbNode);
    source.start(t);
  }

  /** Apparition de l'œil de marbre : drone caverneux mystique et pulsation cardiaque lente */
  eyeReveal() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Drone caverneux de pierre (quinte mystique 73Hz / 110Hz)
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const gain = ctx.createGain();

    o1.type = 'sine';
    o1.frequency.setValueAtTime(73.42, t); // D2
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(110, t); // A2

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 1.2);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    if (this.reverbNode) gain.connect(this.reverbNode);

    o1.start(t);
    o2.start(t);
    this.droneOscs.push(o1, o2);

    // Deux battements de cœur caverneux lents
    this.scheduleHeartbeat(1.8);
  }

  /** Plongeon dans la pupille : vortex d'aspiration spatiale qui monte en flèche, puis coupure nette */
  dive() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Arrêt doux des drones de l'œil
    this.droneOscs.forEach((o) => {
      try { o.stop(t + 0.2); } catch { /* déjà arrêté */ }
    });
    this.droneOscs = [];

    // Vortex d'aspiration qui accélère vers le néant
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.95);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.95);
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.48, t + 0.88);
    // Coupure vacuum brutale juste avant la fin (silence dramatique de 80ms)
    gain.gain.setValueAtTime(0.0001, t + 0.96);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    if (this.reverbNode) gain.connect(this.reverbNode);
    osc.start(t);
    osc.stop(t + 1.0);
  }

  /** Ouverture du portail vers le site : résolution majestueuse en Ré majeur (accord du site) */
  portalReveal() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Sub bloom d'arrivée
    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, t);
    sub.frequency.exponentialRampToValueAtTime(36.7, t + 1.4); // D1
    sGain.gain.setValueAtTime(0.45, t);
    sGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    sub.connect(sGain);
    sGain.connect(this.master);
    sub.start(t);
    sub.stop(t + 2.1);

    // Accord majestueux Ré majeur 9 (harmonie avec ambient.ts)
    const chord = [293.66, 369.99, 440, 554.37, 659.25]; // D4, F#4, A4, C#5, E5
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.16 / (idx * 0.5 + 1), t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);

      osc.connect(gain);
      gain.connect(this.master!);
      if (this.reverbNode) gain.connect(this.reverbNode);
      osc.start(t);
      osc.stop(t + 3.2);
    });
  }

  /** Coupe ou restaure le son */
  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  /** Arrêt complet et nettoyage */
  dispose() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.droneOscs.forEach((o) => {
      try { o.stop(); } catch { /* déjà arrêté */ }
    });
    this.droneOscs = [];
    if (this.tensionOsc) {
      try { this.tensionOsc.stop(); } catch { /* déjà arrêté */ }
      this.tensionOsc = null;
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch { /* déjà arrêté */ }
      this.ctx = null;
    }
  }
}

export const introAudio = new IntroAudioEngine();
