# Importación del diseño aprobado: flujo de 3 pasos

**Fecha de importación:** 29-ago-2026 · **Fuente:** canvas de Claude Design
«Seguro lo tengo: Flujo de 3 pasos»
(<https://claude.ai/code/artifact/ce0c8332-d059-4b59-a790-bc8904ec079b>,
actualizado el 27-ago-2026), aprobado por Andres como diseño de la **nueva
configuración de pantallas**. Este documento es la transcripción fiel de ese
canvas al repo —estructura, textos, datos y reglas de interacción— más la
trazabilidad contra el flujo vigente de 8 pasos y la lista de divergencias
que requieren decisión **antes** de reescribir `ESPECIFICACION_PANTALLAS.md`.

El canvas es la fuente visual; este documento es la fuente de trabajo. Si al
implementar se detecta una discrepancia entre ambos, gana el canvas y se
corrige acá.

---

## 1. La nueva configuración

El flujo pasa de **8 pasos** a **3 pasos visibles**, más tres pantallas fuera
del contador:

| Pantalla        | Stepper           | Contenido                                                                                                     |
| :-------------- | :---------------- | :------------------------------------------------------------------------------------------------------------ |
| Inicio          | — (fuera)         | Página informativa: promesa («en 3 pasos»), los 3 pasos explicados, aviso de datos, T&C con casilla, CTA.     |
| **Paso 1**      | `INSCRIBITE`      | Identidad (cédula + selfie + OCR) → canales (OTP WhatsApp + correo doble tipeo) → datos complementarios → aceptación única. |
| **Paso 2**      | `ELEGÍ TU SEGURO` | Ramos (tabs, solo Oncológico activo) → 3 planes → coberturas en claro → beneficiario → 5 declaraciones → aceptación de condiciones del plan. |
| **Paso 3**      | `PAGÁ Y FIRMÁ`    | Resumen del plan → propuesta + FIPF (PDF cerrado, `PROP-…`) → firma (enlace a canal elegido) → pago (factura + 3 medios Bancard). |
| Confirmación    | — (fuera)         | Hitos, 4 documentos, mesas de ayuda, opt-in comercial (opcional, desmarcado).                                  |
| Revisión manual | — (fuera)         | `CASO-…`, «no es un rechazo», contacto por canales verificados, nada cobrado ni firmado.                      |

Cada paso es **una página larga con secciones que se habilitan en cascada**
(gating progresivo), no una secuencia de pantallas separadas. Los rótulos de
lo bloqueado dicen qué falta («Se habilita cuando confirmes tus datos de
identidad», «…cuando declares tu correo dos veces iguales y verifiques tu
WhatsApp», «…cuando completes tus datos complementarios»).

**Cambio de orden estructural: la identidad va primero y el plan después.**
Hoy: plan → WhatsApp → preparación → identidad. En el diseño: inscripción
(identidad + canales) → plan + declaraciones → firma + pago. Ver divergencia
D-B.

**El orden firma → pago se conserva** («Firmás primero y pagás después: así
solo te cobramos algo que ya aceptaste»), igual que D-08 y la regla 6-bis.
El vencimiento también: «Tenés 24 horas; si no pagás, no hay nada que
devolver y podés empezar de nuevo» (D-10).

## 2. Textos clave por pantalla

Los títulos se personalizan con el nombre de pila cuando ya se leyó la cédula
(`Inscribite con nosotros, Ana` / `Después, el pago, Ana` / `¡Listo, Ana! Tu
familia ya está protegida`).

### Inicio

- H1: **«Protege a tu familia, consigue su tranquilidad en 3 pasos»** · bajada: «Todo desde tu celular, en unos minutos. Respaldado por Alianza Garantía e intermediado por Interseguros.»
- Pasos: 1 «Inscribite con nosotros — Fotografiás tu cédula, leemos tus datos y vos los confirmás.» · 2 «Elegí tu seguro — Compará los tres planes y respondé cuatro preguntas.» · 3 «Pagá y firmá — Firma electrónica y pago seguro por Bancard.»
- ANTES DE EMPEZAR: «Usamos tu WhatsApp y tu correo solo para esta contratación […] no se ceden a terceros con fines comerciales.»
- Casilla de T&C **en el inicio** (habilita el CTA) + «Ver qué datos usamos y para qué».
- Pie: «Esta página es informativa. La contratación comienza recién en el paso 1 y la aceptación contractual ocurre al firmar.»

### Paso 1 — Inscribite

- Encabezado: «Acá no se firma nada ni se cobra nada: leemos tu cédula, vos confirmás los datos y verificamos tu identidad.» · IMPORTANTE: OTP vence en 5 minutos, «nadie te lo va a pedir por llamada», fotos cifradas.
- Identidad: «empecemos por tu cédula» — 3 capturas, «Solo cédula paraguaya y únicamente a tu nombre». OCR: cédula y fecha de nacimiento **no editables**; nombres, apellidos, sexo, nacionalidad, país de nacimiento, país de residencia y estado civil editables/seleccionables. «La edad de ingreso admitida es de 18 a 64 años y se calcula con la fecha de nacimiento de tu cédula.»
- Canales: «verificá tu WhatsApp personal» — OTP 6 dígitos, vence 5:00, 3 envíos, reenvío; correo con **doble tipeo** («Los dos correos todavía no coinciden — revisalos con calma»). «El código solo verifica tu canal: no contrata, no firma y no autoriza ningún cobro.»
- Datos complementarios: domicilio, ciudad, situación laboral, actividad, profesión, empresa, ingreso mensual estimado (Gs.), origen principal de los fondos — «Los pide la normativa de conocimiento del cliente».
- ACEPTACIÓN Y CONTINUAR: **una casilla agrupada** con detalle expandible («Ver todo lo que aceptás») de 7 autorizaciones: canales, tratamiento de datos (incl. biométricos, médicos y PEP), lectura de cédula + biometría + prueba de vida, veracidad, registro para firma electrónica simple con OTP, derivación a análisis si no hay emisión automática, y «contrato este seguro únicamente para mí». Nota: «Esto no contrata ni autoriza un pago. Se registran fecha, hora, IP y la versión del texto aceptado.»
- Guía de faltantes: «Te falta: …» + botón «Mostrame qué me falta» (desplaza al primer faltante). Patrón repetido en pasos 2 y 3 y en la tarjeta.

### Paso 2 — Elegí tu seguro

- Tabs de ramos: ONCOLÓGICO activo · VIDA, ACCIDENTES PERSONALES, RESPONSABILIDAD CIVIL con etiqueta «PRONTO» (deshabilitados).
- Leyenda: «producto inscrito SIS-VID-ONC-001/2026 · Res. SS.SG. N° 250/2026. Los importes son premios anuales finales, IVA incluido. Todavía no estás firmando ni pagando.»
- «Tu plan {nombre}, en claro»: las 4 coberturas con monto, detalle y carencia. Enlaces a «Coberturas, exclusiones y carencias (PDF)» y «Condiciones generales».
- Beneficiario — «¿a quién protegés?»: **dos opciones**: «mis herederos legales» (por defecto, sin datos) o «designar a una persona» (nombre, cédula, fecha de nacimiento, parentesco, domicilio completo, celular; 100% del capital; «Podés cambiarlo cuando quieras avisando a Interseguros»).
- Declaraciones — «unas preguntas antes de seguir»: **5** (ver §4). «Se firman recién en el paso 3.»
- Aceptación agrupada 2: carencias + inicio de vigencia (24 h post pago), veracidad, entrega digital, intermediación de Interseguros remunerada por Alianza, no renovación tras diagnóstico.
- Dos CTAs: «continuar al paso 3» o **«enviar mi caso a un asesor»** (cuando hay respuestas incompatibles).

### Paso 3 — Pagá y firmá

- Firma — «primero, tu firma»: «Interseguros S.A. te hace una **propuesta** de seguro: un PDF cerrado […] acompañado del FIPF». Tarjeta del documento: `Propuesta de Interseguros + FIPF · PROP-00018425 · PDF cerrado · huella SHA-256 registrada · art. 1556 del Código Civil` + «Ver PDF». Expandible «¿Qué es el FIPF y qué estoy firmando?» (ver divergencia D-A). Aceptación agrupada 3: recepción y revisión del PDF, licitud de fondos, orden de firmas (cliente → Interseguros y Alianza cualificadas → recién entonces pago, 24 h).
- Canal del enlace de firma: **«firmar por WhatsApp · {celular}» o «firmar por correo · {correo}»** — «Solo se envía a los canales que ya verificaste. Ningún operador te va a pedir ese código.» Confirmado: «✓ Documento firmado · cliente + Interseguros + Alianza Garantía».
- Pago — «Después, el pago»: «El pago se habilita apenas firmes». Datos de factura: **a nombre de, documento, RUC (opcional)**. Desglose: prima neta (premio/1.1), IVA, premio total — «Apertura provisional hasta el desglose oficial de Alianza». Medios: QR Bancard / débito / crédito. «Se abre el entorno seguro de Bancard. SeguroLoTengo e Interseguros no reciben el dinero ni ven tu tarjeta.» Modal Bancard simulado (`vpos.bancard.com.py/pago-seguro`, comercio Alianza) con botones demo.

### Confirmación

- «¡Listo! Tu familia ya está protegida» · «Tu cobertura comienza {fecha} — 24 horas después del pago confirmado.»
- Hitos: Firma electrónica ✓ · Pago confirmado ✓ · Certificado provisional ✓ · Póliza y factura ⋯ (en emisión).
- Documentos (4): CPC, Propuesta+FIPF firmada, Comprobante de pago, **Póliza definitiva (En emisión — vista de estado)**. QR de verificación mencionado.
- Mesas de ayuda de Interseguros y Alianza con horarios.
- **Opt-in comercial**: única autorización de publicidad, desmarcada, opcional, revocable («respondé BAJA por WhatsApp o usá el enlace de baja»).

### Revisión manual

- `REVISIÓN MANUAL · CASO-…` · «tu solicitud queda en buenas manos» · «no es un rechazo» · «Nada se movió de tu bolsillo: no se generó póliza, no se pidió ninguna firma y no se realizó ni autorizó ningún pago.»

### Pie legal (todas las pantallas)

Bloque expandible «INFORMACIÓN LEGAL Y REGULATORIA» + enlaces: T&C, Aviso de privacidad, Coberturas/exclusiones/carencias, Condiciones generales, Consultas y reclamos, Derecho de retracto, **Verificación de documentos**.

## 3. Datos de producto del diseño

| Plan             | Premio anual (IVA incl.) | Cáncer (pago único) | Muerte cualquier causa | Renta hosp./día (≤15 d/año) | Gastos méd. accidente |
| :--------------- | :----------------------- | :------------------ | :--------------------- | :--------------------------- | :--------------------- |
| CONFÍO           | Gs. 319.000              | Gs. 50.000.000      | Gs. 3.500.000          | Gs. 500.000                  | Gs. 7.000.000          |
| CONFÍO+          | Gs. 522.500              | Gs. 75.000.000      | Gs. 5.000.000          | Gs. 750.000                  | Gs. 10.000.000         |
| CONFÍO TOTAL     | Gs. 726.000              | Gs. 100.000.000     | Gs. 7.000.000          | Gs. 1.000.000                | Gs. 14.000.000         |

Los premios coinciden con la decisión aprobada del 20-ago (los de
`PantallasDemo2.pdf`). Identificadores del diseño: producto
`SIS-VID-ONC-001/2026`, Res. SS.SG. N° 250/2026 (reemplazan a los marcadores
`CDXXXXX` — confirmar procedencia, ver D-L).

**Carencias** (transversales al diseño): diagnóstico de cáncer **180 días**,
renta hospitalaria **30 días**, demás coberturas **1 día**, contadas desde el
inicio de vigencia (24 h después del pago confirmado). Ver D-D.

## 4. Las 5 declaraciones del paso 2

| # | Clave         | Pregunta (resumen)                                                                 | Respuesta que habilita | Nota |
| : | :------------ | :--------------------------------------------------------------------------------- | :--------------------- | :--- |
| 1 | salud         | ¿Buen estado de salud y sin buscar cubrir una enfermedad ya existente?             | Sí                     | —    |
| 2 | antecedentes  | ¿Alguna aseguradora te rechazó, postergó o condicionó una solicitud similar?       | No                     | —    |
| 3 | enfermedades  | ¿Diagnóstico de cáncer, cardiovascular, renal, diabetes, esclerosis, autoinmune, hepatitis o cirrosis? | No | — |
| 4 | pep           | ¿Sos PEP o estás vinculado a una?                                                  | No                     | Expandible «¿Qué significa PEP?» con explicación completa; «responder Sí no impide contratar, solo requiere el análisis de un asesor». |
| 5 | carencias     | ¿Entendés y aceptás las carencias y el inicio de vigencia?                         | Sí — **bloqueante**    | Expandible con el detalle; sin aceptación no se avanza (no deriva a asesor: detiene). |

Una respuesta incompatible en 1–4 muestra el aviso «tu solicitud pasa a un
asesor antes de cualquier pago o firma» y habilita el CTA «enviar mi caso a
un asesor» → Revisión manual. La 5 en No **no deriva**: bloquea el avance
(«Sin esta aceptación no podemos avanzar […] Si algo no te queda claro, un
asesor te lo explica»).

## 5. Trazabilidad contra el flujo vigente

| Flujo actual (8 pasos)      | En el diseño nuevo                                        |
| :-------------------------- | :-------------------------------------------------------- |
| /plan (paso 1)              | Paso 2, primera mitad (ramos + planes + coberturas)       |
| /whatsapp (paso 2)          | Paso 1, sección «Tus canales» (OTP idéntico: 6 díg., 5 min, 3 envíos) |
| /preparacion (paso 3)       | Absorbida por Inicio («Tené a mano tu cédula…») y el encabezado del paso 1 |
| /identidad (paso 4)         | Paso 1, secciones identidad + correo + complementarios    |
| /declaraciones (paso 5)     | Paso 2, segunda mitad (beneficiario + 5 declaraciones)    |
| /firma (paso 6)             | Paso 3, primera mitad                                     |
| /pago (paso 7)              | Paso 3, segunda mitad (con datos de factura nuevos)       |
| /confirmacion (paso 8)      | Confirmación (fuera del stepper)                          |
| Pantalla A                  | Revisión manual (mismo rol, textos nuevos)                |
| Pantalla B                  | **No aparece en el canvas** — se conserva como está (el vencimiento sin pago sigue existiendo por D-10) |

Elementos del diseño **sin equivalente hoy**: casilla de T&C en el inicio,
tabs de ramos, bloque de beneficiario, declaración de carencias, aceptaciones
agrupadas con expandible, datos de factura, opt-in comercial, saludo por
nombre de pila, «Mostrame qué me falta», tarjeta «Póliza definitiva» como
vista de estado.

Elementos de hoy **que el canvas no dibuja y se conservan**: Pantalla B,
`/verificar/<código>`, `/asistencia-identidad`, consola administrativa, panel
de demo (el canvas trae sus propios ganchos demo: «Completar con datos de
ejemplo (demo)», «Simular que ya pagué (demo)» — compatibles con
`DEMO_MODE`).

## 6. Divergencias y decisiones (RESUELTAS el 29-ago-2026)

> **Ronda cerrada.** Las once quedaron decididas por Andres el 29-ago-2026 y
> están asentadas en el **Bloque E de `DECISIONES.md`**, que es la fuente de
> verdad de cada resolución. Lo de abajo se conserva como el planteo original
> de cada divergencia; ante duda, manda `DECISIONES.md`. Titulares: FIPF es
> el formulario SEPRELAD (el texto del canvas se corrige); carencias,
> resolución y código de producto son marcadores provisionales; el PDF
> conserva las 8 declaraciones con mapa 5→8; el enlace de firma va por
> cualquiera de los dos canales; y el resto se adopta como lo dibuja el
> canvas.

Se numeran DI-x (decisiones de importación) para no chocar con las D-01…D-22
del Plan v2.

- **DI-1 · Qué significa «FIPF» (la más grave).** El canvas lo explica como
  «Formulario de **Información Previa a la Firma**: la hoja donde la
  aseguradora te resume […] qué cubre el plan, qué no cubre, las carencias y
  el precio», con secciones de producto e información precontractual. En el
  repo y en la normativa el FIPF es el **Formulario de Identificación de
  Persona Física** (Res. SEPRELAD 71/19): KYC/AML, no información de
  producto. Las dos cosas no son intercambiables: la obligación SEPRELAD no
  desaparece por renombrar el formulario. Opciones: (a) el texto del canvas
  es un error de la maqueta y se corrige, manteniendo el FIPF SEPRELAD como
  sección del PDF único (D-11 intacta) — **recomendada**; (b) el producto
  quiere además una hoja de información precontractual dentro del PDF: se
  agrega como sección nueva con otro nombre, sin tocar el FIPF.
- **DI-2 · Identidad antes que plan = máquina de estados nueva.** El orden
  `INICIADO → PLAN_SELECCIONADO → CANAL_WA_VERIFICADO → …` se invierte: la
  cédula se conoce al principio, así que el bloqueo por cédula (regla #11)
  se evalúa antes de invertir tiempo en el flujo — mejora real. Pero exige
  rediseñar aristas y decidir qué pasa con los estados legados. Necesita su
  propio plan de lotes (ver §7).
- **DI-3 · De 8 declaraciones a 5.** P6 hoy tiene 8 declaraciones (bloquean
  la 1, 2, 3 y 8 — regla #5). El canvas pregunta 5 (bloquean-derivan las
  1–4; la 5 detiene sin derivar). Hace falta el mapa 8→5 contra la
  declaración médica de `Solicitud.pdf`: el PDF firmado debe seguir
  conteniendo lo que la Solicitud exige, aunque la pantalla pregunte
  distinto. Decidir si el PDF conserva las 8 con las 5 respuestas mapeadas o
  si la Solicitud cambia (eso escala a Alianza).
- **DI-4 · Carencias 180/30/1 y no renovación tras diagnóstico.** Números
  nuevos, transversales (declaración 5, anexo, CPC, condiciones). Esto no
  tiene respaldo en la matriz de cumplimiento cargada; es contenido del
  producto que debe confirmar Alianza. Igual el «pierde vigencia con la
  emisión de la póliza» del CPC y la Res. SS.SG. N° 250/2026 con
  `SIS-VID-ONC-001/2026` (**DI-L implícita**: ¿son datos reales de Alianza o
  marcadores de la maqueta?).
- **DI-5 · Enlace de firma por correo.** El canvas ofrece firmar por
  WhatsApp **o** correo. El correo hoy se declara con doble tipeo, sin OTP
  (D-06): ¿alcanza esa verificación para mandarle el enlace de firma? La
  rama de firma interna ya modela «el OTP de firma va por cualquiera de los
  dos canales verificados» — coherente, pero hay que declarar formalmente
  que el doble tipeo cuenta como verificación del canal para este fin.
- **DI-6 · Datos de factura en P3** (a nombre de, documento, RUC opcional).
  Campos nuevos; la factura la emite Alianza por SIFEN (fila 40), así que
  esto es captura para remitir a Alianza, no facturación propia. Definir a
  qué parte del expediente y de la remisión (CHG-47) van.
- **DI-7 · Beneficiario en pantalla.** `Solicitud.pdf` ya contempla
  beneficiario; el canvas lo trae a la UI con la opción por defecto
  «herederos legales». Verificar que los 6 campos del canvas coincidan con
  los de `Solicitud.pdf` antes de tocar el modelo.
- **DI-8 · Aceptaciones agrupadas (una casilla + expandible), tres veces.**
  La matriz V4 exige que 1556 y las declaraciones de licitud/veracidad vayan
  **integradas al PDF y no como casilla aparte** — el canvas las mantiene en
  el PDF y además agrupa las autorizaciones de proceso en una casilla por
  paso. Cotejar contra la matriz si algún consentimiento exige casilla
  propia (p. ej. datos sensibles/biométricos); el opt-in comercial ya está
  separado, que es lo principal.
- **DI-9 · Persona de ejemplo.** El canvas usa «Ana María González Ramírez,
  C.I. 4.123.456». Los datos de prueba del repo salen de
  `src/adapters/mock/personas.ts` (Mónica Gorena et al.) y eso no cambia:
  los textos se importan, los datos de ejemplo no.
- **DI-10 · Casilla de T&C en el inicio.** Hoy no existe una aceptación
  previa al paso 1. Decidir si genera evidencia (el canvas la usa solo como
  gate del CTA) y qué versión de texto registra.
- **DI-11 · Opt-in comercial en la confirmación.** Nuevo. Requiere
  evidencia propia, revocación (BAJA por WhatsApp / enlace en correos) y
  respetar la regla #7 (no va a analítica/CRM con datos sensibles).

## 7. Cómo seguir (propuesta)

1. **Resolver DI-1 a DI-11** en `DECISIONES.md` (o un anexo propio) —
   especialmente DI-1, DI-3 y DI-4, que tocan documentos con vida normativa.
2. **Reescribir `ESPECIFICACION_PANTALLAS.md`** contra este documento y el
   canvas, pantalla por pantalla.
3. **Primer PR de implementación: `PASOS_FLUJO`** (`src/domain/rutas-flujo.ts`)
   con la estructura nueva. Propuesta técnica: conservar rutas y estados
   internos finos (el gating en cascada los necesita igual) y agregar la
   noción de **paso visible** (3) del que el stepper deriva su «Paso N de 3»,
   en vez de aplanar la máquina de estados — así la evidencia y los
   expedientes legados no se reescriben (regla #10).
4. **Después, una pantalla por sesión**, con la rama de firma interna
   (`claude/code100-api-integration-1f2547`) integrándose cuando se
   implemente el paso 3 — el canvas ya dibuja exactamente lo que esa rama
   modela (firma sin nombrar proveedor, enlace a canal verificado, OTP de
   firma propio).

## Anexo: método de importación

El canvas se leyó con `Artifact action:"read"`; es un bundle autocontenido
(manifiesto + template JSON). Del template se extrajeron el HTML (163 KB) y
el script de datos del prototipo (53 KB, `class Component extends DCLogic`),
de donde salen los textos dinámicos, planes, declaraciones, hitos y
documentos citados acá. Para repetir la extracción: buscar
`<script type="__bundler/template">` (JSON con el HTML completo) y el tercer
`<script>` interno (datos).
