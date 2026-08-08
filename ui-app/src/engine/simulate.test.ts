import { describe, expect, it } from 'vitest';
import { createBlankProject, createDemoProject, createInstance } from '../state/project';
import { createSimulationState, evaluateCircuit } from './simulate';

describe('BitWire simulation core', () => {
  it('propagates the electrical demo voltage through the closed switch', () => {
    const project = createDemoProject();
    const snapshot = evaluateCircuit(project, 0, 1);
    expect(snapshot.wireSignals.w_power.voltage).toBe(5);
    expect(snapshot.wireSignals.w_load.active).toBe(true);
    expect(snapshot.wireSignals.w_return.active).toBe(true);
    expect(snapshot.wireSignals.w_ground.active).toBe(true);
    // The parallel earth symbol is equipotential but carries no branch current.
    expect(snapshot.wireSignals.w_ground_external.active).toBe(false);
    expect(snapshot.wireSignals.w_return.current).toBeGreaterThan(0);
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
    expect(snapshot.wireSignals.w_return.active).toBe(false);
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
      pins:[{id:'vin',name:'VIN',kind:'POWER',domain:'POWER',side:'left',position:.35,nominalVoltage:5},{id:'gnd',name:'GND',kind:'GND',domain:'POWER',side:'left',position:.7,nominalVoltage:0}],
    });
    project.wires.push(
      {id:'outside',from:{componentId:'source',pinId:'pos'},to:{componentId:'module',pinId:'vin'},routing:'orthogonal'},
      {id:'boundary',from:{componentId:'module',pinId:'vin'},to:{componentId:'inside_resistor',pinId:'a'},routing:'orthogonal'},
      {id:'inside',from:{componentId:'inside_resistor',pinId:'b'},to:{componentId:'inside_lamp',pinId:'a'},routing:'orthogonal'},
      {id:'return_inside',from:{componentId:'inside_lamp',pinId:'b'},to:{componentId:'module',pinId:'gnd'},routing:'orthogonal'},
      {id:'return_outside',from:{componentId:'module',pinId:'gnd'},to:{componentId:'source',pinId:'neg'},routing:'orthogonal'},
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

  it('solves Ohm law and a two-resistor divider numerically',()=>{
    const project=createBlankProject('Ohm and Kirchhoff');
    const source=createInstance('dc_source',0,0,'source');source.properties.voltage=10;
    const r1=createInstance('resistor',0,0,'r1');r1.properties.resistance=100;
    const r2=createInstance('resistor',0,0,'r2');r2.properties.resistance=100;
    project.components.push(source,r1,r2);
    project.wires.push(
      {id:'supply',from:{componentId:'source',pinId:'pos'},to:{componentId:'r1',pinId:'a'},routing:'straight'},
      {id:'middle',from:{componentId:'r1',pinId:'b'},to:{componentId:'r2',pinId:'a'},routing:'straight'},
      {id:'return',from:{componentId:'r2',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
    );
    const snapshot=evaluateCircuit(project);
    expect(snapshot.wireSignals.middle.voltage).toBeCloseTo(5,6);
    expect(snapshot.wireSignals.supply.current).toBeCloseTo(.05,6);
    expect(snapshot.wireSignals.return.current).toBeCloseTo(.05,6);
  });

  it('splits current across parallel branches according to resistance',()=>{
    const project=createBlankProject('Parallel branches');
    const source=createInstance('dc_source',0,0,'source');source.properties.voltage=10;
    const r100=createInstance('resistor',0,0,'r100');r100.properties.resistance=100;
    const r200=createInstance('resistor',0,0,'r200');r200.properties.resistance=200;
    project.components.push(source,r100,r200);
    project.wires.push(
      {id:'branch100',from:{componentId:'source',pinId:'pos'},to:{componentId:'r100',pinId:'a'},routing:'straight'},
      {id:'branch200',from:{componentId:'source',pinId:'pos'},to:{componentId:'r200',pinId:'a'},routing:'straight'},
      {id:'return100',from:{componentId:'r100',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
      {id:'return200',from:{componentId:'r200',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
    );
    const snapshot=evaluateCircuit(project);
    expect(Math.abs(snapshot.wireSignals.branch100.current)).toBeCloseTo(.1,6);
    expect(Math.abs(snapshot.wireSignals.branch200.current)).toBeCloseTo(.05,6);
  });

  it('reverses signed current during the negative AC half-cycle',()=>{
    const project=createBlankProject('AC direction');
    const source=createInstance('ac_source',0,0,'source');source.properties.voltage=10;source.properties.frequency=50;
    const load=createInstance('resistor',0,0,'load');load.properties.resistance=100;
    project.components.push(source,load);
    project.wires.push(
      {id:'forward',from:{componentId:'source',pinId:'pos'},to:{componentId:'load',pinId:'a'},routing:'straight'},
      {id:'return',from:{componentId:'load',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
    );
    expect(evaluateCircuit(project,.005).wireSignals.forward.current).toBeCloseTo(.1,5);
    expect(evaluateCircuit(project,.015).wireSignals.forward.current).toBeCloseTo(-.1,5);
  });

  it('integrates a capacitor with a persistent transient state',()=>{
    const project=createBlankProject('RC transient');
    const source=createInstance('dc_source',0,0,'source');source.properties.voltage=5;
    const resistor=createInstance('resistor',0,0,'r');resistor.properties.resistance=1000;
    const capacitor=createInstance('capacitor',0,0,'c');capacitor.properties.capacitance=1e-6;
    project.components.push(source,resistor,capacitor);
    project.wires.push(
      {id:'supply',from:{componentId:'source',pinId:'pos'},to:{componentId:'r',pinId:'a'},routing:'straight'},
      {id:'charge',from:{componentId:'r',pinId:'b'},to:{componentId:'c',pinId:'a'},routing:'straight'},
      {id:'return',from:{componentId:'c',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
    );
    const state=createSimulationState();
    const first=evaluateCircuit(project,.0001,1,state).wireSignals.charge.voltage;
    const second=evaluateCircuit(project,.0002,2,state).wireSignals.charge.voltage;
    expect(first).toBeGreaterThan(0);expect(second).toBeGreaterThan(first);expect(second).toBeLessThan(5);
  });

  it('resolves every output of a ten-input configurable logic gate',()=>{
    const project=createBlankProject('Large gate');
    const gate=createInstance('gate_and',300,0,'gate');
    gate.properties.inputCount=10;gate.properties.outputCount=10;
    project.components.push(gate);
    for(let index=0;index<10;index++){
      const input=createInstance('logic_input',0,index*40,`source_${index}`);
      project.components.push(input);
      const pin=index===0?'a':index===1?'b':index===2?'c':`in${index+1}`;
      project.wires.push({id:`wire_${index}`,from:{componentId:input.id,pinId:'out'},to:{componentId:'gate',pinId:pin},routing:'straight'});
    }
    const signal=evaluateCircuit(project).componentSignals.gate;
    expect(Object.keys(signal.outputs)).toHaveLength(10);
    expect(Object.values(signal.outputs).every(output=>output.logic===1)).toBe(true);
    project.components.find(component=>component.id==='source_9')!.properties.state=0;
    expect(Object.values(evaluateCircuit(project).componentSignals.gate.outputs).every(output=>output.logic===0)).toBe(true);
  });

  it('uses a promoted wire node as a real electrical junction',()=>{
    const project=createBlankProject('Connectable junction');
    const source=createInstance('dc_source',0,0,'source');source.properties.voltage=10;
    const node=createInstance('junction',0,0,'node');
    const r1=createInstance('resistor',0,0,'r1');r1.properties.resistance=100;
    const r2=createInstance('resistor',0,0,'r2');r2.properties.resistance=200;
    project.components.push(source,node,r1,r2);
    project.wires.push(
      {id:'feed',from:{componentId:'source',pinId:'pos'},to:{componentId:'node',pinId:'node'},routing:'straight'},
      {id:'branch1',from:{componentId:'node',pinId:'node'},to:{componentId:'r1',pinId:'a'},routing:'straight'},
      {id:'branch2',from:{componentId:'node',pinId:'node'},to:{componentId:'r2',pinId:'a'},routing:'straight'},
      {id:'return1',from:{componentId:'r1',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
      {id:'return2',from:{componentId:'r2',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
    );
    const snapshot=evaluateCircuit(project);
    expect(snapshot.wireSignals.feed.current).toBeCloseTo(.15,6);
    expect(snapshot.wireSignals.branch1.current).toBeCloseTo(.1,6);
    expect(snapshot.wireSignals.branch2.current).toBeCloseTo(.05,6);
  });

  it('warns when solved current or power exceeds configured ratings',()=>{
    const project=createBlankProject('Electrical ratings');
    const source=createInstance('dc_source',0,0,'source');source.properties.voltage=10;source.properties.currentLimit=.05;
    const resistor=createInstance('resistor',0,0,'resistor');resistor.properties.resistance=100;resistor.properties.powerRating=.5;
    project.components.push(source,resistor);
    project.wires.push(
      {id:'feed',from:{componentId:'source',pinId:'pos'},to:{componentId:'resistor',pinId:'a'},routing:'straight'},
      {id:'return',from:{componentId:'resistor',pinId:'b'},to:{componentId:'source',pinId:'neg'},routing:'straight'},
    );
    const warnings=evaluateCircuit(project).warnings.join(' ');
    expect(warnings).toContain('potencia nominal');
    expect(warnings).toContain('límite');
  });
});
