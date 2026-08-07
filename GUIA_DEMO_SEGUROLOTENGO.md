# Guía maestra — Demo SeguroLoTengo sobre AWS con Claude Code

**Operador tecnológico:** AAB1 · **Marca:** SeguroLoTengo.com (canal digital de Interseguros S.A.) · **Aseguradora:** Alianza Garantía **Fuente de verdad funcional:** `Pantallas_Sistema_Demo.pdf` — 12 pantallas. Todo lo demás (arquitectura, cumplimiento, PIA/DPIA, propuesta técnica) es contexto de apoyo, pero **si algo contradice al PDF, manda el PDF**.

---

## 0\. Decisión de fondo: qué stack usar para el demo

Tu propuesta técnica define el stack de **producción**: Aurora PostgreSQL Serverless v2, ElastiCache Redis, ECS/microservicios en Go o NestJS, S3 Object Lock, KMS, Cloudflare. Es el stack correcto para operar de verdad.

Pero para un **demo a la brevedad**, ese stack te cuesta entre 3 y 5 días solo de infraestructura (VPC, subnets, NAT Gateway, security groups, parameter groups, cluster de Aurora, ECS task definitions...) y genera costo fijo aunque nadie lo use. Para mostrar el flujo a Interseguros y Alianza eso no aporta nada visible.

**Recomendación: dos vías, con el mismo código de aplicación.**

|  | Vía A — Demo (recomendada ahora) | Vía B — Producción (después) |
| :---- | :---- | :---- |
| Hosting | AWS Amplify Hosting (Next.js 15 SSR nativo, CI/CD desde Git, HTTPS y dominio automáticos) | ECS Fargate detrás de ALB \+ Cloudflare |
| Backend | Route Handlers de Next.js (mismo repo) | Microservicios Go/NestJS desacoplados |
| Base de datos | DynamoDB (tabla única, sin VPC) | Aurora PostgreSQL Serverless v2 |
| Caché / OTP | DynamoDB con TTL nativo | ElastiCache Redis |
| Documentos | S3 estándar (bucket de demo) | S3 con Object Lock (retención legal) |
| Cifrado | SSE-S3 / KMS gestionado | KMS con llaves propias (CMK) |
| Integraciones | **100% mock** (Infobip, Entrust, ComplyAdvantage, Bancard, Code100, SEBAOT) | APIs oficiales |
| Tiempo de puesta en pie | \~4 horas | \~1 semana |
| Costo mensual aproximado | Unos pocos dólares (casi todo dentro de free tier) | Según tráfico y horas de Aurora |

La clave para que esto no sea trabajo tirado: **todo acceso a datos y a proveedores externos pasa por interfaces (puertos)**. DynamoDB y los mocks son implementaciones intercambiables. Migrar a la Vía B es reemplazar adaptadores, no reescribir el flujo, las pantallas ni las reglas de negocio.

Amplify Hosting soporta Next.js hasta la versión 15 con SSR, API routes y middleware sobre su plataforma de cómputo, con logs en CloudWatch. Fija Next.js 15 (no 16\) para evitar sorpresas de compatibilidad.

---

## 1\. Claude Code para quien viene de Antigravity

Antigravity y Claude Code resuelven lo mismo (un agente que escribe código en tu repo) pero el modelo mental cambia en tres puntos:

**1\. `CLAUDE.md` es la constitución del repo.** Se lee al inicio de cada sesión. Ahí van las reglas que no se negocian: reglas de negocio del expediente, prohibición de guardar OTP en claro, regla atómica de firma, convenciones de código, comandos de build y test. Todo lo que en Antigravity repetías en cada prompt, aquí se escribe una vez. Se genera con `/init` y se refina con `/memory`. **Este es el 80% de la calidad del resultado** — si el `CLAUDE.md` es flojo, todo lo demás compensa mal.

**2\. Modo plan antes de escribir.** `/plan` hace que Claude investigue y proponga un plan *sin tocar archivos*; recién cuando lo apruebas, ejecuta. Para tareas de más de un archivo, empezar sin plan es la causa número uno de resultados que hay que tirar.

**3\. Subagentes \= contextos aislados.** Los archivos en `.claude/agents/*.md` (los siete que ya te armé) definen agentes con su propia ventana de contexto y su propio set de herramientas. Claude delega en ellos automáticamente, o se los pides explícitamente ("usá el agente frontend-ux para..."). Sirven para que el contexto de infraestructura no contamine el de UI. Pueden correr hasta 10 en paralelo.

**Comandos que vas a usar todos los días:**

| Comando | Para qué |
| :---- | :---- |
| `/init` | Genera el `CLAUDE.md` inicial escaneando el repo |
| `/memory` | Editar el `CLAUDE.md` sin salir de la sesión |
| `/plan` | Modo plan: investiga y propone antes de tocar código |
| `/context` | Ver qué está ocupando la ventana de contexto |
| `/compact` | Comprimir la conversación cuando se alarga |
| `/clear` | Empezar limpio (usalo entre tareas no relacionadas) |
| `/permissions` | Definir qué puede hacer sin pedirte permiso |
| `/code-review` | Revisión del diff actual buscando bugs |
| `/security-review` | Escaneo de vulnerabilidades — usalo antes de cada entrega |
| `/rewind` | Volver a un checkpoint anterior |
| `/cost` | Cuánto llevás gastado en la sesión |

**Instalación:** `npm install -g @anthropic-ai/claude-code`, luego `claude` dentro del repo. Verificá con `/doctor`.

**Higiene de sesión (importante):** una tarea \= una sesión. Cuando termines de maquetar P5 y vayas a tocar Terraform, hacé `/clear`. El contexto arrastrado de una tarea anterior degrada la siguiente.

---

## 2\. Arquitectura del demo

                     ┌─────────────────────────────┐

   Navegador  ───────▶  Amplify Hosting (CloudFront) │

                     │   Next.js 15 · App Router     │

                     │   ├── /app  (12 pantallas)    │

                     │   ├── /app/api (Route Handlers)│

                     │   └── /app/demo-panel  ◀── panel de control del demo

                     └────────────┬────────────────┘

                                  │

              ┌───────────────────┼───────────────────┐

              ▼                   ▼                   ▼

      ┌───────────────┐   ┌──────────────┐   ┌────────────────┐

      │  DynamoDB     │   │      S3      │   │  Adaptadores   │

      │  expedientes  │   │  evidencias  │   │  (mock | live) │

      │  \+ OTP con TTL│   │  \+ PDFs      │   └───────┬────────┘

      └───────────────┘   └──────────────┘           │

                                    ┌────────────────┴──────────────────┐

                                    │ OtpProvider · IdentityProvider    │

                                    │ ComplianceProvider · PaymentProv. │

                                    │ SignatureProvider · PolicyIssuer  │

                                    │ EvidenceStore                     │

                                    └───────────────────────────────────┘

### Máquina de estados del expediente

Todo el demo gira alrededor de un único objeto `Expediente` con un estado explícito. Las 12 pantallas son vistas de ese estado, y las transiciones son las únicas formas legítimas de avanzar.

INICIADO

  └─(P1: OTP WhatsApp verificado)──▶ CANAL\_WA\_VERIFICADO

        └─(P2: plan elegido \+ hash oferta)──▶ PLAN\_SELECCIONADO

              └─(P3: autorización inicial)──▶ AUTORIZADO

                    └─(P4: OTP correo verificado)──▶ CANAL\_EMAIL\_VERIFICADO

                          └─(P5: OCR \+ liveness \+ face match OK, edad 18-64)──▶ IDENTIDAD\_VERIFICADA

                                ├─(P6: alguna declaración incompatible o PEP=Sí)──▶ DERIVADO\_MANUAL ──▶ \[Pantalla A\] ⛔ FIN

                                └─(P6: todas compatibles)──▶ DECLARACIONES\_OK

                                      └─(P7: QR pagado | tarjeta preautorizada)──▶ PAGO\_CONFIRMADO

                                            └─(genera 2 PDF cerrados \+ hash SHA-256)──▶ PAQUETE\_GENERADO

                                                  ├─(24h sin firmar)──▶ VENCIDO ──▶ DEVOLUCION\_EN\_TRAMITE ──▶ \[Pantalla B\]

                                                  └─(P8: firma Code100, atómica)──▶ FIRMADO

                                                        └─(SEBAOT emite)──▶ EMITIDO ──▶ \[P9\] ✅

**Invariantes que el código debe hacer imposibles de violar (no solo "no hacerlas"):**

1. `DERIVADO_MANUAL` no tiene transición hacia pago, firma ni emisión. La derivación por salud/PEP es terminal en el flujo digital.  
2. La firma es atómica: Solicitud y FIPF se firman en una sola operación o ninguna. No existe estado intermedio "uno firmado".  
3. Existen **tres OTP criptográficamente independientes**: celular (P1), correo (P4) y firma (P8). Nunca se reutiliza uno para otro propósito.  
4. En la base solo vive el **hash** del OTP, nunca el código. Vigencia 5 min, máximo 3 intentos, reenvío bloqueado 60 s.  
5. Los PDF se cierran y se hashean **antes** de habilitar la firma. Cualquier cambio posterior invalida el paquete y obliga a regenerar versión y hashes.  
6. Nunca se persiste PAN completo ni CVV, en ninguna capa, incluidos logs.  
7. Las respuestas médicas y la condición PEP no salen hacia analítica, CRM, monitoreo de errores ni servicios de IA.

### Modelo de datos (DynamoDB, tabla única)

| PK | SK | Contenido |
| :---- | :---- | :---- |
| `EXP#<id>` | `META` | estado, plan, hash de oferta, timestamps, versión de textos legales |
| `EXP#<id>` | `IDENTIDAD` | datos OCR, resultados de liveness/face match, referencias de imágenes en S3 |
| `EXP#<id>` | `DECLARACIONES` | las 8 respuestas de P6 \+ KYC complementario (campo cifrado) |
| `EXP#<id>` | `PAGO` | referencia Bancard, monto, estado, modalidad, idempotency key |
| `EXP#<id>` | `PAQUETE` | códigos PROP-xxxxx y FIPF-xxxxx, hashes SHA-256, versión |
| `EXP#<id>` | `EVIDENCIA#<ts>` | append-only: IP, dispositivo, sesión, acción, resultado |
| `OTP#<hash-destino>` | `<proposito>` | hash del OTP, intentos, expiración (atributo TTL de DynamoDB) |

El TTL nativo de DynamoDB reemplaza a Redis para la caducidad de los OTP en el demo, sin costo ni VPC.

---

## 3\. El Panel de Demo (la pieza que hace vendible la presentación)

Ruta oculta `/demo-panel`, protegida por una clave simple en variable de entorno. Es lo que convierte un prototipo en una demostración controlable frente al cliente.

**Debe permitir:**

- **Elegir persona de prueba** antes de iniciar el flujo:  
  - *Mónica Mariana Gorena Tapia · C.I. 9.323.336* → camino feliz completo hasta P9 (es la persona que figura en tus pantallas).  
  - *Persona PEP* → declaración 8 en Sí, dispara Pantalla A.  
  - *Persona con salud incompatible* → declaraciones 1/2/3 incompatibles, dispara Pantalla A.  
  - *Persona con biometría rechazada* → P5 bloquea, no permite avanzar.  
  - *Persona que no firma* → paga en P7 y deja vencer, dispara Pantalla B.  
- **Ver los OTP generados en pantalla** (en el demo no hay WhatsApp real; el presentador necesita leer el código).  
- **Acelerar el reloj**: el plazo de 24 h de firma se comprime a 60 segundos configurables, para poder mostrar Pantalla B en vivo.  
- **Forzar fallos puntuales**: OTP expirado, 3 intentos agotados, timeout de Bancard, rechazo de Code100.  
- **Reiniciar el expediente** en un clic, para volver a correr la demo sin recargar nada.  
- **Ver el registro de evidencia** del expediente actual (hashes, timestamps, IP, dispositivo) — esto impresiona en una demo a un área de cumplimiento mucho más que la UI.

**Regla:** el panel vive detrás del flag `DEMO_MODE=true` y se compila fuera del bundle cuando el flag está apagado. No puede existir en producción.

---

## 4\. Estrategia de mocks: mismos contratos, dos implementaciones

// src/ports/otp.ts  — el contrato NO cambia entre mock y oficial

export interface OtpProvider {

  send(destino: string, proposito: 'CELULAR' | 'CORREO' | 'FIRMA'): Promise\<EnvioResult\>;

  verify(destino: string, proposito: Proposito, codigo: string): Promise\<VerifyResult\>;

}

INTEGRATION\_MODE=mock  →  MockOtpProvider, MockIdentityProvider, ...

INTEGRATION\_MODE=live  →  InfobipOtpProvider, EntrustIdentityProvider, ...

Con flags granulares por proveedor (`INTEGRATION_OTP=live`, `INTEGRATION_PAYMENT=mock`) podés migrar de a uno sin tocar el resto.

| Puerto | Mock (demo) | Oficial (producción) |
| :---- | :---- | :---- |
| `OtpProvider` | Genera el código y lo expone en el panel de demo; respeta vigencia, intentos y bloqueo reales | Infobip WhatsApp API \+ fallback SMS; Infobip 2FA Email o Amazon SES |
| `IdentityProvider` | Acepta imágenes de prueba, devuelve resultado configurable (aprobado / calidad insuficiente / edad fuera de rango / no coincide) | Entrust Identity Verification (ex Onfido): OCR \+ liveness \+ face match |
| `ComplianceProvider` | Lista fija de documentos "positivos" para PEP y sanciones | ComplyAdvantage (o Sumsub si se unifica KYC+AML) |
| `PaymentProvider` | Genera un QR de prueba con delay simulado; nunca mueve dinero | Bancard vPOS 2.0 y Bancard QR, con tokenización e idempotencia |
| `SignatureProvider` | Marca ambos PDF como firmados con timestamp simulado, respetando atomicidad | Code100: firma no cualificada del cliente por OTP, cualificada de Interseguros/Alianza |
| `PolicyIssuer` | Devuelve número de póliza simulado, estado "en emisión" → "emitida" | SEBAOT |
| `EvidenceStore` | S3 estándar en bucket de demo | S3 con Object Lock en modo compliance |

**Los mocks se escriben con los mismos tests de contrato que correrán después contra el proveedor real.** Ese es el mecanismo que garantiza que cambiar de mock a oficial no rompa el flujo.

---

## 5\. Configuración de AWS — paso a paso

Ya tenés cuenta. Estos son los pasos concretos, en orden. Los que impliquen credenciales o pagos los hacés vos en la consola; el resto lo puede ejecutar Claude Code por vos vía Terraform.

### 5.1 Preparar la cuenta (30 min, manual, una sola vez)

1. **Región:** elegí `us-east-1` (mayor disponibilidad de servicios y menor latencia relativa desde Paraguay que las europeas). Anotala; todo va ahí.  
2. **No uses root.** Activá IAM Identity Center y creá un usuario administrativo para vos. Guardá el root con MFA y no lo toques más.  
3. **Usuario/rol para Claude Code:** creá un rol (o usuario IAM si no vas a usar SSO) llamado `aab1-demo-deployer` con permisos acotados a: DynamoDB, S3, Amplify, IAM (limitado a crear roles de servicio del proyecto), CloudWatch Logs y Secrets Manager. Nada de `AdministratorAccess`.  
4. **AWS Budgets:** presupuesto mensual con alertas al 50 / 80 / 100 %. Hacelo antes de crear el primer recurso, no después.  
5. **CloudTrail:** activalo en la región. Es gratis para el trail de gestión y te da la trazabilidad que el PIA/DPIA exige.

### 5.2 Configurar credenciales locales (10 min)

\# Instalar AWS CLI v2 y verificar

aws \--version

\# Con IAM Identity Center (recomendado)

aws configure sso \--profile aab1-demo

\# O con claves estáticas (si no usás SSO)

aws configure \--profile aab1-demo

\# Verificar que funciona — esto es lo que Claude Code va a usar

aws sts get-caller-identity \--profile aab1-demo

Claude Code lee la cadena de credenciales estándar del SDK de AWS: `~/.aws/credentials` y `~/.aws/config`. Exportá `AWS_PROFILE=aab1-demo` en tu shell antes de abrir `claude`.

> Ojo con la precedencia: si tenés `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` sueltos en el entorno, van a pisar al perfil. Limpialos si querés que mande `AWS_PROFILE`.

### 5.3 Infraestructura del demo (Terraform, lo ejecuta Claude Code)

Recursos a crear — pedíselos al agente `infra-devops`:

| Recurso | Configuración |
| :---- | :---- |
| Tabla DynamoDB `slt-demo-expedientes` | On-demand, PK `pk` / SK `sk`, TTL habilitado en atributo `expiresAt`, cifrado en reposo activado |
| Bucket S3 `slt-demo-evidencias-<sufijo>` | Bloqueo total de acceso público, versionado activado, SSE-S3, política de ciclo de vida a 90 días (es demo) |
| Rol IAM de ejecución para Amplify | Permisos mínimos: leer/escribir esa tabla y ese bucket, escribir logs |
| Secrets Manager | Un secreto con la clave del panel de demo y el pepper de hashing de OTP |
| App de Amplify Hosting | Conectada al repo Git, plataforma `WEB_COMPUTE`, rama `main` → producción del demo, rama `develop` → preview |
| CloudWatch Log Group | Retención 7 días (demo) |

**Nada de VPC, NAT Gateway ni Aurora en la Vía A.** Es exactamente lo que te ahorra los días.

### 5.4 Variables de entorno en Amplify

DEMO\_MODE=true

DEMO\_PANEL\_KEY=\<referencia a Secrets Manager\>

INTEGRATION\_MODE=mock

AWS\_REGION=us-east-1

DDB\_TABLE=slt-demo-expedientes

S3\_BUCKET=slt-demo-evidencias-\<sufijo\>

OTP\_TTL\_SECONDS=300

OTP\_MAX\_ATTEMPTS=3

OTP\_RESEND\_COOLDOWN\_SECONDS=60

FIRMA\_PLAZO\_SECONDS=86400   \# el panel lo puede bajar a 60 para la demo

### 5.5 Dominio

Para la presentación, `https://main.<id>.amplifyapp.com` alcanza. Si querés algo más presentable, un subdominio tipo `demo.segurolotengo.com` apuntado por CNAME desde donde tengas el DNS; Amplify emite el certificado.

---

## 6\. Plan de ejecución día a día

Supone una persona trabajando con Claude Code. **Hito visible el día 5**: flujo completo navegable. **Entregable pulido el día 10\.**

### Día 1 — Fundaciones

- Crear repo Git y correr `npx create-next-app@latest` con TypeScript, App Router y Tailwind, fijando Next.js 15\.  
- Copiar `CLAUDE.md`, `docs/ESPECIFICACION_PANTALLAS.md` y `.claude/agents/*` al repo.  
- Abrir `claude`, correr `/init` y refinar el `CLAUDE.md` generado contra el que te dejo.  
- Definir el sistema de diseño: paleta (azul institucional, naranja de acción, verde de confirmación, rojo de bloqueo, fondo hueso), tipografía, y los tres componentes que se repiten en las 12 pantallas: **cabecera de aseguradora/intermediario**, **stepper "Paso N de 9"**, **barra de plan seleccionado**.  
- Definir tipos TypeScript de `Expediente` y la máquina de estados.

### Día 2 — Infraestructura \+ puertos

- Terraform para todo lo de 5.3; `terraform plan`, revisar, `apply`.  
- Primer deploy de "hola mundo" a Amplify para validar la cadena completa Git → build → URL pública.  
- Escribir las 7 interfaces de puerto y los tests de contrato (vacíos, en rojo).

### Día 3 — Pantallas P0, P1, P2

- P0 landing informativa (sin PII, sin contador).  
- P1 verificación de WhatsApp \+ `MockOtpProvider` funcionando de punta a punta, con hash en DynamoDB, TTL, límite de 3 intentos y cooldown de 60 s.  
- P2 selección de plan con los tres planes, sus coberturas exactas y el hash SHA-256 de la versión de la oferta.

### Día 4 — Pantallas P3, P4, P5

- P3 checklist de cinco requisitos \+ registro del consentimiento inicial con versión de texto, IP, dispositivo y timestamp.  
- P4 verificación de correo (segundo OTP, independiente del primero).  
- P5 captura de cédula y selfie con `MockIdentityProvider`: campos autocompletados no editables, cálculo automático de edad, validación de rango 18-64, checkbox de autorización biométrica.

### Día 5 — 🎯 Hito: flujo navegable

- P6 datos complementarios \+ las 8 declaraciones con el motor de elegibilidad y la derivación automática.  
- Pantalla A completa.  
- Panel de demo v1: selector de persona de prueba y visualización de OTP.  
- **Primera demo interna posible.**

### Día 6 — Pago

- P7 con `MockPaymentProvider`: modalidad QR (pago definitivo antes de firmar) y modalidad tarjeta (preautorización), con sus flujos posteriores distintos.  
- Declaración de origen lícito de fondos como bloqueante.  
- Idempotencia y referencia de operación.

### Día 7 — Documentos y firma

- Generación de los dos PDF (`PROP-00018425` y `FIPF-00018425`, mismo correlativo, prefijos distintos) con hash SHA-256 y QR de verificación.  
- P8 con `MockSignatureProvider`: selección de canal, envío del enlace, firma atómica de ambos documentos.  
- Timer de 24 h y disparo de Pantalla B.

### Día 8 — Cierre y excepciones

- P9 confirmación con `MockPolicyIssuer` (SEBAOT simulado) y descarga de Solicitud y FIPF firmados.  
- Pantalla B completa con timeline de recordatorios (1 h / 5 h / 12 h / vencimiento) y procedimiento de devolución.  
- Panel de demo v2: reloj acelerado y forzado de fallos.

### Día 9 — QA y evidencia

- Correr los 7 escenarios E2E del agente `qa-testing`.  
- Visor de evidencia dentro del panel (hashes, timestamps, cadena completa del expediente).  
- `/security-review` y revisión del agente `seguridad-cumplimiento` sobre todo el repo.

### Día 10 — Pulido de presentación

- Responsive móvil (el producto es B2C, la mayoría del tráfico será celular).  
- Estados de carga y errores con mensajes reales, no genéricos.  
- Guion de demo escrito: qué mostrar, en qué orden, qué persona de prueba usar en cada momento.  
- Deploy final y ensayo completo cronometrado.

---

## 7\. Cómo trabajar cada día con Claude Code

Patrón repetible para cada pantalla:

1\. /clear                          ← contexto limpio

2\. /plan                           ← modo plan

3\. "Implementá la Pantalla P5 según docs/ESPECIFICACION\_PANTALLAS.md

    sección P5. Usá los componentes compartidos que ya existen en

    src/components/shared. No inventes campos que no estén en la

    especificación."

4\. Revisar el plan, corregir lo que haga falta, aprobar.

5\. Dejar que ejecute.

6\. /code-review                    ← revisión del diff

7\. Probar en local, ajustar.

8\. Commit \+ push → Amplify despliega solo.

**Dos hábitos que marcan la diferencia:**

- **Nunca le pidas "hacé el flujo completo".** Una pantalla por sesión. El resultado de pedir todo junto es código que compila y no cumple la mitad de las reglas.  
- **Cuando corrija algo que va a volver a pasar, mandalo al `CLAUDE.md`** con `/memory`. Si tuviste que decirle dos veces que los campos de P5 no son editables, esa regla pertenece al archivo, no al chat.

---

## 8\. Del demo a producción

Cuando el demo esté aprobado y lleguen las credenciales reales, el orden de migración es de menor a mayor riesgo:

1. **Infobip** (OTP) — el más simple y el que más credibilidad agrega, porque el cliente recibe el WhatsApp de verdad.  
2. **Entrust** — validar el piloto pendiente con cédula paraguaya formato nuevo, formato anterior y cédula de residente antes de comprometer nada.  
3. **ComplyAdvantage** — screening PEP y sanciones.  
4. **Bancard** — sandbox primero, con las llaves de idempotencia ya probadas contra el mock.  
5. **Code100** — validar certificado y cadena de confianza; es la pieza con mayor peso legal (Ley 6822/2021).  
6. **SEBAOT** — emisión y facturación.  
7. **S3 Object Lock** — recién acá se activa la retención legal real.

En paralelo, la migración de infraestructura Vía A → Vía B: DynamoDB → Aurora, TTL → Redis, Amplify → ECS Fargate. Como todo pasa por repositorios y puertos, es trabajo de adaptadores, no de reescritura.

---

## 9\. Riesgos del demo y cómo mitigarlos

| Riesgo | Mitigación |
| :---- | :---- |
| El cliente confunde el demo con un sistema en producción | Banda visible permanente "ENTORNO DE DEMOSTRACIÓN — integraciones simuladas" en todas las pantallas del demo |
| Datos de prueba con apariencia real generan expectativa legal | Usar solo las personas de prueba definidas; nunca cargar datos de personas reales en el entorno de demo |
| El demo se cae en vivo | Ensayo completo cronometrado el día 10; tener capturas de respaldo de cada pantalla |
| Se filtra el panel de demo | Detrás de flag de compilación \+ clave en Secrets Manager; no existe en el build de producción |
| Costos inesperados de AWS | Budgets con alerta desde el día 1; ciclo de vida de 90 días en S3; DynamoDB on-demand |
| El demo acumula deuda que después hay que tirar | La capa de puertos es innegociable: si algo llama directo a un proveedor o a DynamoDB sin pasar por su puerto, se rechaza en revisión |

