import React from 'react';
import { AccentTitle } from '@/lib/motion';

interface SectionHeadingProps {
  index: string;          // "01", "02"… (affiché en chiffres LED)
  label: string;          // chemin façon terminal : "outils", "projets"…
  title: string;          // titre (premier mot en italique à empattements)
  lede?: React.ReactNode; // texte d'introduction à droite
  as?: 'h1' | 'h2';
  id?: string;
  children?: React.ReactNode;
}

/* En-tête de section commun : surtitre (numéro + filet + chemin), grand titre, intro.
   Surtitre, titre et intro apparaissent l'un après l'autre derrière la bande de couleur. */
const SectionHeading = ({ index, label, title, lede, as = 'h2', id, children }: SectionHeadingProps) => (
  <header className="relative z-[1] flex flex-wrap items-end justify-between gap-x-14 gap-y-6">
    <div className="min-w-0">
      <p className="eyebrow" data-band>
        <span className="eyebrow__index">{index}</span>
        <span className="eyebrow__rule" aria-hidden="true" data-rule />
        <span className="eyebrow__label">{label}</span>
      </p>
      <AccentTitle text={title} as={as} id={id} band={0.12} className={`title-xl mt-5 ${as === 'h1' ? '!text-[clamp(3rem,9vw,8.5rem)]' : ''}`} />
    </div>
    {(lede || children) && (
      <div className="max-w-md border-l border-primary/35 pl-5 text-muted-foreground text-base lg:text-lg">
        {lede && <div data-band="0.35">{lede}</div>}
        {children && <div data-reveal>{children}</div>}
      </div>
    )}
  </header>
);

export default SectionHeading;
