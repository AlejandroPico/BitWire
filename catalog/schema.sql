PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  family TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags_json)),
  default_properties_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(default_properties_json)),
  simulation_model TEXT NOT NULL,
  symbol_key TEXT NOT NULL,
  is_subcircuit INTEGER NOT NULL DEFAULT 0 CHECK(is_subcircuit IN (0,1)),
  has_custom_gui INTEGER NOT NULL DEFAULT 0 CHECK(has_custom_gui IN (0,1)),
  min_lod_level INTEGER NOT NULL DEFAULT 0 CHECK(min_lod_level BETWEEN 0 AND 4),
  width REAL NOT NULL DEFAULT 160 CHECK(width > 0),
  height REAL NOT NULL DEFAULT 80 CHECK(height > 0),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE svg_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  standard TEXT NOT NULL CHECK(standard IN ('ANSI','IEC','BOTH')),
  lod_level INTEGER NOT NULL CHECK(lod_level BETWEEN 0 AND 4),
  view_box TEXT NOT NULL DEFAULT '0 0 160 80',
  svg_raw TEXT NOT NULL,
  UNIQUE(component_id, standard, lod_level)
);

CREATE TABLE pins (
  id TEXT NOT NULL,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  pin_name TEXT NOT NULL,
  pin_type TEXT NOT NULL CHECK(pin_type IN ('INPUT','OUTPUT','BIDIRECTIONAL','POWER','VCC','GND','ANALOG')),
  signal_domain TEXT NOT NULL CHECK(signal_domain IN ('ANALOG','DIGITAL','MIXED','POWER')),
  rel_x REAL NOT NULL CHECK(rel_x BETWEEN 0 AND 1),
  rel_y REAL NOT NULL CHECK(rel_y BETWEEN 0 AND 1),
  electrical_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(component_id, id)
);

CREATE TABLE subcircuits_definition (
  id TEXT PRIMARY KEY,
  parent_component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  graph_json TEXT NOT NULL CHECK(json_valid(graph_json)),
  external_pin_mapping_json TEXT NOT NULL CHECK(json_valid(external_pin_mapping_json)),
  depth_hint INTEGER NOT NULL DEFAULT 1 CHECK(depth_hint >= 1)
);

CREATE TABLE simulation_parameters (
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK(value_type IN ('number','boolean','text','enum')),
  unit TEXT NOT NULL DEFAULT '',
  default_value TEXT NOT NULL,
  min_value REAL,
  max_value REAL,
  step_value REAL,
  options_json TEXT CHECK(options_json IS NULL OR json_valid(options_json)),
  PRIMARY KEY(component_id, key)
);

CREATE INDEX idx_components_category ON components(category_id, name);
CREATE INDEX idx_pins_component ON pins(component_id, electrical_order);
CREATE INDEX idx_svg_component_lod ON svg_definitions(component_id, lod_level);

CREATE VIEW component_catalog AS
SELECT c.id, c.name, c.family, c.description, c.tags_json,
       c.default_properties_json, c.simulation_model, c.symbol_key,
       c.is_subcircuit, c.has_custom_gui, c.min_lod_level,
       c.width, c.height, cat.id AS category_id, cat.name AS category_name
FROM components c JOIN categories cat ON cat.id = c.category_id;

