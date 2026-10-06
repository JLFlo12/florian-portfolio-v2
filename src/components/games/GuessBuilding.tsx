import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, ChevronRight, Info } from 'lucide-react';

interface GuessBuildingProps {
  onBack: () => void;
}

interface Credit {
  author: string;
  license: string;
  url: string;
}

interface Building {
  name: string;
  image: string;
  info: string;
  country: string;
  funFact: string;
  credit?: Credit; // photos de Wikimedia Commons (licences libres) : auteur, licence et page d'origine
}

/* Photos de Wikimedia Commons, recadrées et réduites (crédits affichés après chaque réponse) */
const COMMONS: Record<string, Credit> = {
  'elbphilharmonie': { author: 'Dietmar Rabich', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Hamburg,_Hafen,_Elbphilharmonie_--_2016_--_3129.jpg' },
  'guggenheim-bilbao': { author: 'José Ligero Loarte', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Museo_Guggenheim_--_2021_--_Bilbao,_Euskadi,_Espa%C3%B1a.jpg' },
  'heydar-aliyev': { author: 'Robot8A', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Baku_15_06_14_216000.jpeg' },
  'interlace': { author: 'kallerna', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:The_Interlace_Singapore.jpg' },
  'cctv': { author: 'Morio', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:CCTV_Headquarters_2015_August.jpg' },
  'habitat-67': { author: 'Dllu', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Habitat_67_2019_dllu_02.jpg' },
  'atomium': { author: 'Trougnouf (Benoit Brummer)', license: 'CC BY 4.0', url: 'https://commons.wikimedia.org/wiki/File:The_Atomium_during_civil_twilight_(DSCF1135).jpg' },
  'lotus-temple': { author: 'Bijay chaurasia', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Lotus_Temple_Front_view_with_garden_-_During_WCI_2016_-_IMG_6499.jpg' },
  'niteroi': { author: 'Donatas Dabravolskas', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Contemporary_Art_Museum_in_Niteroi_City_4.jpg' },
  'statue-liberte': { author: '銀河市長', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Statue_of_liberty_front.jpg' },
  'kheops': { author: 'kallerna', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Great_Pyramid_of_Giza.jpg' },
  'notre-dame': { author: 'Sanchezn', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:NotreDameDeParis.jpg' },
  'pise': { author: 'PaestumPaestum', license: 'CC BY 4.0', url: 'https://commons.wikimedia.org/wiki/File:Exterior_of_the_Leaning_Tower_(Pisa)_in_April_2024.jpg' },
  'parthenon': { author: 'A.Savin', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_50_View_from_Philopappos_-_Acropolis_Hill.jpg' },
  'angkor-vat': { author: 'Jakub Hałun', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:20171126_Angkor_Wat_4712_DxO.jpg' },
  'saint-basile': { author: 'Юрий Д.К.', license: 'CC BY 4.0', url: 'https://commons.wikimedia.org/wiki/File:Moscow_-_2025_-_Daytime_view_of_St._Basil%27s_Cathedral_from_Vasilyevsky_Spusk.jpg' },
  'neuschwanstein': { author: 'Ximonic, Simo Räsänen (post-processing) & Tauno Räsänen (photograph)', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Neuschwanstein_Castle_from_Marienbr%C3%BCcke,_2011_May.jpg' },
  'sainte-sophie': { author: 'Arild Vågen', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Hagia_Sophia_Mars_2013.jpg' },
  'chrysler': { author: 'Ermell', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Chrysler_Building_NYC-20090519-RM-094845.jpg' },
  'petronas': { author: 'Marcin Konsek', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:2016_Kuala_Lumpur,_Petronas_Towers_(26).jpg' },
  'cn-tower': { author: 'Wladyslaw', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Toronto_-_ON_-_Toronto_Harbourfront7.jpg' },
  'space-needle': { author: 'Dietmar Rabich', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Seattle_(WA,_USA),_Space_Needle_--_2022_--_1498.jpg' },
  'gherkin': { author: 'Diliff', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:30_St_Mary_Axe_-_The_Gherkin_from_Leadenhall_St_-_Nov_2006.jpg' },
  'taipei-101': { author: 'AngMoKio', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Taipei_101_2009_amk.jpg' },
  'maison-dansante': { author: 'Honza Groh (Jagro)', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Jir%C3%A1skovo_n%C3%A1m%C4%9Bst%C3%AD,_Tatra_T3R.P_a_Tan%C4%8D%C3%ADc%C3%AD_d%C5%AFm.jpg' },
  'mont-saint-michel': { author: 'Diliff', license: 'Domaine public', url: 'https://commons.wikimedia.org/wiki/File:Mont_St_Michel_3,_Brittany,_France_-_July_2011.jpg' },
  'pantheon-rome': { author: 'Wilfredor', license: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:Pantheon_(Rome),_Dome_interior.jpg' },
};

const building = (slug: string, name: string, info: string, country: string, funFact: string): Building =>
  ({ name, image: `/buildings/${slug}.webp`, info, country, funFact, credit: COMMONS[slug] });

const ALL_BUILDINGS: Building[] = [
  building('sydney-opera', 'Sydney Opera House', 'Sydney, Australie – 1973 – Arch. Jørn Utzon, voûtes en coquille de béton', '🇦🇺', 'Le toit est composé de 1 056 006 tuiles de céramique suédoise auto-nettoyantes.'),
  building('tour-eiffel', 'Tour Eiffel', 'Paris, France – 1889 – Structure en fer puddlé, 10 100 tonnes', '🇫🇷', 'La tour grandit de ~15 cm en été à cause de la dilatation thermique du métal.'),
  building('burj-khalifa', 'Burj Khalifa', 'Dubaï, EAU – 2010 – 828m, plus haut gratte-ciel du monde', '🇦🇪', 'On peut voir le coucher de soleil deux fois : en bas, puis en montant au sommet.'),
  building('sagrada-familia', 'Sagrada Familia', 'Barcelone, Espagne – depuis 1882 – Arch. Gaudí, colonnes arborescentes', '🇪🇸', 'La construction a duré plus longtemps que les pyramides d\'Égypte — et elle n\'est toujours pas finie.'),
  building('empire-state', 'Empire State Building', 'New York, USA – 1931 – Structure acier, 443m, style Art Déco', '🇺🇸', 'Il a été construit en seulement 410 jours, soit environ 4,5 étages par semaine.'),
  building('colisee', 'Colisée', 'Rome, Italie – 80 ap. J.-C. – Béton romain, 50 000 spectateurs', '🇮🇹', 'Les Romains pouvaient le remplir ou le vider en 15 minutes grâce à 80 entrées numérotées.'),
  building('taj-mahal', 'Taj Mahal', 'Agra, Inde – 1653 – Marbre blanc, symétrie parfaite', '🇮🇳', 'Le marbre blanc change de couleur selon l\'heure : rosé à l\'aube, blanc le jour, doré au coucher du soleil.'),
  building('guggenheim-bilbao', 'Guggenheim Bilbao', 'Bilbao, Espagne – 1997 – Arch. Frank Gehry, revêtement titane', '🇪🇸', 'Les 33 000 plaques de titane ne font que 0,38 mm d\'épaisseur — plus fin qu\'une feuille de papier cartonné.'),
  building('big-ben', 'Big Ben', 'Londres, Royaume-Uni – 1859 – Tour horloge néo-gothique, 96m', '🇬🇧', '"Big Ben" est en réalité le nom de la cloche de 13,7 tonnes, pas de la tour.'),
  building('marina-bay', 'Marina Bay Sands', 'Singapour – 2010 – Arch. Moshe Safdie, SkyPark de 340m', '🇸🇬', 'La piscine à débordement au sommet fait 150 mètres de long — 3 fois la longueur d\'une piscine olympique.'),
  building('petra', 'Petra', 'Jordanie – IVe siècle av. J.-C. – Taillé dans le grès rose', '🇯🇴', 'Seuls 15% du site ont été explorés par les archéologues — 85% reste sous terre.'),
  building('christ-redeemer', 'Christ Rédempteur', 'Rio de Janeiro, Brésil – 1931 – Béton armé et stéatite, 30m', '🇧🇷', 'La statue est frappée par la foudre en moyenne 6 fois par an.'),
  building('niteroi', "Musée d'Art Contemporain de Niterói", 'Niterói, Brésil – 1996 – Arch. Oscar Niemeyer, forme soucoupe en béton', '🇧🇷', 'Le bâtiment ne repose que sur un seul pilier central, comme une fleur sur sa tige.'),
  building('habitat-67', 'Habitat 67', 'Montréal, Canada – 1967 – Arch. Moshe Safdie, 354 cubes préfabriqués empilés', '🇨🇦', 'Le projet était la thèse de maîtrise de Safdie — il n\'avait que 23 ans quand il l\'a conçu.'),
  building('heydar-aliyev', 'Heydar Aliyev Center', 'Bakou, Azerbaïdjan – 2012 – Arch. Zaha Hadid, structure fluide sans angles', '🇦🇿', 'Le bâtiment ne contient aucun angle droit — toute la structure est composée de courbes continues.'),
  building('cctv', 'CCTV Headquarters', 'Pékin, Chine – 2012 – Arch. OMA/Rem Koolhaas, boucle structurelle en porte-à-faux', '🇨🇳', 'La boucle au sommet est un porte-à-faux de 75 mètres — soit la longueur de 2 piscines olympiques dans le vide.'),
  building('interlace', 'The Interlace', 'Singapour – 2013 – Arch. OMA/Ole Scheeren, 31 blocs empilés hexagonalement', '🇸🇬', 'Les 31 immeubles sont empilés en hexagone au lieu d\'être alignés, créant 8 cours intérieures géantes.'),
  building('lotus-temple', 'Lotus Temple', 'New Delhi, Inde – 1986 – Arch. Fariborz Sahba, 27 pétales de marbre blanc', '🇮🇳', 'Le temple accueille toutes les religions sans distinction — plus de 100 millions de personnes l\'ont visité.'),
  building('bosco-verticale', 'Bosco Verticale', 'Milan, Italie – 2014 – Arch. Stefano Boeri, 900 arbres sur les façades', '🇮🇹', 'Les 900 arbres sur les façades équivalent à 2 hectares de forêt — soit 3 terrains de football.'),
  building('elbphilharmonie', 'Elbphilharmonie', 'Hambourg, Allemagne – 2017 – Arch. Herzog & de Meuron, acoustique paramétrique', '🇩🇪', 'La salle de concert contient 10 000 panneaux acoustiques uniques, chacun sculpté par algorithme.'),
  building('atomium', 'Atomium', 'Bruxelles, Belgique – 1958 – Maille cristalline de fer agrandie 165 milliards de fois', '🇧🇪', 'L\'Atomium représente un cristal de fer agrandi 165 milliards de fois — chaque sphère fait 18 mètres de diamètre.'),
  // Ajoutés le 06/10/2026
  building('statue-liberte', 'Statue de la Liberté', 'New York, USA – 1886 – Bartholdi et Eiffel, cuivre sur structure de fer, 93 m avec le socle', '🇺🇸', 'Sa couleur verte vient de l\'oxydation du cuivre : à son inauguration, elle était brun cuivré.'),
  building('kheops', 'Pyramide de Khéops', 'Gizeh, Égypte – vers 2560 av. J.-C. – 146 m à l\'origine, environ 2,3 millions de blocs', '🇪🇬', 'Elle est restée la plus haute construction humaine pendant près de 3 800 ans.'),
  building('notre-dame', 'Notre-Dame de Paris', 'Paris, France – 1163-1345 – Gothique, arcs-boutants et rosaces', '🇫🇷', 'Après l\'incendie de 2019, sa flèche a été reconstruite à l\'identique ; la cathédrale a rouvert en décembre 2024.'),
  building('pise', 'Tour de Pise', 'Pise, Italie – 1173-1372 – Campanile en marbre blanc, 56 m', '🇮🇹', 'Elle a commencé à pencher dès sa construction, sur un sol trop mou ; des travaux (1990-2001) l\'ont redressée d\'environ 40 cm.'),
  building('parthenon', 'Parthénon', 'Athènes, Grèce – 438 av. J.-C. – Temple dorique en marbre, sur l\'Acropole', '🇬🇷', 'Ses colonnes sont légèrement bombées et penchées vers l\'intérieur pour paraître parfaitement droites.'),
  building('angkor-vat', 'Angkor Vat', 'Angkor, Cambodge – XIIe siècle – Temple khmer, plus grand monument religieux du monde', '🇰🇭', 'Il figure sur le drapeau du Cambodge : c\'est l\'un des rares bâtiments représentés sur un drapeau national.'),
  building('saint-basile', 'Cathédrale Saint-Basile', 'Moscou, Russie – 1561 – Neuf chapelles coiffées de bulbes colorés', '🇷🇺', 'Selon la légende, Ivan le Terrible aurait fait aveugler l\'architecte pour qu\'il ne bâtisse rien d\'aussi beau — aucune preuve ne l\'atteste.'),
  building('neuschwanstein', 'Château de Neuschwanstein', 'Bavière, Allemagne – 1869-1886 – Château néo-roman de Louis II', '🇩🇪', 'Il a inspiré le château de La Belle au bois dormant à Disneyland.'),
  building('sainte-sophie', 'Sainte-Sophie', 'Istanbul, Turquie – 537 – Coupole de 31 m sur pendentifs', '🇹🇷', 'Elle a été la plus grande cathédrale du monde pendant près de mille ans.'),
  building('chrysler', 'Chrysler Building', 'New York, USA – 1930 – Art déco, 319 m, couronne en acier inoxydable', '🇺🇸', 'Sa flèche a été assemblée en secret à l\'intérieur, puis hissée en 90 minutes pour dépasser un gratte-ciel concurrent.'),
  building('petronas', 'Tours Petronas', 'Kuala Lumpur, Malaisie – 1998 – Arch. César Pelli, 452 m', '🇲🇾', 'Une passerelle relie les deux tours aux 41e et 42e étages ; elles ont été les plus hautes du monde de 1998 à 2004.'),
  building('cn-tower', 'CN Tower', 'Toronto, Canada – 1976 – Tour de télécommunications en béton, 553 m', '🇨🇦', 'C\'est d\'abord une antenne : elle diffuse la radio et la télévision de Toronto. Elle a été la plus haute structure autoportante du monde pendant plus de 30 ans.'),
  building('space-needle', 'Space Needle', 'Seattle, USA – 1962 – Tour d\'observation de 184 m', '🇺🇸', 'Construite pour l\'Exposition universelle de 1962, elle a été achevée en seulement 400 jours.'),
  building('gherkin', 'The Gherkin (30 St Mary Axe)', 'Londres, Royaume-Uni – 2004 – Arch. Norman Foster, 180 m', '🇬🇧', 'Malgré sa forme arrondie, une seule vitre de la façade est courbe : la lentille tout en haut.'),
  building('taipei-101', 'Taipei 101', 'Taipei, Taïwan – 2004 – 508 m, 101 étages', '🇹🇼', 'Une boule d\'acier de 660 tonnes suspendue au sommet amortit les oscillations des typhons et des séismes.'),
  building('maison-dansante', 'Maison dansante', 'Prague, Tchéquie – 1996 – Arch. Frank Gehry et Vlado Milunić', '🇨🇿', 'Elle est surnommée « Ginger et Fred », en hommage au couple de danseurs Ginger Rogers et Fred Astaire.'),
  building('mont-saint-michel', 'Mont-Saint-Michel', 'Normandie, France – abbaye du VIIIe au XVIe siècle – Îlot rocheux au milieu d\'une baie', '🇫🇷', 'Les marées de la baie sont parmi les plus fortes d\'Europe : jusqu\'à 14 m d\'écart entre marée haute et marée basse.'),
  building('pantheon-rome', 'Panthéon de Rome', 'Rome, Italie – vers 125 ap. J.-C. – Coupole en béton de 43 m percée d\'un oculus', '🇮🇹', 'Près de 2 000 ans après, sa coupole reste la plus grande du monde en béton non armé.'),
];

const QUESTIONS_PER_GAME = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateChoices(correct: Building, all: Building[]): string[] {
  const others = shuffle(all.filter(b => b.name !== correct.name)).slice(0, 3).map(b => b.name);
  return shuffle([correct.name, ...others]);
}

const LS_KEY = 'guess-building-best';

const GuessBuilding: React.FC<GuessBuildingProps> = ({ onBack }) => {
  const [phase, setPhase] = useState<'playing' | 'feedback' | 'end'>('playing');
  const [questions, setQuestions] = useState<Building[]>(() => shuffle(ALL_BUILDINGS).slice(0, QUESTIONS_PER_GAME));
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState(() => {
    const s = localStorage.getItem(LS_KEY);
    return s ? parseInt(s, 10) : 0;
  });

  const current = questions[qIndex];
  const choices = useMemo(() => current ? generateChoices(current, ALL_BUILDINGS) : [], [current]);
  const isCorrect = selected === current?.name;

  // Photo suivante chargée pendant qu'on répond à celle-ci
  useEffect(() => {
    const next = questions[qIndex + 1];
    if (next) new Image().src = next.image;
  }, [questions, qIndex]);

  const handleAnswer = useCallback((choice: string) => {
    if (phase !== 'playing') return;
    setSelected(choice);
    if (choice === current.name) setScore(s => s + 1);
    setPhase('feedback');
  }, [phase, current]);

  const handleNext = useCallback(() => {
    const next = qIndex + 1;
    if (next >= questions.length) {
      const finalScore = score + (isCorrect ? 0 : 0);
      if (finalScore > bestScore) {
        localStorage.setItem(LS_KEY, String(finalScore));
        setBestScore(finalScore);
      }
      setPhase('end');
    } else {
      setQIndex(next);
      setSelected(null);
      setPhase('playing');
    }
  }, [qIndex, questions.length, score, isCorrect, bestScore]);

  const restart = useCallback(() => {
    setQuestions(shuffle(ALL_BUILDINGS).slice(0, QUESTIONS_PER_GAME));
    setQIndex(0);
    setScore(0);
    setSelected(null);
    setPhase('playing');
  }, []);

  const getRank = (s: number) => {
    if (s <= 3) return { label: 'Apprenti 🧱', color: 'text-muted-foreground' };
    if (s <= 7) return { label: 'Compagnon 🏗️', color: 'text-yellow-500' };
    return { label: "Maître d'œuvre 🏛️", color: 'text-primary' };
  };

  if (phase === 'end') {
    const rank = getRank(score);
    if (score > bestScore) {
      localStorage.setItem(LS_KEY, String(score));
    }
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6 max-w-lg mx-auto">
        <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-md p-8 shadow-lg w-full text-center">
          <h2 className="text-3xl font-black mb-2">Résultat</h2>
          <p className="text-5xl font-bold text-primary my-4">{score}/{questions.length}</p>
          <p className={`text-xl font-semibold ${rank.color} mb-1`}>{rank.label}</p>
          <p className="text-sm text-muted-foreground mb-6">Meilleur score : {Math.max(score, bestScore)}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={restart} className="gap-2"><RotateCcw className="h-4 w-4" /> Rejouer</Button>
            <Button variant="outline" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Mini-jeux</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <span className="text-sm text-foreground font-semibold font-mono">Question {qIndex + 1}/{questions.length}</span>
        <span className="text-sm font-bold text-primary">Score : {score}</span>
      </div>

      {/* Image : la photo entière (jamais coupée, même en hauteur), sur la même photo floutée qui remplit le cadre */}
      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-2xl border border-border overflow-hidden bg-muted shadow-lg aspect-video relative"
        >
          <img src={current.image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
          <img
            src={current.image}
            alt="Bâtiment à deviner"
            className="relative h-full w-full object-contain"
            loading="eager"
          />
          {phase === 'feedback' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[2px] ${isCorrect ? 'bg-primary/20' : 'bg-destructive/20'}`}
            >
              {isCorrect ? <CheckCircle className="h-16 w-16 text-primary mb-2" /> : <XCircle className="h-16 w-16 text-destructive mb-2" />}
              <p className="text-lg font-bold text-foreground drop-shadow-md">{current.name} {current.country}</p>
              <p className="text-sm text-foreground/80 font-medium drop-shadow-sm">{current.info}</p>
              {/* Fun fact bubble */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3 mx-4 max-w-sm bg-card/95 border border-primary/30 rounded-xl px-4 py-3 shadow-lg"
              >
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/90 font-medium leading-relaxed">{current.funFact}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Crédit de la photo, après la réponse (le lien donnerait la réponse avant) */}
      {phase === 'feedback' && current.credit && (
        <p className="-mt-2 w-full text-right text-[11px] text-muted-foreground">
          Photo : {current.credit.author} ·{' '}
          <a href={current.credit.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-primary hover:underline">
            {current.credit.license}
          </a>
          , via Wikimedia Commons (recadrée)
        </p>
      )}

      {/* Choices */}
      {phase === 'playing' ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          {choices.map((c) => (
            <Button
              key={c}
              variant="outline"
              onClick={() => handleAnswer(c)}
              className="h-auto py-3 text-sm font-medium hover:border-primary/60 hover:bg-primary/5 transition-all"
            >
              {c}
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={handleNext} className="gap-2 mt-2">
          {qIndex + 1 >= questions.length ? 'Voir le résultat' : 'Suivant'} <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
};

export default GuessBuilding;
