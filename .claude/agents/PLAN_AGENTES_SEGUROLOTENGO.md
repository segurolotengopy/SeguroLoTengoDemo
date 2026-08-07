# Plan de Agentes en Claude Code — Demo Sistema Integrado SeguroLoTengo (AAB1)

**Basado en:** las 12 pantallas del flujo (`Pantallas_Sistema_Demo.pdf`) \+ documentación de arquitectura, cumplimiento y propuesta técnica del Drive del proyecto.

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

## 5\. Próximos pasos sugeridos

1. Copiar los archivos de `agentes-claude-code/` a `.claude/agents/` en tu repositorio.  
2. Abrir Claude Code en el repo y pedirle: *"Actúa como orquestador: usa el agente frontend-ux para maquetar P0 a P3 con datos mock, y el agente infra-devops para dejar Terraform listo con Aurora, Redis y S3."*  
3. Validar el flujo completo en modo `INTEGRATION_MODE=mock` antes de gestionar credenciales reales con Infobip, Entrust, Bancard, Code100 y SEBAOT.  
4. Ir migrando integración por integración a `live`, agente por agente, sin tocar frontend ni motor de reglas.

