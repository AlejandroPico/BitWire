import {
  Activity, BookOpen, Box, Cable, ChevronLeft, ChevronRight, CircleHelp,
  Cpu, FolderOpen, Gauge, Layers3, MousePointer2, Search, Sparkles, Wrench, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props { onClose(): void }

interface GuideSection {
  id: string;
  group: string;
  title: string;
  summary: string;
  icon: typeof BookOpen;
  steps: string[];
  details: Array<{ title: string; text: string }>;
  note: string;
}

const GUIDE: GuideSection[] = [
  {
    id: 'inicio', group: 'EMPEZAR', title: 'Primer circuito en cinco minutos', icon: Sparkles,
    summary: 'Construye, conecta y ejecuta un circuito sencillo sin necesitar conocimientos previos del editor.',
    steps: [
      'Localiza Fuente CC, Interruptor SPST, Resistencia, Lámpara y Tierra en el catálogo izquierdo.',
      'Arrastra cada símbolo al lienzo. BitWire conserva el tamaño visual correspondiente al nivel de zoom de inserción.',
      'Pulsa W o el icono de cable, selecciona un terminal y después el terminal de destino.',
      'Selecciona cada componente para ajustar tensión, resistencia o estado desde el inspector.',
      'Pulsa Ejecutar. Los tramos activos muestran pulsos móviles y las etiquetas indican la magnitud seleccionada.',
    ],
    details: [
      { title: 'Qué debes ver', text: 'Un recorrido cerrado desde la fuente hasta tierra. Si el interruptor está abierto, el flujo se detiene; al cerrarlo, la línea activa vuelve a animarse.' },
      { title: 'Si algo no funciona', text: 'Busca terminales sin conectar, componentes desactivados y avisos en la esquina inferior derecha. Una red flotante no tiene referencia eléctrica completa.' },
      { title: 'Guardar el trabajo', text: 'Ctrl+S conserva el proyecto en este navegador. Exportar genera un archivo .bitwire para archivarlo o trasladarlo a otro equipo.' },
    ],
    note: 'Consejo: empieza con pocos componentes y ejecuta después de cada cambio. Así sabrás exactamente qué modificación altera el circuito.',
  },
  {
    id: 'lienzo', group: 'FUNDAMENTOS', title: 'Lienzo, cámara y navegación', icon: MousePointer2,
    summary: 'Domina el plano virtual, el desplazamiento y la escala práctica de hasta 1.000.000.000×.',
    steps: [
      'Usa la rueda sobre el punto que quieras ampliar; ese punto permanece anclado bajo el cursor.',
      'Mantén Espacio y arrastra, utiliza el botón central o activa la herramienta Mano con H.',
      'Pulsa Encajar proyecto para recuperar todos los elementos visibles cuando te hayas alejado demasiado.',
      'Usa Centrar origen para volver al punto de referencia del plano sin modificar los componentes.',
    ],
    details: [
      { title: 'Rejilla adaptativa', text: 'La separación visible cambia automáticamente con el zoom. El tamaño lógico de la cuadrícula sigue siendo estable para el encaje.' },
      { title: 'Escala de inserción', text: 'Un elemento colocado con mucho zoom puede ser microscópico respecto a otro insertado desde una vista general. Esta diferencia es intencionada.' },
      { title: 'Ruta del lienzo', text: 'La miga de navegación superior indica si trabajas en el proyecto o dentro de un encapsulado. Cada nombre es un botón para regresar a ese nivel.' },
      { title: 'Herramientas y cámara', text: 'Cambiar entre Selección, Cable y Mano no altera el circuito. Escape cancela la acción actual y vuelve a la herramienta de selección.' },
    ],
    note: 'El zoom no abre ventanas ni sustituye el lienzo: aumenta progresivamente la información que se dibuja dentro de cada objeto.',
  },
  {
    id: 'catalogo', group: 'FUNDAMENTOS', title: 'Catálogo y colocación de componentes', icon: Layers3,
    summary: 'Encuentra símbolos entre las categorías eléctricas, digitales, analógicas, RF, sensores y procesamiento.',
    steps: [
      'Escribe nombre, familia o función en el buscador del catálogo.',
      'Expande una categoría y arrastra el componente al punto exacto del plano.',
      'También puedes hacer doble clic para insertarlo en el centro de la vista.',
      'Selecciona varios elementos con Mayús o dibujando un recuadro sobre el lienzo.',
    ],
    details: [
      { title: 'Símbolos repetidos', text: 'Un mismo concepto puede aparecer en distintas categorías cuando tiene usos eléctricos y electrónicos diferentes.' },
      { title: 'Vectorial de verdad', text: 'Los símbolos se generan como geometría SVG. No pierden definición al ampliar y pueden revelar representaciones internas adicionales.' },
      { title: 'Duplicar y girar', text: 'El inspector ofrece acciones rápidas. La duplicación conserva parámetros y la rotación transforma también la posición de sus terminales.' },
      { title: 'Elementos complejos', text: 'Pantallas, osciloscopios, memorias y procesadores son macromodelos. Su comportamiento y profundidad visual se ampliarán progresivamente.' },
      { title: 'Displays LED', text: 'A–G controlan individualmente los siete segmentos; D1–D4 seleccionan el dígito multiplexado; la matriz cruza R0–R7 con C0–C7 y la barra responde a sus diez entradas.' },
    ],
    note: 'El catálogo SQLite y el catálogo integrado contienen las mismas definiciones; el indicador superior informa de la fuente cargada.',
  },
  {
    id: 'inspector', group: 'EDICIÓN', title: 'Selección, valores e inspector', icon: Wrench,
    summary: 'Edita parámetros eléctricos, posición, estado y conectividad sin perder espacio de lienzo.',
    steps: [
      'Haz clic sobre un componente o encapsulado para seleccionarlo.',
      'Haz doble clic para abrir el inspector lateral cuando esté plegado.',
      'Modifica el valor y pulsa fuera del campo; el motor recibe el proyecto actualizado.',
      'Usa la papelera del inspector o Supr para eliminar la selección y sus conexiones asociadas.',
    ],
    details: [
      { title: 'Edición interna', text: 'Cuando el nivel de detalle es suficiente, determinados valores aparecen dentro del propio símbolo y pueden cambiarse sin abrir el panel.' },
      { title: 'Bloqueo y estado', text: 'Desactivar un elemento lo mantiene en el plano, pero lo excluye de la simulación. El inspector refleja su estado actual.' },
      { title: 'Selección múltiple', text: 'Mayús permite acumular elementos. Las operaciones colectivas deben realizarse con cuidado porque afectan a todas las piezas seleccionadas.' },
      { title: 'Deshacer y rehacer', text: 'Ctrl+Z y Ctrl+Y recuperan cambios de estructura y propiedades. La simulación se recalcula con la versión restaurada.' },
    ],
    note: 'El inspector comienza plegado para reservar espacio al plano y se abre automáticamente cuando una acción necesita mostrar propiedades.',
  },
  {
    id: 'cables', group: 'EDICIÓN', title: 'Cableado, nodos y rutas', icon: Cable,
    summary: 'Crea conexiones rectas, ortogonales o Bézier y reorganiza su recorrido sin alterar la red eléctrica.',
    steps: [
      'Activa Cable desde la paleta vertical del lienzo —o con W— y pulsa un terminal disponible.',
      'Pulsa el segundo terminal. BitWire crea una red con el estilo elegido en Configuración —el engranaje superior derecho—.',
      'Selecciona el cable para abrir el editor flotante de conexión.',
      'Haz doble clic en un tramo para convertir ese punto en un nodo eléctrico conectable y arrástralo hasta despejar el esquema.',
      'Con Cable activo, pulsa un nodo para iniciar o terminar allí una derivación. Los puntos de control puramente geométricos siguen siendo editables.',
    ],
    details: [
      { title: 'Ortogonal', text: 'Produce ángulos rectos y es la opción más legible para planos densos.' },
      { title: 'Bézier', text: 'Utiliza los nodos como puntos de control para formar curvas suaves y separar redes superpuestas.' },
      { title: 'Recta', text: 'Une los terminales por el camino mínimo. Resulta útil en diseños sencillos y conexiones internas cortas.' },
      { title: 'Etiqueta anclada', text: 'La lectura de tensión, corriente, lógica o potencia se coloca a mitad de la longitud real del trazado. Al mover o eliminar nodos, acompaña siempre al cable.' },
      { title: 'Nodo eléctrico', text: 'Un nodo visible no es solo una esquina: divide el conductor conservando la misma red y admite nuevas ramas. La suma de corrientes respeta Kirchhoff.' },
      { title: 'Lectura del flujo', text: 'Los pulsos aparecen solo cuando existe corriente calculada. Su sentido sigue el signo y su velocidad aumenta con la magnitud.' },
    ],
    note: 'Mover un nodo cambia solamente la geometría visual. Los extremos eléctricos continúan conectados a los mismos terminales.',
  },
  {
    id: 'simulacion', group: 'SIMULACIÓN', title: 'Ejecutar, pausar y leer señales', icon: Cpu,
    summary: 'Comprende qué calcula el motor y cómo interpretar tensión, corriente, potencia y lógica.',
    steps: [
      'Abre el engranaje superior derecho y selecciona la magnitud visible: Tensión, Corriente, Lógica 0/1 o Potencia.',
      'Usa el bloque central destacado: Ejecutar inicia la simulación continua y Paso avanza una iteración estando en pausa.',
      'Ajusta la velocidad entre 0,25× y 10× según necesites observar transitorios o estados estables.',
      'Lee las etiquetas sobre cada red y consulta los instrumentos para estudiar su evolución temporal.',
    ],
    details: [
      { title: 'Tensión', text: 'Es la diferencia de potencial entre la red y su referencia. Se expresa normalmente en voltios.' },
      { title: 'Corriente', text: 'Indica el flujo eléctrico estimado. BitWire muestra amperios o miliamperios según la magnitud.' },
      { title: 'Potencia', text: 'Se calcula a partir de tensión y corriente. Permite localizar cargas y etapas con mayor consumo.' },
      { title: 'Lógica', text: 'Los estados digitales pueden ser 0, 1, flotante Z o indeterminado. Una entrada sin referencia no siempre equivale a cero.' },
      { title: 'Animación de corriente', text: 'Está activada por defecto. Puede ocultarse desde Configuración sin detener el motor ni alterar el cálculo eléctrico.' },
      { title: 'Cálculo analógico', text: 'El motor construye la red nodal, estampa fuentes y elementos y resuelve el sistema lineal en cada paso. Condensadores e inductores conservan estado entre iteraciones.' },
      { title: 'Unidades SI', text: 'El inspector acepta 15uF, 4,7 kΩ o 2Meg y muestra automáticamente µ, n, k o M para evitar cadenas de ceros.' },
    ],
    note: 'Los colores ayudan a distinguir estados, pero el valor numérico o lógico de la etiqueta es la referencia principal.',
  },
  {
    id: 'encapsulados', group: 'ARQUITECTURA', title: 'Encapsulados y lienzos internos', icon: Box,
    summary: 'Agrupa circuitos, define patillas externas y construye chips reutilizables con niveles internos anidados.',
    steps: [
      'Activa Crear encapsulado y dibuja el rectángulo que contendrá el circuito.',
      'Selecciona el área para redimensionarla, nombrarla y elegir si se presenta como área o como chip.',
      'Usa la barra superior de patillas para añadir entradas o salidas a izquierda, derecha, arriba o abajo. BitWire las reparte de forma equidistante en cada lado.',
      'Abre el lienzo interno y conecta los terminales fijos del borde con los componentes del circuito.',
      'Guarda el encapsulado en la biblioteca o expórtalo como .bitwire-module.',
    ],
    details: [
      { title: 'Mapa exterior protegido', text: 'Desde el nivel superior se muestra un resumen autoajustado y recortado dentro del contorno. Ese mapa no se puede seleccionar, mover ni borrar: el encapsulado se comporta como una sola pieza.' },
      { title: 'Interior independiente', text: 'El contenido usa su propio lienzo y su propia cámara. Haz doble clic o usa Entrar en el lienzo interno para editarlo.' },
      { title: 'Comunicación exterior', text: 'Las patillas son la única frontera pública. Los cables que intenten atravesar directamente un encapsulado quedan aislados y generan un aviso.' },
      { title: 'Autoespaciado', text: 'Al añadir, mover de lado o eliminar una patilla, las restantes se redistribuyen uniformemente. La posición numérica continúa disponible para ajustes deliberados.' },
      { title: 'Anidamiento', text: 'Puedes crear encapsulados dentro de otros. La ruta superior permite volver a cualquier antecesor sin destruir el estado interno.' },
      { title: 'Flujo jerárquico', text: 'La miniatura protegida conserva la animación interna. Cada nivel usa el color de su encapsulado; al cruzar una patilla hacia el lienzo padre, el cable recupera el color general.' },
      { title: 'Colores', text: 'Los encapsulados nuevos reciben colores diferenciados automáticamente. El inspector permite fijar después un color concreto.' },
      { title: 'Biblioteca local', text: 'Los módulos guardados se almacenan en el navegador. Exportarlos es la forma segura de conservarlos fuera de ese dispositivo.' },
    ],
    note: 'Antes de guardar un chip, asigna nombres claros a todas sus patillas y prueba el lienzo interno de manera aislada.',
  },
  {
    id: 'instrumentos', group: 'SIMULACIÓN', title: 'Banco de instrumentos', icon: Activity,
    summary: 'Combina vistas generales y abre el frontal independiente de cada instrumento conectado al circuito.',
    steps: [
      'Abre Vistas en la cabecera del banco inferior.',
      'Activa simultáneamente osciloscopio, analizador lógico, multímetro, potencia, espectro o frecuencímetro.',
      'Pulsa con el botón derecho sobre un instrumento del plano y elige Abrir interfaz del instrumento.',
      'Arrastra la barra de título, redimensiona desde la esquina y usa la flecha para desplegar los controles profesionales.',
      'Desactiva cualquier vista para retirarla sin detener el motor ni perder muestras.',
      'Pliega todo el banco cuando necesites dedicar la altura completa al lienzo.',
    ],
    details: [
      { title: 'Medida por instancia', text: 'Cada aparato resuelve exclusivamente los cables unidos a sus patillas. Dos osciloscopios conectados a redes distintas conservan gráficas e historiales diferentes.' },
      { title: 'Sonda virtual', text: 'En Vinculación interna de medida puedes asociar un instrumento a un componente o a una patilla. La medida es de alta impedancia y no añade cables ni altera el circuito.' },
      { title: 'Osciloscopio profesional', text: 'La vista extendida incorpora CH1/CH2, volts/div, tiempo/div, posición, acoplamiento, memoria, ancho de banda, adquisición y disparo.' },
      { title: 'Analizador lógico', text: 'Muestra estados binarios y transiciones. Es la vista adecuada para relojes, puertas, buses y secuencias.' },
      { title: 'Medidas eléctricas', text: 'Multímetro y monitor de potencia resumen los valores instantáneos y el consumo agregado de las redes activas.' },
      { title: 'Frecuencia y espectro', text: 'El frecuencímetro estima transiciones por segundo; el espectro ofrece una lectura relativa del contenido frecuencial de la muestra.' },
    ],
    note: 'El botón derecho abre el menú propio de BitWire. El navegador ya no intercepta esa interacción dentro del laboratorio.',
  },
  {
    id: 'profundidad', group: 'ARQUITECTURA', title: 'Zoom semántico y composición interna', icon: Gauge,
    summary: 'Interpreta los niveles de detalle que transforman un bloque funcional en su estructura electrónica y física.',
    steps: [
      'Observa el indicador LOD de la esquina superior derecha del lienzo.',
      'Amplía sobre un símbolo hasta pasar de vista esquemática a funcional y de dispositivo a estructura física.',
      'En puertas lógicas, estudia primero la red equivalente y después la implementación CMOS.',
      'En semiconductores, identifica regiones P/N, uniones, zona de agotamiento, puerta, base o canal.',
    ],
    details: [
      { title: 'LOD 0 — Encapsulado', text: 'Prioriza identidad, contorno y terminales. Es la vista apropiada para sistemas grandes.' },
      { title: 'LOD 1/2 — Esquema y función', text: 'Muestra el símbolo normalizado, valores esenciales y la relación lógica o eléctrica entre entradas y salidas.' },
      { title: 'LOD 3 — Dispositivo', text: 'Revela redes internas, transistores, contactos y bloques que explican el comportamiento del componente.' },
      { title: 'LOD 4 — Físico', text: 'Introduce regiones dopadas, uniones y detalles materiales. Es un modelo educativo, no una máscara de fabricación completa.' },
    ],
    note: 'La profundidad depende del producto del zoom del lienzo y la escala propia del componente.',
  },
  {
    id: 'archivos', group: 'PROYECTO', title: 'Proyectos, guardado e intercambio', icon: FolderOpen,
    summary: 'Diferencia entre guardado local, exportación del proyecto y biblioteca de encapsulados.',
    steps: [
      'Nuevo crea un proyecto vacío después de advertir si existen cambios sin guardar.',
      'Abrir importa un archivo .bitwire o JSON compatible.',
      'Guardar escribe la versión actual en el almacenamiento local del navegador.',
      'Exportar descarga un archivo transportable con componentes, redes, módulos y ajustes del proyecto.',
      'Modo offline detecta Windows, macOS o Linux y descarga la aplicación portable adecuada.',
    ],
    details: [
      { title: 'Guardado local', text: 'Es rápido y cómodo, pero pertenece al navegador y dispositivo actuales. Borrar los datos del sitio puede eliminarlo.' },
      { title: 'Archivo .bitwire', text: 'Es JSON versionado y legible. Sirve como copia de seguridad y como formato de intercambio entre equipos.' },
      { title: 'Archivo de módulo', text: 'Un .bitwire-module contiene un encapsulado reutilizable y sus niveles descendientes, no el proyecto completo.' },
      { title: 'Compatibilidad', text: 'BitWire valida las referencias de los cables al importar. Un archivo con terminales inexistentes se rechaza para evitar grafos corruptos.' },
      { title: 'Aplicación portable', text: 'Los ejecutables se compilan previamente en GitHub Actions e incluyen interfaz, catálogo y motor. El usuario no necesita consola, Node.js, Python ni un instalador.' },
    ],
    note: 'Para trabajos importantes, combina Guardar durante la edición con exportaciones periódicas versionadas.',
  },
  {
    id: 'diagnostico', group: 'REFERENCIA', title: 'Diagnóstico de problemas frecuentes', icon: CircleHelp,
    summary: 'Resuelve rápidamente fallos de selección, redes sin señal, cámara perdida y módulos aparentemente vacíos.',
    steps: [
      'Si un componente no se mueve, confirma que está seleccionado, no bloqueado y que la herramienta activa es Selección.',
      'Si una red no se anima, ejecuta el motor y comprueba que la fuente, el retorno y los elementos intermedios forman un recorrido válido.',
      'Si no encuentras el circuito, pulsa Encajar proyecto.',
      'Si el interior de un módulo parece vacío, revisa la ruta superior y las patillas fijas del borde.',
    ],
    details: [
      { title: 'Valor “—”', text: 'No existe una medida activa o la red está flotante. Comprueba referencias, alimentación y continuidad.' },
      { title: 'Estado Z', text: 'La línea digital está en alta impedancia. Necesita una fuente lógica o una resistencia de polarización según el diseño.' },
      { title: 'Avisos del motor', text: 'El contador inferior agrupa advertencias de simulación. Pausa y revisa conexiones antes de ampliar el circuito.' },
      { title: 'Rendimiento', text: 'Pliega instrumentos que no uses, trabaja por encapsulados y evita mostrar valores superpuestos en miles de redes simultáneamente.' },
    ],
    note: 'Cuando investigues un problema complejo, crea una copia y reduce el circuito hasta el conjunto mínimo que todavía reproduzca el fallo.',
  },
  {
    id: 'atajos', group: 'REFERENCIA', title: 'Atajos y vocabulario esencial', icon: BookOpen,
    summary: 'Consulta los controles principales y los conceptos que aparecen en la interfaz.',
    steps: [
      'V: selección · W: cable · H: mano · Espacio + arrastre: desplazar.',
      'Ctrl+S: guardar · Ctrl+N: nuevo · Ctrl+Z: deshacer · Ctrl+Y: rehacer.',
      'Supr o Retroceso: eliminar · Escape: cancelar selección o herramienta.',
      'Rueda: zoom · Mayús + clic: selección múltiple · Doble clic: inspector o navegación interna.',
    ],
    details: [
      { title: 'Terminal', text: 'Punto interactivo de entrada, salida, alimentación o referencia de un componente.' },
      { title: 'Red', text: 'Conjunto de puntos eléctricamente conectados mediante uno o más cables.' },
      { title: 'Encapsulado', text: 'Contenedor jerárquico con circuito interno y una interfaz exterior formada por patillas.' },
      { title: 'LOD', text: 'Nivel de detalle semántico elegido según el zoom efectivo de la vista y del componente.' },
    ],
    note: 'Mantén el cursor sobre cualquier botón para consultar su función y, cuando exista, el atajo asociado.',
  },
];

export function HelpGuide({ onClose }: Props) {
  const [activeId, setActiveId] = useState(GUIDE[0].id);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    if (!needle) return GUIDE;
    return GUIDE.filter(section => [section.title,section.summary,section.group,...section.steps,...section.details.flatMap(item=>[item.title,item.text])].join(' ').toLocaleLowerCase('es').includes(needle));
  }, [query]);

  useEffect(() => {
    if (filtered.length && !filtered.some(section => section.id === activeId)) setActiveId(filtered[0].id);
  }, [activeId, filtered]);

  const active = GUIDE.find(section => section.id === activeId) ?? GUIDE[0];
  const index = GUIDE.findIndex(section => section.id === active.id);
  const Icon = active.icon;

  return <div className="modal-backdrop guide-backdrop" onMouseDown={onClose}>
    <section className="help-guide" onMouseDown={event => event.stopPropagation()} aria-label="Guía completa de BitWire">
      <header className="guide-header">
        <div className="guide-title"><BookOpen size={21}/><div><span className="eyebrow">MANUAL INTERACTIVO</span><h2>Guía completa de BitWire</h2></div></div>
        <label className="guide-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar cableado, encapsulados, LOD…"/></label>
        <button className="guide-close" onClick={onClose} aria-label="Cerrar guía"><X size={19}/></button>
      </header>
      <div className="guide-layout">
        <aside className="guide-index">
          <div className="guide-index-summary"><strong>{GUIDE.length}</strong><span>capítulos · desde el primer circuito hasta la arquitectura jerárquica</span></div>
          <nav aria-label="Índice de la guía">
            {filtered.map(section => {
              const ItemIcon=section.icon;
              return <button key={section.id} className={section.id===active.id?'active':''} onClick={()=>setActiveId(section.id)}>
                <ItemIcon size={15}/><span><small>{section.group}</small><strong>{section.title}</strong></span>
              </button>;
            })}
            {!filtered.length && <p className="guide-no-results">No hay capítulos que coincidan con la búsqueda.</p>}
          </nav>
        </aside>
        <article className="guide-content" key={active.id}>
          <div className="guide-chapter-heading"><span><Icon size={23}/></span><div><small>{active.group} · CAPÍTULO {index+1}</small><h3>{active.title}</h3><p>{active.summary}</p></div></div>
          <section className="guide-tutorial"><h4>TUTORIAL PASO A PASO</h4><ol>{active.steps.map((step,itemIndex)=><li key={step}><b>{String(itemIndex+1).padStart(2,'0')}</b><span>{step}</span></li>)}</ol></section>
          <section className="guide-detail-grid">{active.details.map(item=><div key={item.title}><h4>{item.title}</h4><p>{item.text}</p></div>)}</section>
          <aside className="guide-note"><CircleHelp size={17}/><p>{active.note}</p></aside>
          <footer className="guide-navigation">
            <button disabled={index===0} onClick={()=>setActiveId(GUIDE[index-1].id)}><ChevronLeft size={15}/>Anterior</button>
            <span>{index+1} / {GUIDE.length}</span>
            <button disabled={index===GUIDE.length-1} onClick={()=>setActiveId(GUIDE[index+1].id)}>Siguiente<ChevronRight size={15}/></button>
          </footer>
        </article>
      </div>
    </section>
  </div>;
}
