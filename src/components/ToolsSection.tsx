import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code, Database, Shield, Server, Globe, Terminal, FileText, Wifi, HardDrive, Monitor, Gamepad2, Cpu, Lock, Bug, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SectionHeading from '@/components/SectionHeading';
import { gsap, prefersReducedMotion, useReveal } from '@/lib/motion';

interface Tool {
  name: string;
  icon: React.ReactNode;
  category: string;
  description: string;
}

const ToolsSection = () => {
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const section = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  useReveal(section);

  const tools: Tool[] = [
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

  // Catégories présentes, dans l'ordre d'apparition
  const categories = useMemo(() => Array.from(new Set(tools.map((tool) => tool.category))), []);
  const visible = filter === 'all' ? tools : tools.filter((tool) => tool.category === filter);

  // Petite animation quand on change de filtre
  const applyFilter = (value: string) => {
    if (value === filter) return;
    setFilter(value);
    if (prefersReducedMotion()) return;
    requestAnimationFrame(() => {
      const items = grid.current?.children;
      if (items) gsap.fromTo(items, { autoAlpha: 0, y: 24, rotationX: -25 }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03, overwrite: true });
    });
  };

  return (
    <section ref={section} className="section-y relative">
      <div className="container-x">
        <SectionHeading index="01" label="tools" title={t('home.toolsTitle')} lede={t('home.toolsHint')} />

        {/* Filtres par catégorie */}
        <div className="mt-12 flex flex-wrap gap-2" data-reveal>
          {['all', ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => applyFilter(cat)}
              className={`rounded-full border px-4 py-2 font-mono text-xs transition-colors ${
                filter === cat ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'
              }`}
            >
              {cat === 'all' ? t('home.allTools') : t(`home.categories.${cat}`)}
              <span className="ml-2 opacity-60">{cat === 'all' ? tools.length : tools.filter((tool) => tool.category === cat).length}</span>
            </button>
          ))}
        </div>

        {/* Grille des outils */}
        <div ref={grid} className="mt-8 grid grid-cols-2 gap-3 [perspective:1200px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-stagger>
          {visible.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => setSelectedTool(tool)}
              data-cursor={t('ui.open')}
              className="panel group flex min-h-[150px] flex-col justify-between p-4 text-left transition-transform duration-500 [transition-timing-function:var(--ease-out)] hover:-translate-y-1"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="led text-xs text-muted-foreground">{String(tools.indexOf(tool) + 1).padStart(2, '0')}</span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
              </span>
              <span className="text-muted-foreground transition-colors duration-300 group-hover:text-primary">{tool.icon}</span>
              <span>
                <span className="block font-display text-[.95rem] font-bold leading-tight [font-stretch:110%]">{tool.name}</span>
                <span className="label-mono mt-1 block !text-[.62rem]">{t(`home.categories.${tool.category}`)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Fenêtre de description */}
      <Dialog open={!!selectedTool} onOpenChange={(open) => { if (!open) setSelectedTool(null); }}>
        <DialogContent className="panel max-w-md border-primary/30 p-0 sm:rounded-[22px]">
          {selectedTool && (
            <div className="relative p-7">
              <div className="hud-frame inset-3" aria-hidden="true"><i /><i /><i /><i /></div>
              <DialogHeader className="space-y-4 text-left">
                <p className="label-mono">{t(`home.categories.${selectedTool.category}`)}</p>
                <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase [font-stretch:118%]">
                  <span className="text-primary">{selectedTool.icon}</span>
                  {selectedTool.name}
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                  {selectedTool.description}
                </DialogDescription>
              </DialogHeader>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ToolsSection;
