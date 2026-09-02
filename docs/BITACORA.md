# Bitácora de cambios

Registro cronológico de cada sesión de trabajo: **qué se cambió, qué decidió o
ejecutó Andres, con qué se verificó, y qué quedó abierto.**

## Para qué existe

El repositorio conserva el *resultado* del trabajo —el código, los documentos de
decisión, la matriz de cumplimiento— pero no el *caso*: por qué se tocó algo, qué
se probó antes de creerlo, qué se descartó y con qué prueba. Esa parte vivía en la
conversación de cada sesión y se perdía al cerrarla, así que la sesión siguiente
volvía a preguntar lo mismo o, peor, rehacía una decisión ya tomada.

Pedido explícito de Andres el 21-ago-2026, después de una sesión en la que dos
cosas ya decididas —la selfie por archivo y el sexo editable— se habían quedado
sin implementar justamente por eso.

## Cómo se escribe una entrada

Orden inverso: **lo más reciente arriba**. Cada entrada lleva las cinco secciones
de abajo, y ninguna es opcional:

| Sección | Qué va |
| :---- | :---- |
| **El caso** | Qué disparó la sesión. Sin esto, dentro de un mes el cambio parece arbitrario. |
| **Qué cambió** | Los cambios de código y documentación, con el porqué de cada uno. |
| **Qué hizo Andres** | Sus decisiones y lo que ejecutó él: consolas, comandos, verificaciones propias. Un cambio hecho "porque me lo pidieron" tiene que decir quién y cuándo. |
| **Verificaciones** | Resultados concretos, con números. `npm test` en verde no es un dato: `1120 tests` sí. |
| **Queda abierto** | Lo que espera una decisión, y de quién. Es la sección que la sesión siguiente lee primero. |

Dos reglas que hacen que esto sirva:

- **Los intermitentes se registran con su prueba.** "El test falla a veces" es
  ruido; "falla 1 de 2 también sobre el árbol limpio, verificado con `git stash`"
  evita que la próxima sesión gaste una hora buscando una regresión que no existe.
- **Lo que NO se hizo también se anota**, con el motivo. Media bitácora se vuelve
  inútil cuando registra solo los éxitos.

---

## 2026-09-02 · El canvas publicado en el repo de Lovable, y la adenda integrada

**Rama:** `docs/rediseno-lovable-canvas` · **Pedido de Andres** (seis pasos:
publicar el commit del canvas en el repo de diseño, limpiar, integrar la adenda
en la especificación, agregar el MCP de Lovable, actualizar `CLAUDE.md`,
verificar y cerrar)

### El caso

Una sesión de **Cowork** había preparado el commit `4771f03` («Canvas aprobado
ce0c8332 como fuente visual…», sobre `955fd0e`) para
`github.com/segurolotengo-diseno/slt-diseno-v3`, pero su sandbox no le permitió
empujarlo: lo dejó como *bundle* de git en `_lovable-push/` con un clon parcial
en `~/slt-diseno-lovable`.

El hallazgo que motiva todo esto está en `semilla/canvas/canvas-reglas-visuales.md`
§1 y en el §0 de la guía v2: **el canvas tiene dos capas de estilo y el repo
portó la equivocada**. La capa 1 «Modernist» (Archivo 800, acento `#ec3013`,
radios 0, fondo `#f3f2f2`) es la base de Claude Design y está **tapada** por la
capa 2 «SeguroLoTengo» (DM Sans 600, naranja `#e2660f`/`#bd550f`, radios
8/12/16, fondo `#fafafa`, foco azul `#2b5a9e`, botón 44 px r12), que es la que
gana por cascada — y que usa exactamente la paleta de `GUIA_DE_ESTILOS.md`.
`src/app/canvas-v3.css` había copiado la capa 1 entera y nada de la 2. Ese es el
origen del «v3 se ve MALO»: no fue mal gusto, fue construir sobre la base que el
propio diseño tapa. Además, la mitad del dibujo vive en estilos **inline** del
HTML, que tampoco entraron.

**Un primer intento, desde la web, no pudo hacer nada de esto**: corrió en un
contenedor distinto y vacío, sin el bundle, sin el clon y sin la adenda, y dejó
constancia de ello (commit `eeca5fd`). Esta sesión corre en el equipo de Andres,
donde los insumos sí estaban, y retomó desde ahí.

### Dos sesiones sobre el mismo directorio

Mientras esta sesión trabajaba, **otra sesión de Cowork operó el mismo árbol**:
entre las 21:41 y las 21:45 creó `chore/material-rediseno`, commiteó el material
(`9e747cb`) y lo mergeó a `main` como **PR #96**, dejando el directorio
*checkouteado en `main`* con la rama del pedido atrás. Se detectó por el reflog,
no por casualidad. Consecuencia práctica: `docs/rediseno-lovable-canvas` tenía el
párrafo de `CLAUDE.md` pero no el canvas, y `main` tenía el canvas pero no el
párrafo. Se mergeó `main` en la rama del pedido antes de seguir — sin eso, la
adenda habría quedado citando un `semilla/canvas/` inexistente en esa rama.

### Qué cambió

- **El canvas está publicado.** `4771f03` empujado a
  `segurolotengo-diseno/slt-diseno-v3`; `main` remoto pasó de `955fd0e` a
  `4771f03` en avance rápido.
- **`_lovable-push/` borrado del disco.** Su propio LEEME lo pedía una vez
  publicado; PR #96 ya lo había agregado a `.gitignore`, así que nunca entró al
  repo de producción.
- **Adenda integrada en `docs/ESPECIFICACION_PANTALLAS.md`** (86 líneas nuevas,
  16 reemplazadas, seis hunks, ningún otro texto tocado):
  §A el pie legal con su redacción literal y la tabla de los siete modales; §B
  los tres bloques de cabecera con el sufijo `(provisional)` y el tercero
  **solo en el Inicio**; §C la tabla de rótulos del carrusel con la cadencia de
  3 s; §D el párrafo «Paleta, tipografía y dibujo», que ahora nombra al canvas
  como fuente del dibujo y advierte que Archivo, el rojo y las esquinas rectas
  son la capa tapada; §E la subsección «Divergencias con el canvas que se
  mantienen», para que nadie las «corrija» hacia el canvas. Encabezado con la
  línea de revisión «Adenda del 01-sep-2026 integrada (canvas ce0c8332)».
- **MCP de Lovable agregado** en el ámbito de usuario
  (`~/.claude.json`): `lovable → https://mcp.lovable.dev` (HTTP). Reporta
  `Needs authentication`; el OAuth lo tiene que completar Andres.
- **`CLAUDE.md` sin cambios**: el párrafo que dejó `eeca5fd` se contrastó línea
  por línea contra `docs/rediseno-lovable/CLAUDE.md-fragmento.md` y coincide,
  con las sustituciones previstas (`segurolotengo-diseno`, `slt-diseno-v3`,
  02-sep-2026, y «(pendiente de aprobación; hasta entonces, rama `main`)» en
  lugar del tag `diseno-v1-aprobado`, que todavía no existe).

### Qué hizo Andres

- Encargó los seis pasos y autorizó la rama `docs/rediseno-lovable-canvas`.
- Aportó el equipo donde vivían el bundle y el clon, y la sesión de `gh` de
  `segurolotengopy` (scopes `repo`, `read:org`, `workflow`) con la que se
  empujó al repo de la organización de diseño.
- **Pendiente de su parte:** el OAuth de Lovable (`/mcp`), sin el cual no se
  puede leer `src/index.css` del proyecto.

### Verificaciones

- `git ls-remote --heads origin main` sobre
  `segurolotengo-diseno/slt-diseno-v3` devuelve **`4771f03`**.
- `gh api …/contents/docs/canvas` lista las **siete** entradas esperadas:
  `canvas-plantilla.html`, `canvas-estilos.css`, `canvas-logica.js`,
  `canvas-textos.md`, `canvas-modales.md`, `canvas-reglas-visuales.md` y
  `capturas/`.
- `git bundle verify` dio «bundle está bien / historia completa» **antes** de
  borrarlo, y el clon quedó con árbol limpio y `origin` apuntando a GitHub, así
  que borrar el bundle no dejó al clon dependiendo de él.
- `npm run verify` en verde: **1247 tests, 91 archivos**, `tsc --noEmit` sin
  errores, ESLint **0 errores y 8 advertencias**. Sin cambios de código.
- Las 8 advertencias son 6 preexistentes (`<img>` en cinco pantallas y una
  variable sin usar en `VerificacionIdentidad.tsx`) **más 2 nuevas que no son
  de esta sesión**: ESLint entró a lintear
  `docs/rediseno-lovable/semilla/canvas/canvas-logica.js`, que PR #96 vendoreó
  al repo. Es material de referencia, no código del producto.

### El estado real del proyecto de Lovable (medido con el MCP)

Andres completó el OAuth y se leyó `src/index.css` del proyecto
`slt-diseno-v3` **sin modificar nada** — por dos vías que coinciden:
`read_file` del MCP y grep sobre `~/slt-diseno-lovable/src/index.css`, que está
sincronizado (el preview ya corre sobre `4771f034`, o sea que Lovable tomó el
push). De los tres rastros que busca P0-bis, **dos siguen y uno ya no está**:

| Rastro | Estado |
| :--- | :--- |
| «Archivo» | **Sigue** (5 ocurrencias): `--font-sans` / `--font-heading` / `--font-body` en `"Archivo"`, `--font-heading-weight: 800`. Debería ser DM Sans 600. |
| «#ec3013» | **Sigue** (2): `--color-accent: #ec3013` y el comentario de cabecera. Debería ser `#e2660f` / `#bd550f`. |
| «radius: 0» | **Ya no está**: radios 8/12/16/20/28, corregidos por `955fd0e` «Redondeó esquinas y fondo claro», anterior al commit del canvas. |

Queda más capa 1 que esos tres marcadores: `--color-bg: #f3f2f2` (debería ser
`#fafafa`), `--color-divider` al 40 % de `#201e1d` (debería ser `#e0e0e0`), la
escala `--color-accent-*` entera en rojo, el foco de v3 en el acento en vez del
azul `#2b5a9e`, y —lo que más daño hace— **`--color-naranja-*` sobrescrito con
la escala roja**, que propaga el acento equivocado a cada `bg-naranja-600` del
árbol.

**El problema de fondo no es un valor.** El comentario de cabecera de
`src/index.css` le *afirma* a Lovable que la capa B es «la última aprobada» y
que «el rediseño en Lovable PARTE de la capa B». Mientras ese texto siga ahí,
un prompt que solo cambie valores compite con una instrucción escrita en el
propio archivo: P0-bis debería reemplazar también ese bloque. La nota de
corrección que agregó `4771f03` está en `docs/01-tokens.css` del repo de
diseño, no en `src/index.css`, así que Lovable no la ve donde importa.

### Queda abierto

- **Lovable**: pegar el *Knowledge v2*
  (`semilla/02-knowledge-lovable-v2.md`) en el proyecto y enviar **P0-bis**
  (`semilla/03-prompts-lovable-v2.md`). El prerrequisito ya está cumplido:
  `docs/canvas/*` y `docs/pantallas/*` viven en el repo de diseño desde el
  push de esta sesión, así que Lovable puede leerlos.
- ~~**P0-bis conviene ampliarlo**~~ — **hecho**: `semilla/03-prompts-lovable-v2.md`
  ahora ataca el comentario de cabecera de `src/index.css` (paso 0 del prompt),
  trae los valores de la capa 2 copiados literales con el tema noche completo,
  e inventaria todo lo que hay que borrar, incluido el bloque que sobrescribe
  `--color-naranja-*` con la escala roja. Sincronizado al repo de diseño
  (`841ac87`), que es donde Lovable lo lee.
- **ESLint sobre el canvas vendoreado**: conviene excluir
  `docs/rediseno-lovable/semilla/canvas/` de `eslint.config.js`. Es un artefacto
  de referencia; lintearlo solo produce ruido.
- **El puntero de `CLAUDE.md`** sigue en la rama `main` del repo de diseño;
  cuando exista el tag `diseno-v1-aprobado` hay que reemplazar «(pendiente de
  aprobación; hasta entonces, rama `main`)» por la etiqueta.
- **Coordinación de sesiones**: dos sesiones sobre el mismo árbol se pisaron hoy.
  Conviene una sola sesión por directorio, o worktrees separados.

---

## 2026-09-01 (g) · Las tarjetas de captura, y el susto de haber roto producción

**Rama:** `fix/canvas-tarjetas-captura` · **Pedido de Andres**

### Qué cambió

Las tarjetas de captura dejan de numerar («1. Cédula · frente» → «Cédula ·
frente»: el canvas nombra las tomas y el orden lo da la posición) y dejan el
chip de estado en mayúsculas. Mientras está pendiente **no muestran chip** —lo
que hay que hacer lo dice el botón—; aprobada muestra «✓ Aprobada» en acento,
como el canvas, y el rojo queda para «No coincide» y «Rechazada».

### El hallazgo importante: se había roto v2, que es producción

`VerificacionIdentidad` es **compartida por los dos flujos**, y los cambios de
la tanda anterior —columna única, botón propio de lectura, bloques de datos
abiertos recién con la lectura— se habían aplicado a las dos. El e2e de v2
(`01-camino-feliz`) lo delató: `#p5-correo` ya no existía al llegar, porque el
correo había quedado detrás de la lectura de la cédula.

**`main` despliega a producción con el flag apagado**, así que eso era romper
el flujo vigente para portar el diseño del nuevo.

Se acotó con una prop `canvas` en el componente: v3 recibe la reestructura y
**v2 conserva su pantalla** —dos columnas, lectura automática al completar la
tercera captura, bloques desde el principio—. Los textos de las tarjetas sí se
comparten: son una mejora y los helpers de e2e los contemplan.

### Verificaciones

Suite **1247** en verde · e2e v3 **10/10** · **e2e v2 `01-camino-feliz` en
verde**, que es la prueba de que producción quedó como estaba.

---

## 2026-09-01 (f) · La comparación exhaustiva contra el canvas, con método

**Rama:** `fix/canvas-textos-faltantes` · **Andres preguntó si se revisó pantalla por pantalla**

### El caso

La respuesta honesta era **no**: se había extraído la estructura del canvas y
comparado bloque por bloque, pero nunca elemento por elemento. Se hizo ahora,
con un método reproducible en vez de a ojo.

### El método, y sus dos errores corregidos

1. Se extraen los textos visibles del canvas por pantalla desde la plantilla
   del Artifact (`canvas-textos.json`, 6 pantallas, 199 textos).
2. Se comparan contra el producto.

El **primer intento comparó contra el `innerText` de la app** y dio 76
diferencias — casi todas falsas: los bloques del canvas que todavía no se
abrieron y los textos dentro de desplegables cerrados no aparecen en
`innerText`. El **segundo** compara contra el **código fuente**, que contiene
los textos exista o no la pantalla abierta: 40 diferencias, y de esas, varias
seguían siendo falsas por textos partidos en varios nodos JSX.

La lección: comparar contra lo renderizado sobre-reporta, y hay que verificar
cada candidato antes de llamarlo faltante. Se verificaron uno por uno.

### Qué se agregó (faltaba de verdad)

- **Inicio**: botón «Ver qué datos usamos y para qué», junto a los términos.
- **Paso 1**: el subtítulo del bloque de documento («Fotografiá tu cédula
  vigente y hacé una selfie en vivo…»), el aviso de correos con el texto del
  canvas («Los dos correos todavía no coinciden — revisalos con calma.») y la
  explicación de por qué se piden los datos complementarios («Los pide la
  normativa de conocimiento del cliente…»).
- **Paso 2**: los botones «Ver coberturas, exclusiones y carencias (PDF)» y
  «Ver condiciones generales de la póliza», que no existían.

### Divergencias deliberadas del canvas (no se copian)

- **Datos de contacto inventados** del canvas (+595 21 000 000,
  `ayuda@interseguros.com.py`, mesas de ayuda): `higiene-de-citas.test.ts`
  pone la suite en rojo con datos de contacto inventados. El producto muestra
  «[dato oficial pendiente]».
- **«producto inscrito SIS-VID-ONC-001/2026 · Res. SS.SG. N° 250/2026»**:
  resolución inventada; el producto usa marcadores.
- **«La firma se realiza con el proveedor de firma electrónica»**: en v3 la
  firma del cliente es **interna** (D1). El canvas quedó desactualizado ahí.
- **«CASO-2026-004518»**: número de caso de maqueta.

### Verificaciones

Suite **1247** en verde · e2e v3 **10/10**. El camino feliz vuelca ahora el
texto de cada pantalla además de la captura (`CAPTURAS_DISENO`), que es lo que
hace repetible esta comparación.

---

## 2026-09-01 (e) · Apertura progresiva, el archivo firmado que nunca llegaba, y la evidencia completa

**Rama:** `fix/canvas-paso1-y-evidencia` · **Andres pidió el análisis pantalla por pantalla y priorizó**

### El caso

Andres señaló que **cambié el UX**: el canvas pide de a poco —primero las tres
capturas y recién después los datos— y la implementación pedía todo junto en
dos columnas. Además reportó tres cosas concretas: el paquete firmado se queda
en «Preparando el archivo firmado…» para siempre, no se entiende qué es el
«Intento 3», y la evidencia de la firma no identifica a la persona.

### Qué cambió

- **Paso 1 en columna única con apertura progresiva**: las tres capturas, un
  botón propio «Tocá acá para leer los datos de mi cédula →» —la lectura ya no
  se dispara sola al completar la tercera—, y los datos aparecen recién con la
  lectura. Rótulos de las tarjetas, los del canvas.
- **El archivo firmado, arreglado.** `archivarDocumentosFirmados` le pedía el
  PDF a un proveedor; con la firma interna (D1) **no hay proveedor**, devolvía
  `SIN_DESCARGA_DE_PROVEEDOR` y el botón no aparecía nunca. Como el acto
  interno no modifica los bytes —lo que prueba la firma es el registro—, el
  documento firmado **es** el paquete cerrado: se archiva bajo la clave de
  firmado, con la misma verificación de huella que se le exige al proveedor.
  Dos tests nuevos, uno de ellos sobre el caso en que la huella no coincide.
- **Evidencia de la firma completa**: titular, cédula, fecha de nacimiento, IP
  de la verificación de identidad, resultado de prueba de vida y coincidencia
  facial, y la huella de las tres capturas. **La foto no se puede mostrar**:
  las imágenes no se persisten, solo su SHA-256 y la referencia del proveedor.
- **Pie legal colapsable** («INFORMACIÓN LEGAL Y REGULATORIA ▾») desde el paso
  1, como el canvas; la bienvenida lo deja abierto.
- **Bloque IMPORTANTE** con el dibujo del canvas y el botón «Ver cómo cuidamos
  tus datos» a la derecha.
- **Pestañas de ramos** subrayadas, no cajas.
- Los tres bloques bajo el botón de pago (plazo, secuencia, seguridad) pasan a
  texto chico: **no se quitan** —el plazo es D-10 y las viñetas de seguridad
  son la fila 24 de la matriz— pero dejan de ocupar media pantalla.

### Corrección a la lista anterior

Se había reportado que faltaba el bloque «QUÉ CUBRE Y DESDE CUÁNDO». **Existe**
desde el lote F3; el dato era falso.

### Verificaciones

Suite **1247** en verde · e2e v3 **10/10**. Los specs de identidad se
actualizaron a los rótulos del canvas y al botón de lectura explícito.

### Queda abierto

- **Orden de bloques del paso 1**: el canvas va documento → identidad →
  canales → complementarios → aceptación. Hoy el correo y los complementarios
  viajan en la misma llamada que la identidad, y el OTP exige
  `IDENTIDAD_VERIFICADA`; para el orden del canvas hay que **partir**
  `/api/p5/identidad`. Es cambio de dominio: queda para después de la demo.
- Beneficiario: faltan los dos campos del canvas (fecha de nacimiento y
  celular), que tocan el expediente y la Solicitud.
- ~~«Intento N»~~ y ~~la confirmación~~: resueltos en la misma sesión. El
  contador dice ahora «3.º intento de envío» —a secas se leía como un intento
  fallido de la persona—; los documentos se agrupan bajo «TUS DOCUMENTOS» y
  «Y ESTOS TE LLEGAN EN BREVE», y los cuatro hitos pasaron de tarjeta con
  título a la fila entre filetes del canvas.

---

## 2026-09-01 (d) · Los modales de Bancard y los mecanismos del canvas

**Rama:** `fix/canvas-modales-bancard` · **Andres, molesto y con razón**

### El caso

Andres preguntó, literal: «COMO TENGO QUE DECIRTE QUE SE RESPETE PRIMERO EL
DISEÑO, explícame qué debo decir». La respuesta honesta es que **no tiene que
decirlo distinto**: lo pidió bien desde el principio. El método estaba mal.

Lo que se venía haciendo era **trabajar por diferencias**: comparar la pantalla
propia con el canvas, arreglar lo señalado, y a la ronda siguiente aparecían
más diferencias, porque el armazón seguía siendo el propio. Cada tanda tapaba
un síntoma.

Lo que señaló esta vez: el QR y la tarjeta aparecían **como una sección más
abajo** en vez de en un modal; la tarjeta no simulaba el entorno de Bancard ni
dejaba llenar datos; la aceptación de firma era «un click oculto» donde el
canvas tiene un recuadro grande; y los medios de pago eran tarjetas de radio
con viñetas donde el canvas pone tres botones chicos.

### Qué cambió

- **`ModalBancard.tsx`**: la ventana del canvas — los tres puntos, la barra con
  `vpos.bancard.com.py` y el candado, la cabecera «Bancard · vPOS» con el
  comercio y el importe. El QR y el formulario de tarjeta viven **adentro**.
  No es solo estética: dibujarlo como una sección contaba mal lo que pasa,
  porque sugiere que el cobro ocurre dentro del portal.
- **Medios de pago**: tres botones del canvas en una fila, y el peso visual en
  el botón de pagar. Antes eran tres tarjetas de radio con viñetas cada una.
- **`data-falta`**: se descubrió que el canvas trae su **propio mecanismo** —
  un atributo que pinta el recuadro y escribe «* TE FALTA ESTO» desde el CSS—
  y ya estaba en el port sin usarse. Reemplaza a la versión a mano en las cinco
  preguntas y en las dos aceptaciones. Además, el canvas marca lo que falta
  **desde el principio**, no recién al chocar contra el botón.
- **Botones de firma**: apilados y grandes, como la acción principal que son.
- **Barra del plan**: pasa debajo de la foto, que es donde el canvas la pone.

### Regla #6, revisada al agregar los campos de tarjeta

El test de guarda saltó al cambiar los radios por botones (`p7-medio` dejó de
ser un `<input>`). Se corrigió la lista **y se le agregó una guarda nueva**
para la ventana simulada: comprueba, leyendo el código, que no llame a la red,
no persista en el navegador, no escriba a `console` y que `alPagar` **no pueda
recibir** los valores de la tarjeta. Los campos existen porque el canvas los
modela; lo que los hace inofensivos es que no salen del navegador.

### Verificaciones

Suite **1244** en verde (una guarda nueva) · batería e2e v3 **10/10**.

### Confirmación (misma sesión, quinta tanda)

Reconstruida al encabezado del canvas: kicker «CONTRATACIÓN ACEPTADA», título
grande y bajada a la izquierda, y **la foto al costado** en vez de una banda
sobre todo lo demás. Las tarjetas de documento pasan al dibujo del diseño —
nombre y detalle a la izquierda, la acción a la derecha y en la misma línea—;
antes el botón caía debajo y cada documento ocupaba el triple de alto.

La versión de v2 del encabezado se conserva intacta detrás del flag.

### Queda abierto

- Nada identificado del canvas sin portar. Lo que siga sale de la revisión de
  Andres sobre la demo.

---

## 2026-09-01 (c) · El sistema de diseño del canvas, portado de verdad

**Rama:** `fix/canvas-sistema-de-diseno` · **Andres, con capturas lado a lado**

### El caso

Andres puso las capturas del canvas contra las de la demo: «SON MUY
DIFERENTES EN ESTILO». Y tenía razón. Lo que se había hecho hasta acá era
tomar del canvas **los colores, la tipografía y las fotos** y seguir dibujando
los componentes con Tailwind. Eso no es importar un diseño: es pintarle encima
al que ya había.

Su segundo mensaje precisó que no es solo CSS: faltaban **los mensajes, los
tamaños, las posiciones y las ayudas al cliente** —el ejemplo que dio es la
píldora «Acá abajo está el botón…», que el canvas tiene en las cinco pantallas
y acá no existía—, y sobraban mensajes propios. Y los controles: donde el
canvas pone botones, acá había radios que «no se ven».

### Qué cambió

- **`src/app/canvas-v3.css`**: el CSS del canvas portado **tal cual** desde el
  Artifact —tokens, `.btn`, `.input`, `.field`, `.seg`, `.radio`, `.card`,
  `.tag`, tipografía y escalas—, encapsulado bajo `[data-flujo="v3"]` para que
  v2 no lo vea. Se le quitaron las `@font-face` (Archivo entra por
  `next/font`) y se acotó la regla de enlaces a `a:not([class])`: sin eso
  pintaba de rojo y subrayaba hasta los botones.
- **`BandaPasosV3`**: la banda de tres columnas del canvas, a lo ancho y bajo
  la cabecera, con el filete de color y el ✓ de los pasos cumplidos. Reemplaza
  al «Paso N de 3» con puntitos, que **el diseño nunca tuvo**.
- **`AvisoCtaFlotante`**: la píldora del canvas. No sabe de pantallas: busca
  los botones con `data-cta`, toma el primero que quedó bajo el borde y muestra
  su mensaje. Los CTA de los pasos 2 y 3 ya lo declaran.
- **Beneficiario**: dos botones, como el canvas, en vez de radios; y la
  explicación de lo elegido en la cita al margen del diseño.
- **Declaraciones**: en la rejilla `minmax(330px, 1fr)` del canvas y con el
  rótulo «* TE FALTA ESTO» arriba de la pregunta, no un asterisco al final.
- **Carrusel**: la primera foto estaba en flujo y las otras tres absolutas, así
  que su rótulo quedaba más arriba y el carrusel «saltaba». Ahora las cuatro
  son absolutas y el alto lo da el contenedor.

### Verificaciones

- Suite **1243** en verde · batería e2e v3 **10/10**.
- Los tres tests del stepper se reescribieron: asertaban «Paso N de 3», que es
  el rótulo que el canvas no tiene. Ahora comprueban la banda y su
  `aria-current`.

### Tarjetas de plan (misma sesión, después del primer despliegue)

Portadas al dibujo del canvas detrás de una prop `canvas` en
`SelectorDePlanes`, para no tocar la maqueta de v2: cabecera a la izquierda sin
escudo, precio grande debajo del nombre, importe apilado sobre el concepto,
rótulo «✓ SELECCIONADO» en vez de la cinta, y el control como botón declarado
(«Tocá acá para elegir este plan» / «✓ Plan elegido»). **Conserva
`role="radio"` y `aria-checked`**: la elección sigue siendo una de tres y los
e2e de v2 dependen de esa semántica.

### Campos y encabezados (misma sesión, tercera tanda)

- **Campos**: la especificación `.input` del canvas aplicada a todos los
  campos de v3 de una vez —alto, fondo, borde, foco y etiqueta chica— en vez
  de repetirla componente por componente. La estructura ya era la del diseño
  (etiqueta + control); lo que difería era el dibujo.
- **Encabezados**: se quitó del port la **escala global de tamaños** del canvas
  (h1 42px … h6 13px). El diseño fija el tamaño de cada encabezado dentro de
  su pantalla, y la escala global agrandaba los rótulos de sección que acá se
  dimensionan con utilidades: «ESTADO DE LA CONTRATACIÓN» salía a 32 px. Se
  conservan familia, peso, interlínea y `letter-spacing`.

### Tarjetas de captura (cuarta tanda)

`IlustracionCaptura.tsx`: los tres dibujos del canvas —frente con retrato y
renglones, dorso con la banda del MRZ, encuadre de la selfie— copiados trazo
por trazo del Artifact. Heredan `currentColor`, así que siguen el estado de la
tarjeta sin recibir props de color. Antes las tarjetas eran solo texto y no se
distinguía de un vistazo cuál de las tres fotos tocaba.

### Queda abierto

- Nada identificado del canvas sin portar. Lo que siga sale de una revisión
  nueva de Andres sobre la demo desplegada.
- El canvas pide la cédula del beneficiario obligatoria; Andres confirmó que
  **no** lo es, así que queda opcional y la divergencia se cierra a favor del
  cumplimiento.

---

## 2026-09-01 (b) · El diseño del canvas, aplicado de verdad a las tres pantallas

**Rama:** `fix/diseno-canvas-3-pantallas` · **Feedback de Andres probando la demo**

### El caso

Andres reportó que el diseño no estaba aplicado en `/seguro`, `/pago-y-firma`
ni `/confirmacion`: los recuadros no llenaban la pantalla, las fotos cortaban
las caras, el carrusel del inicio arrancaba por la foto 4, y el pago abría un
enlace a otra pestaña. Instrucción explícita: **seguir el canvas, no
improvisar**.

El canvas se volvió a leer del Artifact (`ce0c8332…`), extrayendo su plantilla
y su manifiesto: de ahí salen los números que se aplicaron, no de la memoria.

### Qué cambió

- **Rejillas del canvas** — el diseño usa
  `repeat(auto-fit, minmax(Npx, 1fr))` en todos lados; el código tenía
  `sm:grid-cols-2` / `lg:grid-cols-3`, que a anchos intermedios colapsan a una
  columna y dejan media pantalla vacía. Se agregó `.v3-rejilla` (scopeada a
  `[data-flujo="v3"]`, así v2 no se toca) y se aplicó en los nueve bloques,
  cada uno con el mínimo que declara el canvas.
- **Recorte de las fotos** — el canvas recorta en `object-position: center 35%`
  (pasos), `40%` (carrusel) y `45%` (cierre); sin eso el 50 % por defecto
  cortaba las caras. Alto `clamp(140px, 20vw, 210px)`, como el diseño.
- **Carrusel del inicio** — arrancaba por la foto 4 porque los desfases
  positivos dejan a las que no empezaron en su estado base (opacidad 1) y
  ganaba la última del DOM. Ahora `opacity: 0` de base y desfases **negativos**:
  arranca por la foto 1 y rota 1→2→3→4, 3 s cada una (pedido de Andres; el
  canvas usaba 4,5 s). Se agregaron los rótulos sobre cada foto.
- **Pago con tarjeta** — desapareció el enlace «Abrir formulario seguro ↗» a
  otra pestaña; ahora aparece la ventana simulada de Bancard dentro de la
  pantalla (`VentanaBancardSimulada.tsx`), con los campos, el botón de
  completar con datos de ejemplo y el de pagar, como el modal del canvas. Los
  datos de la tarjeta **no salen del navegador** (regla inviolable #6): el
  componente no los manda a ningún endpoint y `alPagar` no los recibe.
- **Casilla de confirmación de identidad** — pasó **arriba** del botón y el
  botón queda desactivado hasta marcarla (antes quedaba habilitado y repetía
  el mismo rechazo). Entró a la lista de faltantes con su ancla.
- **Nombres del OCR** — `nombre-plausible.ts` (dominio, con tests): si lo que
  la lectura del frente devuelve no puede ser un nombre, el campo queda
  **vacío**. Sin MRZ la lectura adivina por posición y devolvía «BLI» y «FECHA
  DE VENCIMIENTO» como nombre y apellido. No es un diccionario de nombres —eso
  dejaría afuera nombres legítimos raros—: descarta lo que no puede ser uno.
- **Botón *Finalizar*** — redirigía a `/plan`, que en v3 reenvía a `/seguro`, y
  quien terminaba caía en un paso 2 sin inscripción. Ahora
  `RUTA_CIERRE_DE_TRAMITE` manda a la raíz en v3 y sigue en `/plan` en v2.
- **Beneficiario** — nombre, parentesco y domicilio quedan marcados con `*` y
  se pintan en rojo cuando faltan, como el canvas.

### Divergencia declarada con el canvas

El canvas pide la **cédula del beneficiario obligatoria** (y suma fecha de
nacimiento y celular). Se mantuvo **opcional**: la Res. SIS 215/2025 num. 11.4
exige nombre y domicilio, no el documento de un tercero, y exigirlo sería pedir
más que la norma (CHG-24, CMP-21). Los dos campos que el canvas agrega no se
crearon: tocan el modelo del expediente y la Solicitud, y «cada campo extra es
un problema de negocio». Queda a decisión de Andres.

### Verificaciones

- Suite **1243** en verde (5 tests nuevos de `nombre-plausible`, con los
  valores reales que devolvió el OCR de la cédula de Rodrigo).
- Batería e2e v3 **10/10**. El camino feliz gana `CAPTURAS_DISENO`, que
  guarda una captura por pantalla para comparar contra el canvas.

### Validación contra el canvas de las pantallas restantes (01-sep, tarde)

El canvas tiene **seis** pantallas: bienvenida, los tres pasos, confirmación y
revisión manual. **No trae solicitud vencida**: esa pantalla es del sistema y
no tiene contraparte en el diseño.

- **Revisión manual**: los textos del canvas están todos («Tu solicitud queda
  en buenas manos», el párrafo de que no es un rechazo, «Nada se movió de tu
  bolsillo»), y la pantalla agrega el detalle operativo que el canvas no
  modela —número de caso, estado, qué se envió al análisis, contactos—. Se
  conservó: quitarlo sería perder información de cumplimiento para parecerse
  más a una maqueta.
- **Bienvenida**: el canvas **no dibuja stepper** ahí (`enPasos` lo esconde) y
  la cabecera del inicio suma un tercer bloque, el canal digital. La raíz de
  v3 mostraba «P0 · INFORMACIÓN / FUERA DEL CONTADOR 1-3», nomenclatura de v2
  —donde esa pantalla existía— y se retiró.

### Queda abierto

- El tercer bloque de cabecera del canvas en la bienvenida (CANAL DIGITAL ·
  SeguroLoTengo.com) no se agregó: la cabecera es un componente compartido por
  las doce pantallas y tocarla afecta a todas.
- Los dos campos de beneficiario del canvas, si Andres los quiere.

---

## 2026-09-01 · La constancia de la firma del cliente

**Rama:** `feat/constancia-firma-cliente` · **Pedido de Andres**

### El caso

Andres pidió dos cosas: confirmar que el flujo v3 usa la solución **interna**
de firma no cualificada, y poner un botón donde se puedan ver las evidencias
de esa firma.

Lo primero está confirmado en código: `/pago-y-firma` monta `FirmaInternaV3`,
que llama a `solicitarOtpDeFirmaCliente` y `registrarActoDeFirmaCliente`
(`src/domain/firma-cliente.ts`), y la firma se asienta con
`origen: "INTERNA"` y `referenciaActo` = el OTP consumido. Code100 (mock)
queda solo para las cualificadas de Interseguros y Alianza, aplicadas después
por el sondeo de siempre. Coincide con D1 y con el CLAUDE.md.

Lo segundo no existía, y su ausencia era el agujero real: **como la firma no
es cualificada, no hay certificado de un prestador que la persona pueda
abrir**. Lo que la respalda es el registro de evidencia, y ese registro vivía
únicamente en la consola interna. Quien firmaba no tenía forma de ver qué
respalda su propia firma.

### Qué cambió

- **`src/domain/constancia-firma.ts`** (nuevo): proyección pura del Expediente
  + su historial de evidencia. Agrupa los hechos por los **tres requisitos de
  la Res. SS.SG. 210/2025 art. 4** —identificación, integridad, trazabilidad—
  en vez de volcar una lista de registros que no le dice nada a nadie, e
  incluye lo que el art. 9 manda conservar (IP, fecha y hora, códigos de
  validación). Declara explícitamente la naturaleza de la firma
  (`SIMPLE_NO_CUALIFICADA`, emisor `SEGUROLOTENGO`) para que la constancia no
  se lea como un certificado cualificado.
- **Solo constata la firma interna.** Sobre `origen: "PROVEEDOR"` devuelve
  `null`: citar los artículos de la firma simple sobre un acto producido de
  otra manera sería falso.
- **`GET /api/p8/evidencia-firma`** (nuevo): lectura pura sobre el expediente
  de la cookie. No escribe evidencia — mirar lo que respalda la propia firma
  no es un hecho que haya que asentar, y sería una escritura por apertura.
  Registrado en `SOLO_LECTURA` del inventario de rutas.
- **`ModalEvidenciaFirma`** (compartido) + botón **«Ver la evidencia de mi
  firma»** en dos lugares: la sección de firma del paso 3 y la pantalla de
  confirmación. En confirmación va gateado por `firma.origen === "INTERNA"`,
  que la página resuelve en el servidor: la pantalla es compartida con v2 y
  ahí el botón habría mostrado un panel que miente.
- Nunca sale el código del OTP (regla #2: viaja su referencia) ni datos de
  salud o PEP (regla #7); el canal va enmascarado.

### Verificaciones

- Suite: **1231 tests** en verde (6 nuevos en `constancia-firma.test.ts`,
  incluido uno que serializa la proyección y comprueba que no filtre).
- Batería e2e v3: **10/10**, con el camino feliz extendido — abre el panel
  tras firmar, comprueba los tres pilares y la cita de la norma, y vuelve a
  abrirlo en confirmación para probar que sigue alcanzable después de pagar.

### Queda abierto

- La constancia no se descarga como PDF. Si Legal la quiere como instrumento
  entregable, es otro documento del motor (con huella y QR), no este panel.
- Sigue pendiente el fix del 500 del demo-panel, que Andres está validando.

---

## 2026-08-31 (f) · La carrera del OTP de firma simulado, cerrada

**Rama:** worktree `upbeat-swirles-88c054` (`claude/silly-rhodes-75e3d9`) · **Arreglo puntual**

### El caso

En dev, `POST /api/p8/firmador-simulado` devolvía `CODIGO_INCORRECTO` con el
código que mostraba el panel de demo.

**El mecanismo real no es el que traía el diagnóstico de entrada.** Este quedó
anotado como un intercalado de escrituras (sesión=hash_B con panel=código_A), y
al intentar reproducirlo se vio que con el almacén en memoria —el de `next dev`
y el de los tests— eso no puede pasar: `obtener` devuelve **la misma
referencia** de sesión a las dos aperturas y las escrituras van en lockstep, así
que gana la última en las dos colecciones y el estado queda consistente solo.

Lo que sí pasaba, y alcanza de sobra: el doble montaje de StrictMode dispara dos
ABRIR y el segundo **regeneraba el código**. Quien leyó el panel entre los dos
montajes tipeó uno ya reemplazado. Sin ninguna escritura intercalada de por
medio: bastaba con regenerar.

### Qué cambió

- `abrirEnlaceDeFirmaMock` recibe el **origen** de la apertura. Un
  `MONTAJE_DE_PANTALLA` con el código vigente de menos de 60 s es idempotente
  (devuelve su `expiraEn` sin acuñar otro): eso cierra el síntoma y, con
  `INTEGRATION_OTP=live`, deja de mandar dos WhatsApp por una pantalla abierta
  una sola vez. Un `PEDIDO_EXPLICITO` —el valor por defecto— **siempre rota**.
- El Route Handler gana la acción `REEMITIR`, distinta de `ABRIR`: la pantalla
  manda `ABRIR` al montarse y `REEMITIR` desde *Pedir un código nuevo*.
- Serialización de aperturas por `idCode100` (`APERTURAS_EN_CURSO`). Queda como
  defensa del almacén **desplegado**, que es DynamoDB: ahí cada lectura devuelve
  una copia y cada escritura es una llamada de red con latencia propia, así que
  el orden entre las dos colecciones sí puede cruzarse. En memoria no hay caso
  que falle sin ella, y el código y los tests lo dicen en vez de sugerir lo
  contrario.
- Seis tests en `signature-provider.test.ts`, incluidos los dos que faltaban:
  que el pedido explícito rota a los dos segundos, y que con los tres intentos
  agotados hay salida inmediata.

### Qué hizo Andres

- Eligió la dirección **combinada** (idempotencia dentro de los 60 s +
  rotación después) entre tres opciones.
- Revisada la implementación a pedido suyo, apareció que esa idempotencia
  rompía *Pedir un código nuevo*: dentro del minuto devolvía el mismo código
  con `ok: true`, lo que dejaba `e2e/09-firma-reintento-codigo.spec.ts` en rojo
  y —con los 3 intentos agotados— convertía el botón en un callejón sin salida
  de hasta un minuto, que responde que anduvo sin emitir nada. Eso contradecía
  la condición con la que él había aceptado pedir el código dentro de la
  pantalla (21-ago-2026). **Elegió distinguir el montaje del pedido explícito**,
  sabiendo el precio: el «reenvío bloqueado 60 s» de la regla inviolable #1 no
  rige para el botón de este tercer OTP. Es una **divergencia declarada**, no un
  olvido; la regla sigue entera para los OTP de canal, donde `OtpRepository` la
  aplica con `REENVIO_BLOQUEADO`.
- Se verificó antes que la matriz de cumplimiento **no** exige el cooldown (las
  filas de OTP —13, 22, 42, 68, 75— hablan de control de canal y evidencia): el
  respaldo del «reenvío bloqueado 60 s» es la regla #1 de CLAUDE.md, decisión de
  la casa, no obligación legal.

### Verificaciones

- **Una prueba que se cayó, y queda anotada porque es la lección**: el primer
  test del intercalado «falló 2 de 3 corridas» con el arreglo neutralizado, y
  eso se leyó como que reproducía la carrera. No era: fallaba por la aserción de
  idempotencia (`expiraEn` igual), que sin el cooldown falla siempre, y pasaba
  1 de 3 cuando los dos códigos se acuñaban dentro del mismo milisegundo y los
  vencimientos coincidían por casualidad. Neutralizando **solo** el candado, el
  test de intercalado pasa 3 de 3: no hay caso en memoria que lo necesite.
- La regresión del reintento sí se comprobó con un test descartable: dentro del
  minuto el código no cambiaba (`primero=769297 segundo=769297`) y, con los
  intentos agotados, firmar con el «nuevo» daba `INTENTOS_AGOTADOS`.
- Con el arreglo: 33 tests del adaptador en verde. Cadena completa: typecheck +
  lint + **1229 tests** (89 archivos).
- **E2E 09 en verde (1.4 m)**, que es el que la primera versión rompía. Su paso
  prueba además que el camino nuevo es el que corrió: si el servidor hubiera
  rechazado la acción `REEMITIR`, el código no habría rotado y el test caía en
  el `poll`.
- **E2E 01 (camino feliz) en verde** (3.8 m con 07). De los cinco escenarios que
  abren el acto de firma, los otros tres (06, 07, 98) usan el mismo helper y el
  mismo camino que 01 y 09 recorren.
- **E2E 07 falla, y no es de este cambio.** Falla en `GET /demo-panel` con 500,
  dos corridas de dos. La causa, capturada del servidor: `TypeError: ArrayBuffer
  is not detachable and could not be cloned` → `failed to pipe response`. Es el
  500 preexistente que la entrada anterior dejó anotado con sesión propia, y
  ahora tiene mecanismo: `/demo-panel` es un Server Component que hace `await`
  sobre `listarSesionesFirmaMock()` (`page.demo.tsx:116`), y esas sesiones
  llevan `documentoFirmado: Uint8Array` —el PDF firmado, de varios KB— apenas el
  cliente firmó. El canal de depuración RSC de `next dev` encola crudo cualquier
  `Uint8Array` grande que se awaitee y revienta al clonarlo. Por eso 07 lo pega
  (firma y después abre el panel) y 09 no (abre el panel antes de firmar). Este
  cambio no agrega ni mueve bytes.

### Queda abierto

- **El 500 de `/demo-panel` ya lo está arreglando otra sesión**, y no hay que
  tocarlo desde acá: el worktree `review-pending-prs-e227dd` (rama
  `claude/eager-blackburn-166061`) tiene sin commitear el cambio de
  `documentoFirmado: Uint8Array` a `documentoFirmadoBase64: string`, con su
  entrada `2026-08-31 (e)`. El diagnóstico de esta sesión y el de esa coinciden
  en el mecanismo, llegando por caminos distintos. **Los dos cambios conviven**:
  la fusión a tres bandas de `signature-provider.ts` contra el ancestro común
  real da limpio, porque ellos tocan el campo del PDF y la descarga, y esta
  sesión la apertura del acto. Lo que sí choca es `docs/BITACORA.md`, un
  conflicto por anteponer entrada los dos; por eso esta se numeró `(f)`, ya que
  `main` ocupa hasta la `(d)` y `(e)` está reservada por ellos.
- **Falta correr los E2E que no se tocaron**: 06 y 98 usan el mismo helper de
  firma y no se ejecutaron acá; 06 además pasa por el panel, así que puede pegar
  el mismo 500 preexistente.
- La divergencia declarada de la regla #1 vive hoy solo en el comentario del
  adaptador y en esta entrada. Si Andres quiere que quede en CLAUDE.md junto a
  la regla, es una línea.
- Los cambios siguen **sin commitear** en el worktree, que además quedó **10
  commits atrás de `main`** (entraron F5b, F5c y F5d mientras tanto). Entre lo
  que avanzó está `e2e/support/flujo.ts`, que es el helper con el que se
  corrieron los E2E de acá: conviene rehacer 01 y 09 después de mergear `main`,
  no antes.

---

## 2026-08-31 (e) · El 500 de /demo-panel tras la firma: binario en el estado demo contra el debug RSC de dev

**Rama:** `claude/eager-blackburn-166061` (worktree `review-pending-prs-e227dd`) · **Arreglo de bug preexistente**

### El caso

Andres reportó que `e2e/07-firma-atomica.spec.ts` (línea 33, «si las firmas
institucionales no llegan, el cobro sigue inhabilitado») fallaba de forma
reproducible: `GET /demo-panel` devolvía 500 con `TypeError: ArrayBuffer is
not detachable and could not be cloned`, «Invalid state: ReadableStream is
already closed» y «failed to pipe response, page: /demo-panel». Verificado por
él también sobre main limpio (worktree en `ffa1900`): preexistente, no
regresión de los lotes F4.

### El diagnóstico, con su prueba

La cadena completa, verificada paso a paso:

1. Al firmar el cliente, el mock de Code100 guardaba el PDF firmado
   (`documentoFirmado: Uint8Array`, la constancia real pesa **2567 bytes**) en
   la sesión simulada, que con `DYNAMODB_TABLE` puesto vive en DynamoDB
   (`AlmacenEstadoDemo`). Por eso el 500 empezaba exactamente en la primera
   lectura del panel posterior a la firma.
2. `/demo-panel` hace `await` de esas sesiones en un Server Component. **El
   modo dev de Next serializa como debug info del payload RSC los valores de
   todos los awaits, incluidos los intermedios** (la respuesta cruda del SDK).
   Prueba: el HTML del panel en dev contiene `urlActoDeFirma` y otros campos
   de la sesión que la página jamás renderiza.
3. React Flight copia los chunks binarios de hasta 2048 bytes, pero **los
   mayores los encola crudos** en su stream de bytes. El Uint8Array que
   devuelve el SDK es una vista sobre el buffer de 64 KB de la respuesta HTTP
   (se capturó con instrumentación: `byteLength:2567, byteOffset:22728,
   bufferByteLength:65536`), y el `enqueue` de un byte-stream transfiere el
   ArrayBuffer subyacente — Node se niega a transferir una vista compartida y
   tira el TypeError. El stream muere, y de ahí los errores secundarios y el 500.
4. Repro mínima bidireccional (tabla efímera + ítem sintético + GET):
   sesión con documento de 2567 bytes → 500; sin documento → 200; con
   documento de 1400 bytes → 200 (por el umbral de copia de 2048). El fallo no
   era aleatorio: dependía del tamaño del documento.
5. **Filtrar el campo a la salida de `listarSesionesFirmaMock` no alcanzó** —
   se implementó y el 500 siguió, porque el debug captura el await interno del
   SDK antes de que el recorte exista. Esto descartó la primera hipótesis y es
   lo que obligó al arreglo de fondo.

### Qué cambió

`src/adapters/mock/signature-provider.ts`, tres cosas:

- `SesionFirmaMock.documentoFirmado: Uint8Array | null` →
  `documentoFirmadoBase64: string | null`. El almacén de estado demo es
  «colección + clave + JSON» por contrato; el binario era un polizón. Sin
  atributo Binary no hay vista intransferible que el debug de dev pueda
  encolar, en ninguna página presente o futura.
- `descargarDocumentoFirmado` decodifica y devuelve una copia con buffer
  propio. El round-trip base64 conserva los bytes exactos, así que la
  verificación de huella de `archivarDocumentosFirmados` sigue intacta.
- `listarSesionesFirmaMock` devuelve `SesionFirmaVisiblePanel`
  (`Omit<…, "documentoFirmadoBase64">`): higiene de alcance — el panel muestra
  metadata del acto, no el documento — con el comentario explicando que esto
  solo **no** es la defensa.

Sesiones viejas ya persistidas con el campo binario no se migran: son estado
efímero de proveedor simulado con TTL de 48 h, no evidencia (regla #10 no
aplica); pierden la descarga del PDF firmado y se van solas.

### Qué hizo Andres

Reportó el bug con los digests y la verificación sobre main limpio que ahorró
la mitad del diagnóstico. No hubo decisiones nuevas de producto: el arreglo no
toca reglas inviolables (el hash de la firma, que es lo probatorio, vive en el
expediente y no cambió).

### Verificaciones

- Reproducción real: 2 corridas del escenario 07 con el 500 idéntico al
  reporte, más la repro mínima sintética en ambos sentidos (500 con bytes
  >2048, 200 sin bytes y con bytes ≤2048).
- Tras el arreglo: repro sintética con documento de 2567 bytes en base64 →
  `GET /demo-panel` 200; `npx tsc --noEmit` limpio; `npm run lint` limpio;
  `npm test` **1195 tests, 88 archivos, todo verde**; el escenario 07 completo
  contra servidor limpio (resultado en la sección de abajo si difiere).
- La instrumentación usada (wrapper de `ReadableByteStreamController.enqueue`
  y `ArrayBuffer.prototype.transfer` precargado con `NODE_OPTIONS`) fue
  temporal y no quedó en el repositorio.

### Queda abierto

- **Carrera del OTP de firma en dev** (la destapó este diagnóstico, 3 veces de
  6 corridas con la máquina cargada): el efecto de `BloqueOtpFirma` que emite
  el código corre dos veces por el doble montaje de StrictMode y cada `ABRIR`
  regeneraba el OTP, así que quien leía el código del panel entre los dos
  montajes tipeaba uno ya reemplazado (`CODIGO_INCORRECTO` con el código
  correcto a la vista). **Cerrada en la entrada (f) de este mismo día**, que se
  integra en el mismo PR que esta.
- **Corrección a este diagnóstico:** acá quedó anotado que el mecanismo era un
  intercalado de escrituras (sesión con un hash y panel con otro código). La
  entrada (f) lo desmintió con pruebas: con el almacén en memoria —el de
  `next dev` y el de los tests— las dos aperturas comparten la misma
  referencia de sesión, así que gana la última en las dos colecciones y el
  estado queda consistente. Bastaba con regenerar el código; el intercalado
  solo es alcanzable con el almacén desplegado.


---

## 2026-08-31 (d) · Lote F5d: correcciones reales — drill-down, confirmación y la tarjeta de la selfie

**Rama:** `feat/f5d-correcciones-reales` · **Segundo feedback de Andres con documentos reales**

### El caso

Segunda prueba de Andres con la cédula real de Rodrigo destapó tres cosas:
(1) la nacionalidad era texto libre y pidió drill-down; (2) puso **su** selfie
sobre el documento de Rodrigo y la tarjeta dijo «Aprobada» mientras el
rechazo real («no coincide») aparecía lejos, abajo — error de UX; (3) el
cotejo de CHG-15 bloqueaba sus correcciones legítimas («Rodrigo»,
«Fernandez Echazu») porque el OCR había leído basura y la distancia de
edición no perdona: «No me permite seguir».

### Qué cambió (vale para v2 y v3)

- **Nacionalidad por lista** (`NACIONALIDADES_ADMITIDAS = PARAGUAYA,
  BOLIVIANA` en `cotejo-ocr.ts`): `<select>` en pantalla y cotejo por
  pertenencia, como el sexo. Elegir un valor de la lista nunca «no coteja».
- **Confirmación explícita cuando el cotejo falla**
  (`verificacion-identidad.ts`): el primer VALIDAR devuelve
  `CORRECCION_NO_COINCIDE` + `camposQueNoCotejan`; la pantalla muestra un
  mensaje honesto («no se parece a lo que la lectura automática leyó», ya no
  «lo que dice tu cédula») y una casilla «escribí mis nombres exactamente
  como figuran». Revalidar con `confirmaCorrecciones: true` acepta el valor
  y deja evidencia `correccionConfirmadaSinCotejo=<campos>` (nombres de
  campos, nunca valores). El OCR malo deja de ser un callejón sin salida sin
  volverse un bypass silencioso: queda asentado qué campos pasaron sin cotejo.
- **La tarjeta de la selfie dice la verdad**: si la calidad aprobó pero la
  coincidencia facial no, la tarjeta pasa a rojo con «No coincide» y el texto
  «Repetila» — el veredicto vive donde está la foto, no tres bloques más abajo.

### Qué hizo Andres

- Reportó los tres problemas con capturas (31-ago). Autorizó pruebas con los
  documentos reales de `tests/fixtures/identidad/` (fixtures D-21,
  gitignorados; sus datos bolivianos solo para pruebas).

### Verificaciones

- Suite completa: **1224 tests** en verde; `verificacion-identidad.test.ts`
  17/17 (4 tests nuevos: normalización a lista, BOLIVIANA legítima,
  «Marciana» rechazada, y el ciclo sin confirmar → `camposQueNoCotejan` /
  confirmado → guardado + evidencia). Batería e2e v3: 10/10.
- Playwright manual contra dev en mock (fixtures reales de Rodrigo por
  archivo): primer VALIDAR → 400 `CORRECCION_NO_COINCIDE`
  `["nombres","apellidos"]`, aparece la casilla, segundo VALIDAR con
  `confirmaCorrecciones: true` → identidad verificada, sección WhatsApp
  activa. BOLIVIANA pasó a la primera. Payloads y respuestas capturados.
- La prueba con Textract/Rekognition **reales no se pudo correr en local**:
  `aab1-demo-qa` no tiene `rekognition:DetectFaces` (AccessDenied); solo el
  rol de cómputo de Amplify los tiene. Queda para la demo desplegada.

### Queda abierto

- Probar el flujo con fixtures reales contra `demo-v3` desplegada (Textract
  real) después del merge — autorizado por Andres.
- El MRZ del dorso no le ganó al OCR malo del frente en la prueba real:
  pendiente post-presentación.
- El fix del 500 del demo-panel (serialización binaria de `next dev`) sigue
  en la sesión worktree paralela; los e2e v2 de firma (01/07) esperan eso.

---

## 2026-08-31 (c) · Lote F5c: la UX de identidad con cédulas reales

**Rama:** `feat/f5c-ux-identidad` · **Feedback directo de Andres con documentos reales**

### El caso

Andres probó la demo con la cédula real de Rodrigo (fixture D-21). El OCR
leyó mal («BLI», «FECHA DE VENCIMIENTO») y la pantalla no ofrecía salida: el
candado-botón de CHG-15 existía pero era indescubrible (se ve igual que el
ícono decorativo). Pidió: campos editables, ingreso por rangos como el
Design, entender qué falta, y el botón de datos ficticios del canvas.

### Qué cambió (VerificacionIdentidad, vale para v2 y v3)

- **Nombres, apellidos y nacionalidad: editables directos**, rotulados
  «· editable» con candado abierto; cédula y fecha siguen «· no editable»
  (regla #8/#11). El cotejo del servidor (CHG-15) no cambia: lo editado viaja
  en `correcciones` como siempre.
- **Ingreso mensual por rangos** (los cinco del canvas); viaja el
  representante numérico del rango en el mismo campo de siempre — dominio y
  FIPF intactos.
- **Faltantes del canvas**: el CTA es siempre clickeable; sin requisitos
  muestra «Te falta: …» (rojo) y se desplaza al primer campo, más el enlace
  «Mostrame qué me falta». Reemplaza al párrafo que enumeraba condiciones en
  abstracto.
- **«Completar el resto con datos de ejemplo (demo)»** (solo DEMO_MODE):
  llena lo vacío con opciones válidas de los catálogos.
- Helper e2e actualizado (`p5-ingreso` → selectOption).

### Verificaciones

- typecheck + lint (0 errores) + 1222 tests; **batería v3 10/10** (2.3 m).
- Captura de la sección nueva enviada a Andres.
- **Smoke v2 `01-camino-feliz`: FALLA en la firma, y es el bug preexistente**
  del 500 del panel de demo (next dev serializa mal binarios grandes en RSC —
  causa raíz ya identificada por la sesión del worktree; su PR lo arregla).
  El tramo donde falla no lo toca este lote.

### Queda abierto

- Mergear el PR de la sesión del worktree (arregla el 500 del panel y con él
  el smoke v2 de firma).
- El MRZ del dorso real no ganó al OCR aproximado (leyó «BLI» pese a un MRZ
  legible) — retomar el pendiente conocido del MRZ tras la presentación.

---

## 2026-08-31 (b) · Lote F5b: la piel del canvas — el diseño que faltaba

**Rama:** `feat/f5b-diseno-canvas` · **Corrección de alcance, urgente**

### El caso

Andres probó la demo desde el celular: «todo mal — NO se ha aplicado el
diseño, solo el modelo funcional». Tenía razón: F1–F5 importaron del canvas
la estructura y los textos, pero las pantallas se maquetaron con los tokens
y componentes v2. El sistema visual del canvas —fotos, Archivo 800, acento
rojo #ec3013, esquinas rectas, fondo #f3f2f2— nunca se aplicó.

### Qué cambió

- **La piel por tokens**: bloque `[data-flujo="v3"]` en globals.css que
  redefine las variables que Tailwind v4 consume — fuente (`--font-sans` →
  Archivo, + regla directa porque el preflight no pasa por ahí), la rampa
  completa del acento (los MISMOS tokens naranja-* pasan a la rampa roja del
  canvas: cada `bg-naranja-600` del árbol se re-viste sin editar
  componentes), radios a 0, superficie clara del canvas, títulos 800. El
  layout marca el atributo cuando `flujoV3Activo()` y carga Archivo por
  next/font. Con el flag apagado el bloque no matchea nada: v2 intacto.
- **Las 8 fotos y 2 logos del canvas** extraídos del bundle del Artifact a
  `public/v3/`: hero con crossfade de los 4 pasos en el inicio (CSS puro,
  16s), y la foto «familia» arriba de cada paso y de la confirmación (esta
  última condicional al flag: la página es compartida).
- Verificación visual por Playwright a 375px (el panel de preview no
  compone): capturas enviadas a Andres.

### Verificaciones

- typecheck + lint (0 errores; 7 warnings de `<img>` aceptados para la demo)
  + 1222 tests + build.
- **Batería v3: 10/10** con la piel puesta — el camino feliz no se inmutó.
- Runtime verificado por consola del navegador: `data-flujo=v3`, acento
  `#dd2b0f`, fondo `#f3f2f2`, radius 0, Archivo aplicada, 4 heros cargados.

### Queda abierto

- Refinar contra el canvas: la vpos modal, iconografía fina, el modo noche
  propio del canvas (hoy el oscuro conserva superficies del sistema con el
  acento nuevo), y reemplazar `<img>` por `next/image`.
- GUIA_DE_ESTILOS.md queda como fuente del v2; el canvas manda en v3 — a
  reconciliar en F6.

---

## 2026-08-31 · Lote F5 (esencial): el inicio real y los cierres v3

**Rama:** `feat/f5-inicio-y-cierres` · **Implementación (apurada por la presentación a Alianza del 2-sep)**

### El caso

Con F4 mergeado y el camino feliz v3 probado, Andres pidió el branch deploy
de demo Y el F5. El F5 se recortó a lo que la presentación necesita: el
aterrizaje del canvas en la raíz (en v3, `/` terminaba en 404 vía la cadena
de redirects) y los títulos v3 de confirmación y revisión manual.

### Qué cambió

- **La raíz `/` en v3 ES el inicio del canvas** (H1 «Protege a tu familia…»,
  los 3 pasos explicados, ANTES DE EMPEZAR, casilla de T&C → crea el
  expediente → /inscripcion; con trámite empezado, CTA de reencaminado). En
  v2 sigue redirigiendo a /plan.
- **El bootstrap de T&C se mudó** de /inscripcion al inicio (como F2 dejó
  anotado): /inscripcion sin trámite ahora manda a `/`.
- Títulos v3 por flag: `TITULO_P9` («¡Listo! Tu familia ya está protegida»)
  y `TITULO_PANTALLA_A`/`BAJADA` («Tu solicitud queda en buenas manos», «no
  es un rechazo», «Nada se movió de tu bolsillo…»).
- Specs v3 01 y 04 actualizados al arranque por `/`.
- **Branch `demo-v3` creado y pusheado** para el deploy de demo de Amplify
  con FLUJO_V3=true — la conexión al app espera el `aws login` de Andres.

### Verificaciones

- typecheck + lint + 1222 tests; build en verde.
- **Batería v3: 10/10** (3.1 m), camino feliz completo incluido, arrancando
  desde la raíz.

### Queda abierto

- Conectar `demo-v3` a Amplify (branch + FLUJO_V3=true + job) — bloqueado por
  `aws login` de Andres. **OJO: demo-v3 debe re-crearse desde main tras
  mergear este PR** para incluir el inicio.
- Resto de F5 (personalización con nombre en confirmación, hitos/documentos
  finos del canvas) y F6 — post-presentación.
- El 500 de /demo-panel (preexistente) corre en su propia sesión.

---

## 2026-08-30 (d) · Lote F4b: la página /pago-y-firma con la firma interna

**Rama:** `feat/f4b-pago-y-firma` (encadenada sobre F4a) · **Implementación**

### El caso

Segunda mitad de F4: cablear la firma interna del cliente (mergeada en F4a)
a la pantalla del paso 3. Arquitectura verificada antes de codear:
`confirmarFirmaP8` con `FIRMADO_CLIENTE` aplica las institucionales SIN
requerir acto de Code100 — el sondeo de siempre completa el tramo cualificado
sobre una firma interna sin tocar `firma-p8.ts`.

### Qué cambió

- `textos-pago-firma.ts`: aceptación agrupada 3 (DI-8, 3 ítems,
  `PAGO-FIRMA-ACEPTACION-v1`) — **es además el texto que el acto interno
  registra como firmado** —, el «¿Qué es el FIPF?» con el formulario real
  (DI-1) y los encabezados del paso.
- Endpoints `POST /api/p8/firma-interna/{enviar,verificar}`: guarda
  `flujoV3Activo()` en la puerta HTTP (el dominio del acto no distingue
  versiones a propósito — es el mismo acto legal), aceptación agrupada
  requerida antes de emitir el código, texto/versión del servidor, deps de P1
  reutilizadas (`DependenciasFirmaCliente` ≡ `DependenciasP1`). Registrados
  en el inventario de rutas con sus dos CASOS (rechazan a un derivado sin
  tocarlo: sin paquete cerrado no hay nada que firmar).
- `FirmaInternaV3.tsx`: resumen del paquete (reutiliza `GET /api/p8/resumen`,
  que además lo genera, y `ModalVisorPdf`), casilla agrupada + expandible,
  botones de canal WhatsApp/correo enmascarados (DI-5), `CamposOtp`, y el
  sondeo institucional con `GET /api/p8/estado` → `onCompletado`.
- `PagoYFirma.tsx` + `page.tsx`: dos secciones gateadas (firma hasta FIRMADO,
  pago desde FIRMADO — regla 6-bis en el gating), `FIRMADO` como estado
  propio (mismo criterio que `tambienPropios` de la página v2 de pago),
  `FormularioPagoP7` montado sin cambios, barra de plan con `cambiar plan` →
  /seguro, puerta a /inscripcion sin trámite. `DETALLE_PAGO_Y_FIRMA` neutral.
- `e2e/v3/03-pago-y-firma.spec.ts` (molde de 01/02).

### Verificaciones

- typecheck + lint + **1222 tests en verde**; build con y sin flag en verde
  (la ruta `/pago-y-firma` aparece en el build).
- **La batería E2E sigue bloqueada por el cupo de inotify** (65536; el sysctl
  de F4a sigue pendiente). Verificación equivalente hecha contra un build de
  producción con el flag (`next start`, sin watchers): redirects 308 de
  /firma y /pago → /pago-y-firma, puerta sin trámite, «Paso 3 de 3», y las
  guardas de los endpoints nuevos (ACEPTACION_REQUERIDA / SESION_INVALIDA /
  CANAL_INVALIDO) por curl.
- El circuito completo firma-interna → institucionales → pago por navegador
  queda pendiente junto con las corridas formales de Playwright: ambos
  destrabados por el mismo `sysctl`.

### Adenda (31-ago, tras el sysctl de Andres)

- inotify subido a 524288: **E2E v3 10/10 en verde**, incluido el nuevo
  `04-camino-feliz.spec.ts` — **el recorrido completo T&C → identidad → OTP →
  aceptaciones → plan → 5 preguntas → firma interna con su código →
  institucionales del mock → pago QR → confirmación pasa de punta a punta**
  (1.7–3.3 m). Es la prueba de demo-readiness para la presentación a Alianza
  del miércoles. Ajustes que salieron de iterarlo: `tipearOtp` y
  `tomarCapturaP5` exportados del helper v2, espera del acuse de envío antes
  de leer el panel, y el idPrefijo de `CamposOtp` en la firma
  (`firma-v3-otp`).
- El smoke v2 `07-firma-atomica` (escenario 2) **falla igual en main limpio**
  (verificado con worktree en ffa1900): GET /demo-panel devuelve 500 con
  errores de streaming del dev server ("ArrayBuffer is not detachable").
  **Preexistente, no regresión de F4** — queda como tarea aparte (chip
  lanzado); el escenario 1 del mismo spec pasa.

### Queda abierto

- El 500 de /demo-panel bajo `next dev` (preexistente, chip lanzado) — no
  bloquea la demo (el panel funciona en el recorrido normal; falla bajo la
  secuencia del escenario 2 del spec 07).
- `sudo sysctl fs.inotify.max_user_watches=524288` (hecho el 31-ago) → correr
  `test:e2e:v3` (3 specs), el smoke v2 `07-firma-atomica` de F4a, y el
  recorrido completo por navegador ANTES de mergear F4b.
- F5: inicio + confirmación + revisión manual. F6: encendido y limpieza.
- El PR de F4b tiene base en la rama de F4a: se re-apunta a main al mergear
  #67.

---

## 2026-08-30 (c) · Lote F4a: la firma interna del cliente entra a main

**Rama:** `feat/f4a-firma-interna-dominio` · **Merge de la rama en espera**

### El caso

Decisión de Andres (30-ago, al abrir F4): **la firma del cliente la ejecuta
nuestra solución interna no cualificada; el mock de Code100 queda solo para
las cualificadas de Interseguros y Alianza.** Eso es exactamente lo que la
rama `claude/code100-api-integration-1f2547` (8 commits, en espera desde el
27-ago) construyó a nivel dominio, así que F4 se partió en dos PRs: F4a
mergea la rama; F4b cablea pantalla y endpoints.

### Qué cambió

- Merge de la rama: `src/domain/firma-cliente.ts` (el acto de firma interno,
  Res. 210/2025 art. 4, con sus 23 tests), propósito OTP `FIRMA` con
  `canalCoherenteConProposito` (ambos canales), renombre
  `Firma.idCode100 → referenciaActo` + campo `origen: PROVEEDOR|INTERNA`
  (`ActoDeFirmaEnCurso.idCode100` se conserva: es el acto del proveedor),
  y los docs `MATRIZ_LEGAL_V4.md`, `normativa/CATALOGO.md` y
  `VALIDACION_LEGAL_FIRMA_INTERNA.md`.
- Conflicto único en `CLAUDE.md` (las dos citas de la 215): ganó la doctrina
  de main (#57 — la vigente es la **215/2025**), y la viñeta nueva de la rama
  que afirmaba «la correcta es la 215/2017» se corrigió a esa doctrina, con
  la regla de que ante discrepancia entre `CATALOGO.md` (de la rama) e
  `INDICE.md` manda el índice.
- `CLAUDE.md` §SignatureProvider actualizado con la decisión ratificada: la
  firma del cliente es interna (v3); el flujo simulado de Code100 sigue en v2
  hasta su retiro.

### Qué hizo Andres

- Ratificó el modelo de firma (30-ago): interna para el cliente, Code100
  (mock) solo institucionales — respuesta directa, no una de las opciones
  ofrecidas.

### Verificaciones

- typecheck + lint + **1218 tests en verde** (los 23 de firma-cliente
  absorbidos sin tocar ninguno de main).
- `npm run build` en verde (flag apagado y con entorno demo).
- **Smoke e2e `07-firma-atomica`: BLOQUEADO por la máquina, no por el
  código** — el guardián `preflight-inotify` aborta la corrida porque el cupo
  de watchers (65536) está agotado por los IDEs abiertos. Pendiente de que
  Andres corra `sudo sysctl fs.inotify.max_user_watches=524288` (+persistir
  en /etc/sysctl.d); después, correr `npx playwright test
  e2e/07-firma-atomica.spec.ts` antes del merge de F4b.

### Queda abierto

- El smoke v2 de firma (bloqueo de inotify, arriba).
- F4b: textos de la aceptación agrupada 3, endpoints
  `/api/p8/firma-interna/{enviar,verificar}`, componente `FirmaInternaV3`,
  página `/pago-y-firma` y `e2e/v3/03`.
- La memoria de la rama en espera queda obsoleta al mergear este PR.

---

## 2026-08-30 (b) · Lote F3: la página /seguro — el paso 2 y el mapa 5→8

**Rama:** `feat/f3-seguro` · **Implementación**

### El caso

Con F2 mergeado, Andres pidió F3. Corrección importante surgida en la
exploración: **los premios ya eran los aprobados** (319.000/522.500/726.000,
OFERTA-CONFIO-v2 del 20-ago) — la pregunta sobre premios partió de un dato
viejo mío y la decisión «global ahora» ya estaba cumplida; este lote no tocó
el catálogo.

### Qué cambió

- **El mapa 5→8 (DI-3)**: `src/domain/declaraciones-v3.ts` — la pantalla
  pregunta 5, el PDF sigue imprimiendo 8. Claves 1/2/3/4/8 desde las
  preguntas; 5/6/7 desde la casilla agrupada 2. Con test propio, como exigía
  la decisión.
- `declaraciones-p6.ts` con camino v3: exige la aceptación agrupada
  (`ACEPTACION_REQUERIDA`), corta carencias en No **sin derivar**
  (`CARENCIAS_NO_ACEPTADAS` — la clave 4 no bloquea en el motor y dejarla
  pasar convertiría un alto de UI en un derivado), expande y sigue el
  pipeline intacto. Evidencia por flag: en v3 asienta el literal y la versión
  de la aceptación agrupada 2 (`SEGURO-ACEPTACION-v1`).
- `textos-seguro.ts`: las 5 preguntas del canvas con sus notas (PEP,
  carencias), la aceptación agrupada 2 (5 ítems) y `coberturasEnClaro()`
  derivada del catálogo + las carencias del certificado (ahora exportadas).
- `/seguro`: page (patrón F2; sin trámite → puerta a `/inscripcion`),
  orquestador `Seguro.tsx` (plan activo/colapsado con `cambiar plan` vía el
  autobucle, coberturas en claro, formulario gated) y `FormularioSeguroP2`
  (beneficiario con los campos de la Solicitud, 5 preguntas con avisos, CTA
  dual continuar/asesor — mismo POST, el motor decide).
- `SelectorDePlanes` ganó `onCompletado` (v2 intacto);
  `PestanasDeProducto` extraída a shared con etiqueta parametrizada
  («PRÓXIMAMENTE» v2 / «PRONTO» v3).
- `DETALLE_SEGURO_COMPLETO` neutral: a esta página se llega desde trámites
  anteriores Y posteriores al paso; afirmar «tu plan ya está elegido»
  mentiría en el primer caso (visto en el recorrido por navegador).
- E2E v3: `02-seguro.spec.ts` (redirect de /declaraciones, puerta sin
  trámite, etiqueta PRONTO, stepper «Paso 2 de 3»).

### Qué hizo Andres

- Eligió «global ahora» para los premios (resultó ya cumplida) y aprobó el
  plan del lote.

### Verificaciones

- typecheck + lint + **1195 tests** (12 nuevos del mapa y el caso de uso v3,
  con imports dinámicos post-stubEnv — las constantes por flag son de
  import-time).
- Build sin flag en verde. **E2E v3: 6/6** (52 s). Smoke v2:
  `03-salud-incompatible` en verde (1.7 m) — P6 v2 intacto.
- Navegador con flag: /seguro dibuja tabs PRONTO, marcadores CDXXXXX y
  reencamina un trámite en inscripción.

### Queda abierto

- F4: página `/pago-y-firma` (paso 3) + decisión de integración de la rama
  de firma interna. El destino tras las declaraciones ya apunta ahí.
- El E2E v3 de recorrido completo sigue esperando a que el flujo cierre
  (F4–F6).
- La sección del plan dentro de /seguro reusa el pie del selector v2 (nota
  legal + botón) tal cual; los literales finos del canvas para esa sección
  entran al refinar, si hace falta.

---

## 2026-08-30 · Lote F2: la página /inscripcion — el paso 1 del flujo v3

**Rama:** `feat/f2-inscripcion` · **Implementación (primera página v3)**

### El caso

Con F1 desplegado, Andres pidió abrir F2. Dos decisiones suyas dieron el
recorte: **entrada por caso de uso + bootstrap** (los T&C que crean el
expediente se implementan de verdad, DI-10, y la casilla vive provisoriamente
arriba de /inscripcion hasta que exista /inicio en F5) y **secciones en
agrupado pragmático** (correo y complementarios quedan dentro de la sección
de identidad — el envío único que el dominio ya valida — en vez de partir el
caso de uso).

### Qué cambió

- Dominio: `inicio-terminos.ts` (`aceptarTerminosIniciales`: crea el
  expediente en INICIADO con evidencia INICIO_TERMINOS_ACEPTADOS; rechaza en
  v2 con FLUJO_NO_DISPONIBLE y no duplica con EXPEDIENTE_YA_EXISTE),
  `textos-inicio.ts`, `textos-inscripcion.ts` (los 7 ítems de DI-8 con
  versión INSCRIPCION-ACEPTACION-v1), campo `Expediente.terminosIniciales`, y
  `autorizacion-inicial.ts` asienta texto/versión por flag (v3 firma la
  aceptación agrupada; v2 sigue con P3).
- Endpoint `POST /api/inicio/terminos` (siembra la cookie como p2/plan).
- `VerificacionIdentidad` y `FormularioVerificacionWhatsapp` ganaron
  `onCompletado` (y `onAsistencia`) opcionales: con la prop avanzan el gating
  con `router.refresh()`; sin ella navegan como siempre — las páginas v2 no
  cambian.
- `/inscripcion`: page server con `notFound()` sin flag, sin barra de plan, y
  orquestador client con las tres secciones en cascada (bloqueada / activa /
  completa) con los rótulos de la spec.
- E2E: `playwright.v3.config.ts` (puerto 3101, FLUJO_V3=true, readiness
  contra /inscripcion porque la raíz redirige a /seguro que es 404 hasta F3),
  `testIgnore: **/v3/**` en la config base, `E2E_BASE_URL` en global-setup,
  spec `e2e/v3/01-inscripcion` (redirects 308, puerta de T&C → gating,
  persistencia por cookie, stepper «Paso 1 de 3») y script `test:e2e:v3`.
- Spec: nota de implementación en el Paso 1 con las dos divergencias (agrupado
  pragmático; checkbox biométrico inline ANTES de capturar, el ítem 3 del
  expandible queda como ratificación) y el bootstrap provisional de T&C.
- `.claude/launch.json`: configuración `segurolotengo-dev-flujo-v3`.

### Qué hizo Andres

- Eligió «caso de uso + bootstrap» para la entrada y «agrupado pragmático»
  para las secciones; aprobó el plan del lote en plan mode.

### Verificaciones

- typecheck + lint + **1183 tests** en verde (12 nuevos de dominio/textos).
- `npm run build` con el flag apagado en verde.
- **E2E v3: 3/3** (`npm run test:e2e:v3`, 37 s) — redirects, puerta de T&C
  con expediente real en Dynamo, gating y stepper.
- Smoke v2: `05-otp-agotado` en verde (2.1 m) — el formulario de WhatsApp
  modificado sigue intacto en su página.
- Recorrido por navegador con el flag encendido: T&C → sección 1 activa con
  capturas y rótulos de bloqueo; el `router.refresh()` transiciona en vivo
  (la primera impresión tarda lo que tarda el dev server en compilar).
- Dos servidores `next dev` simultáneos comparten `.next` y el segundo no
  arranca — por eso la corrida v3 exige el puerto libre y
  `reuseExistingServer: false`.

### Queda abierto

- El recorrido E2E completo del paso 1 (capturas + OTP + aceptación) entra
  cuando el flujo v3 sea recorrible de punta a punta (F3–F6): los helpers
  v2 están acoplados a URLs por página y no vale la pena bifurcarlos ahora.
- F3: página `/seguro` (paso 2 — plan + beneficiario + 5 declaraciones con
  mapa 5→8). El destino tras la aceptación de F2 ya apunta ahí.
- Los títulos internos de la sección de identidad conservan los literales v2
  (los del canvas entran al refinar la sección en un lote posterior).

---

## 2026-08-29 (e) · Lote F1: el flujo v3 entra al dominio detrás del flag FLUJO_V3

**Rama:** `feat/f1-flujo-v3-dominio` · **Implementación (primer lote de código)**

### El caso

Con la Fase 1 documental cerrada, Andres pidió abrir la sesión de
`PASOS_FLUJO`. La restricción que dio forma al plan: el merge a main ES el
deploy, así que cambiar la lista a 3 rutas sin páginas rompería producción.
Andres eligió la estrategia de **flag de entorno `FLUJO_V3`** (mismo patrón
que DEMO_MODE y los INTEGRATION_*): lotes chicos con el flag apagado, un PR
final lo enciende.

### Qué cambió

- `src/domain/flujo-vigente.ts` (nuevo): `flujoV3Activo()`, único lector del
  flag. La versión del flujo es propiedad del despliegue, así que se resuelve
  a import-time y ningún consumidor cambia de firma.
- `rutas-flujo.ts`: `PASOS_FLUJO_V2/V3` (3 pasos: /inscripcion, /seguro,
  /pago-y-firma), `PANTALLA_POR_ESTADO_V2/V3` (la v3 mapea estados
  intermedios a su página larga — el corazón del gating en cascada) y
  `REDIRECCIONES_RUTAS_VIEJAS_V2/V3` (la v3 redirige también los slugs
  semánticos v2).
- `expediente.ts`: `TRANSICIONES_V2/V3`. El orden nuevo (identidad primero,
  DI-2) recablea aristas entre los estados existentes — cero estados nuevos;
  el tramo desde DECLARACIONES_OK es idéntico al v2 (verificado por test).
  ASISTENCIA_IDENTIDAD sale de INICIADO; DERIVADO_MANUAL de PLAN_SELECCIONADO.
- Constantes por versión: `CANAL_WHATSAPP_P1.estadoRequerido`
  (IDENTIDAD_VERIFICADA en v3), `ESTADO_REQUERIDO_P5` (INICIADO),
  `ESTADO_REQUERIDO_P6` (PLAN_SELECCIONADO), `RUTA_TRAS_DECLARACIONES` y
  `RUTA_PAGO` derivadas de PANTALLA_POR_ESTADO, y `seleccionarPlan` en v3 ya
  no crea el expediente (nacerá con los T&C del inicio, DI-10/F5).
- Tests: los contratos v2 quedaron fijados por nombre (_V2), bloque nuevo de
  PANTALLA_POR_ESTADO_V3, y `flujo-v3.test.ts` con los invariantes del grafo
  (regla 6-bis, tramo D-08 idéntico, terminales intactos) y la selección por
  flag vía vi.stubEnv + import dinámico.

### Qué hizo Andres

- Eligió la estrategia del flag (contra rama larga y contra mega-PR).
- Aprobó el plan del lote F1 en plan mode.

### Verificaciones

- `npm run typecheck && npm run lint && npm test`: **86 archivos, 1171 tests
  en verde** (17 nuevos), con el flag apagado — cero cambio de comportamiento.
- `npm run build` en verde con el flag apagado.
- `grep FLUJO_V3` confinado a src/domain y tests: ningún componente de UI lo
  lee todavía.
- Desvío declarado respecto del plan: la corrida de la suite completa con
  `FLUJO_V3=true` se difirió a F6 — los tests históricos fijan comportamiento
  v2 y migrarlos ahora sería trabajo tirado; los contratos v3 quedan cubiertos
  por los tests por nombre (_V3), que no dependen del entorno.

### Queda abierto

- F2: página `/inscripcion` (paso 1) — convertir los `window.location.assign`
  de los componentes en callbacks `onCompletado` y montarlos como secciones.
- F3: `/seguro` · F4: `/pago-y-firma` (+ decisión de la rama de firma
  interna) · F5: inicio (T&C crea expediente, DI-10) + confirmación +
  revisión manual · F6: encendido del flag, migración de la suite y los E2E,
  barrido de expedientes v2 en curso del demo, retiro del v2.
- El spec `08-plan-tramite-en-curso` habrá que rediseñarlo en F3/F6: su
  escenario entero asume una pantalla por paso.

---

## 2026-08-29 (d) · Fase 1: ESPECIFICACION_PANTALLAS.md reescrita al flujo de 3 pasos

**Rama:** `docs/especificacion-pantallas-3-pasos` · **Especificación**

### El caso

Con las 11 DI decididas (PR #62 mergeado), Andres pidió arrancar la
reescritura de la especificación de pantallas contra el canvas importado y el
Bloque E.

### Qué cambió

- `docs/ESPECIFICACION_PANTALLAS.md` reescrita completa: 3 pasos visibles con
  gating en cascada (+ inicio, confirmación y revisión manual fuera del
  contador), textos literales del canvas, premios aprobados
  (319.000/522.500/726.000), aceptaciones agrupadas, mapa 5→8 de
  declaraciones con tabla explícita, y banner de transición: describe la
  configuración OBJETIVO; el código en main sigue en 8 pasos hasta que los
  lotes cierren, y el orden vigente sigue viviendo en PASOS_FLUJO.
- Verificaciones DI-3 y DI-7 hechas contra `Solicitud.pdf` (pdftotext): la
  declaración médica son 3 preguntas + 4 finales + PEP en FIPF — el mapa 5→8
  cierra sin huecos; el beneficiario del formulario lleva nombre, parentesco
  y domicilio — los 3 campos extra del canvas (cédula, f. nac., celular del
  beneficiario) NO se piden, por DI-7 mandan los campos de la Solicitud.
- El expandible «¿Qué es el FIPF?» quedó redactado sobre el formulario real
  (DI-1); las referencias regulatorias del canvas quedaron rotuladas como
  marcadores provisionales (DI-4).

### Qué hizo Andres

- Mergeó el #62 y pidió arrancar la reescritura («arranquemos»).

### Verificaciones

- `npm run typecheck && npm run lint && npm test` sobre la rama (el test de
  higiene de citas también vigila docs/).

### Queda abierto

- Primer PR de implementación: `PASOS_FLUJO` con pasos visibles (3) y las
  rutas nuevas (`/inscripcion`, `/seguro`, `/pago-y-firma`, provisionales
  hasta ese PR), sin aplanar la máquina de estados (DI-2).
- Después, un paso por sesión (cada paso nuevo es una página larga: paso 1,
  paso 2, paso 3, inicio+confirmación+revisión).
- La rama de firma interna (`claude/code100-api-integration-1f2547`) se
  integra al implementar el paso 3.
- Los marcadores provisionales (DI-4) esperan el dato oficial de Alianza.

---

## 2026-08-29 (c) · Fase 1: las 11 DI resueltas en DECISIONES.md

**Rama:** `docs/decisiones-di-diseno-3-pasos` · **Ronda de decisiones**

### El caso

Con el PR #61 mergeado, Andres resolvió la ronda completa de divergencias de
la importación del diseño (DI-1…DI-11), dos por mensaje directo y cuatro por
preguntas estructuradas; las cinco restantes se derivaron de reglas ya
existentes.

### Qué cambió

- `docs/plan/DECISIONES.md`: **Bloque E** nuevo con las once DI decididas.
- `docs/plan/IMPORTACION_DISENO_3_PASOS.md` §6: marcado como ronda resuelta,
  apuntando al Bloque E como fuente de verdad.

### Qué hizo Andres

- Mergeó el #61 (pidió el merge explícitamente).
- **DI-1:** confirmó que FIPF es el Formulario de Identificación de Persona
  Física (Res. SEPRELAD 71/19); el texto del canvas es error de maqueta.
- **DI-4:** confirmó que carencias, resolución y código de producto del
  canvas son marcadores de la maqueta (parámetros provisionales, criterio D-04).
- **DI-3, DI-5, DI-8, DI-10:** eligió la opción recomendada en las cuatro
  (PDF conserva las 8 declaraciones con mapa 5→8; enlace de firma por ambos
  canales; casillas agrupadas como el canvas; T&C del inicio con evidencia).

### Verificaciones

- `npm run typecheck && npm run lint && npm test` (solo docs, igual corre la
  cadena por política).

### Queda abierto

- Reescribir `ESPECIFICACION_PANTALLAS.md` contra el documento de importación
  y el Bloque E — incluye documentar el mapa 5→8 y cotejar el beneficiario
  contra `Solicitud.pdf` (DI-7).
- Primer PR de implementación: `PASOS_FLUJO` con pasos visibles (3) sin
  aplanar la máquina de estados (DI-2).
- La rama de firma interna se integra al implementar el paso 3 (DI-5 ya la
  respalda).

---

## 2026-08-29 (b) · Fase 1: importación del diseño de 3 pasos desde Claude Design

**Rama:** `docs/importacion-diseno-3-pasos` · **Importación de diseño**

### El caso

Con la Fase 0 cerrada (PR #60 mergeado, ramas y worktrees consolidados),
Andres pidió arrancar la Fase 1 del cambio de configuración de pantallas. El
diseño ya estaba aprobado en Claude Design, así que no se re-maqueta: se
importa.

### Qué cambió

- `docs/plan/IMPORTACION_DISENO_3_PASOS.md`: transcripción fiel del canvas
  «Seguro lo tengo: Flujo de 3 pasos» (artifact ce0c8332, 27-ago) —
  estructura de 3 pasos + inicio/confirmación/revisión, textos por pantalla,
  planes y carencias, las 5 declaraciones nuevas, trazabilidad contra los 8
  pasos vigentes y **11 divergencias (DI-1…DI-11)** que necesitan decisión
  antes de reescribir `ESPECIFICACION_PANTALLAS.md`.

### Qué hizo Andres

- Mergeó #57, #55, #56, #59 y #60 (resuelto el conflicto de
  `textos-aclaraciones.ts` integrando el derecho de retracto al catálogo-función).
- Borró las ramas que exigían `-D`.
- Confirmó que el diseño aprobado es el canvas de Claude Design y que la
  Fase 1 lo importa en lugar de re-maquetar.

### Verificaciones

- La extracción del canvas se hizo del bundle publicado (template JSON de
  163 KB + datos del prototipo de 53 KB); los premios extraídos (319.000 /
  522.500 / 726.000) coinciden con la decisión aprobada del 20-ago.

### Queda abierto

- **Las 11 decisiones DI-1…DI-11** del documento — Andres. Las tres urgentes:
  DI-1 (qué significa FIPF: el canvas lo redefine como «Información Previa a
  la Firma» y contradice a la Res. SEPRELAD 71/19), DI-3 (mapa de 8→5
  declaraciones contra `Solicitud.pdf`) y DI-4 (carencias 180/30/1 y
  Res. 250/2026: ¿datos reales de Alianza o marcadores de la maqueta?).
- Reescritura de `ESPECIFICACION_PANTALLAS.md` contra el documento importado.
- Primer PR de implementación: `PASOS_FLUJO` con la noción de paso visible
  (3) sin aplanar la máquina de estados.
- La rama de firma interna se integra al implementar el paso 3.

---

## 2026-08-29 · Fase 0: consolidación del repo antes del cambio de configuración de pantallas

**Rama:** `claude/review-pending-prs-e227dd` · **Consolidación**

### El caso

Andres pidió un análisis completo del repo (ramas, worktrees, PRs, dependencias)
como antesala de un **cambio mayor: nueva configuración de pantallas**, cuyo
diseño ya está aprobado en Claude Design. El análisis encontró trabajo valioso
sin asegurar: esta rama con ~1.300 líneas sin commitear (incluida esta bitácora),
la rama de firma interna con 8 commits sin pushear, y el `main` local 10 commits
detrás de `origin/main`.

### Qué cambió

- Este commit asegura el trabajo de la sesión del 21-ago que había quedado
  suelto en el worktree: reencaminado del flujo, mock de Bancard fiel a los
  documentos del proveedor (EMVCo, `response_code` reales), OTP de firma en
  bloque propio, E2E `09-firma-reintento-codigo`, la bitácora y el `CLAUDE.md`
  actualizado con las decisiones del 20/21-ago.
- Se pusheó `claude/code100-api-integration-1f2547` (firma interna, 8 commits
  que estaban solo en local, a la espera del rediseño de pantallas).
- Se abrió PR #59 con `docs/DECISION_MIGRACION_GITHUB_APP.md`, que vivía sin
  trackear desde el 10-ago.
- Tags de archivo `archive/hardening-seguridad` y `archive/wip-l4-inversion-firma-pago`
  antes de proponer el borrado de esas ramas.

### Qué hizo Andres

- Aprobó ejecutar la Fase 0 completa (2026-08-29).
- Decidió que el diseño de la nueva configuración de pantallas ya está aprobado
  en Claude Design: la Fase 1 lo importa desde su Artifact, no re-maqueta.
- Quedan a su cargo (bloqueados para el agente por política): mergear #57, #55,
  #56 y #59, y borrar las ramas locales ya mergeadas.

### Verificaciones

- `npm run typecheck && npm run lint && npm test` sobre este árbol: **83 archivos,
  1131 tests, todos en verde** (4.9 s).
- CI de #57, #55 y #56: los 4 jobs en verde en los tres.
- `npm audit --omit=dev`: 0 vulnerabilidades.

### Queda abierto

- Mergear los PRs (#57, #59 y los dos de dependabot) — Andres.
- Esta rama necesita traerse `origin/main` (está 10 atrás) antes de su PR.
- El diff suelto de `ESPECIFICACION_PANTALLAS.md` en el worktree
  `elegant-murdock` describe el orden pago→firma anterior al Plan v2: decidir
  si se descarta — Andres.
- Ramas remotas sin PR: `claude/bancred-integration-docs-t1inpp` (4 commits,
  Pantalla B con respuestas de Bancard) y `claude/qr-interno-documentos-bf2u30`
  (token no adivinable en el QR) — rescatar o archivar.
- `chore/hardening-fase-2` tiene CodeQL sin mergear: abrirle PR o descartarlo.
- Fase 1 del cambio de pantallas: importar el diseño aprobado desde Claude
  Design y actualizar `REFORMULACION_PANTALLAS_MAQUETA.md` y
  `ESPECIFICACION_PANTALLAS.md`; el primer PR de implementación es el de
  `PASOS_FLUJO` en `src/domain/rutas-flujo.ts`.

---

## 2026-08-21 (f) · La batería se degrada corrida a corrida — medido, no diagnosticado

**Rama:** `claude/review-pending-prs-e227dd` · **Problema abierto**

### El hecho

La batería E2E completa fue empeorando de forma monótona a lo largo de la
sesión, con el mismo hardware y sin cambios en los escenarios que fallan:

| Corrida | Tiempo | Fallos |
| :---- | :---- | :---- |
| 1ª | 12 min | 1 |
| 2ª | 17 min | 4 |
| 3ª | 23 min | 3 |
| 4ª | **37 min** | **7** |

**Todos los fallos son timeouts limpios**, no errores de lógica: escenarios que
no tocan nada de lo que se cambió (salud incompatible, biometría rechazada, OTP
agotado) mueren por reloj igual que los demás.

### Lo que la medición descarta

- **No es el código de los escenarios.** Corridos **solos**, pasan y en su
  tiempo de siempre: el camino feliz tarda 2,3 min aislado, igual que antes de
  toda esta tanda.
- **No son procesos huérfanos ni presión de recursos.** Con la batería
  terminada: cero procesos node vivos, carga 0,6, 20 GB de memoria libre.
- **No es un bucle de reintentos del paso 6.** Existía —el efecto que abre el
  acto se volvía a disparar solo si la apertura fallaba, un POST por vuelta— y
  se corrigió con un `ref`. Es un defecto real y valía arreglarlo, pero **la
  corrida siguiente fue la peor de todas**, así que no era la causa.
- **No es la latencia a AWS en reposo.** `describe-table` responde en ~1 s
  incluyendo el arranque del CLI.
- **No es que el repositorio se reconstruya caro.** `crearExpedienteRepository()`
  usa el cliente singleton de DynamoDB; no resuelve credenciales ni secretos por
  llamada.

### Lo que queda como hipótesis, sin probar

El servidor se degrada **a medida que la corrida avanza**, no entre corridas. El
cambio más sistémico de esta tanda es el chequeo previo `expedienteEnOtroPaso`,
que agregó **una lectura de DynamoDB en cada render de siete pantallas** y las
volvió dinámicas (leen cookies). Cientos de renders por batería.

**El experimento que lo decide** es barato de describir y caro de correr:
desactivar temporalmente esos chequeos y correr la batería completa. Si el
tiempo vuelve a la franja de los 12 minutos, es eso; si no, hay que seguir
buscando. No se corrió: son 20+ minutos y la decisión de gastarlos es de Andres.

### Por qué esto no invalida la tanda

Cada escenario, corrido solo, pasa. Lo que está en duda es la **batería como
instrumento**, no el producto: hoy no sirve para decir "todo verde" de una
pasada, y ese es exactamente el trabajo que se le pide antes de un despliegue.

---

## 2026-08-21 (e) · El reintento del código, verificado — y lo que costó verificarlo

**Rama:** `claude/review-pending-prs-e227dd`

### El caso

Andres eligió la **opción 1** para el bloque de canal del paso 6 —sacarlo de la
demostración y decir simplemente a dónde fue el código— **con una condición**:
*"verificando que efectivamente se pueda reintentar si hay error o se pueda
reintentar en demanda, en el demo"*.

Esa condición es la que valió la pena: verificarla destapó tres cosas que
estaban rotas y que nadie habría visto mirando la pantalla andar bien.

### Qué cambió

**El bloque de canal no se dibuja en demostración.** El acto se abre al cargar,
así que para cuando alguien miraba los controles el código ya había salido y
quedaban congelados desde el primer instante: ofrecían una decisión imposible.
Ahora se dice a dónde fue el código y listo. Poder cambiarlo exige descartar el
acto abierto, y eso el dominio no lo permite — queda anotado, no simulado.

**Los textos que narraban el enlace.** El indicador de tres pasos decía *"Recibí
el enlace / Abrí y firmá / Te confirmamos y volvés al portal"* — tres cosas que
en la demostración no pasan. Se agregó un juego propio
(`PASOS_PROGRESO_FIRMA_DEMO_P8`) en vez de cambiar el original, porque los dos
recorridos son ciertos, cada uno en su modo.

**Los mensajes de error no correspondían a los motivos reales.** De los ocho que
el servidor devuelve, el mapa acertaba **dos**: el resto caía en *"No pudimos
procesar el pedido"*. Un código mal tipeado —lo más normal del mundo— no decía ni
que estaba mal ni cuántos intentos quedaban. Ahora los motivos salen de
`ResultadoFirmaDemo` / `ResultadoAperturaDemo` y del propio Route Handler, y se
muestra `intentosRestantes`, que el servidor ya mandaba y la pantalla ignoraba.

**Escenario E2E nuevo (`09-firma-reintento-codigo`)** que fija los dos caminos
del reintento: se yerra el código, aparece el mensaje específico con los intentos
restantes y el trámite **sigue en pie**; se pide otro código, el proveedor emite
uno nuevo con el contador de intentos en cero; se firma con ese y el flujo sigue
al pago.

### Tres tropiezos propios, y qué enseñó cada uno

Ninguno era un bug del producto; los tres eran del andamiaje, y los tres se
veían igual desde afuera: "el test falla".

1. **El presupuesto de tiempo, no el código.** El camino feliz empezó a fallar
   **después de llegar al paso 8**: completaba todo y el reloj lo mataba en la
   última pantalla. El recorrido incorporó dos esperas deliberadas del producto
   —el contador de 5 s del pago y el cierre del paquete documental— y 180 s
   dejaron de alcanzar. Global a 300 s.
2. **Esperar el título en vez del contenido.** El ayudante daba por abierto el
   acto al ver el encabezado *"Código para firmar"*, que se dibuja apenas hay
   acto **mientras la emisión sigue en vuelo**. Leía el panel en ese hueco y
   encontraba `null`, con el mensaje "el panel no tiene código", que es cierto y
   desorienta. Ahora espera el texto que solo existe con el código ya emitido.
3. **`getByRole("alert")` no es unívoco en Next.** Devuelve también el
   `__next-route-announcer__`, invisible, y el modo estricto de Playwright se
   niega —con razón— a elegir. Se busca por texto.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests**, en verde |
| `e2e/01-camino-feliz` | Pasa (2,1 min) |
| `e2e/09-firma-reintento-codigo` | Pasa (1,9 min) — el reintento queda probado |

### Queda abierto

| Tema | Nota |
| :---- | :---- |
| Poder **cambiar de canal** en el paso 6 | Exige descartar un acto abierto, que hoy el dominio no permite. Es la opción 3 de las tres que se plantearon; quedó para el rediseño |
| Batería completa | Lanzada al cierre de esta entrada; en la corrida anterior habían fallado 4 escenarios que pasan aislados, sin causa diagnosticada |

---

## 2026-08-21 (d) · Las cinco observaciones, terminadas

**Rama:** `claude/review-pending-prs-e227dd` · **Estado: EN PAUSA, a pedido de Andres**

### El caso

Andres pidió terminar las cinco observaciones mientras arma el diseño nuevo.
Están las cinco. La batería E2E completa **no llegó a correr** sobre el
resultado final: se cortó al pausar.

### Qué cambió

**#2 · El paso 6 dejó de mandar un enlace y pasa a pedir el código.** Se fue el
botón *Enviar enlace seguro de firma* y se fue la ventana del firmador. El acto
se abre solo al cargar la pantalla y lo único que hay es el OTP de 6 dígitos
(`BloqueOtpFirma.tsx`), con *Firmar* y *Pedir un código nuevo*. El código sigue
emitiéndolo y validándolo el proveedor simulado con las reglas de siempre, y la
pantalla **nunca lo ve** (regla inviolable #2).

Efecto colateral buscado: **el problema del canal clavado desaparece por
construcción**, porque ya no queda un acto abierto esperando a que alguien
vuelva de otro lado. Se borraron `PanelFirmadorSimulado.tsx` y
`ModalFirmadorSimulado.tsx` (339 líneas), que quedaron sin un solo consumidor.

**#4 · El escenario 07, resuelto de raíz.** Miraba el 409 con la pantalla
abierta, y esa ventana la cierra el propio sondeo al reintentar el sellado. Ahora
va a `about:blank` antes de consultar —sin temporizadores corriendo— y usa
`page.request`, que lleva las cookies del contexto. **3 de 3, y bajó de 1,4 min a
34 s.**

**#5 · Links y mensajes.**

- Los dos enlaces del pie —*Derecho de retracto* y *Tus datos y cookies*—
  aparecen en todas las pantallas, incluidas las que tienen un formulario a
  medio llenar, y navegaban fuera. Ahora abren modal (`EnlaceAclaracion`). Se
  escribió el texto de retracto, con una sección de *qué no es* que separa el
  retracto de dejar vencer una solicitud sin pagar. Las páginas `/retracto` y
  `/privacidad` **se conservan** para quien llegue por su dirección.
- Los mensajes se mudaron junto a su acción. En el paso 7 hay tres acciones
  distintas —generar, *Pagado* y el sondeo— y el error vivía al final de la
  columna: ahora cada mensaje se dibuja junto al botón que lo produjo, con un
  `origenError` que decide cuál. En el paso 4 el error estaba a media pantalla
  del botón de validar; ahora va debajo.

### La corrección que importa: mi medición del 06 estaba viciada

Le había dicho a Andres que el escenario 06 fallaba **1 de cada 2 corridas
también sobre el árbol limpio**, y de ahí concluí que la causa era la lectura
eventual de DynamoDB. **Las dos mediciones usaban `--repeat-each`, y eso invalida
este escenario**: termina dejando el expediente en `VENCIDO`, que **bloquea la
cédula por la regla #11**, y el saneo de cédulas corre una vez por corrida, no
entre repeticiones. La segunda repetición estaba condenada por diseño.

Medido bien —tres corridas independientes— el 06 da **3 de 3 en verde**.

`ConsistentRead: true` se conserva igual, porque leer con consistencia eventual
en un flujo de escritura-y-lectura inmediata es incorrecto por su cuenta, pero
el comentario del código se corrigió: ya no se atribuye un mérito sin evidencia.

**La lección, para la próxima:** `--repeat-each` no sirve en los escenarios 2, 3
y 6, que terminan en estados que bloquean la cédula. Para muestrear esos, hay que
lanzar corridas independientes.

### Un fallo que solo apareció por el E2E

El autocompletado del OTP **no firmaba**. `onCompleto` de `CamposOtp` se dispara
en el mismo tick en que se escribe el sexto dígito, y `firmar()` leía el código
del estado, que todavía tenía cinco: la guarda de longitud cortaba **en
silencio**, sin mensaje. Con el botón sí andaba, que es lo que volvía confuso al
síntoma. El código pasa por parámetro.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests**, 83 archivos, en verde |
| `e2e/01-camino-feliz` | Pasa con el flujo nuevo (OTP en línea + botón *Pagado*) |
| `e2e/07-firma-atomica` ×3 independientes | 3 de 3 |
| `e2e/06-vencimiento-firma` ×3 independientes | 3 de 3 |
| Batería E2E completa | **No corrida** sobre el resultado final |

### Queda abierto

| Tema | Nota |
| :---- | :---- |
| Correr `npm run test:e2e` completo | Es lo único que falta para cerrar esta tanda |
| Armar el PR | Sin commitear: ~49 archivos tocados |
| La reformulación del UX | Andres la está armando; esta tanda es su punto de partida |

---

## 2026-08-21 (c) · Las cinco decisiones, respondidas — y detenido a mitad para reformular el UX

**Rama:** `claude/review-pending-prs-e227dd` · **Estado: EN PAUSA por decisión de Andres**

### El caso

Andres respondió las cinco decisiones que la entrada anterior dejaba abiertas.
Se alcanzaron a implementar dos y media antes de que pidiera parar: *"deja
pendiente todo esto aun, quiero reformular el UX"*.

**Lo que sigue es el punto de partida de esa reformulación.** Nada de lo
pendiente se empezó, así que no hay trabajo a medio hacer que haya que
desarmar.

### Las cinco respuestas de Andres, textuales

| # | Tema | Su respuesta |
| :---- | :---- | :---- |
| 1 | Aviso de vencimiento que ningún código manda | *"El texto es cierto, pero por fuera del sistema"* |
| 2 | El canal de firma queda clavado | *"Quita ese botón, solo pide el OTP, que debe llegar por Whatsapp o Mail, es solo para el demo"* |
| 3 | El mock de pago vive en memoria de la instancia | *"En lugar de eso, solamente que haya un contador de 5 segundos para el demo y activar el botón de «Pagado»"* |
| 4 | Los dos E2E intermitentes | *"Corrige de manera integral esa intermitencia"* |
| 5 | Los links de los formularios | *"Todos los links de los formularios deben abrir un modal con un mensaje paramétrico… en lugar de direccionar a cualquier lugar. Todos los mensajes deben aparecer cerca de la acción que los ha disparado no en otro lugar"* |

### Qué se alcanzó a hacer

**1 · Resuelto, sin código.** El aviso de vencimiento sí se da: lo hace el
equipo, por fuera del portal. El texto queda como está, y quedó anotado en
`textos-p7.ts` **por qué no hay que "arreglarlo"** de las dos maneras
tentadoras: sacar la frase ocultaría algo que de verdad ocurre, e implementar un
envío automático duplicaría el que ya se hace a mano.

**3 · Hecho.** El pago del demo ya no lo dispara un reloj:

- Contador de 5 segundos en el paso 7 y botón **Pagado**, que hace lo que en la
  realidad hace la persona en la app de su banco.
- `POST /api/p7/pagado`, extensión `route.demo.ts` — no se compila siquiera sin
  `DEMO_MODE`. **No transiciona el expediente**: eso lo sigue haciendo
  `confirmarPagoP7` desde el sondeo, con todas sus validaciones y emitiendo el
  certificado en la misma escritura (D-12).
- De paso resuelve el problema de fondo: `acreditarPagoMock` **reconstruye la
  operación desde el `Pago` persistido** si esta instancia de cómputo no la
  conoce, así que la acreditación deja de depender de qué instancia atendió cada
  pedido.

**4 · La causa de raíz, encontrada y corregida.** No era de los tests.

> **Ninguna lectura de DynamoDB pedía consistencia fuerte.** `GetItem` lee por
> omisión con consistencia eventual, y este producto es una secuencia de
> escrituras seguidas de lecturas inmediatas: una pantalla transiciona el
> expediente, navega, y la siguiente lo lee en el mismo segundo.

Eso es exactamente el escenario 06: al vencer el plazo, la pantalla de pago
confirmaba la transición a `VENCIDO` y llevaba a Pantalla B, que leía el
expediente todavía en `FIRMADO` y mostraba la pantalla con guiones. Falla ~1 de
cada 2 corridas — el ratio de una carrera, no de un test frágil. `obtenerPorId`
pasa a `ConsistentRead: true`. **Es un bug de producto, no de la suite**: le
podía pasar a cualquiera, no solo a Playwright.

El E2E del pago, además, dejó de depender de un temporizador: espera a que el
botón *Pagado* se habilite (con el auto-retry de Playwright, sin
`waitForTimeout`) y lo aprieta.

### Qué queda pendiente, para la reformulación del UX

| # | Qué falta | Nota para retomarlo |
| :---- | :---- | :---- |
| 2 | Quitar el botón de enviar enlace del paso 6 y dejar solo el OTP, que llega por WhatsApp o correo | Es el cambio que además elimina el problema del canal clavado, porque desaparece el acto que lo clavaba |
| 4 | El escenario **07** sigue intermitente | Su carrera es distinta a la del 06 y no la arregla `ConsistentRead`: el test comprueba que el cobro está inhabilitado (409) mientras faltan las firmas institucionales, pero esa ventana la cierra el propio sondeo de la pantalla, que reintenta cada 2 s. La salida limpia es detener el sondeo antes de consultar, no ampliar el plazo |
| 5 | Los links de los formularios abren modal con mensaje paramétrico; los mensajes van **junto a la acción que los disparó** | Ya existe `EnlaceAclaracion` (modal, sin navegar) y ya se usó para los tres documentos previos a la firma. La segunda mitad —mensajes cerca de la acción— es la que toca todas las pantallas |

### Verificaciones al momento de la pausa

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests**, 83 archivos, en verde |
| `e2e/01-camino-feliz` con el botón *Pagado* | Pasa |

Todo sin commitear.

---

## 2026-08-21 (b) · Bancard: el mock pasa a hablar el idioma del proveedor

**Rama:** `claude/review-pending-prs-e227dd`

### El caso

Andres pidió que **los mensajes y el comportamiento de Bancard, incluido el
demo, salgan de los documentos de `docs/Integraciones/`**. El mock los inventaba:
una demostración que muestra un formato que no es el del producto enseña algo
falso, y el día que se escriba el adaptador oficial nadie se acuerda de que
aquello era de mentira.

### Qué cambió

- **El QR es EMVCo de verdad** (`src/adapters/mock/bancard-emvco.ts`). Antes era
  `bancard-qr://pago?ref=…&monto=…&moneda=PYG`, un esquema inventado que ningún
  lector reconoce. Ahora se arma con la estructura TLV del documento —etiquetas
  `00/01/02/52/53/54/58/59/60/62`— y cierra con **CRC-16/CCITT-FALSE** en la
  etiqueta `63`, calculado sobre todo lo anterior **incluido su propio
  encabezado `6304`**, que es la parte que se implementa mal si uno no la lee con
  cuidado. Es un QR **dinámico** (`01` = `12`): lleva el importe adentro.
- **`hook_alias`**, el identificador con el que Bancard QR notifica el pago por
  callback. No existía. Lleva prefijo `DEMO` para distinguirse de un alias real.
- **Los `response_code` del proveedor** (`CODIGOS_RESPUESTA_BANCARD` en el
  puerto): `00` aprobada, `05` tarjeta inhabilitada, `12` transacción inválida,
  `15` tarjeta inválida, `51` fondos insuficientes, con la descripción textual
  del documento. `EstadoConsultaPago` y `ErrorBancard` los transportan.
- **El rechazo forzado del panel usa `51`**, que es el del propio ejemplo del
  documento y el más frecuente en producción.
- **El mensaje de la pantalla se compone**: la razón la pone Bancard
  ("Bancard informó: Fondos insuficientes (código 51)"), el qué hacer lo pone el
  producto. Antes un solo texto genérico servía igual para fondos insuficientes
  que para una tarjeta inhabilitada, y esas dos cosas mandan a la persona a hacer
  cosas distintas.
- **El contrato compartido exige el formato** (`payment-provider.contract.ts`),
  no solo los tests del mock: el adaptador oficial tendrá que cumplirlo igual.
- **La nota en pantalla dejó de mentir**: decía que el payload era "análogo" al
  de Bancard; ahora dice que es EMVCo real y que el dibujo lo hace Bancard.

### Divergencia declarada, no unificada

**Los dos documentos de Bancard no coinciden en la moneda**: compra simple
declara `currency` como `PYG`, y el callback de QR trae `"currency":"GS"` en sus
ejemplos. Se conservan las dos (`MONEDA_BANCARD_VPOS` / `MONEDA_BANCARD_QR`):
son dos APIs distintas del mismo proveedor, y elegir una sola por prolijidad
sería inventar el contrato de la otra.

### Qué NO se hizo

- **La reversa automática a los 5 segundos.** El documento de QR es explícito:
  Bancard aguarda 5 s la respuesta del callback y, si no llega, *reversa la
  transacción*; y si el comercio no pudo responder, **debe llamar al endpoint
  `revert`**. Hoy no hay callback —el mock no lo emite— así que no hay nada que
  reversar. Cuando exista, esa regla es obligatoria y no opcional.
- **Los códigos que no están en el documento no se inventaron.** El vencimiento
  de un QR se marca con `12` (transacción inválida), que es el que corresponde a
  una transacción que nunca ocurrió, y no con un código propio.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests** (11 nuevos), 83 archivos, todo en verde |
| CRC-16 contra el vector público del algoritmo | `crc16Emvco("123456789")` = `29B1` |
| Parseo TLV de la cadena generada | Reconstruye la cadena entera sin desalinearse |

Un test que había escrito se descartó por inútil: buscaba "datos con forma de
cédula" en la salida y daba falso positivo contra el código de comercio. La
garantía de que no hay datos de la persona es **estructural** —la función solo
recibe importe y alias—, así que se reemplazó por uno que congela la lista de
etiquetas, que sí puede degradarse si alguien agrega una.

### Queda abierto

| Tema | De quién es la decisión |
| :---- | :---- |
| Datos reales del comercio (código, sucursal, rubro) para el EMVCo; hoy son de demostración y lo dicen | Bancard los provee al dar de alta la cuenta |
| Emitir el callback y honrar la reversa a los 5 s, con su endpoint `revert` | Cuando se escriba el adaptador oficial |

---

## 2026-08-21 · Revisión de PRs pendientes y tanda de arreglos del flujo

**Rama:** `claude/review-pending-prs-e227dd`

### El caso

Arrancó como una revisión de los cinco PR que figuraban como pendientes y derivó
en dos cosas más: el cierre del bump de Terraform que estaba trabado hacía dos
semanas, y una tanda de arreglos salidos de que Andres recorrió el flujo en vivo
y fue reportando lo que encontraba.

### Qué cambió

**Pull requests.** Ninguno quedó pendiente:

| PR | Desenlace | Por qué |
| :---- | :---- | :---- |
| [#43](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/43) | Ya estaba mergeado | La tarjeta de la lista estaba desactualizada |
| [#44](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/44) | **Cerrado** | Recorte de `CLAUDE.md` escrito contra una versión anterior: conflicto real, y media premisa caducada — la sección `Comandos` de hoy ya **no** es derivable de `package.json` |
| [#45](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/45) | **Mergeado** (`7166aab`) | Decisión del módulo de identidad independiente. Se corrigió antes una ruta desactualizada (`(flujo)/p5-identidad/` → `(flujo)/identidad/`) |
| [#37](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/37) | **Mergeado** (`1041b93`) | aws-sdk ×4, minor dentro de v3 |
| [#38](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/38) | **Mergeado** (`8a84633`) | `@types/node`, solo lockfile |
| [#4](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/4) | **Cerrado**, reemplazado por [#54](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/54) (`86a4bbe`) | Ver abajo |

**El caso de #4, que conviene no volver a diagnosticar.** Su Gitleaks en rojo
**nunca fue un secreto filtrado**: era el falso positivo conocido del pepper de
fixture en `puerta.test.ts`, que en `main` está pineado en `.gitleaksignore` con
**dos** fingerprints (`5611d1c` y `228747b`, el segundo por el rebase al mergear
el PR #1). La rama de Dependabot era del 9-ago, estaba 156 commits atrás, y su
copia del archivo solo tenía el primero. Se probaron las tres salidas:
`@dependabot rebase` **nunca fue atendido** (el PR no tiene una sola respuesta del
bot), el botón *Update branch* no está habilitado en el repo, y pushear a mano
sacaba la rama de la gestión de Dependabot igual. Se rehízo desde `main` en un
commit, y de paso el lock quedó en **6.61.0** en vez de 6.58.0. La restricción se
dejó en `~> 6.0`, con la misma amplitud que tenía `~> 5.0`.

**Arreglos del flujo** (9, sin commitear al cierre de la sesión):

1. **Selfie por archivo en el paso 4**, solo con `DEMO_MODE=true`. Decisión de
   Andres del 20-ago que había quedado sin implementar. No es inocua —es el ancla
   biométrica— y entra porque ese camino **ya renunció a la prueba de vida**
   (`decidirPresenciaDemo` comprueba presencia, no vida), así que exigir cámara
   para la selfie no compraba la garantía que aparentaba. Origen `ARCHIVO` sellado
   en la evidencia. `CLAUDE.md` afirmaba lo contrario y se corrigió.
2. **El sexo dejó de completarse por OCR** y pasó a selector obligatorio. Sigue
   viajando en `correcciones.sexo`, así que el contrato del endpoint no cambió.
3. **Callejón sin salida al volver atrás, cerrado en las 7 pantallas** que podían
   rechazar por estado. Antes la pantalla se dibujaba entera y el rechazo llegaba
   al enviar —en el paso 4, después de sacar las tres fotos—. Ahora se pregunta en
   el servidor **antes de dibujar** (`expedienteEnOtroPaso` + `TramiteEnOtroPaso`,
   ahora compartido; `/plan` tenía el suyo propio y se unificó).
4. **«Finalizar y volver al inicio» cierra el trámite en el navegador**
   (`POST /api/flujo/cerrar`). Antes la cookie seguía apuntando al expediente
   terminado y el paso 1 recibía con «Ya tenés un trámite empezado» a quien acababa
   de contratar. No toca el expediente ni levanta el bloqueo por cédula.
5. **El sondeo del pago ya no espera para siempre.** `PAGO_NO_INICIADO` no estaba
   en la lista de motivos terminales, así que cada respuesta se trataba como
   tropiezo pasajero y el sondeo repetía en silencio, indefinidamente. Se agregó
   contador de espera, aviso a los 30 s, y corte a los 5 sondeos sin operación.
6. **La pantalla de firma dejó de afirmar que mandó el enlace.** Ver "el correo"
   más abajo.
7. **Los tres documentos de «Acceso previo a la información»** tenían
   `href="/plan"` escrito a mano: tocar «Aviso de privacidad» justo antes de firmar
   te devolvía al paso 1. Ahora abren su documento en modal.
8. **El «← Volver» del paso 7** apuntaba dos pasos atrás, a declaraciones. Resto de
   antes de D-08. Ahora se deriva de `PASOS_FLUJO`.
9. **El texto bajo el botón del paso 4** enumeraba requisitos incompletos (le
   faltaban los datos económicos, y con el cambio 2 también el sexo).

### Qué hizo Andres

- **Decidió el destino de cada PR**: cerrar #44, mergear #45/#37/#38, cerrar #4 y
  rehacerlo desde `main`, y autorizar cada merge por separado sabiendo que
  **mergear a `main` es desplegar a producción**.
- **Marcó dos PR como ajenos a este repo**: [WhatsAppModular #31](https://github.com/segurolotengopy/WhatsAppModular/pull/31)
  y [encuentrame.bo #3](https://github.com/segurolotengopy/encuentrame.bo/pull/3)
  se atienden desde sus propios directorios, no desde sesiones de este proyecto.
- **Corrió el `terraform plan` del bump del provider**, dos veces:
  - La primera falló con `No valid credential sources found` — **error del comando
    que le pasé**: el provider tiene `profile = var.aws_profile` con `default = null`,
    así que sin `AWS_PROFILE=aab1-demo-deployer` cae a la cadena por defecto y
    termina preguntándole al IMDS de una EC2 que no existe.
  - La segunda devolvió `No changes`, pero **con el provider 5.100.0**: su
    `versions.tf` seguía en `~> 5.0`, así que `init -upgrade` se quedó dentro de la
    serie 5. Se detectó leyendo su lock y su carpeta de providers, y se corrigió el
    cuerpo del PR, que ya afirmaba una verificación que en ese momento no existía.
  - La tercera, con la restricción en `~> 6.0`, bajó **6.61.0** y devolvió
    `No changes`. Esa es la buena.
- **Recorrió el flujo en vivo** y reportó, en este orden: selfie por archivo
  bloqueada, el paso 6 trabado sin correo y sin poder cambiar de canal, la vuelta
  atrás sin poder cambiar nada, el sexo autocompletado, el paso 7 esperando sin
  contador, «Finalizar» devolviendo al panel de trámite empezado, y el correo que
  no llegó **después de dos intentos**.
- **Pidió una auditoría con agentes** de botones, vueltas atrás y envíos reales.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1120 tests**, 82 archivos, todo en verde |
| `npm run test:e2e` | **7 pasan**, 3 se saltean, **2 escenarios intermitentes** (ver abajo) |
| CI sobre `main` fusionado (`8a84633`, `86a4bbe`) | 4/4 en verde, Gitleaks incluido |
| Amplify, job 55 (`8a84633`) | `SUCCEED`; `/plan` responde **HTTP 200**, la raíz **307** |
| `terraform validate` con provider 6 | `Success! The configuration is valid.` — ningún argumento removido ni renombrado |
| `terraform plan` con **6.61.0** contra el state real | `No changes` |

**Los dos intermitentes de E2E, con su prueba:**

- **06 · vencimiento** falla ~1 de cada 2 corridas. Se verificó guardando la tanda
  entera con `git stash` y corriéndolo sobre el árbol limpio: **falla igual, en la
  misma proporción**. Es preexistente. No perder tiempo buscándole una regresión.
- **07 · firma atómica** comprueba que mientras las firmas institucionales no
  llegan el pago sigue bloqueado (409), pero esa ventana **la cierra el propio
  sondeo de la pantalla**, que reintenta cada dos segundos. Aislado pasa siempre.

**Dos regresiones que el E2E atrapó durante la tanda**, las dos por el chequeo
previo del punto 3, y las dos con la misma forma: hay pantallas que **siguen
siendo dueñas del estado que producen** porque no navegan solas. `/pago` conserva
`PAGO_CONFIRMADO` (se queda mostrando el comprobante y el enlace a la
confirmación) y `/firma` conserva `FIRMADO` (su sondeo lleva a la persona al pago).
De ahí sale el parámetro `tambienPropios` de `expedienteEnOtroPaso`.

### Qué se decidió NO hacer, y por qué

- **El canal de firma sigue clavado** una vez pedido el enlace, sin botón para
  descartar el acto. Arreglarlo pide una forma de cancelar en el dominio, y hoy el
  enlace no se envía a ningún lado igual.
- **Los mensajes `ESTADO_INVALIDO` de los formularios siguen sin enlace de vuelta.**
  Solo se disparan en la ventana angosta entre que el servidor dibujó la pantalla y
  que se envía el formulario con el estado ya cambiado desde otra pestaña.
- **Los dos E2E intermitentes no se tocaron.** Hacerlos estables exige decidir qué
  deben afirmar, y eso no corresponde colar en medio de arreglos de producto.

### El correo del paso 6 — respuesta definitiva

Andres lo probó dos veces esperando el enlace de firma. **No podía llegar, y no
es SES ni la ventana de Meta.** `SignatureProvider` está en mock porque
`INTEGRATION_SIGNATURE` no está definida, y su `iniciarFirma` **no hace una sola
llamada de red**: fabrica una URL simulada y la guarda. Da igual el canal elegido.
Ninguna variable de entorno cambia eso — `INTEGRATION_SIGNATURE=live` haría que la
app tirara un `throw` explícito, porque el adaptador oficial no existe.

La pantalla decía «Enviamos el enlace de firma a tu canal verificado», que es una
afirmación falsa y costó dos intentos. En demostración ahora dice que el enlace no
se envía a ningún canal y remite al firmador de la propia pantalla.

**Del mismo inventario salieron dos cosas más:**

- **El paso 7 promete un aviso que ningún código intenta**: «si el pago no se
  completa dentro de 24 horas, la solicitud vence y se avisa por WhatsApp y
  correo». En la transición a `VENCIDO` no hay llamada a `MessagingProvider`. Es
  una promesa al consumidor sin implementación.
- **`INTEGRATION_OTP_EMAIL=live` y `OTP_EMAIL_FROM` están en Amplify y no las
  ejercita nada** en el flujo de 8 pasos (D-06 retiró el OTP de correo). No se
  quitan: la opción C de la firma las va a necesitar.

### Queda abierto

| Tema | De quién es la decisión |
| :---- | :---- |
| **La promesa de aviso de vencimiento del paso 7**: implementarla o sacar la frase | Legal — es lo único de esta tanda con filo legal antes de mostrarle el flujo a alguien |
| Armar el PR de la tanda (24 archivos, +565/−224) | Andres |
| Cancelar el acto de firma para poder cambiar de canal | Producto |
| Qué deben afirmar los dos E2E intermitentes | Andres |
| Persistir el estado del mock de pago (hoy vive en memoria de la instancia, y Amplify puede escalar) | Andres, si reaparece en demostraciones |
| **D1: quién ejecuta la firma del cliente** — Code100 confirmó por escrito que no puede | Gerencia y Legal. Sigue bloqueando el adaptador oficial |
