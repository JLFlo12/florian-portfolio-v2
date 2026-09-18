/* Contenu du CV (version web de public/mon-cv.pdf), en français et en anglais. */

export interface CvContent {
  title: string;
  about: string;
  experience: { title: string; items: string[] }[];
  education: { school: string; degree: string; years: string }[];
  skills: string[];
  languages: { name: string; level: string }[];
  interests: { name: string; text: string }[];
  labels: Record<'contact' | 'education' | 'skills' | 'languages' | 'about' | 'experience' | 'interests', string>;
}

export const CV: Record<'fr' | 'en', CvContent> = {
  fr: {
    title: 'Étudiant en réseaux & télécommunications',
    about: "Étudiant en réseaux et télécommunications, orienté cybersécurité et fiabilité des infrastructures. À l'aise avec la configuration d'équipements Cisco, l'analyse des flux réseau et l'identification de vulnérabilités en environnement contrôlé. Motivé à mettre en pratique mes compétences techniques pour renforcer la sécurité et la performance des systèmes de communication.",
    experience: [
      { title: 'Simulation et configuration de réseaux', items: ['Cisco Packet Tracer, GNS3'] },
      { title: 'Analyse de réseau', items: ['Wireshark'] },
      { title: 'Virtualisation et environnements de test', items: ['VirtualBox, VMware'] },
      { title: 'Administration des systèmes et services réseau', items: ['Linux (Debian, Kali), Windows Server'] },
      { title: 'Sécurité & pare-feu', items: ['pfSense'] },
      { title: 'Pentest / sécurité offensive', items: ["Analyse de la surface d'attaque et reconnaissance réseau", 'Recherche de failles connues (CVE) et de mauvaises configurations'] },
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
    interests: [
      { name: 'Jeux vidéo', text: "développement de la logique, du sens stratégique et de l'esprit d'équipe" },
      { name: 'Musique', text: 'créativité, concentration et persévérance' },
      { name: 'Art', text: 'sens esthétique et capacité à penser différemment' },
      { name: 'Informatique', text: 'veille technologique et auto-apprentissage' },
    ],
    labels: { contact: 'Contact', education: 'Formation', skills: 'Compétences', languages: 'Langues', about: 'À propos de moi', experience: 'Expérience', interests: 'Intérêts' },
  },
  en: {
    title: 'Networks & telecommunications student',
    about: 'Networks and telecommunications student focused on cybersecurity and infrastructure reliability. Comfortable configuring Cisco equipment, analysing network traffic and identifying vulnerabilities in controlled environments. Eager to put my technical skills into practice to strengthen the security and performance of communication systems.',
    experience: [
      { title: 'Network simulation and configuration', items: ['Cisco Packet Tracer, GNS3'] },
      { title: 'Network analysis', items: ['Wireshark'] },
      { title: 'Virtualisation and test environments', items: ['VirtualBox, VMware'] },
      { title: 'System and network service administration', items: ['Linux (Debian, Kali), Windows Server'] },
      { title: 'Security & firewalls', items: ['pfSense'] },
      { title: 'Pentesting / offensive security', items: ['Attack surface analysis and network reconnaissance', 'Finding known vulnerabilities (CVEs) and misconfigurations'] },
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
    interests: [
      { name: 'Video games', text: 'logic, strategic thinking and team spirit' },
      { name: 'Music', text: 'creativity, focus and perseverance' },
      { name: 'Art', text: 'aesthetic sense and thinking differently' },
      { name: 'Computing', text: 'tech watch and self-learning' },
    ],
    labels: { contact: 'Contact', education: 'Education', skills: 'Skills', languages: 'Languages', about: 'About me', experience: 'Experience', interests: 'Interests' },
  },
};
