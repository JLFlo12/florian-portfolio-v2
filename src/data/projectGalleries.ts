
// Configuration facile pour modifier les images des projets
// Il suffit de modifier les URLs ici pour changer les images affichées

export interface ProjectImage {
  id: string;
  url: string;
  title: string;
  description?: string;
}

export interface ProjectFile {
  id: string;
  url: string;
  title: string;
  description?: string;
  type: 'html' | 'css' | 'js' | 'image';
}

export interface ProjectDetail {
  section: string;
  content: string[];
}

export interface ProjectGallery {
  projectId: string;
  projectTitle: string;
  images: ProjectImage[];
  files?: ProjectFile[];
  details?: ProjectDetail[];
}

export const projectGalleries: ProjectGallery[] = [
  {
    projectId: 'the-forgotten-survival-horror',
    projectTitle: 'The Forgotten - Survival Horror',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop',
        title: 'Ambiance forestière',
        description: 'Forêt brumeuse et oppressante - années 80'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop',
        title: 'Camp militaire abandonné',
        description: 'Exploration du campement militaire désert'
      },
      {
        id: '3',
        url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&h=600&fit=crop',
        title: 'Système de lumière',
        description: 'Lampe à huile et torche - gameplay central'
      }
    ],
    details: [
      {
        section: '📋 Informations générales',
        content: [
          '🎮 Titre de travail : "The Forgotten"',
          '🎯 Genre : Aventure / Survival Horror',
          '👁️ Perspective : Troisième personne',
          '⚙️ Moteur de jeu : Unreal Engine 5',
          '💻 Plateforme cible : PC (Windows)',
          '🎨 Style visuel : Réalisme — Années 80, ambiance nocturne et brumeuse',
          '⏱️ Durée de développement : 10 mois',
          '👥 Équipe : 3 personnes',
          '🎯 Objectif : Créer un jeu complet et jouable (non commercialisé)'
        ]
      },
      {
        section: '📖 Concept du jeu - Pitch',
        content: [
          '🎭 Le joueur incarne un homme d\'une quarantaine d\'années venu dans une ville désertée à la suite d\'une crise économique.',
          '🌲 En explorant une vaste forêt et un ancien camp militaire, il tente de retrouver son frère disparu avec son escadron.',
          '🌫️ L\'univers est oppressant, plongé dans le brouillard et la nuit.',
          '👻 Le joueur est poursuivi par un monstre principal intuable et doit survivre en explorant, se cachant et combattant des créatures secondaires.'
        ]
      },
      {
        section: '🎮 Caractéristiques principales',
        content: [
          '🗺️ Monde semi-ouvert (forêt, maisons, campement militaire)',
          '🌙 Ambiance années 80, nocturne, réaliste et brumeuse',
          '🔦 Système de lumière (lampe à huile, torche) influant sur la visibilité',
          '⚔️ Combat au corps à corps uniquement (armes improvisées)',
          '👹 Ennemi principal invincible, poursuivant le joueur en continu',
          '🧟 Petits monstres destructibles',
          '🎒 Exploration, collecte d\'objets et gestion d\'inventaire simple',
          '😨 Thématique : isolement, peur, survie et perte'
        ]
      },
      {
        section: '🎯 Objectifs de production',
        content: [
          '✅ Concevoir un prototype complet, stable et jouable sous Unreal Engine 5',
          '🎭 Créer une expérience immersive reposant sur l\'atmosphère et la tension psychologique',
          '🎨 Garantir une cohérence visuelle et sonore avec des moyens limités (assets gratuits / low-cost)',
          '⚡ Optimiser pour un fonctionnement fluide sur PC milieu de gamme'
        ]
      },
      {
        section: '📅 Phase 1 — Pré-production (Mois 1-2)',
        content: [
          '🎯 Objectif : définir le cadre du projet et poser les bases techniques',
          '📝 Rédaction du Game Design Document (GDD) : concept narratif, gameplay, univers, mécaniques',
          '📋 Description des systèmes (combat, lumière, IA, inventaire)',
          '🗺️ Schéma de la carte et des zones clés',
          '🎨 Constitution d\'un moodboard visuel et sonore',
          '⚙️ Préparation du projet Unreal Engine 5 (paramètres, architecture de dossiers)',
          '🧪 Réalisation d\'un prototype basique : personnage, caméra, terrain test',
          '📦 Identification des assets disponibles (Unreal Marketplace, Megascans, Sketchfab)',
          '✅ Livrable : prototype de base fonctionnel'
        ]
      },
      {
        section: '🎮 Phase 2 — Prototype jouable (Mois 3-4)',
        content: [
          '🎯 Objectif : construire le cœur du gameplay',
          '⚔️ Implémentation du système de combat au corps à corps',
          '💡 Développement de la gestion de lumière (torche, lampe à huile, durée de vie)',
          '🎒 Création d\'un inventaire minimaliste',
          '🤖 Développement IA Monstre principal (traque, détection sonore et visuelle)',
          '👾 Développement IA Petits ennemis (patrouille, poursuite, attaque, mort)',
          '🌲 Création d\'un terrain prototype : forêt et bâtiments de test',
          '🔄 Test de la boucle de gameplay (exploration, collecte, fuite, combat)',
          '✅ Livrable : version jouable du cœur du jeu (alpha préliminaire)'
        ]
      },
      {
        section: '🏗️ Phase 3 — Production (Mois 5-7)',
        content: [
          '🎯 Objectif : construire le contenu principal du jeu',
          '🗺️ Construction du monde semi-ouvert : topographie, chemins, maisons, campement militaire',
          '🌳 Intégration d\'assets réalistes (environnement, végétation, éclairage)',
          '🏚️ Ajout de zones explorables, de caches et de ressources',
          '📖 Développement de la narration environnementale (indices, objets interactifs, journaux)',
          '🎵 Intégration de la bande-son et des effets audio d\'ambiance',
          '🎯 Création de la quête principale et des objectifs secondaires',
          '✅ Livrable : version Alpha complète (toutes mécaniques présentes, sans optimisation)'
        ]
      },
      {
        section: '⚡ Phase 4 — Optimisation et tests (Mois 8-9)',
        content: [
          '🎯 Objectif : stabiliser, équilibrer et peaufiner le jeu',
          '🚀 Optimisation graphique et performances (LOD, occlusion, lumière dynamique)',
          '🐛 Correction des bugs de collisions, IA et interface',
          '⚖️ Ajustement de la difficulté, de la vitesse du joueur et du comportement des ennemis',
          '🌫️ Amélioration du rendu atmosphérique (brouillard, lumière volumétrique, pluie éventuelle)',
          '🧪 Sessions de test internes et externes (feedback de joueurs tests)',
          '✅ Livrable : version Beta stable et jouable'
        ]
      },
      {
        section: '✅ Phase 5 — Finalisation (Mois 10)',
        content: [
          '🎯 Objectif : livrer une version finale jouable',
          '🎮 Intégration du menu principal, des options et de l\'écran de fin',
          '🐛 Correction des derniers bugs critiques',
          '🎬 Ajout du générique et des crédits',
          '💻 Compilation et tests finaux sur plusieurs machines',
          '🎥 Préparation d\'une courte vidéo de démonstration',
          '✅ Livrable : version finale stable (jeu complet jouable sur PC)'
        ]
      },
      {
        section: '📊 Rétroplanning synthétique',
        content: [
          '📅 Mois 1 : Pré-production — Rédaction GDD, moodboard, config UE5, terrain test',
          '📅 Mois 2 : Pré-production (suite) — Finalisation GDD, plan technique, tests gameplay',
          '📅 Mois 3 : Prototype — Combat corps à corps, gestion lumière, inventaire, début IA monstre',
          '📅 Mois 4 : Prototype (suite) — IA petits monstres, boucle gameplay, map test jouable',
          '📅 Mois 5 : Production — Level design (forêt, camp militaire, maisons), assets réalistes',
          '📅 Mois 6 : Production (suite) — Éléments narratifs, sound design, tests atmosphère',
          '📅 Mois 7 : Production (fin) — Finalisation carte, ajustements rythme, quête principale',
          '📅 Mois 8 : Optimisation — Graphismes, lumière, IA, correction bugs majeurs',
          '📅 Mois 9 : Tests — Playtests internes/externes, collecte feedback, équilibrage',
          '📅 Mois 10 : Finalisation — Menu principal, derniers bugs, générique, build final'
        ]
      },
      {
        section: '🛠️ Outils et ressources',
        content: [
          '⚙️ Moteur : Unreal Engine 5.3+',
          '📋 Gestion de projet : Notion / Trello',
          '🔄 Versioning : GitHub ou Perforce',
          '🎨 Assets : Unreal Marketplace, Quixel Megascans, Sketchfab (gratuits ou libres de droits)',
          '🎵 Audio : Freesound.org, Sonniss Game Audio Bundle',
          '📝 Documentation : Google Docs / Notion (GDD, suivi technique, bug list)',
          '🧪 Tests : Builds mensuels, sessions de test externes dès le mois 8'
        ]
      },
      {
        section: '⚠️ Risques et contraintes',
        content: [
          '🔴 Manque de temps (Impact élevé) → Solution : Réduire la taille de la carte et le nombre d\'ennemis',
          '🟠 Performance Unreal (Impact moyen) → Solution : Optimiser textures et éclairages dynamiques',
          '🟠 Manque d\'assets réalistes (Impact moyen) → Solution : Utiliser des packs gratuits / Megascans',
          '🔴 Travail en équipe réduite (Impact élevé) → Solution : Prioriser les systèmes clés et éviter les fonctions secondaires'
        ]
      },
      {
        section: '🎯 Livrable final attendu',
        content: [
          '✅ Jeu complet et jouable sur PC',
          '⏱️ Durée de jeu estimée : 30 à 60 minutes',
          '🎭 Ambiance immersive, cohérente et stable',
          '💻 Build final compilé et testé sous Windows'
        ]
      }
    ]
  },
  {
    projectId: 'hygiene-cybersecurite',
    projectTitle: 'Hygiène et cybersécurité',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
        title: 'Configuration antivirus',
        description: 'Mise en place des solutions de sécurité'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop',
        title: 'Analyse des menaces',
        description: 'Étude des vulnérabilités système'
      },
      {
        id: '3',
        url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=600&fit=crop',
        title: 'Formation utilisateurs',
        description: 'Sensibilisation aux bonnes pratiques'
      }
    ]
  },
  {
    projectId: 'raspberry-pi-led',
    projectTitle: 'Pilotage de LED avec Raspberry Pi',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
        title: 'Circuit LED',
        description: 'Montage des composants électroniques'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=600&fit=crop',
        title: 'Interface web',
        description: 'Développement de l\'interface de contrôle'
      },
      {
        id: '3',
        url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=600&fit=crop',
        title: 'Code Python',
        description: 'Programmation du contrôleur GPIO'
      }
    ]
  },
  {
    projectId: 'analyse-wifi',
    projectTitle: 'Analyse de transmission WiFi',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop',
        title: 'WiFi Analyzer',
        description: 'Interface de l\'outil d\'analyse'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
        title: 'Mesures de signal',
        description: 'Relevés de puissance des signaux'
      }
    ]
  },
  {
    projectId: 'if-you-stay--science-fiction-motionnelle',
    projectTitle: 'If You Stay — Science-fiction émotionnelle',
    images: [
      {
        id: '1',
        url: '',
        title: 'Concept Art — Univers',
        description: 'Image à venir — Ambiance contemplative et science-fiction'
      },
      {
        id: '2',
        url: '',
        title: 'La plage — Monde B',
        description: 'Image à venir — Lieu central du récit entre deux réalités'
      },
      {
        id: '3',
        url: '',
        title: 'Singularités & Interférences',
        description: 'Image à venir — Effets visuels narratifs'
      },
      {
        id: '4',
        url: '',
        title: 'Eliott & Lina',
        description: 'Image à venir — Personnages principaux'
      }
    ],
    details: [
      {
        section: '📋 Informations générales',
        content: [
          '🎮 Titre de travail : "If You Stay"',
          '🎯 Genre : Jeu narratif 2.5D — Science-fiction émotionnelle',
          '👁️ Perspective : 2.5D (vue latérale avec profondeur)',
          '⚙️ Moteur de jeu : Godot 4.x',
          '💻 Plateforme cible : PC (Windows)',
          '🎨 Style visuel : Contemplatif, minimaliste, émotionnel',
          '⏱️ Durée de jeu estimée : 20–40 minutes (démo)',
          '👥 Équipe : 1 personne',
          '🎯 Objectif : Explorer le deuil, l\'amour et la mécanique quantique à travers le gameplay'
        ]
      },
      {
        section: '📖 Concept du jeu - Pitch',
        content: [
          '🎭 Eliott, un lycéen brillant mais détaché, vit entre deux réalités depuis la mort de sa sœur Élise.',
          '🌊 La plage est le point de convergence : un souvenir figé qui refuse de disparaître.',
          '💫 L\'arrivée de Lina stabilise ses "interférences" — mais les deux mondes entrent en collision.',
          '🔮 Le joueur fait face à un choix quantique : observer pour rester, ou lâcher et disparaître.'
        ]
      },
      {
        section: '🎮 Caractéristiques principales',
        content: [
          '🌍 Deux mondes superposés (Monde A – présent, Monde B – souvenir)',
          '🌀 Système d\'interférences visuelles et sonores narratives',
          '💬 Dialogues à choix impactant les variables relationnelles',
          '🕳️ Singularités : zones aspirantes avec feedback visuel et sonore',
          '💕 Mini-jeux émotionnels (marche synchronisée, révisions, lancers de cailloux)',
          '🔮 Choix final quantique déterminant la fin',
          '🎵 Audio adaptatif selon l\'état du monde (Normal, Interference, Void)',
          '😢 Thématique : deuil, amour, présence, mécanique quantique'
        ]
      },
      {
        section: '📕 CHAPITRE 1 — ÉTAT STABLE (Lundi – Mardi)',
        content: [
          '🎬 Acte 1 — Lundi matin : Routine',
          'Eliott fait un exposé brillant au lycée. Il ne ressent aucune fierté, seulement du vide. Il regarde par la fenêtre et aperçoit la plage. Une sensation étrange apparaît : léger vertige, impression de déjà-vu. Eliott rationalise : « Une perturbation. Un bruit dans un système trop stable. »',
          '🗺️ Maps : Salle de classe (jour), Couloir du lycée',
          '🎮 Gameplay : Exploration 2.5D simple, interactions basiques (tableau, fenêtre), déplacements sans objectif clair, effets sensoriels très légers (flou, son étouffé)',
          '',
          '🎬 Acte 2 — Lundi soir : Première interférence',
          'Eliott est chez lui. Routine monotone. Un vendeur de calendriers sonne. Août : image de la plage. Interférence plus marquée : superposition visuelle, rire d\'enfant, migraine. Eliott ferme la porte brutalement. Il refuse d\'approfondir : « Le cerveau invente des motifs quand il s\'ennuie. »',
          '🗺️ Maps : Appartement d\'Eliott (soir)',
          '🎮 Gameplay : Interactions avec des objets du quotidien, choix vagues (allumer / éteindre la lumière), aucun HUD, sons distordus temporaires',
          '',
          '🎬 Acte 3 — Mardi : La résonance',
          'Nouvelle élève : Lina. Elle est lumineuse, naturelle. Lorsque Eliott la regarde, la sensation revient… mais sans douleur. Eliott comprend inconsciemment : « La perturbation se stabilise en sa présence. »',
          '🗺️ Maps : Salle de classe (jour – mardi), Cour du lycée',
          '🎮 Gameplay : Dialogues interactifs, choix relationnels simples (regarder / détourner), ambiance plus chaleureuse, musique discrète'
        ]
      },
      {
        section: '📗 CHAPITRE 2 — RÉSONANCE (Milieu de semaine)',
        content: [
          '🎬 Acte 1 — Moments partagés',
          'Eliott et Lina passent du temps ensemble. Moments simples : marcher après les cours, rire, silences confortables. Pensée d\'Eliott : « Deux ondes en phase réduisent le bruit. »',
          '🗺️ Maps : Chemin après les cours, Bus / tram',
          '🎮 Gameplay : Mini-jeu de marche synchronisée, choix de rythme, gameplay lent et doux',
          '',
          '🎬 Acte 2 — Proximité',
          'Séances de révision ensemble. Lina encourage Eliott à parler. Il commence à se sentir présent.',
          '🗺️ Maps : Bibliothèque / salle d\'étude',
          '🎮 Gameplay : Mini-jeu de révision, dialogues optionnels, gestion des silences',
          '',
          '🎬 Acte 3 — Premiers doutes',
          'Les migraines reviennent. Lina parle de la mer : « Ça me rend triste… sans raison. » Eliott formule une hypothèse : « Une bifurcation passée. Deux réalités coexistent. »',
          '🗺️ Maps : Quai urbain, Appartement d\'Eliott (nuit)',
          '🎮 Gameplay : Exploration libre, rêves interactifs, sons superposés'
        ]
      },
      {
        section: '📘 CHAPITRE 3 — SUPERPOSITION (Week-end)',
        content: [
          '🎬 Acte 1 — Samedi : La plage',
          'Eliott, Mathis (et parfois Lina) vont à la plage. Silence irréel. Le ciel se fige. Flash blanc. Mathis et Lina disparaissent.',
          '🗺️ Maps : Plage – Monde A',
          '🎮 Gameplay : Exploration libre, absence de musique, contrôle retiré pendant l\'événement',
          '',
          '🎬 Acte 2 — Monde B',
          'Eliott se retrouve sur la même plage, en été. Lina enfant apparaît. Elle le reconnaît. Elle n\'est pas surprise.',
          '🗺️ Maps : Plage – Monde B (été)',
          '🎮 Gameplay : Marche lente, aucun danger, interaction contemplative',
          '',
          '🎬 Acte 3 — Origine',
          'Flashbacks fragmentés d\'Élise. Jeux d\'enfants. Mort suggérée, jamais montrée. Eliott comprend : « Je suis resté entre deux états. »',
          '🗺️ Maps : Micro-maps de souvenirs',
          '🎮 Gameplay : Séquences courtes, décors incomplets, transitions abruptes'
        ]
      },
      {
        section: '📙 CHAPITRE 4 — COLLISION (Après le week-end)',
        content: [
          '🎬 Acte 1 — Amour fragile',
          'Eliott et Lina sont officiellement ensemble. Moments heureux mais instables. Eliott sait que cela ne peut pas durer.',
          '🗺️ Maps : Ville (état instable), Appartement d\'Eliott',
          '🎮 Gameplay : Mini-jeux émotionnels, glitchs visuels discrets',
          '',
          '🎬 Acte 2 — Fissures',
          'Lina disparaît brièvement par moments. Des trous noirs apparaissent. Pensée d\'Eliott : « Deux systèmes incompatibles partagent le même espace. »',
          '🗺️ Maps : Ville instable, Plage (superposition partielle)',
          '🎮 Gameplay : Évitement de zones instables, sons aspirés',
          '',
          '🎬 Acte 3 — Disparition de Lina',
          'Collision totale des mondes. Lina se trouve au point d\'intersection. Elle disparaît définitivement.',
          '🗺️ Maps : Plage – Superposition totale',
          '🎮 Gameplay : Singularités actives, contrôles ralentis'
        ]
      },
      {
        section: '📒 CHAPITRE 5 — OBSERVATION (Fin)',
        content: [
          '🎬 Acte 1 — Fusion',
          'Le monde se déchire. Un trou noir cosmique apparaît dans le ciel. Eliott comprend : « Ce n\'est pas un trou noir. C\'est un état final. »',
          '🗺️ Maps : Plage – Monde en fusion',
          '🎮 Gameplay : Errance, sons étouffés, gravité ressentie',
          '',
          '🎬 Acte 2 — Le choix',
          'Interface minimale. Le système exige une observation.',
          '🗺️ Maps : Zone liminale',
          '🎮 Gameplay : Choix unique — Stabiliser l\'observation / Laisser le système évoluer',
          '',
          '🎬 Acte 3 — Épilogue',
          'Fin heureuse : Lina revient, Eliott est vivant. Fin mauvaise : Lina revient, Eliott n\'est plus là.',
          '🗺️ Maps : Plage stabilisée (deux variantes)',
          '🎮 Gameplay : Marche lente, caméra fixe ou libre selon la fin',
          '💡 Message final : « Observer, c\'est rester. Lâcher, c\'est disparaître. »'
        ]
      },
      {
        section: '📜 PROLOGUE — AOÛT (Récit complet)',
        content: [
          'Il y a des souvenirs qui ne vieillissent pas. Ils restent là, immobiles, comme si le temps avait décidé de les oublier.',
          'Pour Eliott, c\'était la plage. Le sable brûlant, le bruit des vagues, le rire d\'Élise.',
          'C\'est là que tout aurait dû rester.'
        ]
      },
      {
        section: '📜 CHAPITRE I — LES SIGNES (Récit)',
        content: [
          'Eliott est intelligent. Trop. Assez pour comprendre vite. Pas assez pour y trouver un sens.',
          'Au lycée, il ne fait que l\'essentiel. Les professeurs l\'admirent, les élèves l\'ignorent, et lui traverse les journées comme un observateur extérieur. Il réussit son exposé sans effort, sans joie. Quand il lève les yeux, ce n\'est pas vers la classe, mais vers la fenêtre.',
          'La plage est visible au loin.',
          'À cet instant, quelque chose se produit. Un vertige. Une pression sourde derrière les tempes. Une sensation étrange, familière, impossible à nommer.',
          'Eliott n\'y prête pas attention. Il a appris depuis longtemps à ignorer ce qui fait mal sans raison.',
          'Le soir, chez lui, la routine reprend. Devoirs, écran, silence. Puis quelqu\'un sonne.',
          'Un vendeur de calendriers. Les saisons défilent. L\'hiver, le printemps… Août.',
          'La plage.',
          'La douleur revient, plus forte. Une image se superpose à la réalité : des enfants qui courent, un rire clair, le soleil trop blanc.',
          'Eliott ferme la porte trop vite.',
          'Ce n\'est qu\'un déjà-vu. Le cerveau fait ça quand il s\'ennuie.',
          'C\'est ce qu\'il se dit. Ce n\'est pas ce qu\'il croit.'
        ]
      },
      {
        section: '📜 CHAPITRE II — LINA (Récit)',
        content: [
          'Le lendemain, Lina arrive dans sa classe.',
          'Elle est tout ce qu\'Eliott n\'est pas. Présente. Lumineuse. Vivante.',
          'Quand leurs regards se croisent, la sensation revient… mais cette fois, elle ne fait pas mal. Elle se stabilise. Comme si quelque chose, enfin, s\'alignait.',
          'Lina sourit naturellement. Elle lui parle comme si c\'était évident.',
          '« J\'ai l\'impression de te connaître. »',
          'Eliott ne répond pas tout de suite. Il réfléchit. Pas aux mots. À ce qu\'il ressent.',
          'Intéressant. La perturbation disparaît en sa présence.',
          'Les jours passent. Ils marchent ensemble après les cours. Révisent. Se taisent sans gêne. Eliott recommence à ressentir quelque chose qui ressemble à une envie de rester.',
          'Mais les migraines reviennent. La plage revient. Toujours la plage.',
          'Lina, un jour, dit sans y penser :',
          '« La mer me rend triste… comme un souvenir que j\'ai pas vécu. »',
          'Eliott comprend alors qu\'il ne s\'agit pas d\'un hasard.'
        ]
      },
      {
        section: '📜 CHAPITRE III — LA BIFURCATION (Récit)',
        content: [
          'Le week-end, ils vont à la plage. Eliott, Mathis, et parfois Lina.',
          'Le silence est anormal. Le ciel trop calme.',
          'Eliott sent que quelque chose va céder.',
          'Puis tout disparaît.',
          'Mathis. Lina. Le bruit. Le vent.',
          'Quand Eliott rouvre les yeux, la plage est là… mais différente. Plus chaude. Plus lumineuse. Figée.',
          'Une enfant joue près de l\'eau.',
          'Lina.',
          'Elle se tourne vers lui, sans surprise.',
          '« T\'es revenu. »',
          'Eliott comprend alors.',
          'Ce monde est un état antérieur. Une version conservée. Un souvenir qui a refusé de mourir.',
          'C\'est ici qu\'Élise jouait. C\'est ici qu\'elle riait. C\'est ici qu\'Eliott a voulu que le temps s\'arrête.',
          'Quand sa sœur est morte, quelque chose s\'est brisé. Pas seulement en lui.',
          'Deux réalités ont émergé : l\'une qui avançait, l\'autre qui refusait l\'entropie.',
          'Et lui est resté entre les deux.'
        ]
      },
      {
        section: '📜 CHAPITRE IV — COLLISION (Récit)',
        content: [
          'Eliott revient dans le monde réel.',
          'Lina adulte est là… mais elle ne se souvient de rien.',
          'Elle existe dans deux états. Enfant dans le monde figé. Adulte dans le monde présent.',
          'Aucun des deux n\'est stable.',
          'Les jours passent. Leur relation devient réelle, profonde. Mais les fissures apparaissent.',
          'Des absences. Des trous dans le décor. Des souvenirs aspirés.',
          'Eliott comprend ce qui arrive.',
          'Deux systèmes incompatibles partagent le même espace. L\'univers cherchera la solution la plus simple.',
          'Lina commence à disparaître par moments.',
          'Puis, un jour, elle disparaît complètement.',
          'Au point exact où les deux mondes se superposent.',
          'Elle est dans les deux systèmes. Donc elle ne peut exister dans aucun.',
          'Avant de s\'effacer, elle lui dit :',
          '« Promets-moi de rester. Même si je reviens pas. »'
        ]
      },
      {
        section: '📜 CHAPITRE V — OBSERVATION (Récit)',
        content: [
          'Le monde s\'effondre lentement.',
          'Des singularités apparaissent. Des trous où l\'information tombe sans revenir.',
          'Dans le ciel, un immense disque lumineux se forme. Un trou noir.',
          'Eliott le regarde sans peur.',
          'Ce n\'est pas un monstre. C\'est un état final.',
          'Il comprend enfin.',
          'Tant qu\'il observe, les mondes restent ouverts. S\'il lâche, la réalité se stabilisera… sans lui.',
          'Le système n\'a pas besoin de son corps. Seulement de sa présence.',
          'Une seule chose est demandée : Observer.'
        ]
      },
      {
        section: '📜 ÉPILOGUE — DEUX RÉSULTATS (Récit)',
        content: [
          'S\'il reste :',
          'Eliott accepte l\'incertitude. La douleur. Le futur. Les mondes se stabilisent. Lina revient. Ils vivent. Pas parfaitement. Mais ensemble.',
          '',
          'S\'il lâche :',
          'Le système se ferme. Les mondes se stabilisent. Lina revient. Mais Eliott n\'est plus là pour la voir.',
          '',
          '💡 La réalité ne choisit pas pour nous. Elle réagit à notre présence.'
        ]
      },
      {
        section: '📅 Plan de production détaillé',
        content: [
          '📦 Étape 0 — Préparer le projet (1-2 jours) :',
          'Choisir Godot 4.x. Créer un repository Git avec arborescence (scenes/, scripts/, assets/, dialogue/, data/). Définir la résolution cible (1920×1080 ou 640×360 pixel art upscalé). Rédiger une page Vision (ton, références, durée cible).',
          'Livrable : Projet Godot vide, arborescence en place et versionnée.',
          '',
          '🎮 Étape 1 — Prototype jouable — Vertical Slice :',
          'Player : CharacterBody3D, déplacements WASD, animations idle/walk. Caméra : Camera3D, follow du joueur, limites de déplacement. Interaction : Area3D sur objets interactifs, touche E → Interact(). Transitions : chaque map = scène Godot (.tscn), SceneTree.change_scene_to_file().',
          'Livrable : Mini-map jouable avec interaction PNJ, dialogue, changement de map.',
          '',
          '💬 Étape 2 — Système de dialogue solide :',
          'Format JSON : id, speaker, text, choices[]. Chaque choix peut poser des flags, déclencher des events, rediriger vers un autre id.',
          'Livrable : Dialogue avec deux choix et une variable impactant une phrase ultérieure.',
          '',
          '📊 Étape 3 — Story Manager & progression :',
          'Singleton GameState.gd (AutoLoad) : chapter, act, flags (met_lina, seen_calendar), variables relationnelles (bond_lina, trust_mathis), world_state (A/B/Fusion). EventBus (système de signaux) : signal event_triggered(name).',
          'Livrable : Changement de map avec décor variant selon world_state.',
          '',
          '🗺️ Étape 4 — Pipeline Maps :',
          '1 layout par map, 3 couches d\'ambiance : A (normal), B (été/enfance), Fusion (glitch, singularités). Activer/désactiver des nodes selon world_state ou utiliser des WorldEnvironment distincts.',
          'Livrable : Une plage passant de Monde A → Monde B → Fusion dans une seule scène.',
          '',
          '🌀 Étape 5 — Interférences :',
          'Post-process shader (screen shader) : blur léger, aberration chromatique, vignette, displacement. InterferenceController : start_interference(intensity, duration), filtre audio (low-pass), réduction temporaire de l\'input (micro-latence).',
          'Livrable : L\'effet se déclenche automatiquement lorsque le joueur regarde la mer.',
          '',
          '🕳️ Étape 6 — Singularités / trous noirs :',
          'Chaque singularité : Area3D, force de "drag" ralentissant le joueur, distorsion visuelle locale (shader + particules). Si le joueur reste trop longtemps : reset position ou blackout + perte de souvenir.',
          'Livrable : Zone aspirante avec feedback visuel et sonore clair.',
          '',
          '💕 Étape 7 — Mini-jeux émotionnels :',
          'Marche synchronisée (maintenir un rythme commun), Révisions (choix de ton : gentil/sec/silencieux), Lancer de cailloux (timing + discussions entre chaque lancer).',
          'Livrable : Un mini-jeu complet avec récompense narrative unique.',
          '',
          '🎬 Étape 8 — Cutscenes & mise en scène :',
          'Script qui bloque l\'input, déplace la caméra sur rails (Tween), lance animations simples, affiche dialogues.',
          'Livrable : Scène jouable de la disparition de Lina avec cutscene intégrée.',
          '',
          '🔮 Étape 9 — Choix final quantique :',
          'UI simple : texte "Une observation est requise", deux boutons. Aucune indication de bonne ou mauvaise fin. Set final_choice = "stabilize" ou "evolve".',
          'Livrable : Deux épilogues distincts chargés selon le choix.',
          '',
          '🔊 Étape 10 — Audio :',
          'Trois couches : ambiance (vent, mer), musique minimaliste (piano, pads), layer interférence (drones, filtres). Audio buses : Normal, Interference (filtré), Void (quasi silence).',
          'Livrable : Audio adaptatif selon world_state.',
          '',
          '💾 Étape 11 — Sauvegardes & QA :',
          'Autosave à chaque changement de map, sauvegarde manuelle via menu. Checklist de tests : choix, dialogues, transitions, softlocks.',
          'Livrable : Possibilité de quitter et reprendre à tout moment.'
        ]
      },
      {
        section: '📊 Plan de production conseillé',
        content: [
          '🎯 Étape A — Démo jouable (recommandée) :',
          'Chapitre 1 complet, Chapitre 2 partiel, Week-end (plage Monde B) en teaser. Durée cible : 20–40 minutes.',
          '',
          '🎯 Étape B — Jeu complet :',
          'Collision lente, Fusion, Fins multiples.',
          '',
          '📋 Ordre de production optimal :',
          '1. Contrôles + caméra',
          '2. Dialogue + choix + flags',
          '3. Transitions de maps',
          '4. Une map "plage" avec A / B / Fusion',
          '5. Interférences (shader + audio)',
          '6. Singularités (Area3D)',
          '7. Mini-jeu romance',
          '8. Cutscene disparition de Lina',
          '9. Choix final + deux épilogues',
          '10. Polish (audio, FX, UI, sauvegardes)'
        ]
      },
      {
        section: '🎯 Fins du jeu',
        content: [
          '✅ Fin heureuse : Eliott accepte l\'incertitude — Lina revient, ils vivent ensemble',
          '💀 Fin tragique : Le système se ferme — Lina revient, mais Eliott n\'est plus là',
          '💡 Message final : "Observer, c\'est rester. Lâcher, c\'est disparaître."'
        ]
      },
      {
        section: '🛠️ Outils et ressources',
        content: [
          '⚙️ Moteur : Godot 4.x',
          '📋 Gestion de projet : Notion',
          '🔄 Versioning : GitHub',
          '🎨 Assets : Sprites personnalisés, shaders GLSL custom pour les interférences',
          '🎵 Audio : Compositions minimalistes (piano, pads), Freesound.org pour ambiance',
          '📝 Documentation : Notion (GDD, suivi technique, narrative design)',
          '🧪 Tests : Builds de test à chaque chapitre complété'
        ]
      },
      {
        section: '📊 Rétroplanning synthétique',
        content: [
          '📅 Semaine 1-2 : Pré-production — GDD, moodboard, architecture Godot, prototype déplacement + caméra',
          '📅 Semaine 3-4 : Système de dialogue JSON + Story Manager + flags narratifs',
          '📅 Semaine 5-6 : Pipeline maps (Monde A / B / Fusion) + transitions de scènes',
          '📅 Semaine 7-8 : Interférences (shaders + audio) + singularités (Area3D)',
          '📅 Semaine 9-10 : Mini-jeux émotionnels + cutscenes narratives',
          '📅 Semaine 11-12 : Choix final quantique + deux épilogues + polish audio/FX',
          '📅 Semaine 13-14 : Tests, équilibrage, sauvegardes, build final démo'
        ]
      },
      {
        section: '⚠️ Risques et contraintes',
        content: [
          '🔴 Développement solo (Impact élevé) → Solution : Scope limité à une démo de 20-40 minutes',
          '🟠 Shaders complexes pour interférences (Impact moyen) → Solution : Prototyper tôt, simplifier si nécessaire',
          '🟠 Narration lourde à intégrer (Impact moyen) → Solution : Système JSON modulaire, dialogues testés séparément',
          '🔴 Équilibrage émotionnel (Impact élevé) → Solution : Playtests externes dès le chapitre 3'
        ]
      },
      {
        section: '🎯 Livrable final attendu',
        content: [
          '✅ Démo jouable et complète sur PC',
          '⏱️ Durée de jeu estimée : 20 à 40 minutes',
          '🎭 Expérience narrative immersive et émotionnelle',
          '💻 Build final compilé et testé sous Windows'
        ]
      }
    ]
  },
  {
    projectId: 'thornfall--action-rpg-souls-like',
    projectTitle: 'Thornfall — Action RPG Souls-like',
    images: [
      {
        id: '1',
        url: '',
        title: 'Forêt sinistre',
        description: 'Image à venir — Environnement dark fantasy oppressant'
      },
      {
        id: '2',
        url: '',
        title: 'Combat Souls-like',
        description: 'Image à venir — Système de combat lourd et punitif'
      },
      {
        id: '3',
        url: '',
        title: 'Boss — Althéon',
        description: 'Image à venir — Gardien de Noirracine'
      },
      {
        id: '4',
        url: '',
        title: 'Level Design — Forêt',
        description: 'Image à venir — Zone principale interconnectée'
      }
    ],
    details: [
      {
        section: '📋 Informations générales',
        content: [
          '🎮 Titre de travail : "Thornfall"',
          '🎯 Genre : Action RPG — Souls-like',
          '👁️ Perspective : Troisième personne',
          '⚙️ Moteur de jeu : Unreal Engine 5',
          '💻 Plateforme cible : PC (manette recommandée)',
          '🎨 Style visuel : Dark fantasy, couleurs désaturées, brume et ombres',
          '⏱️ Durée de la démo : ~20 minutes',
          '👥 Équipe : 2 programmeurs + 1 game designer',
          '🎯 Objectif : Créer une démo Souls-like courte mais intense, centrée sur un combat punitif et un boss mémorable'
        ]
      },
      {
        section: '📖 Concept du jeu - Pitch',
        content: [
          '⚔️ Le joueur explore une forêt sinistre et corrompue, affrontant des ennemis standards avant un boss dévastateur.',
          '💀 Le combat est lourd, engageant et punitif : chaque action a un coût en stamina, chaque erreur est punissable.',
          '🧠 La mort est pédagogique : le joueur apprend les patterns du boss par l\'observation et la patience.',
          '🎯 L\'objectif n\'est pas de raconter toute l\'histoire, mais de faire ressentir la qualité du gameplay.'
        ]
      },
      {
        section: '🎮 Caractéristiques principales',
        content: [
          '🗺️ Zone unique interconnectée (forêt sinistre) avec chemins secondaires et raccourcis',
          '⚔️ Combat au corps à corps lourd (grosse épée, 1 coup = 1 décision)',
          '🔋 Gestion stricte de la stamina (toutes les actions consomment de l\'endurance)',
          '🛡️ Système de garde avec garde brisée à 0 stamina (1.5s de stun)',
          '🏃 Esquive avec i-frames de 0.35s (pas de spam possible)',
          '👹 Boss final : Althéon, Gardien de Noirracine (3500 PV, 6 attaques uniques)',
          '🔥 Phase critique du boss à ≤30% PV (rythme accéléré, pas de nouvelles attaques)',
          '😨 Thématique : isolement, tension, apprentissage par la mort'
        ]
      },
      {
        section: '🌲 Univers & Ambiance',
        content: [
          '📍 Lieu : Forêt sinistre, ancienne et corrompue',
          '🌑 Ambiance : sombre, oppressante, silence entrecoupé de sons naturels inquiétants, sentiment d\'isolement',
          '📖 Narration : environnementale uniquement, pas de cinématiques longues, lore suggéré par le décor et le boss'
        ]
      },
      {
        section: '🔄 Core Gameplay Loop',
        content: [
          '🌲 Exploration prudente de la forêt',
          '⚔️ Affrontement d\'ennemis standards',
          '💀 Mort du joueur → perte de ressources',
          '🔥 Retour au checkpoint',
          '🧠 Apprentissage des patterns',
          '👹 Affrontement du boss final'
        ]
      },
      {
        section: '⚔️ Système de combat — Vue d\'ensemble',
        content: [
          '📷 Vue & caméra : 3e personne, caméra libre, inspiration Dark Souls',
          '🗡️ Arsenal : 1 arme unique — grosse épée, attaques lentes, puissantes, engageantes',
          '🎮 Actions du joueur : Attaque légère, Attaque lourde, Esquive (roulade), Garde / blocage, Utilisation de soins',
          '⚡ Endurance (Stamina) : Toutes les actions consomment de l\'endurance. Gestion de la stamina = clé du combat.',
          '🚫 Aucune action offensive ou défensive possible à stamina = 0'
        ]
      },
      {
        section: '🎮 Personnage & Level Design',
        content: [
          '👤 Personnage unique imposé, pas de création, équipement fixe, progression limitée ou absente dans la démo',
          '',
          '🗺️ Level Design — Forêt sinistre :',
          '1 zone principale interconnectée, chemins secondaires, raccourcis déblocables, 1 checkpoint principal (type feu)',
          'Ennemis standards + 1 ennemi élite optionnel, apprentissage progressif avant le boss'
        ]
      },
      {
        section: '⚔️ Document de Combat — Intentions de design',
        content: [
          'Le système de combat vise à :',
          '🧘 Encourager la patience et la lecture',
          '⚡ Punir l\'agressivité irréfléchie',
          '⚖️ Donner du poids à chaque action',
          '📚 Rendre la mort pédagogique, jamais arbitraire',
          'Le joueur doit s\'engager à chaque attaque.'
        ]
      },
      {
        section: '🔋 Tableau chiffré — Endurance (Stamina)',
        content: [
          'Stamina max : 100',
          'Régénération (hors action) : 20 / seconde',
          'Délai avant regen : 0,8 s',
          'Regen pendant garde : ❌ Non',
          'Action possible à 0 stamina : ❌ Aucune'
        ]
      },
      {
        section: '🗡️ Tableau chiffré — Attaques du joueur',
        content: [
          '🔹 Attaque légère : Coût 20 stamina, 100 dégâts, 0.9s animation — Punition rapide',
          '🔸 Attaque lourde : Coût 40 stamina, 180 dégâts, 1.6s animation — Très engageante',
          '🚫 Combo autorisé : Non — 1 coup = 1 décision'
        ]
      },
      {
        section: '🛡️ Tableau chiffré — Défense',
        content: [
          '🔵 Roulade : Coût 30 stamina, I-frames 0.35s, Recovery 0.6s, Spam possible : ❌ Non',
          '',
          '🛡️ Garde / Blocage :',
          'Drain continu : 10/seconde',
          'Drain par impact : 25',
          'Réduction dégâts : 100%',
          'Garde brisée à : 0 stamina',
          'Stun garde brisée : 1.5s',
          '⚠️ La garde est sûre mais dangereuse si mal gérée.',
          '',
          '💊 Soins : 3 charges, 2s d\'animation, interruptible : ✅ Oui'
        ]
      },
      {
        section: '👹 Boss — ALTHÉON, GARDIEN DE NOIRRACINE',
        content: [
          '🎯 Philosophie du boss :',
          'Combat lent, lisible, brutal. Punit : roulade en boucle, garde passive. Récompense : patience, bonne distance, 1 attaque bien placée.',
          '',
          '📊 Stats du boss :',
          '❤️ PV : 3 500',
          '⚔️ Dégâts moyens : 40–60% des PV joueur',
          '🛡️ Résistance au stun : Élevée',
          '🏃 Vitesse : Lente à moyenne'
        ]
      },
      {
        section: '⚔️ Liste complète des attaques du Boss',
        content: [
          '1️⃣ Coup vertical écrasant — Attaque de base :',
          'Télégraphie : lève l\'épée au-dessus de la tête. Délai : 1.2s. Dégâts élevés. Casse la garde, énorme drain stamina (+40). Punition : attaque légère possible.',
          '👉 Apprendre au joueur à ne pas garder systématiquement.',
          '',
          '2️⃣ Balayage horizontal large — Anti-roulade :',
          'Arc large à hauteur de buste. Portée élevée. Dégâts moyens. Punition courte.',
          '👉 Attrape les roulades tardives.',
          '',
          '3️⃣ Enchaînement à deux coups — Test de discipline :',
          'Coup horizontal → coup vertical. Délai entre coups : 0.5s. Le 2e coup punit ceux qui attaquent trop tôt.',
          '👉 Le joueur doit attendre la fin du pattern.',
          '',
          '4️⃣ Estoc enracinée — Punition distance moyenne :',
          'Althéon plante son épée dans le sol. Racines surgissent en ligne droite. Zone télégraphiée. Dégâts élevés + projection.',
          '👉 Apprend au joueur à se repositionner, pas reculer.',
          '',
          '5️⃣ Coup retardé — Mind game :',
          'Animation lente volontairement trompeuse. Le coup part plus tard que prévu. Dégâts élevés. Punition : attaque lourde possible (rare).',
          '👉 Conçue pour casser le timing du joueur.',
          '',
          '6️⃣ Rugissement de Noirracine — Pression stamina :',
          'Cri + onde de choc courte. Aucun dégât direct. Vide une grosse partie de la stamina (60). Repousse légèrement.',
          '👉 Forcer le joueur à respirer, pas attaquer.'
        ]
      },
      {
        section: '🔥 Phase critique du Boss (≤30% PV)',
        content: [
          'Attaques plus fréquentes',
          'Balayage + coup vertical peuvent s\'enchaîner',
          'Moins de pauses',
          'Pas de nouvelles attaques (lisibilité conservée)',
          '👉 La difficulté vient du rythme, pas de la surprise.',
          '',
          '☠️ Conditions de victoire voulues :',
          'Le joueur gagne s\'il : attaque 1 fois après chaque ouverture, gère sa stamina mieux que ses PV, accepte de mourir pour apprendre.'
        ]
      },
      {
        section: '🎨 Direction artistique & Audio',
        content: [
          '🎨 Style : dark fantasy, couleurs désaturées, brume, ombres, végétation dense',
          '🖥️ UI : minimaliste, informations essentielles uniquement, immersion prioritaire',
          '',
          '🔊 Audio :',
          'Sons d\'ambiance naturels (vent, arbres, craquements)',
          'Musique discrète en exploration',
          'Musique intense et grave pour le boss',
          'Feedback sonore fort pour : coups réussis, garde brisée, mort du joueur'
        ]
      },
      {
        section: '🚫 Contenu volontairement absent',
        content: [
          'Pas de multijoueur',
          'Pas de monde ouvert',
          'Pas de classes multiples',
          'Pas de système de loot complexe',
          'Pas de combos complexes, magie, parade parfaite, styles de jeu multiples',
          '👉 Focus total sur combat, lisibilité et tension.',
          '👉 Simplicité = meilleur équilibrage.'
        ]
      },
      {
        section: '🏗️ Phases de production détaillées',
        content: [
          '🟢 PHASE 1 — Pré-production (fondations) :',
          '🎯 Objectif : savoir exactement ce qu\'on fait et ce qu\'on ne fait pas.',
          '1. Verrouiller le scope : 1 zone (forêt), 1 arme (grosse épée), 1 boss très difficile, 1 type de personnage. Tout ce qui n\'aide pas le boss = supprimé.',
          '2. Documenter le combat : vitesse des attaques, coût stamina, durée d\'esquive, récupération stamina, stun/garde brisée.',
          '3. Répartition des rôles : Prog 1 = combat joueur/stamina/caméra, Prog 2 = ennemis/IA/boss, GD = équilibrage/patterns/level design.',
          '',
          '🟡 PHASE 2 — Prototype jouable :',
          '🎯 Objectif : le jeu fonctionne, même moche.',
          '4. Contrôles du joueur : déplacement, caméra libre, lock optionnel, roulade, garde. Testable clavier/manette.',
          '5. Système de stamina : consommation sur chaque action, blocage impossible à 0, feedback visuel simple. À tester très tôt.',
          '6. Combat basique : attaques légères/lourdes, hitbox simples, dégâts clairs, animation placeholder OK. Le "game feel" passe avant le visuel.',
          '',
          '🟠 PHASE 3 — Ennemis & Boss :',
          '🎯 Objectif : rendre le combat intéressant.',
          '7. Ennemi standard : 1 type suffit, 2-3 attaques max, sert d\'apprentissage.',
          '8. Prototype du boss (le plus tôt possible) : modèle simple, patterns grossiers, grosses hitbox visibles. Ne pas attendre la fin.',
          '9. Design des patterns : attaques lentes → lourdes, fenêtres de punition claires, attaques qui cassent la garde.',
          '',
          '🔵 PHASE 4 — Level Design :',
          '🎯 Objectif : guider le joueur vers le boss.',
          '10. Blocage de la forêt (greybox) : chemins principaux, raccourcis, arènes de combat. Pas de déco, juste des volumes.',
          '11. Placement des ennemis : apprendre les mécaniques, fatiguer le joueur avant le boss, jamais injuste.',
          '12. Checkpoint : respawn, reset ennemis, récupération soins.',
          '',
          '🟣 PHASE 5 — Polishing (crucial) :',
          '🎯 Objectif : ressenti pro.',
          '13. Feedback joueur : sons d\'impact, effets visuels simples, animations de hit.',
          '14. Équilibrage du boss : dégâts, stamina drain, timing des attaques. Le joueur doit mourir, mais comprendre pourquoi.',
          '15. UX & lisibilité : UI minimale, barre stamina lisible, attaques ennemies claires.',
          '',
          '🔴 PHASE 6 — Finalisation démo :',
          '🎯 Objectif : livrer quelque chose de propre.',
          '16. Tests externes : joueurs qui ne connaissent pas le jeu, observer sans expliquer, noter où ils meurent.',
          '17. Ajustements finaux : supprimer frustration inutile, garder la difficulté, corriger bugs bloquants.',
          '18. Build final : menu simple, lancement direct en jeu, message de fin après le boss.'
        ]
      },
      {
        section: '🧩 Architecture Blueprint — Joueur',
        content: [
          '📝 Variables (Character BP) :',
          'StaminaMax = 100, Stamina = 100, StaminaRegenRate = 20/s, StaminaRegenDelay = 0.8s',
          'bIsSprinting, bIsBlocking, bIsDodging, bIsAttacking, bIsGuardBroken',
          'GuardBreakStunTime = 1.5, BlockDrainPerSecond = 10, BlockDrainOnHit = 25',
          'LightCost = 20, HeavyCost = 40, DodgeCost = 30',
          '',
          '📝 Fonctions (Character BP) :',
          'CanSpendStamina(Cost) → bool : Return (Stamina >= Cost) AND NOT bIsGuardBroken AND NOT bIsDodging AND NOT bIsAttacking',
          'SpendStamina(Cost) : Stamina = Clamp(Stamina - Cost, 0, StaminaMax), LastStaminaUseTime = GetGameTimeInSeconds()',
          'TryStartRegen() (appelé en Tick) : Si bIsBlocking/bIsAttacking/bIsDodging/bIsGuardBroken → return. Si délai pas atteint → return. Sinon regen.',
          'EnterGuardBreak() : bIsGuardBroken = true, bIsBlocking = false, Play Montage GuardBreak_Stagger, disable input, SetTimer → ExitGuardBreak',
          '',
          '📝 Input Actions :',
          'Blocage (Hold) : Block Pressed → set bIsBlocking = true. Block Released → false. Tick : drain continu, si 0 → EnterGuardBreak()',
          'Roulade : Si CanSpendStamina → SpendStamina, bIsDodging = true, Play Dodge_Roll, activer i-frames, AnimNotify Dodge_End → reset',
          'Attaque légère/lourde : Si CanSpendStamina → SpendStamina, bIsAttacking = true, Play Montage, AnimNotify pour hitbox et fin',
          '',
          '📝 Prise de dégâts :',
          'HandleIncomingHit : Si bIsInvulnerable → ignore. Si bIsBlocking et "attaque vient de face" → SpendStamina(BlockDrainOnHit + bonus), zéro dégâts PV, si 0 → EnterGuardBreak(). Sinon → appliquer dégâts PV.'
        ]
      },
      {
        section: '🧩 Architecture Blueprint — Boss Althéon',
        content: [
          '📝 Blueprints recommandés :',
          'BP_Boss_Altheon (Character), BP_BossAIController, (optionnel) BT_Boss + BB_Boss, ABP_Boss (AnimBP)',
          '',
          '📝 Variables (BP_Boss_Altheon) :',
          'Enum EBossState : Idle, Chase, AttackWindup, Attacking, Recover, Stagger, Dead',
          'BossState, Target, DistanceToTarget, bPhase2 (actif quand HP ≤ 30%), HPMax = 3500',
          'Cooldowns par attaque, MinAttackInterval = 0.6 (phase1) / 0.45 (phase2)',
          'Ranges : MeleeRange = 250, SweepRange = 320, RootThrustRange = 900, RoarRange = 400',
          'RecoverTime_Short = 0.7, RecoverTime_Long = 1.1 (réduit de 15-25% en phase2)',
          '',
          '📝 FSM — BossThink (toutes les 0.1s) :',
          'Si Attacking/Recover/Stagger/Dead → return. Chercher Target. Check phase2 (HP ≤ 30%). Si hors MeleeRange → Chase + MoveTo. Sinon → SelectAttack().',
          '',
          '📝 SelectAttack() :',
          'Construire liste Candidates avec scores pondérés : VerticalSmash (30), TwoHit (25), DelayedStrike (20), Sweep (25 si en range), RootThrust (35 à distance), Roar (15 rare).',
          'Anti-spam : retirer si en cooldown, réduire si dernière attaque = même type. En phase2 : augmenter Sweep + TwoHit.',
          'Tirage pondéré → StartAttack(Chosen).',
          '',
          '📝 StartAttack → Notifies → Recovery :',
          'FaceTarget(0.2s), PlayMontage. AnimNotifies : Hitbox_On/Off, Attack_Commit, Attack_End. Fin → BossState = Recover, SetTimer → EndRecover → Idle.',
          '',
          '📝 Dégâts boss → joueur :',
          'Weapon box collider → OnComponentBeginOverlap → appliquer Damage + StaminaDamage.',
          'StaminaDamage bonus : VerticalSmash +40, Sweep +10, TwoHit +15, Delayed +30, RootThrust +25.',
          '',
          '📝 Attaques spéciales :',
          'RootThrust : AnimNotify → SpawnActor(BP_RootLineAOE) aligné vers Target, warning decal 0.6s, puis ApplyDamage + LaunchCharacter.',
          'Roar : Sphere overlap RoarRange → SpendStamina(60) sur joueur, léger knockback, pas de dégâts PV.',
          '',
          '📝 Anti-exploit :',
          'Joueur trop loin → favoriser RootThrust. Joueur spam roulade → favoriser Sweep. Joueur garde trop → favoriser VerticalSmash + Roar.',
          '',
          '📝 Organisation Blueprints :',
          'Boss BP : FSM, sélection d\'attaque, timers, HP/phase. AnimBP : locomotion + slots montages. Montages : notifies. Weapon BP : collision + application dégâts/stamina.'
        ]
      },
      {
        section: '🧠 Règles d\'or',
        content: [
          '⚔️ Toute action a un coût',
          '💀 Toute erreur est punissable',
          '👁️ Toute attaque doit être lisible',
          '⚡ La stamina est plus importante que les PV',
          '🎯 Le joueur perd par impatience, pas par injustice',
          '🚫 Si ça ne rend pas le combat meilleur, ça dégage',
          '💡 Si le joueur meurt, il doit savoir pourquoi.'
        ]
      },
      {
        section: '🎯 Objectif final',
        content: [
          'Cette démo doit :',
          '✅ Prouver la solidité du gameplay Souls-like',
          '✅ Marquer le joueur avec un boss mémorable',
          '✅ Démontrer le potentiel du projet et de l\'équipe'
        ]
      },
      {
        section: '🛠️ Outils et ressources',
        content: [
          '⚙️ Moteur : Unreal Engine 5.3+',
          '📋 Gestion de projet : Notion / Trello',
          '🔄 Versioning : GitHub ou Perforce',
          '🎨 Assets : Unreal Marketplace, Quixel Megascans, Mixamo (animations)',
          '🎵 Audio : Freesound.org, compositions custom pour le boss',
          '📝 Documentation : Notion (GDD, combat doc, blueprint architecture)',
          '🧪 Tests : Builds mensuels, playtests externes dès la phase 5'
        ]
      },
      {
        section: '📊 Rétroplanning synthétique',
        content: [
          '📅 Semaine 1-2 : Pré-production — Scope verrouillé, combat doc finalisé, répartition des rôles',
          '📅 Semaine 3-4 : Prototype jouable — Contrôles joueur, caméra, roulade, garde',
          '📅 Semaine 5-6 : Système de stamina — Consommation, blocage, feedback visuel, tests',
          '📅 Semaine 7-8 : Combat basique — Attaques légères/lourdes, hitbox, dégâts, game feel',
          '📅 Semaine 9-10 : Ennemis & Boss — IA standard, prototype boss, patterns grossiers',
          '📅 Semaine 11-12 : Level Design — Greybox forêt, placement ennemis, checkpoint',
          '📅 Semaine 13-14 : Polishing — Feedback joueur, sons d\'impact, équilibrage boss, UX',
          '📅 Semaine 15-16 : Finalisation — Tests externes, ajustements, menu, build final'
        ]
      },
      {
        section: '⚠️ Risques et contraintes',
        content: [
          '🔴 Équilibrage du boss (Impact élevé) → Solution : Playtests externes réguliers, observer sans expliquer',
          '🟠 Performance Unreal (Impact moyen) → Solution : Optimiser tôt, LOD et occlusion dès le greybox',
          '🟠 Animations de combat (Impact moyen) → Solution : Mixamo + retouches manuelles',
          '🔴 Coordination équipe réduite (Impact élevé) → Solution : Rôles clairs, builds hebdomadaires, communication constante'
        ]
      },
      {
        section: '🎯 Livrable final attendu',
        content: [
          '✅ Démo jouable et complète sur PC',
          '⏱️ Durée de jeu estimée : ~20 minutes',
          '⚔️ Combat Souls-like solide avec boss mémorable',
          '💻 Build final compilé et testé sous Windows (clavier/manette)'
        ]
      }
    ]
  },
  {
    projectId: 'mesure-signal',
    projectTitle: 'Mesure et caractérisation d\'un signal',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
        title: 'Oscilloscope',
        description: 'Analyse des signaux électriques'
      }
    ]
  },
  {
    projectId: 'topologie-centralisee',
    projectTitle: 'Projet intégratif : Topologie centralisée + succursale (GNS3)',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop',
        title: 'Site principal',
        description: 'Configuration du site central'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
        title: 'Interconnexion',
        description: 'Liaison avec la succursale'
      }
    ]
  },
  {
    projectId: 'suivi-commande',
    projectTitle: 'Création d\'un site web de suivi de commande',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=800&h=600&fit=crop',
        title: 'Interface utilisateur',
        description: 'Dashboard de suivi des commandes'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=600&fit=crop',
        title: 'Base de données',
        description: 'Architecture des données'
      }
    ]
  },
  {
    projectId: 'des-jeux-pour-professionnels-du-btiment',
    projectTitle: 'Des Jeux pour Professionnels du Bâtiment',
    images: [
      {
        id: '1',
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop',
        title: 'Chantier BTP',
        description: 'Contexte professionnel du bâtiment'
      },
      {
        id: '2',
        url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&h=600&fit=crop',
        title: 'Gamification',
        description: 'Approche ludique pour les professionnels'
      }
    ],
    details: [
      {
        section: '📋 Informations générales',
        content: [
          '🎮 Titre : "Des jeux pour professionnels du bâtiment"',
          '👥 Équipe : Florian Girardot Lahogue · Mathis Payet · Romaric Gambier',
          '🎯 Type : Application web/mobile',
          '🏗️ Secteur : BTP / construction',
          '🎯 Cible : Professionnels du bâtiment connectés et exigeants (30–35 ans)'
        ]
      },
      {
        section: '📖 Concept du projet',
        content: [
          '📱 Application web/mobile conçue pour intégrer une dimension ludique dans le quotidien des professionnels du bâtiment, sans jamais compromettre leur productivité.',
          '🎯 Le projet répond à un défi précis : offrir une vraie pause à des travailleurs de terrain, connectés et exigeants, qui n\'ont que 1 à 2 minutes disponibles et attendent de la valeur ajoutée — pas du divertissement vide.',
          '⏱️ Les sessions durent moins de 2 minutes, sans boucle addictive ni récompenses infinies.',
          '🔄 Un système de rotation mensuelle renouvelle le jeu actif pour maintenir l\'intérêt dans la durée.'
        ]
      },
      {
        section: '🎮 Mini-jeux développés',
        content: [
          '🏛️ Guess the Building — Quiz visuel pour identifier des bâtiments iconiques à travers le monde',
          '🏗️ Bati-Bloc — Jeu de grue où l\'on empile des blocs de chantier le plus haut possible',
          '⏱️ Format court : chaque session dure moins de 2 minutes',
          '🚫 Aucune boucle addictive, aucune récompense infinie'
        ]
      },
      {
        section: '🎯 Philosophie de conception',
        content: [
          '✅ Chaque choix de conception — format court, contenu métier, zéro distraction excessive — vise le même équilibre :',
          '🤝 Humaniser l\'expérience utilisateur tout en respectant l\'identité professionnelle du secteur BTP',
          '🧠 Gameplay facile à comprendre en 3 secondes',
          '💼 Adapté à un environnement professionnel de chantier'
        ]
      },
      {
        section: '🛠️ Technologies et compétences',
        content: [
          '🎨 UX Design — Conception centrée utilisateur pour un public terrain',
          '🎮 Gamification — Mécaniques de jeu appliquées au contexte professionnel',
          '💻 Application web — Développement front-end responsive',
          '📊 Game Design — Équilibrage des sessions courtes et engageantes'
        ]
      }
    ]
  }
];

// Fonction utilitaire pour récupérer une galerie par ID
export const getProjectGallery = (projectId: string): ProjectGallery | undefined => {
  return projectGalleries.find(gallery => gallery.projectId === projectId);
};

// Fonction pour créer l'ID du projet à partir du titre
export const createProjectId = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Enlever les caractères spéciaux
    .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
    .replace(/--+/g, '-') // Remplacer les tirets multiples par un seul
    .trim();
};
