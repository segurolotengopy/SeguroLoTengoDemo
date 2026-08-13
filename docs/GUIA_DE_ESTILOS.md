# Guía de estilos — SeguroLoTengo

Identidad visual del portal, alineada al sitio institucional
**interseguros360.com** y a las marcas de las dos entidades del producto:
**Interseguros S.A.** (corredor, dueño de la marca SeguroLoTengo) y
**Alianza Garantía Seguros y Reaseguros S.A.** (aseguradora).

Esta guía es la fuente de verdad de **colores, tipografía y uso de marcas**.
La estructura, textos y campos de cada pantalla siguen mandando en
`docs/ESPECIFICACION_PANTALLAS.md`. La paleta descripta acá **reemplaza por
decisión de producto** a la descripta en la sección "Elementos comunes" de esa
especificación (no hay obligación legal involucrada: no existe fila en la
matriz de cumplimiento sobre colores).

---

## 1. Origen de la paleta

Los valores se midieron sobre los estilos computados de interseguros360.com
(agosto 2026):

| Rol en el sitio | Valor medido | Uso |
| :---- | :---- | :---- |
| `--primary` | `hsl(24 85% 40%)` = `#bd550f` | Naranja primario: botones, acentos |
| `--primary-deep` | `hsl(24 85% 42%)` ≈ `#c65910` | Hover del primario |
| `--foreground` | `#333333` | Texto principal |
| Texto secundario | `#474747` / `#6b6b6b` | Cuerpo y rótulos |
| `--background` | `#fafafa` | Fondo de página |
| `--border` | `#e0e0e0` | Bordes y filetes |
| `--warm-gray` | ≈ `#f4f2ef` | Superficies suaves |
| Tipografía | **DM Sans** | Toda la interfaz |

A eso se suman los colores de los isologos aportados por las marcas:

| Marca | Color | Hex |
| :---- | :---- | :---- |
| Interseguros — cápsula del isologo | naranja vivo | `#e2660f` |
| Interseguros — "I" del isologo | **calada** (transparente: toma el fondo) | — |
| Alianza — chevrón | azul institucional | `#2b5a9e` |
| Alianza — triángulo | verde manzana | `#8dc63f` |

> Los hex de los isologos están estimados a partir de los archivos de marca
> provistos. Si Interseguros o Alianza entregan su manual de marca con códigos
> Pantone/hex oficiales, ajustarlos acá y en `src/app/globals.css`,
> `src/components/shared/marcas.tsx`, `public/marca/*.svg` y
> `src/documentos/layout.ts` (una sola sesión, todos juntos).

---

## 2. Escalas de color (tokens Tailwind)

Definidas en `src/app/globals.css` (`@theme`). Cada escala va de 50 (más
claro) a 950 (más oscuro). **No usar hex sueltos en las pantallas: siempre un
token.**

### `naranja` — Interseguros · acciones primarias y alertas

| Token | Hex | Uso típico |
| :---- | :---- | :---- |
| 50 | `#fdf4ec` | Fondos de bloque elegido/destacado |
| 100–300 | `#fbe3cd` → `#f0a264` | Bordes y fondos de aviso |
| **500** | **`#e2660f`** | **Naranja de marca (isologo), botones de acción** |
| **600** | **`#bd550f`** | **Primario del sitio: hover, estados profundos, texto naranja** |
| 700–950 | `#98450e` → `#371806` | Texto sobre fondos naranjas claros |

### `azul` — Alianza Garantía · institucional

| Token | Hex | Uso típico |
| :---- | :---- | :---- |
| 50–200 | `#f0f5fb` → `#b9d0e9` | Fondos institucionales suaves |
| **600** | **`#2b5a9e`** | **Azul de marca (isologo): nombres de entidad, énfasis institucional** |
| 700–950 | `#254a80` → `#111f34` | Texto azul sobre claro / fondos oscuros |

### `verde` — Alianza · confirmaciones y seguridad

| Token | Hex | Uso típico |
| :---- | :---- | :---- |
| 50 | `#f6faec` | Fondo de franjas de confirmación |
| **400** | **`#8dc63f`** | **Verde de marca (isologo): íconos, indicadores** |
| 600–700 | `#55811d` / `#436519` | Texto verde con contraste AA sobre claro |

### `rojo` — bloqueos (sin cambios)

Escala previa intacta: `rojo-500 #d33636`, `rojo-600 #b32424`, etc.

### `hueso` — neutros del sitio

Conserva el nombre histórico, pero hoy es la escala de grises del sitio:
`50 #fafafa` (fondo), `100 #f4f2ef` (superficie suave), `200 #e0e0e0`
(bordes), `600 #6b6b6b` (rótulos), `800 #474747` (cuerpo), `900 #333333`
(títulos), `950 #1a1a1a`.

### Tokens semánticos (los que cambian con el tema)

Para estructura usar **siempre** los semánticos: `bg-fondo`, `bg-superficie`,
`bg-superficie-suave`, `border-borde-sutil`, `border-borde-tenue`,
`text-titulo`, `text-cuerpo`, `text-etiqueta`.

| Token | Claro | Oscuro |
| :---- | :---- | :---- |
| fondo | `#fafafa` | `#141414` |
| superficie | `#ffffff` | `#1e1e1e` |
| superficie-suave | `#f4f2ef` | `#262626` |
| titulo | `#333333` | `#f4f2ef` |
| cuerpo | `#474747` | `#cfcecb` |
| etiqueta | `#6b6b6b` | `#a5a4a0` |

El tema oscuro es grafito neutro (espejo del claro, que es gris y no azul);
contrastes verificados ≥ 4.5:1 (WCAG AA). Los acentos de marca no cambian con
el tema; para bloques de acento usar la escala con su variante `dark:`
explícita, como siempre.

Referencia visual viva: `/design-system`.

---

## 3. Tipografía

| Uso | Fuente | Dónde se define |
| :---- | :---- | :---- |
| Toda la interfaz | **DM Sans** (Google Fonts, `next/font`) | `src/app/layout.tsx` → `--font-dm-sans` |
| Códigos, OTP, hashes | **Geist Mono** | `--font-geist-mono` |
| PDFs (Solicitud/FIPF) | **Helvetica / Helvetica-Bold** | `src/documentos/pdf.ts` |

Los PDF siguen en Helvetica a propósito: el generador propio usa las fuentes
estándar del lector para no embeber archivos de fuente (determinismo y peso).
DM Sans y Helvetica son ambas palo seco de proporciones parecidas; la marca no
se resiente.

Jerarquía en pantalla (sin cambios de tamaño respecto de lo ya construido):
títulos en `font-semibold`/`font-bold` + `text-titulo`; cuerpo regular +
`text-cuerpo`; rótulos `text-[10px]`–`text-xs` `uppercase tracking-wide` +
`text-etiqueta`.

---

## 4. Logos e isologos

Archivos en `public/marca/` (SVG, fondo transparente):

| Archivo | Contenido | Uso |
| :---- | :---- | :---- |
| `interseguros-isologo.svg` | Cápsula naranja con la "I" calada (versión 2026-08-12: esquina inferior derecha de radio mayor) | **Identificador base de SeguroLoTengo** |
| `alianza-isologo.svg` | Chevrón azul + triángulo verde | Marca de la aseguradora |
| `interseguros-logo.svg` | Isologo + "INTERSEGUROS / corredores y asesores" | Piezas horizontales (correos, materiales) |
| `alianza-logo.svg` | Isologo + "alianza garantía / SEGUROS Y REASEGUROS S.A." | Piezas horizontales |

En la app los isologos se renderizan **inline** desde
`src/components/shared/marcas.tsx` (`IsologoAlianza`, `IsologoInterseguros`)
— misma geometría que los SVG de `public/marca/` — para evitar peticiones de
red y parpadeo. La cabecera institucional (`HeaderInstitucional`) los muestra
en todas las pantallas: Alianza en el bloque "Aseguradora", Interseguros en el
bloque "Intermediario".

**Los cuatro SVG son recreaciones vectoriales** a partir de los archivos de
marca provistos (los logos con texto aproximan la tipografía original con DM
Sans). Cuando existan los vectores oficiales, reemplazar los archivos de
`public/marca/` **sin cambiar el nombre** y ajustar la geometría de
`marcas.tsx` y `src/documentos/layout.ts` para que coincidan.

### Reglas de uso

- **No recolorear**: los colores de marca no cambian con el tema claro/oscuro.
- **Área de respeto**: dejar alrededor de cada isologo un margen mínimo
  equivalente al 25 % de su lado.
- **Tamaño mínimo**: 16 px en pantalla, 12 pt en papel.
- No deformar, rotar, aplicar sombras ni encerrar en contenedores de color
  que compitan con la marca (el isologo de Interseguros va sobre blanco o
  sobre `bg-fondo`/`bg-superficie`).

### Favicon e identidad base

El **isologo de Interseguros sobre fondo blanco** es el identificador base de
SeguroLoTengo y es lo que se ve en el navegador:

- `src/app/icon.svg` — ícono SVG (fondo blanco explícito, igual en tema
  oscuro del navegador).
- `src/app/favicon.ico` — 32×32 generado píxel a píxel a partir de la misma
  geometría (script reproducible; no editar a mano).

---

## 5. Marcas en los documentos hacia el cliente

Todo documento que reciba la persona (Solicitud `PROP-`, FIPF `FIPF-`, y los
que se sumen) lleva **las dos marcas** en la cabecera: isologo de Alianza
junto al bloque "Aseguradora" e isologo de Interseguros junto al bloque
"Intermediario", ambos de 16 pt.

Implementación: los isologos se dibujan como **vectores nativos del PDF**
(`dibujarIsologoAlianza` / `dibujarIsologoInterseguros` en
`src/documentos/layout.ts`), con la misma geometría 100×100 de los SVG. No se
embeben imágenes: el generador propio no incrusta mapas de bits y los caminos
vectoriales producen siempre los mismos bytes, preservando el determinismo del
hash (regla inviolable #4).

La paleta del documento (constantes de `layout.ts`) es la misma de esta guía:
naranja `#bd550f` para secciones y firma del cliente, azul `#2b5a9e` para
entidades y valores, texto `#333333`, rótulos `#6b6b6b`, bordes `#e0e0e0`.

---

## 6. Forma y layout

Tomados de la referencia de estilo derivada del mockup (`Pantallas Sistema
Demo.pdf`), **conservando la paleta de esta guía** (la referencia traía la
paleta crema/azul del render del mockup; por decisión de producto los colores
son los de interseguros360.com). Definidos en `src/app/globals.css`:

| Token | Valor | Uso |
| :---- | :---- | :---- |
| `rounded-xl` | 16 px | tarjetas y paneles |
| `rounded-2xl` | 24 px | marcos exteriores |
| `max-w-pantalla` | 1400 px | contenedor de todas las pantallas: ancho, con poco desplazamiento vertical en escritorio |
| `min-h-tap` / `p-tap`… | 44 px | blanco táctil mínimo (WCAG 2.5.5) |
| `text-display/h1/h2/h3` | `clamp()` fluido 360→1456 px | títulos nuevos, sin media queries |

Base global (también en `globals.css`): cifras tabulares en todo el sistema
(los importes en guaraníes se alinean entre planes), `:focus-visible` con
anillo azul de 2 px, y `prefers-reduced-motion` respetado. La jerarquía se
construye con borde y color — sin sombras, salvo capas realmente flotantes.

El detalle completo de la referencia (escala tipográfica, patrones de
componente, estados por pantalla pendientes de especificar) está en los
archivos de análisis entregados por producto; lo incorporado acá es lo que
rige hoy en el código.

---

## 7. Qué no hacer

- No introducir hex sueltos en pantallas: token de escala o semántico.
- No redefinir cabecera/stepper/barra de plan por pantalla (siguen siendo
  componentes compartidos).
- No usar el naranja para estados de éxito ni el verde para acciones: naranja
  = acción/alerta, verde = confirmación/seguridad, rojo = bloqueo, azul =
  institucional.
- No mostrar los logos junto a datos sensibles enmascarados de forma que
  parezcan validación de la entidad (los sellos de verificación son otra
  cosa).
- No generar variantes de los isologos (monocromo, invertido) sin registrar
  la decisión en esta guía.
