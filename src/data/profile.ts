/* ───────────────────────────────────────────────────────────────
   Profil de Florian : source unique pour le site (accueil, CV, contact)
   et pour Jarvis, qui reçoit ces informations à chaque question.
   ─────────────────────────────────────────────────────────────── */

export const CONTACT = {
  email: 'f.girardot--lahogue@rt-iut.re',
  github: 'https://github.com/JLFlo12',
  linkedin: 'https://www.linkedin.com/in/florian-girardot-lahogue-4aa367341/',
  location: 'Le Tampon, La Réunion',
};

export type Level = 'maitrise' | 'avance' | 'base' | 'fragile';

export const TECHNICAL_SKILLS: { name: string; level: Level }[] = [
  { name: 'Réseaux & GNS3', level: 'maitrise' },
  { name: 'Linux/Windows Server', level: 'maitrise' },
  { name: 'JavaScript/TypeScript', level: 'base' },
  { name: 'PHP & SQL', level: 'base' },
  { name: 'Cybersécurité', level: 'fragile' },
  { name: 'Virtualisation', level: 'maitrise' },
];

export const SOFT_SKILLS: { name: string; level: Level }[] = [
  { name: 'Leadership', level: 'base' },
  { name: 'Communication', level: 'avance' },
  { name: 'Travail d\'équipe', level: 'maitrise' },
  { name: 'Discipline', level: 'maitrise' },
  { name: 'Esprit critique', level: 'avance' },
];

/* Formation (années de début et de fin scolaires) */
export const STUDIES = {
  start: 2024, // rentrée en 1re année de BUT
  end: 2027,
};

/* Année de BUT en cours (1, 2 ou 3), ou null si la formation est terminée.
   L'année universitaire commence en septembre. */
export const currentStudyYear = (now = new Date()) => {
  const schoolYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const year = schoolYearStart - STUDIES.start + 1;
  return year >= 1 && year <= STUDIES.end - STUDIES.start ? { year, from: schoolYearStart, to: schoolYearStart + 1 } : null;
};
