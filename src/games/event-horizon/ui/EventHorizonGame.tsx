import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Game, type GameSnapshot } from '../core/Game';
import { hud, useHud, type EndStats, type GameMode, type HudState, type NavEntry } from '../core/store';
import { QUALITY, QUALITY_ORDER, loadQuality, saveQuality, type QualityLevel } from '../engine/quality';
import { UPGRADES, type UpgradeId } from '../progression/Progression';
import type { ScienceSheet } from '../universe/bodies';
import { useLenis } from '@/components/fx/SmoothScroll';
import { sound } from '@/lib/ambient';
import './event-horizon.css';

interface Props {
  onBack: () => void;
}

const number = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const distance = (km: number) =>
  km >= 1e6 ? `${number(km / 1e6, 2)} millions de km` : `${number(Math.round(km / 10) * 10)} km`;

const clockTime = (seconds: number) => {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h ? `${h} h ` : ''}${m} min ${String(s % 60).padStart(2, '0')} s`;
};

const COMMANDS: [string, string][] = [
  ['Z / W · S', 'Accélérer · ralentir'],
  ['Q / A · D', 'Tourner à gauche · à droite'],
  ['↑ · ↓', 'Cabrer · piquer'],
  ['Espace · Maj', 'Freiner · surrégime'],
  ['C', 'Croisière / impulsion'],
  ['Souris', 'Caméra (glisser), zoom (molette)'],
  ['T · N', 'Cible suivante · navigation'],
  ['F', 'Scanner la cible'],
  ['J · U', 'Journal · améliorations'],
  ['P', 'Mode photo'],
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

const SoundSwitch = ({ muted, onChange }: { muted: boolean; onChange: (muted: boolean) => void }) => (
  <div className="eh-quality">
    <span className="eh-label" id="eh-sound-label">Son</span>
    <div className="eh-segments" role="group" aria-labelledby="eh-sound-label">
      <button type="button" aria-pressed={!muted} onClick={() => onChange(false)}>Activé</button>
      <button type="button" aria-pressed={muted} onClick={() => onChange(true)}>Coupé</button>
    </div>
  </div>
);

const Sheet = ({ sheet, onClose }: { sheet: ScienceSheet; onClose: () => void }) => (
  <aside className="eh-panel" aria-label={`Fiche scientifique : ${sheet.name}`}>
    <span className="eh-label">Fiche scientifique · {sheet.id}</span>
    <h3>{sheet.name}</h3>
    <div className="eh-target-type">{sheet.designation} · {sheet.type}</div>
    {sheet.log && (
      <blockquote className="eh-log">
        <span className="eh-label">Enregistrement récupéré</span>
        <p>{sheet.log}</p>
      </blockquote>
    )}
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
    <ul className="eh-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button type="button" onClick={() => onOpen(entry)}>
            <span>{entry.name}{entry.log ? ' · enregistrement' : ''}</span>
            <span>{entry.type}</span>
          </button>
        </li>
      ))}
    </ul>
    <button type="button" className="eh-btn eh-panel-close" onClick={onClose}>Fermer (J)</button>
  </aside>
);

const Navigation = ({ entries, onSelect, onClose }: { entries: NavEntry[]; onSelect: (id: string) => void; onClose: () => void }) => (
  <aside className="eh-panel" aria-label="Navigation">
    <span className="eh-label">Navigation</span>
    <h3>Objets connus</h3>
    <p className="eh-target-type">Du plus proche au plus lointain. Choisir une cible affiche son repère.</p>
    <ul className="eh-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button type="button" aria-current={entry.current} onClick={() => onSelect(entry.id)}>
            <span>{entry.name}<small>{entry.scanned ? entry.type : `${entry.type} · à analyser`}</small></span>
            <span className="eh-mono">{distance(entry.distance)}</span>
          </button>
        </li>
      ))}
    </ul>
    <button type="button" className="eh-btn eh-panel-close" onClick={onClose}>Fermer (N)</button>
  </aside>
);

const Upgrades = ({ points, owned, onBuy, onClose }: { points: number; owned: UpgradeId[]; onBuy: (id: UpgradeId) => void; onClose: () => void }) => (
  <aside className="eh-panel" aria-label="Améliorations du vaisseau">
    <span className="eh-label">Améliorations</span>
    <h3>{points} point{points > 1 ? 's' : ''} de recherche</h3>
    <p className="eh-target-type">Chaque analyse rapporte des points. Les objets rares en rapportent davantage.</p>
    <ul className="eh-upgrades">
      {UPGRADES.map((upgrade) => {
        const installed = owned.includes(upgrade.id);
        return (
          <li key={upgrade.id}>
            <div>
              <strong>{upgrade.name}</strong>
              <p>{upgrade.description}</p>
            </div>
            <button type="button" className="eh-btn" disabled={installed || points < upgrade.cost} onClick={() => onBuy(upgrade.id)}>
              {installed ? 'Installé' : `${upgrade.cost} pts`}
            </button>
          </li>
        );
      })}
    </ul>
    <button type="button" className="eh-btn eh-panel-close" onClick={onClose}>Fermer (U)</button>
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
      {state.objective && (
        <div className="eh-objective">
          <div className="eh-label">Piste</div>
          {state.objective}
        </div>
      )}
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
        <span>Recherche <b>{state.research} pts</b></span>
      </div>
      <div className="eh-energy">
        <span className="eh-label">Énergie</span>
        <span className="eh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={state.energyMax} aria-valuenow={Math.round(state.energy)}>
          <span style={{ transform: `scaleX(${state.energy / state.energyMax})` }} />
        </span>
        <span className="eh-mono">{Math.round(state.energy)} %</span>
      </div>
      {state.radiation > 0.02 && (
        <div className="eh-warning eh-mono">Radiations : {Math.round(state.radiation * 100)} %, l’énergie se vide</div>
      )}
      {state.timeFactor < 0.97 && (
        <div className="eh-warning eh-mono">
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

/** Temps vu par un observateur lointain pendant la chute : il s'emballe, puis n'a plus de fin. */
const farLabel = (elapsed: number) => {
  if (elapsed > 8.2) return '∞';
  const s = Math.pow(10, elapsed * 1.5);
  if (s < 90) return `${number(s)} s`;
  if (s < 5400) return `${number(s / 60)} min`;
  if (s < 172800) return `${number(s / 3600)} h`;
  if (s < 6.3e7) return `${number(s / 86400)} jours`;
  const years = s / 3.156e7;
  return years < 1e4 ? `${number(years)} ans` : `${number(years / 1000)} milliers d’années`;
};

const Ending = () => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => { setElapsed((performance.now() - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="eh-ending" aria-live="off">
      <div className="eh-iris" />
      <div className="eh-ending-count">
        <span className="eh-label">Temps écoulé loin d’ici</span>
        <span className="eh-mono">{farLabel(elapsed)}</span>
      </div>
    </div>
  );
};

const EndScreen = ({ stats, onRestart, onMenu, onQuit }: { stats: EndStats; onRestart: () => void; onMenu: () => void; onQuit: () => void }) => (
  <div className="eh-end">
    <div className="eh-end-body">
      <span className="eh-label">Fin de la transmission</span>
      <h2 className="eh-title">Au-delà de l’horizon</h2>
      <p>
        Vu de l’extérieur, AETHER-01 n’a jamais franchi l’horizon. Son image a ralenti, a rougi, puis s’est effacée.
        À bord, tout s’est joué en quelques secondes.
      </p>
      <p>
        {stats.storyComplete
          ? 'Votre balise émet encore. Étiré par la gravité, son signal mettra 61 ans à remonter. Quelqu’un le captera près d’une étoile nommée Hélice, et croira à un appel de détresse.'
          : 'Un signal faible émettait sur la bande de détresse. Vous n’avez jamais su d’où il venait.'}
      </p>
      <dl className="eh-end-stats">
        <div><dt>Temps passé à bord</dt><dd className="eh-mono">{clockTime(stats.shipTime)}</dd></div>
        <div><dt>Avance prise par le reste de l’univers</dt><dd className="eh-mono">+ {number(stats.farDelta, 1)} s avant l’horizon, sans limite ensuite</dd></div>
        <div><dt>Découvertes</dt><dd className="eh-mono">{stats.discoveries} sur {stats.total}</dd></div>
      </dl>
      <div className="eh-actions">
        <button type="button" className="eh-btn eh-btn--primary" onClick={onRestart} autoFocus>Reprendre au point de départ</button>
        <button type="button" className="eh-btn" onClick={onMenu}>Menu principal</button>
        <button type="button" className="eh-btn" onClick={onQuit}>Quitter le jeu</button>
      </div>
      <p className="eh-note">Vos découvertes et vos améliorations sont conservées.</p>
    </div>
  </div>
);

const EventHorizonGame: React.FC<Props> = ({ onBack }) => {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const ghostMarker = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const snapshot = useRef<GameSnapshot | null>(null);
  const resumeMode = useRef<GameMode>('menu');
  const [quality, setQuality] = useState<QualityLevel>(loadQuality);
  const [error, setError] = useState(false);
  const state = useHud();
  const lenis = useLenis();
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  // Le jeu occupe tout l'écran : le défilement de la page et la musique du site sont suspendus
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

  useEffect(() => {
    sound.hold(true);
    return () => { sound.hold(false); hud.reset(); };
  }, []);

  // Le moteur est recréé quand la qualité change ; la partie en cours est conservée
  useEffect(() => {
    if (!container.current || !marker.current || !ghostMarker.current) return;
    let instance: Game;
    try {
      instance = new Game(container.current, { target: marker.current, ghost: ghostMarker.current }, quality, snapshot.current ?? undefined);
    } catch (e) {
      console.error('[EVENT HORIZON]', e);
      setError(true);
      return;
    }
    game.current = instance;
    if (import.meta.env.DEV) (window as unknown as { __eh?: Game }).__eh = instance; // accès console en développement
    const resume = resumeMode.current;
    instance.setMode(resume === 'ending' || resume === 'ended' ? 'menu' : resume);
    return () => {
      snapshot.current = instance.snapshot();
      resumeMode.current = hud.get().mode;
      instance.dispose();
      game.current = null;
    };
  }, [quality]);

  const changeQuality = (level: QualityLevel) => {
    saveQuality(level);
    setQuality(level);
  };
  const setMode = (mode: GameMode) => game.current?.setMode(mode);
  const setMuted = (muted: boolean) => game.current?.setMuted(muted);
  const playing = !error && state.mode === 'play';

  return createPortal(
    <div className="eh" role="application" aria-label="EVENT HORIZON, jeu d'exploration spatiale">
      <div ref={container} style={{ position: 'absolute', inset: 0 }}>
        <div ref={marker} className="eh-marker" aria-hidden="true" />
        <div ref={ghostMarker} className="eh-marker eh-marker--ghost" aria-hidden="true" />
      </div>

      {/* Les bords de l'image se referment à l'approche du trou noir */}
      {playing && !state.photo && <div className="eh-vignette" style={{ opacity: state.dread }} aria-hidden="true" />}

      {error && (
        <div className="eh-error">
          <p>Ce navigateur ne peut pas afficher le jeu (WebGL 2 indisponible).</p>
          <button type="button" className="eh-btn" onClick={onBack}>Retour aux mini-jeux</button>
        </div>
      )}

      {playing && !state.photo && (
        <>
          <Hud state={state} />
          {state.sheet && <Sheet sheet={state.sheet} onClose={() => hud.set({ sheet: null })} />}
          {!state.sheet && state.panel === 'journal' && (
            <Journal entries={state.journal} onOpen={(sheet) => hud.set({ sheet, panel: null })} onClose={() => hud.set({ panel: null })} />
          )}
          {!state.sheet && state.panel === 'nav' && (
            <Navigation entries={state.nav} onSelect={(id) => game.current?.selectTarget(id)} onClose={() => hud.set({ panel: null })} />
          )}
          {!state.sheet && state.panel === 'upgrades' && (
            <Upgrades points={state.research} owned={state.upgrades} onBuy={(id) => game.current?.buy(id)} onClose={() => hud.set({ panel: null })} />
          )}
        </>
      )}

      {playing && state.photo && (
        <div className="eh-photo">
          <span>{state.message.startsWith('Image') ? state.message : 'Mode photo · glisser pour tourner · molette pour le zoom'}</span>
          <button type="button" className="eh-btn" onClick={() => game.current?.savePhoto()}>Enregistrer l’image (Entrée)</button>
          <button type="button" className="eh-btn" onClick={() => game.current?.setPhoto(false)}>Quitter (P)</button>
        </div>
      )}

      {!error && state.mode === 'ending' && <Ending />}

      {!error && state.mode === 'ended' && state.end && (
        <EndScreen
          stats={state.end}
          onRestart={() => game.current?.restart('play')}
          onMenu={() => game.current?.restart('menu')}
          onQuit={onBack}
        />
      )}

      {!error && state.mode === 'menu' && (
        <div className="eh-menu">
          <div className="eh-menu-body">
            <span className="eh-label">Exploration spatiale · en développement</span>
            <h1 className="eh-title">Event Horizon</h1>
            <p className="eh-tagline">
              Seul à bord du vaisseau scientifique AETHER-01, vous captez un signal de détresse aux abords du trou noir NEMESIS-01. Personne n’aurait dû arriver ici avant vous.
            </p>
            <div className="eh-actions">
              <button type="button" className="eh-btn eh-btn--primary" onClick={() => setMode('play')} autoFocus>
                {state.journal.length ? 'Reprendre l’exploration' : 'Commencer l’exploration'}
              </button>
              <button type="button" className="eh-btn" onClick={onBack}>Retour aux mini-jeux</button>
            </div>
            <QualityPicker value={quality} onChange={changeQuality} />
            <SoundSwitch muted={state.muted} onChange={setMuted} />
            <p className="eh-note">
              {coarse
                ? 'Ce jeu se pilote au clavier et à la souris : il n’est pas jouable sur écran tactile.'
                : 'Clavier et souris, de préférence au casque. Z pour accélérer, Q et D pour tourner, C pour la croisière, F pour scanner.'}
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
            <SoundSwitch muted={state.muted} onChange={setMuted} />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default EventHorizonGame;
