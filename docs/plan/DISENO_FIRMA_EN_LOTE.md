# Firma institucional en lote, por fuera del sistema (D-38)

**Estado: PROPUESTA de diseño, sin implementar (15-sep-2026).** Nace de la
decisión de Andres del 15-sep-2026: *«en la primera fase Interseguros firmará en
lote por fuera del sistema; se debe contar con un mecanismo de entrega y
recepción de estos documentos»*. Sirve para cualquier firmante institucional,
porque el manual funcional v4 también pone a Alianza como firmante cualificada
de la Solicitud + FIPF (pregunta abierta P1).

## 0. Precondiciones que todavía no están en el código

- **Enmienda de D-08 del 04-sep:** hoy `TRANSICIONES_V2/V3` tienen
  `FIRMADO_CLIENTE: ["FIRMADO"]` y el cobro sale de `FIRMADO`. Tiene que salir
  de `FIRMADO_CLIENTE`, con la firma institucional **después** del pago.
- **Plazo de pago de 10 minutos (D-32):** `PLAZO_PAGO_MS` (`firma-p8.ts`) sigue
  en 24 h y el reloj arranca en `registrarFirmasInstitucionales`. Tiene que
  arrancar con la firma del cliente, y `vencerPlazoSiCorresponde` tiene que
  mirar `FIRMADO_CLIENTE`.

## 1. Entrega

**Elegibilidad por lote de un rol:** el expediente está en `PAGO_CONFIRMADO`,
le falta la firma de ese rol, ya están aplicados todos los firmantes anteriores
en el orden de `firmantes-documento.ts` (las firmas PAdES van en fila india:
dos firmas sobre la misma base dan archivos incompatibles), y no está en otro
lote abierto del mismo rol con la misma huella base. No entran expedientes sin
pagar: vencen a los 10 minutos y firmarlos sería trabajo perdido.

**Qué se entrega:** la última revisión del documento (el PDF congelado, o el
que devolvió el firmante anterior).

**Acción «Generar lote» de la consola:**

- `lotes-firma/<loteId>/entrega.zip` con los PDF (`PROP-<correlativo>-v<versión>.pdf`),
  más `manifiesto.json` y `manifiesto.csv`: `loteId`, rol, código, correlativo,
  versión, SHA-256 base, **tamaño base en bytes**, instante del pago y fecha de
  corte.
- Entidad `LOTE#<id>` en DynamoDB, con estado `GENERADO → DESCARGADO → PARCIAL → CERRADO`
  y cada ítem `PENDIENTE / RECIBIDO / RECHAZADO`.
- El SHA-256 del zip y del manifiesto se guarda en el lote y como evidencia en
  cada expediente (`FIRMA_LOTE_ENTREGA`). Cada descarga deja
  `FIRMA_LOTE_DESCARGA`, con operador, IP y hora.

**Quién descarga:** la consola tiene hoy una sola clave y ningún rol
(`_sesion.ts`). Hasta que existan usuarios nominales, cada acción exige el
nombre del operador y lo deja en la evidencia. Los PDF llevan salud y PEP
(regla #7): bucket cifrado con KMS y retención corta del zip.

## 2. Recepción

Se carga uno o varios PDF, o un zip.

**Emparejamiento por contenido, no por nombre.** El firmador puede renombrar
los archivos. Para cada archivo se buscan los ítems abiertos cuyo `tamañoBase`
sea menor que el del archivo y cuyo `SHA-256(archivo[0..tamañoBase])` sea igual
al hash base. Una firma PAdES incremental conserva los bytes originales como
prefijo. El nombre del archivo es solo una pista.

**Verificaciones, en orden, cada una con su motivo de rechazo:**

1. El prefijo es exacto (`NO_EMPAREJA`).
2. Hay una revisión nueva con `/ByteRange [0 a b c]` y `/Contents` (`SIN_FIRMA_NUEVA`).
3. El `ByteRange` cubre de 0 hasta el final del archivo, con el único hueco en
   `/Contents`, y el prefijo cae antes de ese hueco (`BYTERANGE_NO_CUBRE`).
4. El certificado del firmante: se extrae del CMS y se lee con
   `X509Certificate` de `node:crypto`. El sujeto, número de serie y emisor
   tienen que estar en la lista permitida para ese rol (`FIRMANTE_INESPERADO`),
   y la fecha de firma dentro de la vigencia del certificado (`CERTIFICADO_FUERA_DE_VIGENCIA`).
5. La fecha de firma (`signingTime` o `/M`) es posterior a la entrega y no
   futura (`FECHA_INCONSISTENTE`).
6. La integridad del CMS: el `messageDigest` coincide con el SHA-256 de los
   rangos, y la firma de los atributos firmados se verifica con `crypto.verify`
   sobre un parser DER mínimo, con el mismo criterio que el PDF y el QR propios.
7. El incremento no agrega contenido fuera de la firma: solo objetos de firma,
   formulario, widget o DSS (`CONTENIDO_AGREGADO`). Es heurístico.

**Ante una discrepancia** se rechaza ese archivo y el expediente no se toca. La
evidencia va al expediente si el archivo emparejó, y al lote si no.

**Idempotencia** por el SHA-256 del archivo completo: el mismo archivo otra vez
es `DUPLICADA` (deja evidencia, no transiciona), y otro archivo para un rol ya
aplicado es `YA_APLICADA`. Se guarda en
`…/PROP-…-v1-<rol>-<sha256>.pdf` (la huella va en la clave, como el CPC) con
bloqueo optimista.

**Transición:** si todavía falta otro firmante, el expediente sigue en
`PAGO_CONFIRMADO` con `firmasInstitucionales` parcial. «Firmas pendientes» se
deriva de la configuración, no es un estado nuevo, y el documento pasa a ser
elegible para el lote del rol siguiente. Con la última firma se transiciona
`PAGO_CONFIRMADO → FIRMADO`, y después `FIRMADO → EMITIDO`.

## 3. Qué el sistema no verifica, y cómo se declara

El sistema no verifica la cadena hasta la raíz de la PKI paraguaya, la
revocación (CRL/OCSP), el sello de tiempo de una TSA, el LTV ni la condición de
prestador cualificado. No se inventan APIs de ninguna autoridad certificante.
Cada firma lleva:

```ts
verificacion: { nivel: "ESTRUCTURAL_E_INTEGRIDAD", cadena: "NO_VERIFICADA", revocacion: "NO_VERIFICADA" }
```

La consola y `/verificar` lo dicen así: *«firma cualificada declarada; validable
en cualquier validador PAdES externo»*. Es el mismo criterio que el prefijo
`DEMO-CERT` de hoy.

## 4. Impacto

- **`firmantes-documento.ts`:** no conviene una modalidad `LOTE_EXTERNO`,
  porque *cuándo* se firma y *por dónde* llega la firma son dos cosas
  distintas. `ModalidadFirma` pasa a ser `PREFIRMADO | CONJUNTO | DIFERIDO`; se
  agrega `via: "PROVEEDOR" | "LOTE_EXTERNO"` y una lista de certificados
  permitidos por rol. Invariante con test: `LOTE_EXTERNO ⇒ DIFERIDO`. Se suma
  `firmantesDiferidos()`. Alianza entra agregando una fila.
- **`FirmaInstitucional`:** se le agregan `via`, `loteId`, `hashBase`,
  `hashResultante`, `clave`, los datos del certificado, la fecha declarada y
  `verificacion`.
- **Máquina de estados:** `FIRMADO_CLIENTE → PAGO_CONFIRMADO | VENCIDO`;
  `PAGO_CONFIRMADO → FIRMADO`; `FIRMADO → EMITIDO`. La arista vieja
  `FIRMADO → PAGO_CONFIRMADO` se conserva como legado. Cambian V2 y V3.
- **Consola:** una pestaña «Firmas en lote» para generar, descargar, cargar y
  ver el resultado de cada archivo, con aviso de atraso pasadas las 24/48 h
  desde el pago.
- **Evidencia append-only:** `FIRMA_LOTE_ENTREGA`, `FIRMA_LOTE_DESCARGA` y
  `FIRMA_LOTE_RECEPCION` (aceptada, rechazada o duplicada, con motivo).
- **Qué ve el cliente:** *«Solicitud firmada por vos ✓ · Firma del corredor en
  proceso (hasta 48 h) ⋯»*. Descarga lo que firmó, la constancia y el
  comprobante, y recibe el documento final por sus canales
  (`entrega-documentos.ts`) cuando se completan las firmas.

## 5. Cambios por archivo

- `src/domain/firmantes-documento.ts` y su test: `DIFERIDO`, `via`, certificados permitidos, invariante.
- `src/domain/tipos.ts`: `FirmaInstitucional` extendida; `LoteFirma` e `ItemLote`.
- `src/domain/expediente.ts`: aristas nuevas; `registrarFirmaInstitucionalRecibida` (de a una); plazo sobre `FIRMADO_CLIENTE`.
- `src/domain/firma-p8.ts`: `PLAZO_PAGO_MS` a 10 minutos.
- `src/domain/lote-firma.ts` (nuevo): elegibilidad, manifiesto, emparejamiento y motivos. Funciones puras.
- `src/documentos/pades-inspeccion.ts` (nuevo): `ByteRange`, CMS y certificado.
- `src/documentos/zip.ts` (nuevo): zip sin compresión, con CRC32.
- `src/repositories/lote-firma-repository.ts` (nuevo).
- `src/app/api/admin-consola/lotes/{generar,descargar,recibir}/route.ts` y la UI en `src/app/admin-consola/`.
- `src/domain/evidencia.ts`, los textos de confirmación y `/verificar`, `CLAUDE.md` y `DECISIONES.md` (D-08, D-10, D-13).

## 6. Riesgos

- **El firmador real puede no firmar de forma incremental.** Si reescribe el
  PDF, todos los archivos se rechazan con `NO_EMPAREJA`. **Hay que probarlo con
  el software de Interseguros antes de construir.**
- Los zips grandes pueden chocar con el límite de tamaño de las funciones de
  Amplify. Hay que prever la carga directa a S3 con URL prefirmada.
- Con la clave compartida de la consola, el operador que queda en la evidencia
  es declarado, no autenticado.
- Una devolución que ocurre entre la entrega y la recepción deja un documento
  firmado sobre un expediente en `DEVOLUCION_EN_TRAMITE`.

## 7. Preguntas abiertas

1. ~~¿Alianza firma la Solicitud + FIPF?~~ **Resuelta de forma preliminar (D-42, 15-sep): no.** El lote de la propuesta tiene un solo rol institucional, Interseguros.
2. ~~¿Por dónde va el CPC?~~ **D-42:** lo genera Interseguros y lo firma Alianza por el intercambio SFTP. No entra en el lote de Interseguros. La recepción puede reusar el emparejamiento por prefijo de §2.
3. ¿Qué certificado exacto usa cada firmante (sujeto y número de serie)?
4. ¿La verificación de integridad del CMS (punto 6 de §2) entra en la fase 1, o alcanza con los controles estructurales?
5. Si llega la firma de un expediente que está en devolución, ¿se guarda sin transición o se rechaza?
6. ¿Hacen falta usuarios nominales en la consola antes de producción?
7. ¿El lote para Alianza por SFTP sale de la misma entidad `LOTE#`?
