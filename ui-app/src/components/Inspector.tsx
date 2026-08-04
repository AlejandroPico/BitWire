import { Box, ChevronRight, CirclePower, Copy, Download, ExternalLink, Layers3, Library, Plus, RotateCw, Trash2, X } from 'lucide-react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import type { BitWireProject, ComponentInstance, ModuleArea, ModulePin, ModulePinSide, PinKind, PropertyValue, SignalDomain } from '../model/types';
import { uid } from '../state/project';

interface Props {
  project: BitWireProject;
  selected: string[];
  collapsed: boolean;
  onToggle(): void;
  onProperty(componentId: string, key: string, value: PropertyValue): void;
  onPatch(componentId: string, patch: Partial<ComponentInstance>): void;
  onProject(patch: Partial<BitWireProject>): void;
  onDelete(): void;
  onDuplicate(): void;
  onSelectModule(id: string): void;
  selectedModule?: ModuleArea;
  onModule(patch: Partial<ModuleArea>): void;
  activeModuleId?: string;
  onEnterModule(id?: string): void;
  onSaveModule(): void;
  onExportModule(): void;
}

export function Inspector({ project, selected, collapsed, onToggle, onProperty, onPatch, onProject, onDelete, onDuplicate, onSelectModule, selectedModule, onModule, activeModuleId, onEnterModule, onSaveModule, onExportModule }: Props) {
  if (collapsed) return <aside className="inspector-panel collapsed-panel right"><button className="icon-button vertical-label" onClick={onToggle}>INSPECTOR</button></aside>;
  const component = selected.length === 1 ? project.components.find(item => item.id === selected[0]) : undefined;
  const definition = component ? CATALOG_BY_ID.get(component.definitionId) : undefined;

  return <aside className="inspector-panel">
    <div className="panel-heading"><div><span className="eyebrow">PROPIEDADES</span><h2>Inspector</h2></div><button className="icon-button" onClick={onToggle}><X size={17}/></button></div>
    <div className="inspector-scroll">
      {selectedModule ? <>
        <div className="selection-identity"><span className="identity-icon"><Box size={22}/></span><div><strong>{selectedModule.name}</strong><small>Encapsulado funcional</small></div></div>
        <Field label="Nombre"><input value={selectedModule.name} onChange={e => onModule({ name: e.target.value })}/></Field>
        <Field label="Descripción"><textarea rows={3} value={selectedModule.description ?? ''} onChange={e => onModule({ description: e.target.value })}/></Field>
        <Field label="Activo"><Toggle checked={selectedModule.enabled} onChange={enabled => onModule({ enabled })}/></Field>
        <Field label="Como chip"><Toggle checked={selectedModule.collapsed} onChange={collapsed => onModule({ collapsed })}/></Field>
        <Field label="Color"><input type="color" value={selectedModule.color} onChange={e => onModule({ color: e.target.value })}/></Field>
        <div className="field-grid"><Field label="W"><NumberInput value={selectedModule.width} onChange={width => onModule({ width: Math.max(100,width) })}/></Field><Field label="H"><NumberInput value={selectedModule.height} onChange={height => onModule({ height: Math.max(80,height) })}/></Field></div>
        <div className="module-actions"><button className="primary" onClick={() => onEnterModule(activeModuleId === selectedModule.id ? selectedModule.parentModuleId : selectedModule.id)}><ExternalLink size={14}/>{activeModuleId === selectedModule.id ? 'Subir un nivel' : 'Abrir lienzo interno'}</button><button onClick={onSaveModule}><Library size={14}/>Guardar en biblioteca</button><button onClick={onExportModule}><Download size={14}/>Exportar archivo</button><button className="danger" onClick={onDelete}><Trash2 size={14}/>Eliminar encapsulado</button></div>
        <dl className="metrics-list"><div><dt>Elementos internos</dt><dd>{selectedModule.memberIds.length}</dd></div><div><dt>Conexiones exteriores</dt><dd>{selectedModule.pins.length}</dd></div></dl>
        <InspectorSection title="Patillas exteriores">
          <ModulePinsEditor module={selectedModule} onChange={pins => onModule({ pins })}/>
        </InspectorSection>
      </> : component && definition ? <>
        <div className="selection-identity"><span className="identity-icon">{definition.symbol === 'chip' ? 'IC' : '◇'}</span><div><strong>{definition.name}</strong><small>{definition.category} / {definition.family}</small></div></div>
        <p className="component-description">{definition.description}</p>
        <div className="quick-actions"><button onClick={() => onPatch(component.id, { enabled: !component.enabled })}><CirclePower size={15}/>{component.enabled ? 'Desactivar' : 'Activar'}</button><button onClick={onDuplicate}><Copy size={15}/>Duplicar</button><button onClick={() => onPatch(component.id, { rotation: (component.rotation + 90) % 360 })}><RotateCw size={15}/>Girar</button><button className="danger" onClick={onDelete}><Trash2 size={15}/></button></div>
        <InspectorSection title="Transformación">
          <div className="field-grid"><Field label="X"><NumberInput value={component.x} onChange={x => onPatch(component.id, { x })}/></Field><Field label="Y"><NumberInput value={component.y} onChange={y => onPatch(component.id, { y })}/></Field></div>
          <Field label="Rotación"><NumberInput value={component.rotation} onChange={rotation => onPatch(component.id, { rotation })} suffix="°"/></Field>
          <Field label="Escala"><NumberInput value={component.scale || 1} onChange={scale => onPatch(component.id, { scale: Math.max(1e-9, scale) })} suffix="×"/></Field>
          <Field label="Bloqueado"><Toggle checked={Boolean(component.locked)} onChange={locked => onPatch(component.id, { locked })}/></Field>
        </InspectorSection>
        <InspectorSection title="Parámetros del modelo">
          {Object.entries(component.properties).map(([key, value]) => <Field key={key} label={humanize(key)}>{typeof value === 'boolean' ? key === 'closed' ? <button className={`state-button ${value?'closed':'open'}`} onClick={()=>onProperty(component.id,key,!value)}>{value?'CERRADO':'ABIERTO'}</button> : <Toggle checked={value} onChange={next => onProperty(component.id, key, next)}/> : typeof value === 'number' ? <NumberInput value={value} onChange={next => onProperty(component.id, key, next)} suffix={unitFor(key)}/> : key.toLowerCase().includes('color') ? <input type="color" value={String(value)} onChange={e => onProperty(component.id, key, e.target.value)}/> : <input value={String(value)} onChange={e => onProperty(component.id, key, e.target.value)}/>}</Field>)}
        </InspectorSection>
        <InspectorSection title="Conectividad"><dl className="pin-list">{definition.pins.map(pin => <div key={pin.id}><dt><span className={`pin-kind ${pin.kind.toLowerCase()}`}/>{pin.name}</dt><dd>{pin.kind} · {pin.domain}</dd></div>)}</dl></InspectorSection>
        {definition.internal && <div className="deep-zoom-note"><Layers3 size={17}/><div><strong>Modelo jerárquico disponible</strong><span>Amplía el componente para revelar su red interna; usa este inspector para editar sus parámetros.</span></div></div>}
      </> : selected.length > 1 ? <>
        <div className="selection-identity"><span className="identity-icon">{selected.length}</span><div><strong>Selección múltiple</strong><small>Componentes preparados para operar en conjunto</small></div></div>
        <div className="quick-actions"><button onClick={onDuplicate}><Copy size={15}/>Duplicar</button><button className="danger" onClick={onDelete}><Trash2 size={15}/>Eliminar</button></div>
      </> : <>
        <InspectorSection title="Proyecto">
          <Field label="Nombre"><input value={project.name} onChange={e => onProject({ name: e.target.value })}/></Field>
          <Field label="Descripción"><textarea value={project.description} onChange={e => onProject({ description: e.target.value })} rows={4}/></Field>
          <dl className="metrics-list"><div><dt>Componentes</dt><dd>{project.components.length}</dd></div><div><dt>Cables</dt><dd>{project.wires.length}</dd></div><div><dt>Encapsulados</dt><dd>{project.modules.length}</dd></div></dl>
        </InspectorSection>
        <InspectorSection title="Encapsulados">
          <div className="module-list">{project.modules.map(module => <button key={module.id} onClick={() => onSelectModule(module.id)}><span style={{ background: module.color }}/><span>{module.name}<small>{module.memberIds.length} elementos</small></span><ChevronRight size={14}/></button>)}</div>
        </InspectorSection>
        <div className="empty-inspector"><MouseHint/><p>Selecciona un componente para editar sus valores. Con <kbd>Mayús</kbd> puedes seleccionar varios.</p></div>
      </>}
    </div>
  </aside>;
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="inspector-section"><h3>{title}</h3>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="property-field"><span>{label}</span>{children}</label>; }
function NumberInput({ value, onChange, suffix }: { value: number; onChange(value: number): void; suffix?: string }) { return <span className="number-control"><input type="number" value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Number(e.target.value))}/>{suffix && <small>{suffix}</small>}</span>; }
function Toggle({ checked, onChange }: { checked: boolean; onChange(value: boolean): void }) { return <button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}><span/></button>; }
function humanize(value: string) { const labels:Record<string,string>={frequency:'Frecuencia',dutyCycle:'Ciclo útil',propagationDelay:'Retardo de propagación',voltage:'Tensión',currentLimit:'Límite de corriente',resistance:'Resistencia',capacitance:'Capacidad',inductance:'Inductancia',state:'Estado lógico',closed:'Estado del contacto'}; return labels[value] ?? value.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()); }
function unitFor(key: string) { const keyLower = key.toLowerCase(); if (keyLower.includes('voltage')) return 'V'; if (keyLower.includes('resistance')) return 'Ω'; if (keyLower.includes('capacitance')) return 'F'; if (keyLower.includes('inductance')) return 'H'; if (keyLower.includes('frequency')) return 'Hz'; if (keyLower.includes('delay')) return 'ns'; if (keyLower.includes('power')) return 'W'; return ''; }
function MouseHint() { return <svg viewBox="0 0 50 64" width="34"><rect x="9" y="2" width="32" height="58" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M25 3v20" stroke="currentColor"/><rect x="21" y="10" width="8" height="14" fill="currentColor"/></svg>; }

function ModulePinsEditor({ module, onChange }: { module: ModuleArea; onChange(pins: ModulePin[]): void }) {
  const change = (id: string, patch: Partial<ModulePin>) => onChange(module.pins.map(pin => pin.id === id ? { ...pin, ...patch } : pin));
  const add = (side: ModulePinSide) => onChange([...module.pins, {
    id: uid('pin'), name: `PIN ${module.pins.length + 1}`, kind: 'BIDIRECTIONAL', domain: 'MIXED', side,
    position: Math.min(.9, Math.max(.1, (module.pins.filter(pin => pin.side === side).length + 1) / (module.pins.filter(pin => pin.side === side).length + 2))),
  }]);
  return <div className="module-pins-editor">
    {module.pins.map((pin,index) => <article key={pin.id}>
      <header><b>{index + 1}</b><input value={pin.name} onChange={e => change(pin.id,{ name:e.target.value })}/><button onClick={() => onChange(module.pins.filter(item => item.id !== pin.id))}><Trash2 size={13}/></button></header>
      <div className="pin-editor-grid">
        <label>Lado<select value={pin.side} onChange={e => change(pin.id,{ side:e.target.value as ModulePinSide })}><option value="left">Izquierda</option><option value="right">Derecha</option><option value="top">Superior</option><option value="bottom">Inferior</option></select></label>
        <label>Tipo<select value={pin.kind} onChange={e => change(pin.id,{ kind:e.target.value as PinKind })}><option>INPUT</option><option>OUTPUT</option><option>BIDIRECTIONAL</option><option>POWER</option><option>VCC</option><option>GND</option><option>ANALOG</option></select></label>
        <label>Señal<select value={pin.domain} onChange={e => change(pin.id,{ domain:e.target.value as SignalDomain })}><option>ANALOG</option><option>DIGITAL</option><option>MIXED</option><option>POWER</option></select></label>
        <label>Posición<input type="number" min="0" max="100" value={Math.round(pin.position*100)} onChange={e => change(pin.id,{ position:Math.max(0,Math.min(1,Number(e.target.value)/100)) })}/></label>
        <label>Tensión nominal<input type="number" value={pin.nominalVoltage ?? ''} placeholder="—" onChange={e => change(pin.id,{ nominalVoltage:e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
      </div>
    </article>)}
    <div className="add-pin-row">{(['left','right','top','bottom'] as ModulePinSide[]).map(side => <button key={side} onClick={() => add(side)}><Plus size={12}/>{side === 'left' ? 'Izq.' : side === 'right' ? 'Der.' : side === 'top' ? 'Sup.' : 'Inf.'}</button>)}</div>
  </div>;
}
