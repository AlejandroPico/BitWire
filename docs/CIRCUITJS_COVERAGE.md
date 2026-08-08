# Cobertura respecto a CircuitJS

Referencia auditada: menú oficial de dibujo de [CircuitJS](https://github.com/pfalstad/circuitjs1/blob/master/src/com/lushprojects/circuitjs1/client/Menus.java) y [simulador público de Falstad](https://www.falstad.com/circuit/).

El menú principal oficial contiene 144 entradas de dibujo, agrupadas en pasivos, entradas y fuentes, salidas y etiquetas, dispositivos activos, puertas, circuitos digitales, circuitos analógicos y bloques activos. Este número no es directamente comparable con el total de BitWire: ambos catálogos separan variantes de manera distinta y una definición visible no implica que su modelo eléctrico sea equivalente.

## Incorporado en esta revisión

- Fuentes de un terminal: carril CC y CA, señal cuadrada, barrido y ruido reproducible.
- Instrumentación: amperímetro, ohmímetro, vatímetro y registrador de datos, además de la vinculación virtual común para medidores, analizadores y sondas.
- Digital: demultiplexor 1→2 y decodificador BCD a siete segmentos.
- Analógica: comparador de fase XOR y fuentes controladas VCVS/VCCS.
- Identidad: nombre editable y estable para cualquier componente, usado por el plano y por todos los selectores de medida.
- Tiempo: escala logarítmica `0,0001×–10×` y conservación del estado de condensadores y bobinas al conmutar.

## Brechas que requieren un modelo dedicado

No deben presentarse como equivalentes hasta tener ecuaciones y pruebas propias:

- Transformadores con toma, transformadores configurables y líneas de transmisión.
- Memristor, descargador, chispero, diodo túnel y varactor.
- Triodo de vacío, UJT y modelos avanzados de transistor.
- Fuentes controladas por corriente, CCII, girador y OTA no ideal.
- Registros SIPO/PISO, JK/T completos, monoestable y otros circuitos secuenciales con temporización.
- Modelos precisos de op-amp, temporizador, PLL, reguladores y semiconductores de potencia.

Cada incorporación futura debe acompañarse de una prueba de referencia con magnitudes, polaridad, estado transitorio y tolerancia explícita. El objetivo es aumentar cobertura eléctrica verificable, no solo el número de símbolos.
