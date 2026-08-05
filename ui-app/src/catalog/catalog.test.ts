import { describe, expect, it } from 'vitest';
import { EMBEDDED_CATALOG } from './catalog';

describe('expanded component catalog', () => {
  it('contains 219 unique, connectable vector components', () => {
    expect(EMBEDDED_CATALOG).toHaveLength(219);
    expect(new Set(EMBEDDED_CATALOG.map(item=>item.id)).size).toBe(219);
    expect(EMBEDDED_CATALOG.every(item=>item.pins.length>0)).toBe(true);
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
});
