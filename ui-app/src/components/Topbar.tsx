import {
  Binary, Cable, ChevronDown, CircleGauge, CornerDownRight, Download,
  Eye, FilePlus2, FolderOpen, Gauge, Laptop, Minus, Pause, Play, Redo2, Route,
  Save, Spline, StepForward, Undo2, Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SignalView, Wire } from '../model/types';
import type { Theme } from '../model/types';
import { ThemeControl } from './ThemeControl';

interface Props {
  projectName: string;
  running: boolean;
  speed: number;
  routing: Wire['routing'];
  signalView: SignalView;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  theme: Theme;
  onRun(): void;
  onStep(): void;
  onSpeed(speed: number): void;
  onRouting(routing: Wire['routing']): void;
  onSignalView(view: SignalView): void;
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

const SPEED_OPTIONS = [.25, .5, 1, 2, 5, 10].map(value => ({
  value,
  label: `${String(value).replace('.', ',')}×`,
  detail: value < 1 ? 'Cámara lenta' : value === 1 ? 'Tiempo normal' : 'Acelerado',
  icon: <CircleGauge size={15}/>,
}));

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
        <ToolbarMenu value={props.speed} options={SPEED_OPTIONS} onChange={props.onSpeed} label="Velocidad de simulación" compact/>
      </nav>
    </div>

    <div className="topbar-right">
      <ToolbarMenu value={props.signalView} options={SIGNAL_OPTIONS} onChange={props.onSignalView} label="Magnitud visible" triggerIcon={<Eye size={16}/>}/>
      <ToolbarMenu value={props.routing} options={ROUTING_OPTIONS} onChange={props.onRouting} label="Trazado de cables" triggerIcon={<Route size={16}/>}/>
      <ThemeControl theme={props.theme} onTheme={props.onTheme}/>
    </div>
  </header>;
}

interface MenuOption<T extends string | number> {
  value: T;
  label: string;
  detail: string;
  icon: ReactNode;
}

function ToolbarMenu<T extends string | number>({ value, options, onChange, label, triggerIcon, compact = false }: {
  value: T;
  options: MenuOption<T>[];
  onChange(value: T): void;
  label: string;
  triggerIcon?: ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const active = options.find(option => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    return () => { window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeEscape); };
  }, [open]);

  return <div className={`toolbar-menu ${compact ? 'compact' : ''}`} ref={root}>
    <button className={open ? 'toolbar-menu-trigger active' : 'toolbar-menu-trigger'} type="button" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={`${label}: ${active.label}`} title={`${label}: ${active.label}`}>
      {triggerIcon ?? active.icon}<span>{active.label}</span><ChevronDown size={12}/>
    </button>
    {open && <menu className="toolbar-popover" aria-label={label}>
      <header>{label.toUpperCase()}</header>
      {options.map(option => <button key={option.value} type="button" className={option.value === value ? 'active' : ''} onClick={() => { onChange(option.value); setOpen(false); }}>
        <span>{option.icon}</span><span><strong>{option.label}</strong><small>{option.detail}</small></span>{option.value === value && <i/>}
      </button>)}
    </menu>}
  </div>;
}
