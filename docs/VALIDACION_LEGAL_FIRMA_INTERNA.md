# Validación legal de la firma no cualificada propia y convergencia con Firmas-NoCualificadas

**Fecha:** 2026-08-27
**Pregunta que responde:** ¿puede SeguroLoTengo generar por sí mismo la firma electrónica no cualificada del cliente, y en qué condiciones?

**Documentos analizados**

| Fuente | Qué aporta |
| :---- | :---- |
| `docs/normativa/215 2025.pdf` — **contiene en realidad la Resolución SS.SG. N.º 210/2025** (§7.1) | Texto de primera mano: condiciones mínimas para comercializar seguros por medios electrónicos. **Norma central de este análisis.** |
| `docs/normativa/231 2025.pdf` — Resolución SS.SG. N.º 231/2025 | Texto de primera mano: emisión de pólizas e instrumentos de cobertura en formato electrónico. |
| *Marco Regulatorio de Firma Electrónica para Seguros en Paraguay* (versiones 1 y 2) | Análisis externo; la versión 1 trae un complemento con la tesis del "mecanismo interno". |
| *Actualizaciones normativas relevantes* (26-ago-2026) | Barrido de todo el marco aplicable, con estado vigente/histórico de cada norma. |
| `/home/andres-alberdi/Firmas-NoCualificadas/` (9 documentos + repositorio comprimido) | Blueprint y código inicial de un PSCNC propio. |

---

## 1. Respuesta corta

**Sí, y con respaldo expreso.** El artículo 4 de la Resolución SS.SG. N.º 210/2025 admite que el proponente suscriba la propuesta de seguro y los documentos precontractuales —menciona expresamente los cuestionarios de salud— con firma electrónica cualificada **o, en su defecto, con firma electrónica simple**, siempre que esté respaldada por un mecanismo de autenticación previo, "tal como OTP u otros medios técnicamente idóneos", que garantice la identificación del firmante, el origen e integridad de sus datos y la trazabilidad de la operación.

La norma **no exige que esa firma la genere un prestador registrado**. Exige autenticación previa, identificación, integridad y trazabilidad — que es exactamente lo que el sistema ya produce.

Pero hay que separar dos cosas que suelen confundirse, porque tienen regímenes distintos:

| | **Generar firmas** no cualificadas para las contrataciones propias | **Emitir certificados** electrónicos no cualificados |
| :---- | :---- | :---- |
| Qué es | Autenticar al firmante y vincularlo al documento con evidencia | Actuar como autoridad de certificación: expedir credenciales a nombre de personas |
| ¿Habilitado? | **Sí**, Res. 210/2025 art. 4 | **Sí**, la ley lo permite sin autorización previa |
| ¿Requiere trámite? | No, mientras sea mecanismo interno (§4) | **Sí**: REPSE + comunicación al MIC dentro de 3 meses + Declaración de Prácticas + perfil `DOC-ICPP-20` |
| Riesgo si se omite | — | Infracción sujeta a sumario administrativo y multa |

**Para SeguroLoTengo alcanza con la primera columna.** La segunda es el terreno del proyecto Firmas-NoCualificadas (§5), que por definición sirve a terceros y por lo tanto sí es un prestador.

---

## 2. Lo que dicen las dos resoluciones, leídas directamente

### 2.1 Resolución SS.SG. N.º 210/2025 — comercialización por medios electrónicos (25-sep-2025)

| Artículo | Qué establece | Efecto sobre el proyecto |
| :---- | :---- | :---- |
| 1 y 2 | Alcance: aseguradoras, agentes y corredores autorizados. Criterios esenciales: trato justo, transparencia, enfoque basado en riesgos, gobernanza tecnológica, protección de datos y ciberseguridad, innovación responsable | Marco general; ya alineado con el diseño del portal |
| 3 | Canales alcanzados: apps, sitios web, plataformas de mensajería, redes sociales, llamadas; lista enunciativa | SeguroLoTengo y el canal de WhatsApp quedan comprendidos |
| **4** | **Propuesta y documentos precontractuales: FEC o firma simple. Si es simple, exige mecanismo de autenticación previo (OTP u otro idóneo), identificación del firmante, origen e integridad de los datos y trazabilidad** | **Habilita el modelo decidido.** El OTP de firma no es un adorno: es el requisito |
| **5** | **Si hay intermediario, la propuesta debe estar suscrita con firma electrónica cualificada del agente o corredor** | **La FEC de Interseguros es obligación legal, no diseño.** Ver §3 |
| 6 | Consentimiento informado previo; deben existir medios para corroborar que fue libre, expreso e inequívoco | La declaración de P8 y su versionado cumplen esta función |
| 7 | Información mínima: datos y domicilio de aseguradora e intermediario, características y exclusiones, costo total y forma de pago, procedimiento de denuncia de siniestros | Verificar cobertura completa en las pantallas |
| **8** | **Contratar empresas de servicios tecnológicos no traslada la responsabilidad: aseguradora e intermediarios responden ante la SIS y los asegurados** | Que AAB1 sea el operador tecnológico **no escuda a Interseguros** |
| **9** | **Conservación con trazabilidad: metadatos, IP, fecha y hora, códigos de validación. Mínimo 2 años desde el vencimiento de la póliza, disponibles para consulta del cliente y de la SIS** | Fija el plazo de retención, que el proyecto hoy no declara (§8) |
| 10 | Procedimiento escrito de comercialización aprobado por el Directorio de la aseguradora, más planes de contingencia | Documento de Alianza; el sistema debe poder describirse en él |

### 2.2 Resolución SS.SG. N.º 231/2025 — pólizas electrónicas

| Artículo | Qué establece | Efecto |
| :---- | :---- | :---- |
| 2 | La aseguradora puede emitir pólizas electrónicas con FEC del suscriptor, previa comunicación a la SIS **con 10 días hábiles de antelación**, acompañada de nómina de firmantes (con acta de directorio, poderes y cédulas), certificado cualificado vigente de cada firmante e informe del área de TI aprobado por el directorio | Obligación de Alianza. Condiciona la fecha de salida a producción |
| 3 | La comunicación previa aplica solo a entidades no habilitadas bajo la derogada Res. 136/2018 | Hay que preguntarle a Alianza en qué situación está |
| 4 | El tomador declara **en la propuesta** el medio electrónico de recepción; la copia en papel lleva código seguro de verificación; el acuse de recibo se rige por la Ley 6822/2021 | Verificar que la Solicitud registre el medio de recepción declarado |
| 5 | Verificación de la póliza por código QR o equivalente, herramientas de verificación de certificados o plataformas de consulta | Es de la póliza, no de la Solicitud: nuestro QR sigue siendo decisión de producto |
| 6 | Seguridad, respaldo, recuperación y evaluación periódica de riesgos | Alineado con la infraestructura actual |

---

## 3. Quién firma qué, según la norma

| Documento | Firmante | Requisito legal | Estado en SeguroLoTengo |
| :---- | :---- | :---- | :---- |
| Solicitud (propuesta) y FIPF / cuestionarios | Cliente | FEC **o** firma simple con autenticación previa (210 art. 4) | **Cumple** con el modelo decidido: OTP + identidad verificada + hash + evidencia |
| Propuesta intermediada | **Interseguros** | **FEC obligatoria** del agente o corredor (210 art. 5), y por Res. 205/2025 la propuesta la firma el agente autorizado (Rodrigo Fernández Echazú, matrícula 2918) | **No implementado.** Hoy es solo texto en pantalla |
| Póliza e instrumentos de cobertura | Alianza | FEC del suscriptor autorizado + comunicación previa a la SIS (231 art. 2) | Fuera del sistema; condiciona P9 |
| Solicitud y FIPF firmados por Alianza | Alianza | **No exigido por la norma** | Control adicional válido; es decisión de diseño, no obligación |

Dos consecuencias que conviene subrayar:

1. **La firma cualificada de Interseguros dejó de ser opcional.** La matriz del proyecto la describe hoy como "decisión acordada" (fila 38); el artículo 5 de la 210/2025 la vuelve obligatoria para toda propuesta intermediada. Es, además, la firma institucional que sí o sí hay que implementar.
2. **La firma de Alianza sobre la Solicitud y el FIPF es un extra.** Lo que la norma le exige a la aseguradora es firmar la póliza. Si el pipeline institucional resulta caro u operativamente pesado (consulta C21, sin responder), esta es la pieza que puede discutirse sin tocar el cumplimiento.

---

## 4. ¿Interseguros se convierte en prestador de servicios de confianza?

**Los dos documentos aportados se contradicen, y conviene decirlo antes que nada.** El cuerpo principal del *Marco Regulatorio* afirma que operar el software de firmas "adquiere la condición de PSCNC" y exige inscripción en el REPSE más Declaración de Prácticas dentro de los tres meses. El complemento del mismo documento sostiene lo contrario: que si el mecanismo es interno, gratuito y exclusivo de las contrataciones propias, no hay servicio de confianza ofrecido al mercado y no corresponde registrarse.

**El criterio que resuelve la contradicción** es la definición de la Ley 6822/2021: un servicio de confianza es el que se presta *habitualmente a cambio de una remuneración*. De ahí salen dos escenarios:

| | **E1 · Mecanismo interno** | **E2 · Prestador no cualificado (PSCNC)** |
| :---- | :---- | :---- |
| Cuándo aplica | Firma usada solo en contrataciones propias, sin cobrar por firmar, sin ofrecerla a terceros, **sin emitir certificados** | Se ofrece a terceros, se cobra por crear/verificar/conservar firmas, o se emiten certificados electrónicos |
| Trámite | Ninguno | REPSE (VUE, gratuito, 48 h hábiles) + comunicación a la DGFDCE del MIC dentro de **3 meses** desde el inicio efectivo |
| Documentación | — | Formulario (FOR-ICPP-02), Declaración de Prácticas de los Servicios de Confianza, perfil de certificados conforme a `DOC-ICPP-20` (Res. MIC 262/2024) |
| Obligaciones permanentes | Las del contrato y las de la SIS | Listado público, notificación de incidentes en **24 h** a DGFDCE y CERT-Py, conservación, auditorías de vulnerabilidad, responsabilidad civil directa |
| Lo que **no** exige | — | Autorización previa, póliza de 500 salarios mínimos ni auditoría previa: eso es de los prestadores **cualificados** |

**Dónde cae cada proyecto:**

- **SeguroLoTengo, con el modelo decidido: E1.** Firma sus propias contrataciones, no cobra por firmar, no ofrece el servicio a terceros. La única frontera que no conviene cruzar sin análisis es **emitir certificados**: apenas se expiden credenciales a nombre del firmante, el argumento del mecanismo interno se debilita.
- **Firmas-NoCualificadas: E2, sin discusión.** Es un SaaS B2B multi-tenant pensado para otros proyectos y clientes. Ahí el registro no es opcional.

**Recomendación coincidente con el propio documento aportado:** antes de producción, presentar una **consulta escrita al MIC** describiendo el carácter interno del mecanismo y pedir confirmación de que no corresponde comunicarse como prestador. Cuesta poco y cierra el único punto opinable.

**Cuidado con los textos de pantalla.** No debe decirse que SeguroLoTengo actúa como prestador de firma. La formulación correcta describe el mecanismo —firma electrónica no cualificada mediante código de un solo uso, vinculada al documento y a la identidad verificada— sin presentarlo como un servicio de certificación independiente.

---

## 5. Qué es Firmas-NoCualificadas y en qué estado está

**Contenido de la carpeta:** blueprint técnico v2, guía de registro ante el MIC, régimen de responsabilidad y seguros, declaración de prácticas y perfiles, arquitectura de claves en AWS KMS, esquema de base de datos de auditoría, especificación de integración B2B con aseguradoras, esquema de dashboard, wireframe React, y un repositorio comprimido con un servicio en Python (orquestador con máquina de estados, `crypto/` con CA efímera, PAdES y TSA, repositorios DynamoDB y S3, `compliance/legal_guard`, módulo de onboarding).

**Lo que propone:** CA intermedia con la clave privada en AWS KMS, certificados X.509 efímeros por transacción (validez de T−5 min a T+1 h, con el número de cédula en el `SerialNumber`), firma PAdES incremental, sello de tiempo RFC 3161 de una TSA cualificada paraguaya, opción de elevar a PAdES-B-LTA con información de revocación embebida, expediente de evidencias sellado y retención de 2 años con S3 Object Lock en modo Compliance. API en tres llamadas: crear sesión, confirmar con OTP, descargar documento y evidencias.

**Es un blueprint con un repositorio inicial. No ejecuté el código ni verifiqué que funcione**; lo que sigue sale de leer los documentos y el árbol de archivos.

**Diferencias que hay que resolver antes de integrarlo:**

| Punto | Firmas-NoCualificadas | SeguroLoTengo | Cómo se resuelve |
| :---- | :---- | :---- | :---- |
| Umbral biométrico | El orquestador exige coincidencia "> 95%", y el ejemplo de respuesta devuelve 0.985 | **99 sobre 100**, con la decisión registrada junto al umbral aplicado, la versión del modelo y la versión de la política | El servicio **no puede volver a decidir**: recibe la decisión ya tomada. Si decidiera él, aprobaría casos que nuestra política rechaza |
| Escala | 0 a 1 | 0 a 100 (la de Rekognition) | Normalizar en el borde, como ya exige el dominio |
| Qué viaja | El PDF completo por `multipart/form-data` | La Solicitud contiene **declaraciones de salud** | Preferir modo hash-only si el servicio lo admite; si no, contrato de tratamiento de datos (es la consulta C29, que ahora aplica a este proveedor) |
| OTP de consentimiento | El servicio recibe `consent_otp_code` en la confirmación | El tercer OTP debe ser de SeguroLoTengo (§3.1 del análisis de modelo) | Que el OTP lo emita y verifique SeguroLoTengo, y viaje al servicio como evidencia, no como control |
| Registro de evidencia | Genera su propio expediente sellado | `EvidenceStore` append-only del expediente | El registro del expediente es el autoritativo; el del servicio es el acta del acto de firma. Se referencian por `Transaction_ID` ↔ `expedienteId` |
| Restricciones de uso | `legal_guard` bloquea hipoteca, donación, testamento y matrimonio | No aplica a seguros | Sin conflicto; conviene conocerlo |
| Sello de tiempo | Consume una TSA cualificada de un prestador paraguayo | Hoy el proyecto no usa TSA | Si se integra, el proveedor externo que se registra es **el servicio**, no la TSA |

---

## 6. Convergencia recomendada: dos fases

**Fase 1 — ahora, sin dependencias.** SeguroLoTengo implementa la firma interna en su versión de evidencia: OTP propio, identidad ya verificada, hash antes y después, bloque impreso en el documento y registro append-only. Cumple el artículo 4 de la 210/2025 **hoy**, no emite certificados, no dispara la condición de prestador y no depende de que Firmas-NoCualificadas esté registrado ni terminado. Es, además, lo que la demo necesita.

**Fase 2 — cuando Firmas-NoCualificadas esté registrado como PSCNC y en producción.** Se eleva la misma firma a PAdES-T con certificado efímero y sello de tiempo cualificado, consumiendo su API, **sin cambiar nada del recorrido del cliente**: los mismos pasos, la misma pantalla, el mismo OTP.

Lo que hace posible el cambio sin reescribir el flujo es la arquitectura de puertos: un puerto de firma del cliente con dos adaptadores —interno y Firmas-NoCualificadas— y el dominio indiferente a cuál está activo, igual que hoy con identidad o pagos.

**Condiciones de proyecto para la fase 2**, que no son negociables por la regla de CLAUDE.md:

1. Registrar el servicio en `docs/Tabla de Integraciones externas - Tabla.csv` **antes** de escribir el adaptador. El ítem 18 pasa a servicio interno en la fase 1, y a este proveedor en la fase 2.
2. Que el servicio esté efectivamente comunicado al MIC y publicado en el listado de PSCNC.
3. Contrato de tratamiento de datos que contemple declaraciones de salud, biometría y cédula.
4. Que acepte recibir la decisión biométrica ya tomada, sin re-evaluarla con su propio umbral.

---

## 7. Hallazgos sobre la documentación normativa del repositorio

1. **`docs/normativa/215 2025.pdf` no es la Resolución 215: contiene la Resolución SS.SG. N.º 210/2025.** El nombre induce a error justo en la norma más importante del canal. Conviene renombrarlo.
2. **La carpeta `docs/normativa/` existe solo en el checkout principal y está sin commitear.** No está en este worktree. Son las normas mismas: deberían versionarse.
3. **La matriz de cumplimiento cita "Res. SS SG. 215/15".** El documento de actualizaciones sostiene que la vigente es la **215/2017** (modificada por 238/2019 y 181/2020), y que la 292/2007 fue sustituida por ella. La cita aparece en muchas filas y también en `CLAUDE.md`: hay que verificarla y corregirla en bloque.
4. **La matriz no incluye la 210/2025 ni la 231/2025**, que hoy son las dos normas centrales del canal electrónico. Faltan filas, y de ellas cuelgan obligaciones concretas (§8).
5. **Normas derogadas que el proyecto podría estar citando:** Res. 136/2018 (derogada por la 231/2025) y las Leyes 4017/2010 y 4610/2012 (derogadas por la 6822/2021).
6. **`docs/normativa/ESPECIFICACION.pdf` (17-ago-2026) describe otro producto:** flujo de **seis pantallas**, QR Bancard como único medio de pago, y Solicitud y FIPF en **un único PDF** firmado mediante Code100. Diverge de `CLAUDE.md`, de `ESPECIFICACION_PANTALLAS.md` y del modelo de firma decidido. Hay que definir cuál es la especificación vigente antes de seguir construyendo sobre cualquiera de las dos.
7. **`docs/normativa/matriz 16 08 2026.pdf`** (11 páginas, escaneada) parece una versión posterior de la matriz de cumplimiento. No la analicé: si reemplaza al CSV, es la fuente de verdad y hay que migrarla.

---

## 8. Obligaciones nuevas que el proyecto todavía no cubre

| Obligación | Fuente | Estado |
| :---- | :---- | :---- |
| FEC del corredor sobre la propuesta | 210/2025 art. 5 | **No implementada.** Es la firma institucional imprescindible |
| Conservación mínima de 2 años desde el vencimiento de la póliza, con disponibilidad para el cliente y la SIS | 210/2025 art. 9 | Sin política de retención declarada ni acceso posterior al flujo |
| Responsabilidad no delegable al operador tecnológico | 210/2025 art. 8 | Debe reflejarse en el contrato con AAB1 |
| Procedimiento escrito de comercialización aprobado por el Directorio + contingencias | 210/2025 art. 10 | Documento de Alianza |
| Comunicación previa a la SIS con 10 días hábiles, nómina de firmantes, certificados e informe de TI | 231/2025 art. 2 | De Alianza; condiciona la fecha de producción |
| Medio electrónico de recepción declarado en la propuesta | 231/2025 art. 4 | Verificar que la Solicitud lo registre |
| Adecuación anticipada a la Ley 7593/2025 de Protección de Datos | Ley 7593/2025 | Biometría y salud con protección reforzada; conviene diseñar ya conforme a ella |
| Uso exclusivo de la denominación registrada | Res. 190/2025 y Circular 011/2025 | La marca SeguroLoTengo debe estar autorizada ante la SIS; verificar |

---

## 9. Qué recomiendo hacer ahora

1. **Confirmar con el asesor legal la lectura del artículo 4 de la 210/2025** y la tesis del mecanismo interno (§4). Es la última pieza del gate 0.
2. **Presentar la consulta escrita al MIC** sobre el carácter interno del mecanismo, antes de producción.
3. **Implementar la fase 1** (§6): firma interna con evidencia, sin certificados.
4. **Poner la FEC de Interseguros en el camino crítico**: es obligación legal y hoy no existe en el código.
5. **Ordenar la documentación normativa** (§7): renombrar el archivo, versionar la carpeta, corregir la cita de la 215 y agregar las filas de la 210/2025 y la 231/2025 a la matriz.
6. **Resolver qué especificación rige** antes de seguir construyendo (§7.6).
7. **Registrar Firmas-NoCualificadas en el catálogo de integraciones** cuando se decida integrarlo, y no antes de que esté comunicado al MIC.
