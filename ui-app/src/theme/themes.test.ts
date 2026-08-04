import { describe, expect, it } from 'vitest';
import { nextPrimaryTheme, normalizeTheme, resolveTheme } from './themes';

describe('temas de BitWire', () => {
  it('resuelve el modo automático con la hora local', () => {
    expect(resolveTheme('auto', new Date(2026, 7, 5, 8))).toBe('morning');
    expect(resolveTheme('auto', new Date(2026, 7, 5, 18))).toBe('afternoon');
    expect(resolveTheme('auto', new Date(2026, 7, 5, 23))).toBe('night');
  });

  it('limita el clic normal a los cuatro temas cotidianos', () => {
    expect(nextPrimaryTheme('auto')).toBe('morning');
    expect(nextPrimaryTheme('morning')).toBe('afternoon');
    expect(nextPrimaryTheme('afternoon')).toBe('night');
    expect(nextPrimaryTheme('night')).toBe('auto');
    expect(nextPrimaryTheme('blueprint')).toBe('auto');
  });

  it('migra los nombres de los temas antiguos', () => {
    expect(normalizeTheme('dark')).toBe('night');
    expect(normalizeTheme('light')).toBe('morning');
    expect(normalizeTheme('desconocido')).toBeUndefined();
  });
});
