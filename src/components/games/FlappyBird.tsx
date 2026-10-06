import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft } from 'lucide-react';

interface FlappyBirdProps {
  onBack: () => void;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BIRD_SIZE = 24;
const BIRD_X = 80;
// Physique à pas fixe (60 pas par seconde) : même vitesse et même gravité sur un écran 60, 120 ou 144 Hz
// (avant, tout était calculé à chaque image : deux fois plus rapide sur un écran à 120 Hz)
const STEP_MS = 1000 / 60;
const GRAVITY = 0.36; // gravité adoucie (était 0,52)
const FLAP_FORCE = -6.6;
const MAX_FALL = 8.5; // vitesse de chute maximale
const PIPE_WIDTH = 50;
const PIPE_GAP = 165;
const PIPE_GAP_MIN = 135;
const PIPE_SPEED_INITIAL = 3.4;
const PIPE_SPEED_MAX = 5.2;
const PIPE_SPACING = 250; // distance entre deux tuyaux (px)
const HITBOX_SHRINK = 4; // pixels to shrink bird hitbox

const FlappyBird: React.FC<FlappyBirdProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    return parseInt(localStorage.getItem('flappy-best') || '0', 10);
  });
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const isDark = document.documentElement.classList.contains('dark');

  // Chaque tuyau garde la taille de son passage : la collision correspond toujours à ce qui est dessiné
  const gameStateRef = useRef({
    birdY: CANVAS_HEIGHT / 2,
    birdVelocity: 0,
    pipes: [] as { x: number; topH: number; gap: number; scored: boolean }[],
    score: 0,
    gameOver: false,
    speed: PIPE_SPEED_INITIAL,
    birdRotation: 0,
  });

  const resetGame = useCallback(() => {
    gameStateRef.current = {
      birdY: CANVAS_HEIGHT / 2,
      birdVelocity: 0,
      pipes: [],
      score: 0,
      gameOver: false,
      speed: PIPE_SPEED_INITIAL,
      birdRotation: 0,
    };
    setScore(0);
    setGameOver(false);
    setStarted(true);
  }, []);

  const flap = useCallback(() => {
    if (!started) {
      resetGame();
      return;
    }
    const state = gameStateRef.current;
    if (state.gameOver) return;
    state.birdVelocity = FLAP_FORCE;
  }, [started, resetGame]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const fgColor = isDark ? '#f5f5f5' : '#1a1a1a';
    const bgColor = isDark ? '#1a1a1a' : '#f0f4f8';
    const pipeColor = isDark ? '#3a3a3a' : '#6b7280';
    const primaryColor = '#f97316';
    const groundColor = isDark ? '#333' : '#a3a3a3';

    const draw = () => {
      const state = gameStateRef.current;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Pipes
      state.pipes.forEach(pipe => {
        ctx.fillStyle = pipeColor;
        // Top pipe
        ctx.beginPath();
        ctx.roundRect(pipe.x, 0, PIPE_WIDTH, pipe.topH, [0, 0, 8, 8]);
        ctx.fill();
        // Bottom pipe
        const bottomY = pipe.topH + pipe.gap;
        ctx.beginPath();
        ctx.roundRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_HEIGHT - bottomY - 40, [8, 8, 0, 0]);
        ctx.fill();

        // Pipe caps
        ctx.fillStyle = isDark ? '#4a4a4a' : '#4b5563';
        ctx.fillRect(pipe.x - 4, pipe.topH - 20, PIPE_WIDTH + 8, 20);
        ctx.fillRect(pipe.x - 4, bottomY, PIPE_WIDTH + 8, 20);
      });

      // Ground
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 40);

      // Bird
      ctx.save();
      ctx.translate(BIRD_X + BIRD_SIZE / 2, state.birdY + BIRD_SIZE / 2);
      const rotation = Math.min(Math.max(state.birdVelocity * 4, -30), 70) * (Math.PI / 180);
      ctx.rotate(rotation);

      // Body
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, BIRD_SIZE / 2 + 2, BIRD_SIZE / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = isDark ? '#0f0f0f' : '#fff';
      ctx.beginPath();
      ctx.arc(6, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(7, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(BIRD_SIZE / 2, -2);
      ctx.lineTo(BIRD_SIZE / 2 + 8, 2);
      ctx.lineTo(BIRD_SIZE / 2, 6);
      ctx.closePath();
      ctx.fill();

      // Wing
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(-4, 4, 8, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Score
      ctx.fillStyle = fgColor;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(state.score)}`, CANVAS_WIDTH / 2, 50);

      if (!started) {
        ctx.fillStyle = fgColor;
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Cliquez ou ESPACE pour jouer', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
      }
    };

    const endGame = (state: typeof gameStateRef.current) => {
      state.gameOver = true;
      setGameOver(true);
      setScore(Math.floor(state.score));
      const best = Math.max(Math.floor(state.score), parseInt(localStorage.getItem('flappy-best') || '0', 10));
      localStorage.setItem('flappy-best', String(best));
      setBestScore(best);
    };

    // Un pas de simulation (1/60 s)
    const step = () => {
      const state = gameStateRef.current;
      if (state.gameOver || !started) return;

      // Physics
      state.birdVelocity = Math.min(state.birdVelocity + GRAVITY, MAX_FALL);
      state.birdY += state.birdVelocity;

      // Ceiling
      if (state.birdY < 0) {
        state.birdY = 0;
        state.birdVelocity = 0;
      }

      // Ground collision
      if (state.birdY + BIRD_SIZE >= CANVAS_HEIGHT - 40) {
        endGame(state);
        return;
      }

      // Speed increase — after 3 points, moderate, capped
      if (state.score >= 3) {
        state.speed = Math.min(PIPE_SPEED_MAX, PIPE_SPEED_INITIAL + (state.score - 3) * 0.03);
      }

      // Spawn pipes at a fixed distance (same spacing whatever the speed); the gap narrows slowly
      const last = state.pipes[state.pipes.length - 1];
      if (!last || last.x < CANVAS_WIDTH - PIPE_SPACING) {
        const gap = Math.max(PIPE_GAP_MIN, PIPE_GAP - Math.floor(state.score / 5) * 3);
        const minTop = 60;
        const maxTop = CANVAS_HEIGHT - gap - 100;
        const topH = minTop + Math.random() * (maxTop - minTop);
        state.pipes.push({ x: CANVAS_WIDTH, topH, gap, scored: false });
      }

      // Move pipes & check collision
      state.pipes = state.pipes.filter(pipe => {
        pipe.x -= state.speed;

        // Score
        if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
          pipe.scored = true;
          state.score += 1;
          setScore(state.score);
        }

        // Collision with pipes (shrunken hitbox), with this pipe's own gap
        if (
          !state.gameOver &&
          BIRD_X + BIRD_SIZE - HITBOX_SHRINK > pipe.x &&
          BIRD_X + HITBOX_SHRINK < pipe.x + PIPE_WIDTH
        ) {
          if (state.birdY + HITBOX_SHRINK < pipe.topH || state.birdY + BIRD_SIZE - HITBOX_SHRINK > pipe.topH + pipe.gap) {
            endGame(state);
          }
        }

        return pipe.x > -PIPE_WIDTH;
      });
    };

    // Boucle : autant de pas de 1/60 s que le temps écoulé en demande, puis un dessin
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(now - last, 250);
      last = now;
      while (acc >= STEP_MS) {
        step();
        acc -= STEP_MS;
      }
      draw();
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [started, isDark]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-6"
    >
      <div className="relative rounded-2xl border border-border bg-background/80 backdrop-blur-md p-4 shadow-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={flap}
          className="cursor-pointer max-w-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl"
          >
            <h3 className="text-3xl font-bold text-primary mb-2">Game Over</h3>
            <p className="text-lg text-muted-foreground mb-1">
              Score : <span className="text-foreground font-bold">{score}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Best : <span className="text-primary font-bold">{bestScore}</span>
            </p>
            <div className="flex gap-4">
              <Button onClick={resetGame} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <RotateCcw className="h-4 w-4" /> Rejouer
              </Button>
              <Button variant="outline" onClick={onBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Mini-jeux
              </Button>
            </div>
          </motion.div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Espace ou clic pour flap</p>
    </motion.div>
  );
};

export default FlappyBird;
