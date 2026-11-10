import React, { Suspense, lazy } from 'react';

// Le jeu (moteur 3D, shaders, post-traitement) n'est téléchargé que lorsqu'on le lance.
const EventHorizonGame = lazy(() => import('@/games/event-horizon/ui/EventHorizonGame'));

interface EventHorizonProps {
  onBack: () => void;
}

const EventHorizon: React.FC<EventHorizonProps> = ({ onBack }) => (
  <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement d’EVENT HORIZON…</p>}>
    <EventHorizonGame onBack={onBack} />
  </Suspense>
);

export default EventHorizon;
