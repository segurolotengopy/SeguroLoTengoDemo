**Para:** soporte de integraciones de Bancard · equipo comercial · Laura Vera (ejecutiva de cuenta)
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Consultas pendientes de integración, consolidadas y priorizadas (10 puntos)

---

Estimados:

Muchas gracias por las respuestas recibidas el 27 y el 28 de agosto. Con ellas quedaron cerradas **11 de las 13 consultas** de nuestra primera ronda, y ya están incorporadas a nuestra documentación técnica y al desarrollo.

Este correo **consolida en un solo lugar todo lo que queda pendiente**, sumando lo que quedó abierto de aquella ronda y lo que surgió al leer sus respuestas. Son **10 puntos**, agrupados por el impacto que tienen sobre nuestro cronograma, para que puedan priorizar la respuesta y derivar internamente cada uno a quien corresponda. Los identificadores cuelgan de la consulta original que los originó (`-bis`, `-ter`), para que se pueda seguir el hilo de cada tema.

**No hace falta responder todo junto.** Las cuatro del primer bloque son las que hoy nos frenan; si llegan antes que el resto, podemos seguir trabajando mientras se resuelven las demás.

**Contexto que hace falta para varias de las preguntas.** Nuestro proceso **cobra al final, después de que el cliente firmó electrónicamente su solicitud de seguro**, y el expediente **caduca si no se paga dentro de las 24 horas** siguientes. Es decir: tenemos una ventana de cobro propia, más corta que la vigencia del QR que ustedes nos informaron, y necesitamos poder cerrar una operación cuando esa ventana vence.

---

## Resumen

| # | Tema | Prioridad | Área |
| :---- | :---- | :---- | :---- |
| **B7** | Ambiente, credenciales y certificación de QR | **Bloqueante** | Comercial / ejecutiva |
| **B13-bis** | Cuántas URL de confirmación se configuran, y por ambiente | **Bloqueante** | Técnica |
| **B4-bis** | Si la reversa invalida un QR generado y no pagado | **Bloqueante** | Técnica |
| **B10-bis** | Cómo se entera el comercio de un intento rechazado | **Bloqueante** | Técnica |
| **B11** | Montos mínimos y máximos por transacción | Importante | Comercial |
| **B8-ter** | Confirmación de las IP de origen de vPOS | Importante | Técnica |
| **B6-bis** | Conciliación de pagos QR ante un callback perdido | Importante | Técnica |
| **B3-bis** | Plazo de devolución de un pago por QR A2A | Importante | Comercial |
| **B5-bis** | Si el TTL de 3 días del QR es configurable | Deseable | Técnica |
| **B8-bis** | Política de reintentos del callback | Deseable | Técnica |

---

## Bloque 1 — Bloqueantes

Sin estas cuatro respuestas no podemos escribir ni certificar la integración.

### B7 · Ambiente, credenciales y certificación de QR *(comercial / ejecutiva)*

En su respuesta del 27 de agosto nos indicaron que se abriría un hilo con nuestra ejecutiva de cuenta para compartir las **URLs base de staging y producción** del API de Comercios, las **credenciales de prueba** y la **lista de casos de prueba** del proceso de certificación de QR, junto con la versión vigente de esa documentación. Ese hilo todavía no llegó.

Es el punto que más nos frena: **sin ambiente no podemos escribir ni probar una sola línea de la integración de QR.** Es también el único de los diez que no requiere ninguna definición de su parte — es entrega de datos que ya existen.

### B13-bis · Cuántas URL de confirmación, y por ambiente *(técnica)*

Su respuesta a B13 indica que *"solo se puede configurar una única URL de confirmación, tanto para vPOS como para QR"*. Necesitamos desambiguarla, porque las tres lecturas posibles nos llevan a arquitecturas distintas:

- **(a)** una URL para vPOS y otra para QR — una por producto;
- **(b)** una sola URL compartida que reciba las notificaciones de ambos productos;
- **(c)** una única URL en total para todo el comercio.

Y en cualquiera de los tres casos: **¿se configura una URL por ambiente (staging y producción), o es la misma para ambos?** Esto último condiciona la certificación: necesitamos completar las pruebas sin apuntar a nuestro ambiente productivo.

Es el primer componente que tenemos que construir, así que la ambigüedad nos bloquea desde el inicio.

### B4-bis · ¿La reversa invalida un QR generado y no pagado? *(técnica)*

Ustedes nos informaron (B5) que el QR dinámico vive **3 días**, y nuestro expediente caduca a las **24 horas**. Eso nos deja hasta dos días en los que existe un QR técnicamente pagable asociado a una operación que de nuestro lado ya está cerrada. Recibir ese pago nos obligaría a devolverlo, que es exactamente lo que nuestro diseño busca evitar.

Necesitamos **desactivar el QR cuando vence nuestro plazo**:

- **(a)** ¿La operación `PUT .../selling/payments/revert/:hook_alias` **invalida el QR generado y no pagado**, de modo que un escaneo posterior ya no pueda pagar, o solo revierte un pago que efectivamente ocurrió?
- **(b)** Si solo hace lo segundo, ¿existe alguna otra operación para **anular o desactivar un QR emitido y no utilizado** antes de que se cumplan sus 3 días?
- **(c)** Si no existe ninguna, ¿cuál es el procedimiento que Bancard recomienda para este escenario?

Lo consultamos porque su documentación presenta la reversa como el mecanismo para resolver un pago **incierto**, y desactivar un QR **no pagado** es otra cosa. No queremos darle a la operación un uso que ustedes no previeron.

### B10-bis · ¿Cómo se entera el comercio de un intento rechazado? *(técnica)*

Su respuesta a B10 —el `shop_process_id` queda registrado aunque el intento de pago falle, y hay que generar uno nuevo para reintentar— nos obliga a **detectar el rechazo** para poder ofrecerle al cliente un segundo intento con otra tarjeta. La pregunta es por qué vía nos enteramos:

- **(a)** Ante un intento **rechazado**, ¿el POST de confirmación se envía igual a nuestra URL, con el `response_code` correspondiente, o solo se notifican las operaciones aprobadas?
- **(b)** ¿`single_buy/confirmations` (`get_confirmation`) sobre un `shop_process_id` cuyo único intento fue rechazado devuelve esa operación con su código de rechazo, o devuelve `PaymentNotFoundError`?
- **(c)** ¿Existe algún caso en que un intento quede utilizado **sin** que el comercio pueda enterarse por ninguna de las dos vías?

El caso (c) es el que nos preocupa: dejaría al cliente sin posibilidad de reintentar, sin que nosotros podamos siquiera detectarlo para ofrecerle una alternativa.

---

## Bloque 2 — Importantes

No nos frenan hoy, pero tienen que estar resueltas antes de salir a producción.

### B11 · Montos mínimos y máximos *(comercial)*

Nos indicaron que los **montos mínimos y máximos por transacción** para vPOS (Pago Ocasional) y para QR se definen con ustedes. Les agradeceremos confirmarnos ambos límites para los dos productos.

El importe que vamos a cobrar es el premio anual del seguro, en guaraníes, en un único cobro por operación. Necesitamos verificar que caiga dentro del rango admitido en los tres medios de pago antes de salir a producción, y no suponerlo.

### B8-ter · Confirmación de las IP de origen de vPOS *(técnica)*

En su respuesta a B8, el bloque titulado "vPOS 2.0" lista cuatro direcciones IP bajo la leyenda *"Las IP de origen del servicio QR son las siguientes"*. Entendemos que se trata de un error de tipeo y que esas cuatro direcciones —190.128.218.209, 190.128.232.10, 190.104.129.98 y 200.85.46.226— corresponden efectivamente a **vPOS**. ¿Nos lo confirman?

Una lista de acceso mal armada nos cortaría los cobros en producción, así que preferimos verificarlo antes que suponerlo. Aprovechamos para consultar si esos rangos son **estables** y, de cambiar, con cuánta antelación y por qué canal se notifica al comercio.

### B6-bis · Conciliación de pagos QR *(técnica)*

Entendemos de su respuesta a B6 que **no existe un servicio de consulta del estado de un pago QR** y que la única fuente de información es el callback. Nuestra consulta es sobre el caso en que el callback **se pierda por completo** —no que llegue tarde: que no llegue—.

Por tratarse de un producto de seguros regulado, estamos obligados a conservar constancia de cada cobro. ¿Bancard pone a disposición del comercio algún mecanismo de **conciliación** —reporte diario, archivo de cierre, exportación desde el Portal de Comercios, extracto de movimientos— que permita detectar un pago acreditado del que no nos hayamos enterado?

De no existir, agradeceremos que nos lo confirmen explícitamente, para poder dejarlo asentado como riesgo operativo conocido en nuestra documentación de cumplimiento.

### B3-bis · Plazo de devolución de un pago por QR A2A *(comercial)*

En su respuesta a B3 nos confirmaron que el dinero vuelve al mismo plástico cuando se pagó con tarjeta, y **a la cuenta cuando se pagó con QR A2A**. Sobre los plazos, la respuesta remite a los indicados más arriba, que son los de **crédito** (48 a 72 horas) y **débito** (sin SLA, dependiente del banco pagador). El **QR A2A no es ninguno de los dos**, así que nos queda sin respuesta.

Lo necesitamos porque la normativa nos obliga a informarle al cliente, antes de que pague, en cuánto tiempo recuperaría su dinero. Hoy, a falta del dato, nuestra pantalla le dice que la acreditación depende de su banco —por analogía con lo que ustedes respondieron para débito—. Preferimos confirmarlo antes que sostener una inferencia nuestra.

---

## Bloque 3 — Deseables

Podemos avanzar sin estas dos, pero nos permitirían simplificar el diseño.

### B5-bis · ¿El TTL de 3 días del QR es configurable? *(técnica)*

¿La vigencia de 3 días del QR dinámico es **configurable por comercio** —por ejemplo, a 24 horas o menos—, o es un valor fijo de la plataforma?

Va junto con **B4-bis**: si fuera configurable, sería la solución más limpia al problema del QR que sobrevive a nuestro plazo de pago, y las dos consultas se responderían de una sola vez.

### B8-bis · Política de reintentos del callback *(técnica)*

Quedó sin responder qué hace Bancard cuando el comercio **no responde en tiempo** a una notificación. ¿Se reintenta el envío? De ser así: ¿cuántas veces, con qué espaciado y durante cuánto tiempo? ¿O la falta de respuesta en plazo deriva directamente en la reversa automática de la transacción?

Lo consultamos para dimensionar correctamente el tratamiento de notificaciones duplicadas de nuestro lado y para fijar el "tiempo X" antes de invocar la reversa que ustedes recomiendan configurar.

---

Quedamos a disposición para una reunión técnica si les resulta más práctico repasar estos puntos en conjunto — en particular los cuatro del primer bloque, que son los que hoy condicionan nuestro cronograma.

Desde ya, muchas gracias por la disposición que vienen teniendo.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]
