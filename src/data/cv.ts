/* Contenu du CV (version web de public/mon-cv.pdf), en français et en anglais. */

export interface CvContent {
  title: string;
  about: string;
  experience: { title: string; place: string; items: string[] }[];
  education: { school: string; degree: string; years: string }[];
  skills: string[];
  languages: { name: string; level: string }[];
  tools: { name: string; text: string }[];
  interests: { name: string; text: string }[];
  labels: Record<'contact' | 'education' | 'skills' | 'languages' | 'tools' | 'about' | 'experience' | 'interests', string>;
}

export const CV: Record<'fr' | 'en', CvContent> = {
  fr: {
    title: 'Étudiant en réseaux & télécommunications',
    about: "Étudiant en réseaux et télécommunications, orienté cybersécurité et fiabilité des infrastructures. À l'aise avec la configuration d'équipements Cisco, l'analyse des flux réseau et l'identification de vulnérabilités en environnement contrôlé. Motivé à mettre en pratique mes compétences techniques pour renforcer la sécurité et la performance des systèmes de communication.",
    experience: [
      {
        title: 'Stage réseaux & infrastructures',
        place: 'ESIROI — La Réunion',
        items: [
          "Modernisation de l'infrastructure Wi-Fi du département informatique",
          'Installation et déploiement de bornes Wi-Fi',
          'Configuration et mise en service de switches réseau',
          "Participation au déploiement et à la configuration de l'infrastructure réseau",
          'Tests de connectivité et vérification du bon fonctionnement du réseau',
          'Diagnostic et résolution de problèmes liés au réseau',
        ],
      },
    ],
    education: [
      { school: 'IUT de La Réunion', degree: 'BUT Réseaux et Télécommunications', years: '2024 – 2027' },
      { school: 'Lycée Roland Garros', degree: 'Baccalauréat technologique', years: '2023 – 2024' },
    ],
    skills: ['Autonomie', "Méthodologie d'analyse", "Travail d'équipe", 'Organisation', 'Esprit critique', 'Avis critique'],
    languages: [
      { name: 'Français', level: 'natif' },
      { name: 'Anglais', level: 'technique (documentation, outils)' },
    ],
    tools: [
      { name: 'Réseaux', text: 'Cisco Packet Tracer, GNS3, Wireshark' },
      { name: 'Systèmes', text: 'Linux (Debian, Kali), Windows Server' },
      { name: 'Virtualisation', text: 'VMware, VirtualBox' },
      { name: 'Cybersécurité', text: 'pfSense, pentest, reconnaissance réseau, CVE' },
    ],
    interests: [
      { name: 'Jeux vidéo', text: "développement de la logique, du sens stratégique et de l'esprit d'équipe" },
      { name: 'Musique', text: 'créativité, concentration et persévérance' },
      { name: 'Art', text: 'sens esthétique et capacité à penser différemment' },
      { name: 'Informatique', text: 'veille technologique et auto-apprentissage' },
    ],
    labels: { contact: 'Contact', education: 'Formation', skills: 'Compétences', languages: 'Langues', tools: 'Outils', about: 'À propos de moi', experience: 'Expérience', interests: 'Intérêts' },
  },
  en: {
    title: 'Networks & telecommunications student',
    about: 'Networks and telecommunications student focused on cybersecurity and infrastructure reliability. Comfortable configuring Cisco equipment, analysing network traffic and identifying vulnerabilities in controlled environments. Eager to put my technical skills into practice to strengthen the security and performance of communication systems.',
    experience: [
      {
        title: 'Networks & infrastructure internship',
        place: 'ESIROI — Reunion Island',
        items: [
          "Modernised the computer science department's Wi-Fi infrastructure",
          'Installed and deployed Wi-Fi access points',
          'Configured and commissioned network switches',
          'Took part in deploying and configuring the network infrastructure',
          'Ran connectivity tests and checked the network worked properly',
          'Diagnosed and fixed network issues',
        ],
      },
    ],
    education: [
      { school: 'IUT de La Réunion', degree: 'Bachelor of Technology (BUT) in Networks & Telecommunications', years: '2024 – 2027' },
      { school: 'Lycée Roland Garros', degree: 'Technological baccalaureate', years: '2023 – 2024' },
    ],
    skills: ['Autonomy', 'Analytical method', 'Teamwork', 'Organisation', 'Critical thinking', 'Critical judgement'],
    languages: [
      { name: 'French', level: 'native' },
      { name: 'English', level: 'technical (documentation, tools)' },
    ],
    tools: [
      { name: 'Networks', text: 'Cisco Packet Tracer, GNS3, Wireshark' },
      { name: 'Systems', text: 'Linux (Debian, Kali), Windows Server' },
      { name: 'Virtualisation', text: 'VMware, VirtualBox' },
      { name: 'Cybersecurity', text: 'pfSense, pentesting, network reconnaissance, CVEs' },
    ],
    interests: [
      { name: 'Video games', text: 'logic, strategic thinking and team spirit' },
      { name: 'Music', text: 'creativity, focus and perseverance' },
      { name: 'Art', text: 'aesthetic sense and thinking differently' },
      { name: 'Computing', text: 'tech watch and self-learning' },
    ],
    labels: { contact: 'Contact', education: 'Education', skills: 'Skills', languages: 'Languages', tools: 'Tools', about: 'About me', experience: 'Experience', interests: 'Interests' },
  },
};
