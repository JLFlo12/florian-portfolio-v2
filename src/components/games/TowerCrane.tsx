import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { W, H, STEP_MS, MAX_MISSED, LS_KEY, fresh, step, drop as dropFloor, draw, type Events, type State } from './towerCraneGame';

interface TowerCraneProps {
  onBack: () => void;
}

/* Tower Crane : le moteur et le dessin sont dans towerCraneGame.ts ; ici, la boucle,
   les commandes (clic, toucher, Espace) et l'affichage React (score, ratés, rejouer). */
const TowerCrane: React.FC<TowerCraneProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialBest] = useState(() => {
    try { return parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0; } catch { return 0; }
  });
  const stateRef = useRef<State>(fresh(initialBest));
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [bestScore, setBestScore] = useState(initialBest);
  const [gameOver, setGameOver] = useState(false);

  const drop = useCallback(() => { dropFloor(stateRef.current); }, []);

  const restart = useCallback(() => {
    stateRef.current = fresh(stateRef.current.best);
    setScore(0);
    setMissed(0);
    setGameOver(false);
  }, []);

  // Boucle : pas de simulation fixes (60 par seconde), puis un dessin net (écrans haute densité)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      acc += Math.min(now - last, 250);
      last = now;
      const s = stateRef.current;
      const ev: Events = {};
      while (acc >= STEP_MS) {
        step(s, ev);
        acc -= STEP_MS;
      }
      if (ev.score) setScore(s.score);
      if (ev.missed) setMissed(s.missed);
      if (ev.over) {
        if (s.score > s.best) {
          s.best = s.score;
          try { localStorage.setItem(LS_KEY, String(s.score)); } catch { /* stockage indisponible */ }
          setBestScore(s.score);
        }
        setGameOver(true);
      }
      draw(ctx, s, dpr);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  // Espace : lâcher l'étage
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); drop(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drop]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between w-full">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div className="flex gap-3 items-center">
          <span className="text-sm font-bold text-primary font-mono">Score : {score}</span>
          <span className="text-xs text-muted-foreground font-mono">❌ {missed}/{MAX_MISSED}</span>
          <span className="text-sm text-muted-foreground font-mono">Best : {bestScore}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={(e) => { e.preventDefault(); drop(); }}
        role="img"
        aria-label="Tower Crane : touchez ou appuyez sur Espace pour lâcher l'étage"
        className="rounded-2xl border border-border shadow-lg cursor-pointer bg-card max-w-full"
        style={{ touchAction: 'none', aspectRatio: `${W}/${H}`, width: '100%', maxWidth: W }}
      />

      {gameOver && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
          <Button onClick={restart} className="gap-2"><RotateCcw className="h-4 w-4" /> Rejouer</Button>
          <Button variant="outline" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Mini-jeux</Button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default TowerCrane;
