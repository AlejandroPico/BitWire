import {
  Activity, Binary, Cable, Check, ChevronDown, CircleGauge, CornerDownRight, Download,
  Eye, FilePlus2, FolderOpen, Gauge, Grid3X3, Laptop, Minus, MonitorDot, Pause, Play, Redo2,
  Route, Save, Settings2, Spline, StepForward, Tags, Undo2, Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProjectSettings, Theme } from '../model/types';
import { THEME_DEFINITIONS } from '../theme/themes';

interface Props {
  projectName: string;
  running: boolean;
  speed: number;
  settings: ProjectSettings;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  theme: Theme;
  onRun(): void;
  onStep(): void;
  onSpeed(speed: number): void;
  onSettings(patch: Partial<ProjectSettings>): void;
  onNew(): void;
  onSave(): void;
  onImport(): void;
  onExport(): void;
  onOffline(): void;
  onUndo(): void;
  onRedo(): void;
  onTheme(theme: Theme): void;
}

const SIGNAL_OPTIONS = [
  { value: 'voltage' as const, label: 'Tensión', detail: 'Voltios en cada red', icon: <Zap size={15}/> },
  { value: 'current' as const, label: 'Corriente', detail: 'Flujo en amperios', icon: <Cable size={15}/> },
  { value: 'logic' as const, label: 'Lógica 0/1', detail: 'Estados digitales', icon: <Binary size={15}/> },
  { value: 'power' as const, label: 'Potencia', detail: 'Consumo en vatios', icon: <Gauge size={15}/> },
];

const ROUTING_OPTIONS = [
  { value: 'orthogonal' as const, label: 'Ortogonal', detail: 'Ángulos de 90°', icon: <CornerDownRight size={15}/> },
  { value: 'bezier' as const, label: 'Bézier', detail: 'Curvas suaves', icon: <Spline size={15}/> },
  { value: 'straight' as const, label: 'Recto', detail: 'Distancia mínima', icon: <Minus size={15}/> },
];

const SPEED_PRESETS=[.0001,.001,.01,.1,.25,.5,1,2,5,10];

export function Topbar(props: Props) {
  return <header className="topbar">
    <div className="topbar-left">
      <nav className="toolbar-group file-tools" aria-label="Archivo">
        <button onClick={props.onNew} title="Proyecto nuevo (Ctrl+N)"><FilePlus2 size={16}/><span>Nuevo</span></button>
        <button onClick={props.onImport} title="Abrir o importar .bitwire"><FolderOpen size={16}/><span>Abrir</span></button>
        <button onClick={props.onSave} title="Guardar en este dispositivo (Ctrl+S)"><Save size={16}/><span>Guardar</span></button>
        <button onClick={props.onExport} title="Exportar .bitwire"><Download size={16}/><span>Exportar</span></button>
        <button className="offline-action" onClick={props.onOffline} title="Descargar BitWire portable"><Laptop size={16}/><span>Modo offline</span></button>
      </nav>
      <nav className="toolbar-group history-tools" aria-label="Historial">
        <button onClick={props.onUndo} disabled={!props.canUndo} title="Deshacer"><Undo2 size={16}/></button>
        <button onClick={props.onRedo} disabled={!props.canRedo} title="Rehacer"><Redo2 size={16}/></button>
      </nav>
    </div>

    <div className="topbar-center">
      <div className="project-title" title={props.projectName}>
        <span className={props.dirty ? 'dirty-dot' : 'saved-dot'}/><span>{props.projectName}</span>
      </div>
      <nav className="simulation-command" aria-label="Control principal de simulación">
        <span className={`simulation-state ${props.running ? 'running' : ''}`}><i/>{props.running ? 'EN MARCHA' : 'EN PAUSA'}</span>
        <button className={props.running ? 'stop-action' : 'run-action'} onClick={props.onRun}>
          {props.running ? <Pause size={17}/> : <Play size={17}/>}<span>{props.running ? 'Pausar' : 'Ejecutar'}</span>
        </button>
        <button className="step-action" onClick={props.onStep} disabled={props.running} title="Avanzar una iteración">
          <StepForward size={16}/><span>Paso</span>
        </button>
        <SimulationSpeedControl value={props.speed} onChange={props.onSpeed}/>
      </nav>
    </div>

    <div className="topbar-right">
      <SettingsMenu settings={props.settings} theme={props.theme} onSettings={props.onSettings} onTheme={props.onTheme}/>
    </div>
  </header>;
}

function SettingsMenu({ settings, theme, onSettings, onTheme }: {
  settings: ProjectSettings;
  theme: Theme;
  onSettings(patch: Partial<ProjectSettings>): void;
  onTheme(theme: Theme): void;
}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);};
  },[open]);

  return <div className="settings-control" ref={root}>
    <button className={open?'settings-trigger active':'settings-trigger'} type="button" onClick={()=>setOpen(value=>!value)} aria-haspopup="dialog" aria-expanded={open} aria-label="Configuración de visualización" title="Configuración de visualización">
      <Settings2 size={18}/><span className={settings.animateCurrent?'settings-live':''}/>
    </button>
    {open&&<section className="settings-popover" role="dialog" aria-label="Configuración de BitWire">
      <header><span><Settings2 size={15}/>CONFIGURACIÓN</span><small>LIENZO Y VISUALIZACIÓN</small></header>
      <div className="settings-toggles">
        <ToggleRow icon={<Activity size={15}/>} label="Animación de corriente" detail="Pulsos móviles en conductores activos" checked={settings.animateCurrent} onChange={checked=>onSettings({animateCurrent:checked})}/>
        <ToggleRow icon={<MonitorDot size={15}/>} label="Instrumentos en vivo" detail="Lectura real dentro de cada aparato" checked={settings.liveInstrumentScreens} onChange={checked=>onSettings({liveInstrumentScreens:checked})}/>
        <ToggleRow icon={<Tags size={15}/>} label="Valores sobre cables" detail="Muestra la magnitud seleccionada" checked={settings.showValues} onChange={checked=>onSettings({showValues:checked})}/>
        <ToggleRow icon={<Grid3X3 size={15}/>} label="Ajustar a cuadrícula" detail="Alineación precisa al desplazar" checked={settings.snapToGrid} onChange={checked=>onSettings({snapToGrid:checked})}/>
      </div>
      <SettingsOptions title="MAGNITUD VISIBLE" icon={<Eye size={13}/>} options={SIGNAL_OPTIONS} value={settings.signalView} onChange={signalView=>onSettings({signalView})}/>
      <SettingsOptions title="TRAZADO DE CABLES" icon={<Route size={13}/>} options={ROUTING_OPTIONS} value={settings.wireRouting} onChange={wireRouting=>onSettings({wireRouting})}/>
      <div className="settings-section">
        <h3><span>TEMA</span><small>{THEME_DEFINITIONS.find(item=>item.id===theme)?.label}</small></h3>
        <div className="settings-theme-grid">{THEME_DEFINITIONS.map(option=><button key={option.id} type="button" className={option.id===theme?'active':''} onClick={()=>onTheme(option.id)} title={option.description}>
          <span className="settings-theme-swatch">{option.palette.map(color=><i key={color} style={{background:color}}/>)}</span><strong>{option.shortLabel}</strong>{option.id===theme&&<Check size={12}/>} 
        </button>)}</div>
      </div>
      <footer>La animación está activada por defecto y la configuración se conserva con el proyecto.</footer>
    </section>}
  </div>;
}

function ToggleRow({icon,label,detail,checked,onChange}:{icon:ReactNode;label:string;detail:string;checked:boolean;onChange(value:boolean):void}){
  return <button type="button" className="settings-toggle" role="switch" aria-checked={checked} onClick={()=>onChange(!checked)}>
    <span>{icon}</span><span><strong>{label}</strong><small>{detail}</small></span><i className={checked?'on':''}><b/></i>
  </button>;
}

function SettingsOptions<T extends string>({title,icon,options,value,onChange}:{title:string;icon:ReactNode;options:MenuOption<T>[];value:T;onChange(value:T):void}){
  return <div className="settings-section"><h3><span>{icon}{title}</span></h3><div className="settings-option-grid">
    {options.map(option=><button key={option.value} type="button" className={option.value===value?'active':''} onClick={()=>onChange(option.value)}><span className="settings-option-icon">{option.icon}</span><span className="settings-option-copy"><strong>{option.label}</strong><small>{option.detail}</small></span>{option.value===value&&<Check className="settings-option-check" size={12}/>}</button>)}
  </div></div>;
}

interface MenuOption<T extends string | number> {
  value: T;
  label: string;
  detail: string;
  icon: ReactNode;
}

function SimulationSpeedControl({value,onChange}:{value:number;onChange(value:number):void}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    return () => { window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeEscape); };
  }, [open]);

  const exponent=Math.log10(Math.max(.0001,Math.min(10,value)));
  return <div className="toolbar-menu compact speed-control" ref={root}>
    <button className={open ? 'toolbar-menu-trigger active' : 'toolbar-menu-trigger'} type="button" onClick={() => setOpen(current => !current)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Velocidad de simulación: ${formatSpeed(value)}`} title={`Velocidad de simulación: ${formatSpeed(value)}`}>
      <CircleGauge size={15}/><span>{formatSpeed(value)}</span><ChevronDown size={12}/>
    </button>
    {open&&<section className="speed-popover" role="dialog" aria-label="Escala temporal">
      <header><span>ESCALA TEMPORAL</span><strong>{formatSpeed(value)}</strong></header>
      <label><span>ULTRALENTA</span><input type="range" min="-4" max="1" step="0.01" value={exponent} onChange={event=>onChange(10**Number(event.target.value))}/><span>10×</span></label>
      <div>{SPEED_PRESETS.map(preset=><button key={preset} className={Math.abs(Math.log10(value)-Math.log10(preset))<.001?'active':''} onClick={()=>onChange(preset)}>{formatSpeed(preset)}</button>)}</div>
      <footer>La escala es logarítmica: permite observar µs, transitorios LRC y conmutaciones rápidas con el ratón.</footer>
    </section>}
  </div>;
}

function formatSpeed(value:number){
  const digits=value<.001?4:value<.01?3:value<.1?2:value<1?2:value<10?2:0;
  return `${value.toLocaleString('es-ES',{maximumFractionDigits:digits})}×`;
}
