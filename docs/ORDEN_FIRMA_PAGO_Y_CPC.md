# Orden firma → pago, CPC y PDF único — decisiones y consecuencias

**Fecha:** 2026-08-27
**Origen:** decisiones de producto tomadas sobre los cambios que trajo la Matriz Legal V4 (`docs/MATRIZ_LEGAL_V4.md` §10).

| # | Decisión | Estado |
| :---- | :---- | :---- |
| 1 | **El cobro va después de las firmas** | **Decidida** |
| 2 | **Se emite el CPC** (Certificado Provisional de Cobertura) | **Decidida** |
| 3 | **PDF único**: factible, condicionado a que el prestador de firma cualificada pueda firmar dos documentos en un solo evento | **Condicionada** — ver §5, donde ya hay respuesta |
| 4 | **Medios de pago: QR, tarjeta de crédito y tarjeta de débito** | **Decidida** — prevalece sobre el "solo QR" de la V4; el detalle se trata en la sesión de Bancard |
| 5 | El resto de los puntos de la norma | Se implementan conforme necesidad |

**Este documento no toca pantallas.** El rediseño de tres pantallas está en curso; acá solo se analiza el efecto sobre el dominio, la máquina de estados y la evidencia.

---

## 1. La secuencia nueva

| Orden | Acto | Responsable | Qué produce |
| :---- | :---- | :---- | :---- |
| 1 | Elegibilidad aprobada | Sistema | Supera edad, salud, PEP e identidad. Si no, caso manual |
| 2 | Cierre documental | SeguroLoTengo | Solicitud + FIPF con versión y hash congelados |
| 3 | **Firma del cliente** | Cliente | Firma electrónica simple respaldada por el OTP de firma, sobre el documento completo puesto a la vista |
| 4 | **Firma del corredor** | Interseguros | Firma cualificada sobre la propuesta y sus anexos integrantes (Res. 210/2025 art. 5) |
| 5 | **Aceptación y CPC** | Alianza | Reglas autorizadas aplicadas automáticamente; se emite el CPC y lo firma su suscriptor autorizado, **condicionado al pago** |
| 6 | **Pago** | Cliente / Bancard | QR, crédito o débito. Si la emisión falla, reverso |
| 7 | Activación y entrega | Alianza / SeguroLoTengo | El pago confirmado activa la cobertura; se entregan CPC, documento firmado y comprobante |
| 8 | Póliza y factura | Alianza / SEBAOT | Emisión posterior |

Lo que cambia respecto de hoy no es un paso: es **el sentido de la mitad del expediente**. Hoy el dinero entra primero y la firma es lo que puede faltar; ahora la firma entra primero y lo que puede faltar es el dinero.

---

## 2. Efecto sobre la máquina de estados

**Hoy** (`src/domain/expediente.ts`): `DECLARACIONES_OK → PAGO_CONFIRMADO → PAQUETE_GENERADO → FIRMADO → EMITIDO`, con `VENCIDO → DEVOLUCION_EN_TRAMITE → DEVUELTO` colgando de las dos etapas intermedias.

**Con el orden nuevo**, la cadena se reordena: cierre documental → firma del cliente → firma del corredor → aceptación y CPC → pago → activación → emisión.

### 2.1 Lo que desaparece del camino ordinario

**La devolución.** Toda la rama `VENCIDO → DEVOLUCION_EN_TRAMITE → DEVUELTO` existía porque se cobraba antes de firmar: si la persona no firmaba, había plata que devolver, y como el rollback de Bancard solo opera el mismo día, la devolución terminaba siendo un trámite presencial en Alianza. **Con el pago al final, un expediente abandonado no tiene dinero adentro.** No hay nada que devolver, no hay trámite presencial, no hay Pantalla B tal como está escrita hoy.

Es la simplificación más grande que trae la decisión, y conviene decirlo con todas las letras: **se elimina el peor camino del producto**, el único que obligaba al cliente a ir a una oficina.

La rama no se borra del dominio todavía —hay que ver si Alianza la quiere conservar para excepciones—, pero deja de ser el desenlace ordinario del abandono.

### 2.2 Lo que aparece

- **Expediente firmado y no pagado.** Estado nuevo: existe un documento firmado por el cliente y por el corredor, y un CPC firmado por Alianza, sobre una operación que puede no pagarse nunca. Necesita su propio desenlace terminal, **sin devolución**.
- **Reverso por fallo de emisión.** La V4 lo pide expresamente: si entra el pago y la emisión falla, reverso automático. Ese sí mueve dinero, y es el único caso que lo hace. Es una excepción técnica, no un camino de negocio.
- **CPC como documento del expediente.** Con su número oficial, su hash, su firma cualificada, su verificador y su acuse de entrega.

### 2.3 Preguntas que la decisión abre y hay que cerrar con Alianza

1. **¿Qué pasa con los documentos firmados si nunca se paga?** Están firmados por tres partes y no hay contrato perfeccionado. ¿Se anulan, se conservan como propuesta no aceptada, se archivan con una marca? El Código Civil sostiene que la propuesta no obliga por sí sola; hace falta que el expediente lo refleje.
2. **¿El CPC firmado y no pagado genera cobertura?** La V4 dice que queda condicionado al pago, pero un instrumento de cobertura firmado y entregado es un documento con efectos. Hay que definir si se entrega antes o después del pago, y qué dice el propio CPC sobre su condición.
3. **¿Cuánto vive un expediente firmado sin pagar?** El plazo de 24 horas del proyecto medía otra cosa —el tiempo para firmar después de pagar—. Ahora hay que definir cuánto vale una firma sin pago.

---

## 3. Reglas del proyecto que quedan desalineadas

| Dónde | Qué dice | Qué pasa |
| :---- | :---- | :---- |
| `CLAUDE.md` → "Qué no hacer" | "No generes Nota de Cobertura — el producto no la contempla" | **Revertida** por la decisión 2. Queda por confirmar si el CPC y la Nota de Cobertura son el mismo instrumento con distinto nombre, o dos cosas distintas y la prohibición sobrevive para la segunda |
| `CLAUDE.md` → checklist #7 | "¿El pago respeta el flujo Bancard (QR-antes-de-firma o preautorización-antes/captura-después)?" | Obsoleto: ya no hay pago antes de firma |
| `CLAUDE.md` → máquina de estados | Describe el orden actual, con `PAGO_CONFIRMADO` antes de `PAQUETE_GENERADO` | Describe lo implementado, que sigue siendo cierto hasta que se toque el código. Se marca como pendiente de reordenar |
| CSV, fila 28 | "En QR, permitir pago anterior a la firma e informar la condición y devolución" | Sin objeto |
| CSV, fila 30 | "Devolver el premio si el cliente no firma dentro del plazo comunicado" | Pierde su supuesto: no hay premio pagado |
| CSV, fila 29 | Recordatorios de firma a 1, 5 y 12 horas | Cambia de destinatario: si hay recordatorios, ahora son de pago |
| CSV, filas 26 y 27 | Preautorizar antes de firmar y capturar después | Ya estaban sin efecto por la adenda de 2026-08-12 |
| `src/domain/textos-p8.ts`, `textos-p9.ts`, `emision-p9.ts`, `documentos.ts` | Leyenda "No se genera Nota de Cobertura" impresa en pantalla y **dentro de los PDF** | Hay que quitarla. Como va impresa en documentos que se hashean, exige subir versión documental |

---

## 4. Evidencia: se ancla al acto, no a la pantalla

Con tres pantallas, cada una concentra varios actos con efecto jurídico. La regla que conviene fijar **antes** de que llegue el rediseño es que **la evidencia se registra por acto**, y una pantalla puede producir cinco registros distintos. Nada en el registro debe llamarse "evidencia de la pantalla 2".

Evidencia mínima por acto, según la V4 §9 y lo que el sistema ya produce:

| Acto | Evidencia mínima | Hoy |
| :---- | :---- | :---- |
| Apertura de sesión | ID, origen, IP, user-agent, fecha/hora, recuperación de sesión | Existe |
| Oferta puesta a disposición | Producto, plan y versiones; aperturas de video, brochure y condiciones. **Nunca registrar una lectura inexistente** | Parcial |
| Verificación de canal | Teléfono normalizado, OTP, intentos, resultado; correo declarado y confirmado | Existe |
| Identidad | Documento, OCR y correcciones, autenticidad, prueba de vida y resultado facial con referencias seguras | Existe |
| Consentimientos | Versión exacta del texto, pantalla, fecha/hora, acto afirmativo y canal. Marketing separado | Existe |
| Documento | PDF previo y posterior, número de propuesta, correlativo, hash SHA-256 | Existe |
| **Firma del cliente** | OTP de firma, texto aceptado, hash antes y después, IP, dispositivo | Por construir |
| **Firma del corredor** | Certificado, firmante, sesión del prestador, fecha/hora | Por construir |
| Aceptación | Resultado de filtros, regla aplicada, versión del motor, autorización de Alianza, motivo | Parcial |
| **CPC** | Número oficial, hash, firma cualificada, verificador, fecha/hora, inicio y fin, canal y acuse | Por construir |
| Pago | ID de orden y transacción, importe, moneda, concepto, vencimiento, callback, idempotencia, estado, comprobante | Existe |
| Entrega | Destino, estado, reintentos y acuse para CPC, póliza y factura | Parcial |

**Protección, que no cambia:** ni salud, ni PEP, ni imágenes, ni puntajes biométricos, ni OTP, ni PAN, ni CVV en registros ordinarios.

---

## 5. PDF único: el prestador ya contestó

La decisión quedó condicionada a si el prestador puede firmar dos documentos en un solo evento. **Con Code100 la respuesta ya está por escrito** (C8d, `docs/Integraciones/Code100 - Respuestas C1 a C12.md`): todos los documentos enviados en una misma llamada se firman con la misma sesión, derivada de **una única autenticación y una única autorización**, sin intervención del firmante entre un documento y el otro. La precisión que agregan: cada PDF recibe **su propia firma PAdES individual**, no hay contenedor único, y sugieren asentar el `session_id` junto con los hashes de ambos documentos como vínculo explícito.

Dos consecuencias:

1. **Para la firma del cliente la pregunta ni siquiera se plantea**: esa firma es interna, la atomicidad la garantiza nuestro propio servicio con una sola escritura.
2. **Para la firma del corredor, con Code100 no hace falta unificar el PDF.** Y si mañana se contrata otro prestador, esta es una pregunta obligatoria de la homologación.

Así que **unificar o no unificar pasa a ser una decisión de producto y legal —un instrumento o dos—, no una restricción técnica.** Si se decide unificar, el impacto está acotado a `src/documentos/` (un correlativo, un código, un hash en vez de dos) y hace que la regla inviolable #3 se vuelva trivial: con un solo documento no existe el estado "uno firmado y el otro no".

---

## 6. Qué no se toca todavía

Las pantallas. El rediseño de tres pantallas está en curso y hasta que llegue no se modifica ninguna. Lo que sí conviene tener resuelto para entonces: las tres preguntas de §2.3, que son de Alianza, y la definición de si el CPC reemplaza a la Nota de Cobertura o convive con ella.
