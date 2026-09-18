import { useId } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Logo : un F penché posé sur un globe filaire relié en réseau
   (reprend l'emblème d'origine du portfolio, redessiné en vectoriel).
   - les méridiens tournent lentement (le globe a l'air de pivoter) ;
   - un "paquet" circule entre les nœuds du réseau ;
   - le F est détaché des lignes par un fin liseré transparent (masque).
   Couleur du globe = currentColor (orange via text-primary).
   ─────────────────────────────────────────────────────────────── */

const F_PATH = 'M7.5 42.5V7H44l-4.4 6.8H14.5v6.7h17l-4.2 6.5H14.5v15.5Z';
const CX = 27, CY = 25.5, R = 17.5;

// Nœuds du réseau [x, y, rayon, orange ?]
const NODES: [number, number, number, boolean][] = [
  [33, 11.5, 1.2, false], [39.5, 19.5, 1.9, false], [44, 15.5, 1.4, true],
  [35.5, 29, 1.2, false], [42.5, 31.5, 1.6, true], [30, 37.5, 1.2, false], [37.5, 41, 1.8, true],
];
const LINKS: [number, number][] = [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5], [5, 6], [4, 6]];
const PACKET = 'M39.5 19.5L35.5 29L30 37.5L37.5 41L42.5 31.5L35.5 29L39.5 19.5';

const Logo = ({ size = 40, className = '' }: { size?: number; className?: string }) => {
  const uid = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const animate = !prefersReducedMotion();
  const spline = { calcMode: 'spline', keyTimes: '0;.5;1', keySplines: '.45 0 .55 1;.45 0 .55 1' };

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`flex-none overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor="#ffa35c" />
          <stop offset=".5" stopColor="#ff6a1f" />
          <stop offset="1" stopColor="#e2480c" />
        </linearGradient>
        <mask id={`${uid}m`} maskUnits="userSpaceOnUse" x="-2" y="-2" width="52" height="52">
          <rect x="-2" y="-2" width="52" height="52" fill="#fff" />
          <path d={F_PATH} fill="#000" stroke="#000" strokeWidth="3.4" strokeLinejoin="round" />
        </mask>
      </defs>

      <g mask={`url(#${uid}m)`}>
        {/* Globe filaire, légèrement incliné */}
        <g transform={`rotate(-16 ${CX} ${CY})`} fill="none" stroke="currentColor" strokeWidth=".9">
          <circle cx={CX} cy={CY} r={R} strokeWidth="1.1" opacity=".9" />
          <ellipse cx={CX} cy={CY} rx={R} ry={R * 0.3} opacity=".55" />
          <ellipse cx={CX} cy={CY - R * 0.55} rx={R * 0.835} ry={R * 0.25} opacity=".4" />
          <ellipse cx={CX} cy={CY + R * 0.55} rx={R * 0.835} ry={R * 0.25} opacity=".4" />
          {[0, 1, 2].map((i) => (
            <ellipse key={i} cx={CX} cy={CY} rx={[R * 0.35, R * 0.75, R * 0.95][i]} ry={R} opacity=".5">
              {animate && <animate attributeName="rx" values={`${R};0;${R}`} dur="9s" begin={`${-3 * i - 1.5}s`} repeatCount="indefinite" {...spline} />}
            </ellipse>
          ))}
        </g>

        {/* Réseau */}
        <g style={{ stroke: 'hsl(var(--foreground) / .5)' }} strokeWidth=".7">
          {LINKS.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
          ))}
        </g>
        {NODES.map(([x, y, r, orange], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={orange ? 'currentColor' : undefined} style={orange ? undefined : { fill: 'hsl(var(--foreground))' }}>
            {animate && i % 3 === 1 && <animate attributeName="opacity" values="1;.35;1" dur="2.6s" begin={`${-i * 0.7}s`} repeatCount="indefinite" />}
          </circle>
        ))}
        {animate && (
          <circle r=".95" fill="currentColor">
            <animateMotion path={PACKET} dur="6s" repeatCount="indefinite" />
          </circle>
        )}
      </g>

      {/* Le F */}
      <path d={F_PATH} fill={`url(#${uid}f)`} />
      <path d="M7.5 7H44l-.6.9H7.5Z" fill="#fff" opacity=".35" />
    </svg>
  );
};

export default Logo;
