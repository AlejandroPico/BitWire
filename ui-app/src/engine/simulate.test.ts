import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../state/project';
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
});
