# Criterio unificado — Normativa, firma electrónica y seguridad (AWS)

**Fecha:** 26-ago-2026 · **Rama:** `claude/analisis-ra-215-2025-fre8rp`

Consolida tres documentos analizados el 26-ago-2026 —la **Res. SS.SG. N°
210/2025** (norma central de la venta electrónica), el memo **«Actualizaciones
normativas relevantes»** (barrido del marco completo, corte 26-ago-2026) y el
memo **«Marco Regulatorio de Firma Electrónica para Seguros en Paraguay»**
(análisis MIC/Ley 6822 del mecanismo de firma del cliente)— con la Matriz
Legal V4, el CSV de cumplimiento y el estado real del código y de la
infraestructura (`infra/*.tf`).

El análisis artículo por artículo y el detalle de cada fuente están en
`docs/auditoria/ANALISIS_RES_210_2025.md`. Este documento es el **criterio
operativo**: qué regla rige cada tema, con qué mecanismo se cumple, qué está
implementado y qué falta, en qué horizonte.

**Naturaleza de las fuentes:** la 210/2025 es norma; los dos memos son
investigación jurídica. Sirven como mapa y dirección, no como fuente de
verdad final — toda norma que citen y que el proyecto use debe entrar como
PDF oficial a `docs/normativa/` antes de citarse en pantallas o matriz.
El inventario de qué está y qué falta vive en `docs/normativa/INDICE.md`.

**Aplicado el 26-ago-2026** (mismo día, en esta rama): la errata «215/15» →
«215/17» en las 72 apariciones del repositorio; ocho filas nuevas en la
matriz de cumplimiento (86-93) con los arts. 4 a 10 de la 210/2025; el
retiro del correo de atención inventado de las dos aclaraciones que lo
publicaban; el índice de `docs/normativa/`; la etiqueta normativa del Lote 6
en el plan; y un test que impide que las normas derogadas y los contactos
inventados vuelvan. Lo que sigue abierto es de Alianza, Legal o negocio.

---

## 1. El criterio jurídico, en cinco líneas

1. **La venta electrónica la rige la Res. 210/2025** y nada posterior la
   modificó. La arquitectura del proyecto ya es la que esa norma pide.
2. **El cliente firma con firma electrónica no cualificada (FENC)** — la
   210/2025 art. 4 la autoriza expresamente si está respaldada por
   autenticación previa (OTP), identificación del firmante, integridad del
   documento y trazabilidad. Todo eso el portal ya lo produce.
3. **Las firmas institucionales son cualificadas** (210/2025 art. 5 para
   Interseguros; 231/2025 para Alianza en póliza y CPC, que además prohíbe
   firmas facsimilares). Code100 queda para esas; no puede ejecutar la del
   cliente (C1).
4. **La evidencia y su conservación** (210/2025 art. 9: metadatos, IP,
   fecha/hora, códigos de validación; mínimo 2 años desde el vencimiento;
   SEPRELAD: 5 años) se cumplen con el registro append-only del dominio más
   el bucket WORM de S3.
5. **Los datos sensibles** (salud, PEP, biometría, tarjeta) no salen del
   perímetro: regla inviolable #7, con la Ley 7593/2025 como estándar de
   diseño desde ahora aunque su plena vigencia sea 2027.

## 2. La decisión de arquitectura de firma que se desprende

El tercer documento cierra la dirección técnica de **D1** (quién ejecuta la
firma del cliente), pendiente de formalización por Gerencia y Legal:

**SeguroLoTengo implementa internamente la FENC del cliente.** No hace falta
un prestador externo: la 210/2025 no exige que la firma simple la genere un
prestador registrado — exige autenticación y evidencia. El flujo es el que el
portal ya tiene: OTP de canal → identidad verificada (cédula + selfie +
prueba de vida) → PDF único cerrado y hasheado → revisión del documento →
**OTP exclusivo del acto de firma** → vínculo criptográfico de cliente,
documento, hash, OTP, fecha/hora, IP, dispositivo y texto aceptado →
constancia de evidencias. Code100 aplica después las cualificadas de
Interseguros y Alianza sobre el mismo PDF.

Consecuencias que hay que dejar aclaradas:

- **El OTP del acto de firma vuelve a ser un acto propio del portal.** D-07
  (19-ago-2026) lo había retirado suponiendo que el acto ocurría dentro del
  flujo de Code100; C1 demostró que Code100 no puede recibir la firma del
  cliente, y este memo lo resuelve: OTP de canal y OTP de firma son **actos
  distintos** aunque viajen al mismo WhatsApp. Cuando D1 se formalice, D-07 y
  la regla inviolable #1 se re-redactan en ese sentido — no antes (las
  decisiones PENDIENTES no se implementan).
- **Los textos no nombran proveedor ni «prestador».** El botón:
  *«Firmar electrónicamente la Solicitud y el FIPF»*. La declaración previa
  nombra el código de un solo uso al WhatsApp verificado, no a Code100. La
  leyenda técnica: *«Firma electrónica no cualificada realizada mediante
  autenticación por código de un solo uso, vinculada al documento y a la
  identidad verificada del firmante»* — nunca «realizada por SeguroLoTengo
  como prestador». Ojo: el texto de la Matriz V4 §4 («…deseo firmarlo
  mediante Code100») **contradice** esta regla y la de CLAUDE.md («ninguna
  pantalla nombra al proveedor»); al implementar D1 el texto se corrige y el
  cambio se registra en la matriz.
- **Interseguros no necesita registrarse ante el MIC** mientras el mecanismo
  sea **interno, gratuito y exclusivo** de sus propias contrataciones (Ley
  6822/2021: servicio de confianza = prestado habitualmente a cambio de
  remuneración). Deja de valer si se ofrece firma a terceros, se cobra por
  ella, Alianza paga específicamente por el servicio, se la publicita como
  plataforma de firma o se emiten certificados: en ese caso corresponde la
  comunicación FOR-ICPP-02 al MIC dentro de los tres meses (sin autorización
  previa). **Antes de producción: consulta escrita al MIC** describiendo el
  carácter interno, para tener la confirmación por escrito.
- **Ante la SIS no hace falta matrícula adicional**, pero sí: aprobación
  formal del mecanismo por Alianza, procedimiento documentado, autenticación
  conforme a la 210/2025, evidencias auditables, nombre autorizado, propuesta
  firmada por el representante autorizado de Interseguros (Res. 205/2025:
  Rodrigo Fernández Echazú, mat. 2918) y descarga del documento firmado por
  el cliente.
- **Alianza notifica a la SIS con al menos 10 días hábiles de anticipación**
  el inicio de la comercialización por canal no presencial (231/2025). Es un
  trámite de Alianza, no del portal — va al calendario regulatorio.

## 3. Evidencia por acto de firma — checklist contra lo implementado

Lo que el memo exige registrar por cada firma, contra dónde vive hoy:

| Dato exigido | Dónde está hoy | Falta |
| :--- | :--- | :--- |
| Número único de operación | Correlativo `PROP-…` + `idCode100` del acto | — |
| Nombre y cédula del firmante | `Expediente.identidad` (OCR + registro civil) | — |
| WhatsApp verificado | `Expediente.canalWhatsapp` | — |
| Identificador y versión del documento | `PROP-<correlativo>`, versión y clave S3 con huella | — |
| Hash SHA-256 antes de firmar | Regla inviolable #4; determinismo del generador | — |
| Fecha/hora de generación, envío y validación del OTP | Evidencia de envío/verificación (`P1_OTP_*`; el acto de firma en `P8_*`) | Al implementar D1: eventos propios del OTP de firma con sus tres timestamps |
| Resultado de autenticación e intentos fallidos | `RegistroEvidencia.resultado` + intentos en el ciclo OTP | — |
| IP, navegador/dispositivo, sesión | `RegistroEvidencia.ip/dispositivo/sesionId` | — |
| Texto exacto aceptado y versión del aviso | `textoAceptado` + `versionTextoAceptado` | — |
| Resultado de cédula, selfie y prueba de vida | `DecisionBiometrica` (puntuación + umbral + versiones) | — |
| Canal utilizado | Origen de confirmación (`SONDEO`/`RETORNO_NAVEGADOR`) + canal en evidencia | — |
| Constancia de descarga o envío | Acuses de entrega (Lote 5d) y descargas | Descargas como evento de evidencia: TRV-01 (L6) |
| Hash del documento final (con firmas) | Hash del paquete firmado registrado | — |
| OTP nunca en claro | Regla inviolable #2: solo hash + pepper | — |
| Constancia de evidencias sellada criptográficamente | Registro append-only + WORM | Sellado activo del audit trail — ver §4, fila «Integridad de la evidencia» |

Conclusión: el modelo de evidencia actual cubre la lista casi entera; lo que
falta cae exactamente en TRV-01 (L6) y en dos refuerzos de Go-Live (§4).

## 4. Mapa normativa → mecanismo de seguridad (AWS y propios)

Anclado en lo que existe en `infra/*.tf` y en el código. «Demo ✅» = ya
implementado y operativo hoy.

| Requisito (norma) | Mecanismo | Estado |
| :--- | :--- | :--- |
| Evidencia append-only e inmutable (210/2025 art. 9; SEPRELAD 71/19 arts. 43-44; regla #10) | **S3 Object Lock (WORM)** en el bucket de evidencias, con versionado, SSE y bloqueo de acceso público (`infra/s3.tf`) | Demo ✅ (GOVERNANCE + 30 días) · **Go-Live: pasar a COMPLIANCE + 5 años** (ya documentado en el propio .tf) |
| Conservación 2/5/10 años por categoría (210/2025 art. 9; Matriz §6) | Política de retención documentada + lifecycle de S3 (las versiones vigentes se conservan indefinidamente) | ⚠️ Política escrita = CMP-14 (**L6**); borrado programado = compuerta de producción |
| Integridad documental (6822/2021; regla #4) | SHA-256 determinista del PDF único; clave S3 con huella (`CPC-…-v1-<sha256>.pdf`); regeneración = versión nueva | Demo ✅ |
| Integridad de la evidencia (constancia «sellada criptográficamente») | Hoy: append-only + WORM. **Go-Live recomendado:** firma asimétrica de la constancia de evidencias con **AWS KMS** (clave asimétrica, `Sign`/`Verify`), para que la constancia pruebe integridad por sí sola fuera del sistema | ⚠️ Nuevo — Go-Live |
| OTP: solo hash, uso único, 5 min, 3 intentos (regla #1/#2) | Hash + **pepper en Secrets Manager** (`infra/secrets.tf`); **TTL nativo de DynamoDB** para expiración | Demo ✅ |
| Identificación del firmante (210/2025 art. 4; regla #8) | **Rekognition Face Liveness** por referencia de sesión (el video va navegador→AWS, el backend nunca lo ve); umbral facial 99; **Textract** + MRZ; `DecisionBiometrica` versionada | Demo ✅ (mock) / adaptador live existente |
| Datos sensibles aislados (regla #7; Ley 7593/2025) | Sin analítica ni CRM; logs de CloudWatch con retención 7 días (`infra/logs.tf`); **opt-out de uso de datos por servicios de IA de AWS aplicado** (`infra/politica-opt-out-ia.json`); salud/PEP/biometría nunca en logs | Demo ✅ · test explícito de logs = CMP-16 (**L6**) |
| Cifrado en reposo | SSE en DynamoDB y S3 (llaves gestionadas por AWS) | Demo ✅ · CMK propia: opcional, decisión de Go-Live si Alianza la exige |
| Cifrado en tránsito | TLS de Amplify Hosting (obligatorio además para la cámara: `mediaDevices` exige HTTPS) | Demo ✅ |
| Rate limiting y antiabuso (210/2025 art. 2.e; Matriz compuerta 7) | Middleware 429 por IP y sesión en OTP/identidad/firma/pago (**L6**) + **AWS WAF** delante del dominio como capa de infraestructura en Go-Live | ⚠️ L6 + Go-Live |
| Continuidad y respaldo (Res. 219/2018; 210/2025 art. 10) | **PITR de DynamoDB** — hoy apagado, aceptado y documentado hasta Go-Live (`infra/dynamodb.tf`); versionado S3 activo; presupuesto con alarma (`presupuesto.tf`) | ⚠️ PITR = Go-Live (junto a COMPLIANCE y separación de cuentas) |
| Secretos y accesos (Matriz filas 79-84) | **Secrets Manager** con claves separadas para panel de demo y consola administrativa (revocables por separado); políticas IAM de referencia por rol (`infra/iam*.json`); separación de ambientes = compuerta de producción | Demo ✅ · 3 cuentas AWS = Go-Live |
| Entrega con acuse (CHG-44/CMP-05) | **SES** para correo (límites de sandbox en `docs/CONFIGURACION_SES.md`); WhatsApp por el proveedor de mensajería; acuse y reintentos (Lote 5d) | Demo ✅ (mock de mensajería; live pendiente de contrato) |
| Verificación pública de autenticidad (CMP-06; 231/2025) | `/verificar/<código>`: hechos del documento, sin datos personales; QR con URL sola | Demo ✅ · evidencia por visita se reevalúa con el rate limiting (L6) |
| Supervisión de dependencias e IaC | **Snyk** (`npm run seguridad`) + cadena de despliegue (`docs/POLITICA_DE_DESPLIEGUE.md`: verify → seguridad → PR → 4 jobs CI → merge=deploy) | Demo ✅ |

## 5. Qué se hace cuándo

**Ya está (no tocar, es lo que la norma pide):** firma simple + OTP +
biometría + hash + evidencia; institucionales cualificadas configurables;
CPC atómico con el cobro; WORM de evidencias; OTP solo hash; opt-out de IA;
aislamiento de datos sensibles; verificación pública.

**Lote 6 (cierre normativo, no hardening opcional):** TRV-01 (art. 9 —
descargas, reproducciones y aceptaciones como eventos con IP), CMP-10
(información del canal, art. 7.d + Res. 030/2025), CMP-12/13 (privacidad y
cookies, art. 2.e + Ley 7593/2025), CMP-14 (política de retención 2/5/10),
CMP-16 (test de logs), rate limiting con 429.

**Al formalizarse D1 (Gerencia/Legal):** OTP de firma como acto propio con
sus tres timestamps en evidencia; re-redacción de D-07 y de la regla
inviolable #1; textos de botón y declaración según §2 (sin nombrar
proveedor); corrección del texto de la Matriz §4; constancia de evidencias
como documento descargable del expediente.

**Go-Live (compuertas):** Object Lock a COMPLIANCE + 5 años; PITR;
separación en tres cuentas AWS; AWS WAF; sellado KMS de la constancia de
evidencias; CMK propia si Alianza la exige; certificados cualificados
vigentes en Code100 — el de Interseguros a nombre de su representante
autorizado (Res. 205/2025) — y contrato con Code100 que documente el
servicio (cualificado / no cualificado) por firmante; comercio receptor de
Bancard = Alianza (Ley 7503/2025).

**Trámites externos (no son código):** consulta escrita al MIC por el
carácter interno del mecanismo de firma; aprobación formal del mecanismo por
Alianza; notificación de Alianza a la SIS ≥ 10 días hábiles antes de
comercializar por el canal; lectura jurídica de la exigibilidad de la prima
frente al CPC (Código Civil — el diseño soporta ambas lecturas); renovación
de matrícula de Interseguros antes del 18-sep-2027.

## 6. Cautelas finales

- Las conclusiones sobre MIC/REPSE del tercer documento tienen **dos partes
  en tensión**: la primera sección afirma que operar el software de firmas
  en AWS convierte a Interseguros en prestador no cualificado con registro
  obligatorio; el complemento lo refina — mecanismo interno, gratuito y
  exclusivo ⇒ no es servicio de confianza ⇒ sin registro. El criterio
  adoptado es el del complemento **más la consulta escrita al MIC**, que es
  la que convierte la interpretación en certeza.
- Ninguna de las re-redacciones de reglas (regla #1, D-07, texto de la
  matriz) se implementa hasta que D1 esté formalmente decidida: las
  decisiones PENDIENTES no se implementan (regla del repo).
- AWS es el mecanismo, no el responsable: frente a la SIS y a los tomadores
  responden Interseguros y Alianza (210/2025 art. 8). Todo lo de este
  documento asume ese reparto.
