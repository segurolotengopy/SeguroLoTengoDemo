# Matriz Legal Final V4 — transcripción y contraste

**Documento de origen:** `docs/MATRIZ_LEGAL_V4_2026-08-16.pdf` (antes `docs/normativa/matriz 16 08 2026.pdf`)
**Corte del documento:** 16 de agosto de 2026 · **Versión:** V4, "última auditoría normativa antes del diseño"
**Transcrito el:** 2026-08-27

> **Cómo se hizo esta transcripción.** El PDF es un escaneo sin capa de texto: lo leí como imágenes, página por página. La transcripción es fiel en contenido pero **puede tener errores de lectura en cifras y nombres**; ante cualquier duda manda el PDF. El original tampoco lleva tildes.

> **Regla de prevalencia declarada por el propio documento:** *"esta V4 reemplaza la V3"*, y se define como **fuente maestra aprobada para el diseño de seis pantallas y el demo**. Su alcance jurídico está acotado: no sustituye el plan registrado, ni el dictamen jurídico de Alianza, ni la aprobación de Cumplimiento/ALA-CFT, ni las autorizaciones de la Superintendencia de Seguros.

---

## 1. Estado de los bloques

| Bloque | Estado | Contenido |
| :---- | :---- | :---- |
| Firmas | CERRADO | Cliente: firma electrónica simple autenticada por OTP en la propuesta y los documentos precontractuales. Interseguros: firma cualificada en la propuesta intermediada. Alianza: firma cualificada en CPC, póliza y demás instrumentos de cobertura que emita |
| Canal y roles | CERRADO | SeguroLoTengo.com es marca y portal operado por Interseguros S.A.; Alianza es la aseguradora |
| Cumplimiento | OBLIGATORIO | Los campos impuestos por norma se incorporan directamente y no se someten a decisión comercial |
| Datos oficiales | PENDIENTE PRODUCCIÓN | Nombre comercial autorizado, código/acto/URL del plan, prima e impuestos, modelos registrados, regla de vigencia y firmantes habilitados |
| Infraestructura | PENDIENTE PRODUCCIÓN | Plataforma de firma cualificada y vigente, nube, biometría, cookies, seguridad, subencargados, QR, reversos y operativa SEBAOT |
| Revisión normativa | CERRADO | Cotejo final de las Resoluciones 210/2025 y 231/2025, Código Civil, Ley 827, consumidor, firma, ALA/CFT, privacidad, salud y pagos |

## 2. Entidades y roles

| Entidad | Rol | Firma o responsabilidad |
| :---- | :---- | :---- |
| Alianza Garantía Seguros y Reaseguros S.A. | Aseguradora; acepta el riesgo y emite CPC, póliza y factura | Su suscriptor autorizado firma con firma cualificada el CPC, la póliza y los demás instrumentos de cobertura |
| Interseguros S.A. | Corredor y operador de SeguroLoTengo.com. Matrícula SIS 118, RUC 80133988 | Su representante autorizado firma la propuesta intermediada con firma cualificada |
| SeguroLoTengo.com | Marca y portal digital de Interseguros; **no es una entidad jurídica separada** | No asume el riesgo, no firma como entidad y no emite póliza ni factura |
| Plataforma de firma | Firma electrónica; **no realiza biometría ni verifica correo** | Cliente: firma simple autenticada. Instituciones: firma cualificada solo si servicio, certificado y firmante están vigentes y habilitados |
| Bancard | Proveedor de pago **exclusivamente QR** | El pago ocurre **después de la firma** y no constituye firma contractual |
| SEBAOT | Sistema interno de Alianza para emisión | No hay integración directa por API o callback con SeguroLoTengo |

**Canales de atención (cerrados):** WhatsApp solo para consultas; trámites ordinarios y cancelación, presenciales con Interseguros o Alianza; retracto legal por notificación electrónica simple a `segurolotengo@interseguros360.com`, aceptado hasta el vencimiento del plazo más favorable entre 7 días corridos y 5 hábiles; derechos sobre datos por el mismo correo.

## 3. Las seis pantallas

| # | Pantalla | Firma / efecto |
| :---- | :---- | :---- |
| 1 | Catálogo y plan | Nadie firma. Seleccionar un plan o abrir un recurso no equivale a aceptarlo |
| 2 | Contacto | El OTP autentica el teléfono y respalda la firma simple posterior; no contrata por sí solo |
| 3 | Elegibilidad e identidad | Salud o PEP que requieran análisis derivan a revisión manual; no habilitan firma, QR ni CPC |
| 4 | Solicitud + FIPF | Borrador. Las declaraciones forman parte del PDF que se firma en la pantalla 5 |
| 5 | Revisión, firma y QR | Alianza no firma la propuesta salvo exigencia del modelo. El QR se habilita solo tras las firmas y la aceptación automática autorizada |
| 6 | Confirmación y CPC | CPC firmado exclusivamente por el suscriptor autorizado de Alianza. Cliente e Interseguros no firman el CPC por defecto |

## 4. Orden de firmas, pago, CPC y emisión

| Orden | Acto | Responsable | Regla |
| :---- | :---- | :---- | :---- |
| 1 | Elegibilidad aprobada | Sistema | Supera edad, salud, PEP, identidad y controles. Si no, caso manual |
| 2 | PDF único generado | SeguroLoTengo | **Solicitud + FIPF + declaraciones**, con versión y hash congelados |
| 3 | Firma del cliente | Cliente / plataforma de firma | Firma electrónica simple, respaldada por OTP, sobre el PDF completo puesto a la vista |
| 4 | Firma del corredor | Interseguros | Firma electrónica **cualificada** sobre la propuesta y todos sus anexos integrantes |
| 5 | Aceptación y CPC | Alianza / sistema autorizado | Reglas autorizadas aplicadas automáticamente; se genera el CPC y lo firma el suscriptor de Alianza. Queda condicionado al pago y ajustado al modelo registrado |
| 6 | **QR y pago** | Bancard | El QR se habilita con la aceptación registrada y el CPC preemitido, o dentro de una **operación atómica** que garantice su emisión contra el pago. Si la emisión falla, reverso automático |
| 7 | Activación y entrega | Alianza / SeguroLoTengo | El pago confirmado activa la cobertura en la fecha y hora del plan. Se entrega de inmediato CPC, PDF firmado y comprobante, con acuse y reintentos |
| 8 | Póliza y factura | Alianza / SEBAOT | Emisión posterior; el portal no inventa números ni firma estos documentos |

**Mapa de firmas por documento** (definición declarada cerrada y prevalente):

| Documento | Interviniente | Nivel |
| :---- | :---- | :---- |
| PDF Solicitud + FIPF + cuestionarios y declaraciones | Cliente | Una firma electrónica simple, respaldada por OTP |
| PDF Solicitud + FIPF + anexos integrantes | Interseguros | Firma cualificada del representante autorizado; la Ley 827 impide anexos de propuesta no firmados por el corredor |
| CPC u otro instrumento provisional | Alianza | Firma cualificada del suscriptor autorizado. **No firman el cliente ni el corredor** |
| Póliza | Alianza | Firma cualificada del suscriptor autorizado |
| Factura / KuDE | Alianza / SIFEN | Documento tributario; no requiere firma del cliente ni del corredor |
| Pago QR | Cliente / Bancard | Operación de pago; **no constituye firma contractual** |

> *"Cliente e Interseguros firman el expediente Solicitud + FIPF; Alianza firma CPC y póliza. Alianza no firma la propuesta ni cliente/Interseguros firman el CPC, salvo que el modelo registrado disponga expresamente lo contrario. Esta asignación aplica la Resolución 210/2025 arts. 4 y 5, la Ley 827 art. 76 y la Resolución 231/2025 art. 2."*

## 5. Producto oncológico documentado

| Plan | Cáncer | Fallecimiento | Hospitalización | Gastos médicos accidente | Premio total |
| :---- | :---- | :---- | :---- | :---- | :---- |
| CONFÍO | Gs. 50.000.000 | Gs. 3.500.000 | Gs. 7.500.000 / Gs. 500.000 por día | Gs. 7.000.000 | Gs. 290.000 |
| CONFÍO+ | Gs. 75.000.000 | Gs. 5.000.000 | Gs. 11.250.000 / Gs. 750.000 por día | Gs. 10.000.000 | Gs. 475.000 |
| CONFÍO TOTAL | Gs. 100.000.000 | Gs. 7.000.000 | Gs. 15.000.000 / Gs. 1.000.000 por día | Gs. 14.000.000 | Gs. 660.000 |

Carencias: cáncer 180 días, hospitalización 30 días, otras coberturas 1 día. Hospitalización: mínimo 24 horas continuas, máximo 15 días por vigencia. Edad de ingreso 18 a 64 años. Precio y registro del plan quedan **pendientes de Alianza**; durante el diseño se usa el marcador `CDXXXXX`.

## 6. Declaraciones y consentimientos

Tres preguntas de salud (buen estado de salud y ausencia de preexistencia; rechazo/postergación previa por otra aseguradora; diagnóstico de una lista de enfermedades), condición PEP, autorización expresa para tratar datos de salud y biométricos, aviso de derivación manual, licitud y veracidad de fondos, actuación por cuenta propia, confirmación de firma del cliente, leyenda del **art. 1556 del Código Civil** y casilla de marketing **desmarcada**.

Dos reglas de cierre que conviene no perder de vista:

- Las tres preguntas de salud **solo pueden publicarse si coinciden literalmente con el cuestionario inscrito del plan** y sus reglas de suscripción. No son preguntas creadas por una ley.
- Cualquier referencia directa o indirecta al VIH exige control de no discriminación, confidencialidad y, si hubiera prueba, consentimiento y consejería conforme a la **Ley 3940/2009**.

## 7. Privacidad, conservación y renovación

Biometría —cédula, selfie, prueba de vida y comparación facial— la procesa **el propio portal**, no la plataforma de firma. Cookies técnicas, analíticas y publicitarias con panel de aceptar/rechazar/configurar por categorías, sin cargar analítica ni publicidad antes del consentimiento.

**Conservación:** mínimo 2 años desde el vencimiento para la venta electrónica; **mínimo 5 años** para el expediente asegurador y ALA-CFT; **10 años** si el documento instrumenta una obligación por mayor tiempo. Se aplica siempre el plazo más largo.

**Renovación anual:** solo válida si está prevista en el plan registrado y en la póliza aceptada. Sin cambios, no se repite la firma de la Solicitud. Con cambios, se firma el documento que cambie. Avisos 15 días antes, 3 días antes y al vencimiento; pago hasta 24 horas después, sujeto a confirmación. La no renovación por diagnóstico solo puede aplicarse si figura en el plan registrado y supera el control de no discriminación.

## 8. Expediente electrónico y numeración

Evidencia mínima por bloque: sesión (ID, origen, IP, user-agent, fecha/hora), oferta (versiones puestas a disposición, aperturas de video/brochure/condiciones — **sin registrar una lectura inexistente**), contacto, identidad, consentimientos, documento (PDF previo/posterior, número de propuesta, correlativo, hash SHA-256), aceptación, pago, CPC, entrega, conservación y protección.

**Protección:** no incluir salud, PEP, imágenes, puntajes biométricos, OTP, PAN ni CVV en logs ordinarios.

**Numeración:** el expediente interno puede usar prefijos `SOL`, `FIPF`, `CPC` o `POL`. El **número oficial** de cada instrumento de cobertura debe coincidir con la Central de Información SIS: **10 dígitos numéricos, sin letras, símbolos ni espacios**. No se presume que CPC y póliza compartan número oficial; se relacionan por el correlativo interno.

## 9. Diez pendientes antes de producción

Datos institucionales y autorización del nombre; código/acto/URL/prima/impuestos del plan; modelos registrados (incluido el CPC como instrumento de cobertura); reglas exactas de cobertura; firmantes, certificados y habilitación de la plataforma de firma; mapa final de firmas contra los modelos registrados; operación QR/CPC; intercambio con SEBAOT sin API directa; FIPF y procedimiento manual de salud/PEP; privacidad, nube, biometría, cookies y seguridad.

Ninguno impide diseñar las seis pantallas ni un demo con datos de muestra; **todos bloquean la emisión real**.

---

## 10. Qué cambia respecto de lo que el proyecto tiene implementado

Este es el contraste, no parte del documento original.

| Tema | Proyecto hoy (`CLAUDE.md` + CSV) | Matriz V4 | Peso |
| :---- | :---- | :---- | :---- |
| **Orden pago/firma** | Se cobra en P7 **antes** de firmar, y de ahí cuelgan `VENCIDO`, `DEVOLUCION_EN_TRAMITE`, `DEVUELTO` y toda la Pantalla B | **El pago ocurre después de la firma** (orden 6), contra CPC preemitido o en operación atómica con reverso automático | **Altísimo.** Elimina la causa de una rama entera del dominio |
| **Medios de pago** | QR, débito y crédito | **Solo QR** | Alto |
| **CPC** | `CLAUDE.md` prohíbe expresamente generar Nota de Cobertura | El **Certificado Provisional de Cobertura** es el documento central de la pantalla 6, firmado por Alianza | **Alto y contradictorio** con una regla vigente del proyecto |
| **Documentos** | Dos PDF, un correlativo, dos prefijos (`PROP-`/`FIPF-`) | **Un PDF único** Solicitud + FIPF + declaraciones, con versión y hash congelados | Alto |
| **Firmas institucionales** | Cliente → Interseguros **y Alianza** sobre ambos PDF | Cliente → **solo Interseguros** sobre el expediente. Alianza firma CPC y póliza, no la propuesta | Medio: **elimina una firma** del pipeline |
| **Firma del cliente** | Firma simple con OTP | Igual | Coincide con el modelo decidido |
| **Pantallas** | 9 pasos + pantallas A/B | Seis pantallas | Alto (y el usuario está probando además un flujo de tres) |
| **Conservación** | Sin política declarada | 2 / 5 / 10 años según categoría, siempre el plazo más largo | Medio |
| **Renovación** | Fuera de alcance | Reglas completas de renovación anual | Medio |
| **Numeración oficial** | `PROP-00018425` | 10 dígitos numéricos sin letras para instrumentos de cobertura | Medio (afecta a Alianza) |
| **Cita de la 215** | `Res. SS SG. 215/15`, 35 veces | `Res. SIS 215/2017, 238/2019 y 181/2020` | La V4 tiene razón: ver `docs/normativa/CATALOGO.md` §3 |
| **210/2025 y 231/2025** | Ausentes del CSV | Fuentes centrales | La V4 tiene razón |

**Qué hacer con el CSV.** La V4 es posterior, se declara prevalente y corrige errores verificables del CSV, así que **pasa a ser la matriz de referencia**. El CSV **no se borra**: sus 84 filas numeradas están citadas por número en el código y en los comentarios del dominio (`fila 34`, `fila 42`, `fila 47`…), y perderlas rompería la trazabilidad de decisiones ya tomadas. Queda como antecedente numerado; ante conflicto, manda la V4.

**Lo que la V4 no resuelve y sigue abierto:** las tres contradicciones de arriba —pago después de la firma, CPC, y PDF único— no son ajustes de redacción, son cambios de producto que tocan la máquina de estados, las reglas inviolables y la mitad de las pantallas. Necesitan decisión explícita antes de tocar código.
