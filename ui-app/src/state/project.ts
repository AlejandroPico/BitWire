import type { BitWireProject, ComponentInstance, ModuleArea, ProjectSettings, Theme, Wire } from '../model/types';
import { CATALOG_BY_ID } from '../catalog/catalog';
import { componentOwnerModuleId } from '../model/moduleScope';

const now = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

export const DEFAULT_SETTINGS: ProjectSettings = {
  gridSize: 20,
  snapToGrid: true,
  wireRouting: 'orthogonal',
  theme: 'auto',
  signalView: 'voltage',
  showValues: true,
  animateCurrent: true,
  liveInstrumentScreens: true,
};

export function createInstance(definitionId: string, x: number, y: number, id = uid('node'), scale = 1): ComponentInstance {
  const definition = CATALOG_BY_ID.get(definitionId);
  if (!definition) throw new Error(`Componente desconocido: ${definitionId}`);
  const properties={ ...definition.defaults };
  if(['and','or','nand','nor','xor','xnor'].includes(definition.model)){
    properties.inputCount=definition.pins.filter(pin=>pin.kind==='INPUT').length||2;
    properties.outputCount=1;
  } else if(definition.model==='not') properties.outputCount=1;
  return {
    id,
    definitionId,
    x,
    y,
    rotation: 0,
    scale,
    properties,
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
    wire('w_return', 'lamp_main', 'b', 'module_power', 'gnd'),
    wire('w_ground', 'source_main', 'neg', 'module_power', 'gnd'),
    wire('w_ground_external', 'module_power', 'gnd', 'ground_main', 'gnd'),
    wire('w_a', 'logic_a', 'out', 'module_gate_core', 'a'),
    wire('w_a_internal', 'module_gate_core', 'a', 'gate_main', 'a'),
    wire('w_b', 'logic_b', 'out', 'module_gate_core', 'b'),
    wire('w_b_internal', 'module_gate_core', 'b', 'gate_main', 'b'),
    wire('w_gate_internal', 'gate_main', 'out', 'module_gate_core', 'q'),
    wire('w_gate_out', 'module_gate_core', 'q', 'led_logic', 'a'),
    wire('w_module_q_internal', 'module_gate_core', 'q', 'module_logic', 'q'),
    wire('w_led_return', 'led_logic', 'b', 'module_logic', 'gnd'),
    wire('w_logic_ground_external', 'module_logic', 'gnd', 'ground_main', 'gnd'),
    wire('w_scope', 'module_logic', 'q', 'scope_main', 'ch1'),
  ];
  const modules: ModuleArea[] = [
    { id: 'module_power', name: 'Etapa eléctrica de 5 V', x: -610, y: -170, width: 900, height: 210, color: '#f5b942', memberIds: ['source_main','switch_main','resistor_main','lamp_main'], enabled: true, collapsed: false, pins: [
      { id: 'vin', name: 'VIN 5V', kind: 'POWER', domain: 'POWER', side: 'left', position: 1/3, nominalVoltage: 5 },
      { id: 'gnd', name: 'GND', kind: 'GND', domain: 'POWER', side: 'left', position: 2/3, nominalVoltage: 0 },
      { id: 'vout', name: 'VOUT', kind: 'OUTPUT', domain: 'ANALOG', side: 'right', position: .5, nominalVoltage: 5 },
    ] },
    { id: 'module_logic', name: 'Demostrador AND', x: -580, y: 250, width: 920, height: 320, color: '#2be4c4', memberIds: ['logic_a','logic_b','gate_main','led_logic'], enabled: true, collapsed: false, pins: [
      { id: 'a', name: 'A', kind: 'INPUT', domain: 'DIGITAL', side: 'left', position: 1/3 },
      { id: 'b', name: 'B', kind: 'INPUT', domain: 'DIGITAL', side: 'left', position: 2/3 },
      { id: 'q', name: 'Q', kind: 'OUTPUT', domain: 'DIGITAL', side: 'right', position: .5 },
      { id: 'gnd', name: 'GND', kind: 'GND', domain: 'POWER', side: 'bottom', position: .5, nominalVoltage: 0 },
    ] },
    { id: 'module_gate_core', name: 'Núcleo lógico AND', x: -260, y: 300, width: 320, height: 180, color: '#7b8cff', memberIds: ['gate_main'], enabled: true, collapsed: true, parentModuleId: 'module_logic', pins: [
      { id: 'a', name: 'A', kind: 'INPUT', domain: 'DIGITAL', side: 'left', position: 1/3 },
      { id: 'b', name: 'B', kind: 'INPUT', domain: 'DIGITAL', side: 'left', position: 2/3 },
      { id: 'q', name: 'Q', kind: 'OUTPUT', domain: 'DIGITAL', side: 'right', position: .5 },
    ] },
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

/** Duplicates components and keeps every copy in the same hierarchical canvas as its source. */
export function duplicateComponents(
  project: BitWireProject,
  selectedIds: readonly string[],
  makeId: (prefix: string) => string = uid,
): string[] {
  const selected = new Set(selectedIds);
  const sources = project.components.filter(component => selected.has(component.id));
  const owners = new Map(sources.map(component => [component.id, componentOwnerModuleId(project, component.id)]));
  const idMap = new Map(sources.map(component => [component.id, makeId('node')]));
  const copies = sources.map(component => ({
    ...structuredClone(component),
    id: idMap.get(component.id)!,
    x: component.x + 40,
    y: component.y + 40,
  }));
  const wires = project.wires
    .filter(connection => idMap.has(connection.from.componentId) && idMap.has(connection.to.componentId))
    .map(connection => ({
      ...structuredClone(connection),
      id: makeId('wire'),
      from: { ...connection.from, componentId: idMap.get(connection.from.componentId)! },
      to: { ...connection.to, componentId: idMap.get(connection.to.componentId)! },
    }));

  project.components.push(...copies);
  project.wires.push(...wires);
  for (const source of sources) {
    const ownerId = owners.get(source.id);
    const duplicateId = idMap.get(source.id)!;
    if (ownerId) project.modules.find(module => module.id === ownerId)?.memberIds.push(duplicateId);
  }
  return copies.map(component => component.id);
}

export function validateProject(input: unknown): BitWireProject {
  if (!input || typeof input !== 'object') throw new Error('El archivo no contiene un proyecto válido.');
  const candidate = input as Partial<BitWireProject>;
  if (candidate.format !== 'bitwire' || candidate.version !== 1) throw new Error('Versión de archivo .bitwire incompatible.');
  if (!Array.isArray(candidate.components) || !Array.isArray(candidate.wires)) throw new Error('El grafo del circuito está incompleto.');
  candidate.modules ??= [];
  const ids = new Set([...candidate.components.map(item => item.id), ...candidate.modules.map(item => item.id)]);
  for (const connection of candidate.wires) {
    if (!ids.has(connection.from.componentId) || !ids.has(connection.to.componentId)) {
      throw new Error(`El cable ${connection.id} apunta a un componente inexistente.`);
    }
  }
  const project = candidate as BitWireProject;
  project.settings = { ...DEFAULT_SETTINGS, ...(candidate.settings ?? {}) };
  // Forward-compatible migration of projects saved by the first public build.
  for (const component of project.components) component.scale = Number(component.scale) || 1;
  for (const module of project.modules) {
    module.collapsed ??= false;
    module.pins ??= [];
  }
  for (const connection of project.wires) connection.controlPoints ??= [];
  if (project.settings.theme === ('dark' as Theme)) project.settings.theme = 'night';
  if (project.settings.theme === ('light' as Theme)) project.settings.theme = 'morning';
  return project;
}
