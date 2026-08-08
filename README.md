# BitWire

BitWire es un editor vectorial multiescala para diseñar, inspeccionar y simular circuitos eléctricos, electrónicos y digitales directamente en el navegador. El proyecto está preparado para GitHub Pages: no necesita servidor, cuenta ni instalación para abrir y editar un circuito.

La primera versión funcional incluye un plano SVG de profundidad semántica, cableado interactivo, simulación desacoplada del render, módulos encapsulables, instrumentación y proyectos portables `.bitwire`.

## Lo que ya funciona

- Plano técnico virtualmente infinito con desplazamiento, zoom práctico hasta `1.000.000.000×`, rejilla adaptativa y encaje automático.
- Cinco niveles de detalle: encapsulado, esquemático, funcional, dispositivo y físico.
- Escala de inserción dependiente del zoom: una pieza conserva el tamaño visual con el que fue colocada y revela su escala relativa al alejarse.
- Catálogo de **235 componentes** repartidos entre electricidad, semiconductores, RF, analógica, potencia, sensores, lógica, memorias, comunicaciones, audio, visualización e instrumentación.
- Símbolos SVG nativos: no se utilizan bitmaps para los elementos del circuito.
- Inserción mediante arrastre o doble clic, movimiento con ajuste a rejilla, selección múltiple, duplicado, giro, bloqueo y borrado seguro de conexiones.
- Paleta vertical integrada en el lienzo para seleccionar, cablear, desplazar y crear encapsulados sin cargar la cabecera.
- Cableado terminal a terminal con rutas ortogonales, Bézier o rectas.
- Edición manual de cables: arrastre directo, nodos eléctricos conectables mediante doble clic, asas desplazables y cambio de ruta por conexión.
- Control central de simulación con ejecución, pausa y paso, más una escala temporal logarítmica manejable con ratón entre `0,0001×` y `10×` sobre un motor aislado en `Web Worker`.
- Solver nodal MNA con fuentes CC/CA, fuentes de corriente, resistencias, potenciómetros, condensadores e inductores con estado transitorio, interruptores, cargas, diodos, transistores y etapas analógicas básicas.
- Corriente calculada con signo y conservación de Kirchhoff: el sentido y la velocidad de la animación responden al resultado eléctrico, incluidos retornos a masa y medios ciclos negativos de CA.
- Puertas AND, OR, NOT, NAND, NOR, XOR y XNOR configurables con hasta 10 entradas y 10 salidas físicas por instancia.
- Visualización sobre el cable de tensión, corriente, potencia o estado lógico mediante menús propios de superficie completa, sin depender de pequeños selectores nativos.
- Accionamiento directo de interruptores y entradas binarias desde el plano.
- Banco de instrumentación multivista y persistente: osciloscopio, analizador lógico, multímetro, monitor de potencia, analizador de espectro y frecuencímetro; cualquier combinación puede mostrarse u ocultarse.
- Captura independiente por aparato: osciloscopios, medidores, analizadores y sondas leen únicamente sus redes o un componente vinculado mediante una sonda virtual de alta impedancia.
- Menús contextuales propios mediante botón derecho para componentes, conexiones, lienzo y encapsulados; el menú nativo del navegador queda bloqueado dentro del laboratorio.
- Ventanas de instrumento movibles, redimensionables, minimizables, maximizables y ordenadas por foco, con extensión a frontales profesionales de adquisición, disparo, escalas, rangos y filtros.
- Encapsulados funcionales redimensionables y anidables sin límite práctico, con color diferenciado al crearlos, lienzo interno propio, animación de corriente coloreada, navegación jerárquica, terminales fijos de borde, modo chip y patillas configurables.
- Biblioteca local de encapsulados, importación y exportación `.bitwire-module` y reutilización entre proyectos.
- Inspector editable con nombre propio por elemento, parámetros eléctricos en notación SI (`15 µF`, `4,7 kΩ`), posición, rotación, estado y conectividad.
- Interfaz de trabajo compacta con contador de catálogo `visibles / total`, título de proyecto centrado, inspector abierto al iniciar y barra superior separada del plano.
- Manual interactivo con búsqueda, índice navegable y doce tutoriales desarrollados sobre edición, simulación, encapsulados, instrumentos, LOD, archivos y diagnóstico.
- Inspector lateral mediante doble clic y parámetros editables directamente dentro del elemento al alcanzar el LOD físico.
- Redes internas equivalentes y CMOS para AND, OR, NOT, NAND, NOR, XOR y XNOR; estructura P–N, BJT y MOS visible mediante zoom semántico.
- Displays vectoriales de uno y cuatro dígitos, LCD 16×2, matriz LED 8×8 y barra de diez segmentos.
- Diez temas integrales y persistentes: automático por hora local, mañana, tarde, noche, BitWire clásico, plano azul con interfaz de madera, laboratorio, terminal, pizarra y pergamino.
- Control rápido de aspecto: clic en el icono para recorrer `Automático → Mañana → Tarde → Noche`; `Alt + clic` abre el selector visual completo.
- Deshacer/rehacer, guardado local, importación y exportación `.bitwire`.
- Ventana «Acerca de» con autoría, enlaces al repositorio y al portfolio.
- Aplicación de escritorio portable basada en Electron: `.exe` para Windows, aplicación universal para macOS y AppImage para Linux, generadas automáticamente desde `main`.
- Selector «Modo offline» que detecta el sistema operativo y ofrece el paquete autocontenido correcto, sin instalación, consola ni dependencias de desarrollo.
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
│   ├── src/utils/           Persistencia e intercambio .bitwire
│   └── desktop/             Ventana nativa y política segura de enlaces externos
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

Abrir la aplicación de escritorio durante el desarrollo:

```bash
cd ui-app
npm run desktop
```

Los paquetes finales no se compilan en el ordenador del usuario. El flujo `Build portable desktop apps` produce previamente cada binario autocontenido y los publica en la versión `desktop-latest` de GitHub Releases.

## Controles

| Acción | Control |
|---|---|
| Seleccionar | paleta vertical del lienzo o `V` |
| Cablear | paleta vertical, o `W`, y clic en dos terminales |
| Desplazar | paleta vertical, `H`, botón central o `Espacio` + arrastre |
| Selección múltiple | `Mayús` + clic o recuadro |
| Encapsular | herramienta de módulo + recuadro |
| Zoom semántico | rueda del ratón; el doble clic selecciona y abre el inspector lateral |
| Menú del objeto | botón derecho sobre componente, cable, encapsulado o lienzo |
| Interfaz de instrumento | botón derecho → `Abrir interfaz del instrumento` |
| Cambiar tema | clic en el icono de aspecto; `Alt` + clic abre el menú completo |
| Descargar la aplicación | `Modo offline` después de `Exportar` |
| Eliminar | `Supr` |
| Guardar | `Ctrl+S` |
| Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Y` |

## Formato `.bitwire`

Un archivo BitWire es JSON versionado y contiene metadatos, instancias, propiedades, terminales conectados, rutas, encapsulados y preferencias de visualización. La importación valida referencias antes de sustituir el proyecto abierto.

## Próximas capas

La estructura actual deja preparadas las siguientes ampliaciones sin romper los proyectos existentes:

1. Migración opcional del solver MNA a Rust/WASM y ampliación progresiva con modelos SPICE de precisión.
2. Retardos de propagación, buses, alta impedancia y resolución de conflictos digitales.
3. Apertura real de subgrafos anidados e importación de un proyecto como símbolo reutilizable.
4. Autorouter Manhattan con evitación de obstáculos y edición de vértices.
5. PCB, encapsulados físicos, footprints y reglas DRC/ERC.
6. Más instrumentos: generador de funciones, analizador de protocolos y fuente de laboratorio regulable.
7. Catálogo ampliable por paquetes de componentes versionados.

## Licencia

MIT © 2026 Alejandro Pico.
