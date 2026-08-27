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

### D-09 · Estados de vencimiento y devolución
- **DECIDIDA (19-ago-2026): sí**, se conservan. Con D-10 y D-02 dejan de ser legado y **recuperan disparadores propios**:
  - `VENCIDO`: expediente **firmado y no pagado** que superó las 24 h (D-10). No genera devolución: bajo el orden nuevo no hubo cobro.
  - `DEVOLUCION_EN_TRAMITE → DEVUELTO`: flujo de seguimiento de **devoluciones de pagos con tarjeta** (D-02).
  - `CANAL_EMAIL_VERIFICADO` sí queda legado sin aristas (D-06).
  - La regla inviolable #11 (bloqueo por cédula) se re-redacta sobre esta semántica nueva.

### D-10 · Caducidad del expediente firmado sin pagar
- **DECIDIDA (19-ago-2026): caduca a las 24 h.**
- **Verificación pedida sobre Code100:** su documentación (`docs/Integraciones/Documentacion Firmador - API FLOW.pdf`) **sí expone caducidad de sesión** — `POST /signature/getSessionId` devuelve `fecha_expiracion` y `expirado: true/false` — pero **no documenta una duración fija**; en su ejemplo, una sesión creada 14-ene 17:10 UTC expira 15-ene 14:12 (≈21 h). Implementación en consecuencia: el plazo de 24 h del expediente es **nuestro**, y el estado de la sesión de firma se toma de `fecha_expiracion`/`expirado` del proveedor cuando exista, sin hardcodear su política. Confirmar la duración exacta se suma a las consultas PEN-01/PEN-02.

### D-11 · PDF unificado
- **DECIDIDA (19-ago-2026): sí.** Un solo PDF (Solicitud + FIPF + declaraciones), un correlativo, ambos códigos internos visibles en sus secciones, **un** SHA-256 congelado. La regla inviolable #3 pasa a ser estructural.

### D-12 · Certificado de Cobertura Provisional
- **DECIDIDA (19-ago-2026): sí.** Documento nuevo del motor determinista, generable solo con pago confirmado, con QR de verificación (CMP-06) y modelo rotulado provisional. Se actualiza CLAUDE.md: sigue prohibida la "Nota de Cobertura"; el CPC se incorpora como documento del producto.

### D-13 · Firmas sobre el expediente
- **ESTABLECIDA (19-ago-2026): Alianza firma los TRES documentos** — Solicitud, FIPF y Certificado de Cobertura Provisional — **ya sea prefirmados o junto con el cliente**. Ambas modalidades son válidas y el sistema debe soportar las dos.
- **Diseño:** la lista de firmantes por documento es **dato configurable y ordenado**, con dos modalidades por firmante: `PREFIRMADO` (la firma institucional ya está sobre el documento cuando el cliente lo recibe) o `CONJUNTO` (se aplica en el mismo acto que la del cliente). Firmantes previstos: cliente (simple, Code100), Interseguros (cualificada) y Alianza (cualificada) sobre Solicitud y FIPF —que viajan como un PDF único, D-11—, y Alianza sobre el CPC. Cada firma deja firmante, certificado simulado, modalidad y evidencia propios, visibles en la consola. Cambiar de modalidad es configuración, no reescritura.
- **Registro en la matriz (ALR-07, abajo):** la Matriz V4 §7 dice hoy que Alianza no firma la propuesta. Rodrigo/Legal deben actualizarla y contrastarla con el modelo registrado (compuerta de producción 6).

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
