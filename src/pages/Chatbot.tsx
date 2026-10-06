import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Mic, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { AccentTitle, useReveal } from '@/lib/motion';
import { buildJarvisContext } from '@/lib/jarvisContext';
import { useDynamicProjects } from '@/hooks/useDynamicProjects';
import JarvisOrb, { type OrbMode } from '@/components/fx/JarvisOrb';
import { canListen, canSpeak, listen, Speaker, type Listener } from '@/lib/voice';

type Msg = { role: 'user' | 'assistant'; content: string };
type ApiMsg = { role: 'system' | 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cyberbot-chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  errors,
}: {
  messages: ApiMsg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  errors: { tooMany: string; noCredits: string };
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (resp.status === 429) {
    toast.error(errors.tooMany);
    throw new Error('Rate limited');
  }
  if (resp.status === 402) {
    toast.error(errors.noCredits);
    throw new Error('Payment required');
  }
  if (!resp.ok || !resp.body) throw new Error('Failed to start stream');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

const Chatbot = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const { data: projects = [] } = useDynamicProjects();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [talking, setTalking] = useState(false); // Jarvis parle (synthèse vocale)
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('florian-jarvis-voice') !== 'off'; } catch { return true; }
  });
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  // État lu par les fonctions appelées plus tard (fin de l'écoute, fin de la voix) : toujours à jour
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const busy = useRef(false);
  const listener = useRef<Listener | null>(null);
  const speaker = useRef<Speaker | null>(null);
  const conversation = useRef(false); // conversation vocale : le micro se rouvre après chaque réponse dite à voix haute

  // Descend automatiquement dans le fil de discussion (sans faire défiler toute la page)
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Voix chargées à l'avance ; en quittant la page, le micro et la voix s'arrêtent
  useEffect(() => {
    if (canSpeak) window.speechSynthesis.getVoices();
    return () => {
      conversation.current = false;
      listener.current?.abort();
      if (canSpeak) window.speechSynthesis.cancel();
    };
  }, []);

  /* Coupe la parole à Jarvis, sans rouvrir le micro */
  const hush = () => {
    const current = speaker.current;
    speaker.current = null;
    current?.stop();
    setTalking(false);
  };

  const send = async (override?: string, spoken = false) => {
    const text = (override ?? input).trim();
    if (!text || busy.current) return;
    busy.current = true;

    const userMsg: Msg = { role: 'user', content: text };
    const history = messagesRef.current;
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Question posée à voix haute : Jarvis répond aussi à voix haute (si sa voix est activée),
    // puis le micro se rouvre pour la suite de la conversation
    hush();
    const voice: Speaker | null = spoken && voiceOnRef.current && canSpeak
      ? new Speaker(lang, (on) => {
        if (speaker.current !== voice) return;
        setTalking(on);
        if (!on) {
          speaker.current = null;
          if (conversation.current) startListening();
        }
      })
      : null;
    speaker.current = voice;

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        // Le contexte à jour (date, projets, profil) précède la conversation, sans être affiché
        messages: [{ role: 'system', content: buildJarvisContext({ projects, lang: i18n.language }) }, ...history, userMsg],
        onDelta: (chunk) => { upsertAssistant(chunk); voice?.push(chunk); },
        onDone: () => { busy.current = false; setIsLoading(false); voice?.end(); },
        errors: { tooMany: t('chatbot.tooMany'), noCredits: t('chatbot.noCredits') },
      });
    } catch (e) {
      console.error(e);
      busy.current = false;
      setIsLoading(false);
      conversation.current = false;
      if (speaker.current === voice) hush();
    }
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  /* Micro : écoute une question, l'affiche au fil de la parole, puis l'envoie.
     Un silence (rien de compris) termine la conversation vocale. */
  const startListening = () => {
    if (!canListen || listener.current || busy.current) return;
    hush();
    setInput('');
    setListening(true);
    listener.current = listen({
      lang: lang === 'fr' ? 'fr-FR' : 'en-US',
      onText: setInput,
      onError: (error) => {
        conversation.current = false;
        if (error === 'not-allowed' || error === 'service-not-allowed') toast.error(t('chatbot.micDenied'));
        else if (error !== 'no-speech' && error !== 'aborted') toast.error(t('chatbot.micError'));
      },
      onEnd: (heard) => {
        listener.current = null;
        setListening(false);
        if (heard) {
          conversation.current = true;
          sendRef.current(heard, true);
        } else {
          conversation.current = false;
          setInput('');
        }
      },
    });
    if (!listener.current) setListening(false);
  };

  // Toucher le micro (ou Jarvis) : écouter ; pendant l'écoute, terminer et envoyer ce qui a été dit
  const toggleMic = () => {
    if (listener.current) listener.current.stop();
    else startListening();
  };

  // Voix de Jarvis : la couper l'arrête aussitôt et termine la conversation vocale
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try { localStorage.setItem('florian-jarvis-voice', next ? 'on' : 'off'); } catch { /* stockage indisponible */ }
    if (!next) { conversation.current = false; hush(); }
  };

  // Sphère de Jarvis : elle écoute, réfléchit en attendant la réponse, puis bat comme un cœur pendant qu'il répond ou parle
  const orbMode: OrbMode = listening ? 'listening'
    : isLoading && messages[messages.length - 1]?.role !== 'assistant' ? 'thinking'
    : isLoading || talking ? 'speaking' : 'idle';
  const status = {
    listening: t('chatbot.listening'),
    thinking: t('chatbot.thinking'),
    speaking: t('chatbot.speaking'),
    idle: canListen ? t('chatbot.voiceHint') : '',
  }[orbMode];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div ref={page} className="flex min-h-[100svh] flex-col overflow-x-clip pb-8 pt-[calc(var(--nav-h)+28px)]">
      <div className="container-x flex max-w-5xl flex-1 flex-col">
        {/* En-tête centré : la sphère de Jarvis (on la touche pour lui parler), puis le titre et l'état */}
        <header className="mb-6 flex flex-col items-center text-center">
          {canListen ? (
            <button
              type="button"
              onClick={toggleMic}
              disabled={isLoading}
              aria-pressed={listening}
              aria-label={listening ? t('chatbot.micStop') : t('chatbot.mic')}
              className="jarvis-orb-btn"
            >
              <JarvisOrb mode={orbMode} />
            </button>
          ) : (
            <JarvisOrb mode={orbMode} />
          )}
          <AccentTitle as="h1" text="Jarvis" serifWords={0} band={0.12} className="mt-6 display-xl text-[clamp(2.6rem,7vw,5rem)]" />
          <p className="mt-2 max-w-md text-sm text-muted-foreground" data-reveal>{t('chatbot.subtitle')}</p>
          <p className="mt-3 min-h-[1rem] font-mono text-[.7rem] uppercase tracking-[.14em] text-primary" aria-live="polite">{status}</p>
        </header>

        {/* Fenêtre de discussion */}
        <div className="panel relative flex flex-1 flex-col" data-reveal>
          <div className="hud-frame inset-2" aria-hidden="true"><i /><i /><i /><i /></div>

          <div ref={scroller} data-lenis-prevent className="relative max-h-[62vh] min-h-[300px] flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
            {/* Accueil (la sphère, au-dessus, représente déjà Jarvis) */}
            {messages.length === 0 && (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
                <p className="font-display text-xl font-bold [font-stretch:110%]">{t('chatbot.welcome')}</p>
                <p className="text-sm text-muted-foreground">{t('chatbot.hint')}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${msg.role === 'user' ? 'border-primary/40 bg-primary/15' : 'border-border bg-muted'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-foreground/70" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'whitespace-pre-wrap rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border border-border bg-muted/60 text-foreground'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert
                      [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
                      [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                      [&_code]:rounded-md [&_code]:bg-background/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
                      [&_h1]:mb-1.5 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold
                      [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold
                      [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold
                      [&_hr]:my-3 [&_hr]:border-border [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-1.5 [&_p]:leading-relaxed
                      [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-background/50 [&_pre]:p-3
                      [&_strong]:font-semibold [&_strong]:text-foreground
                      [&_table]:border-collapse [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-xs
                      [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_ul]:my-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                      {isLoading && i === messages.length - 1 && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary" />
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  <Bot className="h-4 w-4 text-foreground/70" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-border bg-muted/60 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Saisie */}
          <div className="relative border-t border-border p-4">
            <div className="flex items-center gap-2.5">
              {/* Réponses à voix haute (activées par défaut, choix mémorisé) */}
              {canSpeak ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-pressed={voiceOn}
                  aria-label={t('chatbot.voice')}
                  title={t('chatbot.voice')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary aria-pressed:text-primary"
                >
                  {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              ) : (
                <span className="hidden font-mono text-sm text-primary sm:block">&gt;_</span>
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                // Taper au clavier termine la conversation vocale
                onChange={e => { setInput(e.target.value); conversation.current = false; }}
                onKeyDown={handleKeyDown}
                placeholder={listening ? t('chatbot.listening') : t('chatbot.placeholder')}
                disabled={isLoading}
                aria-label={t('chatbot.placeholder')}
                className="h-12 min-w-0 flex-1 rounded-full border border-border bg-background/60 px-5 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              {canListen && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isLoading}
                  aria-pressed={listening}
                  aria-label={listening ? t('chatbot.micStop') : t('chatbot.mic')}
                  className={`mic-btn liquid inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40 ${listening ? 'is-on text-primary' : 'text-foreground hover:text-primary'}`}
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || isLoading}
                aria-label={t('chatbot.send')}
                className="btn-neon h-12 w-12 !p-0 disabled:pointer-events-none disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
