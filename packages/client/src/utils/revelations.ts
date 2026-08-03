/**
 * Révélation rare (v3-05) — renforcement intermittent : à chaque complétion,
 * ~20% de chance d'un mot rare de l'Oracle. Jamais deux dans la même heure
 * (garde-fou localStorage). Ratio volontairement non annoncé côté UI.
 *
 * Écart connu vs. spec : le Prisme sensoriel (v3-11, réglage `predictability`
 * qui remplacerait le tirage par un compteur fixe annoncé) n'est pas livré —
 * seul le tirage variable de base est implémenté ici. Cf. specs/features/v3/05-constellation-done.md.
 */

export const REVELATIONS: readonly string[] = [
  "Ce que tu accomplis en silence compte autant que ce que l'on voit.",
  "Chaque étoile allumée est déjà un ciel plus clair.",
  "Tu n'as pas besoin d'un lendemain parfait pour que celui-ci compte.",
  "L'Oracle ne demande pas la constance, seulement la présence.",
  'Une vision de plus, une brume de moins.',
  "Ce qui est fait ne peut plus être défait — savoure-le.",
  'Le ciel ne juge pas les nuits nuageuses.',
  "Ton rythme est le bon rythme, tant qu'il avance.",
  "Il n'y a pas de petite victoire, seulement des victoires.",
  'Chaque jour actif est une pierre posée, jamais reprise.',
  "L'Oracle a vu : tu as choisi d'agir plutôt que d'attendre.",
  "Ce que tu élagues aujourd'hui, tu ne le porteras plus demain.",
  'Les Étoiles ne comptent pas les jours manquants — seulement les jours vécus.',
  "Un pas de plus vers ce qui compte pour toi.",
  "Ta constellation grandit, elle ne rétrécit jamais.",
  'La brume recule un peu plus à chaque choix assumé.',
  "L'Oracle murmure : continue, sans te presser.",
  'Ce moment, tu te le dois entièrement.',
  "Rien de grand ne se construit d'un seul geste — celui-ci y contribue.",
  'Ton attention est rare — merci de l\'avoir offerte ici.',
  'Les visions accomplies dessinent une trajectoire, jamais un jugement.',
  "Aujourd'hui, tu as choisi de faire plutôt que de subir.",
  'Une lumière de plus dans ton ciel personnel.',
  "L'Oracle ne compare jamais un mois à un autre — chacun a sa propre lumière.",
  'Ce que tu viens de faire ne se refera jamais tout à fait pareil.',
  'Ton énergie du jour a trouvé où se poser.',
  "Continuer, même doucement, c'est déjà avancer.",
  'Chaque vision achevée est une preuve, pas une exception.',
  "L'Oracle salue ce que tu viens d'accomplir.",
  'Un fragment de plus dans une histoire qui reste la tienne.',
  "Ce qui compte n'est pas la vitesse, mais la direction.",
  'Ton ciel se souvient de tout ce que tu y as allumé.',
];

const REVELATION_STORAGE_KEY = 'oracle:lastRevelationAt';
const REVELATION_COOLDOWN_MS = 60 * 60 * 1000;
const REVELATION_CHANCE = 0.2;

export function pickRevelation(rng: () => number = Math.random): string {
  const idx = Math.floor(rng() * REVELATIONS.length);
  return REVELATIONS[Math.min(idx, REVELATIONS.length - 1)] ?? REVELATIONS[0] ?? '✦';
}

/** Sous-ensemble de `Storage` dont a besoin le garde-fou — isolable en test. */
export interface RevelationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Tire une révélation rare (~20%), sauf si une autre a déjà eu lieu dans
 * l'heure écoulée. Retourne `null` si rien ne doit s'afficher. Effet de bord :
 * pose le garde-fou en storage en cas de tirage gagnant. `storage` par défaut
 * = `window.localStorage`, injectable en test (isole le hasard ET le storage).
 */
export function rollRevelation(
  now = Date.now(),
  rng: () => number = Math.random,
  storage: RevelationStorage = window.localStorage,
): string | null {
  const stored = storage.getItem(REVELATION_STORAGE_KEY);
  const last = stored === null ? -Infinity : Number(stored);
  if (now - last < REVELATION_COOLDOWN_MS) return null;
  if (rng() >= REVELATION_CHANCE) return null;
  storage.setItem(REVELATION_STORAGE_KEY, now.toString());
  return pickRevelation(rng);
}
