import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Lock, Building2, Construction } from 'lucide-react';
import DinoRunner from '@/components/games/DinoRunner';
import FlappyBird from '@/components/games/FlappyBird';
import SnakeGame from '@/components/games/SnakeGame';
import GuessBuilding from '@/components/games/GuessBuilding';
import TowerCrane from '@/components/games/TowerCrane';
import SectionHeading from '@/components/SectionHeading';
import Sakura from '@/components/fx/Sakura';
import { gsap, prefersReducedMotion, useReveal } from '@/lib/motion';

interface GameCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
}

const games: GameCard[] = [
  {
    id: 'dino',
    name: 'Dino Runner',
    description: 'Évite les obstacles et bats ton record !',
    icon: <span className="text-4xl">🦕</span>,
    available: true,
  },
  {
    id: 'flappy',
    name: 'Flappy Bird',
    description: 'Passe entre les tuyaux. Un clic = un flap.',
    icon: <span className="text-4xl">🐦</span>,
    available: true,
  },
  {
    id: 'snake',
    name: 'Snake',
    description: 'Mange, grandis, évite-toi.',
    icon: <span className="text-4xl">🐍</span>,
    available: true,
  },
  {
    id: 'guess-building',
    name: 'Guess the Building',
    description: 'Reconnais les bâtiments iconiques du monde.',
    icon: <Building2 className="h-9 w-9 text-primary" strokeWidth={1.5} />,
    available: true,
  },
  {
    id: 'tower-crane',
    name: 'Tower Crane Challenge',
    description: 'Construis la tour la plus stable possible.',
    icon: <Construction className="h-9 w-9 text-primary" strokeWidth={1.5} />,
    available: true,
  },
  {
    id: 'coming-1',
    name: 'Bientôt…',
    description: 'Un nouveau mini-jeu arrive.',
    icon: <Lock className="h-9 w-9 text-muted-foreground" strokeWidth={1.5} />,
    available: false,
  },
];

const Games = () => {
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useReveal(page, [activeGame]);

  // Transition douce entre le menu et un jeu
  useLayoutEffect(() => {
    if (!stage.current || prefersReducedMotion()) return;
    gsap.fromTo(stage.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform' });
  }, [activeGame]);

  const renderGame = () => {
    const onBack = () => setActiveGame(null);
    const components: Record<string, React.ReactNode> = {
      dino: <DinoRunner onBack={onBack} />,
      flappy: <FlappyBird onBack={onBack} />,
      snake: <SnakeGame onBack={onBack} />,
      'guess-building': <GuessBuilding onBack={onBack} />,
      'tower-crane': <TowerCrane onBack={onBack} />,
    };
    const game = games.find((g) => g.id === activeGame);
    if (!game || !components[game.id]) return null;
    return (
      <div className="flex w-full flex-col items-center">
        <p className="eyebrow">
          <span className="eyebrow__index">{String(games.indexOf(game) + 1).padStart(2, '0')}</span>
          <span className="eyebrow__rule" aria-hidden="true" />
          <span className="eyebrow__label">games</span>
        </p>
        <h2 className="mb-10 mt-4 text-center font-display text-[clamp(2rem,5vw,3.6rem)] font-black uppercase leading-none tracking-[-.04em] [font-stretch:125%]">
          {game.name}
        </h2>
        {components[game.id]}
      </div>
    );
  };

  return (
    <div ref={page} className="relative overflow-x-clip pb-24 pt-[calc(var(--nav-h)+56px)]">
      {/* Cerisier en fleurs et pétales qui tombent (plus discrets pendant une partie) */}
      <Sakura calm={!!activeGame} />
      <div className="container-x relative z-[1]">
        <div ref={stage}>
          {activeGame ? (
            renderGame()
          ) : (
            <>
              <SectionHeading as="h1" index="//" label="games" title={t('games.title')} lede={t('games.subtitle')} />

              <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-stagger="flip">
                {games.map((game, index) => (
                  <article
                    key={game.id}
                    className={`panel group flex min-h-[300px] flex-col justify-between p-7 transition-transform duration-500 [transition-timing-function:var(--ease-out)] ${game.available ? 'hover:-translate-y-1.5' : 'opacity-55'}`}
                    data-cursor={game.available ? t('ui.play') : undefined}
                  >
                    <div className="flex items-start justify-between">
                      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/40 transition-transform duration-700 group-hover:rotate-[-6deg] group-hover:scale-110">
                        {game.icon}
                      </span>
                      <span className="led text-sm text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-extrabold uppercase leading-tight tracking-tight [font-stretch:115%]">{game.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{game.description}</p>
                      {game.available ? (
                        <button
                          type="button"
                          onClick={() => setActiveGame(game.id)}
                          className="btn-neon mt-6 !px-5 !py-2.5 text-sm"
                        >
                          <Play className="h-4 w-4" /> {t('games.play')}
                        </button>
                      ) : (
                        <span className="btn-ghost pointer-events-none mt-6 !px-5 !py-2.5 text-sm opacity-70">
                          <Lock className="h-4 w-4" /> {t('games.soon')}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Games;
