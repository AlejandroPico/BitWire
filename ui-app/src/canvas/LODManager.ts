export type LodLevel = 0 | 1 | 2 | 3 | 4;

export interface LodDescriptor {
  level: LodLevel;
  name: string;
  detail: string;
}

const LEVELS: LodDescriptor[] = [
  { level: 0, name: 'Encapsulado', detail: 'Bloques y conectores' },
  { level: 1, name: 'Esquemático', detail: 'Símbolo y valores esenciales' },
  { level: 2, name: 'Funcional', detail: 'Pines, señales y bloques internos' },
  { level: 3, name: 'Dispositivo', detail: 'Transistores y red interna' },
  { level: 4, name: 'Físico', detail: 'Parámetros editables y modelo' },
];

export function lodForScale(scale: number): LodDescriptor {
  if (scale < 0.45) return LEVELS[0];
  if (scale < 1.4) return LEVELS[1];
  if (scale < 3) return LEVELS[2];
  if (scale < 7) return LEVELS[3];
  return LEVELS[4];
}

export function detailOpacity(scale: number, threshold: number): number {
  return Math.max(0, Math.min(1, (scale - threshold) / Math.max(0.35, threshold * 0.4)));
}

