import { CONTACT, SOFT_SKILLS, STUDIES, TECHNICAL_SKILLS, currentStudyYear, type Level } from '@/data/profile';
import { TOOLS } from '@/data/tools';
import type { DynamicProject } from '@/hooks/useDynamicProjects';

/* ───────────────────────────────────────────────────────────────
   Contexte envoyé à Jarvis avec chaque question.
   La fonction serveur (cyberbot-chat) a ses propres instructions ;
   celles-ci les complètent avec des informations toujours à jour :
   date du jour, projets lus dans la base, compétences et outils du site.
   ─────────────────────────────────────────────────────────────── */

const LEVELS: Record<Level, string> = {
  maitrise: 'maîtrisé',
  avance: 'avancé',
  base: 'bases',
  fragile: 'notions, en cours d\'apprentissage',
};

const CATEGORIES: Record<string, string> = {
  security: 'cybersécurité', network: 'réseau', gamedev: 'jeu vidéo', virtualization: 'virtualisation',
  development: 'développement', server: 'serveurs', telecom: 'télécom', hardware: 'matériel', os: 'système', tools: 'outil',
};

const clip = (text: string, max = 280) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

export function buildJarvisContext({ projects, lang }: { projects: DynamicProject[]; lang: string }) {
  const now = new Date();
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Indian/Reunion' }).format(now);
  const study = currentStudyYear(now);
  const studyLine = study
    ? `Florian est actuellement en ${study.year === 1 ? '1re' : `${study.year}e`} année de BUT Réseaux & Télécommunications (année universitaire ${study.from}-${study.to}), à l'IUT de La Réunion.`
    : `Florian a suivi le BUT Réseaux & Télécommunications à l'IUT de La Réunion (${STUDIES.start}-${STUDIES.end}).`;

  const projectLines = projects.length
    ? projects.map((p, i) => {
        const description = (lang === 'en' && p.description_en) || p.description_fr || p.description_en;
        const status = p.status === 'completed' ? 'terminé' : 'en cours';
        const tags = p.tags?.length ? ` [${p.tags.join(', ')}]` : '';
        return `${i + 1}. ${p.title} (${status})${tags}${description ? ` : ${clip(description)}` : ''}`;
      }).join('\n')
    : '(liste des projets indisponible pour le moment : invite le visiteur à consulter la page Projets)';

  return `## Informations à jour fournies par le site (prioritaires sur tes autres informations en cas de différence)

### Date
Nous sommes le ${date} (heure de La Réunion, UTC+4). Utilise cette date pour toute question sur l'année, l'âge d'un projet ou « aujourd'hui ».

### Parcours
- ${studyLine}
- Formation : BUT Réseaux & Télécommunications, parcours cybersécurité (${STUDIES.start}-${STUDIES.end}).
- Avant : baccalauréat technologique au lycée Roland Garros (2023-2024).
- Langues : français (langue maternelle), anglais technique (documentation, outils).
- Centres d'intérêt : jeux vidéo, musique, art, veille informatique et auto-apprentissage.

### Contact (à donner exactement ainsi)
- E-mail : ${CONTACT.email} (attention : deux tirets entre « girardot » et « lahogue »)
- GitHub : ${CONTACT.github}
- LinkedIn : ${CONTACT.linkedin}
- Localisation : ${CONTACT.location}
- Le plus simple pour le contacter : le formulaire de la page Contact du portfolio.

### Compétences techniques (niveaux affichés sur le site)
${TECHNICAL_SKILLS.map((s) => `- ${s.name} : ${LEVELS[s.level]}`).join('\n')}

### Savoir-être
${SOFT_SKILLS.map((s) => `- ${s.name} : ${LEVELS[s.level]}`).join('\n')}
- Autres qualités citées dans son CV : autonomie, méthodologie d'analyse, organisation.

### Expérience pratique (d'après son CV)
- Simulation et configuration de réseaux : Cisco Packet Tracer, GNS3
- Analyse de réseau : Wireshark
- Virtualisation et environnements de test : VirtualBox, VMware
- Administration de systèmes et services réseau : Linux (Debian, Kali), Windows Server
- Sécurité et pare-feu : pfSense
- Pentest / sécurité offensive en environnement contrôlé : analyse de la surface d'attaque, reconnaissance réseau, recherche de failles connues (CVE) et de mauvaises configurations

### Outils qu'il utilise (${TOOLS.length})
${TOOLS.map((t) => `${t.name} (${CATEGORIES[t.category] ?? t.category})`).join(', ')}

### Projets publiés sur le portfolio (${projects.length})
${projectLines}

### Le portfolio
Version 2, refonte complète : planète 3D interactive (React Three Fiber), animations GSAP, verre liquide. Pages : Accueil, Projets, À propos, CV, Contact, Jarvis (toi) et Jeux.`;
}
