import type { Point, ViewportState } from '../model/types';

export const MIN_ZOOM = 0.035;
export const MAX_ZOOM = 32;

export function screenToWorld(point: Point, viewport: ViewportState): Point {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function worldToScreen(point: Point, viewport: ViewportState): Point {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

export function zoomAt(viewport: ViewportState, screenPoint: Point, factor: number): ViewportState {
  const world = screenToWorld(screenPoint, viewport);
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.scale * factor));
  return {
    scale,
    x: screenPoint.x - world.x * scale,
    y: screenPoint.y - world.y * scale,
  };
}

export function fitBounds(
  bounds: { x: number; y: number; width: number; height: number },
  viewportSize: { width: number; height: number },
  padding = 100,
): ViewportState {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
    Math.min((viewportSize.width - padding * 2) / Math.max(bounds.width, 1),
      (viewportSize.height - padding * 2) / Math.max(bounds.height, 1))));
  return {
    scale,
    x: viewportSize.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: viewportSize.height / 2 - (bounds.y + bounds.height / 2) * scale,
  };
}

