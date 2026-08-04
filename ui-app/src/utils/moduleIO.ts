import type { BitWireProject, ComponentInstance, ModuleArea, SavedModule, Wire } from '../model/types';
import { uid } from '../state/project';

const LIBRARY_KEY = 'bitwire:module-library:v1';
const MODULE_ENDPOINT = '__module__';

export function loadModuleLibrary(): SavedModule[] {
  try {
    const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as SavedModule[];
    return value.filter(item => item.format === 'bitwire-module' && item.version === 1);
  } catch { return []; }
}

export function buildSavedModule(project: BitWireProject, module: ModuleArea): SavedModule {
  const descendants: ModuleArea[] = [];
  const collect = (parentId: string) => project.modules.filter(item => item.parentModuleId === parentId).forEach(item => { descendants.push(item); collect(item.id); });
  collect(module.id);
  const moduleIds = new Set([module.id, ...descendants.map(item => item.id)]);
  const members = new Set([module, ...descendants].flatMap(item => item.memberIds));
  const components = project.components.filter(item => members.has(item.id)).map(item => ({
    ...structuredClone(item), x: item.x - module.x, y: item.y - module.y,
  }));
  const wires = project.wires.filter(wire =>
    (members.has(wire.from.componentId) || moduleIds.has(wire.from.componentId))
    && (members.has(wire.to.componentId) || moduleIds.has(wire.to.componentId)))
    .map(wire => {
      const copy = structuredClone(wire);
      if (copy.from.componentId === module.id) copy.from.componentId = MODULE_ENDPOINT;
      if (copy.to.componentId === module.id) copy.to.componentId = MODULE_ENDPOINT;
      copy.controlPoints = copy.controlPoints?.map(point => ({ x: point.x - module.x, y: point.y - module.y }));
      return copy;
    });
  const modules = descendants.map(item => ({
    ...structuredClone(item), x: item.x - module.x, y: item.y - module.y,
    parentModuleId: item.parentModuleId === module.id ? MODULE_ENDPOINT : item.parentModuleId,
  }));
  return {
    format: 'bitwire-module', version: 1, id: uid('library'), name: module.name,
    description: module.description ?? '', width: module.width, height: module.height,
    color: module.color, pins: structuredClone(module.pins), components, wires, modules,
    savedAt: new Date().toISOString(),
  };
}

export function saveModuleToLibrary(project: BitWireProject, module: ModuleArea): SavedModule[] {
  const saved = buildSavedModule(project, module);
  const library = [saved, ...loadModuleLibrary().filter(item => item.name !== saved.name)].slice(0, 60);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  return library;
}

export function deleteSavedModule(id: string): SavedModule[] {
  const library = loadModuleLibrary().filter(item => item.id !== id);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  return library;
}

export function insertSavedModule(project: BitWireProject, saved: SavedModule, x: number, y: number, parentModuleId?: string): ModuleArea {
  const moduleId = uid('module');
  const idMap = new Map<string, string>();
  idMap.set(MODULE_ENDPOINT, moduleId);
  for (const nested of saved.modules ?? []) idMap.set(nested.id, uid('module'));
  const components: ComponentInstance[] = saved.components.map(component => {
    const id = uid('node'); idMap.set(component.id, id);
    return { ...structuredClone(component), id, x: x + component.x, y: y + component.y };
  });
  const wires: Wire[] = saved.wires.map(wire => ({
    ...structuredClone(wire), id: uid('wire'),
    from: { ...wire.from, componentId: idMap.get(wire.from.componentId) ?? wire.from.componentId },
    to: { ...wire.to, componentId: idMap.get(wire.to.componentId) ?? wire.to.componentId },
    controlPoints: wire.controlPoints?.map(point => ({ x: point.x + x, y: point.y + y })),
  }));
  const module: ModuleArea = {
    id: moduleId, name: saved.name, description: saved.description,
    x, y, width: saved.width, height: saved.height, color: saved.color,
    memberIds: components.map(item => item.id), enabled: true, collapsed: true,
    pins: structuredClone(saved.pins), parentModuleId,
  };
  const nestedModules = (saved.modules ?? []).map(nested => ({
    ...structuredClone(nested), id: idMap.get(nested.id)!,
    x: x + nested.x, y: y + nested.y,
    parentModuleId: nested.parentModuleId === MODULE_ENDPOINT ? moduleId : nested.parentModuleId ? idMap.get(nested.parentModuleId) : moduleId,
    memberIds: nested.memberIds.map(id => idMap.get(id) ?? id),
  }));
  project.components.push(...components);
  project.wires.push(...wires);
  project.modules.push(module, ...nestedModules);
  return module;
}

export function exportModule(project: BitWireProject, module: ModuleArea): void {
  const saved = buildSavedModule(project, module);
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/vnd.bitwire-module+json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${module.name.toLocaleLowerCase('es').replace(/[^a-z0-9áéíóúñ]+/gi, '-') || 'encapsulado'}.bitwire-module`;
  anchor.click(); URL.revokeObjectURL(url);
}

export async function importModule(file: File): Promise<SavedModule> {
  if (file.size > 20_000_000) throw new Error('El encapsulado supera el límite de 20 MB.');
  const value = JSON.parse(await file.text()) as SavedModule;
  if (value.format !== 'bitwire-module' || value.version !== 1 || !Array.isArray(value.components) || !Array.isArray(value.pins)) {
    throw new Error('El archivo no contiene un encapsulado BitWire compatible.');
  }
  const library = [value, ...loadModuleLibrary().filter(item => item.id !== value.id)].slice(0, 60);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  return value;
}
