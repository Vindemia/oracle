/**
 * Mots de l'Oracle (v3-03) — la phrase qui clôt le Rituel de l'Aube.
 *
 * Règle du chantier v3 : jamais de punition, jamais d'injonction à la
 * performance. Aucune phrase ne doit culpabiliser un jour vide, ni promettre
 * une récompense conditionnée au fait de tout finir.
 */
const ORACLE_WORDS = [
  'Trois pas valent mieux que trente intentions.',
  "Ce que tu commences aujourd'hui n'a pas besoin d'être fini aujourd'hui.",
  'La brume se lève sur ce que tu regardes.',
  'Le peu que tu choisis pèse plus que tout ce que tu remets.',
  'Une vision tenue en éclaire dix autres.',
  "L'ordre naît du premier geste, jamais de la liste.",
  'Tu as le droit de faire court.',
  "Ce jour n'attend rien de toi qu'un début.",
  'Ce qui compte tient dans une main.',
  'Avance à la lumière que tu as, pas à celle que tu voudrais.',
  "Le temps que tu ne comptes pas t'appartient quand même.",
  'Un jour sans étoile reste un jour.',
  'Commence par le plus proche, pas par le plus grand.',
  "L'imparfait accompli vaut mieux que le parfait rêvé.",
  'Ta journée ne se juge pas, elle se traverse.',
  'Ce que tu laisses de côté ne disparaît pas — il attend.',
  'Le vent emporte ce qui n\'avait pas besoin de toi.',
  'Rien ne presse autant que ça en a l\'air.',
  'Fais une chose, entièrement.',
  'Le premier fragment ouvre la voie au reste.',
  'Tu reviendras demain, et ce sera assez.',
  'La constance est plus douce que l\'élan.',
] as const;

/**
 * Une phrase tirée au hasard. `seed` permet d'ancrer le tirage (test, ou
 * même mot pour toute la journée si un jour on le souhaite).
 */
export function pickOracleWord(seed = Math.random()): string {
  const index = Math.floor(seed * ORACLE_WORDS.length) % ORACLE_WORDS.length;
  return ORACLE_WORDS[index] ?? ORACLE_WORDS[0];
}

export const ORACLE_WORDS_COUNT = ORACLE_WORDS.length;
