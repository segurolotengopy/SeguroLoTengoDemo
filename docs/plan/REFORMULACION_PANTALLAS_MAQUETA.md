# Reformulación de las pantallas al formato de la maqueta

**Fecha:** 20-ago-2026 · **Mandato:** instrucción expresa de Andres — la gerencia espera
las pantallas con el mismo formato, los mismos campos y los mismos mensajes de
`docs/antecedentes/PantallasDemo2.pdf`, ajustados por los puntos señalados en la
reunión del 18-ago-2026. La implementación actual diverge en formato y este documento
reformula **explícitamente cada pantalla** para cerrarla contra la maqueta.

## Aprobado el 20-ago-2026 (las ocho pantallas)

Andres revisó las maquetas de las ocho pantallas y resolvió lo que estaba abierto.
**Estas decisiones mandan sobre lo que este documento decía antes**, y ya están
aplicadas más abajo:

1. **Los premios son los de `PantallasDemo2.pdf`**: `Gs. 319.000` / `Gs. 522.500`
   / `Gs. 726.000`, y la barra de plan de los pasos 2 a 8 arrastra el del plan
   elegido. Deroga a D-04 **en los montos**; el código de producto y la
   resolución siguen como marcadores `CDXXXXX` hasta que Alianza los pase.
2. **`Gs.` es la abreviatura oficial del guaraní** y se usa en todo el portal
   —pantallas y documentos—, no `G.`.
3. **Paso 1:** el pie de información precontractual **se saca**; lo que dice
   sobre la no renovación queda en el enlace de coberturas, exclusiones y
   condiciones.
4. **Paso 2:** autorizar es presionar `ENVIAR CÓDIGO POR WHATSAPP`, y ese acto
   registra la evidencia del consentimiento. La pantalla **no avanza sola** al
   completarse las seis casillas: se avanza con `VERIFICAR WHATSAPP Y CONTINUAR`.
5. **Paso 3:** la frase de derivación a análisis va en la caja azul en letra más
   chica, y los requisitos de emisión automática (edad 18–64, salud, PEP) van en
   letra más chica dentro del aviso rojo. El botón de continuar queda más chico y
   en dos líneas.

**Las ocho maquetas están aprobadas** (`pantallas/maqueta/maqueta-pasos-1-3.html`
y `maqueta-pasos-4-8.html`). Las decisiones de los pasos 4 a 8, además de las
cinco de arriba:

6. **Paso 4 · el orden de la pantalla cambia.** Columna izquierda: primero las
   tomas —con las cajas más chicas— y **debajo** los datos de identidad.
   Columna derecha: correo, datos complementarios, la advertencia de cédula
   paraguaya y el botón. Se conservan los 24 campos; lo que se aprieta son los
   tamaños.
7. **Paso 4 · solo dos campos con candado.** `Número de cédula` y `Fecha de
   nacimiento` no son editables; **nombres, apellidos, sexo y nacionalidad sí
   lo son**, aunque el OCR los complete. Esto **cambia** la convención que traía
   `ESPECIFICACION_PANTALLAS.md` (todos los campos del OCR bloqueados, y repetir
   la captura como único remedio). La regla inviolable #8 queda intacta: la edad
   se sigue verificando contra la fecha de nacimiento del documento, que sigue
   con candado.
8. **Paso 4 · se conserva la salida a `/asistencia-identidad`** tras tres
   análisis fallidos.
9. **Paso 5 · las declaraciones van pegadas**, sin filete ni aire entre una y
   otra: la etiqueta en versalita alcanza para distinguirlas. El botón
   `DECLARAR Y CONTINUAR` toma el ancho del aviso rojo que tiene encima y va
   **debajo** de él, no como franja de ancho completo.
10. **Paso 6 · el portal no nombra al proveedor de firma.** Code100 confirmó que
    **no tiene API para firma no cualificada**, así que los textos dicen *"te
    enviaremos un enlace"*, *"recibí el enlace"* y *"te confirmaremos la firma"*.
    Cuando haya proveedor cerrado se decide si se lo nombra.
11. **Paso 6 · el visor no descarga.** El botón es `VER PDF COMPLETO · SOLO
    LECTURA` y la pantalla lo dice: no se puede descargar ni imprimir; la
    descarga llega con el documento firmado. Refuerza CHG-29.
12. **Paso 6 · el plazo de pago se anuncia acá**, en línea aparte bajo el
    candado: *"Una vez firmado, tenés 24 horas para pagar; pasado ese plazo la
    solicitud caduca."* Sin la explicación de por qué no hay devolución.
13. **Las palabras «no cualificada» salen de todas las pantallas** (pasos 6 y 8).
    Los **documentos y la evidencia sí la conservan**: ahí la calificación de la
    firma es lo que le da valor probatorio.
14. **Paso 7 · los datos de facturación viven acá**, confirmado.
15. **Paso 8 · reordenada para que entre sin scroll.** El título y la banda del
    cobro comparten fila; `Recibirás los documentos en` se muda a la columna
    izquierda, bajo el inicio de cobertura; `¿Necesitás ayuda?` es un rótulo a
    la izquierda de las dos tarjetas de contacto; la casilla de comunicaciones
    comerciales y la leyenda de Interseguros van a la izquierda de un botón
    `FINALIZAR` chico. Los datos de contacto reales se cargan más adelante.

**Las cinco pantallas entran sin scroll**: con el lienzo de 1160 px las alturas
son 759 / 707 / 594 / 640 / 667 px.

## Jerarquía de fuentes de esta reformulación

1. **La maqueta manda el formato**: disposición de bloques, campos visibles y mensajes.
2. **La reunión y las decisiones D-01…D-22 mandan sobre la maqueta** donde chocan
   (la maqueta es del 18-ago por la mañana; la reunión la corrigió en vivo y las
   decisiones después). Cada choque está listado en la pantalla que lo sufre, con su
   fuente — ninguno se resuelve en silencio.
3. **Las reglas inviolables y la matriz V4 mandan sobre todo**: nada de esta
   reformulación puede reintroducir un formulario de PAN/CVV (D-02, regla #6), una
   descarga antes de la firma (CHG-29) ni un consentimiento premarcado (D-01).
4. **La paleta y la tipografía son las de `GUIA_DE_ESTILOS.md`**, no el trazo a mano
   de la maqueta: la maqueta define estructura, no estilo gráfico (decisión de
   producto ya tomada; el propio Rodrigo pidió "mantener el estilo amistoso", no el
   lápiz).

## Mapa maqueta ↔ flujo definitivo

La maqueta trae 8 páginas con numeración inconsistente ("PASO 1 DE 6", "PASO 4 DE 7",
"PASO 7 DE 7"): se dibujó mientras el flujo se discutía. El orden definitivo es el de
`PASOS_FLUJO` (CHG-01/D-22, 8 pasos), así que las páginas se reordenan:

| Maqueta | Pantalla final | Paso |
|---|---|---|
| p.1 `seleccion-plan` | `/plan` | 1 de 8 |
| p.3 `verificar-whatsapp` | `/whatsapp` | 2 de 8 (intercambio acordado en la reunión, 00:05:49) |
| p.2 `Prepará lo necesario` | `/preparacion` | 3 de 8 |
| p.4 `Datos e identificación` | `/identidad` | 4 de 8 |
| p.5 `Datos y declaraciones` | `/declaraciones` | 5 de 8 |
| p.6 `Revisá, aceptá y firmá` | `/firma` | 6 de 8 (la firma va antes del pago — D-08) |
| p.7 `Prepará el pago` | `/pago` | 7 de 8 (título "Realizá el pago" — D-16) |
| p.8 `¡Contratación confirmada!` | `/confirmacion` | 8 de 8 |

P0 (`/`), la Pantalla A/B y la asistencia de identidad **no están en la maqueta**:
conservan su contenido actual y solo heredan la cromática compartida (cabecera,
indicador). Las fichas de producto y el video de P0 se mudan a `/plan` (así los dibuja
la maqueta); P0 queda como puerta mínima que lleva al paso 1.

---

## Cromática compartida (todas las pantallas)

Es donde vive la mayor parte de la divergencia de formato, y se corrige una sola vez:

1. **Cabecera** — `ASEGURADORA` con isologo + razón social de Alianza, separador,
   `INTERMEDIARIO` con isologo + razón social de Interseguros, y debajo de cada una su
   línea de matrícula/registro (la reunión, 00:03: *"tiene que ser lo mismo. La
   resolución… la aseguradora, el intermediario"*). Los nombres enlazan a los sitios
   oficiales (TRV-04). La identificación de la Circular 011/2025 (CMP-01) queda dentro
   de esas líneas, no como franja aparte.
2. **Indicador de paso** — `PASO N DE 8` en texto + **fila de 8 puntos** con los
   cumplidos rellenos en naranja. La maqueta dibuja puntos (6 o 7 según la página,
   números superados por CHG-01/D-22); el número y el total siguen saliendo de
   `PASOS_FLUJO`, nunca escritos a mano.
3. **Barra de plan** — formato exacto de la maqueta: ícono de escudo naranja +
   `Plan seleccionado` / `Seguro Oncológico · CONFÍO+` + `Gs. 522.500 al año · IVA
   incluido` + ranura derecha (enlace `Cambiar plan` o chip de estado según pantalla).
   Visible en los pasos 2–8 (la reunión, 00:03:05: producto y prima siempre a la
   vista).
4. **Título de pantalla** — grande, centrado, con subtítulo azul en una línea. Es el
   patrón de las 8 páginas de la maqueta y reemplaza a los encabezados en caja de la
   implementación actual.
5. **Botón principal** — naranja, rotulado en mayúsculas, al pie de la pantalla
   (ancho completo cuando la maqueta lo dibuja así: declaraciones, pago,
   confirmación).
6. **Avisos** — cajas de borde redondeado con ícono: rojas (advertencia dura), azules
   (legal/informativa), verdes (confirmación), como los dibuja la maqueta.

---

## Paso 1 · `/plan` — Selección del plan (maqueta p.1)

**Estructura, de arriba hacia abajo:**

1. **Pestañas de producto**: `ONCOLÓGICO` (activa, naranja) · `VIDA` ·
   `ACCIDENTES PERSONALES` · `RESPONSABILIDAD CIVIL` (inactivas, con
   `PRÓXIMAMENTE`). Absorben las fichas de producto de P0.
2. **Título**: `Seguro de Vida Oncológico CONFÍO` + subtítulo azul
   `Elegí el plan que mejor se adapta a vos`. Debajo, en chico:
   `Producto inscrito: CDXXXXX · Res. CDXXXXX`.
3. **Botón `VIDEO INFORMATIVO`** (naranja, arriba a la derecha):
   `Conocé el producto en 60 segundos`. Absorbe el bloque de video de P0.
4. **Tres tarjetas de plan** en fila: ícono de escudo, nombre, **premio grande**
   (`Gs. 319.000` / `Gs. 522.500` / `Gs. 726.000`), `Premio total anual · IVA incluido`,
   y cuatro filas de cobertura con ícono:
   `Diagnóstico de cáncer: Gs. …` · `Fallecimiento: Gs. …` ·
   `Renta hospitalaria: hasta Gs. …` · `Gastos médicos por accidente: Gs. …`.
   Enlace rojo `+ Info sobre coberturas, exclusiones y condiciones.` (abre el PDF de
   coberturas, D-15). Radio al pie: `Elegir esta opción` → `Plan seleccionado`; la
   elegida lleva borde naranja y la cinta `★ PLAN SELECCIONADO`.
5. **Franja `Información relevante`**, tres ítems con ícono:
   `Edad de ingreso: 18 a 64 años.` ·
   `Carencias: cáncer 180 días · renta hospitalaria 30 días · demás coberturas 1 día.` ·
   `La cobertura comienza 24 horas después de confirmarse el pago.`
6. **Nota legal azul** (texto de la maqueta, literal): `El continuar con la selección
   del plan no implica la contratación del seguro, la firma de documentos, el inicio
   de la cobertura ni la obligación de pago de prima. No obstante, al continuar con la
   siguiente pantalla se entiende que el usuario ha leído y comprendido toda la
   información presentada.`
7. **Botón**: `CONTINUAR CON EL PLAN SELECCIONADO →`.

**Divergencias obligadas respecto de la maqueta:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| `SIS-VID-ONC-001/2026 · Res. SS.SG. N.º 250/2026` | marcadores `CDXXXXX` | D-04 (código y acto los pasa Alianza) |
| `PASO 1 DE 6` | `PASO 1 DE 8` | CHG-01 / D-22 |
| "Seguro de Vida **Individual** Oncológico CONFIO" | nombre registrado del catálogo (`Seguro de Vida Oncológico CONFÍO`) | el nombre expuesto es el del producto registrado; si Alianza confirma "Individual", se cambia una constante |

## Paso 2 · `/whatsapp` — Verificá tu número de WhatsApp (maqueta p.3)

**Estructura:** título `Verificá tu número de WhatsApp` + subtítulo azul
`Este paso confirma que el número está activo y bajo tu control.` Dos tarjetas lado a
lado:

- **`1. Confirmá el número`** — selector de país fijado en `Paraguay +595` + campo
  del número; ícono de WhatsApp + botón `ENVIAR CÓDIGO POR WHATSAPP`; debajo, en
  naranja, la autorización del envío: `Autorizo el envío de un código por WhatsApp con
  el único fin de verificar que este número es mío y continuar con la contratación.`
- **`2. Ingresá el código`** — leyenda verde `Código enviado por WhatsApp a
  +595 981 ••• 456`; seis casillas; botón `VERIFICAR WHATSAPP Y CONTINUAR`; chips
  `Vence 05:00` (cuenta regresiva) e `Intentos 1/3`; aviso rojo
  `Nunca compartas este código con terceros.`

**Pie** (caja de aviso): `La verificación no implica la contratación del seguro, la
firma de documentos, el inicio de la cobertura ni la obligación de pago de prima. Sin
embargo, constituye una declaración de que el número indicado es de mi propiedad y se
encuentra bajo mi control.`

**Divergencias obligadas:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| La autorización del código incluye "consentimiento para recibir ofertas de otros seguros" | la autorización cubre **solo** el envío del código; el consentimiento comercial sigue en su casilla separada y desmarcada de la confirmación | D-01 / ALR-01 (cerrada) |
| Paso 3 | Paso 2 | intercambio acordado en la reunión (00:05:49) — CHG-01 |

## Paso 3 · `/preparacion` — Prepará lo necesario (maqueta p.2)

**Estructura:** título `Prepará lo necesario` + subtítulo azul `Antes de comenzar la
validación, asegurate de tener todo a mano.` Cuatro tarjetas numeradas con ilustración:

1. `Cédula de identidad vigente` — `Necesitaremos fotografiar el frente y el dorso.
   Los datos deben verse completos y sin reflejos.`
2. `Celular o computadora con cámara` — `La cámara se utilizará para fotografiar la
   cédula y realizar una selfie en vivo.`
3. `WhatsApp y correo electrónico activos` — `Tanto el WhatsApp como el correo deben
   ser de tu propiedad y estar accesibles. Ya verificamos tu número con un código.`
   (adaptado: en el orden definitivo el WhatsApp ya quedó verificado en el paso 2).
4. `Medio de pago` — `Podrás pagar mediante QR Bancard o tarjeta. El cobro se realiza
   únicamente después de la firma.` (la maqueta ya lo dice así: coincide con D-08).

**Aviso rojo `IMPORTANTE`** (literal de la maqueta): `Este seguro no puede ser
contratado a nombre de otras personas. Por ello, la cédula de identidad, el número de
WhatsApp, el correo electrónico y el medio de pago deberán pertenecer necesariamente
al asegurado.`

Debajo, **en letra más chica dentro del mismo aviso** (aprobación del 20-ago), los
requisitos de la emisión automática, que hoy vive en la pantalla y la maqueta no
dibujaba: `Requisitos para la emisión automática: edad de ingreso entre 18 y 64 años,
verificada con la cédula · las declaraciones de salud deben permitir la emisión · una
condición de Persona Expuesta Políticamente deriva el caso a análisis. Si el caso
requiere análisis, la solicitud se detiene antes del pago y la información se envía a
Interseguros y Alianza Garantía.` Van acá y no en un bloque propio porque son el mismo
tema que el aviso: quién puede contratar.

**Caja azul de consentimiento con candado** (consentimiento inicial, fila 11 de la
matriz — literal de la maqueta): `Al presionar el botón CONTINUAR acepto que todos mis
datos personales proporcionados, incluyendo información de salud, fotografías y demás
información brindada, sean utilizados exclusivamente para verificar mi identidad,
evaluar el riesgo y generar la documentación contractual vinculada a la contratación
del seguro y al pago correspondiente.` (Sigue generando la evidencia versionada de
siempre: cambiar el literal exige subir `versionAviso`.)

Cierra la caja, **en letra más chica**, la frase de derivación (aprobación del 20-ago):
`Si no fuera posible emitir automáticamente, autorizo el envío de mi caso a Interseguros
y Alianza Garantía para su análisis y que puedan contactarme.` La maqueta no la traía y
sin ella la remisión a análisis quedaría sin autorización expresa.

**Botón:** `TENGO TODO LISTO Y CONTINUAR →`, más chico y en dos líneas, para dejarle
sitio al texto del consentimiento.

## Paso 4 · `/identidad` — Datos e identificación (maqueta p.4)

**Estructura:** título `Datos e identificación` + subtítulo azul `Información
fundamental para la contratación del seguro.` Dos columnas:

**Columna izquierda:**

- **`Datos de identidad`** — `Los datos serán extraídos de tu cédula y confirmados
  mediante la selfie en vivo.` Campos con candado (`Se completa automáticamente`):
  Número de cédula, Nombres, Apellidos, Fecha de nacimiento, Sexo, Nacionalidad.
  Selects requeridos: País de nacimiento, Estado civil, País de residencia.
- **`Datos complementarios`** — numerados como la maqueta: 1. Domicilio · 2. Ciudad ·
  3. Situación laboral · 4. Actividad · 5. Profesión · 6. Empresa / empleador ·
  7. Ingreso mensual declarado · 8. Origen principal de fondos. **Se mudan desde la
  pantalla de declaraciones**, que es donde viven hoy: la maqueta los pone junto a la
  identidad y la reunión no lo contradijo (lo único que la reunión mudó de acá fue lo
  fiscal, a pago — 00:36:51). La configuración por producto (CHG-18) sigue mandando
  qué campo se pide.

**Columna derecha:**

- **`Correo electrónico`** — `El correo es fundamental para la recepción de documentos
  y la contratación del seguro. Asegurate de que sea el correcto.` Campos
  `Correo electrónico *` + `Confirmar correo *` (doble tipeo, D-06). Va **antes** de
  las fotografías: punto expreso de la reunión (00:36 — "solicitar el correo
  electrónico antes de la fotografía de identidad").
- **`Verificá tu identidad`** — `Fotografiá tu cédula y realizá una selfie en vivo.`
  Tres sub-tarjetas: `Frente de la cédula` (`Documento completo, enfocado y sin
  reflejos.` · `TOMAR FOTOGRAFÍA`), `Dorso de la cédula` (ídem), `Selfie en vivo`
  (`Seguiremos movimientos para la prueba de vida.` · `INICIAR VERIFICACIÓN`).
  Aviso rojo: `Importante: este seguro solo puede ser contratado por personas con
  cédula de identidad paraguaya.`

**Botón:** `VALIDAR IDENTIDAD Y CONTINUAR`.

**Divergencias obligadas:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| (nada sobre reintentos) | tras 3 análisis fallidos se deriva a `/asistencia-identidad`, igual que hoy | decisión de producto vigente |
| campo `Nacionalidad` dos veces (candado y select) | una sola vez, con candado (viene del MRZ/registro civil) | regla #8; el select duplicado es un error de dibujo |

**Consecuencia de fondo:** `DatosComplementariosP6` pasa a capturarse en el paso 4
(endpoint de identidad), no en el 5. El modelo no cambia (NC-04); cambia qué pantalla
lo envía. Los expedientes en vuelo con datos ya guardados no se migran.

## Paso 5 · `/declaraciones` — Datos y declaraciones (maqueta p.5)

**Estructura:** título `Datos y declaraciones` + subtítulo azul `Completá la
información requerida antes de generar la propuesta.` Dos columnas:

**Columna izquierda — declaraciones con toggle `Sí / No`** (formato maqueta: fila por
declaración, rótulo en negrita + texto, chips a la derecha), en dos grupos:

1. `ESTADO DE SALUD` · `ANTECEDENTES DE CONTRATACIÓN` · `ENFERMEDADES DIAGNOSTICADAS`
   (los literales vigentes de `textos-p6.ts`, que ya son los de la maqueta).
2. `VERACIDAD` · `VIGENCIA Y CARENCIAS` · `ENTREGA DIGITAL` · `CORREDOR DE LA PÓLIZA`.

**Columna derecha:**

- **`A. Beneficiario por fallecimiento`** (borde naranja): radios
  `Herederos legales — 100%` / `Una persona — 100%`; si es una persona: `Nombre
  completo *`, `Domicilio completo *`, `Parentesco`, `Número de cédula del
  beneficiario` (opcional y no bloqueante — CHG-24).
- **Caja PEP rosada**: `¿Sos una Persona Expuesta Políticamente o estás vinculada a
  una?` + `Sí / No` + enlace `¿Qué significa PEP o vínculo PEP?`.

**Franja roja al pie** (literal de la maqueta, es CHG-25 + CHG-47): `Una respuesta
incompatible en salud, antecedentes, enfermedades diagnosticadas o condición PEP
finalizará la solicitud antes de la preparación del pago, la firma y la emisión. Sin
embargo, la información será enviada a Alianza Seguros a través de Interseguros para
su evaluación.`

**Botón (ancho completo):** `DECLARAR Y CONTINUAR`.

**Divergencias obligadas:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| `B. Datos fiscales` en esta pantalla | los datos fiscales viven en el paso de pago | reunión 00:36:51 — CHG-26/34 |
| (no dibuja los datos complementarios acá) | correcto: se van al paso 4 | maqueta p.4 |

## Paso 6 · `/firma` — Revisá, aceptá y firmá (maqueta p.6)

**Estructura:** título `Revisá, aceptá y firmá` + subtítulo azul `Revisá los
documentos cerrados y solicitá el enlace seguro de firma.` La barra de plan lleva en
su ranura derecha el chip verde de estado: `✓ Documentos cerrados · el cobro llega
después de la firma` (la maqueta decía `Pago preparado · todavía no cobrado`, del
orden viejo). Dos columnas:

- **`1. Revisá tus documentos`** — check verde `Datos, correo, WhatsApp e identidad
  verificados`. **Un solo documento con sus dos secciones** (D-11), presentado como
  las dos filas de la maqueta apuntando al mismo PDF:
  `Propuesta de seguro · Código: PROP-00018425 · Documento completo y cerrado` y
  `Formulario de Identificación de Persona Física (FIPF) · Código: FIPF-00018425 ·
  Sección del mismo documento`. Botón `VER PDF COMPLETO` (visor sin descarga).
  Candado: `El contenido no podrá modificarse después de solicitar la firma.`
- **`2. Aceptá y solicitá el enlace de firma`** — checkbox `He revisado la Solicitud y
  el FIPF, acepto su contenido y solicito firmar ambos electrónicamente en un solo
  acto.`; `Elegí dónde querés recibir el enlace seguro:` con dos radio-tarjetas
  (`WhatsApp verificado · +595 981 ••• 456` / `Correo verificado · m•••@example.com`);
  aviso naranja `La empresa Code100 enviará un enlace seguro al canal elegido para
  realizar la firma electrónica no cualificada.`; botón `SOLICITAR ENLACE DE FIRMA`.

**Franja `¿Qué sucede después?`** (tres pasos numerados, literal maqueta adaptado):
`1 · Recibí el enlace de Code100.` `2 · Abrilo y firmá la Solicitud y el FIPF en un
solo acto.` `3 · Code100 confirmará la firma y volverás automáticamente al portal.`
Botón derecho `CONTINUAR Y PAGAR →` (habilitado con la firma confirmada).

**Divergencias obligadas:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| `DESCARGAR BORRADOR` | no existe: visor de solo lectura antes de la firma | reunión 00:46 — CHG-29 |
| chip `Pago preparado · todavía no cobrado` | chip del orden nuevo (documentos cerrados, cobro después) | D-08 |
| dos documentos | un PDF, dos secciones/códigos, un acto | D-11 |
| `PASO 7 DE 7` | `PASO 6 DE 8` | CHG-01 / D-22 |

## Paso 7 · `/pago` — Realizá el pago (maqueta p.7)

**Estructura:** título `Realizá el pago` (D-16; la maqueta decía "Prepará el pago",
del orden viejo) + subtítulo azul `Elegí el medio de pago y autorizá la operación. El
cobro se realiza ahora, con tu firma ya registrada.` Dos columnas:

- **`1. Elegí cómo pagar`** — `Seleccioná solo un medio de pago.` Radio-tarjetas:
  - `A) QR Bancard` — recuadro del QR + `Escaneá el QR desde una aplicación
    habilitada y autorizá el pago.` + botón `GENERAR QR BANCARD`.
  - `B) Tarjeta de crédito o débito` — ilustración de tarjeta + candado con el
    descargo de la maqueta: `Los datos de la tarjeta son procesados de forma segura
    por Bancard y no quedan almacenados en el portal.` + botón que abre el
    **formulario seguro de Bancard** (no hay campos de tarjeta en el portal).
- **`2. Datos de facturación y resumen del pago`** — `Nombre / razón social`
  (autocompletado con el asegurado, con candado), `RUC` (opcional), nota `Estos datos
  se utilizarán para emitir la factura electrónica.` Resumen: `Plan: CONFÍO+` ·
  `Periodicidad: pago único anual` · `Prima neta: Gs. …` · `IVA: Gs. …` ·
  **`PREMIO TOTAL: Gs. 522.500`** (grande, naranja) · `Todos los importes están
  expresados en guaraníes.` (desglose provisional, D-04). Debajo, **una** casilla
  obligatoria (CHG-37, pendiente hasta hoy): `Una vez pagado el premio, acepto
  expresamente que se emita el Certificado de Cobertura Provisional y que la póliza y
  la factura electrónica se envíen a mis canales verificados.`

**Botón (ancho completo):** `REALIZAR EL PAGO Y CONTRATAR EL SEGURO` (CHG-38, ya
vigente).

**Divergencias obligadas:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| formulario con PAN, vencimiento y CVV | flujo alojado/tokenizado de Bancard; el portal no tiene ni un campo de tarjeta | D-02, regla inviolable #6 |
| casilla `origen lícito de los fondos` | no es casilla: la declaración viaja integrada al PDF que se firma | Matriz V4 §4 / CMP-20 (L4b) |
| `en un plazo de 48 horas` (en la casilla del CPC) | `a mis canales verificados`, sin plazo acá; los plazos viven en la confirmación con la fecha exacta | CHG-41 |
| prima neta 475.000 + IVA = 522.500 | premio total 522.500 con el desglose derivado de ese total | aprobación del 20-ago (ver encabezado) |

## Paso 8 · `/confirmacion` — ¡Contratación confirmada! (maqueta p.8)

**Estructura:**

1. **Título centrado con check verde grande**: `¡Contratación confirmada!` +
   `Tu firma y tu pago fueron confirmados. La solicitud fue enviada al sistema de
   Alianza Garantía para su emisión.`
2. **Banda verde**: `Pago confirmado por Bancard — Premio total pagado: Gs. 522.500 ·
   Operación N.º … · fecha y hora` (ya implementada en L5b; se conserva).
3. **Dos columnas:**
   - **`Estado de la contratación`** — lista vertical de checks (formato maqueta, no
     las cuatro columnas actuales): `✓ Firma electrónica no cualificada confirmada` ·
     `✓ Pago confirmado` · `✓ Certificado de Cobertura Provisional emitido` (con
     `Código: CPC-…` al costado) · `🕐 Emisión de la póliza y la factura — En proceso
     en el sistema de Alianza Garantía`. Debajo, caja naranja `Inicio de cobertura`:
     fecha y hora exactas + `24 horas después de la confirmación del pago.` y la
     vigencia hasta su aniversario.
   - **`Entrega de documentos`** — `Alianza Garantía realizará la revisión y enviará
     los documentos directamente a tus canales verificados.` Filas de PDF con
     `Ver documento | Descargar PDF` (formato maqueta): `Certificado de Cobertura
     Provisional` · `Solicitud de seguro` · `Formulario de Identificación de Persona
     Física (FIPF)` (las dos últimas abren el mismo PDF firmado, cada una por su
     código) · `Comprobante de pago` (D-05). Caja azul `Recibirás los documentos en:`
     correo y WhatsApp enmascarados **+ el estado real de la entrega por canal**
     (enviado / entregado / no se pudo — CHG-44, ya implementado; la maqueta no lo
     dibujó porque la entrega no existía).
4. **`¿Necesitás ayuda?`** — dos tarjetas de contacto (Alianza / Interseguros) con
   domicilio, teléfono, correo y sitio; **solo datos reales de `entidades.ts`** — la
   propia maqueta rotula los suyos como "datos de contacto provisorios para el
   diseño" (D-19: lo que falta se omite, no se inventa). Botón de WhatsApp si hay
   número configurado (D-17).
5. **Botón ancho completo `FINALIZAR`** + leyenda `Interseguros continuará
   brindándote asesoramiento y asistencia durante todo el proceso.` (CHG-46, vigente).
6. Se conservan, en formato maqueta: la casilla separada de comunicaciones
   comerciales (D-01) y la leyenda `No se genera Nota de Cobertura.`

**Divergencias obligadas:**

| La maqueta dice | Se implementa | Fuente |
|---|---|---|
| `48 horas después de la confirmación del pago` | `24 horas…`, con fecha y hora exactas del certificado | reunión 00:39:18 — CHG-41 |
| contactos `(021) 555 100`, `Av. Mariscal López 2450`, etc. | datos reales de `entidades.ts`; lo pendiente de D-19 se omite | la maqueta los declara provisorios |
| `Código: SOL-00018425` | los códigos reales: `PROP-…`, `FIPF-…`, `CPC-…`, `REC-…` | D-11/D-12/D-05 |
| `PASO 3 DE 6` | `PASO 8 DE 8` | CHG-01 / D-22 |

---

## Orden de implementación

Una pantalla por sesión (regla del repo), en este orden — primero la cromática
compartida porque es la mitad de la divergencia visible:

1. **Cromática compartida** + **Paso 1 `/plan`** (esta sesión).
2. Paso 2 `/whatsapp` · 3. Paso 3 `/preparacion` · 4. Paso 4 `/identidad` (la más
   pesada: muda los datos complementarios) · 5. Paso 5 `/declaraciones` ·
   6. Paso 6 `/firma` · 7. Paso 7 `/pago` (incluye CHG-37, pendiente) ·
   8. Paso 8 `/confirmacion`.

Cada pantalla cierra con: copys en `textos-*.ts` (lint de voseo), tests y batería E2E
actualizados en la misma sesión, y la captura regenerada para comparar contra la
página de la maqueta correspondiente.
