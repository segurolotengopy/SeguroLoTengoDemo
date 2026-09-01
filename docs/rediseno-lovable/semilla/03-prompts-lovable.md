# Secuencia de prompts para Lovable

Cada bloque es **un** prompt. Se envían en este orden, uno por vez, y no se
pasa al siguiente hasta aprobar el resultado en la vista previa (de escritorio
**y** de celular — Lovable tiene el conmutador arriba de la vista previa).

Los prompts están escritos para que Lovable **lea los archivos que ya están en
el proyecto** (cargados en el paso 2.3 de la guía) en vez de recibir el texto
pegado. Eso evita que el agente «resuma» la especificación y pierda literales.

> Consumo estimado: cada prompt es un mensaje con créditos. Con 10 prompts
> base más 2–3 rondas de ajuste por pantalla, presupuestar ~30–40 mensajes.

---

## P0 · Arranque: tokens, tipografía, tema y cascarón

```
Este proyecto es un prototipo visual de SeguroLoTengo. Leé primero
`docs/02-knowledge-lovable.md` (ya está en tu Knowledge), después
`docs/01-tokens.css` y `docs/referencia-canvas-v3.css`.

Hacé SOLO esto, sin pantallas todavía:

1. Reemplazá el contenido de `src/index.css` por `docs/01-tokens.css`
   completo, debajo de `@import "tailwindcss";`. No renombres ningún token.
2. Cargá la fuente Archivo (pesos 400, 600, 700, 800) desde Google Fonts y
   dejá `data-flujo="v3"` en <html>.
3. Implementá el conmutador de tema: `data-tema="oscuro"` en <html>, botón
   `☾ Modo noche` / `☼ Modo día`. Sin prefers-color-scheme.
4. Creá el cascarón compartido en `src/components/shared/`:
   - `HeaderInstitucional`: tres bloques con los textos EXACTOS de la sección
     «Elementos comunes» de `docs/pantallas/ESPECIFICACION_PANTALLAS.md`,
     isologos de `public/marca/`, botón de tema.
   - `BandaPasos`: banda de tres columnas a lo ancho bajo la cabecera,
     `1 INSCRIBITE · 2 ELEGÍ TU SEGURO · 3 PAGÁ Y FIRMÁ`, paso actual
     resaltado con filete de acento, pasos completados con ✓. Recibe el slug
     de la pantalla (`/inscripcion`, `/seguro`, `/pago-y-firma`) — nunca un
     número. En Inicio, Confirmación y Revisión manual NO se muestra.
   - `PieLegal`: bloque expandible «INFORMACIÓN LEGAL Y REGULATORIA» con el
     texto institucional y los siete enlaces de la especificación.
5. Una página vacía `/design-system` que muestre todos los tokens (escalas,
   semánticos, tipografía, radios) en claro y oscuro.

Cuando termines, mostrame `/design-system` y listame los tokens que usaste.
```

## P1 · Inicio `/`

```
Implementá la pantalla **Inicio** siguiendo al pie de la letra la sección
«Inicio — `/` (fuera del contador)» de `docs/pantallas/ESPECIFICACION_PANTALLAS.md`.

Reglas de esta pantalla:
- Sin BandaPasos. Cabecera + contenido + PieLegal.
- Hero con carrusel de cuatro fotos en crossfade (3 s cada una, cruce de
  0,7 s, orden: inscribite → seguro → pagá y firmá → protegé), con un rótulo
  en acento abajo a la izquierda de cada foto. Usá las cuatro fotos de
  `public/v3/hero-*.jpg`.
- H1, bajada, las tres tarjetas de pasos, el bloque ANTES DE EMPEZAR, la
  casilla de T&C que habilita el CTA, el enlace «Ver qué datos usamos y para
  qué», el CTA y la guía contextual y el pie: TODOS con los textos literales.
- La casilla de T&C sin marcar deja el CTA deshabilitado y la guía dice
  «Aceptá los términos y condiciones para continuar.»; marcada, la guía
  cambia y el CTA lleva a `/inscripcion`.

Diseñá primero a 360 px y después a escritorio. Cuando termines, listame los
textos usados y cualquier texto que no hayas encontrado en la especificación.
```

## P2 · Paso 1 `/inscripcion`

```
Implementá el **Paso 1 · Inscribite** (`/inscripcion`) siguiendo la sección
«Paso 1 · Inscribite — `/inscripcion`» de `docs/pantallas/ESPECIFICACION_PANTALLAS.md`,
con sus cuatro secciones EN ESTE ORDEN y con gating en cascada:

1. PRIMERO · TU DOCUMENTO — tres tarjetas de captura (Cédula · frente,
   Cédula · dorso, Selfie en vivo), cada una con ilustración, estado y botón;
   botón «Tocá acá para leer los datos de mi cédula →» con su guía; bloque
   DATOS DE IDENTIDAD con los campos exactos (cédula y fecha de nacimiento NO
   editables, con candado; sexo se elige; el resto editable) y la leyenda de
   edad; botón «Completar el resto con datos de ejemplo (demo)».
2. TUS CANALES — bloqueada hasta confirmar identidad, con su rótulo literal;
   celular con ejemplo y botón de envío; casillas OTP de 6 dígitos con reloj
   `vence en M:SS`, contador `reenvíos N de 3`, enlace «Reenviar código»;
   estado verificado con número enmascarado; correo + repetir correo con el
   aviso de no coincidencia.
3. DATOS COMPLEMENTARIOS — bloqueada hasta canales; los ocho campos exactos.
4. ACEPTACIÓN Y CONTINUAR — bloqueada hasta complementarios; la casilla
   agrupada, el expandible «Ver todo lo que aceptás» con los SIETE ítems
   literales, los dos enlaces, la nota, y el botón «Tocá acá para continuar
   al paso 2 →».

Además: título y encabezado con el saludo «, Ana» cuando la cédula ya fue
leída; bloque IMPORTANTE con el enlace «Ver cómo cuidamos tus datos»; patrón
«Te falta: …» + «Mostrame qué me falta» con los faltantes en rojo con
asterisco desde el principio; píldora flotante «Acá abajo está el botón…»
cuando el CTA queda fuera de la vista.

Simulá todo con estado local: el botón «(demo)» llena datos de ejemplo de Ana
Ejemplo Modelo, el OTP acepta `123456`. Cuando termines, listame textos usados
y faltantes.
```

## P3 · Paso 2 `/seguro`

```
Implementá el **Paso 2 · Elegí tu seguro** (`/seguro`) siguiendo la sección
«Paso 2 · Elegí tu seguro — `/seguro`» de `docs/pantallas/ESPECIFICACION_PANTALLAS.md`:

- Pestañas de ramos subrayadas (no cajas): ONCOLÓGICO activo; VIDA,
  ACCIDENTES PERSONALES y RESPONSABILIDAD CIVIL con etiqueta PRONTO,
  deshabilitadas.
- Leyenda del producto (con «(provisional)» en los identificadores).
- Tres tarjetas de plan con los valores EXACTOS de la tabla, rejilla
  `repeat(auto-fit, minmax(260px, 1fr))`, precio grande bajo el nombre,
  importes alineados con cifras tabulares, rótulo «✓ SELECCIONADO» y botón
  «Tocá acá para elegir este plan» / «✓ Plan elegido». La selección es
  exclusiva (semántica de radio, `role="radio"` + `aria-checked`).
- QUÉ CUBRE Y DESDE CUÁNDO con las cuatro coberturas, sus carencias y los dos
  botones de PDF, más la leyenda de edad de ingreso.
- Beneficiario: dos botones grandes (herederos legales / designar a una
  persona); al designar, SOLO los tres campos: nombre completo, parentesco
  (selector), domicilio. Leyenda final.
- Declaraciones: las CINCO preguntas literales, con botones Sí/No (no
  radios), rejilla `minmax(330px, 1fr)`, rótulo «* TE FALTA ESTO» arriba de
  la pregunta cuando falta, expandibles de la 4 y la 5, y los dos avisos
  (derivación a asesor para 1–4; detención para la 5 en No).
- Aceptación agrupada 2 con sus CINCO ítems y los dos enlaces.
- Dos CTAs posibles según respuestas: «Tocá acá para continuar al paso 3 →» o
  «Tocá acá para enviar mi caso a un asesor →» (este lleva a
  `/revision-manual`).

Barra del plan seleccionado visible apenas se elige plan. Cuando termines,
listame textos usados y faltantes.
```

## P4 · Paso 3 `/pago-y-firma`

```
Implementá el **Paso 3 · Pagá y firmá** (`/pago-y-firma`) siguiendo la sección
«Paso 3 · Pagá y firmá — `/pago-y-firma`» de `docs/pantallas/ESPECIFICACION_PANTALLAS.md`:

- Título, encabezado y barra TU PLAN (plan, premio, «premio anual · IVA
  incluido», enlace «cambiar plan»), debajo de la foto de cabecera
  `public/v3/hero-paga-firma.jpg` recortada en `object-position: center 35%`.
- Sección 1 · La firma: párrafo, expandible «¿Qué es el FIPF y qué estoy
  firmando?» con el texto literal, tarjeta del documento `PROP-00000001` con
  botón «Ver PDF» (abre `ModalVisorPdf`, rotulado VISTA DE MUESTRA), la
  aceptación agrupada 3 con sus TRES ítems como recuadro grande, y los dos
  botones de firma apilados y grandes (WhatsApp / correo, con canal
  enmascarado) más la leyenda. Estado firmado: «✓ Documento firmado · cliente
  + Interseguros + Alianza Garantía».
- Sección 2 · El pago, bloqueada hasta firmar con su rótulo: datos para la
  factura (tres campos exactos), liquidación (prima neta, IVA, premio total,
  leyenda provisional), los tres medios como tres botones chicos en fila
  (QR por defecto), botón grande de pago con el texto según medio, leyenda
  de Bancard, los tres bloques de texto chico (plazo 24 h con cuenta
  regresiva, secuencia, seguridad).
- `ModalBancard`: ventana simulada con los tres puntos, barra
  `vpos.bancard.com.py/pago-seguro` con candado, cabecera «Bancard · vPOS»
  con comercio e importe; adentro el QR con su guía o el formulario de
  tarjeta (número, MM/AA, código, titular) con «Mostrame qué me falta»;
  botones «Simular que ya pagué (demo)» y «Completar con datos de ejemplo
  (demo)»; leyenda de ventana simulada.

Al «pagar», navegá a `/confirmacion`. Cuando termines, listame textos usados
y faltantes.
```

## P5 · Confirmación `/confirmacion`

```
Implementá **Confirmación** (`/confirmacion`) siguiendo su sección en
`docs/pantallas/ESPECIFICACION_PANTALLAS.md`. Sin BandaPasos.

- Encabezado: kicker «CONTRATACIÓN ACEPTADA», título grande y bajada a la
  izquierda, foto `public/v3/familia-confirmacion.jpg` al costado
  (`object-position: center 45%`).
- Cuatro hitos en una fila entre filetes (no tarjetas con título).
- TUS DOCUMENTOS: tres tarjetas descargables (CPC, Propuesta+FIPF firmada,
  Comprobante) con nombre y detalle a la izquierda y la acción «Ver PDF» +
  descarga a la derecha en la misma línea; y bajo «Y ESTOS TE LLEGAN EN
  BREVE» la tarjeta de estado de la Póliza definitiva (sin descarga).
  Leyenda del QR.
- Ayuda: mesas de ayuda de Interseguros y Alianza — SOLO con los rótulos;
  los datos de contacto van como `[dato oficial pendiente]`.
- COMUNICACIONES COMERCIALES · OPCIONAL: casilla desmarcada con su texto y
  la leyenda.
- Botón «Volver al inicio».

Cuando termines, listame textos usados y faltantes.
```

## P6 · Revisión manual `/revision-manual`

```
Implementá **Revisión manual** (`/revision-manual`) siguiendo su sección en
`docs/pantallas/ESPECIFICACION_PANTALLAS.md`. Sin BandaPasos. Banda
«REVISIÓN MANUAL · CASO-00000001», título con «, Ana», los dos párrafos
literales, un bloque de datos del caso (número, estado «En análisis», qué se
envió, canales enmascarados) y el botón «Volver al inicio». Tono: sereno, no
es un rechazo. Cuando termines, listame textos usados y faltantes.
```

## P7 · Modales y estados transversales

```
Repasá las seis pantallas y completá los estados que faltan:
- `AclaracionModal` para los siete enlaces del PieLegal (título + texto
  `[texto pendiente]`), sin abandonar la pantalla.
- Estados deshabilitado, hover, focus visible y error de TODOS los botones y
  campos, con los tokens.
- Tema oscuro revisado pantalla por pantalla: contraste ≥ 4,5:1; los colores
  de marca no cambian.
- `prefers-reduced-motion`: el carrusel y las transiciones se detienen.
- Blanco táctil ≥ 44 px en todos los controles.
Mostrame capturas de cada pantalla en claro y oscuro, a 360 px y a 1400 px.
```

## P8 · Auditoría final (antes de aprobar)

```
Hacé una auditoría de cierre y devolveme una tabla por pantalla con tres
columnas: «Texto de la especificación», «Está en el prototipo (sí/no)»,
«Dónde». Incluí TODOS los textos de `docs/pantallas/ESPECIFICACION_PANTALLAS.md`
para esa pantalla, sin resumir. Marcá aparte cualquier texto del prototipo
que NO esté en la especificación. No corrijas nada todavía: solo la tabla.
```

Después de P8 se corrigen las diferencias con prompts puntuales («En Paso 2,
el ítem 4 de la aceptación dice X y debe decir Y»), y recién entonces se
aprueba y se etiqueta el repositorio (guía, fase 3.4).
