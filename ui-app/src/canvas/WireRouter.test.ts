import { describe,expect,it } from 'vitest';
import { nearestSegmentIndex, routeWire } from './WireRouter';

describe('editable wire routing',()=>{
  it('routes an orthogonal wire through user-authored bend nodes',()=>{
    const path=routeWire({x:0,y:0},{x:100,y:100},'orthogonal',[{x:30,y:70}]);
    expect(path).toContain('L 0 70');
    expect(path).toContain('L 30 70');
  });
  it('uses a user node as a Bézier control point',()=>{
    expect(routeWire({x:0,y:0},{x:100,y:0},'bezier',[{x:50,y:80}])).toContain('Q 50 80');
  });
  it('inserts nodes into the nearest segment',()=>{
    expect(nearestSegmentIndex([{x:0,y:0},{x:50,y:0},{x:100,y:100}],{x:20,y:3})).toBe(0);
  });
});
