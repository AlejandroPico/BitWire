import { CATALOG_BY_ID } from '../catalog/catalog';
import type {
  BitWireProject, ComponentInstance, ComponentSignal, LogicValue,
  SimulationSnapshot, WireSignal,
} from '../model/types';
import { EMPTY_SIGNAL } from '../model/types';

const cloneSignal = (signal: Partial<WireSignal> = {}): WireSignal => ({ ...EMPTY_SIGNAL, ...signal });
const keyOf = (componentId: string, pinId: string) => `${componentId}:${pinId}`;

function truth(value: WireSignal | undefined): LogicValue {
  if (!value || value.logic === 'X' || value.logic === 'Z') return 'X';
  return value.logic;
}

function logicSignal(value: LogicValue, highVoltage = 5): WireSignal {
  return cloneSignal({
    logic: value,
    voltage: value === 1 ? highVoltage : 0,
    active: value === 0 || value === 1,
    floating: value === 'X' || value === 'Z',
    current: value === 1 ? .002 : 0,
  });
}

function gateResult(model: string, inputs: LogicValue[]): LogicValue {
  if (inputs.some(value => value === 'X' || value === 'Z')) return 'X';
  const bits = inputs as Array<0 | 1>;
  switch (model) {
    case 'and': return bits.every(Boolean) ? 1 : 0;
    case 'nand': return bits.every(Boolean) ? 0 : 1;
    case 'or': return bits.some(Boolean) ? 1 : 0;
    case 'nor': return bits.some(Boolean) ? 0 : 1;
    case 'xor': return bits.filter(Boolean).length % 2 ? 1 : 0;
    case 'xnor': return bits.filter(Boolean).length % 2 ? 0 : 1;
    case 'not': return bits[0] ? 0 : 1;
    default: return 'X';
  }
}

function evaluateComponent(
  component: ComponentInstance,
  inputs: Record<string, WireSignal>,
  time: number,
): Record<string, WireSignal> {
  const definition = CATALOG_BY_ID.get(component.definitionId);
  if (!definition || !component.enabled) return {};
  const props = { ...definition.defaults, ...component.properties };
  const output: Record<string, WireSignal> = {};
  const voltageHigh = Number(props.voltageHigh ?? 5);
  const model = definition.model;

  if (model === 'source_dc') {
    const voltage = Number(props.voltage ?? 5);
    output.pos = cloneSignal({ logic: voltage >= 2.5 ? 1 : 0, voltage, current: .01, active: true, floating: false });
    output.neg = cloneSignal({ logic: 0, voltage: 0, active: true, floating: false });
  } else if (model === 'source_ac') {
    const peak = Number(props.voltage ?? 12) * Math.SQRT2;
    const voltage = peak * Math.sin(time * Math.PI * 2 * Number(props.frequency ?? 50));
    output.pos = cloneSignal({ logic: voltage >= 2.5 ? 1 : 0, voltage, current: Math.abs(voltage) / 1000, active: true, floating: false });
    output.neg = cloneSignal({ logic: 0, voltage: 0, active: true, floating: false });
  } else if (model === 'ground') {
    output.gnd = cloneSignal({ logic: 0, voltage: 0, active: true, floating: false });
  } else if (model === 'logic_input') {
    output.out = logicSignal(Number(props.state) ? 1 : 0, voltageHigh);
  } else if (model === 'clock') {
    const frequency = Math.max(.001, Number(props.frequency ?? 1));
    const duty = Math.max(1, Math.min(99, Number(props.dutyCycle ?? 50))) / 100;
    output.out = logicSignal((time * frequency) % 1 < duty ? 1 : 0, voltageHigh);
  } else if (['and','or','not','nand','nor','xor','xnor'].includes(model)) {
    const ids = model === 'not' ? ['in'] : ['a', 'b'];
    output.out = logicSignal(gateResult(model, ids.map(id => truth(inputs[id]))), voltageHigh);
  } else if (model === 'mux') {
    const selected = truth(inputs.sel) === 1 ? inputs.b : inputs.a;
    output.out = selected ? { ...selected } : logicSignal('X', voltageHigh);
  } else if (model === 'dff') {
    const initial = Number(props.initialState ?? 0) ? 1 : 0;
    const q = inputs.d && truth(inputs.clk) === 1 ? truth(inputs.d) : initial;
    output.q = logicSignal(q, voltageHigh);
    output.nq = logicSignal(q === 1 ? 0 : 1, voltageHigh);
  } else if (model === 'comparator') {
    const result = (inputs.plus?.voltage ?? 0) > (inputs.minus?.voltage ?? 0) ? 1 : 0;
    output.out = logicSignal(result, Number(props.highVoltage ?? 5));
  } else if (model === 'switch') {
    if (Boolean(props.closed)) {
      if (inputs.a) output.b = { ...inputs.a };
      if (inputs.b) output.a = { ...inputs.b };
    }
  } else if (['resistor','capacitor','inductor','fuse','connector'].includes(model)) {
    if (model === 'fuse' && Boolean(props.blown)) return {};
    if (inputs.a) output.b = { ...inputs.a };
    if (inputs.b) output.a = { ...inputs.b };
    if (inputs.p1) output.p2 = { ...inputs.p1 };
    if (inputs.p2) output.p1 = { ...inputs.p2 };
  } else if (['diode','zener','led','lamp','motor','buzzer'].includes(model)) {
    // Loads consume a net but must not behave as ideal voltage sources on the return net.
    // Their visual activity is derived from the input below.
  } else if (model === 'opamp') {
    const supply = Number(props.supply ?? 12);
    const voltage = Math.max(-supply, Math.min(supply,
      ((inputs.plus?.voltage ?? 0) - (inputs.minus?.voltage ?? 0)) * Number(props.gain ?? 100000)));
    output.out = cloneSignal({ voltage, logic: voltage >= 2.5 ? 1 : 0, active: true, floating: false, current: Math.abs(voltage) / 10000 });
  }
  return output;
}

export function evaluateCircuit(project: BitWireProject, time = 0, tick = 0): SimulationSnapshot {
  const endpointSignals = new Map<string, WireSignal>();
  const componentSignals: Record<string, ComponentSignal> = {};

  const connectedTo = new Map<string, string[]>();
  for (const wire of project.wires) {
    const from = keyOf(wire.from.componentId, wire.from.pinId);
    const to = keyOf(wire.to.componentId, wire.to.pinId);
    connectedTo.set(from, [...(connectedTo.get(from) ?? []), to]);
    connectedTo.set(to, [...(connectedTo.get(to) ?? []), from]);
  }

  const signalOnNet = (start: string): WireSignal | undefined => {
    const queue = [start], visited = new Set<string>();
    let fallback: WireSignal | undefined;
    while (queue.length) {
      const endpoint = queue.shift()!;
      if (visited.has(endpoint)) continue;
      visited.add(endpoint);
      const value = endpointSignals.get(endpoint);
      if (value?.active && Math.abs(value.voltage) > .001) return value;
      if (value?.active) fallback = value;
      else if (value && !fallback) fallback = value;
      for (const peer of connectedTo.get(endpoint) ?? []) queue.push(peer);
    }
    return fallback;
  };

  for (let pass = 0; pass < Math.max(6, project.components.length * 2); pass += 1) {
    let changed = false;
    for (const component of project.components) {
      const definition = CATALOG_BY_ID.get(component.definitionId);
      if (!definition) continue;
      const inputs: Record<string, WireSignal> = {};
      for (const pinDef of definition.pins) {
        const endpoint = keyOf(component.id, pinDef.id);
        const signal = signalOnNet(endpoint);
        if (signal) inputs[pinDef.id] = signal;
      }
      const outputs = evaluateComponent(component, inputs, time);
      let active = false;
      let power = 0;
      for (const [pinId, signal] of Object.entries(outputs)) {
        const endpoint = keyOf(component.id, pinId);
        const previous = endpointSignals.get(endpoint);
        if (!previous || previous.logic !== signal.logic || Math.abs(previous.voltage - signal.voltage) > 1e-9) changed = true;
        endpointSignals.set(endpoint, signal);
        active ||= signal.active && Math.abs(signal.voltage) > .001;
        power += Math.abs(signal.voltage * signal.current);
      }
      if (['diode','zener','led','lamp','motor','buzzer'].includes(definition.model)) {
        const input = Object.values(inputs).find(signal => signal.active && Math.abs(signal.voltage) > .001);
        if (input) { active = true; power = Math.abs(input.voltage * Math.max(input.current,.002)); }
      }
      componentSignals[component.id] = { outputs, active, power };
    }
    if (!changed) break;
  }

  const wireSignals: Record<string, WireSignal> = {};
  const warnings: string[] = [];
  for (const wire of project.wires) {
    const left = signalOnNet(keyOf(wire.from.componentId, wire.from.pinId));
    const right = signalOnNet(keyOf(wire.to.componentId, wire.to.pinId));
    const signal = left?.active ? left : right?.active ? right : left ?? right ?? cloneSignal();
    const destination = project.components.find(c => c.id === wire.to.componentId);
    const destinationDef = destination && CATALOG_BY_ID.get(destination.definitionId);
    const source = project.components.find(c => c.id === wire.from.componentId);
    const sourceDef = source && CATALOG_BY_ID.get(source.definitionId);
    const isDigital = sourceDef?.pins.find(pin => pin.id === wire.from.pinId)?.domain === 'DIGITAL'
      || destinationDef?.pins.find(pin => pin.id === wire.to.pinId)?.domain === 'DIGITAL';
    const resistance = destinationDef?.model === 'resistor'
      ? Math.max(.001, Number(destination?.properties.resistance ?? destinationDef.defaults.resistance ?? 1000))
      : 1000;
    const active = signal.active && (isDigital || Math.abs(signal.voltage) > .001);
    wireSignals[wire.id] = { ...signal, active, current: active ? Math.abs(signal.voltage) / resistance : 0 };
    if (!left && !right) warnings.push(`Cable ${wire.label ?? wire.id} sin señal definida`);
  }

  return { tick, time, wireSignals, componentSignals, warnings: warnings.slice(0, 8) };
}
