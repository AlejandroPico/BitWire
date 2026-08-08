#!/usr/bin/env python3
"""Compile BitWire's human-editable catalog into a deterministic SQLite database."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def pins_for(profile: str) -> list[dict]:
    pin = lambda ident, name, kind, domain, x, y: {
        "id": ident, "name": name, "kind": kind, "domain": domain, "x": x, "y": y
    }
    profiles = {
        "power": [pin("neg", "−", "GND", "POWER", 0, .7), pin("pos", "+", "POWER", "POWER", 1, .3)],
        "ground": [pin("gnd", "GND", "GND", "POWER", .5, 0)],
        "analog2": [pin("a", "A", "ANALOG", "ANALOG", 0, .5), pin("b", "B", "ANALOG", "ANALOG", 1, .5)],
        "analog3": [pin("a", "A", "ANALOG", "ANALOG", 0, .3), pin("w", "W", "ANALOG", "ANALOG", 1, .5), pin("b", "B", "ANALOG", "ANALOG", 0, .7)],
        "digital_out": [pin("out", "Q", "OUTPUT", "DIGITAL", 1, .5)],
        "gate1": [pin("in", "A", "INPUT", "DIGITAL", 0, .5), pin("out", "Q", "OUTPUT", "DIGITAL", 1, .5)],
        "gate2": [pin("a", "A", "INPUT", "DIGITAL", 0, .33), pin("b", "B", "INPUT", "DIGITAL", 0, .67), pin("out", "Q", "OUTPUT", "DIGITAL", 1, .5)],
        "transistor": [pin("b", "B/G", "INPUT", "MIXED", 0, .5), pin("c", "C/D", "ANALOG", "ANALOG", 1, .25), pin("e", "E/S", "ANALOG", "ANALOG", 1, .75)],
        "opamp": [pin("plus", "+", "INPUT", "ANALOG", 0, .35), pin("minus", "−", "INPUT", "ANALOG", 0, .65), pin("out", "OUT", "OUTPUT", "ANALOG", 1, .5)],
        "probe1": [pin("in", "IN", "INPUT", "MIXED", 0, .5)],
        "probe2": [pin("plus", "+", "INPUT", "ANALOG", 0, .35), pin("minus", "−", "INPUT", "ANALOG", 0, .65)],
        "scope": [pin("ch1", "CH1", "INPUT", "ANALOG", 0, .35), pin("ch2", "CH2", "INPUT", "ANALOG", 0, .65), pin("gnd", "GND", "GND", "POWER", 1, .8)],
        "connector2": [pin("p1", "1", "BIDIRECTIONAL", "MIXED", 0, .35), pin("p2", "2", "BIDIRECTIONAL", "MIXED", 0, .65)],
        "junction": [pin("node", "●", "BIDIRECTIONAL", "MIXED", .5, .5)],
    }
    if profile in profiles:
        return profiles[profile]
    if profile == "transformer":
        return [pin("p1","P1","ANALOG","ANALOG",0,.3),pin("p2","P2","ANALOG","ANALOG",0,.7),pin("s1","S1","ANALOG","ANALOG",1,.3),pin("s2","S2","ANALOG","ANALOG",1,.7)]
    if profile == "relay":
        return [pin("coil_a","A1","INPUT","ANALOG",0,.25),pin("coil_b","A2","INPUT","ANALOG",0,.75),pin("com","COM","ANALOG","ANALOG",1,.5),pin("no","NO","ANALOG","ANALOG",1,.25),pin("nc","NC","ANALOG","ANALOG",1,.75)]
    if profile == "bridge":
        return [pin("ac1","~","ANALOG","ANALOG",0,.3),pin("ac2","~","ANALOG","ANALOG",0,.7),pin("pos","+","OUTPUT","ANALOG",1,.3),pin("neg","−","OUTPUT","ANALOG",1,.7)]
    if profile in {"chip4", "converter"}:
        return [pin("in","IN","INPUT","DIGITAL",0,.5),pin("out","OUT","OUTPUT","DIGITAL",1,.5),pin("vcc","VCC","VCC","POWER",.35,0),pin("gnd","GND","GND","POWER",.65,1)]
    if profile == "chip8":
        return [pin(f"p{i}",str(i),"BIDIRECTIONAL","MIXED",0 if i <= 4 else 1,(i if i <= 4 else i-4)/5) for i in range(1,9)]
    if profile == "dff":
        return [pin("d","D","INPUT","DIGITAL",0,.3),pin("clk","CLK","INPUT","DIGITAL",0,.7),pin("q","Q","OUTPUT","DIGITAL",1,.3),pin("nq","Q̅","OUTPUT","DIGITAL",1,.7)]
    if profile == "mux":
        return [pin("a","A","INPUT","DIGITAL",0,.25),pin("b","B","INPUT","DIGITAL",0,.55),pin("sel","S","INPUT","DIGITAL",0,.82),pin("out","Q","OUTPUT","DIGITAL",1,.5)]
    if profile == "display7":
        return [pin(name,name.upper(),"INPUT","DIGITAL",0,(i+1)/9) for i,name in enumerate("abcdefg")]
    if profile == "display4":
        return [pin(name,name.upper(),"INPUT","DIGITAL",0,(i+1)/9) for i,name in enumerate("abcdefg")] + [pin(f"digit{i+1}",f"D{i+1}","INPUT","DIGITAL",1,(i+1)/5) for i in range(4)]
    if profile == "lcd16x2":
        return [pin(f"d{i}",f"D{i}","INPUT","DIGITAL",0,(i+1)/10) for i in range(8)] + [pin("rs","RS","INPUT","DIGITAL",1,.25),pin("enable","E","INPUT","DIGITAL",1,.45),pin("vcc","VCC","VCC","POWER",1,.65),pin("gnd","GND","GND","POWER",1,.82)]
    if profile == "matrix8":
        return [pin(f"row{i}",f"R{i}","INPUT","DIGITAL",0,(i+1)/9) for i in range(8)] + [pin(f"col{i}",f"C{i}","INPUT","DIGITAL",1,(i+1)/9) for i in range(8)]
    if profile == "bargraph10":
        return [pin(f"s{i+1}",str(i+1),"INPUT","DIGITAL",0,(i+1)/11) for i in range(10)]
    if profile == "analyzer":
        return [pin(f"ch{i}",f"D{i}","INPUT","DIGITAL",0,(i+1)/9) for i in range(8)]
    if profile == "rf3":
        return [pin("rf_in","RF IN","INPUT","ANALOG",0,.35),pin("control","CTRL","INPUT","MIXED",0,.75),pin("rf_out","RF OUT","OUTPUT","ANALOG",1,.5)]
    if profile == "sensor3":
        return [pin("vcc","VCC","VCC","POWER",0,.25),pin("gnd","GND","GND","POWER",0,.75),pin("out","OUT","OUTPUT","MIXED",1,.5)]
    if profile == "switch3":
        return [pin("com","COM","BIDIRECTIONAL","MIXED",0,.5),pin("a","A","BIDIRECTIONAL","MIXED",1,.3),pin("b","B","BIDIRECTIONAL","MIXED",1,.7)]
    if profile == "fulladder":
        return [pin("a","A","INPUT","DIGITAL",0,.25),pin("b","B","INPUT","DIGITAL",0,.5),pin("cin","CIN","INPUT","DIGITAL",0,.75),pin("sum","Σ","OUTPUT","DIGITAL",1,.35),pin("cout","COUT","OUTPUT","DIGITAL",1,.68)]
    if profile == "gate3":
        return [pin("a","A","INPUT","DIGITAL",0,.22),pin("b","B","INPUT","DIGITAL",0,.5),pin("c","C","INPUT","DIGITAL",0,.78),pin("out","Q","OUTPUT","DIGITAL",1,.5)]
    if profile == "bus8":
        return [pin(f"d{i}",f"D{i}","BIDIRECTIONAL","DIGITAL",0 if i < 4 else 1,((i%4)+1)/5) for i in range(8)]
    return profiles["analog2"]


def build(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    catalog = json.loads((ROOT / "components.json").read_text(encoding="utf-8"))
    catalog += json.loads((ROOT / "expanded-components.json").read_text(encoding="utf-8"))
    schema = (ROOT / "schema.sql").read_text(encoding="utf-8")
    db = sqlite3.connect(output)
    db.executescript(schema)
    categories = sorted({item["category"] for item in catalog})
    db.executemany("INSERT INTO categories(id,name,sort_order) VALUES(?,?,?)", [
        (f"cat_{i:02d}", name, i) for i, name in enumerate(categories)
    ])
    category_ids = {name: f"cat_{i:02d}" for i, name in enumerate(categories)}
    for item in catalog:
        db.execute("""INSERT INTO components
          (id,name,category_id,family,description,tags_json,default_properties_json,
           simulation_model,symbol_key,is_subcircuit,has_custom_gui,min_lod_level,width,height)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            item["id"], item["name"], category_ids[item["category"]], item["family"],
            item["description"], json.dumps(item.get("tags", []), ensure_ascii=False),
            json.dumps(item.get("defaults", {}), ensure_ascii=False), item["model"], item["symbol"],
            int("internal" in item), int(item.get("customGui", False)), 0, 160, 80,
        ))
        for order, p in enumerate(pins_for(item["profile"])):
            db.execute("INSERT INTO pins VALUES(?,?,?,?,?,?,?,?)", (
                p["id"], item["id"], p["name"], p["kind"], p["domain"], p["x"], p["y"], order
            ))
        # Templates remain raw SVG and vector-only. The renderer may replace them with richer LOD symbols.
        macro = f'<svg viewBox="0 0 160 80"><rect x="1" y="1" width="158" height="78" fill="none" stroke="currentColor"/><text x="80" y="44" text-anchor="middle">{item["name"]}</text></svg>'
        db.execute("INSERT INTO svg_definitions(component_id,standard,lod_level,svg_raw) VALUES(?,?,?,?)", (item["id"], "BOTH", 0, macro))
    db.commit()
    result = db.execute("PRAGMA integrity_check").fetchone()[0]
    count = db.execute("SELECT COUNT(*) FROM components").fetchone()[0]
    db.close()
    if result != "ok":
        raise RuntimeError(result)
    print(f"BitWire catalog: {count} components -> {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "catalog.db")
    build(parser.parse_args().output)
