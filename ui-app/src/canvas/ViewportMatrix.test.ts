import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, zoomAt } from './ViewportMatrix';

describe('practical infinite zoom', () => {
  it('can zoom far beyond the former 32× ceiling while preserving the cursor anchor', () => {
    const pointer={x:400,y:250};
    const next=zoomAt({x:100,y:50,scale:32},pointer,1000);
    expect(next.scale).toBe(32000);
    expect((pointer.x-next.x)/next.scale).toBeCloseTo((pointer.x-100)/32,8);
    expect((pointer.y-next.y)/next.scale).toBeCloseTo((pointer.y-50)/32,8);
  });

  it('caps only at the browser-safe practical limit', () => {
    expect(zoomAt({x:0,y:0,scale:MAX_ZOOM}, {x:0,y:0}, 2).scale).toBe(MAX_ZOOM);
  });
});
