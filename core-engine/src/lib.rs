use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PinKind { Input, Output, Bidirectional, Power, Vcc, Gnd, Analog }

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SignalDomain { Analog, Digital, Mixed, Power }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PinRef { pub component_id: String, pub pin_id: String }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Point2D { pub x: f64, pub y: f64 }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transform2D {
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub scale_x: f64,
    pub scale_y: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ComponentInstance {
    pub id: String,
    pub definition_id: String,
    pub transform: Transform2D,
    pub properties: BTreeMap<String, serde_json::Value>,
    pub enabled: bool,
    pub child_graph: Option<Box<CircuitGraph>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Wire {
    pub id: String,
    pub from: PinRef,
    pub to: PinRef,
    pub label: Option<String>,
    #[serde(default)]
    pub control_points: Vec<Point2D>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModulePin {
    pub id: String,
    pub name: String,
    pub kind: PinKind,
    pub domain: SignalDomain,
    pub side: String,
    pub position: f64,
    pub nominal_voltage: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CircuitModule {
    pub id: String,
    pub name: String,
    pub bounds: [f64; 4],
    pub member_ids: Vec<String>,
    pub pins: Vec<ModulePin>,
    pub enabled: bool,
    pub collapsed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct CircuitGraph {
    pub id: String,
    pub name: String,
    pub components: BTreeMap<String, ComponentInstance>,
    pub wires: BTreeMap<String, Wire>,
    #[serde(default)]
    pub modules: BTreeMap<String, CircuitModule>,
    pub external_pins: BTreeMap<String, PinRef>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum LodLevel { Package = 0, Transition = 1, Functional = 2, Device = 3, Physical = 4 }

pub fn lod_for_scale(scale: f64) -> LodLevel {
    match scale {
        s if s < 0.45 => LodLevel::Package,
        s if s < 1.4 => LodLevel::Transition,
        s if s < 3.0 => LodLevel::Functional,
        s if s < 7.0 => LodLevel::Device,
        _ => LodLevel::Physical,
    }
}

#[wasm_bindgen]
pub fn validate_project(project_json: &str) -> Result<String, JsValue> {
    let graph: CircuitGraph = serde_json::from_str(project_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    for wire in graph.wires.values() {
        if !graph.components.contains_key(&wire.from.component_id)
            || !graph.components.contains_key(&wire.to.component_id) {
            return Err(JsValue::from_str(&format!("Cable {} referencia un componente inexistente", wire.id)));
        }
    }
    serde_json::to_string(&graph).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lod_boundaries_are_stable() {
        assert_eq!(lod_for_scale(0.1), LodLevel::Package);
        assert_eq!(lod_for_scale(1.0), LodLevel::Transition);
        assert_eq!(lod_for_scale(4.0), LodLevel::Device);
        assert_eq!(lod_for_scale(20.0), LodLevel::Physical);
    }
}
