import { Crosshair, Maximize, Minus, Plus, Scan, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import { fitBounds, screenToWorld, zoomAt } from '../canvas/ViewportMatrix';
import { lodForScale } from '../canvas/LODManager';
import { routePreview, routeWire } from '../canvas/WireRouter';
import { CircuitSymbol } from './CircuitSymbol';
import type {
  BitWireProject, ComponentInstance, ModuleArea, PinDefinition, PinRef, Point,
  SimulationSnapshot, ToolMode, ViewportState, WireSignal,
} from '../model/types';
import { createInstance, uid } from '../state/project';

type Update = (recipe: (draft: BitWireProject) => void, record?: boolean) => void;

interface Props {
  project: BitWireProject;
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
}

type Interaction =
  | { type: 'pan'; start: Point; origin: ViewportState }
  | { type: 'drag'; start: Point; origins: Map<string, Point>; recorded: boolean }
  | { type: 'marquee' | 'module'; start: Point; current: Point }
  | null;

export function Workspace({ project, update, selected, onSelected, selectedModuleId, onSelectedModule, tool, onTool, snapshot, running, onViewport }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewportState] = useState<ViewportState>({ x: 690, y: 270, scale: .78 });
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [pendingPin, setPendingPin] = useState<PinRef>();
  const [pointerWorld, setPointerWorld] = useState<Point>({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const lod = lodForScale(viewport.scale);
  const selectedModule = project.modules.find(module => module.id === selectedModuleId);

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
    if (!component || !definition || !pin) return undefined;
    const base = { x: pin.x * definition.width, y: pin.y * definition.height };
    const angle = component.rotation * Math.PI / 180;
    const cx = definition.width / 2, cy = definition.height / 2;
    return {
      x: component.x + cx + (base.x - cx) * Math.cos(angle) - (base.y - cy) * Math.sin(angle),
      y: component.y + cy + (base.x - cx) * Math.sin(angle) + (base.y - cy) * Math.cos(angle),
    };
  }, [project.components]);

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
    if (tool === 'pan' || event.button === 1 || spaceHeld) {
      setInteraction({ type: 'pan', start: local, origin: viewport });
    } else if (tool === 'module') {
      setInteraction({ type: 'module', start: world, current: world });
      onSelected([]); onSelectedModule(undefined);
    } else {
      setInteraction({ type: 'marquee', start: world, current: world });
      if (!event.shiftKey) { onSelected([]); onSelectedModule(undefined); }
      if (pendingPin) setPendingPin(undefined);
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const local = localPoint(event);
    const world = screenToWorld(local, viewport);
    setPointerWorld(world);
    if (!interaction) return;
    if (interaction.type === 'pan') {
      setViewport({ ...interaction.origin, x: interaction.origin.x + local.x - interaction.start.x, y: interaction.origin.y + local.y - interaction.start.y });
    } else if (interaction.type === 'drag') {
      const dx = world.x - interaction.start.x, dy = world.y - interaction.start.y;
      const snap = project.settings.snapToGrid ? project.settings.gridSize : 1;
      update(draft => {
        for (const [id, origin] of interaction.origins) {
          const component = draft.components.find(item => item.id === id);
          if (!component || component.locked) continue;
          component.x = Math.round((origin.x + dx) / snap) * snap;
          component.y = Math.round((origin.y + dy) / snap) * snap;
        }
      }, !interaction.recorded);
      if (!interaction.recorded) setInteraction({ ...interaction, recorded: true });
    } else {
      setInteraction({ ...interaction, current: world });
    }
  };

  const finishInteraction = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interaction) return;
    if (interaction.type === 'marquee' || interaction.type === 'module') {
      const rect = normalizedRect(interaction.start, interaction.current);
      if (rect.width > 8 && rect.height > 8) {
        const memberIds = project.components.filter(component => {
          const definition = CATALOG_BY_ID.get(component.definitionId);
          if (!definition) return false;
          return intersects(rect, { x: component.x, y: component.y, width: definition.width, height: definition.height });
        }).map(component => component.id);
        if (interaction.type === 'marquee') onSelected(memberIds);
        else {
          const module: ModuleArea = { id: uid('module'), name: `Encapsulado ${project.modules.length + 1}`, ...rect, color: '#7b8cff', memberIds, enabled: true };
          update(draft => { draft.modules.push(module); });
          onSelectedModule(module.id); onTool('select');
        }
      }
    }
    setInteraction(null);
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  };

  const onComponentDown = (event: React.PointerEvent<SVGGElement>, component: ComponentInstance) => {
    event.stopPropagation();
    if (tool === 'pan' || event.button === 1 || spaceHeld) {
      const local = localPoint(event);
      setInteraction({ type: 'pan', start: local, origin: viewport });
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    if (tool !== 'select') { onSelected([component.id]); return; }
    const nextSelection = event.shiftKey
      ? selected.includes(component.id) ? selected.filter(id => id !== component.id) : [...selected, component.id]
      : selected.includes(component.id) ? selected : [component.id];
    onSelected(nextSelection); onSelectedModule(undefined);
    const world = screenToWorld(localPoint(event), viewport);
    const origins = new Map(nextSelection.map(id => {
      const item = project.components.find(node => node.id === id)!;
      return [id, { x: item.x, y: item.y }] as const;
    }));
    setInteraction({ type: 'drag', start: world, origins, recorded: false });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onPin = (event: React.PointerEvent<SVGCircleElement>, component: ComponentInstance, pin: PinDefinition) => {
    event.stopPropagation();
    const next = { componentId: component.id, pinId: pin.id };
    if (!pendingPin) { setPendingPin(next); onTool('wire'); return; }
    if (pendingPin.componentId === next.componentId && pendingPin.pinId === next.pinId) { setPendingPin(undefined); return; }
    const duplicate = project.wires.some(wire =>
      (wire.from.componentId === pendingPin.componentId && wire.from.pinId === pendingPin.pinId && wire.to.componentId === next.componentId && wire.to.pinId === next.pinId)
      || (wire.to.componentId === pendingPin.componentId && wire.to.pinId === pendingPin.pinId && wire.from.componentId === next.componentId && wire.from.pinId === next.pinId));
    if (!duplicate) update(draft => { draft.wires.push({ id: uid('wire'), from: pendingPin, to: next, routing: draft.settings.wireRouting }); });
    setPendingPin(undefined);
  };

  const quickToggle = (component: ComponentInstance) => update(draft => {
    const item = draft.components.find(node => node.id === component.id);
    const definition = CATALOG_BY_ID.get(component.definitionId);
    if (!item || !definition) return;
    if (definition.model === 'switch') item.properties.closed = !Boolean(item.properties.closed);
    if (definition.model === 'logic_input') item.properties.state = Number(item.properties.state) ? 0 : 1;
  });

  const focusComponent = (component: ComponentInstance) => {
    const definition = CATALOG_BY_ID.get(component.definitionId);
    const rect = svgRef.current!.getBoundingClientRect();
    if (!definition) return;
    const scale = Math.max(4.2, viewport.scale);
    setViewport({ scale, x: rect.width / 2 - (component.x + definition.width / 2) * scale, y: rect.height / 2 - (component.y + definition.height / 2) * scale });
    onSelected([component.id]);
  };

  const fitProject = () => {
    const rect = svgRef.current!.getBoundingClientRect();
    if (!project.components.length) { setViewport({ x: rect.width / 2, y: rect.height / 2, scale: 1 }); return; }
    const boxes = project.components.map(component => { const d = CATALOG_BY_ID.get(component.definitionId)!; return { x: component.x, y: component.y, width: d.width, height: d.height }; });
    const minX = Math.min(...boxes.map(b => b.x)), minY = Math.min(...boxes.map(b => b.y));
    const maxX = Math.max(...boxes.map(b => b.x + b.width)), maxY = Math.max(...boxes.map(b => b.y + b.height));
    setViewport(fitBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, { width: rect.width, height: rect.height }, 110));
  };

  const addAt = (definitionId: string, world: Point) => {
    const definition = CATALOG_BY_ID.get(definitionId);
    if (!definition) return;
    const component = createInstance(definitionId, world.x - definition.width / 2, world.y - definition.height / 2);
    update(draft => { draft.components.push(component); });
    onSelected([component.id]); onSelectedModule(undefined);
  };

  const marquee = interaction && (interaction.type === 'marquee' || interaction.type === 'module') ? normalizedRect(interaction.start, interaction.current) : undefined;
  const pendingStart = pendingPin ? pinWorld(pendingPin) : undefined;

  const gridSize = adaptiveGrid(project.settings.gridSize, viewport.scale);
  const renderedWires = useMemo(() => project.wires.map(wire => ({ wire, from: pinWorld(wire.from), to: pinWorld(wire.to) })), [project.wires, pinWorld]);

  return <main className={`workspace theme-${resolveTheme(project.settings.theme)} tool-${tool} ${spaceHeld ? 'space-pan' : ''}`}>
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
        <g className="module-layer">{project.modules.map(module => <g key={module.id} className={`module-area ${module.id === selectedModuleId ? 'selected' : ''} ${module.enabled ? '' : 'disabled'}`} onPointerDown={event => { event.stopPropagation(); onSelected([]); onSelectedModule(module.id); }} onDoubleClick={() => setViewport(current => fitBounds(module, { width: svgRef.current!.clientWidth, height: svgRef.current!.clientHeight }, 90))}>
          <rect x={module.x} y={module.y} width={module.width} height={module.height} style={{ stroke: module.color }}/><path d={`M${module.x} ${module.y + 34}h${module.width}`} style={{ stroke: module.color }}/><text x={module.x + 14} y={module.y + 23} style={{ fill: module.color }}>{module.name.toUpperCase()}</text><text className="module-state" x={module.x + module.width - 14} y={module.y + 23} textAnchor="end">{module.enabled ? 'ACTIVO' : 'AISLADO'}</text>
        </g>)}</g>
        <g className="wire-layer">{renderedWires.map(({ wire, from, to }) => {
          if (!from || !to) return null;
          const signal = snapshot?.wireSignals[wire.id];
          const value = formatSignal(signal, project.settings.signalView);
          const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
          return <g key={wire.id} className={`wire ${signal?.active ? 'active' : ''} logic-${signal?.logic ?? 'z'} ${running ? 'running' : ''}`}>
            <path className="wire-hit" d={routeWire(from, to, wire.routing)}/><path className="wire-base" d={routeWire(from, to, wire.routing)}/><path className="wire-signal" d={routeWire(from, to, wire.routing)}/>
            {project.settings.showValues && <g className="signal-label" transform={`translate(${mid.x} ${mid.y})`}><rect x="-36" y="-13" width="72" height="22"/><text textAnchor="middle" y="3">{value}</text></g>}
          </g>;
        })}{pendingStart && <path className="wire-preview" d={routePreview(pendingStart, pointerWorld)}/>}</g>
        <g className="component-layer">{project.components.map(component => {
          const definition = CATALOG_BY_ID.get(component.definitionId);
          if (!definition) return null;
          return <CircuitSymbol key={component.id} component={component} definition={definition} selected={selected.includes(component.id)} lod={lod.level} signal={snapshot?.componentSignals[component.id]} onPointerDown={onComponentDown} onDoubleClick={focusComponent} onPin={onPin} onQuickToggle={quickToggle}/>;
        })}</g>
        {marquee && <rect className={interaction?.type === 'module' ? 'module-marquee' : 'selection-marquee'} x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height}/>} 
      </g>
    </svg>
    <div className="workspace-breadcrumb"><span>PROYECTO</span><b>/</b><strong>{project.name}</strong>{selectedModule && <><b>/</b><span style={{ color: selectedModule.color }}>{selectedModule.name}</span></>}</div>
    <div className="lod-indicator"><Scan size={15}/><div><span>LOD {lod.level}</span><strong>{lod.name}</strong></div><small>{lod.detail}</small></div>
    {pendingPin && <div className="wire-hint"><WayPointIcon/>Selecciona otro terminal para completar el cable<button onClick={() => setPendingPin(undefined)}><X size={14}/></button></div>}
    <div className="zoom-controls"><button onClick={() => setViewport(current => zoomAt(current, { x: svgRef.current!.clientWidth/2, y: svgRef.current!.clientHeight/2 }, 1.25))}><Plus size={16}/></button><span>{Math.round(viewport.scale * 100)}%</span><button onClick={() => setViewport(current => zoomAt(current, { x: svgRef.current!.clientWidth/2, y: svgRef.current!.clientHeight/2 }, .8))}><Minus size={16}/></button><button onClick={fitProject} title="Encajar proyecto"><Maximize size={16}/></button><button onClick={() => setViewport({ x: svgRef.current!.clientWidth/2, y: svgRef.current!.clientHeight/2, scale: 1 })} title="Centrar origen"><Crosshair size={16}/></button></div>
  </main>;
}

function normalizedRect(a: Point, b: Point) { return { x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), width: Math.abs(a.x-b.x), height: Math.abs(a.y-b.y) }; }
function intersects(a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) { return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y; }
function adaptiveGrid(base: number, scale: number) { let size = base; while (size * scale < 10) size *= 5; while (size * scale > 80) size /= 2; return size; }
function resolveTheme(theme: BitWireProject['settings']['theme']) { if (theme !== 'auto') return theme; return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
function isTyping(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }
function formatSignal(signal: WireSignal | undefined, view: BitWireProject['settings']['signalView']) { if (!signal || !signal.active) return '—'; if (view === 'logic') return String(signal.logic); if (view === 'current') return signal.current >= 1 ? `${signal.current.toFixed(2)} A` : `${(signal.current*1000).toFixed(1)} mA`; if (view === 'power') return `${Math.abs(signal.voltage*signal.current).toFixed(3)} W`; return `${signal.voltage.toFixed(2)} V`; }
function WayPointIcon() { return <svg viewBox="0 0 24 24" width="16"><circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="2"/></svg>; }
