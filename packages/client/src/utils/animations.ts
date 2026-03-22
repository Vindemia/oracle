import type { ToastVariant } from '../context/ToastContext.js';
import type { Quadrant } from '../types/index.js';

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
