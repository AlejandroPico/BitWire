import { describe, expect, it } from 'vitest';
import { createBlankProject, createDemoProject, createInstance } from '../state/project';
import { evaluateCircuit } from './simulate';

describe('BitWire simulation core', () => {
  it('propagates the electrical demo voltage through the closed switch', () => {
    const project = createDemoProject();
    const snapshot = evaluateCircuit(project, 0, 1);
    expect(snapshot.wireSignals.w_power.voltage).toBe(5);
    expect(snapshot.wireSignals.w_load.active).toBe(true);
  });

  it('evaluates the AND gate deterministically', () => {
    const project = createDemoProject();
    const snapshot = evaluateCircuit(project, 0, 1);
    expect(snapshot.wireSignals.w_gate_out.logic).toBe(1);
  });

  it('blocks a circuit when its switch is open', () => {
    const project = createDemoProject();
    const switchNode = project.components.find(node => node.id === 'switch_main')!;
    switchNode.properties.closed = false;
    const snapshot = evaluateCircuit(project, 0, 1);
    expect(snapshot.wireSignals.w_load.active).toBe(false);
  });

  it('passes a signal through an encapsulation boundary pin', () => {
    const project = createBlankProject('Boundary test');
    project.components.push(
      createInstance('dc_source',0,0,'source'),
      createInstance('resistor',300,0,'inside_resistor'),
      createInstance('lamp',520,0,'inside_lamp'),
    );
    project.modules.push({
      id:'module',name:'Chip',x:240,y:-80,width:500,height:220,color:'#2be4c4',
      memberIds:['inside_resistor','inside_lamp'],enabled:true,collapsed:true,
      pins:[{id:'vin',name:'VIN',kind:'POWER',domain:'POWER',side:'left',position:.5,nominalVoltage:5}],
    });
    project.wires.push(
      {id:'outside',from:{componentId:'source',pinId:'pos'},to:{componentId:'module',pinId:'vin'},routing:'orthogonal'},
      {id:'boundary',from:{componentId:'module',pinId:'vin'},to:{componentId:'inside_resistor',pinId:'a'},routing:'orthogonal'},
      {id:'inside',from:{componentId:'inside_resistor',pinId:'b'},to:{componentId:'inside_lamp',pinId:'a'},routing:'orthogonal'},
    );
    const snapshot=evaluateCircuit(project,0,1);
    expect(snapshot.wireSignals.boundary.voltage).toBe(5);
    expect(snapshot.wireSignals.inside.active).toBe(true);
  });

  it('evaluates every input of a three-input gate', () => {
    const project=createBlankProject('Three input gate');
    project.components.push(createInstance('logic_input',0,0,'a'),createInstance('logic_input',0,100,'b'),createInstance('logic_input',0,200,'c'),createInstance('gate_and_3',300,100,'gate'));
    project.wires.push(
      {id:'a',from:{componentId:'a',pinId:'out'},to:{componentId:'gate',pinId:'a'},routing:'straight'},
      {id:'b',from:{componentId:'b',pinId:'out'},to:{componentId:'gate',pinId:'b'},routing:'straight'},
      {id:'c',from:{componentId:'c',pinId:'out'},to:{componentId:'gate',pinId:'c'},routing:'straight'},
    );
    expect(evaluateCircuit(project).componentSignals.gate.outputs.out.logic).toBe(1);
    project.components.find(item=>item.id==='c')!.properties.state=0;
    expect(evaluateCircuit(project).componentSignals.gate.outputs.out.logic).toBe(0);
  });

  it('exposes the resolved inputs of LED displays to their visual model',()=>{
    const project=createBlankProject('Display inputs');
    const sourceA=createInstance('logic_input',0,0,'source_a');
    const sourceB=createInstance('logic_input',0,100,'source_b');
    sourceB.properties.state=0;
    project.components.push(sourceA,sourceB,createInstance('seven_segment',300,0,'display'));
    project.wires.push(
      {id:'segment_a',from:{componentId:'source_a',pinId:'out'},to:{componentId:'display',pinId:'a'},routing:'straight'},
      {id:'segment_b',from:{componentId:'source_b',pinId:'out'},to:{componentId:'display',pinId:'b'},routing:'straight'},
    );
    const display=evaluateCircuit(project).componentSignals.display;
    expect(display.inputs?.a.logic).toBe(1);
    expect(display.inputs?.b.logic).toBe(0);
    expect(display.active).toBe(true);
  });
});
