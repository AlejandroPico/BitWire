import { BookOpen, CheckCircle2, CircleAlert, Cpu, HelpCircle, Layers3, PanelLeftClose, PanelRightClose, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CatalogPanel } from './components/CatalogPanel';
import { Inspector } from './components/Inspector';
import { InstrumentTray } from './components/Oscilloscope';
import { Topbar } from './components/Topbar';
import { Workspace } from './components/Workspace';
import { EMBEDDED_CATALOG, verifyCatalogDatabase } from './catalog/catalog';
import type {
  BitWireProject, CatalogDatabaseStatus, ComponentDefinition, ModuleArea,
  PropertyValue, SavedModule, SimulationSnapshot, Theme, ToolMode, ViewportState,
} from './model/types';
import { createBlankProject, createDemoProject, createInstance, uid } from './state/project';
import { useProjectHistory } from './state/useProjectHistory';
import { exportProject, importProject, loadLocalProject, saveProjectLocally } from './utils/projectIO';
import { deleteSavedModule, exportModule, importModule, insertSavedModule, loadModuleLibrary, saveModuleToLibrary } from './utils/moduleIO';

export default function App() {
  const initial = useRef(loadLocalProject() ?? createDemoProject()).current;
  const { project, update, reset, undo, redo, canUndo, canRedo } = useProjectHistory(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>();
  const [activeModuleId, setActiveModuleId] = useState<string>();
  const [moduleLibrary, setModuleLibrary] = useState<SavedModule[]>(loadModuleLibrary);
  const [tool, setTool] = useState<ToolMode>('select');
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>();
  const [samples, setSamples] = useState<SimulationSnapshot[]>([]);
  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [instrumentsCollapsed, setInstrumentsCollapsed] = useState(false);
  const [database, setDatabase] = useState<CatalogDatabaseStatus>({ source: 'embedded', count: EMBEDDED_CATALOG.length });
  const [viewport, setViewport] = useState<ViewportState>({ x: 690, y: 270, scale: .78 });
  const [savedRevision, setSavedRevision] = useState(initial.updatedAt);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; message: string }>();
  const [helpOpen, setHelpOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const moduleImportRef = useRef<HTMLInputElement>(null);

  const simulationProject = useCallback((source: BitWireProject) => {
    const next = structuredClone(source);
    for (const module of next.modules) {
      if (!module.enabled) for (const id of module.memberIds) {
        const component = next.components.find(item => item.id === id);
        if (component) component.enabled = false;
      }
    }
    return next;
  }, []);

  useEffect(() => {
    verifyCatalogDatabase().then(setDatabase);
    const worker = new Worker(new URL('./engine/simulator.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      if (event.data?.type !== 'snapshot') return;
      const next = event.data.snapshot as SimulationSnapshot;
      setSnapshot(next);
      setSamples(current => [...current.slice(-149), next]);
    };
    worker.onerror = () => setToast({ type: 'error', message: 'El motor de simulación se ha detenido; recarga para reiniciarlo.' });
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => { workerRef.current?.postMessage({ type: 'project', project: simulationProject(project) }); }, [project, simulationProject]);
  useEffect(() => { workerRef.current?.postMessage({ type: 'control', running, speed }); }, [running, speed]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(undefined), 3200); return () => clearTimeout(id); }, [toast]);

  const save = useCallback(() => {
    saveProjectLocally(project); setSavedRevision(project.updatedAt);
    setToast({ type: 'ok', message: 'Proyecto guardado en este dispositivo.' });
  }, [project]);

  const newProject = useCallback(() => {
    if (project.updatedAt !== savedRevision && !window.confirm('Hay cambios sin guardar. ¿Crear un proyecto nuevo?')) return;
    reset(createBlankProject()); setSelected([]); setSelectedModuleId(undefined); setActiveModuleId(undefined); setRunning(false);
  }, [project.updatedAt, savedRevision, reset]);

  const doImport = async (file?: File) => {
    if (!file) return;
    try {
      const next = await importProject(file); reset(next); setSelected([]); setSelectedModuleId(undefined); setActiveModuleId(undefined); setRunning(false); setToast({ type: 'ok', message: `Proyecto «${next.name}» importado.` });
    } catch (error) { setToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo importar el proyecto.' }); }
  };

  const addDefinition = (definition: ComponentDefinition) => {
    const world = { x: (window.innerWidth * .5 - viewport.x) / viewport.scale, y: (window.innerHeight * .45 - viewport.y) / viewport.scale };
    const instanceScale = Math.max(1e-9,Math.min(20,1/viewport.scale));
    const component = createInstance(definition.id, world.x - definition.width*instanceScale/2, world.y - definition.height*instanceScale/2, uid('node'), instanceScale);
    update(draft => { draft.components.push(component); if(activeModuleId) draft.modules.find(module=>module.id===activeModuleId)?.memberIds.push(component.id); });
    setSelected([component.id]); setSelectedModuleId(undefined);
  };

  const saveSelectedModule = () => {
    if (!selectedModule) return;
    setModuleLibrary(saveModuleToLibrary(project,selectedModule));
    setToast({type:'ok',message:`«${selectedModule.name}» guardado en la biblioteca de encapsulados.`});
  };

  const insertModule = (saved: SavedModule) => {
    const world = { x:(window.innerWidth*.5-viewport.x)/viewport.scale, y:(window.innerHeight*.45-viewport.y)/viewport.scale };
    let insertedId='';
    update(draft=>{ const module=insertSavedModule(draft,saved,world.x-saved.width/2,world.y-saved.height/2,activeModuleId); insertedId=module.id; });
    queueMicrotask(()=>{ if(insertedId){ setSelected([]); setSelectedModuleId(insertedId); } });
  };

  const doImportModule = async(file?:File) => {
    if(!file)return;
    try{ const saved=await importModule(file); setModuleLibrary(loadModuleLibrary()); setToast({type:'ok',message:`Encapsulado «${saved.name}» importado.`}); }
    catch(error){setToast({type:'error',message:error instanceof Error?error.message:'No se pudo importar el encapsulado.'});}
  };

  const deleteSelection = useCallback(() => {
    if (selectedModuleId) {
      const moduleIds = new Set([selectedModuleId]);
      let changed = true;
      while (changed) { changed = false; for (const module of project.modules) if (module.parentModuleId && moduleIds.has(module.parentModuleId) && !moduleIds.has(module.id)) { moduleIds.add(module.id); changed = true; } }
      update(draft => {
        const componentIds = new Set(draft.modules.filter(module=>moduleIds.has(module.id)).flatMap(module=>module.memberIds));
        draft.modules = draft.modules.filter(module => !moduleIds.has(module.id));
        draft.components = draft.components.filter(component=>!componentIds.has(component.id));
        draft.wires = draft.wires.filter(wire=>!moduleIds.has(wire.from.componentId)&&!moduleIds.has(wire.to.componentId)&&!componentIds.has(wire.from.componentId)&&!componentIds.has(wire.to.componentId));
        for (const module of draft.modules) module.memberIds = module.memberIds.filter(id=>!componentIds.has(id));
      });
      if(activeModuleId && moduleIds.has(activeModuleId))setActiveModuleId(undefined);
      setSelectedModuleId(undefined); return;
    }
    if (!selected.length) return;
    const ids = new Set(selected);
    update(draft => {
      draft.components = draft.components.filter(component => !ids.has(component.id));
      draft.wires = draft.wires.filter(wire => !ids.has(wire.from.componentId) && !ids.has(wire.to.componentId));
      for (const module of draft.modules) module.memberIds = module.memberIds.filter(id => !ids.has(id));
    });
    setSelected([]);
  }, [selected, selectedModuleId, activeModuleId, update, project.modules]);

  const duplicateSelection = useCallback(() => {
    if (!selected.length) return;
    const idMap = new Map<string, string>();
    update(draft => {
      const copies = draft.components.filter(item => selected.includes(item.id)).map(item => {
        const id = uid('node'); idMap.set(item.id, id);
        return { ...structuredClone(item), id, x: item.x + 40, y: item.y + 40 };
      });
      const wires = draft.wires.filter(wire => idMap.has(wire.from.componentId) && idMap.has(wire.to.componentId)).map(wire => ({ ...structuredClone(wire), id: uid('wire'), from: { ...wire.from, componentId: idMap.get(wire.from.componentId)! }, to: { ...wire.to, componentId: idMap.get(wire.to.componentId)! } }));
      draft.components.push(...copies); draft.wires.push(...wires);
    });
    setSelected([...idMap.values()]);
  }, [selected, update]);

  const patchModule = (patch: Partial<ModuleArea>) => {
    if (!selectedModuleId) return;
    update(draft => { const module = draft.modules.find(item => item.id === selectedModuleId); if (module) Object.assign(module, patch); });
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); newProject(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (typing) return;
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelection();
      else if (event.key.toLowerCase() === 'v') setTool('select');
      else if (event.key.toLowerCase() === 'w') setTool('wire');
      else if (event.key.toLowerCase() === 'h') setTool('pan');
      else if (event.key === 'Escape') { setSelected([]); setSelectedModuleId(undefined); setActiveModuleId(undefined); setTool('select'); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [deleteSelection, newProject, redo, save, undo]);

  const selectedModule = project.modules.find(module => module.id === selectedModuleId);
  const activeWarnings = snapshot?.warnings.length ?? 0;

  return <div className="app-shell">
    <Topbar projectName={project.name} tool={tool} running={running} speed={speed} routing={project.settings.wireRouting} signalView={project.settings.signalView} canUndo={canUndo} canRedo={canRedo} dirty={savedRevision !== project.updatedAt}
      onTool={setTool} onRun={() => setRunning(value => !value)} onStep={() => workerRef.current?.postMessage({ type: 'step' })} onSpeed={setSpeed}
      onRouting={routing => update(draft => { draft.settings.wireRouting = routing; })} onSignalView={signalView => update(draft => { draft.settings.signalView = signalView; })}
      onNew={newProject} onSave={save} onImport={() => importRef.current?.click()} onExport={() => exportProject(project)} onUndo={undo} onRedo={redo}/>
    <div className={`editor-grid ${catalogCollapsed ? 'left-collapsed' : ''} ${inspectorCollapsed ? 'right-collapsed' : ''} ${instrumentsCollapsed ? 'bottom-collapsed' : ''}`}>
      <CatalogPanel collapsed={catalogCollapsed} database={database} onToggle={() => setCatalogCollapsed(value => !value)} onAdd={addDefinition} modules={moduleLibrary} onInsertModule={insertModule} onImportModule={()=>moduleImportRef.current?.click()} onDeleteModule={id=>setModuleLibrary(deleteSavedModule(id))}/>
      <Workspace project={project} update={update} selected={selected} onSelected={setSelected} selectedModuleId={selectedModuleId} onSelectedModule={setSelectedModuleId} tool={tool} onTool={setTool} snapshot={snapshot} running={running} onViewport={setViewport} activeModuleId={activeModuleId} onActiveModule={id=>{setActiveModuleId(id);if(id){setSelected([]);setSelectedModuleId(id);}}} onOpenInspector={()=>setInspectorCollapsed(false)}/>
      <Inspector project={project} selected={selected} collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed(value => !value)} selectedModule={selectedModule}
        onProperty={(id, key, value: PropertyValue) => update(draft => { const item = draft.components.find(component => component.id === id); if (item) item.properties[key] = value; })}
        onPatch={(id, patch) => update(draft => { const item = draft.components.find(component => component.id === id); if (item) Object.assign(item, patch); })}
        onProject={patch => update(draft => { Object.assign(draft, patch); })} onDelete={deleteSelection} onDuplicate={duplicateSelection}
        onSelectModule={id => { setSelected([]); setSelectedModuleId(id); }} onModule={patchModule} activeModuleId={activeModuleId} onEnterModule={id=>{setActiveModuleId(id);if(id)setSelectedModuleId(id);}} onSaveModule={saveSelectedModule} onExportModule={()=>selectedModule&&exportModule(project,selectedModule)}/>
      <InstrumentTray collapsed={instrumentsCollapsed} samples={samples} onToggle={() => setInstrumentsCollapsed(value => !value)}/>
      <footer className="statusbar">
        <div><span className={`engine-light ${running ? 'running' : ''}`}/><b>{running ? `SIMULANDO ${speed}×` : 'MOTOR EN PAUSA'}</b><span>{snapshot ? `t = ${snapshot.time.toFixed(3)} s · tick ${snapshot.tick}` : 'Inicializando motor…'}</span></div>
        <div><span>{project.components.length} componentes</span><span>{project.wires.length} redes</span><span>{selected.length ? `${selected.length} seleccionados` : 'Sin selección'}</span></div>
        <div className="status-actions">
          <label>Tema <select value={project.settings.theme} onChange={event => update(draft => { draft.settings.theme = event.target.value as Theme; })}><option value="blueprint">Plano</option><option value="dark">Noche</option><option value="light">Día</option><option value="auto">Automático</option></select></label>
          <button onClick={() => setHelpOpen(true)}><HelpCircle size={14}/>Guía</button>
          <span className={activeWarnings ? 'warning-count active' : 'warning-count'}><CircleAlert size={13}/>{activeWarnings}</span>
        </div>
      </footer>
    </div>
    <input ref={importRef} type="file" accept=".bitwire,.json,application/json" hidden onChange={event => { void doImport(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
    <input ref={moduleImportRef} type="file" accept=".bitwire-module,.json,application/json" hidden onChange={event=>{void doImportModule(event.target.files?.[0]);event.currentTarget.value='';}}/>
    {toast && <div className={`toast ${toast.type}`}>{toast.type === 'ok' ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>}<span>{toast.message}</span><button onClick={() => setToast(undefined)}><X size={15}/></button></div>}
    {helpOpen && <div className="modal-backdrop" onMouseDown={() => setHelpOpen(false)}><section className="help-modal" onMouseDown={event => event.stopPropagation()}>
      <header><div><span className="eyebrow">GUÍA RÁPIDA</span><h2>Trabajar en BitWire</h2></div><button onClick={() => setHelpOpen(false)}><X size={18}/></button></header>
      <div className="help-grid">
        <article><PanelLeftClose/><h3>1. Inserta</h3><p>Arrastra símbolos desde el catálogo. Todos son vectoriales y conservan nitidez a cualquier escala.</p></article>
        <article><Cpu/><h3>2. Configura</h3><p>Selecciona un elemento y modifica sus parámetros. Los interruptores y entradas lógicas también se accionan sobre el plano.</p></article>
        <article><Layers3/><h3>3. Profundiza</h3><p>Amplía para revelar controles y circuitos internos. El doble clic selecciona el elemento y abre su inspector lateral sin mover la cámara.</p></article>
        <article><BookOpen/><h3>4. Encapsula</h3><p>Dibuja un módulo, redimensiónalo y define sus patillas. Su lienzo interno puede guardarse o exportarse para reutilizarlo.</p></article>
      </div>
      <div className="shortcut-table"><span><kbd>V</kbd> Selección</span><span><kbd>W</kbd> Cable</span><span><kbd>H</kbd> Mano</span><span><kbd>Espacio</kbd> Desplazar</span><span><kbd>Supr</kbd> Eliminar</span><span><kbd>Ctrl S</kbd> Guardar</span></div>
    </section></div>}
  </div>;
}
