import { Crosshair, Maximize, Minus, Plus, Route, Scan, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import { fitBounds, screenToWorld, zoomAt } from '../canvas/ViewportMatrix';
import { lodForScale } from '../canvas/LODManager';
import { nearestSegmentIndex, routePreview, routeWire } from '../canvas/WireRouter';
import { CircuitSymbol } from './CircuitSymbol';
import type {
  BitWireProject, ComponentInstance, ModuleArea, PinDefinition, PinRef, Point,
  ModulePin, PropertyValue, SimulationSnapshot, Theme, ToolMode, ViewportState, Wire, WireSignal,
} from '../model/types';
import { createInstance, uid } from '../state/project';

type Update = (recipe: (draft: BitWireProject) => void, record?: boolean) => void;

interface Props {
  project: BitWireProject;
  resolvedTheme: Exclude<Theme, 'auto'>;
  update: Update;
  selected: string[];
  onSelected(ids: string[]): void;
  selectedModuleId?: string;
  onSelectedModule(id?: string): void;
  tool: ToolMode;
  onTool(tool: ToolMode): void;
  snapshot?: SimulationSnapshot;
  running: boolean;
  onViewport(viewport: ViewportState): void;
  activeModuleId?: string;
  onActiveModule(id?: string): void;
  onOpenInspector(): void;
}

type Interaction =
  | { type: 'pan'; start: Point; origin: ViewportState }
  | { type: 'drag'; start: Point; origins: Map<string, Point>; recorded: boolean }
  | { type: 'module-drag'; start: Point; origin: Point; moduleId: string; recorded: boolean }
  | { type: 'module-resize'; start: Point; origin: { x: number; y: number; width: number; height: number }; moduleId: string; handle: string; recorded: boolean }
  | { type: 'wire-pending'; wireId: string; index: number; point: Point; startScreen: Point }
  | { type: 'wire-node'; wireId: string; index: number; recorded: boolean }
  | { type: 'marquee' | 'module'; start: Point; current: Point }
  | null;

export function Workspace({ project, resolvedTheme, update, selected, onSelected, selectedModuleId, onSelectedModule, tool, onTool, snapshot, running, onViewport, activeModuleId, onActiveModule, onOpenInspector }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewportState] = useState<ViewportState>({ x: 690, y: 270, scale: .78 });
  const [interaction, setInteraction] = useState<Interaction>(null);
  const interactionRef = useRef<Interaction>(null);
  const [pendingPin, setPendingPin] = useState<PinRef>();
  const [selectedWireId, setSelectedWireId] = useState<string>();
  const [pointerWorld, setPointerWorld] = useState<Point>({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const lod = lodForScale(viewport.scale);
  const selectedModule = project.modules.find(module => module.id === selectedModuleId);
  const activeModule = project.modules.find(module => module.id === activeModuleId);
  const childModules = useMemo(() => project.modules.filter(module => module.parentModuleId === activeModuleId), [project.modules, activeModuleId]);
  const ancestors = useMemo(() => {
    const path: ModuleArea[] = [];
    let cursor = activeModule;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) { visited.add(cursor.id); path.unshift(cursor); cursor = project.modules.find(module => module.id === cursor?.parentModuleId); }
    return path;
  }, [activeModule, project.modules]);
  const hiddenMemberIds = useMemo(() => new Set(project.modules.filter(module => module.collapsed && module.id !== activeModuleId && (!activeModuleId || module.parentModuleId === activeModuleId)).flatMap(module => module.memberIds)), [project.modules, activeModuleId]);
  const activeMemberIds = useMemo(() => activeModule ? new Set(activeModule.memberIds) : undefined, [activeModule]);
  const visibleComponents = useMemo(() => project.components.filter(component => activeMemberIds ? activeMemberIds.has(component.id) && !hiddenMemberIds.has(component.id) : !hiddenMemberIds.has(component.id)), [project.components, activeMemberIds, hiddenMemberIds]);
  const visibleWires = useMemo(() => project.wires.filter(wire => {
    if (activeMemberIds && activeModule) {
      const visibleEndpoints = new Set([activeModule.id, ...activeMemberIds, ...childModules.map(module => module.id)]);
      return [wire.from.componentId, wire.to.componentId].every(id => visibleEndpoints.has(id));
    }
    return !project.modules.some(module => module.collapsed && [wire.from.componentId, wire.to.componentId].every(id => module.memberIds.includes(id) || id === module.id));
  }), [project.wires, project.modules, activeMemberIds, activeModule, childModules]);

  const setCurrentInteraction = useCallback((value: Interaction) => {
    interactionRef.current = value;
    setInteraction(value);
  }, []);

  const setViewport = useCallback((next: ViewportState | ((current: ViewportState) => ViewportState)) => {
    setViewportState(current => {
      const value = typeof next === 'function' ? next(current) : next;
      onViewport(value);
      return value;
    });
  }, [onViewport]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === 'Space' && !isTyping(event.target)) { event.preventDefault(); setSpaceHeld(true); } };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const pinWorld = useCallback((ref: PinRef): Point | undefined => {
    const component = project.components.find(item => item.id === ref.componentId);
    const definition = component && CATALOG_BY_ID.get(component.definitionId);
    const pin = definition?.pins.find(item => item.id === ref.pinId);
    if (!component || !definition || !pin) {
      const module = project.modules.find(item => item.id === ref.componentId);
      const modulePin = module?.pins.find(item => item.id === ref.pinId);
      if (module && modulePin && module.id === activeModuleId && svgRef.current) {
        const width=svgRef.current.clientWidth, height=svgRef.current.clientHeight;
        const screenPoint = modulePin.side==='left' ? {x:1,y:modulePin.position*height} : modulePin.side==='right' ? {x:width-1,y:modulePin.position*height} : modulePin.side==='top' ? {x:modulePin.position*width,y:1} : {x:modulePin.position*width,y:height-1};
        return screenToWorld(screenPoint,viewport);
      }
      return module && modulePin ? modulePinWorld(module, modulePin) : undefined;
    }
    const base = { x: pin.x * definition.width, y: pin.y * definition.height };
    const angle = component.rotation * Math.PI / 180;
    const cx = definition.width / 2, cy = definition.height / 2;
    const scale = component.scale || 1;
    return {
      x: component.x + (cx + (base.x - cx) * Math.cos(angle) - (base.y - cy) * Math.sin(angle)) * scale,
      y: component.y + (cy + (base.x - cx) * Math.sin(angle) + (base.y - cy) * Math.cos(angle)) * scale,
    };
  }, [project.components, project.modules, activeModuleId, viewport]);

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = localPoint(event);
    const factor = Math.exp(-event.deltaY * .0015);
    setViewport(current => zoomAt(current, point, factor));
  };

  const onBackgroundDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const local = localPoint(event);
    const world = screenToWorld(local, viewport);
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedWireId(undefined);
    if (tool === 'pan' || event.button === 1 || spaceHeld) {
      setCurrentInteraction({ type: 'pan', start: local, origin: viewport });
    } else if (tool === 'module') {
      setCurrentInteraction({ type: 'module', start: world, current: world });
      onSelected([]); onSelectedModule(undefined);
    } else {
      setCurrentInteraction({ type: 'marquee', start: world, current: world });
      if (!event.shiftKey) { onSelected([]); onSelectedModule(undefined); }
      if (pendingPin) setPendingPin(undefined);
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const local = localPoint(event);
    const world = screenToWorld(local, viewport);
    setPointerWorld(world);
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;
    if (currentInteraction.type === 'pan') {
      setViewport({ ...currentInteraction.origin, x: currentInteraction.origin.x + local.x - currentInteraction.start.x, y: currentInteraction.origin.y + local.y - currentInteraction.start.y });
    } else if (currentInteraction.type === 'drag') {
      const dx = world.x - currentInteraction.start.x, dy = world.y - currentInteraction.start.y;
      const snap = project.settings.snapToGrid ? project.settings.gridSize : 1;
      update(draft => {
        for (const [id, origin] of currentInteraction.origins) {
          const component = draft.components.find(item => item.id === id);
          if (!component || component.locked) continue;
          component.x = Math.round((origin.x + dx) / snap) * snap;
          component.y = Math.round((origin.y + dy) / snap) * snap;
        }
      }, !currentInteraction.recorded);
      if (!currentInteraction.recorded) setCurrentInteraction({ ...currentInteraction, recorded: true });
    } else if (currentInteraction.type === 'module-drag') {
      const dx = world.x - currentInteraction.start.x, dy = world.y - currentInteraction.start.y;
      update(draft => {
        const module = draft.modules.find(item => item.id === currentInteraction.moduleId);
        if (!module) return;
        const moveX = currentInteraction.origin.x + dx - module.x;
        const moveY = currentInteraction.origin.y + dy - module.y;
        module.x += moveX; module.y += moveY;
        const descendantIds = new Set([module.id]);
        let changed=true;
        while(changed){changed=false;for(const child of draft.modules)if(child.parentModuleId&&descendantIds.has(child.parentModuleId)&&!descendantIds.has(child.id)){descendantIds.add(child.id);child.x+=moveX;child.y+=moveY;changed=true;}}
        for (const id of module.memberIds) { const component = draft.components.find(item => item.id === id); if (component) { component.x += moveX; component.y += moveY; } }
        for (const wire of draft.wires) if ([wire.from.componentId,wire.to.componentId].some(id => module.memberIds.includes(id) || id === module.id)) wire.controlPoints = wire.controlPoints?.map(point => ({ x: point.x + moveX, y: point.y + moveY }));
      }, !currentInteraction.recorded);
      if (!currentInteraction.recorded) setCurrentInteraction({ ...currentInteraction, recorded: true });
    } else if (currentInteraction.type === 'module-resize') {
      const dx = world.x - currentInteraction.start.x, dy = world.y - currentInteraction.start.y;
      update(draft => {
        const module = draft.modules.find(item => item.id === currentInteraction.moduleId);
        if (module) Object.assign(module, resizedRect(currentInteraction.origin, currentInteraction.handle, dx, dy));
      }, !currentInteraction.recorded);
      if (!currentInteraction.recorded) setCurrentInteraction({ ...currentInteraction, recorded: true });
    } else if (currentInteraction.type === 'wire-pending') {
      if (Math.hypot(local.x-currentInteraction.startScreen.x,local.y-currentInteraction.startScreen.y) >= 3) {
        update(draft=>{
          const wire=draft.wires.find(item=>item.id===currentInteraction.wireId);
          if(wire){ wire.controlPoints ??=[]; wire.controlPoints.splice(currentInteraction.index,0,world); }
        });
        setCurrentInteraction({type:'wire-node',wireId:currentInteraction.wireId,index:currentInteraction.index,recorded:true});
      }
    } else if (currentInteraction.type === 'wire-node') {
      update(draft => {
        const wire = draft.wires.find(item => item.id === currentInteraction.wireId);
        if (wire?.controlPoints?.[currentInteraction.index]) wire.controlPoints[currentInteraction.index] = world;
      }, !currentInteraction.recorded);
      if (!currentInteraction.recorded) setCurrentInteraction({ ...currentInteraction, recorded: true });
    } else {
      setCurrentInteraction({ ...currentInteraction, current: world });
    }
  };

  const finishInteraction = (event: React.PointerEvent<SVGSVGElement>) => {
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;
    if (currentInteraction.type === 'marquee' || currentInteraction.type === 'module') {
      const rect = normalizedRect(currentInteraction.start, currentInteraction.current);
      if (rect.width > 8 && rect.height > 8) {
        const memberIds = visibleComponents.filter(component => {
          const definition = CATALOG_BY_ID.get(component.definitionId);
          if (!definition) return false;
          const scale=component.scale||1;
          return intersects(rect, { x: component.x, y: component.y, width: definition.width*scale, height: definition.height*scale });
        }).map(component => component.id);
        if (currentInteraction.type === 'marquee') onSelected(memberIds);
        else {
          const module: ModuleArea = { id: uid('module'), name: `Encapsulado ${project.modules.length + 1}`, ...rect, color: '#7b8cff', memberIds, enabled: true, collapsed: false, pins: [], parentModuleId: activeModuleId };
          update(draft => { draft.modules.push(module); });
          onSelectedModule(module.id); onTool('select');
        }
      }
    }
    setCurrentInteraction(null);
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  };

  const onComponentDown = (event: React.PointerEvent<SVGGElement>, component: ComponentInstance) => {
    event.stopPropagation();
    if (tool === 'pan' || event.button === 1 || spaceHeld) {
      const local = localPoint(event);
      setCurrentInteraction({ type: 'pan', start: local, origin: viewport });
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    // A component body always remains draggable; wire mode only changes pin behaviour.
    const nextSelection = event.shiftKey
      ? selected.includes(component.id) ? selected.filter(id => id !== component.id) : [...selected, component.id]
      : selected.includes(component.id) ? selected : [component.id];
    onSelected(nextSelection); onSelectedModule(undefined);
    const world = screenToWorld(localPoint(event), viewport);
    const origins = new Map(nextSelection.map(id => {
      const item = project.components.find(node => node.id === id)!;
      return [id, { x: item.x, y: item.y }] as const;
    }));
    setCurrentInteraction({ type: 'drag', start: world, origins, recorded: false });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const connectPin = (next: PinRef) => {
    if (!pendingPin) { setPendingPin(next); onTool('wire'); return; }
    if (pendingPin.componentId === next.componentId && pendingPin.pinId === next.pinId) { setPendingPin(undefined); return; }
    const duplicate = project.wires.some(wire =>
      (wire.from.componentId === pendingPin.componentId && wire.from.pinId === pendingPin.pinId && wire.to.componentId === next.componentId && wire.to.pinId === next.pinId)
      || (wire.to.componentId === pendingPin.componentId && wire.to.pinId === pendingPin.pinId && wire.from.componentId === next.componentId && wire.from.pinId === next.pinId));
    if (!duplicate) update(draft => { draft.wires.push({ id: uid('wire'), from: pendingPin, to: next, routing: draft.settings.wireRouting }); });
    setPendingPin(undefined);
    onTool('select');
  };

  const onPin = (event: React.PointerEvent<SVGCircleElement>, component: ComponentInstance, pin: PinDefinition) => {
    event.stopPropagation();
    connectPin({ componentId: component.id, pinId: pin.id });
  };

  const quickToggle = (component: ComponentInstance) => update(draft => {
    const item = draft.components.find(node => node.id === component.id);
    const definition = CATALOG_BY_ID.get(component.definitionId);
    if (!item || !definition) return;
    if (definition.model === 'switch') item.properties.closed = !Boolean(item.properties.closed);
    if (definition.model === 'logic_input') item.properties.state = Number(item.properties.state) ? 0 : 1;
  });

  const openComponentInspector = (component: ComponentInstance) => { onSelected([component.id]); onSelectedModule(undefined); onOpenInspector(); };

  const fitProject = () => {
    const rect = svgRef.current!.getBoundingClientRect();
    if (!visibleComponents.length) { setViewport({ x: rect.width / 2, y: rect.height / 2, scale: 1 }); return; }
    const boxes = visibleComponents.map(component => { const d = CATALOG_BY_ID.get(component.definitionId)!; const scale = component.scale || 1; return { x: component.x, y: component.y, width: d.width * scale, height: d.height * scale }; });
    const minX = Math.min(...boxes.map(b => b.x)), minY = Math.min(...boxes.map(b => b.y));
    const maxX = Math.max(...boxes.map(b => b.x + b.width)), maxY = Math.max(...boxes.map(b => b.y + b.height));
    setViewport(fitBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, { width: rect.width, height: rect.height }, 110));
  };

  const navigateToModule = (id?:string) => {
    onActiveModule(id); onSelected([]); onSelectedModule(id);
    const rect=svgRef.current?.getBoundingClientRect();
    const module=id?project.modules.find(item=>item.id===id):undefined;
    if(rect&&module)setViewport(fitBounds(module,{width:rect.width,height:rect.height},90));
    else if(rect){const roots=project.modules.filter(item=>!item.parentModuleId);if(roots.length){const minX=Math.min(...roots.map(item=>item.x)),minY=Math.min(...roots.map(item=>item.y)),maxX=Math.max(...roots.map(item=>item.x+item.width)),maxY=Math.max(...roots.map(item=>item.y+item.height));setViewport(fitBounds({x:minX,y:minY,width:maxX-minX,height:maxY-minY},{width:rect.width,height:rect.height},80));}}
  };

  const addAt = (definitionId: string, world: Point) => {
    const definition = CATALOG_BY_ID.get(definitionId);
    if (!definition) return;
    const instanceScale = Math.max(1e-9, Math.min(20, 1 / viewport.scale));
    const component = createInstance(definitionId, world.x - definition.width * instanceScale / 2, world.y - definition.height * instanceScale / 2, uid('node'), instanceScale);
    update(draft => { draft.components.push(component); if (activeModuleId) draft.modules.find(module => module.id === activeModuleId)?.memberIds.push(component.id); });
    onSelected([component.id]); onSelectedModule(undefined);
  };

  const onModuleDown = (event: React.PointerEvent<SVGGElement>, module: ModuleArea) => {
    event.stopPropagation();
    onSelected([]); onSelectedModule(module.id); setSelectedWireId(undefined);
    if (tool !== 'select' || activeModuleId === module.id) return;
    const world = screenToWorld(localPoint(event), viewport);
    setCurrentInteraction({ type: 'module-drag', start: world, origin: { x: module.x, y: module.y }, moduleId: module.id, recorded: false });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onModuleResize = (event: React.PointerEvent<SVGRectElement>, module: ModuleArea, handle: string) => {
    event.stopPropagation();
    const world = screenToWorld(localPoint(event), viewport);
    setCurrentInteraction({ type: 'module-resize', start: world, origin: { x: module.x, y: module.y, width: module.width, height: module.height }, moduleId: module.id, handle, recorded: false });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onWireDown = (event: React.PointerEvent<SVGPathElement>, wire: Wire, from: Point, to: Point) => {
    event.stopPropagation();
    setSelectedWireId(wire.id); onSelected([]); onSelectedModule(undefined);
    if (event.detail > 1) return;
    const world = screenToWorld(localPoint(event), viewport);
    const points = [from, ...(wire.controlPoints ?? []), to];
    const index = nearestSegmentIndex(points, world);
    setCurrentInteraction({ type:'wire-pending',wireId:wire.id,index,point:world,startScreen:localPoint(event) });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const addWireNode = (event: React.MouseEvent<SVGPathElement>,wire:Wire,from:Point,to:Point) => {
    event.stopPropagation();
    const world=screenToWorld(localPoint(event),viewport);
    const index=nearestSegmentIndex([from,...(wire.controlPoints??[]),to],world);
    update(draft=>{const target=draft.wires.find(item=>item.id===wire.id);if(target){target.controlPoints??=[];target.controlPoints.splice(index,0,world);}});
    setSelectedWireId(wire.id);
  };

  const onWireNodeDown = (event: React.PointerEvent<SVGRectElement>, wireId: string, index: number) => {
    event.stopPropagation();
    setSelectedWireId(wireId);
    setCurrentInteraction({ type: 'wire-node', wireId, index, recorded: false });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const patchWire = (wireId: string, patch: Partial<Wire>) => update(draft => { const wire = draft.wires.find(item => item.id === wireId); if (wire) Object.assign(wire, patch); });
  const deleteWire = (wireId: string) => { update(draft => { draft.wires = draft.wires.filter(item => item.id !== wireId); }); setSelectedWireId(undefined); };

  const marquee = interaction && (interaction.type === 'marquee' || interaction.type === 'module') ? normalizedRect(interaction.start, interaction.current) : undefined;
  const pendingStart = pendingPin ? pinWorld(pendingPin) : undefined;

  const gridSize = adaptiveGrid(project.settings.gridSize, viewport.scale);
  const renderedWires = useMemo(() => visibleWires.map(wire => ({ wire, from: pinWorld(wire.from), to: pinWorld(wire.to) })), [visibleWires, pinWorld]);
  const selectedWire = project.wires.find(wire => wire.id === selectedWireId);
  const renderedModules = activeModule ? childModules : project.modules.filter(module => !module.parentModuleId);

  return <main className={`workspace theme-${resolvedTheme} tool-${tool} ${spaceHeld ? 'space-pan' : ''} ${activeModule ? 'inside-module' : ''}`}>
    <svg ref={svgRef} className="circuit-canvas" onWheel={onWheel} onPointerDown={onBackgroundDown} onPointerMove={onPointerMove} onPointerUp={finishInteraction} onPointerCancel={finishInteraction}
      onDragOver={event => { if (event.dataTransfer.types.includes('application/x-bitwire-component')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('application/x-bitwire-component'); addAt(id, screenToWorld(localPoint(event), viewport)); }}>
      <defs>
        <pattern id="minorGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} className="grid-minor"/></pattern>
        <pattern id="majorGrid" width={gridSize * 5} height={gridSize * 5} patternUnits="userSpaceOnUse"><rect width={gridSize * 5} height={gridSize * 5} fill="url(#minorGrid)"/><path d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`} className="grid-major"/></pattern>
        <filter id="signalGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
        <rect className="grid-plane" x={-100000} y={-100000} width={200000} height={200000} fill="url(#majorGrid)"/>
        <g className="module-layer">{renderedModules.map(module => <g key={module.id} className={`module-area ${module.collapsed ? 'chip-mode' : 'area-mode'} ${module.id === selectedModuleId ? 'selected' : ''} ${module.enabled ? '' : 'disabled'}`} onPointerDown={event => onModuleDown(event,module)} onDoubleClick={event => { event.stopPropagation(); navigateToModule(module.id); }}>
          <rect x={module.x} y={module.y} width={module.width} height={module.height} style={{ stroke: module.color }}/>
          <path d={`M${module.x} ${module.y + 34}h${module.width}`} style={{ stroke: module.color }}/>
          {module.collapsed && <>{Array.from({length:Math.max(2,Math.min(12,module.pins.length))},(_,index)=><path key={index} className="chip-decoration" d={`M${module.x+22+index*14} ${module.y+12}v10`} style={{stroke:module.color}}/>)}</>}
          <text x={module.x + 14} y={module.y + 23} style={{ fill: module.color }}>{module.name.toUpperCase()}</text><text className="module-state" x={module.x + module.width - 14} y={module.y + 23} textAnchor="end">{module.collapsed ? `${module.pins.length} PINES` : module.enabled ? 'ACTIVO' : 'AISLADO'}</text>
          {module.pins.map(pin => <ModulePinNode key={pin.id} module={module} pin={pin} onPin={event => { event.stopPropagation(); connectPin({ componentId: module.id, pinId: pin.id }); }}/>) }
          {module.id === selectedModuleId && <ResizeHandles module={module} onPointerDown={onModuleResize}/>} 
        </g>)}</g>
        <g className="wire-layer">{renderedWires.map(({ wire, from, to }) => {
          if (!from || !to) return null;
          const signal = snapshot?.wireSignals[wire.id];
          const value = formatSignal(signal, project.settings.signalView);
          const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
          return <g key={wire.id} className={`wire ${signal?.active ? 'active' : ''} logic-${signal?.logic ?? 'z'} ${running ? 'running' : ''}`}>
            <path className="wire-hit" d={routeWire(from, to, wire.routing, wire.controlPoints)} onPointerDown={event => onWireDown(event,wire,from,to)} onDoubleClick={event => addWireNode(event,wire,from,to)}/><path className="wire-base" d={routeWire(from, to, wire.routing, wire.controlPoints)}/><path className="wire-signal" d={routeWire(from, to, wire.routing, wire.controlPoints)}>{running && signal?.active && <animate attributeName="stroke-dashoffset" from="0" to="-15" dur="0.55s" repeatCount="indefinite"/>}</path>
            {project.settings.showValues && <g className="signal-label" transform={`translate(${mid.x} ${mid.y})`}><rect x="-36" y="-13" width="72" height="22"/><text textAnchor="middle" y="3">{value}</text></g>}
            {wire.id === selectedWireId && wire.controlPoints?.map((point,index)=><rect key={index} className="wire-control-node" x={point.x-6} y={point.y-6} width="12" height="12" onPointerDown={event => onWireNodeDown(event,wire.id,index)} onDoubleClick={event => { event.stopPropagation(); patchWire(wire.id,{ controlPoints:wire.controlPoints?.filter((_,itemIndex)=>itemIndex!==index) }); }}/>) }
          </g>;
        })}{pendingStart && <path className="wire-preview" d={routePreview(pendingStart, pointerWorld)}/>}</g>
        <g className="component-layer">{visibleComponents.map(component => {
          const definition = CATALOG_BY_ID.get(component.definitionId);
          if (!definition) return null;
          const componentLod = lodForScale(viewport.scale * (component.scale || 1));
          return <CircuitSymbol key={component.id} component={component} definition={definition} selected={selected.includes(component.id)} lod={componentLod.level} signal={snapshot?.componentSignals[component.id]} onPointerDown={onComponentDown} onDoubleClick={openComponentInspector} onPin={onPin} onQuickToggle={quickToggle} onProperty={(item,key,value) => update(draft => { const target=draft.components.find(node=>node.id===item.id); if(target) target.properties[key]=value; })}/>;
        })}</g>
        {marquee && <rect className={interaction?.type === 'module' ? 'module-marquee' : 'selection-marquee'} x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height}/>} 
      </g>
    </svg>
    <nav className="workspace-breadcrumb" aria-label="Ruta del lienzo"><button onClick={() => navigateToModule()}>PROYECTO</button><b>/</b><button onClick={() => navigateToModule()}>{project.name}</button>{ancestors.map((module,index)=><span className="breadcrumb-level" key={module.id}><b>/</b><button className={index===ancestors.length-1?'current':''} style={{color:module.color}} onClick={()=>navigateToModule(module.id)}>{module.name}{index===ancestors.length-1?' · LIENZO INTERNO':''}</button></span>)}{!activeModule && selectedModule && <span className="breadcrumb-level"><b>/</b><span style={{color:selectedModule.color}}>{selectedModule.name}</span></span>}</nav>
    {activeModule && <ModulePortDocks module={activeModule} onPin={pin=>connectPin({componentId:activeModule.id,pinId:pin.id})}/>} 
    <div className="lod-indicator"><Scan size={15}/><div><span>LOD {lod.level}</span><strong>{lod.name}</strong></div><small>{lod.detail}</small></div>
    {pendingPin && <div className="wire-hint"><WayPointIcon/>Selecciona otro terminal para completar el cable<button onClick={() => setPendingPin(undefined)}><X size={14}/></button></div>}
    {selectedWire && <div className="wire-editor"><Route size={14}/><strong>CONEXIÓN</strong><select value={selectedWire.routing} onChange={event => patchWire(selectedWire.id,{routing:event.target.value as Wire['routing']})}><option value="orthogonal">Ortogonal</option><option value="bezier">Bézier</option><option value="straight">Recta</option></select><span>{selectedWire.controlPoints?.length ?? 0} nodos</span><button onClick={() => patchWire(selectedWire.id,{controlPoints:[]})}>Limpiar nodos</button><button className="danger" onClick={() => deleteWire(selectedWire.id)}><Trash2 size={13}/></button></div>}
    <div className="zoom-controls"><button onClick={() => setViewport(current => zoomAt(current, { x: svgRef.current!.clientWidth/2, y: svgRef.current!.clientHeight/2 }, 1.25))}><Plus size={16}/></button><span title={`${viewport.scale * 100}%`}>{formatZoom(viewport.scale)}</span><button onClick={() => setViewport(current => zoomAt(current, { x: svgRef.current!.clientWidth/2, y: svgRef.current!.clientHeight/2 }, .8))}><Minus size={16}/></button><button onClick={fitProject} title="Encajar proyecto"><Maximize size={16}/></button><button onClick={() => setViewport({ x: svgRef.current!.clientWidth/2, y: svgRef.current!.clientHeight/2, scale: 1 })} title="Centrar origen"><Crosshair size={16}/></button></div>
  </main>;
}

function normalizedRect(a: Point, b: Point) { return { x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), width: Math.abs(a.x-b.x), height: Math.abs(a.y-b.y) }; }
function intersects(a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) { return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y; }
function adaptiveGrid(base: number, scale: number) { let size = base; while (size * scale < 10) size *= 5; while (size * scale > 80) size /= 2; return size; }
function formatZoom(scale:number) { const percent=scale*100; if(percent<10_000)return `${Math.round(percent)}%`; if(percent<1_000_000)return `${(percent/1000).toFixed(1)}k%`; return `${(percent/1_000_000).toFixed(percent<10_000_000?1:0)}M%`; }
function isTyping(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }
function formatSignal(signal: WireSignal | undefined, view: BitWireProject['settings']['signalView']) { if (!signal || !signal.active) return '—'; if (view === 'logic') return String(signal.logic); if (view === 'current') return signal.current >= 1 ? `${signal.current.toFixed(2)} A` : `${(signal.current*1000).toFixed(1)} mA`; if (view === 'power') return `${Math.abs(signal.voltage*signal.current).toFixed(3)} W`; return `${signal.voltage.toFixed(2)} V`; }
function WayPointIcon() { return <svg viewBox="0 0 24 24" width="16"><circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="2"/></svg>; }

function modulePinWorld(module: ModuleArea, pin: ModulePin): Point {
  const position = Math.max(0,Math.min(1,pin.position));
  if (pin.side === 'left') return { x:module.x, y:module.y+position*module.height };
  if (pin.side === 'right') return { x:module.x+module.width, y:module.y+position*module.height };
  if (pin.side === 'top') return { x:module.x+position*module.width, y:module.y };
  return { x:module.x+position*module.width, y:module.y+module.height };
}

function ModulePinNode({ module, pin, onPin }: { module: ModuleArea; pin: ModulePin; onPin(event: React.PointerEvent<SVGCircleElement>): void }) {
  const point = modulePinWorld(module,pin);
  const horizontal = pin.side === 'left' || pin.side === 'right';
  const labelX = point.x + (pin.side === 'left' ? 11 : pin.side === 'right' ? -11 : 0);
  const labelY = point.y + (pin.side === 'top' ? 13 : pin.side === 'bottom' ? -8 : -8);
  return <g className={`module-pin ${pin.domain.toLowerCase()}`}>
    <circle cx={point.x} cy={point.y} r="5"/>
    <circle className="module-pin-hit" cx={point.x} cy={point.y} r="14" onPointerDown={onPin}/>
    <text x={labelX} y={labelY} textAnchor={horizontal ? pin.side === 'left' ? 'start' : 'end' : 'middle'}>{pin.name}{pin.nominalVoltage !== undefined ? ` · ${pin.nominalVoltage}V` : ''}</text>
  </g>;
}

function ModulePortDocks({ module, onPin }: { module: ModuleArea; onPin(pin:ModulePin):void }) {
  return <div className="module-port-docks" aria-label={`Terminales de ${module.name}`}>{module.pins.map(pin => {
    const along = `${Math.max(4,Math.min(96,pin.position*100))}%`;
    const style = pin.side === 'left' || pin.side === 'right' ? { top: along } : { left: along };
    return <button key={pin.id} className={`module-port-dock ${pin.side} ${pin.domain.toLowerCase()}`} style={style} onPointerDown={event=>event.stopPropagation()} onClick={()=>onPin(pin)} title={`${pin.kind} · ${pin.domain}${pin.nominalVoltage !== undefined ? ` · ${pin.nominalVoltage} V` : ''}`}>
      <i/><span><strong>{pin.name}</strong><small>{pin.kind}{pin.nominalVoltage !== undefined ? ` · ${pin.nominalVoltage} V` : ''}</small></span>
    </button>;
  })}</div>;
}

const RESIZE_HANDLES = [
  ['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5],
] as const;

function ResizeHandles({ module, onPointerDown }: { module: ModuleArea; onPointerDown(event: React.PointerEvent<SVGRectElement>,module:ModuleArea,handle:string):void }) {
  return <g className="resize-handles">{RESIZE_HANDLES.map(([handle,x,y])=><rect key={handle} x={module.x+x*module.width-6} y={module.y+y*module.height-6} width="12" height="12" data-handle={handle} onPointerDown={event=>onPointerDown(event,module,handle)}/>)}</g>;
}

function resizedRect(origin: {x:number;y:number;width:number;height:number}, handle:string, dx:number, dy:number) {
  let {x,y,width,height}=origin;
  if (handle.includes('e')) width=Math.max(100,origin.width+dx);
  if (handle.includes('s')) height=Math.max(80,origin.height+dy);
  if (handle.includes('w')) { const next=Math.max(100,origin.width-dx); x=origin.x+origin.width-next; width=next; }
  if (handle.includes('n')) { const next=Math.max(80,origin.height-dy); y=origin.y+origin.height-next; height=next; }
  return {x,y,width,height};
}
