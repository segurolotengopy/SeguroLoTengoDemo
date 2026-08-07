# SeguroLoTengo — Demo del sistema integrado (AAB1)

Portal B2C de venta electrónica del **Seguro de Vida Oncológico CONFÍO**. Marca y canal digital de **Interseguros S.A.** (corredor) · Aseguradora: **Alianza Garantía Seguros y Reaseguros S.A.** · Operador tecnológico: **AAB1**. Mercado: Paraguay.

Este es un **entorno de demostración**: todas las integraciones externas están simuladas. La funcionalidad y las reglas de negocio son reales y completas.

---

## Fuente de verdad

`docs/ESPECIFICACION_PANTALLAS.md` describe las 12 pantallas al detalle (textos, campos, botones, reglas, valores). **Antes de implementar o modificar cualquier pantalla, leé la sección correspondiente de ese documento.** Si algo que te pido contradice ese documento, avisame en vez de improvisar.

No inventes campos, pasos, validaciones ni textos que no estén en la especificación. El producto está diseñado para mínima fricción: cada campo extra es un problema de negocio.

---

## Comandos

npm run dev          \# desarrollo local

npm run build        \# build de producción

npm run lint         \# ESLint

npm run typecheck    \# tsc \--noEmit

npm test             \# tests unitarios y de contrato

npm run test:e2e     \# Playwright, escenarios completos

Antes de cualquier commit: `npm run typecheck && npm run lint && npm test` deben pasar.

---

## Stack

- **Next.js 15** (App Router, TypeScript estricto) — fijo en 15, no subir a 16 (límite de Amplify Hosting)  
- **Tailwind CSS** \+ componentes propios en `src/components/shared`  
- **DynamoDB** (tabla única) para expedientes y OTP con TTL nativo  
- **S3** para evidencias y PDFs generados  
- **AWS Amplify Hosting** (plataforma WEB\_COMPUTE) para deploy  
- **Playwright** para E2E, **Vitest** para unitarios

---

## Estructura

src/

  app/                    \# App Router: una carpeta por pantalla

    (flujo)/p1-whatsapp/  ... hasta p9-confirmacion

    revision-manual/      \# Pantalla A

    solicitud-vencida/    \# Pantalla B

    demo-panel/           \# panel de control del demo (solo con DEMO\_MODE=true)

    api/                  \# Route Handlers

  components/shared/      \# cabecera, stepper, barra de plan, campos OTP

  domain/                 \# máquina de estados, reglas de elegibilidad, tipos

  ports/                  \# las 7 interfaces de proveedores externos

  adapters/mock/          \# implementaciones simuladas

  adapters/live/          \# implementaciones oficiales (vacío por ahora)

  repositories/           \# acceso a DynamoDB y S3, detrás de interfaces

docs/                     \# especificación de pantallas y decisiones

infra/                    \# Terraform

---

## Reglas de negocio inviolables

Estas reglas tienen consecuencia legal (Ley 6822/2021 de firma electrónica, Res. SEPRELAD 71/19 y 50/20, Res. BCP 25/21). El código debe hacerlas **imposibles de violar**, no solo evitarlas.

1. **Tres OTP independientes**: celular (P1), correo (P4) y firma (P8). Nunca se reutiliza un OTP para otro propósito. Cada uno: 6 dígitos, uso único, vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos.  
2. **Solo el hash del OTP se persiste.** Nunca el código en claro, ni en base, ni en logs, ni en respuestas de API. En modo demo el código se expone únicamente a través del panel de demo, nunca por la API del flujo.  
3. **Regla atómica de firma**: la Solicitud y el FIPF se firman en una sola operación o ninguna. No existe estado intermedio con uno firmado.  
4. **Los PDF se cierran y se hashean (SHA-256) antes de habilitar la firma.** Cualquier modificación posterior invalida el paquete: hay que regenerar versión y hashes.  
5. **Bloqueo automático de elegibilidad**: una respuesta incompatible en las declaraciones 1, 2, 3 u 8 de P6 detiene la emisión automática y deriva a Pantalla A. Ese estado es **terminal en el flujo digital**: no existe transición desde ahí hacia pago, firma ni emisión.  
6. **Nunca se persiste PAN completo ni CVV**, en ninguna capa, incluidos logs y trazas de error.  
7. **Datos sensibles aislados**: las respuestas médicas y la condición PEP no salen hacia analítica, CRM, monitoreo de errores ni servicios de IA. Si agregás cualquier instrumentación, excluí explícitamente esos campos.  
8. **Edad 18-64 años** verificada contra la fecha de nacimiento extraída de la cédula, no contra un campo declarado.  
9. **Solo el titular puede contratar** para sí mismo. No existe flujo de contratación para terceros.  
10. **Evidencia append-only**: fecha, hora, IP, dispositivo, sesión, versión de texto aceptado y resultado de cada paso. Nunca se sobrescribe ni se borra un registro de evidencia.

---

## Máquina de estados del expediente

INICIADO → CANAL\_WA\_VERIFICADO → PLAN\_SELECCIONADO → AUTORIZADO

  → CANAL\_EMAIL\_VERIFICADO → IDENTIDAD\_VERIFICADA

     ├─ DERIVADO\_MANUAL (terminal) → Pantalla A

     └─ DECLARACIONES\_OK → PAGO\_CONFIRMADO → PAQUETE\_GENERADO

            ├─ VENCIDO → DEVOLUCION\_EN\_TRAMITE → Pantalla B

            └─ FIRMADO → EMITIDO → P9

Toda transición pasa por `src/domain/expediente.ts`. **Ningún Route Handler modifica el estado directamente.** Si necesitás una transición nueva, se agrega ahí con su validación.

---

## Arquitectura de puertos y adaptadores

Los 7 proveedores externos viven detrás de interfaces en `src/ports/`:

`OtpProvider` · `IdentityProvider` · `ComplianceProvider` · `PaymentProvider` · `SignatureProvider` · `PolicyIssuer` · `EvidenceStore`

**Regla dura:** ningún archivo fuera de `src/adapters/` puede importar un SDK de proveedor externo ni hacer fetch a una API externa. Todo pasa por el puerto. Lo mismo para el acceso a datos: nada llama al SDK de DynamoDB o S3 fuera de `src/repositories/`.

La selección de adaptador es por variable de entorno (`INTEGRATION_MODE`, o flags granulares `INTEGRATION_OTP`, `INTEGRATION_PAYMENT`, etc.). Los mocks y las implementaciones oficiales comparten los mismos tests de contrato en `src/ports/__tests__/`.

---

## Panel de demo

`/demo-panel`, protegido por `DEMO_PANEL_KEY`, disponible solo con `DEMO_MODE=true` y excluido del bundle cuando el flag está apagado.

Permite: elegir persona de prueba, ver los OTP generados, acelerar el plazo de firma de 24 h a segundos, forzar fallos puntuales (OTP expirado, intentos agotados, timeout de Bancard, rechazo de Code100), reiniciar el expediente y ver el registro de evidencia.

Personas de prueba definidas en `src/adapters/mock/personas.ts`:

- **Mónica Mariana Gorena Tapia** (C.I. 9.323.336) — camino feliz hasta P9  
- **PEP positivo** — declaración 8 en Sí → Pantalla A  
- **Salud incompatible** — declaraciones 1/2/3 incompatibles → Pantalla A  
- **Biometría rechazada** — P5 no aprueba coincidencia facial  
- **No firma** — paga en P7 y deja vencer → Pantalla B

---

## Convenciones de UI

- Cabecera de aseguradora/intermediario, stepper "Paso N de 9" y barra de plan seleccionado son componentes compartidos. **No los redefinas por pantalla.**  
- P0, Pantalla A y Pantalla B están **fuera del contador de 9 pasos** y usan su propio indicador.  
- Los botones de continuar arrancan deshabilitados y se habilitan solo con los requisitos de esa pantalla cumplidos.  
- Los campos autocompletados por OCR en P5 se muestran con ícono de candado y **no son editables**; el único camino ante discrepancia es repetir la captura.  
- Mobile-first: el producto es B2C y la mayoría del tráfico será celular.  
- Nunca muestres el OTP, el número completo de tarjeta ni datos sin enmascarar en la UI del flujo.  
- Textos en español rioplatense-paraguayo (voseo), exactamente como figuran en la especificación.

---

## Qué no hacer

- No agregues librerías pesadas sin justificarlo primero.  
- No uses `any` en TypeScript. El dominio del expediente es tipado estricto.  
- No escribas lógica de negocio dentro de componentes React — va en `src/domain/`.  
- No hagas commits que dejen tests en rojo.  
- No implementes más de una pantalla por sesión: pedime que abramos una sesión nueva.

