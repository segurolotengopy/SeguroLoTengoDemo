# Análisis visual de los 103 artes del handoff v4

**Qué es esto.** Una lectura arte por arte de los **103 PNG** de
`docs/v4/SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14/assets/screens/`
(81 `APROBADA_FINAL` + 22 `CANDIDATA`), hecha para que la implementación tenga
**exactamente la misma apariencia**: posiciones, tamaños relativos, íconos y
emojis, textos literales, contenido de los desplegables y estados.

**Qué no es.** No reemplaza al `MANUAL_FUNCIONAL_TRANSCRIPCION.txt`, que por
D-28 manda sobre el arte cuando hay conflicto, ni a `ANALISIS.md`, que registra
qué se adopta y qué choca. Acá se describe **lo que el PNG muestra**; donde el
arte contradice al manual o a una regla inviolable, se marca con ⚠ y se remite
al conflicto correspondiente.

**Cómo leerlo.** Cada arte lleva su `screen_code`, `state_code` y
`original_filename` —la terna de trazabilidad que exige la nota de
programación— y las medidas se dan **en proporción del ancho del lienzo**, no
en píxeles del PNG: los artes vienen en tres tamaños de maqueta distintos
(1103×1426, 941×1671, 853×1846) y todos son mockups dentro de un marco de
iPhone, así que el píxel del PNG no es el píxel de la pantalla.

---

## 0. Lo que es igual en todos los artes

### 0.1 El marco

Todos los PNG son **una maqueta de iPhone sobre fondo blanco roto**: marco
negro con borde redondeado, isla dinámica, barra de estado con `9:41` a la
izquierda (en azul marino, no negro) y señal/wifi/batería a la derecha, y la
barra de gesto inferior. **Nada de eso se implementa** — es el envoltorio de
presentación. Lo que se implementa es el contenido del recorte.

### 0.2 Cabecera institucional

Dos variantes, y la diferencia es normativa, no estética (regla de marcas de
`screens.json`: `cover_brands: 2`, `contracting_brands: 3`):

| Variante | Dónde | Contenido |
| :-- | :-- | :-- |
| **Dos marcas** | Portada 01 y sus modales 01A, 01B | ☰ · `seguroOLOtengo` + `canal digital` · separador vertical fino · isologo INTERSEGUROS + `intermediario` |
| **Tres marcas** | 01C, 01D, 01E y todo el flujo de contratación | ☰ · `seguroOLOtengo` + `canal digital` · separador · INTERSEGUROS + `intermediario` · separador · `alianza garantía` + `aseguradora` |

Detalles que se reproducen tal cual:

- El logotipo es **una sola palabra**, `segur` + `OLO` + `tengo`, donde las dos
  «O» son **anteojos rojos** unidos por un puente y la `L` va dentro; el resto
  del texto en azul marino `#071F78`, en minúsculas y peso bold.
- Bajo el logotipo, `canal digital` centrado, tamaño ~40 % del logotipo, en
  azul marino, con **tracking abierto**.
- El rótulo bajo cada marca (`intermediario`, `aseguradora`) va en versalitas
  pequeñas, gris azulado, centrado bajo su logo.
- El ☰ es de **tres líneas**, azul marino, a la izquierda del todo.
- Al abrirse un modal, la cabecera **queda visible y se atenúa** (velo gris),
  salvo en 01B (menú), donde el panel la tapa.

### 0.3 Paleta y tipografía

`#071F78` navy (títulos, logotipo, rótulos) · `#FF1721` rojo (CTA principal,
acentos del logotipo y de las ilustraciones) · `#0876F9` azul (enlaces, bordes
de tarjetas informativas) · `#55709D` azul apagado (texto de cuerpo secundario)
· blanco. Tipografía **Nimbus Sans** en el arte; por D-39 se implementa con una
libre equivalente. Cuerpo mínimo 16 px (`layout_contract.body_min_font_px`).

### 0.4 Patrón de modal (01A, 01C, 01D, 01E y todos los «detalle»)

Hoja blanca que sube desde abajo y ocupa **todo el ancho menos ~2 %** por lado,
con:

1. **Filete rojo** `#FF1721` de ~4 px pegado al borde superior de la hoja, de
   lado a lado. Es la firma visual del modal; ninguna otra superficie la lleva.
2. Título en navy bold ~26 px, a la izquierda, y **botón ✕ circular** a la
   derecha, a la misma altura: círculo con borde azul `#0876F9` de 1 px, fondo
   blanco, aspa azul.
3. Bajada de una línea en `#55709D` regular, debajo del título.
4. **Regla horizontal** fina gris azulado de margen a margen.
5. Las tarjetas de contenido: fondo azul muy claro (~`#F2F7FE`), borde
   `#0876F9` a 1 px, radio ~10 px, título navy bold y cuerpo en `#55709D`.
   Separación entre tarjetas ≈ ancho del borde ×8.
6. El resto de la hoja queda **en blanco** hasta el borde inferior; las
   tarjetas no se estiran para llenarla.

---

## 1. Grupo 01 · Portada y catálogo de productos

Etapa: **sin stepper** (la portada y sus modales quedan fuera de las 5 etapas).

### 1.1 `01` / `portada-y-catalogo-de-productos` — `PANTALLA_01_APROBADA_FINAL.png` ✅ APROBADA_FINAL

Cabecera de **dos marcas**. De arriba abajo:

1. **Bloque héroe** (ocupa ~30 % del alto):
   - Titular en dos líneas, alineado a la izquierda, ~34 px bold:
     `Tu seguro,` en navy / `fácil y rápido` en **rojo**.
   - Bajada en dos líneas, `#55709D` regular ~19 px:
     `Elige tu producto y` / `contrata de forma simple.` ⚠ está en **tuteo
     castellano** («Elige», «contrata»); por D-35 se pasa a voseo
     («Elegí tu producto y contratá de forma simple»).
   - **Ilustración a la derecha**, sobre una mancha ovalada azul clarísima:
     una mano sosteniendo un celular de línea azul marino, con un **escudo con
     tilde roja** en la pantalla y tres destellos rojos arriba a la izquierda y
     dos negros a la derecha. Estilo *line art* de 2 px, sin relleno.
2. **Tres atributos en fila**, separados por dos filetes verticales finos:

   | Ícono | Rótulo (navy bold, versalita) | Pie (`#55709D`) |
   | :-- | :-- | :-- |
   | Mano con dedo índice tocando, con tres destellos rojos | `DIGITAL` | `Todo en línea.` |
   | Cronómetro con aguja, tres líneas de velocidad rojas | `ÁGIL` | `En pocos pasos.` |
   | Escudo con tilde roja | `CONFIABLE` | `Datos protegidos.` |

   Los íconos van dentro de un **círculo azul clarísimo** y miden ~2,5 veces el
   cuerpo del rótulo. Los tres comparten línea de base.
3. **Onda decorativa** azul clarísima de lado a lado, que separa el héroe del
   catálogo.
4. **Catálogo**: título `Seguros para cada necesidad` (navy bold ~27 px) y
   bajada `Protege lo que más te importa.` (`#55709D`) ⚠ también en tuteo.
5. **Rejilla de 6 tarjetas, 2 columnas × 3 filas**, en este orden exacto:

   | | Izquierda | Derecha |
   | :-- | :-- | :-- |
   | Fila 1 | **Oncológico** — píldora verde `Disponible` | **Vida** — píldora gris `Próximamente` |
   | Fila 2 | **Accidentes** — `Próximamente` | **Salud** — `Próximamente` |
   | Fila 3 | **Mascotas** — `Próximamente` | **Viaje** — `Próximamente` |

   Cada tarjeta: fondo blanco, borde gris azulado 1 px, radio ~10 px, y tres
   zonas — **ícono de línea** a la izquierda (cinta/roseta para Oncológico,
   corazón para Vida, persona con brazo en cabestrillo para Accidentes,
   estetoscopio para Salud, huella de perro para Mascotas, maleta con avión
   para Viaje), **nombre + píldora de estado** al centro, **chevron `›`** a la
   derecha.
   - La tarjeta **Oncológico** es la única con **fondo azul clarísimo** y
     **borde azul**: es la activa. Su píldora es verde claro con texto verde
     oscuro; las otras cinco, píldora gris con texto gris.
   - Las cinco «Próximamente» se ven **atenuadas** (nombre en gris azulado, no
     navy) y no son pulsables.
6. Enlace centrado `Información legal`, azul `#0876F9` **subrayado**.
7. **Banner de cookies** anclado abajo, en tarjeta de fondo azul clarísimo con
   borde azul: cuatro líneas de texto en `#55709D`
   (`Usamos cookies necesarias para que el sitio web y su trámite funcionen
   correctamente. También utilizamos cookies analíticas de Google Analytics
   para medir el uso del sitio y mejorar su funcionamiento. No utilizamos
   cookies de publicidad.`) y **dos botones en fila**, de igual alto:
   `VER EL DETALLE` (fondo blanco, borde azul marino, texto navy) y
   `HE LEÍDO Y ENTENDIDO` (fondo rojo `#FF1721`, texto blanco). El rojo ocupa
   ~52 % del ancho y va a la derecha. Ambos en versalitas, con tracking.

   ⚠ El banner **no ofrece rechazar la analítica**: es un «he leído y
   entendido», no un consentimiento con opción de negativa. Es lo que muestra
   el arte y lo que dice el manual; queda anotado como punto para Legal.

### 1.2 `01A` / `detalle-cookies` — `PANTALLA_01A_DETALLE_COOKIES_APROBADA_FINAL.png` ✅

Modal sobre la portada atenuada (patrón §0.4), que arranca a ~27 % del alto y
**no llega al borde inferior**: el banner de cookies de la portada sigue
visible por debajo, sin atenuar. Título `Detalle de cookies`, bajada
`Información clara antes de continuar.`, y dos tarjetas:

| Título de tarjeta | Cuerpo |
| :-- | :-- |
| `Cookies necesarias` | `Permiten el funcionamiento del sitio, la seguridad del trámite y la continuidad de la contratación. Permanecen activas porque son indispensables.` |
| `Cookies analíticas` | `Usamos Google Analytics para medir el uso del sitio y mejorar su funcionamiento. No se usan para publicidad ni se envían señales publicitarias. La información analítica se conserva hasta 24 meses.` |

Sin casillas, sin interruptores y sin botones propios: se cierra con la ✕ y se
acepta desde el banner de la portada.

### 1.3 `01B` / `menu` — `PANTALLA_01B_MENU_APROBADA_FINAL.png` ✅

**Panel lateral izquierdo**, no modal centrado: ocupa ~80 % del ancho, va de
borde superior a borde inferior, esquina superior derecha e inferior derecha
redondeadas, y deja ver la portada atenuada en la franja derecha. Filete rojo
superior **solo sobre el ancho del panel**.

- Título `Menú` navy bold, ✕ circular azul a la derecha, regla fina debajo.
- Tres filas pulsables, separadas por reglas finas, cada una con rótulo en
  **versalitas navy bold** y chevron `›` gris a la derecha:
  `INICIO` · `RESPONSABILIDADES` · `CONTACTO`.
  Alto de fila ≈ 5 % del alto de pantalla; el texto arranca a ~7 % del ancho.
- El resto del panel queda vacío, y **al pie**: `SeguroLoTengo · canal digital de`
  / `Interseguros S.A.` en dos líneas (`#55709D`) y, debajo, el enlace
  `Información legal` azul subrayado.

### 1.4 `01B` / `confirmacion-salida` — `PANTALLA_01B_CONFIRMACION_SALIDA_APROBADA_FINAL.png` ✅

Se dispara desde `INICIO` del menú. **Diálogo centrado** (no hoja inferior)
sobre el menú, que a su vez queda atenuado con un velo azul grisáceo más denso
que el de los otros modales. Ancho ~70 % del lienzo, esquinas redondeadas,
filete rojo superior.

- Título **centrado** `¿Volver al inicio?` navy bold ~24 px.
- Cuerpo centrado en cuatro líneas, `#55709D`:
  `Si vuelve al inicio, se cerrará la sesión y se descartará todo el avance de
  esta contratación. Para continuar, deberá comenzar nuevamente.` ⚠ en usted;
  por D-35 pasa a voseo.
- **Dos botones apilados, ancho completo**, en este orden:
  1. `CONTINUAR CONTRATACIÓN` — blanco, borde navy, texto navy.
  2. `SALIR Y DESCARTAR` — rojo pleno, texto blanco.

  ⚠ La acción destructiva es la **roja**, que en todo el resto del producto es
  la CTA de avanzar. Se implementa como está (manda el arte), pero queda
  anotado.
- **Sin ✕**: solo se sale por uno de los dos botones.

### 1.5 `01C` / `responsabilidades` — `PANTALLA_01C_RESPONSABILIDADES_APROBADA_FINAL.png` ✅

Primer arte con cabecera de **tres marcas**. Modal alto (§0.4) que deja ver por
debajo los dos botones del banner de cookies. Título `Responsabilidades`,
bajada `Quién interviene y qué función cumple.`, y tres tarjetas:

| Título (navy bold, **versalitas**) | Cuerpo |
| :-- | :-- |
| `SEGUROLOTENGO` | `Es la marca y el canal digital de Interseguros S.A. mediante el cual se completa el proceso de contratación.` |
| `INTERSEGUROS S.A.` | `Es el corredor de seguros - Matrícula SIS N.° 118 - y el intermediario en la contratación. Brinda asistencia y seguimiento antes, durante y después de la emisión de la póliza.` |
| `ALIANZA GARANTÍA SEGUROS Y REASEGUROS S.A.` | `Es la aseguradora que emite la póliza, asume el riesgo, brinda la cobertura y paga las indemnizaciones cuando corresponde, conforme a las condiciones del seguro.` |

El tercer título, por largo, va en un cuerpo ~10 % menor y en una sola línea.
⚠ Acá la matrícula se escribe `N.°` y en 01D `N.º`: se unifica en **`N.º`**
(ANALISIS.md §4).

### 1.6 `01D` / `contacto` — `PANTALLA_01D_CONTACTO_APROBADA_FINAL.png` ✅

Título `Contacto`, bajada `Atención del intermediario.` Dos tarjetas:

1. `Canales oficiales` — `Para consultas, solicitudes, cambios, modificaciones
   o renovaciones de la póliza, comuníquese con Interseguros S.A.`
2. `INTERSEGUROS S.A.` (navy bold), con subtítulo `Corredor de Seguros ·
   Matrícula SIS N.º 118` y cuatro bloques **etiqueta navy bold + valor**:

   | Etiqueta | Valor |
   | :-- | :-- |
   | `WhatsApp oficial` | `+595 991 478 468` (navy bold, ~20 px) |
   | `Correo electrónico` | `segurolotengo@interseguros360.com` (navy regular) |
   | `Oficinas` | `Avda. Aviadores del Chaco 2351,` / `Edificio Plaza Center, 7.º piso, Asunción` (dos líneas, `#55709D`) |
   | — | `interseguros360.com` — enlace azul subrayado, al pie de la tarjeta |

   Separación entre bloques ≈ 1,5 líneas. ⚠ Estos datos de contacto deben
   cotejarse contra `src/domain/entidades.ts` antes de escribirlos: el test de
   higiene de citas pone la suite en rojo con datos de contacto inventados.

### 1.7 `01E` / `informacion-legal` — `PANTALLA_01E_INFORMACION_LEGAL_APROBADA_FINAL.png` ✅

Título `Información legal`, bajada `Todos los documentos y avisos en un solo
lugar.` Cuatro tarjetas **pulsables** (mismo estilo, sin chevron), más juntas
entre sí que en 01C:

| Título | Cuerpo |
| :-- | :-- |
| `Aviso de privacidad` | `Conozca cómo se usan y protegen sus datos personales.` |
| `Cookies` | `Consulte el detalle de las cookies necesarias y analíticas utilizadas por el sitio.` |
| `Responsabilidades` | `Identifique las funciones de SeguroLoTengo, Interseguros y Alianza Garantía.` |
| `Contacto` | `Acceda a los canales oficiales de Interseguros S.A.` |

⚠ Los cuatro cuerpos están en **usted**; por D-35 pasan a voseo («Conocé»,
«Consultá», «Identificá», «Accedé»).

### 1.8 `01` / `caratula-catalogo` — `PANTALLA_01_CARATULA_CATALOGO_CANDIDATA.png` ⛔ CANDIDATA

Es la **misma portada** que 1.1, píxel por píxel en el cuerpo. Las dos únicas
diferencias están en la cabecera:

- **No** lleva el separador vertical entre el logotipo y el isologo de
  Interseguros.
- El isologo de Interseguros lleva **una barra naranja debajo** que la versión
  aprobada no tiene.

Por la regla de release (`approved_for_development=false`) **no se implementa**:
manda 1.1, que es justamente la que quitó esa barra.

---

## 2. Grupo 02 · Selección de plan

Etapa **1 de 5** (así lo dibuja el arte; `main_stage` de `screens.json` dice
2 y **manda el arte**, ANALISIS.md §4).

> ⚠ **El producto se llama `VIVE` en todo este grupo**, y los planes son
> `VIVE`, `VIVE+` y `VIVE TOTAL`. `CLAUDE.md` y el código de hoy dicen
> **CONFÍO**. Es un cambio de marca comercial que llega con v4 y toca catálogo,
> PDF y textos legales; no se resuelve dentro de una pantalla.

### 2.1 El stepper (aparece por primera vez acá, y es igual en todo el flujo)

Franja bajo la cabecera, de ~4 % del alto:

- **Cinco puntos** en línea horizontal unidos por un filete de 2 px, ocupando
  desde el margen izquierdo hasta ~62 % del ancho.
- El punto **activo** es un disco rojo `#FF1721` de ~14 px; los cuatro
  restantes son discos grises claros de ~10 px. El tramo de filete entre el
  punto 1 y el 2 va en **rojo degradado a gris**; el resto, gris.
- A la derecha, alineado a la derecha del todo, el rótulo `1 de 5` en
  `#55709D`, tamaño de cuerpo. No lleva la palabra «Paso».

### 2.2 `02` / `seleccion-plan` — `PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png` ✅

Cabecera de tres marcas + stepper `1 de 5`. Contenido:

1. **Titular a dos líneas**, izquierda, ~32 px bold:
   `Seguro de Vida` (navy) / `Oncológico VIVE` (**rojo**). Debajo, en
   `#55709D` ~18 px: `Elija el plan que mejor se adapte a usted.` ⚠ usted →
   voseo (D-35).
   A la derecha, sobre mancha ovalada azul clarísima, **ilustración de tres
   escudos superpuestos**: el central grande con un **lazo de cáncer** dentro,
   el izquierdo con un **corazón**, el derecho con una **cruz médica**; tres
   destellos rojos arriba. Line art navy de 2 px con el lazo en azul.
2. **Tarjeta de video**, ancho completo, fondo azul clarísimo, borde azul,
   radio ~10 px, alto ~5 % de pantalla:
   - Círculo rojo pleno con **▶ blanco** a la izquierda.
   - `VIDEO INFORMATIVO` navy bold versalitas + debajo
     `Conozca el producto en 60 segundos` (`#55709D`). ⚠ usted → voseo.
   - Chevron `›` azul a la derecha.
3. **Pie de registro**, centrado, dos líneas, ~11 px, `#55709D`:
   `Producto inscrito: Seguro de Vida Individual con Indemnización Adicional
   por Diagnóstico de Cáncer · Código de Registro N.º 15-VI.0002 · Nota SS.SG.
   N.º 397/2026.`
4. **Tres tarjetas de plan**, apiladas, mismo ancho, borde azul claro, radio
   ~12 px. Cada una:
   - **Encabezado**: nombre del plan en navy bold ~26 px; debajo el precio en
     **rojo bold ~26 px** (`Gs. 390.000` / `Gs. 575.000` / `Gs. 760.000`) y, a
     su derecha y en la misma línea de base, `Premio total anual · IVA incluido`
     en `#55709D` ~15 px.
   - **Radio circular vacío** de ~34 px a la derecha del encabezado, alineado
     al centro vertical del bloque nombre+precio. Es el único control de
     selección: no hay botón «elegir» por tarjeta.
   - Solo `VIVE TOTAL` lleva, entre el nombre y el radio, la **píldora azul
     claro** `PLAN RECOMENDADO` con texto azul `#0876F9` en versalitas bold.
   - **Cuatro filas de cobertura**, separadas por reglas finísimas, con ícono
     de línea a la izquierda, concepto a la izquierda (`#55709D`) e importe a
     la derecha (navy bold):

     | Ícono | Concepto | VIVE | VIVE+ | VIVE TOTAL |
     | :-- | :-- | :-- | :-- | :-- |
     | lazo | `Diagnóstico de cáncer` | `Gs. 50.000.000` | `Gs. 75.000.000` | `Gs. 100.000.000` |
     | escudo | `Fallecimiento` | `Gs. 3.500.000` | `Gs. 5.000.000` | `Gs. 7.000.000` |
     | cama | `Renta Hospitalaria por Accidente` | `Hasta Gs. 500.000/día · Máx. 15 días` | `Hasta Gs. 750.000/día · Máx. 15 días` | `Hasta Gs. 1.000.000/día · Máx. 15 días` |
     | maletín médico | `Gastos Médicos por Accidente` | `Hasta Gs. 7.000.000` | `Hasta Gs. 10.000.000` | `Hasta Gs. 14.000.000` |
5. Enlace centrado, azul subrayado:
   `Ver coberturas, exclusiones y condiciones` → abre 02A/02B/02C.
6. **Tres fichas informativas en fila**, borde gris azulado, radio ~10 px,
   ícono de línea navy a la izquierda:

   | Ícono | Título (navy bold versalitas) | Cuerpo |
   | :-- | :-- | :-- |
   | busto de persona | `EDAD DE INGRESO` | `18 a 64 años` |
   | calendario | `CARENCIAS` | `Cáncer: 90 días` / `Renta: 1 dia` / `Gastos por accidente: 1 dia` / `Fallecimiento: sin carencia` |
   | reloj | `INICIO DE VIGENCIA` | `Al acreditarse el pago.` |

   ⚠ Dos erratas verificadas ampliando el arte: **`1 dia` sin tilde** en las
   dos líneas de renta y gastos (`90 días` sí la lleva). Se corrige a `1 día`.
   ⚠ `INICIO DE VIGENCIA` acá y `INICIO DE COBERTURA` en 02A: se unifica en
   **«Inicio de cobertura»**.
7. **Bloque de aclaración**, fondo azul clarísimo, borde azul, ícono **ⓘ**
   circular azul a la izquierda, texto en azul `#0876F9`:
   `ACLARACIÓN:` en bold + `Continuar con el plan seleccionado no implica, bajo
   ninguna circunstancia, la contratación del seguro, la firma de documentos,
   la emisión de la póliza o de la factura, el inicio de la cobertura ni la
   obligación de pagar la prima.` / (salto de párrafo) `Sin embargo, al
   presionar el botón «CONTINUAR» para avanzar a la siguiente pantalla,
   confirmo que he leído y comprendido toda la información presentada en la
   sección «Coberturas, exclusiones y condiciones».`
8. **CTA `CONTINUAR`** ancho completo, alto ~5 %, radio ~8 px, en **rojo
   pálido** (deshabilitado) con texto blanco: en este estado **no hay plan
   elegido**. Al elegir uno pasa a rojo pleno. ⚠ En 03B el deshabilitado se
   dibuja gris; se unifica en **un solo estado deshabilitado** del componente
   (ANALISIS.md §4).
9. Enlace centrado al pie: `Información legal`, azul subrayado.

### 2.3 `02A` / `coberturas` — `PANTALLA_02A_COBERTURAS_APROBADA_FINAL.png` ✅

Modal de altura casi total (patrón §0.4), título a una línea
`Coberturas, exclusiones y condiciones`, ✕ circular, regla fina, y **tres
pestañas en fila** de igual ancho, radio ~8 px:
`COBERTURAS` · `EXCLUSIONES` · `SINIESTROS`. La activa es **navy pleno con
texto blanco**; las inactivas, blancas con borde azul y texto navy. Acá la
activa es `COBERTURAS`. **No hay bajada** bajo el título en este modal.

Contenido de la pestaña (cuatro tarjetas):

1. **Tabla `MISMAS COBERTURAS · DISTINTAS SUMAS`** (título navy bold
   versalitas). Encabezado de columnas `VIVE` / `VIVE+` / `VIVE TOTAL` en navy
   bold, centrado; filas con el concepto a la izquierda en navy bold y los
   valores centrados en `#55709D`:

   | Concepto | VIVE | VIVE+ | VIVE TOTAL |
   | :-- | :-- | :-- | :-- |
   | `Diagnóstico de cáncer` | `50 M` | `75 M` | `100 M` |
   | `Fallecimiento` | `3,5 M` | `5 M` | `7 M` |
   | `Renta hospitalaria por accidente` | `Gs. 500.000/día` | `Gs. 750.000/día` | `Gs. 1.000.000/día` |
   | `Gastos médicos por accidente` | `7 M` | `10 M` | `14 M` |

   Entre la fila de renta y la de gastos hay una **franja de nota** a todo el
   ancho, centrada, ~12 px: `Internación mínima: 24 horas · Máximo: 15 días por
   vigencia.` Las líneas divisorias son finísimas y hay **separadores
   verticales** entre columnas.
2. `EDAD DE INGRESO Y PERMANENCIA` — `Ingreso: de 18 a 64 años. Permanencia:
   hasta los 75 años, cuando se hayan cumplido 10 años continuos de cobertura
   antes de los 65.`
3. `CARENCIAS` — `Cáncer: 90 días · Renta hospitalaria por accidente: 1 día ·
   Gastos médicos por accidente: 1 día · Fallecimiento: sin carencia.`
   (acá **sí** con tildes, a diferencia de 02).
4. `INICIO DE COBERTURA` — `La cobertura comienza al acreditarse el pago.`

El resto de la hoja queda en blanco.

### 2.4 `02B` / `exclusiones` — `PANTALLA_02B_EXCLUSIONES_APROBADA_FINAL.png` ✅

Mismo modal con la pestaña **`EXCLUSIONES`** activa. El lienzo es más alto
(858×1832): el contenido **desborda y se desplaza**, y el arte dibuja una
**barra de desplazamiento azul** a la derecha, pegada al borde interno del
modal, con el pulgar arriba. Cuatro tarjetas con título navy bold versalitas y
**lista con viñetas redondas** en `#55709D`:

**`FALLECIMIENTO`**
- `Enfermedades, lesiones o dolencias preexistentes conocidas o diagnosticadas antes del inicio.`
- `Carreras, competencias hípicas, pruebas de rendimiento o de prototipos.`
- `Operaciones subacuáticas o aéreas, salvo como pasajero de transporte regular.`
- `Guerra y riesgos nucleares.`
- `Suicidio o tentativa de suicidio. Esta exclusión no se aplica cuando ocurre en circunstancias que excluyen la voluntad del asegurado.`
- `Empresa criminal, pena de muerte y uso de motocicletas o similares.`

**`DIAGNÓSTICO DE CÁNCER`**
- `Diagnóstico que no sea cáncer o sin respaldo anatomopatológico e histológico.`
- `Cáncer detectado durante la carencia o antes del inicio del seguro.`
- `Contaminación nuclear, actividades o enfermedades ocupacionales.`
- `Enfermedad preexistente conocida.`
- `Cáncer de piel, excepto melanoma maligno.`
- `Carcinoma in situ, estadio 0, lesiones precancerosas o cáncer derivado de guerra.`

**`RENTA HOSPITALARIA POR ACCIDENTE`**
- `Aplican las exclusiones de la cobertura principal.`
- `Accidente sin hospitalización, atención solo en urgencias o tratamiento ambulatorio.`
- `Tratamiento por familiares hasta segundo grado.`
- `Accidentes causados por culpa grave del asegurado cuando se encuentre bajo los efectos del alcohol.`
- `Intento de suicidio.`
- `Trastornos mentales, nerviosos, seniles, psiquiátricos o condiciones congénitas.`
- `Tratamientos estéticos, plásticos o reconstructivos, salvo función reparadora por un evento cubierto.`
- `Tratamientos derivados del consumo de alcohol, tabaco o drogas.`
- `Alopecia, obesidad, reducción de peso o corrección refractiva.`

  Cierra con un **recuadro gris claro embebido** (sin borde, fondo gris
  azulado): `CONDICIÓN ESPECIAL DE RENTA DIARIA` en navy bold versalitas +
  `Entre hospitalizaciones por accidentes diferentes deberán transcurrir al
  menos 90 días naturales, siempre que no estén relacionadas con el evento
  anterior.`

**`GASTOS MÉDICOS POR ACCIDENTE`**
- `Aplican las exclusiones de la cobertura principal.`
- `Accidentes causados por culpa grave del asegurado cuando se encuentre bajo los efectos del alcohol.`
- `Tratamientos derivados del consumo de alcohol, tabaco o drogas.`
- `Viajes o estadías en centros de reposo, balnearios o convalecencia.`
- `Aparatos ortopédicos, anteojos, medias o fajas de goma.`
- `Prótesis y obturaciones dentales.`

  Cierra con una franja gris clarísima con el texto **en rojo**, centrado a la
  izquierda: `Este resumen es informativo y no sustituye el condicionado
  completo.` Es el **único texto rojo de cuerpo** de todo el handoff.

### 2.5 `02C` / `siniestros` — `PANTALLA_02C_SINIESTROS_APROBADA_FINAL.png` ✅

Mismo modal con **`SINIESTROS`** activa y la misma barra de desplazamiento.
Seis tarjetas:

**`AVISO DEL SINIESTRO`** (sin viñetas, dos párrafos)
`Regla general: comunique el siniestro dentro de los 3 días de haber tomado
conocimiento.` / `Para gastos médicos por accidente rige el plazo específico
indicado en su sección; no constituye una carencia.`

**`FALLECIMIENTO`**
- `Copia legalizada del certificado de defunción.`
- `Certificado de la autoridad sanitaria o declaración del médico tratante.`
- `Declaración del beneficiario en el formulario de la aseguradora.`
- `Antecedentes policiales o judiciales, cuando correspondan, y datos necesarios para verificar el evento.`

**`DIAGNÓSTICO DE CÁNCER`**
- `Comunicar el diagnóstico y presentar prueba médica de su inicio y causa.`
- `Informe anatomopatológico e histológico positivo.`
- `Documentación clínica, radiológica o de laboratorio.`
- `Permitir las verificaciones o exámenes solicitados por la aseguradora.`

**`RENTA HOSPITALARIA POR ACCIDENTE`**
- `Acreditar que la hospitalización fue ocasionada por el accidente cubierto.`
- `Presentar informe médico y documentación clínica que respalden el ingreso y los días de internación.`
- `Internación mínima: 24 horas. Máximo indemnizable: 15 días por vigencia.`

**`GASTOS MÉDICOS POR ACCIDENTE`**
- `Avisar por escrito dentro de los 30 días.`
- `Informe del especialista y documentación clínica, radiológica, histológica o de laboratorio.`
- `Originales de recibos o facturas.`
- `Programa médico y prescripción.`
- `Permitir las verificaciones o exámenes requeridos por la aseguradora.`

**`IMPORTANTE`** (sin viñetas)
`La aseguradora podrá solicitar información adicional razonable para verificar
el siniestro.`

⚠ Todo este grupo está en **usted** («comunique», «su sección»); por D-35 pasa
a voseo, salvo lo que sea cita textual del condicionado.

---

## 3. Grupo 03A · Verificación del número de WhatsApp (18 artes, todos ✅)

Etapa **2 de 5**: el stepper muestra los **dos primeros puntos en rojo** unidos
por un tramo rojo, y los tres restantes grises.

> **Novedad de cabecera:** desde 03A la cabecera institucional va sobre una
> **banda gris azulada clarísima** y lleva un **filete rojo de ~3 px** por
> debajo, de lado a lado. En 01 y 02 la cabecera es blanca y sin filete.

### 3.1 Esqueleto común de las 18 vistas

Todas comparten exactamente la misma pila; lo único que cambia entre estados es
el contenido de los bloques 4 y 5.

1. **Titular a dos líneas**: `Verifique su número` (navy) / `de WhatsApp`
   (**rojo**), ~30 px bold. Bajada en dos líneas `#55709D`:
   `Confirmaremos que su número está activo y bajo su control.`
   ⚠ usted → voseo (D-35): «Verificá tu número…».
   A la derecha, sobre óvalo azul clarísimo, **ilustración**: un celular de
   línea navy con el **logo de WhatsApp en verde pleno** en la pantalla,
   tres destellos rojos arriba a la izquierda, y detrás y a la derecha un
   **escudo navy con el número `123456`** escrito dentro.
2. **Barra de plan seleccionado**: tarjeta ancho completo, fondo azul
   clarísimo, borde azul claro, radio ~10 px, dos líneas:
   - `PLAN SELECCIONADO` en `#55709D` versalitas ~13 px.
   - `VIVE+` navy bold + ` · ` + `Gs. 575.000` **navy bold** + ` al año · IVA
     incluido` en `#55709D` regular. (El arte usa siempre **VIVE+** como plan
     de ejemplo, en todo 03A.)
3. **Tarjeta «1. Confirme el número»** — borde azul claro, radio ~12 px,
   título navy bold ~22 px con el ordinal incluido en el texto:
   - Dos campos en fila: **`País`** (~45 % del ancho) con la **bandera de
     Paraguay** y el texto `Paraguay +595`; **`Número de WhatsApp`** (~55 %)
     con marcador de posición `981 000 000`. Etiquetas encima del campo, en
     navy bold ~15 px. Campos de fondo blanco (el de país, gris clarísimo:
     está fijo), borde gris, radio ~8 px, alto ~44 px.
   - **Casilla de consentimiento**: cuadrado ~26 px con radio ~6 px a la
     izquierda y, a la derecha, el texto completo del consentimiento
     `whatsapp_verification_and_marketing` en cinco líneas (`#55709D`):
     `Autorizo el envío de un código por WhatsApp para verificar que el número
     indicado es de mi propiedad y se encuentra bajo mi control. Asimismo,
     autorizo el envío de publicidad y ofertas de seguros intermediados por
     Interseguros S.A. por este mismo canal, autorización que podré retirar en
     cualquier momento.`
     Marcada, la casilla es **navy pleno con tilde blanca**.
   - **Botón `ENVIAR CÓDIGO A MI WHATSAPP`**, ancho completo, alto ~52 px,
     radio ~8 px, con **ícono circular de WhatsApp (contorno blanco)** a la
     izquierda del rótulo. Rojo pleno cuando está habilitado; **gris azulado
     con texto blanco** cuando no.
4. **Tarjeta «2. Ingrese el código»** — mismo estilo. Contiene:
   - Subtítulo opcional `El código vence en MM:SS` en navy bold ~15 px (rojo
     cuando llega a `00:00`).
   - **Seis casillas de OTP** en fila, cuadradas (~74 px), radio ~10 px, con un
     **cursor vertical gris** dibujado al centro. Vacías y sin foco: borde gris
     claro. Con OTP activo: borde **azul**; la primera, con **halo azul** de
     foco. Con dígitos: número navy bold ~30 px centrado.
   - Línea de error, cuando aplica: **ícono ⊘ rojo circular** + texto rojo.
   - **Botón `VERIFICAR WHATSAPP Y CONTINUAR`**, mismas medidas que el de
     enviar, sin ícono. Gris azulado deshabilitado / rojo pleno habilitado.
   - **Pie de dos acciones** separadas por un filete vertical:
     `⟳ Reenviar código` a la izquierda y `✎ Editar número` a la derecha, en
     azul subrayado con su ícono de línea. Deshabilitadas, van en gris.
5. **Dos avisos fijos al pie**, siempre presentes en las 18 vistas:
   - **Aviso rojo**: fondo rosa clarísimo, borde rojo claro, **ícono ❗
     circular rojo** a la izquierda, título `SOBRE EL CÓDIGO ENVIADO` en rojo
     bold versalitas y cuerpo en rojo apagado: `El código no afecta el
     funcionamiento ni la seguridad de su cuenta de WhatsApp; su única
     finalidad es verificar que el número proporcionado se encuentra activo.
     Interseguros y Alianza no solicitarán este código por mensaje o llamada.`
   - **Aviso azul**: fondo azul clarísimo, **ícono ⓘ circular azul**, título
     `IMPORTANTE` navy bold versalitas y cuerpo: `Continuar con la verificación
     del número de WhatsApp no implica, bajo ninguna circunstancia, la
     contratación del seguro, la firma de documentos, la emisión de la póliza o
     de la factura, el inicio de la cobertura ni la obligación de pagar la
     prima.`
6. Enlace centrado `Información legal`, azul subrayado.

### 3.2 Los 18 estados, uno por uno

| # | `state_code` / archivo | Qué cambia respecto del esqueleto |
| :-- | :-- | :-- |
| **00** | `estado-inicial` · `…03A_00_VERIFICACION_WHATSAPP_ESTADO_INICIAL…` | Número **vacío** (solo el marcador `981 000 000` en gris). Casilla **sin marcar**. `ENVIAR CÓDIGO` **gris**. OTP vacío, bordes grises, `VERIFICAR` gris. Las dos acciones del pie, **grises** (`Reenviar código` y `Editar número`, ambas inactivas). |
| **01** | `datos-listos-para-envio` · `…03A_01_DATOS_LISTOS_PARA_ENVIO…` | Número **escrito** `981 000 000` en navy. Casilla **marcada** (navy con tilde). `ENVIAR CÓDIGO A MI WHATSAPP` en **rojo pleno**. `Editar número` ya activo (azul); `Reenviar código` sigue gris. |
| **01A** | `autorizacion-pendiente` · `…03A_01A_AUTORIZACION_PENDIENTE…` | Número escrito pero casilla **sin marcar** ⇒ `ENVIAR CÓDIGO` vuelve a gris. Es el estado que prueba que **el consentimiento gobierna el envío**. No muestra mensaje de error: la deshabilitación es el único aviso. |
| **01B** | `numero-invalido` · `…03A_01B_NUMERO_INVALIDO…` | Número incompleto `981 000 00`; el campo pasa a **borde rojo** y debajo, en rojo ~14 px: `Ingrese los 9 dígitos del número, sin 0 inicial ni +595.` La casilla está marcada, pero `ENVIAR CÓDIGO` queda **gris**. El bloque «2» baja ~20 px por la línea de error. |
| **02** | `enviando-codigo` · `…03A_02_ENVIANDO_CODIGO…` | Toda la tarjeta 1 se **atenúa** (campos grises, casilla gris con tilde blanca, texto del consentimiento gris claro). El botón queda **rojo pleno** con **anillo de carga** girando a la izquierda y el rótulo `ENVIANDO CÓDIGO...`. OTP sigue vacío y gris. |
| **03** | `codigo-whatsapp-enviado` · `…03A_03_CODIGO_WHATSAPP_ENVIADO…` | El botón de envío **se reemplaza** por una **franja verde** (fondo verde clarísimo, sin borde) con **✓ circular verde pleno** y el texto `Enviamos un código por WhatsApp al ` + `+595 981 ••• 000` en **verde bold**. Tarjeta 2: aparece `El código vence en 04:59`; las seis casillas pasan a **borde azul** y la primera toma foco (halo azul). Pie: `Reenviar código en 00:30` **gris** (con cuenta regresiva) y `Editar número` azul activo. ⚠ El manual fija la espera de reenvío en **60 s**; el arte dibuja 30 s. **Manda el manual** (D-28): `00:60`→`00:00`. |
| **04** | `otp-completo` · `…03A_04_OTP_COMPLETO…` | Las seis casillas con `1 2 3 4 5 6` en navy bold; borde azul, sin halo. `VERIFICAR WHATSAPP Y CONTINUAR` en **rojo pleno**. Contador `El código vence en 04:21`, reenvío `en 00:12`. |
| **05** | `verificando-otp` · `…03A_05_VERIFICANDO_OTP…` | Los dígitos se **atenúan** (gris claro) y el botón rojo muestra **anillo de carga** + `VERIFICANDO...`. `Editar número` se atenúa; `Reenviar código en 00:12` sigue gris. |
| **06** | `codigo-incorrecto` · `…03A_06_CODIGO_INCORRECTO…` | Casillas **vacías otra vez**, borde azul, primera con foco. Debajo, en rojo con ⊘: `Código incorrecto. Le quedan 2 intentos.` `VERIFICAR` gris. **`Reenviar código` ya activo** (azul, sin contador). Contador de vencimiento `03:47`. ⚠ «Le quedan» → voseo: «Te quedan 2 intentos». |
| **07** | `codigo-invalidado-tercer-intento` · `…03A_07_CODIGO_INVALIDADO_TERCER_INTENTO…` | Casillas vacías y **sin foco ni borde azul** (gris): el código murió. Mensaje rojo con ⊘: `Código invalidado por superar el máximo de intentos. Solicite uno nuevo.` `VERIFICAR` gris; `Reenviar código` azul activo. El vencimiento sigue corriendo (`03:11`) aunque el código ya no sirva. |
| **08** | `reenvio-whatsapp-realizado` · `…03A_08_REENVIO_WHATSAPP_REALIZADO…` | Franja verde con texto **distinto**: `Enviamos un nuevo código por WhatsApp al +595 981 ••• 000.` Contador **reiniciado** a `04:59`, casillas azules con foco en la primera. **El pie pierde `Reenviar código`**: queda **solo `Editar número`, centrado**. ⚠ El manual dice que un código nuevo **invalida el anterior**; hoy el código del repo no lo cumple (ANALISIS.md §5.3). |
| **09** | `codigo-whatsapp-vencido` · `…03A_09_CODIGO_WHATSAPP_VENCIDO…` | `El código vence en 00:00` **en rojo**. Casillas grises, sin foco. Mensaje rojo con ⊘: `El código ha vencido. Solicite uno nuevo.` `VERIFICAR` gris; `Reenviar código` azul activo y `Editar número` azul. |
| **10** | `sms-disponible` · `…03A_10_SMS_DISPONIBLE…` | En la tarjeta 1, en lugar de la franja verde, una **franja roja** (fondo rosa, borde rojo claro) con **❗ circular rojo** y el texto en rojo: `No pudimos entregar el código por WhatsApp.` En la tarjeta 2, **sin contador**, casillas grises y, debajo, nota en `#55709D`: `Ya utilizó el reenvío por WhatsApp. Puede solicitar un código por SMS al mismo número.` El pie cambia la acción izquierda por **`Enviar código por SMS`**, azul subrayado, con **ícono de burbuja de chat con la palabra `SMS` dentro**. `Editar número` a la derecha. |
| **11** | `codigo-sms-enviado` · `…03A_11_CODIGO_SMS_ENVIADO…` | Franja **verde**: `Enviamos un código por SMS al +595 981 ••• 000.` Contador `04:59`, casillas azules con foco. Pie con **solo `Editar número`**. ⚠ **Inconsistencia del arte**: el titular sigue diciendo `Verifique su número de WhatsApp` y el botón `VERIFICAR WHATSAPP Y CONTINUAR`, cuando el código llegó por SMS. Se corrige a «número de celular» / «VERIFICAR Y CONTINUAR» (ANALISIS.md §4). Por D-37 el SMS sale por el servicio de AWS. |
| **12** | `bloqueo-temporal` · `…03A_12_BLOQUEO_TEMPORAL…` | Franja verde de SMS arriba (viene del intento anterior). En la tarjeta 2, **antes** de las casillas, una **franja roja** con ❗: `Verificación bloqueada. Nuevo intento disponible en 05:00.` Casillas grises, `VERIFICAR` gris y **`Editar número` también deshabilitado** (gris): durante el bloqueo no hay ninguna acción posible. |
| **13** | `error-tecnico-envio` · `…03A_13_ERROR_TECNICO_ENVIO…` | Tarjeta 1 **activa** (campos en navy, casilla marcada, botón rojo pleno) y, **debajo del botón**, franja roja con ❗ y texto rojo: `No pudimos enviar el código. Intente nuevamente.` Tarjeta 2 intacta y gris. Es el único estado donde el aviso de error va **debajo** del botón de envío en vez de reemplazarlo. |
| **14** | `numero-sin-whatsapp` · `…03A_14_NUMERO_SIN_WHATSAPP…` | Botón de envío **gris** y, debajo, franja roja con ❗: `El número indicado no tiene WhatsApp activo. Edítelo para continuar.` Tarjeta 2 gris; en el pie **`Editar número` es la única acción activa**. ⚠ «Edítelo» → voseo: «Editalo». |
| **15** | `verificacion-exitosa` · `…03A_15_VERIFICACION_EXITOSA…` | Franja verde de envío arriba. La tarjeta 2 **sustituye casillas, botón y pie** por un **panel verde** de ~150 px: ✓ circular verde pleno centrado, `Número verificado correctamente` en verde bold ~22 px y, debajo, `Continuando...` en verde regular ~16 px. La tarjeta 1 queda atenuada. Tras este estado el flujo pasa a **03B** (`functional_contract.otp.success_next_screen`). |

### 3.3 Reglas funcionales que el grupo deja fijadas

- OTP de **6 dígitos**, vigencia **5 minutos** (el contador arranca en `04:59`),
  **3 intentos** y reenvío bloqueado **60 s** (manual; el arte dibuja 30 s).
- Cadena de canales: **WhatsApp → reenvío por WhatsApp → SMS**, y después
  **bloqueo temporal de 5 minutos**. El SMS no se ofrece de entrada: aparece
  recién cuando WhatsApp falló o ya se reenvió.
- El código **nunca se muestra** en la pantalla (regla inviolable #2); el
  `123456` del arte vive **dentro de la ilustración**, no en las casillas del
  estado inicial.
- El número se enmascara siempre como `+595 981 ••• 000` — prefijo y últimos
  tres dígitos visibles, tres puntos medios en el medio.

---

## 4. Grupo 03B · Prepare lo necesario + Aviso de privacidad (4 artes, todos ✅)

Etapa **2 de 5**, mismo stepper que 03A.

### 4.1 `03B` / `estado-inicial` — `…03B_00_PREPARE_LO_NECESARIO_ESTADO_INICIAL…` ✅

1. **Titular**: `Prepare lo` (navy) / `necesario` (**rojo**), dos líneas, ~32 px
   bold. Bajada en dos líneas: `Antes de comenzar la validación, asegúrese de
   tener todo a mano.` ⚠ usted → voseo.
   **Ilustración** a la derecha sobre óvalo azul clarísimo: una **lista con tres
   tildes rojas**, una **tarjeta de identidad** con silueta y líneas rojas, y un
   **celular con ✓ blanco sobre círculo rojo pleno**; dos destellos rojos
   arriba a la derecha.
2. **Barra de plan seleccionado**, idéntica a la de 03A.
3. **Cuatro tarjetas numeradas**, ancho completo, borde gris azulado, radio
   ~12 px, con tres zonas: **círculo azul clarísimo con el número** (navy bold)
   a la izquierda, **ícono de línea navy con acentos rojos** al lado, y
   título + cuerpo a la derecha:

   | # | Ícono | Título (navy bold ~19 px) | Cuerpo (`#55709D`, 2 líneas) |
   | :-- | :-- | :-- | :-- |
   | 1 | Carnet con retrato y líneas rojas | `Cédula de identidad paraguaya vigente` | `Fotografiaremos el frente y el dorso. Los datos deben verse completos, nítidos y sin reflejos.` |
   | 2 | Celular + notebook con destellos rojos | `Celular o computadora con cámara` | `La cámara se utilizará para fotografiar la cédula y realizar una selfie con prueba de vida.` |
   | 3 | Burbuja de WhatsApp + sobre | `WhatsApp y correo electrónico activos` | `Ambos deben ser de su propiedad y encontrarse accesibles.` |
   | 4 | Dos tarjetas de crédito superpuestas | `Medio de pago` | `Podrá pagar mediante QR Bancard o tarjeta de débito o crédito.` |

   El título 1 ocupa **dos líneas**; los otros tres, una.
4. **Aviso rojo** (fondo rosa clarísimo, borde rojo claro, ❗ circular rojo):
   `IMPORTANTE:` en rojo bold + `Este seguro solo puede ser contratado por la
   persona que será asegurada. La cédula de identidad, el número de WhatsApp,
   el correo electrónico y el medio de pago deberán pertenecerle.` (regla
   inviolable #9 dicha en pantalla).
5. **Tarjeta de consentimiento de privacidad**: fondo blanco azulado, borde
   gris azulado, casilla cuadrada ~28 px a la izquierda y texto largo a la
   derecha, en **azul `#0876F9`** (no en gris), con el tramo
   `Aviso de Privacidad` **subrayado y pulsable** (abre 03B_02A):
   `He leído el ` + `Aviso de Privacidad` + ` y autorizo, de forma libre,
   previa, expresa, específica e informada, a Interseguros S.A. y a Alianza
   Garantía Seguros y Reaseguros S.A., en el ámbito de sus respectivas
   funciones, a tratar mis datos personales y de salud, fotografías y datos
   biométricos para verificar mi identidad, realizar la prueba de vida, evaluar
   el riesgo y gestionar la solicitud, contratación y administración del
   seguro.`
6. **CTA `TENGO TODO LISTO Y CONTINUAR`**, ancho completo. En este estado va en
   **rojo pálido/rosado con texto blanco** (deshabilitado). ⚠ En 03A el
   deshabilitado es **gris azulado**: dos dibujos para el mismo estado. Se
   unifica en uno solo (ANALISIS.md §4).
7. Enlace centrado `Información legal`.

### 4.2 `03B` / `listo` — `…03B_01_PREPARE_LO_NECESARIO_LISTO…` ✅

Idéntica, con dos cambios y ninguno más:

- La casilla queda **marcada**, y acá se dibuja **roja con tilde blanca**.
  ⚠ En 03A la casilla marcada es **navy**. Un solo componente de casilla: se
  elige un color y se usa en las dos pantallas.
- La CTA pasa a **rojo pleno**.

### 4.3 `03B` / `aviso-privacidad-inicio` — `…03B_02A_AVISO_PRIVACIDAD_UNIFICADO_INICIO…` ✅

Modal de altura casi total que **arranca debajo del stepper** (cabecera y
stepper quedan visibles y sin atenuar) y lleva el **filete rojo bajo el
stepper**, no bajo la cabecera.

- Título `Aviso de privacidad` (~28 px navy bold), ✕ circular azul grande,
  bajada `Consulte cómo utilizamos y protegemos sus datos.`, regla fina.
- **Indicador de desplazamiento**: línea centrada `Deslice para consultar todo
  el aviso` en navy bold ~15 px seguida de una **flecha ↓ roja**. Aparece
  **solo en el estado inicial** (arriba del todo) y desaparece en 02B.
- **Barra de desplazamiento azul** a la derecha, con el **pulgar arriba**.
- Tarjetas (fondo azul clarísimo, borde azul, título navy bold versalitas):

  | Título | Cuerpo |
  | :-- | :-- |
  | `QUIÉNES INTERVIENEN` | `Interseguros S.A. gestiona el canal digital y la intermediación de la contratación. Alianza Garantía Seguros y Reaseguros S.A. utiliza la información necesaria para evaluar el riesgo, emitir la póliza y administrar la cobertura.` |
  | `PARA QUÉ USAMOS SUS DATOS` | `Para verificar su identidad y sus canales de contacto; validar su cédula, fotografías, datos biométricos y prueba de vida; evaluar requisitos, declaraciones de salud y condición PEP; preparar la Solicitud de Seguro y el FIPF; gestionar la contratación, emisión y administración de la póliza; y cumplir las obligaciones legales y regulatorias aplicables.` |
  | `DATOS QUE PODEMOS TRATAR` | `Datos de identidad y contacto; cédula; fotografías, datos biométricos y prueba de vida; información laboral, económica y financiera; declaraciones de salud; condición PEP; datos del beneficiario; y registros necesarios para acreditar las decisiones y aceptaciones realizadas durante el proceso.` |
  | `PAGO CON TARJETA` | `Bancard procesa el pago. Interseguros S.A. no recibe ni administra los fondos y no almacena los datos completos de la tarjeta.` |
  | `ANALÍTICA DEL SITIO` | `Google Analytics se utiliza para medir el uso del sitio y mejorar su funcionamiento. No se utiliza con fines publicitarios ni se envían señales de publicidad. La información analítica se conserva hasta 24 meses.` |
  | `CONSERVACIÓN` | (se corta al pie en este estado) `Los registros de la contratación y sus respaldos se conservan durante los plazos legales aplicables.` |

  Las tarjetas llevan **holgura inferior generosa** (~30 px de aire bajo la
  última línea): no se ajustan al texto.

### 4.4 `03B` / `aviso-privacidad-final` — `…03B_02B_AVISO_PRIVACIDAD_UNIFICADO_FINAL…` ✅

El mismo modal **desplazado hasta el fondo**: desaparecen la línea `Deslice
para consultar todo el aviso` y la tarjeta `QUIÉNES INTERVIENEN`, el pulgar de
la barra baja al extremo inferior, y se ven completas `CONSERVACIÓN` y la
última tarjeta:

| Título | Cuerpo |
| :-- | :-- |
| `CONSERVACIÓN` | `Los registros de la contratación y sus respaldos se conservan durante los plazos legales aplicables.` |
| `SUS DERECHOS Y CONTACTO` | `Podrá solicitar información sobre sus datos personales, pedir su corrección o actualización o retirar las autorizaciones voluntarias escribiendo a segurolotengo@interseguros360.com.` |

El modal **no tiene botón de aceptar**: la aceptación vive en la casilla de
03B. ⚠ Los siete cuerpos están en **usted**; por D-35 pasan a voseo, salvo lo
que sea texto legal literal aprobado.

---

## 5. Grupo 03C · Identidad y correo (27 artes, todos ✅)

26 estados de pantalla + 1 lámina resumen. Etapa **2 de 5**.

### 5.1 Esqueleto común (vale para 22 de los 26 estados)

1. **Titular**: `Verifique su` (navy) / `identidad` (**rojo**). Bajada de cuatro
   líneas: `Va a fotografiar el frente y el dorso de su cédula de identidad
   paraguaya vigente y a realizar una selfie. No se admite pasaporte.`
   **Ilustración**: una **cédula** en perspectiva con el rótulo
   `REPÚBLICA DEL PARAGUAY`, retrato y tres líneas (dos rojas), un **celular**
   con un rostro dentro de un marco de reconocimiento y, encima, un **✓ blanco
   sobre disco rojo pleno**; dos destellos rojos arriba a la derecha. Todo
   sobre un **círculo** azul clarísimo (no óvalo, como en las otras pantallas).
2. **Barra de plan seleccionado** (igual a 03A/03B).
3. **Aviso azul `ARCHIVOS Y CAPTURA`** — ⓘ circular azul + título navy bold
   versalitas + cuerpo en `#55709D` de tres líneas: `Tomar en cuenta que para
   el frente y el dorso, puede tomar una fotografía o cargar una imagen JPG,
   JPEG, PNG o HEIC de hasta 20 MB. No se admite PDF. La selfie se realiza
   únicamente con la cámara.`
   ⚠ Es **más permisivo** que el código de hoy, donde la carga por archivo solo
   existe con `DEMO_MODE=true`. Al portar v4 hay que decidir si la carga de
   frente/dorso pasa a ser una capacidad de producción (D-40 quitó al proveedor
   de detección de alteración, lo que empeora el riesgo de una imagen cargada).
4. **Rótulo de sección** `CAPTURA DOCUMENTAL Y BIOMÉTRICA`, navy bold
   versalitas ~17 px, alineado a la izquierda, **sin tarjeta**.
5. **Tres tarjetas en fila** de igual ancho (~32 % cada una), borde gris
   azulado, radio ~12 px, **misma altura** aunque una tenga dos botones y otra
   uno. Contenido de cada una, centrado:
   - **Ícono de línea navy** de ~56 px: carnet con retrato y **dos líneas
     rojas** (Frente) · carnet con código de barras (Dorso) · rostro dentro de
     un **marco de enfoque** (Selfie).
   - **Nombre** navy bold ~19 px: `Frente` / `Dorso` / `Selfie`.
   - **Píldora de estado**, ancho completo de la tarjeta, radio completo:
     | Estado | Fondo | Texto |
     | :-- | :-- | :-- |
     | `Pendiente` | gris azulado claro | gris azulado |
     | `PROCESANDO…` | azul clarísimo | navy |
     | `✓ VALIDADO` | azul clarísimo | navy bold, con tilde delante |
     | `REVISAR` | rosa clarísimo | **rojo bold** |
   - **Botón(es)**: `TOMAR FOTOGRAFÍA` (dos líneas) o `TOMAR SELFIE` (una), y
     **solo para frente y dorso** un segundo botón `CARGAR ARCHIVO` blanco con
     borde navy. Activo = rojo pleno; inactivo = gris clarísimo con texto gris.
     Durante el análisis, el botón dice `VALIDANDO…` en gris más oscuro.
   - La tarjeta **activa** lleva **borde azul** (las otras dos, gris).
6. **Aviso azul sin título**: ⓘ + `Las fotografías de la cédula deben ser
   nítidas y la selfie debe superar la prueba de vida y la validación de
   coincidencia facial con la fotografía de la cédula.`
7. **Sección `CORREO ELECTRÓNICO`** (rótulo suelto, igual formato que el
   anterior) con:
   - Aviso azul: `El correo electrónico se utilizará para enviarle los
     documentos del seguro. Es fundamental ingresarlo correctamente.`
   - **Dos campos en fila**, etiqueta flotante dentro del campo en la línea
     superior: `Correo electrónico` y `Confirmación del correo`. Deshabilitados
     (fondo gris clarísimo) hasta que la selfie esté validada.
   - Cuando están deshabilitados, debajo y centrada, la nota en gris:
     `Se habilitará después de validar la selfie.` Al habilitarse, **la nota
     desaparece** y los campos toman fondo blanco.
   - Es el **doble tipeo** que reemplazó al OTP de correo (D-06). No hay
     casilla de consentimiento acá: la de biometría se aceptó en 03B.
8. **CTA `VALIDAR Y CONTINUAR`** ancho completo (gris deshabilitado / rojo
   pleno habilitado) y enlace `Información legal`.

**Regla de composición de los estados de error:** cuando hay error, **el bloque
de correo y la CTA desaparecen** y en su lugar queda una **tarjeta de error** a
ancho completo, con el mismo alto para todos los casos (~330 px), aunque el
texto sea corto: los botones quedan siempre a la misma altura. Dos familias:

| Familia | Fondo / borde | Ícono y título | Botones |
| :-- | :-- | :-- | :-- |
| **Error que consume intento** | rosa clarísimo / rojo claro | ❗ circular rojo + título **rojo bold versalitas** | `VOLVER A TOMAR` (rojo pleno) + `CARGAR OTRO ARCHIVO` (blanco, borde navy), lado a lado |
| **Aviso que no consume intento** | azul clarísimo / azul claro | ⓘ circular azul + título **navy bold versalitas** | un solo botón rojo a ancho completo |

### 5.2 Los 26 estados

| # | `state_code` | Qué muestra |
| :-- | :-- | :-- |
| **00** | `estado-inicial` | Las tres píldoras en `Pendiente`. Solo la tarjeta **Frente** está activa (borde azul, `TOMAR FOTOGRAFÍA` rojo + `CARGAR ARCHIVO`). Dorso y Selfie con botones grises. Correo deshabilitado con la nota. CTA gris. |
| **01** | `camara-frente` | **Pantalla de cámara a pantalla completa**, fondo **azul marino casi negro**, que empieza bajo el stepper (cabecera y stepper siguen visibles). Título blanco `Fotografíe el frente`, ✕ circular blanca, bajada blanca `Alinee la cédula dentro del marco. Asegúrese de que se vea completa, enfocada y sin reflejos.` Al centro, un **recuadro de vista** ligeramente más claro con un **marco punteado blanco grueso** de esquinas redondeadas (proporción tarjeta), el ícono del carnet navy adentro y, bajo el marco, `FRENTE DE LA CÉDULA` en blanco bold versalitas. Debajo, el **obturador**: círculo blanco de ~130 px con **anillo interior rojo**. Bajo él, `Pulse el botón para capturar` en gris claro. Al pie, `Información legal` en blanco subrayado. |
| **02** | `frente-procesando` | Frente: píldora `PROCESANDO…`, botón `VALIDANDO…` gris, `CARGAR ARCHIVO` **desaparece**. Resto sin cambios. |
| **03** | `frente-validado-dorso-habilitado` | Frente `✓ VALIDADO` con sus botones grises; **Dorso** toma el borde azul y sus dos botones activos. |
| **04** | `camara-dorso` | Igual que 01 con `Fotografíe el dorso`, ícono de **código de barras** dentro del marco y rótulo `DORSO DE LA CÉDULA`. |
| **05** | `dorso-procesando` | Dorso en `PROCESANDO…` / `VALIDANDO…`; Frente ya `✓ VALIDADO`. |
| **06** | `documento-validado-selfie-habilitada` | Frente y Dorso `✓ VALIDADO`; **Selfie** con borde azul y `TOMAR SELFIE` rojo (botón **único**, sin `CARGAR ARCHIVO` — la selfie es solo cámara). |
| **07** | `camara-selfie` | Pantalla de cámara con `Realice la selfie`, bajada `Centre su rostro dentro del óvalo y siga las indicaciones de prueba de vida.`, **óvalo punteado vertical** con una silueta de busto gris adentro, rótulo `Mire al frente` (navy/blanco bold, **no** en versalitas) y, bajo el obturador, `La captura se realizará automáticamente` — el botón está pero la captura la dispara la prueba de vida. |
| **08** | `selfie-procesando` | Selfie en `PROCESANDO…` / `VALIDANDO…`. |
| **09** | `identidad-validada-correo-habilitado` | Las tres en `✓ VALIDADO`, **ninguna tarjeta con borde azul**. Campos de correo **habilitados y vacíos**, sin la nota inferior. CTA todavía gris. |
| **10** | `correo-invalido` | Primer campo con `cliente@correo`, **borde rojo**; debajo, a la izquierda, **punto rojo** + `Ingrese un correo electrónico válido.` en rojo ~14 px. CTA gris. |
| **11** | `correos-no-coinciden` | `cliente@email.com` / `clienta@email.com`; el **segundo** campo en rojo y el mensaje `Los correos electrónicos no coinciden. Verifique ambos campos.` |
| **12** | `listo-para-validar` | Los dos correos iguales, campos en azul/gris normal, **CTA `VALIDAR Y CONTINUAR` en rojo pleno**. |
| **13** | `validacion-final-procesando` | CTA gris con el rótulo `VALIDANDO IDENTIDAD…` y un **anillo de carga a la derecha del texto** (no a la izquierda, como en 03A). |
| **14** | `imagen-rechazada-calidad` | Frente en `REVISAR` con sus dos botones activos; tarjeta de error roja `NO PUDIMOS VALIDAR LA IMAGEN` — `La imagen está borrosa o presenta reflejos. Capture o cargue otra imagen donde la cédula se vea completa, nítida y bien iluminada. Intento 1 de 3.` |
| **15** | `archivo-no-admitido` | Frente vuelve a `Pendiente` (no `REVISAR`: el archivo nunca llegó a analizarse). Tarjeta **azul** `ARCHIVO NO ADMITIDO` — `Seleccione una imagen JPG, JPEG, PNG o HEIC de hasta 20 MB. No se admite PDF ni archivos dañados.` con un único botón rojo `SELECCIONAR OTRO ARCHIVO`. **No consume intento.** |
| **16** | `lado-incorrecto-o-repetido` | Frente `✓ VALIDADO`, **Dorso** en `REVISAR`; error rojo `EL LADO NO CORRESPONDE` — `Se esperaba el dorso de la cédula. La imagen cargada corresponde al frente o repite la captura anterior. Intento 1 de 3.` |
| **17** | `documento-no-paraguayo` | Frente en `REVISAR`; error rojo `DOCUMENTO NO ADMITIDO` — `Solo se admite una cédula de identidad paraguaya vigente. No se admite pasaporte ni otro documento. Intento 1 de 3.` |
| **18** | `cedula-vencida` | Error rojo `CÉDULA VENCIDA` — `La cédula fotografiada se encuentra vencida. Para continuar deberá utilizar una cédula paraguaya vigente. Intento 1 de 3.` |
| **19** | `posible-alteracion` | Error rojo `NO PUDIMOS VALIDAR EL DOCUMENTO` — `Detectamos inconsistencias o posibles alteraciones en la imagen. Utilice el documento original y vuelva a capturarlo. Intento 1 de 3.` ⚠ **Por D-40 hoy no hay proveedor que detecte alteración documental.** El estado se maquetea, pero nada lo dispara: no se puede prometer una verificación que no existe. |
| **20** | `camara-denegada-documento` | Aviso **azul** `PERMITA EL ACCESO A LA CÁMARA` — `Para tomar la fotografía debe habilitar la cámara del dispositivo. También puede continuar cargando una imagen del frente o dorso.` Dos botones: `HABILITAR CÁMARA` (rojo) + `CARGAR ARCHIVO` (blanco). |
| **21** | `camara-denegada-selfie` | Aviso azul `LA SELFIE REQUIERE ACCESO A LA CÁMARA` — `La selfie debe realizarse en vivo. Habilite la cámara del dispositivo para completar la prueba de vida y la coincidencia facial.` **Un solo botón** `HABILITAR CÁMARA`: acá no hay alternativa por archivo, y es la diferencia deliberada con 20. |
| **22** | `prueba-de-vida-fallida` | Selfie en `REVISAR`; error rojo `NO PUDIMOS CONFIRMAR LA PRUEBA DE VIDA` — `Centre el rostro, mejore la iluminación y siga las instrucciones que aparecen en pantalla. Intento 1 de 3.` Botón único `REPETIR SELFIE`. |
| **23** | `coincidencia-facial-fallida` | Error rojo `EL ROSTRO NO COINCIDE CON LA CÉDULA` — `No pudimos confirmar la coincidencia facial. Asegúrese de que la selfie sea realizada por el titular de la cédula. Intento 1 de 3.` Botón `REPETIR SELFIE`. |
| **24** | `error-tecnico` | Aviso **azul** `NO PUDIMOS PROCESAR LA IMAGEN` — `Compruebe su conexión e intente nuevamente. Conservaremos temporalmente la captura o el archivo seleccionado.` + una línea aparte, **navy bold**: `Este error no consume un intento de validación.` Botón `INTENTAR NUEVAMENTE`. La tarjeta afectada queda en `PROCESANDO…`. |
| **25** | `bloqueo-temporal-5-minutos` | Error rojo `VALIDACIÓN TEMPORALMENTE BLOQUEADA` — `Se alcanzaron 3 intentos fallidos en esta etapa. Las etapas anteriores ya validadas se conservarán. El sistema habilitará automáticamente nuevos intentos en 04:59.` En vez de botones de acción, una **barra gris deshabilitada** con `REINTENTO AUTOMÁTICO EN 04:59`. ⚠ **La tarjeta Frente se dibuja activa** (píldora `REVISAR`, `TOMAR FOTOGRAFÍA` rojo, `CARGAR ARCHIVO` habilitado) durante un bloqueo: contradice al propio bloqueo. **Durante los 5 minutos los tres botones van deshabilitados** (ANALISIS.md §4). |

### 5.3 `03C` / `resumen-26-estados` — `…03C_RESUMEN_26_ESTADOS…` ✅ (lámina)

Lámina de documentación, **no una pantalla**: `artifact_type = summary_board`,
lienzo 968×3320. Título `PANTALLA 03C · IDENTIDAD Y CORREO` en navy bold
centrado y bajada `26 estados y escenarios para revisión`. Debajo, una **rejilla
de 4 columnas × 7 filas** con las 26 maquetas en miniatura, cada una en su marco
de iPhone sobre placa gris clarísima, y su rótulo en navy bold versalitas a dos
líneas (`00 · ESTADO INICIAL`, `01 · CÁMARA FRENTE`, …, `25 · BLOQUEO TEMPORAL
5 MINUTOS`). La última fila solo tiene dos. **No se implementa**; sirve para
verificar que no falte ningún estado.

Los rótulos de la lámina son la **nomenclatura oficial** de los estados y no
siempre coinciden con el nombre del archivo: `09 · CORREO HABILITADO`,
`13 · VALIDACIÓN FINAL`, `14 · IMAGEN SIN CALIDAD`. Ante duda, manda el
`state_code` del manifiesto.

---

## 6. Grupo 03D · Datos personales (15 artes, todos ✅)

14 estados + 1 lámina resumen. Etapa **2 de 5**. Es el único grupo con
**especificación JSON propia**: `data/PANTALLA_03D_ESPECIFICACION_Y_CATALOGOS_APROBADA_FINAL.json`
(15 campos y 5 catálogos), que manda sobre el arte para nombres de campo,
obligatoriedad y contenido de los desplegables.

### 6.1 Esqueleto común

1. **Titular en una sola línea**: `Complete sus ` (navy) + `datos` (**rojo**),
   ~34 px bold — es el único titular del flujo que no va a dos líneas. Bajada
   de una línea: `Revise la información y complete los campos restantes.`
   **Ilustración** pequeña, arriba a la derecha, parcialmente **detrás del
   titular**: carnet de línea navy con retrato y tres líneas (una roja), y un
   **✓ blanco sobre disco navy** (no rojo) abajo a la derecha; dos destellos
   rojos arriba.
2. **Banda de identidad verificada**: tarjeta azul clarísima con **✓ blanco
   sobre disco navy pleno** de ~44 px a la izquierda y el texto en dos líneas
   `Identidad verificada mediante la cédula, la prueba de vida y la
   coincidencia facial.` Va **antes** de la barra de plan, y es el único lugar
   del flujo donde aparece.
3. **Barra de plan seleccionado**.
4. **Rótulo `DATOS DE IDENTIDAD`** (navy bold versalitas, suelto) + aviso azul
   ⓘ: `Todos los campos son obligatorios. Puede editar los datos extraídos de
   su cédula; el tipo de documento permanece bloqueado.`
5. **Rejilla de campos a dos columnas**, etiqueta encima del campo en
   `#55709D` ~14 px, campo de ~46 px de alto, radio ~8 px, borde gris azulado.
   El orden es exactamente este:

   | Fila | Izquierda | Derecha |
   | :-- | :-- | :-- |
   | 1 | `Tipo de documento` — fondo **gris**, valor `Cédula de identidad`, **🔒 candado navy** a la derecha | `Número de cédula` — `4.123.456`, ✎ |
   | 2 | `Nombres` — **ancho completo**, `MARÍA BELÉN`, ✎ | — |
   | 3 | `Apellido paterno` — `GONZÁLEZ`, ✎ | `Apellido materno` — `BENÍTEZ`, ✎ |
   | 4 | `Fecha de nacimiento` — `14/05/1984`, ✎ | `Sexo` — desplegable |
   | 5 | `Estado civil` — desplegable | `País de nacimiento` — desplegable |
   | 6 | `Nacionalidad` — desplegable | `País de residencia` — desplegable |

   - El **ícono de edición es un lápiz navy inclinado** (no un candado
     abierto), pegado al borde derecho del campo. Aparece en **todo campo de
     texto editable**, incluidos `Número de cédula` y `Fecha de nacimiento`.
   - Los desplegables llevan **chevron ⌄ navy** y, vacíos, el marcador
     `Seleccione una opción` en gris. ⚠ Por D-35 pasa a voseo (`Elegí una
     opción`), unificado con 04A.
   - Los valores extraídos por OCR se muestran en **mayúsculas** tal como los
     leyó (`MARÍA BELÉN`, `GONZÁLEZ`, `BENÍTEZ`); los tipeados por la persona,
     en caja normal (`Avda. España 1234`, `Villa Morra`).
6. **Rótulo `DOMICILIO`** + tres campos: `Dirección` (ancho completo, ✎),
   `Ciudad` (desplegable buscable) y `Barrio o zona` (texto libre, ✎).
   Marcador de los campos de texto vacíos: `Complete este campo`.
7. **Dos fichas informativas en fila**, azul clarísimo con ⓘ:

   | Izquierda | Derecha |
   | :-- | :-- |
   | `¿LOS DATOS NO COINCIDEN?` — `Puede corregir los datos extraídos antes de continuar. Las modificaciones quedarán registradas.` | `EDAD CALCULADA: 42 AÑOS` — `Para contratar el seguro, debe tener entre 18 y 64 años.` |

   La ficha de edad **lleva la edad en el título**, no en el cuerpo.
8. **CTA `CONTINUAR`** (gris deshabilitada / roja habilitada) + `Información legal`.

> ⚠ **Divergencia con `CLAUDE.md`, ya resuelta por D-31.** La especificación
> declara `document_number` y `birth_date` **editables**, y el arte les pone
> lápiz; el código de hoy los tiene bloqueados porque de ellos cuelgan el
> bloqueo por cédula y el corte de edad (regla inviolable #8). La decisión es:
> **se deja editar y el cambio se registra, pero la elegibilidad y el bloqueo
> se calculan con el valor que el OCR leyó**. El campo editado viaja como dato
> declarado, no como el que decide.

### 6.2 Los 14 estados

| # | `state_code` | Qué muestra |
| :-- | :-- | :-- |
| **00** | `datos-extraidos-campos-pendientes` | Los cuatro campos del OCR con valor; los cinco desplegables y los tres de domicilio, **vacíos**. CTA gris. |
| **01** | `menu-sexo` | Desplegable **en línea** (no hoja inferior): el campo `Sexo` toma **borde navy grueso** y debajo se despliega un panel blanco con borde navy y radio ~8 px, con **dos filas separadas por reglas finas**: `Femenino` · `Masculino`. El panel **tapa** el campo `País de nacimiento` y empuja visualmente la rejilla. Sin buscador y sin contador. |
| **02** | `menu-estado-civil` | Igual, con **cinco filas**: `Soltero/a` · `Casado/a` · `Unión de hecho` · `Divorciado/a` · `Viudo/a`. El panel es más alto y tapa `Nacionalidad` y parte de `DOMICILIO`. |
| **03** | `menu-pais-nacimiento` | **Hoja inferior**, no desplegable en línea: la pantalla se atenúa con un velo azul grisáceo, y desde abajo sube una hoja blanca con esquinas superiores redondeadas que ocupa ~57 % del alto. Lleva **asa gris** centrada arriba, título `PAÍS DE NACIMIENTO` navy bold versalitas, ✕ circular azul, **campo de búsqueda** de fondo gris clarísimo con **lupa** y marcador `Buscar país`, y la lista: `Afganistán` · `Albania` · `Alemania` · `Andorra` · `Angola` · `Antigua y Barbuda` · `Arabia Saudita` (7 visibles, separadas por reglas finas). Al pie, centrado y en azul, `195 opciones disponibles`. |
| **04** | `menu-nacionalidad` | Misma hoja, título `NACIONALIDAD`, marcador `Buscar nacionalidad`, **las mismas 195 opciones con nombre de país** (el catálogo de nacionalidad usa el gentilicio = nombre del país: `Afganistán`, `Albania`, …). |
| **05** | `menu-pais-residencia` | Misma hoja, título `PAÍS DE RESIDENCIA`, marcador `Buscar país`, 195 opciones. |
| **06** | `menu-ciudad` | Misma hoja, título `CIUDAD`, marcador `Buscar ciudad`, y lista **de 44** que empieza `Asunción` · `Concepción` · `Horqueta` · `San Lázaro` · `San Pedro de Ycuamandiyú` · `Santa Rosa del Aguaray` y, como **séptima fila visible**, `Otra ciudad o localidad` — que en el catálogo es la **opción 44, la última** (`allows_other: true`). ⚠ El arte la muestra fuera de orden; en la implementación va **al final de la lista**, y elegirla habilita el texto libre. Pie: `44 opciones disponibles`. |
| **07** | `todos-los-datos-completos` | Todos los campos con valor: `Femenino`, `Casado/a`, `Paraguay` (nacimiento, nacionalidad y residencia), `Avda. España 1234`, `Asunción`, `Villa Morra`. **CTA `CONTINUAR` en rojo pleno.** |
| **08** | `editando-dato-extraido` | El campo `Número de cédula` en **foco**: borde navy grueso, valor a medio tipear `4.123.45`. La CTA vuelve a **gris** mientras el dato está incompleto. Ningún otro cambio. |
| **09** | `cambio-registrado` | Sobre la etiqueta `Número de cédula`, **a la derecha y en la misma línea**, aparece la marca `EDITADO` en navy bold versalitas ~11 px. La ficha izquierda del pie **cambia de texto**: `MODIFICACIÓN REGISTRADA` — `El cambio fue guardado y quedará registrado para la contratación.` CTA roja. Es la prueba visual de `modifications_logged`. |
| **10** | `campo-obligatorio-faltante` | `Barrio o zona` vacío con **borde rojo**; bajo las dos fichas, una **franja de error** a ancho completo (fondo rosa clarísimo, borde rojo, **sin ícono**) con dos líneas en rojo bold: `BARRIO O ZONA ES OBLIGATORIO.` / `Complete el campo para poder continuar.` CTA gris. |
| **11** | `fecha-nacimiento-invalida` | `Fecha de nacimiento` con `31/02/1984` y borde rojo; franja de error `FECHA DE NACIMIENTO NO VÁLIDA.` / `Revise el día, el mes y el año ingresados.` ⚠ **La ficha sigue diciendo `EDAD CALCULADA: 42 AÑOS`** con una fecha imposible. Se **oculta la edad** mientras la fecha no sea válida (ANALISIS.md §4). |
| **12** | `validando-datos` | CTA gris con **anillo de carga a la izquierda** del rótulo `VALIDANDO DATOS…`. Todos los campos quedan como están, sin atenuar. |
| **13** | `no-elegible-por-edad` | **Vista propia, no una tarjeta**: el contenido desaparece y queda, bajo el stepper, el título `Resultado de la validación` en **rojo bold** a la izquierda con **✕ circular azul** a la derecha; luego la barra de plan; luego, centrado, un **✕ dentro de un círculo rojo de contorno grueso** (~120 px), el rótulo `NO ES POSIBLE CONTINUAR` en **rojo bold ~28 px a dos líneas** y el cuerpo centrado en navy: `La edad calculada está fuera del rango permitido para contratar este seguro: de 18 a 64 años.` Debajo, aviso azul con ⓘ: `Si la fecha de nacimiento no es correcta, cierre esta pantalla y corríjala. De lo contrario, seleccione FINALIZAR.` Después, **botón `FINALIZAR` rojo pleno** y, bajo él y centrado en azul ~13 px, `FINALIZAR cierra la sesión y vuelve al inicio.` Al pie, `Información legal`. **No hay stepper terminal distinto**: sigue diciendo `2 de 5`, que es la etapa donde el flujo se detuvo — y es la regla de consistencia de ANALISIS.md §4. |

### 6.3 `03D` / `resumen-14-estados` — `…03D_RESUMEN_14_ESTADOS…` ✅ (lámina)

Lámina 968×1940, `PANTALLA 03D · DATOS PERSONALES` / `14 estados y escenarios
para revisión`, rejilla de 4 columnas × 4 filas (la última con dos). Mismos
rótulos que la tabla de arriba. **No se implementa.**

### 6.4 Los catálogos, como los fija el JSON aprobado

- **Sexo** (2, sin buscador): `Femenino`, `Masculino`. Coincide con
  `SEXOS_ADMITIDOS` del código y con la decisión del 21-ago-2026 de **no
  prellenarlo con el OCR**.
- **Estado civil** (5, sin buscador): `Soltero/a`, `Casado/a`,
  `Unión de hecho`, `Divorciado/a`, `Viudo/a`.
- **País de nacimiento / Nacionalidad / País de residencia** (195 cada uno,
  **con buscador**): catálogo ISO en español, de `Afganistán` a `Zimbabue`.
- **Ciudad** (44, con buscador y `allows_other`): las 43 localidades
  paraguayas por departamento —de `Asunción` a `Loma Plata`— más
  `Otra ciudad o localidad` al final.
- **Barrio o zona**: texto libre (`neighborhood_open_text: true`).

---

## 7. Grupo 03E2 · Revisión manual por condición PEP (3 artes, todos ✅)

Son las **pantallas terminales** del camino PEP. El arte las dibuja con
**`4 de 5`** y cuatro puntos rojos. ⚠ **Se corrige a `3 de 5`** (ANALISIS.md
§4): 03E2 se dispara al terminar 03E, que es la etapa 3; una pantalla terminal
muestra la etapa en la que el flujo se detuvo, no la siguiente.

### 7.1 `03E2` / `revision-manual-registrada` — `…03E2_21_REVISION_MANUAL_REGISTRADA…` ✅

1. **Titular**: `Tu solicitud requiere` (navy) / `revisión` (**rojo**) — y acá
   el arte ya está en **voseo/tuteo** (`Tu`), mientras el cuerpo sigue en
   usted. Se unifica todo en voseo (D-35). Bajada en dos líneas:
   `Recibimos correctamente su información.`
   **Ilustración**: busto de persona de línea navy junto a un **panel con
   retrato y renglones**, una **lupa** y un **reloj**; dos destellos rojos.
2. **Barra de plan seleccionado.**
3. **Tarjeta `REVISIÓN POR CONDICIÓN PEP`** (borde azul claro, ⓘ circular azul
   a la izquierda del título, título navy bold ~21 px), con **tres párrafos**:
   - `Su declaración sobre la condición PEP requiere evaluación adicional por
     parte de la compañía de seguros. Por este motivo, el proceso automático de
     emisión ha sido detenido y el caso será enviado por Interseguros S.A. a
     Alianza Garantía Seguros y Reaseguros S.A. para su evaluación manual.`
   - `Esto no significa que su solicitud haya sido rechazada. No se solicitarán
     firma ni pago mientras el caso se encuentre pendiente. Si fuera necesario,
     se le solicitará información adicional a través de los canales declarados.`
   - `Este procedimiento no implica la contratación del seguro, la firma de
     documentos, la emisión de la póliza o la factura, el inicio de la cobertura
     ni la obligación de pagar la prima.`
4. **Tarjeta `ESTADO DE LA SOLICITUD`** — título navy bold versalitas y
   **cinco filas** de dos columnas (concepto a la izquierda en `#55709D`,
   estado a la derecha con ícono):

   | Concepto | Ícono | Estado |
   | :-- | :-- | :-- |
   | `Datos recibidos` | ✓ blanco sobre **disco verde** | `Confirmado` |
   | `Revisión de cumplimiento` | **reloj** de contorno navy | `En revisión` |
   | `Firma de documentos` | círculo vacío gris | `Pendiente` |
   | `Pago` | círculo vacío gris | `No realizado` |
   | `Cobertura` | círculo vacío gris | `No iniciada` |

   Los textos de estado van en navy; los conceptos, en gris azulado. Debajo,
   **regla fina** y una fila final: `N.º de caso` a la izquierda y
   **`CAS-00018425`** a la derecha, ambos navy. El formato es `CAS-` + 8
   dígitos, **el mismo que 04A1**, y solo cambia la segunda fila de la lista
   según el motivo.
5. **Aviso azul** con ⓘ: `Su solicitud se encuentra en etapa de revisión.
   Cualquier comunicación adicional se realizará únicamente por los canales
   oficiales declarados.`
6. **Botón `CERRAR SESIÓN`** rojo pleno, ancho completo + `Información legal`.
   No hay ninguna acción que permita firmar ni pagar: es la traducción visual
   de `manual_review.signature_requested = false` y
   `payment_requested = false`.

### 7.2 `03E2A` / `confirmar-cierre-sesion` — `…03E2A_22_CONFIRMAR_CIERRE_SESION…` ✅

Sobre la pantalla anterior atenuada con velo azul grisáceo, **una tarjeta
blanca reemplaza en su sitio a la tarjeta de revisión PEP** (no es un diálogo
centrado en la pantalla: ocupa el mismo hueco, y `ESTADO DE LA SOLICITUD` sigue
visible debajo). Contenido, todo centrado:

- **❗ dentro de un círculo de contorno navy** de ~80 px.
- Título `¿Cerrar sesión?` navy bold ~26 px.
- Cuerpo en dos líneas: `Su solicitud ya fue registrada y continuará en
  revisión. Al cerrar la sesión, volverá a la pantalla de inicio.`
- **Botón `CERRAR SESIÓN`** rojo pleno, ancho de la tarjeta.
- **No hay botón de cancelar ni ✕**: se sale tocando fuera. ⚠ Conviene agregar
  una salida explícita («Seguir viendo el estado»); un diálogo de confirmación
  sin negativa visible es una trampa de un solo camino.

El botón `CERRAR SESIÓN` del pie queda **atenuado** (rojo apagado) mientras el
diálogo está abierto.

### 7.3 `03E2B` / `error-registro-revision` — `…03E2B_22_ERROR_REGISTRO_REVISION…` ✅

La pantalla **cambia de identidad**: titular `Revisión manual` en navy bold
(sin segunda línea roja), bajada `Registro de la solicitud.`, y **sin
ilustración**. Después:

- Barra de plan seleccionado.
- **Tarjeta blanca de borde azul claro** con, centrado: **✕ dentro de un
  círculo rojo de contorno grueso sobre fondo rosa clarísimo** (~110 px),
  título `NO PUDIMOS ENVIAR SU SOLICITUD A REVISIÓN` en **rojo bold a dos
  líneas**, y el cuerpo en navy, centrado: `La solicitud no fue registrada.` /
  `La información ingresada no pudo guardarse.` y, en **navy bold**, la línea
  que cierra: `No se generó un número de caso, firma ni cobro.`
- **Aviso azul** con ⓘ: `Al seleccionar INICIAR NUEVA CONTRATACIÓN, volverá al
  inicio y deberá completar nuevamente todos los pasos.`
- **Botón `INICIAR NUEVA CONTRATACIÓN`** rojo pleno + `Información legal`.
- **No hay tarjeta `ESTADO DE LA SOLICITUD`**, y es correcto: no hay caso que
  mostrar.

---

## 8. Grupo 04 · Declaraciones, evaluación manual y consentimientos (3 artes, ✅)

Etapa **4 de 5** (cuatro puntos rojos). Es el último tramo con arte aprobado:
**04E (revisión y firma), 05A (pago) y 05B (confirmación) no tienen arte** y
por D-41 **no se implementan** hasta tenerlo.

### 8.1 `04A` / `datos-y-declaraciones` — `…04A_00_DATOS_Y_DECLARACIONES…` ✅

1. **Titular en una línea**: `Datos y ` (navy) + `declaraciones` (**rojo**).
   Bajada en dos líneas, **ya en voseo**: `Completá la información requerida
   para preparar la Solicitud y el FIPF.`
   **Ilustración**: busto de persona de línea navy con un **corazón con
   electrocardiograma** delante y, a la derecha, una **planilla con ✓ dentro de
   un círculo**; dos destellos rojos arriba.
2. **Barra de plan seleccionado.**
3. **Rótulo `DECLARACIONES DE SALUD`** navy bold versalitas, **seguido de un
   ⓘ circular rojo** (no azul) del mismo alto que el texto: es el único ⓘ rojo
   de todo el handoff, y abre la aclaración de evaluación manual.
4. **Tres tarjetas de pregunta**, borde azul claro, radio ~10 px, con el
   enunciado a la izquierda (navy, ~17 px, hasta seis líneas) y, a la derecha y
   centrados verticalmente, **dos botones cuadrados `SÍ` / `NO`** de ~86×54 px,
   fondo blanco, borde azul claro, texto navy bold versalitas. **Ninguno
   seleccionado** en el arte. Las tres preguntas, literales:
   1. `Declaro que me encuentro en buen estado de salud y que no estoy
      contratando este seguro para cubrir una enfermedad, diagnóstico o
      condición médica preexistente.`
   2. `¿Alguna aseguradora rechazó, postergó o condicionó alguna solicitud tuya
      de seguro de vida, de salud o de características similares?`
   3. `¿Te han diagnosticado o estás actualmente en tratamiento por alguna de
      las siguientes enfermedades o condiciones médicas: cáncer, enfermedad
      cardiovascular, insuficiencia renal, diabetes, esclerosis, enfermedad
      autoinmune, inmunodeficiencia, hepatitis o cirrosis?`

   Son **tres**, no ocho (D-33): la condición PEP se declara en 03E. ⚠ Esto
   reescribe la regla inviolable #5 del repositorio, que habla de «las
   declaraciones 1, 2, 3 u 8 de P6»: con v4 el disparador de evaluación manual
   médica son **estas tres**, y el de revisión de cumplimiento es la PEP de 03E.
5. **Rótulo `BENEFICIARIO POR FALLECIMIENTO*`** — con **asterisco rojo** de
   obligatoriedad, que acá aparece por primera vez en el flujo.
   - **Dos opciones de radio en fila**, cada una en su tarjeta de borde azul
     claro: `Heredero legales — 100%` (sic: `Herederos legales — 100%`) y
     `Designar una persona — 100%`. El radio seleccionado es un **círculo azul
     `#0876F9` con punto blanco**; el otro, contorno gris. En el arte está
     elegido **`Designar una persona`**, que es lo que despliega los campos.
   - **Cuatro campos**, etiqueta arriba con asterisco rojo:
     `Nombre completo*` (ancho completo, marcador `Ingresá el nombre
     completo`), `Domicilio completo*` (ancho completo, `Ingresá el domicilio
     completo`), y en fila `Parentesco*` (desplegable, `Elegí una opción`) y
     `N.º de cédula del beneficiario*` (`Ingresá el número de cédula`).
   - Con `Herederos legales` elegido, los cuatro campos **no se muestran**.
   - El beneficiario vive **dentro de 04A**; `screens.json` es explícito en que
     **no existe una pantalla 04B** (`separate_04B_screen: false`).
6. **Aviso azul** con **ⓘ rojo**: `Si alguna respuesta médica o de antecedentes
   requiere evaluación adicional, la solicitud no será rechazada
   automáticamente. Se detendrá el proceso automático de emisión y el caso será
   enviado por Interseguros a Alianza Seguros para su evaluación manual.`
   (Texto en cuerpo pequeño, ~13 px, cuatro líneas.)
7. **CTA `CONTINUAR`** roja + `Información legal`.
   ⚠ **En el arte está roja con todo vacío.** El manual prohíbe avanzar sin las
   respuestas requeridas, así que **arranca deshabilitada** y se habilita con
   las tres preguntas respondidas y el beneficiario completo (ANALISIS.md §4).

### 8.2 `04A1` / `evaluacion-manual-medica` — `…04A1_00_EVALUACION_MANUAL_MEDICA…` ✅

Gemela de 03E2, con **cuatro diferencias y ninguna más**:

| | 03E2 (PEP) | 04A1 (salud) |
| :-- | :-- | :-- |
| Ilustración | busto + panel con retrato + lupa + reloj | **planilla con renglones + dos relojes** (sin figura humana) |
| Título de la tarjeta | `REVISIÓN POR CONDICIÓN PEP` | `EVALUACIÓN MANUAL` |
| Primer párrafo | `Su declaración sobre la condición PEP requiere evaluación adicional…` | `Alguna respuesta médica o de antecedentes requiere evaluación adicional…` |
| Segunda fila del estado | `Revisión de cumplimiento` | `Evaluación de asegurabilidad` |

El segundo párrafo también cambia: `Esto no significa que su solicitud haya sido
rechazada automáticamente. Todos los antecedentes serán revisados con mayor
detalle y, si fuera necesario, se le solicitará información adicional a través
de los canales declarados.` El tercero es idéntico. El resto —estado de la
solicitud, `N.º de caso CAS-00018425`, aviso azul, `CERRAR SESIÓN`— es igual.

Acá el stepper **`4 de 5` es correcto**: 04A1 se dispara dentro de 04A, que es
la etapa 4.

### 8.3 `04D` / `consentimientos` — `…04D_00_CONSENTIMIENTOS…` ✅

1. **Titular de una sola palabra, todo en rojo**: `Consentimientos` — es el
   único titular del handoff sin parte navy. Bajada en dos líneas:
   `Revise la información antes de continuar.` ⚠ usted → voseo.
   **Ilustración**: planilla con **tres tildes rojas** y, delante, un **escudo
   con tilde roja**; dos destellos rojos.
2. **Barra de plan seleccionado.**
3. **Tres bloques**, cada uno en tarjeta de borde gris azulado clarísimo, con
   una composición propia: **control arriba a la izquierda**, **ilustración de
   línea debajo del control**, y **título + cuerpo a la derecha**.

   | # | Control | Título (navy bold versalitas) | Ilustración | Texto |
   | :-- | :-- | :-- | :-- | :-- |
   | 1 | **casilla cuadrada** vacía, ~40 px, borde navy | `ENTREGA DIGITAL` | documento con flecha ↓ en un círculo | `Autorizo y acepto recibir por mis canales verificados (WhatsApp y correo electrónico) el Certificado de Cobertura Provisional, la póliza y la factura electrónica, así como la Solicitud de Seguro y el FIPF firmados cuando los requiera.` |
   | 2 | **casilla cuadrada** vacía | `INICIO DE COBERTURA Y CARENCIAS` (dos líneas) | calendario con reloj y destellos rojos | `Tomo conocimiento y acepto que la cobertura comenzará una vez acreditado el pago de la prima. Carencias: cáncer, 90 días; renta hospitalaria por accidente, 1 día; gastos médicos por accidente, 1 día; fallecimiento, sin carencia.` |
   | 3 | **ⓘ circular rojo** — **no** una casilla | `INTERMEDIARIO Y CANAL DE ATENCIÓN` (dos líneas) | busto con corbata y escudo con tilde roja | `Tomo conocimiento de que Interseguros S.A. es el intermediario en la contratación de este seguro y será el canal de atención para todas las gestiones relacionadas con la póliza. Para cualquier consulta, solicitud, cambio, modificación o renovación, deberé comunicarme con Interseguros S.A. a través de sus canales oficiales o acudir a sus oficinas.` |

   **Que el tercero no tenga casilla es deliberado y está confirmado por el
   manual** (ANALISIS.md §3): es **informativo**, se registra al continuar. Los
   textos 1 y 2 coinciden palabra por palabra con `consents[digital_delivery]`
   y `consents[coverage_waiting_periods]` de `screens.json`; el tercero es más
   largo en el arte que en el JSON —le agrega la frase sobre consultas y
   oficinas— y **manda el arte**, que es lo que la persona lee.
4. **CTA `CONTINUAR`** roja + `Información legal`. ⚠ Igual que en 04A, en el
   arte está **roja con las dos casillas vacías**: arranca **deshabilitada** y
   se habilita con las dos marcadas.

---

## 9. Grupo 03E · Actividad, ingresos y condición PEP (21 artes, **todos ⛔ CANDIDATA**)

> **Ninguno de estos 21 artes es implementable.** `approval_status = CANDIDATA`,
> `approved_for_development = false`, y `pending_gates` lo declara: *«Existen 21
> estados visuales, pero ninguno tiene aprobación final para implementación»*.
> **D-41: 03E no se implementa hasta tener arte aprobado.** Se describe acá
> para que, cuando llegue la versión aprobada, se pueda comparar contra lo que
> se recibió — y porque de estas pantallas salen los cinco catálogos laborales
> y la pregunta PEP, que sí están definidos.

Etapa **3 de 5** (tres puntos rojos) — la numeración que ANALISIS.md §4 usa
para corregir el `4 de 5` de 03E2.

### 9.1 Esqueleto común

1. **Titular**: `Actividad e` (navy) / `ingresos` (**rojo**), dos líneas.
   Bajada de una línea: `Complete su información laboral y económica.`
   ⚠ usted → voseo. **Ilustración**: busto de persona de línea navy con un
   **maletín** delante y, a la derecha, una **pila de monedas con ✓ en un
   círculo**; dos destellos rojos. Sobre óvalo azul clarísimo.
2. **Barra de plan seleccionado.**
3. **Rótulo `INFORMACIÓN LABORAL`** + cinco campos **a ancho completo, uno por
   fila** (a diferencia de 03D, que va a dos columnas):
   `Situación laboral` · `Actividad económica` · `Ocupación u oficio` ·
   `Profesión` (los cuatro, desplegables con chevron ⌄) y
   `Empresa o empleador` (texto con ✎).
   - `Empresa o empleador` arranca **deshabilitado**, fondo gris, con el
     marcador **`Se habilita cuando corresponda`**.
   - Debajo de ese campo, en azul ~12 px:
     `Obligatorio para Empleado (dependiente) y Propietario/Accionista.`
4. **Rótulo `INFORMACIÓN ECONÓMICA`** + dos campos en fila:
   `Ingreso mensual declarado` (texto con ✎, marcador `Complete este campo`) y
   `Origen de ingresos` (desplegable). Debajo del segundo, en azul ~12 px:
   `Seleccione un solo origen de ingresos.`
5. **Rótulo `CONDICIÓN PEP`** + **tarjeta de pregunta** idéntica en forma a las
   de 04A: enunciado a la izquierda en dos líneas — `¿Es una Persona Expuesta
   Políticamente (PEP) o mantiene un vínculo con una persona PEP?` — y los dos
   botones `SÍ` / `NO` a la derecha. **Seleccionado, el botón se pinta navy
   pleno con texto blanco** (así se ve el estado activo de este control, que en
   04A nunca aparece elegido).
6. **Enlace centrado `¿Qué significa PEP?`**, azul subrayado → abre 03E1.
7. **Aviso azul `INFORMACIÓN IMPORTANTE`** con ⓘ: `Si responde "Sí", podrá
   completar esta pantalla y continuar. Interseguros S.A. remitirá la solicitud
   a Alianza Garantía para evaluación manual, sin rechazo automático.`
   Con `SÍ` elegido, **este bloque se reemplaza** por el aviso rojo descrito en
   9.2/15.
8. **CTA `CONTINUAR`** (gris/roja) + `Información legal`.

### 9.2 Los 21 estados

| # | `state_code` | Qué muestra |
| :-- | :-- | :-- |
| **00** | `inicial` | Los seis desplegables vacíos, `Empresa o empleador` deshabilitado con `Se habilita cuando corresponda`, PEP sin responder, CTA gris. |
| **01** | `menu-situacion-laboral` | **Hoja inferior** (mismo componente que 03D) con título `SITUACIÓN LABORAL`, **sin buscador**, y **7 filas**: `Empleado (dependiente)` · `Propietario/Accionista` · `Independiente/Profesional independiente` · `Jubilado` · `Estudiante` · `Desempleado` · `Trabajador del hogar`. Pie: `7 opciones disponibles`. |
| **02** | `empleado-empresa-habilitada` | `Situación laboral = Empleado (dependiente)`; **`Empresa o empleador` se habilita** (fondo blanco, ✎, marcador `Complete este campo`). Los otros tres desplegables siguen vacíos. |
| **03** | `propietario-empresa-habilitada` | Idéntico con `Propietario/Accionista`. Son las **dos únicas** situaciones que habilitan el campo. |
| **04** | `estudiante-autocompletado` | `Estudiante` ⇒ `Actividad económica = No aplica`, `Ocupación u oficio = Estudiante`, `Empresa o empleador = No aplica` **y deshabilitado**. `Profesión` queda **vacía y editable**. |
| **05** | `desempleado-autocompletado` | `Desempleado` ⇒ `No aplica` / `Sin ocupación actual` / `No aplica`. |
| **06** | `trabajador-hogar-autocompletado` | `Trabajador del hogar` ⇒ `No aplica` / `Trabajador del hogar` / `No aplica`. |
| **07** | `jubilado-autocompletado` | `Jubilado` ⇒ `No aplica` / `Jubilado` / `No aplica`. |
| **08** | `menu-actividad-economica` | Hoja inferior `ACTIVIDAD ECONÓMICA`, **con buscador** (`Buscar actividad`), 8 filas visibles: `No aplica` · `Comercio` · `Servicios` · `Industria` · `Construcción` · `Agro` · `Transporte` · `Salud`. Pie: `15 opciones disponibles`. |
| **09** | `menu-ocupacion-oficio` | `OCUPACIÓN U OFICIO`, buscador `Buscar ocupación u oficio`, 8 visibles: `Estudiante` · `Sin ocupación actual` · `Trabajador del hogar` · `Jubilado` · `Empleado administrativo` · `Gerente` · `Supervisor` · `Encargado`. Pie: `28 opciones disponibles`. |
| **10** | `menu-profesion` | `PROFESIÓN`, buscador `Buscar profesión`, 8 visibles: `Médico` · `Odontólogo` · `Farmacéutico` · `Bioquímico` · `Psicólogo` · `Ingeniero` · `Arquitecto` · `Economista`. Pie: `23 opciones disponibles`. |
| **11** | `menu-origen-ingresos` | `ORIGEN DE INGRESOS`, **sin buscador**, 8 visibles: `Apoyo familiar/manutención` · `Salario` · `Honorarios/servicios` · `Utilidades/empresa` · `Comisiones` · `Alquileres` · `Pensión/jubilación` · `Herencia/donación`. Pie: `10 opciones disponibles`. **Un solo origen**, como dice la nota del campo. |
| **12** | `03E1` · `que-significa-pep` | **Pantalla propia, no hoja inferior**: ocupa todo bajo la cabecera (**sin stepper**), con título `¿Qué significa PEP?` navy bold ~30 px, ✕ circular azul, bajada `Información sobre esta declaración.`, regla fina y tres tarjetas azul clarísimo: `PERSONA EXPUESTA POLÍTICAMENTE` — `Es quien desempeña o ha desempeñado una función pública relevante, o quien mantiene un vínculo comprendido por las reglas aplicables con una persona PEP.`; `¿POR QUÉ LO PREGUNTAMOS?` — `Esta información forma parte de las verificaciones requeridas para evaluar la solicitud y aplicar los controles correspondientes a la contratación.`; `SI RESPONDE "SÍ"` — `Podrá completar esta pantalla. Al seleccionar CONTINUAR, Interseguros S.A. remitirá su solicitud a Alianza Garantía para evaluación manual. No será rechazada automáticamente y no se solicitarán firma ni pago mientras el caso esté pendiente.` Cierra con un aviso azul con ⓘ: `Seleccione X para cerrar este panel y regresar a Actividad e ingresos. La información ingresada permanecerá sin cambios.` |
| **13** | `datos-completos-pep-pendiente` | Todo lleno (`Empleado (dependiente)`, `Servicios`, `Empleado administrativo`, `Administrador`, `Interseguros S.A.`, `Gs. 9.500.000`, `Salario`) pero **PEP sin responder** ⇒ **CTA gris**. Es la prueba de que la PEP es obligatoria. |
| **14** | `lista-pep-no` | `NO` en **navy pleno**; aviso azul sin cambios; **CTA roja**. |
| **15** | `lista-pep-si` | `SÍ` en navy pleno; el aviso azul **se reemplaza** por uno **rojo** (fondo rosa, borde rojo, **ⓘ circular rojo**) con título `SU SOLICITUD REQUERIRÁ REVISIÓN MANUAL` en rojo bold versalitas y cuerpo en rojo: `Al seleccionar CONTINUAR, Interseguros S.A. remitirá su solicitud a Alianza Garantía para evaluación manual. No se solicitarán firma ni pago mientras el caso se encuentre pendiente.` **CTA roja**: con `SÍ` **también se continúa** — lo que cambia es adónde. |
| **16** | `campo-obligatorio-faltante` | `Profesión` vacía con **borde rojo**; franja de error bajo el aviso: `PROFESIÓN ES OBLIGATORIA.` / `Seleccione una opción para poder continuar.` CTA gris. |
| **17** | `empresa-condicional-faltante` | `Empresa o empleador` vacío y en rojo, **y su nota de ayuda se pinta roja y en bold** (`Obligatorio para Empleado (dependiente) y Propietario/Accionista.`). Franja de error: `EMPRESA O EMPLEADOR ES OBLIGATORIO.` / `Complete el campo para la situación laboral seleccionada.` |
| **18** | `ingreso-no-valido` | `Ingreso mensual declarado` con `Gs. -100.000` y borde rojo; franja: `INGRESO MENSUAL NO VÁLIDO.` / `Declare el monto mensual que corresponda en guaraníes.` |
| **19** | `validando-pep-no` | CTA gris con anillo de carga y `VALIDANDO DATOS…` (mismo componente que 03D_12). |
| **20** | `registrando-revision-pep-si` | CTA gris con anillo de carga y **`REGISTRANDO REVISIÓN…`** — rótulo distinto del anterior, y el que lleva a 03E2. |

### 9.3 Catálogos que deja fijados (pendientes de aprobación)

| Campo | Buscador | Total | Primeras opciones |
| :-- | :-- | :-- | :-- |
| Situación laboral | no | **7** | Empleado (dependiente) · Propietario/Accionista · Independiente/Profesional independiente · Jubilado · Estudiante · Desempleado · Trabajador del hogar |
| Actividad económica | sí | **15** | No aplica · Comercio · Servicios · Industria · Construcción · Agro · Transporte · Salud |
| Ocupación u oficio | sí | **28** | Estudiante · Sin ocupación actual · Trabajador del hogar · Jubilado · Empleado administrativo · Gerente · Supervisor · Encargado |
| Profesión | sí | **23** | Médico · Odontólogo · Farmacéutico · Bioquímico · Psicólogo · Ingeniero · Arquitecto · Economista |
| Origen de ingresos | no | **10** | Apoyo familiar/manutención · Salario · Honorarios/servicios · Utilidades/empresa · Comisiones · Alquileres · Pensión/jubilación · Herencia/donación |

**Las listas completas no están en el paquete**: los artes muestran 7-8 filas y
el pie declara el total. Hay que pedirle a Interseguros los cinco catálogos
completos junto con el arte aprobado — igual que existe el JSON de 03D. Los ocho
campos coinciden con `functional_contract.work_income_candidate.fields`.

---

## 10. Inventario de componentes: lo que hay que construir una sola vez

De los 103 artes salen **19 componentes**. Ninguna pantalla puede redefinirlos
por su cuenta —es la regla que ya rige en `CLAUDE.md` para la cabecera y el
stepper—, y la mitad de las inconsistencias detectadas (§11) existen justamente
porque en el arte se dibujaron dos veces.

| # | Componente | Variantes | Dónde aparece |
| :-- | :-- | :-- | :-- |
| 1 | `CabeceraInstitucional` | 2 marcas / 3 marcas; con filete rojo (flujo) o sin él (01, 02) | todas |
| 2 | `Stepper` | 5 puntos + `N de 5`; sin stepper en 01, 01A/B y 03E1 | 02 en adelante |
| 3 | `BarraPlanSeleccionado` | única | 03A en adelante |
| 4 | `TitularConIlustracion` | 1 o 2 líneas, mitad navy + mitad roja; 9 ilustraciones distintas | todas las de flujo |
| 5 | `Modal` (hoja alta con filete rojo) | con pestañas (02A-C), con desplazamiento (02B, 02C, 03B_02) | 01A, 01C-E, 02A-C, 03B |
| 6 | `PanelLateral` | único | 01B |
| 7 | `DialogoConfirmacion` | centrado (01B salida) / en el hueco de una tarjeta (03E2A) | 01B, 03E2A |
| 8 | `HojaInferiorDeOpciones` | con o sin buscador; pie `N opciones disponibles` | 03D (4), 03E (5) |
| 9 | `DesplegableEnLinea` | panel bajo el campo | 03D (sexo, estado civil) |
| 10 | `CampoTexto` | normal / con ✎ / bloqueado con 🔒 / con error (borde rojo) / con marca `EDITADO` | 03D, 03E, 04A |
| 11 | `AvisoAzul` | con o sin título; ⓘ azul o **ⓘ rojo** (04A, 04D, 03E_15) | todas |
| 12 | `AvisoRojo` | ❗ circular rojo; título versalitas rojo | 03A, 03B, 03C, 03E |
| 13 | `FranjaVerdeDeExito` | ✓ circular verde + texto verde bold | 03A |
| 14 | `FranjaDeError` | sin ícono, dos líneas rojas en bold | 03D, 03E |
| 15 | `BotonPrincipal` | rojo pleno / **deshabilitado** / con anillo de carga (izquierda en 03A y 03D, derecha en 03C) | todas |
| 16 | `BotonSecundario` | blanco con borde navy | 01B, 03C, 01 (cookies) |
| 17 | `CasillaConsentimiento` | marcada **navy** (03A) o **roja** (03B) — hay que elegir una | 03A, 03B, 04D |
| 18 | `ParSiNo` | dos botones cuadrados; seleccionado = navy pleno | 04A, 03E |
| 19 | `TarjetaCapturaBiometrica` | 4 píldoras de estado × 1 o 2 botones | 03C |

Y **dos componentes de pantalla completa**: la cámara de 03C (01, 04, 07) y la
pantalla de resultado terminal (03D_13, 03E2B).

---

## 11. Lo que hay que corregir del arte (no se copia tal cual)

Estas 14 cosas están **en el arte** y **no se reproducen**, porque el manual
(D-28), una decisión de Andres o una regla inviolable manda sobre ellas. Cada
una tiene su lugar exacto en las secciones de arriba.

| # | Dónde | Qué dice el arte | Qué se implementa |
| :-- | :-- | :-- | :-- |
| 1 | Todo el paquete | usted (`Elija`, `Complete`, `Verifique`, `Su`) mezclado con tú en 03E2/04A1 | **voseo en todo** (D-35) |
| 2 | 03A_03 / 03A_04 | reenvío en `00:30` (y `00:51` en otras versiones) | **60 s** (manual) |
| 3 | 03A_11 | «WhatsApp» en título y botón con el código enviado por SMS | «número de celular» / `VERIFICAR Y CONTINUAR` |
| 4 | 02 vs. 03B | deshabilitado gris vs. rojo pálido | **un solo estado** del componente |
| 5 | 03A vs. 03B | casilla marcada navy vs. roja | **un solo color** |
| 6 | 02 | `1 dia` sin tilde (×2) | `1 día` |
| 7 | 01C vs. 01D | `N.° 118` vs. `N.º 118` | **`N.º`**, como `entidades.ts` |
| 8 | 02 vs. 02A | `Inicio de vigencia` vs. `Inicio de cobertura` | **«Inicio de cobertura»** |
| 9 | 02 | «Premio total anual» (arte) vs. «prima anual» (manual) | **pendiente de Rodrigo**; una sola palabra |
| 10 | 04A y 04D | `CONTINUAR` roja con todo vacío | **arranca deshabilitada** |
| 11 | 03C_25 | botones del frente activos durante el bloqueo | **deshabilitados** los 5 minutos |
| 12 | 03D_11 | `EDAD CALCULADA: 42 AÑOS` con fecha inválida | **se oculta** la edad |
| 13 | 03E2 / 03E2A / 03E2B | `4 de 5` | **`3 de 5`** (el flujo se detuvo en la etapa 3) |
| 14 | 03D_06 | `Otra ciudad o localidad` como 7.ª fila | **al final** de las 44 |

Además, **tres divergencias de fondo** que exceden a una pantalla y necesitan
decisión antes de portar:

- **`VIVE` vs. `CONFÍO`.** Todo v4 nombra al producto `Seguro de Vida
  Oncológico VIVE`, con planes `VIVE` / `VIVE+` / `VIVE TOTAL`; el repositorio
  dice **CONFÍO**. Toca catálogo, PDF, textos legales y `entidades.ts`.
- **Carga de archivo en 03C.** El arte la ofrece para frente y dorso **sin
  condicionarla a modo demo**; hoy solo existe con `DEMO_MODE=true`. Con D-40
  (no hay proveedor que detecte alteración documental) abrirla en producción
  empeora el riesgo que 03C_19 dice cubrir.
- **Edición de cédula y fecha de nacimiento** (03D): el JSON las declara
  editables. **D-31 ya lo resolvió**: se editan y se registran, pero
  **elegibilidad y bloqueo se calculan con el valor del OCR**.

---

## 12. Cobertura: los 103, por dónde caen

| Código | Artes | Aprobados | Candidatos | Tipo | ¿Implementable? |
| :-- | --: | --: | --: | :-- | :-- |
| 01 | 2 | 1 | 1 | vista | sí (la aprobada) |
| 01A | 1 | 1 | — | detalle | sí |
| 01B | 2 | 2 | — | modal + vista | sí |
| 01C · 01D · 01E | 3 | 3 | — | detalle | sí |
| 02 | 1 | 1 | — | vista | sí |
| 02A · 02B · 02C | 3 | 3 | — | detalle | sí |
| 03A | 18 | 18 | — | vista | sí |
| 03B | 4 | 4 | — | vista | sí |
| 03C | 27 | 27 | — | 26 vistas + 1 lámina | sí (26) |
| 03D | 15 | 15 | — | 14 vistas + 1 lámina | sí (14) |
| 03E | 20 | — | 20 | vista | **no** (D-41) |
| 03E1 | 1 | — | 1 | detalle | **no** |
| 03E2 · 03E2A · 03E2B | 3 | 3 | — | vista | sí |
| 04A · 04A1 · 04D | 3 | 3 | — | vista | sí |
| **Total** | **103** | **81** | **22** | | **79 vistas + 2 láminas** |

**Faltan cuatro pantallas y ninguna tiene arte**: `03E` (solo candidato),
`04E` revisión y firma, `05A` pago Bancard y `05B` confirmación y emisión. Las
tres últimas ni siquiera tienen candidato. Mientras no lleguen, **el flujo v4
no se puede cerrar**: no hay arte para el acto de firma, para el pago ni para
la confirmación con los descargables.

---

## 13. Verificación de integridad

Los 103 PNG **coinciden con el manifiesto**: el SHA-256 de cada archivo es el
que declara `data/screen_manifest.csv` y `screens.json`. Antes de tomar un arte
como referencia conviene recomprobarlo, que es exactamente para lo que la nota
de programación pide conservar `screen_code + state_code + original_filename`:

```bash
cd docs/v4/SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14 && python3 -c "
import csv,hashlib,sys
malos=[]
for f in csv.DictReader(open('data/screen_manifest.csv',encoding='utf-8-sig')):
    h=hashlib.sha256(open(f['reference_image'],'rb').read()).hexdigest()
    if h!=f['sha256']: malos.append(f['reference_image'])
print('NO COINCIDEN:',malos) if malos else print('los 103 coinciden')"
```

Los PNG **no se versionan** (73 MB, D-28): viven en `docs/v4/`, que está en
`.gitignore`. Este documento es lo que queda en el repositorio cuando el ZIP no
esté a mano.
