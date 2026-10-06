import { CONTACT } from './profile';

/* ───────────────────────────────────────────────────────────────
   Mentions légales et confidentialité (page /mentions-legales), en français et en anglais.
   Un bloc = un titre + des paragraphes ; une ligne qui commence par « - » devient une puce.
   À tenir à jour si le site ajoute un service (formulaire, statistiques, contenu intégré…).
   ─────────────────────────────────────────────────────────────── */

export interface LegalBlock { title: string; body: string[] }

export const LEGAL_UPDATED = '2026-10-04';

const fr: LegalBlock[] = [
  {
    title: 'Éditeur du site',
    body: [
      'Ce site est le portfolio personnel, non commercial, de Florian GIRARDOT LAHOGUE, étudiant en BUT Réseaux & Télécommunications à l’IUT de La Réunion. Il en est l’éditeur et le directeur de la publication.',
      `Contact : ${CONTACT.email}`,
    ],
  },
  {
    title: 'Hébergement',
    body: [
      'Site hébergé par Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis (vercel.com).',
      'Les fiches des projets et leurs images sont stockées chez Supabase (supabase.com).',
    ],
  },
  {
    title: 'Propriété intellectuelle',
    body: [
      'Les textes, projets, présentations et visuels de ce site sont l’œuvre de Florian GIRARDOT LAHOGUE (et de ses coéquipiers pour les projets de groupe). Toute reproduction sans autorisation est interdite.',
      'Crédits :',
      '- polices Hubot Sans, Mona Sans, Geist Mono, Doto et Instrument Serif, sous licence SIL Open Font License ;',
      '- photo de la borne UniFi : Wikimedia Commons, auteur L3u, domaine public (CC0) ;',
      '- 27 photos du jeu « Guess the Building » : Wikimedia Commons, sous licences libres (CC BY, CC BY-SA, CC0 ou domaine public), recadrées et réduites. L’auteur et la licence de chaque photo sont indiqués dans le jeu, sous la photo, avec un lien vers sa page d’origine ;',
      '- quelques images d’anciens projets : Unsplash, sous licence Unsplash ;',
      '- logos des outils (accueil) : Simple Icons (simpleicons.org), licence CC0 ;',
      '- les marques et logos cités appartiennent à leurs propriétaires.',
    ],
  },
  {
    title: 'Données personnelles',
    body: [
      `Responsable du traitement : Florian GIRARDOT LAHOGUE (${CONTACT.email}). Le site ne crée aucun compte visiteur et ne vend aucune donnée.`,
      '- Formulaire de contact : votre nom, votre adresse e-mail et votre message sont transmis par le service FormSubmit (Devro LABS) jusqu’à ma boîte mail, uniquement pour vous répondre. Ils sont conservés le temps de l’échange, puis supprimés au plus tard 12 mois après le dernier message.',
      '- Jarvis (assistant) : vos questions sont envoyées, via une fonction Supabase, au service d’intelligence artificielle de Lovable (modèle Google Gemini) pour produire la réponse. Le site ne conserve pas les conversations. N’y saisissez pas d’informations personnelles.',
      '- Jarvis à la voix (facultatif) : si vous lui parlez, la reconnaissance vocale est faite par votre navigateur (Chrome et Edge envoient le son à Google ou à Microsoft, Safari à Apple), et seul le texte reconnu est envoyé à Jarvis. Sa voix est produite par votre navigateur. Le micro s’allume quand vous touchez Jarvis ou le bouton micro, se rouvre après chacune de ses réponses dites à voix haute, et s’éteint après un silence.',
      '- Statistiques : Vercel Web Analytics compte les visites de façon anonyme et agrégée (pages vues, pays, type d’appareil), sans cookie.',
      '- Ces services peuvent traiter les données aux États-Unis.',
    ],
  },
  {
    title: 'Cookies et stockage local',
    body: [
      'Le site ne dépose aucun cookie publicitaire ni de mesure d’audience. Il garde seulement sur votre appareil des préférences que vous choisissez : thème clair ou sombre, musique activée ou non, meilleurs scores des jeux, écran de chargement déjà vu pendant la visite, et présentations que vous avez accepté de charger. Rien de tout cela n’est envoyé ailleurs ; vous pouvez l’effacer depuis votre navigateur.',
      'Contenus intégrés : les présentations Canva et Gamma ne se chargent que si vous cliquez sur « Charger la présentation ». Ces services peuvent alors déposer leurs propres cookies, selon leurs politiques. Votre choix est retenu sur cet appareil ; le bouton ci-dessous l’annule.',
    ],
  },
  {
    title: 'Vos droits',
    body: [
      `Vous pouvez demander l’accès, la rectification ou l’effacement de vos données, ou vous opposer à leur traitement, en écrivant à ${CONTACT.email}. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).`,
    ],
  },
];

const en: LegalBlock[] = [
  {
    title: 'Publisher',
    body: [
      'This website is the personal, non-commercial portfolio of Florian GIRARDOT LAHOGUE, a student in Networks & Telecommunications (BUT R&T) at IUT de La Réunion, who is its publisher and editor.',
      `Contact: ${CONTACT.email}`,
    ],
  },
  {
    title: 'Hosting',
    body: [
      'Hosted by Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United States (vercel.com).',
      'Project records and their images are stored with Supabase (supabase.com).',
    ],
  },
  {
    title: 'Intellectual property',
    body: [
      'The texts, projects, presentations and visuals on this site are the work of Florian GIRARDOT LAHOGUE (and his teammates for group projects). Reproduction without permission is prohibited.',
      'Credits:',
      '- Hubot Sans, Mona Sans, Geist Mono, Doto and Instrument Serif fonts, under the SIL Open Font License;',
      '- UniFi access point photo: Wikimedia Commons, by L3u, public domain (CC0);',
      '- 27 photos in the “Guess the Building” game: Wikimedia Commons, under free licences (CC BY, CC BY-SA, CC0 or public domain), cropped and resized. Each photo’s author and licence are shown in the game, below the photo, with a link to its original page;',
      '- a few images from older projects: Unsplash, under the Unsplash licence;',
      '- tool logos (home page): Simple Icons (simpleicons.org), CC0 licence;',
      '- the brands and logos mentioned belong to their owners.',
    ],
  },
  {
    title: 'Personal data',
    body: [
      `Data controller: Florian GIRARDOT LAHOGUE (${CONTACT.email}). The site creates no visitor accounts and sells no data.`,
      '- Contact form: your name, email address and message are relayed by the FormSubmit service (Devro LABS) to my inbox, only so I can reply. They are kept for the duration of the exchange and deleted no later than 12 months after the last message.',
      '- Jarvis (assistant): your questions are sent, through a Supabase function, to Lovable’s AI service (Google Gemini model) to generate the answer. The site does not keep conversations. Please do not enter personal information.',
      '- Talking to Jarvis (optional): if you speak to him, speech recognition is done by your browser (Chrome and Edge send the audio to Google or Microsoft, Safari to Apple), and only the recognised text is sent to Jarvis. His voice is produced by your browser. The microphone turns on when you tap Jarvis or the microphone button, reopens after each of his spoken replies, and turns off after a silence.',
      '- Analytics: Vercel Web Analytics counts visits anonymously and in aggregate (pages viewed, country, device type), without cookies.',
      '- These services may process data in the United States.',
    ],
  },
  {
    title: 'Cookies and local storage',
    body: [
      'The site sets no advertising or audience-measurement cookies. It only keeps preferences you choose on your device: light or dark theme, music on or off, best game scores, loading screen already seen during the visit, and presentations you agreed to load. None of this is sent anywhere; you can clear it from your browser.',
      'Embedded content: Canva and Gamma presentations only load when you click “Load the presentation”. These services may then set their own cookies, under their own policies. Your choice is remembered on this device; the button below resets it.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      `You can ask to access, correct or delete your data, or object to its processing, by writing to ${CONTACT.email}. You can also lodge a complaint with the CNIL, the French data protection authority (cnil.fr).`,
    ],
  },
];

export const legalContent = (lang: string) => (lang.startsWith('en') ? en : fr);

/* Présentations intégrées (Canva, Gamma) que le visiteur a accepté de charger, mémorisées sur l'appareil */
const EMBEDS_KEY = 'florian-embeds';

export const embedAllowed = (host: string) => {
  try { return (JSON.parse(localStorage.getItem(EMBEDS_KEY) || '[]') as string[]).includes(host); } catch { return false; }
};

export const allowEmbed = (host: string) => {
  try {
    const list = JSON.parse(localStorage.getItem(EMBEDS_KEY) || '[]') as string[];
    if (!list.includes(host)) localStorage.setItem(EMBEDS_KEY, JSON.stringify([...list, host]));
  } catch { /* stockage indisponible */ }
};

export const resetEmbeds = () => {
  try { localStorage.removeItem(EMBEDS_KEY); } catch { /* stockage indisponible */ }
};
