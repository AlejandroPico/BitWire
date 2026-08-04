import { describe, expect, it } from 'vitest';
import { EMBEDDED_CATALOG } from './catalog';

describe('expanded component catalog', () => {
  it('contains 216 unique, connectable vector components', () => {
    expect(EMBEDDED_CATALOG).toHaveLength(216);
    expect(new Set(EMBEDDED_CATALOG.map(item=>item.id)).size).toBe(216);
    expect(EMBEDDED_CATALOG.every(item=>item.pins.length>0)).toBe(true);
  });

  it('provides meaningful RF, sensor and power coverage', () => {
    const count=(category:string)=>EMBEDDED_CATALOG.filter(item=>item.category===category).length;
    expect(count('Radiofrecuencia')).toBeGreaterThan(20);
    expect(count('Sensores')).toBeGreaterThanOrEqual(20);
    expect(count('Gestión de potencia')).toBeGreaterThanOrEqual(15);
  });
});
