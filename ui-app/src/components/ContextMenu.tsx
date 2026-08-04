import {
  Activity, Box, Copy, Eye, EyeOff, FolderOpen, Inspect, Lock, MousePointer2,
  Play, RotateCw, Save, Trash2, Unlock, Waypoints, Wrench,
} from 'lucide-react';
import { useEffect } from 'react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import type { BitWireProject } from '../model/types';

export type ContextTarget =
  | { kind:'component'; id:string; x:number; y:number }
  | { kind:'module'; id:string; x:number; y:number }
  | { kind:'wire'; id:string; x:number; y:number }
  | { kind:'canvas'; x:number; y:number };

export type ContextAction =
  | 'instrument'|'inspect'|'duplicate'|'rotate'|'toggle'|'lock'|'delete'
  | 'enter-module'|'save-module'|'collapse-module'|'select-tool'|'wire-tool'|'module-tool';

interface Props {
  target: ContextTarget;
  project: BitWireProject;
  onAction(action:ContextAction):void;
  onClose():void;
}

export function ContextMenu({target,project,onAction,onClose}:Props) {
  useEffect(()=>{
    const close=()=>onClose();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',key);};
  },[onClose]);
  const position={left:Math.min(target.x,window.innerWidth-260),top:Math.min(target.y,window.innerHeight-390)};
  const run=(action:ContextAction)=>{onAction(action);onClose();};

  if(target.kind==='component'){
    const component=project.components.find(item=>item.id===target.id);
    const definition=component&&CATALOG_BY_ID.get(component.definitionId);
    if(!component||!definition)return null;
    return <menu className="object-context-menu" style={position} onPointerDown={event=>event.stopPropagation()}>
      <header><span>{glyph(definition.symbol)}</span><div><strong>{definition.name}</strong><small>{component.id}</small></div></header>
      {definition.customGui&&<button className="context-primary" onClick={()=>run('instrument')}><Activity size={15}/><span><strong>Abrir interfaz del instrumento</strong><small>Lectura independiente y controles profesionales</small></span></button>}
      <button onClick={()=>run('inspect')}><Inspect size={14}/><span>Mostrar en el inspector</span><kbd>doble clic</kbd></button>
      <button onClick={()=>run('duplicate')}><Copy size={14}/><span>Duplicar componente</span></button>
      <button onClick={()=>run('rotate')}><RotateCw size={14}/><span>Girar 90°</span></button>
      <button onClick={()=>run('toggle')}>{component.enabled?<EyeOff size={14}/>:<Eye size={14}/>}<span>{component.enabled?'Desactivar':'Activar'}</span></button>
      <button onClick={()=>run('lock')}>{component.locked?<Unlock size={14}/>:<Lock size={14}/>}<span>{component.locked?'Desbloquear posición':'Bloquear posición'}</span></button>
      <hr/><button className="danger" onClick={()=>run('delete')}><Trash2 size={14}/><span>Eliminar componente</span><kbd>Supr</kbd></button>
    </menu>;
  }
  if(target.kind==='module'){
    const module=project.modules.find(item=>item.id===target.id);if(!module)return null;
    return <menu className="object-context-menu" style={position} onPointerDown={event=>event.stopPropagation()}>
      <header><span style={{borderColor:module.color,color:module.color}}><Box size={16}/></span><div><strong>{module.name}</strong><small>{module.pins.length} patillas · {module.memberIds.length} elementos</small></div></header>
      <button className="context-primary" onClick={()=>run('enter-module')}><FolderOpen size={15}/><span><strong>Entrar en el lienzo interno</strong><small>Ver composición y funcionamiento</small></span></button>
      <button onClick={()=>run('inspect')}><Wrench size={14}/><span>Configurar encapsulado</span></button>
      <button onClick={()=>run('save-module')}><Save size={14}/><span>Guardar en Mi biblioteca</span></button>
      <button onClick={()=>run('collapse-module')}><Box size={14}/><span>{module.collapsed?'Mostrar como área':'Mostrar como chip'}</span></button>
      <button onClick={()=>run('toggle')}>{module.enabled?<EyeOff size={14}/>:<Play size={14}/>}<span>{module.enabled?'Aislar encapsulado':'Activar encapsulado'}</span></button>
      <hr/><button className="danger" onClick={()=>run('delete')}><Trash2 size={14}/><span>Eliminar encapsulado y contenido</span></button>
    </menu>;
  }
  if(target.kind==='wire')return <menu className="object-context-menu" style={position} onPointerDown={event=>event.stopPropagation()}><header><span>⌁</span><div><strong>Conexión</strong><small>{target.id}</small></div></header><button className="danger" onClick={()=>run('delete')}><Trash2 size={14}/><span>Eliminar conexión</span></button></menu>;
  return <menu className="object-context-menu" style={position} onPointerDown={event=>event.stopPropagation()}>
    <header><span>＋</span><div><strong>Lienzo BitWire</strong><small>Herramienta de trabajo</small></div></header>
    <button onClick={()=>run('select-tool')}><MousePointer2 size={14}/><span>Herramienta Selección</span><kbd>V</kbd></button>
    <button onClick={()=>run('wire-tool')}><Waypoints size={14}/><span>Herramienta Cable</span><kbd>W</kbd></button>
    <button onClick={()=>run('module-tool')}><Box size={14}/><span>Crear encapsulado</span></button>
  </menu>;
}

function glyph(symbol:string){if(symbol==='oscilloscope')return '∿';if(symbol==='analyzer')return '▥';if(symbol==='multimeter')return 'VΩ';if(symbol.includes('gate'))return '∧';return '◇';}
