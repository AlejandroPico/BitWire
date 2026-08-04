export type PinKind = 'INPUT' | 'OUTPUT' | 'BIDIRECTIONAL' | 'POWER' | 'VCC' | 'GND' | 'ANALOG';
export type SignalDomain = 'ANALOG' | 'DIGITAL' | 'MIXED' | 'POWER';
export type LogicValue = 0 | 1 | 'X' | 'Z';
export type PropertyValue = string | number | boolean;

export interface PinDefinition {
  id: string;
  name: string;
  kind: PinKind;
  domain: SignalDomain;
  x: number;
  y: number;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  family: string;
  description: string;
  tags: string[];
  model: string;
  symbol: string;
  width: number;
  height: number;
  pins: PinDefinition[];
  defaults: Record<string, PropertyValue>;
  customGui?: boolean;
  internal?: string;
}

export interface Point { x: number; y: number }
export interface PinRef { componentId: string; pinId: string }

export interface ComponentInstance {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  rotation: number;
  properties: Record<string, PropertyValue>;
  enabled: boolean;
  locked?: boolean;
}

export interface Wire {
  id: string;
  from: PinRef;
  to: PinRef;
  label?: string;
  routing: 'orthogonal' | 'bezier' | 'straight';
}

export interface ModuleArea {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  memberIds: string[];
  enabled: boolean;
  collapsed?: boolean;
}

export interface ProjectSettings {
  gridSize: number;
  snapToGrid: boolean;
  wireRouting: Wire['routing'];
  theme: Theme;
  signalView: SignalView;
  showValues: boolean;
}

export interface BitWireProject {
  format: 'bitwire';
  version: 1;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  components: ComponentInstance[];
  wires: Wire[];
  modules: ModuleArea[];
  settings: ProjectSettings;
}

export interface WireSignal {
  logic: LogicValue;
  voltage: number;
  current: number;
  active: boolean;
  floating?: boolean;
}

export interface ComponentSignal {
  outputs: Record<string, WireSignal>;
  active: boolean;
  power: number;
}

export interface SimulationSnapshot {
  tick: number;
  time: number;
  wireSignals: Record<string, WireSignal>;
  componentSignals: Record<string, ComponentSignal>;
  warnings: string[];
}

export type ToolMode = 'select' | 'wire' | 'pan' | 'module';
export type Theme = 'blueprint' | 'dark' | 'light' | 'auto';
export type SignalView = 'voltage' | 'current' | 'logic' | 'power';

export interface ViewportState { x: number; y: number; scale: number }

export interface CatalogDatabaseStatus {
  source: 'sqlite' | 'embedded';
  count: number;
}

export const EMPTY_SIGNAL: WireSignal = {
  logic: 'Z', voltage: 0, current: 0, active: false, floating: true,
};

