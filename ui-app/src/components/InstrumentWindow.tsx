import {
  Activity, BarChart3, ChevronDown, ChevronUp, Gauge, Maximize2, Minimize2,
  Minus, Radio, RotateCcw, Square, TimerReset, Waves, X, Zap,
} from 'lucide-react';
import { useMemo, useRef } from 'react';
import { CATALOG_BY_ID } from '../catalog/catalog';
import type { BitWireProject, ComponentInstance, PropertyValue, SimulationSnapshot } from '../model/types';
import { captureInstrument, formatFrequency, formatPeriod } from './instrumentData';

export interface InstrumentWindowState {
  id: string;
  componentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  expanded: boolean;
  minimized: boolean;
  maximized: boolean;
}

interface Props {
  state: InstrumentWindowState;
  component: ComponentInstance;
  project: BitWireProject;
  samples: SimulationSnapshot[];
  onState(patch: Partial<InstrumentWindowState>): void;
  onPatch(properties: Record<string,PropertyValue>): void;
  onClose(): void;
  onFocus(): void;
}

type PointerOperation = { mode:'drag'|'resize'; x:number; y:number; left:number; top:number; width:number; height:number };

export function InstrumentWindow({ state,component,project,samples,onState,onPatch,onClose,onFocus }:Props) {
  const definition=CATALOG_BY_ID.get(component.definitionId);
  const capture=useMemo(()=>captureInstrument(project,component,samples),[project,component,samples]);
  const operation=useRef<PointerOperation|undefined>(undefined);
  const Icon=iconFor(component.definitionId);
  const connected=capture.pins.filter(pin=>pin.wireId).length;

  const begin=(event:React.PointerEvent,mode:'drag'|'resize')=>{
    if(state.maximized)return;
    event.stopPropagation(); onFocus();
    operation.current={mode,x:event.clientX,y:event.clientY,left:state.x,top:state.y,width:state.width,height:state.height};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=(event:React.PointerEvent)=>{
    const current=operation.current;if(!current)return;
    if(current.mode==='drag')onState({x:Math.max(0,Math.min(window.innerWidth-220,current.left+event.clientX-current.x)),y:Math.max(54,Math.min(window.innerHeight-65,current.top+event.clientY-current.y))});
    else onState({width:Math.max(460,Math.min(window.innerWidth-30,current.width+event.clientX-current.x)),height:Math.max(280,Math.min(window.innerHeight-40,current.height+event.clientY-current.y))});
  };
  const finish=()=>{operation.current=undefined;};
  const toggleExpanded=()=>{
    const expanded=!state.expanded;
    localStorage.setItem('bitwire:instrument-professional-view',expanded?'1':'0');
    onState({expanded,minimized:false,width:expanded?Math.max(900,state.width):Math.min(640,state.width),height:expanded?Math.max(590,state.height):Math.min(410,state.height)});
  };

  return <section className={`floating-instrument ${state.expanded?'expanded':''} ${state.minimized?'minimized':''} ${state.maximized?'maximized':''}`} style={{left:state.x,top:state.y,width:state.width,height:state.height,zIndex:state.z}} onPointerDown={onFocus} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} aria-label={`${definition?.name ?? 'Instrumento'} ${component.id}`}>
    <header className="floating-instrument-titlebar" onPointerDown={event=>begin(event,'drag')}>
      <span className="instrument-title-icon"><Icon size={16}/></span>
      <div><strong>{definition?.name ?? 'Instrumento virtual'}</strong><small>{component.id} · {connected}/{capture.pins.length} terminales conectados</small></div>
      <span className={component.enabled?'instrument-online':'instrument-offline'}>{component.enabled?'ADQUISICIÓN':'DESACTIVADO'}</span>
      <nav onPointerDown={event=>event.stopPropagation()}>
        <button className={state.expanded?'active':''} onClick={toggleExpanded} title={state.expanded?'Ocultar controles profesionales':'Extender controles profesionales'}>{state.expanded?<ChevronDown size={15}/>:<ChevronUp size={15}/>}</button>
        <button onClick={()=>onState({minimized:!state.minimized})} title={state.minimized?'Restaurar':'Minimizar'}><Minus size={15}/></button>
        <button onClick={()=>onState({maximized:!state.maximized,minimized:false})} title={state.maximized?'Restaurar tamaño':'Maximizar'}>{state.maximized?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>
        <button className="danger" onClick={onClose} title="Cerrar"><X size={16}/></button>
      </nav>
    </header>
    {!state.minimized&&<div className="floating-instrument-body">
      <section className="instrument-live-view">
        <InstrumentDisplay component={component} capture={capture}/>
        <footer><span><i className="online-dot"/>LIVE</span><span>{capture.duration.toFixed(3)} s de memoria</span><span>{samples.length} muestras</span><span>{connected?`${connected} entradas vinculadas`:'SIN SONDA'}</span></footer>
      </section>
      {state.expanded&&<ProfessionalControls component={component} capture={capture} onPatch={onPatch}/>} 
    </div>}
    {!state.minimized&&!state.maximized&&<button className="instrument-resize-handle" onPointerDown={event=>begin(event,'resize')} title="Redimensionar ventana"/>}
  </section>;
}

function InstrumentDisplay({component,capture}:{component:ComponentInstance;capture:ReturnType<typeof captureInstrument>}) {
  if(component.definitionId==='oscilloscope')return <ScopeDisplay capture={capture}/>;
  if(component.definitionId==='logic_analyzer')return <LogicDisplay capture={capture}/>;
  if(component.definitionId==='spectrum_analyzer')return <SpectrumDisplay capture={capture}/>;
  if(component.definitionId==='multimeter')return <MeterDisplay capture={capture} mode={String(component.properties.mode??'voltage')}/>;
  if(component.definitionId==='power_monitor')return <PowerDisplay capture={capture}/>;
  if(component.definitionId==='frequency_counter')return <FrequencyDisplay capture={capture}/>;
  return <ProbeDisplay capture={capture}/>;
}

function ScopeDisplay({capture}:{capture:ReturnType<typeof captureInstrument>}) {
  const ch1=capture.pins.find(pin=>pin.pinId==='ch1'),ch2=capture.pins.find(pin=>pin.pinId==='ch2');
  const scale=Math.max(.001,...[...(ch1?.values??[]),...(ch2?.values??[])].map(Math.abs));
  return <div className="professional-screen scope-screen"><ScreenGrid/>
    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-label="Pantalla del osciloscopio">
      <polyline className="trace trace-ch1" points={tracePoints(ch1?.values??[],800,360,scale)}/>
      <polyline className="trace trace-ch2" points={tracePoints(ch2?.values??[],800,360,scale)}/>
      <path className="trigger-line" d="M0 180H800"/><path className="cursor-line" d="M400 0V360"/>
    </svg>
    <div className="scope-readouts"><span className="ch1">CH1 {formatVoltage(ch1?.values.at(-1)??0)}</span><span className="ch2">CH2 {formatVoltage(ch2?.values.at(-1)??0)}</span><span>ΔV {(capture.maximum-capture.minimum).toFixed(3)} V</span><span>{formatFrequency(capture.frequency)}</span></div>
  </div>;
}

function LogicDisplay({capture}:{capture:ReturnType<typeof captureInstrument>}) {
  return <div className="professional-screen logic-screen"><ScreenGrid/><svg viewBox="0 0 800 360" preserveAspectRatio="none">{capture.pins.slice(0,8).map((pin,lane)=><g key={pin.pinId}><text x="8" y={lane*42+27}>{pin.pinName}</text><polyline className={`logic-trace lane-${lane}`} points={logicPoints(pin.logic,800,lane*42+9,lane*42+33)}/></g>)}</svg><div className="screen-corner-readout">{capture.transitions} FLANCOS · {formatFrequency(capture.frequency)}</div></div>;
}

function SpectrumDisplay({capture}:{capture:ReturnType<typeof captureInstrument>}) {
  return <div className="professional-screen spectrum-screen"><ScreenGrid/><svg viewBox="0 0 800 360" preserveAspectRatio="none"><polyline className="spectrum-trace" points={capture.spectrum.map((value,index)=>`${index*800/(capture.spectrum.length-1)},${340-value*315}`).join(' ')}/>{capture.spectrum.map((value,index)=><line key={index} className="spectrum-stem" x1={index*800/(capture.spectrum.length-1)} y1="340" x2={index*800/(capture.spectrum.length-1)} y2={340-value*315}/>)}</svg><div className="spectrum-axis"><span>START</span><span>CENTER</span><span>STOP</span></div></div>;
}

function MeterDisplay({capture,mode}:{capture:ReturnType<typeof captureInstrument>;mode:string}) {
  const reading=mode==='current'?`${(capture.current*1000).toFixed(3)} mA`:mode==='resistance'?`${Math.abs(capture.current)>1e-9?Math.abs(capture.voltage/capture.current).toFixed(2):'OL'} Ω`:mode==='frequency'?formatFrequency(capture.frequency):`${capture.voltage.toFixed(4)} V`;
  return <div className="professional-screen meter-screen"><header><span>TRUE RMS</span><span>AUTO RANGE</span><span>DC</span></header><strong>{reading}</strong><div className="meter-bar"><i style={{width:`${Math.min(100,Math.abs(capture.voltage)/10*100)}%`}}/></div><footer><span>MIN {capture.minimum.toFixed(3)}</span><span>AVG {capture.average.toFixed(3)}</span><span>MAX {capture.maximum.toFixed(3)}</span></footer></div>;
}

function PowerDisplay({capture}:{capture:ReturnType<typeof captureInstrument>}) {return <div className="professional-screen power-screen"><div><small>TENSIÓN</small><strong>{capture.voltage.toFixed(4)} V</strong></div><div><small>CORRIENTE</small><strong>{(capture.current*1000).toFixed(3)} mA</strong></div><div><small>POTENCIA</small><strong>{capture.power.toFixed(5)} W</strong></div><div><small>ENERGÍA</small><strong>{capture.energy.toFixed(6)} J</strong></div><span className="power-load-bar"><i style={{width:`${Math.min(100,capture.power*20)}%`}}/></span></div>;}
function FrequencyDisplay({capture}:{capture:ReturnType<typeof captureInstrument>}) {return <div className="professional-screen frequency-screen"><small>FREQUENCY COUNTER · CH A</small><strong>{formatFrequency(capture.frequency)}</strong><div><span>PERIODO <b>{formatPeriod(capture.period)}</b></span><span>DUTY <b>{capture.dutyCycle.toFixed(3)} %</b></span><span>FLANCOS <b>{capture.transitions}</b></span></div></div>;}
function ProbeDisplay({capture}:{capture:ReturnType<typeof captureInstrument>}) {return <div className="professional-screen probe-screen"><Activity size={34}/><div><small>SONDA ACTIVA</small><strong>{formatVoltage(capture.voltage)}</strong><span>{(capture.current*1000).toFixed(3)} mA · lógica {capture.pins[0]?.last?.logic??'Z'}</span></div></div>;}

function ProfessionalControls({component,capture,onPatch}:{component:ComponentInstance;capture:ReturnType<typeof captureInstrument>;onPatch(p:Record<string,PropertyValue>):void}) {
  const p=component.properties;
  if(component.definitionId==='oscilloscope')return <div className="professional-controls scope-controls">
    <ControlGroup title="VERTICAL · CH1"><Dial label="VOLTS/DIV" value={num(p.voltsDiv,1)} min={.001} max={20} step={.001} unit="V" onChange={value=>onPatch({voltsDiv:value})}/><Dial label="POSICIÓN" value={num(p.ch1Position,0)} min={-5} max={5} step={.1} unit="div" onChange={value=>onPatch({ch1Position:value})}/><Segment label="ACOPLAMIENTO" value={String(p.ch1Coupling??'DC')} options={['DC','AC','GND']} onChange={value=>onPatch({ch1Coupling:value})}/></ControlGroup>
    <ControlGroup title="VERTICAL · CH2"><Dial label="VOLTS/DIV" value={num(p.ch2VoltsDiv,p.voltsDiv,1)} min={.001} max={20} step={.001} unit="V" onChange={value=>onPatch({ch2VoltsDiv:value})}/><Dial label="POSICIÓN" value={num(p.ch2Position,0)} min={-5} max={5} step={.1} unit="div" onChange={value=>onPatch({ch2Position:value})}/><Segment label="ACOPLAMIENTO" value={String(p.ch2Coupling??'DC')} options={['DC','AC','GND']} onChange={value=>onPatch({ch2Coupling:value})}/></ControlGroup>
    <ControlGroup title="HORIZONTAL"><Dial label="TIEMPO/DIV" value={num(p.timeDiv,.1)} min={1e-9} max={10} step={1e-9} unit="s" onChange={value=>onPatch({timeDiv:value})}/><Dial label="POSICIÓN" value={num(p.horizontalPosition,0)} min={-50} max={50} step={1} unit="%" onChange={value=>onPatch({horizontalPosition:value})}/><SelectControl label="MEMORIA" value={String(p.recordLength??'10 kpts')} options={['1 kpts','10 kpts','100 kpts','1 Mpts','10 Mpts']} onChange={value=>onPatch({recordLength:value})}/></ControlGroup>
    <ControlGroup title="TRIGGER"><Dial label="NIVEL" value={num(p.triggerLevel,0)} min={-20} max={20} step={.01} unit="V" onChange={value=>onPatch({triggerLevel:value})}/><Segment label="FUENTE" value={String(p.triggerSource??'CH1')} options={['CH1','CH2','EXT']} onChange={value=>onPatch({triggerSource:value})}/><Segment label="PENDIENTE" value={String(p.triggerSlope??'↑')} options={['↑','↓','↕']} onChange={value=>onPatch({triggerSlope:value})}/><Segment label="MODO" value={String(p.triggerMode??'AUTO')} options={['AUTO','NORMAL','SINGLE']} onChange={value=>onPatch({triggerMode:value})}/></ControlGroup>
    <ControlGroup title="ADQUISICIÓN"><Segment label="MODO" value={String(p.acquisition??'SAMPLE')} options={['SAMPLE','PEAK','HI-RES','AVERAGE']} onChange={value=>onPatch({acquisition:value})}/><SelectControl label="ANCHO DE BANDA" value={String(p.bandwidth??'FULL')} options={['20 MHz','100 MHz','200 MHz','FULL']} onChange={value=>onPatch({bandwidth:value})}/><ActionRow onReset={()=>onPatch({ch1Position:0,ch2Position:0,horizontalPosition:0,triggerLevel:0})}/></ControlGroup>
  </div>;
  if(component.definitionId==='logic_analyzer')return <div className="professional-controls"><ControlGroup title="ADQUISICIÓN"><Dial label="MUESTREO" value={num(p.sampleRate,1e6)} min={1e3} max={1e9} step={1e3} unit="Sa/s" onChange={value=>onPatch({sampleRate:value})}/><SelectControl label="PROFUNDIDAD" value={String(p.memoryDepth??'1 Mpts')} options={['10 kpts','100 kpts','1 Mpts','10 Mpts']} onChange={value=>onPatch({memoryDepth:value})}/></ControlGroup><ControlGroup title="NIVELES"><Dial label="UMBRAL" value={num(p.threshold,2.5)} min={-5} max={15} step={.05} unit="V" onChange={value=>onPatch({threshold:value})}/><Segment label="FAMILIA" value={String(p.logicFamily??'CMOS')} options={['TTL','CMOS','ECL','CUSTOM']} onChange={value=>onPatch({logicFamily:value})}/></ControlGroup><ControlGroup title="TRIGGER"><SelectControl label="CANAL" value={String(p.triggerChannel??'D0')} options={capture.pins.map(pin=>pin.pinName)} onChange={value=>onPatch({triggerChannel:value})}/><Segment label="CONDICIÓN" value={String(p.triggerCondition??'↑')} options={['↑','↓','0','1','PATTERN']} onChange={value=>onPatch({triggerCondition:value})}/><Dial label="PRETRIGGER" value={num(p.pretrigger,50)} min={0} max={100} step={1} unit="%" onChange={value=>onPatch({pretrigger:value})}/></ControlGroup></div>;
  if(component.definitionId==='spectrum_analyzer')return <div className="professional-controls"><ControlGroup title="FRECUENCIA"><Dial label="CENTRO" value={num(p.centerFrequency,1e6)} min={1} max={6e9} step={1} unit="Hz" onChange={value=>onPatch({centerFrequency:value})}/><Dial label="SPAN" value={num(p.span,1e6)} min={1} max={6e9} step={1} unit="Hz" onChange={value=>onPatch({span:value})}/></ControlGroup><ControlGroup title="AMPLITUD"><Dial label="NIVEL REF." value={num(p.referenceLevel,0)} min={-160} max={30} step={1} unit="dBm" onChange={value=>onPatch({referenceLevel:value})}/><SelectControl label="ESCALA" value={String(p.scale??'10 dB/div')} options={['1 dB/div','2 dB/div','5 dB/div','10 dB/div']} onChange={value=>onPatch({scale:value})}/></ControlGroup><ControlGroup title="ANCHO DE BANDA"><Dial label="RBW" value={num(p.rbw,1000)} min={1} max={10e6} step={1} unit="Hz" onChange={value=>onPatch({rbw:value})}/><Dial label="VBW" value={num(p.vbw,1000)} min={1} max={10e6} step={1} unit="Hz" onChange={value=>onPatch({vbw:value})}/></ControlGroup><ControlGroup title="TRAZA"><Segment label="DETECTOR" value={String(p.detector??'PEAK')} options={['PEAK','RMS','SAMPLE','AVERAGE']} onChange={value=>onPatch({detector:value})}/><Segment label="MODO" value={String(p.traceMode??'CLEAR')} options={['CLEAR','MAX HOLD','MIN HOLD','AVERAGE']} onChange={value=>onPatch({traceMode:value})}/></ControlGroup></div>;
  if(component.definitionId==='multimeter')return <div className="professional-controls meter-controls"><ControlGroup title="SELECTOR"><RotaryMode value={String(p.mode??'voltage')} onChange={value=>onPatch({mode:value})}/></ControlGroup><ControlGroup title="RANGO"><Segment label="SELECCIÓN" value={String(p.rangeMode??'AUTO')} options={['AUTO','MANUAL']} onChange={value=>onPatch({rangeMode:value})}/><SelectControl label="RANGO" value={String(p.range??'AUTO')} options={['AUTO','600 mV','6 V','60 V','600 V','1000 V']} onChange={value=>onPatch({range:value})}/></ControlGroup><ControlGroup title="REGISTRO"><ToggleControl label="HOLD" value={Boolean(p.hold)} onChange={value=>onPatch({hold:value})}/><ToggleControl label="MIN/MAX/AVG" value={Boolean(p.minMax)} onChange={value=>onPatch({minMax:value})}/><ToggleControl label="FILTRO" value={Boolean(p.filter)} onChange={value=>onPatch({filter:value})}/></ControlGroup><ControlGroup title="LECTURAS"><Readout label="RMS" value={capture.rms.toFixed(5)}/><Readout label="MÍNIMO" value={capture.minimum.toFixed(5)}/><Readout label="MÁXIMO" value={capture.maximum.toFixed(5)}/><Readout label="PROMEDIO" value={capture.average.toFixed(5)}/></ControlGroup></div>;
  if(component.definitionId==='power_monitor')return <div className="professional-controls"><ControlGroup title="ENTRADA"><SelectControl label="RANGO V" value={String(p.voltageRange??'20 V')} options={['2 V','20 V','200 V','1000 V']} onChange={value=>onPatch({voltageRange:value})}/><SelectControl label="RANGO I" value={String(p.currentRange??'2 A')} options={['20 mA','200 mA','2 A','20 A']} onChange={value=>onPatch({currentRange:value})}/><Dial label="SHUNT" value={num(p.shunt,.1)} min={.0001} max={10} step={.0001} unit="Ω" onChange={value=>onPatch({shunt:value})}/></ControlGroup><ControlGroup title="INTEGRACIÓN"><ToggleControl label="ACUMULAR ENERGÍA" value={Boolean(p.integrate??true)} onChange={value=>onPatch({integrate:value})}/><SelectControl label="VENTANA" value={String(p.integrationWindow??'CONTINUA')} options={['1 s','10 s','60 s','CONTINUA']} onChange={value=>onPatch({integrationWindow:value})}/><Segment label="FILTRO" value={String(p.filter??'MEDIUM')} options={['FAST','MEDIUM','SLOW']} onChange={value=>onPatch({filter:value})}/></ControlGroup></div>;
  if(component.definitionId==='frequency_counter')return <div className="professional-controls"><ControlGroup title="ENTRADA A"><Segment label="ACOPLAMIENTO" value={String(p.coupling??'DC')} options={['DC','AC']} onChange={value=>onPatch({coupling:value})}/><Segment label="IMPEDANCIA" value={String(p.impedance??'1 MΩ')} options={['50 Ω','1 MΩ']} onChange={value=>onPatch({impedance:value})}/><Segment label="ATENUACIÓN" value={String(p.attenuation??'×1')} options={['×1','×10','×100']} onChange={value=>onPatch({attenuation:value})}/></ControlGroup><ControlGroup title="DISPARO"><Dial label="NIVEL" value={num(p.triggerLevel,2.5)} min={-10} max={10} step={.01} unit="V" onChange={value=>onPatch({triggerLevel:value})}/><Segment label="PENDIENTE" value={String(p.slope??'↑')} options={['↑','↓']} onChange={value=>onPatch({slope:value})}/></ControlGroup><ControlGroup title="PUERTA"><SelectControl label="TIEMPO" value={String(p.gateTime??'1 s')} options={['10 ms','100 ms','1 s','10 s']} onChange={value=>onPatch({gateTime:value})}/><ToggleControl label="HOLD" value={Boolean(p.hold)} onChange={value=>onPatch({hold:value})}/></ControlGroup></div>;
  return <div className="professional-controls"><ControlGroup title="SONDA"><Segment label="ATENUACIÓN" value={String(p.attenuation??'×10')} options={['×1','×10','×100']} onChange={value=>onPatch({attenuation:value})}/><Segment label="ACOPLAMIENTO" value={String(p.coupling??'DC')} options={['DC','AC','GND']} onChange={value=>onPatch({coupling:value})}/><SelectControl label="ANCHO DE BANDA" value={String(p.bandwidth??'FULL')} options={['20 MHz','100 MHz','200 MHz','FULL']} onChange={value=>onPatch({bandwidth:value})}/><Dial label="COMPENSACIÓN" value={num(p.compensation,0)} min={-1} max={1} step={.01} unit="" onChange={value=>onPatch({compensation:value})}/></ControlGroup></div>;
}

function ControlGroup({title,children}:{title:string;children:React.ReactNode}) {return <section className="control-group"><header>{title}</header><div>{children}</div></section>;}
function Dial({label,value,min,max,step,unit,onChange}:{label:string;value:number;min:number;max:number;step:number;unit:string;onChange(v:number):void}) {const logarithmic=min>0&&max/min>1000;const ratio=Math.max(0,Math.min(1,logarithmic?Math.log(value/min)/Math.log(max/min):(value-min)/(max-min)));const sliderValue=logarithmic?ratio*1000:value;const change=(raw:number)=>onChange(logarithmic?min*Math.pow(max/min,raw/1000):raw);return <label className="instrument-dial"><span className="dial-face" style={{'--dial-angle':`${-135+ratio*270}deg`} as React.CSSProperties}><i/></span><b>{label}</b><input type="range" min={logarithmic?0:min} max={logarithmic?1000:max} step={logarithmic?1:step} value={sliderValue} onChange={event=>change(Number(event.target.value))}/><small>{formatControlValue(value)} {unit}</small></label>;}
function Segment({label,value,options,onChange}:{label:string;value:string;options:string[];onChange(v:string):void}) {return <div className="control-segment"><b>{label}</b><div>{options.map(option=><button key={option} className={value===option?'active':''} onClick={()=>onChange(option)}>{option}</button>)}</div></div>;}
function SelectControl({label,value,options,onChange}:{label:string;value:string;options:string[];onChange(v:string):void}) {return <label className="select-control"><b>{label}</b><select value={value} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option}>{option}</option>)}</select></label>;}
function ToggleControl({label,value,onChange}:{label:string;value:boolean;onChange(v:boolean):void}) {return <button className={`panel-toggle ${value?'on':''}`} onClick={()=>onChange(!value)}><i/><span>{label}</span><b>{value?'ON':'OFF'}</b></button>;}
function Readout({label,value}:{label:string;value:string}) {return <div className="control-readout"><small>{label}</small><strong>{value}</strong></div>;}
function ActionRow({onReset}:{onReset():void}) {return <div className="control-actions"><button onClick={onReset}><RotateCcw size={13}/>PUESTA A CERO</button><button><Square size={12}/>SINGLE SEQ</button></div>;}
function RotaryMode({value,onChange}:{value:string;onChange(v:string):void}) {const modes=['voltage','current','resistance','continuity','diode','capacitance','frequency'];return <div className="rotary-mode"><span className="rotary-selector"><i style={{transform:`rotate(${modes.indexOf(value)*42-126}deg)`}}/></span><div>{modes.map(mode=><button key={mode} className={value===mode?'active':''} onClick={()=>onChange(mode)}>{modeLabel(mode)}</button>)}</div></div>;}
function ScreenGrid(){return <span className="screen-grid"/>;}

function tracePoints(values:number[],width:number,height:number,scale:number){if(!values.length)return `0,${height/2} ${width},${height/2}`;return values.map((value,index)=>`${index*width/Math.max(1,values.length-1)},${height/2-value/scale*height*.42}`).join(' ');}
function logicPoints(values:Array<0|1|'X'|'Z'>,width:number,highY:number,lowY:number){if(!values.length)return `0,${lowY} ${width},${lowY}`;const points:string[]=[];values.forEach((value,index)=>{const x=index*width/Math.max(1,values.length-1),y=value===1?highY:value===0?lowY:(highY+lowY)/2;if(index){const previous=values[index-1]===1?highY:values[index-1]===0?lowY:(highY+lowY)/2;points.push(`${x},${previous}`);}points.push(`${x},${y}`);});return points.join(' ');}
function formatVoltage(value:number){return Math.abs(value)>=1?`${value.toFixed(3)} V`:`${(value*1000).toFixed(3)} mV`;}
function formatControlValue(value:number){if(Math.abs(value)>=1e9)return `${(value/1e9).toFixed(3)}G`;if(Math.abs(value)>=1e6)return `${(value/1e6).toFixed(3)}M`;if(Math.abs(value)>=1e3)return `${(value/1e3).toFixed(3)}k`;if(Math.abs(value)<1e-6&&value!==0)return `${(value*1e9).toFixed(3)}n`;if(Math.abs(value)<1e-3&&value!==0)return `${(value*1e6).toFixed(3)}µ`;return Number(value.toPrecision(4)).toString();}
function num(...values:unknown[]){for(const value of values){const parsed=Number(value);if(Number.isFinite(parsed))return parsed;}return 0;}
function modeLabel(mode:string){return {voltage:'V',current:'A',resistance:'Ω',continuity:')))',diode:'⇥|',capacitance:'F',frequency:'Hz'}[mode]??mode;}
function iconFor(id:string){if(id==='oscilloscope')return Waves;if(id==='logic_analyzer')return Radio;if(id==='multimeter')return Gauge;if(id==='power_monitor')return Zap;if(id==='spectrum_analyzer')return BarChart3;if(id==='frequency_counter')return TimerReset;return Activity;}
