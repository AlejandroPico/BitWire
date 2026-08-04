import { CATALOG_BY_ID } from '../catalog/catalog';
import type {
  BitWireProject, ComponentInstance, LogicValue, SimulationSnapshot, WireSignal,
} from '../model/types';

export interface InstrumentPinCapture {
  pinId: string;
  pinName: string;
  wireId?: string;
  wireLabel?: string;
  values: number[];
  currents: number[];
  logic: LogicValue[];
  last?: WireSignal;
}

export interface InstrumentCapture {
  pins: InstrumentPinCapture[];
  duration: number;
  voltage: number;
  current: number;
  power: number;
  minimum: number;
  maximum: number;
  average: number;
  rms: number;
  frequency: number;
  period: number;
  dutyCycle: number;
  transitions: number;
  energy: number;
  spectrum: number[];
}

export function captureInstrument(
  project: BitWireProject,
  component: ComponentInstance,
  samples: SimulationSnapshot[],
): InstrumentCapture {
  const definition = CATALOG_BY_ID.get(component.definitionId);
  const recent = samples.slice(-240);
  const groundWire = wireForPin(project, component.id, 'gnd');
  const groundValues = recent.map(sample => groundWire ? sample.wireSignals[groundWire.id]?.voltage ?? 0 : 0);
  const pins = (definition?.pins ?? []).map(pin => {
    const wire = wireForPin(project, component.id, pin.id);
    const signals = recent.map(sample => wire ? sample.wireSignals[wire.id] : undefined);
    const values = signals.map((signal,index) => (signal?.voltage ?? 0) - (pin.id === 'gnd' ? 0 : groundValues[index]));
    return {
      pinId: pin.id,
      pinName: pin.name,
      wireId: wire?.id,
      wireLabel: wire?.label,
      values,
      currents: signals.map(signal => signal?.current ?? 0),
      logic: signals.map(signal => signal?.logic ?? 'Z'),
      last: signals.at(-1),
    } satisfies InstrumentPinCapture;
  });
  const primary = primaryPin(component.definitionId, pins);
  const reference = component.definitionId === 'multimeter' ? pins.find(pin => pin.pinId === 'minus') : undefined;
  const values = primary?.values.map((value,index) => value - (reference?.values[index] ?? 0)) ?? [];
  const currents = primary?.currents ?? [];
  const logic = primary?.logic ?? [];
  const duration = Math.max(.000001,(recent.at(-1)?.time ?? 0) - (recent.at(0)?.time ?? 0));
  const transitions = logic.slice(1).reduce<number>((count,value,index) => count + (value !== logic[index] && value !== 'Z' && logic[index] !== 'Z' ? 1 : 0),0);
  const high = logic.filter(value => value === 1).length;
  const voltage = values.at(-1) ?? 0;
  const current = currents.at(-1) ?? 0;
  const powerSeries = values.map((value,index) => Math.abs(value * (currents[index] ?? 0)));
  const average = values.length ? values.reduce((sum,value) => sum + value,0) / values.length : 0;
  const rms = values.length ? Math.sqrt(values.reduce((sum,value) => sum + value * value,0) / values.length) : 0;
  const frequency = transitions / (2 * duration);
  return {
    pins,
    duration,
    voltage,
    current,
    power: powerSeries.at(-1) ?? 0,
    minimum: values.length ? Math.min(...values) : 0,
    maximum: values.length ? Math.max(...values) : 0,
    average,
    rms,
    frequency,
    period: frequency > 0 ? 1 / frequency : 0,
    dutyCycle: logic.length ? high / logic.length * 100 : 0,
    transitions,
    energy: integrate(powerSeries,duration),
    spectrum: spectrumBins(values,32),
  };
}

function wireForPin(project: BitWireProject, componentId: string, pinId: string) {
  return project.wires.find(wire =>
    (wire.from.componentId === componentId && wire.from.pinId === pinId) ||
    (wire.to.componentId === componentId && wire.to.pinId === pinId));
}

function primaryPin(definitionId: string, pins: InstrumentPinCapture[]) {
  const preferred: Record<string,string[]> = {
    oscilloscope: ['ch1','ch2'], logic_analyzer: ['ch0'], multimeter: ['plus'],
    spectrum_analyzer: ['in'], power_monitor: ['plus','in'], frequency_counter: ['in'], probe: ['in'],
  };
  for (const id of preferred[definitionId] ?? []) {
    const pin = pins.find(item => item.pinId === id);
    if (pin?.wireId) return pin;
  }
  return pins.find(pin => pin.wireId && pin.pinId !== 'gnd') ?? pins[0];
}

function integrate(values: number[], duration: number) {
  if (values.length < 2) return 0;
  return values.reduce((sum,value) => sum + value,0) / values.length * duration;
}

export function spectrumBins(values: number[], count: number) {
  if (values.length < 2) return Array.from({ length: count },() => 0);
  const source = values.slice(-128);
  const mean = source.reduce((sum,value) => sum + value,0) / source.length;
  const magnitudes = Array.from({ length: count },(_,bin) => {
    let real = 0, imaginary = 0;
    source.forEach((value,index) => {
      const window = .5 - .5 * Math.cos(2 * Math.PI * index / Math.max(1,source.length - 1));
      const angle = 2 * Math.PI * bin * index / source.length;
      real += (value - mean) * window * Math.cos(angle);
      imaginary -= (value - mean) * window * Math.sin(angle);
    });
    return Math.hypot(real,imaginary) / source.length;
  });
  const maximum = Math.max(.000001,...magnitudes);
  return magnitudes.map(value => value / maximum);
}

export function formatFrequency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0.000 Hz';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(4)} GHz`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(4)} MHz`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(4)} kHz`;
  return `${value.toFixed(4)} Hz`;
}

export function formatPeriod(value: number) {
  if (!value) return '—';
  if (value < 1e-6) return `${(value * 1e9).toFixed(3)} ns`;
  if (value < 1e-3) return `${(value * 1e6).toFixed(3)} µs`;
  if (value < 1) return `${(value * 1e3).toFixed(3)} ms`;
  return `${value.toFixed(4)} s`;
}
