# Análisis de los documentos de integración — Code100 y Bancard

**Fecha:** 2026-08-12
**Documentos analizados:**

- `docs/Integraciones/Documentacion Firmador - API FLOW.pdf` (Code100, 5 págs.)
- `docs/Integraciones/eCommerce_bancard_compra_simple_version_1.23.1 (1).pdf` (Bancard vPOS Single Buy v1.23, 86 págs.)
- `docs/Integraciones/Preaut y promociones 14.pdf` (Bancard vPOS, esquema de preautorización, 9 págs.)
- `docs/Integraciones/Qr en API de Comercios v1.2 16 (1).pdf` (Bancard Ventas QR v1.2, 11 págs.)

**Contrastados contra:** `src/ports/payment-provider.ts` y `src/ports/signature-provider.ts`.

**Conclusión general:** los dos puertos calzan con los contratos reales de los proveedores — no hace falta rediseñar ninguna interfaz. Quedan **6 preguntas abiertas** (sección final) que requieren respuesta del proveedor o decisión de producto antes de escribir los adaptadores `live/`, y una serie de detalles de mapeo que este documento deja asentados para esa implementación.

---

## 1. Code100 — API Flow del firmador

### 1.1 Mapeo endpoint ↔ puerto

| Endpoint | Método de `SignatureProvider` |
| :---- | :---- |
| `POST /signature/auth` (username/password → token Bearer) | interno del adaptador |
| `GET /signature/session-start` (→ `_authUrl` + `session_id`) | `iniciarFirma` |
| `POST /signature/getSessionId` (→ `code`, `state`, `cert_info`, `status`, `fecha_expiracion`, `expirado`) | `confirmarResultado` |
| `POST /signature/sign-pdf` (code, state, session_id, `document[]` → `documents_signeds`) | `descargarDocumentosFirmados` |

### 1.2 Hallazgos

1. **`sign-pdf` no es una descarga: es el acto de firma.** El flujo real es: la persona se autentica en el `_authUrl` (OAuth con PKCE, `code_challenge_method=S256`), `getSessionId` devuelve `code` y `state`, y recién ahí el comercio invoca `sign-pdf` con esos valores más los PDF en base64 — la respuesta ya es el documento firmado. El nombre `descargarDocumentosFirmados` sugiere una operación pasiva e idempotente, pero en el adaptador oficial esa llamada **ejecuta** la firma. Consecuencia para el adaptador `live/`: llamarlo **una sola vez**, persistir los dos PDF firmados de inmediato (vía `ArchivoRepository`), y responder desde lo persistido en cualquier reintento. El documento no dice qué pasa si se rellama, y no hay que averiguarlo en producción.

2. **La regla inviolable #3 (atomicidad) se implementa con el array `document`.** `sign-pdf` acepta varios documentos (`nro_odt` por cada uno, con `container_sign` para la ubicación de la firma y `pdf_base64`) bajo el mismo `code`/`state`/`session_id`. La Solicitud y el FIPF viajan como dos entradas de **una misma llamada**, nunca en dos llamadas separadas — exactamente lo que el puerto ya exige a nivel de tipos (`DocumentosFirmados` sin campos opcionales).

3. **El documento no dice quién envía el enlace por el canal.** El PDF solo muestra el `_authUrl` embebido en un iframe (`width=1000 height=600`). El comentario de `FirmaIniciada.urlActoDeFirma` asume que "Code100 le manda a la persona por el canal elegido", pero esa capacidad no está documentada en el API Flow. O el envío por WhatsApp/correo lo hace SeguroLoTengo (con Infobip, cuando exista ese adaptador), o es una función de Code100 que necesita documentación aparte. **Pregunta abierta #1.**

4. **No hay callbacks documentados.** `CLAUDE.md` pide tratar los callbacks de Code100 como idempotentes, pero este PDF solo ofrece polling vía `getSessionId` — coherente con cómo P8 ya sondea. Si el contrato comercial incluye webhooks, falta ese documento en `docs/Integraciones/`.

5. **La multifirma no está en este documento.** El orden cliente (no cualificada) → Interseguros y Alianza (cualificada, en paralelo) es regla del proyecto, pero el API Flow no muestra cómo se orquesta más de un firmante ni certificados de terceros: la respuesta de `getSessionId` trae un solo `cert_info`. **Pregunta abierta #2.**

6. **Evidencia disponible y vigencia.** `cert_info` trae emisor (`issuerO`, con marca `[HOMOLOG]` en el ambiente de pruebas), `subjectCN`, `subjectSN` (aparenta ser la cédula del firmante), validez del certificado, más `session_id`, `created_at`, `fecha_expiracion` y `expirado` — cubre lo que exige la fila 42 de la matriz de cumplimiento (identidad, fecha, hora, resultado; IP y canal los aporta SeguroLoTengo). En el ejemplo del PDF la expiración cae ~21 h después de `created_at`: compatible con las 24 h de la fila 41, pero el documento **no declara la duración** del enlace. Tampoco documenta códigos de error ni el TTL del token de `auth` (manejar re-auth ante 401), así que el mapeo a `MotivoNoFirmado` va a ser parcialmente inferido: hoy solo `EXPIRADA` tiene fuente clara (`expirado: true`). **Pregunta abierta #3.**

---

## 2. Bancard — vPOS compra simple + preautorización

### 2.1 Mapeo operación ↔ puerto

| Método de `PaymentProvider` | Operación vPOS |
| :---- | :---- |
| `iniciarPagoTarjetaDebito` | `POST /vpos/api/0.3/single_buy` (sin flag) + iframe `Bancard.Checkout.createForm` |
| `iniciarPreautorizacionTarjeta` | `single_buy` con `preauthorization: "S"` |
| `capturarPreautorizacion` | `POST /vpos/api/0.3/preauthorizations/confirm` |
| `cancelarOLiberarReserva` | `POST /vpos/api/0.3/single_buy/rollback` |
| `consultarEstadoPago` | `POST /vpos/api/0.3/single_buy/confirmations` (`get_confirmation`) |
| (webhook entrante, sin método en el puerto) | `single_buy_confirm` — POST de vPOS a la URL configurada en el portal de comercios |

Ambientes: producción `https://vpos.infonet.com.py`, staging `https://vpos.infonet.com.py:8888` (habilitar el puerto 8888 en desarrollo). Exigen TLS 1.2 del lado del comercio.

### 2.2 Hallazgos

1. **El flag `preauthorization` se manda antes de conocer la tarjeta — y hay tarjetas donde la preaut no existe o mueve dinero.** El iframe acepta cualquier tarjeta, pero: (a) la preautorización solo aplica a VISA/Mastercard emitidas por Bancard y Mastercard internacionales — **VISA internacional y otras marcas quedan afuera**; (b) si la persona mete una tarjeta de débito en una operación con `preauthorization: "S"`, el dinero **se acredita al comercio en el acto** (ya documentado en el comentario de `iniciarPreautorizacionTarjeta`). P7 le pregunta el medio a la persona, pero nada le impide tipear una TD en el camino de crédito. Mitigación disponible: `extra_response_attributes: ["payment_card_type"]` devuelve `credit`/`debit` en la respuesta — el adaptador puede detectar el cruce y disparar rollback el mismo día. Qué hace P7 con un cliente de crédito VISA internacional es **pregunta abierta #4** (decisión de producto: no tiene fila en la matriz de cumplimiento).

2. **El rollback solo funciona el día de la operación** ("reversas automáticas", antes de que la transacción se cupone). Después devuelve `TransactionAlreadyConfirmed` y la reversión pasa a ser un trámite manual por el portal (soporte/anulaciones). Esto **valida el diseño del dominio**: el vencimiento de firma es a 24 h del pago, así que la Pantalla B con `DEVOLUCION_EN_TRAMITE` → `DEVUELTO` presencial de Alianza es exactamente lo que el contrato de Bancard impone. El adaptador `live/` debe mapear `TransactionAlreadyConfirmed` a "derivar a devolución manual", no a error.

3. **La confirmación de preautorización es de un solo tiro.** "Una preautorización solo puede ser confirmada una vez y no es posible hacer el reintento de la confirmación... si una confirmación queda rechazada entonces no puede volver a ser reintentada." El reintento solo está permitido ante **falla de comunicación** (el propio documento lo pide). Esto refina el contrato de `capturarPreautorizacion`: idempotente ante timeout, terminal ante rechazo — el estado que la palanca "fallo de captura de Bancard" del panel de demo ya ensaya. Además (v1.23): **monto mínimo de confirmación USD 1** (control de marcas emisoras) — con primas en guaraníes no debería morder, pero queda asentado. La confirmación admite monto menor (se acredita la diferencia al usuario) o hasta +20 % con TC; CONFÍO siempre confirma el monto exacto, así que no aplica. La preautorización no confirmada vence sola a los 30 días.

4. **Mapeo de errores a desenlaces, no excepciones.** En rollback: `PaymentNotFoundError` significa "el cliente nunca pagó" y el documento pide tomarlo como respuesta correcta; `AlreadyRollbackedError` es el caso idempotente que el contrato del puerto ya exige absorber. En `get_confirmation`: `PaymentNotFoundError` mapea al `null` de `consultarEstadoPago`. El anexo trae la tabla completa de códigos de respuesta de pago (00 aprobada, 05, 12, 15, 51, 71 "operación ya extornada", etc.).

5. **Restricciones operativas para el onboarding y el adaptador:**
   - El webhook `single_buy_confirm` exige responder HTTP 200 en **30 segundos**; no responder **no** significa transacción denegada — siempre re-consultar con `get_confirmation`. Tiempo de espera recomendado antes de consultar/reversar: 10 minutos.
   - La URL de confirmación **se configura en el portal de comercios, no por API** — tarea de onboarding/infra, no de código.
   - Autenticación por operación con `token = md5(private_key + …)` (fórmula distinta por operación, montos como string con dos decimales y punto). Es un esquema débil, pero **es el contrato**: no inventar otro. La clave privada nunca viaja en claro.
   - `shop_process_id` es un **entero de 15 dígitos**: `PROP-<correlativo>` no entra tal cual. El adaptador mapea la `idempotencyKey` a un `shop_process_id` numérico persistido (dos llamadas con la misma clave reusan el mismo; cada intento de pago legítimo acuña uno nuevo).
   - Bloqueo antifraude por reintentos: **7 rechazos de la misma tarjeta en 24 h, o 35 en 30 días, bloquean la tarjeta en el comercio por 30 días** ("MANDATO MC MAC 03 y 21"). P7 debería limitar reintentos antes de llegar ahí.
   - Restricciones de UI en la pantalla de resultado: mostrar fecha/hora, número de pedido (`shop_process_id`), importe y `response_description`; **no** mostrar `authorization_number`, `response_code`, `extended_response_description` ni `security_information`. Verificar contra `ESPECIFICACION_PANTALLAS.md` cuando se cablee el adaptador.
   - `risk_index` (0–9) llega en `security_information` para TC local: dato de seguridad, no de salud/PEP — puede persistirse como evidencia. Las acciones ante riesgo medio/alto son recomendación operativa de Bancard, decisión de producto adoptarlas.
   - Pase a producción: exige completar la **lista de test** del portal (single_buy, confirm, get_confirmation, rollback exitosos) y certificación del equipo de soporte de Bancard. El flag `test_client` en el JSON evita marcar la lista.

6. **Qué NO usar de vPOS.** Todo el bloque de catastro / pago con token / 3DS / Zimple no aplica (pago ocasional único, reglas #6 y #9). Y el elemento `billing` de factura electrónica **no debe usarse**: la factura de CONFÍO la emite Alianza vía SEBAOT/SIFEN (regla transversal "Póliza y factura las emite y envía Alianza") — que nadie "complete" ese campo por prolijidad.

---

## 3. Bancard — QR en API de Comercios

### 3.1 Mapeo

| Método de `PaymentProvider` | Operación QR |
| :---- | :---- |
| `iniciarPagoQr` | `POST /commerces/:commerce_code/branches/:branch_code/selling/generate-qr-express` |
| `cancelarOLiberarReserva` (rama QR) | `PUT .../selling/payments/revert/:hook_alias` |
| (webhook entrante) | callback POST de Bancard al endpoint del comercio (obligatorio de implementar) |

La `referenciaBancard` natural para QR es el `hook_alias`. El `qrPayload` sale de `qr_data` (cadena EMVCo) o de la `url` del PNG que devuelve Bancard — coherente con la decisión de P7 de no dibujar el QR localmente.

### 3.2 Hallazgos

1. **Autenticación distinta de vPOS**: Basic Auth con usuario `apps/` + clave pública y contraseña la clave privada, concatenadas con `:` y codificadas en Base64 (RFC 2045, sin límite de 76 caracteres por línea). El adaptador `live/` va a tener **dos clientes HTTP con esquemas distintos** aunque ambos sean "Bancard".

2. **El callback exige responder en ≤ 5 segundos** (contra 30 s en vPOS) **o Bancard reversa la transacción automáticamente**. El Route Handler que lo reciba tiene que persistir y responder, nada de trabajo pesado inline. Respuesta con `content-type: application/json`, `status: success` y `messages[{key: "Confirmed", level: "success"}]` (o `ConfirmedError` / `error` para rechazar).

3. **Manejo fino de duplicados y carreras, documentado por Bancard:** si el comercio ya envió una solicitud de reversa y después llega el callback de pago, debe responder **error** (no success) — responder success en ese caso está marcado explícitamente como incorrecto. Esto alimenta directamente la sección "Idempotencia de webhooks" de `CLAUDE.md`.

4. **La reversa es obligatoria de consumir** cuando: no llega el callback en un tiempo X (recomiendan ~5 min, configurable del lado del comercio), el cajero/flujo cancela la venta, o no hay certeza del resultado. Desenlaces tipificados: `ConfirmationNotFoundError` = el pago nunca se realizó (equivale al `PaymentNotFoundError` de vPOS); `response_code 71` = la operación ya se reversó automáticamente. Ambos son desenlaces esperables, no errores. La respuesta de la reversa indica que la **invocación** fue recibida, no que la reversa fue exitosa — mirar el elemento `reverse`.

5. **Datos del callback**: `status` (`confirmed`/`failed`), `response_code` (00 = exitoso), `amount`, `currency`, `installment_number`, `ticket_number`, `authorization_code`, `hook_alias`, `commerce_name`/`branch_name`, `account_type` (TC/TD/DC — débito en cuenta llega con `card_last_numbers` vacío), `card_last_numbers`, `bin`, `merchant_code`, `payer` opcional (nombre y apellido). Alcanza para `ultimos4Digitos` sin acercarse nunca al PAN (regla inviolable #6).

6. **Dos huecos del documento** (→ preguntas abiertas #5 y #6): (a) la **expiración del QR dinámico no está declarada** — el puerto expone `expiraEn` y el mock lo inventa; (b) el control de cambios menciona una URL de "obtener pagos por hook_alias" (la consulta de estado que `consultarEstadoPago` necesita para la rama QR), pero el cuerpo del documento no la especifica — sin ella, el estado de un QR solo se conoce por callback.

---

## 4. Preguntas abiertas

Ninguna bloquea el modo demo actual; todas preceden a los adaptadores `live/`.

| # | Destinatario | Pregunta |
| :---- | :---- | :---- |
| 1 | Code100 | ¿Quién envía el enlace de firma por WhatsApp/correo: Code100 o el comercio? El API Flow solo documenta el iframe. |
| 2 | Code100 | ¿Cómo se orquesta la firma cualificada de Interseguros y Alianza (multifirma, orden cliente → cualificadas en paralelo)? Falta documentación. |
| 3 | Code100 | ¿La vigencia del enlace es configurable a 24 h (fila 41)? ¿Qué devuelve `sign-pdf` ante sesión expirada o segunda invocación? ¿TTL del token de `auth`? ¿Hay webhooks o solo polling? |
| 4 | Producto/negocio | Camino de pago para crédito **VISA internacional u otras marcas**, donde la preautorización no aplica: ¿compra simple directa (cobra antes de la firma, como débito/QR) o rechazo con mensaje? Sin fila en la matriz de cumplimiento — decisión de producto. |
| 5 | Bancard | TTL / expiración del QR dinámico de `generate-qr-express`. |
| 6 | Bancard | Especificación del endpoint de consulta de pagos por `hook_alias` (mencionado en el control de cambios v1.0.2 del documento QR, sin detalle en el cuerpo). |

---

## 5. Recomendaciones para los adaptadores `live/`

1. **`signature-provider.ts` (Code100):** `iniciarFirma` = `auth` + `session-start`; `confirmarResultado` = `getSessionId`; `descargarDocumentosFirmados` = `sign-pdf` **una sola vez**, con la Solicitud y el FIPF en el mismo array `document`, persistiendo los firmados antes de devolver. Manejar re-auth del token Bearer. Registrar `session_id`, `cert_info`, `created_at`, `fecha_expiracion` como evidencia.
2. **`payment-provider.ts` (Bancard):** dos clientes HTTP (vPOS con tokens md5, QR con Basic Auth). Tabla de mapeo `idempotencyKey → shop_process_id` numérico persistida. `TransactionAlreadyConfirmed` → derivación a devolución manual (Pantalla B); `AlreadyRollbackedError` y `PaymentNotFoundError`/`ConfirmationNotFoundError` → desenlaces idempotentes/benignos, no excepciones. Enviar `extra_response_attributes: ["payment_card_type"]` en toda compra simple para detectar el cruce débito/crédito.
3. **Route Handlers de webhooks:** presupuesto de 5 s (QR) / 30 s (vPOS); persistir y responder, procesar después. Responder `error` al callback de un pago cuya reversa ya se solicitó.
4. **No implementar** catastro, pago con token, 3DS, Zimple ni el elemento `billing` de factura electrónica de Bancard.
5. **Onboarding (infra, no código):** URL de confirmación en el portal de comercios, puerto 8888 habilitado para staging, TLS 1.2, lista de test + certificación para el pase a producción.
6. **P7 (cuando se retoque esa pantalla):** limitar reintentos de pago con tarjeta (bloqueo Bancard a los 7 rechazos en 24 h) y respetar las restricciones de la interfaz de respuesta (§2.2.5). El script `bancard-checkout-4.0.0.js` se carga desde `vpos.infonet.com.py` en el navegador: encapsularlo en un componente único y contemplarlo en la CSP — es frontend, no viola la regla de aislamiento de `src/adapters/`, pero conviene que haya un solo punto de entrada.

---

## 6. Adenda (2026-08-12) — se descarta la preautorización

**Decisión de negocio posterior al análisis original:** no se implementará la preautorización de tarjeta de crédito. Todos los medios (crédito, débito, QR) cobran de forma **definitiva en P7**, y el modelo pasa a ser exclusivamente **pago / devolución**.

Consecuencias sobre este análisis:

1. **La pregunta abierta #4 queda sin efecto.** Sin preautorización desaparece el problema de VISA internacional/otras marcas: la compra simple de pago ocasional "acepta todas las tarjetas". También dejan de aplicar los hallazgos §2.2.1 y §2.2.3 (flag `preauthorization`, confirmación de un solo tiro, mínimo USD 1), que se conservan solo como registro.
2. **No hay conflicto con la matriz de cumplimiento.** El camino "cobro definitivo antes de la firma" ya era el de QR/débito; la fila 44 se cumple por exceso (el cobro confirmado siempre precede a la firma y a la emisión).
3. **La devolución pasa a ser el camino crítico.** Lo que documenta Bancard: el rollback de vPOS solo opera **el mismo día** de la transacción (antes del cuponado); la reversa del QR está pensada para la ventana inmediata (callback ausente ~5 min, cancelación). **No hay API documentada de devolución posterior al cuponado**: es un trámite manual por el portal de comercios (soporte/anulaciones). Como el vencimiento de firma es a 24 h del pago, un expediente `VENCIDO` cae en general fuera de la ventana de reversa automática → **toda Pantalla B implica devolución por el canal manual**, lo cual es consistente con el dominio actual (`DEVOLUCION_EN_TRAMITE` → `DEVUELTO`, ejecutada por Alianza fuera del flujo digital). Las preguntas B1–B4 del correo a Bancard piden precisar ventanas, SLA y constancias de ese trámite.
4. **Refactor interno pendiente (tarea aparte, no hecha):** quitar `iniciarPreautorizacionTarjeta` y `capturarPreautorizacion` de `src/ports/payment-provider.ts` (y del mock, sus tests de contrato y la palanca "fallo de captura de Bancard" del panel de demo), y actualizar los documentos que describen crédito = preautorización: `docs/ESPECIFICACION_PANTALLAS.md` (P7), `CLAUDE.md` (checklist #7) y la nota de `MedioDePago` en `src/domain/tipos.ts`. Hasta que esos documentos se actualicen, siguen siendo la fuente de verdad formal: este cambio debe bajarse a la especificación antes de tocar código.
5. **Los correos de consulta a ambos proveedores** (con las preguntas abiertas de la sección 4 reformuladas tras esta decisión, más las nuevas sobre devoluciones y firma no cualificada) están en `docs/CONSULTAS_PROVEEDORES_CODE100_BANCARD.md`.
