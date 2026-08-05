import { describe, expect, it } from 'vitest';
import { createBlankProject, createInstance } from '../state/project';
import type { ModuleArea, ModulePin } from './types';
import { canvasScope, redistributeModulePins, respectsModuleBoundaries } from './moduleScope';

const moduleArea = (id:string, memberIds:string[], parentModuleId?:string):ModuleArea => ({
  id,name:id,x:0,y:0,width:400,height:240,color:'#2be4c4',memberIds,parentModuleId,
  enabled:true,collapsed:false,pins:[{id:'io',name:'IO',kind:'BIDIRECTIONAL',domain:'MIXED',side:'left',position:.5}],
});

describe('fronteras jerárquicas de los encapsulados', () => {
  it('muestra en cada lienzo solo sus componentes directos', () => {
    const project=createBlankProject();
    project.components.push(createInstance('resistor',0,0,'root'),createInstance('resistor',0,0,'inside'),createInstance('resistor',0,0,'nested'));
    project.modules.push(moduleArea('outer',['inside','nested']),moduleArea('inner',['nested'],'outer'));
    expect(canvasScope(project).components.map(item=>item.id)).toEqual(['root']);
    expect(canvasScope(project).modules.map(item=>item.id)).toEqual(['outer']);
    expect(canvasScope(project,'outer').components.map(item=>item.id)).toEqual(['inside']);
    expect(canvasScope(project,'outer').modules.map(item=>item.id)).toEqual(['inner']);
    expect(canvasScope(project,'inner').components.map(item=>item.id)).toEqual(['nested']);
  });

  it('impide conexiones que atraviesan una frontera sin usar la patilla', () => {
    const project=createBlankProject();
    project.components.push(createInstance('dc_source',0,0,'outside'),createInstance('resistor',0,0,'inside'));
    project.modules.push(moduleArea('box',['inside']));
    const illegal={id:'illegal',from:{componentId:'outside',pinId:'pos'},to:{componentId:'inside',pinId:'a'},routing:'straight' as const};
    const outside={id:'outside-wire',from:{componentId:'outside',pinId:'pos'},to:{componentId:'box',pinId:'io'},routing:'straight' as const};
    const inside={id:'inside-wire',from:{componentId:'box',pinId:'io'},to:{componentId:'inside',pinId:'a'},routing:'straight' as const};
    expect(respectsModuleBoundaries(project,illegal)).toBe(false);
    expect(respectsModuleBoundaries(project,outside)).toBe(true);
    expect(respectsModuleBoundaries(project,inside)).toBe(true);
  });

  it('reparte las patillas equidistantemente por cada lado', () => {
    const pins:ModulePin[]=[.8,.1,.5].map((position,index)=>({id:String(index),name:String(index),kind:'INPUT',domain:'DIGITAL',side:'left',position}));
    const distributed=redistributeModulePins(pins,['left']).filter(pin=>pin.side==='left').sort((a,b)=>a.position-b.position);
    expect(distributed.map(pin=>pin.position)).toEqual([.25,.5,.75]);
    expect(redistributeModulePins([pins[0]],['left'])[0].position).toBe(.5);
  });
});
