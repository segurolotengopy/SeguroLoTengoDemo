# Análisis de las respuestas de Bancard (B1–B13, parte 1)

**Fecha:** 2026-08-27
**Fuente:** `docs/Integraciones/Bancard - Respuestas B1 a B13 (parte 1).md`
**Consultas de origen:** `docs/CONSULTAS_PROVEEDORES_CODE100_BANCARD.md` → "Correo 2 — Bancard" (2026-08-12)
**Análisis previo que este documento corrige y extiende:** `docs/ANALISIS_INTEGRACIONES_CODE100_BANCARD.md` (2026-08-12)
**Contrastado contra:** `src/ports/payment-provider.ts`, `src/domain/pago-p7.ts`, `src/domain/tipos.ts`, `src/adapters/mock/payment-provider.ts`

> **Nota de contexto obligatoria.** Las 13 consultas se escribieron el 12-ago-2026,
> **antes** de la inversión pago ↔ firma (D-08, Lote 4b). En ese momento se cobraba
> primero y se firmaba después, así que las cuatro primeras preguntas —B1 a B4—
> apuntaban al que entonces era el riesgo central: **devolver el premio a quien no
> firmara**. Con D-08 ese riesgo desapareció por construcción (`VENCIDO` ocurre
> antes de que haya dinero). Este análisis lee las respuestas **con el orden nuevo**,
> no con el que tenían las preguntas. Es la diferencia entre "Bancard nos dio malas
> noticias" y "Bancard confirmó que la decisión que ya tomamos era la correcta".

**Conclusión general.** Ninguna respuesta obliga a rediseñar `PaymentProvider`: el
puerto sigue calzando con el contrato real. Pero aparecen **tres huecos concretos en
el código de hoy** (§3) que hasta ahora estaban tapados por el comportamiento
benévolo del mock, **una divergencia declarada** con las reglas transversales de
`CLAUDE.md` (§5) y **seis preguntas** que hay que volver a poner sobre la mesa (§6).
Nada de esto bloquea el modo demo; todo precede al adaptador `live/`.

---

## 1. Lo que cambia el mapa, en una tabla

| Respuesta | Qué dice | Impacto |
| :---- | :---- | :---- |
| **B5** | El QR dinámico vive **3 días** | **Alto** — sobrevive al plazo de pago de 24 h (D-10). Hueco G1 |
| **B6** | La consulta de pagos por `hook_alias` **no existe**: fue un error del documento | **Alto** — la rama QR de `consultarEstadoPago` se queda sin fuente en vivo. Hueco G3 |
| **B10** | `shop_process_id` es de **un solo uso de por vida**, aun si el intento falla | **Alto** — hoy un rechazo de tarjeta deja a la persona sin reintento. Hueco G2 |
| **B8** | Callbacks: Basic + HTTPS + whitelist de IP. **Sin firma, sin mTLS** | **Medio** — divergencia con la regla transversal de callbacks firmados (§5) |
| **B12** | El bloqueo antifraude es **por tarjeta, no por tarjeta+comercio**; recomiendan ≤ 5 intentos / 24 h | **Medio** — corrige el análisis del 12-ago y sube el costo de reintentar |
| **B13** | Alta de QR independiente de vPOS; **"una única URL de confirmación"** | **Medio** — restricción de arquitectura, con ambigüedad que hay que cerrar |
| **B1** | Rollback TC hasta el cuponado (20:00 / 00:00); TD solo el mismo día | **Bajo** — confirma que la devolución real es manual. Valida D-02 |
| **B4** | La reversa QR **no es una devolución**; devolver un QR confirmado es ticket manual | **Bajo** — confirma D-02. Pero define el uso legítimo de la reversa (→ G1) |
| **B9** | `payment_card_type` disponible en `single_buy` y en el POST de confirmación | **Bajo** — oportunidad de evidencia (§4.3) |
| **B7 · B11 · B2 · B3** | Derivadas al equipo comercial / ejecutiva de cuenta | Pendientes (§6) |

---

## 2. Respuesta por respuesta: qué significa para nuestro código

### 2.1 B1 y B4 — la devolución automática no existe para nuestro caso, y ya no hace falta

B1 precisa la ventana de rollback de vPOS: **crédito hasta el cuponado** (procesos a
las 20:00 y a las 00:00), **débito solo el mismo día**. En la práctica, un cobro con
débito a las 23:50 tiene diez minutos de ventana, y uno con crédito a las 20:05 la
tiene hasta medianoche. B4 agrega que la reversa de QR **no es un instrumento de
devolución** —es el mecanismo para resolver la incertidumbre cuando el callback no
llegó— y que devolver un pago QR ya confirmado es **un ticket manual por el portal
de comercios**.

Leído con el orden viejo, esto era una mala noticia: el vencimiento de firma caía a
las 24 h del pago, es decir, casi siempre fuera de toda ventana automática.

Leído con D-08, es una **validación**. Bajo el orden vigente el expediente vence
**antes** de que exista dinero (`FIRMADO → VENCIDO`, sin cobro), así que la
devolución dejó de ser el camino masivo y quedó reservada a lo que D-02 contempla:
un cobro con tarjeta ya acreditado que el titular pide devolver. Para ese caso —raro,
a pedido, sin plazo garantizado— el trámite manual ejecutado por Alianza fuera del
flujo digital es exactamente lo que el dominio ya modela (`DEVOLUCION_EN_TRAMITE →
DEVUELTO`, Pantalla B).

**Consecuencia para el adaptador `live/`:** `cancelarOLiberarReserva` **no puede
prometer una devolución**. Su contrato honesto es *"cancelá una operación que todavía
no se cobró"*, y para lo ya acreditado debe devolver un desenlace tipificado que el
dominio lea como *"esto es trámite manual"*, no como error. El análisis del 12-ago ya
lo anticipaba (`TransactionAlreadyConfirmed` → derivación a devolución manual);
B1 y B4 lo confirman y le ponen los horarios.

### 2.2 B5 — el QR vive tres días, y el expediente vence en veinticuatro horas

`generate-qr-express` produce un QR válido **3 días**. Nuestro plazo de pago es de
**24 horas** desde las firmas institucionales (D-10). Los dos relojes no coinciden, y
el de Bancard es el más largo: **hay hasta 48 horas en las que existe un QR pagable
apuntando a un expediente que ya está `VENCIDO`**.

Esto se desarrolla en §3.1 (hueco G1), porque es el hallazgo más importante del
documento.

Dato secundario pero útil para P7: si el cliente escanea un QR vencido, **el mensaje
de error lo decide cada entidad emisora** en su app de homebanking. No podemos
controlarlo ni predecirlo, así que la pantalla no debe prometer un texto concreto
("te va a decir que el QR expiró"): debe decir que el QR dejó de ser válido y ofrecer
generar uno nuevo.

### 2.3 B6 — no hay consulta de estado para QR

El endpoint de "obtener pagos por `hook_alias`" que el control de cambios del
documento QR mencionaba **no existe**: fue un error de ese documento. Bancard es
explícita en la alternativa que propone, y no es un endpoint: es **instrumentar el
propio callback** (medir cuánto tarda en responder) y, ante la duda, **invocar la
reversa**.

Para nosotros esto significa que **la rama QR de `consultarEstadoPago` no tiene
implementación posible en vivo**. La única fuente de verdad del estado de un pago QR
es el callback entrante. Ver §3.3 (hueco G3).

Nota de contraste: la rama vPOS **sí** tiene consulta (`single_buy/confirmations`,
`get_confirmation`). Las dos ramas del mismo método del puerto tienen capacidades
distintas, y el adaptador `live/` va a tener que hacerlo explícito.

### 2.4 B8 — la autenticidad del callback es Basic + IP, y nada más

- **QR:** el callback del comercio debe tener **autenticación BASIC** y **HTTPS
  obligatorio**. Las credenciales y la URL **las parametriza Bancard de su lado** —no
  las configuramos nosotros—, lo que las convierte en un secreto a recibir por canal
  seguro y guardar en la infraestructura, no en un valor que elijamos.
- **vPOS:** URL pública "de común acuerdo" y **TLS 1.2** como cliente del web service.
- **Whitelist de IP:** 7 direcciones para QR, 4 para vPOS (las 4 de vPOS son un
  subconjunto de las 7 de QR).
- **Presupuestos de respuesta:** **5 s** para QR, **30 s** para vPOS. Confirma lo que
  el análisis del 12-ago ya había leído de los documentos.

**No hay firma del mensaje ni mTLS.** Bancard no los ofreció ni como opción. Eso
choca de frente con la regla transversal de `CLAUDE.md` *"Callbacks de proveedores
firmados, verificables, idempotentes y vinculados a la misma propuesta"* → §5.

**No respondieron la política de reintentos** cuando el comercio no contesta a
tiempo. Es una omisión con consecuencia práctica: sin saber si Bancard reintenta —y
cuántas veces— no se puede dimensionar la idempotencia del route handler ni decidir
cuánto esperar antes de reversar. Vuelve a §6.

### 2.5 B9 — `payment_card_type`, ahora sin la razón original y con una mejor

Confirmado: disponible en el `single_buy` de pago ocasional **y** en el POST de
confirmación. La razón por la que lo habíamos pedido —detectar que alguien metiera
una tarjeta de débito en una operación con `preauthorization: "S"`— **murió con D-02**
(sin preautorización no hay cruce que detectar).

Queda una razón mejor: **el medio de pago que hoy registramos es el que la persona
eligió en la pantalla, no el que efectivamente usó.** Alguien que toca "Tarjeta de
crédito" y paga con débito genera un comprobante (`REC-<correlativo>`, D-05) que dice
algo que no ocurrió. `payment_card_type` permite asentar el medio **real**. Ver §4.3.

### 2.6 B10 — `shop_process_id` es de un solo uso, incluso si el pago falló

La respuesta es tajante: el identificador queda registrado **aunque el intento
falle**, y no se puede reintentar con otra tarjeta usando el mismo. Cada intento
nuevo exige un `shop_process_id` nuevo.

Esto **confirma la mitad** de nuestro diseño de idempotencia y **rompe la otra
mitad**. Ver §3.2 (hueco G2).

### 2.7 B12 — el bloqueo es por tarjeta, no por tarjeta+comercio

Corrección importante al análisis del 12-ago, que había leído del documento que el
bloqueo dejaba *"la tarjeta bloqueada **en el comercio** por 30 días"*. Bancard aclara
que **no es un control de la plataforma sino un mandato de las marcas**, que se aplica
**a nivel de tarjeta con independencia del comercio**, y que **el comercio no puede
consultar el estado ni gestionar el desbloqueo**: el titular tiene que llamar a su
banco emisor.

El costo de equivocarse subió mucho. Un bucle de reintentos en P7 no le arruina a la
persona la compra del seguro: le **inutiliza la tarjeta en todos lados**. Y no tenemos
forma de detectar que ocurrió ni de repararlo.

**Recomendación explícita de Bancard: no superar 5 intentos en 24 h por tarjeta.**
Nuestro límite interno debería quedar cómodamente por debajo. Ver §4.2.

### 2.8 B13 — dos altas, ¿una URL?

Tres hechos y una ambigüedad:

1. **El alta de QR (`commerce_code`/`branch_code`) es independiente del alta de vPOS.**
   Son dos onboardings, dos juegos de credenciales y dos esquemas de autenticación
   (md5 por operación en vPOS, Basic con clave pública/privada en QR). El adaptador
   `live/` va a tener **dos clientes HTTP distintos** dentro de un mismo archivo
   "Bancard", como ya anticipaba el análisis del 12-ago.
2. **La URL de confirmación de vPOS la configura el comercio** en el Portal de
   Comercios; **la de QR la parametriza Bancard**. Es decir: la de QR no se
   autogestiona — cambiarla es un pedido al proveedor, no un deploy.
3. **Single Buy v1.23 es la versión vigente.** El PDF que tenemos en
   `docs/Integraciones/` está al día.

La ambigüedad: *"Solo se puede configurar una única URL de confirmación, tanto para
vPOS como para QR."* Admite dos lecturas incompatibles —(a) una URL por producto, o
(b) una sola URL compartida por ambos— y una tercera pregunta que la frase ni toca:
**¿una única URL en total, o una por ambiente?** Las tres importan y ninguna se puede
adivinar. Ver §6.

Por si la lectura (b) resulta ser la correcta, conviene tener presente lo que
implicaría: **un mismo route handler recibiendo dos formatos de payload, con dos
esquemas de autenticación distintos, dos formatos de respuesta esperados** (vPOS se
conforma con HTTP 200; QR exige un cuerpo JSON con `status` y `messages[]`) **y dos
presupuestos de tiempo** (30 s contra 5 s). Es implementable —se discrimina por la
forma del cuerpo— pero es un punto único de falla para los dos medios de cobro, y
conviene saberlo antes de diseñarlo, no después.

---

## 3. Los tres huecos que estas respuestas abren en el código de hoy

Los tres están tapados hoy por el mock, que es más benévolo que Bancard. Ninguno
rompe la demo; los tres romperían producción.

### 3.1 G1 · El QR sobrevive al vencimiento del expediente, y nadie lo cancela

**Los hechos.**

- El QR de Bancard vive **3 días** (B5).
- El expediente firmado y no pagado vence a las **24 h** (D-10).
- `vencerPlazoPagoP7` (`src/domain/pago-p7.ts:951`) transiciona `FIRMADO → VENCIDO` y
  **no toca la operación abierta en Bancard**.
- `cancelarOLiberarReserva` (`src/ports/payment-provider.ts:171`) **no tiene ningún
  llamador en el dominio** — solo existen la definición del puerto y la
  implementación del mock.

**El escenario.** Alguien firma, genera el QR, no paga, el expediente vence a las 24 h
… y a las 40 h escanea el QR que le había quedado abierto en el teléfono y paga. El
dinero entra. Del lado de SeguroLoTengo el expediente es terminal: no existe la
arista `VENCIDO → PAGO_CONFIRMADO`, así que el cobro no se puede asentar, no se emite
Certificado de Cobertura Provisional y no hay póliza.

**Por qué importa más de lo que parece.** El resultado es exactamente lo que D-08 fue
diseñado para hacer imposible: **plata cobrada sin contrato vigente y una devolución
que gestionar** — que, por B4, es un ticket manual. La inversión pago ↔ firma eliminó
el problema del lado del dominio, y el TTL del proveedor lo vuelve a meter por la
ventana.

**La corrección.** El vencimiento tiene que **cerrar la operación en Bancard**, no solo
marcar el expediente. Y B4 dice que esto no es un uso creativo de la reversa, sino
**el uso que Bancard declara mandatorio**: *"es mandatorio invocar la operación de
reversa siempre que el cajero cancele la venta desde el sistema del comercio"*. Un
expediente que vence **es** la cancelación de la venta desde el sistema del comercio.

Forma concreta: `vencerPlazoPagoP7`, en la misma escritura que transiciona a
`VENCIDO`, invoca `cancelarOLiberarReserva` sobre la `referenciaBancard` pendiente y
asienta el resultado como evidencia. La operación ya está declarada idempotente por
`referenciaBancard`, así que la carrera contra el sondeo —que la pantalla dispara en
paralelo— converge. **Caso de borde que hay que decidir explícitamente:** qué pasa si
la reversa llega tarde porque el pago se acreditó en el intervalo. Bancard responde
`response_code 71` ("operación ya extornada") o el pago aparece confirmado; en el
segundo caso el expediente ya no debería vencer. Es la misma carrera que
`conReintentoPorConflicto` ya resuelve para el estado, extendida al proveedor.

**Esta corrección está condicionada a una respuesta que todavía no tenemos.** Supone
que reversar apaga el QR. Bancard describe la reversa como la forma de resolver un pago
incierto, no como una forma de anular un QR **no pagado** — y esas son dos cosas distintas.
Si la reversa solo revierte pagos ocurridos y el QR sigue vivo sus 3 días, esta vía no
sirve y hay que buscar otra. Es la consulta **B4-bis** del correo de repregunta (§6), y es
la que más conviene contestar antes de escribir una línea.

**Corolario sobre el TTL propio.** `VIGENCIA_QR_MINUTOS = 15`
(`src/adapters/mock/payment-provider.ts:73`) está documentado en el mock como si fuera
el TTL del QR. **No lo es**: el TTL del proveedor es de 3 días. Los 15 minutos son una
**política nuestra**, y con B5 pasan de ser un detalle de simulación a ser una
decisión de producto que el adaptador `live/` **no puede hacer cumplir** —Bancard no
acepta un TTL configurable— y que por lo tanto tenemos que hacer cumplir nosotros,
por la vía de la reversa. El comentario del mock hay que corregirlo para que no
afirme algo que el proveedor no hace.

### 3.2 G2 · Tras un rechazo de tarjeta, la persona queda sin reintento posible

**Los hechos.**

- `shop_process_id` se quema en el primer intento, exitoso o no (B10).
- `claveDeIdempotencia` (`src/domain/pago-p7.ts:199`) reutiliza la clave anterior
  cuando el pago previo está **`PENDIENTE`** con el mismo medio y monto.
- `EstadoPago` (`src/domain/tipos.ts:370`) tiene cuatro valores: `PENDIENTE`,
  `CONFIRMADO`, `CANCELADO`, `DEVUELTO`. **No existe `RECHAZADO`.**
- El contrato del puerto obliga a que dos llamadas con la misma `idempotencyKey`
  devuelvan **la misma** `referenciaBancard` y la misma `urlFormularioSeguro`.

**El escenario.** La persona abre el formulario seguro, tipea una tarjeta y **se la
rechazan dentro del iframe de Bancard**. Nosotros no nos enteramos: nuestro
`pago.estado` sigue en `PENDIENTE`, porque el rechazo no tiene estado donde
asentarse. La persona vuelve a tocar "Pagar". `claveDeIdempotencia` ve un pago
`PENDIENTE` con el mismo medio y monto, y **devuelve la misma clave**. El adaptador,
cumpliendo el contrato, reabre **el mismo `shop_process_id`** — que Bancard ya dio por
usado. El segundo intento no puede prosperar, y el tercero tampoco.

**El diagnóstico.** El bug no está en `claveDeIdempotencia`: su regla es correcta y el
propio puerto explica por qué ("solo cambia cuando el intento anterior murió o cuando
la persona cambió de medio de pago"). El problema es que **el dominio no tiene cómo
saber que el intento anterior murió**, porque un rechazo de tarjeta no es
representable. `PENDIENTE` significa hoy dos cosas incompatibles: "todavía no pagó" y
"lo intentó y le dijeron que no".

**La corrección.** Agregar `RECHAZADO` a `EstadoPago` y hacer que el sondeo lo asiente
cuando Bancard devuelve un rechazo — la tabla de códigos de respuesta del anexo de
Single Buy (05, 12, 15, 51…) es la fuente. Con eso, `claveDeIdempotencia` acuña sola
una clave nueva, el adaptador acuña un `shop_process_id` nuevo, y el reintento
funciona sin tocar la función. Es el cambio de menor superficie que resuelve el caso,
y deja P7 en condiciones de contar intentos (→ §4.2), que hoy no puede hacer porque
todos los intentos se ven iguales.

**También está condicionada.** Asentar `RECHAZADO` exige que Bancard nos cuente el rechazo,
y no sabemos por cuál de las dos vías: si el POST de confirmación se envía también para
operaciones rechazadas, o si `get_confirmation` devuelve la operación con su código en vez
de `PaymentNotFoundError`. Consulta **B10-bis** (§6). Si resultara que un intento se quema
sin que el comercio pueda enterarse por ninguna vía, el arreglo deja de ser técnico y pasa
a ser de producto: habría que acuñar clave nueva en cada apertura del formulario, con el
costo de perder la protección contra el doble click.

**Alcance.** Afecta a las dos ramas de tarjeta. La rama QR no la sufre: un QR no se
"rechaza" por tarjeta, se cancela o expira, y para eso `CANCELADO` alcanza.

### 3.3 G3 · El callback de QR es la única fuente de verdad, y tiene 5 segundos

**Los hechos.**

- No existe consulta de estado por `hook_alias` (B6).
- El callback de QR debe responder en **menos de 5 segundos** o Bancard **reversa la
  transacción automáticamente**.
- Bancard es explícita: *"es primordial que el callback no esté ligado a ningún
  proceso interno del comercio"*.
- Hoy **no existe ningún route handler de callback de Bancard** en `src/app/api/`. El
  estado del pago se conoce exclusivamente por el sondeo de P7
  (`confirmarPagoP7`, `src/domain/pago-p7.ts:731`).
- `confirmarPagoP7` **genera, dibuja, hashea y persiste el Certificado de Cobertura
  Provisional** dentro de la transición del pago — es la garantía de D-12/CMP-07:
  si el certificado no se puede cerrar, el pago no se confirma
  (`CERTIFICADO_NO_EMITIDO`, `src/domain/pago-p7.ts:842`).

**El hallazgo.** Estas dos últimas líneas, juntas, son un choque frontal. **Si el
callback de QR fuera el que transiciona el pago, ejecutaría la emisión del certificado
—generación de PDF, SHA-256, escritura en S3, escritura en DynamoDB— dentro de un
presupuesto de 5 segundos**, con Bancard reversando la transacción si se pasa. Y una
reversa disparada por lentitud sobre un pago que del lado nuestro ya emitió
certificado es la peor combinación posible: certificado emitido, dinero devuelto.

**La buena noticia:** el diseño actual ya está del lado correcto, por accidente feliz.
El certificado se emite en el **sondeo**, no en un callback, porque hasta hoy no hay
callback. Lo que estas respuestas hacen es **convertir esa casualidad en un invariante
que hay que declarar y proteger** antes de escribir el adaptador `live/`.

**La forma que debe tener el callback.** Recibir, autenticar (Basic + whitelist de IP),
**persistir el aviso crudo** en el expediente o en una partición de avisos, responder
el JSON que Bancard espera, y **terminar**. Nada más. La transición de estado y la
emisión del certificado las sigue haciendo `confirmarPagoP7`, que ahora tiene dos
posibles fuentes de verdad según la rama:

| Rama | Fuente del estado en `confirmarPagoP7` |
| :---- | :---- |
| **vPOS** (débito / crédito) | `get_confirmation` (consulta en vivo) **o** el aviso persistido, lo que llegue primero |
| **QR** | **exclusivamente** el aviso persistido por el callback |

Esto es, estructuralmente, el mismo patrón que CHG-33 ya resolvió para la firma:
**dos vías de enterarse, un identificador de idempotencia** (allá `session_id`, acá
`hook_alias` / `shop_process_id`), la primera que llega transiciona y la segunda
responde lo mismo con `duplicada: true` y deja su propia evidencia. Conviene
reutilizar el patrón y su vocabulario en lugar de inventar otro: el origen del aviso
(`SONDEO` / `CALLBACK`) es una pregunta de auditoría, igual que allá.

**Consecuencia operativa que hay que aceptar.** Si el callback de QR se pierde y no hay
consulta que hacer, el pago queda invisible para nosotros. La única defensa que Bancard
ofrece es la reversa por tiempo X (recomiendan ~5 min, configurable del lado del
comercio). Es decir: **para QR, un cobro sobre el que perdimos el callback se deshace,
no se investiga.** Hay que decidir ese "tiempo X" como parámetro de producto y dejarlo
asentado, y hay que decírselo a la persona en P7 en términos que no prometan lo que no
podemos cumplir.

---

## 4. Correcciones y ajustes al análisis del 12-ago-2026

### 4.1 Bloqueo antifraude: la lectura anterior era incorrecta

`docs/ANALISIS_INTEGRACIONES_CODE100_BANCARD.md` §2.2.5 afirma que 7 rechazos en 24 h
*"bloquean la tarjeta **en el comercio** por 30 días"*. **Es más grave que eso:** por
B12 el bloqueo es **de la tarjeta, en todos los comercios**, lo aplica el emisor o la
marca, y no lo podemos consultar ni levantar. Se corrige por adenda en aquel
documento.

### 4.2 Límite de reintentos en P7: hay número, y hay una limitación honesta

Bancard recomienda **≤ 5 intentos por tarjeta en 24 h**. Nuestro límite interno tiene
que quedar por debajo.

La limitación que hay que declarar: **nosotros no vemos la tarjeta**, así que no
podemos contar por tarjeta. Podemos contar por expediente —lo que, resuelto G2, se
vuelve posible— y esa cuenta es una aproximación conservadora en el caso normal (una
persona, un expediente, una o dos tarjetas), pero **no cubre** a quien reintente
repartiendo intentos entre expedientes distintos. La regla #11 (bloqueo por cédula)
limita parcialmente ese camino, no lo cierra.

Existe un identificador no-PAN que Bancard sí nos da en el callback de QR —`bin` +
`card_last_numbers`— y que permitiría contar por tarjeta sin acercarse jamás al PAN
(regla inviolable #6). **No conviene usarlo todavía**: es un dato de tarjeta que hoy
no persistimos, su valor de identificación es imperfecto, y agregar persistencia de
datos de tarjeta para calibrar un contador es una decisión que merece su propia
discusión con Cumplimiento, no una nota al pie de este documento.

Recomendación: **límite de 3 intentos de tarjeta por expediente**, con mensaje
accionable que invite a usar QR o a intentar más tarde, y evidencia por intento.
Es decisión de producto — **no hay fila en la matriz de cumplimiento que la exija**;
lo que sí hay es la fila 32 (idempotencia) que exige lo contiguo, que es no cobrar dos
veces.

### 4.3 `payment_card_type`: enviarlo siempre, por una razón distinta

El análisis del 12-ago recomendaba enviar `extra_response_attributes:
["payment_card_type"]` en toda compra simple **para detectar el cruce débito/crédito
de la preautorización**. Esa razón caducó con D-02. La recomendación se mantiene con
otro fundamento: **asentar el medio de pago realmente usado**, en vez del que la
persona eligió en la pantalla. Hoy `Pago.medio` guarda la elección de P7, y el
comprobante `REC-<correlativo>` (D-05) la imprime; si no coinciden, el comprobante
afirma algo que no ocurrió. Fila 31 de la matriz (*"Conservar ID, estado, fecha, hora,
importe y referencia de la operación Bancard"*, Res. BCP 25/21, art. 6(a-e); Ley
6822/21, arts. 42(5) y 66) empuja en la misma dirección: lo que se conserva debe ser
lo que pasó.

### 4.4 Lo que se confirma sin cambios

- **`shop_process_id` numérico de 15 dígitos mapeado desde la `idempotencyKey`**: el
  diseño sigue siendo correcto; B10 solo agrega que el mapeo debe acuñar uno nuevo
  ante cualquier intento muerto, incluido el rechazado (→ G2).
- **Dos clientes HTTP con esquemas distintos** dentro del adaptador Bancard: B13 lo
  confirma al confirmar dos altas independientes.
- **Presupuestos de 5 s (QR) y 30 s (vPOS)**: confirmados literalmente por B8.
- **Single Buy v1.23 vigente**: el PDF de `docs/Integraciones/` está al día.
- **No usar catastro, token, 3DS, Zimple ni el elemento `billing`**: nada en estas
  respuestas lo toca.

---

## 5. Divergencia declarada con las reglas transversales de integraciones

`CLAUDE.md` → "Reglas transversales de integraciones (no negociables)" exige:

> *Callbacks de proveedores firmados, verificables, idempotentes y vinculados a la
> misma propuesta.*

**Bancard no firma sus callbacks y no ofrece mTLS** (B8). Lo que ofrece es
autenticación **BASIC sobre HTTPS**, con las credenciales que **ellos** parametrizan,
más una **whitelist de IP** publicada. Es un mecanismo más débil que el que la regla
pide, y **no hay negociación posible**: es el contrato del proveedor, igual que el
esquema de tokens md5 de vPOS que el análisis del 12-ago ya había marcado como débil
pero obligatorio.

**Cómo se cierra la brecha con lo que sí está en nuestras manos:**

1. **Basic + HTTPS obligatorio** con la credencial que Bancard parametrice, guardada
   como secreto de infraestructura (nunca en el repositorio).
2. **Whitelist de las IP de origen** en la capa de borde (Cloudflare/WAF), no en el
   route handler: 7 direcciones para QR, 4 para vPOS.
3. **Idempotencia y vinculación a la propuesta**: esas dos mitades de la regla **sí**
   se cumplen y son nuestras. El aviso se vincula por `hook_alias` /
   `shop_process_id` a un intento de pago que ya está persistido en el expediente; un
   aviso que no case con un intento abierto se registra y se descarta, no se cree.
4. **Nunca confiar en el contenido del aviso como orden de cobro.** Para vPOS,
   `get_confirmation` permite re-preguntarle al proveedor —el mismo criterio con el
   que ninguna ruta de retorno de Code100 cree lo que dice el navegador (CHG-33)—.
   Para QR **no se puede**, y ahí la defensa es (1)+(2)+(3).

**Esto hay que registrarlo como divergencia consciente**, del mismo modo en que D-13
registró la suya con la Matriz V4 §2. No es una regla que estemos incumpliendo por
descuido: es una regla que el proveedor no permite cumplir en su letra, y cuya
intención se cubre por otros medios.

---

## 6. Preguntas abiertas — insumo para la parte 2

**Redactadas y listas para reenviar**, un archivo por correo —van separados porque tienen
destinatarios distintos—:

- `docs/correos/Correo 3 - Bancard tecnico - segunda ronda (B4-bis a B13-bis).md`
- `docs/correos/Correo 4 - Bancard comercial - devoluciones (B2, B3, B7, B11).md`

El porqué de cada consulta y la trazabilidad B1…B13 siguen en
`docs/CONSULTAS_PROVEEDORES_CODE100_BANCARD.md` → "Segunda ronda — Bancard".

| # | Destinatario | Pregunta | Por qué bloquea |
| :---- | :---- | :---- | :---- |
| **B2** (repreguntar) | Equipo comercial Bancard | Devolución posterior al cuponado: ¿único canal el ticket manual? SLA, **constancia/comprobante emitido**, plazo máximo, ¿admite parcial? | La constancia se incorpora al expediente en Pantalla B (D-02). Sin saber qué documento emite Bancard, no se puede diseñar ese asiento |
| **B3** (repreguntar) | Equipo comercial Bancard | ¿La devolución aplica igual a TC, TD, QR y débito en cuenta? ¿Por qué vía y en qué plazo vuelve el dinero en cada uno? | El texto de Pantalla B le informa a la persona un plazo. Hoy no tenemos ninguno que sea cierto |
| **B7** (en curso) | Ejecutiva de cuenta | Hosts de staging/producción del API de Comercios, credenciales, lista de casos de prueba y certificación de QR | Precondición del adaptador `live/` de la rama QR |
| **B11** (en curso) | Ejecutiva de cuenta | Montos mínimos y máximos para vPOS pago ocasional y para QR | El premio anual de CONFÍO debe caer dentro del rango en los tres medios. Hay que verificarlo, no suponerlo |
| **B4-bis** (nueva) | Bancard técnico | ¿La reversa por `hook_alias` **invalida un QR generado y no pagado**, o solo revierte un pago ocurrido? Si es lo segundo, ¿hay alguna operación para **desactivar un QR emitido y no usado**? | **Es la que decide si G1 tiene arreglo.** Toda la mitigación del §3.1 supone que reversar al vencer apaga el QR. Si no lo apaga, hay que buscar otra cosa |
| **B6-bis** (nueva) | Bancard técnico | Sin consulta por `hook_alias` y sin callback, un pago QR acreditado nos queda invisible. ¿Existe **conciliación diaria** —reporte, archivo de cierre, exportación del portal— para detectarlo? | Fila 31 de la matriz obliga a conservar constancia de cada cobro. Si no existe, hay que asentarlo como riesgo operativo aceptado, no descubrirlo en producción |
| **B10-bis** (nueva) | Bancard técnico | Ante un intento **rechazado**: ¿llega igual el POST de confirmación con su `response_code`? ¿`get_confirmation` devuelve la operación rechazada o `PaymentNotFoundError`? | **Es la que decide si G2 tiene arreglo.** Sin una vía por la que enterarnos del rechazo no se puede asentar `RECHAZADO`, y sin eso no hay reintento |
| **B8-bis** (nueva) | Bancard técnico | **Política de reintentos** de Bancard cuando el comercio no responde en tiempo: ¿reintenta el callback? ¿cuántas veces, con qué espaciado? ¿o reversa directamente? | Dimensiona la idempotencia del route handler y el "tiempo X" antes de reversar |
| **B13-bis** (nueva) | Bancard técnico | Desambiguar *"una única URL de confirmación, tanto para vPOS como para QR"*: ¿(a) una por producto, (b) una compartida por ambos, o (c) una en total? Y en cualquier caso: **¿una por ambiente, o la misma para staging y producción?** | Define si el callback es un route handler o dos, y si se puede certificar sin pisar producción |
| **B8-ter** (nueva) | Bancard técnico | Las 4 IP listadas bajo el título "vPOS 2.0" aparecen rotuladas como *"IP de origen del servicio QR"*. ¿Es un error de tipeo y corresponden a vPOS? | Una whitelist mal armada corta los cobros en producción |
| **B5-bis** (nueva) | Bancard técnico | ¿El TTL de 3 días del QR es configurable por comercio, o fijo? | Si fuera configurable a ≤ 24 h, el hueco G1 se cierra del lado del proveedor y no hace falta la reversa al vencer |

---

## 7. Trabajo pendiente en el código (no ejecutado en esta tarea)

Este documento es análisis. Siguiendo la regla de `CLAUDE.md` —el cambio se baja a la
especificación antes de tocar código—, **no se modificó nada de `src/`**. Lo que estas
respuestas dejan planteado, en orden de importancia:

1. **G1 · Reversar la operación de Bancard al vencer el expediente.**
   `vencerPlazoPagoP7` invoca `cancelarOLiberarReserva` sobre la referencia pendiente
   y asienta el resultado como evidencia. Resuelve el QR de 3 días sobre un plazo de
   24 h, y le da su primer llamador a un método del puerto que hoy no tiene ninguno.
   *Toca:* `src/domain/pago-p7.ts`, evidencia, tests de contrato del puerto.
   **Bloqueado por B4-bis:** si la reversa no apaga un QR no pagado, esta vía no sirve.
2. **G2 · Agregar `RECHAZADO` a `EstadoPago`** y asentarlo en el sondeo ante un
   rechazo de Bancard. Desbloquea el reintento tras un rechazo de tarjeta (B10) y
   habilita el contador de intentos.
   *Toca:* `src/domain/tipos.ts`, `src/domain/pago-p7.ts`, mock, panel de demo (una
   palanca "tarjeta rechazada" que hoy no existe), tests.
   **Bloqueado por B10-bis:** hace falta saber por qué vía nos llega el rechazo.
3. **G3 · Declarar el invariante del callback** antes de escribir el adaptador
   `live/`: el callback persiste y responde; la transición y la emisión del
   certificado siguen en `confirmarPagoP7`. Idempotencia por `hook_alias` /
   `shop_process_id`, con origen (`SONDEO` / `CALLBACK`) en la evidencia, calcado del
   patrón CHG-33 de la firma.
   *Toca:* documentación primero (`CLAUDE.md`, `ESPECIFICACION_PANTALLAS.md` → P7);
   código recién con el adaptador `live/`.
4. **§4.2 · Límite de intentos de tarjeta en P7** (3 por expediente, recomendado),
   con mensaje accionable. Depende de G2.
5. **§4.3 · `payment_card_type`** en toda compra simple, para asentar el medio real.
   Depende del adaptador `live/`; el mock puede simularlo antes.
6. **Corregir el comentario de `VIGENCIA_QR_MINUTOS`** en el mock: hoy se lee como si
   fuera el TTL del proveedor, y el TTL del proveedor son 3 días. Los 15 minutos son
   política nuestra, y con G1 pasan a ser política **exigible**.
7. **§5 · Registrar la divergencia** de callbacks no firmados donde
   `CLAUDE.md` enuncia la regla transversal, con la mitigación de cuatro puntos.

Ninguno de los siete afecta al modo demo actual ni al Lote 6, que sigue siendo el
único lote pendiente del Plan v2. El punto 4 se solapa con el rate limiting de L6 y
conviene hacerlos juntos.
