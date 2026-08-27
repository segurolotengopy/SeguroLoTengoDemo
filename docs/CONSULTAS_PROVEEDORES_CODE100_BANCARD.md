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

---

# Segunda ronda — Bancard (repregunta)

**Fecha de redacción:** 2026-08-27
**Motivo:** las respuestas recibidas (`docs/Integraciones/Bancard - Respuestas B1 a B13 (parte 1).md`) dejaron cuatro consultas sin responder y abrieron siete puntos nuevos, analizados en `docs/ANALISIS_RESPUESTAS_BANCARD.md` §6.

Van **dos correos separados porque tienen dos destinatarios distintos**: el equipo técnico de integraciones y el equipo comercial / la ejecutiva de cuenta. Los identificadores nuevos siguen la convención de la primera ronda: `-bis` y `-ter` cuelgan de la consulta original de la que nacieron, para que la trazabilidad B1…B13 no se rompa.

**Cambio de contexto que conviene tener presente al leer ambos correos.** Desde la primera ronda invertimos el orden del proceso: **ahora se firma primero y se cobra después** (decisión D-08 del proyecto). El efecto práctico es que la devolución dejó de ser un camino masivo —quien no firma nunca llega a pagar— y quedó reservada a un pedido excepcional del titular sobre un cobro ya acreditado. Eso **baja** la urgencia de B2/B3 pero **no la elimina**: seguimos necesitando saber qué constancia emite Bancard y en qué plazo vuelve el dinero, porque eso es lo que la pantalla le informa a la persona.

---

## Correo 3 — Bancard, equipo técnico de integraciones

**Para:** soporte de integraciones de Bancard
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Segunda ronda de consultas técnicas (B4-bis, B5-bis, B6-bis, B8-bis, B8-ter, B10-bis, B13-bis)

Estimado equipo de Soporte de Integraciones de Bancard:

Muchas gracias por las respuestas a nuestras consultas B1 a B13. Nos resultaron claras y ya están incorporadas a nuestra documentación técnica. De su lectura surgieron **siete puntos** que necesitamos precisar antes de escribir los adaptadores definitivos; todos son consecuencia directa de lo que ustedes nos respondieron, y los numeramos colgando de la consulta original para mantener la trazabilidad.

Un dato de contexto que ayuda a entender por qué preguntamos lo que preguntamos: **nuestro proceso cobra al final, después de que el cliente firmó electrónicamente la solicitud, y el expediente caduca si no se paga dentro de las 24 horas.** Es decir, tenemos una ventana de cobro propia, más corta que la vigencia del QR que ustedes nos informaron.

**Ventas QR**

- **B4-bis.** Es nuestra consulta más importante de esta ronda. Ustedes nos informaron (B5) que el QR dinámico vive **3 días**, y nuestro expediente caduca a las **24 horas**. Eso nos deja hasta dos días en los que existe un QR técnicamente pagable asociado a una operación que de nuestro lado ya está cerrada. Para evitar recibir un pago que no vamos a poder honrar, necesitamos **desactivar el QR cuando vence nuestro plazo**. Concretamente: (a) ¿la operación `PUT .../selling/payments/revert/:hook_alias` **invalida el QR generado y no pagado**, de modo que un escaneo posterior ya no pueda pagar, o solo revierte un pago que efectivamente ocurrió? (b) Si solo hace lo segundo, ¿existe alguna otra operación para **anular o desactivar un QR emitido y no utilizado** antes de que se cumplan sus 3 días? (c) Si no existe ninguna, ¿cuál es el procedimiento que Bancard recomienda para este escenario?
- **B5-bis.** ¿El TTL de 3 días del QR dinámico es **configurable por comercio** (por ejemplo, a 24 horas o menos), o es un valor fijo de la plataforma? Si fuera configurable, sería la solución más limpia al punto anterior.
- **B6-bis.** Entendemos de su respuesta a B6 que **no existe un servicio de consulta del estado de un pago QR** y que la única fuente de información es el callback. Nuestra pregunta es sobre el caso en que el callback se pierda por completo (no que llegue tarde: que no llegue). Por tratarse de un producto de seguros regulado, estamos obligados a conservar constancia de cada cobro. ¿Bancard pone a disposición del comercio algún mecanismo de **conciliación diaria** —reporte, archivo de cierre, exportación desde el Portal de Comercios, extracto de movimientos— que nos permita detectar un pago acreditado del que no nos hayamos enterado? De no existir, agradeceremos que nos lo confirmen explícitamente, para dejarlo asentado como riesgo operativo aceptado.

**vPOS — pago ocasional**

- **B10-bis.** Su respuesta a B10 —el `shop_process_id` queda registrado aunque el intento de pago falle, y hay que generar uno nuevo para reintentar— nos obliga a **detectar el rechazo** para poder ofrecerle al cliente un segundo intento con otra tarjeta. La pregunta es cómo nos enteramos: (a) ante un intento **rechazado**, ¿el POST de confirmación se envía igual a nuestra URL, con el `response_code` correspondiente, o solo se notifican las operaciones aprobadas? (b) ¿`single_buy/confirmations` (`get_confirmation`) sobre un `shop_process_id` cuyo único intento fue rechazado devuelve esa operación con su código de rechazo, o devuelve `PaymentNotFoundError`? (c) ¿Existe algún caso en que un intento quede "quemado" **sin** que el comercio pueda enterarse por ninguna de las dos vías? Ese último caso es el que nos preocupa, porque dejaría al cliente sin posibilidad de reintentar.

**Callbacks y seguridad**

- **B8-bis.** Quedó sin responder la **política de reintentos de Bancard** cuando el comercio no responde en tiempo. ¿Bancard reintenta la notificación? De ser así: ¿cuántas veces, con qué espaciado y durante cuánto tiempo? ¿O la falta de respuesta en plazo deriva directamente en la reversa automática de la transacción? Lo consultamos para dimensionar correctamente el tratamiento de notificaciones duplicadas de nuestro lado y para fijar el "tiempo X" antes de invocar la reversa que ustedes recomiendan configurar.
- **B8-ter.** En su respuesta, el bloque titulado "vPOS 2.0" lista cuatro direcciones IP bajo la leyenda *"Las IP de origen del servicio QR son las siguientes"*. Entendemos que se trata de un error de tipeo y que esas cuatro direcciones (190.128.218.209, 190.128.232.10, 190.104.129.98, 200.85.46.226) corresponden efectivamente a **vPOS**. ¿Nos lo confirman? Una lista de acceso mal armada nos cortaría los cobros en producción, así que preferimos verificarlo antes que suponerlo. Aprovechamos para consultar si esos rangos son **estables** o si Bancard notifica los cambios con antelación, y por qué canal.
- **B13-bis.** Su respuesta a B13 indica que *"solo se puede configurar una única URL de confirmación, tanto para vPOS como para QR"*. Necesitamos desambiguar esa frase, porque las tres lecturas posibles nos llevan a arquitecturas distintas: (a) una URL para vPOS y otra para QR, es decir una por producto; (b) una sola URL compartida que reciba las notificaciones de ambos productos; o (c) una única URL en total para todo el comercio. Y en cualquiera de los tres casos: **¿se configura una URL por ambiente (staging y producción), o es la misma para ambos?** Esto último nos condiciona la certificación: necesitamos poder completar las pruebas sin apuntar a nuestro ambiente productivo.

Como en la ronda anterior, quedamos a disposición para una reunión técnica si les resulta más práctico repasar estos siete puntos en conjunto — en particular B4-bis y B13-bis, que son los que más condicionan nuestro diseño.

Desde ya, muchas gracias por la disposición.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]

---

## Correo 4 — Bancard, equipo comercial / ejecutiva de cuenta

**Para:** equipo comercial de Bancard · Laura Vera (ejecutiva de cuenta), con copia a Soporte de Integraciones
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Consultas B2 y B3 pendientes (devoluciones) y recordatorio de B7 y B11

Estimada Laura, estimado equipo comercial:

Nos dirigimos a ustedes de parte del equipo técnico de **SeguroLoTengo**, portal de venta electrónica del Seguro de Vida Oncológico CONFÍO — canal digital de **Interseguros S.A.**, con emisión de **Alianza Garantía Seguros y Reaseguros S.A.**

El equipo de Soporte de Integraciones respondió nuestras consultas técnicas y nos indicó que **B2 y B3 las responde el equipo comercial**, y que **B7 y B11** se compartirían en el hilo que se abriría con ustedes. Reiteramos esas cuatro acá, con el contexto que les faltaba.

**Por qué preguntamos por devoluciones.** Somos un producto de seguros y estamos alcanzados por la normativa de seguros y de defensa del consumidor, que nos obliga a **informarle al cliente, antes de pagar, cómo y en cuánto tiempo recuperaría su dinero** si correspondiera una devolución. Hoy esa pantalla no puede decir un plazo cierto porque no lo tenemos. No estamos previendo un volumen alto de devoluciones: desde que invertimos el orden del proceso —ahora se firma primero y se cobra después—, un cliente que abandona el trámite **nunca llega a pagar**. La devolución quedó como un caso excepcional, a pedido del titular, sobre un cobro ya acreditado. Pero es justamente por ser excepcional que necesitamos tenerla bien documentada de antemano.

- **B2.** Para una transacción **ya cuponada** (fuera de la ventana de reversa automática que nos precisó Soporte en B1): confirmamos que el único canal es el **pedido manual por el Portal de Comercios**. Sobre ese trámite necesitamos saber: (a) ¿cuál es el **SLA típico de resolución**? (b) ¿qué **constancia o comprobante** emite Bancard una vez ejecutada la devolución, y en qué formato? Este punto es el más importante de los cuatro: esa constancia la tenemos que incorporar al expediente del cliente como respaldo documental, así que necesitamos saber qué documento vamos a recibir antes de diseñar dónde se guarda. (c) ¿Existe un **plazo máximo** desde la transacción original para solicitarla? (d) ¿Se admite **devolución parcial**, o solo por el importe total?
- **B3.** ¿El procedimiento de devolución es el mismo para pagos con **tarjeta de crédito**, **tarjeta de débito** y **QR** (incluido el débito en cuenta)? Para cada uno de esos medios: **¿por qué vía vuelve el dinero al cliente** (reversa al plástico, acreditación en cuenta, otra) **y en qué plazo estimado**? Es el dato que necesitamos para poder informarle al cliente algo cierto en pantalla.
- **B7** (recordatorio). Quedamos a la espera de las **URLs base de staging y producción** del API de Comercios (QR), las **credenciales de prueba** y la **lista de casos de prueba** del proceso de certificación de QR, junto con la versión vigente de esa documentación. Es la precondición para que podamos empezar a integrar la rama de QR.
- **B11** (recordatorio). Nos indicaron que los **montos mínimos y máximos por transacción** para vPOS (Pago Ocasional) y para QR los definimos con ustedes. Les agradeceremos confirmarnos ambos límites para los dos productos. El importe que vamos a cobrar es el premio anual del seguro, en guaraníes, en un único cobro por operación; necesitamos verificar que caiga dentro del rango admitido en los tres medios de pago antes de salir a producción, y no suponerlo.

Quedamos atentos y a disposición para coordinar una llamada si resulta más práctico.

Desde ya, muchas gracias.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]
