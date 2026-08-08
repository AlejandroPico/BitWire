import { describe, expect, it } from 'vitest';
import { CATALOG_BY_ID, EMBEDDED_CATALOG, effectiveDefinition } from './catalog';

describe('expanded component catalog', () => {
  it('contains 235 unique, connectable vector components', () => {
    expect(EMBEDDED_CATALOG).toHaveLength(235);
    expect(new Set(EMBEDDED_CATALOG.map(item=>item.id)).size).toBe(235);
    expect(EMBEDDED_CATALOG.every(item=>item.pins.length>0)).toBe(true);
  });

  it('covers the newly audited CircuitJS fundamentals with explicit models',()=>{
    for(const id of ['rail_dc','rail_ac','square_source','sweep_source','noise_source','ammeter','ohmmeter','wattmeter','data_recorder','demux_1_2','decoder_7seg','vcvs','vccs'])expect(CATALOG_BY_ID.has(id)).toBe(true);
    expect(CATALOG_BY_ID.get('decoder_7seg')?.pins).toHaveLength(11);
    expect(CATALOG_BY_ID.get('vcvs')?.pins.map(pin=>pin.id)).toEqual(['ctrl_plus','ctrl_minus','out_plus','out_minus']);
  });

  it('provides meaningful RF, sensor and power coverage', () => {
    const count=(category:string)=>EMBEDDED_CATALOG.filter(item=>item.category===category).length;
    expect(count('Radiofrecuencia')).toBeGreaterThan(20);
    expect(count('Sensores')).toBeGreaterThanOrEqual(20);
    expect(count('Gestión de potencia')).toBeGreaterThanOrEqual(15);
  });

  it('gives dense displays enough physical room for distinct terminals',()=>{
    const ids=['seven_segment','display_7seg_4','matrix_8x8','bargraph_10'];
    for(const id of ids){
      const display=EMBEDDED_CATALOG.find(item=>item.id===id)!;
      expect(display.height).toBeGreaterThanOrEqual(126);
      const left=display.pins.filter(pin=>pin.x===0).sort((a,b)=>a.y-b.y);
      const minimum=Math.min(...left.slice(1).map((pin,index)=>(pin.y-left[index].y)*display.height));
      expect(minimum).toBeGreaterThan(12);
    }
  });

  it('materializes up to ten inputs and ten outputs on configurable gates',()=>{
    const base=CATALOG_BY_ID.get('gate_and')!;
    const gate=effectiveDefinition(base,{inputCount:10,outputCount:10});
    expect(gate.pins.filter(pin=>pin.kind==='INPUT')).toHaveLength(10);
    expect(gate.pins.filter(pin=>pin.kind==='OUTPUT')).toHaveLength(10);
    expect(gate.pins.map(pin=>pin.id)).toContain('in10');
    expect(gate.pins.map(pin=>pin.id)).toContain('out10');
  });

  it('includes a one-terminal junction that can become part of a net',()=>{
    const junction=CATALOG_BY_ID.get('junction')!;
    expect(junction.model).toBe('connector');
    expect(junction.pins.map(pin=>pin.id)).toEqual(['node']);
  });
});
