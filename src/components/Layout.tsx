
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Globe, ChevronDown, Gamepad2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import SmoothScroll, { useLenis } from '@/components/fx/SmoothScroll';
import Cursor from '@/components/fx/Cursor';
import Preloader from '@/components/fx/Preloader';
import LiquidGlass from '@/components/fx/LiquidGlass';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/motion';

interface LayoutProps {
  children: React.ReactNode;
}

/* ─────────────── Contenu du layout (a besoin du contexte Lenis) ─────────────── */
const Shell: React.FC<LayoutProps> = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const lenis = useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const hudBar = useRef<HTMLElement>(null);
  const hudPct = useRef<HTMLSpanElement>(null);
  const curtain = useRef<HTMLDivElement>(null);
  const firstRoute = useRef(true);

  const navItems = [
    { path: '/', label: t('nav.home') },
    { path: '/projects', label: t('nav.projects') },
    { path: '/about', label: t('nav.about') },
    { path: '/contact', label: t('nav.contact') },
    { path: '/chatbot', label: t('nav.chatbot') }
  ];

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const currentLabel = navItems.find((i) => isActive(i.path))?.label ?? (location.pathname.startsWith('/games') ? t('nav.games') : location.pathname === '/cv' ? 'CV' : '404');

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
  };

  /* Changement de page : retour en haut + rideau orange qui balaie l'écran */
  useLayoutEffect(() => {
    setMenuOpen(false);
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
    requestAnimationFrame(() => ScrollTrigger.refresh());

    if (firstRoute.current) { firstRoute.current = false; return; }
    if (!curtain.current || prefersReducedMotion()) return;
    // y: 0 => ignore le translateY(100%) du CSS de départ
    gsap.fromTo(curtain.current, { y: 0, yPercent: 0 }, { yPercent: -100, duration: 0.95, ease: 'expo.inOut', delay: 0.12 });
    gsap.fromTo(curtain.current.firstElementChild, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -40, duration: 0.5, ease: 'power2.in', delay: 0.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  /* Barre de navigation : masquée quand on descend, visible quand on remonte */
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // Indicateur de défilement mis à jour directement (sans re-rendu React à chaque image)
      const p = max > 0 ? Math.min(1, y / max) : 0;
      if (hudBar.current) hudBar.current.style.transform = `scaleX(${p})`;
      if (hudPct.current) hudPct.current.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}%`;
      if (hudBar.current) hudBar.current.closest<HTMLElement>('[data-scroll-hud]')!.style.opacity = y > window.innerHeight * 0.5 && p < 0.96 ? '1' : '0';
      if (Math.abs(y - last) > 6) { setHidden(y > last && y > window.innerHeight * 0.5); last = y; }
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Menu mobile : bloque le défilement pendant qu'il est ouvert */
  useEffect(() => {
    if (!lenis) return;
    if (menuOpen) lenis.stop(); else lenis.start();
  }, [menuOpen, lenis]);

  const controls = (
    <>
      {/* Langue */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t('ui.language')} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-mono text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
            <Globe className="h-4 w-4" />
            {i18n.language === 'fr' ? 'FR' : 'EN'}
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="liquid rounded-2xl bg-transparent">
          <DropdownMenuItem onClick={() => changeLanguage('fr')} className="cursor-pointer">Français</DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer">English</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mini-jeux */}
      <Link
        to="/games"
        aria-label={t('ui.games')}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-foreground/5 ${isActive('/games') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <Gamepad2 className="h-4 w-4" />
      </Link>

      {/* Thème */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={t('ui.theme')}
        className="group inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <span className="transition-transform duration-500 group-hover:rotate-180">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </span>
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Preloader />
      <Cursor />
      <LiquidGlass />
      <div className="grain" aria-hidden="true" />

      {/* Rideau de transition entre les pages */}
      <div ref={curtain} className="curtain" aria-hidden="true">
        <span className="curtain__label">{currentLabel}</span>
      </div>

      {/* ─────────────── Navigation ─────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-700 [transition-timing-function:var(--ease-out)] ${hidden && !menuOpen ? '-translate-y-full' : ''}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <nav className="container-x relative flex h-[var(--nav-h)] max-w-[1800px] items-center justify-between gap-4" aria-label="Navigation principale">
          <Link to="/" className="liquid relative z-[2] flex items-center gap-2.5 rounded-full p-1 text-primary sm:pr-4" aria-label="Florian G.L — accueil">
            <Logo size={40} />
            <span className="hidden font-display text-[.95rem] font-extrabold uppercase tracking-tight text-foreground sm:inline [font-stretch:125%]">
              Florian<span className="text-primary">.</span>G.L
            </span>
          </Link>

          {/* Pilule de navigation (ordinateur) */}
          <div className="liquid hidden items-center gap-1 rounded-full p-1.5 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive(item.path) ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-foreground/10 hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="relative z-[2] flex items-center gap-1">
            <div className="liquid hidden items-center gap-0.5 rounded-full p-1 md:flex">{controls}</div>
            {/* Bouton menu (mobile) */}
            <button
              type="button"
              className="liquid relative h-[50px] w-[50px] rounded-full md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? t('ui.close') : t('ui.menu')}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className={`absolute left-[14px] right-[14px] top-[17px] h-0.5 rounded bg-foreground transition-transform duration-500 ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
              <span className={`absolute left-[14px] right-[14px] top-[23px] h-0.5 rounded bg-foreground transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`absolute left-[14px] right-[14px] top-[29px] h-0.5 rounded bg-foreground transition-transform duration-500 ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
            </button>
          </div>
        </nav>

        {/* Menu plein écran (mobile) */}
        <div
          id="mobile-menu"
          className={`fixed inset-0 -z-[1] flex flex-col justify-between bg-background px-[var(--gutter)] pb-10 pt-[calc(var(--nav-h)+24px)] transition-[opacity,visibility] duration-500 md:hidden ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
        >
          <ul className="space-y-1">
            {[...navItems, { path: '/games', label: t('nav.games') }].map((item, i) => (
              <li
                key={item.path}
                className={`transition-all duration-700 [transition-timing-function:var(--ease-out)] ${menuOpen ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
                style={{ transitionDelay: menuOpen ? `${i * 50}ms` : '0ms' }}
              >
                <Link to={item.path} className={`flex items-baseline gap-4 py-1 font-display text-[clamp(2rem,10vw,3.2rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%] ${isActive(item.path) ? 'text-primary' : 'text-foreground'}`}>
                  <span className="led text-sm text-primary">{String(i + 1).padStart(2, '0')}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">{controls}</div>
        </div>
      </header>

      {/* ─────────────── Contenu ─────────────── */}
      <main className="relative">{children}</main>

      {location.pathname !== '/chatbot' && <Footer />}

      {/* Indicateur de défilement façon télémétrie (grand écran) */}
      <div data-scroll-hud className="pointer-events-none fixed bottom-6 left-[var(--gutter)] z-40 hidden items-center gap-3 font-mono text-[.68rem] uppercase tracking-[.1em] text-muted-foreground opacity-0 transition-opacity duration-500 lg:flex" aria-hidden="true">
        <span className="text-primary">FLORIAN.SYS</span>
        <span>/ {currentLabel}</span>
        <span className="relative h-0.5 w-20 overflow-hidden bg-foreground/15">
          <i ref={hudBar} className="absolute inset-0 origin-left scale-x-0 bg-primary" />
        </span>
        <span ref={hudPct} className="led text-foreground">000%</span>
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <SmoothScroll>
    <Shell>{children}</Shell>
  </SmoothScroll>
);

export default Layout;
