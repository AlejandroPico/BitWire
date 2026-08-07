import { CheckCircle2, CircleAlert, HelpCircle, Info, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AboutDialog } from './components/AboutDialog';
import { CatalogPanel } from './components/CatalogPanel';
import { ContextMenu, type ContextAction, type ContextTarget } from './components/ContextMenu';
import { HelpGuide } from './components/HelpGuide';
import { Inspector } from './components/Inspector';
import { InstrumentWindow, type InstrumentWindowState } from './components/InstrumentWindow';
import { InstrumentTray } from './components/Oscilloscope';
import { OfflineDialog } from './components/OfflineDialog';
import { Topbar } from './components/Topbar';
import { Workspace } from './components/Workspace';
import { EMBEDDED_CATALOG, verifyCatalogDatabase } from './catalog/catalog';
import type {
  BitWireProject, CatalogDatabaseStatus, ComponentDefinition, ModuleArea,
  PropertyValue, SavedModule, SimulationSnapshot, Theme, ToolMode, ViewportState,
} from './model/types';
import { createBlankProject, createDemoProject, createInstance, duplicateComponents, uid } from './state/project';
import { useProjectHistory } from './state/useProjectHistory';
import { exportProject, importProject, loadLocalProject, saveProjectLocally } from './utils/projectIO';
import { deleteSavedModule, exportModule, importModule, insertSavedModule, loadModuleLibrary, saveModuleToLibrary } from './utils/moduleIO';
import { loadThemePreference, resolveTheme, saveThemePreference, themeDefinition } from './theme/themes';

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
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [instrumentsCollapsed, setInstrumentsCollapsed] = useState(false);
  const [database, setDatabase] = useState<CatalogDatabaseStatus>({ source: 'embedded', count: EMBEDDED_CATALOG.length });
  const [viewport, setViewport] = useState<ViewportState>({ x: 690, y: 270, scale: .78 });
  const [savedRevision, setSavedRevision] = useState(initial.updatedAt);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; message: string }>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget>();
  const [instrumentWindows, setInstrumentWindows] = useState<InstrumentWindowState[]>([]);
  const [theme, setTheme] = useState<Theme>(loadThemePreference);
  const [themeClock, setThemeClock] = useState(() => Date.now());
  const workerRef = useRef<Worker | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const moduleImportRef = useRef<HTMLInputElement>(null);
  const windowZ = useRef(120);

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
  useEffect(() => {
    const preventNativeMenu = (event:MouseEvent) => event.preventDefault();
    document.addEventListener('contextmenu',preventNativeMenu);
    return () => document.removeEventListener('contextmenu',preventNativeMenu);
  },[]);

  useEffect(() => { workerRef.current?.postMessage({ type: 'project', project: simulationProject(project) }); }, [project, simulationProject]);
  useEffect(() => { workerRef.current?.postMessage({ type: 'control', running, speed }); }, [running, speed]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(undefined), 3200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (theme !== 'auto') return;
    const refresh = () => setThemeClock(Date.now());
    const id = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, [theme]);

  const changeTheme = useCallback((next: Theme) => {
    saveThemePreference(next);
    setTheme(next);
    setThemeClock(Date.now());
  }, []);

  const save = useCallback(() => {
    saveProjectLocally(project); setSavedRevision(project.updatedAt);
    setToast({ type: 'ok', message: 'Proyecto guardado en este dispositivo.' });
  }, [project]);

  const newProject = useCallback(() => {
    if (project.updatedAt !== savedRevision && !window.confirm('Hay cambios sin guardar. ¿Crear un proyecto nuevo?')) return;
    reset(createBlankProject()); setSelected([]); setSelectedModuleId(undefined); setActiveModuleId(undefined); setRunning(false); setInstrumentWindows([]);
  }, [project.updatedAt, savedRevision, reset]);

  const doImport = async (file?: File) => {
    if (!file) return;
    try {
      const next = await importProject(file); reset(next); setSelected([]); setSelectedModuleId(undefined); setActiveModuleId(undefined); setRunning(false); setInstrumentWindows([]); setToast({ type: 'ok', message: `Proyecto «${next.name}» importado.` });
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
    let duplicated: string[] = [];
    update(draft => { duplicated = duplicateComponents(draft, selected); });
    setSelected(duplicated);
  }, [selected, update]);

  const patchModule = (patch: Partial<ModuleArea>) => {
    if (!selectedModuleId) return;
    update(draft => { const module = draft.modules.find(item => item.id === selectedModuleId); if (module) Object.assign(module, patch); });
  };

  const focusInstrumentWindow = useCallback((id:string) => {
    const z=++windowZ.current;
    setInstrumentWindows(current=>current.map(item=>item.id===id?{...item,z}:item));
  },[]);

  const openInstrumentWindow = useCallback((componentId:string) => {
    const component=project.components.find(item=>item.id===componentId);
    const definition=component&&EMBEDDED_CATALOG.find(item=>item.id===component.definitionId);
    if(!component||!definition?.customGui)return;
    setInstrumentWindows(current=>{
      const existing=current.find(item=>item.componentId===componentId);
      const z=++windowZ.current;
      if(existing)return current.map(item=>item.id===existing.id?{...item,z,minimized:false}:item);
      const expanded=localStorage.getItem('bitwire:instrument-professional-view')==='1';
      const offset=(current.length%6)*24,width=expanded?960:580,height=expanded?610:370;
      return [...current,{id:`instrument-window-${componentId}`,componentId,x:Math.max(8,Math.min(window.innerWidth-width-16,310+offset)),y:Math.max(58,Math.min(window.innerHeight-height-32,82+offset)),width,height,z,expanded,minimized:false,maximized:false}];
    });
  },[project.components]);

  const deleteModuleDirect = useCallback((moduleId:string) => {
    const moduleIds=new Set([moduleId]);let changed=true;
    while(changed){changed=false;for(const module of project.modules)if(module.parentModuleId&&moduleIds.has(module.parentModuleId)&&!moduleIds.has(module.id)){moduleIds.add(module.id);changed=true;}}
    const componentIds=new Set(project.modules.filter(module=>moduleIds.has(module.id)).flatMap(module=>module.memberIds));
    update(draft=>{draft.modules=draft.modules.filter(module=>!moduleIds.has(module.id));draft.components=draft.components.filter(component=>!componentIds.has(component.id));draft.wires=draft.wires.filter(wire=>!moduleIds.has(wire.from.componentId)&&!moduleIds.has(wire.to.componentId)&&!componentIds.has(wire.from.componentId)&&!componentIds.has(wire.to.componentId));for(const module of draft.modules)module.memberIds=module.memberIds.filter(id=>!componentIds.has(id));});
    setInstrumentWindows(current=>current.filter(item=>!componentIds.has(item.componentId)));
    if(activeModuleId&&moduleIds.has(activeModuleId))setActiveModuleId(undefined);setSelectedModuleId(undefined);
  },[activeModuleId,project.modules,update]);

  const runContextAction = useCallback((action:ContextAction) => {
    const target=contextTarget;if(!target)return;
    if(target.kind==='canvas'){
      if(action==='select-tool')setTool('select');if(action==='wire-tool')setTool('wire');if(action==='module-tool')setTool('module');return;
    }
    if(target.kind==='wire'){
      if(action==='delete')update(draft=>{draft.wires=draft.wires.filter(wire=>wire.id!==target.id);});return;
    }
    if(target.kind==='component'){
      const id=target.id;
      if(action==='instrument'){openInstrumentWindow(id);return;}
      if(action==='inspect'){setSelected([id]);setSelectedModuleId(undefined);setInspectorCollapsed(false);return;}
      if(action==='duplicate'){let duplicated:string[]=[];update(draft=>{duplicated=duplicateComponents(draft,[id]);});if(duplicated.length)setSelected(duplicated);return;}
      if(action==='delete'){update(draft=>{draft.components=draft.components.filter(item=>item.id!==id);draft.wires=draft.wires.filter(wire=>wire.from.componentId!==id&&wire.to.componentId!==id);for(const module of draft.modules)module.memberIds=module.memberIds.filter(member=>member!==id);});setInstrumentWindows(current=>current.filter(item=>item.componentId!==id));setSelected([]);return;}
      update(draft=>{const item=draft.components.find(component=>component.id===id);if(!item)return;if(action==='rotate')item.rotation=(item.rotation+90)%360;if(action==='toggle')item.enabled=!item.enabled;if(action==='lock')item.locked=!item.locked;});return;
    }
    const module=project.modules.find(item=>item.id===target.id);if(!module)return;
    if(action==='inspect'){setSelected([]);setSelectedModuleId(module.id);setInspectorCollapsed(false);return;}
    if(action==='enter-module'){setActiveModuleId(module.id);setSelected([]);setSelectedModuleId(module.id);return;}
    if(action==='save-module'){setModuleLibrary(saveModuleToLibrary(project,module));setToast({type:'ok',message:`«${module.name}» guardado en la biblioteca.`});return;}
    if(action==='delete'){deleteModuleDirect(module.id);return;}
    update(draft=>{const item=draft.modules.find(candidate=>candidate.id===module.id);if(!item)return;if(action==='toggle')item.enabled=!item.enabled;if(action==='collapse-module')item.collapsed=!item.collapsed;});
  },[contextTarget,deleteModuleDirect,openInstrumentWindow,project,update]);

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
  const resolvedTheme = resolveTheme(theme, new Date(themeClock));

  return <div className={`app-shell theme-${resolvedTheme}`} data-theme-mode={theme}>
    <div className={`editor-grid ${catalogCollapsed ? 'left-collapsed' : ''} ${inspectorCollapsed ? 'right-collapsed' : ''} ${instrumentsCollapsed ? 'bottom-collapsed' : ''}`}>
      <Topbar projectName={project.name} running={running} speed={speed} settings={project.settings} canUndo={canUndo} canRedo={canRedo} dirty={savedRevision !== project.updatedAt}
      theme={theme} onTheme={changeTheme}
      onRun={() => setRunning(value => !value)} onStep={() => workerRef.current?.postMessage({ type: 'step' })} onSpeed={setSpeed}
      onSettings={patch => update(draft => { Object.assign(draft.settings, patch); })}
      onNew={newProject} onSave={save} onImport={() => importRef.current?.click()} onExport={() => exportProject(project)} onOffline={()=>setOfflineOpen(true)} onUndo={undo} onRedo={redo}/>
      <CatalogPanel collapsed={catalogCollapsed} database={database} onToggle={() => setCatalogCollapsed(value => !value)} onAdd={addDefinition} modules={moduleLibrary} onInsertModule={insertModule} onImportModule={()=>moduleImportRef.current?.click()} onDeleteModule={id=>setModuleLibrary(deleteSavedModule(id))}/>
      <Workspace project={project} resolvedTheme={resolvedTheme} update={update} selected={selected} onSelected={setSelected} selectedModuleId={selectedModuleId} onSelectedModule={setSelectedModuleId} tool={tool} onTool={setTool} snapshot={snapshot} samples={samples} running={running} onViewport={setViewport} activeModuleId={activeModuleId} onActiveModule={id=>{setActiveModuleId(id);if(id){setSelected([]);setSelectedModuleId(id);}}} onOpenInspector={()=>setInspectorCollapsed(false)} onContextTarget={setContextTarget}/>
      <Inspector project={project} selected={selected} collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed(value => !value)} selectedModule={selectedModule}
        onProperty={(id, key, value: PropertyValue) => update(draft => { const item = draft.components.find(component => component.id === id); if (item) item.properties[key] = value; })}
        onPatch={(id, patch) => update(draft => { const item = draft.components.find(component => component.id === id); if (item) Object.assign(item, patch); })}
        onProject={patch => update(draft => { Object.assign(draft, patch); })} onDelete={deleteSelection} onDuplicate={duplicateSelection}
        onSelectModule={id => { setSelected([]); setSelectedModuleId(id); }} onModule={patchModule} activeModuleId={activeModuleId} onEnterModule={id=>{setActiveModuleId(id);if(id)setSelectedModuleId(id);}} onSaveModule={saveSelectedModule} onExportModule={()=>selectedModule&&exportModule(project,selectedModule)}/>
      <InstrumentTray collapsed={instrumentsCollapsed} project={project} samples={samples} onToggle={() => setInstrumentsCollapsed(value => !value)}/>
      <footer className="statusbar">
        <div><span className={`engine-light ${running ? 'running' : ''}`}/><b>{running ? `SIMULANDO ${speed}×` : 'MOTOR EN PAUSA'}</b><span>{snapshot ? `t = ${snapshot.time.toFixed(3)} s · tick ${snapshot.tick}` : 'Inicializando motor…'}</span></div>
        <div><span>{project.components.length} componentes</span><span>{project.wires.length} redes</span><span>{selected.length ? `${selected.length} seleccionados` : 'Sin selección'}</span></div>
        <div className="status-actions">
          <span className="theme-status">TEMA · {themeDefinition(theme).shortLabel.toUpperCase()}</span>
          <button onClick={() => setAboutOpen(true)}><Info size={14}/>Acerca de</button>
          <button onClick={() => setHelpOpen(true)}><HelpCircle size={14}/>Guía</button>
          <span className={activeWarnings ? 'warning-count active' : 'warning-count'}><CircleAlert size={13}/>{activeWarnings}</span>
        </div>
      </footer>
    </div>
    {instrumentWindows.map(windowState=>{const component=project.components.find(item=>item.id===windowState.componentId);return component?<InstrumentWindow key={windowState.id} state={windowState} component={component} project={project} samples={samples} onFocus={()=>focusInstrumentWindow(windowState.id)} onState={patch=>setInstrumentWindows(current=>current.map(item=>item.id===windowState.id?{...item,...patch}:item))} onPatch={properties=>update(draft=>{const item=draft.components.find(candidate=>candidate.id===component.id);if(item)Object.assign(item.properties,properties);})} onClose={()=>setInstrumentWindows(current=>current.filter(item=>item.id!==windowState.id))}/>:null;})}
    {contextTarget&&<ContextMenu target={contextTarget} project={project} onAction={runContextAction} onClose={()=>setContextTarget(undefined)}/>} 
    <input ref={importRef} type="file" accept=".bitwire,.json,application/json" hidden onChange={event => { void doImport(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
    <input ref={moduleImportRef} type="file" accept=".bitwire-module,.json,application/json" hidden onChange={event=>{void doImportModule(event.target.files?.[0]);event.currentTarget.value='';}}/>
    {toast && <div className={`toast ${toast.type}`}>{toast.type === 'ok' ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>}<span>{toast.message}</span><button onClick={() => setToast(undefined)}><X size={15}/></button></div>}
    {helpOpen && <HelpGuide onClose={() => setHelpOpen(false)}/>} 
    {aboutOpen && <AboutDialog onClose={()=>setAboutOpen(false)} onOffline={()=>setOfflineOpen(true)}/>} 
    {offlineOpen && <OfflineDialog onClose={()=>setOfflineOpen(false)}/>} 
  </div>;
}
