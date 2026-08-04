import { Box, ChevronRight, CirclePower, Copy, Layers3, RotateCw, Trash2, X } from 'lucide-react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import type { BitWireProject, ComponentInstance, ModuleArea, PropertyValue } from '../model/types';

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
}

export function Inspector({ project, selected, collapsed, onToggle, onProperty, onPatch, onProject, onDelete, onDuplicate, onSelectModule, selectedModule, onModule }: Props) {
  if (collapsed) return <aside className="inspector-panel collapsed-panel right"><button className="icon-button vertical-label" onClick={onToggle}>INSPECTOR</button></aside>;
  const component = selected.length === 1 ? project.components.find(item => item.id === selected[0]) : undefined;
  const definition = component ? CATALOG_BY_ID.get(component.definitionId) : undefined;

  return <aside className="inspector-panel">
    <div className="panel-heading"><div><span className="eyebrow">PROPIEDADES</span><h2>Inspector</h2></div><button className="icon-button" onClick={onToggle}><X size={17}/></button></div>
    <div className="inspector-scroll">
      {selectedModule ? <>
        <div className="selection-identity"><span className="identity-icon"><Box size={22}/></span><div><strong>{selectedModule.name}</strong><small>Encapsulado funcional</small></div></div>
        <Field label="Nombre"><input value={selectedModule.name} onChange={e => onModule({ name: e.target.value })}/></Field>
        <Field label="Activo"><Toggle checked={selectedModule.enabled} onChange={enabled => onModule({ enabled })}/></Field>
        <Field label="Color"><input type="color" value={selectedModule.color} onChange={e => onModule({ color: e.target.value })}/></Field>
        <dl className="metrics-list"><div><dt>Elementos</dt><dd>{selectedModule.memberIds.length}</dd></div><div><dt>Dimensiones</dt><dd>{Math.round(selectedModule.width)} × {Math.round(selectedModule.height)}</dd></div></dl>
      </> : component && definition ? <>
        <div className="selection-identity"><span className="identity-icon">{definition.symbol === 'chip' ? 'IC' : '◇'}</span><div><strong>{definition.name}</strong><small>{definition.category} / {definition.family}</small></div></div>
        <p className="component-description">{definition.description}</p>
        <div className="quick-actions"><button onClick={() => onPatch(component.id, { enabled: !component.enabled })}><CirclePower size={15}/>{component.enabled ? 'Desactivar' : 'Activar'}</button><button onClick={onDuplicate}><Copy size={15}/>Duplicar</button><button onClick={() => onPatch(component.id, { rotation: (component.rotation + 90) % 360 })}><RotateCw size={15}/>Girar</button><button className="danger" onClick={onDelete}><Trash2 size={15}/></button></div>
        <InspectorSection title="Transformación">
          <div className="field-grid"><Field label="X"><NumberInput value={component.x} onChange={x => onPatch(component.id, { x })}/></Field><Field label="Y"><NumberInput value={component.y} onChange={y => onPatch(component.id, { y })}/></Field></div>
          <Field label="Rotación"><NumberInput value={component.rotation} onChange={rotation => onPatch(component.id, { rotation })} suffix="°"/></Field>
          <Field label="Bloqueado"><Toggle checked={Boolean(component.locked)} onChange={locked => onPatch(component.id, { locked })}/></Field>
        </InspectorSection>
        <InspectorSection title="Parámetros del modelo">
          {Object.entries(component.properties).map(([key, value]) => <Field key={key} label={humanize(key)}>{typeof value === 'boolean' ? <Toggle checked={value} onChange={next => onProperty(component.id, key, next)}/> : typeof value === 'number' ? <NumberInput value={value} onChange={next => onProperty(component.id, key, next)} suffix={unitFor(key)}/> : key.toLowerCase().includes('color') ? <input type="color" value={String(value)} onChange={e => onProperty(component.id, key, e.target.value)}/> : <input value={String(value)} onChange={e => onProperty(component.id, key, e.target.value)}/>}</Field>)}
        </InspectorSection>
        <InspectorSection title="Conectividad"><dl className="pin-list">{definition.pins.map(pin => <div key={pin.id}><dt><span className={`pin-kind ${pin.kind.toLowerCase()}`}/>{pin.name}</dt><dd>{pin.kind} · {pin.domain}</dd></div>)}</dl></InspectorSection>
        {definition.internal && <div className="deep-zoom-note"><Layers3 size={17}/><div><strong>Modelo jerárquico disponible</strong><span>Amplía el componente o haz doble clic para revelar su red interna.</span></div></div>}
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
function humanize(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()); }
function unitFor(key: string) { const keyLower = key.toLowerCase(); if (keyLower.includes('voltage')) return 'V'; if (keyLower.includes('resistance')) return 'Ω'; if (keyLower.includes('capacitance')) return 'F'; if (keyLower.includes('inductance')) return 'H'; if (keyLower.includes('frequency')) return 'Hz'; if (keyLower.includes('delay')) return 'ns'; if (keyLower.includes('power')) return 'W'; return ''; }
function MouseHint() { return <svg viewBox="0 0 50 64" width="34"><rect x="9" y="2" width="32" height="58" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M25 3v20" stroke="currentColor"/><rect x="21" y="10" width="8" height="14" fill="currentColor"/></svg>; }

