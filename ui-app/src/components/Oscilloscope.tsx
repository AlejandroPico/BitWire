import {
  Activity, BarChart3, Check, ChevronDown, ChevronUp, Gauge, Radio,
  SlidersHorizontal, TimerReset, Waves, Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SimulationSnapshot } from '../model/types';

interface Props { collapsed: boolean; samples: SimulationSnapshot[]; onToggle(): void }
type InstrumentId = 'scope' | 'logic' | 'multimeter' | 'power' | 'spectrum' | 'frequency';

const STORAGE_KEY = 'bitwire:instrument-views';
const INSTRUMENTS: Array<{ id: InstrumentId; name: string; description: string; icon: typeof Activity }> = [
  { id:'scope',name:'Osciloscopio',description:'Tensión frente al tiempo',icon:Waves },
  { id:'logic',name:'Analizador lógico',description:'Estados y transiciones digitales',icon:Radio },
  { id:'multimeter',name:'Multímetro',description:'Medidas eléctricas instantáneas',icon:Gauge },
  { id:'power',name:'Monitor de potencia',description:'Consumo y carga de las redes',icon:Zap },
  { id:'spectrum',name:'Analizador de espectro',description:'Contenido frecuencial relativo',icon:BarChart3 },
  { id:'frequency',name:'Frecuencímetro',description:'Frecuencia y periodo estimados',icon:TimerReset },
];

function loadViews(): Set<InstrumentId> {
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as InstrumentId[];
    const valid=parsed.filter(id=>INSTRUMENTS.some(item=>item.id===id));
    return new Set(valid.length?valid:['scope','logic']);
  } catch { return new Set(['scope','logic']); }
}

export function InstrumentTray({ collapsed, samples, onToggle }: Props) {
  const [selected,setSelected]=useState<Set<InstrumentId>>(loadViews);
  const [pickerOpen,setPickerOpen]=useState(false);
  const recent=samples.slice(-120);
  const voltages=recent.map(sample=>sample.wireSignals.w_scope?.voltage ?? sample.wireSignals.w_gate_out?.voltage ?? 0);
  const logics=recent.map(sample=>sample.wireSignals.w_gate_out?.logic===1?1:0);
  const last=recent.at(-1);
  const signals=Object.values(last?.wireSignals ?? {});
  const activeSignals=signals.filter(signal=>signal.active);
  const voltage=voltages.at(-1) ?? 0;
  const current=activeSignals.length?activeSignals.reduce((sum,signal)=>sum+Math.abs(signal.current),0)/activeSignals.length:0;
  const totalPower=activeSignals.reduce((sum,signal)=>sum+Math.abs(signal.voltage*signal.current),0);
  const peakPower=Math.max(0,...recent.map(sample=>Object.values(sample.wireSignals).reduce((sum,signal)=>sum+Math.abs(signal.voltage*signal.current),0)));
  const duration=Math.max(.001,(recent.at(-1)?.time ?? 0)-(recent[0]?.time ?? 0));
  const transitions=logics.slice(1).reduce<number>((count,value,index)=>count+(value!==logics[index]?1:0),0);
  const frequency=transitions/(2*duration);
  const period=frequency>0?1/frequency:0;
  const points=voltages.map((value,index)=>`${index*(600/Math.max(1,voltages.length-1))},${82-Math.max(-10,Math.min(10,value))*6}`).join(' ');
  const logicPoints=logics.map((value,index)=>`${index*(600/Math.max(1,logics.length-1))},${value?25:55}`).join(' ');
  const spectrum=useMemo(()=>spectrumBins(voltages,18),[voltages]);

  const toggleView=(id:InstrumentId)=>setSelected(current=>{
    const next=new Set(current); next.has(id)?next.delete(id):next.add(id);
    localStorage.setItem(STORAGE_KEY,JSON.stringify([...next])); return next;
  });

  if(collapsed)return <div className="instrument-tray collapsed"><button onClick={onToggle}><Activity size={15}/>Instrumentos virtuales <span>{selected.size} vistas activas</span><ChevronUp size={15}/></button></div>;

  return <section className="instrument-tray">
    <div className="instrument-heading">
      <div><Activity size={16}/><strong>Banco de instrumentación</strong><span>captura en vivo</span></div>
      <div className="instrument-heading-actions">
        <button className={pickerOpen?'instrument-view-button active':'instrument-view-button'} onClick={()=>setPickerOpen(value=>!value)}><SlidersHorizontal size={14}/><span>Vistas</span><b>{selected.size}/{INSTRUMENTS.length}</b></button>
        <button onClick={onToggle} title="Plegar banco"><ChevronDown size={15}/></button>
      </div>
    </div>
    {pickerOpen&&<div className="instrument-picker" role="group" aria-label="Instrumentos visibles">
      <header><div><strong>VISTAS DEL BANCO</strong><small>Combina todos los instrumentos que necesites</small></div><button onClick={()=>setPickerOpen(false)}>HECHO</button></header>
      <div>{INSTRUMENTS.map(item=>{const Icon=item.icon,active=selected.has(item.id);return <button key={item.id} className={active?'active':''} role="checkbox" aria-checked={active} onClick={()=>toggleView(item.id)}><Icon size={16}/><span><strong>{item.name}</strong><small>{item.description}</small></span><i>{active&&<Check size={11}/>}</i></button>;})}</div>
    </div>}
    {selected.size?<div className="instrument-grid">
      {selected.has('scope')&&<article className="scope-instrument"><header><Waves size={15}/><strong>Osciloscopio</strong><span className="channel-dot ch1"/>CH1 <b>{voltage.toFixed(2)} V</b></header>
        <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-label="Forma de onda de tensión"><defs><pattern id="scopeGrid" width="60" height="20" patternUnits="userSpaceOnUse"><path d="M60 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".18"/></pattern></defs><rect width="600" height="100" fill="url(#scopeGrid)"/><line x1="0" y1="82" x2="600" y2="82" className="zero-line"/><polyline points={points||'0,82 600,82'} className="wave voltage-wave"/></svg>
        <footer><span>1 V/div</span><span>100 ms/div</span><span>DC</span><span>AUTO</span></footer></article>}
      {selected.has('logic')&&<article className="logic-instrument"><header><Radio size={15}/><strong>Analizador lógico</strong><span>D0 / AND.Q</span></header>
        <svg viewBox="0 0 600 80" preserveAspectRatio="none" aria-label="Traza lógica"><defs><pattern id="logicGrid" width="60" height="20" patternUnits="userSpaceOnUse"><path d="M60 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".14"/></pattern></defs><rect width="600" height="80" fill="url(#logicGrid)"/><polyline points={logicPoints||'0,55 600,55'} className="wave logic-wave"/></svg>
        <footer><span>Estado: <b>{logics.at(-1)??0}</b></span><span>{transitions} flancos</span><span>1 MHz máx.</span></footer></article>}
      {selected.has('multimeter')&&<article className="meter-instrument"><header><Gauge size={15}/><strong>Multímetro</strong><span>AUTO RANGE</span></header>
        <div className="meter-display"><small>TENSIÓN DE SONDA</small><strong>{voltage.toFixed(3)}</strong><b>V DC</b><span className={voltage?'live':''}>●</span></div>
        <footer><span>I media {(current*1000).toFixed(2)} mA</span><span>{activeSignals.length} redes activas</span></footer></article>}
      {selected.has('power')&&<article className="power-instrument"><header><Zap size={15}/><strong>Monitor de potencia</strong><span>AGREGADO</span><b>{totalPower.toFixed(3)} W</b></header>
        <div className="power-display"><div><span style={{width:`${Math.min(100,totalPower/Math.max(.001,peakPower)*100)}%`}}/></div><dl><div><dt>Actual</dt><dd>{totalPower.toFixed(3)} W</dd></div><div><dt>Pico</dt><dd>{peakPower.toFixed(3)} W</dd></div><div><dt>Redes</dt><dd>{activeSignals.length}</dd></div></dl></div>
        <footer><span>P = V × I</span><span>valor absoluto acumulado</span></footer></article>}
      {selected.has('spectrum')&&<article className="spectrum-instrument"><header><BarChart3 size={15}/><strong>Analizador de espectro</strong><span>FFT RELATIVA</span></header>
        <svg viewBox="0 0 360 90" preserveAspectRatio="none" aria-label="Espectro relativo">{spectrum.map((value,index)=><rect key={index} x={index*20+3} y={86-value*76} width="13" height={value*76} className="spectrum-bar"/>)}</svg>
        <footer><span>DC</span><span>frecuencia →</span><span>Nyquist</span></footer></article>}
      {selected.has('frequency')&&<article className="frequency-instrument"><header><TimerReset size={15}/><strong>Frecuencímetro</strong><span>AND.Q</span></header>
        <div className="frequency-display"><small>FRECUENCIA ESTIMADA</small><strong>{formatFrequency(frequency)}</strong><span>Periodo {period?formatPeriod(period):'—'}</span></div>
        <footer><span>{transitions} transiciones</span><span>ventana {duration.toFixed(2)} s</span></footer></article>}
    </div>:<div className="instrument-empty"><Activity size={23}/><div><strong>No hay instrumentos visibles</strong><span>Abre Vistas y activa una o varias herramientas de medida.</span></div><button onClick={()=>setPickerOpen(true)}>Seleccionar vistas</button></div>}
  </section>;
}

function spectrumBins(values:number[],count:number){
  if(values.length<2)return Array.from({length:count},()=>0);
  const source=values.slice(-64),magnitudes=Array.from({length:count},(_,bin)=>{
    let real=0,imaginary=0;
    source.forEach((value,index)=>{const angle=2*Math.PI*bin*index/source.length;real+=value*Math.cos(angle);imaginary-=value*Math.sin(angle);});
    return Math.hypot(real,imaginary)/source.length;
  });
  const max=Math.max(.0001,...magnitudes);return magnitudes.map(value=>value/max);
}
function formatFrequency(value:number){if(!Number.isFinite(value)||value<=0)return '0.000 Hz';if(value>=1_000_000)return `${(value/1_000_000).toFixed(3)} MHz`;if(value>=1_000)return `${(value/1_000).toFixed(3)} kHz`;return `${value.toFixed(3)} Hz`;}
function formatPeriod(value:number){if(value<.000001)return `${(value*1e9).toFixed(2)} ns`;if(value<.001)return `${(value*1e6).toFixed(2)} µs`;if(value<1)return `${(value*1000).toFixed(2)} ms`;return `${value.toFixed(3)} s`;}
