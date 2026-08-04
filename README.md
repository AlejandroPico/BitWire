# BitWire

BitWire es un editor vectorial multiescala para diseñar, inspeccionar y simular circuitos eléctricos, electrónicos y digitales directamente en el navegador. El proyecto está preparado para GitHub Pages: no necesita servidor, cuenta ni instalación para abrir y editar un circuito.

La primera versión funcional incluye un plano SVG de profundidad semántica, cableado interactivo, simulación desacoplada del render, módulos encapsulables, instrumentación y proyectos portables `.bitwire`.

## Lo que ya funciona

- Plano técnico virtualmente infinito con desplazamiento, zoom práctico hasta `1.000.000.000×`, rejilla adaptativa y encaje automático.
- Cinco niveles de detalle: encapsulado, esquemático, funcional, dispositivo y físico.
- Escala de inserción dependiente del zoom: una pieza conserva el tamaño visual con el que fue colocada y revela su escala relativa al alejarse.
- Catálogo de **216 componentes** repartidos entre electricidad, semiconductores, RF, analógica, potencia, sensores, lógica, memorias, comunicaciones, audio, visualización e instrumentación.
- Símbolos SVG nativos: no se utilizan bitmaps para los elementos del circuito.
- Inserción mediante arrastre o doble clic, movimiento con ajuste a rejilla, selección múltiple, duplicado, giro, bloqueo y borrado seguro de conexiones.
- Cableado terminal a terminal con rutas ortogonales, Bézier o rectas.
- Edición manual de cables: arrastre directo, nodos mediante doble clic, asas desplazables y cambio de ruta por conexión.
- Motor de simulación en `Web Worker` con ejecución, pausa, paso y velocidades de `0,25×` a `10×`.
- Propagación de fuentes CC/CA, interruptores, cargas, pasivos, entradas digitales, reloj y puertas AND, OR, NOT, NAND, NOR, XOR y XNOR.
- Visualización sobre el cable de tensión, corriente, potencia o estado lógico.
- Accionamiento directo de interruptores y entradas binarias desde el plano.
- Osciloscopio y analizador lógico vectoriales con captura en vivo.
- Encapsulados funcionales redimensionables y anidables sin límite práctico, con lienzo interno propio, navegación jerárquica, terminales fijos de borde, modo chip y patillas configurables.
- Biblioteca local de encapsulados, importación y exportación `.bitwire-module` y reutilización entre proyectos.
- Inspector editable con parámetros eléctricos, posición, rotación, estado y conectividad.
- Inspector lateral mediante doble clic y parámetros editables directamente dentro del elemento al alcanzar el LOD físico.
- Redes internas equivalentes y CMOS para AND, OR, NOT, NAND, NOR, XOR y XNOR; estructura P–N, BJT y MOS visible mediante zoom semántico.
- Displays vectoriales de uno y cuatro dígitos, LCD 16×2, matriz LED 8×8 y barra de diez segmentos.
- Temas plano técnico, noche, día y automático.
- Deshacer/rehacer, guardado local, importación y exportación `.bitwire`.
- Proyecto inicial con un circuito eléctrico de 5 V y un demostrador lógico AND.

## Arquitectura

```text
BitWire/
├── catalog/                 Esquema SQLite, definiciones y compilador del catálogo
├── core-engine/             Contrato estable del futuro núcleo Rust/WASM
├── ui-app/
│   ├── src/canvas/          Matriz de vista, LOD y rutas de cables
│   ├── src/catalog/         Carga SQLite y respaldo integrado
│   ├── src/components/      Interfaz y render SVG
│   ├── src/engine/          Simulación determinista + Web Worker
│   ├── src/model/           Contrato de proyecto y señales
│   ├── src/state/           Historial y creación de grafos
│   └── src/utils/           Persistencia e intercambio .bitwire
└── .github/workflows/       Validación y despliegue automático a Pages
```

La interfaz no contiene la lógica de simulación. El grafo de circuito se serializa y se entrega a un trabajador aislado; el render consume instantáneas inmutables. `core-engine` fija desde ahora las estructuras jerárquicas y la frontera WASM para migrar cálculos intensivos sin alterar el formato de proyecto ni rehacer el editor.

El catálogo se mantiene como JSON legible y se compila a una base SQLite validada. La aplicación verifica `catalog.db` mediante `sql.js` y conserva un catálogo integrado como arranque seguro.

## Desarrollo local

Requisitos: Node.js 22 y Python 3.12.

```bash
python catalog/generate_db.py --output ui-app/public/catalog.db
cd ui-app
npm install
npm run dev
```

Validación completa:

```bash
cd ui-app
npm test
npm run build
```

## Controles

| Acción | Control |
|---|---|
| Seleccionar | `V` |
| Cablear | `W` y clic en dos terminales |
| Desplazar | `H`, botón central o `Espacio` + arrastre |
| Selección múltiple | `Mayús` + clic o recuadro |
| Encapsular | herramienta de módulo + recuadro |
| Zoom semántico | rueda del ratón; el doble clic selecciona y abre el inspector lateral |
| Eliminar | `Supr` |
| Guardar | `Ctrl+S` |
| Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Y` |

## Formato `.bitwire`

Un archivo BitWire es JSON versionado y contiene metadatos, instancias, propiedades, terminales conectados, rutas, encapsulados y preferencias de visualización. La importación valida referencias antes de sustituir el proyecto abierto.

## Próximas capas

La estructura actual deja preparadas las siguientes ampliaciones sin romper los proyectos existentes:

1. Solver analógico MNA completo en Rust/WASM y modelos SPICE.
2. Retardos de propagación, buses, alta impedancia y resolución de conflictos digitales.
3. Apertura real de subgrafos anidados e importación de un proyecto como símbolo reutilizable.
4. Autorouter Manhattan con evitación de obstáculos y edición de vértices.
5. PCB, encapsulados físicos, footprints y reglas DRC/ERC.
6. Más instrumentos: generador de funciones, analizador de espectro y protocolo, fuente de laboratorio.
7. Catálogo ampliable por paquetes de componentes versionados.

## Licencia

MIT © 2026 Alejandro Pico.
