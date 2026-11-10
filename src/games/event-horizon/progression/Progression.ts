export type UpgradeId = 'scanner' | 'engines' | 'energy' | 'shield';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  cost: number;
  description: string;
}

export const UPGRADES: Upgrade[] = [
  { id: 'scanner', name: 'Scanner à synthèse d’ouverture', cost: 30, description: 'Portée d’analyse +60 %, analyse presque deux fois plus rapide, détection des objets non catalogués deux fois plus loin.' },
  { id: 'engines', name: 'Tuyères à haut rendement', cost: 40, description: 'Poussée +40 %, vitesse maximale +30 % en impulsion comme en croisière.' },
  { id: 'energy', name: 'Accumulateurs supraconducteurs', cost: 35, description: 'Réserve d’énergie portée à 160 %, recharge plus rapide. Le surrégime dure plus longtemps.' },
  { id: 'shield', name: 'Blindage antiradiation', cost: 50, description: 'La zone où les radiations de NEMESIS-01 vident l’énergie de bord est repoussée tout près du disque.' },
];

const KEY = 'event-horizon-upgrades';

/** Progression par la recherche : les analyses rapportent des points, dépensés en équipements. */
export class Progression {
  private owned = new Set<UpgradeId>();

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) saved.forEach((id) => UPGRADES.some((u) => u.id === id) && this.owned.add(id));
    } catch { /* stockage indisponible ou corrompu */ }
  }

  has(id: UpgradeId) { return this.owned.has(id); }
  list() { return [...this.owned]; }
  spent() { return UPGRADES.filter((u) => this.owned.has(u.id)).reduce((sum, u) => sum + u.cost, 0); }

  /** @param earned total des points gagnés par les analyses */
  buy(id: UpgradeId, earned: number) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade || this.owned.has(id) || earned - this.spent() < upgrade.cost) return false;
    this.owned.add(id);
    try { localStorage.setItem(KEY, JSON.stringify(this.list())); } catch { /* stockage indisponible */ }
    return true;
  }

  get scanRange() { return this.has('scanner') ? 1.6 : 1; }
  get scanDuration() { return this.has('scanner') ? 1.7 : 3; }
  get detectRange() { return this.has('scanner') ? 2 : 1; }
  get thrust() { return this.has('engines') ? 1.4 : 1; }
  get topSpeed() { return this.has('engines') ? 1.3 : 1; }
  get energyMax() { return this.has('energy') ? 160 : 100; }
  get energyRegen() { return this.has('energy') ? 11 : 7; }
  /** Rayon de la zone de radiations, en rayons de Schwarzschild. */
  get radiationZone() { return this.has('shield') ? 3.6 : 9.5; }
}
