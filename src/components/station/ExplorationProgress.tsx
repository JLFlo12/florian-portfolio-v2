import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { TimelineStop } from './scrollTimeline';

/* ───────────────────────────────────────────────────────────────
   ExplorationProgress : barre de progression de la visite (un repère par étape),
   nom de l'étape en cours, étapes précédente / suivante, pause des animations.
   La barre est remplie à chaque image (style posé directement, sans rendu React).
   ─────────────────────────────────────────────────────────────── */

interface Props {
  stops: TimelineStop[];
  current: number;
  label: string;
  ambient: boolean;
  onStep: (dir: -1 | 1) => void;
  onGo: (index: number) => void;
  onToggleAmbient: () => void;
  stopLabel: (index: number) => string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const ExplorationProgress = forwardRef<HTMLSpanElement, Props>(({ stops, current, label, ambient, onStep, onGo, onToggleAmbient, stopLabel }, bar) => {
  const { t } = useTranslation();
  return (
    <div className="station-hud">
      <div className="station-hud__row">
        <button type="button" className="station-btn" onClick={() => onStep(-1)} disabled={current <= 0} aria-label={t('home.station.prev')}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="station-hud__now" aria-live="polite">
          <span className="led text-primary">{pad(current + 1)}</span>
          <span className="text-muted-foreground"> / {pad(stops.length)}</span>
          <span className="station-hud__label">{label}</span>
        </div>
        <button type="button" className="station-btn" onClick={() => onStep(1)} disabled={current >= stops.length - 1} aria-label={t('home.station.next')}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className="station-btn" onClick={onToggleAmbient} aria-pressed={!ambient} aria-label={ambient ? t('home.station.pause') : t('home.station.play')}>
          {ambient ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>
      {/* Repères cliquables : un par étape, à sa place dans la visite */}
      <div className="station-track" role="group" aria-label={t('home.station.progress')}>
        <span ref={bar} className="station-track__fill" />
        {stops.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`station-track__tick ${i === current ? 'is-on' : ''}`}
            style={{ left: `${(s.arrive * 100).toFixed(2)}%` }}
            onClick={() => onGo(i)}
            aria-label={stopLabel(i)}
            title={stopLabel(i)}
          />
        ))}
      </div>
    </div>
  );
});
ExplorationProgress.displayName = 'ExplorationProgress';

export default ExplorationProgress;
