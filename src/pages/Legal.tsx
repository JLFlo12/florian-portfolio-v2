import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SectionHeading from '@/components/SectionHeading';
import { useReveal } from '@/lib/motion';
import { LEGAL_UPDATED, legalContent, resetEmbeds } from '@/data/legal';

/* Mentions légales et confidentialité : un bloc par rubrique, titre à gauche, texte à droite. */
const Legal = () => {
  const { t, i18n } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  const [reset, setReset] = useState(false);
  useReveal(page, [i18n.language]);

  const blocks = legalContent(i18n.language);
  const date = new Date(LEGAL_UPDATED).toLocaleDateString(i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div ref={page} className="pb-8 pt-[calc(var(--nav-h)+40px)]">
      <div className="container-x">
        <SectionHeading index="//" label="legal" title={t('legal.title')} as="h1" lede={t('legal.updated', { date })} />
      </div>

      {blocks.map((block, i) => (
        <section key={block.title} className="case-row container-x legal-block">
          <h2 className="case-row__label label-mono"><span className="text-primary">{String(i + 1).padStart(2, '0')}</span> · {block.title}</h2>
          <div className="legal-text" data-reveal>
            {block.body.some((line) => line.startsWith('- ')) ? (
              <>
                {block.body.filter((line) => !line.startsWith('- ')).map((line) => <p key={line}>{line}</p>)}
                <ul className="case-detail__list">
                  {block.body.filter((line) => line.startsWith('- ')).map((line) => <li key={line}>{line.slice(2)}</li>)}
                </ul>
              </>
            ) : block.body.map((line) => <p key={line}>{line}</p>)}
            {i === 4 && (
              <button type="button" className="btn-ghost mt-6 !py-2.5 text-sm" onClick={() => { resetEmbeds(); setReset(true); }}>
                {reset ? t('legal.resetDone') : t('legal.reset')}
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
};

export default Legal;
