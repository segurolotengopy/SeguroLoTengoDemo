# Reglas visuales del canvas (medidas sobre el HTML publicado, 01-sep-2026)

Estas son las constantes que **realmente** dibujan el canvas. Salieron de
contar los estilos inline y las dos capas de CSS del artefacto, no de
memoria. Lovable las tiene que respetar al reproducir cada pantalla, y Claude
Code al portar.

## 1. La cascada: qué gana

| Capa | Dónde | Qué fija | Estado |
| :--- | :---- | :------- | :----- |
| 1 · Modernist | primer `<style>` | Archivo 800, acento `#ec3013`, radios 0, fondo `#f3f2f2`, `.btn/.input/.card…` base | **Base, tapada** |
| 2 · SeguroLoTengo | último `<style>` | DM Sans 600, acento `#e2660f` / `#bd550f`, radios 8/12/16, fondo `#fafafa`, divisor `#e0e0e0`, foco azul `#2b5a9e`, `.btn` 44 px r12, `.input` r10, etiquetas mayúsculas, `data-falta`, tema noche | **La que se ve** |
| 3 · inline | atributos `style=""` del HTML | radios de tarjeta, tamaños, kickers, superficies, rejillas, recortes de foto | **La que se ve** |

`src/app/canvas-v3.css` del repo copió la capa 1 y nada más. Eso es el
origen del «v3 se ve MALO».

## 2. Tokens vigentes (capa 2)

```
--font-heading / --font-body : 'DM Sans'   --font-heading-weight: 600   --font-mono: 'Geist Mono'
--color-bg #fafafa   --color-surface #ffffff   --sup #ffffff (superficie de tarjeta)
--color-text #333333   --color-divider #e0e0e0
--color-accent #e2660f   -100 #fdf4ec   -200 #fbe3cd   -300 #f0a264   -600 #bd550f   -700 #98450e
--color-neutral-100 #f4f2ef  -200 #f0eeea  -300 #e0e0e0  -400 #a5a4a0  -500 #6b6b6b  -600 #6b6b6b  -700 #474747  -800 #333333  -900 #1a1a1a
--radius-sm 8px   --radius-md 12px   --radius-lg 16px
--azul #2b5a9e   --verde #8dc63f   --verde-600 #55811d
```

Tema noche (`data-tema="noche"` en el contenedor raíz, no en `<html>`):
`--sup #1e1e1e`, `--color-bg #141414`, `--color-text #f4f2ef`,
`--color-divider #333333`, neutrales invertidos, `--color-accent #e2660f`,
`--color-accent-600 #e2660f`, `--color-accent-700 #f0a264`,
`--color-accent-100 #3a1c08`, `--color-accent-200 #4a2409`.
(En el producto el atributo es `data-tema="oscuro"` en `<html>`; el nombre
del valor es lo único que cambia.)

Equivalencias con los tokens del producto: `--color-accent` = `naranja-500`,
`--color-accent-600` = `naranja-600`, `--color-accent-700` = `naranja-700`,
`--color-accent-100/200/300` = `naranja-50/100/300`, `--azul` = `azul-600`,
`--verde` = `verde-400`, `--color-bg` = `hueso-50`, `--color-divider` =
`hueso-200`, `--color-text` = `hueso-900`, neutrales 500/700/800 =
`hueso-600/800/900`. **No hay ningún color del canvas que no exista ya en
`globals.css`**: el porteo es de dibujo, no de paleta.

## 3. Componentes (capa 2)

- `.btn`: `min-height 44px`, `padding 11px 20px`, `border-radius 12px`,
  DM Sans 600, centrado. `.btn-primary` fondo `accent-600`, texto blanco,
  hover `accent-700`. `.btn-secondary` fondo `--sup`, borde y texto
  `accent-600`, hover fondo `accent-100`. `.btn-ghost` borde `divider`,
  texto `neutral-700`, hover fondo `neutral-100` y texto `accent-700`.
- `.input`: `min-height 44px`, `padding 9px 12px`, `border-radius 10px`,
  borde `divider`, fondo `--sup`; hover borde `neutral-400`; foco borde y
  anillo `--azul`.
- `.field > label`: 11 px, mayúsculas, `letter-spacing 0.06em`, 600,
  `neutral-500`. Si falta: color acento y ` *` al final.
- `[data-falta="1"]`: borde 2 px acento, fondo `accent-100`, anillo
  `accent-200`, y `::before` con «* TE FALTA ESTO» 10.5 px / 0.09em / 700.
  `.pulso` anima el anillo dos veces al pedir «Mostrame qué me falta».
- Casillas y radios nativos con `accent-color: accent-600`.

## 4. Dibujo inline (lo que más pesa)

| Elemento | Valor |
| :--- | :--- |
| Contenedor | `max-width 1360px`, `padding 0 24px` |
| Cabecera | bloques `flex 1 1 260px`; isologo 38 × 38; kicker 9.5 px / 0.1em / 700 / `accent-700`; nombre 12.5 px 600; referencia 10.5 px `neutral-600`; botón de tema `.btn-ghost` 12 px |
| Stepper | rejilla `repeat(3,1fr)` a lo ancho, cada paso `padding 12px 0`, `border-top 3px` (acento el actual, verde el cumplido, divisor el pendiente); número 700; rótulo 0.04em; ✓ al cumplir |
| Tarjeta | `border 1px solid divider`, `border-radius 16px`, fondo `--sup`, `padding 20px` (14–18 px en tarjetas chicas) |
| Tarjeta chica / chip / modal interior | `border-radius 12px` |
| Kicker de sección | 10.5 px / `letter-spacing 0.09em` / 700 / `accent-700`, mayúsculas |
| Título de pantalla | `clamp(26px,4vw,36px)`, 700, `-0.02em`, `margin 10px 0 8px` |
| H1 bienvenida | `clamp(34px,5vw,58px)`, 700, `line-height 1.04`, `-0.02em`, `max-width 18ch` |
| Título de sección | 15–17 px 700 |
| Cuerpo | 13–13.5 px, `line-height 1.5–1.55`, `neutral-700` |
| Ayuda / leyendas | 12–12.5 px `neutral-500/600` |
| Medida de texto | `max-width 52ch / 54ch / 60ch / 66ch` |
| Foto de paso | `height clamp(140px,20vw,210px)`, `object-fit cover`, `object-position center 35%` (pasos), `40%` (carrusel), `45%` (cierre), `border-radius 16px` |
| Carrusel inicio | `aspect-ratio 16/9`, cuatro `<div>` en `grid-area 1/1`, `transition opacity .7s`, rótulo `accent` blanco 700 `clamp(15px,2vw,25px)` `padding 10px 18px` abajo a la izquierda; cuatro puntos indicadores 4 × 22 px |
| Rejillas | `repeat(auto-fit, minmax(N,1fr))` con N = 220 (planes, coberturas, datos), 230, 330 (declaraciones), 430 (beneficiario), 190 (tarjeta), 150; `gap 10–14px` |
| Píldora flotante | fondo `accent-600`, blanco, 700, `border-radius 999px`, sombra `--shadow-lg`, flecha con `@keyframes baja` |
| Sombras | solo en píldora y modales (`--shadow-lg`); tarjetas sin sombra |
| Modal Bancard | fondo exterior `#20262e`, barra `#151a20`, radio 16, contenido `--sup`; `max-width 560px` |
| Estados de captura | borde `1px dashed neutral-400` pendiente → `2px solid accent` aprobada |
| Enlaces | `accent-600` subrayados, `text-underline-offset 2px`, hover `accent-700` |

## 5. Lo que el canvas NO es

- No es Archivo, no es rojo, no tiene esquinas rectas: eso es la base
  Modernist tapada por la capa 2.
- No usa `.card` de la capa 1 (0 ocurrencias): las tarjetas son `<div>` con
  estilo inline.
- No tiene sombras en tarjetas.
