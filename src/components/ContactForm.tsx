import React, { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CONTACT } from '@/data/profile';

/* ───────────────────────────────────────────────────────────────
   Formulaire de contact
   Envoi via FormSubmit (service gratuit, sans compte) : chaque message
   arrive directement dans la boîte mail de Florian.
   - Anti-spam : champ piège "_honey", invisible pour les humains.
   - En cas d'échec : lien e-mail pré-rempli avec le message saisi.
   ─────────────────────────────────────────────────────────────── */

const ENDPOINT = `https://formsubmit.co/ajax/${CONTACT.email}`;

type Status = 'idle' | 'sending' | 'sent' | 'error';
type Fields = { name: string; email: string; message: string };

const ContactForm = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [last, setLast] = useState<Fields>({ name: '', email: '', message: '' });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    // Champ piège rempli = robot : on fait semblant que tout va bien
    if (data._honey) { setStatus('sent'); return; }
    const fields = { name: data.name.trim(), email: data.email.trim(), message: data.message.trim() };
    setLast(fields);
    setStatus('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...fields,
          _subject: `Portfolio : message de ${fields.name}`,
          _template: 'table',
          _captcha: 'false',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || `HTTP ${res.status}`);
      form.reset();
      setStatus('sent');
    } catch (err) {
      console.error('Envoi du formulaire impossible :', err);
      setStatus('error');
      toast.error(t('contact.form.error'));
    }
  };

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-[hsl(var(--online)/.35)] bg-[hsl(var(--online)/.07)] p-6" role="status">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--online)/.16)] text-[hsl(var(--online))]">
          <Check className="h-5 w-5" />
        </span>
        <p className="font-display text-2xl font-extrabold uppercase leading-none [font-stretch:115%]">{t('contact.form.sentTitle')}</p>
        <p className="text-muted-foreground">{t('contact.form.sentText')}</p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost liquid !py-2.5 text-sm">
          {t('contact.form.again')}
        </button>
      </div>
    );
  }

  const mailto = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Portfolio : message de ${last.name}`)}&body=${encodeURIComponent(last.message)}`;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label-mono">{t('contact.form.name')}</span>
          <input name="name" required maxLength={80} autoComplete="name" placeholder={t('contact.form.namePh')} className="field__input" />
        </label>
        <label className="field">
          <span className="label-mono">{t('contact.form.email')}</span>
          <input name="email" type="email" required maxLength={120} autoComplete="email" placeholder={t('contact.form.emailPh')} className="field__input" />
        </label>
      </div>
      <label className="field">
        <span className="label-mono">{t('contact.form.message')}</span>
        <textarea name="message" required minLength={10} maxLength={3000} rows={5} placeholder={t('contact.form.messagePh')} className="field__input resize-y" data-lenis-prevent />
      </label>
      {/* Piège à robots : caché aux humains et aux lecteurs d'écran */}
      <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" className="btn-neon" disabled={status === 'sending'}>
          {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {status === 'sending' ? t('contact.form.sending') : t('contact.form.send')}
        </button>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{t('contact.form.privacy')}</p>
      </div>

      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t('contact.form.errorText')}{' '}
          <a href={mailto} className="email-text font-medium underline underline-offset-4">{CONTACT.email}</a>
        </p>
      )}
    </form>
  );
};

export default ContactForm;
