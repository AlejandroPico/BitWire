import { Activity, ChevronDown, ChevronUp, Radio, Waves } from 'lucide-react';
import type { SimulationSnapshot } from '../model/types';

interface Props { collapsed: boolean; samples: SimulationSnapshot[]; onToggle(): void }

export function InstrumentTray({ collapsed, samples, onToggle }: Props) {
  const recent = samples.slice(-100);
  const voltages = recent.map(sample => sample.wireSignals.w_scope?.voltage ?? sample.wireSignals.w_gate_out?.voltage ?? 0);
  const logics = recent.map(sample => sample.wireSignals.w_gate_out?.logic === 1 ? 1 : 0);
  const points = voltages.map((value, index) => `${index * (600 / Math.max(1, voltages.length - 1))},${82 - Math.max(-10, Math.min(10, value)) * 6}`).join(' ');
  const logicPoints = logics.map((value, index) => `${index * (600 / Math.max(1, logics.length - 1))},${value ? 25 : 55}`).join(' ');
  if (collapsed) return <div className="instrument-tray collapsed"><button onClick={onToggle}><Activity size={15}/>Instrumentos virtuales<ChevronUp size={15}/></button></div>;
  return <section className="instrument-tray">
    <div className="instrument-heading"><div><Activity size={16}/><strong>Banco de instrumentación</strong><span>captura en vivo</span></div><button onClick={onToggle}><ChevronDown size={15}/></button></div>
    <div className="instrument-grid">
      <article className="scope-instrument"><header><Waves size={15}/><strong>Osciloscopio</strong><span className="channel-dot ch1"/>CH1 <b>{(voltages.at(-1) ?? 0).toFixed(2)} V</b></header>
        <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-label="Forma de onda de tensión"><defs><pattern id="scopeGrid" width="60" height="20" patternUnits="userSpaceOnUse"><path d="M60 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".18"/></pattern></defs><rect width="600" height="100" fill="url(#scopeGrid)"/><line x1="0" y1="82" x2="600" y2="82" className="zero-line"/><polyline points={points || '0,82 600,82'} className="wave voltage-wave"/></svg>
        <footer><span>1 V/div</span><span>100 ms/div</span><span>DC</span><span>AUTO</span></footer>
      </article>
      <article className="logic-instrument"><header><Radio size={15}/><strong>Analizador lógico</strong><span>D0 / AND.Q</span></header>
        <svg viewBox="0 0 600 80" preserveAspectRatio="none" aria-label="Traza lógica"><defs><pattern id="logicGrid" width="60" height="20" patternUnits="userSpaceOnUse"><path d="M60 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".14"/></pattern></defs><rect width="600" height="80" fill="url(#logicGrid)"/><polyline points={logicPoints || '0,55 600,55'} className="wave logic-wave"/></svg>
        <footer><span>Estado: <b>{logics.at(-1) ?? 0}</b></span><span>Flanco ↑</span><span>1 MHz</span></footer>
      </article>
    </div>
  </section>;
}
