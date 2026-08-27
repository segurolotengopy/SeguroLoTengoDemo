# SeguroLoTengo — Demo del sistema integrado (AAB1)

Portal B2C de venta electrónica del **Seguro de Vida Oncológico CONFÍO**. Marca y canal digital de **Interseguros S.A.** (corredor) · Aseguradora: **Alianza Garantía Seguros y Reaseguros S.A.** · Operador tecnológico: **AAB1**. Mercado: Paraguay.

Este es un **entorno de demostración**: todas las integraciones externas están simuladas. La funcionalidad y las reglas de negocio son reales y completas.

---

## Fuente de verdad

`docs/ESPECIFICACION_DEMO.md` es el guion de demostración y el catálogo de datos de prueba (personas, planes, recorrido por pantalla, qué está simulado). **No es fuente de verdad de las pantallas** — manda el documento de abajo. Si necesitás un dato de prueba para una pantalla nueva, sacalo de ahí (`src/adapters/mock/personas.ts`) en vez de inventarlo en la pantalla.

`docs/ESPECIFICACION_PANTALLAS.md` describe las 12 pantallas al detalle (textos, campos, botones, reglas, valores). **Antes de implementar o modificar cualquier pantalla, leé la sección correspondiente de ese documento.** Si algo que te pido contradice ese documento, avisame en vez de improvisar.

No inventes campos, pasos, validaciones ni textos que no estén en la especificación. El producto está diseñado para mínima fricción: cada campo extra es un problema de negocio.

### ⚠️ Plan de Cambios v2 en ejecución (desde el 19-ago-2026)

El proyecto está aplicando el **Plan de Cambios v2**, que nace de la reunión con
Interseguros del 18-ago-2026 y de la **Matriz Legal Final V4** (16-ago-2026).
Mientras dure, la jerarquía de fuentes cambia y hay que leer estos tres
documentos **antes** que `ESPECIFICACION_PANTALLAS.md`:

| Documento                              | Qué manda                                                                                                                                                                         |
| :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/normativa/matriz 16 08 2026.pdf` | **Fuente maestra de cumplimiento.** Donde contradiga a `Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`, prevalece la matriz V4; el CSV sigue vigente para todo lo no contradicho. |
| `docs/plan/PLAN_DE_CAMBIOS_v2.md`      | Alcance, matriz de trazabilidad (TRV/CHG/CMP), diseño de la máquina de estados nueva y los lotes L1–L6 con sus criterios de aceptación.                                           |
| `docs/plan/DECISIONES.md`              | Las 22 decisiones ya tomadas (D-01…D-22). **Ninguna decisión marcada `PENDIENTE` se implementa.**                                                                                 |

Contexto adicional en `docs/antecedentes/` (transcripción de la reunión y
wireframes `PantallasDemo2.pdf`), `docs/normativa/` (resoluciones de la SIS) y
`docs/auditoria/ESTADO_ACTUAL.md` (mapa del sistema antes del plan).

**`ESPECIFICACION_PANTALLAS.md` se reescribió el 20-ago-2026**, al cerrarse el
Lote 4: ya describe el flujo de 8 pasos, con la firma antes del pago, el PDF
unificado y el correo dentro de identidad. Vuelve a ser la referencia de
detalle de cada pantalla.

El **orden**, en cambio, sigue sin vivir ahí: vive en `PASOS_FLUJO`
(`src/domain/rutas-flujo.ts`), que es de donde la aplicación deriva el número
de paso y el stepper. Si el documento y esa lista discrepan, gana la lista.

Cambios de este plan que tocan las reglas inviolables de más abajo, ya
decididos: el OTP de correo se retiró (queda un solo OTP de canal, el de
WhatsApp, Lote 2); la firma pasó a ocurrir **antes** del pago (Lote 4b); la
Solicitud y el FIPF se unificaron en un solo PDF (Lote 4c); y el **Certificado
de Cobertura Provisional** existe desde el Lote 5a, emitido en la misma
escritura que confirma el cobro. El Lote 5b puso los **tres** descargables en
la pantalla de confirmación —paquete firmado, certificado y comprobante de
pago (D-05)— con el inicio de cobertura a la vista, y el Lote 5c abrió
`/verificar/<código>`, la página pública a la que apuntan los QR (CMP-06).
El Lote 5d entrega el certificado y el paquete firmado a los canales
verificados, con acuse y reintentos (CHG-44, CMP-05), y el Lote 5e cierra el
plan con la remisión automática del caso a Alianza (CHG-47) y el seguimiento de
devoluciones (D-02). **Queda pendiente el Lote 6** (trazabilidad completa, rate
limiting y el resto de los CMP nuevos). Cada regla se corrige acá cuando el
lote que la cambia se implementa, no antes: hasta entonces, **la regla escrita
abajo es la que rige el código que existe hoy**.

### Documentos fuente adicionales

Además de `ESPECIFICACION_PANTALLAS.md`, estos documentos en `docs/` son fuente de verdad de aspectos específicos. Cargalos antes de tocar el área indicada — no asumas su contenido de memoria si pasó tiempo desde la última lectura.

**Convención:** la documentación técnica que publica un proveedor externo (Code100, Bancard, y más adelante Infobip, Entrust, ComplyAdvantage, SEBAOT) vive agrupada en `docs/Integraciones/`. En la raíz de `docs/` quedan los documentos propios del proyecto y del producto: especificaciones, formularios, matriz de cumplimiento y catálogo de integraciones. Un PDF de proveedor nuevo va en `docs/Integraciones/`, nunca suelto en la raíz.

| Archivo                                                                                                                                                                     | Úsalo para...                                                                                                                                                                                                                                                                                                                                                |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GUIA_DE_ESTILOS.md`                                                                                                                                                        | Fuente de verdad de colores, tipografía (DM Sans) y uso de logos/isologos de Alianza e Interseguros, en pantallas, favicon y PDFs. La paleta reemplaza por decisión de producto a la descripta en ESPECIFICACION_PANTALLAS.md.                                                                                                                               |
| `Solicitud.pdf`                                                                                                                                                             | Estructura exacta y campos obligatorios de la Solicitud de Seguro (proponente, planes/coberturas, beneficiario, declaración médica, declaraciones finales, firma). El servicio de generación de PDF interno debe respetar estos campos y su orden.                                                                                                           |
| `FIPF.pdf`                                                                                                                                                                  | Formulario de Identificación de Persona Física (SEPRELAD): campos personales, laborales, económicos, origen de fondos, condición PEP. Referencia obligatoria del modelo de datos de KYC/AML — ya reflejado parcialmente en `DatosComplementariosP6` de `src/domain/tipos.ts`.                                                                                |
| `Integraciones/Documentacion Firmador - API FLOW.pdf`                                                                                                                       | Contrato técnico exacto de la API de Code100 (`POST /signature/auth`, `GET /signature/session-start`, `POST /signature/getSessionId`, `POST /signature/sign-pdf`). Gobierna el futuro adaptador oficial de `SignatureProvider` en `src/adapters/live/`. No inventar parámetros ni endpoints distintos a los documentados ahí.                                |
| `Integraciones/Code100 - Respuestas C1 a C12.md` | **Respuestas del proveedor a las doce consultas técnicas** (20-ago-2026). Fuente de verdad de qué puede y qué no puede hacer Api Flow. Lo que manda: **firma exclusivamente con certificado cualificado que el firmante ya tenga**, así que **no puede recibir la firma del cliente**; no registra IP ni dispositivo; no emite acta de evidencias; las tres firmas van en fila india. Leerlo antes de tocar `SignatureProvider`. |
| `Integraciones/eCommerce_bancard_compra_simple_version_1.23.1 (1).pdf`, `Integraciones/Preaut y promociones 14.pdf`, `Integraciones/Qr en API de Comercios v1.2 16 (1).pdf` | Contrato técnico exacto de las APIs de Bancard: compra simple de eCommerce, preautorización y captura, y QR de comercios. Gobiernan el futuro adaptador oficial de `PaymentProvider` (P7). Mismo criterio que con Code100: no inventar parámetros ni endpoints.                                                                                              |
| `RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`                                                                                                                                   | Estrategia de P5 (Rekognition/Textract para demo y piloto, brecha de autenticidad documental, RFP para producción) y **§7: los parámetros internacionales de calidad de rostro, prueba de vida y coincidencia facial**, con su procedencia. Los números viven implementados en `src/domain/identidad-parametros.ts`; ese documento explica por qué son esos. |
| `Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`                                                                                                                             | Matriz normativa (Número, Categoría R1–R8, Título, Norma y Artículo). Fuente de verdad regulatoria del proyecto — ver "Regla de trabajo con los documentos" abajo.                                                                                                                                                                                           |
| `Tabla de Integraciones externas - Tabla.csv` y `SeguroLoTengo-integraciones-externas-alta-resolucion.pdf`                                                                  | Catálogo de las integraciones externas reales que los adaptadores `live/` deberán implementar algún día (Bancard, Code100, SEBAOT, Infobip, Entrust, ComplyAdvantage, etc.), agrupadas en 30 procesos / 6 categorías, con proveedor y estado de decisión de cada una. Ver "Reglas transversales de integraciones" más abajo para el resumen no negociable.   |
| `Cumplimiento SeguroLoTengo.pdf`                                                                                                                                            | Versión narrativa de la matriz de cumplimiento; usar como respaldo textual cuando el CSV no alcance el detalle necesario.                                                                                                                                                                                                                                    |
| `CONFIGURACION_SES.md`                                                                                                                                                      | Guía operativa del OTP de correo (P4) sobre Amazon SES: sandbox y sus tres límites, verificación de remitente y destinatarios, salida a producción, deliverability con dominio propio, y el reparto de permisos entre el rol de cómputo y el usuario local. Leela antes de tocar `INTEGRATION_OTP_EMAIL` o `infra/ses-correo-otp.tf`.                        |
| `QR_HASH_Y_EVIDENCIAS_INMUTABLES.pdf` y `ANALISIS_QR_HASH_Y_EVIDENCIAS.md`                                                                                                  | Diseño del QR interno, la cadena de hashes y el registro inmutable de evidencias. El PDF es la propuesta; el `.md` la confronta punto por punto contra lo implementado y dice qué está hecho, qué falta y qué diverge a propósito. **Leelo antes de tocar `qr.ts`, el token de verificación o `/verificar`.** |
| `SeguroLoTengo_Asistente_IA_y_Configuracion.pdf`                                                                                                                            | Especificación del asistente Terra — **fuera de alcance de esta demo por ahora**, ver sección "Asistente IA (Terra)" más abajo.                                                                                                                                                                                                                              |

---

## Comandos

npm run dev \# desarrollo local

npm run build \# build de producción

npm run lint \# ESLint

npm run typecheck \# tsc \--noEmit

npm test \# tests unitarios y de contrato

npm run test:e2e \# Playwright, escenarios completos

npm run otp:requerimiento -- +59XXXXXXXXX \# manda un OTP REAL por WhatsApp

npm run seguridad \# Snyk: dependencias e infraestructura

Antes de cualquier commit: `npm run typecheck && npm run lint && npm test` deben pasar.

> **Antes de cualquier despliegue** corre además la cadena completa de
> [`docs/POLITICA_DE_DESPLIEGUE.md`](docs/POLITICA_DE_DESPLIEGUE.md):
> `npm run verify` → `npm run seguridad` → PR a `main` → los 4 jobs de CI en
> verde → merge. **El merge a `main` ES el despliegue**: Amplify tiene
> `autoBuild` encendido en esa rama y buildea a PRODUCTION solo. Por eso no se
> commitea nunca directo a `main`.

> **`otp:requerimiento` manda mensajes de verdad.** Antes de correrlo, leé
> [`docs/MENSAJERIA_REAL_PASOS.md`](docs/MENSAJERIA_REAL_PASOS.md) → "Enviar
> OTPs de WhatsApp a mano". La condición que hace que llegue o no: **el
> destinatario tiene que haberle escrito primero al número de prueba de Meta**,
> porque hoy el OTP sale como texto de sesión y Meta solo lo entrega dentro de
> la ventana de 24 h. Sin eso, el envío se acepta con 202 y nunca llega.

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

app/ \# App Router: una carpeta por pantalla

    (flujo)/plan, whatsapp, preparacion, identidad,
            declaraciones, pago, firma, confirmacion   \# 8 pasos, sin número en el slug

    revision-manual/      \# Pantalla A

    solicitud-vencida/    \# Pantalla B

    demo-panel/           \# panel de control del demo (solo con DEMO\_MODE=true)

    api/                  \# Route Handlers

components/shared/ \# cabecera, stepper, barra de plan, campos OTP

domain/ \# máquina de estados, reglas de elegibilidad, tipos

documentos/ \# generación de la Solicitud y el FIPF: PDF, QR, hash

ports/ \# las 9 interfaces de proveedores externos

adapters/mock/ \# implementaciones simuladas

adapters/live/ \# implementaciones oficiales (Rekognition + Textract)

repositories/ \# acceso a DynamoDB y S3, detrás de interfaces

docs/ \# especificación de pantallas y decisiones

infra/ \# Terraform

---

## Regla de trabajo con los documentos

- **Nunca cites de memoria un artículo de ley.** Si necesitás justificar una regla de negocio, buscá la fila correspondiente en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` y citá Número + Categoría + Norma y Artículo tal como figuran ahí.
- Si un pedido no tiene fila en esa matriz, decilo explícitamente: _"Esto no tiene respaldo en la matriz de cumplimiento cargada; es una decisión de producto/UX, no una obligación legal"_.
- Los PDF (`Solicitud.pdf`, `FIPF.pdf`, `Pantallas Sistema Demo.pdf`) son la fuente de verdad de **estructura de datos y UI**. El CSV de cumplimiento es la fuente de verdad de **obligación legal**. No mezclar ambos como si fueran lo mismo.
- Ante conflicto entre lo que se pide y lo que exige la matriz de cumplimiento (por ejemplo, saltear un OTP, iniciar cobertura antes del pago, o permitir contratar para un tercero), **priorizá la matriz** y señalá el conflicto en vez de implementarlo en silencio.

---

## Reglas de negocio inviolables

Estas reglas tienen consecuencia legal (Ley 6822/2021 de firma electrónica, Ley 4868/13, Ley 1334/98, Ley 827/96, Res. SS SG. 215/15 y 223/17, Res. SEPRELAD 71/19 y 50/20, Res. BCP 25/21 — ver cita exacta por fila en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`). El código debe hacerlas **imposibles de violar**, no solo evitarlas.

1. **Un OTP de canal, más el del acto de firma**: celular (paso 2) y firma (paso 6). Nunca se reutiliza un OTP para otro propósito. Cada uno: 6 dígitos, uso único, vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos. **El OTP de correo se retiró** (D-06 del Plan v2, Lote 2): el correo se declara con doble tipeo dentro de la pantalla de identidad y se respalda con la declaración de veracidad que se firma después. El estado `CANAL_EMAIL_VERIFICADO` sobrevive como legado, sin aristas de entrada, porque hay expedientes históricos ahí (regla #10).
2. **Solo el hash del OTP se persiste.** Nunca el código en claro, ni en base, ni en logs, ni en respuestas de API. En modo demo el código se expone únicamente a través del panel de demo, nunca por la API del flujo.
3. **Regla atómica de firma, ahora estructural**: la Solicitud y el FIPF son **dos secciones de un mismo PDF** (D-11), con un solo SHA-256 y un solo acto de firma. No existe la operación que podría firmar una y no la otra — la regla dejó de necesitar validaciones que la vigilen y pasó a ser una propiedad del modelo. `FIRMADO_CLIENTE` no es una excepción: nombra el momento en que el cliente ya firmó el documento entero y faltan las firmas institucionales (D-13).
4. **El PDF se cierra y se hashea (SHA-256) antes de habilitar la firma.** Cualquier modificación posterior invalida el paquete: hay que regenerar versión y hash.
5. **Bloqueo automático de elegibilidad**: una respuesta incompatible en las declaraciones 1, 2, 3 u 8 de P6 detiene la emisión automática y deriva a Pantalla A. Ese estado es **terminal en el flujo digital**: no existe transición desde ahí hacia paquete documental, firma, pago ni emisión.
6. **Nunca se persiste PAN completo ni CVV**, en ninguna capa, incluidos logs y trazas de error.

   6-bis. **No hay cobro sin firma** (D-08, Matriz V4 §7). El único estado desde el que se abre y se confirma una operación en Bancard es `FIRMADO`, al que solo se llega con el paquete cerrado y hasheado, la firma del cliente registrada y las institucionales aplicadas. No existe arista `DECLARACIONES_OK → PAGO_CONFIRMADO`. El corolario es la fila 30 de la matriz cumplida por construcción: el expediente caduca **antes** de cobrar, así que nunca hay premio que devolver por no firmar.

7. **Datos sensibles aislados**: las respuestas médicas y la condición PEP no salen hacia analítica, CRM, monitoreo de errores ni servicios de IA. Si agregás cualquier instrumentación, excluí explícitamente esos campos.
8. **Edad 18-64 años** verificada contra la fecha de nacimiento extraída de la cédula, no contra un campo declarado.
9. **Solo el titular puede contratar** para sí mismo. No existe flujo de contratación para terceros.
10. **Evidencia append-only**: fecha, hora, IP, dispositivo, sesión, versión de texto aceptado y resultado de cada paso. Nunca se sobrescribe ni se borra un registro de evidencia.
11. **Bloqueo de nuevo registro por cédula**: mientras una cédula tenga un expediente en `DERIVADO_MANUAL`, `VENCIDO`, `DEVOLUCION_EN_TRAMITE` o `DEVUELTO` **sin superar**, el flujo digital normal no deja empezar otro con esa cédula. Se aplica en P5, que es donde el sistema conoce la cédula. Solo la consola administrativa levanta el bloqueo, y lo hace creando un expediente **nuevo** enlazado por `expedienteAnteriorId` — nunca reactivando el viejo, que sigue siendo terminal (regla #5). El bloqueo no es un flag editable: se deriva de la cadena de expedientes. Ver `src/domain/consola-administrativa.ts`.

---

## Máquina de estados del expediente

INICIADO → PLAN\_SELECCIONADO → CANAL\_WA\_VERIFICADO → AUTORIZADO

     ├─ ASISTENCIA\_IDENTIDAD (terminal, NO bloquea la cédula)

     └─ IDENTIDAD\_VERIFICADA

     ├─ DERIVADO\_MANUAL (terminal) → Pantalla A

     └─ DECLARACIONES\_OK → PAQUETE\_GENERADO → FIRMADO\_CLIENTE → FIRMADO

            ├─ VENCIDO (24 h sin pagar; sin cobro, sin devolución)

            └─ PAGO\_CONFIRMADO → EMITIDO → P9

                   └─ DEVOLUCION\_EN\_TRAMITE → DEVUELTO (a pedido, Pantalla B)

**Se firma antes de pagar** (D-08, Lote 4b; Matriz Legal V4 §7). Es la inversión del orden que tenía el flujo hasta el Plan v2: cobrar antes de la firma dejaba a la persona pagando por un contrato que todavía no había aceptado, y obligaba a devolver el premio cada vez que no firmaba. Con el orden nuevo el vencimiento ocurre **antes** de que haya dinero, así que caducar es gratis y la devolución queda reservada a lo que sí puede pedirse: un cobro con tarjeta ya acreditado (D-02).

`FIRMADO_CLIENTE` es el estado entre la firma del cliente y las institucionales de Interseguros y Alianza (D-13). Existe como estado propio y no como un campo porque un sellado a medio hacer tiene que ser distinguible de un expediente sin firmar (regla inviolable #3): si Code100 confirma la firma del cliente y las institucionales fallan, el expediente queda ahí y el cobro sigue inhabilitado.

`PAGO_CONFIRMADO` significa _"el dinero entró"_ y, desde D-12, **también** que existe el Certificado de Cobertura Provisional: los dos entran por la misma transición, así que no hay estado intermedio en el que uno exista sin el otro (CMP-07). Ver "El Certificado de Cobertura Provisional" más abajo.

`EMITIDO` significa **solicitud aceptada y emisión ordenada**, no "póliza en mano": P9 lo muestra como `Solicitud aceptada ✓` junto a `Póliza en preparación ⋯`. El estado del documento vive aparte, en `Expediente.poliza`, y lo mueve Alianza (SEBAOT y SIFEN) a su ritmo — por eso son dos cosas distintas. La póliza **conserva el correlativo de la propuesta**: SEBAOT no acuña un número nuevo. El correlativo lo acuña ahora el **cierre del paquete documental**, no el pago: los documentos se cierran antes de firmarse, así que el número nace con ellos (`generarNumeroPropuesta` en `src/documentos/servicio.ts`).

`VENCIDO` significa **firmado y no pagado dentro de las 24 h** (D-10), y en el flujo vigente es el final del camino: no hubo cobro, así que no hay premio que devolver. El reloj arranca al aplicarse las firmas institucionales (`Expediente.plazoPagoVenceEn`) y lo apaga el cobro. La arista `VENCIDO → DEVOLUCION_EN_TRAMITE` **se conserva como legado**: hay expedientes que vencieron bajo el orden viejo con el pago hecho y no se los reescribe (regla #10); sin esa salida quedarían con dinero adentro y sin trámite al que ir. Quien la guarda es `iniciarDevolucionPantallaB`, que exige un pago acreditado — condición que un vencimiento nuevo nunca cumple.

`DEVUELTO` cierra la rama de la devolución: `DEVOLUCION_EN_TRAMITE` es un trámite en curso —no un final— y el pie de la Pantalla B declara el estado final del expediente como `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`. La devolución la ejecuta Alianza presencialmente, fuera del flujo digital; el expediente solo la asienta. Ninguno de los dos estados vuelve al flujo ni llega a póliza, y los dos bloquean por regla #11.

Toda transición pasa por `src/domain/expediente.ts`. **Ningún Route Handler modifica el estado directamente.** Si necesitás una transición nueva, se agrega ahí con su validación.

---

## Arquitectura de puertos y adaptadores

Los 9 proveedores externos viven detrás de interfaces en `src/ports/`:

`OtpProvider` · `IdentityProvider` · `ComplianceProvider` · `PaymentProvider` · `SignatureProvider` · `PolicyIssuer` · `EvidenceStore` · `RegistroCivilProvider` · `MessagingProvider`

`MessagingProvider` (CHG-44) es el noveno y **no es el del OTP**, aunque compartan proveedor real: aquel entrega un código de seis dígitos y gestiona su ciclo de vida; este entrega **archivos ya emitidos** a alguien que ya está identificado. Solo tiene mock, y el `live` no es una tarea pendiente cualquiera: WhatsApp-Modular expone hoy un `otp-service` y ningún endpoint de documentos, así que no hay contrato que implementar — inventarlo sería inventar la integración, el mismo criterio que dejó el webhook de Code100 declarado y sin implementar (PEN-02).

**Regla dura:** ningún archivo fuera de `src/adapters/` puede importar un SDK de proveedor externo ni hacer fetch a una API externa. Todo pasa por el puerto. Lo mismo para el acceso a datos: nada llama al SDK de DynamoDB o S3 fuera de `src/repositories/`.

La selección de adaptador es por variable de entorno (`INTEGRATION_MODE`, o flags granulares `INTEGRATION_OTP`, `INTEGRATION_PAYMENT`, etc.). Los mocks y las implementaciones oficiales comparten los mismos tests de contrato en `src/ports/__tests__/`.

### Firmantes por documento (D-13)

Quiénes firman cada documento, en qué orden, con qué nivel y en qué modalidad (`PREFIRMADO` / `CONJUNTO`) es **dato configurable**, en `src/domain/firmantes-documento.ts`. De ahí salen tres cosas a la vez: el bloque de firmas que se imprime en el PDF, el orden en que el adaptador aplica las firmas, y lo que la consola muestra de cada una — cuando eran tres listas separadas, el PDF podía anunciar un firmante que el proveedor no aplicaba.

Dos invariantes que la configuración no puede romper, las dos con test: **el cliente firma primero y firma simple**, y **toda firma institucional es cualificada**. `PREFIRMADO` es la excepción ordenada a lo primero: la firma ya está sobre el documento antes de que el cliente lo reciba, como en una póliza modelo.

Cada firma institucional aplicada queda en `Expediente.firmasInstitucionales` con su rol, nivel, modalidad y certificado, visible en la consola: un expediente `FIRMADO` que no dijera quién lo firmó no probaría nada. El certificado es simulado mientras Code100 sea un mock y la referencia lo dice (`DEMO-CERT-…`).

**Divergencia declarada:** la Matriz V4 §2 dice que _"Alianza no firma la propuesta salvo exigencia del modelo"_; D-13 establece lo contrario y manda D-13. ALR-07 registra que Rodrigo y Legal actualicen la matriz.

### Contrato oficial de `SignatureProvider` (Code100)

Cuando se implemente `src/adapters/live/signature-provider.ts`, debe usar exclusivamente el flujo documentado en `docs/Integraciones/Documentacion Firmador - API FLOW.pdf` — no inventar parámetros ni endpoints:

```
POST /signature/auth            → token
GET  /signature/session-start   → _authUrl (iframe), session_id
POST /signature/getSessionId    → code, state, cert_info (estado de firma)
POST /signature/sign-pdf        → pdf_base64 firmado (documents_signeds)
```

Reglas no negociables de esa integración: el documento único viaja en **un** `session_id` —con D-11 ya no hay dos archivos que pudieran ir en llamadas separadas—; se cierra (hash + versión) antes de enviarse a firmar; el orden de firmas es cliente → Interseguros → Alianza, **una después de otra y nunca al revés** (el proveedor confirmó que en paralelo produce documentos incompatibles), y sale de `firmantes-documento.ts`; se registran PDF, hash, canal, `session_id`, firmantes, fecha, hora, IP y callbacks.

**Code100 no puede recibir la firma del cliente, y eso ya está respondido por escrito.**
`docs/Integraciones/Code100 - Respuestas C1 a C12.md` (C1): Api Flow firma **exclusivamente con
certificado cualificado que el firmante ya tenga emitido a su nombre**, y no existe flujo alternativo.
El cliente de CONFÍO no lo tiene. Así que el adaptador oficial de `SignatureProvider`, cuando se
escriba, cubre **las firmas institucionales**; quién ejecuta la del cliente es decisión de Gerencia y
Legal (D1 del informe del 20-ago-2026), con la opción recomendada de que la resuelva SeguroLoTengo
sobre lo que la plataforma ya hace: identidad verificada, OTP de un solo uso, IP, sello de tiempo y
huella. Dos datos del proveedor que empujan en esa dirección: **no registra IP ni dispositivo del
firmante** y **no emite acta de evidencias descargable**, así que el respaldo probatorio lo produce y
conserva el portal de todos modos. **Ninguna pantalla nombra al proveedor**: dicen «te enviaremos un
enlace» y «te confirmaremos la firma», y quedan válidas se decida lo que se decida.

### Confirmación de firma: dos vías, un `session_id` (CHG-33)

La confirmación de que el cliente firmó llega por **dos** caminos, y los dos pueden llegar por el mismo acto: el sondeo de la pantalla cada dos segundos, y el retorno del navegador cuando la persona vuelve de la ventana de Code100 (`POST /api/p8/retorno`). La que llega primero transiciona; la segunda encuentra el expediente firmado, responde lo mismo con `duplicada: true` y deja evidencia propia (`P8_CONFIRMACION_DUPLICADA`). La idempotencia es por `session_id`, que es el `idCode100` del acto abierto.

El origen (`SONDEO` / `RETORNO_NAVEGADOR` / `WEBHOOK`) viaja a la evidencia: _"¿por dónde se enteró el sistema de que esto se firmó?"_ es una pregunta de auditoría, no de depuración.

**No hay webhook, y no es un olvido.** La documentación de Code100 expone cuatro endpoints y ninguno es un callback servidor a servidor; la única aparición de _callback_ es el `redirect_uri` de OAuth. Inventarle payload y verificación sería inventar el contrato, así que `WEBHOOK` está declarado en el tipo pero sin implementación: queda como PEN-02. Ninguna ruta de retorno confía en lo que dice el navegador — recibe el aviso de que volvió y le pregunta al proveedor.

### Idempotencia de webhooks (Bancard y Code100)

Los adaptadores oficiales de `PaymentProvider` y `SignatureProvider` deben tratar sus webhooks/callbacks como potencialmente duplicados (reintentos de red, doble entrega). `src/ports/payment-provider.ts` ya expone `idempotencyKey` en los métodos de inicio de pago y documenta `capturarPreautorizacion`/`cancelarOLiberarReserva` como idempotentes por `referenciaBancard` — cualquier adaptador debe cumplir esa garantía, no solo el mock.

---

## Servicio de generación de documentos

`src/documentos/` **acuña el correlativo** (`generarNumeroPropuesta`, ocho dígitos de CSPRNG), cierra con él **un solo PDF** que lleva la Solicitud y el FIPF como secciones (D-11) —identidad `PROP-<correlativo>`, con el código interno `FIPF-<correlativo>` impreso en su sección—, calcula un SHA-256, lo guarda por `ArchivoRepository` y transiciona DECLARACIONES_OK → PAQUETE_GENERADO. Es el paso que habilita la firma: sin documento cerrado y hasheado no hay nada válido que mandarle a Code100 (regla inviolable #4).

**Un correlativo, dos códigos internos.** Las dos secciones conservan su código propio porque son dos formularios con vida normativa distinta —la Solicitud responde a la Res. SS SG. 215/15 y el FIPF a la Res. SEPRELAD 71/19— y un auditor de cualquiera de los dos tiene que poder citar el suyo. Lo que ya no tienen es archivo, huella ni acto de firma separados.

El documento imprime además, por la Matriz Legal V4 §4: la advertencia del **art. 1556 del Código Civil** (CMP-09) con el **sello de tiempo** de la solicitud, y las declaraciones de **licitud y veracidad** y de **cuenta propia** (CMP-20). La matriz es explícita en que van integradas al PDF y **no** como casilla aparte: se aceptan al firmar, no antes.

El correlativo nace acá y no en el pago desde la inversión de D-08: los documentos se cierran **antes** de que exista ninguna operación de Bancard, así que el número tiene que nacer con ellos y el pago pasa a ser uno más de los que lo citan. Se acuña en memoria y se persiste en la misma escritura que el paquete: si el cierre falla, no queda un número reservado sin documentos que lo lleven.

**No es un proveedor externo, así que no tiene puerto.** Los 7 puertos modelan integraciones con terceros; generar un PDF propio no lo es. Lo único que pasa por infraestructura es guardar el archivo, y eso ya entra por `src/repositories/archivo-repository.ts`.

### El comprobante de pago (D-05, Lote 5b)

Tercer documento del motor y el único que **no se cierra, no se hashea y no se guarda**: `REC-<correlativo>`, generado al vuelo cada vez que se lo pide y determinista, así que dos descargas dan el mismo archivo. Contenido en `src/domain/comprobante-pago.ts`, generación en `generarComprobantePago`.

Es una proyección de datos que ya están persistidos —el cobro, el plan, el certificado que ese cobro emitió—, así que guardarlo sería guardar dos veces lo mismo y hashearlo sugeriría una inmutabilidad que no le hace falta. **Tampoco lleva QR**: lo que afirma ya está probado por el certificado y por la Solicitud firmada, y un QR sugeriría una verificación propia que no existe. `EncabezadoDocumento.urlVerificacion` es `string | null` justamente por esto.

**No es la factura**, y el documento lo dice en rojo y en el cuerpo: la factura electrónica la emite Alianza por SIFEN (fila 40 de la matriz). Un comprobante del corredor que no lo aclarara sería leído como documento fiscal.

Exige el certificado además del cobro: los dos nacen en la misma escritura (D-12), así que un expediente cobrado sin certificado sería un estado imposible, y el comprobante lo cita como lo que ese pago habilitó.

### El Certificado de Cobertura Provisional (D-12, Lote 5a)

El motor produce **dos documentos**, no uno. El segundo es el CPC: `CPC-<correlativo>`, mismo correlativo que el paquete y con `PROP-<correlativo>` impreso como documento vinculado. Dice quién está cubierto, **desde cuándo**, por cuánto, qué lo pagó y qué lo respalda; lo firma solo Alianza y **prefirmado** (D-13), así que el cliente no firma nada nuevo. Contenido en `src/domain/certificado-cobertura.ts`, dibujo en `plantillas.ts`, emisión en `servicio.ts` (`emitirCertificadoCobertura`).

**No es la póliza y no es una Nota de Cobertura.** La póliza la emite Alianza por SEBAOT con su número oficial de diez dígitos (CMP-18); la Nota de Cobertura sigue prohibida porque compromete cobertura anticipada, y el CPC no compromete nada: constata un cobro que ya ocurrió y la fecha que se deriva de él. El propio PDF lo dice, en rojo y en el cuerpo.

**El inicio de la cobertura es el instante del cobro acreditado más 24 horas exactas** (CHG-41) — milisegundos sobre el instante absoluto, no "el día siguiente": es lo único que acierta en los bordes de mes, de año y en los cambios de horario. El fin es el aniversario, contado por calendario para que cruzar un bisiesto no adelante el vencimiento. Se calcula una sola vez, se persiste en el expediente y no se recalcula al leerlo.

**Se emite dentro de la transición del pago, no después** (CMP-07). `confirmarPagoP7` cierra y hashea el PDF antes de transicionar, y `registrarPagoConfirmadoP7` asienta el estado y el certificado en la **misma** escritura: no existe un expediente cobrado sin certificado ni un certificado sin cobro. Si el certificado no se puede cerrar, el pago **no se confirma** (`CERTIFICADO_NO_EMITIDO`) y el próximo sondeo reintenta la operación entera — el dinero ya está en Bancard y la clave de idempotencia impide cobrarlo de nuevo. Los expedientes que cobraron antes de D-12 traen el campo en `null` y no se reescriben (regla inviolable #10).

Quien emite vive en `src/documentos/` y quien lo llama es el dominio, así que la función **entra inyectada** (`DependenciasP7.emitirCertificado`) y no importada: al revés sería un ciclo de módulos. Es obligatoria en el tipo, para que el compilador impida un `DependenciasP7` capaz de cobrar sin certificar.

**La clave en S3 lleva la huella** (`CPC-…-v1-<sha256>.pdf`). No es un adorno: la pantalla de pago sondea en bucle, dos sondeos pueden solaparse y los dos emiten un certificado con instantes distintos —bytes distintos— antes de que el bloqueo optimista deje que solo uno se asiente. Con una clave que dependiera solo del código y la versión, el perdedor podía escribir último y dejar en el bucket un archivo cuya huella no era la registrada; la descarga fallaba con `HUELLA_NO_COINCIDE` sobre un expediente sano. Con la huella en la clave cada emisión escribe en su propio lugar, el archivo huérfano no lo referencia nadie y el del ganador es por construcción el que su huella dice.

Reparto: `src/domain/documentos.ts` y `src/domain/certificado-cobertura.ts` deciden **qué dice** cada documento (proyección del Expediente, sin `node:*`); `plantillas.ts` + `layout.ts` cómo se distribuye en la hoja; `pdf.ts` + `tipografia.ts` escriben los bytes; `qr.ts` genera el QR de verificación; `servicio.ts` cierra, hashea, guarda, transiciona y deja evidencia.

Tres cosas no negociables de este servicio:

- **Determinismo.** Mismo contenido y misma fecha de cierre ⇒ mismos bytes ⇒ mismo hash. Sin `/ID` aleatorio ni `/CreationDate` del reloj. Si el hash dependiera del momento de generación no sería una propiedad del documento, y una auditoría no podría reproducirlo.
- **Un documento, una huella** (regla inviolable #3, estructural desde D-11). `registrarPaqueteDocumental` valida que los dos códigos internos deriven del mismo correlativo; ya no hay versiones que puedan divergir porque hay una sola.
- **Sin librerías de PDF ni de QR.** Ambas se escribieron acá (menos de 400 líneas cada una) porque lo que hace falta es la matriz de módulos y los bytes del archivo, no renderers de canvas ni fuentes embebidas — y porque las librerías de PDF de uso corriente emiten metadatos no deterministas. Mismo criterio con el que P7 decidió no dibujar el QR de Bancard.

**El QR es decisión de producto, no obligación legal**: no hay fila en la matriz de cumplimiento que lo exija (la 77 exige el hash individual y la 47 vincular por correlativo o hash, cosas que el paquete cumple sin él). Codifica **solo** `<URL_BASE>/<token>` — nunca el hash (el QR va dentro del PDF que se hashea) ni ningún dato de la persona.

**El QR lleva el token público, no el código visible.** El token es
`<correlativo>-<32 hexadecimales>`: 128 bits que no se pueden adivinar, contra
los veintisiete bits del correlativo de ocho dígitos. Sin él, la página pública
de verificación —sin sesión y hoy sin límite de tasa— quedaba enumerable con un
script. El código sigue impreso en la caja del encabezado y en el pie de todas
las páginas, y `/verificar/PROP-…` sigue resolviendo: son dos formas de llegar
al **mismo** documento y el token no da acceso a nada extra, solo cierra el
camino de adivinarlo.

**Se deriva, no se sortea** (`derivarTokenVerificacion` en `src/documentos/servicio.ts`):
`SHA-256(<id del expediente>:<código>:<versión>)` truncado a 128 bits. Un token
aleatorio rompería el determinismo del servicio —el certificado se reemite en
cada reintento del pago y daría bytes distintos para el mismo instante—; el `id`
del expediente es un `randomUUID` que nunca se imprime ni viaja en una URL, y el
SHA-256 no se invierte. El código y la versión entran en la derivación para que
el QR del certificado no abra la verificación del paquete y para que una versión
nueva no herede la dirección de la anterior.

`tokenVerificacion` es `string | null`: los documentos cerrados antes de que el
token existiera lo traen en `null` y no se reescriben (regla inviolable #10). Su
QR sigue apuntando al código, que es lo que sus bytes ya llevan impreso.

Origen y análisis completo en [`docs/ANALISIS_QR_HASH_Y_EVIDENCIAS.md`](docs/ANALISIS_QR_HASH_Y_EVIDENCIAS.md),
sobre `docs/QR_HASH_Y_EVIDENCIAS_INMUTABLES.pdf`. **Pendiente asociado (L6):
límite de tasa sobre `/verificar/[codigo]`** — mientras el código tipeado
resuelva sin cupo, el recorrido de correlativos sigue siendo posible y el token
solo cierra la otra mitad.

### La verificación pública (CMP-06, Lote 5c)

`/verificar/<token|código>` es el destino del QR de cada documento con huella. Acepta las dos formas —el token que codifica el QR y el código que alguien tipea del papel—, y las dos devuelven exactamente el mismo documento; `interpretarEntrada` las distingue. Es **pública, sin sesión y sin ningún dato de la persona**: el token va impreso en un PDF que se reenvía, así que cualquiera que lo tenga abre esa página. Lo que responde son hechos del documento —código, correlativo, versión, sello de tiempo, SHA-256, firmantes con su nivel y modalidad y, en el certificado, la ventana de cobertura que declara—. Nunca el nombre, la cédula, los canales, el plan ni el importe (regla inviolable #7). Proyección en `src/domain/verificacion-documento.ts`.

**Verifica autenticidad, no vigencia**, y lo dice en la pantalla. Un certificado emitido sobre un cobro que después se devolvió sigue siendo auténtico: lo que cambió no es el documento sino la relación. Afirmar "vigente" o "anulado" exigiría una regla sobre qué le pasa a la cobertura cuando un cobro se revierte, y esa regla no está decidida en ningún documento fuente.

El comprobante de pago responde con **su propio motivo** en vez de "no encontrado": no se verifica por sí solo (D-05), y un "no encontrado" haría pensar que es falso.

**No deja evidencia por visita, y es deliberado.** Cada carga de una URL pública sería una escritura no autenticada sobre la partición del expediente, amplificable por cualquiera que tenga el código; CMP-06 pide verificación de autenticidad, no registro de cada consulta. Conviene reevaluarlo cuando L6 traiga el rate limiting.

La base del QR sale del **origen de la petición** que cierra el documento (`urlBaseVerificacion` en `src/app/api/_http/contexto-peticion.ts`), igual que la URL de retorno de Bancard: en local apunta a `localhost` y en Amplify al dominio desplegado, sin una variable de entorno más. Como el QR es parte de los bytes que se hashean, el enlace de un documento no cambia después de cerrarlo.

**Pendiente:** los tres documentos todavía no se entregan por WhatsApp y correo con acuse (CHG-44, CMP-05). Los tres **sí** se descargan desde la pantalla de confirmación (CHG-42/43), por `GET /api/p8/documento?codigo=…`.

---

## Parámetros de verificación de identidad (P5)

Los "niveles" con los que P5 decide —calidad de imagen, prueba de vida, coincidencia facial, confianza de OCR— viven **solo** en `src/domain/identidad-parametros.ts`, versionados con `VERSION_POLITICA_IDENTIDAD`. No los repitas en un adaptador ni en una pantalla.

Tres reglas, todas verificadas por tests:

- **Toda decisión biométrica se registra como `DecisionBiometrica`**: puntuación cruda + umbral aplicado + versión del modelo del proveedor + versión de la política. Un `aprobada: true` suelto no es evidencia — un auditor pregunta con qué umbral se aprobó, y las APIs sin estado de Rekognition migran de versión de modelo solas.
- **Escala 0–100 en todo el módulo**, la de Rekognition. Cualquier adaptador que hable otra escala normaliza antes de llegar al dominio.
- **La coincidencia facial usa 99, no 95** (umbral de caso sensible de AWS): de ahí cuelga la firma de un contrato de seguro de vida y la identificación ante SEPRELAD. A 99, AWS exige recortar el rostro antes de comparar — por eso existe `RECORTE_ROSTRO_OBLIGATORIO`.

Bajar cualquiera de esos umbrales "para mejorar la conversión" pone la suite en rojo a propósito. Si hay que cambiarlos, se cambia también la versión de la política, porque si no se reescribiría retroactivamente el criterio con el que se aprobaron los expedientes viejos (regla inviolable #10).

**La prueba de vida no viaja como bytes.** `CapturaSelfie` es una unión: `VIDEO` (bytes, el camino del mock) o `SESION_LIVENESS` (referencia de sesión). Con AWS Rekognition Face Liveness el video va del navegador **directo al proveedor** y el backend nunca lo ve — recibe un `SessionId` y consulta el resultado. Por eso el navegador nunca manda una puntuación: la manda el proveedor, al servidor, por referencia. Un cliente podría afirmar que aprobó sin haber hecho nada.

El adaptador de AWS (`src/adapters/live/identity-provider.ts`, `INTEGRATION_IDENTITY=live`) **rechaza el camino de bytes** en vez de comparar una foto suelta y llamarla prueba de vida; el mock rechaza el de sesión. Cada uno declara lo que no sabe hacer. La pantalla elige según `soportaSesionPruebaDeVida`, que resuelve el servidor y baja como prop — así en modo mock el chunk de Amplify UI (289 kB gzip) no se carga siquiera. Ese chunk **solo** se importa por `next/dynamic` desde `PanelPruebaDeVida.tsx`: importarlo estático lo mete en el First Load de un producto mobile-first.

`src/domain/mrz.ts` lee el MRZ TD1 del dorso (ICAO Doc 9303) y cruza sus datos contra lo que el OCR leyó en el frente. Es la única verificación de autenticidad documental que tenemos con código propio; verifica **consistencia interna, no existencia** — un MRZ inventado con dígitos bien calculados pasa. La procedencia de cada número y el límite de cada control están en §7 de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`.

**La cédula del formato anterior no tiene MRZ**, así que el OCR no puede dar nombre ni fecha de nacimiento con garantías (adivinarlos por posición violaría la regla #8). El número del frente **sí** se lee, y con él `RegistroCivilProvider` (ítem 33) trae los datos de la fuente oficial — más fuerte que leerlos del plástico. Consecuencia a tener presente: cuando esa consulta se usa, **la fecha que decide el corte de edad 18–64 viene del registro civil, no del documento**. Es una lectura de la regla #8 por su espíritu (nada declarado por la persona) y no por su letra, y por eso cada consulta deja evidencia propia (`P5_CONSULTA_REGISTRO_CIVIL`) con su referencia.

Los tres estados de ese puerto no se pueden colapsar: `NO_ENCONTRADO` es una respuesta del registro, `NO_DISPONIBLE` es que no contestó. Hoy los dos impiden continuar, pero solo el segundo justificaría derivar a revisión manual — esa salida todavía no existe (§6 del documento).

### Camino de demostración con cámara (`identity-provider-camara.ts`)

Segundo adaptador de AWS, para **demostrar el recorrido a distancia con cédulas reales**. Usa las mismas APIs (Textract + Rekognition) y se elige con `INTEGRATION_IDENTITY=live` más `INTEGRATION_IDENTITY_SELFIE=camara-demo`. **No reemplaza ni modifica al de producción**, que sigue exigiendo Face Liveness.

Tiene tres relajaciones, y las tres están selladas en la evidencia con `VERSION_POLITICA_IDENTIDAD_DEMO`:

1. **Sin prueba de vida** — `decidirPresenciaDemo` verifica que haya un rostro único, nítido y sin oclusión. Es _presencia_, no vida: una foto impresa frente a la cámara pasaría. Se llama distinto a propósito, para que la evidencia no afirme haber verificado algo que nadie verificó.
2. **Umbral facial 90 (`UMBRAL_COINCIDENCIA_FACIAL_DEMO`), no 99.** El 99 compara contra el retrato digital de la cédula; acá el retrato es una foto de un plástico con reflejos, y a 99 se rechaza al propio titular. **`UMBRAL_COINCIDENCIA_FACIAL` sigue en 99 y sus tests siguen en verde** — bajar _ese_ sigue poniendo la suite en rojo a propósito.
3. **OCR aproximado sin MRZ** (`cedula-aproximada.ts`), con heurísticas de rótulo y "la fecha más antigua es la de nacimiento". Con MRZ presente no se usa: el MRZ trae dígitos verificadores y siempre gana.

**El constructor tira si `DEMO_MODE` no es `"true"`.** Las tres relajaciones juntas permitirían firmar un seguro de vida con la foto de otra persona, así que un despliegue de producción que apuntara acá por error no arranca en vez de aprobar identidades con criterio de demo. Las referencias de evidencia llevan prefijo `DEMO-` para que se distingan de un vistazo en la consola administrativa.

Qué documentos se aceptan lo decide `src/domain/documento-regional.ts` (dominio, no adaptador: es regla de negocio). Reconoce cédula paraguaya y boliviana por marcadores impresos —información pública, sin proveedor de pago— y **no verifica autenticidad documental**: solo descarta que la fotografía sea de algo que no es una cédula. Por defecto acepta **solo Paraguay**; `IDENTITY_PAISES_CEDULA=PY,BO` suma Bolivia, que es una **decisión de demostración sin fila en la matriz de cumplimiento** y contradice a `ESPECIFICACION_PANTALLAS.md` ("No se admite pasaporte ni documento extranjero").

Las tres capturas salen de la cámara (`CapturaConCamara.tsx`) — `CAPTURA_SOLO_DESDE_CAMARA`. Requiere HTTPS: `navigator.mediaDevices` no existe en un origen inseguro, así que la demostración a distancia va por el dominio de Amplify.

**Única excepción, y solo con `DEMO_MODE=true`:** el frente y el dorso se pueden subir como archivo. **La selfie nunca**, en ningún modo — es el ancla biométrica, y un archivo ahí permitiría verificar la identidad con la cara de otra persona. Lo decide `origenCapturaAdmitido()` en el dominio, y **quien lo hace cumplir es el Route Handler**, no la pantalla: esconder el botón es cosmético, cualquiera arma la petición a mano. El origen (`CAMARA` / `ARCHIVO`) va a la evidencia, así que un expediente con documento subido nunca queda registrado como fotografiado en vivo. Es comodidad de demostración, sin fila en la matriz de cumplimiento.

## Salida de P5 a asistencia humana

Tras **tres** análisis fallidos (`INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA`), P5 deriva el expediente a `ASISTENCIA_IDENTIDAD` con su propio número de caso (`ASIS-…`) y su propia pantalla, `/asistencia-identidad`. Sin esa salida, quien tiene un documento que el sistema no sabe leer repite capturas indefinidamente: no es un rechazo, es un callejón sin salida.

**Es un estado distinto de `DERIVADO_MANUAL`, y no se pueden mezclar.** Tres razones, todas con test:

- `DERIVADO_MANUAL` significa "la elegibilidad se detuvo por salud o PEP" (regla #5) y su pantalla muestra `Declaraciones recibidas ✓`. Quien falla en P5 nunca declaró nada — reusar ese estado haría que la pantalla afirmara algo falso.
- `DERIVADO_MANUAL` **bloquea la cédula** (regla #11). `ASISTENCIA_IDENTIDAD` **no**, a propósito: bloquear a alguien porque la cámara no daba sería desproporcionado, no hay ningún indicio en su contra. Puede empezar un expediente nuevo cuando quiera.
- Son dos colas de trabajo distintas: análisis de riesgo de Alianza contra soporte de captura.

La regla #5 queda intacta: la derivación por elegibilidad sigue siendo exclusiva de las declaraciones de P6, y la arista nueva sale de `CANAL_EMAIL_VERIFICADO`, no de `IDENTIDAD_VERIFICADA`.

**Decisión de producto, sin fila en la matriz de cumplimiento.** La fila 19 respalda derivar una respuesta PEP a análisis reforzado, que es otra cosa.

## Consola administrativa

Herramienta interna nueva (staff AAB1/Interseguros/Alianza), **no forma parte de las 12 pantallas** ni del contador de 8 pasos. Especificación completa en `docs/CONSOLA_ADMINISTRATIVA.md` — leela antes de tocar esto. En resumen: búsqueda de expedientes, vista de datos y de envíos/respuestas a proveedores (incluidos los mocks), visibilidad de derivación a Pantalla A / vencimiento a Pantalla B, y reinicio con justificativo que **crea un expediente nuevo enlazado al anterior** — nunca reactiva ni cambia de estado el expediente original (`DERIVADO_MANUAL` sigue siendo terminal, regla inviolable #5). Introdujo la regla de negocio inviolable #11 (bloqueo de nuevo registro por cédula).

**Estado: implementada.** Ruta `/admin-consola`, protegida por `ADMIN_CONSOLE_ENABLED=true` y `ADMIN_CONSOLE_KEY` (secreto **distinto** del panel de demo). Búsqueda por cédula, número de caso, y estado + rango de fechas, con filtro por nombre. La búsqueda por nombre es un filtro en memoria sobre el resultado de un criterio indexado — limitación conocida, documentada en `src/domain/consola-administrativa.ts`. El detalle **sí muestra** respuestas médicas y condición PEP: es la única excepción autorizada a la regla #7, porque la consola es cumplimiento interno y no analítica/CRM/IA. No copiar ese criterio a ninguna otra pantalla.

## Panel de demo

`/demo-panel`, protegido por `DEMO_PANEL_KEY`, disponible solo con `DEMO_MODE=true` y excluido del bundle cuando el flag está apagado.

Permite: elegir persona de prueba, ver los OTP generados, acelerar el plazo de **pago** de 24 h a segundos, forzar fallos puntuales (OTP expirado, intentos agotados, timeout de Bancard, rechazo de Code100, **firmas institucionales caídas**, registro civil caído, **mensajería caída** y **entrega sin acuse**), completar el acto de firma de Code100, reiniciar el expediente y ver el registro de evidencia.

El plazo que el panel acorta es el de D-10 —24 horas para **pagar** un expediente ya firmado—, y se congela al aplicarse las firmas institucionales: para verlo caducar en segundos hay que fijarlo corto **antes** de firmar.

**El acto de firma también se puede completar sin abrir el panel**, desde el modal de P8 (`ModalFirmadorSimulado.tsx` + `/api/p8/firmador-simulado`, extensión `route.demo.ts`). Es la misma simulación de Code100, presentada como lo que es —la ventana del proveedor, no una pantalla de SeguroLoTengo— y existe para no tener que mostrar la consola de trucos en una demostración por pantalla compartida. **Nunca muestra el código**: lo recibe tipeado (regla inviolable #2). A diferencia del endpoint del panel, no acepta `idCode100` del cliente: lo saca del expediente de la sesión, y esa es la propiedad que reemplaza a la clave del panel.

El modal cubre las tres acciones del otro lado del enlace: abrir, firmar y **rechazar**. La palanca de _cortar el sellado a la mitad_ que llevaba antes **desapareció con D-11**: con un solo documento no hay dos archivos que puedan quedar a medias. La falla equivalente —y la que sí tiene un estado que mostrar— es `FIRMAS_INSTITUCIONALES_FALLAN`, que vive en el panel: el cliente firma, las cualificadas no llegan y el expediente queda en `FIRMADO_CLIENTE` con el cobro inhabilitado.

Tres reglas de las palancas del panel, todas verificadas por tests: **se consumen en un solo intento** (se ve el error una vez y el reintento funciona); **ninguna inventa un camino** — cada fallo produce un estado real que rechaza la validación de siempre, no una rama especial del código; y **ninguna existe fuera de `DEMO_MODE`**, ni siquiera si quedó armada antes de apagar el flag. El plazo de firma, además, solo se puede acortar: alargarlo sería cambiarle a la persona una condición ya informada (fila 30 de la matriz).

Personas de prueba definidas en `src/adapters/mock/personas.ts`:

- **Mónica Mariana Gorena Tapia** (C.I. 9.323.336) — camino feliz hasta P9
- **PEP positivo** — declaración 8 en Sí → Pantalla A
- **Salud incompatible** — declaraciones 1/2/3 incompatibles → Pantalla A
- **Biometría rechazada** — P5 no aprueba coincidencia facial
- **No firma** — paga en P7 y deja vencer → Pantalla B

---

## Convenciones de UI

- Cabecera de aseguradora/intermediario, stepper "Paso N de 8" y barra de plan seleccionado son componentes compartidos. **No los redefinas por pantalla.** El stepper recibe el **slug** de la pantalla, nunca un número: el orden vive en `PASOS_FLUJO` (`src/domain/rutas-flujo.ts`) y de ahí se deriva todo. Escribir un número a mano es cómo la pantalla de firma llegó a anunciar "Paso 7 de 7".
- **Tema claro/oscuro:** el botón de día/noche vive dentro de `HeaderInstitucional`, así que aparece solo en toda pantalla que use la cabecera — no lo agregues por pantalla. Para la estructura usá los tokens semánticos (`bg-fondo`, `bg-superficie`, `border-borde-sutil`, `text-titulo`, `text-cuerpo`, `text-etiqueta`), que se reescriben con el tema; para los bloques de acento (verde de seguridad, naranja de acción, rojo de bloqueo) usá la escala de marca con su variante `dark:` explícita. Referencia visual viva en `/design-system`. La paleta (claro y oscuro) es la de `docs/GUIA_DE_ESTILOS.md` —alineada a interseguros360.com por decisión de producto, reemplaza a la descripta en `docs/ESPECIFICACION_PANTALLAS.md`—; el tema oscuro tampoco tiene respaldo en la matriz de cumplimiento. La preferencia es cosmética: vive en `localStorage`, no es dato del expediente y no genera evidencia.
- P0, Pantalla A y Pantalla B están **fuera del contador de 8 pasos** y usan su propio indicador.
- Los botones de continuar arrancan deshabilitados y se habilitan solo con los requisitos de esa pantalla cumplidos.
- Los campos autocompletados por OCR en P5 se muestran con ícono de candado y **no son editables**; el único camino ante discrepancia es repetir la captura.
- Mobile-first: el producto es B2C y la mayoría del tráfico será celular.
- Nunca muestres el OTP, el número completo de tarjeta ni datos sin enmascarar en la UI del flujo.
- Textos en español rioplatense-paraguayo (voseo), exactamente como figuran en la especificación.

---

## Reglas transversales de integraciones (no negociables)

Resumen condensado de `docs/SeguroLoTengo-integraciones-externas-alta-resolucion.pdf` (mapa de 30 procesos) — aplican con la misma jerarquía que la matriz de cumplimiento, aunque no tengan un artículo de ley asociado: son controles de arquitectura ya decididos por el negocio. En el modo demo actual los adaptadores `mock` deben simular este comportamiento igual que lo tendrán que cumplir los `live`:

- OTP del celular y OTP del correo con códigos distintos y evidencias separadas (ya cubierto por regla inviolable #1).
- Salud o PEP positivo genera un `case_id`/número de caso independiente y deriva a Alianza, sin cobro ni emisión (regla inviolable #5).
- Nunca se almacena PAN ni CVV; Bancard conserva el ámbito de pago (regla inviolable #6).
- No enviar datos médicos, cédula, OTP ni pagos a CRM, analítica o registros técnicos tipo Sentry/PostHog/HubSpot (regla inviolable #7).
- Callbacks de proveedores firmados, verificables, idempotentes y vinculados a la misma propuesta (ver "Idempotencia de webhooks" arriba).
- Solicitud y FIPF: **un solo PDF**, un correlativo, dos códigos internos visibles, un acto de firma (D-11, regla inviolable #3).
- Certificado de Cobertura Provisional: solo con el cobro acreditado, en la misma escritura que lo confirma, firmado por Alianza y sin número oficial de póliza (D-12, CMP-04/06/07/18).
- Del portal se descargan **tres** documentos y ninguno más: paquete firmado, certificado y comprobante de pago (D-05). La póliza y la factura las emite y envía Alianza.
- Póliza y factura las emite y envía Alianza (SEBAOT); descarga inmediata desde SeguroLoTengo solo de Solicitud y FIPF firmados.
- No usar automatizaciones administrativas (n8n o similar) para controlar la secuencia crítica pago → firma → emisión.
- No introducir un proveedor externo nuevo sin registrarlo antes en `docs/Tabla de Integraciones externas - Tabla.csv`.

Stack de proveedores reales previsto para cuando existan adaptadores `live/` (no aplica al modo demo actual, que es 100% mock): Cloudflare, Infobip, Entrust/Onfido, ComplyAdvantage, Bancard, Code100, SEBAOT, AWS S3 + CloudTrail, Sentry, PostHog (post-piloto).

---

## Asistente IA (Terra) — fuera de alcance por ahora

`docs/SeguroLoTengo_Asistente_IA_y_Configuracion.pdf` especifica un asistente conversacional ("Terra") para el sitio público. **No está implementado ni planificado para esta sesión ni las próximas** — no es una de las 12 pantallas ni forma parte del flujo de contratación. Se documenta acá solo como referencia para cuando se confirme como requerimiento:

- Solo respondería con respaldo documental aprobado y versionado (File Search / vector store); sin respaldo, deriva a un asesor humano — nunca inventa.
- Podría responder: planes, premios, coberturas, sumas, carencias, exclusiones, edades, beneficiarios, proceso de contratación/pago/firma/entrega, procedimiento de siniestros aprobado.
- No podría responder ni procesar: elegibilidad o cobertura de un caso particular, diagnósticos/pronósticos médicos, promesas de indemnización, datos de salud/PEP/tarjeta, ni ejecutar pago, firma, emisión o modificación de pólizas.
- Debería quedar desacoplado en código del flujo transaccional (Bancard, Code100, SEBAOT): ninguna función del asistente podría invocar esos servicios.

No crear código, pantallas ni dependencias para esto sin que se pida explícitamente como una tarea nueva.

---

## Checklist antes de cerrar una tarea

Además de `npm run typecheck && npm run lint && npm test`:

1. ¿El cambio respeta el orden y contenido de los 8 pasos que fija `PASOS_FLUJO` (`src/domain/rutas-flujo.ts`) —o las Pantallas A/B— y el detalle de cada pantalla en `docs/ESPECIFICACION_PANTALLAS.md`?
2. Si toca campos de Solicitud/FIPF: ¿existen y respetan el formato de `Solicitud.pdf`/`FIPF.pdf`?
3. ¿Hay una fila en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` que respalde la regla implementada? Si no, ¿está marcado como decisión de producto y no de ley?
4. Si usa una integración externa: ¿está descrita en `docs/Tabla de Integraciones externas - Tabla.csv`? ¿Respeta las "Reglas transversales de integraciones" de arriba?
5. ¿Se generan y persisten las evidencias probatorias correspondientes (hash, timestamp, IP, canal, resultado) vía `EvidenceStore`?
6. ¿La firma, si aplica, va sobre el documento único y con los firmantes que declara `firmantes-documento.ts` (D-13)?
7. ¿El pago, si aplica, ocurre **después** de la firma (D-08) y es idempotente? ¿El único estado de origen es `FIRMADO`? ¿El Certificado de Cobertura Provisional se emite en la misma escritura que el cobro (D-12, CMP-07)? ¿La emisión exige el cobro confirmado (fila 44)?
8. ¿Ningún dato de salud, PEP, tarjeta o cédula quedó expuesto en logs no cifrados, analítica, o (a futuro) al asistente IA?

---

## Qué no hacer

- No agregues librerías pesadas sin justificarlo primero.
- No uses `any` en TypeScript. El dominio del expediente es tipado estricto.
- No escribas lógica de negocio dentro de componentes React — va en `src/domain/`.
- No hagas commits que dejen tests en rojo.
- No implementes más de una pantalla por sesión: pedime que abramos una sesión nueva.
- No inventes artículos de ley, endpoints, campos de API o pasos del flujo que no figuren en los documentos fuente.
- No generes Nota de Cobertura — el producto no la contempla. El **Certificado de Cobertura Provisional** (D-12) es otra cosa y sí existe: no compromete cobertura anticipada, se emite recién con el cobro acreditado y solo constata desde cuándo corre lo que ese cobro compró.
- No introduzcas un proveedor externo nuevo sin registrarlo antes en `docs/Tabla de Integraciones externas - Tabla.csv`, ni dejes su documentación técnica suelta en la raíz de `docs/`: va en `docs/Integraciones/`.
