import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { AccentTitle, useReveal } from '@/lib/motion';
import { buildJarvisContext } from '@/lib/jarvisContext';
import { useDynamicProjects } from '@/hooks/useDynamicProjects';

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
  const { data: projects = [] } = useDynamicProjects();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  // Descend automatiquement dans le fil de discussion (sans faire défiler toute la page)
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text };
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

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
        messages: [{ role: 'system', content: buildJarvisContext({ projects, lang: i18n.language }) }, ...messages, userMsg],
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
        errors: { tooMany: t('chatbot.tooMany'), noCredits: t('chatbot.noCredits') },
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div ref={page} className="flex min-h-[100svh] flex-col pb-8 pt-[calc(var(--nav-h)+28px)]">
      <div className="container-x flex max-w-5xl flex-1 flex-col">
        {/* En-tête */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow" data-band>
              <span className="eyebrow__index">AI</span>
              <span className="eyebrow__rule" data-rule aria-hidden="true" />
              <span className="eyebrow__label">jarvis</span>
            </p>
            <AccentTitle as="h1" text="Jarvis" serifWords={0} band={0.12} className="mt-4 display-xl text-[clamp(3rem,9vw,6.5rem)]" />
          </div>
          <div className="hud-panel max-w-xs" data-reveal>
            <p className="flex items-center gap-2 text-foreground"><span className="status-dot" /> {t('ui.online')}</p>
            <p className="mt-1">{t('chatbot.subtitle')}</p>
          </div>
        </header>

        {/* Fenêtre de discussion */}
        <div className="panel relative flex flex-1 flex-col" data-reveal>
          <div className="hud-frame inset-2" aria-hidden="true"><i /><i /><i /><i /></div>

          <div ref={scroller} data-lenis-prevent className="relative max-h-[62vh] min-h-[460px] flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
            {messages.length === 0 && (
              <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-5 text-center">
                <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                  <Bot className="h-9 w-9 text-primary" />
                  <span className="absolute -right-1 -top-1"><span className="status-dot block" /></span>
                </div>
                <div className="space-y-2">
                  <p className="font-display text-xl font-bold [font-stretch:110%]">{t('chatbot.welcome')}</p>
                  <p className="text-sm text-muted-foreground">{t('chatbot.hint')}</p>
                </div>
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
              <span className="hidden font-mono text-sm text-primary sm:block">&gt;_</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chatbot.placeholder')}
                disabled={isLoading}
                aria-label={t('chatbot.placeholder')}
                className="h-12 flex-1 rounded-full border border-border bg-background/60 px-5 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={send}
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
