import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { ComponentDefinition, ComponentInstance, ComponentSignal, PinDefinition, PropertyValue } from '../model/types';
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
  onProperty(component: ComponentInstance, key: string, value: PropertyValue): void;
}

export function CircuitSymbol({ component, definition, selected, lod, signal, onPointerDown, onDoubleClick, onPin, onQuickToggle, onProperty }: Props) {
  const w = definition.width;
  const h = definition.height;
  const active = Boolean(signal?.active);
  const gateInternal = lod >= 3 && ['and','or','not','nand','nor','xor','xnor'].includes(definition.model);
  const semiconductorInternal = lod >= 3 && ['npn','pnp','nmos','pmos','diode','zener','led'].includes(definition.symbol);
  return <g
    className={`circuit-component ${selected ? 'selected' : ''} ${active ? 'energized' : ''} ${component.enabled ? '' : 'disabled'}`}
    transform={`translate(${component.x} ${component.y}) scale(${component.scale || 1}) rotate(${component.rotation} ${w / 2} ${h / 2})`}
    onPointerDown={event => onPointerDown(event, component)}
    onDoubleClick={event => { event.stopPropagation(); onDoubleClick(component); }}
    data-component-id={component.id}
  >
    <rect className="component-hitbox" x="-8" y="-8" width={w + 16} height={h + 16}/>
    {lod === 0 ? <MacroSymbol definition={definition}/> : <>
      {!gateInternal && !semiconductorInternal && <g className="symbol-artwork">{symbolArtwork(definition, component, active)}</g>}
      {gateInternal && (lod >= 4 ? <GateCmosNetwork definition={definition}/> : <GateInternalNetwork definition={definition}/>)} 
      {semiconductorInternal && <SemiconductorInternal definition={definition} lod={lod}/>} 
      <text className="symbol-title" x={w / 2} y={h + 20} textAnchor="middle">{definition.name}</text>
      {lod >= 2 && <text className="symbol-model" x={w / 2} y={h + 34} textAnchor="middle">{definition.family.toUpperCase()}</text>}
      {lod >= 3 && definition.symbol === 'oscilloscope' && <OscilloscopeInternalNetwork definition={definition}/>} 
      {lod >= 3 && definition.internal && !gateInternal && definition.symbol !== 'oscilloscope' && <InternalNetwork definition={definition}/>} 
      {lod >= 4 && !gateInternal && !semiconductorInternal && definition.symbol !== 'oscilloscope' && <InlinePropertyEditor component={component} definition={definition} onProperty={onProperty}/>} 
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

function symbolArtwork(definition: ComponentDefinition, component: ComponentInstance, active: boolean): ReactNode {
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
  if (s === 'switch' || s === 'button' || s === 'fuse') {
    const closed = Boolean(component.properties.closed);
    return <><path className="lead" d={`M0 ${h/2}H42 M118 ${h/2}H${w}`}/>{s === 'fuse' ? <rect className="symbol-body" x="42" y="25" width="76" height="30"/> : <><circle className="terminal" cx="42" cy="40" r="5"/><circle className="terminal" cx="118" cy="40" r="5"/><path className="symbol-line switch-blade" d={`M42 40L${closed ? 118 : 105} ${closed ? 40 : 18}`}/>{s === 'button' && <path className="symbol-line" d="M72 10h34M89 10v17"/>}</>}</>;
  }
  if (s === 'lamp') return <><path className="lead" d={`M0 ${h/2}H43 M117 ${h/2}H${w}`}/><circle className={`lamp-bulb ${active ? 'on' : ''}`} cx="80" cy="40" r="35"/><path className="symbol-line" d="M56 16l48 48m0-48L56 64"/></>;
  if (s === 'led' || s === 'diode' || s === 'zener') return <><path className="lead" d={`M0 ${h/2}H50 M110 ${h/2}H${w}`}/><path className="symbol-body" d="M50 16v48l50-24z"/><path className="symbol-line" d={s === 'zener' ? 'M100 16v13m-6 0h12m-6 0v22m-6 0h12m-6 0v13' : 'M100 14v52'}/>{s === 'led' && <><path className="symbol-line accent" d="M105 25l18-14m-8 1 8-1-2 8M111 38l18-14m-8 1 8-1-2 8"/></>}</>;
  if (['and','nand'].includes(s)) return <><path className="symbol-body" d="M42 8h35c53 0 53 64 0 64H42z"/><path className="lead" d={`M0 26H42 M0 54H42 M118 40H${w}`}/>{s === 'nand' && <circle className="symbol-body" cx="124" cy="40" r="6"/>}</>;
  if (['or','nor','xor','xnor'].includes(s)) return <><path className="symbol-body" d="M39 8c22 0 63 4 84 32-21 28-62 32-84 32 18-20 18-44 0-64z"/><path className="lead" d={`M0 26H45 M0 54H45 M123 40H${w}`}/>{s.startsWith('x') && <path className="symbol-line" d="M31 8c18 20 18 44 0 64"/>}{(s === 'nor' || s === 'xnor') && <circle className="symbol-body" cx="128" cy="40" r="6"/>}</>;
  if (s === 'not') return <><path className="symbol-body" d="M42 8v64l72-32z"/><path className="lead" d={`M0 40H42 M126 40H${w}`}/><circle className="symbol-body" cx="120" cy="40" r="6"/></>;
  if (s === 'logic_input') return <><path className="lead" d={`M112 40H${w}`}/><rect className="symbol-body" x="26" y="11" width="86" height="58"/><text className="logic-value" x="69" y="51" textAnchor="middle">{active ? '1' : '0'}</text></>;
  if (s === 'npn' || s === 'pnp') return <BjtSymbol type={s}/>;
  if (s === 'nmos' || s === 'pmos') return <MosfetSymbol type={s}/>;
  if (s === 'opamp' || s === 'comparator') return <><path className="symbol-body" d="M35 8v64l88-32z"/><path className="lead" d={`M0 28H35 M0 52H35 M123 40H${w}`}/><text className="op-sign" x="45" y="31">+</text><text className="op-sign" x="45" y="57">−</text></>;
  if (s === 'oscilloscope' || s === 'analyzer' || s === 'multimeter') return <InstrumentSymbol definition={definition}/>;
  if (s === 'display7') return <DisplaySymbol/>;
  if (s === 'display4') return <FourDigitDisplay/>;
  if (s === 'lcd16x2') return <LcdDisplay/>;
  if (s === 'matrix8') return <DotMatrixDisplay/>;
  if (s === 'bargraph') return <BargraphDisplay/>;
  if (s === 'chip' || s === 'dff' || s === 'mux') return <ChipSymbol definition={definition}/>;
  if (s === 'motor') return <><path className="lead" d={`M0 40H42 M118 40H${w}`}/><circle className="symbol-body" cx="80" cy="40" r="36"/><text className="logic-value" x="80" y="51" textAnchor="middle">M</text></>;
  if (s === 'transformer') return <><path className="symbol-line" d="M68 13v54M92 13v54M20 24h25c25 0 25 32 0 32H20M140 24h-25c-25 0-25 32 0 32h25"/></>;
  return <><rect className="symbol-body" x="20" y="8" width={w - 40} height={h - 16}/><text className="generic-label" x={w / 2} y={h / 2 + 5} textAnchor="middle">{definition.name}</text></>;
}

function InstrumentSymbol({ definition }: { definition: ComponentDefinition }) {
  const w = definition.width, h = definition.height;
  const screenRight = w - 65;
  return <><rect className="instrument-body" x="8" y="6" width={w - 16} height={h - 12}/><rect className="instrument-screen" x="25" y="20" width={w - 85} height={h - 45}/><path className="scope-trace" d={`M30 ${h/2}H43l8-18 12 36 12-26 10 8H${screenRight}`}/><circle className="dial" cx={w - 38} cy="36" r="12"/><circle className="dial" cx={w - 38} cy="74" r="12"/><text className="instrument-name" x="25" y={h - 12}>{definition.name.toUpperCase()}</text></>;
}

function BjtSymbol({ type }: { type:'npn'|'pnp' }) {
  const npn = type === 'npn';
  return <g className="transistor-symbol bjt"><circle cx="82" cy="40" r="33"/><path className="lead" d="M0 40H64 M100 24L126 20H160 M100 56L126 60H160"/><path className="junction" d="M68 14V66 M68 30L100 24 M68 50L100 56"/><path className="transistor-arrow" d={npn?'M104 54l17 5-12 13z':'M121 59l-17-5 12-13z'}/><text x="10" y="34">B</text><text x="142" y="14">C</text><text x="142" y="74">E</text><text className="device-type" x="82" y="76" textAnchor="middle">{type.toUpperCase()}</text></g>;
}

function MosfetSymbol({ type }: { type:'nmos'|'pmos' }) {
  const nmos = type === 'nmos';
  return <g className="transistor-symbol mosfet"><circle cx="82" cy="40" r="33"/><path className="lead" d="M0 40H52 M93 20H160 M93 60H160"/><path className="gate" d="M56 15V65 M66 18V30 M66 35V45 M66 50V62"/><path className="channel" d="M78 20H93 M78 60H93 M78 20V60"/><path className="body" d="M78 40H103V60"/><path className="transistor-arrow" d={nmos?'M75 40l12-6v12z':'M90 40l-12-6v12z'}/>{!nmos&&<circle className="gate-bubble" cx="53" cy="40" r="4"/>}<text x="10" y="34">G</text><text x="142" y="14">D</text><text x="142" y="74">S</text><text className="device-type" x="82" y="76" textAnchor="middle">{nmos?'NMOS':'PMOS'}</text></g>;
}

function ChipSymbol({ definition }: { definition: ComponentDefinition }) {
  const w = definition.width, h = definition.height;
  return <><rect className="chip-body" x="23" y="5" width={w - 46} height={h - 10}/>{[18,32,48,62].map((y, i) => <g key={y}><path className="lead" d={`M0 ${y}h23M${w-23} ${y}h23`}/><circle className="chip-pad" cx="30" cy={y} r="2"/><circle className="chip-pad" cx={w-30} cy={y} r="2"/></g>)}<circle className="chip-notch" cx={w/2} cy="5" r="7"/><text className="chip-name" x={w/2} y={h/2+5} textAnchor="middle">{definition.name}</text></>;
}

function DisplaySymbol() {
  const segments = ['M58 14h44','M108 20v20','M108 48v18','M58 71h44','M52 48v18','M52 20v20','M58 43h44'];
  return <><rect className="display-body" x="38" y="4" width="84" height="72"/>{segments.map((d,i)=><path key={i} className="display-segment" d={d}/>)}</>;
}

function FourDigitDisplay() {
  return <><rect className="display-body" x="14" y="5" width="132" height="70"/>{[0,1,2,3].map(index => <g key={index} transform={`translate(${18+index*32} 10) scale(.34 .72)`}><DisplaySymbol/></g>)}<circle className="display-segment" cx="139" cy="65" r="3"/></>;
}

function LcdDisplay() {
  return <><rect className="lcd-frame" x="10" y="7" width="140" height="66"/><rect className="lcd-screen" x="20" y="16" width="120" height="46"/><text className="lcd-text" x="27" y="35">BITWIRE 16×2</text><text className="lcd-text" x="27" y="52">READY_</text></>;
}

function DotMatrixDisplay() {
  return <><rect className="matrix-frame" x="36" y="4" width="88" height="72"/>{Array.from({length:64},(_,index) => { const x=index%8, y=Math.floor(index/8); const on=[1,2,3,8,12,16,20,24,25,26,27,32,36,40,44,49,50,51].includes(index); return <circle key={index} className={on?'matrix-dot on':'matrix-dot'} cx={43+x*10.5} cy={11+y*8.4} r="2.4"/>; })}</>;
}

function BargraphDisplay() {
  return <><rect className="bargraph-frame" x="18" y="16" width="124" height="48"/>{Array.from({length:10},(_,index)=><rect key={index} className={index<6?'bargraph-led on':'bargraph-led'} x={24+index*11.5} y="23" width="7" height="34"/>)}</>;
}

function InternalNetwork({ definition }: { definition: ComponentDefinition }) {
  return <g className="internal-network">
    <rect x="22" y="9" width={definition.width - 44} height={definition.height - 18}/>
    <path d={`M31 24h20v32h22V24h22v32h25`}/>
    {[51,73,95].map((x,i)=><g key={x} transform={`translate(${x} ${i%2 ? 48 : 22})`}><circle r="7"/><path d="M-12 0h5M7 0h12M0-11v4M0 7v11"/></g>)}
    <text x={definition.width/2} y={definition.height-4} textAnchor="middle">RED CMOS · {definition.internal}</text>
  </g>;
}

function OscilloscopeInternalNetwork({ definition }: { definition: ComponentDefinition }) {
  const blocks = [
    { x: 10, y: 18, w: 27, label: 'ATT' }, { x: 43, y: 18, w: 29, label: 'AMP Y' },
    { x: 78, y: 18, w: 24, label: 'ADC' }, { x: 108, y: 18, w: 38, label: 'DISPLAY' },
    { x: 43, y: 50, w: 29, label: 'TRIGGER' }, { x: 78, y: 50, w: 31, label: 'TIMEBASE' },
  ];
  return <g className="oscilloscope-internal">
    <rect className="scope-chassis" x="4" y="4" width={definition.width-8} height={definition.height-8}/>
    <text x="10" y="13">ARQUITECTURA INTERNA · SEÑAL MIXTA</text>
    {blocks.map(block=><g key={block.label}><rect x={block.x} y={block.y} width={block.w} height="17"/><text x={block.x+block.w/2} y={block.y+11} textAnchor="middle">{block.label}</text></g>)}
    <path d="M4 27H10M37 27H43M72 27H78M102 27H108M57 35V50M72 58H78M109 58h20V35M13 72h133"/>
    <text x="82" y="72" textAnchor="middle">FUENTE · MEMORIA · CONTROL</text>
  </g>;
}

function GateInternalNetwork({ definition }: { definition: ComponentDefinition }) {
  const model = definition.model;
  const inverted = model === 'nand' || model === 'nor' || model === 'not';
  const series = model === 'and' || model === 'nand';
  return <g className="gate-internal-network">
    <rect x="9" y="5" width="142" height="70"/>
    <text x="15" y="14">EQUIVALENTE DE CONMUTACIÓN · {model.toUpperCase()}</text>
    <path className="rail" d="M18 24h124M18 64h124"/>
    <text x="15" y="30">VCC</text><text x="15" y="61">GND</text>
    {model === 'not' ? <>
      <SwitchGlyph x={62} y={42} label="A" normallyClosed/>
      <path className="network-wire" d="M18 24h30v18h14m38 0h27V24h15M100 42h27"/>
      <text x="131" y="45">Q</text>
    </> : series ? <>
      <SwitchGlyph x={55} y={42} label="A"/>
      <SwitchGlyph x={97} y={42} label="B"/>
      <path className="network-wire" d="M18 24h23v18h14m18 0h24m18 0h15V24h12"/>
      <text x="132" y="45">Q</text>
    </> : model === 'or' || model === 'nor' ? <>
      <SwitchGlyph x={74} y={32} label="A"/>
      <SwitchGlyph x={74} y={54} label="B"/>
      <path className="network-wire" d="M18 24h38v8h18m18 0h28v10m-64 12h18m18 0h28V42h22"/>
      <text x="132" y="45">Q</text>
    </> : <>
      <SwitchGlyph x={61} y={32} label="A"/>
      <SwitchGlyph x={97} y={54} label="B"/>
      <path className="network-wire" d="M18 24h29v8h14m18 0h28v10m-60 12h50m18 0h12V42h35"/>
      <text x="132" y="45">Q</text>
    </>}
    {inverted && model !== 'not' && <circle className="invert-node" cx="128" cy="42" r="4"/>}
    <text className="network-note" x="80" y="72" textAnchor="middle">{series ? 'CONTACTOS EN SERIE' : model === 'or' || model === 'nor' ? 'CONTACTOS EN PARALELO' : model === 'not' ? 'CONTACTO INVERSOR' : 'RED CRUZADA DE PARIDAD'}</text>
  </g>;
}

function GateCmosNetwork({ definition }: { definition: ComponentDefinition }) {
  const model=definition.model;
  const devices = model==='not'?2:model==='nand'||model==='nor'?4:model==='and'||model==='or'?6:12;
  const pullSeries=model==='nand'||model==='and';
  return <g className="gate-cmos-network">
    <rect x="5" y="4" width="150" height="72"/><text x="10" y="13">RED CMOS · {model.toUpperCase()} · {devices} MOSFET</text>
    <path className="rail" d="M14 20H146M14 64H146"/><text x="8" y="22">VDD</text><text x="8" y="66">VSS</text>
    {model==='not'?<><CmosGlyph x={60} y={30} type="P" label="A"/><CmosGlyph x={60} y={53} type="N" label="A"/><path className="network-wire" d="M28 20H60M78 30V53M78 41H138M60 64H28"/></>:<>
      <CmosGlyph x={45} y={30} type="P" label="A"/><CmosGlyph x={86} y={30} type="P" label="B"/><CmosGlyph x={45} y={53} type="N" label="A"/><CmosGlyph x={86} y={53} type="N" label="B"/>
      <path className="network-wire" d={pullSeries?'M24 20H45M63 30H86M104 30H125V42H139M24 64H45M63 53H86M104 53H125V42':'M24 20H45M63 30H125V42H139M24 20H86M104 30H125M24 64H45M63 53H125V42M24 64H86M104 53H125'}/>
      {(model==='and'||model==='or'||model==='xor'||model==='xnor')&&<g><rect className="inverter-stage" x="127" y="27" width="22" height="28"/><text x="138" y="38" textAnchor="middle">INV</text><text x="138" y="47" textAnchor="middle">×2</text></g>}
    </>}
    <text className="network-note" x="80" y="73" textAnchor="middle">PMOS: RED DE ELEVACIÓN · NMOS: RED DE DESCARGA</text>
  </g>;
}

function CmosGlyph({x,y,type,label}:{x:number;y:number;type:'P'|'N';label:string}) {
  return <g className="cmos-glyph" transform={`translate(${x} ${y})`}><path d="M0 0H18M4-7V7M-8 0H1"/>{type==='P'&&<circle cx="1" cy="0" r="2"/>}<text x="9" y="-9" textAnchor="middle">{type}·{label}</text></g>;
}

function SemiconductorInternal({ definition, lod }: { definition:ComponentDefinition; lod:LodLevel }) {
  const s=definition.symbol;
  if (s==='diode'||s==='zener'||s==='led') return <g className="semiconductor-internal diode-junction">
    <rect className="semiconductor-frame" x="5" y="5" width="150" height="70"/><text x="10" y="14">UNIÓN P–N · {s.toUpperCase()}</text>
    <rect className="p-region" x="18" y="22" width="57" height="40"/><rect className="depletion-region" x="75" y="22" width="12" height="40"/><rect className="n-region" x="87" y="22" width="57" height="40"/>
    <text className="region-label" x="46" y="45" textAnchor="middle">P · HUECOS +</text><text className="region-label" x="116" y="45" textAnchor="middle">N · e⁻</text><text className="vertical-label" x="83" y="59" transform="rotate(-90 83 59)">ZONA DE AGOTAMIENTO</text>
    <path className="carrier-flow" d="M22 68H138"/><path className="carrier-arrow" d="M137 68l-8-4v8z"/>
    {lod>=4&&<g className="crystal-lattice">{[30,42,54,99,111,123,135].map((x,index)=><circle key={x} cx={x} cy={index%2?30:55} r="2"/>)}<text x="80" y="72" textAnchor="middle">Si DOPADO · CAMPO INTERNO · BARRERA DE POTENCIAL</text></g>}
  </g>;
  const bjt=s==='npn'||s==='pnp'; const pFirst=s==='pnp'||s==='pmos';
  return <g className="semiconductor-internal transistor-structure"><rect className="semiconductor-frame" x="5" y="5" width="150" height="70"/><text x="10" y="14">ESTRUCTURA {bjt?'BIPOLAR':'MOS'} · {s.toUpperCase()}</text>{bjt?<>
    <rect className={pFirst?'p-region':'n-region'} x="18" y="23" width="47" height="38"/><rect className={pFirst?'n-region':'p-region'} x="65" y="23" width="25" height="38"/><rect className={pFirst?'p-region':'n-region'} x="90" y="23" width="52" height="38"/><text className="region-label" x="41" y="45" textAnchor="middle">{pFirst?'P':'N'} · E</text><text className="region-label" x="77" y="45" textAnchor="middle">{pFirst?'N':'P'} · B</text><text className="region-label" x="116" y="45" textAnchor="middle">{pFirst?'P':'N'} · C</text>
  </>:<><rect className={pFirst?'n-region':'p-region'} x="18" y="34" width="124" height="27"/><rect className={pFirst?'p-region':'n-region'} x="99" y="28" width="34" height="33"/><rect className="oxide-layer" x="48" y="28" width="38" height="5"/><rect className="metal-gate" x="48" y="20" width="38" height="7"/><text className="region-label" x="67" y="18" textAnchor="middle">GATE</text><text className="region-label" x="36" y="51">S</text><text className="region-label" x="116" y="51">D</text><text className="region-label" x="67" y="39" textAnchor="middle">SiO₂</text></>}</g>;
}

function SwitchGlyph({ x, y, label, normallyClosed = false }: { x: number; y: number; label: string; normallyClosed?: boolean }) {
  return <g className="internal-switch" transform={`translate(${x} ${y})`}>
    <circle cx="0" cy="0" r="2"/><circle cx="18" cy="0" r="2"/><path d={normallyClosed ? 'M2 0h14' : 'M2 0l14-7'}/><text x="9" y="-10" textAnchor="middle">{label}</text>
  </g>;
}

function InlinePropertyEditor({ component, definition, onProperty }: { component: ComponentInstance; definition: ComponentDefinition; onProperty: Props['onProperty'] }) {
  const entries = Object.entries(component.properties).slice(0, 3);
  return <foreignObject className="inline-editor-object" x="14" y="9" width={definition.width - 28} height={definition.height - 18} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    <div className="inline-property-editor">
      {entries.map(([key,value]) => <label key={key}><span>{humanize(key)}</span>{typeof value === 'boolean' ? <button className={value ? 'mini-toggle on' : 'mini-toggle'} onClick={() => onProperty(component,key,!value)}>{key === 'closed' ? value ? 'CERRADO' : 'ABIERTO' : value ? 'ON' : 'OFF'}</button> : typeof value === 'number' ? <CompactNumberInput value={value} onChange={next=>onProperty(component,key,next)}/> : <input type={key.toLowerCase().includes('color') ? 'color' : 'text'} value={String(value)} onChange={event => onProperty(component,key,event.target.value)}/>}</label>)}
    </div>
  </foreignObject>;
}

function CompactNumberInput({ value, onChange }: { value: number; onChange(value:number): void }) {
  const step = Math.abs(value) >= 100 ? 10 : Math.abs(value) >= 10 ? 1 : .1;
  return <span className="compact-number"><button onClick={()=>onChange(Number((value-step).toPrecision(10)))}>−</button><input type="number" value={value} onChange={event=>onChange(Number(event.target.value))}/><button onClick={()=>onChange(Number((value+step).toPrecision(10)))}>+</button></span>;
}

function humanize(value: string) {
  const labels: Record<string,string> = {
    frequency:'Frecuencia (Hz)', dutyCycle:'Ciclo útil (%)', propagationDelay:'Retardo (ns)',
    voltage:'Tensión (V)', currentLimit:'Límite (A)', resistance:'Resistencia (Ω)',
    capacitance:'Capacidad (F)', inductance:'Inductancia (H)', state:'Estado lógico', closed:'Cerrado',
  };
  return labels[value] ?? value.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
}
