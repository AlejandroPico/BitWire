import { describe,expect,it } from 'vitest';
import { createBlankProject,createInstance,duplicateComponents } from '../state/project';
import { componentDisplayName } from './componentIdentity';

describe('component identities',()=>{
  it('numbers equal components and respects a user-authored name',()=>{
    const project=createBlankProject();
    const first=createInstance('resistor',0,0,'r1'),second=createInstance('resistor',0,0,'r2');
    project.components.push(first,second);
    expect(componentDisplayName(project,first)).toBe('Resistencia 1');
    expect(componentDisplayName(project,second)).toBe('Resistencia 2');
    second.name='Resistencia de realimentación';
    expect(componentDisplayName(project,second)).toBe('Resistencia de realimentación');
  });

  it('marks a duplicate of a named element without creating an ambiguous identity',()=>{
    const project=createBlankProject();
    const source=createInstance('capacitor',0,0,'c1');source.name='Condensador de tanque';project.components.push(source);
    const [copyId]=duplicateComponents(project,['c1'],()=> 'c2');
    expect(project.components.find(item=>item.id===copyId)?.name).toBe('Condensador de tanque · copia');
  });
});
