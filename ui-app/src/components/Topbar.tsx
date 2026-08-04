import {
  Box, ChevronDown, Download, FilePlus2, FolderOpen, Gauge, Hand,
  MousePointer2, Pause, Play, Redo2, Save, StepForward, Undo2, Waypoints,
} from 'lucide-react';
import type { SignalView, ToolMode, Wire } from '../model/types';
import type { Theme } from '../model/types';
import { ThemeControl } from './ThemeControl';

interface Props {
  projectName: string;
  tool: ToolMode;
  running: boolean;
  speed: number;
  routing: Wire['routing'];
  signalView: SignalView;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  theme: Theme;
  onTool(tool: ToolMode): void;
  onRun(): void;
  onStep(): void;
  onSpeed(speed: number): void;
  onRouting(routing: Wire['routing']): void;
  onSignalView(view: SignalView): void;
  onNew(): void;
  onSave(): void;
  onImport(): void;
  onExport(): void;
  onUndo(): void;
  onRedo(): void;
  onTheme(theme: Theme): void;
}

export function Topbar(props: Props) {
  return <header className="topbar">
    <div className="brand-block"><span className="brand-mark">BW</span><div><strong>BITWIRE</strong><small>VECTOR CIRCUIT LAB</small></div></div>
    <div className="project-title"><span className={props.dirty ? 'dirty-dot' : 'saved-dot'}/><span>{props.projectName}</span></div>
    <nav className="toolbar-group file-tools" aria-label="Archivo">
      <button onClick={props.onNew} title="Proyecto nuevo (Ctrl+N)"><FilePlus2 size={17}/></button>
      <button onClick={props.onImport} title="Importar .bitwire"><FolderOpen size={17}/></button>
      <button onClick={props.onSave} title="Guardar en este dispositivo (Ctrl+S)"><Save size={17}/></button>
      <button onClick={props.onExport} title="Exportar .bitwire"><Download size={17}/></button>
    </nav>
    <nav className="toolbar-group" aria-label="Historial">
      <button onClick={props.onUndo} disabled={!props.canUndo} title="Deshacer"><Undo2 size={17}/></button>
      <button onClick={props.onRedo} disabled={!props.canRedo} title="Rehacer"><Redo2 size={17}/></button>
    </nav>
    <nav className="toolbar-group primary-tools" aria-label="Herramientas">
      <button className={props.tool === 'select' ? 'active' : ''} onClick={() => props.onTool('select')} title="Seleccionar (V)"><MousePointer2 size={17}/></button>
      <button className={props.tool === 'wire' ? 'active' : ''} onClick={() => props.onTool('wire')} title="Cablear (W)"><Waypoints size={17}/></button>
      <button className={props.tool === 'pan' ? 'active' : ''} onClick={() => props.onTool('pan')} title="Desplazar (H)"><Hand size={17}/></button>
      <button className={props.tool === 'module' ? 'active' : ''} onClick={() => props.onTool('module')} title="Crear encapsulado"><Box size={17}/></button>
    </nav>
    <div className="toolbar-spacer"/>
    <label className="compact-select" title="Visualización de señales"><Gauge size={15}/><select value={props.signalView} onChange={event => props.onSignalView(event.target.value as SignalView)}>
      <option value="voltage">Tensión</option><option value="current">Corriente</option><option value="logic">Lógica 0/1</option><option value="power">Potencia</option>
    </select><ChevronDown size={12}/></label>
    <label className="compact-select" title="Trazado de cables"><select value={props.routing} onChange={event => props.onRouting(event.target.value as Wire['routing'])}>
      <option value="orthogonal">Ortogonal</option><option value="bezier">Bézier</option><option value="straight">Recto</option>
    </select><ChevronDown size={12}/></label>
    <ThemeControl theme={props.theme} onTheme={props.onTheme}/>
    <nav className="toolbar-group simulation-tools">
      <button className={props.running ? 'stop-action' : 'run-action'} onClick={props.onRun}>{props.running ? <Pause size={17}/> : <Play size={17}/>}<span>{props.running ? 'Pausar' : 'Ejecutar'}</span></button>
      <button onClick={props.onStep} disabled={props.running} title="Avanzar un paso"><StepForward size={17}/></button>
      <select className="speed-select" value={props.speed} onChange={event => props.onSpeed(Number(event.target.value))} aria-label="Velocidad">
        <option value={.25}>0,25×</option><option value={.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option><option value={10}>10×</option>
      </select>
    </nav>
  </header>;
}
