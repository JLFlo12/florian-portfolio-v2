import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Game, type GameSnapshot } from '../core/Game';
import { hud, useHud, type GameMode, type HudState } from '../core/store';
import { QUALITY, QUALITY_ORDER, loadQuality, saveQuality, type QualityLevel } from '../engine/quality';
import type { ScienceSheet } from '../universe/bodies';
import { useLenis } from '@/components/fx/SmoothScroll';
import './event-horizon.css';

interface Props {
  onBack: () => void;
}

const number = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const distance = (km: number) =>
  km >= 1e6 ? `${number(km / 1e6, 2)} millions de km` : `${number(Math.round(km / 10) * 10)} km`;

const COMMANDS: [string, string][] = [
  ['Z / W', 'Accélérer'],
  ['S', 'Ralentir, marche arrière'],
  ['Q / A · D', 'Tourner à gauche · à droite'],
  ['↑ · ↓', 'Cabrer · piquer'],
  ['Espace', 'Freiner'],
  ['Maj', 'Surrégime'],
  ['C', 'Croisière / impulsion'],
  ['Souris', 'Caméra (glisser), zoom (molette)'],
  ['T', 'Cible suivante'],
  ['F', 'Scanner la cible'],
  ['J', 'Journal'],
  ['Échap', 'Pause'],
];

const QualityPicker = ({ value, onChange }: { value: QualityLevel; onChange: (q: QualityLevel) => void }) => (
  <div className="eh-quality">
    <span className="eh-label" id="eh-quality-label">Qualité graphique</span>
    <div className="eh-segments" role="group" aria-labelledby="eh-quality-label">
      {QUALITY_ORDER.map((level) => (
        <button key={level} type="button" aria-pressed={value === level} onClick={() => onChange(level)}>
          {QUALITY[level].label}
        </button>
      ))}
    </div>
  </div>
);

const Sheet = ({ sheet, onClose }: { sheet: ScienceSheet; onClose: () => void }) => (
  <aside className="eh-panel" aria-label={`Fiche scientifique : ${sheet.name}`}>
    <span className="eh-label">Fiche scientifique · {sheet.id}</span>
    <h3>{sheet.name}</h3>
    <div className="eh-target-type">{sheet.designation} · {sheet.type}</div>
    <dl>
      <div><dt>Diamètre</dt><dd>{sheet.diameter}</dd></div>
      <div><dt>Masse</dt><dd>{sheet.mass}</dd></div>
      <div><dt>Température</dt><dd>{sheet.temperature}</dd></div>
      <div><dt>Composition</dt><dd>{sheet.composition}</dd></div>
      <div><dt>Atmosphère</dt><dd>{sheet.atmosphere}</dd></div>
      <div><dt>Particularités</dt><dd>{sheet.notes}</dd></div>
    </dl>
    <button type="button" className="eh-btn eh-panel-close" onClick={onClose}>Fermer (F)</button>
  </aside>
);

const Journal = ({ entries, onOpen, onClose }: { entries: ScienceSheet[]; onOpen: (s: ScienceSheet) => void; onClose: () => void }) => (
  <aside className="eh-panel" aria-label="Journal des découvertes">
    <span className="eh-label">Journal</span>
    <h3>{entries.length ? `${entries.length} découverte${entries.length > 1 ? 's' : ''}` : 'Aucune découverte'}</h3>
    {entries.length === 0 && (
      <p className="eh-target-type">Approchez un objet, sélectionnez-le avec T puis lancez une analyse avec F.</p>
    )}
    <ul className="eh-journal-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button type="button" onClick={() => onOpen(entry)}>
            <span>{entry.name}</span>
            <span>{entry.type}</span>
          </button>
        </li>
      ))}
    </ul>
    <button type="button" className="eh-btn eh-panel-close" onClick={onClose}>Fermer (J)</button>
  </aside>
);

const Hud = ({ state }: { state: HudState }) => (
  <div className="eh-hud">
    <div className="eh-corner eh-tl">
      <div className="eh-label">Secteur</div>
      <div className="eh-sector">{state.sector}</div>
      <div className="eh-coords eh-mono">
        X {number(state.coords[0], 1)} · Y {number(state.coords[1], 1)} · Z {number(state.coords[2], 1)}
      </div>
    </div>

    <div className="eh-corner eh-tr">
      <div className="eh-label">Cible</div>
      <div className="eh-target-name">{state.targetName}</div>
      <div className="eh-target-type">{state.targetType}</div>
      <div className="eh-target-distance eh-mono">{distance(state.targetDistance)}</div>
      <div className="eh-scan">
        <span className="eh-scan-state" data-state={state.scanner}>
          Scanner : {state.targetScanned ? 'objet catalogué' : state.scanner.toLowerCase()}
        </span>
        {state.scanner === 'Analyse' && (
          <span className="eh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.scanProgress * 100)}>
            <span style={{ transform: `scaleX(${state.scanProgress})` }} />
          </span>
        )}
      </div>
    </div>

    <div className="eh-corner eh-bl">
      <div className="eh-label">Vitesse</div>
      <div className="eh-speed">
        <span className="eh-speed-value eh-mono">{number(Math.round(state.speed))}</span>
        <span className="eh-speed-unit">km/s</span>
      </div>
      <div className="eh-flight">
        <span>Mode <b className={state.cruise ? 'is-on' : ''}>{state.cruise ? 'croisière' : 'impulsion'}</b></span>
        <span>Moteurs <b className={state.engines === 'Surrégime' ? 'is-on' : ''}>{state.engines.toLowerCase()}</b></span>
      </div>
      <div className="eh-energy">
        <span className="eh-label">Énergie</span>
        <span className="eh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.energy)}>
          <span style={{ transform: `scaleX(${state.energy / 100})` }} />
        </span>
        <span className="eh-mono">{Math.round(state.energy)} %</span>
      </div>
      {state.timeFactor < 0.97 && (
        <div className="eh-dilation eh-mono">
          Dilatation temporelle : 1 s à bord = {number(1 / Math.max(state.timeFactor, 0.01), 2)} s au loin
        </div>
      )}
    </div>

    <div className="eh-corner eh-br">
      {state.helpOpen && (
        <div className="eh-help">
          {COMMANDS.map(([key, label]) => (
            <div key={key} style={{ display: 'contents' }}><kbd>{key}</kbd><span>{label}</span></div>
          ))}
        </div>
      )}
      <div className="eh-help-toggle">H : {state.helpOpen ? 'masquer' : 'afficher'} les commandes</div>
      <div className="eh-fps eh-mono">{state.fps} images/s</div>
    </div>

    {state.message && <div className="eh-message" role="status">{state.message}</div>}
  </div>
);

const EventHorizonGame: React.FC<Props> = ({ onBack }) => {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const snapshot = useRef<GameSnapshot | null>(null);
  const resumeMode = useRef<GameMode>('menu');
  const [quality, setQuality] = useState<QualityLevel>(loadQuality);
  const [error, setError] = useState(false);
  const state = useHud();
  const lenis = useLenis();
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  // Le jeu occupe tout l'écran : le défilement de la page est suspendu pendant ce temps
  useEffect(() => {
    lenis?.stop();
    const previous = document.body.style.overflow;
    const previousRoot = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      document.documentElement.style.overflow = previousRoot;
      lenis?.start();
    };
  }, [lenis]);

  // Le moteur est recréé quand la qualité change ; la partie en cours est conservée
  useEffect(() => {
    if (!container.current || !marker.current) return;
    let instance: Game;
    try {
      instance = new Game(container.current, marker.current, quality, snapshot.current ?? undefined);
    } catch (e) {
      console.error('[EVENT HORIZON]', e);
      setError(true);
      return;
    }
    game.current = instance;
    if (import.meta.env.DEV) (window as unknown as { __eh?: Game }).__eh = instance; // accès console en développement
    instance.setMode(resumeMode.current);
    return () => {
      snapshot.current = instance.snapshot();
      resumeMode.current = hud.get().mode;
      instance.dispose();
      game.current = null;
    };
  }, [quality]);

  useEffect(() => () => hud.reset(), []);

  const changeQuality = (level: QualityLevel) => {
    saveQuality(level);
    setQuality(level);
  };
  const setMode = (mode: GameMode) => game.current?.setMode(mode);

  return createPortal(
    <div className="eh" role="application" aria-label="EVENT HORIZON, jeu d'exploration spatiale">
      <div ref={container} style={{ position: 'absolute', inset: 0 }}>
        <div ref={marker} className="eh-marker" aria-hidden="true" />
      </div>

      {error && (
        <div className="eh-error">
          <p>Ce navigateur ne peut pas afficher le jeu (WebGL 2 indisponible).</p>
          <button type="button" className="eh-btn" onClick={onBack}>Retour aux mini-jeux</button>
        </div>
      )}

      {!error && state.mode === 'play' && (
        <>
          <Hud state={state} />
          {state.sheet && <Sheet sheet={state.sheet} onClose={() => hud.set({ sheet: null })} />}
          {state.journalOpen && !state.sheet && (
            <Journal
              entries={state.journal}
              onOpen={(sheet) => hud.set({ sheet, journalOpen: false })}
              onClose={() => hud.set({ journalOpen: false })}
            />
          )}
        </>
      )}

      {!error && state.mode === 'menu' && (
        <div className="eh-menu">
          <div className="eh-menu-body">
            <span className="eh-label">Exploration spatiale · version 0.1</span>
            <h1 className="eh-title">Event Horizon</h1>
            <p className="eh-tagline">
              Aux commandes du vaisseau scientifique AETHER-01, approchez le trou noir NEMESIS-01. Personne d’autre n’est venu jusqu’ici.
            </p>
            <div className="eh-actions">
              <button type="button" className="eh-btn eh-btn--primary" onClick={() => setMode('play')} autoFocus>
                Commencer l’exploration
              </button>
              <button type="button" className="eh-btn" onClick={onBack}>Retour aux mini-jeux</button>
            </div>
            <QualityPicker value={quality} onChange={changeQuality} />
            <p className="eh-note">
              {coarse
                ? 'Ce jeu se pilote au clavier et à la souris : il n’est pas jouable sur écran tactile.'
                : 'Clavier et souris. Z pour accélérer, Q et D pour tourner, C pour la croisière, F pour scanner.'}
            </p>
          </div>
        </div>
      )}

      {!error && state.mode === 'pause' && (
        <div className="eh-menu eh-menu--pause">
          <div className="eh-menu-body">
            <span className="eh-label">Pause</span>
            <h2 className="eh-title">Event Horizon</h2>
            <div className="eh-actions">
              <button type="button" className="eh-btn eh-btn--primary" onClick={() => setMode('play')} autoFocus>Reprendre</button>
              <button type="button" className="eh-btn" onClick={() => setMode('menu')}>Menu principal</button>
              <button type="button" className="eh-btn" onClick={onBack}>Quitter le jeu</button>
            </div>
            <QualityPicker value={quality} onChange={changeQuality} />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default EventHorizonGame;
