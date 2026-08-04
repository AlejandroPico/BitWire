import type { BitWireProject, ComponentInstance, ModuleArea, ProjectSettings, Wire } from '../model/types';
import { CATALOG_BY_ID } from '../catalog/catalog';

const now = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

export const DEFAULT_SETTINGS: ProjectSettings = {
  gridSize: 20,
  snapToGrid: true,
  wireRouting: 'orthogonal',
  theme: 'blueprint',
  signalView: 'voltage',
  showValues: true,
};

export function createInstance(definitionId: string, x: number, y: number, id = uid('node')): ComponentInstance {
  const definition = CATALOG_BY_ID.get(definitionId);
  if (!definition) throw new Error(`Componente desconocido: ${definitionId}`);
  return {
    id,
    definitionId,
    x,
    y,
    rotation: 0,
    properties: { ...definition.defaults },
    enabled: true,
  };
}

const wire = (id: string, fromComponent: string, fromPin: string, toComponent: string, toPin: string): Wire => ({
  id, from: { componentId: fromComponent, pinId: fromPin }, to: { componentId: toComponent, pinId: toPin }, routing: 'orthogonal',
});

export function createDemoProject(): BitWireProject {
  const createdAt = now();
  const components: ComponentInstance[] = [
    createInstance('dc_source', -560, -110, 'source_main'),
    createInstance('switch_spst', -320, -110, 'switch_main'),
    createInstance('resistor', -80, -110, 'resistor_main'),
    createInstance('lamp', 180, -110, 'lamp_main'),
    createInstance('ground', 440, 30, 'ground_main'),
    createInstance('logic_input', -520, 300, 'logic_a'),
    createInstance('logic_input', -520, 430, 'logic_b'),
    createInstance('gate_and', -180, 345, 'gate_main'),
    createInstance('led', 120, 345, 'led_logic'),
    createInstance('oscilloscope', 400, 300, 'scope_main'),
  ];
  components.find(c => c.id === 'resistor_main')!.properties.resistance = 330;
  components.find(c => c.id === 'lamp_main')!.properties.ratedVoltage = 5;
  components.find(c => c.id === 'led_logic')!.properties.color = '#2be4c4';
  const wires: Wire[] = [
    wire('w_power', 'source_main', 'pos', 'switch_main', 'a'),
    wire('w_control', 'switch_main', 'b', 'resistor_main', 'a'),
    wire('w_load', 'resistor_main', 'b', 'lamp_main', 'a'),
    wire('w_return', 'lamp_main', 'b', 'ground_main', 'gnd'),
    wire('w_ground', 'source_main', 'neg', 'ground_main', 'gnd'),
    wire('w_a', 'logic_a', 'out', 'gate_main', 'a'),
    wire('w_b', 'logic_b', 'out', 'gate_main', 'b'),
    wire('w_gate_out', 'gate_main', 'out', 'led_logic', 'a'),
    wire('w_led_return', 'led_logic', 'b', 'ground_main', 'gnd'),
    wire('w_scope', 'gate_main', 'out', 'scope_main', 'ch1'),
  ];
  const modules: ModuleArea[] = [
    { id: 'module_power', name: 'Etapa eléctrica de 5 V', x: -610, y: -170, width: 900, height: 210, color: '#f5b942', memberIds: ['source_main','switch_main','resistor_main','lamp_main'], enabled: true },
    { id: 'module_logic', name: 'Demostrador AND', x: -580, y: 250, width: 920, height: 320, color: '#2be4c4', memberIds: ['logic_a','logic_b','gate_main','led_logic'], enabled: true },
  ];
  return {
    format: 'bitwire', version: 1, id: uid('project'), name: 'Laboratorio inicial',
    description: 'Circuito eléctrico y bloque lógico de demostración.', createdAt, updatedAt: createdAt,
    components, wires, modules, settings: { ...DEFAULT_SETTINGS },
  };
}

export function createBlankProject(name = 'Circuito sin título'): BitWireProject {
  const createdAt = now();
  return {
    format: 'bitwire', version: 1, id: uid('project'), name, description: '',
    createdAt, updatedAt: createdAt, components: [], wires: [], modules: [], settings: { ...DEFAULT_SETTINGS },
  };
}

export function cloneProject(project: BitWireProject): BitWireProject {
  return structuredClone(project);
}

export function validateProject(input: unknown): BitWireProject {
  if (!input || typeof input !== 'object') throw new Error('El archivo no contiene un proyecto válido.');
  const candidate = input as Partial<BitWireProject>;
  if (candidate.format !== 'bitwire' || candidate.version !== 1) throw new Error('Versión de archivo .bitwire incompatible.');
  if (!Array.isArray(candidate.components) || !Array.isArray(candidate.wires)) throw new Error('El grafo del circuito está incompleto.');
  const ids = new Set(candidate.components.map(item => item.id));
  for (const connection of candidate.wires) {
    if (!ids.has(connection.from.componentId) || !ids.has(connection.to.componentId)) {
      throw new Error(`El cable ${connection.id} apunta a un componente inexistente.`);
    }
  }
  return candidate as BitWireProject;
}

