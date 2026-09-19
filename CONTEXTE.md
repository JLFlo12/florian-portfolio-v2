# Contexte du projet : portfolio v2 (Florian GIRARDOT LAHOGUE)

Ce fichier résume tout le travail fait sur la refonte du portfolio, les décisions prises et ce qu'il faut savoir pour continuer. Dernière mise à jour : 18 septembre 2026.

---

## 1. En bref

| | |
| --- | --- |
| **Site v2 (en ligne)** | https://florian-portfolio-v2.vercel.app |
| **Dépôt v2 (public)** | https://github.com/JLFlo12/florian-portfolio-v2 |
| **Ancien site (inchangé)** | https://florian-portfolio-zeta.vercel.app |
| **Ancien dépôt (inchangé)** | https://github.com/JLFlo12/florian-portfolio |
| **Dossier local** | `PorteFolio/`, branche `refonte-moderne` |
| **Stack** | React 18 + TypeScript + Vite 5, Tailwind + shadcn/ui, GSAP + Lenis, three.js + React Three Fiber, i18next (FR/EN), Supabase |

La v2 est une **refonte complète** du portfolio d'origine, qui avait été généré avec Lovable. Le style s'inspire du site AMIGOS (`BUT 3/SiteWeb`), ambiance « pilote de F1 / HUD futuriste ». **Tout le contenu d'origine est conservé** : textes, 23 outils, compétences, 12 projets Supabase, mode admin, Jarvis, 5 mini-jeux, FR/EN, thème clair/sombre.

---

## 2. Git, GitHub et déploiement

### Dépôts
- `origin` → `JLFlo12/florian-portfolio` : **ancien portfolio**. Relié à Lovable et à Vercel : un push sur `main` redéploie l'ancien site. **Ne pas pousser la v2 dessus.**
- `v2` → `JLFlo12/florian-portfolio-v2` : **nouveau dépôt**. La branche locale `refonte-moderne` suit `v2/main`.

### Commits de la v2
| Commit | Contenu |
| --- | --- |
| `f7e4a87` | Refonte complète (design, planète 3D, animations, contact, README) |
| `67c7453` | Fusion du commit initial créé par GitHub (README remplacé par la version complète) |
| `000b1c7` | Verre liquide, nouveau logo, tracé au survol sur Contact |
| `78c4e62` | Plongée 3D de l'accueil vers la section Outils |
| `9ceba31` | Jarvis à jour, formulaire, page CV, polices locales, WebP, découpage du code, statistiques, typographie + télémétrie de la plongée, toile 3D des outils façon Jarvis (déployé sur Vercel le 18/09/2026) |

Pour pousser : `git push v2 refonte-moderne:main`.
**Règle de Florian : toujours lui faire relire les fichiers avant un commit ou un push.**

### Vercel
- Projet **`florian-portfolio-v2`** (id `prj_4IlaCo3QXrHJXuwtkAra17fKv9DP`, équipe `flos-projects-2a6a4f20`, compte `jlflo12`).
- **Ce projet n'est pas relié à GitHub** : un push ne redéploie rien. On déploie à la main le dossier `dist/` déjà compilé :
  ```bash
  npm run build                                  # ou : node node_modules/vite/bin/vite.js build
  # copier dist/ + vercel.json dans un dossier relié au projet, puis :
  npx vercel@latest link --project florian-portfolio-v2   # une seule fois
  npx vercel@latest deploy --prod --yes
  ```
- `vercel.json` : toutes les routes renvoient vers `index.html` (application monopage), **sauf** `/_vercel/*`, pour ne pas casser le script de statistiques.
- Option à proposer : relier ce projet Vercel au dépôt v2 pour que chaque push déploie automatiquement.

### Supabase
- Projet `esphltubteoswpkqbszo`, **géré par Lovable Cloud**. Le connecteur Supabase de Claude n'y a **pas accès** (il ne voit que le projet `parko`).
- On ne peut donc ni déployer de fonction, ni créer de table sans passer par Lovable.
- Fonctions existantes : `cyberbot-chat` (Jarvis, via Lovable AI Gateway) et `admin-projects` (mode admin, mot de passe). Table `projects`, bucket `project-thumbnails`.

---

## 3. Pièges rencontrés (important pour la suite)

1. **Le `&` dans le chemin** (`BUT Réseaux & Télécommunication - Cyber`) casse les scripts `npx`/`.cmd` du projet. Lancer les outils avec node directement :
   - build : `node node_modules/vite/bin/vite.js build`
   - types : `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit`
   - aperçu : `node node_modules/vite/bin/vite.js preview --port 4173`
   - `npx vercel@latest` fonctionne, à condition de le lancer **depuis un autre dossier**.
2. **Fins de ligne mélangées (CRLF/LF)** : certains fichiers sont en CRLF. Les remplacements de texte doivent en tenir compte.
3. **Découpage du code (`manualChunks` dans `vite.config.ts`)** : tout module qui appelle React **au chargement** (ex. `react-i18next`) doit rester dans le même fichier que React (`vendor-react`). Sinon, page blanche : `Cannot read properties of undefined (reading 'createContext')`.
4. **GSAP et transformations** : les animations d'apparition utilisent `clearProps: 'transform'` pour ne pas bloquer les effets de survol CSS.
5. **Épinglage ScrollTrigger** : la plongée de l'accueil utilise `refreshPriority: 1`, car elle est créée après les animations placées plus bas dans la page.
6. **Police Mona Sans** : deux tirets consécutifs se touchent et ressemblent à un seul trait. L'adresse e-mail s'affiche donc en monospace (classe `.email-text`).

---

## 4. Design system « FLORIAN.SYS »

- **Couleurs** : noir chaud et orange néon (`#ff6a1f` en sombre, `#ea580c` en clair). Jetons HSL shadcn dans `src/index.css` (`:root` = clair, `.dark` = sombre, sombre par défaut).
- **Planète et thème** : `Planet.tsx` a deux palettes (`DARK` / `LIGHT`), qui changent sans rechargement quand on bascule le thème. En clair, la planète est ivoire et pêche, ses continents orange brûlé, et le halo est un dégradé translucide en mélange normal : le mélange additif donnait un néon criard avec un liseré gris sur fond clair. C'est ce qui rend lisibles « FLORIAN » et les mots de la plongée. Les shaders écrivent leur couleur telle quelle, donc la palette claire utilise `raw()` (valeurs sRGB).
- **Polices**, **hébergées dans `public/fonts/`** (sous-ensemble latin, licences SIL OFL dans `public/fonts/OFL.txt`) :
  - Hubot Sans : titres, largeur 112–125 %
  - Mona Sans : texte
  - Geist Mono : HUD
  - Doto : chiffres LED
  - Instrument Serif italique : accents

  Hubot Sans et Mona Sans sont préchargées dans `index.html`. Il n'y a plus aucune requête vers Google Fonts.
- **Classes utiles** (`src/index.css`) : `container-x`, `section-y`, `display-xl`, `title-xl`, `serif-accent`, `label-mono`, `led`, `eyebrow`, `hud-frame`, `hud-panel`, `panel`, `btn-neon`, `btn-ghost`, `chip`, `liquid`, `liquid-strong`, `field`, `field__input`, `email-text`, `cv-*`, `track-*`, `dive-*`, `tools-*`, `tool-card`.
- **Animations** (`src/lib/motion.tsx`) :
  - attributs `data-reveal`, `data-stagger` (dont `flip`), `data-split`, `data-rule` et `data-count`, activés par `useReveal(ref)` ;
  - aussi `magnetic()`, `scrambleText()` (annule l'appel précédent sur le même élément) et `SplitText` / `AccentTitle`.
- **Accessibilité** :
  - `prefers-reduced-motion` coupe les animations, la plongée et le préchargeur ;
  - `prefers-reduced-transparency` rend le verre opaque.

---

## 5. Fonctionnalités et fichiers clés

### Structure générale
- `src/components/Layout.tsx`, en-tête en **pastilles de verre flottantes** :
  - trois pastilles : logo, navigation, réglages (langue, jeux, thème) ;
  - sur mobile : logo + bouton menu, avec menu plein écran.
- Également dans le layout :
  - le rideau de transition orange entre les pages ;
  - l'indicateur de défilement façon télémétrie ;
  - le curseur personnalisé et le grain.
- `src/components/fx/Preloader.tsx` : écran de chargement façon démarrage système (mode rapide si déjà vu dans la session). Il envoie le signal `markReady()` (`src/lib/ready.ts`).
- `src/components/fx/SmoothScroll.tsx` : Lenis synchronisé avec GSAP. Il se met en pause quand un menu ou une fenêtre Radix bloque le défilement.
- `src/components/Footer.tsx` : grand appel à l'action, menu, contacts, heure de La Réunion (`useReunionTime`).
- `src/App.tsx` : l'accueil est chargé tout de suite, les autres pages à la demande (`React.lazy`). Les notifications Sonner sont chargées après le premier affichage.

### Accueil
Fichiers : `src/pages/Home.tsx` et `src/components/three/*`.
- **Planète 3D** (`Planet.tsx`, chargée à part, environ 235 Ko compressés) :
  - noyau avec shader ;
  - continents en 11 000 points ;
  - atmosphère et anneau avec poussière ;
  - lune et étoiles ;
  - liaisons réseau parcourues de « paquets » ;
  - balise sur La Réunion avec une étiquette HTML qui la suit.

  Elle suit la souris et le rendu se met en pause hors écran.
- **Plongée vers les Outils** (épinglage ScrollTrigger sur environ 1,3 écran de scroll) :
  - la planète vient au centre et tourne pour placer La Réunion face à la caméra (`REUNION_YAW` / `REUNION_PITCH`) ;
  - elle grossit jusqu'à `DIVE_SCALE = 3.3`, on traverse l'anneau ;
  - la balise et les liaisons s'effacent, les étoiles défilent ;
  - le texte du hero passe de part et d'autre ;
  - un voile orange (`data-dive-flash`) fait le raccord avec la section Outils.

  La progression est partagée via `planetState.dive`.
- **Habillage de la plongée** (`src/components/DiveOverlay.tsx`) :
  - télémétrie : altitude de 35 786 km à 0, vitesse, cible La Réunion, progression, statut ;
  - réticule qui se verrouille sur La Réunion ;
  - mots « Réseaux / Systèmes / Cybersécurité » qui traversent l'écran ;
  - phrase « Voici avec quoi *je travaille* » construite lettre par lettre.

  Tout est piloté par `gsap.ticker` et marche dans les deux sens.
- **Outils : toile holographique « façon Jarvis »** (`src/components/ToolsSection.tsx`, données dans `src/data/tools.tsx`, styles `.tools-*` / `.tool-card` dans `index.css`) :
  - les outils forment un **anneau 3D en CSS** (pas de three.js) posé au-dessus d'un socle de projecteur ;
  - on le fait pivoter en le glissant (souris ou doigt, même en attrapant une carte), avec le pavé tactile (deux doigts à l'horizontale), les flèches du clavier ou les boutons précédent / suivant ;
  - relâché, il garde son élan puis se cale sur la carte la plus proche ;
  - au repos, il tourne lentement. Il se met en pause hors écran, au survol d'une carte, au clavier, quand la fenêtre de détail est ouverte, ou avec le bouton pause (exigé par WCAG) ;
  - la carte de face est encadrée ; son nom se « décode » sous l'anneau (`scrambleText`) ; un panneau `SYS://TOOLKIT` affiche les compteurs et la rotation ;
  - **entrée « allumage de l'hologramme »** (une seule fois, quand le haut de l'anneau passe aux 3/4 de l'écran) : le socle s'allume, un faisceau monte, un balayage lumineux passe, les cartes s'allument du centre vers l'arrière en scintillant, pendant que l'anneau remonte des profondeurs en tournant ; les commandes arrivent en dernier (`boot()`, classes `.is-on` / `.is-scan`) ;
  - **les filtres gardent la roue entière** : les outils de la catégorie restent allumés, les autres s'estompent (`DIM`) et ne sont plus cliquables. La roue pivote vers le premier outil de la catégorie, avec un recul et un balayage. Ensuite, la rotation automatique passe d'un outil de la catégorie au suivant, et les flèches ne parcourent que ces outils (désactivées s'il n'y en a qu'un) ;
  - un clic ouvre la fenêtre de détail, mais un glissement ne l'ouvre pas : le glissement ne démarre qu'après 6 px, et le clic qui suit est bloqué ;
  - le rayon est calculé d'après la largeur réelle des cartes (`measure()`), donc les cartes voisines ne se chevauchent pas, quelle que soit la taille d'écran ;
  - les cartes sont centrées par leur marge, pas par `translate(-50%)` : leur axe de rotation doit être celui de l'anneau, sinon la carte de face est décalée ;
  - **grille simple** seulement si `prefers-reduced-motion` est activé.
- Bandeau défilant (après les outils), puis compétences en barres LED (données dans `src/data/profile.ts`).

### Contact
Fichiers : `src/pages/Contact.tsx`, `TrackLinks.tsx`, `ContactForm.tsx` et `fx/TopoLines.tsx`.
- Grands mots E-MAIL / LINKEDIN / GITHUB / CV, inspirés du menu de landonorris.com :
  - les lettres roulent au survol ;
  - un tracé orange se déroule **uniquement au survol ou au focus clavier** ;
  - l'adresse s'affiche en dessous, façon terminal.
- Fond en courbes de niveau qui se dessinent, et emblème du logo dans une bague graduée.
- **Formulaire de contact via FormSubmit** (`https://formsubmit.co/ajax/<email>`) :
  - piège anti-robots `_honey` ;
  - lien mailto pré-rempli en secours.
  - ⚠️ **À activer** : cliquer sur le lien « Activate Form » reçu par e-mail (envoyé le 18/09/2026). En attendant, le formulaire affiche une erreur avec le lien de secours.

### CV
Fichiers : `src/pages/Cv.tsx` et `src/data/cv.ts`.
- Version web du PDF (`public/mon-cv.pdf`), en français et en anglais.
- Bouton « Imprimer / enregistrer en PDF » : une page A4 blanche et propre (règles `@media print` en fin de `index.css`).
- Le téléphone est volontairement absent de la page web, pour éviter les robots. Il reste dans le PDF.
- Liens vers `/cv` : page À propos (« Voir mon CV ») et page Contact (mot « CV »).

### Jarvis
Fichiers : `src/pages/Chatbot.tsx` et `src/lib/jarvisContext.ts`.
- Avant : pas de date (il se croyait en 2024), adresse e-mail fausse (un seul tiret), seulement 4 projets.
- Maintenant, **le site envoie un message système à chaque question** avec :
  - la date et l'heure de La Réunion ;
  - l'année de BUT, calculée par `currentStudyYear()` (3e année en 2026-2027) ;
  - les contacts exacts ;
  - les compétences et les 23 outils ;
  - l'expérience tirée du CV ;
  - **les 12 projets lus en direct dans Supabase**.
- Vérifié : il répond « 2026, 3e année de BUT, f.girardot--lahogue@rt-iut.re ».
- Le code serveur `supabase/functions/cyberbot-chat/index.ts` est aussi corrigé (e-mail, date du jour), mais **n'est pas déployé** : il faut passer par Lovable. Ce n'est pas urgent, la correction côté site suffit.

### Verre liquide
Fichier : `src/components/fx/LiquidGlass.tsx`.
- Tout élément `.liquid` ou `[data-liquid]` reçoit un filtre SVG `feDisplacementMap` dans `backdrop-filter`. Sa carte de déplacement est **calculée pixel par pixel dans un canvas** (`displacementMap()`), d'après la taille et l'arrondi de l'élément :
  - profil de lentille convexe : forte courbure sur la tranche (`band`, `edgeShift`, puissance 2,4) ;
  - léger effet loupe au centre (`zoom`) ;
  - aberration chromatique (rouge, vert et bleu décalés).
- Sur **Chrome / Edge**, le fond est réellement réfracté, en direct. Le flou est presque nul (0,6 px).
- Ailleurs (Safari, Firefox), le verre est transparent, en CSS seul (flou de 1,5 px).
- Le verre est dessiné par la réfraction, un liseré brillant (`::before`, lumière en haut à gauche et rebond en bas à droite), un filet de lumière en haut, une lueur au bas (`--lg-caustic`) et une ombre portée. La teinte est presque nulle (`--lg-tint`).
- Un reflet suit la souris (`::after`, proportionnel à l'élément).
- La variante `.liquid-strong` reste plus teintée et plus floue, pour les étiquettes posées sur des images.
- Le profil de réfraction s'inspire du shader de [liquid-glass-js](https://github.com/dashersw/liquid-glass-js) (MIT). La bibliothèque elle-même n'est pas utilisée : elle réfracte une **capture figée** de la page (html2canvas), qui ne voit ni la planète WebGL, ni les animations, ni le défilement.

### Logo et favicon
- `src/components/Logo.tsx` : F penché sur un globe filaire relié en réseau. C'est l'emblème d'origine, redessiné en vectoriel. Les méridiens tournent et un paquet circule entre les nœuds.
- `public/favicon.svg` : même dessin, fixe.

### Autres pages
Projets, fiches projet, À propos, Jeux et 404 sont refaits dans le même style, avec la même logique qu'avant (hooks Supabase, admin, galeries, Canva).

---

## 6. Performance et statistiques

- **Premier chargement de l'accueil** : environ 207 Ko compressés, contre 220 Ko avant. La planète est chargée à part.
- **Découpage** : `vendor-react`, `vendor-motion` (GSAP + Lenis) et `vendor-i18n` sont des fichiers séparés, gardés en cache d'une version à l'autre. Une mise à jour ne fait retélécharger qu'environ 67 Ko.
- **Modules retirés** : les toasts Radix et le `TooltipProvider`, jamais utilisés.
- **Notifications Sonner** : elles suivent maintenant le thème du site (`ThemeContext`) au lieu de `next-themes`.
- **Images du jeu Guess the Building** : 22 fichiers en WebP (1 280 px max), soit 1,8 Mo au lieu de 2,5 Mo.
- **Statistiques** : `@vercel/analytics` est injecté en production (`src/main.tsx`), sans cookies.
  - ⚠️ **À activer** par Florian : projet Vercel `florian-portfolio-v2`, onglet Analytics, puis Enable. On peut aussi lancer `vercel project web-analytics enable florian-portfolio-v2` dans un terminal interactif.

---

## 7. Données partagées (source unique)

| Fichier | Contenu | Utilisé par |
| --- | --- | --- |
| `src/data/profile.ts` | Contacts, compétences, soft skills, années de BUT | Accueil, CV, Contact, Jarvis |
| `src/data/tools.tsx` | 23 outils (nom, icône, catégorie, description) | Section Outils, Jarvis |
| `src/data/cv.ts` | Contenu du CV en français et en anglais | Page CV |
| `src/i18n/config.ts` | Tous les textes FR/EN (`ui.*`, `home.dive.*`, `contact.form.*`, `cv.*`…) | Tout le site |

Pour modifier une compétence, un outil ou un contact, il suffit de le faire à un seul endroit : le site et Jarvis se mettent à jour ensemble.

---

## 8. Reste à faire / idées

- [ ] **Florian** : activer FormSubmit (lien « Activate Form » reçu par e-mail).
- [ ] **Florian** : activer Vercel Web Analytics.
- [ ] **Florian** : corriger le **PDF** du CV. L'adresse y est inversée (`f.lahogue--girardot@…` au lieu de `f.girardot--lahogue@…`) et la ligne « Analyse de la surface d'attaque… » y est en double.
- [ ] Faire relire, puis commiter et pousser les derniers changements sur `v2`.
- [ ] Optionnel : redéployer la fonction `cyberbot-chat` via Lovable.
- [ ] Optionnel : relier le projet Vercel v2 au dépôt GitHub v2 (déploiement automatique).
- [ ] Idées non faites :
  - vraie image de partage (`og:image`, qui pointe encore vers Lovable), `og:url`, `canonical`, `sitemap.xml` ;
  - PWA (`manifest.json`) ;
  - frise de parcours sur À propos ;
  - easter egg « console » ;
  - remplacer le menu de langue Radix par un simple bouton FR/EN (environ 35 Ko de moins).

---

## 9. Conventions de Florian (GitHub : JLFlo12)

- README en anglais (`README.md`) et en français (`README.fr.md`), avec lien 🇬🇧/🇫🇷 et badges shields.io, sans captures d'écran.
- Licence MIT au nom de « JLFlo12 ».
- Ne pas toucher à la bio ni aux liens du profil GitHub.
- **Toujours faire relire avant un commit ou un push.**
- Florian écrit en français. Les commentaires du code sont en français.
