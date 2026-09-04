# Especificación de pantallas — SeguroLoTengo (fuente de verdad)

**Adenda del 01-sep-2026 integrada (canvas ce0c8332).**

**Reescrita el 29-ago-2026** contra el diseño aprobado del **flujo de 3 pasos**
(canvas de Claude Design importado en `docs/plan/IMPORTACION_DISENO_3_PASOS.md`,
PR #61) y las once decisiones DI-1…DI-11 del **Bloque E de
`docs/plan/DECISIONES.md`** (PR #62). Este documento manda sobre cualquier otro
en cuanto a qué muestra cada pantalla; donde el Plan v2, la Matriz Legal V4 o el
Bloque E lo contradigan, mandan ellos y acá queda anotado.

> ⚠️ **Documento objetivo — transición en curso.** Esta especificación describe
> la configuración **aprobada y todavía no implementada**. El código en `main`
> implementa hoy el flujo de 8 pasos de la versión anterior de este documento
> (reescritura del 20-ago-2026, recuperable en el historial de git). Como
> siempre, **el orden vigente no vive acá**: vive en `PASOS_FLUJO`
> (`src/domain/rutas-flujo.ts`), y si este texto y esa lista discrepan, gana la
> lista. Cada pantalla de este documento entra en vigencia cuando su lote de
> implementación se mergea.

> **Qué cambió respecto de la versión de 8 pasos.** El wizard pasa de 8 pasos a
> **3 pasos visibles** — `INSCRIBITE` / `ELEGÍ TU SEGURO` / `PAGÁ Y FIRMÁ` —
> más el inicio, la confirmación y la revisión manual fuera del contador. Cada
> paso es **una página larga con secciones que se habilitan en cascada**, no
> una secuencia de pantallas separadas. El cambio de orden estructural:
> **la identidad va primero y el plan después** (DI-2) — el bloqueo por cédula
> (regla inviolable #11) se evalúa al comienzo. Se conservan intactos: el orden
> **firma antes que pago** (D-08, regla 6-bis), el vencimiento a las 24 h sin
> devolución (D-10), el PDF único con un solo hash y un solo acto de firma
> (D-11), el OTP único de canal por WhatsApp (D-06) y los tres medios de pago
> Bancard (D-02).

> **Rutas (provisionales hasta el PR de `PASOS_FLUJO`):** `/inscripcion`,
> `/seguro`, `/pago-y-firma`, más `/inicio` (raíz), `/confirmacion` y
> `/revision-manual`. Las rutas del flujo de 8 pasos (`/plan`, `/whatsapp`,
> `/preparacion`, `/identidad`, `/declaraciones`, `/firma`, `/pago`) responden
> **308** hacia el paso nuevo que absorbió su contenido (ver el mapa de
> trazabilidad en `IMPORTACION_DISENO_3_PASOS.md` §5).

## Elementos comunes a todas las pantallas

**Cabecera fija.** Texto literal de los tres bloques, en este orden:

1. `ASEGURADORA` / `Alianza Garantía Seguros y Reaseguros S.A.` / `Res. SS.SG. N° 118/2003 · producto 15-VI.0002 · Nota SS.SG. N.º 397/2026 (provisional)` — el bloque enlaza a `https://alianzagarantia.com/#/home` (nueva pestaña).
2. `INTERMEDIARIO` / `Interseguros S.A. · Corredores de Seguros` / `Matrícula CS N° 0142 · Res. SS.SG. N° 072/2019 (provisional)` — enlaza a `https://interseguros360.com/`.
3. `CANAL DIGITAL` / `SeguroLoTengo.com` / `Marca de Interseguros S.A. · Res. SS.SG. N° 311/2026 (provisional)` — con el sello `SLT` (recuadro 38 × 38, borde 2 px `accent-600`, radio 12, texto acento 700). **Solo en el Inicio** (el canvas lo condiciona a `esInicio`); en los pasos, la cabecera tiene dos bloques. Enlaza a `https://www.segurolotengo.com`.

Las referencias regulatorias se muestran **con el sufijo `(provisional)`**
(DI-4).

Las referencias regulatorias que la cabecera imprime (`Res. SS.SG. N° 118/2003`,
`Matrícula CS N° 0142 · Res. SS.SG. N° 072/2019`, `Res. SS.SG. N° 311/2026`,
`producto 15-VI.0002 · Nota SS.SG. N.º 397/2026`) son **marcadores provisionales de la maqueta**
(DI-4): se implementan parametrizadas y rotuladas, y no se publican como
definitivas hasta el dato oficial de Alianza. Lo mismo aplica a la
`Res. SS.SG. N° 250/2026` del paso 2.

**Stepper (tres posiciones):** `1 INSCRIBITE · 2 ELEGÍ TU SEGURO · 3 PAGÁ Y
FIRMÁ`. El paso actual va resaltado; los completados llevan ✓. **El stepper
recibe el slug de la pantalla, nunca un número**: el orden y la pertenencia a
un paso visible se derivan de `PASOS_FLUJO`. Inicio, confirmación y revisión
manual van **fuera del contador**.

**Botón de tema día/noche** en la cabecera (`☾ Modo noche` / `☼ Modo día`),
como hoy: preferencia cosmética en `localStorage`, sin evidencia.

**Saludo por nombre de pila:** desde que el OCR leyó la cédula, los títulos se
personalizan (`Inscribite con nosotros, Ana`, `Después, el pago, Ana`,
`¡Listo, Ana! Tu familia ya está protegida`). El nombre sale del expediente,
nunca de un campo editable suelto.

**Gating en cascada:** dentro de cada paso, las secciones bloqueadas muestran
qué falta con rótulo propio (`Se habilita cuando confirmes tus datos de
identidad.`, `Se habilita cuando declares tu correo dos veces iguales y
verifiques tu WhatsApp.`, `Se habilita cuando completes tus datos
complementarios.`). Los botones de continuar arrancan deshabilitados; al
intentar avanzar con faltantes se muestra `Te falta: …` y el botón
`Mostrame qué me falta` desplaza al primer campo faltante, marcado en rojo con
asterisco. El patrón se repite en los tres pasos y en el formulario de tarjeta.

**Pie legal (todas las pantallas):** bloque expandible. Rótulo del
desplegable: `INFORMACIÓN LEGAL Y REGULATORIA ▾` (abierto: `▴`). Cuerpo:

> SeguroLoTengo.com es marca y canal digital de Interseguros S.A. — Corredores
> de Seguros. La aseguradora es Alianza Garantía Seguros y Reaseguros S.A.
> Producto inscrito: Seguro de Vida Oncológico CONFÍO, 15-VI.0002 · Nota SS.SG. N.º 397/2026 ·
> Res. SS.SG. N° 250/2026. Firma electrónica del cliente: simple, autenticada
> por código de un solo uso; las firmas institucionales son cualificadas.
> Pagos procesados por Bancard directamente a favor de la aseguradora. La
> cobertura comienza 24 horas después del pago confirmado, una vez completada
> la contratación.

Estado del texto: **provisional** (pendiente de Legal, L6 —
`docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md`); los identificadores
`15-VI.0002 · Nota SS.SG. N.º 397/2026` y `Res. SS.SG. N° 250/2026` son marcadores DI-4 y se
muestran con el sufijo `(provisional)`. En el producto vive en
`src/domain/textos-legales.ts` (`IDENTIFICACION_CANAL`) con versión.

**Los siete enlaces no tienen URL** —Términos y condiciones · Aviso de
privacidad · Coberturas, exclusiones y carencias · Condiciones generales ·
Consultas y reclamos · Derecho de retracto · Verificación de documentos—:
abren el modal de aclaraciones (`AclaracionModal`) sin abandonar la pantalla.
`/retracto` y `/verificar/<código>` conservan además su página propia. El
contenido de los modales sale de `src/domain/textos-aclaraciones.ts`, que
manda sobre esta tabla cuando difieran.

| Enlace | Título del modal | Meta | Secciones (título — texto) |
| :--- | :--- | :--- | :--- |
| Términos y condiciones | Términos y condiciones de uso de SeguroLoTengo.com | Versión 4.0 · vigente desde agosto de 2026 | QUIÉN OPERA EL SITIO — SeguroLoTengo.com es marca y canal digital de Interseguros S.A. — Corredores de Seguros. Los seguros ofrecidos son emitidos por Alianza Garantía Seguros y Reaseguros S.A. · USO PERSONAL — La contratación es únicamente a nombre propio, con cédula de identidad paraguaya vigente, y requiere ser mayor de 18 años y menor de 65 al momento del ingreso. · CANALES VERIFICADOS — El WhatsApp y el correo declarados se verifican con un código de un solo uso y se utilizan para entregar documentos y notificaciones. Ningún operador solicita ese código por llamada. · FIRMA ELECTRÓNICA — La firma del cliente es electrónica simple autenticada por código de un solo uso. Las firmas de Interseguros y Alianza son cualificadas. · PAGOS — Los pagos se procesan por Bancard a favor de la aseguradora. El portal no almacena datos de tarjetas. |
| Aviso de privacidad | Aviso de privacidad y tratamiento de datos | Versión 4.0 · responsables: Interseguros S.A. y Alianza Garantía | DATOS QUE TRATAMOS — Datos de identificación extraídos de la cédula, imagen facial y prueba de vida, datos de contacto, laborales y de ingresos, declaraciones de salud y condición de persona expuesta políticamente. · PARA QUÉ — Validar identidad, evaluar el riesgo, emitir la póliza, prevenir fraude y cumplir obligaciones de la normativa de seguros y de prevención de lavado de activos y financiamiento del terrorismo. · CON QUIÉN SE COMPARTEN — Con la aseguradora, el proveedor de firma electrónica, el procesador de pagos Bancard y las autoridades que lo requieran conforme a la ley. · CONSERVACIÓN Y DERECHOS — Los datos se conservan por los plazos legales aplicables. Podés solicitar acceso, rectificación o supresión, y revocar los consentimientos opcionales, escribiendo a los canales de Interseguros. |
| Coberturas, exclusiones y carencias | Ver `canvas-modales.md` (`coberturas`) | — | Ver `canvas-modales.md`. |
| Condiciones generales | Ver `canvas-modales.md` (`condiciones`) | — | Ver `canvas-modales.md`. |
| Consultas y reclamos | Consultas y reclamos | Atención de Interseguros S.A. y Alianza Garantía | Ver `canvas-modales.md`. **Los datos de contacto (teléfonos, correos, horarios) NO se copian**: van como `[dato oficial pendiente]` (`higiene-de-citas.test.ts`). |
| Derecho de retracto | Ver `canvas-modales.md` (`retracto`) | — | Ver `canvas-modales.md`. |
| Verificación de documentos | Ver `canvas-modales.md` (`verificacion`) | — | Ver `canvas-modales.md`. |

Pie de todos los modales: `Texto de muestra para la demostración del flujo.`
(`canvas-modales.md` vive en `docs/rediseno-lovable/semilla/canvas/`.)

**Visor de documentos (modal):** los botones `Ver PDF` abren el documento en un
modal con título, metadatos (`código · páginas · SHA-256` cuando aplica),
secciones y pie. En modo demo el visor rotula `VISTA DE MUESTRA` y aclara que
el contenido es ilustrativo.

**Paleta, tipografía y dibujo:** los tokens son los de
`docs/GUIA_DE_ESTILOS.md` (DM Sans, naranja/azul/verde/rojo/hueso,
semánticos). **El dibujo de cada pantalla** —tamaños, radios, espaciados,
rejillas, estados— es el del canvas aprobado «Seguro lo tengo: Flujo de 3
pasos» (Artifact ce0c8332), tal como está en
`docs/rediseno-lovable/semilla/canvas/` (`canvas-plantilla.html`,
`canvas-estilos.css`, `canvas-reglas-visuales.md`). El canvas no usa
Archivo, ni acento rojo, ni esquinas rectas: esos valores son la base
«Modernist» que su propia capa de estilo redefine (ver
`canvas-reglas-visuales.md` §1).

### Divergencias con el canvas que se mantienen

Para que nadie las «corrija» hacia el canvas:

- Beneficiario: el canvas pide cédula, fecha de nacimiento y celular; **no se
  piden** (DI-7, Res. SIS 215/17 num. 11.4). Solo nombre, parentesco,
  domicilio.
- «Formulario de Información Previa a la Firma»: error del canvas; el FIPF
  es el Formulario de Identificación de Persona Física (DI-1).
- Datos de contacto, `CASO-2026-004518`, resoluciones: marcadores, nunca los
  del canvas.
- «La firma se realiza con el proveedor de firma electrónica»: en v3 la
  firma del cliente es interna (D1); el texto del canvas está desactualizado.
- Cadencia del carrusel: 3 s, no 4,5 s.

---

## Inicio — `/` (fuera del contador)

Página pública informativa. **No solicita datos médicos ni PEP, no genera
propuesta, no cobra, no emite póliza.** Reemplaza a la P0 del flujo anterior.

- **H1:** `Protege a tu familia, consigue su tranquilidad en 3 pasos` — bajada: `Todo desde tu celular, en unos minutos. Respaldado por Alianza Garantía e intermediado por Interseguros.`
- **Carrusel.** Los cuatro rótulos, en orden, con su foto:

  | # | Foto | Rótulo (y `alt`) |
  | :- | :--- | :--- |
  | 1 | `hero-inscribite.jpg` | `Inscribite con nosotros` |
  | 2 | `hero-seguro.jpg` | `Elegí tu seguro` |
  | 3 | `hero-paga-firma.jpg` | `Pagá y firmá` |
  | 4 | `hero-protege.jpg` | **`Protege a tu familia`** |

  Cadencia: 3 s por foto (pedido de Andres del 01-sep; el canvas publicado usa
  4,5 s), cruce de 0,7 s, cuatro puntos indicadores bajo el cuadro (acento el
  activo, `neutral-400` los demás), recorte `center 40%`, cuadro `16/9` con
  radio 16. Alt de las fotos de paso: `Familia paraguaya reunida` (pasos 1–3)
  y `Familia abrazándose junto a la póliza emitida` (confirmación).
- **Los 3 pasos explicados** (tarjetas numeradas):
  1. `Inscribite con nosotros` — `Fotografiás tu cédula, leemos tus datos y vos los confirmás.`
  2. `Elegí tu seguro` — `Compará los tres planes y respondé cuatro preguntas.`
  3. `Pagá y firmá` — `Firma electrónica y pago seguro por Bancard.`
- **`ANTES DE EMPEZAR`:** `Usamos tu WhatsApp y tu correo solo para esta contratación: verificación, firma y entrega de documentos. Los datos quedan entre Interseguros S.A. y Alianza Garantía y no se ceden a terceros con fines comerciales.`
- **Casilla de Términos y condiciones** (`Tocá acá para aceptar los términos y condiciones` → `✓ Términos y condiciones aceptados`) + enlace `Ver qué datos usamos y para qué`. La casilla habilita el CTA.
- **CTA:** `Tocá acá para empezar →`. Guía contextual: sin T&C aceptados, `Aceptá los términos y condiciones para continuar.`; con ellos, `Tené a mano tu cédula vigente y tu celular con cámara.`
- **Pie:** `Esta página es informativa. La contratación comienza recién en el paso 1 y la aceptación contractual ocurre al firmar.`

**Reglas del sistema:**

- **La aceptación de T&C genera evidencia** (DI-10): fecha, hora, IP y versión
  del texto, y es el acto que **crea el expediente** (`INICIADO`) antes del
  paso 1. Regla inviolable #10.
- Con un trámite ya empezado, el CTA lleva al paso donde quedó (o a la
  pantalla terminal que explica qué pasó), según `destinoDelExpediente` —
  misma mecánica de reencaminado del flujo anterior.

---

## Paso 1 · Inscribite — `/inscripcion`

**Título:** `Inscribite con nosotros{, nombre}` — encabezado: `Acá no se firma
nada ni se cobra nada: leemos tu cédula, vos confirmás los datos y verificamos
tu identidad.`

**Bloque `IMPORTANTE`:** `El código de verificación que te pediremos vence en 5
minutos y nadie te lo va a pedir por llamada. Las fotos de tu cédula y tu
selfie viajan cifradas y tus datos los ven únicamente Interseguros y Alianza
Garantía.` + enlace `Ver cómo cuidamos tus datos`.

### Sección 1 — Tu documento (`PRIMERO · TU DOCUMENTO`)

**Título:** `{nombre,} empecemos por tu cédula` — `Fotografiá tu cédula vigente
y hacé una selfie en vivo. De la cédula leemos automáticamente tus datos y
después los revisás. Solo cédula paraguaya y únicamente a tu nombre.`

- Tres capturas (frente, dorso, selfie en vivo), cada una con estado y acción;
  al aprobar, `✓ Aprobada`. Rigen las reglas vigentes de P5: parámetros de
  `identidad-parametros.ts`, MRZ, `CAPTURA_SOLO_DESDE_CAMARA` con la excepción
  de `DEMO_MODE`, tres intentos y salida a `/asistencia-identidad`.
- Botón `Tocá acá para leer los datos de mi cédula →`. Guía: `Primero completá
  las tres capturas de arriba.` / `Tarda unos segundos.` Durante el OCR:
  `Leyendo tu cédula… estamos extrayendo nombre, número y fecha de nacimiento.`
- Resultado: `✓ Leímos tu cédula y tu selfie coincide. Revisá abajo lo que
  extrajimos: podés corregir todo, salvo el número de cédula y la fecha de
  nacimiento, que quedan tal como figuran en el documento.`

**`DATOS DE IDENTIDAD`** — `Extraídos de tu cédula y confirmados con tu selfie
en vivo. Los campos marcados en rojo son los que todavía faltan completar.`

- **No editables:** `Número de cédula · no editable`, `Fecha de nacimiento · no editable` (de ellos cuelgan el bloqueo por cédula y el corte de edad — regla #8 y #11).
- **Editables/seleccionables:** Nombres, Apellidos, Sexo (**no se pregunta** — D-25, 04-sep-2026: se toma del MRZ de la cédula y se conserva porque el modelo registrado de la Solicitud lo imprime; la decisión del 21-ago de elegirlo a mano queda sin efecto), Nacionalidad, País de nacimiento, País de residencia, Estado civil. Las correcciones se cotejan contra lo leído (CHG-15).
- Leyenda: `La edad de ingreso admitida es de 18 a 64 años y se calcula con la fecha de nacimiento de tu cédula.`
- En `DEMO_MODE`: botón `Completar el resto con datos de ejemplo (demo)`, con los datos de `personas.ts` (DI-9 — los de la maqueta no entran al código).

> **Nota de implementación (lote F2, 30-ago-2026).** El correo (doble tipeo) y
> los datos complementarios se implementaron **dentro de la sección 1**, junto
> con el documento: son el envío único que el caso de uso de identidad valida
> y asienta, y partirlo habría duplicado endpoints y evidencias sin cambiar
> ninguna garantía. Los gates que importan se conservan — sin identidad no hay
> OTP, sin OTP no hay aceptación. Decisión de Andres del 30-ago (opción
> «agrupado pragmático»); si el orden visual del canvas se quiere literal, se
> refina en un lote posterior. Además, el **ítem 3 de la aceptación agrupada**
> (biometría) se acepta también inline, **antes** de capturar — aceptar la
> biometría después de haberla hecho sería un consentimiento retroactivo; el
> ítem del expandible queda como ratificación (matiz de DI-8). La casilla de T&C vivió
> como puerta provisional arriba de esta pantalla hasta el lote F5 (31-ago),
> que la mudó a su página definitiva: el inicio en la raíz `/`.

### Sección 2 — Tus canales (`TUS CANALES`, gated por identidad)

**Título:** `{nombre,} verificá tu WhatsApp personal` — `Por acá recibís la
póliza, la factura y el enlace de firma. El código solo verifica tu canal: no
contrata, no firma y no autoriza ningún cobro.`

- `Celular (WhatsApp)`: campo con ejemplo (`Ej.: +595 981 000 000`) y botón `Tocá acá para recibir el código por WhatsApp`. Guía sin número completo: `Escribí primero tu celular completo (…) y te enviamos el código.`
- Casillas del código: 6 dígitos; reloj `vence en M:SS`, contador `reenvíos N de 3`, enlace `Reenviar código` (al agotarse: `Sin reenvíos disponibles`). Verificado: `✓ WhatsApp verificado · +595 ••• ••• 000`.
- **Autorizar es presionar el botón de envío** (decisión del 20-ago que se conserva): ese acto registra la evidencia del consentimiento del canal. La pantalla no avanza sola al completar las casillas.
- `Correo electrónico` + `Repetí tu correo` (doble tipeo, D-06). Si difieren: `Los dos correos todavía no coinciden — revisalos con calma.` Sin OTP de correo; la veracidad la respalda la declaración que se firma en el paso 3.

**Reglas OTP** (regla inviolable #1, sin cambios): 6 dígitos, uso único,
vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos; solo se
persiste el hash (regla #2).

### Sección 3 — Datos complementarios (`DATOS COMPLEMENTARIOS`, gated por canales)

`Los pide la normativa de conocimiento del cliente. Elegí la opción que mejor
te describa.` Campos: Domicilio · Ciudad · Situación laboral · Actividad ·
Profesión · Empresa o empleador · Ingreso mensual estimado (Gs.) · **Origen
principal de los fondos**. Alimentan la sección FIPF del PDF único — el FIPF
es el **Formulario de Identificación de Persona Física** (Res. SEPRELAD 71/19),
DI-1.

### Sección 4 — Aceptación y continuar (`ACEPTACIÓN Y CONTINUAR`, gated por complementarios)

**Una casilla agrupada** (DI-8): `Marcá acá para aceptar todo lo necesario para
inscribirte — autorizaciones de datos, biometría y firma electrónica, en un
solo paso.` + expandible `Ver todo lo que aceptás` con los **siete** ítems:

1. Autorizo usar mi número y mi correo para verificar mis canales, recibir mis documentos y continuar el proceso. Sobre la publicidad y ofertas se confirma aparte, es opcional y te la pedimos al final, en la pantalla de aceptación.
2. Autorizo a Interseguros S.A. y Alianza Garantía a tratar y compartir mis datos personales, de identificación, biométricos, médicos y de condición PEP para validar mi identidad, evaluar el riesgo, gestionar la solicitud y cumplir obligaciones regulatorias.
3. Autorizo la lectura automática de mi cédula, la captura de mi imagen facial y su comparación con la fotografía del documento, junto con la prueba de vida.
4. Declaro que los datos extraídos de mi cédula que confirmé y los que completé son verdaderos y están vigentes.
5. Acepto quedar registrado para firmar electrónicamente mediante el proveedor de firma electrónica que utilice Interseguros (firma electrónica simple autenticada por código de un solo uso).
6. Si la emisión automática no es posible, autorizo el envío del caso a Interseguros y Alianza para su análisis y que puedan contactarme.
7. Declaro que contrato este seguro únicamente para mí y que el WhatsApp y el correo declarados son míos y están bajo mi control.

Enlaces `Aviso de privacidad` y `Términos y condiciones`. Nota: `Esto no
contrata ni autoriza un pago. Se registran fecha, hora, IP y la versión del
texto aceptado.`

**Botón `Tocá acá para continuar al paso 2 →`.**

**Reglas del sistema:** ninguna pantalla nombra al proveedor de firma (el ítem
5 dice «el proveedor de firma electrónica que utilice Interseguros»); el ítem 7
es la regla inviolable #9 en palabras del cliente; la aceptación agrupada deja
**una** evidencia con la versión del texto completo de los siete ítems.

---

## Paso 2 · Elegí tu seguro — `/seguro`

**Título:** `{nombre,} elegí el plan que más te convenga`.

**Tabs de ramos:** `ONCOLÓGICO` (activo) · `VIDA`, `ACCIDENTES PERSONALES`,
`RESPONSABILIDAD CIVIL` con etiqueta `PRONTO`, deshabilitados.

**Leyenda:** `Seguro de Vida Individual Oncológico CONFÍO · producto inscrito
15-VI.0002 · Nota SS.SG. N.º 397/2026 · Res. SS.SG. N° 250/2026. Los importes son premios
anuales finales, IVA incluido. Todavía no estás firmando ni pagando.`
(identificadores provisionales, DI-4).

**Tres planes (valores exactos, aprobados el 20-ago — derogan a los de D-04):**

| Cobertura | CONFÍO | CONFÍO+ | CONFÍO TOTAL |
| :---- | :---- | :---- | :---- |
| Indemnización por cáncer (pago único) | Gs. 50.000.000 | Gs. 75.000.000 | Gs. 100.000.000 |
| Muerte por cualquier causa | Gs. 3.500.000 | Gs. 5.000.000 | Gs. 7.000.000 |
| Renta hospitalaria por día (hasta 15 días por año) | Gs. 500.000 | Gs. 750.000 | Gs. 1.000.000 |
| Gastos médicos por accidente (reembolso hasta) | Gs. 7.000.000 | Gs. 10.000.000 | Gs. 14.000.000 |
| **Premio anual (IVA incluido)** | **Gs. 319.000** | **Gs. 522.500** | **Gs. 726.000** |

Tarjeta seleccionada: badge `✓ SELECCIONADO`, fondo de acento, botón `✓ Plan
elegido`; las otras, `Tocá acá para elegir este plan`. La abreviatura del
guaraní es **`Gs.`** en todo el portal. Al seleccionar plan se guarda el ID de
versión de la oferta y su hash SHA-256 (regla técnica vigente).

**`QUÉ CUBRE Y DESDE CUÁNDO` — `Tu plan {nombre}, en claro`:** las cuatro
coberturas con monto, detalle y carencia:

- `Diagnóstico de cáncer` — `Pago único al confirmarse el diagnóstico cubierto. Carencia de 180 días.`
- `Fallecimiento` — `Por cualquier causa, a tus beneficiarios. Carencia de 1 día.`
- `Renta hospitalaria` — `Hasta 15 días por año de internación. Carencia de 30 días.`
- `Gastos médicos por accidente` — `Reembolso contra comprobantes. Carencia de 1 día.`

Enlaces `Ver coberturas, exclusiones y carencias (PDF)` y `Ver condiciones
generales de la póliza`. Leyenda: `Edad de ingreso: 18 a 64 años. El
diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta
terminar la vigencia contratada.` **Las carencias (180/30/1) son parámetros
provisionales** (DI-4): se implementan parametrizados y rotulados hasta el dato
oficial de Alianza.

**Beneficiario — `{nombre,} ¿a quién protegés?`:** `¿Quién recibiría la
cobertura por fallecimiento? Elegí una de las dos opciones.`

- `Opción por defecto: mis herederos legales` — `no designás a nadie en particular. Si falleces, la cobertura la reciben tus herederos legales según el Código Civil paraguayo — cónyuge, hijos, padres — en el orden y la proporción que la ley establece. No hay datos que completar.`
- `Quiero designar a una persona` — `cobra el 100% de la cobertura por fallecimiento antes que tus herederos legales.` Campos: **Nombre completo del beneficiario, Parentesco (selector), Domicilio del beneficiario** — los que imprime `Solicitud.pdf` (DI-7: ante diferencia mandan los campos de la Solicitud; la cédula, fecha de nacimiento y celular del beneficiario que dibujaba el canvas **no se piden** — no existen en el formulario y cada campo extra es un problema de negocio).
- Leyenda: `Un único beneficiario, que recibe la totalidad de la cobertura por fallecimiento. Podés cambiarlo cuando quieras avisando a Interseguros.`

**Declaraciones — `{nombre,} unas preguntas antes de seguir`:** `Estas
respuestas integran tu propuesta y su FIPF. Respondé con total tranquilidad —
se firman recién en el paso 3.` **Cinco preguntas** con `Sí`/`No`:

| # | Clave | Pregunta | Habilita | Nota expandible |
| :- | :---- | :---- | :---- | :---- |
| 1 | Salud | `{nombre,} ¿te encontrás en buen estado de salud y contratás este seguro sin buscar cubrir una enfermedad o diagnóstico que ya tengas?` | **Sí** | — |
| 2 | Antecedentes | `¿Alguna aseguradora te rechazó, postergó o condicionó una solicitud de seguro similar?` | **No** | — |
| 3 | Enfermedades | `¿Tenés diagnosticado cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, esclerosis, enfermedad autoinmune o inmunodeficiente, hepatitis o cirrosis?` | **No** | — |
| 4 | PEP | `{nombre,} ¿sos una persona expuesta políticamente o estás vinculada a una?` | **No** | `¿Qué significa PEP?` — explicación completa; `responder Sí no impide contratar, solo requiere el análisis de un asesor`. |
| 5 | Carencias | `¿Entendés y aceptás las carencias y el inicio de vigencia? Son los plazos que tienen que pasar antes de poder usar cada cobertura: 180 días para el diagnóstico de cáncer, 30 días para la renta hospitalaria y 1 día para el resto, contados desde que arranca tu cobertura, 24 horas después de confirmado el pago.` | **Sí — bloqueante** | `Ver el detalle completo` — si el evento ocurre dentro del plazo no corresponde indemnización; los plazos corren desde el inicio de vigencia, no desde hoy; preexistencias excluidas; la aceptación queda registrada en la propuesta y el FIPF. |

- Una respuesta incompatible en **1–4** muestra su aviso (`Con esta respuesta tu solicitud pasa a un asesor antes de cualquier pago o firma…`) y habilita el CTA `Tocá acá para enviar mi caso a un asesor →` → **Revisión manual**. Es la regla inviolable #5 con las declaraciones nuevas.
- La **5 en No no deriva: detiene.** Aviso: `Sin esta aceptación no podemos avanzar: es la constancia de que conocés las carencias antes de contratar. Si algo no te queda claro, un asesor te lo explica.`

**Aceptación agrupada 2** (DI-8): `Marcá acá para aceptar las condiciones de tu
plan — vigencia, carencias, entrega digital e intermediación, en un solo paso.`
+ expandible con **cinco** ítems:

1. Declaro que la cobertura comienza 24 horas después del pago confirmado, una vez completadas la contratación y la emisión, y que leí las carencias explicadas arriba (180 días cáncer, 30 días renta hospitalaria, 1 día demás coberturas).
2. Declaro que los datos proporcionados son verdaderos.
3. Acepto recibir la póliza y la factura en mis canales verificados, y disponer de la Propuesta y el FIPF firmados para descarga en SeguroLoTengo.
4. Tomo conocimiento de que Interseguros S.A. es el corredor de esta póliza y de que su remuneración será pagada por Alianza Garantía.
5. Tomo conocimiento de que el diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta finalizar la vigencia contratada.

Enlaces `Condiciones generales` y `Coberturas, exclusiones y carencias`.

**Botón `Tocá acá para continuar al paso 3 →`.**

### El mapa 5→8 (DI-3): qué imprime el PDF

La pantalla pregunta 5; el PDF único conserva **todas** las declaraciones de
`Solicitud.pdf` y el FIPF, con las respuestas derivadas así (con test propio en
dominio):

| Solicitud/FIPF (PDF) | Fuente en pantalla |
| :---- | :---- |
| Declaración médica 1 · Estado de salud | Pregunta 1 |
| Declaración médica 2 · Antecedentes de contratación | Pregunta 2 |
| Declaración médica 3 · Enfermedades diagnosticadas | Pregunta 3 |
| FIPF · Condición PEP | Pregunta 4 |
| Final 1 · Datos verdaderos, completos y actuales | Aceptación 2, ítem 2 (+ ítem 4 de la aceptación del paso 1) |
| Final 2 · Acepto coberturas, sumas, carencias, exclusiones y premio | Pregunta 5 + aceptación 2, ítem 1 |
| Final 3 · Entrega digital (póliza y factura a canales; descarga de Propuesta y FIPF) | Aceptación 2, ítem 3 |
| Final 4 · Licitud de fondos | Aceptación del paso 3, ítem 2 (se firma con el documento) |
| Corredor y remuneración | Aceptación 2, ítem 4 |

Nada de lo que el formulario exige queda sin respuesta; nada se pregunta dos
veces. Las declaraciones cierran su sección del PDF al salir de este paso,
igual que hoy.

---

## Paso 3 · Pagá y firmá — `/pago-y-firma`

**Título:** `{nombre,} pagá y firmá tu contrato` — encabezado: `Firmás primero
y pagás después: así solo te cobramos algo que ya aceptaste.`

**Barra `TU PLAN`:** `Seguro de Vida Oncológico · {plan}` · `{premio}` ·
`premio anual · IVA incluido` · enlace `cambiar plan` (legal solo antes de
cerrar el paquete documental).

### Sección 1 — La firma (`{nombre,} primero, tu firma`)

`Interseguros S.A. te hace una propuesta de seguro: un PDF cerrado con el plan
que elegiste, tus datos y tus declaraciones, acompañado del FIPF. Si estás de
acuerdo, la firmás.`

- Expandible `¿Qué es el FIPF y qué estoy firmando?` — **el texto explica el
  formulario real** (DI-1): el FIPF es el Formulario de Identificación de
  Persona Física exigido por la normativa de prevención de lavado de activos
  (Res. SEPRELAD 71/19): identifica a la persona que contrata —datos
  personales, laborales, económicos, origen de fondos y condición PEP— y viaja
  dentro del mismo PDF que la propuesta, con una sola huella SHA-256. Al
  firmar se acepta la propuesta completa; hasta ese momento no hay contrato ni
  cobro. *(El texto del canvas que lo describía como «Formulario de
  Información Previa a la Firma» era un error de la maqueta y no se
  implementa.)*
- Tarjeta del documento: `Propuesta de Interseguros + FIPF · PROP-{correlativo}` — `PDF cerrado · huella SHA-256 registrada · art. 1556 del Código Civil` + botón `Ver PDF` (visor modal; **sin descarga antes de la firma**, CHG-29 vigente).
- **Aceptación agrupada 3** (DI-8): `Marcá acá para aceptar la propuesta y firmarla — revisión, licitud de fondos y solicitud de firma, en un solo paso.` + expandible con **tres** ítems:
  1. Confirmo que recibí de Interseguros el PDF único con la propuesta y el FIPF, que pude revisarlo y corregir mis datos, que acepto su contenido y que deseo firmarlo electrónicamente.
  2. Declaro que los fondos con los que pagaré este seguro tienen origen lícito.
  3. Entiendo que después de mi firma firman Interseguros y Alianza Garantía (firma cualificada) y recién entonces se habilita el pago, con 24 horas para completarlo.
- **Canal del enlace** (DI-5): `La firma se realiza con el proveedor de firma electrónica, mediante un enlace seguro y personal con un código de un solo uso. Elegí por dónde querés recibirlo:` — `Tocá acá para firmar por WhatsApp · +595 ••• ••• 000` o `Tocá acá para firmar por correo · m••••••@…`. `Solo se envía a los canales que ya verificaste. Ningún operador te va a pedir ese código.` El destino sale del expediente, nunca de un campo que la persona escriba; la evidencia registra a cuál se envió.
- Firmado: `✓ Documento firmado · cliente + Interseguros + Alianza Garantía`.

**Reglas del sistema (sin cambios de fondo):** el paquete se cierra y hashea
antes de habilitar la firma (regla #4); un solo acto de firma sobre el PDF
único (regla #3, D-11); firmantes y orden desde `firmantes-documento.ts`
(D-13, cliente simple primero → institucionales cualificadas), con
`FIRMADO_CLIENTE` como estado intermedio visible; la confirmación llega por
sondeo o retorno del navegador, idempotente por `session_id` (CHG-33); ninguna
pantalla nombra al proveedor de firma; **no se genera Nota de Cobertura**.

### Sección 2 — El pago (`Después, el pago{, nombre}`)

`El pago se habilita apenas firmes — es la garantía de que solo pagás lo que ya
aceptaste.` · `Bancard procesa el pago directamente a favor de Alianza
Garantía. Tenés 24 horas; si no pagás, no hay nada que devolver y podés empezar
de nuevo.` (D-10).

- **Datos para la factura** (DI-6 — captura para remitir a Alianza con el caso, CHG-47; la factura la emite Alianza por SIFEN, fila 40): `Factura a nombre de` (autocompletado con el asegurado, regla #9) · `Documento para la factura` · `RUC (opcional)` — si queda vacío, viaja la cédula del asegurado y la pantalla lo dice (CHG-34).
- **Liquidación:** `Prima neta anual` · `IVA` · `Premio total anual` — `Apertura provisional hasta el desglose oficial de Alianza.` (D-04; el canvas calcula prima neta = premio/1,1 y es igual de provisional).
- **Medios (los tres cobran el premio total en el momento, D-02):** `QR Bancard` (por defecto) · `Tarjeta de débito` · `Tarjeta de crédito`. Botón según medio: `Tocá acá para generar el QR de Bancard` / `Tocá acá para pagar con débito →` / `Tocá acá para pagar con tarjeta de crédito →`.
- `Se abre el entorno seguro de Bancard. SeguroLoTengo e Interseguros no reciben el dinero ni ven tu tarjeta.` — la tarjeta va por el flujo alojado de Bancard; el portal nunca ve PAN/CVV (regla #6). El comportamiento del mock sale de los documentos de Bancard (`response_code`, EMVCo, reversa a los 5 s).
- **Modal Bancard** (en demo, simulado y rotulado como tal): `vpos.bancard.com.py/pago-seguro` · `Comercio: Alianza Garantía Seguros y Reaseguros S.A.` · `A PAGAR {premio}` · QR con guía (`{nombre,} escaneá este QR desde tu app de pagos — apenas Bancard confirme el pago seguimos automáticamente…`) o formulario de tarjeta (número, vencimiento MM/AA, código de seguridad, titular) con validación y `Mostrame qué me falta`. Botones `Simular que ya pagué (demo)` y `Completar con datos de ejemplo (demo)` **solo** con `DEMO_MODE=true`. Leyenda: `Ventana simulada del entorno de Bancard para esta demostración. En producción se abre el formulario real de Bancard…`
- **Plazo:** 24 horas desde las firmas institucionales, con cuenta regresiva. Vencido → **Pantalla B** (sin cobro, sin devolución).

**Reglas del sistema:** el único estado que abre y confirma una operación es
`FIRMADO` (regla 6-bis); la operación es idempotente; el Certificado de
Cobertura Provisional se emite en la misma escritura que confirma el cobro
(D-12, CMP-07); cada emisión del medio de cobro queda asentada con la huella
del PDF firmado (CMP-08).

---

## Confirmación — `/confirmacion` (fuera del contador)

Banda `CONTRATACIÓN ACEPTADA`. **Título:** `¡Listo{, nombre}! Tu familia ya
está protegida` — `Alianza Garantía está emitiendo tu póliza. Te llega en breve
a {correo enmascarado} y a tu WhatsApp {celular enmascarado}. Tu cobertura
comienza {fecha y hora} — 24 horas después del pago confirmado.` La fecha sale
del certificado (CHG-41): son 24 horas exactas sobre el instante del cobro, y
la pantalla no la recalcula.

**Hitos (cuatro):** `Firma electrónica ✓ · Cliente, Interseguros y Alianza` —
`Pago confirmado ✓ · Acreditado por Bancard` — `Certificado provisional ✓ ·
Emitido por Alianza` — `Póliza y factura ⋯ · En proceso de emisión`.

**`Tus documentos{, nombre}`** — cuatro tarjetas:

1. `Certificado de Cobertura Provisional` — `CPC-{correlativo} · firmado por Alianza Garantía · SHA-256 registrado` · `Ver PDF` + descarga.
2. `Propuesta de Interseguros + FIPF (firmada)` — `PROP-{correlativo} · cliente, Interseguros y Alianza · SHA-256 registrado` · `Ver PDF` + descarga.
3. `Comprobante de pago del premio` — `REC-{correlativo} · {premio} vía Bancard` · `Ver PDF` + descarga (sin huella: se genera al pedirlo, D-05).
4. `Póliza definitiva` — `En emisión por Alianza Garantía · llega por correo y WhatsApp` · **vista de estado**, no descarga: al abrirla, el visor explica que la emite Alianza y que mientras tanto el CPC acredita la cobertura.

**Los descargables siguen siendo tres** (D-05): paquete firmado, certificado y
comprobante. La tarjeta de la póliza es estado, no un cuarto descargable.
Leyenda: `La póliza y la factura electrónica están en emisión y te llegan por
correo y WhatsApp. Podés verificar la autenticidad de cada documento con el
código QR que trae impreso.`

**Ayuda:** `Podés solicitar ayuda o más información en:` mesas de ayuda de
Interseguros y de Alianza con teléfono, WhatsApp, correo y horario, más las
fichas institucionales. Los datos salen de `src/domain/entidades.ts`; lo que
D-19 no cerró no se muestra.

**`COMUNICACIONES COMERCIALES · OPCIONAL`** (DI-11, D-01): casilla **desmarcada**
`Quiero recibir por WhatsApp y correo ofertas de otros seguros comercializados
por Interseguros. Puedo revocar esta autorización en cualquier momento.` +
leyenda: `Es la única autorización de publicidad del trámite: va desmarcada, es
opcional y no condiciona tu seguro ya contratado. Para dejar de recibirlas,
respondé BAJA por WhatsApp o usá el enlace de baja de cualquier correo — sin
costo y en cualquier momento.` Genera evidencia propia con versión de texto; no
alimenta analítica/CRM (regla #7).

**Botón `Volver al inicio`.**

---

## Revisión manual — `/revision-manual` (fuera del contador)

Banda `REVISIÓN MANUAL · CASO-{número}`. **Título:** `{nombre,} tu solicitud
queda en buenas manos` — `Por lo que declaraste, tu seguro no puede emitirse
automáticamente — y eso no es un rechazo. Un asesor de Interseguros y Alianza
Garantía va a analizar tu caso y te contacta por tu WhatsApp {enmascarado} o tu
correo {enmascarado}.`

`Nada se movió de tu bolsillo: no se generó póliza, no se pidió ninguna firma y
no se realizó ni autorizó ningún pago. La información que enviaste viaja segura
conforme a la autorización que diste al inscribirte.`

**Botón `Volver al inicio`.**

**Reglas del sistema (sin cambios):** estado `DERIVADO_MANUAL`, terminal, con
número de caso propio (`CASO-…`) distinto del correlativo; **bloquea la cédula**
(regla #11); no continúa a paquete, firma, pago ni emisión (regla #5). La
derivación nace de las preguntas 1–4 del paso 2. Reemplaza a la Pantalla A del
flujo anterior; la información enviada y la autorización ya otorgada se
conservan como datos del caso visibles en la consola.

---

## Pantallas que se conservan del flujo anterior

El canvas no las dibuja y **siguen vigentes tal como están** en el historial de
este documento (versión del 20-ago-2026), con las adaptaciones mínimas
anotadas:

- **Pantalla B · Solicitud vencida sin cobro** (`/solicitud-vencida`): sin
  cambios de fondo — expediente firmado y no pagado en 24 h, sin devolución,
  con su variante legada de devolución para los expedientes del orden viejo.
  Única adaptación: el resumen y los hitos nombran el paso 3 nuevo.
- **Verificación pública** (`/verificar/<código>`): sin cambios. El pie legal
  nuevo la enlaza desde todas las pantallas.
- **Asistencia de identidad** (`/asistencia-identidad`): sin cambios de fondo;
  ahora se llega desde la sección de identidad del **paso 1**. Sigue sin
  bloquear la cédula.
- **Consola administrativa y panel de demo:** fuera de las pantallas del flujo,
  sin cambios por este rediseño. Los ganchos demo del canvas (datos de
  ejemplo, simular pago) se integran al panel y a `DEMO_MODE` existentes.

---

## Lo que este documento deroga

- La **P0** y los ocho pasos separados (`/plan`, `/whatsapp`, `/preparacion`,
  `/identidad`, `/declaraciones`, `/firma`, `/pago` como pantallas propias):
  sus contenidos viven ahora dentro de los 3 pasos según el mapa de
  trazabilidad (`IMPORTACION_DISENO_3_PASOS.md` §5). Sus rutas responden 308.
- Los premios de D-04 (290.000/475.000/660.000): rigen los aprobados el 20-ago
  (319.000/522.500/726.000).
- La pantalla de declaraciones con 8 preguntas: rige el mapa 5→8 (DI-3).
- El indicador `PASO N DE 8`: rige el stepper de 3 posiciones.
