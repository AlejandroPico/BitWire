import type { Theme } from '../model/types';

export interface ThemeDefinition {
  id: Theme;
  label: string;
  shortLabel: string;
  description: string;
  palette: readonly [string, string, string];
}

export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  { id: 'auto', label: 'Automático', shortLabel: 'Auto', description: 'Mañana, tarde o noche según la hora local.', palette: ['#edf2ee', '#b66a35', '#10171d'] },
  { id: 'morning', label: 'Mañana', shortLabel: 'Mañana', description: 'Mesa clara y plano de alta legibilidad.', palette: ['#f3f0e8', '#d5dde0', '#233843'] },
  { id: 'afternoon', label: 'Tarde', shortLabel: 'Tarde', description: 'Tonos cálidos de cobre, papel y nogal.', palette: ['#e7cfaa', '#9b5f35', '#332117'] },
  { id: 'night', label: 'Noche', shortLabel: 'Noche', description: 'Negro técnico y contraste contenido.', palette: ['#090c10', '#26343d', '#cbd5db'] },
  { id: 'classic', label: 'BitWire clásico', shortLabel: 'Clásico', description: 'El aspecto azul petróleo original de BitWire.', palette: ['#07141f', '#17364a', '#2be4c4'] },
  { id: 'blueprint', label: 'Plano azul', shortLabel: 'Plano', description: 'Cianotipo azul cielo, líneas blancas y mobiliario de madera.', palette: ['#237cb5', '#f7fbff', '#71462c'] },
  { id: 'laboratory', label: 'Laboratorio', shortLabel: 'Laboratorio', description: 'Superficies blancas, acero y señalización científica.', palette: ['#f4f8f9', '#c7d5da', '#087d92'] },
  { id: 'terminal', label: 'Terminal', shortLabel: 'Terminal', description: 'Monitor fósforo verde y consola electrónica.', palette: ['#030906', '#143523', '#68f59a'] },
  { id: 'chalkboard', label: 'Pizarra', shortLabel: 'Pizarra', description: 'Pizarra verde, tiza y marco de madera oscura.', palette: ['#173d33', '#dce4cf', '#74462d'] },
  { id: 'parchment', label: 'Pergamino', shortLabel: 'Pergamino', description: 'Esquema clásico en tinta sepia sobre papel cálido.', palette: ['#ead9b5', '#8b6038', '#3f2b1f'] },
] as const;

export const PRIMARY_THEME_ORDER: readonly Theme[] = ['auto', 'morning', 'afternoon', 'night'];
export const THEME_STORAGE_KEY = 'bitwire:theme-mode';

export function resolveTheme(theme: Theme, date = new Date()): Exclude<Theme, 'auto'> {
  if (theme !== 'auto') return theme;
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 7 * 60 && minutes < 17 * 60) return 'morning';
  if (minutes >= 17 * 60 && minutes < 21 * 60) return 'afternoon';
  return 'night';
}

export function nextPrimaryTheme(theme: Theme): Theme {
  const index = PRIMARY_THEME_ORDER.indexOf(theme);
  return PRIMARY_THEME_ORDER[(index < 0 ? 0 : index + 1) % PRIMARY_THEME_ORDER.length];
}

export function themeDefinition(theme: Theme): ThemeDefinition {
  return THEME_DEFINITIONS.find(item => item.id === theme) ?? THEME_DEFINITIONS[0];
}

export function normalizeTheme(value: string | null | undefined): Theme | undefined {
  if (value === 'dark') return 'night';
  if (value === 'light') return 'morning';
  return THEME_DEFINITIONS.some(theme => theme.id === value) ? value as Theme : undefined;
}

export function loadThemePreference(): Theme {
  if (typeof localStorage === 'undefined') return 'auto';
  return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? 'auto';
}

export function saveThemePreference(theme: Theme): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, theme);
}
