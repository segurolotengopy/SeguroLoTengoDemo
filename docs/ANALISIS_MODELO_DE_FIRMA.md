# Análisis del modelo de firma decidido — firma interna del cliente + PSC cualificado institucional

**Fecha:** 2026-08-26
**Premisa de esta sesión (decisión de producto):**

- **Cliente final:** firma electrónica **no cualificada, generada internamente** por SeguroLoTengo. Sin proveedor externo.
- **Interseguros y Alianza:** firma electrónica **cualificada mediante un PSC cualificado habilitado en Paraguay** — Code100 es la primera opción, no la única.

Es la opción C de `docs/INFORME_GERENCIA_CODE100.md` §1.2, y desbloquea el hallazgo de C1 (`docs/Integraciones/Code100 - Respuestas C1 a C12.md`): el cliente ya no necesita un certificado cualificado previo.

> **Nomenclatura (27-ago-2026).** Donde este documento decía "Code100" como proveedor de las firmas cualificadas, ahora dice **PSC cualificado**: cualquier prestador cualificado de servicios de confianza habilitado en Paraguay. **Code100 sigue siendo la primera opción**, pero no es el único: el listado del MIC (`acraiz.gov.py`) incluye además a VIT S.A. (eFirma), Documenta S.A., Confirma S.A., ITTI S.A.E.C.A. y SOS Tecnología y Gestión Ltda. Los pasajes que describen **respuestas o comportamientos concretos de Code100** conservan su nombre, porque son hechos de ese proveedor y no del rol.

Este documento **no modifica ninguna fuente de verdad**: audita la documentación y el código vigentes contra el modelo decidido, y deja la lista de lo que hay que corregir, en qué orden y qué falta decidir. La matriz de cumplimiento, en particular, no se toca acá (§5).

---

## 1. Lo que la decisión todavía no define

**"Firma no cualificada generada internamente" admite dos implementaciones muy distintas.** Hay que elegir una antes de escribir código, porque cambian la arquitectura, el contrato con el PSC cualificado y lo que el cliente ve en el PDF.

| | **(a) Firma criptográfica propia** | **(b) Evidencia + sello visual, sin criptografía** |
| :---- | :---- | :---- |
| Qué se aplica al PDF | Una firma PAdES real, con un certificado de Interseguros/SeguroLoTengo, aplicada en representación del acto del cliente | Un bloque impreso con los datos del acto (fecha, hora, canal, referencia de evidencia) y nada más |
| Fuerza de la atribución al cliente | El acta de evidencias (identidad verificada + OTP + IP + hash) | La misma acta de evidencias |
| Verificable por un tercero | Sí, con cualquier validador PAdES | No: hay que exhibir el registro de evidencia |
| Firmas cualificadas posteriores | Actualizaciones incrementales sobre un PDF ya firmado — cadena de tres firmas en un solo archivo | El PSC cualificado aplica la primera firma criptográfica del documento |
| Qué hace falta | Un certificado y la custodia de su clave (AWS KMS o HSM), más definir qué muestra el panel de firma del PDF | Nada nuevo: el sistema ya cierra, hashea y registra evidencia |
| Costo | Certificado + infraestructura de custodia | Cero |

**Recomendación:** (a) si el asesor legal quiere que el documento sea autoverificable sin acceso a nuestros registros; (b) si acepta que la atribución se pruebe con la evidencia conservada. La diferencia es probatoria, no técnica, así que la decisión es de legal.

**Consecuencia de arquitectura de la opción (a), que conviene conocer antes de elegir:** firmar con AWS KMS es llamar a un SDK externo, y la regla dura de `CLAUDE.md` prohíbe hacerlo fuera de `src/adapters/`. Es decir, la opción (a) **sí necesita un puerto propio** (algo como `SelloDocumental`) con su adaptador; la opción (b) no necesita ninguno, igual que `src/documentos/`, que no tiene puerto porque generar un PDF propio no es una integración con un tercero.

**Una precisión sobre la regla inviolable #4** que vale para las dos opciones: si el acto de firma modifica el PDF —sea con una firma criptográfica o con un bloque impreso—, hay **dos versiones y dos huellas**: la del documento cerrado que la persona revisó y aceptó, y la del documento ya firmado. El dominio ya lo contempla (`DocumentoCerrado.version` y `DocumentoCerrado.hashSha256` en `src/domain/tipos.ts:398`, más `hashSolicitudFirmada` y `hashFipfFirmado` en `Firma`), así que no hace falta inventar nada: hay que usarlo de forma explícita.

---

## 2. Documentación que queda desactualizada

| Documento | Qué dice hoy | Qué pasa a ser falso |
| :---- | :---- | :---- |
| `docs/ESPECIFICACION_PANTALLAS.md` §P8 (líneas 321-347) | "firmalos en un único proceso seguro de Code100"; "La aceptación contractual ocurre al firmar en Code100"; bloque 2 "Code100 enviará el enlace al canal elegido"; botón `ENVIAR ENLACE SEGURO DE FIRMA`; progreso "1. Recibí el enlace → 2. Abrí y firmá → 3. Volvé al portal"; estado "Esperando confirmación verificable de Code100" | **Toda la mecánica de P8.** La firma pasa a ocurrir dentro del portal. El canal verificado **sigue haciendo falta** —por ahí viaja el tercer OTP—, así que el bloque 2 no desaparece: cambia de rótulo. |
| `docs/ESPECIFICACION_PANTALLAS.md` §P9 y §Pantalla B | Hito "Firmas Code100 ✓"; "firmados por cliente, Interseguros y Alianza Garantía"; seguimiento de firma a 1, 5 y 12 h; vencimiento a 24 h | El hito 1 pasa a ser firma interna del cliente. Los recordatorios y el vencimiento pierden su causa principal (§4.3). |
| `CLAUDE.md` → "Contrato oficial de `SignatureProvider` (Code100)" | "el orden de firmas es cliente (no cualificada) → Interseguros y Alianza (cualificada, en paralelo)"; "la Solicitud y el FIPF viajan en el **mismo** `session_id`" | El cliente ya no pasa por Code100. La atomicidad de la regla #3 se cumple **adentro** del sistema, no en un `session_id` del proveedor. Y "en paralelo" ya era falso por C5: las firmas institucionales van en serie. |
| `CLAUDE.md` → "Idempotencia de webhooks (Bancard y Code100)" | Trata los callbacks de Code100 como duplicables | Code100 no tiene webhooks (C10), y ahora además no interviene en el tramo del cliente. |
| `src/ports/signature-provider.ts` (cabecera y `FirmaIniciada`) | "El OTP que Code100 usa dentro del acto de firma… **vive del lado del proveedor**"; "Enlace que Code100 le manda a la persona por el canal elegido" | Ambas afirmaciones se invierten: el OTP es nuestro y no hay enlace del proveedor. |
| `docs/ESPECIFICACION_DEMO.md` (líneas 25, 115-121, 153, 156) | "Firma electrónica (Code100): simulada"; "el panel hace de pantalla del proveedor"; "tercer OTP del lado de Code100" | La pantalla del proveedor deja de existir para el cliente (§4.4). |
| `docs/GUION_DEMO.md` (paso 7) | "La firma llega por un enlace seguro con un tercer código" | El guion de la demostración cambia junto con P8. |
| `docs/ANALISIS_INTEGRACIONES_CODE100_BANCARD.md` §1 y §5.1 | Mapea los cuatro endpoints de Code100 al acto de firma del cliente | El mapeo sigue siendo correcto, pero aplica a las firmas institucionales, no a la del cliente. |
| `docs/Tabla de Integraciones externas - Tabla.csv`, ítem 18 | "Firma del cliente · Code100 · Firma electrónica no cualificada por OTP · YA DEFINIDO" | Pasa a ser servicio interno, como el ítem 17 (generación de Solicitud y FIPF). El ítem 19 (firmas de Interseguros y Alianza con Code100) se mantiene tal cual. |
| `docs/CONSULTAS_CODE100_SEGUNDA_RONDA.md`, bloque 1 (C13-C20) | Pide a Code100 desarrollar firma no cualificada de un solo uso | **Queda sin efecto**: ya no se le pide ese desarrollo. Los bloques 2 a 6 (C21-C31) siguen vigentes íntegros. |

**Textos impresos dentro de los PDF** — caso aparte, porque cambiarlos cambia los bytes y por lo tanto el hash:

- `src/domain/documentos.ts:583` (`FIRMANTES`): *"Firma electrónica no cualificada mediante enlace seguro de Code100"* para el proponente.
- `src/domain/documentos.ts:491` y `:560` (`leyendaFirma`): *"Cliente primero; Interseguros y Alianza firman después **en paralelo**"* y *"…se firman conjuntamente mediante el mismo enlace seguro de Code100"*.

Los tres son afirmaciones falsas bajo el modelo nuevo, impresas en un documento que se firma. Corregirlos exige **subir la versión documental**, no editar en silencio.

---

## 3. Impacto en el código

| Pieza | Estado hoy | Qué implica el modelo nuevo |
| :---- | :---- | :---- |
| `src/ports/otp-provider.ts` | ~~`PropositoOtp` tiene solo dos propósitos~~ | **Hecho.** `FIRMA` es el tercer propósito, con `canalCoherenteConProposito()` haciendo cumplir que los de verificación van por su canal y el de firma por cualquiera de los dos. |
| `src/ports/signature-provider.ts` | Modela el acto del cliente: canal, destino, enlace, sondeo, descarga | Se convierte en el puerto de las **firmas institucionales**, donde no hay canal ni destino ni enlace. Además arrastra los problemas ya detectados en `PLAN_ACCION_CODE100.md` §3.1 y §3.2 (el "descargar" que en realidad firma, y la falta de idempotencia). |
| `src/domain/firma-p8.ts` | `iniciarFirmaP8` = enviar enlace; `confirmarFirmaP8` = sondear al proveedor | Pasa a ser: emitir el OTP de firma, verificarlo, aplicar la firma a los dos documentos y transicionar. Sin sondeo. |
| `src/domain/expediente.ts:81` | `FIRMADO: ["EMITIDO"]` | No hay lugar para "firmado por el cliente, pendiente de las firmas institucionales" (§4.1). |
| `src/documentos/servicio.ts:470` | `archivarDocumentosFirmados` pide los PDF al proveedor | Con firma interna, los bytes firmados los produce el propio sistema: la descarga desaparece para el tramo del cliente. |
| `src/domain/textos-p8.ts:171`, `src/domain/textos-p9.ts:134` | "Interseguros y Alianza firman ambos PDF"; "Firmado por cliente, Interseguros y Alianza Garantía" | Siguen siendo promesas de algo no implementado (§4.1). |
| `src/app/(flujo)/p8-firma/*`, `src/app/api/p8/*` | Pantalla y endpoints construidos alrededor del enlace y el sondeo | Rediseño de P8 según la especificación corregida. |
| `ModalFirmadorSimulado.tsx`, `ControlFirmaCode100.tsx`, `/api/p8/firmador-simulado` | Simulan la ventana de Code100 para el cliente | Pierden su objeto (§4.4). |

### 3.1 El tercer OTP: la pieza ya existe, hay que mudarla

Hoy el OTP de firma lo emite el mock de Code100 (`abrirEnlaceDeFirmaMock`, `src/adapters/mock/signature-provider.ts:530`) y, con `INTEGRATION_OTP=live`, viaja de verdad por WhatsApp con el propósito `SIGNATURE_P7A` a través de `OtpFirmaRemoto` (`src/adapters/live/otp-provider.ts:226`). **El canal real ya funciona**: lo que hay que hacer es sacar ese OTP de la simulación del proveedor y ponerlo donde corresponde, en `OtpProvider`.

El movimiento mejora el cumplimiento de la regla inviolable #1: los tres OTP pasan a compartir motor, política (6 dígitos, uso único, 5 minutos, 3 intentos, reenvío bloqueado 60 s) y registro de evidencia, en lugar de que el tercero tenga vida propia dentro de un adaptador simulado. Y el ítem 3 del catálogo de integraciones ya contempla ese propósito, así que no hay proveedor nuevo que registrar.

---

## 4. Huecos que la decisión destapa

### 4.1 Las firmas institucionales no existen en el código

Hoy son **solo texto**: `textos-p9.ts:134` promete documentos "firmados por cliente, Interseguros y Alianza Garantía", y el `SignatureProvider` mock modela un único acto, el del cliente. No hay estado, ni evidencia, ni pipeline. Con el modelo nuevo, esas dos firmas pasan a ser **el único uso del PSC cualificado** — y siguen sin estar implementadas ni simuladas.

Hace falta decidir además **si la emisión espera esas firmas**. La máquina de estados va hoy de `FIRMADO` a `EMITIDO` sin escalas (`src/domain/expediente.ts:81`), así que no hay dónde representar "el cliente firmó, faltan las firmas institucionales". Dado que son en serie (C5) y podrían requerir intervención humana por expediente (consulta C21, sin responder), lo más probable es que necesiten un estado propio o un sub-estado en el expediente.

### 4.2 La atomicidad pasa a ser responsabilidad interna

La regla inviolable #3 no cambia de contenido, cambia de lugar de cumplimiento: hasta ahora la garantizaba el `session_id` único de Code100; ahora la tiene que garantizar nuestro propio servicio de firma, con una sola escritura que firme los dos documentos o ninguno — el mismo criterio que ya usa `registrarPaqueteDocumental`.

### 4.3 El plazo de 24 horas y la Pantalla B pierden su causa principal

El plazo existía porque el cliente recibía un enlace y podía abrirlo horas después. Si firma en línea, dentro de la misma sesión en que pagó, el caso "pagó y no firmó" se vuelve mucho menos frecuente: queda para quien abandona el navegador entre el pago y la firma. **No desaparece** —la arista `PAGO_CONFIRMADO → VENCIDO` sigue siendo necesaria— pero los recordatorios a 1, 5 y 12 horas (filas 29 y 30 de la matriz) y el vencimiento a 24 h (fila 41) describen un proceso pensado para otra mecánica. Es decisión de producto qué se conserva.

### 4.4 La demostración se acerca al producto real

El panel de demo y el modal existen porque en una demostración no llega ningún WhatsApp con el enlace de Code100. Sin enlace, esa simulación deja de tener objeto para el tramo del cliente: la firma ocurre en pantalla, con un OTP que ya puede viajar por WhatsApp de verdad. Lo que **sí** habrá que simular, y hoy no existe, son las firmas institucionales.

---

## 5. Matriz de cumplimiento: filas a revisar (no modificadas acá)

La matriz es fuente de verdad de obligación legal y no se edita desde una sesión de desarrollo. Estas son las filas que el modelo nuevo deja desalineadas, para que quien la mantiene las revise con criterio legal:

| Fila | Título | Por qué hay que revisarla |
| :---- | :---- | :---- |
| Categoría **R4** | "FIRMA ELECTRÓNICA MEDIANTE CODE100" | El nombre de la categoría entera presupone un único proveedor para todas las firmas. |
| 34 | El cliente firma electrónicamente la Solicitud y el FIPF | **Sigue vigente y se sigue cumpliendo**; cambia el medio, no la obligación. |
| 36 | Utilizar un mismo enlace Code100 para firmar la Solicitud y el FIPF | El enlace deja de existir. Su nota —mantener la atribución conforme al art. 40 de la Ley 6822/21— pasa a ser el requisito central del acto interno. |
| 41 | Vigencia de 24 horas para el enlace de firma Code100 | No hay enlace que venza; queda por definir qué plazo rige (§4.3). |
| 42 | Conservar evidencia Code100: identidad, OTP, IP, fecha, hora, hash y resultado | La evidencia pasa a ser íntegramente propia. C3 ya había confirmado que Code100 no registra IP ni emite acta, así que en los hechos esto no cambia tanto como parece. |
| 29 y 30 | Recordatorios de firma y devolución del premio | Su supuesto operativo cambia (§4.3). |

---

## 6. Orden de trabajo sugerido

1. **Definir (a) o (b) de §1** — legal + producto. Bloquea el diseño del servicio de firma interna.
2. **Corregir las fuentes de verdad**: `ESPECIFICACION_PANTALLAS.md` (P8, P9, Pantalla B) y `CLAUDE.md`. Antes de tocar código, según la regla del proyecto.
3. **Marcar para revisión** las filas de §5 y actualizar el ítem 18 del catálogo de integraciones.
4. **Podar el bloque 1 (C13-C20)** de `CONSULTAS_CODE100_SEGUNDA_RONDA.md` y enviar el resto: C21-C31 siguen todas vigentes, y C21 (firma desatendida institucional) pasa a ser **la consulta más importante**, porque ahora las firmas institucionales son el único uso del PSC cualificado.
5. ~~**Mudar el tercer OTP** a `OtpProvider` (§3.1)~~ — **hecho el 27-ago-2026**: `PropositoOtp` tiene `FIRMA`, viaja por cualquiera de los dos canales verificados, y los adaptadores mock, WhatsApp-Modular y SES lo soportan. Falta el consumidor, que llega con el acto de firma.
6. **Implementar el servicio de firma interna** con su nueva versión documental, atomicidad y evidencia. **Primera mitad hecha el 27-ago-2026**: `src/domain/firma-cliente.ts` decide y produce el acto (OTP de firma, elegibilidad, huellas, evidencia). Falta la mitad que depende de definiciones abiertas: sellar los bytes (§1, dictamen legal) y persistir la transición (máquina de estados, `ORDEN_FIRMA_PAGO_Y_CPC.md` §2.3).
7. **Rediseñar P8** contra la especificación corregida.
8. **Diseñar el tramo institucional**: estado en la máquina, orden serial, evidencia por firmante, y su simulación en el modo demo.

---

## 7. Qué no cambia

P1 a P7 completos, la verificación de identidad, el pago, la generación y el hasheo de documentos, el registro de evidencia y la consola administrativa. El PSC cualificado —Code100 como primera opción— sigue siendo proveedor del proyecto, con su alcance reducido a las firmas cualificadas de Interseguros y Alianza. Y las tres reglas inviolables que tocan la firma —#3 atomicidad, #4 documentos cerrados y hasheados, #10 evidencia append-only— siguen exactamente igual: cambia quién las hace cumplir, no lo que exigen.
