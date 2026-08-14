# SeguroLoTengo — Demo del sistema integrado (AAB1)

Portal B2C de venta electrónica del **Seguro de Vida Oncológico CONFÍO**. Marca y canal digital de **Interseguros S.A.** (corredor) · Aseguradora: **Alianza Garantía Seguros y Reaseguros S.A.** · Operador tecnológico: **AAB1**. Mercado: Paraguay.

Este es un **entorno de demostración**: todas las integraciones externas están simuladas. La funcionalidad y las reglas de negocio son reales y completas.

---

## Fuente de verdad

`docs/ESPECIFICACION_DEMO.md` es el guion de demostración y el catálogo de datos de prueba (personas, planes, recorrido por pantalla, qué está simulado). **No es fuente de verdad de las pantallas** — manda el documento de abajo. Si necesitás un dato de prueba para una pantalla nueva, sacalo de ahí (`src/adapters/mock/personas.ts`) en vez de inventarlo en la pantalla.

`docs/ESPECIFICACION_PANTALLAS.md` describe las 12 pantallas al detalle (textos, campos, botones, reglas, valores). **Antes de implementar o modificar cualquier pantalla, leé la sección correspondiente de ese documento.** Si algo que te pido contradice ese documento, avisame en vez de improvisar.

No inventes campos, pasos, validaciones ni textos que no estén en la especificación. El producto está diseñado para mínima fricción: cada campo extra es un problema de negocio.

### Documentos fuente adicionales

Además de `ESPECIFICACION_PANTALLAS.md`, estos documentos en `docs/` son fuente de verdad de aspectos específicos. Cargalos antes de tocar el área indicada — no asumas su contenido de memoria si pasó tiempo desde la última lectura.

**Convención:** la documentación técnica que publica un proveedor externo (Code100, Bancard, y más adelante Infobip, Entrust, ComplyAdvantage, SEBAOT) vive agrupada en `docs/Integraciones/`. En la raíz de `docs/` quedan los documentos propios del proyecto y del producto: especificaciones, formularios, matriz de cumplimiento y catálogo de integraciones. Un PDF de proveedor nuevo va en `docs/Integraciones/`, nunca suelto en la raíz.

| Archivo | Úsalo para... |
| :---- | :---- |
| `GUIA_DE_ESTILOS.md` | Fuente de verdad de colores, tipografía (DM Sans) y uso de logos/isologos de Alianza e Interseguros, en pantallas, favicon y PDFs. La paleta reemplaza por decisión de producto a la descripta en ESPECIFICACION_PANTALLAS.md. |
| `Solicitud.pdf` | Estructura exacta y campos obligatorios de la Solicitud de Seguro (proponente, planes/coberturas, beneficiario, declaración médica, declaraciones finales, firma). El servicio de generación de PDF interno debe respetar estos campos y su orden. |
| `FIPF.pdf` | Formulario de Identificación de Persona Física (SEPRELAD): campos personales, laborales, económicos, origen de fondos, condición PEP. Referencia obligatoria del modelo de datos de KYC/AML — ya reflejado parcialmente en `DatosComplementariosP6` de `src/domain/tipos.ts`. |
| `Integraciones/Documentacion Firmador - API FLOW.pdf` | Contrato técnico exacto de la API de Code100 (`POST /signature/auth`, `GET /signature/session-start`, `POST /signature/getSessionId`, `POST /signature/sign-pdf`). Gobierna el futuro adaptador oficial de `SignatureProvider` en `src/adapters/live/`. No inventar parámetros ni endpoints distintos a los documentados ahí. |
| `Integraciones/eCommerce_bancard_compra_simple_version_1.23.1 (1).pdf`, `Integraciones/Preaut y promociones 14.pdf`, `Integraciones/Qr en API de Comercios v1.2 16 (1).pdf` | Contrato técnico exacto de las APIs de Bancard: compra simple de eCommerce, preautorización y captura, y QR de comercios. Gobiernan el futuro adaptador oficial de `PaymentProvider` (P7). Mismo criterio que con Code100: no inventar parámetros ni endpoints. |
| `RECOMENDACIONES_ONBOARDING_IDENTIDAD.md` | Estrategia de P5 (Rekognition/Textract para demo y piloto, brecha de autenticidad documental, RFP para producción) y **§7: los parámetros internacionales de calidad de rostro, prueba de vida y coincidencia facial**, con su procedencia. Los números viven implementados en `src/domain/identidad-parametros.ts`; ese documento explica por qué son esos. |
| `Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` | Matriz normativa (Número, Categoría R1–R8, Título, Norma y Artículo). Fuente de verdad regulatoria del proyecto — ver "Regla de trabajo con los documentos" abajo. |
| `Tabla de Integraciones externas - Tabla.csv` y `SeguroLoTengo-integraciones-externas-alta-resolucion.pdf` | Catálogo de las integraciones externas reales que los adaptadores `live/` deberán implementar algún día (Bancard, Code100, SEBAOT, Infobip, Entrust, ComplyAdvantage, etc.), agrupadas en 30 procesos / 6 categorías, con proveedor y estado de decisión de cada una. Ver "Reglas transversales de integraciones" más abajo para el resumen no negociable. |
| `Cumplimiento SeguroLoTengo.pdf` | Versión narrativa de la matriz de cumplimiento; usar como respaldo textual cuando el CSV no alcance el detalle necesario. |
| `SeguroLoTengo_Asistente_IA_y_Configuracion.pdf` | Especificación del asistente Terra — **fuera de alcance de esta demo por ahora**, ver sección "Asistente IA (Terra)" más abajo. |

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

  documentos/             \# generación de la Solicitud y el FIPF: PDF, QR, hash

  ports/                  \# las 8 interfaces de proveedores externos

  adapters/mock/          \# implementaciones simuladas

  adapters/live/          \# implementaciones oficiales (Rekognition + Textract)

  repositories/           \# acceso a DynamoDB y S3, detrás de interfaces

docs/                     \# especificación de pantallas y decisiones

infra/                    \# Terraform

---

## Regla de trabajo con los documentos

- **Nunca cites de memoria un artículo de ley.** Si necesitás justificar una regla de negocio, buscá la fila correspondiente en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` y citá Número + Categoría + Norma y Artículo tal como figuran ahí.
- Si un pedido no tiene fila en esa matriz, decilo explícitamente: *"Esto no tiene respaldo en la matriz de cumplimiento cargada; es una decisión de producto/UX, no una obligación legal"*.
- Los PDF (`Solicitud.pdf`, `FIPF.pdf`, `Pantallas Sistema Demo.pdf`) son la fuente de verdad de **estructura de datos y UI**. El CSV de cumplimiento es la fuente de verdad de **obligación legal**. No mezclar ambos como si fueran lo mismo.
- Ante conflicto entre lo que se pide y lo que exige la matriz de cumplimiento (por ejemplo, saltear un OTP, iniciar cobertura antes del pago, o permitir contratar para un tercero), **priorizá la matriz** y señalá el conflicto en vez de implementarlo en silencio.

---

## Reglas de negocio inviolables

Estas reglas tienen consecuencia legal (Ley 6822/2021 de firma electrónica, Ley 4868/13, Ley 1334/98, Ley 827/96, Res. SS SG. 215/15 y 223/17, Res. SEPRELAD 71/19 y 50/20, Res. BCP 25/21 — ver cita exacta por fila en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`). El código debe hacerlas **imposibles de violar**, no solo evitarlas.

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
11. **Bloqueo de nuevo registro por cédula**: mientras una cédula tenga un expediente en `DERIVADO_MANUAL`, `VENCIDO`, `DEVOLUCION_EN_TRAMITE` o `DEVUELTO` **sin superar**, el flujo digital normal (P0–P9) no deja empezar otro con esa cédula. Se aplica en P5, que es donde el sistema conoce la cédula. Solo la consola administrativa levanta el bloqueo, y lo hace creando un expediente **nuevo** enlazado por `expedienteAnteriorId` — nunca reactivando el viejo, que sigue siendo terminal (regla #5). El bloqueo no es un flag editable: se deriva de la cadena de expedientes. Ver `src/domain/consola-administrativa.ts`.

---

## Máquina de estados del expediente

INICIADO → CANAL\_WA\_VERIFICADO → PLAN\_SELECCIONADO → AUTORIZADO

  → CANAL\_EMAIL\_VERIFICADO → IDENTIDAD\_VERIFICADA

     ├─ DERIVADO\_MANUAL (terminal) → Pantalla A

     └─ DECLARACIONES\_OK → PAGO\_CONFIRMADO → PAQUETE\_GENERADO

            ├─ VENCIDO → DEVOLUCION\_EN\_TRAMITE → DEVUELTO (Pantalla B)

            └─ FIRMADO → EMITIDO → P9

`EMITIDO` significa **solicitud aceptada y emisión ordenada**, no "póliza en mano": P9 lo muestra como `Solicitud aceptada ✓` junto a `Póliza en preparación ⋯`. El estado del documento vive aparte, en `Expediente.poliza`, y lo mueve Alianza (SEBAOT y SIFEN) a su ritmo — por eso son dos cosas distintas. La póliza **conserva el correlativo de la propuesta**: SEBAOT no acuña un número nuevo.

`DEVUELTO` cierra la rama del vencimiento: `DEVOLUCION_EN_TRAMITE` es un trámite en curso —no un final— y el pie de la Pantalla B declara el estado final del expediente como `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`. La devolución la ejecuta Alianza presencialmente, fuera del flujo digital; el expediente solo la asienta. Ninguno de los dos estados vuelve al flujo ni llega a póliza, y los dos bloquean por regla #11.

Hay una arista más que no está dibujada arriba: **PAGO\_CONFIRMADO → VENCIDO**. El plazo de 24 horas arranca con el pago confirmado, no con el cierre del paquete, así que un expediente pagado cuya persona nunca abrió P8 también tiene que poder vencer; sin esa arista habría un pago sin vencimiento posible. No abre ningún camino nuevo hacia adelante: VENCIDO sigue saliendo solo a DEVOLUCION\_EN\_TRAMITE. La justificación completa está junto al grafo en `src/domain/expediente.ts`.

Toda transición pasa por `src/domain/expediente.ts`. **Ningún Route Handler modifica el estado directamente.** Si necesitás una transición nueva, se agrega ahí con su validación.

---

## Arquitectura de puertos y adaptadores

Los 8 proveedores externos viven detrás de interfaces en `src/ports/`:

`OtpProvider` · `IdentityProvider` · `ComplianceProvider` · `PaymentProvider` · `SignatureProvider` · `PolicyIssuer` · `EvidenceStore` · `RegistroCivilProvider`

**Regla dura:** ningún archivo fuera de `src/adapters/` puede importar un SDK de proveedor externo ni hacer fetch a una API externa. Todo pasa por el puerto. Lo mismo para el acceso a datos: nada llama al SDK de DynamoDB o S3 fuera de `src/repositories/`.

La selección de adaptador es por variable de entorno (`INTEGRATION_MODE`, o flags granulares `INTEGRATION_OTP`, `INTEGRATION_PAYMENT`, etc.). Los mocks y las implementaciones oficiales comparten los mismos tests de contrato en `src/ports/__tests__/`.

### Contrato oficial de `SignatureProvider` (Code100)

Cuando se implemente `src/adapters/live/signature-provider.ts`, debe usar exclusivamente el flujo documentado en `docs/Integraciones/Documentacion Firmador - API FLOW.pdf` — no inventar parámetros ni endpoints:

```
POST /signature/auth            → token
GET  /signature/session-start   → _authUrl (iframe), session_id
POST /signature/getSessionId    → code, state, cert_info (estado de firma)
POST /signature/sign-pdf        → pdf_base64 firmado (documents_signeds)
```

Reglas no negociables de esa integración (ya reflejadas a nivel de tipos en `src/ports/signature-provider.ts`, regla inviolable #3): la Solicitud y el FIPF viajan en el **mismo** `session_id`, nunca en llamadas separadas; los documentos se cierran (hash + versión) antes de enviarse a firmar; el orden de firmas es cliente (no cualificada) → Interseguros y Alianza (cualificada, en paralelo), nunca al revés; se registran PDFs, hashes, canal, `session_id`, firmantes, fecha, hora, IP y callbacks.

### Idempotencia de webhooks (Bancard y Code100)

Los adaptadores oficiales de `PaymentProvider` y `SignatureProvider` deben tratar sus webhooks/callbacks como potencialmente duplicados (reintentos de red, doble entrega). `src/ports/payment-provider.ts` ya expone `idempotencyKey` en los métodos de inicio de pago y documenta `capturarPreautorizacion`/`cancelarOLiberarReserva` como idempotentes por `referenciaBancard` — cualquier adaptador debe cumplir esa garantía, no solo el mock.

---

## Servicio de generación de documentos

`src/documentos/` cierra la Solicitud (`PROP-<correlativo>`) y el FIPF (`FIPF-<correlativo>`) — **un solo correlativo, dos prefijos**, el que acuña P7 en `Expediente.numeroPropuesta` — calcula el SHA-256 de cada PDF, los guarda por `ArchivoRepository` y transiciona PAGO_CONFIRMADO → PAQUETE_GENERADO. Es el paso que habilita la firma de P8: sin paquete cerrado y hasheado no hay nada válido que mandarle a Code100 (regla inviolable #4).

**No es un proveedor externo, así que no tiene puerto.** Los 7 puertos modelan integraciones con terceros; generar un PDF propio no lo es. Lo único que pasa por infraestructura es guardar el archivo, y eso ya entra por `src/repositories/archivo-repository.ts`.

Reparto: `src/domain/documentos.ts` decide **qué dice** cada documento (proyección del Expediente, sin `node:*`); `plantillas.ts` + `layout.ts` cómo se distribuye en la hoja; `pdf.ts` + `tipografia.ts` escriben los bytes; `qr.ts` genera el QR de verificación; `servicio.ts` cierra, hashea, guarda, transiciona y deja evidencia.

Tres cosas no negociables de este servicio:

- **Determinismo.** Mismo contenido y misma fecha de cierre ⇒ mismos bytes ⇒ mismo hash. Sin `/ID` aleatorio ni `/CreationDate` del reloj. Si el hash dependiera del momento de generación no sería una propiedad del documento, y una auditoría no podría reproducirlo.
- **Los dos documentos entran juntos o no entra ninguno** (regla inviolable #3). `registrarPaqueteDocumental` es una sola escritura y valida que ambos códigos deriven del mismo correlativo y compartan versión.
- **Sin librerías de PDF ni de QR.** Ambas se escribieron acá (menos de 400 líneas cada una) porque lo que hace falta es la matriz de módulos y los bytes del archivo, no renderers de canvas ni fuentes embebidas — y porque las librerías de PDF de uso corriente emiten metadatos no deterministas. Mismo criterio con el que P7 decidió no dibujar el QR de Bancard.

**El QR es decisión de producto, no obligación legal**: no hay fila en la matriz de cumplimiento que lo exija (la 77 exige el hash individual y la 47 vincular por correlativo o hash, cosas que el paquete cumple sin él). Codifica **solo** `<URL_BASE>/<código>` — nunca el hash (el QR va dentro del PDF que se hashea) ni ningún dato de la persona.

**Pendiente:** la ruta `/verificar/<código>` a la que apunta el QR todavía no existe, y el servicio no está expuesto por HTTP — lo va a cablear el Route Handler de P8 con `crearArchivoRepository()`, que ya está.

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

## Consola administrativa

Herramienta interna nueva (staff AAB1/Interseguros/Alianza), **no forma parte de las 12 pantallas** ni del contador de 9 pasos. Especificación completa en `docs/CONSOLA_ADMINISTRATIVA.md` — leela antes de tocar esto. En resumen: búsqueda de expedientes, vista de datos y de envíos/respuestas a proveedores (incluidos los mocks), visibilidad de derivación a Pantalla A / vencimiento a Pantalla B, y reinicio con justificativo que **crea un expediente nuevo enlazado al anterior** — nunca reactiva ni cambia de estado el expediente original (`DERIVADO_MANUAL` sigue siendo terminal, regla inviolable #5). Introdujo la regla de negocio inviolable #11 (bloqueo de nuevo registro por cédula).

**Estado: implementada.** Ruta `/admin-consola`, protegida por `ADMIN_CONSOLE_ENABLED=true` y `ADMIN_CONSOLE_KEY` (secreto **distinto** del panel de demo). Búsqueda por cédula, número de caso, y estado + rango de fechas, con filtro por nombre. La búsqueda por nombre es un filtro en memoria sobre el resultado de un criterio indexado — limitación conocida, documentada en `src/domain/consola-administrativa.ts`. El detalle **sí muestra** respuestas médicas y condición PEP: es la única excepción autorizada a la regla #7, porque la consola es cumplimiento interno y no analítica/CRM/IA. No copiar ese criterio a ninguna otra pantalla.

## Panel de demo

`/demo-panel`, protegido por `DEMO_PANEL_KEY`, disponible solo con `DEMO_MODE=true` y excluido del bundle cuando el flag está apagado.

Permite: elegir persona de prueba, ver los OTP generados, acelerar el plazo de firma de 24 h a segundos, forzar fallos puntuales (OTP expirado, intentos agotados, timeout de Bancard, **fallo de captura de Bancard**, rechazo de Code100, **registro civil caído**), completar el acto de firma de Code100, reiniciar el expediente y ver el registro de evidencia.

Tres reglas de las palancas del panel, todas verificadas por tests: **se consumen en un solo intento** (se ve el error una vez y el reintento funciona); **ninguna inventa un camino** — cada fallo produce un estado real que rechaza la validación de siempre, no una rama especial del código; y **ninguna existe fuera de `DEMO_MODE`**, ni siquiera si quedó armada antes de apagar el flag. El plazo de firma, además, solo se puede acortar: alargarlo sería cambiarle a la persona una condición ya informada (fila 30 de la matriz).

Personas de prueba definidas en `src/adapters/mock/personas.ts`:

- **Mónica Mariana Gorena Tapia** (C.I. 9.323.336) — camino feliz hasta P9  
- **PEP positivo** — declaración 8 en Sí → Pantalla A  
- **Salud incompatible** — declaraciones 1/2/3 incompatibles → Pantalla A  
- **Biometría rechazada** — P5 no aprueba coincidencia facial  
- **No firma** — paga en P7 y deja vencer → Pantalla B

---

## Convenciones de UI

- Cabecera de aseguradora/intermediario, stepper "Paso N de 9" y barra de plan seleccionado son componentes compartidos. **No los redefinas por pantalla.**  
- **Tema claro/oscuro:** el botón de día/noche vive dentro de `HeaderInstitucional`, así que aparece solo en toda pantalla que use la cabecera — no lo agregues por pantalla. Para la estructura usá los tokens semánticos (`bg-fondo`, `bg-superficie`, `border-borde-sutil`, `text-titulo`, `text-cuerpo`, `text-etiqueta`), que se reescriben con el tema; para los bloques de acento (verde de seguridad, naranja de acción, rojo de bloqueo) usá la escala de marca con su variante `dark:` explícita. Referencia visual viva en `/design-system`. La paleta (claro y oscuro) es la de `docs/GUIA_DE_ESTILOS.md` —alineada a interseguros360.com por decisión de producto, reemplaza a la descripta en `docs/ESPECIFICACION_PANTALLAS.md`—; el tema oscuro tampoco tiene respaldo en la matriz de cumplimiento. La preferencia es cosmética: vive en `localStorage`, no es dato del expediente y no genera evidencia.  
- P0, Pantalla A y Pantalla B están **fuera del contador de 9 pasos** y usan su propio indicador.  
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
- Solicitud y FIPF: mismo correlativo, prefijos distintos, mismo acto de firma del cliente (regla inviolable #3).
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

1. ¿El cambio respeta el orden y contenido de los 9 pasos (o Pantallas A/B) de `docs/ESPECIFICACION_PANTALLAS.md`?
2. Si toca campos de Solicitud/FIPF: ¿existen y respetan el formato de `Solicitud.pdf`/`FIPF.pdf`?
3. ¿Hay una fila en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` que respalde la regla implementada? Si no, ¿está marcado como decisión de producto y no de ley?
4. Si usa una integración externa: ¿está descrita en `docs/Tabla de Integraciones externas - Tabla.csv`? ¿Respeta las "Reglas transversales de integraciones" de arriba?
5. ¿Se generan y persisten las evidencias probatorias correspondientes (hash, timestamp, IP, canal, resultado) vía `EvidenceStore`?
6. ¿La firma, si aplica, sigue la regla atómica de Code100 (Solicitud + FIPF en un solo acto)?
7. ¿El pago, si aplica, respeta el flujo Bancard (QR-antes-de-firma o preautorización-antes/captura-después) y es idempotente? ¿La emisión exige el cobro **confirmado** y no solo garantizado (fila 44: una preautorización sin capturar habilita la firma, no la póliza)?
8. ¿Ningún dato de salud, PEP, tarjeta o cédula quedó expuesto en logs no cifrados, analítica, o (a futuro) al asistente IA?

---

## Qué no hacer

- No agregues librerías pesadas sin justificarlo primero.  
- No uses `any` en TypeScript. El dominio del expediente es tipado estricto.  
- No escribas lógica de negocio dentro de componentes React — va en `src/domain/`.  
- No hagas commits que dejen tests en rojo.  
- No implementes más de una pantalla por sesión: pedime que abramos una sesión nueva.
- No inventes artículos de ley, endpoints, campos de API o pasos del flujo que no figuren en los documentos fuente.
- No generes Nota de Cobertura — el producto no la contempla.
- No introduzcas un proveedor externo nuevo sin registrarlo antes en `docs/Tabla de Integraciones externas - Tabla.csv`, ni dejes su documentación técnica suelta en la raíz de `docs/`: va en `docs/Integraciones/`.

