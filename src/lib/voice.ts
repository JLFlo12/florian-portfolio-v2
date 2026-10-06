/* ───────────────────────────────────────────────────────────────
   Voix de Jarvis, avec les outils du navigateur (Web Speech API) :
   - reconnaissance vocale (micro → texte) : Chrome et Edge envoient le son à leurs serveurs
     (Google, Microsoft), Safari à Apple ; absente de Firefox (le micro est alors masqué) ;
   - synthèse vocale (texte → voix) : voix du système ou du navigateur.
   Le site n'enregistre rien : seul le texte reconnu est envoyé à Jarvis, comme une question tapée.
   ─────────────────────────────────────────────────────────────── */

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const speechWindow = (typeof window === 'undefined' ? {} : window) as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
const RecognitionImpl = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

export const canListen = !!RecognitionImpl;
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export type Listener = Recognition;

/* Écoute une question : texte provisoire au fil de la parole, puis texte final (vide si rien n'a été compris).
   stop() termine l'écoute et garde ce qui a été dit ; abort() l'annule. */
export const listen = ({ lang, onText, onEnd, onError }: {
  lang: string;
  onText: (text: string) => void;
  onEnd: (text: string) => void;
  onError: (error: string) => void;
}): Listener | null => {
  if (!RecognitionImpl) return null;
  const rec = new RecognitionImpl();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let final = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    onText((final + interim).trim());
  };
  rec.onerror = (e) => onError(e.error);
  rec.onend = () => onEnd(final.trim());
  rec.start();
  return rec;
};

/* Texte lisible à voix haute : sans Markdown, code, liens ni emojis */
const speakable = (md: string) => md
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`([^`]*)`/g, '$1')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
  .replace(/[*_#>|~]+/g, ' ')
  .replace(/\p{Extended_Pictographic}/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Voix de la langue voulue, de préférence « naturelle » et masculine, comme Jarvis */
const pickVoice = (lang: string) => {
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|online|neural|premium|enhanced/i.test(v.name) ? 4 : 0) +
    (/henri|thomas|paul|antoine|claude|daniel|guy|ryan|george|arthur|male|homme/i.test(v.name) ? 2 : 0) +
    (/google/i.test(v.name) ? 1 : 0);
  return window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang))
    .sort((a, b) => score(b) - score(a))[0];
};

/* Lit une réponse au fil de son arrivée : chaque phrase terminée est dite tout de suite.
   onChange(true) quand Jarvis commence à parler, onChange(false) quand il a tout dit (ou qu'on l'arrête). */
export class Speaker {
  private buffer = '';
  private pending = 0;
  private finished = false;

  constructor(private lang: 'fr' | 'en', private onChange: (speaking: boolean) => void) {}

  push(text: string) {
    this.buffer += text;
    this.flush(false);
  }

  end() {
    this.finished = true;
    this.flush(true);
    if (!this.pending) this.onChange(false);
  }

  stop() {
    this.buffer = '';
    this.pending = 0;
    this.finished = true;
    window.speechSynthesis.cancel();
    this.onChange(false);
  }

  private flush(all: boolean) {
    let cut = all ? this.buffer.length : -1;
    if (!all) {
      const end = /[.!?…;:](?=\s)|\n/g;
      for (let m = end.exec(this.buffer); m; m = end.exec(this.buffer)) cut = m.index + 1;
    }
    if (cut <= 0) return;
    const text = this.buffer.slice(0, cut);
    this.buffer = this.buffer.slice(cut);
    // Une phrase par énoncé : certaines voix s'arrêtent net sur les textes longs
    text.split(/(?<=[.!?…])\s+|\n+/).map(speakable).filter(Boolean).forEach((sentence) => this.say(sentence));
  }

  private say(sentence: string) {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = this.lang === 'fr' ? 'fr-FR' : 'en-GB';
    const voice = pickVoice(this.lang);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.03;
    utterance.pitch = 0.9;
    const done = () => {
      this.pending = Math.max(0, this.pending - 1);
      if (!this.pending && this.finished && !this.buffer) this.onChange(false);
    };
    utterance.onend = done;
    utterance.onerror = done;
    this.pending++;
    this.onChange(true);
    window.speechSynthesis.speak(utterance);
  }
}
