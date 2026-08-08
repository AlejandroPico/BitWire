import type { BitWireProject, ModuleArea, ModulePin, ModulePinSide, Wire } from './types';

const ROOT_SCOPE = '__bitwire_root__';

export interface CanvasScope {
  components: BitWireProject['components'];
  modules: ModuleArea[];
  wires: Wire[];
}

function moduleDepth(module: ModuleArea, modules: ModuleArea[]): number {
  let depth = 0;
  let cursor = module;
  const visited = new Set<string>();
  while (cursor.parentModuleId && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const parent = modules.find(item => item.id === cursor.parentModuleId);
    if (!parent) break;
    cursor = parent;
    depth += 1;
  }
  return depth;
}

export function componentOwnerModuleId(project: BitWireProject, componentId: string): string | undefined {
  return project.modules
    .filter(module => module.memberIds.includes(componentId))
    .sort((left, right) => moduleDepth(right, project.modules) - moduleDepth(left, project.modules))[0]?.id;
}

function endpointScopes(project: BitWireProject, endpointId: string): Set<string> {
  if (project.components.some(component => component.id === endpointId)) {
    return new Set([componentOwnerModuleId(project, endpointId) ?? ROOT_SCOPE]);
  }
  const module = project.modules.find(item => item.id === endpointId);
  if (!module) return new Set();
  return new Set([module.parentModuleId ?? ROOT_SCOPE, module.id]);
}

/** A wire is valid only when both endpoints can coexist on at least one canvas. */
export function respectsModuleBoundaries(project: BitWireProject, wire: Wire): boolean {
  const fromScopes = endpointScopes(project, wire.from.componentId);
  const toScopes = endpointScopes(project, wire.to.componentId);
  return [...fromScopes].some(scope => toScopes.has(scope));
}

/** Hierarchical canvas that owns a valid wire; root wires return undefined. */
export function wireOwnerModuleId(project:BitWireProject,wire:Wire):string|undefined {
  const shared=[...endpointScopes(project,wire.from.componentId)].filter(scope=>endpointScopes(project,wire.to.componentId).has(scope));
  return shared.filter(scope=>scope!==ROOT_SCOPE).map(id=>project.modules.find(module=>module.id===id)).filter((module):module is ModuleArea=>Boolean(module)).sort((a,b)=>moduleDepth(b,project.modules)-moduleDepth(a,project.modules))[0]?.id;
}

/** Returns only the objects directly editable at the requested hierarchy level. */
export function canvasScope(project: BitWireProject, activeModuleId?: string): CanvasScope {
  const modules = project.modules.filter(module => module.parentModuleId === activeModuleId);
  const childMemberIds = new Set(modules.flatMap(module => module.memberIds));
  const activeModule = activeModuleId ? project.modules.find(module => module.id === activeModuleId) : undefined;
  const allowedMembers = activeModule ? new Set(activeModule.memberIds) : undefined;
  const components = project.components.filter(component =>
    (!allowedMembers || allowedMembers.has(component.id)) && !childMemberIds.has(component.id));
  const endpointIds = new Set([
    ...components.map(component => component.id),
    ...modules.map(module => module.id),
    ...(activeModule ? [activeModule.id] : []),
  ]);
  const wires = project.wires.filter(wire =>
    respectsModuleBoundaries(project, wire)
    && endpointIds.has(wire.from.componentId)
    && endpointIds.has(wire.to.componentId));
  return { components, modules, wires };
}

export function redistributeModulePins(pins: ModulePin[], sides?: ModulePinSide[]): ModulePin[] {
  const targetSides = new Set(sides ?? ['left', 'right', 'top', 'bottom']);
  const result = pins.map(pin => ({ ...pin }));
  for (const side of targetSides) {
    const sidePins = result
      .map((pin, index) => ({ pin, index }))
      .filter(item => item.pin.side === side)
      .sort((left, right) => left.pin.position - right.pin.position || left.index - right.index);
    sidePins.forEach(({ pin }, index) => { pin.position = (index + 1) / (sidePins.length + 1); });
  }
  return result;
}

export function descendantModules(project: BitWireProject, rootId: string): ModuleArea[] {
  const result: ModuleArea[] = [];
  const queue = [rootId];
  const visited = new Set<string>();
  while (queue.length) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);
    for (const module of project.modules.filter(item => item.parentModuleId === parentId)) {
      result.push(module);
      queue.push(module.id);
    }
  }
  return result;
}
