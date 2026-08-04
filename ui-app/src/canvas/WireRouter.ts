import type { Point, Wire } from '../model/types';

export function routeWire(from: Point, to: Point, routing: Wire['routing']): string {
  if (routing === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  if (routing === 'bezier') {
    const distance = Math.abs(to.x - from.x);
    const bend = Math.max(48, distance * 0.45);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }
  const midX = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

export function routePreview(from: Point, to: Point): string {
  const midX = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}
