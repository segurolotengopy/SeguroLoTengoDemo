# **Api Flow — Respuestas a las consultas C1 a C12**

**Destinatario:** Equipo técnico de Interseguros  
**Referencia:** Documentación Api Flow (POST /signature/auth, GET /signature/session-start, POST /signature/getSessionId, POST /signature/sign-pdf)  
**Caso de uso:** Firma por el cliente de Solicitud de Seguro \+ FIPF en un único acto, más las firmas cualificadas de Interseguros y Alianza.  
Estimados: respondemos punto por punto respetando la numeración utilizada, para que puedan trazar cada respuesta en su documentación técnica.

## **Tipo de firma del cliente final**

### **C1**

**Consulta.** El documento Api Flow describe la autenticación del firmante contra la PSA (/v0/oauth/authorize) y el ejemplo de getSessionId devuelve un cert\_info correspondiente a un "CERTIFICADO CUALIFICADO DE FIRMA ELECTRÓNICA". El cliente final es una persona física sin certificado preexistente, que debe firmar con firma electrónica no cualificada en los términos de la Ley 6822/2021. ¿La plataforma soporta este tipo de firma para el cliente? ¿Se realiza con los mismos endpoints del Api Flow o existe un flujo/documentación distinta?

**No.** Api Flow firma exclusivamente con certificado cualificado. No ofrecemos hoy firma electrónica no cualificada para el firmante.  
El flujo está construido íntegramente sobre ese supuesto: session-start abre una autorización OAuth contra el prestador de servicios de confianza, el firmante se autentica y autoriza el uso de **su** clave, y sign-pdf firma con la sesión resultante. De ahí que el cert\_info del ejemplo corresponda a un certificado cualificado: es la única modalidad que el servicio contempla. Para operar con Api Flow, el cliente final debe contar con un certificado cualificado vigente.  
No existe un flujo alternativo ni documentación complementaria para firma no cualificada.

### **C2**

**Consulta.** De soportarse: ¿qué requisitos de identificación o enrolamiento tiene el firmante no cualificado? ¿Es posible integrarlo con la verificación de identidad que nuestro proceso ya realiza (OCR de cédula \+ verificación biométrica), o Code100 ejecuta su propia verificación? ¿Contempla la emisión de un certificado de único uso?

No aplica, conforme a lo respondido en C1. Al no ofrecerse firma no cualificada, no hay proceso de enrolamiento asociado, no se contempla la integración con verificación de identidad de terceros para este fin, y no se emiten certificados de único uso a través de Api Flow.  
La identificación del firmante queda cubierta por el proceso de emisión del certificado cualificado que él ya posee, ejecutado por Code100.

### **C3**

**Consulta.** ¿Qué evidencias genera el acto de firma no cualificada (OTP, sello de tiempo, dirección IP, trazas de auditoría) y en qué formato se entregan al comercio para su resguardo probatorio?

No aplica en los términos consultados, conforme a C1. A título informativo, describimos las evidencias que sí genera el acto de firma con certificado cualificado:

* **Sello de tiempo.** El PDF firmado incorpora un sello de tiempo emitido por nuestra autoridad de sellado (política PAdES-T), que fija de manera oponible el momento de la firma. Es la evidencia principal y viaja dentro del propio documento.  
* **Datos del firmante.** El servicio devuelve en cert\_info los datos del certificado utilizado —emisor, titular, número de documento y período de vigencia—, que identifican al firmante en el acto.  
* **Trazas del servicio.** Se registra por sesión el session\_id, el comercio que la originó, los datos del certificado, la marca de creación de la sesión y su fecha de expiración, más una traza por cada documento firmado.

No se registran a nivel de aplicación la dirección IP ni el agente de usuario del firmante, y no se emite un acta de evidencias descargable: el resguardo probatorio se apoya en el propio PDF firmado, que es autocontenido y verificable de forma independiente.

## **Multifirma y orden de firmas**

### **C4**

**Consulta.** Sobre los mismos dos PDF deben aplicarse, después de la firma del cliente (aunque podría ser antes, y que Code100 resguarde los PDF firmados o que se los remitamos nosotros), las firmas cualificadas de dos personas jurídicas (Interseguros y Alianza). ¿Las firmas sucesivas se aplican por actualización incremental del PDF conservando la validez de las firmas anteriores? ¿Cada firmante requiere su propia sesión (session-start) y su propia llamada a sign-pdf? ¿Cómo se referencia en la siguiente firma un documento ya firmado?

* **Actualización incremental:** sí. Cada firma sucesiva se aplica como *incremental update* del PDF conforme a PAdES; las firmas anteriores se conservan íntegras y verificables. Es un escenario ya probado sobre nuestra plataforma.  
* **Sesión por firmante:** sí. Cada firmante requiere su propio GET /signature/session-start, su propia autorización en la PSA y su propia llamada a POST /signature/sign-pdf con ese session\_id. La sesión queda ligada al certificado autorizado en esa autenticación.  
* **Referencia al documento ya firmado:** no existe repositorio de documentos ni identificador *server-side*. sign-pdf recibe el PDF en base64, lo firma, lo devuelve en documents\_signeds\[\].pdf\_signed y elimina el archivo temporal. Para la segunda y la tercera firma se debe enviar nuevamente el base64 **del PDF ya firmado** devuelto por la llamada anterior.  
* **Custodia:** no ofrecemos resguardo de los documentos firmados. La custodia entre firmas y el archivo final quedan del lado de Interseguros. Para correlacionar cada PDF firmado con su documento de origen pueden utilizar el campo nro\_odt, que devolvemos sin alterar.  
* **Orden indistinto:** técnicamente da lo mismo que el cliente firme primero o que lo hagan antes Interseguros y Alianza; en ambos casos el resultado es un PDF con tres firmas válidas. Sí conviene planificar la posición visual de cada sello (container\_sign y page\_number, ver C8e) para que no se superpongan.

### **C5**

**Consulta.** En este caso de firma posterior, ¿es posible garantizar el orden de firmas (cliente primero; luego las dos cualificadas, que pueden ser en paralelo)? ¿La plataforma ofrece alguna orquestación de ese orden o debe controlarla nuestra aplicación?

La orquestación debe controlarla la aplicación de Interseguros. La plataforma no modela sobres, flujos ni firmantes en orden: cada llamada a sign-pdf es una operación independiente sobre el binario que se le envía. El orden se garantiza encadenando las llamadas, tomando la salida de una como entrada de la siguiente.  
**Precisión sobre el paralelismo.** Las dos firmas cualificadas pueden *prepararse* en paralelo —ambos firmantes pueden autenticarse y tener su sesión abierta al mismo tiempo—, pero **la aplicación de las firmas sobre el mismo archivo debe serializarse**. Si Interseguros y Alianza firman en paralelo partiendo del mismo PDF base, se obtienen dos archivos divergentes, cada uno con una sola firma, y no existe forma de fusionarlos: hay que descartar uno y volver a firmar. La secuencia correcta es cliente → Interseguros → Alianza (o el orden que definan), tomando en cada paso el PDF devuelto por el paso anterior.  
Ver el Anexo B para la secuencia completa recomendada.

## **Sesión y enlace de firma**

### **C6**

**Consulta.** ¿El envío del enlace de firma al firmante (por WhatsApp o correo electrónico) lo realiza Code100, o es responsabilidad del comercio distribuir el authUrl? El documento solo muestra su embebido en un iframe.

La distribución es responsabilidad del comercio. El servicio no envía WhatsApp ni correo electrónico: no integra mensajería.  
session-start devuelve auth (la URL de autorización) y el session\_id. Esa URL puede embeberse en un iframe, abrirse en una ventana o distribuirse por el canal que Interseguros prefiera. Dos precisiones operativas:

* **Parámetro redirect\_url.** session-start lo acepta como *query string*. Al completarse la autorización, el firmante es redirigido a esa URL con ?status=success\&session\_id=…\&code=…\&state=…. Es el mecanismo recomendado y no depende del iframe.  
* **Si se opta por el iframe.** Debemos incorporar los dominios de Interseguros a la política frame-ancestors del servicio en cada ambiente; hasta que se realice esa configuración, el navegador bloqueará el embebido desde otro dominio. Les solicitamos la lista de dominios de homologación y producción.

### **C7**

**Consulta.** ¿La vigencia de la sesión de firma es configurable? Nuestro requisito regulatorio es de 24 horas. Asimismo: ¿cuál es el TTL del token de POST /signature/auth y el comportamiento esperado ante su expiración?

Sí, la vigencia de la sesión de firma es configurable, y **admite las 24 horas** que requieren. Conviene distinguir tres relojes, porque suelen confundirse en un único requisito:

| Reloj | Valor actual | Configurable | Al expirar |
| :---- | :---- | :---- | :---- |
| **Token JWT del comercio** POST /signature/auth | 60.000 s ≈ 16 h 40 min | Sí | HTTP 401 con Failed to authenticate token: TokenExpiredError: jwt expired. No hay *refresh token*: se vuelve a autenticar contra el mismo endpoint. |
| **Sesión de firma en la PSA** session-start → sign-pdf | 3.600 s (1 hora) | Sí, hasta 24 h | La firma es rechazada por el prestador. Debe iniciarse una nueva sesión con session-start. |
| **Enlace de autorización** antes de ser utilizado | Definido por la PSA | Fuera de este API | El enlace deja de ser válido; se genera uno nuevo con session-start. |

El plazo que rige "cuánto tiempo tiene el firmante para firmar" es el segundo, y se cuenta **desde que el firmante autoriza**, no desde la creación de la sesión. Su valor efectivo queda registrado en el campo fecha\_expiracion que devuelve getSessionId.  
Para su integración configuraremos la vigencia en 24 horas (86.400 s) en el ambiente de homologación y en producción.

## **Semántica de sign-pdf**

### **C8 (a)**

**Consulta.** Si sign-pdf se invoca dos veces con el mismo code/state/session\_id (por ejemplo, por un reintento de red), ¿la segunda llamada falla, devuelve el mismo resultado o produce una segunda firma?

**Produce una segunda firma.** La llamada no es idempotente: mientras la sesión siga vigente, cada invocación firma de nuevo.  
sign-pdf se identifica únicamente por session\_id más el token del comercio; code y state no son parámetros de esta llamada. La sesión no se consume ni se bloquea al firmar, y el servicio no deduplica peticiones. En consecuencia:

* Si se reenvía el **PDF original**, se obtiene un segundo PDF firmado: un archivo distinto del primero, igualmente válido.  
* Si se reenvía el **PDF ya firmado**, se le agrega una segunda firma del mismo firmante.

Recomendación para la integración: ante un *timeout*, no reintentar automáticamente. La confirmación autoritativa de la firma es la propia respuesta síncrona de sign-pdf, que ya contiene los PDF firmados; si esa respuesta no llegó, conviene resolver el caso del lado del comercio antes de repetir la llamada.

### **C8 (b)**

**Consulta.** ¿Qué respuesta devuelve ante una sesión expirada?

Hoy no existe un código de error específico para esta condición. El comportamiento observable es:

* **Sesión inexistente:** HTTP 200 con {"status":"error","data":"La sesión de firma ya fue utilizada"}.  
* **Sesión existente pero vencida:** la firma es rechazada por el prestador y el servicio responde HTTP 400 con el mensaje genérico {"status":"error","message":"Ocurrió un error, contacte con el administrador"}; el detalle queda en la traza del servidor.  
* **Certificado del firmante vencido:** HTTP 400 con "El certificado ha expirado: dd/mm/aaaa hh:mm:ss".

La vía fiable para distinguir "sesión expirada" de "error del servicio" es consultar getSessionId: su campo expirado responde exactamente esa pregunta antes de intentar firmar. Ver C9 y el Anexo A.

### **C8 (c)**

**Consulta.** ¿Existen límites de tamaño por PDF y de cantidad de documentos por llamada?

Los límites que comprometemos para su integración son:

* **10 MB por PDF**  
* **10 documentos por llamada**

Ambos cubren holgadamente el caso de Solicitud de Seguro \+ FIPF. Debe considerarse que la codificación base64 incrementa el tamaño transmitido en aproximadamente un 33 % respecto del archivo original, por lo que el cuerpo de una llamada con dos documentos de 10 MB ronda los 27 MB.  
El tiempo máximo de respuesta del servidor es de 10 minutos, holgado para el volumen previsto. No se aplica límite de tasa de peticiones.

### **C8 (d)**

**Consulta.** ¿Pueden confirmar que todos los documentos enviados en el array document de una misma llamada quedan firmados en un único acto jurídico?

Confirmado: todos los documentos de una misma llamada se firman con la misma sesión, derivada de una única autenticación y una única autorización del firmante. No hay una segunda intervención del firmante entre un documento y el otro.  
Precisión técnica, relevante para su documentación: cada PDF recibe su **propia firma PAdES individual**; no se genera un contenedor único que agrupe ambos documentos. El vínculo entre la Solicitud de Seguro y el FIPF como manifestación única de voluntad está dado por la sesión común —un mismo session\_id, una sola autorización, una sola operación—. Si su análisis jurídico requiere que ese vínculo conste de forma explícita, sugerimos que su registro interno asiente el session\_id junto con el hash SHA-256 de ambos documentos, que ustedes ya calculan antes de habilitar la firma.

### **C8 (e)**

**Consulta.** ¿Cuáles son las unidades y la semántica exacta de container\_sign (left, right, bottom, height) y de nro\_odt?

Las cuatro medidas de container\_sign están expresadas en **centímetros**, tomadas desde los bordes de la página, con origen en el borde inferior izquierdo.  
\+-------------------------------+   \<-- página (page\_number)  
|                               |  
|                               |  
|                               |  
|                               |  
|   \+-----------------------+   |  \-+  
|   |   recuadro de firma   |   |   | height  
|   \+-----------------------+   |  \-+  
|                               |   |  
|                               |   | bottom  
\+-------------------------------+  \-+  
 |\_\_\_|                       |\_\_\_|  
  left                        right

| Campo | Semántica |
| :---- | :---- |
| left | Margen desde el borde izquierdo de la página hasta el lado izquierdo del recuadro. |
| right | Margen desde el borde derecho de la página hasta el lado derecho del recuadro. El ancho no se envía: se deriva como ancho de página − left − right. |
| bottom | Distancia desde el borde inferior de la página hasta la base del recuadro. |
| height | Alto del recuadro. Ocupa verticalmente desde bottom hasta bottom \+ height. |
| page\_number | Entero. \-1 indica la última página y es el valor por defecto; 1 es la primera. Se admite por documento o a nivel de la llamada. |
| nro\_odt | Identificador libre del comercio, opcional. El firmador no lo interpreta ni lo valida: lo devuelve tal cual en documents\_signeds\[\].nro\_odt para correlacionar cada PDF firmado con su documento de origen. Es el campo indicado para distinguir Solicitud de Seguro y FIPF dentro de una misma llamada. |

Si se omite container\_sign, el sello se ubica automáticamente dentro de un área con márgenes de 1,5 cm y 7 cm de alto, con recuadros de 7 × 2 cm y 1 cm de separación entre firmas. Es la opción recomendada cuando no hay una posición exigida por el diseño del formulario, porque apila las firmas sucesivas sin superponerlas — útil para el escenario de tres firmas de C4.

## **Estados, errores y notificaciones**

### **C9**

**Consulta.** ¿Disponen del catálogo completo de estados y códigos de error de getSessionId y sign-pdf (rechazo del firmante, cancelación, expiración, error interno)? En el ejemplo del documento, getSessionId devuelve simultáneamente "status": true y "expirado": true; agradeceremos aclarar la semántica de ambos campos y de fecha\_expiracion.

Aclaramos primero la semántica consultada, que es la fuente de la confusión: status no describe el estado del documento.

| Campo | Semántica |
| :---- | :---- |
| status | Booleano. Indica que **el firmante completó la autorización** en la PSA y el firmador obtuvo la sesión de firma. false o nulo significa que el enlace aún no fue utilizado o que la autorización no se completó. **No** indica que el documento haya sido firmado. |
| fecha\_expiracion | Instante de expiración de la sesión de firma, informado por el prestador al completarse la autorización. Formato YYYY-MM-DD HH:mm:ss en la zona horaria configurada en el servicio. |
| expirado | Booleano calculado en el momento de la consulta: ahora ≥ fecha\_expiracion. |

Por eso el ejemplo del documento muestra ambos campos en true, y es una combinación coherente: **el firmante autorizó, pero la ventana para firmar ya venció**. La acción correcta ante ese estado es iniciar una nueva sesión con session-start. Una consulta con un session\_id inexistente devuelve HTTP 200 con data: \[\].  
Sobre el catálogo: el conjunto de respuestas vigentes de ambos endpoints se detalla en el **Anexo A**. No existe hoy una máquina de estados de negocio con la granularidad que plantean (pendiente / autorizado / firmado / rechazado / cancelado / expirado): en particular, el rechazo del firmante en la PSA no se refleja como estado consultable. Si esa granularidad es necesaria para su integración, podemos acordar el catálogo y su alcance como parte del proceso de certificación descrito en C12.

### **C10**

**Consulta.** ¿Ofrecen webhooks/callbacks al completarse, rechazarse o expirar la firma, o el único mecanismo es la consulta periódica de getSessionId? De existir webhooks: ¿cómo se autentica/firma el mensaje y cuál es la política de reintentos?

No ofrecemos webhooks. Los mecanismos disponibles son tres, y para "firma completada" el primero suele ser suficiente:

1. **Respuesta síncrona de sign-pdf.** Es la confirmación autoritativa de la firma y ya devuelve los PDF firmados. En su caso de uso —el cliente firma en línea al cierre de la contratación— no se requiere notificación asincrónica para el camino feliz.  
2. **Redirección a redirect\_url.** Al completarse la autorización, con status, session\_id, code y state.  
3. **Consulta a getSessionId.** Para conocer el estado de la sesión y su expiración.

Los caminos alternativos —firma rechazada o sesión expirada— se detectan hoy únicamente por consulta.

## **Formato, verificación y ambiente**

### **C11**

**Consulta.** ¿Qué estándar de firma se aplica al PDF resultante (PAdES B/T/LT/LTA), incluye sellado de tiempo (TSA) y ofrecen un servicio de verificación de documentos firmados? ¿Qué garantías de validez a largo plazo tiene el documento?

El PDF resultante es **PAdES-T**: firma PAdES con sello de tiempo. Cada firma incorpora un sello emitido por la autoridad de sellado de tiempo de Code100, tanto en homologación como en producción.  
Sobre la validez a largo plazo: el nivel aplicado es B-T, no LT ni LTA. Esto significa que el documento no embebe la información de revocación (OCSP/CRL) ni un sello de archivo, y que una validación futura depende de que el validador pueda obtener esa información en el momento de la verificación. El sello de tiempo sí acredita de forma permanente que la firma existía en un instante determinado. Elevar la política a PAdES-LT o LTA es un cambio de configuración del servicio; si su política de conservación documental lo requiere, podemos evaluarlo como parte de la implementación.  
No exponemos un endpoint de validación en este API. Los documentos firmados son autocontenidos y pueden verificarse con cualquier validador PAdES estándar.

### **C12**

**Consulta.** Solicitamos credenciales del ambiente de homologación, datos de prueba, límites de tasa aplicables y la descripción del proceso de certificación y paso a producción. Si existe una versión más reciente del documento Api Flow, o documentación complementaria (multifirma, firma no cualificada, webhooks), agradeceremos que nos la remitan.

**Ambiente de homologación.** Disponemos de un ambiente completo y operativo, con raíz de confianza de prueba, servicio de sellado de tiempo de prueba y autoridad certificadora de prueba.

* URL base: ⟨completar⟩  
* Usuario y contraseña del comercio (credenciales de POST /signature/auth): ⟨completar; se remiten por canal seguro⟩  
* Certificado de prueba del firmante: ⟨completar: quién lo provee y cómo se obtiene⟩

**Documentación.** La especificación OpenAPI vigente de los cuatro endpoints está publicada en el propio ambiente, en las rutas /docs (interfaz navegable) y /docs.json (especificación descargable). Es la referencia actualizada frente al documento que recibieron. No existe documentación complementaria adicional: la firma no cualificada no se ofrece (C1) y los webhooks tampoco (C10); el escenario de multifirma queda cubierto por este documento y por el Anexo B.  
**Límites de tasa.** No se aplica límite de tasa de peticiones. Los límites comprometidos de tamaño y cantidad de documentos son los indicados en C8c.  
**Proceso de certificación y paso a producción propuesto:**

1. Alta del comercio en homologación y entrega de credenciales por canal seguro.  
2. Registro de los dominios de Interseguros para CORS y para el embebido en iframe (ver C6).  
3. Configuración de la vigencia de sesión en 24 horas (ver C7).  
4. Prueba de extremo a extremo de los cuatro endpoints con documento único.  
5. Prueba de multifirma encadenada sobre Solicitud \+ FIPF, con las tres firmas.  
6. Validación de los PDF resultantes por parte de Interseguros con su validador de preferencia.  
7. Revisión conjunta de manejo de errores, expiración y reintentos.  
8. Alta en producción, con ventana coordinada y contactos de soporte.

## **Anexo A — Respuestas por endpoint**

| Endpoint | Situación | HTTP | Cuerpo |
| :---- | :---- | :---- | :---- |
| POST /signature/auth | Credenciales válidas | 200 | { token } |
| POST /signature/auth | Contraseña incorrecta | 400 | status: error · "La contraseña es incorrecta" |
| POST /signature/auth | Usuario inexistente o inactivo | 400 | status: error · "Usuario no válido" |
| GET /signature/session-start | Sesión creada | 200 | { auth, session\_id } |
| GET /signature/session-start | Sin cabecera Authorization | 401 | "No se especificó un token" |
| GET /signature/session-start | Token inválido o vencido | 401 | "Failed to authenticate token: …" |
| POST /signature/getSessionId | Sesión encontrada | 200 | status: success · data\[ … expirado \] |
| POST /signature/getSessionId | Sesión inexistente | 200 | status: success · data: \[\] |
| POST /signature/sign-pdf | Firma exitosa | 200 | status: success · cert\_info · documents\_signeds\[\] |
| POST /signature/sign-pdf | Sesión inexistente | 200 | status: error · "La sesión de firma ya fue utilizada" |
| POST /signature/sign-pdf | Certificado del firmante vencido | 400 | status: error · "El certificado ha expirado: …" |
| POST /signature/sign-pdf | Sesión vencida, fallo del prestador u otro error | 400 | status: error · mensaje genérico |
| GET /tsp-callback | Autorización completada | 302 | redirect\_url?status=success\&session\_id\&code\&state |

## **Anexo B — Secuencia recomendada para el caso de uso**

| \# | Paso | Responsable | Entrada / Salida |
| :---- | :---- | :---- | :---- |
| 1 | Cierre de los PDF y cálculo de hash SHA-256 | Interseguros | Solicitud \+ FIPF, con sus hashes |
| 2 | POST /signature/auth | Interseguros | → token del comercio |
| 3 | GET /signature/session-start con redirect\_url | Interseguros | → auth, session\_id |
| 4 | Distribución del enlace y autorización del firmante | Interseguros / cliente | → retorno a redirect\_url |
| 5 | POST /signature/sign-pdf con los dos documentos | Interseguros | Solicitud \+ FIPF originales → ambos firmados por el cliente |
| 6 | Repetición de los pasos 3 a 5 para Interseguros | Interseguros | PDF del paso 5 → con segunda firma |
| 7 | Repetición de los pasos 3 a 5 para Alianza | Alianza | PDF del paso 6 → con tercera firma |
| 8 | Archivo del documento final | Interseguros | PDF con tres firmas |

Los pasos 6 y 7 **deben ejecutarse en serie**: cada uno toma como entrada el PDF devuelto por el paso anterior. La preparación de ambas sesiones puede hacerse en paralelo; la aplicación de las firmas, no (ver C5).  
