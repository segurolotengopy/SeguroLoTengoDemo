# Correos de consulta técnica — Code100 y Bancard

**Fecha de redacción:** 2026-08-12
**Contexto:** consultas surgidas del análisis `docs/ANALISIS_INTEGRACIONES_CODE100_BANCARD.md` (incluida su adenda: se descarta la preautorización; el modelo es pago definitivo + devolución). Las preguntas llevan identificador único (C1…, B1…) para que las respuestas de los proveedores puedan cargarse y trazarse una a una.

---

## Correo 1 — Code100

**Para:** soporte técnico / equipo de integraciones de Code100
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Consultas técnicas sobre la API Flow del Firmador — firma de Solicitud de Seguro y FIPF

Estimado equipo de Code100:

Nos dirigimos a ustedes de parte del equipo técnico de **SeguroLoTengo**, portal de venta electrónica del Seguro de Vida Oncológico CONFÍO — canal digital de **Interseguros S.A.** (corredor de seguros), con emisión de **Alianza Garantía Seguros y Reaseguros S.A.** Estamos desarrollando la integración de firma electrónica sobre la base del documento **"Documentación Api Flow"** que nos fue provisto (`POST /signature/auth`, `GET /signature/session-start`, `POST /signature/getSessionId`, `POST /signature/sign-pdf`).

Nuestro caso de uso, para contexto de las consultas: al final del proceso de contratación, el cliente firma **dos documentos PDF** (la Solicitud de Seguro y el Formulario de Identificación de Persona Física — FIPF) en **un único acto de firma**; posteriormente, Interseguros y Alianza aplican sus **firmas electrónicas cualificadas** sobre esos mismos documentos. Los PDF se cierran y se les calcula hash SHA-256 antes de habilitarse la firma. El marco normativo de referencia es la **Ley 6822/2021**.

Para avanzar con el desarrollo necesitamos precisiones sobre los puntos siguientes. Les agradeceremos responder por escrito referenciando la numeración (C1, C2, …), de manera que podamos trazar cada respuesta en nuestra documentación técnica.

**Tipo de firma del cliente final**

- **C1.** El documento Api Flow describe la autenticación del firmante contra la PSA (`/v0/oauth/authorize`) y el ejemplo de `getSessionId` devuelve un `cert_info` correspondiente a un "CERTIFICADO CUALIFICADO DE FIRMA ELECTRÓNICA". Nuestro cliente final es una persona física **sin certificado preexistente**, que debe firmar con **firma electrónica no cualificada** en los términos de la Ley 6822/2021. ¿La plataforma soporta este tipo de firma para el cliente? ¿Se realiza con los mismos endpoints del Api Flow o existe un flujo/documentación distinta?
- **C2.** De soportarse: ¿qué requisitos de identificación o enrolamiento tiene el firmante no cualificado? ¿Es posible integrarlo con la verificación de identidad que nuestro proceso ya realiza (OCR de cédula + verificación biométrica), o Code100 ejecuta su propia verificación? ¿Contempla la emisión de un certificado de único uso?
- **C3.** ¿Qué evidencias genera el acto de firma no cualificada (OTP, sello de tiempo, dirección IP, trazas de auditoría) y en qué formato se entregan al comercio para su resguardo probatorio?

**Multifirma y orden de firmas**

- **C4.** Sobre los mismos dos PDF deben aplicarse, después de la firma del cliente, las firmas cualificadas de dos personas jurídicas (Interseguros y Alianza). ¿Las firmas sucesivas se aplican por actualización incremental del PDF conservando la validez de las firmas anteriores? ¿Cada firmante requiere su propia sesión (`session-start`) y su propia llamada a `sign-pdf`? ¿Cómo se referencia en la siguiente firma un documento ya firmado?
- **C5.** ¿Es posible garantizar el orden de firmas (cliente primero; luego las dos cualificadas, que pueden ser en paralelo)? ¿La plataforma ofrece alguna orquestación de ese orden o debe controlarla nuestra aplicación?

**Sesión y enlace de firma**

- **C6.** ¿El envío del enlace de firma al firmante (por WhatsApp o correo electrónico) lo realiza Code100, o es responsabilidad del comercio distribuir el `_authUrl`? El documento solo muestra su embebido en un iframe.
- **C7.** ¿La vigencia de la sesión de firma es configurable? Nuestro requisito regulatorio es de **24 horas**. Asimismo: ¿cuál es el TTL del token de `POST /signature/auth` y el comportamiento esperado ante su expiración?

**Semántica de `sign-pdf`**

- **C8.** (a) Si `sign-pdf` se invoca dos veces con el mismo `code`/`state`/`session_id` (por ejemplo, por un reintento de red), ¿la segunda llamada falla, devuelve el mismo resultado o produce una segunda firma? (b) ¿Qué respuesta devuelve ante una sesión expirada? (c) ¿Existen límites de tamaño por PDF y de cantidad de documentos por llamada? (d) ¿Pueden confirmar que todos los documentos enviados en el array `document` de una misma llamada quedan firmados en un único acto jurídico? (e) ¿Cuáles son las unidades y la semántica exacta de `container_sign` (`left`, `right`, `bottom`, `height`) y de `nro_odt`?

**Estados, errores y notificaciones**

- **C9.** ¿Disponen del catálogo completo de estados y códigos de error de `getSessionId` y `sign-pdf` (rechazo del firmante, cancelación, expiración, error interno)? En el ejemplo del documento, `getSessionId` devuelve simultáneamente `"status": true` y `"expirado": true`; agradeceremos aclarar la semántica de ambos campos y de `fecha_expiracion`.
- **C10.** ¿Ofrecen webhooks/callbacks al completarse, rechazarse o expirar la firma, o el único mecanismo es la consulta periódica de `getSessionId`? De existir webhooks: ¿cómo se autentica/firma el mensaje y cuál es la política de reintentos?

**Formato, verificación y ambiente**

- **C11.** ¿Qué estándar de firma se aplica al PDF resultante (PAdES B/T/LT/LTA), incluye sellado de tiempo (TSA) y ofrecen un servicio de verificación de documentos firmados? ¿Qué garantías de validez a largo plazo tiene el documento?
- **C12.** Solicitamos credenciales del ambiente de homologación, datos de prueba, límites de tasa aplicables y la descripción del proceso de certificación y paso a producción. Si existe una versión más reciente del documento Api Flow, o documentación complementaria (multifirma, firma no cualificada, webhooks), agradeceremos que nos la remitan.

Quedamos a disposición para una reunión técnica si les resulta más práctico repasar estos puntos en conjunto. Desde ya, muchas gracias.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]

---

## Correo 2 — Bancard

**Para:** soporte de integraciones de Bancard (portal de comercios → Soporte → vPOS / Pruebas de integración)
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Consultas técnicas de integración vPOS Single Buy v1.23 y Ventas QR API de Comercios v1.2

Estimado equipo de Soporte de Integraciones de Bancard:

Nos dirigimos a ustedes de parte del equipo técnico de **SeguroLoTengo**, portal de venta electrónica del Seguro de Vida Oncológico CONFÍO — canal digital de **Interseguros S.A.** (corredor de seguros), con emisión de **Alianza Garantía Seguros y Reaseguros S.A.** Estamos desarrollando la integración de cobros sobre la base de las especificaciones **"Especificaciones Técnicas Single Buy — Versión 1.23"** y **"QR en API de Comercios v1.2 (Vuelto QR)"**.

Alcance previsto de la integración, para contexto: un **único cobro definitivo por operación** (la prima del seguro, en guaraníes), mediante (a) **pago ocasional** con el iframe de Single Buy (tarjetas de crédito y débito) y (b) **Venta Rápida QR**. No utilizaremos catastro de tarjetas, pago con token, 3DS, Zimple, preautorizaciones ni el módulo de factura electrónica (la factura la emite la aseguradora por su propio canal). Por tratarse de un producto regulado, nuestro sistema debe conservar constancia auditable de cada cobro y de cada devolución.

Les agradeceremos responder por escrito referenciando la numeración (B1, B2, …), de manera que podamos trazar cada respuesta en nuestra documentación técnica.

**Reversas y devoluciones** (nuestro punto más crítico: por diseño del producto, si el cliente no completa la firma dentro de las 24 horas posteriores al pago, corresponde devolverle el importe)

- **B1.** El rollback de vPOS "solo puede enviarse en el día en el que se realizó la operación". ¿Cuál es el corte exacto de esa ventana (hora de cuponado / cierre contable)? ¿Es día calendario o ciclo de procesamiento?
- **B2.** Para una transacción ya cuponada: ¿existe alguna operación por API para gestionar la anulación/devolución, o el único canal es el pedido manual por el portal de comercios (Soporte → Anulaciones)? En el caso manual: ¿cuál es el SLA típico de resolución, qué constancia o comprobante emite Bancard (necesitamos incorporarla al expediente del cliente), existe un plazo máximo para solicitarla y es posible la devolución parcial?
- **B3.** ¿El procedimiento de devolución aplica por igual a pagos con tarjeta de crédito, tarjeta de débito y QR (incluido el débito en cuenta)? ¿Por qué vía y en qué plazos vuelve el dinero al cliente en cada medio?
- **B4.** En Ventas QR, ¿la operación de reversa (`PUT .../payments/revert/:hook_alias`) tiene una ventana temporal equivalente a la del rollback de vPOS? ¿Cuál es el procedimiento para devolver un pago QR confirmado uno o más días después?

**Ventas QR**

- **B5.** ¿Cuál es el tiempo de vigencia (TTL) del QR dinámico generado por `generate-qr-express`? ¿Qué respuesta recibe el cliente si escanea un QR vencido?
- **B6.** El control de cambios del documento QR menciona una URL para "obtener pagos por hook_alias", pero el cuerpo del documento no la especifica. Solicitamos la especificación de ese servicio de consulta: es necesario para conciliar el estado de un pago si el callback no llega o se pierde.
- **B7.** Solicitamos las URLs base (hosts) de staging y producción del API de Comercios (el documento indica `<servidor:puerto>` genérico), las credenciales de prueba correspondientes y la descripción del proceso de certificación para QR (¿existe una lista de test equivalente a la de vPOS?).

**Callbacks y seguridad**

- **B8.** ¿Qué mecanismo recomienda Bancard para verificar la autenticidad de los callbacks entrantes (confirmación de vPOS y callback de QR)? ¿Publican rangos de IP de origen, firman el mensaje o soportan mTLS? Asimismo, agradeceremos confirmar los tiempos máximos de respuesta exigidos al comercio (entendemos 30 segundos para la confirmación de vPOS y 5 segundos para el callback de QR) y la política de reintentos de Bancard cuando el comercio no responde en tiempo.

**vPOS — pago ocasional**

- **B9.** ¿Pueden confirmar que `extra_response_attributes: ["payment_card_type"]` está disponible en el `single_buy` de pago ocasional? ¿El dato llega también en el POST de confirmación a nuestra URL, o solo en la respuesta del `single_buy`?
- **B10.** Sobre `shop_process_id`: ¿debe ser único en la historia del comercio o solo entre operaciones vigentes? ¿Puede reutilizarse tras un rollback? ¿Existe algún rango o convención recomendada?
- **B11.** ¿Existen montos mínimos o máximos por transacción para el pago ocasional y para el QR?
- **B12.** Respecto del mecanismo de bloqueo por rechazos consecutivos (7 intentos en 24 horas / 35 en 30 días): ¿el bloqueo aplica por combinación tarjeta+comercio? ¿El comercio puede consultar el estado de bloqueo o gestionar el desbloqueo? Lo consultamos para calibrar nuestro propio límite interno de reintentos, de modo de cortar antes de alcanzar el umbral.

**Operativa y alta**

- **B13.** Para operar ambos productos: ¿el alta de `commerce_code`/`branch_code` del API de Comercios (QR) es independiente del alta de la aplicación vPOS? ¿La URL de confirmación se configura por ambiente en el portal y admite una única URL por aplicación? Si hubiera versiones más recientes de las especificaciones que las que tenemos (Single Buy v1.23, QR v1.2), agradeceremos que nos las remitan.

Quedamos a disposición para una reunión técnica si les resulta más práctico repasar estos puntos en conjunto. Desde ya, muchas gracias.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]
