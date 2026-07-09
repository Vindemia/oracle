import type { Theme } from './theme.types.js';
import { neutralTheme } from './neutral.js';
import { oracleTheme } from './oracle.js';

export type { Theme, TermKey } from './theme.types.js';

/** Thème appliqué aux nouveaux comptes et tant qu'aucune préférence n'est connue. */
export const DEFAULT_THEME_ID = 'neutral';

/**
 * Registre statique des thèmes livrés avec le build — pas de fetch. Ajouter
 * un thème = ajouter une entrée ici (et son fichier `themes/<id>.ts`).
 */
export const THEMES: Record<string, Theme> = {
  [neutralTheme.id]: neutralTheme,
  [oracleTheme.id]: oracleTheme,
};

export const THEME_IDS = Object.keys(THEMES);

export function isThemeId(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}

export function getTheme(id: string): Theme {
  return THEMES[id] ?? neutralTheme;
}
