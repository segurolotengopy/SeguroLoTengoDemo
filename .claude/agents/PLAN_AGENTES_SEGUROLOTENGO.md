# Plan de Agentes en Claude Code — Demo Sistema Integrado SeguroLoTengo (AAB1)

**Basado en:** las 12 pantallas del flujo (`Pantallas_Sistema_Demo.pdf`) \+ documentación de arquitectura, cumplimiento y propuesta técnica del Drive del proyecto \+ `docs/Tabla de Integraciones externas - Tabla.csv` (30 integraciones/herramientas en 6 categorías) \+ `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` (85 obligaciones normativas en 8 categorías R1-R8).

---

## 1\. Mapa de pantallas → módulos → integraciones

| \# | Pantalla | Qué hace | Integraciones involucradas |
| :---- | :---- | :---- | :---- |
| P0 | Landing informativa | Vitrina de productos, sin PII | Ninguna (contenido estático) |
| P1 (1/9) | Verificación WhatsApp | OTP \#1 al celular, hash del OTP, nunca texto claro | Infobip WhatsApp API (+ fallback SMS) |
| P2 (2/9) | Selección de plan | CONFÍO / CONFÍO+ / CONFÍO TOTAL, hash SHA-256 de la oferta | Motor interno de catálogo (tabla versionada) |
| P3 (3/9) | Preparación \+ autorización inicial | Checklist de requisitos, consentimiento general de tratamiento de datos | Registro de consentimiento (S3 Object Lock) |
| P4 (4/9) | Verificación correo | OTP \#2, distinto al de WhatsApp | Infobip 2FA Email / alternativa Amazon SES |
| P5 (5/9) | Verificación de identidad | Cédula frente/dorso, selfie, prueba de vida, edad 18-64 | Entrust Identity Verification (antes Onfido) — OCR \+ Liveness \+ face match |
| P6 (6/9) | Datos y declaraciones | KYC complementario, 8 declaraciones (salud, antecedentes, PEP, etc.) | Formulario interno \+ regla de elegibilidad automática |
| P7 (7/9) | Facturación y pago | QR Bancard o preautorización de tarjeta | Bancard vPOS 2.0 / Bancard QR |
| P8 (8/9) | Revisión y firma final | Genera Solicitud \+ FIPF (2 PDF cerrados, hash SHA-256), 1 OTP firma ambos (regla atómica) | Servicio PDF interno \+ Code100 (firma electrónica) |
| P9 (9/9) | Confirmación / contratación aceptada | Resumen, entrega de documentos | SEBAOT (emisión \+ factura) \+ Infobip/SES (entrega) |
| Pantalla A | Derivación a revisión manual | Caso con salud/PEP positivo, no continúa a pago ni firma | Módulo interno de casos (case\_id) |
| Pantalla B | Solicitud vencida (24h sin firmar) | Recordatorios a 1h/5h/12h, devolución del pago al origen | Bancard (devolución) \+ Infobip (notificaciones) |

**Reglas transversales que todo agente debe respetar** (ya definidas en tu documentación de cumplimiento):

- El OTP nunca se guarda en texto claro, solo su hash.  
- Regla atómica de firma: Solicitud \+ FIPF se firman juntos o ninguno (P8).  
- Respuesta PEP afirmativa o salud incompatible → bloqueo automático, deriva a Pantalla A, **no** activa Bancard/Code100/SEBAOT.  
- AAB1 nunca almacena PAN ni CVV completos (tokenización vía Bancard).  
- Toda evidencia (hashes, IP, dispositivo, sesión, timestamps) se conserva de forma inmutable (S3 Object Lock).

---

## 2\. Arquitectura de agentes en Claude Code

Se propone un **agente orquestador** (tu sesión principal de Claude Code) que delega en **subagentes especializados** vía el mecanismo de subagents (`.claude/agents/*.md`), cada uno con su propio contexto, herramientas permitidas y responsabilidad acotada. Esto evita que un solo contexto gigante mezcle frontend, reglas de negocio e integraciones de pago/firma (que son las de mayor riesgo).

Orquestador (sesión principal)

├── frontend-ux            → construye las 12 pantallas (Next.js)

├── backend-core           → microservicios, motor de reglas, expediente

├── integraciones-mock     → adaptadores simulados de los 7 proveedores externos

├── integraciones-oficiales→ reemplaza mocks por APIs reales, mismo contrato

├── seguridad-cumplimiento → hashing, cifrado, reglas de bloqueo, auditoría

├── infra-devops           → Terraform, AWS (Aurora, ElastiCache, KMS, S3, WAF)

└── qa-testing             → pruebas E2E de las 9 pantallas \+ casos A/B

Los archivos de definición de cada subagente están en la carpeta `agentes-claude-code/` que acompaña este plan — cópialos a `.claude/agents/` dentro de tu repo y Claude Code los reconocerá automáticamente.

### Por qué separar así

- **frontend-ux** y **backend-core** avanzan en paralelo sin pisarse.  
- **integraciones-mock** se puede completar y demostrar (el "demo") sin esperar credenciales reales de Bancard/Code100/SEBAOT, que suelen tardar en gestionarse.  
- **integraciones-oficiales** solo reemplaza la implementación detrás de una interfaz ya validada — reduce el riesgo de romper el flujo cuando se conectan los proveedores reales.  
- **seguridad-cumplimiento** actúa como revisor transversal (puede invocarse desde cualquier otro agente para auditar una pieza de código antes de aceptarla), dado que las reglas de OTP/hash/PEP son las que tienen consecuencia legal directa.

---

## 3\. Fases de desarrollo (alineadas a tu cronograma de 10 semanas)

| Fase | Semanas | Agentes principales | Entregable |
| :---- | :---- | :---- | :---- |
| 1\. Setup y front-end | 1-2 | infra-devops, frontend-ux | AWS configurado, repos, P0-P3 maquetadas en Next.js con datos mock |
| 2\. Core y biometría | 3-5 | backend-core, integraciones-mock | Motor de OTP (Redis), reglas de elegibilidad, mock de Entrust (OCR/Liveness) |
| 3\. Firmas y pagos | 6-8 | backend-core, integraciones-mock → integraciones-oficiales | Regla atómica de firma, hash SHA-256, mocks de Bancard/Code100, primeras integraciones reales |
| 4\. QA y despliegue | 9-10 | qa-testing, seguridad-cumplimiento, infra-devops | E2E completo P0→P9 \+ A/B, auditoría OWASP, Go-Live |

**Recomendación de secuencia dentro de "demo":** primero cerrar el flujo completo con **todas las integraciones en mock** (fases 1-2 y parte de 3\) — eso ya es un demo mostrable y navegable de punta a punta. Recién después se van sustituyendo mocks por proveedores reales uno por uno, sin tocar el frontend ni el motor de reglas.

---

## 4\. Estrategia mock → oficial (patrón adaptador)

Cada integración externa se implementa detrás de una **interfaz de puerto** fija; el mock y la versión oficial son dos implementaciones intercambiables de esa misma interfaz. Un flag de entorno decide cuál se usa — no se toca el código que la consume.

INTEGRATION\_MODE=mock   →  usa MockOtpProvider, MockBiometricsProvider, etc.

INTEGRATION\_MODE=live   →  usa InfobipOtpProvider, EntrustBiometricsProvider, etc.

| Integración | Interfaz (puerto) | Mock (fase demo) | Oficial (fase producción) |
| :---- | :---- | :---- | :---- |
| OTP celular/correo | `OtpProvider.send()/verify()` | Genera código fijo o aleatorio en logs, sin envío real | Infobip WhatsApp API \+ Infobip 2FA Email / Amazon SES |
| Biometría e identidad | `IdentityProvider.verify(front, back, selfie)` | Devuelve resultado simulado configurable (aprobado/rechazado) con imágenes de prueba | Entrust Identity Verification (antes Onfido) |
| PEP / sanciones | `ComplianceProvider.screen(persona)` | Lista fija de nombres "positivos" para probar el bloqueo | ComplyAdvantage (o Sumsub si se unifica KYC+AML) |
| Pago | `PaymentProvider.charge()/generateQr()` | Simula QR y preautorización sin mover dinero real | Bancard vPOS 2.0 / Bancard QR |
| Firma electrónica | `SignatureProvider.sign(documents, otp)` | Marca los PDF como "firmados" sin certificado real | Code100 |
| Emisión de póliza | `PolicyIssuer.issue(expediente)` | Devuelve número de póliza simulado | SEBAOT |
| Custodia documental | `EvidenceStore.put(doc, hash)` | Guarda en S3 normal (sin Object Lock) en entorno de demo | Amazon S3 Object Lock (producción) |

**Contrato de pruebas:** el agente `integraciones-mock` debe escribir los mismos tests de contrato que luego correrán contra la integración oficial (mismos inputs/outputs esperados), de forma que `integraciones-oficiales` solo tenga que hacerlos pasar en verde con el proveedor real — sin reescribir lógica de negocio.

---

## 5. Mapa ampliado de integraciones y herramientas operativas

Fuente: `docs/Tabla de Integraciones externas - Tabla.csv` (30 filas, 6 categorías). Amplía la tabla de la sección 4: además de los 7 puertos del dominio (los únicos que `backend-core` puede consumir, según la regla dura de `CLAUDE.md`), el proyecto usa herramientas operativas/de infraestructura que **no** pasan por `src/adapters/` porque no participan del flujo transaccional del expediente — las gestiona directamente `infra-devops`, respetando igual la regla 7 de `CLAUDE.md` (nada de datos médicos, PEP, OTP en claro o pagos hacia analítica/CRM/IA).

Estados tal como vienen en la tabla de origen: `ESENCIAL` (para el demo), `INTERNO` (sin proveedor externo), `ALTERNATIVA` (a decidir), `PENDIENTE DE PRUEBA`, `YA DEFINIDO` (contrato/decisión ya tomada), `SEGUNDA FASE` / `DESPUÉS DEL PILOTO` (fuera del alcance de esta demo), `OPCIONAL`.

### 1 — Seguridad y verificación de canales

| # | Título | Plataforma | Puerto / responsable | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Acceso y protección del portal | Cloudflare (DNS, TLS, CDN, WAF, Turnstile) | No es puerto de dominio — perímetro, a cargo de `infra-devops` | ESENCIAL |
| 2 | Verificación del celular | Infobip (OTP WhatsApp + respaldo SMS) | `OtpProvider` — `integraciones-mock` / `integraciones-oficiales` | ESENCIAL |
| 3 | OTP por WhatsApp | Infobip WhatsApp API | `OtpProvider` | ESENCIAL |
| 4 | OTP por correo | Infobip 2FA Email (alt. Amazon SES) | `OtpProvider` | ESENCIAL |

### 2 — Producto, consentimiento e identidad

| # | Título | Plataforma | Puerto / responsable | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 5 | Presentación del producto y planes | Motor interno de SeguroLoTengo (tabla versionada) | No es puerto — catálogo a cargo de `backend-core` | INTERNO |
| 6 | Consentimientos legales | SeguroLoTengo + Amazon S3 Object Lock | `EvidenceStore` — `backend-core` + `infra-devops` | ESENCIAL |
| 7 | Captura de cédula | Entrust Identity Verification (antes Onfido) | `IdentityProvider` | ESENCIAL |
| 8 | Selfie y prueba de vida | Entrust / Onfido | `IdentityProvider` | ESENCIAL |
| 9 | Cédula paraguaya o de residente | Entrust + eventual fuente oficial | `IdentityProvider` | PENDIENTE DE PRUEBA — piloto con formato nuevo, anterior y cédula de residente antes de contratar |

### 3 — Cumplimiento y suscripción

| # | Título | Plataforma | Puerto / responsable | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 10 | Control PEP, sanciones y vinculados | ComplyAdvantage | `ComplianceProvider` | ESENCIAL |
| 11 | Alternativa unificada KYC + AML | Sumsub | `ComplianceProvider` (y potencialmente `IdentityProvider`) | ALTERNATIVA — decidir Sumsub vs. Entrust+ComplyAdvantage antes de `integraciones-oficiales` |
| 12 | Preguntas de salud | Formulario interno (reglas aprobadas por Alianza) | No es puerto — motor de elegibilidad de `backend-core` | INTERNO |
| 13 | Casos con salud o PEP positivo | Módulo interno (Jira Service Management opcional) | No es puerto — `case_id` de derivación a Pantalla A, `backend-core` | INTERNO EN MVP — no activa Bancard, Code100 ni SEBAOT |

### 4 — Pago, documentos y firma

| # | Título | Plataforma | Puerto / responsable | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 14 | Pago con tarjeta | Bancard vPOS 2.0 | `PaymentProvider` | YA DEFINIDO |
| 15 | Pago por QR | Bancard QR | `PaymentProvider` | YA DEFINIDO |
| 16 | Conciliación de pagos | Bancard + módulo interno | `PaymentProvider` + `backend-core` | ESENCIAL |
| 17 | Generación de Solicitud y FIPF | Servicio PDF interno | No es puerto — `backend-core` genera, `EvidenceStore` custodia | INTERNO |
| 18 | Firma del cliente | Code100 | `SignatureProvider` | YA DEFINIDO |
| 19 | Firma de Interseguros y Alianza | Code100 | `SignatureProvider` | YA DEFINIDO |
| 20 | Custodia de documentos firmados | Amazon S3 Object Lock | `EvidenceStore` — `infra-devops` | ESENCIAL |

### 5 — Emisión, entrega y renovación

| # | Título | Plataforma | Puerto / responsable | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 21 | Emisión de la póliza | SEBAOT | `PolicyIssuer` | YA DEFINIDO |
| 22 | Facturación electrónica | SEBAOT (sistema de Alianza) | `PolicyIssuer` | YA DEFINIDO |
| 23 | Entrega de póliza y factura | SEBAOT + Infobip | `PolicyIssuer` + `OtpProvider` (canal de entrega) | ESENCIAL |
| 24 | Descarga de Solicitud y FIPF | SeguroLoTengo + almacenamiento seguro | `EvidenceStore` — `backend-core` | INTERNO |
| 25 | Renovaciones | Infobip + SEBAOT + Bancard | `OtpProvider` + `PolicyIssuer` + `PaymentProvider` | SEGUNDA FASE — **fuera del alcance de la demo P0-P9 actual**, no confundir con R7 de la sección 6 |

### 6 — Operación, analítica y control (fuera de los 7 puertos)

Ninguna de estas cinco herramientas tiene un puerto de dominio propio porque no forman parte del expediente ni de su máquina de estados — son tooling operativo a cargo de `infra-devops`, sujeto igual a la regla 7 de `CLAUDE.md`.

| # | Título | Plataforma | Responsable | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 26 | Atención al cliente | HubSpot Service Hub (alt. Zendesk) | `infra-devops` | SEGUNDA FASE — datos mínimos, excluye salud, imágenes de cédula y expedientes PEP |
| 27 | Errores técnicos | Sentry | `infra-devops` | ESENCIAL — excluir PII y pantallas médicas de los eventos |
| 28 | Embudo y abandono | PostHog | `infra-devops` | DESPUÉS DEL PILOTO — no capturar cédula, salud, OTP ni pagos; desactivar replay en pantallas sensibles |
| 29 | Auditoría técnica | AWS CloudTrail | `infra-devops` | ESENCIAL |
| 30 | Automatizaciones administrativas | n8n | `infra-devops` | OPCIONAL — nunca controla la secuencia crítica pago→firma→emisión |

---

## 6. Marco de cumplimiento normativo (R1-R8)

Fuente: `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` (85 obligaciones, 8 categorías). Cada fila del CSV cita norma y artículo exactos — esta tabla resume por categoría para uso de orquestación; para el detalle artículo por artículo, leer el CSV directamente. `seguridad-cumplimiento` revisa el cumplimiento de las ocho categorías de forma transversal, como ya establece su definición de agente; acá se fija además **quién implementa** cada bloque y **en qué pantallas** aplica.

| Categoría | Ítems | Qué exige (síntesis) | Normativa principal | Pantallas / fase | Implementa |
| :---- | :---- | :---- | :---- | :---- | :---- |
| R1 · Identificación, oferta e información precontractual | 10 | Aclarar que SeguroLoTengo es marca/canal de Interseguros (no aseguradora); mostrar identidad y contactos de Alianza e Interseguros; solo productos registrados; código de registro del plan; coberturas/exclusiones/carencias/costos antes de contratar; acceso a póliza y condiciones antes de aceptar; explicar pasos y resolución de controversias; aceptación expresa (el silencio no vale); aclarar que la Solicitud no es una póliza emitida; premio final con IVA + desglose oficial de Alianza | Ley 4868/13, Ley 827/96, Ley 1334/98, Res. SS SG. 215/15 y 223/17, Código Civil | P0, P2, P3, P8 | `frontend-ux` (textos y UI) + `backend-core` (catálogo versionado con hash) |
| R2 · Consentimiento, identificación y repudio | 12 | Consentimiento inicial y comercial separados y no premarcados; OTP para probar control de WhatsApp/correo; verificación de identidad (cédula + selfie + prueba de vida); solo el titular puede contratar para sí mismo; FIPF completo; edad calculada automáticamente desde la cédula; pregunta de condición PEP; una respuesta PEP deriva a análisis, no rechaza automáticamente; declaraciones médicas claras y coherentes; protección especial de datos médicos y PEP; todo vinculado al mismo expediente digital | Ley 6822/21, Res. SEPRELAD 71/19 y 50/20, Ley 4868/13, Constitución Nacional, Código Civil | P1, P3, P4, P5, P6 | `backend-core` (OTP, expediente, elegibilidad) + `integraciones-mock`/`integraciones-oficiales` (`IdentityProvider`, `ComplianceProvider`) + `frontend-ux` (checkboxes y declaraciones) |
| R3 · Integración de pago con Bancard | 11 | Alianza titular del vPOS y receptora del premio; nunca almacenar PAN completo ni CVV; el importe a Bancard debe coincidir con el premio informado; preautorizar tarjeta antes de firmar y capturar después de firmar; en QR, pago antes de firma con información de la condición y devolución; recordatorios a 1h/5h/12h; devolución si no firma en el plazo comunicado; conservar ID/estado/fecha/importe/referencia; idempotencia contra cobros duplicados; referencia Bancard incorporada a la póliza | Ley 70/2020, Res. BCP 25/21, Ley 4868/13, Ley 1334/98, Código Civil, PCI-DSS (contractual) | P7 | `integraciones-mock`/`integraciones-oficiales` (`PaymentProvider`) + `backend-core` (conciliación, idempotencia) |
| R4 · Firma electrónica mediante Code100 | 9 | El cliente firma electrónicamente Solicitud y FIPF; documentos cerrados y con huella digital antes de firmar; un mismo enlace Code100 para ambos documentos; firma el cliente primero, luego Interseguros y Alianza en paralelo; Interseguros firma como intermediario; Alianza firma con firma electrónica cualificada; la factura electrónica la emite SIFEN, no Code100; vigencia de 24 horas del enlace de firma; evidencia Code100 completa (identidad, OTP, IP, hash, resultado) | Ley 6822/21, Res. SS SG. 215/15, Ley 4868/13, Ley 125/91 | P8 | `integraciones-mock`/`integraciones-oficiales` (`SignatureProvider`) + `backend-core` (regla atómica, hash SHA-256) |
| R5 · Aceptación, emisión y póliza | 10 | Secuencia firma confirmada → cobro → envío a Alianza → validación automática → emisión; si falla el cobro, no se pide la emisión automática; Alianza acepta y emite en su calidad de aseguradora; número de póliza de 18 dígitos; vincular póliza/Solicitud/FIPF/pago/firmas por correlativos o hashes; menciones obligatorias en la póliza; no iniciar cobertura antes de concluir válidamente el contrato; cobertura inicia 24h después del pago confirmado; mecanismo de verificación de autenticidad; no se genera Nota de Cobertura | Código Civil, Ley 827/96, Res. SS SG. 215/15, Ley 6822/21 | P7 → P9 | `integraciones-mock`/`integraciones-oficiales` (`PolicyIssuer`) + `backend-core` (orquestación, correlativos) |
| R6 · Entrega, documentos, factura y posventa | 11 | El cliente elige el canal de entrega; registrar evidencia de envío/recepción; permitir descargar Solicitud y FIPF al finalizar; entregar después póliza y factura emitidas por Alianza/SEBAOT; copia física a pedido; facturar a nombre del asegurado con RUC o cédula; factura electrónica válida vía SIFEN; mostrar contactos de reclamos/consultas/siniestros; indemnización por cáncer en 5 días hábiles; renta hospitalaria fija (mín. 24h, máx. 15 días por vigencia); gastos médicos por accidente como reembolso documentado | Res. SS SG. 215/15, Ley 4868/13, Ley 6822/21, Ley 2421/04, Ley 125/91, RG DNIT 01/24, Código Civil | P9 | `frontend-ux` (P9, contactos, descargas) + `integraciones-mock`/`integraciones-oficiales` (`PolicyIssuer`/SEBAOT) + `backend-core` |
| R7 · Desistimiento, cancelación y renovación | 11 | Informar el derecho de retracto; explicar cancelación y metodología de devolución; renovar solo con aceptación expresa anual; avisos 15 días antes, 3 días antes y al vencimiento; confirmar renovación con OTP; preguntar diagnóstico de cáncer y reclamos al renovar; FIPF anterior precargado, solo se editan cambios; pago hasta 24h después del vencimiento; impedir renovación con diagnóstico confirmado de cáncer; autorización opcional de publicidad; opt-out simple y gratuito | Ley 4868/13, Ley 1334/98, Código Civil, Ley 6822/21, Res. SEPRELAD 71/19, Res. SS SG. 215/15 | Renovación — **fuera del alcance de la demo actual** (la sección 5 marca "Renovaciones" como SEGUNDA FASE) | Backlog — retomar con `backend-core` + `integraciones-mock`/`integraciones-oficiales` + `frontend-ux` cuando se aborde la Fase 2 |
| R8 · Seguridad, conservación y auditoría | 11 | Registrar eventos de OTP, declaraciones, firma, pago, emisión y entrega; conservar expediente y evidencia el plazo aplicable (mínimo 5 años, SEPRELAD); hash individual de Solicitud, FIPF y póliza; infraestructura segura con respaldos, recuperación y evaluación de riesgos; separar ambientes de producción y pruebas con sus credenciales; formalizar contratos con Code100/Bancard/demás proveedores; gestión de incidentes y continuidad; validar firma de webhooks e impedir duplicados; roles y registro de acciones administrativas; privacidad desde el diseño y minimización de datos; informar cookies y permitir rechazar las no esenciales | Ley 6822/21, Res. SEPRELAD 71/19, Res. SS SG. 215/15, Res. BCP 25/21, Ley 4868/13, Constitución Nacional | Transversal a P1-P9 + consola administrativa | `infra-devops` (S3 Object Lock, KMS, backups, CloudTrail, separación de ambientes) + `backend-core` (hashing, `EvidenceStore`, roles) — coordina `seguridad-cumplimiento` |

**Nota sobre R7:** la tabla de integraciones (sección 5, ítem 25) marca "Renovaciones" como `SEGUNDA FASE`. Ninguna de las 12 pantallas de `ESPECIFICACION_PANTALLAS.md` ni el flujo P0-P9 actual cubre renovación — es backlog documentado, no una omisión. No implementar sin que el usuario abra explícitamente esa sesión.

---

## 7. Próximos pasos sugeridos

1. Copiar los archivos de `agentes-claude-code/` a `.claude/agents/` en tu repositorio.  
2. Abrir Claude Code en el repo y pedirle: *"Actúa como orquestador: usa el agente frontend-ux para maquetar P0 a P3 con datos mock, y el agente infra-devops para dejar Terraform listo con Aurora, Redis y S3."*  
3. Validar el flujo completo en modo `INTEGRATION_MODE=mock` antes de gestionar credenciales reales con Infobip, Entrust, Bancard, Code100 y SEBAOT.  
4. Ir migrando integración por integración a `live`, agente por agente, sin tocar frontend ni motor de reglas.  
5. Antes de cerrar cualquier módulo, contrastarlo contra la fila de la sección 5 (integración correspondiente) y las categorías R1-R8 de la sección 6 que le apliquen — pedir revisión a `seguridad-cumplimiento` cuando toque OTP, hashing, PEP, firma o pagos, como ya indica su propia definición de agente.

