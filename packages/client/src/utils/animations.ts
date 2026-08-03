import type { ToastVariant } from '../context/ToastContext.js';
import type { Quadrant } from '../types/index.js';

/**
 * Renforcement immédiat (v3-05) : événement transverse unique dispatché par
 * useTasks() à chaque complétion, écouté par le Header pour animer l'icône
 * Constellation — un seul point de câblage plutôt qu'un écouteur par écran.
 */
export const STAR_PULSE_EVENT = 'oracle:star-pulse';

/**
 * Retourne le message de toast et la variante selon l'action + le quadrant.
 */
export function getCompleteToast(
  quadrant: Quadrant,
  isFirstOfDay: boolean,
  allDone: boolean,
): { message: string; variant: ToastVariant } {
  if (allDone) {
    return { message: '✧ Le ciel est dégagé ✧', variant: 'special' };
  }
  if (isFirstOfDay) {
    return { message: '🌅 Première vision du jour !', variant: 'info' };
  }
  switch (quadrant) {
    case 'FIRE': return { message: '🔥 Le feu est maîtrisé !', variant: 'fire' };
    case 'STARS': return { message: '✦ Vision accomplie !', variant: 'stars' };
    case 'WIND': return { message: '💨 Soufflé !', variant: 'wind' };
    case 'MIST': return { message: '🌫 Bien vu, une chose en moins !', variant: 'mist' };
  }
}

export function getEliminateToast(): { message: string; variant: ToastVariant } {
  return { message: '🌫 Bien vu, une chose en moins !', variant: 'mist' };
}

export function getErrorToast(): { message: string; variant: ToastVariant } {
  return { message: 'Une erreur est survenue, réessaie', variant: 'error' };
}
