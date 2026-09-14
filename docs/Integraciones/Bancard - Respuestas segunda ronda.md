# **Bancard — Respuestas a la segunda ronda (B4-bis, B5-bis, B6-bis, B8-bis, B8-ter, B10-bis)**

**Destinatario:** Equipo técnico de Interseguros (SeguroLoTengo · operador tecnológico AAB1)
**Recibido:** 2026-09-07 (equipo técnico)
**Consultas de origen:** `docs/correos/Correo 5 - Bancard unificado - consultas pendientes priorizadas.md` (10 puntos)
**Primera ronda:** `docs/Integraciones/Bancard - Respuestas B1 a B13.md`
**Análisis derivado:** `docs/ANALISIS_RESPUESTAS_BANCARD.md` → §8
**Original recibido, sin editar:** `docs/Integraciones/Bancard - Respuestas segunda ronda - original 07-sep (tecnico).txt`

> Este documento **reordena** las respuestas por identificador y las separa de la consulta
> que las originó. No cambia una palabra de su contenido: las citas van entre comillas y
> respetan la ortografía del original, erratas incluidas. Ante cualquier duda sobre lo que
> el proveedor dijo, manda el `.txt`.

**Estado: 6 de las 10 consultas pendientes respondidas.** Las cuatro que siguen
abiertas son **B7** y **B11** (ejecutiva de cuenta), **B13-bis** (técnica) y **B3-bis**
(comercial). Dos de ellas —B7 y B13-bis— eran **bloqueantes** y lo siguen siendo: sin
ambiente ni definición de URL de confirmación no se puede escribir ni certificar el
adaptador. Las cuatro técnicas bloqueantes/importantes que sí llegaron desbloquean, en
cambio, los dos huecos de diseño más grandes (G1 y G2 del análisis).

---

## **Reversa y vigencia del QR**

### **B4-bis** — ¿La reversa invalida un QR generado y no pagado?

**Consulta.** (a) ¿`PUT .../selling/payments/revert/:hook_alias` invalida el QR generado
y no pagado, o solo revierte un pago que efectivamente ocurrió? (b) Si es lo segundo,
¿hay otra operación para desactivar un QR emitido y no usado? (c) Si no la hay, ¿qué
procedimiento recomienda Bancard?

**(a)** *"La API de revert permite inactivar o invalidar un QR que haya sido generado y
que aún no haya sido pagado. Adicionalmente les comentamos que es mandatorio invocar la
operación de reversa siempre que el cajero cancele la venta desde el sistema del comercio
o no se haya recibido el resultado de la transacción a través de la invocación del
callback."*

**(b)** *"La respuesta de la consulta (a) responde a esta pregunta, ya que la operación de
revert permite inactivar o invalidar un QR generado y no pagado antes de que finalice su
vigencia de 3 días."*

**(c)** *"La respuesta de la consulta (a) también aplica a este escenario, se debe invocar
la operación de revert cuando corresponda."*

> **Es la respuesta que desbloquea el hueco G1.** La reversa no solo sirve para resolver un
> pago incierto: **apaga un QR emitido y no pagado**, y hacerlo es *mandatorio* cuando el
> comercio cancela la venta. Un expediente que vence **es** esa cancelación.

### **B5-bis** — ¿El TTL de 3 días es configurable?

**Consulta.** ¿La vigencia de 3 días del QR dinámico es configurable por comercio, o es un
valor fijo de la plataforma?

*"La vigencia de 3 días del QR dinámico no es configurable por comercio, ya que corresponde
a un valor fijo definido por el servicio y aplica de la misma manera para todos los
comercios."*

*"Sin embargo, el comercio puede implementar una lógica interna para inactivar el QR
transcurridas 24 horas. Por ejemplo, si el cliente no realiza el pago dentro de ese
período, el comercio puede solicitar la cancelación del QR mediante la API (revert),
evitando que continúe disponible para el pago."*

> **No hay salida del lado del proveedor, y sí la hay del nuestro** — descripta por Bancard
> con nuestro propio plazo de 24 h como ejemplo. La política de vigencia es nuestra y la
> hacemos cumplir reversando.

---

## **Rechazos de tarjeta**

### **B10-bis** — ¿Cómo se entera el comercio de un intento rechazado?

**Consulta.** (a) ¿El POST de confirmación se envía también ante un intento rechazado?
(b) ¿`get_confirmation` devuelve la operación rechazada o `PaymentNotFoundError`?
(c) ¿Existe algún caso en que un intento quede utilizado sin que el comercio pueda
enterarse por ninguna de las dos vías?

**(a)** *"Sí. Los pagos rechazados también son enviados al callback del comercio,
incluyendo el response_code correspondiente al resultado de la operación."*

**(b)** *"Si el pago fue procesado y rechazado, la API de consulta devolverá el resultado
de dicha operación junto con su response_code de rechazo. En cambio, si no se realizó
ningún intento de pago por ejemplo, si el iframe de pago fue abandonado, la consulta
devolverá un PaymentNotFoundError, ya que no existe ningún intento de pago asociado al
shop_process_id, ya sea aprobado o rechazado."*

**(c)** *"Siempre que exista una confirmación de pago el comercio podrá consulta con la Api
de single_buy/confirmations (get_confirmation). En caos de que le mismo devuelva
PaymentNotFoundError indica que el pago no fue realizado o el iframe fue abandonado por lo
que corresponde que el cliente vuelva a intentar pagar generando una nueva operación."*

> **Desbloquea el hueco G2** por partida doble: el rechazo llega por callback **y** es
> consultable. No hay intento que se queme en silencio.
>
> Trae además un dato que la primera ronda no daba y que **corrige** la lectura que el
> análisis había hecho de B10: un `shop_process_id` cuyo iframe fue **abandonado** no
> registra intento alguno (`PaymentNotFoundError`) y, aun así, la respuesta (c) indica
> generar **una nueva operación** para reintentar. Ver §8.2 del análisis.

---

## **Callbacks y conciliación**

### **B6-bis** — Conciliación de pagos QR ante un callback perdido

**Consulta.** ¿Existe algún mecanismo de conciliación —reporte diario, archivo de cierre,
exportación del portal, extracto— que permita detectar un pago acreditado del que no nos
hayamos enterado?

*"Como ya les mencionamos en caso del que comercio no reciba la notificacion a su callback.
El comercio tiene la posibilidad de identificar cuándo llega la petición del servicio al
callback y cuánto tiempo tarda en responder. En función de esto, se puede determinar si el
callback demoró más de 10 segundos en responder y, en ese caso, invocar la reversa a través
del API /commerces/:commerce_code/branches/:branch_code/selling/payments/revert/:hook_alias.
Evitando que un pago quede mal parado del lado del comercio."*

*"Adicionalmente les comentamos que también pueden verificar a nivel reporteria dentro del
portal de comercios en el apartado de ventas QR."*

> **La consulta no fue respondida en su literal** —preguntamos por el callback que *no
> llega*, y la primera parte de la respuesta describe el que *llega y tarda*—, pero la
> segunda parte sí da lo que se pedía: existe **reportería de ventas QR en el Portal de
> Comercios**. Es conciliación manual, sin API ni archivo de cierre. Ver §8.3.
>
> **El "10 segundos" es dato nuevo y no coincide** con el presupuesto de 5 s que B8 y el
> documento QR fijan para responder el callback. Ver §8.6.

### **B8-bis** — Política de reintentos del callback

**Consulta.** ¿Bancard reintenta el envío del callback cuando el comercio no responde en
tiempo? ¿O la falta de respuesta deriva en la reversa automática?

*"No se realizan reintentos de envío al callback. Una vez que se alcanza el tiempo máximo
de espera configurado, el servicio QR interpreta la falta de respuesta del comercio como un
timeout. En ese caso, la transacción se revierte automáticamente, sin necesidad de realizar
ninguna acción adicional por parte del comercio."*

Sobre el "tiempo X" antes de invocar la reversa desde el comercio:

*"Asi como se detalla en la documentación tecnica del servicio QR. El tiempo recomendado si
el comercio no recibe la confirmación por el callback en 5 minutos. Esto no implica que
todos los pagos con QR tendrán que esperar 5 minutos, es un tiempo recomendado para que el
cliente pueda ingresar a su app y confirmar el pago en vista de que tiene que seguir varios
pasos como ingresos de PIN en las apps bancarias, billeteras, etc."*

> **Sin reintentos: el callback de QR se envía una sola vez.** Y una entrega fallida no deja
> el cobro en el aire: Bancard lo **reversa sola**. Ver §8.4 — baja el riesgo de un cobro
> invisible, y sube el costo de un callback lento.

---

## **Seguridad de borde**

### **B8-ter** — Confirmación de las IP de origen de vPOS

**Consulta.** Las cuatro IP listadas bajo el título "vPOS 2.0" aparecen rotuladas como *"IP
de origen del servicio QR"*. ¿Es un error de tipeo y corresponden a vPOS?

*"Si, les confirmamos que corresponden a las IP del servicio vPOS. Son fijas para el
servicio. Si se da el caso que sufra algún cambio se les estará notificando con atelacion
via mail a vuestros contactos."*

> Confirmado el error de tipeo. **190.128.218.209 · 190.128.232.10 · 190.104.129.98 ·
> 200.85.46.226 son de vPOS**, son fijas, y un cambio se avisa por correo con antelación a
> los contactos del comercio. La whitelist de borde se puede armar. Ver §8.5.

---

## **Lo que sigue abierto**

| # | Destinatario | Prioridad declarada en el correo 5 | Estado |
| :---- | :---- | :---- | :---- |
| **B7** | Ejecutiva de cuenta | **Bloqueante** | Sin responder. Hosts de staging/producción del API de Comercios, credenciales de prueba y lista de casos de certificación de QR |
| **B13-bis** | Bancard técnico | **Bloqueante** | Sin responder. Cuántas URL de confirmación y si hay una por ambiente |
| **B11** | Comercial | Importante | Sin responder. Montos mínimos y máximos por transacción, vPOS y QR |
| **B3-bis** | Comercial | Importante | Sin responder. Plazo de devolución de un pago por QR A2A |

Las seis de esta ronda eran las **técnicas**; las que faltan son **tres comerciales y una
técnica**. Conviene reclamarlas por el hilo de la ejecutiva de cuenta, no por el de soporte
técnico, que ya respondió todo lo suyo salvo B13-bis.
