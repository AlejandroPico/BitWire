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

/** Returns the half-length point of the path actually rendered on screen. */
export function wireLabelPoint(from: Point, to: Point, routing: Wire['routing'], controlPoints: Point[] = []): Point {
  const points = sampledRoute(from,to,routing,controlPoints);
  if(points.length<2)return from;
  const lengths=points.slice(1).map((point,index)=>Math.hypot(point.x-points[index].x,point.y-points[index].y));
  const target=lengths.reduce((sum,length)=>sum+length,0)/2;
  let travelled=0;
  for(let index=0;index<lengths.length;index+=1){
    const length=lengths[index];
    if(travelled+length>=target){
      const ratio=length?((target-travelled)/length):0;
      return {x:points[index].x+(points[index+1].x-points[index].x)*ratio,y:points[index].y+(points[index+1].y-points[index].y)*ratio};
    }
    travelled+=length;
  }
  return points.at(-1) ?? to;
}

function sampledRoute(from:Point,to:Point,routing:Wire['routing'],controlPoints:Point[]):Point[] {
  if(routing==='straight')return [from,...controlPoints,to];
  if(routing==='orthogonal'){
    const result=[from];let cursor=from;
    for(const point of [...controlPoints,to]){
      if(Math.abs(point.x-cursor.x)>=Math.abs(point.y-cursor.y))result.push({x:point.x,y:cursor.y});
      else result.push({x:cursor.x,y:point.y});
      result.push(point);cursor=point;
    }
    return compactPoints(result);
  }
  if(controlPoints.length===1)return sampleQuadratic(from,controlPoints[0],to);
  if(controlPoints.length>1){
    const result:Point[]=[from];let start=from;
    for(let index=0;index<controlPoints.length-1;index+=1){
      const control=controlPoints[index],next=controlPoints[index+1];
      const end={x:(control.x+next.x)/2,y:(control.y+next.y)/2};
      result.push(...sampleQuadratic(start,control,end).slice(1));start=end;
    }
    result.push(...sampleQuadratic(start,controlPoints.at(-1)!,to).slice(1));
    return result;
  }
  const distance=Math.abs(to.x-from.x),bend=Math.max(48,distance*.45);
  return sampleCubic(from,{x:from.x+bend,y:from.y},{x:to.x-bend,y:to.y},to);
}

function sampleQuadratic(a:Point,c:Point,b:Point,steps=24):Point[]{return Array.from({length:steps+1},(_,index)=>{const t=index/steps,u=1-t;return{x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y};});}
function sampleCubic(a:Point,c1:Point,c2:Point,b:Point,steps=32):Point[]{return Array.from({length:steps+1},(_,index)=>{const t=index/steps,u=1-t;return{x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y};});}
function compactPoints(points:Point[]):Point[]{return points.filter((point,index)=>!index||point.x!==points[index-1].x||point.y!==points[index-1].y);}

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
