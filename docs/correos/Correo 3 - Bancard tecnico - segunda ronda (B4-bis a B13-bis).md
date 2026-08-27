**Para:** soporte de integraciones de Bancard
**CC:** [ejecutiva de cuenta]
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Segunda ronda de consultas técnicas (B4-bis, B5-bis, B6-bis, B8-bis, B8-ter, B10-bis, B13-bis)

---

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
