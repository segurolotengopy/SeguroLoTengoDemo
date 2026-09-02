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

0. **Antes que nada, el comentario de cabecera de `src/index.css`.** Ese
   archivo hoy declara, por escrito, que hay dos capas y que «el rediseño en
   Lovable PARTE de la capa B (es la última aprobada)», describiendo la capa B
   como «Archivo 800, acento rojo #ec3013, esquinas rectas, fondo #f3f2f2».
   **Eso es falso y es la causa de todo lo demás: la capa roja NO es la
   aprobada.** Es la base «Modernist» de Claude Design, que el propio diseño
   tapa. Reemplazá ese bloque de comentario por uno que diga que la fuente
   visual es la CAPA 2 del canvas (DM Sans 600, naranja #e2660f/#bd550f,
   radios 8/12/16), que la capa 1 está tapada y no se aplica, y que los
   NOMBRES de token de `docs/01-tokens.css` siguen siendo los correctos.
   Mientras ese texto siga como está, cualquier corrección de valores compite
   con una instrucción escrita en el propio archivo.

1. `src/index.css`: mantené los nombres de tokens del producto
   (`docs/01-tokens.css`) y poné los VALORES de la capa 2 del canvas
   (`docs/canvas/canvas-estilos.css`, bloque «CAPA 2», y
   `canvas-reglas-visuales.md` §2). **Copiá estos valores tal cual, no los
   deduzcas:**

   ```
   --font-heading / --font-body : 'DM Sans'   --font-heading-weight: 600
   --font-mono: 'Geist Mono'
   --color-bg:#fafafa   --color-surface:#ffffff   --sup:#ffffff
   --color-text:#333333   --color-divider:#e0e0e0
   --color-accent:#e2660f  -100:#fdf4ec  -200:#fbe3cd  -300:#f0a264
                           -600:#bd550f  -700:#98450e
   --color-neutral-100:#f4f2ef  -200:#f0eeea  -300:#e0e0e0  -400:#a5a4a0
                     -500:#6b6b6b  -600:#6b6b6b  -700:#474747
                     -800:#333333  -900:#1a1a1a
   --radius-sm:8px   --radius-md:12px   --radius-lg:16px
   --azul:#2b5a9e   --verde:#8dc63f   --verde-600:#55811d
   ```

   Tema noche (el canvas lo pone en el contenedor raíz; en el producto es
   `data-tema="oscuro"` en `<html>`): `--sup:#1e1e1e`, `--color-bg:#141414`,
   `--color-surface:#1e1e1e`, `--color-text:#f4f2ef`, `--color-divider:#333333`,
   `--color-accent:#e2660f`, `-600:#e2660f`, `-700:#f0a264`, `-100:#3a1c08`,
   `-200:#4a2409`, y los neutrales invertidos: `-100:#262626`, `-200:#2b2b2b`,
   `-300:#333333`, `-400:#6f6e6b`, `-500:#a5a4a0`, `-600:#a5a4a0`,
   `-700:#cfcecb`, `-800:#e6e4e0`.

   **Borrá la capa roja entera**, no solo los tres rastros obvios. Lo que hay
   hoy y tiene que desaparecer:

   - `--font-sans` / `--font-heading` / `--font-body` en `"Archivo"` y
     `--font-heading-weight: 800` → DM Sans, 600.
   - `--color-accent: #ec3013` y `--color-accent-2: #e15b47`.
   - `--color-bg: #f3f2f2` → `#fafafa`; `--color-surface: #eae9e9` →
     `#ffffff`; `--color-text: #201e1d` → `#333333`.
   - `--color-divider: color-mix(#201e1d 40%)` → `#e0e0e0` liso.
   - La escala `--color-accent-*` roja completa (`#ff563c`, `#dd2b0f`,
     `#ae1800`, `#7c1405`, `#4d170e`…) y **toda** la escala
     `--color-accent-2-*`.
   - La escala `--color-neutral-*` de la capa 1 (`#f8f4f4`, `#eae7e7`,
     `#d7d3d3`, `#bab6b6`, `#9b9797`, `#7d7979`, `#605d5d`, `#444141`,
     `#2d2b2b`) → la de arriba.
   - **El bloque que sobrescribe `--color-naranja-50…950` con la escala roja**,
     comentado hoy como «la regla de oro del porteo». Es el que más daño hace:
     convierte cada `bg-naranja-600` del árbol en rojo. `--color-naranja-*`
     tiene que volver a los valores de marca de `docs/01-tokens.css` §A
     (`500:#e2660f`, `600:#bd550f`, `700:#98450e`…).
   - `[data-flujo="v3"] :focus-visible { outline-color: var(--color-accent) }`
     → el foco es **azul** `#2b5a9e`, como en la capa 2
     (`:focus-visible{outline:2px solid var(--azul)}`).
   - Los bloques `[data-flujo="v3"]:not([data-tema="oscuro"])` con `#faf9f7`,
     `#201e1d`, `#444141`, `#605d5d` → los valores de arriba.

   Sobre los huecos: la capa 2 **no redefine** `--color-accent-400/500/800/900`
   ni `--color-accent-2-*`, y por eso hoy quedan en rojo. Comprobado sobre
   `canvas-plantilla.html`: **ningún elemento del canvas los usa** —solo
   existen como definiciones de la capa 1 y en las reglas `.tag-accent` /
   `.tag-accent-2`, que tampoco se aplican a nada—. Así que **eliminálos**
   junto con `.tag-accent-2`; no inventes valores para rellenarlos. Si más
   adelante hace falta un tono que no esté en la capa 2, sale de la escala
   `--color-naranja-*` de `docs/01-tokens.css` §A, nunca de la roja.

   Enlaces: `color: var(--color-accent-600)`, subrayado con
   `text-underline-offset: 2px`, hover `--color-accent-700`.

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
   pendiente]). Sin URLs. **El pie se muestra en TODAS las pantallas, el
   Inicio incluido**: la especificación dice «Pie legal (todas las
   pantallas)» y ante diferencia con el canvas manda la especificación. El
   canvas lo condiciona a `noEsInicio`, pero esa divergencia no está en la
   adenda §E, así que no vale (corregido el 02-sep-2026 por decisión de
   Andres).
5. `/design-system`: actualizá para que muestre los valores nuevos, los tres
   botones, el input en sus estados y un bloque con data-falta.

Cuando termines: captura de `/design-system` en claro y oscuro, listame qué
valores de token cambiaron respecto del P0 anterior, y confirmame que
`src/index.css` ya no contiene «Archivo», «ec3013», «e15b47», «ff563c»,
«dd2b0f», «ae1800», «f3f2f2» ni «201e1d», y que el comentario de cabecera ya
no dice que la capa B sea la aprobada.
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
- Cabecera con tres bloques (solo acá). Sin BandaPasos. **Con pie legal**
  (va en todas las pantallas; ver P0-bis punto 4).
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

**Con `BandaPasos` en la posición 2 y con pie legal.** Cabecera de dos bloques.

**Los tres planes, con estos valores exactos y ningún otro** (no los deduzcas
ni los redondees):

| Cobertura | CONFÍO | CONFÍO+ | CONFÍO TOTAL |
| :--- | :--- | :--- | :--- |
| Indemnización por cáncer (pago único) | Gs. 50.000.000 | Gs. 75.000.000 | Gs. 100.000.000 |
| Muerte por cualquier causa | Gs. 3.500.000 | Gs. 5.000.000 | Gs. 7.000.000 |
| Renta hospitalaria por día (hasta 15 días por año) | Gs. 500.000 | Gs. 750.000 | Gs. 1.000.000 |
| Gastos médicos por accidente (reembolso hasta) | Gs. 7.000.000 | Gs. 10.000.000 | Gs. 14.000.000 |
| **Premio anual (IVA incluido)** | **Gs. 319.000** | **Gs. 522.500** | **Gs. 726.000** |

La abreviatura del guaraní es **`Gs.`** en todo el portal. El plan
preseleccionado es **CONFÍO+**.

**Las cinco declaraciones no son iguales entre sí**, y el prompt viejo las
trataba como si lo fueran:

- **1 a 4**: la respuesta incompatible (1 → No; 2 → Sí; 3 → Sí; 4 → Sí)
  muestra su aviso y **deriva**: el CTA pasa a «Tocá acá para enviar mi caso a
  un asesor →» hacia `/revision-manual`.
- **5**: responder **No no deriva, DETIENE**. No hay CTA que lleve a ningún
  lado; se muestra «Sin esta aceptación no podemos avanzar: es la constancia de
  que conocés las carencias antes de contratar. Si algo no te queda claro, un
  asesor te lo explica.»
- La 4 (PEP) lleva la nota expandible «¿Qué significa PEP?», que aclara que
  **responder Sí no impide contratar**, solo requiere el análisis de un asesor.
  La 5 lleva «Ver el detalle completo».

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

Las respuestas de salud y la condición PEP son datos sensibles: viven **solo**
en el estado local de la pantalla. No las mandes a ningún servicio, ni las
guardes en `localStorage`, ni las escribas en consola.

Al terminar: capturas, textos, diferencias, y confirmame los importes de los
tres planes y el comportamiento de la declaración 5.
```

## P4 · Paso 3 `/pago-y-firma`

```
Reproducí **Paso 3 · Pagá y firmá**: sección `data-screen-label="Paso 3 Paga
y firma"`, capturas `03-paso3-*.png` (antes de firmar) y
`03-paso3-firmado-*.png` (pago habilitado). Textos: sección «Paso 3» de la
especificación; adenda §E: el expandible del FIPF usa el texto de la
especificación (Formulario de Identificación de Persona Física), no el del
canvas.

**Con `BandaPasos` en la posición 3 y con pie legal.** Cabecera de dos bloques.

**Cuatro reglas de esta pantalla que no se pueden interpretar:**

1. **Nunca se guarda ni se muestra un número de tarjeta completo ni un código
   de seguridad.** El formulario de tarjeta vive dentro de la ventana simulada
   de Bancard y su contenido **no sale de ahí**: no lo escribas en
   `localStorage`, no lo mandes a ningún servicio, no lo imprimas en consola y
   no lo muestres de vuelta en la pantalla del paso 3. Si en algún lado hay que
   mostrar la tarjeta usada, va enmascarada: `•••• •••• •••• 1234`.
2. **El enlace de firma se manda a los canales ya verificados, y el destino
   sale del expediente, nunca de un campo que la persona escriba.** Los dos
   botones muestran el destino **enmascarado**: «Tocá acá para firmar por
   WhatsApp · +595 ••• ••• 000» y «Tocá acá para firmar por correo ·
   m••••••@…», con la leyenda «Solo se envía a los canales que ya verificaste.
   Ningún operador te va a pedir ese código.»
3. **Ninguna pantalla nombra al proveedor de firma.** El texto dice «el
   proveedor de firma electrónica», genérico. Si el canvas trae un nombre
   propio, no se copia.
4. **El PDF se ve pero no se descarga antes de firmar** (`Ver PDF` abre el
   visor modal; no hay botón de descarga en este paso).

**Datos para la factura: tres campos, ni uno más.** `Factura a nombre de`
(autocompletado con el asegurado, porque solo el titular contrata) ·
`Documento para la factura` · `RUC (opcional)`. Si el RUC queda vacío viaja la
cédula del asegurado, **y la pantalla lo dice**.

**Liquidación: tres líneas** — `Prima neta anual` · `IVA` · `Premio total
anual` — con la leyenda `Apertura provisional hasta el desglose oficial de
Alianza.` (la prima neta se calcula premio ÷ 1,1 y es igual de provisional).

**La aceptación agrupada 3 tiene TRES ítems** (no cinco ni siete como las de
los pasos anteriores), con el texto literal de la especificación.

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

Al terminar: capturas, textos, diferencias, y confirmame que ningún dato de
tarjeta se guarda, se registra ni se muestra fuera de la ventana simulada.
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
