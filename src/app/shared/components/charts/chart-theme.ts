import type { Theme } from '../../../core/services/theme.service';

export interface ChartThemeColors {
  text: string;
  grid: string;
}

// Mirrors the Tailwind gray scale used by the cards in each theme.
export function chartThemeColors(theme: Theme): ChartThemeColors {
  return theme === 'dark'
    ? { text: '#d1d5db', grid: 'rgba(255, 255, 255, 0.08)' }
    : { text: '#4b5563', grid: 'rgba(0, 0, 0, 0.08)' };
}
