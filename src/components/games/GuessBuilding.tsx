import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, ChevronRight, Info } from 'lucide-react';

interface GuessBuildingProps {
  onBack: () => void;
}

interface Building {
  name: string;
  image: string;
  info: string;
  country: string;
  funFact: string;
}

const ALL_BUILDINGS: Building[] = [
  { name: 'Sydney Opera House', image: '/buildings/sydney-opera.webp', info: 'Sydney, Australie – 1973 – Arch. Jørn Utzon, voûtes en coquille de béton', country: '🇦🇺', funFact: 'Le toit est composé de 1 056 006 tuiles de céramique suédoise auto-nettoyantes.' },
  { name: 'Tour Eiffel', image: '/buildings/tour-eiffel.webp', info: 'Paris, France – 1889 – Structure en fer puddlé, 10 100 tonnes', country: '🇫🇷', funFact: 'La tour grandit de ~15 cm en été à cause de la dilatation thermique du métal.' },
  { name: 'Burj Khalifa', image: '/buildings/burj-khalifa.webp', info: 'Dubaï, EAU – 2010 – 828m, plus haut gratte-ciel du monde', country: '🇦🇪', funFact: 'On peut voir le coucher de soleil deux fois : en bas, puis en montant au sommet.' },
  { name: 'Sagrada Familia', image: '/buildings/sagrada-familia.webp', info: 'Barcelone, Espagne – depuis 1882 – Arch. Gaudí, colonnes arborescentes', country: '🇪🇸', funFact: 'La construction a duré plus longtemps que les pyramides d\'Égypte — et elle n\'est toujours pas finie.' },
  { name: 'Empire State Building', image: '/buildings/empire-state.webp', info: 'New York, USA – 1931 – Structure acier, 443m, style Art Déco', country: '🇺🇸', funFact: 'Il a été construit en seulement 410 jours, soit environ 4,5 étages par semaine.' },
  { name: 'Colisée', image: '/buildings/colisee.webp', info: 'Rome, Italie – 80 ap. J.-C. – Béton romain, 50 000 spectateurs', country: '🇮🇹', funFact: 'Les Romains pouvaient le remplir ou le vider en 15 minutes grâce à 80 entrées numérotées.' },
  { name: 'Taj Mahal', image: '/buildings/taj-mahal.webp', info: 'Agra, Inde – 1653 – Marbre blanc, symétrie parfaite', country: '🇮🇳', funFact: 'Le marbre blanc change de couleur selon l\'heure : rosé à l\'aube, blanc le jour, doré au coucher du soleil.' },
  { name: 'Guggenheim Bilbao', image: '/buildings/guggenheim-bilbao.webp', info: 'Bilbao, Espagne – 1997 – Arch. Frank Gehry, revêtement titane', country: '🇪🇸', funFact: 'Les 33 000 plaques de titane ne font que 0,38 mm d\'épaisseur — plus fin qu\'une feuille de papier cartonné.' },
  { name: 'Big Ben', image: '/buildings/big-ben.webp', info: 'Londres, Royaume-Uni – 1859 – Tour horloge néo-gothique, 96m', country: '🇬🇧', funFact: '"Big Ben" est en réalité le nom de la cloche de 13,7 tonnes, pas de la tour.' },
  { name: 'Marina Bay Sands', image: '/buildings/marina-bay.webp', info: 'Singapour – 2010 – Arch. Moshe Safdie, SkyPark de 340m', country: '🇸🇬', funFact: 'La piscine à débordement au sommet fait 150 mètres de long — 3 fois la longueur d\'une piscine olympique.' },
  { name: 'Petra', image: '/buildings/petra.webp', info: 'Jordanie – IVe siècle av. J.-C. – Taillé dans le grès rose', country: '🇯🇴', funFact: 'Seuls 15% du site ont été explorés par les archéologues — 85% reste sous terre.' },
  { name: 'Christ Rédempteur', image: '/buildings/christ-redeemer.webp', info: 'Rio de Janeiro, Brésil – 1931 – Béton armé et stéatite, 30m', country: '🇧🇷', funFact: 'La statue est frappée par la foudre en moyenne 6 fois par an.' },
  { name: "Musée d'Art Contemporain de Niterói", image: '/buildings/niteroi.webp', info: 'Niterói, Brésil – 1996 – Arch. Oscar Niemeyer, forme soucoupe en béton', country: '🇧🇷', funFact: 'Le bâtiment ne repose que sur un seul pilier central, comme une fleur sur sa tige.' },
  { name: 'Habitat 67', image: '/buildings/habitat-67.webp', info: 'Montréal, Canada – 1967 – Arch. Moshe Safdie, 354 cubes préfabriqués empilés', country: '🇨🇦', funFact: 'Le projet était la thèse de maîtrise de Safdie — il n\'avait que 23 ans quand il l\'a conçu.' },
  { name: 'Heydar Aliyev Center', image: '/buildings/heydar-aliyev.webp', info: 'Bakou, Azerbaïdjan – 2012 – Arch. Zaha Hadid, structure fluide sans angles', country: '🇦🇿', funFact: 'Le bâtiment ne contient aucun angle droit — toute la structure est composée de courbes continues.' },
  { name: 'CCTV Headquarters', image: '/buildings/cctv.webp', info: 'Pékin, Chine – 2012 – Arch. OMA/Rem Koolhaas, boucle structurelle en porte-à-faux', country: '🇨🇳', funFact: 'La boucle au sommet est un porte-à-faux de 75 mètres — soit la longueur de 2 piscines olympiques dans le vide.' },
  { name: 'The Interlace', image: '/buildings/interlace.webp', info: 'Singapour – 2013 – Arch. OMA/Ole Scheeren, 31 blocs empilés hexagonalement', country: '🇸🇬', funFact: 'Les 31 immeubles sont empilés en hexagone au lieu d\'être alignés, créant 8 cours intérieures géantes.' },
  { name: 'Lotus Temple', image: '/buildings/lotus-temple.webp', info: 'New Delhi, Inde – 1986 – Arch. Fariborz Sahba, 27 pétales de marbre blanc', country: '🇮🇳', funFact: 'Le temple accueille toutes les religions sans distinction — plus de 100 millions de personnes l\'ont visité.' },
  { name: 'Bosco Verticale', image: '/buildings/bosco-verticale.webp', info: 'Milan, Italie – 2014 – Arch. Stefano Boeri, 900 arbres sur les façades', country: '🇮🇹', funFact: 'Les 900 arbres sur les façades équivalent à 2 hectares de forêt — soit 3 terrains de football.' },
  { name: 'Elbphilharmonie', image: '/buildings/elbphilharmonie.webp', info: 'Hambourg, Allemagne – 2017 – Arch. Herzog & de Meuron, acoustique paramétrique', country: '🇩🇪', funFact: 'La salle de concert contient 10 000 panneaux acoustiques uniques, chacun sculpté par algorithme.' },
  { name: 'Musée National du Qatar', image: '/buildings/musee-qatar.webp', info: 'Doha, Qatar – 2019 – Arch. Jean Nouvel, rose des sables géante en béton', country: '🇶🇦', funFact: 'La structure est composée de 539 disques de béton de différentes tailles, imitant une rose des sables naturelle.' },
  { name: 'Atomium', image: '/buildings/atomium.webp', info: 'Bruxelles, Belgique – 1958 – Maille cristalline de fer agrandie 165 milliards de fois', country: '🇧🇪', funFact: 'L\'Atomium représente un cristal de fer agrandi 165 milliards de fois — chaque sphère fait 18 mètres de diamètre.' },
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <span className="text-sm text-foreground font-semibold font-mono">Question {qIndex + 1}/{questions.length}</span>
        <span className="text-sm font-bold text-primary">Score : {score}</span>
      </div>

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-2xl border border-border overflow-hidden bg-muted shadow-lg aspect-video relative"
        >
          <img
            src={current.image}
            alt="Building"
            className="w-full h-full object-cover"
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
