import { CATALOG_BY_ID } from '../catalog/catalog';
import type { BitWireProject, ComponentInstance } from './types';

/** Stable, readable identity for every placed component. */
export function componentDisplayName(project:BitWireProject,component:ComponentInstance) {
  const custom=String(component.name??component.properties.instrumentName??'').trim();
  if(custom)return custom;
  const definition=CATALOG_BY_ID.get(component.definitionId);
  const siblings=project.components.filter(item=>item.definitionId===component.definitionId);
  const index=Math.max(0,siblings.findIndex(item=>item.id===component.id))+1;
  return `${definition?.name??'Elemento'} ${index}`;
}
