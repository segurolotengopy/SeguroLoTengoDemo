# Especificación de pantallas — SeguroLoTengo (fuente de verdad)

Extraída de `Pantallas_Sistema_Demo.pdf`. **Este documento manda sobre cualquier otro.** Si una decisión de implementación contradice algo de acá, gana este documento.

## Elementos comunes a todas las pantallas

**Cabecera fija (tres bloques):**

- Izquierda: `ASEGURADORA · Alianza Garantía Seguros y Reaseguros S.A.` con su logo.  
- Centro: `INTERMEDIARIO · Interseguros S.A. - Corredores de Seguros` con su logo.  
- Derecha: indicador de paso.

**Indicador de paso (derecha de la cabecera):**

- P0: `P0 · INFORMACIÓN` / `FUERA DEL CONTADOR 1-9`  
- P1 a P9: `PASO N DE 9` \+ 9 puntos, los completados en naranja.  
- Pantalla A: `PANTALLA A` / `SEGUROLOTENGO` / `EMISIÓN NO AUTOMÁTICA`  
- Pantalla B: `PANTALLA B` / `QR PAGADO · FIRMA NO COMPLETADA`

**Barra de plan seleccionado** (presente desde P3 hasta P8): ícono de check, `PLAN SELECCIONADO`, `Seguro de Vida Oncológico · CONFÍO+`, `Gs. 475.000 al año · IVA incluido`, y enlace `Cambiar plan` a la derecha. En P7 y P8 el texto dice `premio anual · IVA incluido`. En P8 el enlace es `Volver al pago`.

**Paleta:** azul institucional para títulos y etiquetas, naranja para acciones primarias y alertas, verde para confirmaciones y textos de seguridad, rojo para bloqueos, fondo hueso claro, tarjetas blancas con borde negro fino y esquinas redondeadas.

**Pie de cada pantalla:** enlace de retroceso a la izquierda (`← Volver a ...`) y bloque de `REGISTRO DE SEGURIDAD` cuando corresponde.

---

## P0 · Información (fuera del contador)

Página pública informativa. **No solicita datos médicos ni PEP, no genera propuesta, no cobra, no emite póliza.**

- Encabezado: `SEGUROLOTENGO.COM` y a la derecha `Marca y canal digital de Interseguros S.A.`  
- Bloque principal: título `Protegé hoy lo que más importa mañana`, bajada sobre el Seguro de Vida Oncológico CONFÍO (respaldo económico ante diagnóstico de cáncer, cobertura por fallecimiento, renta hospitalaria y gastos médicos por accidente), botón `VERIFICAR WHATSAPP Y COTIZAR →`, y leyenda verde `La contratación comienza recién en la Pantalla 1.`  
- Panel derecho: `VIDEO INFORMATIVO` con reproductor y pie `Qué cubre · Cómo funciona · Cómo contratar`.  
- `PRODUCTOS DISPONIBLES`: cuatro tarjetas. Solo `CONFÍO` (Seguro de Vida Oncológico) está `Disponible` con botón `CONOCER`; Seguro de Vida, Accidentes Personales y Responsabilidad Civil dicen `Próximamente`.  
- `ANTES DE CONTRATAR`: cuatro ítems — Coberturas y sumas / Exclusiones y carencias (revisá 180, 30 y 1 día según cobertura) / Siniestros y beneficios / Privacidad y seguridad.  
- `AYUDA Y CONSULTAS`: Preguntas frecuentes, Contactar a Interseguros, Consultas y reclamos, y la nota `Chat con IA: previsto para la versión 2.`  
- Banda verde inferior con la leyenda de que la página es informativa.  
- Pie: `Información pública · Versión 1 · Sin chat con inteligencia artificial`

---

## P1 · Paso 1 de 9 — Verificación de WhatsApp

Banda superior: `INICIO SEGURO / Verificación inicial de tu WhatsApp personal` y a la derecha `TODAVÍA NO ES UNA CONTRATACIÓN — No se selecciona plan, no se firma y no se realiza ningún cobro.`

Título: `Verificá tu WhatsApp personal`. Subtítulo azul: será el primer canal verificado y deberá permanecer activo. Nota: el código solo valida el canal, no contrata, no firma, no autoriza cobro.

**Panel izquierdo (ilustrativo):** teléfono con `Código de verificación`, seis casillas, `Uso único · No lo compartas`, y `WHATSAPP PERSONAL — El mensaje contendrá un código de uso único para esta verificación.`

**Paso 1 — Ingresá tu número:**

- Selector de país (Paraguay `+595`) y campo de número, placeholder `Ej.: 981 000 000`.  
- Botón `ENVIAR CÓDIGO` (contorno verde).  
- Checkbox obligatorio: *Autorizo usar este número para verificar el canal, proteger el acceso y continuar el proceso. No autoriza publicidad.*

**Paso 2 — Ingresá el código recibido:**

- Leyenda verde con el número enmascarado: `Código enviado al número +595 ••• ••• 000`.  
- Seis casillas de un dígito.  
- Botón `VERIFICAR WHATSAPP`, más enlaces `Reenviar código` y `Editar número`.  
- Advertencias: no compartir el código; SeguroLoTengo, Interseguros y Alianza no lo piden por llamada. Si es incorrecto o deja de ser válido, se muestra el motivo y se puede pedir otro.

**Bloque `TRES VALIDACIONES INDEPENDIENTES`:** OTP 1 · Pantalla 1 (verifica WhatsApp) — OTP 2 · Pantalla 4 (código diferente para el correo) — FIRMA · más adelante (Code100 validará y registrará la firma).

**Registro de seguridad:** fecha, hora, IP, número enmascarado, referencia del envío y resultado; el código no se conserva visible.

**Botón `CONTINUAR →`** deshabilitado; se habilita únicamente después de verificar el WhatsApp.

**Reglas:** OTP de 6 dígitos, uso único, vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos. En base se guarda solo el hash.

---

## P2 · Paso 2 de 9 — Selección de plan

Encabezado: `SEGUROLOTENGO.COM` y a la derecha `WhatsApp verificado · Marca y canal digital de Interseguros S.A.`

**Selector de producto:** `¿Qué seguro estás buscando?` / `Primero elegí el producto.` Cuatro opciones: `Seguro de Vida Oncológico` (activa, seleccionada) y Seguro de Vida, Accidentes Personales, Responsabilidad Civil, las tres con etiqueta `PRÓXIMAMENTE` y deshabilitadas.

**Título:** `Seguro de Vida Oncológico CONFÍO` — `Elegí uno de los tres planes. Los importes son premios anuales finales con IVA incluido.`

**Tres planes (valores exactos):**

| Cobertura | CONFÍO | CONFÍO+ | CONFÍO TOTAL |
| :---- | :---- | :---- | :---- |
| Muerte por cualquier causa | Gs. 3.500.000 | Gs. 5.000.000 | Gs. 7.000.000 |
| Indemnización por cáncer (pago único) | Gs. 50.000.000 | Gs. 75.000.000 | Gs. 100.000.000 |
| Renta hospitalaria (máx. 15 días por vigencia) | Gs. 7.500.000 (Gs. 500.000 por día) | Gs. 11.250.000 (Gs. 750.000 por día) | Gs. 15.000.000 (Gs. 1.000.000 por día) |
| Gastos médicos por accidente (reembolso hasta) | Gs. 7.000.000 | Gs. 10.000.000 | Gs. 14.000.000 |
| **Premio total anual (IVA incluido)** | **Gs. 290.000** | **Gs. 475.000** | **Gs. 660.000** |

Cada tarjeta lleva enlace `Ver coberturas, exclusiones y condiciones` y botón `SELECCIONAR`. La tarjeta seleccionada muestra badge `✓ SELECCIONADO`, fondo cálido y su botón dice `PLAN ELEGIDO`.

**Cuatro bloques informativos:**

- `CARENCIAS`: 180 días cáncer · 30 días renta hospitalaria · 1 día demás coberturas.  
- `EDADES`: ingreso 18 a 64 años; permanencia hasta 65 años; hasta 75 con diez años continuos antes de cumplir 65\.  
- `PAGO DE BENEFICIOS`: cáncer dentro de 5 días hábiles desde la presentación completa del reclamo; accidente por reembolso contra facturas y comprobantes, hasta la suma asegurada.  
- `HOSPITALIZACIÓN E INICIO`: renta fija por cada 24 horas continuas; 15 días acumulables por año de vigencia; cobertura 24 horas después del pago, una vez completada la contratación.

**Información precontractual:** el diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta finalizar la vigencia contratada. Enlaces `Ver documentación completa` y `Consultas y reclamos`.

**Acción:** `SELECCIONAR CONFÍO+ Y CONTINUAR →` con notas: al continuar se selecciona el plan, todavía no se contrata ni se firma; antes de la firma se podrá revisar y descargar la Solicitud, el FIPF y las condiciones. Leyenda inferior: la aceptación contractual se realizará posteriormente mediante firma electrónica en Code100.

**Regla técnica:** al seleccionar plan se guarda el ID de versión de la oferta y su hash SHA-256.

---

## P3 · Paso 3 de 9 — Preparación y autorización inicial

Título: `Prepará lo necesario` — `Antes de empezar, asegurate de tener estos cinco elementos a mano.` — `Esta pantalla no solicita datos, no realiza ningún cobro y no firma documentos.`

**Cinco tarjetas numeradas:**

1. **Cédula paraguaya vigente** — documento original, frente y dorso, legible y sin reflejos. Nota verde: *No se acepta pasaporte ni cédula extranjera.*  
2. **Celular con cámara y buena iluminación** — para fotografiar la cédula, realizar la selfie en vivo y completar la prueba de vida.  
3. **WhatsApp personal activo** — recibirá un código propio; hay que conservar acceso al número durante todo el proceso.  
4. **Correo electrónico activo** — recibirá un código diferente; se usará para avisos y documentos electrónicos.  
5. **Medio de pago disponible** — QR Bancard: se paga antes de firmar. Tarjeta: según modalidad habilitada. Nota verde: *No hay cobro en esta pantalla.*

**Bloque `ANTES DE INICIAR: REQUISITOS PARA LA EMISIÓN AUTOMÁTICA`** (cuatro columnas):

- *Solo para el titular*: el seguro únicamente puede contratarse para uno mismo; no se admite contratar para otra persona.  
- *Edad permitida*: entre 18 y 64 años, verificada con la cédula.  
- *Salud y condición PEP*: las declaraciones médicas y la condición PEP deben permitir la emisión automática; las preguntas se harán más adelante.  
- *Si el caso requiere análisis*: se detiene antes del pago y no se emite; se genera un número de caso distinto y la información se envía a Interseguros y Alianza.

**Banda azul:** la cobertura comenzará 24 horas después del pago confirmado, una vez completada la contratación y la firma del cliente.

**`AUTORIZACIÓN INICIAL PARA COMENZAR`:** al presionar `TENGO TODO LISTO`, se autoriza a Interseguros y Alianza a tratar y compartir los datos personales, de identificación, biométricos, médicos y de condición PEP necesarios para validar identidad, evaluar el riesgo, gestionar la solicitud y cumplir obligaciones regulatorias; si no es posible emitir automáticamente, se autoriza el envío del caso a Interseguros y Alianza para análisis y que puedan contactar. **Esto no contrata ni autoriza un pago.** Enlaces `Aviso de privacidad` y `Términos y condiciones`.

**Botón `TENGO TODO LISTO →`.** Notas: se registrarán fecha, hora, IP y versión del aviso; la aceptación contractual y la firma ocurrirán después.

---

## P4 · Paso 4 de 9 — Verificación de correo

Estructura idéntica a P1 pero para correo electrónico.

Título: `Verificá tu correo electrónico` — se usará para avisos del proceso y entrega de documentos electrónicos. Nota: **este código es diferente al de WhatsApp**; no contrata, no firma, no autoriza cobro.

**Panel izquierdo:** ilustración de correo, `CORREO PERSONAL — Debe ser una dirección activa a la que tengas acceso directo`, y tarjeta verde `✓ WhatsApp verificado · +595 ••• ••• 000`.

**Paso 1:** campo de correo (placeholder `Ej.: nombre@correo.com`) y botón `ENVIAR CÓDIGO`. Nota: a esa dirección se enviarán comunicaciones y, después de la emisión, los documentos electrónicos.

**Paso 2:** `Código enviado a m••••••@correo.com`, seis casillas, botón `VERIFICAR CORREO`, enlaces `Reenviar código` y `Editar correo`.

**Bloque `VALIDACIONES DEL PROCESO`:** OTP 1 · COMPLETADO (WhatsApp personal verificado) — OTP 2 · AHORA (verificación independiente del correo) — FIRMA · MÁS ADELANTE (Code100).

Mismas reglas de OTP que P1, con un código **criptográficamente distinto**.

---

## P5 · Paso 5 de 9 — Verificación de identidad

Título: `Verificá tu identidad` — fotografiar la cédula paraguaya vigente y realizar una selfie en vivo. **No se admite pasaporte ni documento extranjero. Esta pantalla no contiene declaraciones, pago ni firma.**

**Bloque 1 — Captura documental y biométrica:** tres tarjetas, cada una con estado `Pendiente`:

1. **Frente** — documento completo, enfocado y legible → `TOMAR FOTOGRAFÍA`  
2. **Dorso** — documento completo, enfocado y legible → `TOMAR FOTOGRAFÍA`  
3. **Selfie en vivo** — seguí los movimientos para la prueba de vida → `INICIAR VERIFICACIÓN`

Checkbox: *Autorizo la captura y comparación de mi imagen facial con la fotografía de mi cédula y la realización de la prueba de vida.* (nota: la autorización inicial de tratamiento de datos continúa vigente; esta confirmación es específica para la biometría).

Banda: *Las tres capturas deben aprobar calidad, prueba de vida y coincidencia facial.*

**Bloque 2 — Datos de identidad:** los datos se extraen de la cédula y se confirman con la selfie en vivo.

- Campos **autocompletados y bloqueados** (con ícono de candado, placeholder `Se completa automáticamente`): Número de cédula, Nombres, Apellidos, Fecha de nacimiento, Sexo, Nacionalidad.  
- Campos **obligatorios que el usuario sí completa**: `PAÍS DE NACIMIENTO` y `ESTADO CIVIL` (ambos selectores).  
- Bloque azul `EDAD CALCULADA AUTOMÁTICAMENTE`: se calcula desde la fecha de nacimiento y se incorpora al FIPF. A la derecha, en rojo: *Debe estar entre 18 y 64 años.*  
- Bloque rojo `¿LOS DATOS NO COINCIDEN?`: los campos extraídos **no se editan manualmente**; hay que volver a fotografiar la cédula. Enlace `Repetir captura`. Si persiste el error, el proceso no podrá continuar digitalmente.

**`REQUISITOS PARA CONTINUAR`** (cinco indicadores): cédula vigente y legible · frente y dorso aprobados · prueba de vida aprobada · coincidencia facial · país y estado civil completos.

**Registro de seguridad:** fecha, hora, IP, referencias de captura, hashes de las evidencias, resultado de prueba de vida y coincidencia biométrica.

**Botón `VALIDAR IDENTIDAD Y CONTINUAR →`**, habilitado solo con los cinco requisitos cumplidos.

---

## P6 · Paso 6 de 9 — Datos y declaraciones

Título: `Datos y declaraciones` — completá la información requerida para preparar la Solicitud y el FIPF. **Todavía no estás firmando, pagando ni autorizando un cobro.**

**Bloque 1 — Datos complementarios** (los marcados son obligatorios):

1. Domicilio · obligatorio (texto)  
2. Ciudad · obligatorio (selector)  
3. Situación laboral · obligatorio (selector)  
4. Actividad · obligatorio (selector)  
5. Profesión · obligatorio (selector)  
6. Empresa / empleador (texto)  
7. Ingreso mensual declarado · obligatorio (monto en guaraníes)

**Beneficiario por fallecimiento:** dos opciones excluyentes — `Herederos legales — 100%` (por defecto) o `Designar una persona — 100%`. Si se designa persona, se habilitan: Nombre completo, Parentesco (selector), Domicilio del beneficiario. Nota: *Una persona designada recibe el 100%.*

**Bloque 2 — Declaraciones obligatorias.** Cada una con badge que indica qué respuesta habilita la emisión automática, y opciones `Sí` / `No`:

| \# | Declaración | Habilita |
| :---- | :---- | :---- |
| 1 | **ESTADO DE SALUD** — Declaro que me encuentro en buen estado de salud y que no contrato este seguro para cubrir una enfermedad, diagnóstico o siniestro preexistente. | **Sí** |
| 2 | **ANTECEDENTES DE CONTRATACIÓN** — ¿Alguna aseguradora rechazó, postergó o condicionó una solicitud de seguro similar, o intentaste contratarlo para cubrir una enfermedad persistente? | **No** |
| 3 | **ENFERMEDADES DIAGNOSTICADAS** — ¿Tenés diagnosticado cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, esclerosis, enfermedad autoinmune, enfermedad inmunodeficiente, hepatitis o cirrosis? | **No** |
| 4 | **VIGENCIA Y CARENCIAS** — Declaro que la cobertura comienza 24 horas después del pago confirmado, una vez completadas la contratación y la emisión; revisé todas las carencias aplicables. | **Sí** |
| 5 | **VERACIDAD** — Declaro que los datos proporcionados son verdaderos y que el WhatsApp y el correo declarados son de mi propiedad y están bajo mi control. | **Sí** |
| 6 | **ENTREGA DIGITAL** — Acepto recibir la póliza y la factura en mis canales verificados, y disponer de la Solicitud y el FIPF firmados para descarga en SeguroLoTengo. | **Sí** |
| 7 | **CORREDOR DE LA PÓLIZA** — Tomo conocimiento de que Interseguros S.A. es el corredor de esta póliza y que su remuneración será pagada por Alianza Garantía. | **Sí** |
| 8 | **CONDICIÓN PEP** — ¿Sos una persona expuesta políticamente o estás vinculada a una? (con enlace `¿Qué significa PEP?`) | **No** |

**`REGLA AUTOMÁTICA DE ELEGIBILIDAD`:** una respuesta incompatible de salud, antecedentes, enfermedades diagnosticadas o PEP impide la emisión automática: **no se prepara el pago ni la firma.** SeguroLoTengo genera un número de caso distinto, envía la información a Interseguros y Alianza y, conforme a la autorización inicial, podrán contactar al solicitante → **Pantalla A**.

Leyenda inferior: las declaraciones médicas integrarán la Solicitud y la condición PEP integrará el FIPF; ambos se firmarán en la Pantalla 8 mediante Code100.

**Botón `GUARDAR Y CONTINUAR →`**, habilitado al completar datos y respuestas compatibles.

---

## P7 · Paso 7 de 9 — Facturación y garantía de pago

Título: `Facturación y garantía de pago` — prepará el pago antes de firmar. **La póliza todavía no se emite en esta pantalla.** Bancard procesa la operación directamente a favor de Alianza Garantía.

**Bloque 1 — Datos para la factura** (siempre a nombre del asegurado):

- `Nombre a quien facturar`: autocompletado con el nombre del asegurado.  
- `RUC`: manual, si corresponde. Nota: si queda vacío, SeguroLoTengo enviará automáticamente a Alianza el nombre y la cédula del asegurado.  
- `LIQUIDACIÓN DEL PREMIO`: Prima neta anual y IVA con `Valor oficial de Alianza`; `Premio total anual: Gs. 475.000`.  
- Checkbox **obligatorio**: *Declaro que los fondos utilizados para pagar el premio son de mi propiedad y tienen origen lícito.* (marcado en rojo como obligatorio para continuar).  
- `REFERENCIAS DE LA OPERACIÓN`: Propuesta / futura póliza `00018425`; Identificador Bancard `Se genera al confirmar` (se incorporará a la póliza).

**Bloque 2 — Elegí el medio de pago** (las modalidades tienen momentos de confirmación diferentes):

**QR BANCARD — pago definitivo antes de la firma** (opción por defecto):

- Bancard genera un QR por Gs. 475.000.  
- El pago se acredita directamente a Alianza.  
- Solo después del pago se habilita la firma.  
- Botón `GENERAR QR BANCARD`.  
- `PLAZO PARA FIRMAR: 24 HORAS` — si no se completa la firma dentro de 24 horas, la solicitud vence; se avisa por WhatsApp y correo y habrá que firmar la solicitud de devolución en las oficinas de Alianza Garantía.

**TARJETA DE CRÉDITO O DÉBITO — preautorización antes de la firma:**

- Bancard abre su formulario seguro.  
- Se reserva el importe; todavía no se cobra.  
- La firma del cliente ordena la captura.  
- Botón `PREAUTORIZAR TARJETA`.  
- `DEPENDENCIA DE BANCARD`: se habilitará cuando Bancard confirme la modalidad de preautorización y captura para el vPOS de Alianza. Si no se firma, se cancelará o liberará la reserva según Bancard.

> **Nota de implementación (divergencia vigente).** Bancard confirmó que la **preautorización aplica únicamente a tarjeta de crédito**. Con tarjeta de débito la preautorización ya mueve el dinero — *"al enviar la misma ya se realiza el movimiento de dinero, es decir, se acredita el monto preautorizado en la cuenta del comercio"* (`Integraciones/Preaut y promociones 14.pdf`) —, así que describirla como reserva sería informarle al cliente algo distinto de lo que ocurre con su plata (fila 25 de la matriz de cumplimiento).
>
> Por eso la pantalla implementada ofrece **tres** medios y no dos: el débito se separa del crédito y se agrupa con el QR como pago definitivo antes de la firma, resuelto por **compra simple de vPOS** (`Integraciones/eCommerce_bancard_compra_simple_version_1.23.1 (1).pdf`). El crédito conserva exactamente el texto y el comportamiento descritos arriba. Ver `MedioDePago` en `src/domain/tipos.ts`.

**`DESPUÉS DE ESTA PANTALLA`** (dos secuencias distintas):

- QR: `QR pagado → Firma Code100 → Solicitud de emisión`  
- Tarjeta: `Tarjeta preautorizada → Firma → Captura → Emisión`

**Seguridad y trazabilidad:** Alianza es el comercio adherido y titular de la cuenta. SeguroLoTengo e Interseguros no reciben el dinero ni almacenan el número completo de tarjeta o CVV. Se registrarán referencia, importe, estado, fecha, hora, respuesta e identificador Bancard. **El pago no equivale a firma ni emisión.**

**Botón `CONTINUAR A FIRMA →`**, habilitado al confirmar el pago QR o la preautorización.

---

## Pantalla A · Emisión no automática (derivación a revisión manual)

Se llega desde P6 cuando una declaración es incompatible o PEP \= Sí. **No lleva contador de pasos.**

Encabezado rojo: `Tu solicitud requiere una revisión adicional` — por la información declarada, la póliza no puede emitirse automáticamente. Interseguros y Alianza Garantía analizarán el caso y podrán contactar por los canales verificados. A la derecha: `SEGURO DE VIDA ONCOLÓGICO / REVISIÓN MANUAL`.

**`ESTADO DEL CASO`** (cuatro hitos): 1\. Datos verificados ✓ Completado · 2\. Declaraciones recibidas ✓ Completado · 3\. Revisión requerida ⚠ Derivación automática (se detuvo la emisión automática) · 4\. Análisis y contacto ⋯ Pendiente de análisis.

**`CASO DERIVADO PARA ANÁLISIS`:** Número de caso (generado), Estado `EN ANÁLISIS`, Motivo `[Salud / PEP / vínculo PEP]`. Datos del solicitante: nombre, documento, correo verificado enmascarado, WhatsApp verificado enmascarado. Bloque rojo `NO SE INICIÓ LA EMISIÓN`: no se generó póliza ni se inició su emisión; no se solicitó firma de contratación ni se realizó o autorizó ningún pago.

**`INFORMACIÓN ENVIADA PARA EL ANÁLISIS`:** identificación y datos de contacto ✓ · declaraciones relevantes ✓ · evidencias y trazabilidad ✓. Bloque verde `AUTORIZACIÓN YA OTORGADA`: conforme al consentimiento general inicial, se autorizó el análisis por Interseguros y Alianza y que puedan contactar.

**`¿QUÉ OCURRIRÁ AHORA?`:** 1\. Remisión segura → 2\. Análisis → 3\. Contacto → 4\. Resultado.

**Pie:** datos de contacto de Alianza (análisis del riesgo) e Interseguros (asistencia y seguimiento), botón `FINALIZAR / Volver al inicio`. Leyendas: la derivación no significa un rechazo definitivo. **Regla del sistema: no continuar a pago Bancard, firma Code100 ni emisión mediante SEBAOT.** El número de caso de revisión es distinto del correlativo de una propuesta o póliza.

---

## Pantalla de asistencia de identidad (agregado 2026-08-14)

**No forma parte de las 12 pantallas originales.** Es una decisión de producto posterior, sin fila en la matriz de cumplimiento, y nace de un callejón sin salida real: quien no logra verificar su identidad en P5 —documento gastado, formato anterior sin MRZ, cámara pobre— repetía capturas indefinidamente. P5 decía *"si persiste el error, el proceso no podrá continuar digitalmente"*, y eso en la práctica era una pared sin puerta.

Se llega **desde P5** tras **tres análisis fallidos**. **No lleva contador de pasos.**

**No es la Pantalla A y no debe confundirse con ella:**

| | Pantalla A | Asistencia de identidad |
| :---- | :---- | :---- |
| Se llega desde | P6, declaración incompatible o PEP | P5, identidad no verificable |
| Estado | `DERIVADO_MANUAL` | `ASISTENCIA_IDENTIDAD` |
| Motivo | Salud / PEP / vínculo PEP | Falla técnica de lectura o comparación |
| ¿Bloquea la cédula? | **Sí** (regla inviolable #11) | **No** — puede reintentar |
| Número de caso | `CASO-AAAA-NNNNNN` | `ASIS-AAAA-NNNNNN` |

Encabezado naranja: `No pudimos verificar tu identidad automáticamente` — no es un rechazo y no hay nada anotado en contra de la persona; el sistema no logró leer el documento o confirmar la selfie. A la derecha: `SEGURO DE VIDA ONCOLÓGICO / ASISTENCIA DE IDENTIDAD`.

**`ESTADO DEL CASO`** (cuatro hitos, veraces para este camino): 1. Canales verificados ✓ WhatsApp y correo · 2. Verificación de identidad ⚠ No se pudo completar automáticamente · 3. Asistencia de un asesor ⋯ Pendiente de contacto · 4. Continuar la contratación ⋯ Se retoma cuando la identidad quede verificada.

*(Ojo: los hitos de la Pantalla A dicen `Declaraciones recibidas ✓`. Acá sería falso — la persona nunca llegó a P6.)*

**`CASO DE ASISTENCIA`:** número de caso `ASIS-…`, WhatsApp y correo verificados **enmascarados**. **No muestra identidad**, porque en este camino no la hay: el expediente llegó acá justamente porque no se pudo verificar.

**Bloque verde `PODÉS VOLVER A INTENTARLO`:** la cédula no quedó bloqueada; con mejor luz, una fotografía más nítida o el documento vigente a mano, se puede empezar de nuevo. **Es el bloque que distingue esta pantalla de una derivación** — sin él la persona se va creyendo que quedó vetada.

**`QUÉ CONVIENE REVISAR ANTES DE REINTENTAR`:** iluminación y reflejos, documento completo en el recuadro, rostro de frente sin lentes ni barbijo, y renovar la cédula si está muy gastada o vencida. Salen de los motivos de rechazo reales; **nunca mencionan umbrales ni puntuaciones**, que son para la evidencia.

**Bloque rojo `NO SE INICIÓ NINGUNA CONTRATACIÓN`:** no se generó póliza, no se pidió firma, no se realizó ni autorizó ningún pago.

**`TE PODEMOS AYUDAR`:** contacto de Interseguros (asistencia y seguimiento). No se muestra el de Alianza: no hay riesgo que analizar, hay una captura que resolver.

**Pie:** botones `VOLVER A INTENTAR` (a P1) y `Volver al inicio`. Leyendas: no poder verificar automáticamente no significa que no se pueda contratar; y el número de caso de asistencia es distinto del correlativo de una propuesta y del caso de una revisión por elegibilidad.

**Regla del sistema:** `ASISTENCIA_IDENTIDAD` es terminal en ese expediente —no continúa a pago, firma ni emisión— pero **no bloquea la cédula**: la persona puede iniciar un expediente nuevo. Es la diferencia central con `DERIVADO_MANUAL`.

---

## P8 · Paso 8 de 9 — Revisión y firma final

Título: `Revisión y firma final` — revisá los documentos cerrados y firmalos en un único proceso seguro de Code100. **La aceptación contractual ocurre al firmar en Code100, no al presionar un botón del portal.**

**Bloque 1 — Revisá los documentos** (badge `DATOS E IDENTIDAD VERIFICADOS`):

- **Solicitud de Seguro de Vida Oncológico** · Código `PROP-00018425` — plan, coberturas, premio y beneficiario; declaraciones médicas y autorizaciones; versión definitiva preparada para firma. Botones `VER PDF` y `DESCARGAR`. Marca: `PDF cerrado · hash registrado`.  
- **Formulario de Identificación de Persona Física** · Código `FIPF-00018425` — datos personales, laborales y económicos; identificación, PEP, origen de fondos y evidencias; vinculado al mismo correlativo de la Solicitud. Mismos botones y marca.  
- `ACCESO PREVIO A LA INFORMACIÓN`: enlaces a Coberturas, exclusiones y carencias · Condiciones del seguro · Aviso de privacidad. Nota: después de enviar, los documentos no podrán modificarse sin generar una nueva versión y nuevas huellas digitales.

**Bloque 2 — Elegí el canal** (Code100 enviará el enlace al canal elegido): `WhatsApp verificado +595 ••• ••• 000` (por defecto) o `Correo verificado m••••••@correo.com`.

- `GARANTÍA DE PAGO LISTA`: modalidad elegida en la Pantalla 7 — QR pagado o tarjeta preautorizada. *Esta firma no solicita nuevos datos de pago.*  
- `UN SOLO ACTO DE FIRMA`: la firma electrónica no cualificada del cliente quedará vinculada simultáneamente a la Solicitud y al FIPF mediante sus huellas digitales.

**Bloque 3 — Firmá mediante Code100:**

- `DECLARACIÓN QUE SE ACEPTARÁ AL FIRMAR`: declaro haber tenido acceso y haber revisado la Solicitud, el FIPF, las condiciones, coberturas, exclusiones, carencias, premio y forma de entrega; confirmo la veracidad de los datos; acepto el contenido de ambos documentos y solicito la emisión de la póliza electrónica de Seguro de Vida Oncológico. La aceptación queda registrada por Code100 junto con la firma.  
- Botón `ENVIAR ENLACE SEGURO DE FIRMA`. Nota: Code100 enviará el enlace al canal verificado seleccionado.  
- Progreso de tres pasos: `1. Recibí el enlace → 2. Abrí y firmá → 3. Volvé al portal`, con estado `Esperando confirmación verificable de Code100`.  
- Nota inferior: QR — seguimiento manual de firma a 1, 5 y 12 horas; vencimiento a las 24 horas.

**`DESPUÉS DE LA FIRMA DEL CLIENTE`** (cuatro pasos): 1\. Confirmación Code100 (cliente firmó Solicitud \+ FIPF; se verifican hashes y transacción) → 2\. Firmas y cobro (Interseguros y Alianza firman ambos PDF; Bancard confirma el cobro e identificador) → 3\. Envío y validación (SeguroLoTengo remite el expediente a Alianza; Alianza valida automáticamente mediante SEBAOT) → 4\. Emisión y entrega (Alianza emite y firma la póliza electrónica; envía póliza y factura a canales verificados).

Leyendas: **no se genera Nota de Cobertura**; la póliza conserva el correlativo de la Solicitud y el identificador de Bancard. Se registrarán PDFs, hashes, aceptación, canal, ID de Code100, firmantes, fecha, hora, IP, estados y callbacks.

---

## P9 · Paso 9 de 9 — Contratación aceptada

Encabezado verde: `¡Tu solicitud de seguro fue aceptada!` — Alianza Garantía emitirá tu póliza y la recibirás en breves momentos en tu correo y WhatsApp verificados. A la derecha: `SEGURO DE VIDA ONCOLÓGICO / CONFÍO+ · Gs. 475.000`.

**`ESTADO DE LA CONTRATACIÓN`** (cuatro hitos con fecha y hora registradas): 1\. Firmas Code100 ✓ (Solicitud y FIPF completamente firmados) · 2\. Pago Bancard ✓ (pago confirmado e identificado) · 3\. Solicitud aceptada ✓ (validación automática de Alianza Garantía) · 4\. Póliza en preparación ⋯ (emisión y envío en breves momentos, a cargo de Alianza Garantía).

**`RESUMEN DE LA CONTRATACIÓN`:** Número de propuesta `PROP-00018425` · Estado de la solicitud `ACEPTADA` · Referencia Bancard `[ID confirmado]`. Asegurado, documento, medio de pago (`QR Bancard / tarjeta terminada en ••••`), Estado de la póliza `EN PROCESO DE EMISIÓN`. Bloque `IMPORTANTE`: la póliza será emitida por Alianza Garantía y entregada en breves momentos; correo y WhatsApp verificados. El inicio de cobertura será informado en la póliza electrónica emitida por Alianza Garantía.

**Documentos:**

- `DOCUMENTOS QUE RECIBIRÁS EN BREVES MOMENTOS` — Póliza electrónica y Factura electrónica, ambas con badge `EN EMISIÓN` (las emite y envía Alianza por correo y WhatsApp).  
- `DOCUMENTOS DISPONIBLES PARA DESCARGAR` — Solicitud de Seguro de Vida Oncológico y Formulario de Identificación de Persona Física, ambos firmados por cliente, Interseguros y Alianza Garantía, con botón `DESCARGAR`.  
- Leyenda: **No se genera Nota de Cobertura.**

**`¿QUÉ OCURRIRÁ AHORA?`:** 1\. Emitir la póliza (Alianza mediante SEBAOT) → 2\. Firmar la póliza (Alianza mediante Code100) → 3\. Enviar al correo verificado → 4\. Enviar al WhatsApp verificado.

**Pie:** contactos de Alianza (emisión, cobertura y reclamos) e Interseguros (asistencia y seguimiento). Bloque `COMUNICACIONES COMERCIALES · OPCIONAL`: checkbox **desmarcado por defecto** para recibir por WhatsApp y correo ofertas de otros seguros comercializados por Interseguros, revocable en cualquier momento. Botón `FINALIZAR / Volver al inicio`.

---

## Pantalla B · QR pagado, firma no completada

Encabezado rojo: `Tu solicitud venció porque no completaste la firma` — se inició el procedimiento de devolución del premio pagado mediante QR Bancard. Se informa por WhatsApp y correo verificados.

**`SEGUIMIENTO DE FIRMA`** (cuatro hitos): 1 HORA — alerta manual, recordatorio por WhatsApp · 5 HORAS — segundo recordatorio · 12 HORAS — último recordatorio · 24 HORAS — solicitud vencida, notificación y devolución.

**`RESUMEN DEL CASO`:** Propuesta `PROP-00018425` · Pago Bancard `[Referencia confirmada]` · Premio `Gs. 475.000`. Asegurado, documento, WhatsApp y correo enmascarados. Bloque rojo: **No existe póliza emitida ni cobertura iniciada.**

**`PROCEDIMIENTO DE DEVOLUCIÓN`:** 1\. Notificación doble (SeguroLoTengo informa por WhatsApp y correo verificados) → 2\. Presentación en Alianza (acudir a las oficinas con la cédula) → 3\. Formulario firmado (firmar la solicitud presencial de devolución del premio) → 4\. Devolución al origen (Alianza devuelve únicamente al medio o cuenta de origen). Bloque rojo: **No se devuelve en efectivo, a terceros ni a otra cuenta.**

**`ACTORES Y REGISTRO`:** SeguroLoTengo controla el plazo, registra el estado y genera las comunicaciones · Interseguros verifica manualmente la firma y realiza los recordatorios de 1, 5 y 12 horas · Alianza Garantía recibe el caso, obtiene el formulario firmado y ejecuta la devolución al origen · Bancard identifica el pago y procesa la devolución conforme al procedimiento habilitado.

**`EVIDENCIA CONSERVADA`:** pago y referencia Bancard · fecha y hora · avisos a WhatsApp y correo · alertas de seguimiento · vencimiento · formulario de devolución · aprobación · devolución y cuenta de origen.

**Pie:** `Estado final del expediente: VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`  
