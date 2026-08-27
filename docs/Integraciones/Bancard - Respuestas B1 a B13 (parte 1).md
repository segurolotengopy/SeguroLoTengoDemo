# **Bancard — Respuestas a las consultas B1 a B13 (parte 1)**

**Destinatario:** Equipo técnico de Interseguros (SeguroLoTengo · operador tecnológico AAB1)
**Recibido:** 2026-08-27
**Consultas de origen:** `docs/CONSULTAS_PROVEEDORES_CODE100_BANCARD.md` → "Correo 2 — Bancard" (2026-08-12)
**Referencia documental:** Especificaciones Técnicas Single Buy v1.23 (vPOS) y QR en API de Comercios v1.2
**Análisis derivado:** `docs/ANALISIS_RESPUESTAS_BANCARD.md`
**Original recibido, sin editar:** `docs/Integraciones/Bancard - Respuestas B1 a B13 (parte 1) - original recibido.txt`

> Este documento **reordena** las respuestas siguiendo la numeración de las consultas —el
> original las trae agrupadas por tema y fuera de orden— y no cambia una palabra de su
> contenido. Ante cualquier duda sobre lo que el proveedor dijo, manda el `.txt` original.

> **Sobre el nombre del archivo original.** El adjunto recibido se llama
> `Respuestas_Bancred_Parte_1.txt`. El contenido es inequívocamente de **Bancard**
> (vPOS Single Buy, Ventas QR del API de Comercios, portal de comercios,
> `shop_process_id`, `hook_alias`). El proyecto no tiene ningún proveedor llamado
> "Bancred" registrado en `docs/Tabla de Integraciones externas - Tabla.csv`, así
> que este documento se archiva bajo el nombre del proveedor real. Si "Bancred"
> resultara ser una entidad distinta —y no un error de tipeo del remitente—, hay
> que registrarla en esa tabla **antes** de escribir una sola línea de adaptador.

**Estado:** parcial. **B2** y **B3** —las dos consultas sobre devolución posterior
al cuponado— quedaron sin responder: Bancard las derivó a su equipo comercial.
**B7** y **B11** se derivaron a la ejecutiva de cuenta (Laura Vera) y se
responderán en un hilo aparte. Este documento se completa cuando llegue la parte 2.

---

## **Reversas y devoluciones**

### **B1**

**Consulta.** El rollback de vPOS "solo puede enviarse en el día en el que se realizó la operación". ¿Cuál es el corte exacto de esa ventana (hora de cuponado / cierre contable)? ¿Es día calendario o ciclo de procesamiento?

La operación de rollback vía API para el servicio vPOS: **el horario de cierre depende del tipo de tarjeta.**

- **Tarjeta de crédito (TC):** se pueden realizar reversas de un pago **hasta que se cupone**. Los procesos de cuponado corren a las **20:00 hs** y a las **00:00 hs**. Los pagos con TC que se procesen antes de esos horarios van a poder reversarse sin problemas; luego ya no será posible realizarlo vía API.
- **Tarjeta de débito (TD):** pueden realizarse **solamente el día en que se realizó el pago**.

### **B2**

**Consulta.** Para una transacción ya cuponada: ¿existe alguna operación por API para gestionar la anulación/devolución, o el único canal es el pedido manual por el portal de comercios? SLA típico, constancia emitida, plazo máximo y posibilidad de devolución parcial.

**Pendiente.** Bancard indicó que responde el equipo comercial. Ver §6 de `docs/ANALISIS_RESPUESTAS_BANCARD.md`.

### **B3**

**Consulta.** ¿El procedimiento de devolución aplica por igual a pagos con TC, TD y QR (incluido el débito en cuenta)? ¿Por qué vía y en qué plazos vuelve el dinero al cliente en cada medio?

**Pendiente.** Bancard indicó que responde el equipo comercial. Ver §6 de `docs/ANALISIS_RESPUESTAS_BANCARD.md`.

### **B4**

**Consulta.** En Ventas QR, ¿la operación de reversa (`PUT .../payments/revert/:hook_alias`) tiene una ventana temporal equivalente a la del rollback de vPOS? ¿Cuál es el procedimiento para devolver un pago QR confirmado uno o más días después?

Tal como se indica en la documentación del servicio QR, **la operación de reversa solo debe ser utilizada en caso de no recibir el callback en un tiempo X**, el cual sugerimos que sea configurable del lado del comercio.

**Es mandatorio invocar la operación de reversa siempre que:**

- el cajero cancele la venta desde el sistema del comercio, o
- no se haya recibido el resultado de la transacción a través de la invocación del callback.

**El procedimiento para devolver un pago QR confirmado es el proceso manual vía ticket al portal de comercios.**

---

## **Ventas QR**

### **B5**

**Consulta.** ¿Cuál es el tiempo de vigencia (TTL) del QR dinámico generado por `generate-qr-express`? ¿Qué respuesta recibe el cliente si escanea un QR vencido?

El QR dinámico generado por `generate-qr-express` tiene una vigencia (TTL) de **3 días desde su generación**. Transcurrido ese período, el QR pasa a **estado inactivo** y ya no se puede proceder al pago. Si el cliente escanea un QR vencido, al proceder al pago recibe un mensaje de error; **el mensaje mostrado depende de cada entidad** para mostrar en la app de homebanking.

### **B6**

**Consulta.** El control de cambios del documento QR menciona una URL para "obtener pagos por `hook_alias`", pero el cuerpo del documento no la especifica. Solicitamos la especificación de ese servicio de consulta: es necesario para conciliar el estado de un pago si el callback no llega o se pierde.

**Lo citado en la documentación técnica corresponde a un error en la lista de control de cambios del documento.** (Es decir: **el servicio de consulta por `hook_alias` no existe.**)

El comercio deberá identificar en su sistema interno todas aquellas transacciones que hayan presentado inconvenientes y validar cuánto tiempo demoró el callback en responder al servicio. Si se detecta que el callback tardó **5 segundos o más**, se podrán realizar las siguientes acciones:

- **Optimizar el servicio de callback**, ya que no es sostenible un tiempo de respuesta tan elevado en sistemas transaccionales. Idealmente, el procesamiento de las transacciones no debería superar los 5 segundos. Es primordial que **el callback no esté ligado a ningún proceso interno del comercio**: este servicio debe poder recibir la notificación y responder en un tiempo menor a 5 segundos. De esta forma, se prioriza la confirmación del pago antes de marcarlo como aprobado en su sistema y proceder con la entrega del producto.
- El comercio tiene la posibilidad de identificar cuándo llega la petición al callback y cuánto tarda en responder. En función de eso puede determinar si demoró más de 5 segundos y, en ese caso, **invocar la reversa** a través de `/commerces/:commerce_code/branches/:branch_code/selling/payments/revert/:hook_alias`.

### **B7**

**Consulta.** URLs base (hosts) de staging y producción del API de Comercios, credenciales de prueba y proceso de certificación para QR.

Bancard generará **un hilo con la ejecutiva de cuenta (Laura Vera)** para compartir los datos de los ambientes de **staging y producción**, las **credenciales de prueba** y la **lista de casos de prueba** correspondiente al proceso de **certificación de QR**. En ese mismo hilo remitirán la versión vigente de la documentación de QR.

---

## **Callbacks y seguridad**

### **B8**

**Consulta.** ¿Qué mecanismo recomienda Bancard para verificar la autenticidad de los callbacks entrantes (confirmación de vPOS y callback de QR)? ¿Publican rangos de IP de origen, firman el mensaje o soportan mTLS? Tiempos máximos de respuesta exigidos al comercio y política de reintentos de Bancard.

**API QR**

El callback del comercio debe estar configurado con una **autenticación tipo BASIC** y utilizar el protocolo **HTTPS de manera obligatoria**. Bancard parametriza de su lado las credenciales y la URL del callback del comercio para enviar la confirmación.

IP de origen del servicio QR, para whitelist:

```
190.128.232.10
200.85.46.226
190.128.218.210
190.128.218.209
190.104.129.98
186.16.8.112
200.85.41.18
```

**Tiempo máximo de respuesta del callback de QR: 5 segundos.**

**vPOS 2.0**

El comercio debe ofrecer, en una **URL pública y de común acuerdo**, un servicio mediante el cual se notificará la aprobación o cancelación de la transacción de un cliente final. Además, para funcionar como cliente de Web Service de vPOS, debería soportar **TLS 1.2**.

IP de origen para whitelist (el texto original dice "del servicio QR"; por el contexto corresponde a vPOS — ver §6 del análisis):

```
190.128.218.209
190.128.232.10
190.104.129.98
200.85.46.226
```

**Tiempo máximo de respuesta de la confirmación de vPOS: 30 segundos.**

> **No respondido:** la **política de reintentos de Bancard** cuando el comercio
> no responde en tiempo. Ni firma del mensaje ni mTLS fueron ofrecidos como
> opción: el mecanismo de autenticidad es Basic + HTTPS (+ whitelist de IP).

---

## **vPOS — pago ocasional**

### **B9**

**Consulta.** ¿`extra_response_attributes: ["payment_card_type"]` está disponible en el `single_buy` de pago ocasional? ¿El dato llega también en el POST de confirmación, o solo en la respuesta del `single_buy`?

**Sí**, `extra_response_attributes: ["payment_card_type"]` está disponible para el **Single Buy de Pago Ocasional**.

Asimismo, el dato `payment_card_type` **también se incluye en el POST de confirmación** que se envía a la URL configurada por el comercio.

Para mostrar el tipo de tarjeta utilizada por el usuario, el comercio puede enviar el campo:

```json
"extra_response_attributes": [
    "payment_card_type"
]
```

En la **página 11** de la especificación se encuentra más información sobre el parámetro `extra`.

### **B10**

**Consulta.** Sobre `shop_process_id`: ¿debe ser único en la historia del comercio o solo entre operaciones vigentes? ¿Puede reutilizarse tras un rollback? ¿Existe algún rango o convención recomendada?

El `shop_process_id` es un **identificador único por cada compra**, por lo que, **una vez utilizado, no debe reutilizarse**.

**Independientemente de si el intento de pago falla** (por ejemplo, con una tarjeta Visa), ese identificador **ya queda registrado** en el sistema. Por lo tanto, no podrán realizar un nuevo intento de pago con otra tarjeta (por ejemplo, MasterCard) utilizando el mismo `shop_process_id`.

**Para realizar un nuevo intento, será necesario generar un nuevo `shop_process_id`.**

### **B11**

**Consulta.** ¿Existen montos mínimos o máximos por transacción para el pago ocasional y para el QR?

Los montos mínimos o máximos para el vPOS (Pago Ocasional) y para el QR **deberán ser verificados y definidos con el Ejecutivo Comercial (Laura Vera)**.

### **B12**

**Consulta.** Respecto del bloqueo por rechazos consecutivos (7 intentos en 24 horas / 35 en 30 días): ¿el bloqueo aplica por combinación tarjeta+comercio? ¿El comercio puede consultar el estado de bloqueo o gestionar el desbloqueo?

**Los umbrales mencionados son mandatos de las marcas, no controles propios de la plataforma.**

- El bloqueo se aplica **a nivel de tarjeta, independientemente del comercio**.
- Lo aplica **el emisor o la marca**.
- **El comercio no puede consultar ni gestionar el desbloqueo.** Si una tarjeta queda bloqueada, el titular debe contactar a su banco emisor.

**Para calibrar los reintentos, Bancard recomienda no superar 5 intentos en 24 horas por tarjeta.**

---

## **Operativa y alta**

### **B13**

**Consulta.** ¿El alta de `commerce_code`/`branch_code` del API de Comercios (QR) es independiente del alta de la aplicación vPOS? ¿La URL de confirmación se configura por ambiente en el portal y admite una única URL por aplicación? ¿Hay versiones más recientes de las especificaciones?

- **El alta de `commerce_code`/`branch_code` para el API de Comercios (QR) es independiente del alta de vPOS.**
- **vPOS:** la URL de confirmación **la configura el comercio** desde el Portal de Comercios.
- **QR:** la parametrización de los datos del callback (para las notificaciones de pagos) **la realiza Bancard** de su lado.
- **"Solo se puede configurar una única URL de confirmación, tanto para vPOS como para QR."** (Redacción ambigua — ver §6 del análisis.)
- **La documentación de vPOS Single Buy v1.23 es la versión actualmente vigente.**
- La versión vigente de la documentación de QR se comparte en el hilo con la ejecutiva de cuenta.

---

## **Anexo — Cuadro de estado de las 13 consultas**

| # | Tema | Estado | Quién responde lo que falta |
| :---- | :---- | :---- | :---- |
| B1 | Ventana de rollback vPOS | **Respondida** | — |
| B2 | Devolución posterior al cuponado (SLA, constancia, parcial) | **Pendiente** | Equipo comercial |
| B3 | Devolución por medio (TC / TD / QR / débito en cuenta) | **Pendiente** | Equipo comercial |
| B4 | Ventana y procedimiento de reversa QR | **Respondida** | — |
| B5 | TTL del QR dinámico | **Respondida** (3 días) | — |
| B6 | Consulta de pagos por `hook_alias` | **Respondida: el endpoint no existe** | — |
| B7 | Hosts, credenciales y certificación de QR | **Pendiente** | Ejecutiva de cuenta (hilo aparte) |
| B8 | Autenticidad de callbacks, IP, tiempos | **Parcial** — falta la política de reintentos | Bancard |
| B9 | `payment_card_type` en pago ocasional | **Respondida** (sí, y también en el POST) | — |
| B10 | Unicidad de `shop_process_id` | **Respondida** (único de por vida) | — |
| B11 | Montos mínimos / máximos | **Pendiente** | Ejecutiva de cuenta |
| B12 | Bloqueo antifraude por rechazos | **Respondida** (nivel tarjeta, no consultable) | — |
| B13 | Alta, URL de confirmación, versiones | **Parcial** — ambigüedad sobre la URL única | Bancard |
