import { describe, expect, it } from 'vitest';
import { captureInstrument, instrumentComponents, instrumentDisplayName, spectrumBins } from './instrumentData';
import { createBlankProject, createInstance } from '../state/project';
import type { SimulationSnapshot, Wire } from '../model/types';

const wire = (id:string,componentId:string,pinId:string,sourceId:string):Wire => ({
  id, from:{componentId:sourceId,pinId:'out'}, to:{componentId,pinId}, routing:'straight',
});
const sample = (time:number,a:number,b:number):SimulationSnapshot => ({
  time,tick:Math.round(time*100),warnings:[],componentSignals:{},wireSignals:{
    wa:{voltage:a,current:.01,logic:a>2?1:0,active:true},
    wb:{voltage:b,current:.02,logic:b>2?1:0,active:true},
  },
});

describe('captura individual de instrumentos',() => {
  it('separa los canales de dos osciloscopios conectados a redes distintas',() => {
    const project=createBlankProject();
    const scopeA=createInstance('oscilloscope',0,0,'scope_a');
    const scopeB=createInstance('oscilloscope',0,0,'scope_b');
    project.components.push(scopeA,scopeB);
    project.wires.push(wire('wa','scope_a','ch1','source_a'),wire('wb','scope_b','ch1','source_b'));
    const samples=[sample(0,1,4),sample(.01,2,5)];
    expect(captureInstrument(project,scopeA,samples).voltage).toBe(2);
    expect(captureInstrument(project,scopeB,samples).voltage).toBe(5);
  });

  it('calcula la medida diferencial del multímetro',() => {
    const project=createBlankProject();
    const meter=createInstance('multimeter',0,0,'meter');
    project.components.push(meter);
    project.wires.push(wire('wa','meter','plus','source_a'),wire('wb','meter','minus','source_b'));
    expect(captureInstrument(project,meter,[sample(0,5,1)]).voltage).toBe(4);
  });

  it('genera un espectro normalizado',() => {
    const bins=spectrumBins(Array.from({length:64},(_,i)=>Math.sin(i*Math.PI/4)),16);
    expect(Math.max(...bins)).toBeCloseTo(1);
  });

  it('identifica por separado cada aparato colocado',() => {
    const project=createBlankProject();
    const scopeA=createInstance('oscilloscope',0,0,'scope_a');
    const meter=createInstance('multimeter',0,0,'meter_a');
    const scopeB=createInstance('oscilloscope',0,0,'scope_b');
    project.components.push(scopeA,meter,scopeB,createInstance('resistor',0,0,'resistor'));
    expect(instrumentComponents(project).map(item=>item.id)).toEqual(['scope_a','meter_a','scope_b']);
    expect(instrumentDisplayName(project,scopeA)).toBe('Osciloscopio 1');
    expect(instrumentDisplayName(project,scopeB)).toBe('Osciloscopio 2');
    expect(instrumentDisplayName(project,meter)).toBe('Multímetro 1');
    scopeB.name='Osciloscopio de salida';
    expect(instrumentDisplayName(project,scopeB)).toBe('Osciloscopio de salida');
  });

  it('incluye todas las sondas como instrumentos vinculables',()=>{
    const project=createBlankProject();
    project.components.push(createInstance('probe',0,0,'probe'),createInstance('test_point',0,0,'test'));
    expect(instrumentComponents(project).map(item=>item.id)).toEqual(['probe','test']);
  });

  it('mide un componente vinculado sin añadir un cable al instrumento',()=>{
    const project=createBlankProject();
    const resistor=createInstance('resistor',0,0,'load');
    const scope=createInstance('oscilloscope',300,0,'scope');
    scope.properties.linkedComponentId='load';
    scope.properties.linkedPinId='a';
    project.components.push(resistor,scope);
    const samples:SimulationSnapshot[]=[1,3].map((voltage,index)=>({
      time:index*.01,tick:index,warnings:[],wireSignals:{},componentSignals:{
        load:{active:true,power:.03,outputs:{},inputs:{
          a:{voltage,current:.01,logic:voltage>2.5?1:0,active:true},
          b:{voltage:0,current:-.01,logic:0,active:true},
        }},
      },
    }));
    const capture=captureInstrument(project,scope,samples);
    expect(project.wires).toHaveLength(0);
    expect(capture.voltage).toBe(3);
    expect(capture.current).toBe(.01);
    expect(capture.pins[0].wireLabel).toContain('Vínculo interno');
  });
});
