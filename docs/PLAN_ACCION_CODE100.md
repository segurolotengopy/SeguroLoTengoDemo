# Plan de acción — integración con Code100 (firma electrónica)

**Fecha:** 2026-08-20
**Documento fuente:** `docs/Integraciones/Code100 - Respuestas C1 a C12.md` (respuestas de Code100 a las consultas C1–C12 de `docs/CONSULTAS_PROVEEDORES_CODE100_BANCARD.md`).
**Reemplaza a:** las preguntas abiertas #1, #2 y #3 de `docs/ANALISIS_INTEGRACIONES_CODE100_BANCARD.md` §4, que quedan respondidas.
**Alcance:** solo Code100. Bancard sigue esperando respuesta a B1–B13.

> **Nomenclatura (27-ago-2026).** Donde este documento decía "Code100" como proveedor de las firmas cualificadas, ahora dice **PSC cualificado**: cualquier prestador cualificado de servicios de confianza habilitado en Paraguay. **Code100 sigue siendo la primera opción**, pero no es el único: el listado del MIC (`acraiz.gov.py`) incluye además a VIT S.A. (eFirma), Documenta S.A., Confirma S.A., ITTI S.A.E.C.A. y SOS Tecnología y Gestión Ltda. Los pasajes que describen **respuestas o comportamientos concretos de Code100** conservan su nombre, porque son hechos de ese proveedor y no del rol.


Las respuestas cierran las tres preguntas abiertas, confirman que el diseño de multifirma es viable, **y abren un bloqueo de producto que no es técnico**: Code100 no ofrece firma electrónica no cualificada. Todo lo demás de este plan es secundario frente a esa decisión.

---

## 1. El bloqueo: el cliente final no puede firmar con Api Flow tal como está diseñado el producto

**C1 es un "no" sin matices.** Api Flow firma exclusivamente con **certificado cualificado**: `session-start` abre una autorización OAuth contra el prestador de servicios de confianza, el firmante autoriza el uso de *su* clave y `sign-pdf` firma con esa sesión. No hay flujo alternativo, no hay enrolamiento, no hay certificado de único uso (C2), y por lo tanto tampoco hay evidencias de firma no cualificada que resguardar (C3).

Consecuencia directa: **el cliente de CONFÍO tendría que llegar a P8 con un certificado cualificado vigente ya emitido**. Eso es incompatible con un producto B2C de mínima fricción que se contrata en minutos desde el celular.

### 1.1 Qué dice la matriz de cumplimiento

| Fila | Título | Norma y Artículo (textual del CSV) |
| :---- | :---- | :---- |
| 34 | El cliente firma electrónicamente la Solicitud de Seguro y el FIPF | Ley 6822/21, arts. 38(1), 42(5) y 67-69; Res. SS SG. 215/17, anexo 1, numeral 11.15 |
| 36 | Utilizar un mismo enlace Code100 para firmar la Solicitud y el FIPF | No es exigencia legal, es diseño del proceso. Debe mantener atribución conforme al art. 40 de la Ley 6822/21 |
| 39 | Alianza firma la póliza mediante firma electrónica cualificada | Res. SS SG. 215/17, art. 1; Ley 6822/21, arts. 38(2) y 43 |

La propia matriz distingue el inciso que cita para el cliente (38(1)) del que cita para la firma cualificada de Alianza (38(2) y 43), y la fila 36 —usar Code100 para el cliente— está marcada como **diseño del proceso, no exigencia legal**. Es decir: la matriz no obliga a que el cliente firme con Code100 ni con certificado cualificado. **Confirmarlo es tarea del área legal, no de este equipo**: acá solo se deja asentado que el cambio de proveedor para la firma del cliente no contradice ninguna fila del CSV cargado.

### 1.2 Opciones

| # | Opción | Qué implica | Viabilidad |
| :---- | :---- | :---- | :---- |
| A | El cliente obtiene un certificado cualificado antes de contratar | Enrolamiento presencial o por video ante una AC, costo y demora por persona | **Descartable**: destruye el producto (contratación en minutos, sin fricción). |
| B | Code100 desarrolla firma no cualificada | Depende de su hoja de ruta comercial, sin fecha | No se puede planificar sobre esto. Corresponde preguntarlo (C17), no esperarlo. |
| C | **SeguroLoTengo implementa la firma del cliente y Code100 queda solo para las cualificadas de Interseguros y Alianza** | El tercer OTP (P8) pasa a ser nuestro; la evidencia de atribución (identidad, OTP, IP, fecha, hora, hash, resultado — fila 42) la produce y conserva SeguroLoTengo | **Recomendada.** No agrega proveedor externo, reusa lo que el sistema ya hace (OTP, evidencia append-only, hash SHA-256, verificación de identidad de P5) y deja a Code100 en lo único que sabe hacer: firma cualificada. |
| D | Otro proveedor para la firma del cliente | Alta de proveedor nuevo | Solo si legal rechaza la opción C. **Requiere registrarlo antes en `docs/Tabla de Integraciones externas - Tabla.csv`** (regla de CLAUDE.md). |

**Argumento adicional a favor de C:** C3 aclara que Code100 **no registra la dirección IP ni el agente de usuario del firmante** y **no emite un acta de evidencias descargable**. O sea: aun firmando el cliente con Code100, la fila 42 la tendríamos que cubrir nosotros igual. La opción C no agrega una obligación probatoria nueva; la explicita.

**Contra de C, sin edulcorar:** una firma electrónica simple con OTP + evidencia propia tiene menos fuerza probatoria que una cualificada ante un litigio, y su solidez depende enteramente de la calidad de nuestro registro de evidencia. Es exactamente el punto que legal tiene que resolver antes de que se escriba una línea de código.

> **Gate 0 — nada de lo que sigue se implementa hasta que esta decisión esté tomada por escrito.** Las tareas de las fases 1 y 2 sí pueden avanzar en paralelo, porque valen para cualquiera de las opciones.

---

## 2. Lo que las respuestas confirman, corrigen o rompen

| Consulta | Respuesta | Impacto sobre lo que hoy tenemos |
| :---- | :---- | :---- |
| C1–C3 | Solo firma cualificada; sin IP ni acta de evidencias | **Bloqueo §1.** Además, la evidencia de la fila 42 es nuestra en cualquier escenario. |
| C4 | Multifirma por *incremental update* PAdES: una sesión por firmante, y el PDF ya firmado se reenvía en base64 en la firma siguiente. **No hay custodia del lado de Code100**: el archivo temporal se borra. `nro_odt` correlaciona cada PDF con su origen | Cierra la pregunta abierta #2. **Rompe `descargarDocumentosFirmados`** (§3.1). Confirma que la custodia entre firmas es nuestra (S3). |
| C5 | El orden lo orquesta nuestra aplicación. Las dos firmas cualificadas **deben serializarse**; solo la *preparación* de sesiones puede ser paralela | **Contradice a CLAUDE.md y a la fila 37**, que dicen "Interseguros y Alianza en paralelo". Hay que corregir la documentación (§5). |
| C6 | La distribución del enlace es del comercio: Code100 no manda WhatsApp ni correo | Cierra la pregunta abierta #1 y **desmiente el comentario de `FirmaIniciada.urlActoDeFirma`**. El envío va por WhatsApp-Modular / SES. Si se usa iframe, hay que darles los dominios para `frame-ancestors`. |
| C7 | Tres relojes distintos. Token JWT ≈ 16 h 40 min, sin refresh (401 → re-auth). Sesión de firma configurable **hasta 24 h**, y se cuenta **desde que el firmante autoriza**, no desde que se crea la sesión. El TTL del enlace *antes* de usarse lo define la PSA y está fuera de este API | Cierra parcialmente la pregunta abierta #3. **Queda un hueco crítico**: nuestro enlace se distribuye y puede abrirse 20 h después, y nadie sabe cuánto vive sin usar → consulta C13. |
| C8a | `sign-pdf` **no es idempotente**: una segunda llamada firma de nuevo. Recomiendan no reintentar ante timeout | **Contradice la sección "Idempotencia de webhooks" de CLAUDE.md** en lo que respecta a Code100. La idempotencia hay que construirla de nuestro lado (§3.2). |
| C8b | Sin código de error específico para sesión vencida; la vía fiable es consultar `getSessionId.expirado` antes de firmar | Define el orden real de llamadas del adaptador: consultar, después firmar. |
| C8c | 10 MB por PDF, 10 documentos por llamada, 10 minutos de respuesta máxima, sin límite de tasa | Los PDF propios pesan poco: sin problema. **Pero 10 minutos no entran en el timeout de una función SSR de Amplify** → riesgo de infraestructura (§7). |
| C8d | Todos los documentos de una llamada se firman con la misma sesión y una sola autorización. Cada PDF recibe su **firma PAdES individual**; no hay contenedor único | La regla inviolable #3 se sostiene, pero el vínculo jurídico entre Solicitud y FIPF es el `session_id` común. **Ellos mismos sugieren asentar `session_id` + los dos hashes SHA-256** — que es exactamente lo que ya hacemos. Hay que dejarlo explícito en la evidencia. |
| C8e | `container_sign` en **centímetros**, origen en el borde inferior izquierdo; `page_number = -1` es la última página; `nro_odt` es un identificador libre que devuelven sin tocar | Accionable en `src/documentos/`: o se reserva el recuadro de firma en la última página, o **se omite `container_sign`** y se deja el apilado automático (recomendado para tres firmas). `nro_odt` = `PROP-<correlativo>` / `FIPF-<correlativo>`. |
| C9 | `status` = el firmante completó la autorización (**no** que firmó); `expirado` = calculado contra `fecha_expiracion`. **No existe estado consultable de "rechazo del firmante"** | `ResultadoFirma.PENDIENTE.enlaceAbierto` mapea bien a `status`. Pero **`MotivoNoFirmado: "RECHAZADA"` y `"CANCELADA"` no son observables** con el API actual. Se pueden acordar en la certificación (lo ofrecen). |
| C10 | **No hay webhooks.** Solo respuesta síncrona de `sign-pdf`, redirección a `redirect_url` y polling de `getSessionId` | Confirma el sondeo actual de P8. **Corregir CLAUDE.md**: la idempotencia de callbacks aplica a Bancard, no a Code100. Aparece un retorno HTTP nuevo que hay que atender (`redirect_url`). |
| C11 | **PAdES-T** (B-T con sello de tiempo), no LT ni LTA. Sin información de revocación embebida ni sello de archivo. Elevar la política es configuración del servicio. No exponen endpoint de validación | Brecha de conservación a largo plazo para un documento de seguro. **Pedir PAdES-LTA** (§6, C18) o asumir una estrategia propia de preservación. |
| C12 | Ambiente de homologación completo… **pero los tres datos concretos vinieron en blanco** (`⟨completar⟩`): URL base, credenciales y certificado de prueba del firmante. La referencia vigente es el OpenAPI en `/docs.json` del propio ambiente | **Nada de la fase 4 puede empezar sin esto.** Es el pedido #1 de la fase 1. |

---

## 3. Cambios que las respuestas fuerzan en el código

Todos son independientes del proveedor: se pueden hacer contra el mock, y **no rompen la demo**.

### 3.1 `SignatureProvider`: el "descargar" no existe

Hoy `src/documentos/servicio.ts:470` (`archivarDocumentosFirmados`) llama a `descargarDocumentosFirmados(idCode100)` de forma diferida y reintentable: si los archivos no están en S3, los vuelve a pedir. Contra el Code100 real eso es **volver a firmar** (C8a) sobre un archivo que además ya no existe del lado del proveedor (C4).

Peor: `Firma` exige `hashSolicitudFirmada` y `hashFipfFirmado`, y el único momento en que esos bytes existen es **la respuesta de `sign-pdf`**. `getSessionId` no devuelve documentos. La secuencia actual —`confirmarResultado` produce la `Firma` con hashes, y después alguien descarga— no es implementable.

**Rediseño necesario del puerto:**

- Un método único que **ejecute el acto de firma una sola vez** y devuelva, en la misma operación, los bytes firmados y sus hashes.
- El adaptador persiste los dos PDF por `ArchivoRepository` **antes** de responder, y cualquier consulta posterior se sirve de lo persistido, nunca del proveedor.
- `confirmarResultado` queda como lo que realmente es: consulta de estado de la sesión (`getSessionId`), y su rama `FIRMADO` deja de ser la que acuña la `Firma`.
- Mantener la atomicidad de la regla #3: los dos documentos en un mismo array `document`, una sola escritura.

### 3.2 Idempotencia propia, y prohibición de reintento automático

- Cerrojo de un solo vuelo por `session_id` / expediente: dos peticiones concurrentes no pueden producir dos `sign-pdf`.
- Ante timeout: **no reintentar**. Hace falta un desenlace nuevo —del tipo `FIRMA_EN_VERIFICACION`— que deje el expediente esperando intervención desde la consola administrativa, con `getSessionId` como fuente de verdad para decidir. Hoy no existe ese camino.
- Antes de cada `sign-pdf`, consultar `getSessionId` y mirar `expirado` (C8b).

### 3.3 Las dos firmas cualificadas no están modeladas

El dominio hoy termina la firma en el cliente. Falta la cadena serial cliente → Interseguros → Alianza (C4/C5), con su propia evidencia por firmante (`session_id`, `cert_info`, fecha, hora) y el hash del PDF resultante de cada paso. Como cada firma cambia los bytes, **los hashes de `Firma` valen para el estado "firmado por el cliente"**, y hacen falta hashes nuevos por cada firma institucional. Decidir si eso vive en `Expediente` como una lista append-only o solo en `EvidenceStore`.

### 3.4 Los relojes

- `venceEn` del expediente = 24 h desde el pago confirmado (dominio actual, fila 41).
- `fecha_expiracion` de Code100 = 24 h desde que el firmante **autoriza** (C7).
- Son distintos y el nuestro manda. Si la persona abre el enlace cerca del vencimiento, la sesión de Code100 puede sobrevivir al expediente: **el corte lo hace el dominio, no el proveedor**.
- Si el enlace caduca sin usarse (TTL de la PSA, pendiente C13), hay que poder emitir una sesión nueva sin recrear el paquete documental — el paquete ya está cerrado y hasheado (regla #4), así que solo se rehace `session-start`.

### 3.5 Envío del enlace y retorno

- El enlace lo manda SeguroLoTengo por el canal verificado (WhatsApp-Modular o SES), no Code100 (C6). Corregir el comentario de `FirmaIniciada.urlActoDeFirma` en `src/ports/signature-provider.ts`.
- `session-start` acepta `redirect_url` como query string y redirige con `?status=success&session_id=…&code=…&state=…`. Hace falta un Route Handler de retorno (`/api/p8/retorno-code100`) que **no confíe en esos parámetros como prueba de firma**: son una señal para consultar `getSessionId`, nada más.
- **Recomendación: no usar iframe.** El `redirect_url` no depende de configuración de `frame-ancestors` en el proveedor, y en un producto mobile-first el iframe de 1000×600 del ejemplo no sirve. Si igual se quiere iframe, hay que entregarles la lista de dominios de homologación y producción (§6).

### 3.6 Documentos

- `nro_odt` = `PROP-<correlativo>` y `FIPF-<correlativo>` (ya existen en el dominio).
- Decidir la posición del sello: omitir `container_sign` (apilado automático, sin superposición entre las tres firmas) o reservar el recuadro en `src/documentos/layout.ts` según `Solicitud.pdf`.
- Asentar en la evidencia el `session_id` junto con los dos hashes SHA-256, como vínculo explícito entre Solicitud y FIPF (sugerencia del propio proveedor en C8d).

### 3.7 Mock y panel de demo

- La palanca "rechazo de Code100" y el botón *Rechazar* del modal simulan algo que **el API real no reporta** (C9). Se mantienen —son útiles para la demo— pero hay que rotularlo en el código y en `docs/ESPECIFICACION_DEMO.md`, para que nadie asuma que existe ese camino en producción.
- El mock debe seguir el contrato nuevo del puerto (§3.1) cuando se rediseñe.

---

## 4. Plan por fases

Cada fase tiene un gate: no se empieza la siguiente sin cerrar la anterior.

### Fase 0 — Decisión de producto y legal (bloqueante)
1. Elevar el hallazgo §1 a Interseguros y Alianza, con las cuatro opciones.
2. Dictamen legal: ¿la firma electrónica simple del cliente, con evidencia propia, satisface la fila 34?
3. Decisión escrita, asentada en este documento.

**Gate:** opción elegida por escrito.

### Fase 1 — Pedidos a Code100 (en paralelo con la fase 0)
1. Credenciales y URL base de homologación + certificado de prueba del firmante (C12 vino en blanco).
2. Descargar el OpenAPI de `/docs.json` y guardarlo en `docs/Integraciones/`.
3. Enviar las consultas nuevas C13–C18 (§6).
4. Entregarles la lista de dominios si finalmente se usa iframe.

**Gate:** credenciales en mano y C13–C18 respondidas.

### Fase 2 — Documentación fuente (no requiere gate previo)
Actualizar lo que hoy dice algo falso (§5). **Antes de tocar código**, según la regla del proyecto.

### Fase 3 — Puerto, dominio y mock (requiere gate 0)
1. Rediseño de `SignatureProvider` (§3.1) + mock + tests de contrato.
2. Idempotencia y desenlace `FIRMA_EN_VERIFICACION` (§3.2).
3. Modelado de las firmas institucionales serializadas (§3.3).
4. Relojes y regeneración de sesión (§3.4).
5. Envío del enlace por canal propio + Route Handler de retorno (§3.5).
6. `nro_odt`, posición del sello, evidencia con `session_id` + hashes (§3.6).

**Gate:** `npm run typecheck && npm run lint && npm test` y la batería E2E en verde, con la demo intacta.

### Fase 4 — Adaptador `live/` (requiere gates 0, 1 y 3)
1. `src/adapters/live/signature-provider.ts`: `auth` con re-auth ante 401, `session-start` con `redirect_url`, `getSessionId`, `sign-pdf` una sola vez.
2. Persistencia inmediata de los PDF firmados y verificación de hashes.
3. Mapeo de errores del Anexo A a `MotivoNoFirmado`, documentando qué no es observable.
4. Validación de los PDF resultantes con un validador PAdES independiente.

### Fase 5 — Certificación y producción
Los ocho pasos que propone Code100 en C12, con dos agregados nuestros: prueba de expiración de sesión y prueba de doble `sign-pdf` **en homologación** (para verificar que el cerrojo de §3.2 lo impide del lado nuestro, ya que del lado de ellos no está impedido).

---

## 5. Documentos a corregir (fase 2)

| Documento | Qué dice hoy | Qué debe decir |
| :---- | :---- | :---- |
| `CLAUDE.md` — contrato de `SignatureProvider` | "el orden de firmas es cliente → Interseguros y Alianza (cualificada, **en paralelo**)" | Las tres firmas se aplican **en serie**; solo la preparación de sesiones puede solaparse (C5). |
| `CLAUDE.md` — "Idempotencia de webhooks (Bancard y Code100)" | Trata los callbacks de Code100 como duplicables | Code100 **no tiene webhooks** (C10). Queda `redirect_url` + polling. La no-idempotencia a cubrir es la de `sign-pdf` (C8a). |
| `src/ports/signature-provider.ts` | "Enlace que Code100 le manda a la persona por el canal elegido" | El enlace lo distribuye SeguroLoTengo (C6). |
| `src/ports/signature-provider.ts` | "El OTP … vive del lado del proveedor" | Depende de la decisión del gate 0: con la opción C, el tercer OTP es nuestro. |
| `docs/ANALISIS_INTEGRACIONES_CODE100_BANCARD.md` §4 | Preguntas abiertas #1, #2, #3 | Respondidas; apuntar a este plan. |
| `docs/ESPECIFICACION_PANTALLAS.md` (P8) | Flujo de firma actual | Ajustar cuando se cierre el gate 0 — es el documento que manda sobre la pantalla. |
| `docs/ESPECIFICACION_DEMO.md` | Palanca de rechazo de Code100 | Aclarar que el rechazo del firmante **no es observable** en el API real (C9). |
| Matriz de cumplimiento, fila 37 | "cliente primero; Interseguros y Alianza después, **en paralelo**" | Proponer corrección a serie. La fila misma dice "No existe un artículo que imponga ese orden", así que es cambio de diseño, no de norma. |

---

## 6. Consultas nuevas a Code100

Redactadas y listas para enviar en **`docs/CONSULTAS_CODE100_SEGUNDA_RONDA.md`** (C13–C31), que continúa la numeración de la primera ronda. Resumen de lo que cubren:

| Bloque | Consultas | Tema |
| :---- | :---- | :---- |
| 1 | C13–C20 | **Propuesta de desarrollo**: firma no cualificada de un solo uso por API, alimentada con nuestras evidencias de identidad. Reabre la opción B de §1.2 en mejores términos que los de C1. |
| 2 | C21–C22 | Firma desatendida para las firmas institucionales de Interseguros y Alianza (riesgo §7). |
| 3 | C23–C25 | TTL del enlace sin usar, vigencia efectiva de 24 h y latencia real de `sign-pdf`. |
| 4 | C26–C27 | Idempotencia y catálogo de estados, incluido el rechazo del firmante. |
| 5 | C28–C29 | Elevación a PAdES-LT/LTA y tratamiento de los datos (la Solicitud lleva declaraciones de salud). |
| 6 | C30–C31 | Credenciales de homologación que quedaron en blanco, contrato, disponibilidad y continuidad. |

---

## 7. Riesgos abiertos

| Riesgo | Severidad | Mitigación |
| :---- | :---- | :---- |
| El cliente no puede firmar con Code100 (§1) | **Crítica** | Gate 0. Sin decisión, la fase 3 no arranca. |
| Las firmas institucionales podrían requerir intervención humana por expediente (C14) | **Alta** | Consulta C14 antes de diseñar la cadena de §3.3. |
| `sign-pdf` puede tardar hasta 10 minutos y no entra en el timeout de la función SSR de Amplify | Alta | Medir con C15; si hace falta, sacar la llamada del ciclo de petición (cola o proceso aparte). Afecta la arquitectura, no solo el adaptador. |
| Doble firma por reintento de red (C8a) | Alta | Cerrojo de un solo vuelo + prohibición de reintento automático (§3.2) + prueba explícita en certificación. |
| PAdES-T sin información de revocación (C11) | Media | C18; si no se eleva, estrategia propia de preservación (guardar OCSP/CRL al momento de firmar). |
| El rechazo del firmante no es observable (C9) | Media | Acordar catálogo de estados en la certificación; hasta entonces, el rechazo se manifiesta como expiración. |
| Custodia de los PDF entre firmas es nuestra (C4) | Baja | Ya resuelto: `ArchivoRepository` sobre S3. |

---

## 8. Qué no cambia

La demo actual sigue funcionando igual: los adaptadores `mock` no dependen de nada de esto, y ninguna de las tareas de arriba toca el recorrido P0–P9 que se demuestra hoy. El rediseño del puerto (§3.1) cambia una interfaz interna y su mock, con los mismos tests de contrato en verde.
