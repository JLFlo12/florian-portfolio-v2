import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { gsap, prefersReducedMotion, scrambleText } from "@/lib/motion";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const code = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  // "404" qui se décode puis tremble de temps en temps (glitch)
  useEffect(() => {
    const el = code.current;
    if (!el) return;
    scrambleText(el, "404", 900);
    if (prefersReducedMotion()) return;
    const loop = gsap.timeline({ repeat: -1, repeatDelay: 2.4 });
    for (let i = 0; i < 5; i++) loop.set(el, { x: gsap.utils.random(-10, 10), skewX: gsap.utils.random(-12, 12) }, i * 0.05);
    loop.set(el, { x: 0, skewX: 0 }, 0.28);
    return () => { loop.kill(); };
  }, []);

  return (
    <div className="relative flex min-h-[100svh] items-center overflow-hidden pt-[var(--nav-h)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_50%,hsl(var(--primary)/.14),transparent_70%)]" aria-hidden="true" />
      <div className="container-x relative">
        <p className="eyebrow">
          <span className="eyebrow__index">ERR</span>
          <span className="eyebrow__rule" aria-hidden="true" />
          <span className="eyebrow__label">{location.pathname}</span>
        </p>
        <p ref={code} className="led mt-6 text-[clamp(7rem,28vw,22rem)] leading-[.85] text-primary" aria-hidden="true">404</p>
        <h1 className="title-xl mt-6">{t('notFound.title')}</h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">{t('notFound.text')}</p>
        <Link to="/" className="btn-neon mt-10">
          <ArrowLeft className="h-4 w-4" /> {t('notFound.back')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
