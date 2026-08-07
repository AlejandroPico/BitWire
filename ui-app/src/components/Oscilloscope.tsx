import {
  Activity, BarChart3, Check, ChevronDown, ChevronUp, Gauge, Layers3, Radio,
  Rows3, SlidersHorizontal, TimerReset, Waves, Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import type { BitWireProject, ComponentDefinition, ComponentInstance, SimulationSnapshot } from '../model/types';
import {
  captureInstrument, formatFrequency, formatPeriod, instrumentComponents,
  instrumentDisplayName, type InstrumentCapture,
} from './instrumentData';

interface Props { collapsed: boolean; project: BitWireProject; samples: SimulationSnapshot[]; onToggle(): void }
type TrayMode = 'separate' | 'combined';
interface InstrumentEntry {
  component: ComponentInstance;
  definition: ComponentDefinition;
  capture: InstrumentCapture;
  label: string;
  color: string;
}

const STORAGE_KEY = 'bitwire:instrument-instances';
const MODE_KEY = 'bitwire:instrument-layout';
const COLORS = ['#2be4c4','#f5b942','#7b8cff','#ff6f91','#64c8ff','#b4e36b','#d792ff','#ff9e52'];

export function InstrumentTray({ collapsed, project, samples, onToggle }: Props) {
  const components = useMemo(()=>instrumentComponents(project),[project]);
  const entries = useMemo(()=>components.flatMap((component,index)=>{
    const definition=CATALOG_BY_ID.get(component.definitionId);
    return definition?[{component,definition,capture:captureInstrument(project,component,samples),label:instrumentDisplayName(project,component),color:COLORS[index%COLORS.length]}]:[];
  }),[components,project,samples]);
  const idsKey=entries.map(entry=>entry.component.id).join('|');
  const storageKey=`${STORAGE_KEY}:${project.id}`;
  const [selected,setSelected]=useState<Set<string>>(()=>loadSelection(storageKey,entries.map(entry=>entry.component.id)));
  const [mode,setMode]=useState<TrayMode>(()=>localStorage.getItem(MODE_KEY)==='combined'?'combined':'separate');
  const [pickerOpen,setPickerOpen]=useState(false);

  useEffect(()=>setSelected(loadSelection(storageKey,entries.map(entry=>entry.component.id))),[storageKey,idsKey]);
  const visible=entries.filter(entry=>selected.has(entry.component.id));
  const persist=(next:Set<string>)=>{setSelected(next);localStorage.setItem(storageKey,JSON.stringify([...next]));};
  const toggle=(id:string)=>{const next=new Set(selected);next.has(id)?next.delete(id):next.add(id);persist(next);};
  const selectAll=()=>persist(new Set(entries.map(entry=>entry.component.id)));
  const selectNone=()=>persist(new Set());
  const changeMode=(next:TrayMode)=>{setMode(next);localStorage.setItem(MODE_KEY,next);};

  if(collapsed)return <div className="instrument-tray collapsed"><button onClick={onToggle}><Activity size={15}/>Banco de instrumentación <span>{visible.length}/{entries.length} activos</span><ChevronUp size={15}/></button></div>;

  return <section className="instrument-tray">
    <div className="instrument-heading">
      <div><Activity size={16}/><strong>Banco de instrumentación</strong><span>{entries.length} aparatos · captura en vivo</span></div>
      <div className="instrument-heading-actions">
        <div className="instrument-mode-toggle" role="group" aria-label="Disposición de instrumentos">
          <button className={mode==='separate'?'active':''} onClick={()=>changeMode('separate')} title="Una vista por instrumento"><Rows3 size={13}/><span>Separados</span></button>
          <button className={mode==='combined'?'active':''} onClick={()=>changeMode('combined')} title="Superponer instrumentos"><Layers3 size={13}/><span>Combinado</span></button>
        </div>
        <button className={pickerOpen?'instrument-view-button active':'instrument-view-button'} onClick={()=>setPickerOpen(value=>!value)}><SlidersHorizontal size={14}/><span>Aparatos</span><b>{visible.length}/{entries.length}</b></button>
        <button onClick={onToggle} title="Plegar banco"><ChevronDown size={15}/></button>
      </div>
    </div>
    {pickerOpen&&<div className="instrument-picker" role="group" aria-label="Instrumentos visibles">
      <header><div><strong>APARATOS DEL CIRCUITO</strong><small>Selecciona uno, varios o todos; cada lectura conserva su identidad</small></div><nav><button onClick={selectAll}>TODOS</button><button onClick={selectNone}>NINGUNO</button><button onClick={()=>setPickerOpen(false)}>HECHO</button></nav></header>
      {entries.length?<div>{entries.map(entry=>{const Icon=iconFor(entry.definition.id),active=selected.has(entry.component.id);return <button key={entry.component.id} className={active?'active':''} role="checkbox" aria-checked={active} onClick={()=>toggle(entry.component.id)}><Icon size={16}/><span><strong>{entry.label}</strong><small>{entry.definition.name} · {connectedPins(entry.capture)} conexiones</small></span><i>{active&&<Check size={11}/>}</i></button>;})}</div>:<p className="instrument-picker-empty">No hay instrumentos colocados en el proyecto.</p>}
    </div>}
    {!entries.length?<Empty title="El circuito todavía no tiene instrumentos" detail="Arrastra un osciloscopio, multímetro u otro aparato desde Instrumentación."/>:!visible.length?<div className="instrument-empty"><Activity size={23}/><div><strong>No hay aparatos seleccionados</strong><span>Activa uno o varios instrumentos reales del circuito.</span></div><button onClick={()=>setPickerOpen(true)}>Seleccionar aparatos</button></div>:mode==='combined'?<CombinedView entries={visible}/>:<div className="instrument-grid">{visible.map(entry=><InstrumentCard key={entry.component.id} entry={entry}/>)}</div>}
  </section>;
}

function InstrumentCard({entry}:{entry:InstrumentEntry}) {
  const Icon=iconFor(entry.definition.id), type=entry.definition.id;
  const series=seriesFor(entry), logic=primaryPin(entry.capture)?.logic ?? [];
  const points=tracePoints(type==='logic_analyzer'?logic.map(value=>value===1?1:0):series,600,90);
  return <article className={`instance-instrument ${type}`} data-instrument-id={entry.component.id}>
    <header><Icon size={15}/><strong>{entry.label}</strong><span>{entry.definition.name}</span><b>{reading(entry)}</b></header>
    {type==='spectrum_analyzer'?<svg viewBox="0 0 384 90" preserveAspectRatio="none" aria-label={`Espectro de ${entry.label}`}>{entry.capture.spectrum.slice(0,24).map((value,index)=><rect key={index} x={index*16+2} y={86-value*78} width="11" height={value*78} className="spectrum-bar"/>)}</svg>
      :['multimeter','power_monitor','frequency_counter','probe'].includes(type)?<div className="instance-readout"><small>{metricLabel(type)}</small><strong>{reading(entry)}</strong><span>{secondaryReading(entry)}</span></div>
      :<svg viewBox="0 0 600 90" preserveAspectRatio="none" aria-label={`Captura de ${entry.label}`}><defs><pattern id={`grid-${safeId(entry.component.id)}`} width="60" height="18" patternUnits="userSpaceOnUse"><path d="M60 0H0V18" fill="none" stroke="currentColor" strokeOpacity=".18"/></pattern></defs><rect width="600" height="90" fill={`url(#grid-${safeId(entry.component.id)})`}/><polyline points={points} className={`wave ${type==='logic_analyzer'?'logic-wave':'voltage-wave'}`}/></svg>}
    <footer><span>{primaryPin(entry.capture)?.pinName ?? 'SIN SONDA'}</span><span>{entry.capture.duration.toFixed(3)} s</span><span>{connectedPins(entry.capture)} canales conectados</span></footer>
  </article>;
}

function CombinedView({entries}:{entries:InstrumentEntry[]}) {
  return <article className="combined-instrument">
    <header><Layers3 size={15}/><strong>Vista unificada</strong><span>{entries.length} instrumentos superpuestos · escala normalizada individual</span></header>
    <div className="combined-display"><svg viewBox="0 0 900 120" preserveAspectRatio="none" aria-label="Capturas combinadas"><defs><pattern id="combined-grid" width="90" height="24" patternUnits="userSpaceOnUse"><path d="M90 0H0V24" fill="none" stroke="currentColor" strokeOpacity=".16"/></pattern></defs><rect width="900" height="120" fill="url(#combined-grid)"/>{entries.map(entry=><polyline key={entry.component.id} data-instrument-id={entry.component.id} points={tracePoints(seriesFor(entry),900,112,4)} fill="none" stroke={entry.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>)}</svg>
      <div className="instrument-legend">{entries.map(entry=><div key={entry.component.id}><i style={{background:entry.color}}/><span><strong>{entry.label}</strong><small>{entry.definition.name}</small></span><b>{reading(entry)}</b></div>)}</div>
    </div><footer><span>TIEMPO →</span><span>Las señales se normalizan para poder comparar formas y eventos.</span></footer>
  </article>;
}

function Empty({title,detail}:{title:string;detail:string}) { return <div className="instrument-empty"><Activity size={23}/><div><strong>{title}</strong><span>{detail}</span></div></div>; }
function loadSelection(key:string,ids:string[]) { try { const stored=localStorage.getItem(key); if(stored===null)return new Set(ids); const parsed=JSON.parse(stored) as string[]; return new Set(parsed.filter(id=>ids.includes(id))); } catch { return new Set(ids); } }
function safeId(id:string){return id.replace(/[^a-zA-Z0-9_-]/g,'-');}
function connectedPins(capture:InstrumentCapture){return capture.pins.filter(pin=>pin.wireId).length;}
function primaryPin(capture:InstrumentCapture){return capture.pins.find(pin=>pin.wireId&&pin.pinId!=='gnd')??capture.pins[0];}
function seriesFor(entry:InstrumentEntry) {
  const pin=primaryPin(entry.capture), type=entry.definition.id;
  if(type==='spectrum_analyzer')return entry.capture.spectrum;
  if(type==='logic_analyzer')return (pin?.logic??[]).map(value=>value===1?1:0);
  if(type==='power_monitor')return (pin?.values??[]).map((value,index)=>Math.abs(value*(pin?.currents[index]??0)));
  if(type==='frequency_counter')return (pin?.values??[]).map(()=>entry.capture.frequency);
  return pin?.values??[];
}
function tracePoints(values:number[],width:number,height:number,padding=3) { const source=values.slice(-160); if(!source.length)return `${padding},${height/2} ${width-padding},${height/2}`; const min=Math.min(...source),max=Math.max(...source),range=Math.max(.000001,max-min); return source.map((value,index)=>`${padding+index*(width-padding*2)/Math.max(1,source.length-1)},${padding+(max-value)/range*(height-padding*2)}`).join(' '); }
function reading(entry:InstrumentEntry){const capture=entry.capture,type=entry.definition.id;if(type==='frequency_counter')return formatFrequency(capture.frequency);if(type==='power_monitor')return `${capture.power.toFixed(3)} W`;if(type==='logic_analyzer')return `D ${primaryPin(capture)?.logic.at(-1)??'Z'}`;if(type==='spectrum_analyzer')return `${capture.maximum.toFixed(2)} Vpk`;if(type==='probe')return `${capture.voltage.toFixed(3)} V`;return `${capture.voltage.toFixed(3)} V`;}
function secondaryReading(entry:InstrumentEntry){const capture=entry.capture,type=entry.definition.id;if(type==='frequency_counter')return `Periodo ${formatPeriod(capture.period)}`;if(type==='power_monitor')return `Energía ${capture.energy.toFixed(4)} J`;if(type==='multimeter')return `I ${Math.abs(capture.current*1000).toFixed(3)} mA · RMS ${capture.rms.toFixed(3)} V`;return `Mín ${capture.minimum.toFixed(2)} · Máx ${capture.maximum.toFixed(2)}`;}
function metricLabel(type:string){if(type==='frequency_counter')return 'FRECUENCIA';if(type==='power_monitor')return 'POTENCIA INSTANTÁNEA';if(type==='multimeter')return 'MEDIDA PRINCIPAL';return 'LECTURA DE SONDA';}
function iconFor(type:string):ComponentType<{size?:number}>{if(type==='oscilloscope')return Waves;if(type==='logic_analyzer')return Radio;if(type==='spectrum_analyzer')return BarChart3;if(type==='power_monitor')return Zap;if(type==='frequency_counter')return TimerReset;return Gauge;}
