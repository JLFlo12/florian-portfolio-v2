import { liveAudio } from '@/lib/ambient';

/* ───────────────────────────────────────────────────────────────
   Bruitages de la station, générés en direct (Web Audio, aucun fichier) et très discrets :
   - souffle du déplacement : bruit brun filtré dont le volume et la brillance suivent
     la vitesse réelle de la caméra (silence quand elle ralentit près d'un module) ;
   - grondement grave sous le souffle, pour la masse ;
   - mécanismes : ronronnement de moteur (deux dents de scie filtrées) quand le module
     visité s'anime (portes, paraboles, carrousel, capsules).
   Branché sur le contexte de la musique du site : couper le son coupe aussi les bruitages.
   ─────────────────────────────────────────────────────────────── */

export interface StationAudio {
  update(speed: number, motion: number): void;
  silence(): void;
  dispose(): void;
}

interface Graph {
  ctx: AudioContext;
  out: GainNode;
  whoosh: GainNode;
  band: BiquadFilterNode;
  rumble: GainNode;
  servo: GainNode;
  stop(): void;
}

function brownNoise(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let last = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last;
      peak = Math.max(peak, Math.abs(last));
    }
    for (let i = 0; i < data.length; i++) data[i] /= peak || 1;
  }
  return buffer;
}

function build(ctx: AudioContext): Graph {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);

  const noise = ctx.createBufferSource();
  noise.buffer = brownNoise(ctx, 4);
  noise.loop = true;

  // Souffle : bande de fréquences qui monte avec la vitesse
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 260;
  band.Q.value = 0.8;
  const whoosh = ctx.createGain();
  whoosh.gain.value = 0;
  noise.connect(band).connect(whoosh).connect(out);

  // Grondement grave
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 130;
  const rumble = ctx.createGain();
  rumble.gain.value = 0;
  noise.connect(low).connect(rumble).connect(out);

  // Mécanismes : deux dents de scie graves, légèrement désaccordées, avec un vibrato lent
  const servoFilter = ctx.createBiquadFilter();
  servoFilter.type = 'lowpass';
  servoFilter.frequency.value = 320;
  servoFilter.Q.value = 3;
  const servo = ctx.createGain();
  servo.gain.value = 0;
  servoFilter.connect(servo).connect(out);
  const oscs = [46, 69.4].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(servoFilter);
    return o;
  });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = ctx.createGain();
  depth.gain.value = 1.4;
  lfo.connect(depth);
  oscs.forEach((o) => depth.connect(o.frequency));

  noise.start();
  oscs.forEach((o) => o.start());
  lfo.start();
  return {
    ctx, out, whoosh, band, rumble, servo,
    stop() {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(0, now, 0.05);
      [noise, lfo, ...oscs].forEach((n) => { try { n.stop(now + 0.3); } catch { /* déjà arrêté */ } });
      window.setTimeout(() => out.disconnect(), 400);
    },
  };
}

export function createStationAudio(): StationAudio {
  let g: Graph | null = null;
  const fade = () => { if (g) g.out.gain.setTargetAtTime(0, g.ctx.currentTime, 0.2); };
  if (import.meta.env.DEV) (window as unknown as { __stationAudio?: unknown }).__stationAudio = () => g && { out: g.out.gain.value, whoosh: g.whoosh.gain.value, rumble: g.rumble.gain.value, servo: g.servo.gain.value, freq: g.band.frequency.value };
  return {
    update(speed, motion) {
      const ctx = liveAudio();
      if (!ctx) { fade(); return; }
      if (!g || g.ctx !== ctx) { g?.stop(); g = build(ctx); }
      const now = ctx.currentTime;
      const s = Math.min(1.2, speed / 80);
      g.out.gain.setTargetAtTime(1, now, 0.4);
      g.whoosh.gain.setTargetAtTime(0.05 * Math.pow(s, 1.4), now, 0.09);
      g.band.frequency.setTargetAtTime(240 + 820 * s, now, 0.12);
      g.rumble.gain.setTargetAtTime(0.045 * Math.min(1, s * 1.3), now, 0.15);
      g.servo.gain.setTargetAtTime(0.012 * Math.min(1, motion), now, 0.12);
    },
    silence: fade,
    dispose() { g?.stop(); g = null; },
  };
}
