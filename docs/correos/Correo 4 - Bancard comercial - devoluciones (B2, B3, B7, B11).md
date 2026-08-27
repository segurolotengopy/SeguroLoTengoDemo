**Para:** equipo comercial de Bancard · Laura Vera (ejecutiva de cuenta)
**CC:** soporte de integraciones de Bancard
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Consultas B2 y B3 pendientes (devoluciones) y recordatorio de B7 y B11

---

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
