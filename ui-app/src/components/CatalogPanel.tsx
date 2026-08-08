import { Box, ChevronDown, FolderUp, GripVertical, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EMBEDDED_CATALOG, searchCatalog } from '../catalog/catalog';
import type { CatalogDatabaseStatus, ComponentDefinition, SavedModule } from '../model/types';

interface Props {
  collapsed: boolean;
  database: CatalogDatabaseStatus;
  onToggle(): void;
  onAdd(definition: ComponentDefinition): void;
  modules: SavedModule[];
  onInsertModule(module: SavedModule): void;
  onImportModule(): void;
  onDeleteModule(id: string): void;
}

export function CatalogPanel({ collapsed, database, onToggle, onAdd, modules, onInsertModule, onImportModule, onDeleteModule }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set(['Fuentes y tierra', 'Pasivos', 'Lógica digital']));
  const categories = useMemo(() => [...new Set(EMBEDDED_CATALOG.map(item => item.category))], []);
  const items = useMemo(() => searchCatalog(query), [query]);
  const total = database.count || EMBEDDED_CATALOG.length;

  if (collapsed) return (
    <aside className="catalog-panel collapsed-panel">
      <button className="catalog-brand compact-brand" onClick={onToggle} title="Abrir catálogo"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/></button>
      <button className="icon-button vertical-label" onClick={onToggle} title="Abrir catálogo">CATÁLOGO</button>
    </aside>
  );

  const toggleCategory = (category: string) => setOpen(current => {
    const next = new Set(current);
    next.has(category) ? next.delete(category) : next.add(category);
    return next;
  });

  return (
    <aside className="catalog-panel">
      <div className="catalog-brand">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Icono de BitWire"/>
        <strong>BITWIRE</strong>
      </div>
      <div className="panel-heading">
        <div><span className="eyebrow">BIBLIOTECA</span><h2>Componentes</h2></div>
        <button className="icon-button" onClick={onToggle} title="Ocultar catálogo"><X size={17}/></button>
      </div>
      <label className="search-box">
        <Search size={15}/>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar resistencia, CMOS…" />
        <span className="catalog-count" title={`${items.length} elementos visibles de ${total}`}>{items.length} / {total}</span>
        {query && <button onClick={() => setQuery('')}><X size={14}/></button>}
      </label>
      <div className="catalog-scroll">
        <section className="saved-module-section">
          <div className="saved-module-heading"><span><Box size={13}/>MIS ENCAPSULADOS</span><button onClick={onImportModule} title="Importar .bitwire-module"><FolderUp size={14}/>Importar</button></div>
          {modules.length ? <div className="saved-module-list">{modules.map(module => <div key={module.id}><button className="saved-module-card" onDoubleClick={() => onInsertModule(module)} title="Doble clic para insertar"><span style={{ borderColor: module.color }}><b>{module.pins.length}</b> PIN</span><span><strong>{module.name}</strong><small>{module.components.length} elementos · {module.width} × {module.height}</small></span></button><button className="delete-library-item" onClick={() => onDeleteModule(module.id)} title="Eliminar de la biblioteca"><Trash2 size={12}/></button></div>)}</div> : <p className="empty-library">Guarda aquí los chips que diseñes para reutilizarlos en otros proyectos.</p>}
        </section>
        {categories.map(category => {
          const categoryItems = items.filter(item => item.category === category);
          if (!categoryItems.length) return null;
          const expanded = Boolean(query) || open.has(category);
          return <section className="catalog-category" key={category}>
            <button className="category-heading" onClick={() => toggleCategory(category)}>
              <ChevronDown size={14} className={expanded ? '' : 'closed'}/>
              <span>{category}</span><small>{categoryItems.length}</small>
            </button>
            {expanded && <div className="catalog-items">
              {categoryItems.map(item => <button
                key={item.id}
                className="catalog-item"
                draggable
                onDragStart={event => { event.dataTransfer.setData('application/x-bitwire-component', item.id); event.dataTransfer.effectAllowed = 'copy'; }}
                onDoubleClick={() => onAdd(item)}
                title={`${item.description}\nDoble clic o arrastra al plano`}
              >
                <GripVertical size={13}/><span className="catalog-glyph">{glyphFor(item.symbol)}</span>
                <span><strong>{item.name}</strong><small>{item.family}</small></span>
              </button>)}
            </div>}
          </section>;
        })}
      </div>
      <div className="panel-help">Arrastra al plano o haz doble clic para insertar.</div>
    </aside>
  );
}

function glyphFor(symbol: string) {
  if (symbol.includes('gate') || ['and','or','not','nand','nor','xor','xnor'].includes(symbol)) return '∧';
  if (symbol.includes('source') || symbol === 'battery') return '±';
  if (symbol === 'resistor' || symbol === 'potentiometer') return '↯';
  if (symbol === 'capacitor' || symbol === 'capacitor_polarized') return '‖';
  if (symbol === 'ground') return '⏚';
  if (symbol === 'oscilloscope') return '∿';
  if (symbol === 'analyzer') return '▥';
  if (symbol === 'multimeter') return 'VΩ';
  if (symbol === 'spectrum') return '▥';
  if (symbol === 'power_monitor') return 'W';
  if (symbol === 'frequency_counter') return 'Hz';
  if (symbol === 'chip') return '▣';
  if (symbol === 'lamp' || symbol === 'led') return '✦';
  return '◇';
}
