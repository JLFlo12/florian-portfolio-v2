import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { armSound, sound, useSound } from '@/lib/ambient';

/* Bouton de la musique d'ambiance : barres d'égaliseur qui dansent pendant la lecture. */
const SoundToggle = () => {
  const { t } = useTranslation();
  const { wanted, playing } = useSound();
  useEffect(armSound, []);
  const label = wanted ? t('ui.soundOff') : t('ui.soundOn');
  return (
    <button
      type="button"
      data-sound-toggle
      onClick={sound.toggle}
      aria-pressed={wanted}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      <span className={`sound-bars ${playing ? 'is-playing' : ''} ${wanted ? '' : 'is-off'}`} aria-hidden="true">
        <i /><i /><i /><i />
      </span>
    </button>
  );
};

export default SoundToggle;
