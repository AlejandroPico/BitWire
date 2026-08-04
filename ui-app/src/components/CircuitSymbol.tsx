import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { ComponentDefinition, ComponentInstance, ComponentSignal, PinDefinition } from '../model/types';
import type { LodLevel } from '../canvas/LODManager';

interface Props {
  component: ComponentInstance;
  definition: ComponentDefinition;
  selected: boolean;
  lod: LodLevel;
  signal?: ComponentSignal;
  onPointerDown(event: ReactPointerEvent<SVGGElement>, component: ComponentInstance): void;
  onDoubleClick(component: ComponentInstance): void;
  onPin(event: ReactPointerEvent<SVGCircleElement>, component: ComponentInstance, pin: PinDefinition): void;
  onQuickToggle(component: ComponentInstance): void;
}

export function CircuitSymbol({ component, definition, selected, lod, signal, onPointerDown, onDoubleClick, onPin, onQuickToggle }: Props) {
  const w = definition.width;
  const h = definition.height;
  const active = Boolean(signal?.active);
  return <g
    className={`circuit-component ${selected ? 'selected' : ''} ${active ? 'energized' : ''} ${component.enabled ? '' : 'disabled'}`}
    transform={`translate(${component.x} ${component.y}) rotate(${component.rotation} ${w / 2} ${h / 2})`}
    onPointerDown={event => onPointerDown(event, component)}
    onDoubleClick={event => { event.stopPropagation(); onDoubleClick(component); }}
    data-component-id={component.id}
  >
    <rect className="component-hitbox" x="-8" y="-8" width={w + 16} height={h + 16}/>
    {lod === 0 ? <MacroSymbol definition={definition}/> : <>
      <g className="symbol-artwork">{symbolArtwork(definition, active)}</g>
      <text className="symbol-title" x={w / 2} y={h + 20} textAnchor="middle">{definition.name}</text>
      {lod >= 2 && <text className="symbol-model" x={w / 2} y={h + 34} textAnchor="middle">{definition.family.toUpperCase()}</text>}
      {lod >= 3 && definition.internal && <InternalNetwork definition={definition}/>} 
      {lod >= 4 && <PropertyOverlay component={component} definition={definition}/>} 
    </>}
    {definition.pins.map(pin => {
      const x = pin.x * w;
      const y = pin.y * h;
      return <g className="pin-group" key={pin.id}>
        {lod >= 2 && <text className="pin-label" x={x + (pin.x === 0 ? 10 : pin.x === 1 ? -10 : 0)} y={y - 8} textAnchor={pin.x === 0 ? 'start' : pin.x === 1 ? 'end' : 'middle'}>{pin.name}</text>}
        <circle className={`pin ${pin.domain.toLowerCase()}`} cx={x} cy={y} r={lod >= 2 ? 5 : 4}/>
        <circle className="pin-hit" cx={x} cy={y} r="13" onPointerDown={event => onPin(event, component, pin)}/>
      </g>;
    })}
    {(definition.model === 'switch' || definition.model === 'logic_input') && lod >= 1 && <g className="quick-toggle" onPointerDown={event => { event.stopPropagation(); onQuickToggle(component); }} transform={`translate(${w / 2 - 16} ${h - 21})`}>
      <rect width="32" height="14"/><circle cx={Boolean(component.properties.closed ?? component.properties.state) ? 24 : 8} cy="7" r="5"/>
    </g>}
  </g>;
}

function MacroSymbol({ definition }: { definition: ComponentDefinition }) {
  return <g className="macro-symbol"><rect width={definition.width} height={definition.height}/><text x={definition.width / 2} y={definition.height / 2 + 5} textAnchor="middle">{definition.name}</text></g>;
}

function symbolArtwork(definition: ComponentDefinition, active: boolean): ReactNode {
  const w = definition.width;
  const h = definition.height;
  const s = definition.symbol;
  if (s === 'resistor' || s === 'potentiometer') return <>
    <path className="lead" d={`M0 ${h/2}H28 M132 ${h/2}H${w}`}/><path className="symbol-line" d={`M28 ${h/2}l10 -18 14 36 14 -36 14 36 14 -36 14 36 14 -36 10 18`}/>
    {s === 'potentiometer' && <path className="symbol-line" d="M80 5v22m0 0-8-9m8 9 8-9"/>}
  </>;
  if (s === 'capacitor' || s === 'capacitor_polarized') return <><path className="lead" d={`M0 ${h/2}H68 M92 ${h/2}H${w}`}/><path className="symbol-line" d="M68 15v50M92 15v50"/>{s.includes('polarized') && <text x="102" y="20" className="polarity">+</text>}</>;
  if (s === 'inductor') return <><path className="lead" d={`M0 ${h/2}H32 M128 ${h/2}H${w}`}/><path className="symbol-line" d="M32 40c0-28 24-28 24 0 0-28 24-28 24 0 0-28 24-28 24 0 0-28 24-28 24 0"/></>;
  if (s === 'source' || s === 'source_ac' || s === 'battery') return <><path className="lead" d={`M0 ${h*.7}H48 M112 ${h*.3}H${w}`}/>{s === 'battery' ? <><path className="symbol-line" d="M65 12v56M96 23v34"/><text x="104" y="22" className="polarity">+</text></> : <><circle className="symbol-body" cx="80" cy="40" r="31"/>{s === 'source_ac' ? <path className="symbol-line" d="M57 40c8-22 16 22 24 0s16 22 24 0"/> : <><path className="symbol-line" d="M66 28h28M80 14v28M67 55h26"/></>}</>}</>;
  if (s === 'ground') return <><path className="symbol-line" d="M80 0v30M50 30h60M59 41h42M68 52h24"/></>;
  if (s === 'switch' || s === 'button' || s === 'fuse') return <><path className="lead" d={`M0 ${h/2}H42 M118 ${h/2}H${w}`}/>{s === 'fuse' ? <rect className="symbol-body" x="42" y="25" width="76" height="30"/> : <><circle className="terminal" cx="42" cy="40" r="5"/><circle className="terminal" cx="118" cy="40" r="5"/><path className="symbol-line" d={`M42 40L${s === 'button' ? 105 : 105} ${Boolean(active) ? 40 : 18}`}/>{s === 'button' && <path className="symbol-line" d="M72 10h34M89 10v17"/>}</>}</>;
  if (s === 'lamp') return <><path className="lead" d={`M0 ${h/2}H43 M117 ${h/2}H${w}`}/><circle className={`lamp-bulb ${active ? 'on' : ''}`} cx="80" cy="40" r="35"/><path className="symbol-line" d="M56 16l48 48m0-48L56 64"/></>;
  if (s === 'led' || s === 'diode' || s === 'zener') return <><path className="lead" d={`M0 ${h/2}H50 M110 ${h/2}H${w}`}/><path className="symbol-body" d="M50 16v48l50-24z"/><path className="symbol-line" d={s === 'zener' ? 'M100 16v13m-6 0h12m-6 0v22m-6 0h12m-6 0v13' : 'M100 14v52'}/>{s === 'led' && <><path className="symbol-line accent" d="M105 25l18-14m-8 1 8-1-2 8M111 38l18-14m-8 1 8-1-2 8"/></>}</>;
  if (['and','nand'].includes(s)) return <><path className="symbol-body" d="M42 8h35c53 0 53 64 0 64H42z"/><path className="lead" d={`M0 26h42M0 54h42M118 40h${w}`}/>{s === 'nand' && <circle className="symbol-body" cx="124" cy="40" r="6"/>}</>;
  if (['or','nor','xor','xnor'].includes(s)) return <><path className="symbol-body" d="M39 8c22 0 63 4 84 32-21 28-62 32-84 32 18-20 18-44 0-64z"/><path className="lead" d={`M0 26h45M0 54h45M123 40h${w}`}/>{s.startsWith('x') && <path className="symbol-line" d="M31 8c18 20 18 44 0 64"/>}{(s === 'nor' || s === 'xnor') && <circle className="symbol-body" cx="128" cy="40" r="6"/>}</>;
  if (s === 'not') return <><path className="symbol-body" d="M42 8v64l72-32z"/><path className="lead" d={`M0 40h42M126 40h${w}`}/><circle className="symbol-body" cx="120" cy="40" r="6"/></>;
  if (s === 'logic_input') return <><path className="lead" d={`M112 40h${w}`}/><rect className="symbol-body" x="26" y="11" width="86" height="58"/><text className="logic-value" x="69" y="51" textAnchor="middle">{active ? '1' : '0'}</text></>;
  if (['npn','pnp','nmos','pmos'].includes(s)) return <><circle className="symbol-body" cx="80" cy="40" r="33"/><path className="symbol-line" d="M45 40h24M69 18v44M69 29l34-18M69 51l34 18M103 11v9M103 60v9"/><path className="accent" d={s === 'npn' || s === 'nmos' ? 'M88 57l15 12-3-13M88 23l15-12-3 13' : 'M103 69L88 57l3 13'}/></>;
  if (s === 'opamp' || s === 'comparator') return <><path className="symbol-body" d="M35 8v64l88-32z"/><path className="lead" d={`M0 28h35M0 52h35M123 40h${w}`}/><text className="op-sign" x="45" y="31">+</text><text className="op-sign" x="45" y="57">−</text></>;
  if (s === 'oscilloscope' || s === 'analyzer' || s === 'multimeter') return <InstrumentSymbol definition={definition}/>;
  if (s === 'display7') return <DisplaySymbol/>;
  if (s === 'chip' || s === 'dff' || s === 'mux') return <ChipSymbol definition={definition}/>;
  if (s === 'motor') return <><path className="lead" d={`M0 40h42M118 40h${w}`}/><circle className="symbol-body" cx="80" cy="40" r="36"/><text className="logic-value" x="80" y="51" textAnchor="middle">M</text></>;
  if (s === 'transformer') return <><path className="symbol-line" d="M68 13v54M92 13v54M20 24h25c25 0 25 32 0 32H20M140 24h-25c-25 0-25 32 0 32h25"/></>;
  return <><rect className="symbol-body" x="20" y="8" width={w - 40} height={h - 16}/><text className="generic-label" x={w / 2} y={h / 2 + 5} textAnchor="middle">{definition.name}</text></>;
}

function InstrumentSymbol({ definition }: { definition: ComponentDefinition }) {
  const w = definition.width, h = definition.height;
  return <><rect className="instrument-body" x="8" y="6" width={w - 16} height={h - 12}/><rect className="instrument-screen" x="25" y="20" width={w - 85} height={h - 45}/><path className="scope-trace" d={`M30 ${h/2}h18l8-18 13 36 12-26 12 8h${Math.max(15,w-118)}`}/><circle className="dial" cx={w - 38} cy="36" r="12"/><circle className="dial" cx={w - 38} cy="74" r="12"/><text className="instrument-name" x="25" y={h - 12}>{definition.name.toUpperCase()}</text></>;
}

function ChipSymbol({ definition }: { definition: ComponentDefinition }) {
  const w = definition.width, h = definition.height;
  return <><rect className="chip-body" x="23" y="5" width={w - 46} height={h - 10}/>{[18,32,48,62].map((y, i) => <g key={y}><path className="lead" d={`M0 ${y}h23M${w-23} ${y}h23`}/><circle className="chip-pad" cx="30" cy={y} r="2"/><circle className="chip-pad" cx={w-30} cy={y} r="2"/></g>)}<circle className="chip-notch" cx={w/2} cy="5" r="7"/><text className="chip-name" x={w/2} y={h/2+5} textAnchor="middle">{definition.name}</text></>;
}

function DisplaySymbol() {
  const segments = ['M58 14h44','M108 20v20','M108 48v18','M58 71h44','M52 48v18','M52 20v20','M58 43h44'];
  return <><rect className="display-body" x="38" y="4" width="84" height="72"/>{segments.map((d,i)=><path key={i} className="display-segment" d={d}/>)}</>;
}

function InternalNetwork({ definition }: { definition: ComponentDefinition }) {
  return <g className="internal-network">
    <rect x="22" y="9" width={definition.width - 44} height={definition.height - 18}/>
    <path d={`M31 24h20v32h22V24h22v32h25`}/>
    {[51,73,95].map((x,i)=><g key={x} transform={`translate(${x} ${i%2 ? 48 : 22})`}><circle r="7"/><path d="M-12 0h5M7 0h12M0-11v4M0 7v11"/></g>)}
    <text x={definition.width/2} y={definition.height-4} textAnchor="middle">RED CMOS · {definition.internal}</text>
  </g>;
}

function PropertyOverlay({ component, definition }: { component: ComponentInstance; definition: ComponentDefinition }) {
  const entries = Object.entries(component.properties).slice(0, 3);
  return <g className="property-overlay"><rect x="18" y="8" width={definition.width - 36} height={definition.height - 16}/>{entries.map(([key,value],i)=><text key={key} x="26" y={29+i*16}>{key}: <tspan>{String(value)}</tspan></text>)}</g>;
}
