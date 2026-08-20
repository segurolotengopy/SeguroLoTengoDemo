# Especificación de pantallas — SeguroLoTengo (fuente de verdad)

Extraída de `Pantallas_Sistema_Demo.pdf` y **reescrita el 20-ago-2026 al cerrarse el Lote 4 del Plan de Cambios v2**. Este documento manda sobre cualquier otro en cuanto a qué muestra cada pantalla; donde el Plan v2 o la Matriz Legal V4 lo contradigan, mandan ellos y acá queda anotado.

> **Qué cambió respecto de la versión original.** El wizard pasó de **9 pasos a 8**. El plan subió al paso 1 y el OTP de WhatsApp al 2 (CHG-01); el OTP de correo **desapareció como paso** y el correo se declara con doble tipeo dentro de identidad (D-06); **la firma se adelantó al paso 6 y el pago pasó al 7** (D-08), con lo cual el cobro ya no se garantiza antes de firmar sino que se realiza después; la Solicitud y el FIPF se unificaron en **un solo PDF** con un solo hash y un solo acto de firma (D-11); y el plazo de 24 horas dejó de medir "tiempo para firmar lo ya pagado" para medir **tiempo para pagar lo ya firmado** (D-10).
>
> **El orden vigente no vive en este documento**, vive en `PASOS_FLUJO` (`src/domain/rutas-flujo.ts`), que es de donde la aplicación deriva el número de paso y el stepper. Si este texto y esa lista discrepan, gana la lista: escribir un número de paso a mano fue exactamente cómo la pantalla de firma llegó a anunciar "Paso 7 de 7".
>
> Las rutas son slugs semánticos sin número (D-22): `/plan`, `/whatsapp`, `/preparacion`, `/identidad`, `/declaraciones`, `/firma`, `/pago`, `/confirmacion`. Las rutas viejas (`/p1-whatsapp`, `/p7-pago`, …) responden **308** hacia la nueva.

## Elementos comunes a todas las pantallas

**Cabecera fija (tres bloques):**

- Izquierda: `ASEGURADORA · Alianza Garantía Seguros y Reaseguros S.A.` con su logo.  
- Centro: `INTERMEDIARIO · Interseguros S.A. - Corredores de Seguros` con su logo.  
- Derecha: indicador de paso.

**Indicador de paso (derecha de la cabecera):**

- P0: `P0 · INFORMACIÓN` / `FUERA DEL CONTADOR 1-8`  
- Pasos 1 a 8: `PASO N DE 8` \+ 8 puntos, los completados en naranja. **El stepper recibe el slug de la pantalla, nunca un número:** el orden se deriva de `PASOS_FLUJO`.  
- Pantalla A: `PANTALLA A` / `SEGUROLOTENGO` / `EMISIÓN NO AUTOMÁTICA`  
- Pantalla B: `PANTALLA B` / `FIRMADA · PAGO NO COMPLETADO`

**Barra de plan seleccionado** (presente desde el paso 3 hasta el 7): ícono de check, `PLAN SELECCIONADO`, `Seguro de Vida Oncológico · CONFÍO+`, `Gs. 475.000 al año · IVA incluido`, y enlace `Cambiar plan` a la derecha. En los pasos de firma y pago el texto dice `premio anual · IVA incluido`.

**Paleta:** azul institucional para títulos y etiquetas, naranja para acciones primarias y alertas, verde para confirmaciones y textos de seguridad, rojo para bloqueos, fondo hueso claro, tarjetas blancas con borde negro fino y esquinas redondeadas.

**Pie de cada pantalla:** enlace de retroceso a la izquierda (`← Volver a ...`) y bloque de `REGISTRO DE SEGURIDAD` cuando corresponde.

---

## P0 · Información (fuera del contador)

Página pública informativa. **No solicita datos médicos ni PEP, no genera propuesta, no cobra, no emite póliza.**

- Encabezado: `SEGUROLOTENGO.COM` y a la derecha `Marca y canal digital de Interseguros S.A.`  
- Bloque principal: título `Protegé hoy lo que más importa mañana`, bajada sobre el Seguro de Vida Oncológico CONFÍO (respaldo económico ante diagnóstico de cáncer, cobertura por fallecimiento, renta hospitalaria y gastos médicos por accidente), botón `Elegí tu plan y cotizá →` —el catálogo es ahora el paso 1 (CHG-01)—, y leyenda verde `La contratación comienza recién en el paso 1.`  
- Panel derecho: `VIDEO INFORMATIVO` con reproductor y pie `Qué cubre · Cómo funciona · Cómo contratar`.  
- `PRODUCTOS DISPONIBLES`: cuatro tarjetas. Solo `CONFÍO` (Seguro de Vida Oncológico) está `Disponible` con botón `CONOCER`; Seguro de Vida, Accidentes Personales y Responsabilidad Civil dicen `Próximamente`.  
- `ANTES DE CONTRATAR`: cuatro ítems — Coberturas y sumas / Exclusiones y carencias (revisá 180, 30 y 1 día según cobertura) / Siniestros y beneficios / Privacidad y seguridad.  
- `AYUDA Y CONSULTAS`: Preguntas frecuentes, Contactar a Interseguros, Consultas y reclamos, y la nota `Chat con IA: previsto para la versión 2.`  
- Banda verde inferior con la leyenda de que la página es informativa.  
- Pie: `Información pública · Versión 1 · Sin chat con inteligencia artificial`

---

## Paso 1 · Selección de plan — `/plan`

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

## Paso 2 · Verificación de WhatsApp — `/whatsapp`

Banda superior: `INICIO SEGURO / Verificación inicial de tu WhatsApp personal` y a la derecha `TODAVÍA NO ES UNA CONTRATACIÓN — No se selecciona plan, no se firma y no se realiza ningún cobro.`

Título: `Verificá tu WhatsApp personal`. Subtítulo azul: será el primer canal verificado y deberá permanecer activo. Nota: el código solo valida el canal, no contrata, no firma, no autoriza cobro.

**Panel izquierdo (ilustrativo):** teléfono con `Código de verificación`, seis casillas, `Uso único · No lo compartas`, y `WHATSAPP PERSONAL — El mensaje contendrá un código de uso único para esta verificación.`

**Paso 1 — Ingresá tu número:**

- Selector de país y campo de número, placeholder con el ejemplo del país elegido (`Ej.: 981 000 000` para Paraguay). *Actualización 2026-08-14 (decisión de producto, pruebas del demo con celulares del exterior): el selector ofrece los países de la región — Paraguay por defecto, Bolivia y vecinos — con validación estricta para Paraguay y Bolivia. La versión original contemplaba solo Paraguay (`+595`). El envío real por WhatsApp-Modular cubre hoy `+595` y `+591`; el resto opera en modo simulado.*  
- Botón `ENVIAR CÓDIGO` (contorno verde).  
- Checkbox obligatorio: *Autorizo usar este número para verificar el canal, proteger el acceso y continuar el proceso. No autoriza publicidad.*

**Paso 2 — Ingresá el código recibido:**

- Leyenda verde con el número enmascarado: `Código enviado al número +595 ••• ••• 000`.  
- Seis casillas de un dígito.  
- Botón `VERIFICAR WHATSAPP`, más enlaces `Reenviar código` y `Editar número`.  
- Advertencias: no compartir el código; SeguroLoTengo, Interseguros y Alianza no lo piden por llamada. Si es incorrecto o deja de ser válido, se muestra el motivo y se puede pedir otro.

**Bloque `DOS VALIDACIONES INDEPENDIENTES`:** OTP de canal · este paso (verifica WhatsApp) — FIRMA · más adelante (Code100 validará y registrará la firma). Eran tres: el OTP de correo se retiró (D-06) y el correo pasó a declararse con doble tipeo en el paso de identidad.

**Registro de seguridad:** fecha, hora, IP, número enmascarado, referencia del envío y resultado; el código no se conserva visible.

**Botón `CONTINUAR →`** deshabilitado; se habilita únicamente después de verificar el WhatsApp.

**Reglas:** OTP de 6 dígitos, uso único, vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos. En base se guarda solo el hash.

---

## Paso 3 · Preparación y autorización inicial — `/preparacion`

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

## El paso de correo ya no existe (D-06)

Había una pantalla propia de verificación de correo, con su propio OTP —el segundo de tres—. **Se retiró.** El correo se declara ahora con **doble tipeo** dentro de la pantalla de identidad y se respalda con la declaración de veracidad que integra el documento firmado, que es el reemplazo probatorio del código.

Queda **un solo OTP de canal**, el de WhatsApp, más el del acto de firma que vive del lado de Code100. La regla inviolable #1 se re-redactó sobre eso.

El estado `CANAL_EMAIL_VERIFICADO` **sobrevive sin aristas de entrada**: hay expedientes históricos ahí y la consola tiene que seguir leyéndolos (regla inviolable #10). La ruta vieja `/p4-correo` redirige a `/identidad`.

---

## Paso 4 · Identidad y correo — `/identidad`

Título: `Verificá tu identidad` — declarar el correo, fotografiar la cédula paraguaya vigente y realizar una selfie en vivo. **No se admite pasaporte ni documento extranjero. Esta pantalla no contiene declaraciones médicas, pago ni firma.**

**Bloque 0 — Tu correo electrónico** (CHG-14/17, D-06). Va **arriba de la captura**: es lo primero que se pide en esta pantalla.

- Dos campos, `Correo electrónico` y `Repetí tu correo electrónico`, que deben coincidir. El doble tipeo reemplaza al OTP que el correo tenía como paso propio.  
- Nota: se usará para avisos del proceso y para la entrega de documentos electrónicos. **No se envía ningún código**: la veracidad del correo queda respaldada por la declaración que integra el documento que se firma en el paso 6.  
- El correo declarado deja evidencia propia con la versión del texto aceptado, que es lo que reemplaza al código como respaldo probatorio.

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

**`REQUISITOS PARA CONTINUAR`** (seis indicadores): correo declarado dos veces y coincidente · cédula vigente y legible · frente y dorso aprobados · prueba de vida aprobada · coincidencia facial · país y estado civil completos.

**Registro de seguridad:** fecha, hora, IP, referencias de captura, hashes de las evidencias, resultado de prueba de vida y coincidencia biométrica.

**Botón `VALIDAR IDENTIDAD Y CONTINUAR →`**, habilitado solo con los cinco requisitos cumplidos.

---

## Paso 5 · Datos y declaraciones — `/declaraciones`

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

Leyenda inferior: las declaraciones médicas integrarán la Solicitud y la condición PEP integrará el FIPF; **ambas secciones se cierran al salir de esta pantalla** y se firman en el paso siguiente mediante Code100.

**Botón `GUARDAR Y CONTINUAR →`**, habilitado al completar datos y respuestas compatibles.

---

## Paso 6 · Revisá, aceptá y firmá — `/firma`

Título: `Revisá, aceptá y firmá` — revisá el documento cerrado y firmalo en un único proceso seguro de Code100. **La aceptación contractual ocurre al firmar en Code100, no al presionar un botón del portal.**

> **Este paso se adelantó** (D-08): ahora va **antes** del pago. Al entrar, el expediente viene de declaraciones y todavía no se cobró nada; firmar es justamente lo que habilita el cobro.

**Bloque 1 — Revisá el documento** (badge `DATOS E IDENTIDAD VERIFICADOS`):

- **Solicitud de Seguro de Vida Oncológico y FIPF** · Código `PROP-00018425`, con la sección FIPF identificada como `FIPF-00018425`. **Un solo PDF** (D-11): plan, coberturas, premio y beneficiario; declaraciones médicas, de licitud y veracidad y de cuenta propia; datos personales, laborales y económicos, condición PEP y evidencias.  
- Marca `PDF cerrado · hash registrado` con **un** SHA-256, y la advertencia del **art. 1556 del Código Civil** con el sello de tiempo de la solicitud (CMP-09).  
- Botón `VER PDF`. **No hay botón de descarga** (CHG-29): se puede revisar el documento entero, pero no llevárselo antes de firmarlo, porque todavía no lo firmó nadie. La descarga se habilita después del pago, cuando el documento ya es el instrumento definitivo. El texto lo dice en vez de dejar que la ausencia del botón parezca un olvido, y **no promete que el archivo sea inaccesible**: quien arme la petición recibe el mismo PDF cerrado.  
- `ACCESO PREVIO A LA INFORMACIÓN`: enlaces a Coberturas, exclusiones y carencias · Condiciones del seguro · Aviso de privacidad.

**Bloque 2 — Elegí el canal** (Code100 enviará el enlace al canal elegido): `WhatsApp verificado` (por defecto) o `Correo verificado`, ambos enmascarados. El destino sale del expediente, nunca de un campo que la persona escriba (reglas inviolables #1 y #9).

- `DESPUÉS DE FIRMAR`: **todavía no se cobró nada.** Al firmar se habilita el pago, y hay 24 horas para completarlo. Este bloque reemplaza al de `GARANTÍA DE PAGO LISTA`, que describía el orden viejo.  
- `UN SOLO ACTO DE FIRMA`: la Solicitud y el FIPF no pueden firmarse por separado porque **son secciones del mismo PDF**. La regla inviolable #3 dejó de ser una validación y pasó a ser una propiedad de la estructura.

**Bloque 3 — Firmá mediante Code100:**

- `DECLARACIÓN QUE SE ACEPTARÁ AL FIRMAR` (Matriz §4, bloque *Firma del cliente*): confirmo que tuve acceso al PDF único de Solicitud + FIPF, pude revisarlo y corregir mis datos, acepto su contenido y deseo firmarlo mediante Code100. Casilla vacía + firma simple; el OTP previo de WhatsApp respalda identificación y trazabilidad.  
- Botón `ENVIAR ENLACE SEGURO DE FIRMA`.  
- Progreso de tres pasos: `1. Recibí el enlace → 2. Abrí y firmá → 3. Volvé al portal`, con estado `Esperando confirmación verificable de Code100`.

**Cómo se entera el portal de que se firmó** (CHG-33): por **dos vías**, y las dos pueden llegar por el mismo acto — el sondeo cada dos segundos, y el retorno del navegador al volver de la ventana de Code100. La que llega primero transiciona; la segunda encuentra el expediente firmado, responde lo mismo y queda registrada como duplicada. La idempotencia es por `session_id`. **No hay webhook**: el contrato de Code100 no expone ninguno (PEN-02).

**Firmantes** (D-13), configurables en `firmantes-documento.ts`: cliente (simple, Code100) → Interseguros (cualificada) → Alianza Garantía (cualificada). El cliente firma primero y firma simple; toda institucional es cualificada. Entre la firma del cliente y las institucionales el expediente pasa por `FIRMADO_CLIENTE`, que existe para que **un sellado a medio hacer sea distinguible de un expediente sin firmar**: si las institucionales no llegan, el cobro sigue inhabilitado y el sondeo siguiente retoma ese tramo.

> **Divergencia registrada (ALR-07).** La Matriz V4 §2 dice que *"Alianza no firma la propuesta salvo exigencia del modelo"*. D-13 establece lo contrario y manda D-13; Rodrigo y Legal deben actualizar la matriz.

Leyendas: **no se genera Nota de Cobertura**; la póliza conserva el correlativo de la Solicitud. Se registran PDF, hash, aceptación, canal, `session_id`, firmantes con su nivel y modalidad, fecha, hora, IP y el origen de cada confirmación.

---

## Paso 7 · Realizá el pago — `/pago`

Título: `Realizá el pago` (CHG-39, D-16) — **ya firmaste la Solicitud: falta el pago para contratar el seguro.** La póliza la emite Alianza Garantía después del pago. Bancard procesa la operación directamente a favor de Alianza.

> **Este paso se movió, y con él cambió lo que significa** (D-08, Matriz Legal V4 §7). Antes iba **antes** de la firma y su trabajo era dejar una garantía de cobro para poder firmar; ahora va **después** y su trabajo es cobrar lo que ya se firmó. La razón es la que da la matriz: cobrar antes de la firma deja a la persona pagando por un contrato que todavía no aceptó, y obliga a devolver el premio cada vez que no firma.
>
> El corolario está en el código, no en un texto: **no existe la transición `DECLARACIONES_OK → PAGO_CONFIRMADO`**. El único estado desde el que se abre una operación en Bancard es `FIRMADO`.

**Bloque 1 — Datos para la factura** (siempre a nombre del asegurado):

- `Nombre a quien facturar`: autocompletado con el nombre del asegurado, bloqueado (regla inviolable #9).  
- `RUC`: manual y opcional. Si queda vacío, la pantalla **muestra cuál es la identificación que va a viajar** a Alianza: la cédula del asegurado, enmascarada (CHG-34). Antes esa caída existía y no se decía.  
- `LIQUIDACIÓN DEL PREMIO`: Prima neta anual e IVA, con la nota de que la apertura es provisional hasta el desglose oficial de Alianza (D-04); `Premio total anual: Gs. 475.000`. Todos los importes en guaraníes.  
- **No hay casilla de origen lícito.** La declaración de licitud y veracidad se integró al PDF que la persona firmó dos pasos antes (Matriz §4: *"no casilla adicional"*).  
- `REFERENCIAS DE LA OPERACIÓN`: Propuesta / futura póliza `00018425` —acuñada al cerrarse el documento, no acá— e Identificador Bancard `Se genera al confirmar`.

**Bloque 2 — Elegí el medio de pago.** Los tres cobran el premio total en el momento (D-02): cambia por dónde entra el dinero, no cuándo. La preautorización se retiró del flujo.

- **QR Bancard** (por defecto) — Bancard genera un QR por el premio total; se acredita directamente a Alianza. Botón `GENERAR QR BANCARD`.  
- **Tarjeta de débito** — formulario seguro de Bancard; el importe se debita y acredita en el momento. Botón `PAGAR CON DÉBITO`.  
- **Tarjeta de crédito** — formulario seguro de Bancard; cobro directo. Botón `PAGAR CON TARJETA DE CRÉDITO`.

En los tres, la viñeta dice lo mismo: **el medio de cobro se habilitó porque la Solicitud ya está firmada.**

**`PLAZO PARA PAGAR: 24 HORAS`** (D-10), con cuenta regresiva. Si el pago no se completa, la solicitud vence y se avisa por WhatsApp y correo. **No hubo cobro, así que no hay nada que devolver**: se puede iniciar una solicitud nueva. Esto invierte el aviso anterior, que prometía una devolución presencial en las oficinas de Alianza.

**El medio de cobro se emite contra el documento firmado** (CMP-08): cada emisión —y cada regeneración— queda asentada junto con la huella SHA-256 del PDF. Si esa huella no estuviera, no se abre ninguna operación: cobrar sin poder probar qué se firmó rompería el vínculo de la fila 47.

**Botón `REALIZAR EL PAGO Y CONTRATAR EL SEGURO`** (CHG-38). Con el pago antes de la firma este texto habría mentido —el pago garantizaba, no contrataba—; con el orden nuevo es lo que efectivamente ocurre.

**Seguridad y trazabilidad:** Alianza es el comercio adherido y titular de la cuenta. SeguroLoTengo e Interseguros no reciben el dinero ni almacenan el número completo de tarjeta o CVV (regla inviolable #6). **El pago no equivale a la emisión de la póliza.**

Confirmado el cobro, `VER LA CONFIRMACIÓN →`.

---

## Paso 8 · Contratación aceptada — `/confirmacion`

Encabezado verde: `¡Tu solicitud de seguro fue aceptada!` — Alianza Garantía emitirá tu póliza y la recibirás en breves momentos en tu correo y WhatsApp verificados. A la derecha: `SEGURO DE VIDA ONCOLÓGICO / CONFÍO+ · Gs. 475.000`.

**`ESTADO DE LA CONTRATACIÓN`** (cuatro hitos con fecha y hora registradas): 1\. Firmas Code100 ✓ (documento único firmado por cliente, Interseguros y Alianza) · 2\. Pago Bancard ✓ (pago confirmado e identificado) · 3\. Solicitud aceptada ✓ (validación automática de Alianza Garantía) · 4\. Póliza en preparación ⋯ (emisión y envío a cargo de Alianza Garantía). **El orden de los dos primeros hitos se invirtió con D-08:** primero se firma, después se cobra.

**`RESUMEN DE LA CONTRATACIÓN`:** Número de propuesta `PROP-00018425` · Estado de la solicitud `ACEPTADA` · Referencia Bancard `[ID confirmado]`. Asegurado, documento, medio de pago (`QR Bancard / tarjeta terminada en ••••`), Estado de la póliza `EN PROCESO DE EMISIÓN`. Bloque `IMPORTANTE`: la póliza será emitida por Alianza Garantía y entregada en breves momentos; correo y WhatsApp verificados. El inicio de cobertura será informado en la póliza electrónica emitida por Alianza Garantía.

**Documentos:**

- `DOCUMENTOS QUE RECIBIRÁS EN BREVES MOMENTOS` — Póliza electrónica y Factura electrónica, ambas con badge `EN EMISIÓN` (las emite y envía Alianza por correo y WhatsApp).  
- `DOCUMENTOS DISPONIBLES PARA DESCARGAR` — **un** documento: `Solicitud de Seguro de Vida Oncológico y FIPF (firmado)`, con las firmas de cliente, Interseguros y Alianza Garantía, y botón `DESCARGAR`. Es acá donde la descarga se habilita: antes de firmar el visor no la ofrece (CHG-29).  
- Leyenda: **No se genera Nota de Cobertura.**

**`¿QUÉ OCURRIRÁ AHORA?`:** 1\. Emitir la póliza (Alianza mediante SEBAOT) → 2\. Firmar la póliza (Alianza mediante Code100) → 3\. Enviar al correo verificado → 4\. Enviar al WhatsApp verificado.

**Pie:** contactos de Alianza (emisión, cobertura y reclamos) e Interseguros (asistencia y seguimiento). Bloque `COMUNICACIONES COMERCIALES · OPCIONAL`: checkbox **desmarcado por defecto** para recibir por WhatsApp y correo ofertas de otros seguros comercializados por Interseguros, revocable en cualquier momento. Botón `FINALIZAR / Volver al inicio`.

---

## Pantalla A · Emisión no automática (derivación a revisión manual)

Se llega desde el paso de declaraciones cuando una declaración es incompatible o PEP \= Sí. **No lleva contador de pasos.**

Encabezado rojo: `Tu solicitud requiere una revisión adicional` — por la información declarada, la póliza no puede emitirse automáticamente. Interseguros y Alianza Garantía analizarán el caso y podrán contactar por los canales verificados. A la derecha: `SEGURO DE VIDA ONCOLÓGICO / REVISIÓN MANUAL`.

**`ESTADO DEL CASO`** (cuatro hitos): 1\. Datos verificados ✓ Completado · 2\. Declaraciones recibidas ✓ Completado · 3\. Revisión requerida ⚠ Derivación automática (se detuvo la emisión automática) · 4\. Análisis y contacto ⋯ Pendiente de análisis.

**`CASO DERIVADO PARA ANÁLISIS`:** Número de caso (generado), Estado `EN ANÁLISIS`, Motivo `[Salud / PEP / vínculo PEP]`. Datos del solicitante: nombre, documento, correo verificado enmascarado, WhatsApp verificado enmascarado. Bloque rojo `NO SE INICIÓ LA EMISIÓN`: no se generó póliza ni se inició su emisión; no se solicitó firma de contratación ni se realizó o autorizó ningún pago.

**`INFORMACIÓN ENVIADA PARA EL ANÁLISIS`:** identificación y datos de contacto ✓ · declaraciones relevantes ✓ · evidencias y trazabilidad ✓. Bloque verde `AUTORIZACIÓN YA OTORGADA`: conforme al consentimiento general inicial, se autorizó el análisis por Interseguros y Alianza y que puedan contactar.

**`¿QUÉ OCURRIRÁ AHORA?`:** 1\. Remisión segura → 2\. Análisis → 3\. Contacto → 4\. Resultado.

**Pie:** datos de contacto de Alianza (análisis del riesgo) e Interseguros (asistencia y seguimiento), botón `FINALIZAR / Volver al inicio`. Leyendas: la derivación no significa un rechazo definitivo. **Regla del sistema: no continuar a pago Bancard, firma Code100 ni emisión mediante SEBAOT.** El número de caso de revisión es distinto del correlativo de una propuesta o póliza.

---

## Pantalla de asistencia de identidad (agregado 2026-08-14)

**No forma parte de las 12 pantallas originales.** Es una decisión de producto posterior, sin fila en la matriz de cumplimiento, y nace de un callejón sin salida real: quien no logra verificar su identidad en el paso 4 —documento gastado, formato anterior sin MRZ, cámara pobre— repetía capturas indefinidamente. Ese paso decía *"si persiste el error, el proceso no podrá continuar digitalmente"*, y eso en la práctica era una pared sin puerta.

Se llega **desde el paso de identidad** tras **tres análisis fallidos**. **No lleva contador de pasos.**

**No es la Pantalla A y no debe confundirse con ella:**

| | Pantalla A | Asistencia de identidad |
| :---- | :---- | :---- |
| Se llega desde | Paso 5, declaración incompatible o PEP | Paso 4, identidad no verificable |
| Estado | `DERIVADO_MANUAL` | `ASISTENCIA_IDENTIDAD` |
| Motivo | Salud / PEP / vínculo PEP | Falla técnica de lectura o comparación |
| ¿Bloquea la cédula? | **Sí** (regla inviolable #11) | **No** — puede reintentar |
| Número de caso | `CASO-AAAA-NNNNNN` | `ASIS-AAAA-NNNNNN` |

Encabezado naranja: `No pudimos verificar tu identidad automáticamente` — no es un rechazo y no hay nada anotado en contra de la persona; el sistema no logró leer el documento o confirmar la selfie. A la derecha: `SEGURO DE VIDA ONCOLÓGICO / ASISTENCIA DE IDENTIDAD`.

**`ESTADO DEL CASO`** (cuatro hitos, veraces para este camino): 1. Canales verificados ✓ WhatsApp y correo · 2. Verificación de identidad ⚠ No se pudo completar automáticamente · 3. Asistencia de un asesor ⋯ Pendiente de contacto · 4. Continuar la contratación ⋯ Se retoma cuando la identidad quede verificada.

*(Ojo: los hitos de la Pantalla A dicen `Declaraciones recibidas ✓`. Acá sería falso — la persona nunca llegó a declarar nada.)*

**`CASO DE ASISTENCIA`:** número de caso `ASIS-…`, WhatsApp y correo verificados **enmascarados**. **No muestra identidad**, porque en este camino no la hay: el expediente llegó acá justamente porque no se pudo verificar.

**Bloque verde `PODÉS VOLVER A INTENTARLO`:** la cédula no quedó bloqueada; con mejor luz, una fotografía más nítida o el documento vigente a mano, se puede empezar de nuevo. **Es el bloque que distingue esta pantalla de una derivación** — sin él la persona se va creyendo que quedó vetada.

**`QUÉ CONVIENE REVISAR ANTES DE REINTENTAR`:** iluminación y reflejos, documento completo en el recuadro, rostro de frente sin lentes ni barbijo, y renovar la cédula si está muy gastada o vencida. Salen de los motivos de rechazo reales; **nunca mencionan umbrales ni puntuaciones**, que son para la evidencia.

**Bloque rojo `NO SE INICIÓ NINGUNA CONTRATACIÓN`:** no se generó póliza, no se pidió firma, no se realizó ni autorizó ningún pago.

**`TE PODEMOS AYUDAR`:** contacto de Interseguros (asistencia y seguimiento). No se muestra el de Alianza: no hay riesgo que analizar, hay una captura que resolver.

**Pie:** botones `VOLVER A INTENTAR` (al inicio del flujo) y `Volver al inicio`. Leyendas: no poder verificar automáticamente no significa que no se pueda contratar; y el número de caso de asistencia es distinto del correlativo de una propuesta y del caso de una revisión por elegibilidad.

**Regla del sistema:** `ASISTENCIA_IDENTIDAD` es terminal en ese expediente —no continúa a pago, firma ni emisión— pero **no bloquea la cédula**: la persona puede iniciar un expediente nuevo. Es la diferencia central con `DERIVADO_MANUAL`.

---

## Pantalla B · Solicitud vencida sin cobro

> **Esta pantalla cambió de caso** (D-08/D-10). Describía un QR pagado y una firma que no llegaba, con su procedimiento de devolución. Con el orden invertido eso **ya no puede ocurrir**: se firma primero y se cobra después, así que lo que caduca es un expediente **firmado y no pagado** y no hay premio que devolver. Vencer dejó de costar plata, que era el punto de invertir el orden.

Encabezado rojo: `Tu solicitud venció porque no completaste el pago` — **no se realizó ningún cobro**: firmaste la Solicitud pero el pago no llegó dentro de las 24 horas, así que no hay nada que devolverte. Se informa por WhatsApp y correo verificados.

Indicador: `PANTALLA B` / `FIRMADA · PAGO NO COMPLETADO`.

**`SEGUIMIENTO DEL PLAZO`** (cuatro hitos, contados desde que el expediente quedó firmado): 1 HORA — alerta manual, recordatorio por WhatsApp · 5 HORAS — segundo recordatorio · 12 HORAS — último recordatorio · 24 HORAS — solicitud vencida y notificación a los dos canales. Los tres primeros los hace Interseguros a mano, no el sistema.

**`RESUMEN DEL CASO`:** Propuesta `PROP-00018425` · Premio `Gs. 475.000` · Asegurado, documento, WhatsApp y correo enmascarados. Sin referencia de Bancard, porque no hubo operación. Bloque rojo: **No existe póliza emitida ni cobertura iniciada.**

**`QUÉ PASA AHORA`:** 1\. Notificación doble (SeguroLoTengo informa por WhatsApp y correo verificados) → 2\. Sin movimiento de dinero (no se generó ningún cobro: no salió ni se reservó nada de tu cuenta) → 3\. Sin trámite presencial (no hay formulario que firmar ni que acudir a las oficinas) → 4\. Podés volver a empezar (tu documentación firmada queda archivada y podés iniciar una solicitud nueva). Bloque rojo: **No se realizó ningún cobro, así que no hay premio que devolver.**

**Estado final: `VENCIDO`.** Es el final del camino en el flujo vigente.

### Variante legada · devolución (Pv1-B)

Los expedientes que vencieron **bajo el orden viejo** —con el pago hecho y sin firmar— no se reescriben (regla inviolable #10) y su trámite sigue abierto. Para ellos la pantalla conserva los literales originales: `PROCEDIMIENTO DE DEVOLUCIÓN` en cuatro pasos —notificación doble → presentación en Alianza con la cédula → formulario presencial firmado → devolución **únicamente** al medio o cuenta de origen—, con el bloque rojo `No se devuelve en efectivo, a terceros ni a otra cuenta`, y el pie `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`.

Cuál de las dos se muestra lo decide si el dinero efectivamente entró, no el medio de pago ni la fecha del expediente.

**`ACTORES Y REGISTRO`:** SeguroLoTengo controla el plazo, registra el estado y genera las comunicaciones · Interseguros realiza los recordatorios de 1, 5 y 12 horas · Alianza Garantía, solo en la variante legada, obtiene el formulario firmado y ejecuta la devolución al origen.

**`EVIDENCIA CONSERVADA`:** firma y su huella · fecha y hora · avisos a WhatsApp y correo · alertas de seguimiento · vencimiento. En la variante legada, además: pago y referencia Bancard, formulario de devolución, aprobación y devolución al origen.
