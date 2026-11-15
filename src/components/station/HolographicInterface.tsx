import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tool } from '@/data/tools';
import type { StationModule } from './scrollTimeline';

/* ───────────────────────────────────────────────────────────────
   HolographicInterface : panneau projeté par l'émetteur du module visité.
   Il est relié au module par une ligne (dessinée par StationExperience) et
   ses éléments s'allument au fil de --p (présence de l'étape, posée à chaque image).
   Le défilement fait passer le focus d'un outil à l'autre ; un clic ou le clavier
   le choisit directement. La description affichée est celle de data/tools.tsx.
   ─────────────────────────────────────────────────────────────── */

export type Logos = Record<string, string> | null;

/** ToolDisplay : logo officiel (tracé Simple Icons) ou, à défaut, l'icône du site. */
export const ToolDisplay = ({ tool, logos, size = 'h-6 w-6' }: { tool: Tool; logos: Logos; size?: string }) =>
  logos?.[tool.name] ? (
    <svg viewBox="0 0 24 24" className={`${size} shrink-0`} fill="currentColor" aria-hidden="true"><path d={logos[tool.name]} /></svg>
  ) : (
    <span className={`station-icon ${size} shrink-0`} aria-hidden="true">{tool.icon}</span>
  );

interface Props {
  module: StationModule;
  index: number;          // numéro de l'étape (affiché)
  focus: number;          // outil mis en avant
  logos: Logos;
  onFocus: (i: number) => void;
  onOpen: (tool: Tool) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

const HolographicInterface = forwardRef<HTMLDivElement, Props>(({ module, index, focus, logos, onFocus, onOpen }, ref) => {
  const { t } = useTranslation();
  const tool = module.tools[Math.min(focus, module.tools.length - 1)];
  const categories = module.categories.map((c) => t(`home.categories.${c}`)).join(' · ');
  return (
    <div ref={ref} className="holo-panel" data-module={module.id} role="region" aria-label={module.name}>
      <div className="holo-panel__frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="holo-panel__head">
        <span className="holo-panel__index">{pad(index)}</span>
        <div className="min-w-0">
          <h3 className="holo-panel__title">{module.name}</h3>
          <p className="holo-panel__meta">{categories} · {t('home.station.tools', { count: module.tools.length })}</p>
        </div>
      </header>

      <ul className={`holo-panel__grid ${module.tools.length > 6 ? 'is-dense' : ''}`}>
        {module.tools.map((item, i) => (
          <li key={item.name} style={{ '--i': i } as React.CSSProperties}>
            <button
              type="button"
              className="holo-tile"
              aria-pressed={i === focus}
              onClick={() => onFocus(i)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') onFocus(i); }}
              onFocus={() => onFocus(i)}
            >
              <ToolDisplay tool={item} logos={logos} size="h-5 w-5" />
              <span className="holo-tile__name">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Fiche de l'outil mis en avant (rejouée à chaque changement) */}
      <div key={tool.name} className="holo-panel__detail">
        <div className="flex items-center gap-3">
          <span className="holo-panel__logo"><ToolDisplay tool={tool} logos={logos} size="h-7 w-7" /></span>
          <div className="min-w-0">
            <p className="holo-panel__name">{tool.name}</p>
            <p className="holo-panel__cat">{t(`home.categories.${tool.category}`)}</p>
          </div>
          <button type="button" className="holo-panel__open" onClick={() => onOpen(tool)}>{t('home.station.open')}</button>
        </div>
        <p className="holo-panel__desc">{tool.description}</p>
      </div>
    </div>
  );
});
HolographicInterface.displayName = 'HolographicInterface';

export default HolographicInterface;
