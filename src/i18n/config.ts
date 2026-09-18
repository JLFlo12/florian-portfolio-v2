
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      // Navigation
      nav: {
        home: 'Accueil',
        projects: 'Projets',
        about: 'À propos',
        contact: 'Contact',
        chatbot: 'Jarvis',
        games: 'Games'
      },
      // Interface générale (menu, pied de page, effets)
      ui: {
        menu: 'Menu',
        close: 'Fermer',
        language: 'Langue',
        theme: 'Changer de thème',
        games: 'Mini-jeux',
        scroll: 'Défiler',
        backTop: 'Retour en haut',
        rights: 'Tous droits réservés.',
        localTime: 'Heure locale',
        status: 'Statut',
        online: 'En ligne',
        coords: 'Coordonnées',
        session: 'Session',
        explore: 'Explorer',
        open: 'Ouvrir',
        view: 'Voir',
        read: 'Lire',
        play: 'Jouer',
        loaderLines: ['initialisation de florian.sys', 'chargement des projets', 'connexion au réseau', 'planète en orbite'],
        footerTitle: 'Construisons quelque chose',
        footerAccent: 'ensemble',
        homeBeacon: 'La Réunion · point de départ'
      },
      chatbot: {
        subtitle: 'Assistant IA — Posez-moi vos questions sur Florian',
        welcome: 'Bienvenue. Je suis Jarvis, votre assistant cybersécurité.',
        hint: 'Posez-moi une question sur Florian, ses compétences ou ses projets.',
        placeholder: 'Tapez votre message...',
        send: 'Envoyer',
        tooMany: 'Trop de requêtes, réessayez dans un instant.',
        noCredits: 'Crédits IA épuisés.'
      },
      // Home page
      home: {
        role: 'Étudiant en BUT Réseaux & Télécommunications',
        bio: 'Étudiant passionné par l\'informatique, le développement et la cyber.',
        location: 'La Réunion, France',
        cta: 'Découvrir mes projets',
        skillsHeading: 'Mes compétences',
        skillsTitle: 'Compétences techniques',
        softSkillsTitle: 'Soft Skills',
        toolsTitle: 'Outils que j\'utilise',
        toolsHint: 'Clique sur un outil pour voir à quoi il me sert.',
        allTools: 'Tous',
        levels: { maitrise: 'Maîtrisé', avance: 'Avancé', base: 'Base', fragile: 'Fragile' },
        categories: {
          security: 'Cybersécurité', network: 'Réseau', gamedev: 'Game Dev', virtualization: 'Virtualisation',
          development: 'Développement', server: 'Serveurs', telecom: 'Télécom', hardware: 'Hardware', os: 'OS', tools: 'Outils'
        }
      },
      // Projects page
      projects: {
        title: 'Mes projets',
        completed: 'Terminés',
        inProgress: 'En cours',
        viewProject: 'Voir le projet',
        count: 'projets',
        adminMode: 'Mode admin',
        addProject: 'Ajouter un projet',
        logout: 'Déconnexion',
        viewSlides: 'Voir la présentation',
        deleteTitle: 'Supprimer ce projet ?',
        deleteText: 'Cette action est irréversible.',
        cancel: 'Annuler',
        delete: 'Supprimer',
        // Titres de projets traduits
        projectTitles: {
          'the-forgotten-survival-horror': 'The Forgotten - Survival Horror',
          'hygiene-cybersecurite': 'Hygiène et cybersécurité',
          'pilotage-led-raspberry': 'Pilotage de LED avec Raspberry Pi',
          'analyse-transmission-wifi': 'Analyse de transmission WiFi',
          'creation-portfolio': 'Création d\'un portfolio personnel',
          'reseau-entreprise-gns3': 'Réseau pour petite entreprise (GNS3)',
          'mesure-signal': 'Mesure et caractérisation d\'un signal',
          'projet-integratif-gns3': 'Projet intégratif : Topologie centralisée + succursale (GNS3)',
          'site-suivi-commande': 'Création d\'un site web de suivi de commande'
        },
        // Descriptions de projets traduites
        projectDescriptions: {
          'the-forgotten-survival-horror': 'Développement d\'un jeu survival horror en Unreal Engine 5 - exploration, survie et ambiance oppressante dans une forêt brumeuse',
          'hygiene-cybersecurite': 'Apprentissage des bonnes pratiques de sécurité (mots de passe, antivirus, pare-feu, etc.)',
          'pilotage-led-raspberry': 'Contrôle de LED à distance via un serveur web sur Raspberry Pi',
          'analyse-transmission-wifi': 'Étude de la puissance des signaux WiFi avec WiFi Analyzer et documentation des résultats',
          'creation-portfolio': 'Premier site portfolio simple en HTML/CSS/JS',
          'reseau-entreprise-gns3': 'Conception d\'une infrastructure réseau complète dans GNS3 avec routage, VLAN, NAT, etc.',
          'mesure-signal': 'Analyse de signaux physiques à l\'oscilloscope, calcul de fréquence et d\'amplitude',
          'projet-integratif-gns3': 'Réseau GNS3 simulant un site principal et une succursale interconnectée',
          'site-suivi-commande': 'Développement d\'une web app permettant la gestion et le suivi de commandes, triées par statut, type et fournisseur'
        }
      },
      // Page détail d'un projet
      gallery: {
        back: 'Retour aux projets',
        admin: 'Admin',
        edit: 'Modifier le contenu',
        cancel: 'Annuler',
        logout: 'Déco',
        details: 'Détails du projet',
        plan: 'Plan d\'action du projet',
        images: 'Images du projet',
        image: 'Image du projet',
        files: 'Fichiers du projet',
        slides: 'Voir la présentation',
        canva: 'Voir sur Canva',
        soon: 'Image à venir',
        empty: 'Aucun contenu disponible pour ce projet.',
        notFound: 'Projet non trouvé'
      },
      // About page
      about: {
        title: 'À propos',
        intro: 'Étudiant passionné par les technologies réseau et la cybersécurité',
        cvTitle: 'Mon CV',
        downloadCV: 'Télécharger mon CV',
        viewCV: 'Visualiser en ligne',
        educationTitle: 'Formation',
        educationDegree: 'BUT Réseaux & Télécommunications',
        educationDescription: 'En cours - Spécialisation en cybersécurité et administration réseau',
        expertiseTitle: 'Expertise',
        networkTitle: 'Réseaux',
        networkDescription: 'Configuration et administration de réseaux d\'entreprise, VLAN, routage dynamique et statique',
        systemsTitle: 'Systèmes',
        systemsDescription: 'Administration Linux/Windows Server, virtualisation, conteneurisation',
        cybersecurityTitle: 'Cybersécurité',
        cybersecurityDescription: 'Analyse de vulnérabilités, hardening système, sensibilisation aux bonnes pratiques'
      },
      // Contact page
      contact: {
        title: 'Contact',
        subtitle: 'Discutons de vos projets',
        email: 'Email',
        github: 'GitHub',
        linkedin: 'LinkedIn',
        location: 'Localisation',
        collabTitle: 'Prêt à collaborer ?',
        collabText: 'N\'hésitez pas à me contacter pour discuter de vos projets ou opportunités.',
        collabButton: 'Envoyer un message',
        copy: 'Copier l\'adresse',
        copied: 'Adresse copiée',
        stackEmail: 'E-mail',
        write: 'Écrire',
        cvValue: 'mon-cv.pdf — à consulter ou télécharger'
      },
      // Games page
      games: {
        title: 'Mini Games',
        subtitle: 'Quelques mini-jeux cachés dans mon portfolio.',
        play: 'Play',
        soon: 'Bientôt',
        back: 'Retour aux jeux'
      },
      notFound: {
        title: 'Page introuvable',
        text: 'Ce signal ne mène nulle part. La page demandée n\'existe pas.',
        back: 'Retour à l\'accueil'
      }
    }
  },
  en: {
    translation: {
      // Navigation
      nav: {
        home: 'Home',
        projects: 'Projects',
        about: 'About',
        contact: 'Contact',
        chatbot: 'Jarvis',
        games: 'Games'
      },
      ui: {
        menu: 'Menu',
        close: 'Close',
        language: 'Language',
        theme: 'Toggle theme',
        games: 'Mini games',
        scroll: 'Scroll',
        backTop: 'Back to top',
        rights: 'All rights reserved.',
        localTime: 'Local time',
        status: 'Status',
        online: 'Online',
        coords: 'Coordinates',
        session: 'Session',
        explore: 'Explore',
        open: 'Open',
        view: 'View',
        read: 'Read',
        play: 'Play',
        loaderLines: ['booting florian.sys', 'loading projects', 'connecting to the network', 'planet in orbit'],
        footerTitle: 'Let\'s build something',
        footerAccent: 'together',
        homeBeacon: 'La Réunion · home base'
      },
      chatbot: {
        subtitle: 'AI Assistant — Ask me anything about Florian',
        welcome: 'Welcome. I am Jarvis, your cybersecurity assistant.',
        hint: 'Ask me about Florian, his skills or his projects.',
        placeholder: 'Type your message...',
        send: 'Send',
        tooMany: 'Too many requests, please try again shortly.',
        noCredits: 'AI credits exhausted.'
      },
      // Home page
      home: {
        role: 'Student in Networks & Telecommunications',
        bio: 'Computer science, development and cybersecurity enthusiast.',
        location: 'La Réunion, France',
        cta: 'Discover my projects',
        skillsHeading: 'My skills',
        skillsTitle: 'Technical Skills',
        softSkillsTitle: 'Soft Skills',
        toolsTitle: 'My Tools',
        toolsHint: 'Click a tool to see what I use it for.',
        allTools: 'All',
        levels: { maitrise: 'Mastered', avance: 'Advanced', base: 'Basic', fragile: 'Fragile' },
        categories: {
          security: 'Cybersecurity', network: 'Network', gamedev: 'Game Dev', virtualization: 'Virtualization',
          development: 'Development', server: 'Servers', telecom: 'Telecom', hardware: 'Hardware', os: 'OS', tools: 'Tools'
        }
      },
      // Projects page
      projects: {
        title: 'My Projects',
        completed: 'Completed',
        inProgress: 'In Progress',
        viewProject: 'View project',
        count: 'projects',
        adminMode: 'Admin mode',
        addProject: 'Add a project',
        logout: 'Log out',
        viewSlides: 'View presentation',
        deleteTitle: 'Delete this project?',
        deleteText: 'This action cannot be undone.',
        cancel: 'Cancel',
        delete: 'Delete',
        // Titres de projets traduits
        projectTitles: {
          'the-forgotten-survival-horror': 'The Forgotten - Survival Horror',
          'hygiene-cybersecurite': 'IT Hygiene and Cybersecurity',
          'pilotage-led-raspberry': 'LED Control with Raspberry Pi',
          'analyse-transmission-wifi': 'WiFi Transmission Analysis',
          'creation-portfolio': 'Personal Portfolio Creation',
          'reseau-entreprise-gns3': 'Small Business Network (GNS3)',
          'mesure-signal': 'Signal Measurement and Characterization',
          'projet-integratif-gns3': 'Integrative Project: Centralized Topology + Branch (GNS3)',
          'site-suivi-commande': 'Order Tracking Website Creation'
        },
        // Descriptions de projets traduites
        projectDescriptions: {
          'the-forgotten-survival-horror': 'Survival horror game development in Unreal Engine 5 - Exploration, survival and oppressive atmosphere in a foggy forest',
          'hygiene-cybersecurite': 'Learning security best practices (passwords, antivirus, firewall, etc.)',
          'pilotage-led-raspberry': 'Remote LED control via web server on Raspberry Pi',
          'analyse-transmission-wifi': 'WiFi signal strength study with WiFi Analyzer and results documentation',
          'creation-portfolio': 'First simple portfolio website using HTML/CSS/JS',
          'reseau-entreprise-gns3': 'Complete network infrastructure design in GNS3 with routing, VLAN, NAT, etc.',
          'mesure-signal': 'Physical signal analysis with oscilloscope, frequency and amplitude calculation',
          'projet-integratif-gns3': 'GNS3 network simulating a main site and an interconnected branch',
          'site-suivi-commande': 'Web app development for order management and tracking, sorted by status, type and supplier'
        }
      },
      gallery: {
        back: 'Back to projects',
        admin: 'Admin',
        edit: 'Edit content',
        cancel: 'Cancel',
        logout: 'Log out',
        details: 'Project details',
        plan: 'Project action plan',
        images: 'Project images',
        image: 'Project image',
        files: 'Project files',
        slides: 'View presentation',
        canva: 'View on Canva',
        soon: 'Image coming soon',
        empty: 'No content available for this project.',
        notFound: 'Project not found'
      },
      // About page
      about: {
        title: 'About',
        intro: 'Student passionate about network technologies and cybersecurity',
        cvTitle: 'My Resume',
        downloadCV: 'Download my Resume',
        viewCV: 'View online',
        educationTitle: 'Education',
        educationDegree: 'B.Tech Networks & Telecommunications',
        educationDescription: 'In progress - Specializing in cybersecurity and network administration',
        expertiseTitle: 'Expertise',
        networkTitle: 'Networks',
        networkDescription: 'Enterprise network configuration and administration, VLAN, dynamic and static routing',
        systemsTitle: 'Systems',
        systemsDescription: 'Linux/Windows Server administration, virtualization, containerization',
        cybersecurityTitle: 'Cybersecurity',
        cybersecurityDescription: 'Vulnerability analysis, system hardening, best practices awareness'
      },
      // Contact page
      contact: {
        title: 'Contact',
        subtitle: "Let's discuss your projects",
        email: 'Email',
        github: 'GitHub',
        linkedin: 'LinkedIn',
        location: 'Location',
        collabTitle: 'Ready to collaborate?',
        collabText: 'Feel free to reach out to discuss your projects or opportunities.',
        collabButton: 'Send a message',
        copy: 'Copy address',
        copied: 'Address copied',
        stackEmail: 'Email',
        write: 'Write',
        cvValue: 'mon-cv.pdf — view or download'
      },
      games: {
        title: 'Mini Games',
        subtitle: 'A few mini games hidden in my portfolio.',
        play: 'Play',
        soon: 'Soon',
        back: 'Back to games'
      },
      notFound: {
        title: 'Page not found',
        text: 'This signal leads nowhere. The page you asked for does not exist.',
        back: 'Back to home'
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
