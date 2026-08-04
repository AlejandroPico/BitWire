import { describe, expect, it } from 'vitest';
import { createBlankProject, createDemoProject } from '../state/project';
import { buildSavedModule, insertSavedModule } from './moduleIO';

describe('reusable hierarchical encapsulations', () => {
  it('preserves nested canvases when saved and inserted', () => {
    const source=createDemoProject();
    const root=source.modules.find(module=>module.id==='module_logic')!;
    const saved=buildSavedModule(source,root);
    expect(saved.modules).toHaveLength(1);
    expect(saved.modules?.[0].name).toBe('Núcleo lógico AND');

    const destination=createBlankProject('Import target');
    destination.modules.push({id:'host',name:'Host',x:0,y:0,width:900,height:500,color:'#fff',memberIds:[],enabled:true,collapsed:false,pins:[]});
    const inserted=insertSavedModule(destination,saved,100,80,'host');
    const child=destination.modules.find(module=>module.parentModuleId===inserted.id);

    expect(inserted.parentModuleId).toBe('host');
    expect(child?.name).toBe('Núcleo lógico AND');
    expect(destination.wires.some(wire=>wire.from.componentId===child?.id||wire.to.componentId===child?.id)).toBe(true);
  });
});
