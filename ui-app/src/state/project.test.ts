import { describe,expect,it } from 'vitest';
import { createBlankProject,createDemoProject,duplicateComponents,validateProject } from './project';

describe('project state helpers',()=>{
  it('enables current animation by default and migrates older projects',()=>{
    expect(createBlankProject().settings.animateCurrent).toBe(true);
    const legacy=structuredClone(createBlankProject()) as any;
    delete legacy.settings.animateCurrent;
    expect(validateProject(legacy).settings.animateCurrent).toBe(true);
  });

  it('duplicates a component inside its current encapsulation',()=>{
    const project=createDemoProject();
    let counter=0;
    const [duplicateId]=duplicateComponents(project,['gate_main'],prefix=>`${prefix}_copy_${counter++}`);
    expect(project.modules.find(module=>module.id==='module_gate_core')?.memberIds).toContain(duplicateId);
    expect(project.components.find(component=>component.id===duplicateId)?.x).toBe(-140);
  });

  it('keeps a root-level duplicate at the root',()=>{
    const project=createDemoProject();
    const [duplicateId]=duplicateComponents(project,['ground_main'],prefix=>`${prefix}_root_copy`);
    expect(project.modules.every(module=>!module.memberIds.includes(duplicateId))).toBe(true);
  });
});
