**Para:** Laura Vera (ejecutiva de cuenta) · equipo comercial de Bancard · soporte de integraciones
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Pendientes tras sus respuestas del 7 de septiembre (5 puntos)

---

Estimados:

Muchas gracias por las respuestas del **7 de septiembre**. Fueron las que más nos
destrabaron hasta ahora: con **B4-bis** y **B5-bis** quedó resuelto el problema del QR que
sobrevivía a nuestro plazo de pago —vamos a inactivarlo con la reversa a las 24 horas, tal
como nos indicaron— y con **B10-bis** quedó resuelto cómo detectamos un intento rechazado
para ofrecerle al cliente un segundo intento. Las dos ya están incorporadas a nuestro
diseño.

Quedan **cinco puntos**. Cuatro son de la lista anterior y **tres de ellos son
comerciales**, así que los dirigimos principalmente a la ejecutiva de cuenta; el quinto es
nuevo y surge de una precisión de sus propias respuestas.

**Los dos primeros son los que hoy nos frenan.** No podemos escribir ni certificar la
integración sin ellos.

---

## Resumen

| # | Tema | Prioridad | Área |
| :---- | :---- | :---- | :---- |
| **B7** | Ambiente, credenciales y certificación de QR | **Bloqueante** | Comercial / ejecutiva |
| **B13-bis** | Cuántas URL de confirmación se configuran, y por ambiente | **Bloqueante** | Técnica |
| **B11** | Montos mínimos y máximos por transacción | Importante | Comercial |
| **B3-bis** | Plazo de devolución de un pago por QR A2A | Importante | Comercial |
| **B10-ter** | Si un `shop_process_id` con iframe abandonado se puede reutilizar | Importante | Técnica |

---

## B7 · Ambiente, credenciales y certificación de QR *(comercial / ejecutiva)*

El 27 de agosto nos indicaron que se abriría un hilo con nuestra ejecutiva de cuenta para
compartir las **URLs base de staging y producción** del API de Comercios, las
**credenciales de prueba** y la **lista de casos de prueba** del proceso de certificación
de QR. Ese hilo todavía no llegó, y ya pasaron dos rondas de consultas técnicas.

Es el punto que más nos frena: **sin ambiente no podemos escribir ni probar una sola línea
de la integración de QR**, y es el único de los cinco que no requiere ninguna definición de
su parte — es entrega de datos que ya existen.

## B13-bis · Cuántas URL de confirmación, y por ambiente *(técnica)*

Su respuesta a B13 indica que *"solo se puede configurar una única URL de confirmación,
tanto para vPOS como para QR"*. Las tres lecturas posibles nos llevan a arquitecturas
distintas:

- **(a)** una URL para vPOS y otra para QR — una por producto;
- **(b)** una sola URL compartida que reciba las notificaciones de ambos productos;
- **(c)** una única URL en total para todo el comercio.

Y en cualquiera de los tres casos: **¿se configura una URL por ambiente (staging y
producción), o es la misma para ambos?**

Esto último condiciona la certificación: necesitamos completar las pruebas sin apuntar a
nuestro ambiente productivo. Es el primer componente que tenemos que construir, así que la
ambigüedad nos bloquea desde el inicio.

## B11 · Montos mínimos y máximos *(comercial)*

Nos indicaron que los montos mínimos y máximos por transacción para vPOS (Pago Ocasional)
y para QR se definen con ustedes. Les agradeceremos confirmarnos ambos límites para los dos
productos.

El importe que vamos a cobrar es el premio anual del seguro, en guaraníes, en un único
cobro por operación. Necesitamos verificar que caiga dentro del rango admitido en los tres
medios de pago antes de salir a producción, y no suponerlo.

## B3-bis · Plazo de devolución de un pago por QR A2A *(comercial)*

En su respuesta a B3 nos confirmaron que el dinero vuelve al mismo plástico cuando se pagó
con tarjeta, y **a la cuenta cuando se pagó con QR A2A**. Sobre los plazos, la respuesta
remite a los indicados más arriba, que son los de **crédito** (48 a 72 horas) y **débito**
(sin SLA, dependiente del banco pagador). El **QR A2A no es ninguno de los dos**, así que
nos queda sin respuesta.

Lo necesitamos porque la normativa nos obliga a informarle al cliente, antes de que pague,
en cuánto tiempo recuperaría su dinero. Hoy, a falta del dato, nuestra pantalla le dice que
la acreditación depende de su banco —por analogía con lo que ustedes respondieron para
débito—. Preferimos confirmarlo antes que sostener una inferencia nuestra.

## B10-ter · ¿Se puede reutilizar un `shop_process_id` cuyo iframe fue abandonado? *(técnica)*

Su respuesta a **B10-bis (b)** precisó algo que la primera ronda no distinguía: si el
cliente **abandona el iframe sin llegar a tipear una tarjeta**, no queda ningún intento
asociado al `shop_process_id` y `get_confirmation` devuelve `PaymentNotFoundError`. En
cambio, la respuesta a **(c)** cierra indicando que *"corresponde que el cliente vuelva a
intentar pagar generando una nueva operación"*.

Nuestra consulta es si esa última frase es una **restricción** o una **recomendación**:

- **(a)** Un `shop_process_id` sobre el que **nunca hubo un intento** (iframe abandonado,
  `PaymentNotFoundError`), ¿puede volver a usarse para abrir una nueva operación con el
  mismo identificador, o queda igualmente inutilizado?
- **(b)** Si puede reutilizarse, ¿hay algún plazo tras el cual deje de poder hacerse?

No es una pregunta ociosa. De ella depende cómo protegemos al cliente del doble cobro: hoy,
si alguien toca "Pagar" dos veces seguidas, reutilizamos deliberadamente el mismo
identificador para que las dos pulsaciones abran **la misma** operación y no dos. Si un
identificador se quema con solo abrir el formulario, tenemos que acuñar uno nuevo en cada
pulsación y resolver esa protección por otro camino.

---

Quedamos a disposición para una reunión técnica si les resulta más práctico repasar estos
puntos en conjunto — en particular **B7** y **B13-bis**, que son los que hoy condicionan
nuestro cronograma.

Desde ya, muchas gracias por la disposición que vienen teniendo.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]
