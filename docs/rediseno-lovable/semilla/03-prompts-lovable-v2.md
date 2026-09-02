# Secuencia de prompts para Lovable — v2 (retoma desde P0)

Estado al escribir esto: P0 (versión 1) ya se ejecutó en Lovable y produjo el
cascarón con tokens, `/design-system`, cabecera, banda de pasos y pie legal,
con `[texto pendiente]` donde la especificación no daba el literal. **No se
tira nada**: P0-bis lo corrige y lo alinea al canvas; a partir de ahí, cada
pantalla se **reproduce** desde el canvas.

Antes de P0-bis tienen que estar cargados en Lovable (guía v2, fase 3.0):
`docs/canvas/*` (plantilla, estilos, lógica, textos, modales, reglas
visuales, capturas), `docs/pantallas/ESPECIFICACION_PANTALLAS.md` **y**
`docs/pantallas/ESPECIFICACION_PANTALLAS-ADENDA-2026-09-01.md`, y el Knowledge
v2 pegado.

---

## P0-bis · Corregir el cascarón contra el canvas

```
Cambió la fuente visual del proyecto: leé primero el Knowledge (v2), después
`docs/canvas/canvas-reglas-visuales.md` completo, y después
`docs/canvas/canvas-estilos.css` — atención a su comentario inicial: tiene
dos capas y la SEGUNDA (SeguroLoTengo: DM Sans, naranja, radios 8/12/16) es
la que se ve. Abrí también `docs/canvas/capturas/00-inicio-1360.png` y
`00-inicio-390.png` para ver el resultado esperado.

Corregí lo que ya construiste, sin crear pantallas todavía:

1. `src/index.css`: mantené los nombres de tokens del producto
   (`docs/01-tokens.css`) pero asegurate de que los VALORES vigentes sean los
   de la capa 2 del canvas: DM Sans 400/500/600/700 (no Archivo), acento
   naranja-500 #e2660f / naranja-600 #bd550f / naranja-700 #98450e (no
   rojo), radios 8/12/16 (no 0), fondo hueso-50 #fafafa, divisor hueso-200
   #e0e0e0, texto hueso-900 #333333, foco azul-600 #2b5a9e. Quitá cualquier
   rastro de #ec3013, Archivo y radius 0 que haya quedado del P0 anterior.
   Incorporá las clases de la capa 2 del canvas (.btn 44px r12, .btn-primary/
   secondary/ghost, .input 44px r10, .field > label mayúsculas 11px,
   [data-falta="1"] con «* TE FALTA ESTO», .pulso) con los tokens del
   producto.
2. `HeaderInstitucional`: reproducí EXACTAMENTE la cabecera del canvas
   (bloque `<!-- Cabecera institucional -->` de canvas-plantilla.html):
   isologos 38×38 desde public/marca/, kicker 9.5px/0.1em/700 en
   naranja-700, nombre 12.5px 600, referencia 10.5px con el sufijo
   «(provisional)» según la ADENDA §B, tercer bloque CANAL DIGITAL con el
   sello SLT SOLO en el inicio, botón «☾ Modo noche» / «☼ Modo día» .btn-ghost
   12px a la derecha. Los tres bloques enlazan a los sitios que dice la adenda.
3. `BandaPasos`: rejilla repeat(3,1fr) a lo ancho, cada paso padding 12px 4px,
   font-size 12px, border-top 3px (naranja-600 el actual, verde-400 el
   cumplido, transparente el pendiente), número 700, rótulo 0.04em, «✓» al
   cumplir, color neutral-400 en los pendientes. Recibe el slug de la
   pantalla, nunca un número. No se muestra en Inicio, Confirmación ni
   Revisión manual.
4. `PieLegal`: colapsable «INFORMACIÓN LEGAL Y REGULATORIA ▾/▴» con el
   TEXTO LITERAL de la ADENDA §A (reemplaza los [texto pendiente]) y los
   siete enlaces que abren `AclaracionModal` con el contenido de
   `docs/canvas/canvas-modales.md` (pie «Texto de muestra para la
   demostración del flujo.»; datos de contacto como [dato oficial
   pendiente]). Sin URLs. En el Inicio el pie NO se muestra (el canvas lo
   condiciona a `noEsInicio`).
5. `/design-system`: actualizá para que muestre los valores nuevos, los tres
   botones, el input en sus estados y un bloque con data-falta.

Cuando termines: captura de `/design-system` en claro y oscuro, y listame
qué valores de token cambiaron respecto del P0 anterior.
```

## P1 · Inicio `/` — reproducir el canvas

```
Reproducí la pantalla **Bienvenida** del canvas: sección
`data-screen-label="Bienvenida"` de `docs/canvas/canvas-plantilla.html`, con
las capturas `docs/canvas/capturas/00-inicio-1360.png`, `00-inicio-390.png` y
`00-inicio-noche-1360.png` como resultado esperado. Textos: sección «Inicio»
de la especificación + ADENDA §C (rótulo de la cuarta foto: «Protege a tu
familia»).

Reproducí, con los mismos valores que el HTML del canvas:
- Cabecera con tres bloques (solo acá). Sin BandaPasos. Sin pie legal.
- Hero: columna de texto flex 1 1 340px con H1 clamp(34px,5vw,58px) 700
  line-height 1.04 max-width 18ch y bajada 17px neutral-700 max-width 52ch;
  columna de foto flex 1.7 1 480px con el cuadro 16/9 radio 16 borde
  divisor, cuatro fotos de public/v3/hero-*.jpg en grid-area 1/1 con
  transición de opacidad .7s, rótulo naranja-500 blanco 700
  clamp(15px,2vw,25px) padding 10px 18px abajo a la izquierda, y los cuatro
  puntos indicadores. 3 s por foto.
- Los tres pasos en tres columnas separadas por filetes, número grande en
  naranja, título 600 y bajada neutral-600.
- Tarjeta «ANTES DE EMPEZAR» (radio 16, borde divisor, fondo superficie)
  con el texto y, a la derecha, la casilla-botón de T&C (.btn-secondary →
  al aceptar, «✓ Términos y condiciones aceptados») y el botón «Ver qué
  datos usamos y para qué» (.btn-ghost).
- CTA «Tocá acá para empezar →» .btn-primary con la guía contextual al lado
  (12.5px neutral-600), pie informativo 12px.
- Píldora flotante «Acá abajo está el botón para empezar ↓» cuando el CTA
  queda bajo el borde inferior (mecanismo data-cta).
- Estado: sin T&C el CTA está deshabilitado; con T&C navega a /inscripcion.

Al terminar: captura a 1360 y 390 en claro, lista de textos usados/faltantes
y diferencias visuales que sepas que quedaron contra la captura de referencia.
```

## P2 · Paso 1 `/inscripcion`

```
Reproducí **Paso 1 · Inscribite**: sección `data-screen-label="Paso 1
Inscribite"` de `docs/canvas/canvas-plantilla.html`, capturas
`01-paso1-vacio-*.png` (recién llegado) y `01-paso1-completo-*.png` (todo
cargado). Textos: sección «Paso 1» de la especificación. Los valores de las
variables `{{ … }}` (títulos con «, Ana», guías, estados de captura,
rótulos del OTP, «Te falta: …») están en `docs/canvas/canvas-logica.js`.

Reproducí el orden y el dibujo del canvas: título clamp(26px,4vw,36px) con
encabezado, foto `familia-paso-1.jpg` altura clamp(140px,20vw,210px)
recorte center 35% radio 16, bloque IMPORTANTE con su dibujo y el botón «Ver
cómo cuidamos tus datos» a la derecha; sección PRIMERO · TU DOCUMENTO con
las tres tarjetas de captura (borde dashed neutral-400 pendiente → 2px
naranja aprobada, ilustración SVG del canvas, chip «✓ Aprobada»), el botón
«Tocá acá para leer los datos de mi cédula →» con su guía y el estado
«Leyendo tu cédula…»; DATOS DE IDENTIDAD en rejilla auto-fit minmax(220px)
con los campos exactos (cédula y fecha con candado «no editable»), leyenda
de edad y botón «Completar el resto con datos de ejemplo (demo)»; TUS
CANALES bloqueada con su rótulo hasta confirmar identidad, celular + botón
de envío, casillas OTP con reloj «vence en M:SS» y «reenvíos N de 3»,
correo doble; DATOS COMPLEMENTARIOS bloqueada hasta canales, ocho campos;
ACEPTACIÓN Y CONTINUAR bloqueada hasta complementarios, casilla agrupada +
«Ver todo lo que aceptás» con los SIETE ítems + nota + «Tocá acá para
continuar al paso 2 →». «* TE FALTA ESTO» con data-falta desde el
principio; «Te falta: …» + «Mostrame qué me falta» con .pulso; píldora
flotante.

Simulá con estado local: «(demo)» llena a Ana Ejemplo Modelo; OTP acepta
123456. Al terminar: capturas 1360/390, textos usados/faltantes,
diferencias declaradas.
```

## P3 · Paso 2 `/seguro`

```
Reproducí **Paso 2 · Elegí tu seguro**: sección `data-screen-label="Paso 2
Elegi tu seguro"`, capturas `02-paso2-*.png`. Textos: sección «Paso 2» de la
especificación; OJO adenda §E: beneficiario SOLO nombre, parentesco y
domicilio (el canvas dibuja tres campos más que NO van).

Reproducí: título con «, Ana», foto `familia-paso-2.jpg`; pestañas de ramos
subrayadas (ONCOLÓGICO activa; VIDA, ACCIDENTES PERSONALES, RESPONSABILIDAD
CIVIL con «PRONTO»); leyenda del producto con «(provisional)»; tres tarjetas
de plan en auto-fit minmax(220px) radio 16, la seleccionada con fondo
naranja-50 y borde 2px naranja-600, rótulo «✓ SELECCIONADO», precio grande
«Gs. 522.500» con «al año · IVA incluido», lista de coberturas importe
arriba/concepto abajo, botón .btn-secondary «Tocá acá para elegir este plan»
/ .btn-primary «✓ Plan elegido» (role="radio", aria-checked); tarjeta «QUÉ
CUBRE Y DESDE CUÁNDO · Tu plan CONFÍO+, en claro» con cuatro columnas y los
dos botones de PDF + leyenda de edad; beneficiario con dos botones grandes y
la cita al margen; las CINCO declaraciones en auto-fit minmax(330px) con
botones Sí/No y sus avisos, data-falta; aceptación agrupada 2 con cinco
ítems; CTA .btn-primary «continuar al paso 3» o, con respuestas
incompatibles, «Tocá acá para enviar mi caso a un asesor →» → /revision-
manual; píldora «Acá abajo enviás tu caso a un asesor ↓» /
«Acá abajo está el botón para continuar ↓» según el caso.

Al terminar: capturas, textos, diferencias.
```

## P4 · Paso 3 `/pago-y-firma`

```
Reproducí **Paso 3 · Pagá y firmá**: sección `data-screen-label="Paso 3 Paga
y firma"`, capturas `03-paso3-*.png` (antes de firmar) y
`03-paso3-firmado-*.png` (pago habilitado). Textos: sección «Paso 3» de la
especificación; adenda §E: el expandible del FIPF usa el texto de la
especificación (Formulario de Identificación de Persona Física), no el del
canvas.

Reproducí: título, encabezado, foto `hero-paga-firma.jpg`, barra TU PLAN
debajo de la foto; sección de firma con el párrafo, el expandible, la
tarjeta del documento `PROP-00000001` con «Ver PDF» (ModalVisorPdf con el
contenido de `canvas-modales.md` → fipf/propuesta, rotulado VISTA DE
MUESTRA), la aceptación agrupada 3 como recuadro grande, los dos botones de
firma apilados y grandes, la leyenda; estado firmado «✓ Documento firmado ·
cliente + Interseguros + Alianza Garantía»; sección de pago bloqueada hasta
firmar: datos de factura (tres campos), liquidación, tres medios como
botones chicos en fila (QR por defecto), botón grande de pago según medio,
leyenda de Bancard, tres bloques chicos (plazo 24 h con cuenta regresiva,
secuencia, seguridad). ModalBancard EXACTO al canvas: fondo #20262e, los
tres puntos, barra #151a20 con candado y `vpos.bancard.com.py/pago-seguro`,
«Cerrar ✕», cabecera «Bancard · vPOS» + comercio + «A PAGAR Gs. …», QR de
132px con guía y reloj, o formulario de tarjeta en auto-fit minmax(190px)
con «Mostrame qué me falta», botones (demo), leyenda de ventana simulada.
Al «pagar», navegar a /confirmacion.

Al terminar: capturas, textos, diferencias.
```

## P5 · Confirmación `/confirmacion`

```
Reproducí **Confirmación**: sección `data-screen-label="Confirmacion"`,
capturas `04-confirmacion-*.png`. Textos: sección «Confirmación». Sin
BandaPasos. Kicker «CONTRATACIÓN ACEPTADA», título y bajada a la izquierda,
foto `familia-confirmacion.jpg` al costado recorte center 45%; cuatro hitos
en fila entre filetes; «TUS DOCUMENTOS» con tres tarjetas (nombre y detalle
a la izquierda, «Ver PDF» + descarga a la derecha) y «Y ESTOS TE LLEGAN EN
BREVE» con la póliza como estado; leyenda del QR; ayuda con rótulos y
`[dato oficial pendiente]`; «COMUNICACIONES COMERCIALES · OPCIONAL» con la
casilla desmarcada; «Volver al inicio» .btn-ghost.
```

## P6 · Revisión manual `/revision-manual`

```
Reproducí **Revisión manual**: sección `data-screen-label="Revision manual"`,
capturas `05-revision-*.png`. Textos: sección «Revisión manual». Banda
«REVISIÓN MANUAL · CASO-00000001», título con «, Ana», el párrafo con «no es
un rechazo» en negrita, la tarjeta «Nada se movió de tu bolsillo…» (radio 16,
fondo superficie), «Volver al inicio» .btn-ghost.
```

## P7 · Estados transversales y tema oscuro

```
Repasá las seis pantallas contra `docs/canvas/canvas-reglas-visuales.md`
§3–§4 y las capturas «noche». Completá: estados hover/focus/disabled de
.btn e .input como la capa 2; tema oscuro con los valores de la §2 (fondo
#141414, superficie #1e1e1e, texto #f4f2ef, divisor #333333, acento
naranja-500 y naranja-300 para el 700); prefers-reduced-motion (el carrusel
se detiene); blanco táctil 44px. Capturas de las seis en claro y oscuro,
1360 y 390.
```

## P8 · Auditoría de cierre (textos + dibujo)

```
Devolveme DOS tablas, sin corregir nada todavía:
1. Textos: por pantalla, cada texto de `ESPECIFICACION_PANTALLAS.md` + ADENDA
   con «está (sí/no)» y «dónde»; aparte, todo texto del prototipo que NO esté
   en la especificación ni en `canvas-textos.md`.
2. Dibujo: por pantalla, cada fila de `canvas-reglas-visuales.md` §4 con
   «cumple (sí/no)» y el valor que usaste.
```

Después de P8 se corrigen las diferencias con prompts puntuales, se aprueba y
se etiqueta el repositorio (`diseno-v1-aprobado`).
