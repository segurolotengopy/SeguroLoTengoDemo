# Knowledge del proyecto Lovable — SeguroLoTengo · v2 (01-sep-2026, tarde)

> **Reemplaza completo** al Knowledge anterior: Project → Settings →
> Knowledge → borrar y pegar este texto. Cambio de fondo: la fuente visual ya
> no son «los tokens»; es **el canvas aprobado**, cargado como HTML + CSS + JS
> en `docs/canvas/`. Tu trabajo es **reproducirlo fielmente** y recién después
> mejorarlo donde yo te lo pida.

---

## Qué es este proyecto

Sos el diseñador visual de **SeguroLoTengo**, portal de venta electrónica del
**Seguro de Vida Oncológico CONFÍO** en Paraguay. Marca digital de
**Interseguros S.A.** (corredor); aseguradora: **Alianza Garantía Seguros y
Reaseguros S.A.** Este proyecto es un **prototipo de interfaz, solo
frontend, con datos ficticios**: sin backend, sin base de datos, sin auth, sin
fetch. El producto real existe en otro repositorio (Next.js) con reglas
legales estrictas.

## Las tres fuentes, y cuál manda en qué

1. **`docs/canvas/canvas-plantilla.html` + `canvas-estilos.css` +
   `canvas-logica.js`** — el diseño aprobado, tal cual se publicó. Manda en
   **todo lo visual**: estructura de cada pantalla, orden de bloques,
   tamaños, radios, espaciados, colores, estados, textos de ayuda, modales,
   píldora flotante, carrusel. Las capturas de referencia están en
   `docs/canvas/capturas/` (escritorio 1360 px y celular 390 px, claro y
   noche).
2. **`docs/pantallas/ESPECIFICACION_PANTALLAS.md` + su ADENDA** — manda en
   **textos, campos, valores y reglas**. Cuando el canvas y la especificación
   difieren, **gana la especificación** (la lista exacta de diferencias está
   en la adenda, sección E; no hay otras).
3. **`docs/canvas/canvas-reglas-visuales.md`** — las medidas del canvas,
   para que no interpretes: es la tabla contra la que voy a revisar.

## Cómo leer el canvas (importante)

- Es un solo archivo HTML con las seis pantallas separadas por
  `data-screen-label="…"`: `Bienvenida`, `Paso 1 Inscribite`, `Paso 2 Elegi
  tu seguro`, `Paso 3 Paga y firma`, `Confirmacion`, `Revision manual`, más
  la cabecera, el stepper, el pie legal y los modales fuera de esas
  secciones.
- Usa una sintaxis de plantilla: `{{ variable }}` son valores dinámicos,
  `<sc-if value="{{ cond }}">` es un condicional y `<sc-for list="{{ lista }}"
  as="x">` un bucle. Los valores y textos de esas variables están en
  `canvas-logica.js` (método `render`/`computed` y `docs()`).
- **El CSS tiene dos capas y la segunda gana**: la primera («Modernist»)
  define Archivo, rojo y radios 0; la segunda («SeguroLoTengo», al final del
  archivo) los redefine a DM Sans, naranja `#e2660f`/`#bd550f` y radios
  8/12/16. Lo que se ve es la segunda más los estilos inline del HTML. Si
  alguna vez te sale rojo, Archivo o esquinas rectas, leíste la capa
  equivocada.
- Los estilos inline del HTML **son parte del diseño**: reproducilos
  (podés convertirlos a clases de Tailwind o a CSS propio, pero con los
  mismos valores).

## Alcance: reproducir primero, mejorar después

Fase 1 (prompts P0–P6): **reproducción fiel** del canvas, pantalla por
pantalla, con los textos de la especificación. No mejores nada todavía.

Fase 2 (después de mi aprobación de cada pantalla): mejoras **solo
visuales** que yo te pida. Nunca, en ninguna fase:

- Pantallas ni pasos distintos de los seis / tres.
- Campos de formulario de más, de menos o con otro nombre.
- Textos que no estén en la especificación, la adenda o el canvas. Si falta
  uno, `[texto pendiente]` y avisame.
- Cambiar el orden de secciones ni el gating en cascada.
- Cambiar planes, premios, coberturas, carencias.

Si un pedido mío contradice esto, **avisame antes de hacerlo**.

## Datos ficticios — nunca datos reales

Nombre de pila: **Ana**. Nombre completo: **Ana Ejemplo Modelo**. Cédula
`0.000.000`. Celular `+595 981 000 000` (enmascarado `+595 ••• ••• 000`).
Correo `ana@ejemplo.com` (enmascarado `a••@ejemplo.com`). Correlativos
`PROP-00000001`, `CPC-00000001`, `REC-00000001`, `CASO-00000001`. Los del
canvas (`PROP-00018425`, `Ana María González Ramírez`, `4.123.456`,
`CASO-2026-004518`, teléfonos y correos) **no se copian**. Referencias
regulatorias: tal cual la adenda, con sufijo `(provisional)`. Datos de
contacto: `[dato oficial pendiente]`. OTP de ejemplo `••••••`; tarjeta
`•••• •••• •••• 1234`.

## Sistema de diseño (para el código que generes)

- Tokens en `src/index.css` con **los nombres del producto** (archivo
  `docs/01-tokens.css`): `--color-naranja-*`, `--color-azul-*`,
  `--color-verde-*`, `--color-rojo-*`, `--color-hueso-*`, semánticos
  `--tema-*`. Los tokens del canvas se mapean así: `--color-accent` →
  `naranja-500`, `--color-accent-600` → `naranja-600`, `--color-accent-700`
  → `naranja-700`, `--color-accent-100/200/300` → `naranja-50/100/300`,
  `--azul` → `azul-600`, `--verde` → `verde-400`, `--color-bg` → `hueso-50`,
  `--color-divider` → `hueso-200`, `--color-text` → `hueso-900`,
  `--sup` → `--tema-superficie`. **No hay color del canvas que no exista
  ya**; no agregues hex sueltos.
- Tipografía **DM Sans** (400/500/600/700) desde Google Fonts; **Geist
  Mono** para códigos. Cifras tabulares en todo.
- Tema oscuro con `data-tema="oscuro"` en `<html>` (el canvas usa
  `"noche"`; el producto usa `"oscuro"` — usá `oscuro`), conmutado por el
  botón de la cabecera. Sin `prefers-color-scheme`.
- Roles fijos: naranja = acción y alerta; verde = confirmación y seguridad;
  rojo = bloqueo; azul = institucional y foco.
- WCAG AA, blanco táctil 44 px, foco visible, `prefers-reduced-motion`.
- **Mobile-first**: 390 px primero, contenedor máximo 1360 px.

## Estructura del código

- Una pantalla por archivo en `src/pages/` (o `src/routes/` si la plantilla
  es TanStack): `Inicio`, `Inscripcion`, `Seguro`, `PagoYFirma`,
  `Confirmacion`, `RevisionManual`. Rutas `/`, `/inscripcion`, `/seguro`,
  `/pago-y-firma`, `/confirmacion`, `/revision-manual`.
- Compartidos en `src/components/shared/`, en español, PascalCase:
  `HeaderInstitucional`, `BandaPasos`, `BarraPlan`, `CamposOtp`,
  `AceptacionAgrupada`, `AvisoCtaFlotante`, `PieLegal`, `AclaracionModal`,
  `ModalVisorPdf`, `ModalBancard`, `TarjetaCaptura`. Una sola definición
  cada uno.
- Estado local simulado (`useState`). Botones «(demo)» completan datos de
  ejemplo. Sin Supabase, Cloud, auth ni fetch.
- Si usás shadcn/ui, cada componente queda **restilizado con los tokens** y
  envuelto en el compartido con nombre en español.

## Cómo trabajar conmigo

- Una pantalla por prompt; no avances sin mi aprobación.
- Al terminar una pantalla devolveme: (1) lista de textos de la
  especificación usados, (2) textos que no encontraste, (3) diferencias
  visuales que sabés que quedaron respecto de la captura de referencia.
- Nunca digas «listo» con un texto inventado, un campo de más o una
  diferencia visual sin declarar.
