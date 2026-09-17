# DECISIONES — Plan de Cambios v2 (ADR ligero)

Registro de decisiones de la sesión de planificación. Cada entrada tiene un ID estable
(`D-xx`), su origen y su **estado**. Ninguna entrada `PENDIENTE` se implementa.

**Ronda 1 resuelta: 19 de agosto de 2026** (Andres Alberdi, responsable del proyecto).
Dos resoluciones se apartan de mínimos cerrados de la Matriz Legal V4 y quedan
asentadas como alertas nuevas **ALR-06** y **ALR-07** al pie: se implementan como
fueron decididas, y la matriz debe registrar el cambio (su propia regla de control:
*"no eliminar ni modificar campos, textos, firmas o controles sin registrar el cambio
y obtener aprobación"*).

---

## Bloque A — Conflictos reunión ↔ normativa

### D-01 · Marketing dentro de la autorización del OTP
- **Origen:** ALR-01 / CHG-08 · Reunión 00:06:56 vs Matriz V4 §4 y ESPECIFICACION §4.
- **DECIDIDA (19-ago-2026): separada.** El texto del OTP autoriza únicamente el envío del código para verificar el número. El consentimiento comercial va en **casilla aparte, desmarcada y revocable**. Cumple Matriz §4 y Ley 7593/2025 (consentimiento libre). Cierra ALR-01.

### D-02 · Medios de pago
- **Origen:** ALR-02 / C-8 · Wireframe p.7 vs Matriz V4 §1 ("Bancard exclusivamente QR").
- **ESTABLECIDA (19-ago-2026): el portal va con Bancard y sus TRES tipos de pago — QR, tarjeta de crédito y tarjeta de débito. NO solo QR.** Sin preautorización (cobro directo) y con **flujo de seguimiento de devoluciones**. No es una excepción ni una desviación a evaluar: es la política de medios de pago del producto, y así se implementa.
- **Consecuencias de implementación (no negociables, regla inviolable #6 + Matriz §1):**
  1. Los datos de tarjeta **nunca** tocan el portal. El formulario con PAN/CVV que dibuja el wireframe **no se implementa como está**: la tarjeta va por el flujo alojado/tokenizado de Bancard (iframe o redirección del proveedor), y el portal solo conserva el resultado y la referencia. Ningún log, traza ni evidencia contiene PAN ni CVV.
  2. Se elimina el camino de preautorización/captura del flujo (el `PaymentProvider` conserva los métodos, sin exponerlos en la UI).
  3. El flujo de seguimiento de devoluciones reutiliza los estados `DEVOLUCION_EN_TRAMITE → DEVUELTO` (ver D-09), ahora con disparador propio: solicitud de devolución de un pago con tarjeta, no vencimiento.
- **Registro en la matriz (ALR-06, abajo):** la Matriz V4 §1 dice hoy "Bancard exclusivamente QR". Como la política establecida es otra, el texto de la matriz queda **desactualizado** y Rodrigo/Legal deben actualizarlo. Esto no condiciona la implementación.

### D-03 · Marca "Seguro lo tengo"
- **DECIDIDA (19-ago-2026):** la marca es **Seguro Lo Tengo**; se adopta la recomendación: flag `MARCA_FANTASIA_AUTORIZADA=false` por defecto, frente público con denominación registrada (Interseguros S.A. + actividad + Matrícula SIS N° 118, formato Circ. 011/2025), y el popup TRV-03 implementado detrás del mismo flag. Cierra ALR-03 (queda condicionada a la autorización SIS, compuerta §8.E.1).
- **MODIFICADA (15-sep-2026), para el demo:** Andres decidió que la cabecera v4 muestre **siempre** el logo de SeguroLoTengo, como los artes aprobados del handoff v4 (D-28), sin esperar el flag `MARCA_FANTASIA_AUTORIZADA`. El flag y `marcaVisible()` se conservan para los demás usos del nombre comercial. La autorización de la SIS para la marca de fantasía sigue siendo compuerta de producción real (§8.E.1): esta decisión no la reemplaza.

### D-04 · Cifras de premio
- **DECIDIDA (19-ago-2026):** de acuerdo con la propuesta — montos de la Matriz V4 (290.000 / 475.000 / 660.000) como **parámetros provisionales**, marcador `CDXXXXX` para código/acto/URL, desglose prima/IVA/premio parametrizado y rotulado como provisional. No se publican cifras definitivas hasta el desglose oficial de Alianza. Cierra ALR-04.

### D-05 · Documentos descargables post-pago
- **DECIDIDA (19-ago-2026):** de acuerdo — **PDF firmado (Solicitud + FIPF unificados) + CPC + comprobante de pago**. Cierra ALR-05.

## Bloque B — Re-baseline de reglas internas del repo

### D-06 · Retiro del OTP de correo
- **DECIDIDA (19-ago-2026):** de acuerdo. La regla inviolable #1 pasa de "tres OTP" a **un OTP de canal (WhatsApp)** con las mismas garantías (solo hash, 6 dígitos, 5 min, 3 intentos, reenvío 60 s). El correo se respalda con doble tipeo + declaración de veracidad firmada. `CANAL_EMAIL_VERIFICADO` queda legado; el correo declarado genera evidencia propia con versión de texto.

### D-07 · OTP de firma propio del portal
- **DECIDIDA (19-ago-2026):** de acuerdo. El portal deja de emitir OTP de firma; el acto ocurre dentro del flujo de Code100 y el OTP de WhatsApp previo es el respaldo de identificación (Res. 210/2025 art. 4, Matriz §7 orden 3).

### D-08 · Inversión pago ↔ firma
- **DECIDIDA (19-ago-2026): de acuerdo para el demo, con reserva explícita** — puede cambiar en una versión siguiente. Se adopta la secuencia de la Matriz V4 §7 (firma → QR/pago → CPC atómico). El diseño mantiene la transición de pago detrás de una sola operación de dominio, de modo que revertir el orden en el futuro sea un cambio acotado y no una reescritura.

- **MODIFICADA (04-sep-2026), con el análisis legal de Rodrigo del 03-sep (`docs/firma-cualificada/ANALISIS_LEGAL_CPC_2026-09-03.md`) y las normas ya en `docs/normativa/`:** la firma **del cliente** sigue antes del pago (Res. 210/2025 art. 4; Res. 215/17 num. 11.15). La firma cualificada **de Interseguros** deja de ser previa al cobro: se aplica **después del pago, dentro de 24/48 h operativas y antes de la póliza definitiva** (Res. 210/2025 art. 5; Ley 827/96 art. 76; el plazo no es legal, queda en el procedimiento aprobado por Alianza). **Regla 6-bis re-baseada:** el único estado desde el que se abre y confirma una operación en Bancard pasa a ser `FIRMADO_CLIENTE`; `FIRMADO` (con la institucional) queda entre el pago y la emisión. Consecuencia que lo justifica: la latencia del firmador por token (`CAMBIOS_NECESARIOS.md` §4) sale del camino crítico de la venta. `VENCIDO` se re-define sobre «firmado por el cliente y no pagado».

### D-09 · Estados de vencimiento y devolución
- **DECIDIDA (19-ago-2026): sí**, se conservan. Con D-10 y D-02 dejan de ser legado y **recuperan disparadores propios**:
  - `VENCIDO`: expediente **firmado y no pagado** que superó las 24 h (D-10). No genera devolución: bajo el orden nuevo no hubo cobro.
  - `DEVOLUCION_EN_TRAMITE → DEVUELTO`: flujo de seguimiento de **devoluciones de pagos con tarjeta** (D-02).
  - `CANAL_EMAIL_VERIFICADO` sí queda legado sin aristas (D-06).
  - La regla inviolable #11 (bloqueo por cédula) se re-redacta sobre esta semántica nueva.

### D-10 · Caducidad del expediente firmado sin pagar
- **DECIDIDA (19-ago-2026): caduca a las 24 h.**
- **MODIFICADA (15-sep-2026) por D-32:** el plazo pasa a **10 minutos desde la firma del cliente**, como fija el manual funcional v4. Pendiente de implementar.
- **Verificación pedida sobre Code100:** su documentación (`docs/Integraciones/Documentacion Firmador - API FLOW.pdf`) **sí expone caducidad de sesión** — `POST /signature/getSessionId` devuelve `fecha_expiracion` y `expirado: true/false` — pero **no documenta una duración fija**; en su ejemplo, una sesión creada 14-ene 17:10 UTC expira 15-ene 14:12 (≈21 h). Implementación en consecuencia: el plazo de 24 h del expediente es **nuestro**, y el estado de la sesión de firma se toma de `fecha_expiracion`/`expirado` del proveedor cuando exista, sin hardcodear su política. Confirmar la duración exacta se suma a las consultas PEN-01/PEN-02.

### D-11 · PDF unificado
- **DECIDIDA (19-ago-2026): sí.** Un solo PDF (Solicitud + FIPF + declaraciones), un correlativo, ambos códigos internos visibles en sus secciones, **un** SHA-256 congelado. La regla inviolable #3 pasa a ser estructural.

### D-12 · Certificado de Cobertura Provisional
- **DECIDIDA (19-ago-2026): sí.** Documento nuevo del motor determinista, generable solo con pago confirmado, con QR de verificación (CMP-06) y modelo rotulado provisional. Se actualiza CLAUDE.md: sigue prohibida la "Nota de Cobertura"; el CPC se incorpora como documento del producto.

- **MODIFICADA (04-sep-2026):** el CPC **lo emite y lo firma únicamente Alianza, desde su sistema**, con firma cualificada de su suscriptor autorizado (Res. 231/2025 Anexo I arts. 1-2; Res. 215/17 art. 7º y numeral 10; Código Civil art. 1573). Ni el cliente ni Interseguros lo firman; Interseguros figura identificado como corredor (nombre, matrícula SIS 118, contacto). **SeguroLoTengo deja de generar el CPC**, así que cae la atomicidad «CPC en la misma escritura que el cobro» (CMP-07) y la promesa de tres descargables al instante. Recomendación adoptada: el **comprobante de pago (D-05)** cubre la entrega inmediata y el CPC llega después por los canales verificados, como la póliza. La verificación pública de `/verificar/<código>` deja de cubrir el CPC.

### D-13 · Firmas sobre el expediente
- **ESTABLECIDA (19-ago-2026): Alianza firma los TRES documentos** — Solicitud, FIPF y Certificado de Cobertura Provisional — **ya sea prefirmados o junto con el cliente**. Ambas modalidades son válidas y el sistema debe soportar las dos.
- **Diseño:** la lista de firmantes por documento es **dato configurable y ordenado**, con dos modalidades por firmante: `PREFIRMADO` (la firma institucional ya está sobre el documento cuando el cliente lo recibe) o `CONJUNTO` (se aplica en el mismo acto que la del cliente). Firmantes previstos: cliente (simple, Code100), Interseguros (cualificada) y Alianza (cualificada) sobre Solicitud y FIPF —que viajan como un PDF único, D-11—, y Alianza sobre el CPC. Cada firma deja firmante, certificado simulado, modalidad y evidencia propios, visibles en la consola. Cambiar de modalidad es configuración, no reescritura.
- **Registro en la matriz (ALR-07, abajo):** la Matriz V4 §7 dice hoy que Alianza no firma la propuesta. Rodrigo/Legal deben actualizarla y contrastarla con el modelo registrado (compuerta de producción 6).

- **MODIFICADA (04-sep-2026): Alianza NO firma la Solicitud ni el FIPF.** La Res. 215/17 num. 11.15 prevé en la propuesta la «firma del Agente / Corredor de Seguros, o del Proponente» y nada exige la de la aseguradora; la Matriz V4 §7 tenía razón y **ALR-07 se cierra sin cambiar la matriz**. Firmantes vigentes: `PAQUETE` = cliente (simple, antes del pago) + Interseguros (cualificada, diferida 24/48 h). `CPC` sale de `firmantes-documento.ts` porque deja de ser un documento del motor (D-12). Sigue siendo dato configurable: el cambio es de configuración y de tests, no de arquitectura.

### D-14 · Nomenclatura de pantallas
- **DECIDIDA (19-ago-2026):** el nombre no es relevante porque puede cambiar; se adopta la recomendación **más** una numeración dependiente de la versión: `Pv2-1` … `Pv2-8` para el flujo nuevo, `Pv2-B` para la terminal de evaluación, `Pv1-B` para la pantalla legada de devolución. Los identificadores versionados se usan en documentos, evidencia y tests; los slugs de ruta son semánticos (D-22).

## Bloque C — Abiertos de producto

### D-15 · PDFs de coberturas — **DECIDIDA:** sí, parametrizable (uno o tres por configuración de plan; arranca con uno compartido).
### D-16 · Título del paso de pago — **DECIDIDA:** se adopta **"Realizá el pago"**.
### D-17 · Botón de WhatsApp — **DECIDIDA:** sí, solo en la pantalla de confirmación, con flag para extenderlo.
### D-18 · Mensaje que acompaña el CPC — **DECIDIDA:** se adopta la redacción propuesta:
> *"¡Hola, {nombre}! Tu seguro {plan} ya está en marcha. Te adjuntamos el Certificado de Cobertura Provisional: tu cobertura comienza el {fecha} a las {hora}, 24 horas después de tu pago. La póliza y la factura electrónica te van a llegar por este mismo canal y por correo dentro de las próximas 48 horas, emitidas por Alianza Garantía Seguros y Reaseguros S.A. Guardá este documento: es tu respaldo desde el primer día. — Interseguros S.A., Corredores de Seguros"*

### D-19 · Datos institucionales
- **DECIDIDA (19-ago-2026):** quedan **parametrizables**; Andres/Rodrigo pasan los datos cuando los tengan. Hoy se usan los de la Matriz §1 (direcciones y web de ambas empresas) y marcadores rotulados para lo que falta: teléfono y correo de atención de Interseguros, correo de atención de Alianza y número del botón de WhatsApp. `segurolotengo@interseguros360.com` queda confirmado solo para retracto y derechos de datos hasta nueva indicación.
- **Datos recibidos (14-sep-2026, manual funcional v4, pantalla 01D):** WhatsApp de Interseguros **+595 991 478 468**; correo **segurolotengo@interseguros360.com**; oficina **Avda. Aviadores del Chaco 2351, Edificio Plaza Center, 7.º piso, Asunción**; sitio **interseguros360.com**. Completan `WHATSAPP_ATENCION` y el correo de atención de `entidades.ts`, al implementar 01D. El teléfono fijo y el correo de atención de Alianza siguen sin dato.

## Bloque D — Operativos y técnicos

### D-20 · Rama de trabajo — **DECIDIDA:** fusionar primero el PR de `feat/p5-captura-fiel-y-confirmacion` a `main`, y crear `feat/plan-cambios-v2` desde `main`. Commits `tipo(alcance): descripción [CHG-xx]`.

### D-21 · Fixtures de identidad — **DECIDIDA:** proceder. Pasos exactos para Andres:

1. Copiar los tres archivos (una sola línea):

```bash
mkdir -p /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad && cd "/home/andres-alberdi/Documentos/SeguroLo Tengo/Demo2" && cp "Cedula Paraguay Rodrigo Fernandez 0.png" /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/Cedula_Paraguay_Rodrigo_Fernandez_0.png && cp "Cedula Paraguay Rodrigo Fernandez 1.jpeg" /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/Cedula_Paraguay_Rodrigo_Fernandez_1.jpeg && cp "WhatsApp Image 2026-08-18 at 08.41.16.jpeg" /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/WhatsApp_Image_20260818_at_08.41.16.jpeg
```

2. Verificar que quedaron los tres:

```bash
ls -la /home/andres-alberdi/segurolotengo-demo/tests/fixtures/identidad/
```

3. El `.gitignore` con la regla `/tests/fixtures/identidad/` lo agrego yo en el Lote 1 **antes** de cualquier commit. Hasta entonces, no commitear con `git add -A`. Si querés blindarlo ya mismo, sin esperar al lote:

```bash
cd /home/andres-alberdi/segurolotengo-demo && printf '\n# Datos reales cedidos para pruebas — nunca al repo\n/tests/fixtures/identidad/\n' >> .gitignore && git check-ignore -v tests/fixtures/identidad/Cedula_Paraguay_Rodrigo_Fernandez_0.png
```

La última orden imprime la regla que lo excluye: si no imprime nada, el archivo **no** está ignorado y hay que revisarlo.

### D-22 · Rutas — **DECIDIDA: opción A.** Slugs semánticos sin número (`/plan`, `/whatsapp`, `/preparacion`, `/identidad`, `/declaraciones`, `/firma`, `/pago`, `/confirmacion`); el número de paso se deriva de la lista ordenada única en `rutas-flujo.ts`. Redirects 308 desde las rutas viejas.

---

## Bloque E — Importación del diseño de 3 pasos (ronda del 29-ago-2026)

Divergencias DI-1…DI-11 detectadas al importar el canvas aprobado de Claude
Design (`docs/plan/IMPORTACION_DISENO_3_PASOS.md`, PR #61). **Ronda resuelta
el 29-ago-2026** (Andres Alberdi): las once quedan decididas y ninguna
permanece pendiente.

### DI-1 · Qué significa «FIPF»
- **DECIDIDA (29-ago-2026): FIPF es el Formulario de Identificación de Persona Física de la Res. SEPRELAD 71/19.** El texto del canvas que lo redefine como «Formulario de Información Previa a la Firma» es un **error de la maqueta** y se corrige en la implementación: el expandible «¿Qué es el FIPF?» explicará el formulario real (identificación KYC/AML), y la información precontractual del producto sigue viviendo donde ya vive (coberturas, carencias y condiciones del paso 2, más lo que el PDF ya imprime por la Matriz V4 §4). El PDF único de D-11 queda intacto.

### DI-2 · Identidad antes que plan
- **DECIDIDA (29-ago-2026): sí**, deriva de la aprobación del canvas. Orden nuevo: inscripción (identidad + canales + KYC) → plan + declaraciones → firma → pago. El bloqueo por cédula (regla inviolable #11) pasa a evaluarse al comienzo del flujo. El rediseño de la máquina de estados se especifica en el plan de lotes de la implementación, conservando los estados legados sin reescribirlos (regla #10).

### DI-3 · Declaraciones: 5 en pantalla, 8 en el PDF
- **DECIDIDA (29-ago-2026): el PDF conserva las 8.** La pantalla pregunta las 5 del diseño; la Solicitud impresa mantiene sus 8 declaraciones con las respuestas derivadas de un **mapa 5→8 explícito**, que se documenta en la reescritura de `ESPECIFICACION_PANTALLAS.md` y se implementa en dominio con test propio. `Solicitud.pdf` no cambia y nada escala a Alianza. La declaración 5 (carencias) es aceptación bloqueante: en No detiene sin derivar a Pantalla A.

### DI-4 · Carencias, resolución y código de producto del canvas
- **DECIDIDA (29-ago-2026): son marcadores de la maqueta.** Las carencias (180/30/1 días), la Res. SS.SG. N° 250/2026 y el código `SIS-VID-ONC-001/2026` **no son datos confirmados por Alianza**: se implementan como **parámetros provisionales rotulados**, con el mismo criterio de D-04 (`CDXXXXX`). No se publican como definitivos hasta el dato oficial.

### DI-5 · Canal del enlace de firma
- **DECIDIDA (29-ago-2026): ambos canales.** El enlace de firma puede ir al WhatsApp verificado por OTP **o** al correo declarado por doble tipeo: la declaración de veracidad firmada respalda al correo como canal (D-06), y la rama de firma interna ya modela el OTP de firma por cualquiera de los dos. La evidencia registra a cuál se envió.

### DI-6 · Datos de factura en el paso 3
- **DECIDIDA (29-ago-2026):** los campos «factura a nombre de», «documento» y «RUC (opcional)» son **captura para remitir a Alianza** (la factura la emite Alianza por SIFEN, fila 40): viajan en la remisión del caso (CHG-47) y quedan en el expediente. No constituyen facturación propia del portal.

### DI-7 · Beneficiario en pantalla
- **DECIDIDA (29-ago-2026): se adopta el bloque del canvas** (herederos legales por defecto, o designación de una persona al 100%). Verificación previa obligatoria en la reescritura de la spec: cotejar los 6 campos del canvas contra la sección de beneficiario de `Solicitud.pdf` antes de tocar el modelo de datos; ante diferencia, mandan los campos de la Solicitud.

### DI-8 · Aceptaciones agrupadas
- **DECIDIDA (29-ago-2026): se adopta el patrón del canvas** — una casilla agrupada por paso con detalle expandible («Ver todo lo que aceptás»). El opt-in comercial sigue separado (D-01) y los textos que la Matriz V4 exige integrados al PDF (art. 1556, licitud y veracidad, cuenta propia) siguen dentro del documento que se firma, no en casillas.

### DI-9 · Datos de ejemplo del canvas
- **DECIDIDA (29-ago-2026):** los textos se importan; los datos de ejemplo no. Las personas de prueba siguen siendo las de `src/adapters/mock/personas.ts`. «Ana María González Ramírez» y su cédula no entran al código.

### DI-10 · T&C del inicio
- **DECIDIDA (29-ago-2026): con evidencia.** La aceptación de T&C del inicio registra fecha, hora, IP y versión del texto (regla #10); es el acto que crea el expediente antes del paso 1.

### DI-11 · Opt-in comercial en la confirmación
- **DECIDIDA (29-ago-2026): se implementa como lo dibuja el canvas y lo exige D-01** — desmarcado, opcional, con evidencia propia (versión de texto incluida) y revocación por BAJA en WhatsApp o enlace de baja en correos. No condiciona el seguro y sus datos no salen hacia analítica/CRM (regla #7).

---

## Bloque F — Matriz Normativa de Campos y registro del plan (04-sep-2026)

Fuente: `docs/MATRIZ_CAMPOS_OBLIGATORIOS_2026-09-04.pdf`, analizada en
`docs/auditoria/ANALISIS_MATRIZ_CAMPOS_2026-09-04.md`. Decisiones de Andres del
04-sep-2026.

### D-24 · Ruta de diligencia (DDC simplificada / normal)
- **DECIDIDA (04-sep-2026): opción (b)** — la ruta la fija **un parámetro del producto**. ~~Con la simplificada por defecto~~ → **enmendada el 05-sep-2026, ver abajo**. La simplificada pide nombres, apellidos, cédula y capturas, WhatsApp, domicilio y ciudad, actividad, fecha de nacimiento (extraída), plan y beneficiario; la normal agrega nacionalidad, país de residencia, empleador, ingreso mensual y origen de fondos. **El criterio que enciende la normal lo fija cumplimiento de Alianza** (Res. SEPRELAD 71/2019 art. 27, que no está en `docs/normativa/`); hasta entonces el flag queda en simplificada y no se pierde nada. La persona nunca elige la ruta. Implementación: paso 1 (una pantalla por sesión), modelo `DatosComplementariosP6` con los cinco campos opcionales, y la sección FIPF del PDF que imprime solo lo recabado.

#### Enmienda del 05-sep-2026 · CONFÍO va por régimen NORMAL, y el default se invierte

**Decisión de Andres (05-sep-2026):** para el **Seguro de Vida Oncológico
CONFÍO — nuestro producto — aplica el régimen NORMAL** de debida diligencia.
Otros productos podrán ir por simplificada; este no. El default de la
implementación pasa a ser **normal**, no simplificada.

Con el texto de la **Res. SEPRELAD N° 071/2019 a la vista** —aportado por
Andres el mismo día y ya en
`docs/normativa/SEPRELAD-Res-071-2019-prevencion-LAFT-companias-de-seguros.pdf`—
la decisión no depende solo del criterio de cumplimiento de Alianza: **la norma
la sostiene por sí sola**.

**Art. 27 num. 5 (régimen simplificado):** *«Para aplicar el régimen
simplificado a un determinado producto, los SO deben solicitar las
autorizaciones, en forma previa, a la SEPRELAD y a la Superintendencia de
Seguros»*, presentando descripción del producto y de la categoría de clientes,
metodología de validación documental y de identificación digital cuando el
producto no requiera presencia física, factores de riesgo y sistema de
detección. **Esa autorización previa no existe para CONFÍO.** Sin ella el
producto no puede acogerse al régimen simplificado, cualquiera sea el criterio
comercial: el general del art. 26 es el que rige.

Los casos del art. 27 num. 1 tampoco alcanzan por sí solos. El más cercano
—inc. c), seguros tomados «mediante mercadeo masivo o banca seguros» con pago
por débito directo, tarjeta o cheque— exige además *«obtener del cliente copias
documentales que evidencien su condición de cliente de otro SO»*, algo que el
flujo digital de SeguroLoTengo no hace ni pretende hacer. Y el num. 1 del
art. 28 cierra la puerta en el otro extremo: *«En ningún caso está permitido
aplicar medidas simplificadas cuando exista sospecha de LA/FT»*.

**Qué implica para el paso 1.** Los cinco campos que D-24 reservaba para la
ruta normal —nacionalidad, país de residencia, empresa/empleador, ingreso
mensual declarado y origen principal de fondos— **se piden**, no quedan
apagados. El modelo sigue teniendo que soportar los dos subconjuntos (D-24 no
cambia en eso: la ruta es un parámetro del producto y la persona nunca la
elige), pero el valor de ese parámetro para CONFÍO es **normal**.

Correspondencia verificada contra la norma, no contra la matriz:

| | Art. de la 071/2019 | Datos mínimos de la persona física |
| :-- | :-- | :-- |
| **Simplificada** | art. 27 num. 2 | nombres y apellidos completos; tipo y número de documento; actividad económica; número de teléfono; domicilio |
| **Normal (general)** | art. 26 num. 1 | los anteriores **más** nacionalidad y residencia; propósito de la relación; ocupación/oficio/profesión **y nombre de la empresa**; declaración jurada del origen de dinero o bienes; documentación del volumen de ingresos; y los datos de PEP si corresponde |

La lista de la matriz de campos coincide con la norma en los dos regímenes.

**Dos puntos que la norma abre y la matriz no resuelve — para Rodrigo/Legal:**

1. **El art. 26 num. 1 encabeza «sus clientes personas físicas (tomador y
   beneficiario designado)»**, o sea que los diez mínimos aplicarían también al
   beneficiario designado. La matriz, en cambio, limita al beneficiario a
   nombre y domicilio, apoyada en la Res. SS.SG. 215/17 num. 11.4. Son dos
   normas de distinto orden (seguros y SEPRELAD) y la tensión no está resuelta
   en ningún documento del proyecto. **Hasta que Legal se pronuncie manda la
   matriz** —es lo aprobado— y se registra acá que el punto quedó abierto.
2. **El art. 26 num. 1 inc. i) pide «documentación que demuestre el volumen de
   ingresos»**, mientras la matriz prohíbe expresamente agregar carga de
   comprobante de ingreso a SeguroLoTengo y remite a «los parámetros utilizados
   por el SO en la elaboración del perfil transaccional». Es una lectura
   defendible del inciso —la norma dice «considerando los parámetros utilizados
   por el SO»— pero conviene que Alianza la deje por escrito, porque es el SO
   quien responde.

**Sigue pendiente** la Res. SEPRELAD N° 50/2020, que el código cita junto a la
71/19 y todavía no está en `docs/normativa/`.

### D-25 · Sexo
- **DECIDIDA (04-sep-2026): lo que indica la matriz** — **no se pregunta**. Se conserva automáticamente porque **el modelo registrado de la Solicitud lo imprime** (`docs/Solicitud.pdf`, cabecera «País de nacimiento · Sexo · Estado civil · Nacionalidad · Residencia»), y sale del **MRZ de la cédula** (`mrz.ts` lo lee en la posición 8 de la segunda línea y ya lo cruza con el frente, `CAMPOS_CRUZADOS_CON_MRZ`). Deja sin efecto la decisión del 21-ago-2026 de elegirlo a mano. **Abierto al implementar:** la cédula del formato anterior no tiene MRZ; ahí el dato viene del registro civil si lo provee, o queda vacío y así se imprime — no se pide ni se adivina.
- **Nota para Alianza:** ese mismo modelo imprime país de nacimiento, estado civil, nacionalidad y residencia, que la matriz retira o reserva para la ruta normal. Hay que confirmar si `Solicitud.pdf` es el modelo inscripto bajo el 15-VI.0002 o un formulario genérico: si es el inscripto, manda el modelo (215/17 art. 7º) y esos campos se conservan como dato automático o vacío, nunca como pregunta.

### D-26 · Registro del plan (CHG-03)
- **DECIDIDA (04-sep-2026): se carga el dato oficial.** Nota SS.SG. N.º 397/2026 del 07-ago-2026 (`docs/RegistrosOficiales/`): sección Seguro de Vida de Corto Plazo, denominación **«Seguro de Vida Individual con Indemnización Adicional por Diagnóstico de Cáncer»**, código **15-VI.0002**. Implementado en `src/domain/catalogo.ts` (`REGISTRO_PRODUCTO`, con `denominacionRegistral` separada del nombre comercial y `esProvisional: false`); el desglose del IVA sigue provisional por su propio motivo (D-04). Sigue pendiente **`urlModelo`** (215/17 punto 9.f): Alianza tiene que publicar el modelo y pasar la dirección. Los PDF que imprimen el código cambian de bytes; los ya cerrados conservan su huella.

### D-27 · Constancia verificable de la firma no cualificada del cliente
- **DECIDIDA (04-sep-2026), a propuesta del equipo técnico tras verificar que la evidencia existía pero ningún QR ni enlace llevaba a ella.** La constancia del acto de firma del cliente pasa a ser el **cuarto documento del motor**, `CONST-<correlativo>`: se cierra, se hashea y se guarda **dentro del propio acto de firma**, y entra al expediente **en la misma escritura** que la firma (`registrarFirmaClienteInterna`), como el certificado entra con el cobro. Sin constancia no hay firma (`CONSTANCIA_NO_EMITIDA`; el código ya se consumió y hay que pedir otro).
- **Dos niveles, por la regla inviolable #7.** *Público*, por el QR que el PDF ya imprime: `/verificar/<código>` publica para la firma del proponente su naturaleza, la norma (Res. SS.SG. 210/2025, arts. 4 y 9), **qué** la respalda —categorías, nunca valores— y la huella de la constancia; y `CONST-…` se verifica por su propio código. *Del titular*: el PDF con los datos del acto (identidad, canal enmascarado, referencia del OTP, IP, dispositivo, huellas), descargable desde la confirmación y desde el panel de evidencia. **Por qué:** el art. 9 exige que la información conservada quede disponible para consulta del cliente y de la SIS; la consola cubría a la SIS y al cliente solo mientras durara su sesión.
- **La regla D-05 («tres descargables y ninguno más») se amplía a cuatro**, y la constancia se distingue de los otros tres: no es contractual ni de cobertura, es el registro probatorio del acto, y el propio PDF lo dice en rojo.
- **La leyenda del cliente en el bloque de firmas del paquete** deja de decir «mediante enlace seguro» —era el flujo de un proveedor— y cita el acto que ocurre y su norma; el bloque lleva versión impresa (`FIRMAS-v2`). Los PDF ya cerrados conservan su huella (reglas #4 y #10).
- **Pendiente:** entregar la constancia por los canales verificados con acuse junto con los otros documentos (CHG-44) y un enlace firmado con vencimiento para volver a pedirla sin sesión.

## Bloque G — Pantallas v4 y manual funcional (15-sep-2026)

Origen: el handoff de pantallas v4 y el manual funcional que Rodrigo Fernández
(Interseguros) mandó el 14-sep-2026 (`docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/`).
El contraste con el repositorio, los conflictos que siguen abiertos (C-1 a
C-12) y el plan de implementación están en el `ANALISIS.md` de esa carpeta.
Todas las entradas de este bloque las decidió Andres el 15-sep-2026.

### D-28 · Fuente de verdad de las pantallas v4
- **DECIDIDA:** el paquete v4 reemplaza como fuente visual al prototipo v3 de Lovable, que queda superado. **Orden de autoridad:** (1) el **manual funcional**, (2) el arte `APROBADA_FINAL`, (3) `screens.json`, la especificación de 03D y las reglas globales. Esto invierte el orden que declaran el handoff y el manual, que ponen el arte primero. Solo se implementa lo `APROBADA_FINAL` con `approved_for_development = true`. Por encima del manual siguen estando las reglas inviolables de `CLAUDE.md` y la matriz de cumplimiento: donde choquen, se señala y no se implementa.
- **Los 103 PNG (73 MB) y el PDF del manual no se versionan:** quedan como referencia local. Se versionan el manifiesto con el SHA-256 de cada arte y la transcripción de texto del manual con la huella del original.

### D-29 · Sin modo oscuro en la primera fase
- **DECIDIDA:** la primera fase de v4 sale **solo en tema claro**. El botón de día/noche de `HeaderInstitucional` no se muestra en el flujo v4. Los tokens semánticos se conservan para retomarlo más adelante.

### D-30 · Web app responsiva
- **DECIDIDA:** mobile-first, y **en anchos de escritorio los componentes van lado a lado**. Los artes son todos de celular, así que la disposición de escritorio de cada pantalla se deriva de su arte móvil sin cambiar orden, textos ni jerarquía, y se aprueba con capturas.
- **Implementada el 17-sep-2026** (a pedido de Andres, tras ver las capturas de escritorio «alargadas»): `src/components/v4/disposicion.tsx` es el único sistema de ensanche —`DisposicionV4` (contexto fijo a la izquierda, acción a la derecha desde 1024 px), `RejillaV4` (listas de tarjetas iguales en 2–3 columnas), `CamposV4` (campos cortos y hermanos lado a lado), `AccionesV4` (botón con ancho de botón) y `ProsaV4` (~65 caracteres por línea)—; `MarcoV4` da el lienzo de 72 rem. El DOM conserva el orden del arte: celular y lector de pantalla ven lo mismo que antes. Las capturas de aprobación son las del PDF de gerencia (`98-capturas-gerencia.spec.ts`, escritorio 1456 px y celular 390 px).

### D-31 · Datos extraídos editables; elegibilidad y bloqueo con el OCR
- **DECIDIDA:** en 03D **todos los datos extraídos se pueden editar**, salvo el tipo de documento, y **cada cambio se registra**. La **elegibilidad por edad (regla #8) y el bloqueo por cédula (regla #11) se calculan con el valor que el OCR leyó de la cédula**, frente y dorso (el MRZ cuando lo hay; el registro civil para la cédula del formato anterior, como hoy). Las dos reglas no cambian de letra. El dato corregido se guarda como **declarado**, aparte del leído, y la evidencia de la corrección lleva los dos valores.
- **Abierto:** qué se imprime en la Solicitud cuando el dato declarado difiere del leído, y si una discrepancia en la cédula o en la fecha de nacimiento manda el caso a revisión.

### D-32 · Plazo de pago de 10 minutos
- **DECIDIDA:** el plazo para pagar es de **10 minutos desde la firma del cliente**. **Modifica D-10** (24 h). La consecuencia es que la reversa de la operación de Bancard por `hook_alias` pasa a correr al minuto 10, y que el reloj arranca en `FIRMADO_CLIENTE`, en línea con la enmienda del 04-sep a D-08.

### D-33 · Preguntas de salud
- **DECIDIDA:** las preguntas son las del paquete v4: **tres preguntas médicas en 04A** (compatibles: 1 = Sí, 2 = No, 3 = No) y la **condición PEP en 03E**. Las demás declaraciones del v2 se reubican así: vigencia y carencias, entrega digital y corredor pasan a 04D; la veracidad se acepta con la firma en 04E (conflicto C-10). Una respuesta incompatible deriva a revisión manual y nunca rechaza en automático (regla #5).

### D-34 · Analítica sin datos sensibles
- **DECIDIDA:** la analítica **no recibe datos sensibles**. Las reglas (punto único de entrada, rutas excluidas, saneamiento de URL y título, lista cerrada de eventos, test que lo hace cumplir) están en `ANALISIS.md` §5.4. Que Google Analytics pueda instalarse sin opción de rechazo es otra cosa y sigue abierto con Legal (C-2, fila 85).

### D-35 · Voseo
- **DECIDIDA:** todo el desarrollo va **en voseo**, aunque el arte esté en usted o en tú. Los consentimientos en primera persona no cambian. Las adaptaciones pantalla por pantalla están en `02-pantallas-v4/textos/`.

### D-36 · Etapas efectivas del stepper
- **DECIDIDA:** las pantallas se corrigen para que sean **consistentes con los pasos efectivos**: cinco etapas (Plan · Verificación · Actividad e ingresos · Declaraciones y firma · Pago y confirmación), con la numeración que dibujan los artes y no el `main_stage` del JSON. Una pantalla terminal muestra la etapa en la que el flujo se detuvo. Tabla y correcciones en `ANALISIS.md` §4.

### D-37 · SMS de contingencia sobre AWS
- **DECIDIDA:** la contingencia por SMS del OTP del celular (03A) sale **inicialmente por AWS End User Messaging SMS**. Queda registrada en la fila 2 de la tabla de integraciones. Paraguay no admite remitente propio (ni sender ID, ni número largo, ni código corto): la entrega es *best effort*. Hay que salir del sandbox antes de producción.

### D-38 · Firma de Interseguros en lote, por fuera del sistema
- **DECIDIDA:** en la primera fase, **Interseguros firma en lote con su firma cualificada, por fuera del sistema**, después del pago. El sistema provee la **entrega** (lote exportable con manifiesto y huellas) y la **recepción** (carga de los PDF firmados, emparejados por el prefijo de la revisión incremental). **Modifica D-13** en cómo llega la firma, no en quién firma. Diseño, en estado de propuesta: `docs/plan/DISENO_FIRMA_EN_LOTE.md`.

### D-39 · Tipografía
- **DECIDIDA:** una fuente **libre y parecida a Nimbus Sans**. Se adopta **Arimo** (SIL OFL 1.1, Google Fonts, pesos variables de 400 a 700, métrica de Arial), cargada con `next/font/google`. La alternativa más fiel al dibujo, TeX Gyre Heros (GUST Font License, derivada de URW Nimbus Sans L), solo trae 400 y 700 y hay que autoalojarla. La Nimbus Sans de URW base35 no sirve como webfont comercial: su excepción AGPL cubre PostScript y PDF, no `@font-face`. **Reemplaza** a DM Sans de `docs/GUIA_DE_ESTILOS.md` para el flujo v4.

### D-40 · Sin detección automática de alteración documental
- **DECIDIDA:** por ahora **no se contrata un proveedor** que detecte la alteración del documento. El estado «posible alteración» de 03C (03C_19) no tiene quién lo dispare. Que lo dispare la inconsistencia MRZ ↔ frente de `mrz.ts` es una propuesta abierta (C-12).

### D-41 · Pantallas sin arte aprobado
- **ESTABLECIDA:** Andres ya consultó por **03E** (candidata), **04E**, **05A** y **05B** (sin arte). **No se implementan** hasta que tengan arte `APROBADA_FINAL`. Sus reglas funcionales del manual se usan para el dominio, no para dibujar.

### D-42 · Firmantes y Certificado de Cobertura Provisional (preliminar)
- **DECIDIDA, PRELIMINAR (15-sep-2026), «luego veremos si hay cambios»:**
  - **Solicitud + FIPF (un PDF): dos firmas.** Firma el **cliente**, con firma no cualificada y OTP web, antes del pago. Firma **Interseguros**, con firma cualificada Code100; en la fase 1, en lote por fuera del sistema (D-38). **Alianza no firma la propuesta.** Esto confirma la enmienda del 04-sep a D-13 y deja de lado lo que dice el manual v4 en la p. 9 (conflicto C-4).
  - **CPC:** lo **genera Interseguros desde SeguroLoTengo**, con el modelo que aprueba Alianza, y **lo firma Alianza**. Esto confirma lo que dijo Rodrigo el 14-sep y **modifica D-12**: cae la parte de la enmienda del 04-sep según la cual Alianza lo emitía desde su sistema. Queda sin efecto también lo que dice el manual en la p. 9 (C-5). La firma de Alianza viaja por el intercambio SFTP con Alianza.
- **Consecuencia que queda por diseñar:** el CPC necesita la firma de Alianza (unos 5 minutos, por SFTP), así que no puede quedar firmado en la misma escritura que el cobro, como pedía CMP-07. Hay dos momentos: el CPC se **genera** con el cobro y se **entrega firmado** cuando vuelve de Alianza. Falta decidir qué ve la persona mientras tanto (P2).
- **Consentimiento biométrico (C-13), cerrado:** es obligatorio, y lo cubre la casilla obligatoria de 03B (fotografías, datos biométricos, prueba de vida y coincidencia con la cédula). En 03C no se agrega otra casilla.

## Bloque H — v4 como única versión (16-sep-2026)

Decisiones de Andres del 16-sep-2026, tras el análisis arte por arte de los 103
PNG (`docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/ANALISIS_VISUAL_PNG.md`).
Cierran cuatro puntos que ese análisis dejó abiertos y **cambian el alcance**:
v4 deja de ser una fuente visual a portar y pasa a ser **la versión del
producto**.

### D-43 · v4 es la única versión — **DECIDIDA**
- *"Definamos que esta es la v4, el resto no va."* El flujo de 8 pasos (v2) y
  el de 3 pasos (v3) **dejan de ser objetivos**: no se les agregan pantallas ni
  se los mantiene más allá de lo necesario para que la suite siga en verde
  mientras v4 se construye.
- **Cómo entra:** con el mismo mecanismo que usó v3, `FLUJO_V4`, por una razón
  operativa y no de diseño — `PASOS_FLUJO`, el grafo de transiciones y la
  batería E2E se resuelven a import-time desde la versión activa, así que
  encender v4 antes de que existan sus pantallas dejaría la suite en rojo, y
  *"no hagas commits que dejen tests en rojo"*. El flag se enciende cuando las
  15 pantallas estén, y **ahí v2 y v3 se borran**; no quedan como alternativa.
- **Manda el manual** (D-28) **y las pantallas tienen que ser coherentes entre
  sí**: donde el arte se contradice —contadores, rótulos, estados
  deshabilitados— gana la coherencia, no el píxel.

### D-44 · No hay SMS — **DECIDIDA**
- *"No existirá SMS."* **Deja sin efecto a D-37.** El único canal de OTP es
  **WhatsApp**, como ya dice la regla inviolable #1.
- **Qué se cae del arte:** los estados `03A_10 · SMS disponible` y
  `03A_11 · Código SMS enviado` **no se implementan**, y con ellos desaparece
  el rótulo inconsistente que el análisis marcó (*«Verifique su número de
  WhatsApp»* con un código llegado por SMS).
- **La cadena queda:** WhatsApp → reenvío por WhatsApp (espera de 60 s) →
  agotados los 3 intentos o los reenvíos, **bloqueo temporal de 5 minutos**.
  No se ofrece un canal alternativo que no existe.
- **Consecuencia de coherencia:** `03A_12 · Bloqueo temporal` deja de mostrar
  la franja verde de un SMS enviado.

### D-45 · Renombre del producto a VIVE — **DECIDIDA**
- *"Se renombra el producto a VIVE, todos los documentos deben cambiar."*
- **Nombre comercial:** `Seguro de Vida Oncológico VIVE`. **Planes:** `VIVE`,
  `VIVE+`, `VIVE TOTAL`. **Premios** de la tabla de la p. 5 del manual:
  **390.000 / 575.000 / 760.000**, IVA incluido.
- La **denominación registral no cambia** (`Seguro de Vida Individual con
  Indemnización Adicional por Diagnóstico de Cáncer`, código `15-VI.0002`,
  Nota SS.SG. N.º 397/2026): es lo que la SIS inscribió, y no es un nombre
  comercial que podamos cambiar por decisión propia. Los documentos imprimen
  las dos cosas, como ya hacían.
- **El `PlanId` interno no se renombra** (`CONFIO`, `CONFIO_PLUS`,
  `CONFIO_TOTAL`), ni las variables `NEXT_PUBLIC_PLAN_CONFIO_*` que lo
  sobrescriben: identifican al plan, no lo nombran, y es lo que ya está
  persistido en los expedientes (regla inviolable #10). Lo que cambia es el
  **nombre comercial** que sale de `catalogo.ts` y el `ID_VERSION_OFERTA`
  (`OFERTA-VIVE-v1`, subido el 15-sep-2026 con los premios). Enmienda del
  16-sep-2026: la primera implementación de esta rama había renombrado el
  `PlanId` y traducía los viejos al leer (`PLAN_ID_LEGADO`); se deshizo al
  fusionar con `main`, que ya había hecho el renombre comercial sin tocar el
  identificador. Manda `main`.

### D-46 · Sin proveedor de alteración documental; se permite cargar archivos — **DECIDIDA**
- *"No vamos a usar un proveedor de alteración documental. Permitiremos que
  carguen archivos."* **Confirma D-40 y amplía lo que decía el arte:** la carga
  de imagen del **frente y el dorso** deja de ser una comodidad de `DEMO_MODE`
  y pasa a ser un camino **de producción**, como ya lo anunciaba el aviso
  `ARCHIVOS Y CAPTURA` de 03C (JPG, JPEG, PNG o HEIC, hasta 20 MB, sin PDF).
- **La selfie sigue siendo solo cámara**: es el ancla biométrica y el único
  control que queda contra la suplantación.
- **`03C_19 · Posible alteración` no se implementa como estado alcanzable**:
  sin proveedor que lo detecte, dibujarlo sería prometer una verificación que
  no existe. El texto queda descrito en el análisis visual por si vuelve.
- **Queda anotado el riesgo**, para que la decisión sea trazable: sin detección
  de alteración y con archivo admitido, la autenticidad documental descansa en
  el MRZ (consistencia interna, no existencia) y en la coincidencia facial.

### D-47 · Se dice «premio», no «prima» — **DECIDIDA**
- *"Se llama PREMIO."* Cierra el punto que el análisis dejó abierto entre el
  arte (`Premio total anual`) y el manual (`prima anual`).
- Se usa **premio** en toda la interfaz y en los documentos que genera el
  portal. Donde un texto sea **cita literal** de una norma o del condicionado
  que dice «prima», se conserva la cita y no se la reescribe.

### D-48 · Catálogos de 03E — **DECIDIDA**
- *"Investigá listados similares que tengan entre 15 y 20 opciones."* Los artes
  candidatos muestran 7-8 filas y declaran un total (7, 15, 28, 23 y 10); las
  listas completas no llegaron.
- Se arman **cinco catálogos de 15 a 20 opciones**, salvo `Situación laboral`,
  que queda con las **7** que el arte enumera enteras. Cada uno se ancla en un
  listado reconocido —CIIU Rev. 4 para actividad económica, CIUO-08 para
  ocupación y profesión, y los conceptos de origen de fondos del FIPF— y
  **conserva en su orden las opciones visibles del arte**.
- Siguen siendo **decisión de producto, no obligación legal**: ningún documento
  fuente enumera estas listas. Cuando Interseguros mande el catálogo aprobado,
  manda el suyo.

## Actualizaciones que la Matriz V4 necesita (consecuencia de la ronda 1)

Dos decisiones **establecidas** dejan desactualizado el texto de la matriz. No son
excepciones a evaluar ni condicionan la implementación: son cambios de política ya
tomados, y la matriz —cuya propia regla de control exige registrar todo cambio— debe
reflejarlos. Responsables: Rodrigo / Legal.

### ALR-06 · Medios de pago (D-02)
- **Dice hoy la matriz:** §1 "Bancard, proveedor de pago **exclusivamente QR**"; §7 orden 6 describe la operación atómica solo sobre QR. La ESPECIFICACION lo repite.
- **Política establecida:** Bancard con sus tres tipos de pago — QR, crédito y débito — sin preautorización, con seguimiento de devoluciones.
- **Qué conserva:** el mínimo duro *"no se capturan ni almacenan PAN/CVV"* queda **intacto**, porque la tarjeta va por el flujo alojado/tokenizado de Bancard. Lo que cambia es únicamente la exclusividad del QR.
- **Actualizar:** §1 (rol de Bancard), §7 orden 6 (operación atómica sobre los tres medios) y la compuerta de producción 7, que pasa a cubrir tarjeta, conciliación, duplicados, reversos y devoluciones.

### ALR-07 · Firmas institucionales (D-13)
- **Dice hoy la matriz:** §7 "cliente e Interseguros firman el expediente Solicitud + FIPF; Alianza firma CPC y póliza. **Alianza no firma la propuesta**… salvo que el modelo registrado disponga expresamente lo contrario" (Res. 210/2025 arts. 4-5, Ley 827 art. 76, Res. 231/2025 art. 2).
- **Política establecida:** Alianza firma los tres documentos (Solicitud, FIPF y CPC), prefirmados o junto con el cliente.
- **Actualizar:** §7 (mapa de firmas por documento, con las dos modalidades) y contrastarlo con el modelo registrado en la compuerta de producción 6. La implementación no espera este registro: la lista de firmantes es configurable por documento y modalidad.
- **CERRADA (04-sep-2026):** con la Res. 215/17 a la vista (num. 11.15), la matriz tenía razón: Alianza no firma la propuesta. D-13 se modificó en ese sentido y la matriz no necesita actualizarse en este punto. Lo que sí debe reflejar la matriz es la enmienda de D-08 (firma de Interseguros posterior al pago) y de D-12 (CPC emitido por Alianza).
