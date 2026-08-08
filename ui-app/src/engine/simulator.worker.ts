/// <reference lib="webworker" />
import type { BitWireProject } from '../model/types';
import { createSimulationState, evaluateCircuit } from './simulate';

type Message =
  | { type: 'project'; project: BitWireProject }
  | { type: 'control'; running: boolean; speed: number }
  | { type: 'step' };

let project: BitWireProject | null = null;
let running = false;
let speed = 1;
let tick = 0;
let simulationTime = 0;
let last = performance.now();
let simulationState=createSimulationState();

function emit(delta = 1 / 60) {
  if (!project) return;
  simulationTime += delta * speed;
  tick += 1;
  self.postMessage({ type: 'snapshot', snapshot: evaluateCircuit(project, simulationTime, tick, simulationState) });
}

setInterval(() => {
  if (!running || !project) return;
  const now = performance.now();
  const delta = Math.min(.05, (now - last) / 1000);
  last = now;
  emit(delta);
}, 16);

self.onmessage = (event: MessageEvent<Message>) => {
  const message = event.data;
  if (message.type === 'project') {
    project = message.project;
    simulationState=createSimulationState();
    emit(0);
  } else if (message.type === 'control') {
    running = message.running;
    speed = message.speed;
    last = performance.now();
  } else if (message.type === 'step') {
    emit(1 / 60);
  }
};

export {};
