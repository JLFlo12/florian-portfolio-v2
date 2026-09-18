import React from 'react';
import { Code, Database, Shield, Server, Globe, Terminal, FileText, Wifi, HardDrive, Monitor, Gamepad2, Cpu, Lock, Bug } from 'lucide-react';

/* Outils présentés sur l'accueil (section Outils).
   Aussi transmis à Jarvis pour qu'il reste à jour avec le site. */

export interface Tool {
  name: string;
  icon: React.ReactNode;
  category: string;
  description: string;
}

export const TOOLS: Tool[] = [
  // ── Cybersécurité (Base) ──
  { 
    name: 'Kali Linux', 
    icon: <Shield className="h-8 w-8" />, 
    category: 'security',
    description: 'Distribution Linux spécialisée en sécurité informatique et tests de pénétration, avec plus de 600 outils de sécurité préinstallés.'
  },
  { 
    name: 'Wireshark', 
    icon: <Wifi className="h-8 w-8" />, 
    category: 'security',
    description: 'Analyseur de protocoles réseau puissant pour capturer et examiner le trafic réseau en temps réel. Parfait pour le diagnostic et la sécurité réseau.'
  },
  { 
    name: 'pfSense', 
    icon: <Shield className="h-8 w-8" />, 
    category: 'security',
    description: 'Pare-feu et routeur open-source basé sur FreeBSD, offrant des fonctionnalités de sécurité réseau avancées et une interface web intuitive.'
  },
  { 
    name: 'Nmap', 
    icon: <Bug className="h-8 w-8" />, 
    category: 'security',
    description: 'Scanner de ports et outil d\'audit réseau open-source. Détecte les hôtes, services et vulnérabilités sur un réseau.'
  },
  { 
    name: 'Metasploit', 
    icon: <Lock className="h-8 w-8" />, 
    category: 'security',
    description: 'Framework de tests de pénétration pour découvrir et exploiter des vulnérabilités dans les systèmes informatiques.'
  },
  { 
    name: 'Burp Suite', 
    icon: <Shield className="h-8 w-8" />, 
    category: 'security',
    description: 'Plateforme de test de sécurité des applications web. Proxy d\'interception, scanner de vulnérabilités et outils d\'intrusion.'
  },
  // ── Réseau ──
  { 
    name: 'GNS3', 
    icon: <Globe className="h-8 w-8" />, 
    category: 'network',
    description: 'Simulateur de réseau graphique permettant de concevoir, construire et tester des topologies réseau complexes virtuellement.'
  },
  // ── Game Dev ──
  { 
    name: 'Unreal Engine 5', 
    icon: <Gamepad2 className="h-8 w-8" />, 
    category: 'gamedev',
    description: 'Moteur de jeu AAA d\'Epic Games avec rendu Nanite, illumination Lumen et MetaHuman. Utilisé pour Thornfall et The Forgotten.'
  },
  { 
    name: 'Godot 4', 
    icon: <Gamepad2 className="h-8 w-8" />, 
    category: 'gamedev',
    description: 'Moteur de jeu open-source léger et flexible avec GDScript. Utilisé pour If You Stay — jeu narratif 2.5D.'
  },
  { 
    name: 'Blender', 
    icon: <Cpu className="h-8 w-8" />, 
    category: 'gamedev',
    description: 'Suite 3D open-source complète : modélisation, sculpt, animation, rendu et compositing. Idéal pour créer des assets de jeux.'
  },
  // ── Virtualisation ──
  { 
    name: 'VMware Workstation', 
    icon: <Monitor className="h-8 w-8" />, 
    category: 'virtualization',
    description: 'Plateforme de virtualisation professionnelle pour exécuter plusieurs systèmes d\'exploitation simultanément sur une seule machine.'
  },
  { 
    name: 'VirtualBox', 
    icon: <HardDrive className="h-8 w-8" />, 
    category: 'virtualization',
    description: 'Solution de virtualisation open-source gratuite d\'Oracle, idéale pour tester différents OS et environnements de développement.'
  },
  // ── Développement ──
  { 
    name: 'Visual Studio Code', 
    icon: <Code className="h-8 w-8" />, 
    category: 'development',
    description: 'Éditeur de code source léger et puissant de Microsoft avec support pour de nombreux langages et extensions.'
  },
  { 
    name: 'Git', 
    icon: <Code className="h-8 w-8" />, 
    category: 'development',
    description: 'Système de contrôle de version distribué pour suivre les modifications du code source et collaborer efficacement en équipe.'
  },
  { 
    name: 'Notepad++', 
    icon: <FileText className="h-8 w-8" />, 
    category: 'development',
    description: 'Éditeur de texte et de code source gratuit pour Windows avec coloration syntaxique et support de nombreux langages de programmation.'
  },
  // ── Serveurs ──
  { 
    name: 'Apache', 
    icon: <Server className="h-8 w-8" />, 
    category: 'server',
    description: 'Serveur web HTTP open-source le plus utilisé au monde, robuste et modulaire pour héberger des sites web et applications.'
  },
  { 
    name: 'Nginx', 
    icon: <Server className="h-8 w-8" />, 
    category: 'server',
    description: 'Serveur web haute performance et proxy inverse, excellent pour servir du contenu statique et équilibrer la charge.'
  },
  // ── Télécom ──
  { 
    name: 'Asterisk', 
    icon: <Globe className="h-8 w-8" />, 
    category: 'telecom',
    description: 'Framework de communication open-source pour créer des solutions de téléphonie IP, PBX et centres d\'appels personnalisés.'
  },
  // ── Hardware ──
  { 
    name: 'Raspberry Pi', 
    icon: <HardDrive className="h-8 w-8" />, 
    category: 'hardware',
    description: 'Mini-ordinateur ARM économique parfait pour les projets IoT, domotique, serveurs personnels et apprentissage de l\'informatique.'
  },
  // ── OS ──
  { 
    name: 'Debian', 
    icon: <Terminal className="h-8 w-8" />, 
    category: 'os',
    description: 'Distribution Linux stable et sécurisée, base de nombreuses autres distributions, idéale pour les serveurs et postes de travail.'
  },
  { 
    name: 'Windows Server', 
    icon: <Server className="h-8 w-8" />, 
    category: 'os',
    description: 'Système d\'exploitation serveur de Microsoft avec Active Directory, services réseau intégrés et outils d\'administration avancés.'
  },
  // ── Outils divers ──
  { 
    name: 'FileZilla', 
    icon: <Database className="h-8 w-8" />, 
    category: 'tools',
    description: 'Client FTP/SFTP gratuit et multi-plateforme pour transférer des fichiers entre ordinateurs locaux et serveurs distants.'
  },
  { 
    name: 'Putty', 
    icon: <Terminal className="h-8 w-8" />, 
    category: 'tools',
    description: 'Client SSH/Telnet léger et gratuit pour Windows, permettant la connexion sécurisée aux serveurs et équipements réseau distants.'
  },
];
