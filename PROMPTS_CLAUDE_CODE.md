# Secuencia de prompts para Claude Code — Demo SeguroLoTengo

Copiá y pegá en orden. Antes de cada bloque nuevo: `/clear`. Para cualquier prompt marcado con 🗺️, entrá primero en modo plan con `/plan`, revisá la propuesta y recién después aprobá.

---

## Preparación (una sola vez)

npm install \-g @anthropic-ai/claude-code

mkdir segurolotengo-demo && cd segurolotengo-demo

git init

npx create-next-app@latest . \--typescript \--tailwind \--app \--eslint

\# copiar los archivos que preparé:

\#   CLAUDE.md                          → raíz del repo

\#   docs/ESPECIFICACION\_PANTALLAS.md   → docs/

\#   agentes-claude-code/\*.md           → .claude/agents/

\#   Pantallas\_Sistema\_Demo.pdf         → docs/

export AWS\_PROFILE=aab1-demo

claude

Dentro de Claude Code, primera sesión:

/doctor

/permissions

En `/permissions`, permitir sin preguntar: `Read`, `Grep`, `Glob`, `Bash(npm run *)`, `Bash(git status)`, `Bash(git diff)`. Dejar en modo pregunta: `Write`, `Edit`, `Bash(terraform *)`, `Bash(aws *)`, `Bash(git push)`.

---

## Día 1 — Fundaciones

**1.1 — Verificar el contexto**

Leé CLAUDE.md y docs/ESPECIFICACION\_PANTALLAS.md completos. Después

resumime en 10 líneas cuál es el flujo, cuáles son las reglas que no se

pueden violar, y qué pantallas están fuera del contador de 9 pasos.

No escribas código todavía.

Si el resumen tiene algo mal, corregilo ahora — todo lo que sigue depende de esto.

**1.2 🗺️ — Sistema de diseño y componentes compartidos**

Creá el sistema de diseño base y los tres componentes compartidos que

aparecen en todas las pantallas:

1\. HeaderInstitucional: bloque aseguradora (Alianza Garantía) \+ bloque

   intermediario (Interseguros) \+ slot para el indicador de paso.

2\. StepperPasos: 9 puntos, prop \`pasoActual\`, más variantes para P0,

   Pantalla A y Pantalla B que no llevan contador.

3\. BarraPlanSeleccionado: check, nombre del plan, premio anual con IVA,

   enlace configurable a la derecha.

Definí también los tokens de color en Tailwind: azul institucional para

títulos, naranja para acciones y alertas, verde para confirmaciones y

seguridad, rojo para bloqueos, fondo hueso.

Mobile-first. Nada de lógica de negocio en estos componentes.

**1.3 🗺️ — Dominio y máquina de estados**

Implementá src/domain/ con:

\- Los tipos del Expediente y de todos sus sub-objetos (identidad,

  declaraciones, pago, paquete documental, evidencia).

\- La máquina de estados exacta que está en CLAUDE.md, con una única

  función de transición que valide qué transiciones son legales.

\- El motor de elegibilidad de P6: las 8 declaraciones con su respuesta

  habilitante; una respuesta incompatible en 1, 2, 3 u 8 lleva a

  DERIVADO\_MANUAL, que es terminal.

\- Tests unitarios que prueben que NO se puede transicionar desde

  DERIVADO\_MANUAL hacia pago, firma ni emisión.

TypeScript estricto, sin \`any\`.

---

## Día 2 — Infraestructura y puertos

**2.1 🗺️ — Terraform**

Usá el agente infra-devops.

Escribí infra/ en Terraform para la vía demo, región us-east-1:

\- Tabla DynamoDB \`slt-demo-expedientes\`: on-demand, PK \`pk\`, SK \`sk\`,

  TTL en el atributo \`expiresAt\`, cifrado en reposo.

\- Bucket S3 \`slt-demo-evidencias-\<sufijo aleatorio\>\`: acceso público

  bloqueado, versionado, SSE-S3, ciclo de vida a 90 días.

\- Rol IAM de ejecución para Amplify con permisos mínimos sobre esa

  tabla y ese bucket, más logs.

\- Secret en Secrets Manager para DEMO\_PANEL\_KEY y el pepper de OTP.

\- App de Amplify Hosting, plataforma WEB\_COMPUTE, rama main.

\- Log group de CloudWatch con retención de 7 días.

Sin VPC, sin NAT Gateway, sin Aurora. Mostrame el \`terraform plan\`

antes de aplicar nada.

**2.2 — Puertos y tests de contrato**

Creá src/ports/ con las 7 interfaces: OtpProvider, IdentityProvider,

ComplianceProvider, PaymentProvider, SignatureProvider, PolicyIssuer,

EvidenceStore.

Para cada una, escribí el test de contrato en

src/ports/\_\_tests\_\_/\<puerto\>.contract.ts: una suite parametrizable que

reciba cualquier implementación y verifique el comportamiento esperado.

Estos mismos tests correrán después contra los proveedores oficiales.

Creá también src/adapters/index.ts con la resolución por variable de

entorno (INTEGRATION\_MODE global y flags granulares por proveedor).

**2.3 — Repositorios**

Implementá src/repositories/ para DynamoDB y S3 según el modelo de tabla

única. Recordá: nada fuera de esta carpeta puede importar el SDK de AWS.

Incluí el repositorio de OTP usando TTL nativo de DynamoDB, guardando

solo el hash con pepper.

---

## Día 3 — P0, P1, P2

**3.1**

Implementá la Pantalla P0 según docs/ESPECIFICACION\_PANTALLAS.md

sección "P0 · Información". Usá los componentes compartidos. Sin PII,

sin contador de pasos.

**3.2 🗺️**

Implementá la Pantalla P1 (verificación de WhatsApp) según la

especificación, más:

\- MockOtpProvider funcionando de punta a punta.

\- Route Handlers para enviar y verificar el OTP.

\- Persistencia en DynamoDB del hash con TTL de 300s, contador de

  intentos con máximo 3, y cooldown de reenvío de 60s.

\- Registro de evidencia: fecha, hora, IP, número enmascarado,

  referencia de envío y resultado.

El código del OTP NO puede aparecer en ninguna respuesta de la API del

flujo ni en logs. Escribí el test que lo verifique.

**3.3**

Implementá la Pantalla P2 (selección de plan) según la especificación.

Los valores de los tres planes van en una tabla versionada en

src/domain/catalogo.ts, no hardcodeados en el componente. Al seleccionar

plan, guardá el ID de versión de la oferta y su hash SHA-256 en el

expediente.

---

## Día 4 — P3, P4, P5

**4.1**

Implementá la Pantalla P3 según la especificación. El registro del

consentimiento inicial debe guardar: texto completo, versión, IP,

dispositivo, sesión y timestamp, de forma append-only.

**4.2**

Implementá la Pantalla P4 (verificación de correo). Reutilizá el motor

de OTP de P1 pero con propósito CORREO. Escribí un test que verifique

que el OTP de correo y el de celular son distintos y no intercambiables.

**4.3 🗺️**

Implementá la Pantalla P5 (verificación de identidad) más

MockIdentityProvider.

Del lado del mock: debe aceptar imágenes de prueba y devolver un

resultado configurable — aprobado, calidad insuficiente, edad fuera de

rango 18-64, o no coincide la cara. El resultado sale de la persona de

prueba activa en el panel de demo.

Del lado de la UI: los seis campos extraídos por OCR se muestran con

candado y NO son editables; país de nacimiento y estado civil sí son

selectores obligatorios; la edad se calcula desde la fecha de nacimiento

extraída, no desde un campo declarado; los cinco requisitos para

continuar se marcan a medida que se cumplen.

---

## Día 5 — 🎯 Hito: flujo navegable

**5.1 🗺️**

Implementá la Pantalla P6 según la especificación: los 7 campos

complementarios, el bloque de beneficiario con sus dos opciones, y las

8 declaraciones obligatorias con el badge de respuesta habilitante.

Conectá el motor de elegibilidad del día 1: si alguna de las

declaraciones 1, 2, 3 u 8 responde de forma incompatible, el expediente

pasa a DERIVADO\_MANUAL, se genera un número de caso distinto del

correlativo de propuesta, y se redirige a Pantalla A.

Los campos de salud y PEP deben quedar excluidos de cualquier

instrumentación o log.

**5.2**

Implementá la Pantalla A (revisión manual) según la especificación.

Verificá con un test que desde el estado DERIVADO\_MANUAL no exista

ninguna ruta ni endpoint que permita llegar a pago, firma o emisión.

**5.3 🗺️**

Implementá el panel de demo en /demo-panel, protegido por DEMO\_PANEL\_KEY

y disponible solo con DEMO\_MODE=true (excluido del bundle si el flag

está apagado).

Versión 1: selector de persona de prueba (las 5 definidas en CLAUDE.md),

visualización de los OTP generados en el expediente activo, y botón de

reiniciar expediente.

---

## Día 6 — Pago

Implementá la Pantalla P7 según la especificación, más

MockPaymentProvider.

Dos modalidades con comportamientos distintos:

\- QR Bancard: pago definitivo antes de la firma, genera QR con delay

  simulado, y arranca el plazo de 24 horas para firmar.

\- Tarjeta: preautorización (reserva sin cobro); la captura la ordena la

  firma del cliente.

La declaración de origen lícito de fondos es bloqueante. Implementá

llave de idempotencia para prevenir cobros duplicados. Ningún dato de

tarjeta se persiste en ninguna capa — escribí el test que lo verifique.

---

## Día 7 — Documentos y firma

**7.1 🗺️**

Implementá el servicio de generación de documentos: dos PDF cerrados,

PROP-00018425 y FIPF-00018425, mismo correlativo con prefijos distintos,

cada uno con su hash SHA-256 calculado antes de habilitar la firma, más

un QR de verificación.

La Solicitud lleva plan, coberturas, premio, beneficiario y declaraciones

médicas. El FIPF lleva datos personales, laborales, económicos,

identificación, PEP, origen de fondos y evidencias.

**7.2 🗺️**

Implementá la Pantalla P8 según la especificación, más

MockSignatureProvider.

Crítico — regla atómica: un único OTP de firma (distinto de los de P1 y

P4) sella ambos documentos simultáneamente. O quedan firmados los dos, o

ninguno. Escribí un test que fuerce un fallo a mitad del proceso y

verifique que ninguno de los dos quedó firmado.

Implementá también el timer de 24 horas configurable (el panel de demo

lo puede bajar a segundos) que dispara el vencimiento.

---

## Día 8 — Cierre y excepciones

**8.1**

Implementá la Pantalla P9 según la especificación, más MockPolicyIssuer

simulando SEBAOT: número de póliza simulado, estado "en emisión" que

pasa a "emitida" tras un delay. Descarga de Solicitud y FIPF firmados.

Recordá: NO se genera Nota de Cobertura.

**8.2**

Implementá la Pantalla B según la especificación: timeline de

recordatorios (1h, 5h, 12h, vencimiento a 24h), resumen del caso, los

4 pasos del procedimiento de devolución, actores y evidencia conservada.

Estado final: VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO.

**8.3**

Ampliá el panel de demo a v2: reloj acelerado (plazo de firma

configurable en segundos) y forzado de fallos puntuales — OTP expirado,

3 intentos agotados, timeout de Bancard, rechazo de Code100.

---

## Día 9 — QA y evidencia

**9.1**

Usá el agente qa-testing. Escribí y corré los 7 escenarios E2E en

Playwright:

1\. Camino feliz completo P0→P9 con Mónica Gorena Tapia.

2\. PEP \= Sí en P6 → Pantalla A, sin pasar por P7/P8/P9.

3\. Salud incompatible en P6 → Pantalla A.

4\. Biometría rechazada en P5 → no permite avanzar a P6.

5\. Tres intentos fallidos de OTP en P1 → bloqueo temporal.

6\. Pago confirmado sin firma en el plazo → Pantalla B.

7\. Fallo a mitad de la firma en P8 → ningún documento firmado.

Todos contra INTEGRATION\_MODE=mock.

**9.2**

Agregá al panel de demo un visor de evidencia del expediente activo:

cadena completa de eventos con timestamps, IP, dispositivo, hashes de

documentos y resultados de cada integración. Es lo que se le muestra al

área de cumplimiento en la presentación.

**9.3**

/security-review

Y después:

Usá el agente seguridad-cumplimiento para auditar todo el repo contra

las 10 reglas inviolables de CLAUDE.md. Reportá cualquier violación con

el archivo, la línea y la regla que rompe.

---

## Día 10 — Pulido

Revisá las 12 pantallas en viewport móvil (375px) y corregí todo lo que

se rompa. El producto es B2C y la mayoría del tráfico será celular.

Agregá estados de carga y de error con mensajes específicos por

situación (no genéricos), coherentes con el tono de las pantallas.

Agregá también la banda permanente "ENTORNO DE DEMOSTRACIÓN —

integraciones simuladas" visible en todas las pantallas cuando

DEMO\_MODE=true.

Escribime un guion de demostración de 12 minutos: qué pantalla mostrar,

en qué orden, con qué persona de prueba, qué decir en cada transición y

en qué momento abrir el visor de evidencia. Guardalo en

docs/GUION\_DEMO.md.

---

## Trucos que valen la pena

- **`/context` cuando algo empieza a salir mal.** Si la ventana está llena, la calidad cae. `/compact` o `/clear`.  
- **`/rewind` en vez de pelear.** Si dos correcciones seguidas no arreglan algo, volvé al checkpoint anterior y replanteá el prompt.  
- **`/memory` cada vez que corregís algo dos veces.** Esa regla pertenece al `CLAUDE.md`.  
- **Trabajo en paralelo con git worktrees.** Si querés que una sesión maquete P7 mientras otra escribe Terraform, usá worktrees separados: dos sesiones sobre el mismo directorio se pisan.  
- **Pedile que corra los tests él mismo** antes de darte el trabajo por terminado: "corré npm run typecheck && npm test y arreglá lo que falle".

