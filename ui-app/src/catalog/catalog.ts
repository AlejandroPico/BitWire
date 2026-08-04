import initSqlJs from 'sql.js';
import rawCatalog from '../../../catalog/components.json';
import expandedCatalog from '../../../catalog/expanded-components.json';
import type { CatalogDatabaseStatus, ComponentDefinition, PinDefinition, PinKind, SignalDomain } from '../model/types';

type RawComponent = {
  id: string; name: string; category: string; family: string; description: string;
  tags: string[]; model: string; symbol: string; profile: string;
  defaults: Record<string, string | number | boolean>; customGui?: boolean; internal?: string;
};

const pin = (id: string, name: string, kind: PinKind, domain: SignalDomain, x: number, y: number): PinDefinition =>
  ({ id, name, kind, domain, x, y });

export function pinsFor(profile: string): PinDefinition[] {
  const profiles: Record<string, PinDefinition[]> = {
    power: [pin('neg', '−', 'GND', 'POWER', 0, .7), pin('pos', '+', 'POWER', 'POWER', 1, .3)],
    ground: [pin('gnd', 'GND', 'GND', 'POWER', .5, 0)],
    analog2: [pin('a', 'A', 'ANALOG', 'ANALOG', 0, .5), pin('b', 'B', 'ANALOG', 'ANALOG', 1, .5)],
    analog3: [pin('a', 'A', 'ANALOG', 'ANALOG', 0, .3), pin('w', 'W', 'ANALOG', 'ANALOG', 1, .5), pin('b', 'B', 'ANALOG', 'ANALOG', 0, .7)],
    digital_out: [pin('out', 'Q', 'OUTPUT', 'DIGITAL', 1, .5)],
    gate1: [pin('in', 'A', 'INPUT', 'DIGITAL', 0, .5), pin('out', 'Q', 'OUTPUT', 'DIGITAL', 1, .5)],
    gate2: [pin('a', 'A', 'INPUT', 'DIGITAL', 0, .33), pin('b', 'B', 'INPUT', 'DIGITAL', 0, .67), pin('out', 'Q', 'OUTPUT', 'DIGITAL', 1, .5)],
    transistor: [pin('b', 'B/G', 'INPUT', 'MIXED', 0, .5), pin('c', 'C/D', 'ANALOG', 'ANALOG', 1, .25), pin('e', 'E/S', 'ANALOG', 'ANALOG', 1, .75)],
    opamp: [pin('plus', '+', 'INPUT', 'ANALOG', 0, .35), pin('minus', '−', 'INPUT', 'ANALOG', 0, .65), pin('out', 'OUT', 'OUTPUT', 'ANALOG', 1, .5)],
    probe1: [pin('in', 'IN', 'INPUT', 'MIXED', 0, .5)],
    probe2: [pin('plus', '+', 'INPUT', 'ANALOG', 0, .35), pin('minus', '−', 'INPUT', 'ANALOG', 0, .65)],
    scope: [pin('ch1', 'CH1', 'INPUT', 'ANALOG', 0, .35), pin('ch2', 'CH2', 'INPUT', 'ANALOG', 0, .65), pin('gnd', 'GND', 'GND', 'POWER', 1, .8)],
    connector2: [pin('p1', '1', 'BIDIRECTIONAL', 'MIXED', 0, .35), pin('p2', '2', 'BIDIRECTIONAL', 'MIXED', 0, .65)],
  };
  if (profiles[profile]) return profiles[profile];
  if (profile === 'transformer') return [pin('p1','P1','ANALOG','ANALOG',0,.3),pin('p2','P2','ANALOG','ANALOG',0,.7),pin('s1','S1','ANALOG','ANALOG',1,.3),pin('s2','S2','ANALOG','ANALOG',1,.7)];
  if (profile === 'relay') return [pin('coil_a','A1','INPUT','ANALOG',0,.25),pin('coil_b','A2','INPUT','ANALOG',0,.75),pin('com','COM','ANALOG','ANALOG',1,.5),pin('no','NO','ANALOG','ANALOG',1,.25),pin('nc','NC','ANALOG','ANALOG',1,.75)];
  if (profile === 'bridge') return [pin('ac1','~','ANALOG','ANALOG',0,.3),pin('ac2','~','ANALOG','ANALOG',0,.7),pin('pos','+','OUTPUT','ANALOG',1,.3),pin('neg','−','OUTPUT','ANALOG',1,.7)];
  if (profile === 'chip4' || profile === 'converter') return [pin('in','IN','INPUT','DIGITAL',0,.5),pin('out','OUT','OUTPUT','DIGITAL',1,.5),pin('vcc','VCC','VCC','POWER',.35,0),pin('gnd','GND','GND','POWER',.65,1)];
  if (profile === 'chip8') return Array.from({ length: 8 }, (_, n) => { const i = n + 1; return pin(`p${i}`,String(i),'BIDIRECTIONAL','MIXED',i <= 4 ? 0 : 1,(i <= 4 ? i : i - 4) / 5); });
  if (profile === 'dff') return [pin('d','D','INPUT','DIGITAL',0,.3),pin('clk','CLK','INPUT','DIGITAL',0,.7),pin('q','Q','OUTPUT','DIGITAL',1,.3),pin('nq','Q̅','OUTPUT','DIGITAL',1,.7)];
  if (profile === 'mux') return [pin('a','A','INPUT','DIGITAL',0,.25),pin('b','B','INPUT','DIGITAL',0,.55),pin('sel','S','INPUT','DIGITAL',0,.82),pin('out','Q','OUTPUT','DIGITAL',1,.5)];
  if (profile === 'display7') return [...'abcdefg'].map((name, i) => pin(name,name.toUpperCase(),'INPUT','DIGITAL',0,(i + 1) / 9));
  if (profile === 'display4') return [...'abcdefg'].map((name,i)=>pin(name,name.toUpperCase(),'INPUT','DIGITAL',0,(i+1)/9)).concat(Array.from({length:4},(_,i)=>pin(`digit${i+1}`,`D${i+1}`,'INPUT','DIGITAL',1,(i+1)/5)));
  if (profile === 'lcd16x2') return Array.from({length:8},(_,i)=>pin(`d${i}`,`D${i}`,'INPUT','DIGITAL',0,(i+1)/10)).concat([pin('rs','RS','INPUT','DIGITAL',1,.25),pin('enable','E','INPUT','DIGITAL',1,.45),pin('vcc','VCC','VCC','POWER',1,.65),pin('gnd','GND','GND','POWER',1,.82)]);
  if (profile === 'matrix8') return Array.from({length:8},(_,i)=>pin(`row${i}`,`R${i}`,'INPUT','DIGITAL',0,(i+1)/9)).concat(Array.from({length:8},(_,i)=>pin(`col${i}`,`C${i}`,'INPUT','DIGITAL',1,(i+1)/9)));
  if (profile === 'bargraph10') return Array.from({length:10},(_,i)=>pin(`s${i+1}`,String(i+1),'INPUT','DIGITAL',0,(i+1)/11));
  if (profile === 'analyzer') return Array.from({ length: 8 }, (_, i) => pin(`ch${i}`,`D${i}`,'INPUT','DIGITAL',0,(i + 1) / 9));
  if (profile === 'rf3') return [pin('rf_in','RF IN','INPUT','ANALOG',0,.35),pin('control','CTRL','INPUT','MIXED',0,.75),pin('rf_out','RF OUT','OUTPUT','ANALOG',1,.5)];
  if (profile === 'sensor3') return [pin('vcc','VCC','VCC','POWER',0,.25),pin('gnd','GND','GND','POWER',0,.75),pin('out','OUT','OUTPUT','MIXED',1,.5)];
  if (profile === 'switch3') return [pin('com','COM','BIDIRECTIONAL','MIXED',0,.5),pin('a','A','BIDIRECTIONAL','MIXED',1,.3),pin('b','B','BIDIRECTIONAL','MIXED',1,.7)];
  if (profile === 'fulladder') return [pin('a','A','INPUT','DIGITAL',0,.25),pin('b','B','INPUT','DIGITAL',0,.5),pin('cin','CIN','INPUT','DIGITAL',0,.75),pin('sum','Σ','OUTPUT','DIGITAL',1,.35),pin('cout','COUT','OUTPUT','DIGITAL',1,.68)];
  if (profile === 'gate3') return [pin('a','A','INPUT','DIGITAL',0,.22),pin('b','B','INPUT','DIGITAL',0,.5),pin('c','C','INPUT','DIGITAL',0,.78),pin('out','Q','OUTPUT','DIGITAL',1,.5)];
  if (profile === 'bus8') return Array.from({length:8},(_,i)=>pin(`d${i}`,`D${i}`,'BIDIRECTIONAL','DIGITAL',i<4?0:1,((i%4)+1)/5));
  return profiles.analog2;
}

export const EMBEDDED_CATALOG: ComponentDefinition[] = ([...(rawCatalog as RawComponent[]),...(expandedCatalog as RawComponent[])]).map(item => ({
  id: item.id,
  name: item.name,
  category: item.category,
  family: item.family,
  description: item.description,
  tags: item.tags,
  model: item.model,
  symbol: item.symbol,
  width: ['oscilloscope','analyzer','multimeter','spectrum','power_monitor','frequency_counter'].includes(item.symbol) ? 210 : 160,
  height: ['oscilloscope','analyzer','multimeter','spectrum','power_monitor','frequency_counter'].includes(item.symbol) ? 120 : 80,
  pins: pinsFor(item.profile),
  defaults: item.defaults,
  customGui: item.customGui,
  internal: item.internal,
}));

export const CATALOG_BY_ID = new Map(EMBEDDED_CATALOG.map(item => [item.id, item]));

export async function verifyCatalogDatabase(): Promise<CatalogDatabaseStatus> {
  try {
    const base = import.meta.env.BASE_URL;
    const SQL = await initSqlJs({ locateFile: () => `${base}sql-wasm.wasm` });
    const response = await fetch(`${base}catalog.db`);
    if (!response.ok) throw new Error('database unavailable');
    const db = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
    const result = db.exec('SELECT COUNT(*) AS count FROM components');
    const count = Number(result[0]?.values[0]?.[0] ?? 0);
    db.close();
    if (!count) throw new Error('empty catalog');
    return { source: 'sqlite', count };
  } catch {
    return { source: 'embedded', count: EMBEDDED_CATALOG.length };
  }
}

export function searchCatalog(query: string, category?: string): ComponentDefinition[] {
  const normalized = query.trim().toLocaleLowerCase('es');
  return EMBEDDED_CATALOG.filter(item => {
    if (category && item.category !== category) return false;
    if (!normalized) return true;
    return [item.name, item.family, item.description, ...item.tags]
      .some(value => value.toLocaleLowerCase('es').includes(normalized));
  });
}
