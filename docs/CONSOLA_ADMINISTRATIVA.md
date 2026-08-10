# Consola administrativa — especificación

**Estado: implementada el 2026-08-09** (definida en sesión de planificación del 2026-08-07). Ruta `/admin-consola`; flag `ADMIN_CONSOLE_ENABLED`, clave `ADMIN_CONSOLE_KEY`. Lo que quedó pendiente está marcado en la sección 6. No forma parte de `Pantallas_Sistema_Demo.pdf` ni de las 12 pantallas de `ESPECIFICACION_PANTALLAS.md` — es una herramienta interna nueva, para staff de AAB1/Interseguros/Alianza, no para el cliente final. No cuenta como pantalla del flujo B2C ni lleva stepper "Paso N de 9".

Si algo de este documento contradice una decisión posterior del usuario, gana la decisión más reciente — a diferencia de `ESPECIFICACION_PANTALLAS.md`, esto no viene de un PDF de referencia externo, así que es editable por acuerdo directo.

---

## 1. Propósito

Consola operativa para que el equipo interno audite el estado de cada `Expediente`: qué pasos completó, qué se envió a cada proveedor externo (o mock) y qué respondió, si terminó derivado a revisión manual (Pantalla A) o vencido sin firma (Pantalla B), y — con justificativo — habilitar que esa persona vuelva a intentar la contratación.

## 2. Acceso (Vía A / demo)

- Ruta propia, ej. `/admin-consola`, protegida por clave simple en variable de entorno (mismo patrón que `/demo-panel`): `ADMIN_CONSOLE_KEY`.
- **No hay roles todavía** — quien tiene la clave puede consultar y también autorizar reinicios. Control de acceso granular (roles "solo lectura" vs "puede reiniciar", usuarios nominales) queda explícitamente diferido a Vía B (producción); anotarlo ahí para no perderlo.
- Igual que el panel de demo: compilado fuera del bundle / inaccesible si no corresponde a este entorno — a definir junto con `infra-devops` si comparte flag con `DEMO_MODE` o tiene uno propio (`ADMIN_CONSOLE_ENABLED`).

## 3. Búsqueda de expedientes

Criterios combinables:

- **Cédula o nombre del titular.**
- **Número de propuesta / caso**: `PROP-xxxxx`, `FIPF-xxxxx`, o el número de caso de derivación (Pantalla A) — son correlativos distintos, la búsqueda debe aceptar cualquiera de los tres formatos.
- **Estado del expediente** (según la máquina de estados de `CLAUDE.md`: `INICIADO`, `CANAL_WA_VERIFICADO`, ..., `DERIVADO_MANUAL`, `VENCIDO`, `EMITIDO`, etc.) **+ rango de fechas** (inicio o última actividad).
- **Canal verificado** (WhatsApp o correo) — dato sensible: se busca por hash/últimos dígitos, nunca se muestra ni se filtra por el valor completo en claro.

Resultado: listado con identificador de expediente, titular (enmascarado salvo que se abra el detalle), estado actual, fecha de última actividad, y badge si está `DERIVADO_MANUAL` o `VENCIDO` (bloqueado para nuevo registro — ver sección 5).

## 4. Vista de detalle de un expediente

- **Datos del expediente**: los mismos bloques del modelo de datos ya documentado en `GUIA_DEMO_SEGUROLOTENGO.md` (META, IDENTIDAD, DECLARACIONES, PAGO, PAQUETE) — de solo lectura, nunca editable desde la consola.
- **Envíos a proveedores (resumen y detalle)**: una fila por cada llamada a los 7 puertos (`OtpProvider`, `IdentityProvider`, `ComplianceProvider`, `PaymentProvider`, `SignatureProvider`, `PolicyIssuer`, `EvidenceStore`), **incluidas las llamadas a los adaptadores mock** — no solo cuando haya proveedores oficiales. Vista resumen: proveedor, propósito, timestamp, resultado (éxito/rechazo/timeout). Vista detalle: payload de solicitud y de respuesta, con las mismas exclusiones que ya rigen para toda la evidencia:
  - nunca el código OTP en claro,
  - nunca PAN completo ni CVV,
  - las respuestas médicas y la condición PEP se muestran acá (es una herramienta de cumplimiento interno, no analítica/CRM/IA — la regla 7 de `CLAUDE.md` excluye esos destinos, no a esta consola; dejar esto explícito en el código para que no se confunda con la prohibición).
- **Registro de evidencia** ya definido (fecha, hora, IP, dispositivo, sesión, versión de texto aceptado, resultado por paso) — mismo componente que ya se usa en `/demo-panel`, reutilizar.
- **Estado terminal visible**: si el expediente es `DERIVADO_MANUAL` (Pantalla A) o `VENCIDO`/`DEVOLUCION_EN_TRAMITE` (Pantalla B), mostrarlo de forma explícita, junto con el motivo y la fecha.

## 5. Bloqueo de nuevo registro y reinicio

- Mientras exista un expediente en estado `DERIVADO_MANUAL` o `VENCIDO`/`DEVOLUCION_EN_TRAMITE` para una misma cédula, el sistema **bloquea un nuevo intento de contratación** con esa cédula desde el flujo digital normal (P0–P9). Esto es una regla de negocio nueva, agregarla a la lista de reglas inviolables de `CLAUDE.md` una vez implementada.
- **La consola puede levantar ese bloqueo, pero no reactivando el expediente viejo.** Mecanismo:
  1. El expediente original **nunca cambia de estado** — `DERIVADO_MANUAL` sigue siendo terminal en el flujo digital, tal como ya establece la regla de negocio inviolable #5. Esto es innegociable, no se toca aunque sea vía consola.
  2. La consola crea un **`Expediente` nuevo** (nuevo id, `INICIADO`) para la misma persona.
  3. Al expediente viejo se le agrega un registro de evidencia (append-only, nunca se sobrescribe) del tipo "reiniciado por admin": usuario/clave que autorizó, timestamp, justificativo, y el id del expediente nuevo.
  4. El justificativo es obligatorio. Catálogo sugerido (a confirmar tamaño final, por ahora abierto): `Error en el ingreso de información`, `Error en la respuesta del proveedor`, `Solicitud del cliente`, `Otro` (con texto libre obligatorio si se elige "Otro").
  5. El expediente nuevo queda enlazado al anterior (campo `expedienteAnteriorId` o similar) para trazabilidad — nunca se pierde el historial.

## 6. Pendiente de definir en una sesión futura

- Tamaño final y textos exactos del catálogo de justificativos. *(Se implementaron los cuatro sugeridos; `Otro` exige texto libre.)*
- Si el bloqueo de "nuevo registro" aplica también antes de tener cédula conocida (P1–P4, identificado solo por WhatsApp/correo) o recién desde P5 en adelante. **Decisión provisoria al implementar: desde P5**, que es donde el OCR entrega la cédula. Antes de P5 no hay contra qué consultar.
- Migración de esta clave simple a roles reales en Vía B. Hoy quien tiene `ADMIN_CONSOLE_KEY` consulta y también autoriza reinicios.
- **Envíos a proveedores (sección 4, segundo bullet): no implementado.** La consola muestra el registro de evidencia (`EvidenceStore`), que ya trae paso, resultado, timestamp, IP y hashes. Lo que falta es la vista de payload de solicitud/respuesta por llamada a cada uno de los 7 puertos, incluidos los mocks — eso requiere que los adaptadores registren sus envíos, que hoy no lo hacen.
- **Búsqueda por nombre a escala real.** Hoy es un filtro en memoria sobre el resultado de un criterio indexado (cédula, caso, o estado + fechas). DynamoDB no busca por substring; con volumen real hay que mover esto a un motor de texto.
- **Búsqueda por canal verificado (hash / últimos dígitos), sección 3, cuarto criterio: no implementada.**
- **Test unitario dedicado del enmascarado del listado de búsqueda.** `armarResultados` y `filtrarPorNombre` (`src/domain/consola-administrativa.ts`) enmascaran titular y documento para la sección 3, pero no tienen prueba directa propia — hoy solo quedan cubiertos de forma indirecta por la suite de bloqueo (`derivado-manual-sin-salida.test.ts`). Anotado como pendiente en la auditoría de reglas inviolables del 2026-08-10.
