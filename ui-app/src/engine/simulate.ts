import { CATALOG_BY_ID, effectiveDefinition } from '../catalog/catalog';
import { respectsModuleBoundaries } from '../model/moduleScope';
import type {
  BitWireProject, ComponentInstance, ComponentSignal, LogicValue, PinDefinition,
  SimulationSnapshot, Wire, WireSignal,
} from '../model/types';
import { EMPTY_SIGNAL } from '../model/types';
import { formatSI } from '../utils/si';

const EPSILON_CURRENT=1e-9;
const LOGIC_MODELS=new Set(['and','or','not','nand','nor','xor','xnor']);
const RAIL_MODELS=new Set(['rail_dc','rail_ac','rail_square','rail_sweep','rail_noise']);
const SUPPORTED_MODELS=new Set([
  'source_dc','source_ac','current_source','ground','resistor','potentiometer','capacitor','inductor',
  'switch','analog_switch','fuse','connector','lamp','motor','speaker','buzzer','diode','zener','led',
  'nmos','pmos','bjt_npn','bjt_pnp','opamp','comparator','logic_input','clock','mux','instrument','probe',
  'seven_segment','seven_segment_decoder','display','demux','vcvs','vccs',...RAIL_MODELS,...LOGIC_MODELS,
]);

export interface SimulationState {
  lastTime:number;
  lastDt:number;
  capacitors:Record<string,number>;
  inductors:Record<string,number>;
}

export function createSimulationState():SimulationState {
  return {lastTime:0,lastDt:1/60,capacitors:{},inductors:{}};
}

const cloneSignal=(signal:Partial<WireSignal>={}):WireSignal=>({...EMPTY_SIGNAL,...signal});
const keyOf=(componentId:string,pinId:string)=>`${componentId}:${pinId}`;

class UnionFind {
  private parents=new Map<string,string>();
  add(value:string){if(!this.parents.has(value))this.parents.set(value,value);}
  find(value:string):string{this.add(value);const parent=this.parents.get(value)!;if(parent===value)return value;const root=this.find(parent);this.parents.set(value,root);return root;}
  union(a:string,b:string){const left=this.find(a),right=this.find(b);if(left!==right)this.parents.set(right,left);}
  values(){return [...this.parents.keys()];}
}

interface NetworkContext {
  union:UnionFind;
  validWires:Wire[];
  invalidWires:Wire[];
  referenceRoot:string;
  roots:string[];
  pinsByComponent:Map<string,PinDefinition[]>;
}

interface DigitalDriver { logic:LogicValue; voltage:number; endpoint:string }
interface Branch { componentId:string; a:string; b:string; current:number }
interface SolveResult { voltages:Map<string,number>; sourceCurrents:Map<string,number>; warnings:string[] }

export function evaluateCircuit(project:BitWireProject,time=0,tick=0,state?:SimulationState):SimulationSnapshot {
  const runtime=state??createSimulationState();
  const elapsed=time-runtime.lastTime;
  const dt=Math.max(1e-9,elapsed>0?elapsed:runtime.lastDt);
  const network=buildNetwork(project);
  const digital=resolveDigital(project,network,time);
  const solved=solveElectrical(project,network,digital,time,dt,runtime);
  const branches=calculateBranches(project,network,digital,solved,time,dt,runtime);
  const endpointCurrents=branchInjections(branches,project,network);
  const wireCurrents=solveWireCurrents(network.validWires,endpointCurrents);
  const componentSignals=buildComponentSignals(project,network,digital,solved,branches,endpointCurrents);
  const wireSignals:Record<string,WireSignal>={};

  for(const wire of network.invalidWires)wireSignals[wire.id]=cloneSignal();
  for(const wire of network.validWires){
    const root=network.union.find(keyOf(wire.from.componentId,wire.from.pinId));
    const voltage=solved.voltages.get(root)??0;
    const current=wireCurrents.get(wire.id)??0;
    const driver=digital.get(root);
    const logic=driver?.logic??logicFromVoltage(voltage);
    const floating=!driver&&!Number.isFinite(solved.voltages.get(root));
    wireSignals[wire.id]=cloneSignal({
      voltage,current,logic,floating,
      active:Math.abs(current)>EPSILON_CURRENT||driver?.logic===1,
    });
  }

  for(const component of project.components){
    const definition=CATALOG_BY_ID.get(component.definitionId);
    if(!definition||definition.model!=='capacitor')continue;
    const pins=network.pinsByComponent.get(component.id)??definition.pins;
    const [a,b]=pins;
    if(a&&b)runtime.capacitors[component.id]=voltageBetween(solved,network,component.id,a.id,b.id);
  }
  for(const branch of branches){
    const definition=CATALOG_BY_ID.get(project.components.find(item=>item.id===branch.componentId)?.definitionId??'');
    if(definition?.model==='inductor')runtime.inductors[branch.componentId]=branch.current;
  }
  runtime.lastTime=time;if(elapsed>0)runtime.lastDt=dt;

  const warnings=[
    ...network.invalidWires.map(wire=>`Cable ${wire.label??wire.id} aislado: atraviesa un encapsulado sin patilla`),
    ...solved.warnings,
    ...electricalLimitWarnings(project,componentSignals,branches),
  ];
  return {tick,time,wireSignals,componentSignals,warnings:[...new Set(warnings)].slice(0,8)};
}

function electricalLimitWarnings(project:BitWireProject,signals:Record<string,ComponentSignal>,branches:Branch[]){
  const warnings:string[]=[];
  for(const component of project.components){
    const definition=CATALOG_BY_ID.get(component.definitionId);if(!definition||!component.enabled)continue;
    const props={...definition.defaults,...component.properties};
    const powerRating=Number(props.powerRating??0),power=signals[component.id]?.power??0;
    if(powerRating>0&&power>powerRating*1.0001)warnings.push(`${definition.name}: ${formatSI(power,'W')} supera su potencia nominal de ${formatSI(powerRating,'W')}`);
    const currentLimit=Number(props.currentLimit??props.currentRating??0);
    const current=Math.max(0,...branches.filter(branch=>branch.componentId===component.id).map(branch=>Math.abs(branch.current)));
    if(currentLimit>0&&current>currentLimit*1.0001)warnings.push(`${definition.name}: ${formatSI(current,'A')} supera su límite de ${formatSI(currentLimit,'A')}`);
  }
  return warnings;
}

function buildNetwork(project:BitWireProject):NetworkContext {
  const union=new UnionFind(),pinsByComponent=new Map<string,PinDefinition[]>();
  for(const component of project.components){
    const base=CATALOG_BY_ID.get(component.definitionId);if(!base)continue;
    const definition=effectiveDefinition(base,component.properties);
    pinsByComponent.set(component.id,definition.pins);
    for(const pin of definition.pins)union.add(keyOf(component.id,pin.id));
  }
  for(const module of project.modules)for(const pin of module.pins)union.add(keyOf(module.id,pin.id));
  const validWires=project.wires.filter(wire=>respectsModuleBoundaries(project,wire));
  const invalidWires=project.wires.filter(wire=>!respectsModuleBoundaries(project,wire));
  for(const wire of validWires)union.union(keyOf(wire.from.componentId,wire.from.pinId),keyOf(wire.to.componentId,wire.to.pinId));
  const groundRoots:string[]=[];
  for(const component of project.components){
    const definition=CATALOG_BY_ID.get(component.definitionId);
    if(definition?.model==='ground')groundRoots.push(union.find(keyOf(component.id,'gnd')));
  }
  let referenceRoot=groundRoots[0];
  if(!referenceRoot){
    const source=project.components.find(component=>['source_dc','source_ac'].includes(CATALOG_BY_ID.get(component.definitionId)?.model??''));
    if(source)referenceRoot=union.find(keyOf(source.id,'neg'));
  }
  if(!referenceRoot&&project.components.some(component=>RAIL_MODELS.has(CATALOG_BY_ID.get(component.definitionId)?.model??''))){union.add('__reference__:gnd');referenceRoot=union.find('__reference__:gnd');}
  referenceRoot??=union.find(union.values()[0]??'__reference__:gnd');
  for(const root of groundRoots)union.union(referenceRoot,root);
  referenceRoot=union.find(referenceRoot);
  const roots=[...new Set(union.values().map(value=>union.find(value)))];
  return {union,validWires,invalidWires,referenceRoot,roots,pinsByComponent};
}

function resolveDigital(project:BitWireProject,network:NetworkContext,time:number) {
  const drivers=new Map<string,DigitalDriver>();
  const drive=(root:string,logic:LogicValue,voltage:number,endpoint:string)=>{
    const previous=drivers.get(root);
    if(previous&&previous.logic!==logic)drivers.set(root,{logic:'X',voltage:0,endpoint});
    else drivers.set(root,{logic,voltage,endpoint});
  };
  for(const component of project.components){
    if(!component.enabled)continue;
    const definition=CATALOG_BY_ID.get(component.definitionId);if(!definition)continue;
    const props={...definition.defaults,...component.properties};
    if(definition.model==='logic_input'){
      const logic=Number(props.state)?1:0,voltage=logic?Number(props.voltageHigh??5):0;
      drive(network.union.find(keyOf(component.id,'out')),logic,voltage,keyOf(component.id,'out'));
    } else if(definition.model==='clock'){
      const frequency=Math.max(.001,Number(props.frequency??1)),duty=Math.max(1,Math.min(99,Number(props.dutyCycle??50)))/100;
      const logic:(0|1)=(time*frequency)%1<duty?1:0;
      drive(network.union.find(keyOf(component.id,'out')),logic,logic?Number(props.voltageHigh??5):0,keyOf(component.id,'out'));
    }
  }
  for(let pass=0;pass<Math.max(8,project.components.length*2);pass++){
    let changed=false;
    for(const component of project.components){
      if(!component.enabled)continue;
      const base=CATALOG_BY_ID.get(component.definitionId);if(!base)continue;
      const definition=effectiveDefinition(base,component.properties);
      if(!LOGIC_MODELS.has(definition.model)&&!['mux','demux','seven_segment_decoder'].includes(definition.model))continue;
      const inputs=definition.pins.filter(pin=>pin.kind==='INPUT').map(pin=>drivers.get(network.union.find(keyOf(component.id,pin.id)))?.logic??'X');
      if(definition.model==='demux'){
        const data=inputs[0]??'X',select=inputs[1]??'X';
        const values:Record<string,LogicValue>={a:select==='X'||select==='Z'?'X':select===0?data:0,b:select==='X'||select==='Z'?'X':select===1?data:0};
        for(const pin of definition.pins.filter(pin=>pin.kind==='OUTPUT')){const root=network.union.find(keyOf(component.id,pin.id)),previous=drivers.get(root),result=values[pin.id]??'X';if(previous?.logic!==result)changed=true;drive(root,result,result===1?Number(component.properties.voltageHigh??5):0,keyOf(component.id,pin.id));}
        continue;
      }
      if(definition.model==='seven_segment_decoder'){
        const unknown=inputs.some(value=>value==='X'||value==='Z'),digit=unknown?-1:(inputs as Array<0|1>).reduce<number>((sum,value,index)=>sum+(value<<index),0);
        const lit=new Set((['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'][digit]??''));
        for(const pin of definition.pins.filter(pin=>pin.kind==='OUTPUT')){const root=network.union.find(keyOf(component.id,pin.id)),previous=drivers.get(root),result:LogicValue=unknown?'X':lit.has(pin.id)?1:0;if(previous?.logic!==result)changed=true;drive(root,result,result===1?Number(component.properties.voltageHigh??5):0,keyOf(component.id,pin.id));}
        continue;
      }
      let result:LogicValue;
      if(definition.model==='mux')result=inputs[2]===1?inputs[1]??'X':inputs[2]===0?inputs[0]??'X':'X';
      else result=gateResult(definition.model,inputs);
      const high=Number(component.properties.voltageHigh??5);
      for(const pin of definition.pins.filter(pin=>pin.kind==='OUTPUT')){
        const root=network.union.find(keyOf(component.id,pin.id)),previous=drivers.get(root);
        if(previous?.logic!==result)changed=true;
        drive(root,result,result===1?high:0,keyOf(component.id,pin.id));
      }
    }
    if(!changed)break;
  }
  return drivers;
}

function solveElectrical(project:BitWireProject,network:NetworkContext,digital:Map<string,DigitalDriver>,time:number,dt:number,state:SimulationState):SolveResult {
  const nodeRoots=network.roots.filter(root=>root!==network.referenceRoot);
  const nodeIndex=new Map(nodeRoots.map((root,index)=>[root,index]));
  const sources=project.components.filter(component=>component.enabled&&['source_dc','source_ac','vcvs'].includes(CATALOG_BY_ID.get(component.definitionId)?.model??''));
  const sourceIndex=new Map(sources.map((component,index)=>[component.id,nodeRoots.length+index]));
  const size=nodeRoots.length+sources.length;
  let guess=new Map<string,number>(network.roots.map(root=>[root,0]));
  const warnings:string[]=[];
  let solution=Array.from({length:size},()=>0);

  for(let iteration=0;iteration<10;iteration++){
    const matrix=Array.from({length:size},()=>Array.from({length:size},()=>0));
    const rhs=Array.from({length:size},()=>0);
    const idx=(root:string)=>root===network.referenceRoot?undefined:nodeIndex.get(root);
    const rootFor=(componentId:string,pinId:string)=>network.union.find(keyOf(componentId,pinId));
    const stampG=(a:string,b:string,g:number)=>{const ia=idx(a),ib=idx(b);if(ia!==undefined)matrix[ia][ia]+=g;if(ib!==undefined)matrix[ib][ib]+=g;if(ia!==undefined&&ib!==undefined){matrix[ia][ib]-=g;matrix[ib][ia]-=g;}};
    const stampI=(a:string,b:string,current:number)=>{const ia=idx(a),ib=idx(b);if(ia!==undefined)rhs[ia]-=current;if(ib!==undefined)rhs[ib]+=current;};
    const stampAffine=(a:string,b:string,g:number,offset:number)=>{stampG(a,b,g);const history=g*offset;const ia=idx(a),ib=idx(b);if(ia!==undefined)rhs[ia]+=history;if(ib!==undefined)rhs[ib]-=history;};
    const stampVCCS=(outPlus:string,outMinus:string,controlPlus:string,controlMinus:string,g:number)=>{const op=idx(outPlus),om=idx(outMinus),cp=idx(controlPlus),cm=idx(controlMinus);if(op!==undefined&&cp!==undefined)matrix[op][cp]+=g;if(op!==undefined&&cm!==undefined)matrix[op][cm]-=g;if(om!==undefined&&cp!==undefined)matrix[om][cp]-=g;if(om!==undefined&&cm!==undefined)matrix[om][cm]+=g;};
    const stampNorton=(out:string,target:number,resistance=.05)=>{const g=1/Math.max(1e-9,resistance);stampG(out,network.referenceRoot,g);stampI(network.referenceRoot,out,target*g);};
    const voltage=(root:string)=>guess.get(root)??0;
    for(let index=0;index<nodeRoots.length;index++)matrix[index][index]+=1e-12;

    for(const component of project.components){
      if(!component.enabled)continue;
      const base=CATALOG_BY_ID.get(component.definitionId);if(!base)continue;
      const definition=effectiveDefinition(base,component.properties),props={...definition.defaults,...component.properties},pins=definition.pins;
      const a=pins[0]?rootFor(component.id,pins[0].id):network.referenceRoot,b=pins[1]?rootFor(component.id,pins[1].id):network.referenceRoot;
      const model=definition.model;
      if(RAIL_MODELS.has(model)){const out=rootFor(component.id,'out');stampNorton(out,railVoltage(model,props,time),Math.max(.001,Number(props.internalResistance??.05)));}
      if(model==='resistor')stampG(a,b,1/resistanceFor(props,1000));
      else if(model==='potentiometer'){
        const ra=rootFor(component.id,'a'),rw=rootFor(component.id,'w'),rb=rootFor(component.id,'b'),position=Math.max(.001,Math.min(.999,Number(props.position??50)/100)),total=resistanceFor(props,10000);
        stampG(ra,rw,1/(total*position));stampG(rw,rb,1/(total*(1-position)));
      } else if(model==='switch'||model==='analog_switch'){if(Boolean(props.closed))stampG(a,b,1/Math.max(.001,Number(props.onResistance??.001)));}
      else if(model==='fuse'){if(!Boolean(props.blown))stampG(a,b,1000);}
      else if(model==='connector'&&pins.length>=2)stampG(a,b,1000);
      else if(['lamp','motor','speaker','buzzer'].includes(model))stampG(a,b,1/resistanceFor(props,model==='motor'?8:220));
      else if(model==='capacitor'){
        const g=Math.max(1e-15,Number(props.capacitance??1e-6))/dt;
        stampAffine(a,b,g,state.capacitors[component.id]??0);
      } else if(model==='inductor'){
        const g=dt/Math.max(1e-12,Number(props.inductance??.01));stampG(a,b,g);stampI(a,b,state.inductors[component.id]??0);
        const series=Math.max(0,Number(props.seriesResistance??0));if(series)stampG(a,b,1/series);
      } else if(['diode','zener','led'].includes(model)){
        const params=diodeLinearization(model,props,voltage(a)-voltage(b));stampAffine(a,b,params.g,params.offset);
      } else if(model==='current_source')stampI(a,b,Number(props.current??.01));
      else if(model==='nmos'||model==='pmos'){
        const gate=rootFor(component.id,'b'),drain=rootFor(component.id,'c'),source=rootFor(component.id,'e');
        const threshold=Math.abs(Number(props.threshold??2.5)),drive=model==='nmos'?voltage(gate)-voltage(source):voltage(source)-voltage(gate);
        stampG(drain,source,1/(drive>=threshold?Math.max(.01,Number(props.onResistance??.05)):1e9));
      } else if(model==='bjt_npn'||model==='bjt_pnp'){
        const baseRoot=rootFor(component.id,'b'),collector=rootFor(component.id,'c'),emitter=rootFor(component.id,'e');
        const drive=model==='bjt_npn'?voltage(baseRoot)-voltage(emitter):voltage(emitter)-voltage(baseRoot);
        stampG(baseRoot,emitter,1/(drive>.62?Math.max(100,10000/Math.max(1,Number(props.beta??100))):1e9));
        stampG(collector,emitter,1/(drive>.62?Math.max(.05,10/Math.max(1,Number(props.beta??100))):1e9));
      } else if(model==='opamp'||model==='comparator'){
        const plus=rootFor(component.id,'plus'),minus=rootFor(component.id,'minus'),out=rootFor(component.id,'out');
        const supply=Number(props.supply??props.highVoltage??12),gain=model==='comparator'?1e6:Number(props.gain??100000);
        const target=Math.max(model==='comparator'?0:-supply,Math.min(supply,(voltage(plus)-voltage(minus))*gain));stampNorton(out,target,.05);
      } else if(model==='vccs'){
        stampVCCS(rootFor(component.id,'out_plus'),rootFor(component.id,'out_minus'),rootFor(component.id,'ctrl_plus'),rootFor(component.id,'ctrl_minus'),Number(props.transconductance??.001));
      }
    }
    for(const driver of digital.values())if(driver.logic===0||driver.logic===1)stampNorton(network.union.find(driver.endpoint),driver.voltage,.05);
    for(const source of sources){
      const definition=CATALOG_BY_ID.get(source.definitionId)!,props={...definition.defaults,...source.properties};
      const controlled=definition.model==='vcvs';
      const pos=rootFor(source.id,controlled?'out_plus':'pos'),neg=rootFor(source.id,controlled?'out_minus':'neg'),row=sourceIndex.get(source.id)!;
      const voltageSource=definition.model==='source_ac'?Number(props.voltage??12)*Math.sin(time*Math.PI*2*Number(props.frequency??50)):controlled?0:Number(props.voltage??5);
      const ip=idx(pos),ineg=idx(neg);
      if(ip!==undefined){matrix[ip][row]+=1;matrix[row][ip]+=1;}if(ineg!==undefined){matrix[ineg][row]-=1;matrix[row][ineg]-=1;}rhs[row]+=voltageSource;
      if(controlled){const gain=Number(props.gain??1),cp=idx(rootFor(source.id,'ctrl_plus')),cm=idx(rootFor(source.id,'ctrl_minus'));if(cp!==undefined)matrix[row][cp]-=gain;if(cm!==undefined)matrix[row][cm]+=gain;}
    }
    try{solution=gaussianSolve(matrix,rhs);}catch(error){warnings.push(`Matriz eléctrica singular: ${error instanceof Error?error.message:String(error)}`);solution=Array.from({length:size},()=>0);break;}
    const next=new Map<string,number>([[network.referenceRoot,0]]);
    for(const [root,index] of nodeIndex)next.set(root,solution[index]??0);
    const delta=Math.max(...network.roots.map(root=>Math.abs((next.get(root)??0)-(guess.get(root)??0))),0);
    guess=next;if(delta<1e-7)break;
  }
  const sourceCurrents=new Map<string,number>();for(const [id,index] of sourceIndex)sourceCurrents.set(id,solution[index]??0);
  for(const component of project.components){
    const definition=CATALOG_BY_ID.get(component.definitionId);if(!definition||SUPPORTED_MODELS.has(definition.model)||!component.enabled)continue;
    const connected=project.wires.some(wire=>wire.from.componentId===component.id||wire.to.componentId===component.id);
    if(connected)warnings.push(`${definition.name}: modelo eléctrico todavía aproximado/no implementado`);
  }
  return {voltages:guess,sourceCurrents,warnings};
}

function calculateBranches(project:BitWireProject,network:NetworkContext,digital:Map<string,DigitalDriver>,solved:SolveResult,time:number,dt:number,state:SimulationState):Branch[]{
  const branches:Branch[]=[];
  const add=(componentId:string,aPin:string,bPin:string,current:number)=>branches.push({componentId,a:keyOf(componentId,aPin),b:keyOf(componentId,bPin),current:Number.isFinite(current)?current:0});
  const root=(id:string,pin:string)=>network.union.find(keyOf(id,pin));
  const v=(id:string,pin:string)=>solved.voltages.get(root(id,pin))??0;
  for(const component of project.components){
    if(!component.enabled)continue;const base=CATALOG_BY_ID.get(component.definitionId);if(!base)continue;
    const definition=effectiveDefinition(base,component.properties),props={...definition.defaults,...component.properties},pins=definition.pins,model=definition.model;
    if(RAIL_MODELS.has(model)){const target=railVoltage(model,props,time),resistance=Math.max(.001,Number(props.internalResistance??.05)),actual=v(component.id,'out');branches.push({componentId:component.id,a:keyOf(component.id,'out'),b:'__reference__:gnd',current:(actual-target)/resistance});continue;}
    if(model==='vcvs'){add(component.id,'out_plus','out_minus',solved.sourceCurrents.get(component.id)??0);continue;}
    if(model==='vccs'){add(component.id,'out_plus','out_minus',Number(props.transconductance??.001)*(v(component.id,'ctrl_plus')-v(component.id,'ctrl_minus')));continue;}
    const a=pins[0]?.id,b=pins[1]?.id;if(!a||!b)continue;const difference=v(component.id,a)-v(component.id,b);
    if(model==='resistor')add(component.id,a,b,difference/resistanceFor(props,1000));
    else if(model==='potentiometer'){
      const position=Math.max(.001,Math.min(.999,Number(props.position??50)/100)),total=resistanceFor(props,10000);
      add(component.id,'a','w',(v(component.id,'a')-v(component.id,'w'))/(total*position));add(component.id,'w','b',(v(component.id,'w')-v(component.id,'b'))/(total*(1-position)));
    } else if((model==='switch'||model==='analog_switch')&&Boolean(props.closed))add(component.id,a,b,difference/Math.max(.001,Number(props.onResistance??.001)));
    else if(model==='fuse'&&!Boolean(props.blown))add(component.id,a,b,difference/.001);
    else if(model==='connector'&&pins.length>=2)add(component.id,a,b,difference/.001);
    else if(['lamp','motor','speaker','buzzer'].includes(model))add(component.id,a,b,difference/resistanceFor(props,model==='motor'?8:220));
    else if(model==='capacitor')add(component.id,a,b,Number(props.capacitance??1e-6)/dt*(difference-(state.capacitors[component.id]??0)));
    else if(model==='inductor')add(component.id,a,b,dt/Math.max(1e-12,Number(props.inductance??.01))*difference+(state.inductors[component.id]??0));
    else if(['diode','zener','led'].includes(model)){const p=diodeLinearization(model,props,difference);add(component.id,a,b,p.g*(difference-p.offset));}
    else if(model==='current_source')add(component.id,a,b,Number(props.current??.01));
    else if(model==='source_dc'||model==='source_ac')add(component.id,'pos','neg',solved.sourceCurrents.get(component.id)??0);
    else if(model==='nmos'||model==='pmos'||model==='bjt_npn'||model==='bjt_pnp')add(component.id,'c','e',(v(component.id,'c')-v(component.id,'e'))/transistorResistance(model,props,v(component.id,'b'),v(component.id,'e')));
  }
  for(const driver of digital.values()){
    if(driver.logic!==0&&driver.logic!==1)continue;
    const endpoint=driver.endpoint,[componentId,pinId]=splitEndpoint(endpoint),actual=solved.voltages.get(network.union.find(endpoint))??0;
    branches.push({componentId,a:endpoint,b:'__reference__:gnd',current:(actual-driver.voltage)/.05});
  }
  return branches;
}

function branchInjections(branches:Branch[],project:BitWireProject,network:NetworkContext){
  const injections=new Map<string,number>();
  const groundEndpoint=project.components.map(component=>({component,definition:CATALOG_BY_ID.get(component.definitionId)})).find(item=>item.definition?.model==='ground')?.component.id;
  const referenceEndpoint=groundEndpoint?keyOf(groundEndpoint,'gnd'):network.union.values().find(endpoint=>network.union.find(endpoint)===network.referenceRoot)??'__reference__:gnd';
  for(const branch of branches){
    const a=branch.a.startsWith('__reference__:')?referenceEndpoint:branch.a,b=branch.b.startsWith('__reference__:')?referenceEndpoint:branch.b;
    injections.set(a,(injections.get(a)??0)+branch.current);injections.set(b,(injections.get(b)??0)-branch.current);
  }
  // The reference node has no MNA row. Attach its residual current to the
  // physical ground terminal so wire flows still obey Kirchhoff exactly.
  const totals=new Map<string,number>();
  for(const [endpoint,current] of injections){const root=network.union.find(endpoint);totals.set(root,(totals.get(root)??0)+current);}
  for(const [root,total] of totals){if(Math.abs(total)<1e-10)continue;const endpoint=root===network.referenceRoot?referenceEndpoint:network.union.values().find(item=>network.union.find(item)===root);if(endpoint)injections.set(endpoint,(injections.get(endpoint)??0)-total);}
  return injections;
}

function solveWireCurrents(wires:Wire[],injections:Map<string,number>){
  const adjacency=new Map<string,Array<{wire:Wire;other:string}>>();
  for(const wire of wires){const a=keyOf(wire.from.componentId,wire.from.pinId),b=keyOf(wire.to.componentId,wire.to.pinId);adjacency.set(a,[...(adjacency.get(a)??[]),{wire,other:b}]);adjacency.set(b,[...(adjacency.get(b)??[]),{wire,other:a}]);}
  const currents=new Map<string,number>(),visited=new Set<string>();
  const walk=(node:string,parent?:string):number=>{
    visited.add(node);let total=injections.get(node)??0;
    for(const edge of adjacency.get(node)??[]){if(edge.other===parent||visited.has(edge.other)){if(visited.has(edge.other)&&edge.other!==parent&&!currents.has(edge.wire.id))currents.set(edge.wire.id,0);continue;}const subtree=walk(edge.other,node);const actualFrom=keyOf(edge.wire.from.componentId,edge.wire.from.pinId);currents.set(edge.wire.id,actualFrom===node?subtree:-subtree);total+=subtree;}
    return total;
  };
  for(const node of adjacency.keys())if(!visited.has(node))walk(node);
  return currents;
}

function buildComponentSignals(project:BitWireProject,network:NetworkContext,digital:Map<string,DigitalDriver>,solved:SolveResult,branches:Branch[],endpointCurrents:Map<string,number>){
  const result:Record<string,ComponentSignal>={};
  for(const component of project.components){
    const base=CATALOG_BY_ID.get(component.definitionId);if(!base)continue;const definition=effectiveDefinition(base,component.properties);
    const inputs:Record<string,WireSignal>={},outputs:Record<string,WireSignal>={};
    for(const pin of definition.pins){
      const endpoint=keyOf(component.id,pin.id),root=network.union.find(endpoint),voltage=solved.voltages.get(root)??0,driver=digital.get(root);
      const signal=cloneSignal({voltage,current:endpointCurrents.get(endpoint)??0,logic:driver?.logic??logicFromVoltage(voltage),active:Boolean(driver)||Math.abs(endpointCurrents.get(endpoint)??0)>EPSILON_CURRENT,floating:false});
      if(pin.kind==='OUTPUT')outputs[pin.id]=signal;else inputs[pin.id]=signal;
    }
    const ownBranches=branches.filter(branch=>branch.componentId===component.id);
    const power=ownBranches.reduce((sum,branch)=>{const [aid,apin]=splitEndpoint(branch.a),[bid,bpin]=splitEndpoint(branch.b);const va=aid==='__reference__'?0:solved.voltages.get(network.union.find(keyOf(aid,apin)))??0;const vb=bid==='__reference__'?0:solved.voltages.get(network.union.find(keyOf(bid,bpin)))??0;return sum+Math.abs((va-vb)*branch.current);},0);
    const active=ownBranches.some(branch=>Math.abs(branch.current)>EPSILON_CURRENT)||Object.values(outputs).some(signal=>signal.logic===1)||Object.values(inputs).some(signal=>signal.logic===1);
    result[component.id]={inputs,outputs,active,power};
  }
  return result;
}

function gateResult(model:string,inputs:LogicValue[]):LogicValue {
  if(inputs.some(value=>value==='X'||value==='Z'))return 'X';const bits=inputs as Array<0|1>;
  if(model==='and')return bits.every(Boolean)?1:0;if(model==='nand')return bits.every(Boolean)?0:1;
  if(model==='or')return bits.some(Boolean)?1:0;if(model==='nor')return bits.some(Boolean)?0:1;
  if(model==='xor')return bits.filter(Boolean).length%2?1:0;if(model==='xnor')return bits.filter(Boolean).length%2?0:1;
  if(model==='not')return bits[0]?0:1;return 'X';
}

function resistanceFor(props:Record<string,unknown>,fallback:number){
  return Math.max(1e-9,Number(props.resistance??props.coilResistance??props.impedance??props.darkResistance??fallback));
}
function railVoltage(model:string,props:Record<string,unknown>,time:number){
  const amplitude=Number(props.voltage??5),frequency=Math.max(.000001,Number(props.frequency??50));
  if(model==='rail_ac')return amplitude*Math.sin(2*Math.PI*frequency*time);
  if(model==='rail_square'){const duty=Math.max(0,Math.min(100,Number(props.dutyCycle??50)))/100;return Number(props.offsetVoltage??0)+((time*frequency)%1<duty?amplitude:0);}
  if(model==='rail_sweep'){const duration=Math.max(1e-9,Number(props.sweepTime??1)),local=((time%duration)+duration)%duration,start=Number(props.startFrequency??10),stop=Number(props.stopFrequency??10000),slope=(stop-start)/duration;return amplitude*Math.sin(2*Math.PI*(start*local+.5*slope*local*local));}
  if(model==='rail_noise'){const sample=Math.floor(time*Math.max(1000,Number(props.sampleRate??20000)))+Number(props.seed??1),raw=Math.sin(sample*12.9898)*43758.5453;return amplitude*((raw-Math.floor(raw))*2-1);}
  return amplitude;
}
function diodeLinearization(model:string,props:Record<string,unknown>,voltage:number){
  const forward=Math.max(.01,Number(props.forwardVoltage??(model==='led'?2:.7))),zener=Number(props.zenerVoltage??props.breakdownVoltage??Number.POSITIVE_INFINITY);
  if(voltage>forward)return{g:50,offset:forward};if(voltage< -zener)return{g:50,offset:-zener};return{g:1e-9,offset:0};
}
function transistorResistance(model:string,props:Record<string,unknown>,gate:number,source:number){
  const threshold=Math.abs(Number(props.threshold??(model.startsWith('bjt')?.65:2.5))),drive=model==='pmos'||model==='bjt_pnp'?source-gate:gate-source;
  return drive>=threshold?Math.max(.01,Number(props.onResistance??(model.startsWith('bjt')?.1:.05))):1e9;
}
function voltageBetween(solved:SolveResult,network:NetworkContext,id:string,a:string,b:string){return(solved.voltages.get(network.union.find(keyOf(id,a)))??0)-(solved.voltages.get(network.union.find(keyOf(id,b)))??0);}
function logicFromVoltage(voltage:number):LogicValue{return voltage>=2.5?1:voltage<=.8?0:'X';}
function splitEndpoint(endpoint:string):[string,string]{const index=endpoint.lastIndexOf(':');return[endpoint.slice(0,index),endpoint.slice(index+1)];}

function gaussianSolve(matrix:number[][],rhs:number[]){
  const n=rhs.length;if(!n)return[];const a=matrix.map((row,index)=>[...row,rhs[index]]);
  for(let column=0;column<n;column++){
    let pivot=column;for(let row=column+1;row<n;row++)if(Math.abs(a[row][column])>Math.abs(a[pivot][column]))pivot=row;
    if(Math.abs(a[pivot][column])<1e-18)throw new Error(`pivote nulo en nodo ${column+1}`);
    [a[column],a[pivot]]=[a[pivot],a[column]];const divisor=a[column][column];for(let item=column;item<=n;item++)a[column][item]/=divisor;
    for(let row=0;row<n;row++){if(row===column)continue;const factor=a[row][column];if(!factor)continue;for(let item=column;item<=n;item++)a[row][item]-=factor*a[column][item];}
  }
  return a.map(row=>row[n]);
}
