import { describe,expect,it } from 'vitest';
import { nearestSegmentIndex, routeWire, wireLabelPoint } from './WireRouter';

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
  it('anchors a label to the routed cable instead of the endpoint midpoint',()=>{
    const point=wireLabelPoint({x:0,y:0},{x:100,y:0},'orthogonal',[{x:20,y:80}]);
    expect(point.y).toBeGreaterThan(20);
    expect(routeWire({x:0,y:0},{x:100,y:0},'orthogonal',[{x:20,y:80}])).toContain(`L 20 80`);
  });
  it('places Bézier labels on the sampled curve',()=>{
    const point=wireLabelPoint({x:0,y:0},{x:100,y:0},'bezier',[{x:50,y:100}]);
    expect(point.x).toBeCloseTo(50,1);
    expect(point.y).toBeGreaterThan(45);
  });
});
