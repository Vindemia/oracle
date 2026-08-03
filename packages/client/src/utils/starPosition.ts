/**
 * Position déterministe d'une étoile dans le ciel du mois (v3-05) — hash de
 * l'id de la vision → coordonnées stables entre deux rendus, deux visites.
 * Pas de hasard : le ciel ne doit jamais « bouger » d'une visite à l'autre.
 */
export interface StarPosition {
  x: number;
  y: number;
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Coordonnées en pourcentage (5..95 en x, 5..85 en y — marge pour éviter les bords). */
export function starPosition(id: string): StarPosition {
  const h = hash(id);
  const x = 5 + (h % 9001) / 100;
  const y = 5 + (Math.floor(h / 9001) % 8001) / 100;
  return { x, y };
}
