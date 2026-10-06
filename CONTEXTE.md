# Contexte du projet : portfolio v2 (Florian GIRARDOT LAHOGUE)

Ce fichier résume tout le travail fait sur la refonte du portfolio, les décisions prises et ce qu'il faut savoir pour continuer. Dernière mise à jour : 18 septembre 2026.

---

## 1. En bref

| | |
| --- | --- |
| **Site v2 (en ligne)** | https://www.florianlh.fr (et https://florian-portfolio-v2.vercel.app) |
| **Dépôt v2 (public)** | https://github.com/JLFlo12/florian-portfolio-v2 |
| **Ancien site (inchangé)** | https://florian-portfolio-zeta.vercel.app |
| **Ancien dépôt (inchangé)** | https://github.com/JLFlo12/florian-portfolio |
| **Dossier local** | `PorteFolio/`, branche `refonte-moderne` |
| **Stack** | React 18 + TypeScript + Vite 5, Tailwind + shadcn/ui, GSAP + Lenis, three.js + React Three Fiber, i18next (FR/EN), Supabase |

La v2 est une **refonte complète** du portfolio d'origine, qui avait été généré avec Lovable. Le style s'inspire du site AMIGOS (`BUT 3/SiteWeb`), ambiance « pilote de F1 / HUD futuriste ». **Tout le contenu d'origine est conservé** : textes, outils (23 à l'origine, 42 depuis le 06/10/2026), compétences, 12 projets Supabase, mode admin, Jarvis, 5 mini-jeux, FR/EN, thème clair/sombre.

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
- **Nom de domaine `florianlh.fr`** (acheté chez OVH, DNS chez OVH) : ajouté au projet le 05/10/2026. `www.florianlh.fr` est l'adresse principale, `florianlh.fr` y redirige (308). Zone OVH : `A @ → 76.76.21.21` et `CNAME www → cname.vercel-dns.com.` ; les anciens A/AAAA d'OVH (51.91.236.255, 2001:41d0:301::29) et le TXT `1|www.florianlh.fr` doivent être supprimés. Les MX/SPF d'OVH restent.
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
- **À éviter (Florian, 06/10/2026)** : panneaux façon HUD (« SYS://… », statut, coordonnées, rotation), surtitres « // —— / … », indicateur « FLORIAN.SYS / … », pastille « ● En ligne » : « trop IA ». Ils ont été retirés de l'accueil, de la section Outils, de la page Contact et de l'indicateur de défilement. Préférer du texte simple et des touches faites à la main.
- **Classes utiles** (`src/index.css`) : `container-x`, `section-y`, `display-xl`, `title-xl`, `serif-accent`, `label-mono`, `led`, `eyebrow`, `hud-frame`, `hud-panel`, `panel`, `btn-neon`, `btn-ghost`, `chip`, `liquid`, `liquid-strong`, `field`, `field__input`, `email-text`, `cv-*`, `track-*`, `dive-*`, `tools-*`, `tool-node`, `holo-*`, `jarvis-orb`.
- **Animations** (`src/lib/motion.tsx`) :
  - attributs `data-reveal`, `data-stagger` (dont `flip`), `data-band`, `data-rule` et `data-count`, activés par `useReveal(ref)` ;
  - **`data-band` : bande de couleur façon landonorris.com.** Sur chaque ligne, une bande orange arrive de la gauche, couvre la ligne, puis se retire vers la droite en laissant le texte derrière elle. La valeur de l'attribut est un délai en secondes (ex. `data-band="0.35"`). Elle sert aux titres (`AccentTitle`, prop `band`), aux surtitres, aux intros de section, à la phrase d'intro d'À propos et aux sous-titres ;
  - les lignes sont mesurées au moment de l'animation (`Range.getClientRects`), sans découper le texte, pour que React garde la main dessus (le changement de langue marche toujours). Le texte reste caché (`visibility`) jusqu'à ce que toutes ses lignes soient couvertes ;
  - une bande lancée n'est ni coupée ni rejouée quand la page relance ses animations (ex. projets chargés depuis Supabase) : `gsap.context().ignore()` et le `WeakSet` `banded` ;
  - aussi `magnetic()`, `scrambleText()` (annule l'appel précédent sur le même élément) et `AccentTitle`.
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
  - l'indicateur de défilement (bas gauche, grand écran) : un trait fin et le pourcentage, rien d'autre ;
  - le grain (le curseur est celui du système : Florian ne veut pas de curseur personnalisé).
- `src/components/fx/Preloader.tsx` : écran de chargement **dessiné à la main** (06/10/2026, d'après une référence envoyée par Florian) : croquis de la planète à anneau (trait de la couleur du texte, hachures, point orange sur La Réunion, deux étoiles) et « CHARGEMENT » en capitales tracées à la main (`GLYPHS`). Tout est généré en code avec une graine fixe : le dessin se trace (`pathLength` + `stroke-dashoffset`), puis trois versions légèrement différentes alternent toutes les 140 ms (`.loader__frame`, effet « trait qui bout »). Une fois la page prête (polices chargées, 1,6 s minimum, 0,35 s si déjà vu dans la session), le mot s'efface et l'écran s'ouvre en cercle **depuis le centre de la planète** (`--hx` / `--hy`), avec un liseré orange. Il envoie le signal `markReady()` (`src/lib/ready.ts`). Avant : trois points en orbite.
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

  - sous la phrase, **Jarvis tape un message** (« Accès autorisé. 42 outils chargés, 10 catégories… »), avec un curseur plein. Les chiffres sont calculés depuis `tools.tsx` ;
  - un **cercle se dessine autour de « Défile »** (flèche qui oscille).

  Tout est piloté par `gsap.ticker` et marche dans les deux sens.
- **Manifeste** (`src/components/Manifesto.tsx`, en haut de la section Outils), façon landonorris.com :
  - logo, puis « BUT R&T · Cyber · depuis 2024 », puis une grande phrase centrée en capitales ;
  - les mots d'accent sont en italique orange. Dans la traduction (`home.manifesto`), `*mot*` marque un mot d'accent ;
  - les mots s'allument un à un au fil du défilement (ScrollTrigger `scrub`) ;
  - **astronaute qui tombe** derrière le texte, à droite (`src/components/fx/Astronaut.tsx`, styles `.astronaut` dans `index.css`), demandé par Florian d'après une photo qu'il a envoyée : pendant que le manifeste traverse l'écran, il tombe depuis le haut en tournant, apparaît en fondu, puis rapetisse et s'efface avant le bas ; à l'arrêt, il flotte (animation CSS). Petit (72 à 130 px de large) et **chute lente**, à la demande de Florian : elle dure le passage du manifeste plus 1,5 hauteur d'écran (`RANGE`) et ne descend qu'aux 3/4 de l'écran (`LAND`), il s'efface vers les 2/3 ;
  - **la chute ne revient jamais en arrière** (Florian trouvait bizarre de la voir rejouée à l'envers en remontant) : timeline en pause, avancée jusqu'à la plus grande progression atteinte (amortie comme un scrub) ; en remontant, il reste où il en est, porté par la page ; elle repart de zéro quand la zone repasse sous l'écran (`onLeaveBack`). Opacité nulle aux deux bouts de la chute, donc invisible avant et après. `onRefresh` recalcule la trajectoire au même point. Mode clair : `mix-blend-mode: multiply`. Animations réduites : pas d'astronaute ;
  - image `public/astronaut.webp` (300 × 461, 28 Ko) : photo de Florian détourée (fond noir et étoiles retirés, silhouette pleine, bord sombre épluché). **Origine et licence de la photo non vérifiées** ;
  - ⚠️ l'effet est en `useEffect`, pas `useLayoutEffect` : la ref de la zone (posée par le parent) n'existe pas encore quand les effets « layout » des enfants s'exécutent.
- **Outils : hologramme façon Jarvis, outils en orbite autour du socle** (06/10/2026, `src/components/ToolsSection.tsx`, données dans `src/data/tools.tsx`, styles `.tools-*`, `.tool-node`, `.holo-*` dans `index.css`). Avant : un anneau 3D de grandes cartes au-dessus du socle ; Florian voulait les outils **autour du halo orange** et un hologramme dans le style de l'interface Jarvis des films :
  - le **socle orange** (ellipse aplatie, rapport 0,309 = sin 18°) projette un **faisceau** et un **hologramme** en SVG : couronne graduée, anneau pointillé, arcs épais et fins, bobine, chacun tournant à sa vitesse (`.holo-spin`, `--t`), lignes de balayage, léger scintillement. Au centre, **l'icône de l'outil de face** (rejouée à chaque changement) ;
  - les 42 outils sont des **pastilles rondes** (icône dans un cercle à anneau pointillé) **en orbite autour du socle**. L'orbite est projetée en JS dans `render()` : position sur l'ellipse, taille et fondu selon la profondeur, `z-index` = 1000 + profondeur. L'hologramme est à 1000 : les pastilles passent devant ou derrière lui. Rayon = celui du socle (`measure()`, 410 px au plus, `--orbit-r`) ;
  - l'outil de face est plus grand et lumineux, avec un arc qui tourne autour ; le nom d'une pastille s'affiche au survol ; le nom de l'outil de face se « décode » dans le panneau du bas (`scrambleText`), **centré sous la pastille de face** (le bouton pause est posé à droite hors du flux, dans la consigne sur mobile) ;
  - on fait tourner l'orbite en la glissant (souris ou doigt), au pavé tactile, aux flèches du clavier ou avec précédent / suivant ; relâchée, elle garde son élan puis se cale sur l'outil le plus proche ; au repos, elle tourne lentement (pause hors écran, au survol, au clavier, fenêtre ouverte, ou bouton pause exigé par WCAG) ;
  - **entrée** (une fois, quand la scène arrive aux 3/4 de l'écran) : le socle s'allume, le faisceau monte, l'hologramme s'allume en scintillant, les pastilles s'allument de l'avant vers l'arrière pendant que l'orbite se déploie depuis le centre en tournant ; les commandes arrivent en dernier (`boot()`, `.is-on` / `.is-scan`) ;
  - **les filtres gardent l'orbite entière** : les outils de la catégorie restent allumés, les autres s'estompent (`DIM`) et ne sont plus cliquables ; l'orbite respire, un balayage passe et elle tourne vers le premier outil de la catégorie, puis passe d'un outil de la catégorie au suivant ;
  - un clic ouvre la fenêtre de détail, mais un glissement ne l'ouvre pas (le glissement ne démarre qu'après 6 px, le clic qui suit est bloqué) ;
  - le panneau `SYS://TOOLKIT` a été retiré le 06/10/2026 (« trop IA ») ;
  - **grille simple** seulement si `prefers-reduced-motion` est activé.
- **Bande de projets 3D** (après les outils), inspirée de jesperlandberg.com, à la place de l'ancien bandeau défilant :
  - `src/components/ProjectBand.tsx` garde la place (hauteur fixe) et ne charge `ProjectBandBody.tsx` (projets Supabase) puis `three/ribbon.ts` qu'à l'approche : Supabase reste hors du premier chargement de l'accueil (≈ 77 Ko compressés pour le fichier principal) ;
  - les 12 projets Supabase forment un ruban de cartes qui ondule en profondeur (three.js seul, chargé quand la bande approche) ; pas de grille au sol, Florian l'a fait retirer ;
  - chaque carte est dessinée dans un canvas 2D (image du projet ou couverture générée, numéro LED, mots-clés, titre, bouton flèche) puis envoyée en texture ; coins arrondis et ombrage dans le shader ;
  - la bande avance avec le défilement de la page, se glisse à la souris ou au doigt (avec élan), une carte survolée avance ; un clic ouvre `/projects/dynamic-<id>` ; compteur `01 / 12` de la carte au centre ;
  - **cartes unies + liquide** (souris seulement, idée reprise de bleibtgleich.dev) : au repos, les cartes sont unies avec leur texte (titre, mots-clés, numéro, flèche) : noires en mode sombre, blanches à texte foncé en mode clair (couleurs `DARK` / `LIGHT` dans `ribbon.ts` ; `setLight()` redessine les textures au changement de thème, sans recréer la scène). Sur la carte survolée, et seulement elle, la souris laisse des gouttes de liquide qui montrent l'image telle quelle, sans la déformer (bord net, bord un peu plus sombre), puis s'évaporent en ~2 s. Retirés à la demande de Florian : un effet loupe (image déformée), puis le reflet blanc du liquide.
    - `three/fluid.ts` : petite simulation de fluide sur GPU (« stable fluids ») dans les coordonnées de la carte, réglée en liquide épais (peu de tourbillons) avec une petite zone autour de la souris ; `ribbon.ts` en garde trois, prêtées tour à tour aux cartes survolées (la moins récemment utilisée est vidée et réattribuée, une simulation inactive depuis 4 s est libérée) ;
    - chaque carte a deux textures (image et version unie) ; sur une image, le texte reste clair sur un dégradé sombre dans les deux thèmes ; en mode clair, les projets sans image ont une couverture claire (fond papier, lueur orange, mot-clé foncé), et dans la rangée de repli aussi ; sur écran tactile, images visibles et pas de liquide ;
    - essais refusés par Florian : flou, puis fluide en fumée sur tout le canvas (toutes les cartes à la fois, zone trop grande).
  - **effet caoutchouc** : la déformation suit la vitesse (glisser, élan, défilement) avec un ressort peu amorti : le milieu des cartes traîne derrière leurs bords, se creuse, la vague s'amplifie, puis tout revient en oscillant ;
  - sans WebGL ou avec les animations réduites : une rangée de cartes HTML qui défile au doigt ;
  - ⚠️ ne pas nommer une classe `.band` : ce nom est pris par les bandes de couleur de `bandReveal` (`transform: scaleX(0)`).
- Puis compétences en barres LED (données dans `src/data/profile.ts`). Sur grand écran, les deux colonnes partagent les lignes de la grille (`grid-rows-subgrid`) : les listes commencent à la même hauteur et leurs lignes s'alignent, même si « Compétences techniques » tient sur deux lignes et « Soft skills » sur une (demandé par Florian).
  - **fin du voyage de l'astronaute** (`src/components/fx/SpaceDrift.tsx`, styles `.astronaut--drift` et `.starfield`), d'après un croquis de Florian : quand le titre « Mes compétences » arrive à l'écran, l'astronaute apparaît dans la marge à gauche du titre, puis le traverse très lentement (60 s, aller-retour sans fin) en ondulant **derrière les lettres** (l'en-tête `z-[1]` passe devant) : caché par les lettres, visible entre elles et entre les mots, la tête qui dépasse en haut de la vague ; arrivée juste après la fin du texte (mesurée avec un `Range` sur le contenu du h2). Il tourne sur lui-même (un tour en 200 s). Tout petit (28 à 40 px), un peu transparent, à peine balancé : Florian ne veut pas qu'il attire l'œil au premier regard. Chemin calculé d'après la mise en page (`offsetTop`/`offsetLeft`, recalculé au redimensionnement, à l'arrivée et à chaque `ScrollTrigger.refresh()`) ; sans marge assez large, il part du bord du titre. En pause quand la section est hors de l'écran ;
  - derrière, un **champ d'étoiles discret** (canvas) qui dérive très lentement vers la gauche et défile un peu moins vite que la page, avec un léger scintillement et quelques étoiles à halo. Il ne remplit pas la section : masque en ovale centré sur le titre (variables `--sky-y` / `--sky-ry` posées par le composant), croisé (`mask-composite: intersect`) avec un fondu en haut pour ne pas marquer la limite avec la bande de projets. Couleur du texte du thème, plus discrète en mode clair (couleur choisie d'après le thème et pas relue dans les variables CSS : la classe `dark` change après les effets des composants enfants) ;
  - animations réduites : astronaute immobile à gauche du titre, étoiles fixes.

### Contact
Fichiers : `src/pages/Contact.tsx`, `TrackLinks.tsx`, `ContactForm.tsx` et `fx/TopoLines.tsx`.
- Grands mots E-MAIL / LINKEDIN / GITHUB / CV, inspirés du menu de landonorris.com :
  - les lettres roulent au survol ;
  - un tracé orange se déroule **uniquement au survol ou au focus clavier** ;
  - l'adresse s'affiche en dessous, façon terminal.
- Fond en courbes de niveau qui se dessinent, et emblème du logo dans une bague graduée. Les courbes s'effacent en fondu vers le bas de la section (`.topo` : `mask-image`) : la section les coupait net au-dessus de la carte « Prêt à collaborer ? », remarqué par Florian.
- **Formulaire de contact via FormSubmit** (`https://formsubmit.co/ajax/<email>`) :
  - piège anti-robots `_honey` ;
  - lien mailto pré-rempli en secours.
  - ⚠️ **À activer** : cliquer sur le lien « Activate Form » reçu par e-mail (envoyé le 18/09/2026). En attendant, le formulaire affiche une erreur avec le lien de secours.

### CV
Fichiers : `src/pages/Cv.tsx` et `src/data/cv.ts`.
- Version web du PDF (`public/mon-cv.pdf`), en français et en anglais.
- Bouton « Imprimer / enregistrer en PDF » : une page A4 blanche et propre (règles `@media print` en fin de `index.css`).
  - Depuis le 06/10/2026, le bloc « Outils » (8 lignes) est dans la colonne principale, et l'impression est réduite de 10 % (`zoom: .9` sur `.cv-sheet`) : tout tient sur une page.
  - ⚠️ La règle d'impression masque `header:not(.cv-head)` : un simple `header` masquait aussi l'en-tête du CV, et le nom n'était plus imprimé.
  - Le PDF original (`public/mon-cv.pdf`) n'a pas les nouveaux outils : à refaire par Florian.
- Le téléphone est volontairement absent de la page web, pour éviter les robots. Il reste dans le PDF.
- Liens vers `/cv` : page À propos (« Voir mon CV ») et page Contact (mot « CV »).

### Jarvis
Fichiers : `src/pages/Chatbot.tsx`, `src/lib/jarvisContext.ts`, `src/components/fx/JarvisOrb.tsx` et `src/lib/voice.ts`.
- **Page centrée sur Jarvis** (06/10/2026) : la sphère au centre, puis le titre « JARVIS », le sous-titre et une ligne d'état (« Touchez Jarvis ou le micro pour lui parler », « Je vous écoute… », « Jarvis réfléchit… », « Jarvis répond… », annoncée aux lecteurs d'écran), puis la discussion. Le surtitre « AI —— / jarvis » et l'icône robot de l'accueil ont été retirés (la sphère représente Jarvis).
- **Sphère de Jarvis** (d'après sa sphère holographique dans *L'Ère d'Ultron*, image envoyée par Florian) : un canvas 2D avec environ 1 300 éclats orange et dorés (un tiers de petits traits, un sur sept bleu) sur une sphère qui tourne, des anneaux pointillés et un cœur lumineux. **Pas d'éclairs autour** : Florian les trouvait en trop, ils ont été retirés.
  - **Au repos**, elle respire doucement. **À l'écoute** (micro), elle s'éclaire et un anneau ondule autour d'elle. **Quand Jarvis réfléchit** (avant le premier mot), elle tourne plus vite.
  - **Quand il répond** (texte ou voix), elle bat **doucement** comme un cœur (« poum-poum », toutes les 0,8 s) : les éclats s'écartent un peu et une onde légère part. Les pulsations ont été adoucies à la demande de Florian (amplitude divisée par deux, battement plus ample dans le temps).
  - **Thème sombre** : mélange additif (lumière). **Thème clair** : couleurs plus soutenues, sans mélange additif, directement sur le fond clair. Le thème est relu à chaque image (bascule sans rechargement).
  - L'état (`orbMode`) vient de l'écoute, de `isLoading`, du dernier message et de la voix en cours. Elle est en pause hors écran et devient une image fixe si les animations sont réduites.
- **Chat vocal** (`src/lib/voice.ts`, Web Speech API du navigateur, sans service ajouté) :
  - **parler** : toucher la sphère ou le bouton micro. La question s'écrit en direct dans le champ, puis part toute seule ; toucher de nouveau termine et envoie. La reconnaissance est dans Chrome, Edge et Safari ; Firefox ne l'a pas, donc le micro y est masqué ;
  - **voix de Jarvis** : une question posée à voix haute reçoit une réponse à voix haute, **phrase par phrase au fil de l'arrivée du texte**. Le Markdown, les liens, le code et les emojis sont retirés. Voix de la langue du site, de préférence « naturelle » et masculine ;
  - **conversation** : après une réponse dite à voix haute, le micro se rouvre ; un silence (rien de compris) l'arrête, et taper au clavier aussi ;
  - **bouton haut-parleur** (à gauche du champ) : coupe ou remet la voix, ce qui arrête aussitôt Jarvis. Le choix est mémorisé (`localStorage` `florian-jarvis-voice`, activée par défaut) ;
  - la page **Mentions légales / confidentialité** explique où va le son : Chrome et Edge l'envoient à Google ou Microsoft, Safari à Apple. Seul le texte reconnu est envoyé à Jarvis.
  - Vérifié avec un micro, une voix et une réponse factices (dans le navigateur de test seulement) : écoute, question envoyée (« Qui est Florian ? »), réflexion, réponse dite en deux phrases sans Markdown ni emoji, micro rouvert puis arrêté par le silence, voix coupée mémorisée.
- Avant : pas de date (il se croyait en 2024), adresse e-mail fausse (un seul tiret), seulement 4 projets.
- Maintenant, **le site envoie un message système à chaque question** avec :
  - la date et l'heure de La Réunion ;
  - l'année de BUT, calculée par `currentStudyYear()` (3e année en 2026-2027) ;
  - les contacts exacts ;
  - les compétences et les 42 outils ;
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

### Musique d'ambiance
Fichiers : `src/lib/ambient.ts` et `src/components/SoundToggle.tsx` (bouton dans les réglages de l'en-tête et du menu mobile).
- **Générée en direct avec Web Audio** : aucun fichier audio, rien à télécharger, pas de droits d'auteur.
- Nappes douces en accords de 9e (ré, si mineur, sol, la), basse ronde, notes de cloche espacées avec écho, réverbération. Environ -26 dB en moyenne, fondu d'entrée de 5 s.
- Les navigateurs bloquent le son avant une interaction : la musique démarre au premier clic ou à la première touche. Le bouton (barres d'égaliseur) la coupe ou la relance, et le choix est mémorisé (`localStorage` `florian-sound`).
- Pause automatique quand l'onglet est caché.
- Inspiré des boutons son de lisa.locomotive.ca et why.zero.university.

### Logo et favicon
- `src/components/Logo.tsx` : F penché sur un globe filaire relié en réseau. C'est l'emblème d'origine, redessiné en vectoriel. Les méridiens tournent et un paquet circule entre les nœuds.
- `public/favicon.svg` : même dessin, fixe.

### Sakura (pages Jeux et Contact)
Fichier : `src/components/fx/Sakura.tsx`, styles `.sakura-*` / `.sk-*` dans `index.css`, couleurs `--sakura-*` (clair et sombre).
- Une branche de cerisier en fleurs sort du bord droit, sous l'en-tête. Elle est générée avec une graine fixe (toujours la même), dessinée en SVG, pousse à l'arrivée (fleurs qui éclosent), puis se balance doucement. Chaque fleur frémit en plus au vent, à son propre rythme (`sk-flutter`, propriétés `rotate` / `translate` : elles s'ajoutent à l'éclosion et au frisson au survol, qui utilisent `transform`).
- Des pétales tombent sur tout l'écran (canvas fixe) : ils tournoient et se retournent, suivent le vent (rafales avec traînées), s'écartent de la souris et suivent un peu le défilement.
- Frôler une fleur avec la souris la fait frissonner et lâcher des pétales.
- Pendant une partie : pétales derrière le jeu, moins nombreux, branche estompée.
- ⚠️ Les classes des couleurs (`sk-c0/1/2`) sont écrites en entier dans le code (`TINTS`) : Tailwind supprime les classes qu'il ne trouve pas écrites telles quelles.

### Page projet
Fichier : `src/pages/ProjectGallery.tsx` (styles `.case-*` dans `index.css`). Une seule mise en page pour tous les projets (Supabase et anciens projets locaux de `projectGalleries.ts`), façon étude de cas :
- barre du haut : retour, position `04 / 12`, projet précédent / suivant, bouton admin (cadenas) ;
- en-tête : statut, grand titre (taille selon la longueur), fiche technique (statut, domaine, support : « Présentation Canva / Gamma » détecté depuis l'adresse, ou nombre de rubriques) ;
- couverture 21:9 en parallaxe (image du projet, ou couverture générée avec le premier mot-clé) avec coins HUD ;
- « À propos » (libellé collant à gauche, description en grand, mots-clés), puis sections numérotées selon le contenu : présentation intégrée dans un cadre d'écran, rubriques en deux colonnes (emojis retirés des titres et des listes), fichiers, galerie (première image en grand) ;
- en bas, le projet suivant en très grand. Le mode admin (édition de la galerie) est conservé.
- ⚠️ **Gamma** : seule l'adresse `gamma.app/embed/<id>` peut s'afficher dans une iframe sur un autre site (`frame-ancestors *`) ; les pages `gamma.app/docs/…` l'interdisent (`frame-ancestors 'self'`). `slidesOf()` convertit donc les liens Gamma. Canva : `…/view?embed`, la présentation doit être partagée en lecture publique.
- Tous les projets sont au statut « Terminé » depuis le 04/10/2026 (Le Voyage de Torii était « En cours »).

### Mentions légales et confidentialité
Fichiers : `src/pages/Legal.tsx` (routes `/mentions-legales` et `/legal`), contenu FR/EN dans `src/data/legal.ts`, lien dans le pied de page.
- Éditeur (Florian, particulier, contact e-mail), hébergeur Vercel Inc. (440 N Barranca Avenue #4133, Covina, CA 91723, USA), Supabase pour les projets, crédits (polices SIL OFL, photo UniFi CC0, Unsplash).
- Données : formulaire via FormSubmit (Devro LABS), conservation 12 mois au plus ; Jarvis via la passerelle IA de Lovable (Google Gemini), conversations non conservées ; Vercel Web Analytics sans cookie ; stockage local limité aux préférences.
- **Présentations Canva / Gamma chargées seulement après un clic** (`SlidesEmbed` dans la page projet) : ces services déposent leurs propres cookies. Le choix est retenu par service dans `localStorage` (`florian-embeds`) et se réinitialise depuis la page Mentions légales.
- ⚠️ À mettre à jour si le site ajoute un service (statistiques, formulaire, contenu intégré…).

### Autres pages
Projets, fiches projet, À propos, Jeux et 404 sont refaits dans le même style, avec la même logique qu'avant (hooks Supabase, admin, galeries, Canva).
- **À propos** (`src/pages/About.tsx`, textes `about.*`) : 01 Formation, 02 Expérience (stage en informatique à l'ESIROI, 2e année de BUT, ajouté le 05/10 à la demande de Florian ; sans le point « en cours » qui clignote, puisque le stage est fini), 03 Expertise, 04 CV.

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
| `src/data/tools.tsx` | 42 outils (nom, icône, catégorie, description) | Section Outils, Jarvis |
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
