# Guía operativa v2 — Rediseño con Lovable: retoma desde la fase 3 (iteración visual)

**Fecha:** 01-sep-2026 (tarde) · **Estado al escribir:** organización de
GitHub creada, proyecto Lovable creado y conectado, semilla v1 cargada, **P0
ejecutado**. Lovable reportó dos observaciones (abajo, §3.2). Andres observó
que el flujo v3 **implementado en la demo se ve mal** y que el canvas
<https://claude.ai/code/artifact/ce0c8332-d059-4b59-a790-bc8904ec079b> es
mucho mejor.

Esta versión **reemplaza las fases 3 a 6 de la guía v1** (`GUIA_REDISENO_LOVABLE.md`
§4–§7). Las fases 1 y 2 (organización, proyecto, conexión GitHub) no cambian.

---

## 0. El hallazgo que cambia el plan

Se leyó el HTML publicado del artefacto (2,2 MB: plantilla de las seis
pantallas, tres bloques de CSS, la lógica con todos los textos, ocho fotos,
dos isologos y las fuentes) y se comparó con lo que el repo portó en
`src/app/canvas-v3.css`. Resultado:

**El canvas tiene dos capas de estilo, y el repo portó la equivocada.**

| | Capa 1 «Modernist» (base de Claude Design) | Capa 2 «SeguroLoTengo» (última del archivo; **gana por cascada**) |
| :-- | :-- | :-- |
| Tipografía | Archivo 800 | **DM Sans 600** |
| Acento | rojo `#ec3013` | **naranja `#e2660f` / `#bd550f`** (la paleta de `GUIA_DE_ESTILOS.md`) |
| Radios | 0 / 0 / 0 | **8 / 12 / 16 px** |
| Fondo · divisor · texto | `#f3f2f2` · 40 % de `#201e1d` · `#201e1d` | **`#fafafa` · `#e0e0e0` · `#333333`** |
| Foco | acento | **azul `#2b5a9e`** |
| Botón / campo | 36 px, sin radio | **44 px, radio 12 / 10** |
| Portado al repo | **sí, entero** (`canvas-v3.css` líneas 15–75) | **no** |

Además, la mitad del dibujo del canvas vive en **estilos inline** del HTML
(tarjetas con radio 16, kickers 9,5–10,5 px en `accent-700`, cuerpo
12,5–13,5 px, rejillas `auto-fit`, recortes de foto), que tampoco entraron al
repo salvo por partes. Es decir: la demo no se ve «mal» por mal gusto de
nadie, se ve mal porque **se construyó sobre la base que el propio diseño
tapa**. Y la buena noticia: la capa 2 usa exactamente la paleta que ya está
en `globals.css` — el porteo correcto es de dibujo, no de colores.

Todo esto está documentado, con medidas, en `semilla/canvas/canvas-reglas-visuales.md`.

**Consecuencia para Lovable:** la semilla deja de ser «tokens + spec» y pasa a
ser **el canvas mismo** (HTML + CSS + JS + textos + capturas), con la
especificación mandando solo sobre textos, campos y reglas. Lovable
**reproduce** y después, si Andres quiere, mejora.

---

## 1. Qué hay en `semilla/canvas/` (nuevo)

| Archivo | Qué es | Para quién |
| :--- | :--- | :--- |
| `canvas-standalone.html` (3 MB) | El artefacto **funcionando sin conexión**: doble clic y se navega el flujo completo, con tema noche, modales y carrusel. Es la referencia viva. | Andres, revisores, Claude Code |
| `canvas-standalone-debug.html` | Igual, pero expone `window.__dc` para saltar de pantalla desde la consola del navegador (ver §1.1). | Quien saque capturas |
| `canvas-plantilla.html` (157 KB) | El HTML de las seis pantallas con las imágenes por nombre (`/v3/…`, `/marca/…`), sin runtime. **Lo que lee Lovable.** | Lovable, Claude Code |
| `canvas-estilos.css` | Las dos capas de CSS, anotadas: cuál gana y por qué. | Lovable, Claude Code |
| `canvas-logica.js` | La lógica del canvas: estados, textos calculados (`guiaInicio`, `tituloPaso1`, `pasosStepper`, `hitos`…), modales (`docs()`). | Lovable, Claude Code |
| `canvas-textos.md` | 326 textos del HTML por pantalla + 329 cadenas de la lógica. | Auditoría P8, porteo |
| `canvas-modales.md` | Contenido literal de los 16 documentos/modales del canvas. Responde la observación 1 de Lovable. | Lovable |
| `canvas-reglas-visuales.md` | Las medidas: tokens vigentes, componentes, dibujo inline, cascada. | Lovable, Claude Code, revisión |
| `capturas/` (18 PNG) | Las seis pantallas a 1360 y 390 px, más inicio en tema noche, tomadas del artefacto real. | Lovable (referencia visual), comparación |
| `public/v3/*.jpg`, `public/marca/*.svg` | Las ocho fotos y dos isologos **extraídos del artefacto** (las fotos son byte a byte las de `public/v3/` del repo; los SVG del canvas difieren de los del repo: usar los del canvas en Lovable). | Lovable |
| `ESPECIFICACION_PANTALLAS-ADENDA-2026-09-01.md` | Textos que faltaban (pie legal literal, modales, cabecera, rótulo de la 4.ª foto), el párrafo nuevo de «Paleta y tipografía», y las divergencias que se mantienen. | Lovable, spec del repo |
| `02-knowledge-lovable-v2.md` | Knowledge nuevo (reemplaza al v1). | Lovable |
| `03-prompts-lovable-v2.md` | P0-bis y P1–P8 reescritos para **reproducir** el canvas. | Lovable |

### 1.1 Navegar el canvas sin conexión (solo referencia; no requiere ninguna acción)

Abrir `canvas-standalone-debug.html` en cualquier navegador. Abajo a la
izquierda hay un panel de botones (Inicio · Paso 1 vacío · Paso 1 lleno ·
Paso 2 · Paso 3 · Paso 3 firmado · Confirmación · Revisión manual · ☾/☼ Tema
· Ocultar) que salta a cada pantalla con datos de ejemplo. Sirve para ver el
diseño aprobado tal cual es mientras se revisa lo que Lovable produce. **No
hay que pegar nada en la consola ni hacer ningún cambio.** La píldora «Made
with Claude Design» abajo a la derecha es del visor, no del diseño.

### 1.2 Cómo se obtuvo (para repetirlo cuando el canvas cambie)

El artefacto publica una página «bundle»: un `<script type="__bundler/template">`
con el HTML (codificado como JSON) y un `<script type="__bundler/manifest">`
con los recursos en base64 (gzip los de texto). Se decodificó el template, se
descomprimió el manifiesto, se mapearon los UUID a nombres por `alt` y tamaño,
se inlinó React antes del runtime `dc-runtime` (que si no lo carga de unpkg)
y se sirvió con Chromium (Playwright) para las capturas. Si el canvas se
vuelve a publicar, se repite en una sesión de Claude (Cowork o Claude Code) con
el mismo enlace; toma minutos.

---

## Qué requiere su intervención en esta guía (resumen)

Solo dos cosas: (1) en la fase 3.0, ejecutar el bloque `git` que sube la
carpeta del canvas al repositorio de Lovable y pegar el Knowledge v2 en
Settings → Knowledge; (2) en la fase 3, enviar los prompts a Lovable uno por
uno y aprobar o corregir cada pantalla contra las capturas. Todo lo de la
sección 1 es material de consulta y no pide ninguna acción.

## 2. Fase 3.0 — Cargar el canvas en Lovable (**importar el artefacto**)

Lovable no puede abrir la URL del artefacto (es privada, pide sesión de
claude.ai) ni importar un repositorio. La importación es **por archivos**, y
el proyecto ya está conectado a GitHub, así que el camino más limpio es por
git:

```bash
cd slt-diseno-lovable                       # el clon del repo que creó Lovable (guía v1, fase 2)
git pull
mkdir -p docs/canvas docs/pantallas public/v3 public/marca
cp -r <semilla>/canvas/{canvas-plantilla.html,canvas-estilos.css,canvas-logica.js,canvas-textos.md,canvas-modales.md,canvas-reglas-visuales.md,capturas} docs/canvas/
cp <semilla>/canvas/ESPECIFICACION_PANTALLAS-ADENDA-2026-09-01.md docs/pantallas/
cp <semilla>/canvas/public/v3/*.jpg public/v3/
cp <semilla>/canvas/public/marca/*.svg public/marca/     # sobrescribe los del repo de producción: en Lovable van los del canvas
git add -A && git commit -m "canvas: diseño aprobado ce0c8332 como fuente visual" && git push
```

**No subir** `canvas-standalone*.html` a Lovable (3 MB de data URIs que el
agente no puede leer con provecho; Lovable no guarda archivos > 10 MB y estos
pasan, pero no aportan). Quedan en el repo de producción, en la semilla.

Alternativa sin git: editor de código de Lovable (`</>`), crear las carpetas y
pegar los archivos de texto; las imágenes y las capturas se arrastran al chat
y después se mueven. Es más lento y Lovable elige dónde guarda lo arrastrado.

Luego, en Lovable → Settings → Knowledge: **borrar el texto v1 y pegar
`02-knowledge-lovable-v2.md` completo**.

> **Punto de control 3.0.** En el editor de código de Lovable existen
> `docs/canvas/canvas-plantilla.html`, `docs/canvas/canvas-estilos.css`,
> `docs/canvas/capturas/00-inicio-1360.png` y
> `docs/pantallas/ESPECIFICACION_PANTALLAS-ADENDA-2026-09-01.md`, y el
> Knowledge empieza con «Knowledge del proyecto Lovable — SeguroLoTengo · v2».
> Sin esto, P0-bis va a reproducir de memoria.

---

## 3. Fase 3 — Iteración visual, retomando desde P0

### 3.1 P0-bis, y por qué no se rehace P0

P0 (v1) dejó tokens con los nombres correctos, el conmutador de tema, la
cabecera, la banda y el pie. Nada de eso se tira: **P0-bis** (en
`03-prompts-lovable-v2.md`) corrige los **valores** (DM Sans, naranja, radios
8/12/16) y el **dibujo** de esos tres compartidos contra el canvas, y rellena
los `[texto pendiente]` con la adenda. Enviarlo y verificar:

> **Punto de control 3.1.** `src/index.css` no contiene `#ec3013`, `Archivo`
> ni `radius: 0`; `/design-system` muestra botones de 44 px con radio 12; la
> cabecera se ve como `capturas/00-inicio-1360.png` (bloques, kickers
> naranja-700, isologos 38 px, botón de tema a la derecha).

### 3.2 Las dos observaciones de Lovable, resueltas

Lovable hizo exactamente lo que el Knowledge le pedía —no inventar— y dejó
dos huecos. Los dos están cerrados en la **adenda** y entran con P0-bis:

1. *«La especificación enumera el contenido institucional del pie, pero no
   aporta su redacción literal ni URLs para cinco enlaces; usé [texto
   pendiente]. Las referencias regulatorias de cabecera están con el sufijo
   (provisional).»* → **Adenda §A y §B.** El texto literal del pie es el del
   canvas (provisional, pendiente de Legal L6). Los siete enlaces **no tienen
   URL** por diseño: abren `AclaracionModal`, y el contenido de cada modal está
   en `canvas-modales.md` (con pie «Texto de muestra…»; contactos como
   `[dato oficial pendiente]`). El sufijo `(provisional)` en la cabecera es
   correcto y se mantiene (DI-4).
2. *«Texto no encontrado: el rótulo de la cuarta foto (hero-protege.jpg) no
   figura en la especificación.»* → **Adenda §C.** El rótulo es
   **«Protege a tu familia»** (así, sin acento en «Protege», igual que el H1 del
   canvas). Los otros tres: «Inscribite con nosotros», «Elegí tu seguro»,
   «Pagá y firmá».

Cuando el ThinkPad esté en línea, la adenda se integra a
`docs/ESPECIFICACION_PANTALLAS.md` en la primera sesión de Claude Code del
porteo (es un cambio de documentación; no toca código).

### 3.3 P1 → P6: reproducir, no interpretar

Cada prompt v2 le indica a Lovable la **sección exacta** de
`canvas-plantilla.html` (`data-screen-label`), las **capturas** de referencia y
la sección de la **especificación** para los textos. Después de cada pantalla:

- Comparar la vista previa con la captura a 1360 y a 390. Lo que difiera se
  pide con la medida en la mano (`canvas-reglas-visuales.md` §4): «la tarjeta
  del plan tiene radio 16 y borde 1 px divisor; la tuya tiene radio 8 y
  sombra».
- Leer la lista de «diferencias declaradas» que devuelve el agente (el
  Knowledge v2 se lo exige). Lo que declare, se corrige antes de aprobar.
- Textos: lo que no esté en la especificación ni en la adenda ni en
  `canvas-textos.md`, fuera.

Recién con las seis reproducidas y aprobadas se abre la **fase de mejora**
(la que motivó todo esto): ahí Andres pide cambios visuales libres, uno por
prompt, y Lovable los aplica sobre una base que ya es el canvas.

> **Punto de control 3.3 (por pantalla).** Captura del prototipo y captura
> del canvas, lado a lado, a 390 px: mismos bloques en el mismo orden, mismos
> radios, mismos tamaños de kicker/título/cuerpo, mismos textos. Cero
> `[texto pendiente]` salvo los que la adenda declara como marcadores.

### 3.4 P7, P8 y aprobación

P7 (estados y tema oscuro) y P8 (auditoría doble: textos y dibujo) como en
`03-prompts-lovable-v2.md`. Aprobación y congelamiento igual que la guía v1
§4.4: `git tag -a diseno-v1-aprobado` en `repo-diseno` y entrada en la
Bitácora del repo de producción.

---

## 4. Fase 4 — Claude Code conectado (sin cambios de fondo)

Como en la guía v1 §5 (clon hermano `../slt-diseno-lovable` + MCP de Lovable
con `claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"`).
Un agregado: **el canvas mismo también entra al repo de producción** en
`docs/rediseno-lovable/semilla/canvas/`, así que Claude Code tiene tres fuentes
alineadas — el canvas (dibujo original), el prototipo de Lovable (dibujo
reproducido y mejorado, en React) y la especificación (textos y reglas).

---

## 5. Fase 5 — Porteo: qué cambia respecto de la guía v1

El método (`04-mapa-porteo.md` §0: armazón del prototipo, CSS literal
encapsulado, sin shadcn, una pantalla por sesión) sigue igual. Cambian dos
cosas:

1. **Sesión 0 arranca corrigiendo `canvas-v3.css`.** Antes de tocar el
   cascarón, se reemplaza el contenido de `src/app/canvas-v3.css` (capa 1) por
   la **capa 2** de `canvas-estilos.css`, mapeada a los tokens del producto
   (`--color-accent` → `naranja-500`, etc.; tabla en
   `canvas-reglas-visuales.md` §2), y se quita del bloque `[data-flujo="v3"]`
   de `globals.css` la redefinición a Archivo / rojo / radio 0 (líneas
   249–297 al 01-sep). Solo con eso la demo actual ya debería parecerse al
   canvas mucho más de lo que se parece hoy, **sin tocar una pantalla**. Es
   un cambio chico, de alto impacto, y se puede desplegar antes que el resto
   detrás del flag.
2. **La verificación por sesión compara contra tres capturas**, no dos: la
   del canvas (`semilla/canvas/capturas/`), la del prototipo de Lovable y la
   del producto (`CAPTURAS_DISENO=./capturas-v4 npm run test:e2e:v3`), a 390 y
   1360.

El resto (ramas `feat/rediseno-lovable-NN-…`, `FLUJO_V3`, cadena de
`POLITICA_DE_DESPLIEGUE.md`, e2e de v2 intacta, Bitácora) no cambia.

---

## 6. Riesgos nuevos

| Riesgo | Señal | Acción |
| :--- | :--- | :--- |
| Lovable lee la capa 1 del CSS y sale rojo/Archivo | Botones rojos, títulos en Archivo, esquinas rectas | Prompt: «Leíste la capa 1. La que se ve es la capa 2, al final de `canvas-estilos.css`. Rehacé con DM Sans, naranja y radios 8/12/16 según `canvas-reglas-visuales.md` §2». |
| Lovable copia los datos del canvas (`PROP-00018425`, `Ana María González Ramírez`, `4.123.456`, contactos) | Aparecen en la vista previa | Corregir a los ficticios del Knowledge; revisar `canvas-textos.md` para saber cuáles son datos y cuáles textos. |
| Lovable interpreta el `{{ }}` como texto literal | Llaves visibles en pantalla | Señalar `canvas-logica.js` y la variable concreta. |
| El canvas cambia en claude.ai después de esta extracción | Andres edita el artefacto | Re-extraer (§1.2) y actualizar `docs/canvas/` en Lovable **antes** de seguir; anotar la fecha en la Bitácora. |
| Se «corrige» el producto hacia el canvas en las divergencias legales | Beneficiario con cédula/fecha/celular; FIPF mal nombrado; contactos inventados | Adenda §E es la lista cerrada; `higiene-de-citas.test.ts` y `declaraciones-p6.test.ts` la vigilan. |

---

## 7. Fuentes de esta versión

- Artifact «Seguro lo tengo: Flujo de 3 pasos» ce0c8332 (HTML publicado, leído el 01-sep-2026).
- `src/app/canvas-v3.css`, `src/app/globals.css`, `docs/BITACORA.md` (01-sep (b)–(g)), `docs/ESPECIFICACION_PANTALLAS.md` (29-ago), `docs/plan/IMPORTACION_DISENO_3_PASOS.md`.
- Documentación de Lovable citada en la guía v1 §9 (sin cambios).
