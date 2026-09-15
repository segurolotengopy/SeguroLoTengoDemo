# Análisis del handoff v4 y del manual funcional

**Recibido:** 14-sep-2026, de Rodrigo Fernández (Interseguros). **Analizado:**
14 y 15-sep-2026 contra `main` en `4b23b57`. **Decisiones de Andres:** 15-sep-2026,
asentadas como D-28 a D-41 en el Bloque G de `docs/plan/DECISIONES.md`.

Este documento no es la especificación de las pantallas: es el **contraste**
entre lo que llegó y lo que el repositorio hace hoy. Dice qué se adopta, qué
cambia en el código, qué choca y quién tiene que responder. La especificación
detallada se va a reescribir en `docs/ESPECIFICACION_PANTALLAS.md` pantalla por
pantalla, a medida que cada una se implemente.

## 1. Qué llegó

| Pieza | Contenido |
| :-- | :-- |
| Handoff técnico | 103 artes (81 `APROBADA_FINAL` y 22 candidatos), `screens.json`, la especificación y los catálogos de 03D, un manifiesto con SHA-256 y un visor HTML. Los 103 PNG coinciden con el manifiesto. |
| Manual funcional | 147 páginas, de las que salen 22 grupos funcionales: propósito, entrada, salidas y reglas de cada grupo; disparador, comportamiento y salida de cada estado; los catálogos de 03D; y las pruebas de QA. |

Hay tres pantallas **sin arte** todavía: 04E (revisión y firma), 05A (pago) y
05B (confirmación). Una más, 03E (actividad, ingresos y PEP), tiene arte solo
**candidato**. Andres ya las consultó (D-41): **no se implementan** hasta que
tengan arte aprobado.

## 2. Decisiones de Andres (15-sep-2026)

| # | Lo que dijo | Entrada |
| :-- | :-- | :-- |
| 1 | La primera fase **no sale con modo oscuro** | D-29 |
| 2 | Ya consultó por 03E, 04E, 05A y 05B | D-41 |
| 3 | Es una web app responsiva: **en escritorio los componentes van lado a lado** | D-30 |
| 4 | Se deja **editar y registrar** el cambio, pero la **elegibilidad y el bloqueo se calculan con el valor que el OCR leyó de la cédula** (frente y dorso) | D-31 |
| 5 | El **plazo de pago de 10 minutos** es correcto | D-32 |
| 6 | Las preguntas de salud son correctas como vienen: 3 médicas en 04A y la condición PEP en 03E | D-33 |
| 7 | Hay que **retirar los datos sensibles de la analítica** | D-34 |
| 8 | Todo el desarrollo, **con voseo** | D-35 |
| 9 | Hay que **corregir las pantallas para que sean consistentes con los pasos efectivos** | D-36 |
| 10 | El SMS sale **inicialmente por el servicio de AWS** | D-37 |
| 11 | **El manual prevalece sobre los artes** | D-28 |
| 12 | En la primera fase **Interseguros firma en lote, por fuera del sistema**, con un mecanismo de entrega y recepción | D-38 |
| 13 | Una tipografía **similar a Nimbus Sans, pero gratuita** | D-39 |
| 14 | Por ahora **no hay proveedor que detecte la alteración** del documento | D-40 |
| 15 | Los 73 MB de PNG **no se versionan**: quedan como referencia local | D-28 |

## 3. Orden de autoridad (D-28)

1. **El manual funcional** (`MANUAL_FUNCIONAL_TRANSCRIPCION.txt`).
2. **El arte `APROBADA_FINAL`** de ese código y estado.
3. `screens.json`, la especificación de 03D y las reglas globales.

Esto invierte el orden que declaran el handoff y el propio manual, que ponen el
arte primero. En la práctica decide cuatro casos:

- **04D:** el tercer bloque («Intermediario y canal de atención») es
  informativo, **sin casilla**. Se registra al continuar.
- **03A:** el reenvío espera **60 s**. Los artes muestran contadores de 30 s y
  de 51 s, que son inconsistentes entre sí.
- **03A:** un OTP nuevo invalida el anterior. El manual lo dice explícito; el
  código de hoy no lo cumple (ver §5.3).
- **Precios y carencias:** manda la tabla de la página 5 del manual. El manual
  pide expresamente «no mezclar precios de versiones históricas».

**Por encima del manual siguen estando las reglas inviolables** de `CLAUDE.md` y
la matriz de cumplimiento. Cuando el manual choca con una de ellas, no se
implementa en silencio: se lista en §6.

## 4. Etapas efectivas del stepper (D-36)

El arte dibuja cinco puntos con «N de 5». El `main_stage` de `screens.json` no
coincide con esa numeración: 01 = 1, 02 = 2 y 03A–03D = 3, cuando los artes
muestran 02 = «1 de 5» y 03A–03D = «2 de 5». **Manda el arte**, porque es lo que
ve la persona:

| Etapa | Pantallas | Estado del expediente al completarla |
| :-- | :-- | :-- |
| — (sin stepper) | 01 portada; 01A–01E | — |
| 1 de 5 · Plan | 02 (+ 02A–02C como detalle) | `PLAN_SELECCIONADO` |
| 2 de 5 · Verificación | 03A WhatsApp → 03B preparación → 03C identidad y correo → 03D datos | `IDENTIDAD_VERIFICADA` |
| 3 de 5 · Actividad e ingresos | 03E (+ 03E1) — *candidata* | — |
| 4 de 5 · Declaraciones y firma | 04A → 04D → 04E — *04E sin arte* | `FIRMADO_CLIENTE` |
| 5 de 5 · Pago y confirmación | 05A → 05B — *sin arte* | `PAGO_CONFIRMADO` |

**La regla de consistencia que se aplica al corregir los artes:** una pantalla
terminal muestra la etapa en la que el flujo se detuvo, no la siguiente.
03E2, 03E2A y 03E2B (revisión PEP) se disparan al terminar 03E, así que deben
decir **3 de 5**; el arte dice «4 de 5» y se corrige. 04A1 se dispara en 04A y
queda en **4 de 5**, como está.

Otras correcciones de consistencia:

- **03A_11:** con el código enviado por SMS, el título y el botón siguen
  diciendo «WhatsApp». Debe decir «número de celular» o hablar del SMS.
- **Botones deshabilitados:** en 03A son grises y en 03B son rojo pálido. Se
  unifica en un solo estado del componente.
- **02:** faltan las tildes en «90 dias» y «1 dia». El texto sale del catálogo,
  así que queda con tilde.
- **«N.° 118» / «N.º 118»:** se unifica en `N.º`, que es lo que usa `entidades.ts`.
- **«Premio» / «prima»:** 02 usa las dos palabras. Se sigue al manual, que dice
  «prima anual» en la tabla y «Premio total anual» en el arte. **Se pregunta a
  Rodrigo** cuál vale y se usa una sola.
- **«Inicio de vigencia» (02) / «Inicio de cobertura» (02A):** es el mismo
  concepto. Se unifica en «Inicio de cobertura».
- **CTA habilitada sin requisitos:** en los artes de 04A y 04D, «CONTINUAR» ya
  está en rojo con todo vacío. El manual lo prohíbe expresamente («no permitir
  avanzar si falta una aceptación requerida»), así que la CTA arranca
  deshabilitada.
- **03C_25:** durante el bloqueo de 5 minutos, los botones del frente se ven
  activos. Durante el bloqueo quedan deshabilitados.
- **03D_11:** con la fecha inválida, la edad calculada sigue mostrando un
  valor. Se oculta hasta que la fecha sea válida («no calcular elegibilidad con
  una fecha inválida», manual).
- **Registro mezclado dentro de una misma pantalla:** 03E2 y 04A1 abren con tú
  («Tu solicitud requiere revisión») y siguen en usted. Los selectores dicen
  «Seleccione una opción» en 03D y «Elegí una opción» en 04A. Todo se unifica
  en voseo (D-35).
- **Número de caso:** `CAS-` + 8 dígitos, igual en 03E2 y en 04A1. La segunda
  fila del estado cambia según el motivo, y está bien que cambie: «Revisión de
  cumplimiento» (PEP) y «Evaluación de asegurabilidad» (salud).

**Impacto en el código:** `PASOS_FLUJO` hoy asocia un paso a un slug. Con v4 una
etapa tiene varias pantallas (la 2 tiene cuatro), así que `PasoDelFlujo` suma
una `etapa` y el stepper se deriva de ella. Todo lo demás (número de paso,
siguiente y anterior) sigue saliendo de la misma lista.

## 5. Contraste con el repositorio

### 5.1 Coincide y no cambia

- OTP de 6 dígitos, 5 minutos, 3 intentos y reenvío a los 60 s. Solo se
  persiste el hash.
- Edad de ingreso 18–64; permanencia hasta los 75 años con 10 años de
  cobertura continua antes de los 65 (ya está en `textos-aclaraciones.ts`).
- Solo cédula paraguaya vigente; ni pasaporte ni documentos extranjeros.
- Correo con doble tipeo dentro de identidad, sin OTP (D-06).
- Firma del cliente no cualificada con OTP propio del portal (D1), **antes** del
  pago. Un solo PDF para Solicitud + FIPF (D-11).
- La revisión manual (salud o PEP) nunca rechaza en automático y no pide firma
  ni pago (regla #5).
- Coberturas por plan, registro 15-VI.0002 y Nota SS.SG. N.º 397/2026.
- `segurolotengo@interseguros360.com` para los derechos sobre los datos (D-19).

### 5.2 Cambia por decisión o por el manual (se implementa)

| Tema | Hoy | v4 | Dónde |
| :-- | :-- | :-- | :-- |
| Producto y premios | CONFÍO; 319.000 / 522.500 / 726.000 (`OFERTA-CONFIO-v2`) | **VIVE**; **390.000 / 575.000 / 760.000**, IVA incluido | `catalogo.ts`; `ID_VERSION_OFERTA` pasa a una versión nueva (entra en la evidencia) |
| Secuencia | 8 pasos (v2) o 3 páginas (v3, detrás de `FLUJO_V3`) | **5 etapas**, con portada | `rutas-flujo.ts`; el v3 de Lovable queda superado |
| Portada | Eliminada el 20-ago (la raíz va a `/plan`) | **Vuelve** (01), con catálogo de productos | `src/app/page.tsx` |
| Páginas institucionales | `/privacidad`, `/retracto` y pie legal | 01A cookies, 01B menú, 01C responsabilidades, 01D contacto, 01E información legal | nuevas |
| Identidad visual | DM Sans, naranja (`GUIA_DE_ESTILOS.md`), modo oscuro | **Arimo** (D-39), navy `#071F78`, rojo `#FF1721`, azul `#0876F9`, `#55709D`; **sin modo oscuro** (D-29) | tokens, `layout.tsx`, `HeaderInstitucional` |
| Cabecera | Aseguradora e intermediario | 2 marcas en portada; 3 desde el plan (SeguroLoTengo, Interseguros, Alianza) | `HeaderInstitucional`; falta el **logo en vector** |
| Layout | Mobile-first, patrón wide/narrow | Mobile-first; **lado a lado en escritorio** (D-30). Los artes son todos móviles | por pantalla |
| Datos extraídos (03D) | Cédula y nacimiento con candado | **Todo editable** salvo el tipo de documento; cada cambio se registra; **elegibilidad y bloqueo con el valor del OCR** (D-31) | `verificacion-identidad.ts`, evidencia |
| Campos de 03D | `apellidos` único; sexo desde el MRZ (D-25) | Apellido paterno y materno separados; estado civil (5); país de nacimiento, nacionalidad y residencia (195, ISO en español); dirección; ciudad (43 + «Otra ciudad o localidad»); barrio (texto libre); **sexo como selector** | `tipos.ts`, catálogos nuevos |
| Captura (03C) | Producción: solo cámara | **Frente y dorso por cámara o archivo** (JPG, JPEG, PNG, HEIC, hasta 20 MB, sin PDF); **selfie solo con cámara**, nunca imagen estática | `origenCapturaAdmitido()` |
| Fallos de identidad | 3 fallos derivan a `ASISTENCIA_IDENTIDAD` | 3 fallos **bloquean 5 minutos** con reintento automático; se conservan las etapas ya validadas | `verificacion-identidad.ts` |
| OTP (03A) | Solo WhatsApp; rate limit por IP | + **SMS al mismo número** tras el reenvío por WhatsApp (D-37); **bloqueo de 5 minutos** al llegar al umbral; «número sin WhatsApp» | puerto `OtpProvider` (canal `SMS`), adaptador AWS |
| Salud (04A) | 8 declaraciones en P6 | **3 preguntas médicas** (1 = Sí, 2 = No, 3 = No); la PEP pasa a 03E (D-33) | `elegibilidad.ts` |
| Beneficiario (04A) | Cédula opcional y no bloqueante (CHG-24) | Herederos legales 100 % o persona designada 100 % con **nombre, domicilio, parentesco y cédula obligatorios** | `interpretarBeneficiarioP6` |
| Consentimientos | Casillas del v2 | Los 5 del manual, más la **casilla obligatoria de privacidad y tratamiento de datos de 03B** (no está en la matriz del JSON) | textos versionados |
| Plazo de pago | 24 h desde las firmas institucionales (D-10) | **10 minutos desde la firma del cliente** (D-32) | `firma-p8.ts`; la reversa del QR pasa a correr al minuto 10 |
| Firma de Interseguros | Code100 simulado, antes del cobro | **En lote, fuera del sistema, después del pago** (D-38) | `docs/plan/DISENO_FIRMA_EN_LOTE.md` |
| Contacto (D-19) | `WHATSAPP_ATENCION = null` | **+595 991 478 468**; oficina Plaza Center, 7.º piso | `entidades.ts` |
| Analítica | Ninguna | Google Analytics **sin datos sensibles** (D-34) | ver §5.4 |

**Cómo se lee D-31 en el código.** Las reglas #8 (edad) y #11 (bloqueo por
cédula) **no cambian de letra**: siguen calculándose sobre lo que leyó el OCR del
documento, frente y dorso, con el MRZ cuando lo hay. Lo que la persona corrige
se guarda como **dato declarado**, aparte del leído, y la corrección deja
evidencia con los dos valores. Queda por decidir qué se imprime en la Solicitud
cuando difieren; la propuesta es el declarado, con la discrepancia visible en la
consola (ver §7). Para la cédula del formato anterior, que no tiene MRZ, la
fecha que decide sigue siendo la del registro civil, como hoy.

### 5.3 Defecto encontrado de paso

`verificarOtpDeCanal` (`src/domain/verificacion-canal.ts`) no comprueba que el
`otpId` recibido sea **el último emitido**. Después de un reenvío, el código
anterior sigue sirviendo hasta vencer (`src/adapters/live/otp-provider.ts` lo
reconoce: queda «huérfano»). El manual exige que un OTP nuevo invalide al
anterior, y la contingencia SMS lo vuelve más visible. Se separó como tarea
propia, porque es seguridad y no depende de las pantallas.

### 5.4 Analítica sin datos sensibles (D-34)

**Hoy no hay ninguna analítica.** Las reglas que se van a hacer cumplir:

1. **Un solo punto de entrada** (`src/lib/analitica.ts`). Nadie más toca
   `gtag`, `dataLayer` ni `googletagmanager`.
2. **Configuración de GA:**
   - `send_page_view: false`: las páginas vistas se mandan a mano, ya saneadas.
   - Medición mejorada apagada: formularios, clics salientes, descargas.
   - `allow_google_signals: false` y `allow_ad_personalization_signals: false`.
   - Sin `user_id` ni propiedades de usuario.
3. **Rutas excluidas:** `/admin-consola`, `/demo-panel` y `/api/*`. En
   `/verificar/*` se manda solo `/verificar/:codigo`: el código lleva el
   correlativo y hoy viaja en la URL, en el `<title>` y en el referrer.
4. **Saneamiento:** `page_location` y `page_referrer` sin query ni hash;
   `page_title` de una tabla estática por ruta, nunca de `document.title`. Se
   agrega `Referrer-Policy: strict-origin-when-cross-origin`.
5. **Qué se puede enviar:** solo eventos de una lista cerrada (`paso_visto`,
   `paso_completado`, `tramite_cerrado`) con parámetros enumerados. En una
   derivación se manda `DERIVADO`, **nunca** SALUD ni PEP.
6. **Qué nunca se envía:**
   - texto libre, valores de formulario ni mensajes de error;
   - cédula, nombre, correo, celular, OTP o tarjeta;
   - salud ni PEP;
   - número de propuesta, `expedienteId`, códigos de documento ni importe.
7. **Test nuevo** `analitica-sin-datos-sensibles`, con cuatro partes:
   - **estático:** falla si `gtag` aparece fuera del envoltorio, reusando la
     lista `NOMBRES_PROHIBIDOS` de CMP-16;
   - **unitario:** del saneador;
   - **E2E:** Playwright intercepta `**/g/collect*` y busca la cédula, el OTP,
     el correlativo y el código;
   - **textos:** los del aviso de cookies.

**Esto no resuelve la fila 85** (permitir rechazar las cookies no necesarias).
Ver §6.

## 6. Conflictos que siguen abiertos (no se implementan hasta decidirse)

| # | Conflicto | Qué choca | Quién decide |
| :-- | :-- | :-- | :-- |
| C-1 | El **consentimiento de publicidad** va dentro de la casilla obligatoria del OTP (03A) | **D-01** (19-ago) lo decidió **separado**, desmarcado y revocable (consentimiento libre, Ley 7593/2025) | Andres / Legal |
| C-2 | **Google Analytics con «He leído y entendido»**, sin opción de rechazo | Fila 85 de la matriz; `textos-legales.ts` promete hoy pedir permiso antes de la analítica | Legal (P7) |
| C-3 | **La cobertura empieza al acreditarse el pago** (02, 02A, 04D, manual p. 5 y 9) | CHG-41 (cobro + 24 h exactas) y el mensaje de D-18 («24 horas después de tu pago») | Andres |
| ~~C-4~~ | **Alianza firma la Solicitud + FIPF** con su proveedor cualificado (manual p. 9) | **Resuelto de forma preliminar (D-42):** dos firmas, cliente e Interseguros. Alianza no firma la propuesta | Andres, 15-sep; Rodrigo confirma |
| ~~C-5~~ | **El CPC lo «emite y firma» Alianza** (manual p. 9) | **Resuelto de forma preliminar (D-42):** lo genera Interseguros desde SeguroLoTengo y lo firma Alianza | Andres, 15-sep; Rodrigo confirma |
| C-6 | **Entrega:** CPC, póliza y factura por canales verificados «cuando corresponda»; Solicitud y FIPF firmados «cuando corresponda» | D-05 y D-27: cuatro descargas en la confirmación (paquete, CPC, comprobante, constancia) | Andres, cuando haya arte de 05B |
| C-7 | **No hay retracto** en 01E ni en el menú | Fila 64 de la matriz; `/retracto` existe | Legal (P4) |
| C-8 | **«Salir y descartar elimina el avance de esa sesión»** (01B) | Regla #10 (la evidencia no se borra). Propuesta: cerrar la sesión y marcar el expediente como abandonado, sin borrar nada | Andres |
| C-9 | **El sexo pasa a ser un selector** (03D) | D-25 (04-sep): no se pregunta, sale del MRZ. Con D-31 sería: precargado del MRZ, editable y registrado | Andres |
| C-10 | La **declaración de veracidad** (#5 del v2) no tiene pantalla en v4 | CMP-20: licitud, veracidad y cuenta propia. Propuesta: van en el PDF y se aceptan al firmar en 04E, como hoy | Andres |
| C-11 | **«Número sin WhatsApp»** (03A_14) | WhatsApp-Modular tiene que devolver ese error distinguible. Si no puede, el estado no se puede disparar | Técnico, con WhatsApp-Modular |
| C-12 | El estado **«posible alteración»** (03C_19) | D-40: no hay detector. Propuesta: que lo dispare la inconsistencia MRZ ↔ frente de `mrz.ts` | Andres |
| ~~C-13~~ | **Cerrado (D-42): la casilla obligatoria de 03B cubre el consentimiento biométrico, que es obligatorio; no se agrega otra casilla en 03C.** El manual exige una **casilla de consentimiento biométrico en 03C** (`biometric_identity`, p. 8), pero **ninguno de los 26 estados de 03C la dibuja** | «No agregar ni retirar casillas por interpretación» (manual p. 8) frente a D-28, que pone el manual por encima. La casilla obligatoria de 03B ya autoriza «fotografías y datos biométricos para verificar mi identidad, realizar la prueba de vida» | Rodrigo |
| C-14 | 04D habla de «canales **verificados** (WhatsApp y correo electrónico)» | El correo no se verifica con un código (D-06): se declara con doble tipeo. Hay que decir «declarados» o verificar el correo | Rodrigo / Legal |

## 7. Preguntas

**A Rodrigo:**

1. Confirmar el esquema preliminar de D-42 (dos firmas en la propuesta; el CPC lo genera Interseguros y lo firma Alianza) y corregir la p. 9 del manual. P2: qué recibe el cliente mientras la firma de Alianza sobre el CPC no llega.
2. C-6: ¿qué se descarga en la confirmación?
3. Las inconsistencias de §4: el stepper de 03E2, «premio» o «prima», los contadores de reenvío y el título de 03A_11.
4. El **logo de SeguroLoTengo en vector** (SVG). Solo llegó en PNG.
5. Textos en formato editable. Hoy salen de transcribir imágenes.
6. El comportamiento en escritorio: no hay ningún arte de escritorio. D-30 fija la regla general (lado a lado), pero cada pantalla necesita una disposición.

**A Legal:** C-1, C-2 y C-7.

**A Andres:** C-3, C-8, C-9, C-10, C-12. También qué se imprime en la Solicitud
cuando el dato declarado difiere del leído (D-31), y si una discrepancia en la
cédula o en la fecha de nacimiento debe mandar el caso a revisión.

## 8. Textos y voseo (D-35)

Los artes están casi enteros en **usted**, con restos de tú (01: «Elige…
contrata», «Protege»; 04A: la pregunta 2 dice «tuya» y la 3 «Te han») y algo de
voseo (04A: «Completá», «Ingresá»). Todo pasa a voseo. Los consentimientos en
primera persona («Autorizo…», «Tomo conocimiento…», «He leído…») no cambian.

La transcripción literal de cada arte aprobado, con la tabla de adaptación a
voseo al final de cada pantalla, está en [`textos/`](textos/). **Es una
transcripción de imágenes**: antes de llevar un texto al código hay que
contrastarlo contra el PNG, y cambiarlo cuando lleguen los textos editables.

Textos de consentimiento que hay que versionar tal cual, en primera persona:

- **03B, privacidad y tratamiento (obligatoria):** *«He leído el Aviso de
  Privacidad y autorizo, de forma libre, previa, expresa, específica e
  informada, a Interseguros S.A. y a Alianza Garantía Seguros y Reaseguros
  S.A., en el ámbito de sus respectivas funciones, a tratar mis datos
  personales y de salud, fotografías y datos biométricos para verificar mi
  identidad, realizar la prueba de vida, evaluar el riesgo y gestionar la
  solicitud, contratación y administración del seguro.»*
- **03A, 03C y 04D:** los de la página 8 del manual (`screens.json → consents`).

## 9. Plan de implementación

Una pantalla por sesión, como pide `CLAUDE.md`. Antes, un PR de lo compartido.

1. **Base v4.** Tokens de color, Arimo, cabecera de 2 y 3 marcas, stepper de 5
   etapas, CTA roja en posición fija, `PasoDelFlujo.etapa` y `PASOS_FLUJO_V4`
   detrás de un flag, **sin modo oscuro**. Solo cuando esté el SVG del logo.
2. **Pantallas sin dependencias:** 01 y 01A–01E, 02 y 02A–02C (catálogo VIVE
   con oferta nueva), 03B y 04D.
3. **03A** con el defecto de §5.3 corregido y el bloqueo de 5 minutos. Después,
   la contingencia SMS (puerto, adaptador AWS, `infra/`, salida del sandbox).
4. **03C y 03D:** carga de archivo, bloqueo de 5 minutos, campos y catálogos
   nuevos, edición registrada con OCR autoritativo (D-31).
5. **04A y 04A1, 03E2 y 03E2A/B:** tres preguntas, beneficiario obligatorio,
   pantallas de revisión.
6. **Dominio:** plazo de 10 minutos, cobro desde `FIRMADO_CLIENTE`, firma en
   lote de Interseguros (D-38), analítica (D-34).
7. **03E, 04E, 05A y 05B:** cuando tengan arte aprobado (D-41).

Cada PR corre `npm run verify` y la batería E2E, y deja su entrada en la bitácora.
