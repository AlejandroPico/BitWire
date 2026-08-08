import { useMemo } from 'react';
import { CATALOG_BY_ID, effectiveDefinition } from '../catalog/catalog';
import { routeWire } from '../canvas/WireRouter';
import { descendantModules, respectsModuleBoundaries, wireOwnerModuleId } from '../model/moduleScope';
import type { BitWireProject, ModuleArea, ModulePin, PinRef, Point, SimulationSnapshot } from '../model/types';
import { CircuitSymbol } from './CircuitSymbol';
import { componentDisplayName } from '../model/componentIdentity';

interface Props {
  project: BitWireProject;
  module: ModuleArea;
  snapshot?: SimulationSnapshot;
  running:boolean;
  simulationSpeed:number;
  animateCurrent:boolean;
}

interface Bounds { x:number; y:number; width:number; height:number }

export function ModulePreview({ project, module, snapshot, running, simulationSpeed, animateCurrent }: Props) {
  const content = useMemo(() => {
    const descendants = descendantModules(project,module.id);
    const moduleIds = new Set([module.id,...descendants.map(item=>item.id)]);
    const componentIds = new Set([module,...descendants].flatMap(item=>item.memberIds));
    const components = project.components.filter(component=>componentIds.has(component.id));
    const endpointIds = new Set([...componentIds,...moduleIds]);
    const wires = project.wires.filter(wire=>respectsModuleBoundaries(project,wire)
      && endpointIds.has(wire.from.componentId) && endpointIds.has(wire.to.componentId));
    const points:Point[]=[];
    for(const component of components){
      const base=CATALOG_BY_ID.get(component.definitionId);if(!base)continue;const definition=effectiveDefinition(base,component.properties);
      const scale=component.scale||1;
      points.push({x:component.x,y:component.y},{x:component.x+definition.width*scale,y:component.y+definition.height*scale});
    }
    for(const wire of wires){
      const from=projectPinWorld(project,wire.from),to=projectPinWorld(project,wire.to);
      if(from)points.push(from);if(to)points.push(to);points.push(...(wire.controlPoints??[]));
    }
    if(!points.length)for(const child of descendants)points.push({x:child.x,y:child.y},{x:child.x+child.width,y:child.y+child.height});
    return { descendants,components,wires,bounds:boundsFor(points) };
  },[module,project]);

  const body={x:module.x+10,y:module.y+43,width:Math.max(1,module.width-20),height:Math.max(1,module.height-53)};
  const clipId=`module-preview-${module.id.replace(/[^a-zA-Z0-9_-]/g,'')}`;
  if(!content.bounds)return <g className="module-preview module-preview-empty" aria-hidden="true"><rect x={body.x} y={body.y} width={body.width} height={body.height}/><text x={body.x+body.width/2} y={body.y+body.height/2+3} textAnchor="middle">LIENZO INTERNO VACÍO</text></g>;
  const padding=Math.min(18,Math.max(5,Math.min(body.width,body.height)*.08));
  const availableWidth=Math.max(1,body.width-padding*2),availableHeight=Math.max(1,body.height-padding*2);
  const scale=Math.min(availableWidth/Math.max(1,content.bounds.width),availableHeight/Math.max(1,content.bounds.height));
  const contentCenter={x:content.bounds.x+content.bounds.width/2,y:content.bounds.y+content.bounds.height/2};
  const targetCenter={x:body.x+body.width/2,y:body.y+body.height/2};
  return <g className="module-preview" aria-hidden="true">
    <defs><clipPath id={clipId}><rect x={body.x} y={body.y} width={body.width} height={body.height}/></clipPath></defs>
    <rect className="module-preview-surface" x={body.x} y={body.y} width={body.width} height={body.height}/>
    <g clipPath={`url(#${clipId})`}>
      <g transform={`translate(${targetCenter.x} ${targetCenter.y}) scale(${scale}) translate(${-contentCenter.x} ${-contentCenter.y})`}>
        {content.descendants.map(child=><g className="module-preview-child" key={child.id}><rect x={child.x} y={child.y} width={child.width} height={child.height} style={{stroke:child.color}}/><text x={child.x+9} y={child.y+17} style={{fill:child.color}}>{child.name.toUpperCase()}</text></g>)}
        {content.wires.map(wire=>{
          const from=projectPinWorld(project,wire.from),to=projectPinWorld(project,wire.to);if(!from||!to)return null;
          const signal=snapshot?.wireSignals[wire.id],path=routeWire(from,to,wire.routing,wire.controlPoints),ownerId=wireOwnerModuleId(project,wire),color=project.modules.find(item=>item.id===ownerId)?.color??module.color;
          const offset=(signal?.current??0)>=0?-34:34,duration=currentFlowDuration(signal?.current??0,simulationSpeed);
          return <g key={wire.id} style={{'--wire-flow-color':color} as React.CSSProperties}><path className={`module-preview-wire ${signal?.active?'active':''}`} d={path}/>{animateCurrent&&running&&Math.abs(signal?.current??0)>1e-9&&<path className="module-preview-flow" d={path}><animate attributeName="stroke-dashoffset" from="0" to={String(offset)} dur={`${duration}s`} calcMode="linear" repeatCount="indefinite"/></path>}</g>;
        })}
        {content.components.map(component=>{
          const base=CATALOG_BY_ID.get(component.definitionId);if(!base)return null;const definition=effectiveDefinition(base,component.properties);
          return <CircuitSymbol key={component.id} component={component} definition={definition} selected={false} lod={1} signal={snapshot?.componentSignals[component.id]} componentLabel={componentDisplayName(project,component)}
            onPointerDown={()=>{}} onDoubleClick={()=>{}} onContextMenu={()=>{}} onPin={()=>{}} onQuickToggle={()=>{}} onProperty={()=>{}}/>;
        })}
      </g>
    </g>
    <path className="module-preview-frame" d={`M${body.x} ${body.y+12}v-12h12 M${body.x+body.width-12} ${body.y}h12v12 M${body.x} ${body.y+body.height-12}v12h12 M${body.x+body.width-12} ${body.y+body.height}h12v-12`}/>
  </g>;
}

function currentFlowDuration(current:number,speed:number){const magnitude=Math.abs(current),electrical=1.5/(1+Math.log10(1+magnitude*1000));return Math.max(.12,Math.min(12,electrical/Math.max(.01,speed)));}

function boundsFor(points:Point[]):Bounds|undefined {
  if(!points.length)return undefined;
  const minX=Math.min(...points.map(point=>point.x)),minY=Math.min(...points.map(point=>point.y));
  const maxX=Math.max(...points.map(point=>point.x)),maxY=Math.max(...points.map(point=>point.y));
  return {x:minX,y:minY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
}

function projectPinWorld(project:BitWireProject,ref:PinRef):Point|undefined {
  const component=project.components.find(item=>item.id===ref.componentId);
  if(component){
    const baseDefinition=CATALOG_BY_ID.get(component.definitionId),definition=baseDefinition?effectiveDefinition(baseDefinition,component.properties):undefined,pin=definition?.pins.find(item=>item.id===ref.pinId);
    if(!definition||!pin)return undefined;
    const base={x:pin.x*definition.width,y:pin.y*definition.height};
    const angle=component.rotation*Math.PI/180,cx=definition.width/2,cy=definition.height/2,scale=component.scale||1;
    return {x:component.x+(cx+(base.x-cx)*Math.cos(angle)-(base.y-cy)*Math.sin(angle))*scale,y:component.y+(cy+(base.x-cx)*Math.sin(angle)+(base.y-cy)*Math.cos(angle))*scale};
  }
  const targetModule=project.modules.find(item=>item.id===ref.componentId),pin=targetModule?.pins.find(item=>item.id===ref.pinId);
  return targetModule&&pin?modulePinWorld(targetModule,pin):undefined;
}

function modulePinWorld(module:ModuleArea,pin:ModulePin):Point {
  const position=Math.max(0,Math.min(1,pin.position));
  if(pin.side==='left')return{x:module.x,y:module.y+position*module.height};
  if(pin.side==='right')return{x:module.x+module.width,y:module.y+position*module.height};
  if(pin.side==='top')return{x:module.x+position*module.width,y:module.y};
  return{x:module.x+position*module.width,y:module.y+module.height};
}
