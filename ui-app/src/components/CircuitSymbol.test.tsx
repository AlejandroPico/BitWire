import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { CATALOG_BY_ID } from '../catalog/catalog';
import type { ComponentSignal, WireSignal } from '../model/types';
import { createInstance } from '../state/project';
import { CircuitSymbol } from './CircuitSymbol';

const high:WireSignal={logic:1,voltage:5,current:.002,active:true,floating:false};
const low:WireSignal={logic:0,voltage:0,current:0,active:true,floating:false};
const render=(definitionId:string,inputs:NonNullable<ComponentSignal['inputs']>)=>{
  const definition=CATALOG_BY_ID.get(definitionId)!;
  return renderToStaticMarkup(<CircuitSymbol component={createInstance(definitionId,0,0,'display')} definition={definition} selected={false} lod={2}
    signal={{inputs,outputs:{},active:Object.values(inputs).some(item=>item.logic===1),power:0}}
    onPointerDown={()=>{}} onDoubleClick={()=>{}} onContextMenu={()=>{}} onPin={()=>{}} onQuickToggle={()=>{}} onProperty={()=>{}}/>);
};

describe('functional display rendering',()=>{
  it('lights only the driven seven-segment inputs',()=>{
    const markup=render('seven_segment',{a:high,b:high,c:high,d:low,e:low,f:low,g:low});
    expect(markup).toContain('data-segment="A" class="display-segment on"');
    expect(markup).toContain('data-segment="C" class="display-segment on"');
    expect(markup).toContain('data-segment="D" class="display-segment off"');
  });

  it('applies digit selection independently in the four-digit display',()=>{
    const markup=render('display_7seg_4',{a:high,b:high,c:high,d:high,e:high,f:high,g:low,digit1:high,digit2:low,digit3:low,digit4:low});
    expect(markup.match(/digit-enabled/g)).toHaveLength(1);
    expect(markup.match(/digit-disabled/g)).toHaveLength(3);
  });

  it('lights only selected intersections and bar segments',()=>{
    const matrix=render('matrix_8x8',{row2:high,col3:high,row1:low,col1:low});
    expect(matrix).toContain('data-row="2" data-col="3" class="matrix-dot on"');
    const bar=render('bargraph_10',{s1:high,s2:low,s3:high});
    expect(bar).toContain('data-segment="1" class="bargraph-led on"');
    expect(bar).toContain('data-segment="2" class="bargraph-led"');
  });
});
