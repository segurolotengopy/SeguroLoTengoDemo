# ESTADO ACTUAL — Auditoría Fase 0 (Plan de Cambios v2)

**Fecha:** 19 de agosto de 2026 · **Autor:** auditoría automatizada Fase 0 (solo lectura)
**Insumos:** Reunión Interseguros 18-ago-2026 (transcripción completa, 00:00–00:47:46), PantallasDemo2.pdf (8 wireframes), Matriz Legal Final V4 (16-ago-2026, 11 páginas), ESPECIFICACION.pdf (17-ago-2026, 13 páginas), código del repositorio en rama `feat/p5-captura-fiel-y-confirmacion` (working tree limpio).

---

## 1. Fuentes: ubicación, estado de lectura y pendientes

Los antecedentes no estaban en el repositorio; se localizaron en el equipo y se copiaron a la estructura que exige el prompt maestro:

| Fuente | Origen encontrado | Destino en el repo | Lectura |
| :--- | :--- | :--- | :--- |
| Transcripción reunión 18-ago | `~/Descargas/` | `docs/antecedentes/Reunión inerseguros 2026_08_18 10_06.md` | **Completa** (notas de Gemini + 47 min de diálogo; el resto del archivo son capturas base64 embebidas, sin texto adicional) |
| Ídem en PDF con imágenes (aporte 19-ago) | `~/Descargas/` | `docs/antecedentes/Reunión inerseguros 2026_08_18 10_06.pdf` | **Revisada** (43 páginas; mismo texto, y las imágenes embebidas son capturas de los propios wireframes de PantallasDemo2 — sin contenido adicional) |
| PantallasDemo2.pdf | `~/Documentos/SeguroLo Tengo/Demo2/` | `docs/antecedentes/PantallasDemo2.pdf` | **Completa** (8 páginas) |
| Matriz Legal Final V4 | `~/Documentos/SeguroLo Tengo/Documentos y Normativa/` | `docs/normativa/matriz 16 08 2026.pdf` | **Completa** (11 páginas, §1–§10) |
| ESPECIFICACION.pdf | ídem | `docs/normativa/ESPECIFICACION.pdf` | **Completa** (texto digital) |
| Res. 210/2025, 231/2025, 190/2025, Circ. 011/2025, 117/2026 | ídem | `docs/normativa/` | Inventariadas (5+5+3+3+2 páginas, escaneadas). Lectura artículo por artículo diferida a Fase 1/2, al implementar cada copy legal; los mínimos ya están destilados en la matriz V4 y en §8 del prompt |
| Fixtures de identidad (cédula PY de Rodrigo Fernández ×2 + rostro) | `~/Documentos/SeguroLo Tengo/Demo2/` | `tests/fixtures/identidad/` — **PENDIENTE: copia bloqueada** | — |

**Pendiente operativo 1 — fixtures:** el clasificador de permisos de la sesión bloqueó copiar documentos de identidad reales al repositorio (restricción de privacidad razonable). Copia manual sugerida:

```bash
cd "/home/andres-alberdi/Documentos/SeguroLo Tengo/Demo2" && mkdir -p /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad && cp "Cedula Paraguay Rodrigo Fernandez 0.png" /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/Cedula_Paraguay_Rodrigo_Fernandez_0.png && cp "Cedula Paraguay Rodrigo Fernandez 1.jpeg" /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/Cedula_Paraguay_Rodrigo_Fernandez_1.jpeg && cp "WhatsApp Image 2026-08-18 at 08.41.16.jpeg" /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/WhatsApp_Image_20260818_at_08.41.16.jpeg
```

**Pendiente operativo 2 — confidencialidad:** son datos reales cedidos para pruebas. Antes de cualquier commit debe agregarse `/tests/fixtures/identidad/` a `.gitignore` (el remoto es GitHub; el prompt §11 prohíbe subirlos a repos públicos). Propuesto para el Lote 1 del plan.

### 1.1 Verificación transcripción ↔ §5 del prompt

Se leyó el diálogo completo. **El §5 es fiel a la reunión; no se detectaron discrepancias materiales.** Matices confirmados que conviene registrar:

- **CHG-01** (00:05:49–00:06:56): el intercambio 2↔3 lo propone Andres y Rodrigo acepta ("me parece gran idea… no cambia muchas cosas"). La nota automática de Gemini efectivamente lo resume mal, como advierte el prompt.
- **NC-02** (00:04:25 y 00:15:51): se descarta el OTP de correo; el doble tipeo **se conserva** ("siempre es bueno ese doble check").
- **CHG-42/44** (00:41:40): Rodrigo dice primero "nota de cobertura" y se corrige en vivo: el documento se llama **Certificado de Cobertura Provisional**. Relevante porque el CLAUDE.md actual prohíbe generar "Nota de Cobertura" — ver conflicto C-6.
- **CHG-05** (00:00:00): sobre los PDF de coberturas Rodrigo responde "El mismo va a ser, yo creo" — tentativo, confirma el estado \[ABIERTO\].
- **PEN-08** (00:46:12): "voy a habilitar el carnet boliviano… para el demo" — el repo ya lo soporta vía `IDENTITY_PAISES_CEDULA=PY,BO`.
- **ALR-01**: en la reunión (00:06:56) Rodrigo valora el texto combinado OTP+marketing como "totalmente disuasivo"; la matriz V4 §4 y la ESPECIFICACION (§4, "No se autoriza marketing mediante OTP") lo prohíben. El conflicto es real y queda para decisión.
- **ALR-02**: la reunión (00:35:15–00:36:51) lee la pantalla de pago con tarjeta sin objetarla; la matriz V4 §1 cierra "Bancard exclusivamente QR" y la ESPECIFICACION la ratifica. Conflicto real, queda para decisión.

---

## 2. Inventario del sistema actual

### 2.1 Stack y arquitectura

- **Next.js 15** (App Router, TS estricto, fijo en 15 por Amplify Hosting), Tailwind + componentes propios, **DynamoDB tabla única** (expedientes + OTP con TTL), **S3** (evidencias y PDF), Amplify WEB_COMPUTE, Vitest + Playwright (7 escenarios E2E en verde + generador de capturas).
- **Puertos y adaptadores:** 8 interfaces en `src/ports/` (`OtpProvider`, `IdentityProvider`, `ComplianceProvider`, `PaymentProvider`, `SignatureProvider`, `PolicyIssuer`, `EvidenceStore`, `RegistroCivilProvider`); mocks en `src/adapters/mock/`, oficiales parciales en `src/adapters/live/` (Rekognition+Textract, SES, WhatsApp-Modular). Selección por `INTEGRATION_MODE` / flags granulares. Tests de contrato compartidos.
- **Máquina de estados única** en `src/domain/expediente.ts`; ningún Route Handler transiciona por su cuenta.
- **Documentos:** `src/documentos/` genera Solicitud (`PROP-<correlativo>`) y FIPF (`FIPF-<correlativo>`) — dos PDF, un correlativo — deterministas, SHA-256, sin librerías externas; registro atómico del paquete.
- **Evidencia:** append-only vía `EvidenceStore` (fecha/hora, IP, dispositivo, sesión, versión de texto aceptado, resultado por paso). Ya cubre gran parte de TRV-01/CMP-15.
- **Herramientas internas:** `/demo-panel` (DEMO_MODE), `/admin-consola` (búsquedas, evidencia, reinicio por expediente nuevo enlazado), `/design-system`.

### 2.2 Mapa pantalla → archivos → servicios → persistencia

Nomenclatura del prompt entre paréntesis. Todas las pantallas comparten `HeaderInstitucional`, `StepperPasos`, `BarraPlanDelExpediente` y tema claro/oscuro.

| Pantalla actual | Ruta | API | Dominio | Adaptadores / persistencia |
| :--- | :--- | :--- | :--- | :--- |
| P0 Información (fuera del contador) | `src/app/page.tsx` | — | `textos-p1.ts` parcial | — |
| **P1 · Paso 1/9** Verificación WhatsApp (→ será paso 2) | `(flujo)/p1-whatsapp` | `api/p1/otp/{enviar,reenviar,verificar}` | `reglas-otp.ts`, `telefono.ts`, `verificacion-canal-whatsapp.ts` | `OtpProvider` (mock / `whatsapp-modular.ts`), `otp-repository` (solo hash, TTL) |
| **P2 · Paso 2/9** Selección de plan (→ será paso 1) | `(flujo)/p2-plan` | `api/p2/plan` | `catalogo.ts` (290/475/660 mil Gs.), `seleccion-plan.ts` | `expediente-repository` |
| **P3 · Paso 3/9** Preparación y autorización (→ queda paso 3) | `(flujo)/p3-preparacion` | `api/p3/autorizacion` | `autorizacion-inicial.ts`, `textos-p3.ts` | evidencia de aceptación |
| **P4 · Paso 4/9** OTP de correo (→ **se elimina como paso**, NC-02) | `(flujo)/p4-correo` | `api/p4/otp/*` | `verificacion-canal-correo.ts`, `correo.ts` | `otp-provider-correo-ses.ts` + `docs/CONFIGURACION_SES.md`, `infra/ses-correo-otp.tf` |
| **P5 · Paso 5/9** Identidad (→ paso 4, absorbe correo con doble tipeo) | `(flujo)/p5-identidad` | `api/p5/{captura,analisis,identidad,liveness-sesion}` | `identidad-parametros.ts` (política versionada), `mrz.ts`, `documento-regional.ts`, `calidad-captura.ts`, `verificacion-identidad.ts` | `identity-provider.ts` (Face Liveness), `identity-provider-camara.ts` (demo), `registro-civil`, Textract/Rekognition |
| **P6 · Paso 6/9** Datos y declaraciones (→ paso 5; pierde datos fiscales, CHG-26) | `(flujo)/p6-declaraciones` | `api/p6/declaraciones` | `declaraciones-p6.ts`, `elegibilidad.ts`, `catalogo-p6.ts`, `textos-p6.ts` | `ComplianceProvider`; incompatible → `DERIVADO_MANUAL` |
| **P7 · Paso 7/9** Pago (→ pasa a paso 7 pero **después** de la firma; recibe datos fiscales, CHG-34) | `(flujo)/p7-pago` | `api/p7/{resumen,pago,estado}` | `pago-p7.ts`, `textos-p7.ts` | `PaymentProvider` mock Bancard (QR + preaut/captura, idempotente); acuña `numeroPropuesta` |
| **P8 · Paso 8/9** Revisión y firma (→ paso 6, **antes** del pago) | `(flujo)/p8-firma` | `api/p8/{resumen,documento,firma,estado,vencimiento,firmador-simulado}` | `firma-p8.ts`, `documentos.ts` + `src/documentos/` | `SignatureProvider` mock Code100 (firma atómica Solicitud+FIPF); OTP de firma propio |
| **P9 · Paso 9/9** Confirmación (→ paso 8) | `(flujo)/p9-confirmacion` | `api/p9/{resumen,estado,comunicaciones}` | `emision-p9.ts`, `textos-p9.ts` | `PolicyIssuer` mock (SEBAOT), estado de póliza separado |
| Pantalla A · Derivación manual (= "Pantalla B" del prompt v2) | `revision-manual/` | `api/expediente/caso` | `textos-pantalla-a.ts` | terminal; bloquea cédula (regla #11) |
| Pantalla B actual · Vencimiento/devolución | `solicitud-vencida/` | `api/pantalla-b/caso` | `devolucion-pantalla-b.ts` | rama `VENCIDO → DEVOLUCION_EN_TRAMITE → DEVUELTO` |
| Asistencia de identidad | `asistencia-identidad/` | `api/expediente/asistencia-identidad` | `textos-asistencia-identidad.ts` | terminal, **no** bloquea cédula |

Máquina de estados vigente: `INICIADO → CANAL_WA_VERIFICADO → PLAN_SELECCIONADO → AUTORIZADO → CANAL_EMAIL_VERIFICADO → (ASISTENCIA_IDENTIDAD | IDENTIDAD_VERIFICADA) → (DERIVADO_MANUAL | DECLARACIONES_OK) → PAGO_CONFIRMADO → PAQUETE_GENERADO → (VENCIDO → DEVOLUCION_EN_TRAMITE → DEVUELTO | FIRMADO → EMITIDO)`.

---

## 3. Flujo actual vs. flujo objetivo

| # objetivo | Pantalla objetivo (reunión + matriz) | Equivalente actual | Movimiento |
| :--- | :--- | :--- | :--- |
| 1 | Selección de plan | P2 (paso 2) | Sube a paso 1 |
| 2 | Verificación de WhatsApp (CHG-01) | P1 (paso 1) | Baja a paso 2 |
| 3 | Prepará lo necesario | P3 (paso 3) | Sin movimiento |
| 4 | Datos e identificación (correo doble tipeo + OCR + selfie + datos por norma) | P5 + parte de P4 | P4 desaparece como paso; su UI de correo se integra sin OTP |
| 5 | Datos y declaraciones (sin datos fiscales) | P6 | Renumera; CHG-26 |
| 6 | Revisá, aceptá y firmá (Code100) | P8 | **Se adelanta: firma antes del pago** |
| 7 | Prepará/Realizá el pago (QR post-firma, CMP-07) | P7 | **Se retrasa: pago después de la firma**; recibe datos fiscales |
| 8 | Contratación confirmada + CPC | P9 | Renumera; suma CPC |
| B | Terminal de evaluación | Pantalla A actual (`revision-manual`) | Renombrar/reconciliar nomenclatura |
| — | (sin equivalente objetivo) | Pantalla B actual (`solicitud-vencida`) | La rama "pagó y no firmó" **deja de poder existir**; la reemplaza "firmó y no pagó" (QR vencido, regeneración CMP-08 sin devolución) |

El contador pasa de "Paso N de 9" a "Paso N de 8". Los wireframes traen encabezados incoherentes ("de 6", "de 7", "paso 7 de 7" en firma, "paso 3 de 6" en confirmación): confirman CHG-02, se normaliza todo a 8.

---

## 4. Brechas contra §5 (resumen por ID)

**Ya cubierto total o mayormente por el código actual** (verificar y cerrar detalles en el plan): TRV-02 (barra de plan en todo el flujo), TRV-05/NC-08 (voseo, falta pasada de homogeneización), TRV-06 (mobile-first; pendiente auditoría 375px ya conocida), TRV-07, CHG-06 (+595 fijo; BO por flag), CHG-07 (OTP 6 dígitos/5 min/3 intentos/reenvío 60s, solo hash), CHG-10, CHG-12, CHG-15-parcial (candados OCR; falta la **edición con cotejo**, hoy la única salida es recapturar), CHG-19, CHG-23, CHG-24-parcial (beneficiario existente en P6; verificar campos exactos), CHG-25/CHG-47 (derivación a pantalla terminal con envío a Alianza — `enviar-alianza` ya existe en consola), NC-05, NC-06, NC-07-parcial (24 h post-pago ya es la regla de inicio).

**Cambios de copy/UI puntuales:** TRV-03 (popup marca, con feature flag por ALR-03), TRV-04 (links a webs oficiales), CHG-03, CHG-04 (registro de reproducción de video), CHG-05 (enlace por plan, parametrizable), CHG-08 (texto autorización — sujeto a ALR-01), CHG-09, CHG-11, CHG-16, CHG-17, CHG-18 (campos por norma: hoy `DatosComplementariosP6` cubre parte; falta país de nacimiento/estado civil/nacionalidad/país de residencia como bloque de P4-objetivo + bloqueo por configuración de producto), CHG-20, CHG-21 (guía sí/no habilita, desactivable), CHG-22, CHG-27, CHG-28, CHG-31, CHG-32, CHG-35, CHG-36, CHG-37, CHG-38, CHG-39 (ABIERTO), CHG-45 (datos reales CMP-22), CHG-46.

**Cambios estructurales** (diseño técnico obligatorio en Fase 1): CHG-01/02 (reordenamiento + renumeración), CHG-14 (layout correo→identidad→prellenado), CHG-26/34 (mover datos fiscales), CHG-29 (visor sin descarga pre-firma — hoy P8 tiene descarga del paquete), CHG-30 (PDF unificado — el servicio de documentos hoy emite dos PDF con dos prefijos), CHG-33 (callback de firma que habilita pago — hoy el orden es el inverso), CHG-41 (P9: quitar "48 horas…", inicio = pago + 24 h exactas — la regla ya existe en dominio), CHG-42/43/44 (CPC: documento nuevo, descarga y envío automático con reintentos), TRV-01 (el `EvidenceStore` ya registra pasos; falta ampliar a clics/descargas/reproducciones y consulta), NC-02 (retirar OTP de correo del flujo sin violar el aislamiento de canales — decisión sobre qué pasa con `CANAL_EMAIL_VERIFICADO`).

---

## 5. Conflictos que requieren decisión explícita (no se implementan en silencio)

Además de las alertas ALR-01…ALR-05 del prompt (todas confirmadas contra las fuentes), la auditoría detecta **conflictos entre el plan v2 y las reglas internas del repositorio** (CLAUDE.md, "reglas de negocio inviolables"). El código actual hace estas reglas imposibles de violar, así que no se pueden "sortear": hay que **re-basar la línea normativa interna** como parte del plan, con registro en DECISIONES.md.

| # | Conflicto | Regla interna afectada | Fuente nueva que la contradice |
| :--- | :--- | :--- | :--- |
| C-1 | Eliminar el OTP de correo | Regla inviolable #1 ("tres OTP independientes": celular P1, correo P4, firma P8) | NC-02, reunión 00:04:25, ESPECIFICACION §1, matriz V4 §2 pantalla 2 |
| C-2 | OTP de firma propio de P8 | Regla #1 y flujo P8 actual | La matriz V4 §7 define la firma del cliente como "simple respaldada por OTP" — el respaldo es el OTP de WhatsApp; Code100 gestiona su propio acto. Decidir si el OTP de firma actual desaparece o se convierte en el mecanismo del firmador |
| C-3 | Invertir pago↔firma | Máquina de estados (`DECLARACIONES_OK → PAGO_CONFIRMADO → PAQUETE_GENERADO → FIRMADO`), regla #4 (paquete pre-firma se conserva), fila 44 ("preautorización habilita firma") | CMP-07 / matriz V4 §7: elegibilidad → PDF único → firma cliente → firma corredor → CPC condicionado → **QR solo tras firma** → pago → activación. ESPECIFICACION: "No se cobra antes de la firma" |
| C-4 | La rama VENCIDO/devolución (Pantalla B actual) queda huérfana | Estados `VENCIDO`, `DEVOLUCION_EN_TRAMITE`, `DEVUELTO`; regla #11 (bloqueo por cédula incluye esos estados) | Con pago posterior a la firma no existe "pagó y no firmó". El caso nuevo es "firmó y no pagó": QR vencido + regeneración sin nueva firma (CMP-08), sin devolución. Decidir destino de estados, pantalla y regla #11 |
| C-5 | PDF unificado | Regla #3 y `src/documentos/` (dos PDF, dos prefijos, un correlativo, registro atómico) | CHG-30, matriz V4 §7 ("PDF único Solicitud + FIPF + declaraciones; versión y hash congelados"). El espíritu (un solo acto) se conserva y hasta se refuerza; cambia la materialización |
| C-6 | Certificado de Cobertura Provisional | CLAUDE.md: "No generes Nota de Cobertura — el producto no la contempla" | CHG-42/44, matriz V4 §1/§7 (CPC firmado solo por Alianza, condicionado al pago, con verificación de autenticidad CMP-06). Es un documento distinto de la "Nota de Cobertura", con nombre propio confirmado en la reunión (00:41:40); exige actualizar CLAUDE.md y registrar el modelo como pendiente de Alianza (compuerta §8.E.3) |
| C-7 | Firma cualificada del corredor sobre el expediente | El flujo actual solo modela la firma del cliente (y la contraparte institucional simulada) | CMP-03 / matriz V4 §7 orden 4: Interseguros firma cualificada tras el cliente; Alianza no firma la propuesta |
| C-8 | Tarjeta en P7 | El mock actual implementa QR **y** preautorización/captura de tarjeta | ALR-02 / matriz V4 §1: "Bancard exclusivamente QR". Si se decide QR-solo, la preautorización sale del flujo (el puerto puede conservarla) |
| C-9 | Numeración y nombres de pantallas terminales | "Pantalla A" (revision-manual) y "Pantalla B" (solicitud-vencida) del repo | El prompt v2 llama "Pantalla B" a la terminal de evaluación (la A actual). Normalizar nomenclatura en código y docs para no operar con dos diccionarios |
| C-10 | Precios y marcadores | `catalogo.ts` fija 290/475/660 mil Gs. como `premioAnualGs` | ALR-04: la matriz los registra como PENDIENTE ALIANZA (prima ≠ premio; falta desglose oficial); los wireframes muestran 319/522,5/726 (=+10% IVA). Parametrizar montos + `CDXXXXX`, sin publicar cifras definitivas |

**Nota sobre CHG-13 (cámara en computadora):** el flujo actual ya captura exclusivamente con cámara (`CapturaConCamara.tsx`, requiere HTTPS) y Face Liveness de Amplify funciona en navegadores de escritorio con webcam. Viabilidad técnica preliminar: **sí**, con verificación E2E pendiente en Fase 3 (PEN-03).

---

## 6. Activos reutilizables a favor del plan

- El `EvidenceStore` append-only y las evidencias por paso ya implementan la columna vertebral de TRV-01/CMP-15; falta ensancharlo (clics, descargas, video, versiones de texto por disclaimer) y exponer consulta.
- La política de identidad versionada (`identidad-parametros.ts`, `DecisionBiometrica`) cubre el requisito de repositorio protegido de resultados biométricos (CMP-16) mejor que lo pedido.
- El servicio de documentos determinista (hash SHA-256, registro atómico, QR propio) es la base directa de CHG-30 y CMP-08/09: unificar es reacomodar plantillas y correlativos, no reescribir el motor.
- La consola administrativa, el panel de demo, la asistencia de identidad y la batería E2E (7/7 en verde) quedan bajo NC-01: se conservan y se adaptan solo donde la renumeración los toque.
- El catálogo ya es multiplan y los importes viven en un solo módulo (`catalogo.ts`): parametrizar ALR-04 es acotado.

---

## 7. Skills disponibles y uso previsto por fase

| Fase | Skill | Uso |
| :--- | :--- | :--- |
| 1 (Plan) | `planifica-estructurado` | Marco de los 9 pilares aplicado a esta iteración |
| 1 (Plan) | `dataviz` / Mermaid nativo | Diagrama del flujo objetivo |
| 2 (Implementación) | `code-review`, `simplify` | Revisión por lote antes de cada gate |
| 2 (Implementación) | `security-review` | Lotes que toquen OTP, firma, pago, evidencia |
| 3 (Verificación) | `mejora-proyectos` | Asincronismo (CHG-44, callbacks), caché, suite de carga |
| 3 (Verificación) | `pdf` / PDF Tools MCP | Validar el PDF unificado y la leyenda art. 1556 (CMP-09) |
| Transversal | `update-config` | Si hiciera falta permiso para los fixtures |

No existe en el entorno un skill específico de Playwright; la batería E2E propia del repo cubre ese rol.

---

## 8. Preguntas abiertas para el gate de Fase 0

1. **C-1…C-10 (§5 de este documento):** conformidad para tratarlos en el plan como re-baseline de CLAUDE.md/reglas inviolables, con propuesta de resolución por cada uno en `PLAN_DE_CAMBIOS_v2.md` y decisión registrada en `DECISIONES.md` antes de implementar.
2. **Alcance de conservación de la rama de devolución (C-4):** ¿los estados `VENCIDO/DEVOLUCION_EN_TRAMITE/DEVUELTO` se conservan como historia muerta (expedientes viejos) y se retira la arista de entrada, o se eliminan? Impacta regla #11 y consola.
3. **Rama de trabajo:** el prompt sugiere `feature/plan-cambios-v2`; la convención del repo es `feat/<tema>` con merge commits a `main` protegida. Propuesta: `feat/plan-cambios-v2`.
4. **Fixtures:** ejecutar la copia manual del §1 y confirmar el gitignore.

---

*Documento de solo lectura. Ningún archivo de código fue modificado; los únicos archivos nuevos son las copias de fuentes (`docs/antecedentes/`, `docs/normativa/`) y esta auditoría.*
