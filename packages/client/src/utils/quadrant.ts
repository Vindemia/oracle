import type { Quadrant } from '@/types';

export function getQuadrant(urgent: boolean, important: boolean): Quadrant {
  if (urgent && important) return 'FIRE';
  if (!urgent && important) return 'STARS';
  if (urgent && !important) return 'WIND';
  return 'MIST';
}

interface QuadrantMeta {
  label: string;
  description: string;
  icon: string;
  colorVar: string;
  bgVar: string;
  borderVar: string;
}

const QUADRANT_META: Record<Quadrant, QuadrantMeta> = {
  FIRE: {
    label: 'Feu Sacré',
    description: 'Urgent & Important',
    icon: '🔥',
    colorVar: '--quadrant-fire',
    bgVar: '--quadrant-fire-bg',
    borderVar: '--quadrant-fire-border',
  },
  STARS: {
    label: 'Étoiles',
    description: 'Important, non urgent',
    icon: '✨',
    colorVar: '--quadrant-stars',
    bgVar: '--quadrant-stars-bg',
    borderVar: '--quadrant-stars-border',
  },
  WIND: {
    label: 'Vent',
    description: 'Urgent, non important',
    icon: '💨',
    colorVar: '--quadrant-wind',
    bgVar: '--quadrant-wind-bg',
    borderVar: '--quadrant-wind-border',
  },
  MIST: {
    label: 'Brume',
    description: 'Ni urgent ni important',
    icon: '🌫️',
    colorVar: '--quadrant-mist',
    bgVar: '--quadrant-mist-bg',
    borderVar: '--quadrant-mist-border',
  },
};

export function getQuadrantLabel(quadrant: Quadrant): string {
  return QUADRANT_META[quadrant].label;
}

export function getQuadrantDescription(quadrant: Quadrant): string {
  return QUADRANT_META[quadrant].description;
}

export function getQuadrantIcon(quadrant: Quadrant): string {
  return QUADRANT_META[quadrant].icon;
}

export function getQuadrantColorVar(quadrant: Quadrant): string {
  return QUADRANT_META[quadrant].colorVar;
}

export function getQuadrantBgVar(quadrant: Quadrant): string {
  return QUADRANT_META[quadrant].bgVar;
}

export function getQuadrantBorderVar(quadrant: Quadrant): string {
  return QUADRANT_META[quadrant].borderVar;
}

export function getQuadrantMeta(quadrant: Quadrant): QuadrantMeta {
  return QUADRANT_META[quadrant];
}
