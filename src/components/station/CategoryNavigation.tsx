import { useTranslation } from 'react-i18next';
import { TOOLS } from '@/data/tools';

/* ───────────────────────────────────────────────────────────────
   CategoryNavigation : les filtres de catégories de la section Outils.
   Dans la station, un filtre emmène la caméra jusqu'au module de la catégorie
   (en survolant tout le trajet, sans saut) ; « Tous » mène à la vue finale.
   Le filtre du module visité s'allume pendant le défilement.
   ─────────────────────────────────────────────────────────────── */

const CATEGORIES = Array.from(new Set(TOOLS.map((tool) => tool.category)));
const count = (cat: string) => (cat === 'all' ? TOOLS.length : TOOLS.filter((tool) => tool.category === cat).length);

interface Props {
  active: readonly string[];         // catégories allumées ('all' pour la vue finale)
  onSelect: (category: string) => void;
  className?: string;
  /** Mode filtre (grille de secours) : aria-pressed au lieu de aria-current */
  filter?: boolean;
}

const CategoryNavigation = ({ active, onSelect, className = '', filter = false }: Props) => {
  const { t } = useTranslation();
  return (
    <nav className={className} aria-label={t('home.toolsTitle')}>
      <ul className="flex gap-2">
        {['all', ...CATEGORIES].map((cat) => {
          const on = active.includes(cat);
          return (
            <li key={cat} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(cat)}
                aria-pressed={filter ? on : undefined}
                aria-current={!filter && on ? 'location' : undefined}
                className={`station-chip ${on ? 'is-on' : ''}`}
              >
                {cat === 'all' ? t('home.allTools') : t(`home.categories.${cat}`)}
                <span className="ml-2 opacity-60">{count(cat)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default CategoryNavigation;
