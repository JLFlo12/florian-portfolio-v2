import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/motion';
import { useLenis } from '@/components/fx/SmoothScroll';

/* Bandeau défilant incliné : accélère et se penche selon la vitesse du scroll. */
const Marquee = ({ items, className = '' }: { items: string[]; className?: string }) => {
  const track = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const el = track.current;
    if (!el || prefersReducedMotion()) return;
    const loop = gsap.to(el, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
    const skew = gsap.quickTo(el, 'skewX', { duration: 0.5, ease: 'power3.out' });
    const onScroll = ({ velocity }: { velocity: number }) => {
      const v = gsap.utils.clamp(-80, 80, velocity || 0);
      gsap.to(loop, { timeScale: 1 + Math.abs(v) * 0.14, duration: 0.3, overwrite: true });
      skew(gsap.utils.clamp(-12, 12, -v * 0.3));
    };
    const unsubscribe = lenis?.on('scroll', onScroll);
    return () => { unsubscribe?.(); loop.kill(); gsap.set(el, { clearProps: 'transform' }); };
  }, [lenis]);

  const row = [...items, ...items];
  return (
    <div className={`relative z-[2] -my-6 overflow-hidden py-6 pointer-events-none ${className}`} aria-hidden="true">
      <div className="marquee -rotate-2 w-[120%] -ml-[10%] bg-primary text-primary-foreground shadow-[0_20px_60px_-20px_hsl(var(--primary)/.6)]">
        <div ref={track} className="marquee__track">
          {row.map((item, i) => (
            <span key={i} className="flex items-center">
              <span className="marquee__item">{item}</span>
              <i className="marquee__sep" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Marquee;
