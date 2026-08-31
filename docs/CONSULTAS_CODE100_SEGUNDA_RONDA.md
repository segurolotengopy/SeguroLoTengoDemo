# Segunda ronda de consultas a Code100 (C13–C31)

**Fecha de redacción:** 2026-08-20
**Contexto:** complementan las respuestas de Code100 a C1–C12 (`docs/Integraciones/Code100 - Respuestas C1 a C12.md`) y los pendientes de `docs/PLAN_ACCION_CODE100.md`.
**Numeración:** continúa la serie original, para que cada respuesta siga siendo trazable una a una.

El eje de esta ronda es el **bloque 1**: una propuesta concreta de desarrollo para que Code100 provea firma electrónica **no cualificada de un solo uso por API**, a partir de las evidencias de identidad que SeguroLoTengo ya produce. De prosperar, reabre la opción B del informe a la Gerencia y sería la salida más limpia al bloqueo de C1. Los bloques 2 a 6 son los pendientes técnicos que quedaron de la primera ronda.

---

## Correo — Code100 (segunda ronda)

**Para:** soporte técnico / equipo de integraciones de Code100
**Asunto:** Interseguros S.A. (SeguroLoTengo) — Consultas complementarias C13–C31 y propuesta de firma no cualificada de un solo uso por API

Estimado equipo de Code100:

Agradecemos las respuestas a nuestras consultas C1–C12: el nivel de detalle nos permitió cerrar varios puntos de diseño y ajustar nuestra arquitectura, en particular en multifirma, semántica de `sign-pdf` y manejo de sesiones.

De esas respuestas surge un punto que condiciona todo nuestro proyecto. Conforme a C1, Api Flow firma exclusivamente con certificado cualificado, y nuestro cliente final es una persona física sin certificado, que contrata un seguro de vida en pocos minutos desde su celular. Exigirle un certificado previo hace inviable el canal digital.

Antes de resolverlo por fuera de su plataforma, queremos plantearles una alternativa que nos parece de interés mutuo: **que Code100 desarrolle un servicio de firma electrónica no cualificada de un solo uso, consumible por API, apoyado en las evidencias de identificación que nuestro sistema ya produce y conserva**. El modelo que proponemos está descripto en el **Anexo A**, y el detalle de las evidencias que podemos entregar por operación, en el **Anexo B**.

Les agradeceremos responder por escrito referenciando la numeración (C13, C14, …).

---

### Bloque 1 — Propuesta: firma no cualificada de un solo uso por API

- **C13.** ¿Consideran viable desarrollar el servicio descripto en el Anexo A —recibir por API los documentos a firmar junto con las evidencias de identificación del titular, y devolver los PDF firmados—, ya sea como desarrollo a medida para Interseguros o como producto propio? ¿Es algo que ya hayan implementado para otro cliente?

- **C14.** ¿Cómo lo instrumentarían jurídica y técnicamente? Vemos al menos tres modelos posibles y nos interesa cuál recomiendan y por qué:
  **(i)** emisión de un **certificado de un solo uso** a nombre del titular, sustentada en las evidencias que remitimos, y firma inmediata con ese certificado;
  **(ii)** **sello electrónico de Code100** (o de Interseguros) aplicado al documento, acompañado de un acta de evidencias que atribuya la manifestación de voluntad al cliente;
  **(iii)** otro esquema que ustedes propongan.

- **C15.** ¿Qué evidencias de identificación exigirían, en qué formato y con qué requisitos mínimos de calidad? En el Anexo B detallamos lo que hoy podemos entregar por operación (imágenes de la cédula, resultado biométrico con puntuación, umbral y versión de modelo, lectura MRZ, consulta al registro civil, OTP verificados, IP, dispositivo y huellas SHA-256 de los documentos). Agradeceremos que nos indiquen qué de eso les resulta suficiente y qué faltaría.

- **C16.** ¿Cómo se repartiría la responsabilidad por la identificación? ¿Interseguros queda como responsable de la verificación y Code100 la toma como declarada, o ustedes la revalidan? ¿Exigirían auditoría, certificación o revisión previa de nuestro proceso de identidad antes de habilitar el servicio?

- **C17.** ¿Qué entregarían por cada operación? Concretamente: nivel de firma del PDF resultante, **acta de evidencias descargable** (que hoy, conforme a C3, no existe para el flujo cualificado), identificador verificable de la firma, y qué mostraría el panel de firma del documento (nombre del firmante, referencia del acto, sello de tiempo). ¿El resultado sería verificable con un validador PAdES estándar?

- **C18.** ¿Cómo sería la forma de la API? Nos interesa saber si el servicio podría ser **síncrono y de una sola llamada** —documentos + evidencias entran, PDF firmados salen—, si admitiría **clave de idempotencia** (ver C26), y cuáles serían los límites de tamaño, la cantidad de documentos por llamada y la latencia esperada. Nuestro caso requiere firmar la Solicitud de Seguro y el FIPF **en un mismo acto**, condición que no es negociable de nuestro lado.

- **C19.** ¿Cuál sería el plazo estimado de desarrollo y el modelo comercial: costo del desarrollo, costo por firma, mínimos mensuales y vigencia? ¿Requeriría modificar el contrato marco o se instrumentaría como anexo?

- **C20.** Desde su experiencia como prestador, ¿ven algún impedimento regulatorio para operar ese servicio en Paraguay en la modalidad no cualificada, en el marco de la Ley 6822/2021? Nuestra consulta legal corre por separado; nos interesa conocer su lectura como prestador de servicios de confianza.

---

### Bloque 2 — Firmas de Interseguros y Alianza

- **C21.** Conforme a C4 y C5, cada firmante se autentica en la PSA y autoriza el uso de su clave. Nuestras firmas institucionales (Interseguros y Alianza) ocurren **en cada emisión de póliza**. ¿Existe **firma desatendida** para personas jurídicas —sello electrónico, certificado en HSM, autorización de vigencia prolongada o API de firma automatizada— que evite una intervención humana por expediente? Es, junto con C1, el punto que más condiciona nuestro modelo operativo.

- **C22.** Si esa modalidad no existe hoy, ¿cuál es la operativa que recomiendan para volumen? En particular: ¿una misma autorización del firmante puede cubrir **varias llamadas a `sign-pdf`** o varios documentos a lo largo de la vigencia de la sesión, de modo de firmar por lotes en vez de expediente por expediente?

---

### Bloque 3 — Sesión, enlace y tiempos

- **C23.** C7 indica que el TTL del **enlace de autorización antes de ser utilizado** lo define la PSA y queda fuera de este API. Como la distribución del enlace es nuestra (C6) y el cliente puede abrirlo muchas horas después de recibirlo, necesitamos ese valor: ¿cuál es, es configurable, y cómo detectamos que un enlace caducó sin haber sido usado?

- **C24.** ¿Nos confirman que la vigencia de sesión quedará configurada en 86.400 s tanto en homologación como en producción? Y, dado que el plazo corre **desde la autorización** y no desde la creación de la sesión: si el cliente autoriza cuando ya transcurrieron 23 horas de nuestro propio plazo de 24, la sesión seguiría vigente del lado de ustedes mientras que del nuestro ya venció. ¿Existe forma de fijar un vencimiento absoluto de sesión, o el corte debe hacerlo íntegramente nuestra aplicación?

- **C25.** ¿Cuál es la **latencia típica y el percentil 95** de `sign-pdf` para dos PDF de menos de 1 MB? El máximo de 10 minutos que indica C8c excede el presupuesto de tiempo de nuestra plataforma. ¿Existe o podría existir un modo asincrónico (aceptación inmediata más notificación o consulta posterior) para los casos que superen ese tiempo?

---

### Bloque 4 — Robustez operativa

- **C26.** Conforme a C8a, `sign-pdf` no es idempotente y un reintento produce una segunda firma. ¿Pueden incorporar una **clave de idempotencia** por llamada, o que **la sesión se consuma tras la primera firma exitosa**? Hoy el control queda enteramente de nuestro lado, y una falla de red puede derivar en un documento firmado dos veces.

- **C27.** Sobre el catálogo de estados que ofrecieron acordar en C9: nos resultan indispensables **(a)** que el **rechazo del firmante** sea consultable como estado, y **(b)** un **código de error específico para sesión vencida**, que hoy llega como mensaje genérico (C8b). ¿Pueden comprometerlos como parte del proceso de certificación, y con qué plazo?

---

### Bloque 5 — Formato, conservación y tratamiento de datos

- **C28.** Solicitamos formalmente elevar la política de firma a **PAdES-LT o LTA**, conforme al ofrecimiento de C11. Se trata de documentos de un seguro de vida, cuyo reclamo puede producirse muchos años después de la contratación. ¿En qué plazo podrían aplicarlo y tiene algún impacto en costo o en el tamaño del documento?

- **C29.** Sobre el tratamiento de los datos: la Solicitud de Seguro contiene **declaraciones de salud** del titular y el FIPF, sus datos de identificación. Necesitamos conocer **(a)** el plazo de retención de documentos y evidencias en su infraestructura, **(b)** el país y el proveedor de nube donde se procesan y almacenan, **(c)** los subencargados que intervienen, **(d)** el cifrado en tránsito y en reposo, y **(e)** si suscriben acuerdo de confidencialidad y de tratamiento de datos. Adicionalmente: **¿admiten alguna modalidad de firma remota en la que reciban únicamente el hash del documento** y devuelvan la estructura de firma para que nosotros la incorporemos, de modo que el documento completo no salga de nuestra infraestructura?

---

### Bloque 6 — Ambiente, contrato y continuidad

- **C30.** En la respuesta a C12 quedaron en blanco los tres datos del ambiente de homologación: **URL base, usuario y contraseña del comercio, y certificado de prueba del firmante** (con indicación de quién lo provee y cómo se obtiene). Es lo que necesitamos para comenzar. Asimismo: ¿nos confirman que `/docs.json` del ambiente es la especificación vigente, y nos indican si finalmente requieren la lista de dominios para `frame-ancestors`, en caso de que optemos por el embebido en iframe en lugar de `redirect_url`?

- **C31.** Para el contrato: ¿qué **disponibilidad** comprometen, cuáles son las ventanas de mantenimiento, los canales y tiempos de respuesta de soporte, y los contactos de escalamiento? ¿Qué plan de continuidad existe si el servicio no está disponible en el momento en que un cliente intenta firmar? Es relevante porque, en nuestro proceso, el cobro ocurre antes de la firma y una indisponibilidad prolongada obliga a devolver el dinero.

Quedamos a disposición para una reunión técnica, que en el caso del bloque 1 nos parece el camino más práctico. Desde ya, muchas gracias.

Atentamente,

[Nombre y apellido]
Equipo técnico — SeguroLoTengo (operador tecnológico AAB1)
Interseguros S.A.
[teléfono de contacto]

---

## Anexo A — Modelo propuesto de firma no cualificada de un solo uso

Secuencia por operación, tal como la imaginamos. Los pasos 1 a 4 ya están implementados y en funcionamiento en nuestra plataforma.

| # | Paso | Responsable |
| :---- | :---- | :---- |
| 1 | Verificación de canales: OTP al celular y OTP al correo, independientes entre sí | SeguroLoTengo |
| 2 | Captura de cédula (frente y dorso) y selfie, con prueba de vida, todo desde la cámara del dispositivo | SeguroLoTengo |
| 3 | Verificación biométrica: coincidencia facial contra el retrato del documento, lectura del MRZ y cruce de datos; cuando corresponde, consulta al registro civil | SeguroLoTengo |
| 4 | Cierre de la Solicitud de Seguro y el FIPF, cálculo de SHA-256 de cada uno y registro del correlativo común | SeguroLoTengo |
| 5 | Manifestación de voluntad del titular: aceptación explícita del contenido de ambos documentos, más un tercer OTP específico del acto de firma | SeguroLoTengo *(o Code100, según el modelo que se adopte en C14)* |
| 6 | **Llamada única a la API de Code100** con los dos PDF y el paquete de evidencias del Anexo B | SeguroLoTengo → Code100 |
| 7 | Firma de ambos documentos en un mismo acto y devolución de los PDF firmados, más el acta de evidencias | Code100 |
| 8 | Archivo de los PDF firmados y de la constancia, y verificación de que las huellas coinciden | SeguroLoTengo |
| 9 | Firmas cualificadas de Interseguros y de Alianza, en serie, sobre los documentos ya firmados por el cliente | Code100 (flujo actual de Api Flow) |

Dos condiciones nuestras que no son negociables, por regla de negocio y por la matriz de cumplimiento del proyecto: **la Solicitud y el FIPF se firman en un solo acto o no se firma ninguno**, y **los documentos se cierran y hashean antes de habilitar la firma**.

## Anexo B — Evidencias disponibles por operación

| Evidencia | Detalle de lo que podemos entregar |
| :---- | :---- |
| Imágenes del documento | Frente y dorso de la cédula, capturados con la cámara del dispositivo. El origen de cada captura (cámara o archivo) queda registrado. |
| Lectura del documento | Campos leídos por OCR con confianza mínima exigida de 90 sobre 100; lectura del MRZ del dorso (norma ICAO Doc 9303, formato TD1) con verificación de sus dígitos de control y cruce contra el frente de número de cédula, fecha de nacimiento y sexo. |
| Registro civil | Cuando el documento no tiene MRZ, consulta a la fuente oficial por número de cédula, con la referencia de la consulta registrada como evidencia propia. |
| Rostro | Selfie con prueba de vida (umbral 80 sobre 100) y coincidencia facial contra el retrato del documento con **umbral 99 sobre 100**, el criterio de caso sensible. |
| Trazabilidad de cada decisión biométrica | Puntuación cruda, umbral efectivamente aplicado, versión del modelo del proveedor y versión de nuestra política de identidad (identificador versionado, hoy `IDP-2026-08-13`). |
| Canales verificados | Celular y correo electrónico, cada uno validado con su propio código de un solo uso: 6 dígitos, vigencia de 5 minutos, máximo 3 intentos. Se conserva únicamente el hash del código, nunca el código en claro. |
| Contexto del acto | Fecha, hora, dirección IP, dispositivo, identificador de sesión, versión de los textos aceptados y resultado de cada paso, en un registro que no admite sobrescritura ni borrado. |
| Documentos | Huella SHA-256 de la Solicitud y del FIPF, calculadas antes de habilitar la firma, con correlativo común y prefijos distintos (`PROP-…` y `FIPF-…`). |

Podemos entregar este paquete en el formato que definan (JSON con las imágenes en base64, o referencias a URL firmadas de descarga temporal), y estamos dispuestos a ajustar umbrales o agregar controles si su análisis lo requiere.
