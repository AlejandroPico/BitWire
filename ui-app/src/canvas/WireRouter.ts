import type { Point, Wire } from '../model/types';

export function routeWire(from: Point, to: Point, routing: Wire['routing'], controlPoints: Point[] = []): string {
  if (routing === 'straight') return polyline([from, ...controlPoints, to]);
  if (routing === 'bezier') {
    if (controlPoints.length === 1) {
      const control = controlPoints[0];
      return `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
    }
    if (controlPoints.length > 1) return smoothBezier([from, ...controlPoints, to]);
    const distance = Math.abs(to.x - from.x);
    const bend = Math.max(48, distance * 0.45);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }
  if (controlPoints.length) {
    let d = `M ${from.x} ${from.y}`;
    let cursor = from;
    for (const point of [...controlPoints, to]) {
      const dx = Math.abs(point.x - cursor.x), dy = Math.abs(point.y - cursor.y);
      if (dx >= dy) d += ` L ${point.x} ${cursor.y} L ${point.x} ${point.y}`;
      else d += ` L ${cursor.x} ${point.y} L ${point.x} ${point.y}`;
      cursor = point;
    }
    return d;
  }
  const midX = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

export function routePreview(from: Point, to: Point): string {
  const midX = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

function polyline(points: Point[]): string {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

function smoothBezier(points: Point[]): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index], next = points[index + 1];
    const mid = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    d += ` Q ${point.x} ${point.y} ${mid.x} ${mid.y}`;
  }
  const penultimate = points[points.length - 2], last = points[points.length - 1];
  return `${d} Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`;
}

export function nearestSegmentIndex(points: Point[], target: Point): number {
  let bestIndex = 0, bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(target, points[index], points[index + 1]);
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
  }
  return bestIndex;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (!dx && !dy) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
