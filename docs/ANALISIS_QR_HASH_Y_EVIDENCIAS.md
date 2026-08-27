# Análisis del documento «Solución sólida con QR + hash SHA-256 + registro inmutable de evidencias»

**Documento fuente:** [`docs/QR_HASH_Y_EVIDENCIAS_INMUTABLES.pdf`](QR_HASH_Y_EVIDENCIAS_INMUTABLES.pdf) (9 páginas).
**Fecha del análisis:** 27-ago-2026.
**Alcance:** confrontar las diez piezas que el documento declara obligatorias
para la primera versión contra lo que el repositorio ya tiene, e implementar
las brechas reales.

---

## Resumen ejecutivo

El **QR interno ya existe** y funciona: se genera con código propio
(`src/documentos/qr.ts`, sin librería externa), se dibuja **dentro** del PDF
antes de hashearlo, y su destino —`/verificar/<…>`— es una página pública que
ya publica la huella y ofrece la comparación local del archivo. De los diez
puntos obligatorios del documento, **siete ya estaban cumplidos**, **uno era
una brecha real y se implementó en esta sesión**, y **dos son alcance nuevo que
choca con decisiones vigentes y quedan para decidir**.

La brecha implementada es la que el documento nombra como punto 2 de su
decisión final: **el token público aleatorio**. Hasta ahora el QR codificaba
`…/verificar/PROP-00018425`, es decir el correlativo de ocho dígitos —
veintisiete bits, recorribles con un script—. Ahora codifica
`…/verificar/00018425-<32 hexadecimales>`: 128 bits que no se pueden adivinar.

---

## 1. Punto por punto, contra la «Decisión final recomendada» (§ final del PDF)

| # | Lo que pide el documento | Estado | Dónde vive |
| :-- | :-- | :-- | :-- |
| 1 | QR propio, generado internamente | ✅ **Ya estaba** | `src/documentos/qr.ts` — codificador ISO/IEC 18004 escrito en el repo, modo byte, nivel M, versiones 1-10. Sin dependencia externa, y determinista a propósito: el QR va dentro del PDF que se hashea |
| 2 | Token público aleatorio y no predecible | 🟢 **Implementado ahora** | `derivarTokenVerificacion` (`src/documentos/servicio.ts`), `partirTokenVerificacion` (`src/domain/documentos.ts`). Ver §2 |
| 3 | Hash contractual SHA-256 | ✅ **Ya estaba** | `DocumentoCerrado.hashSha256` — se calcula al cerrar el PDF y antes de habilitar la firma (regla inviolable #4, fila 35 de la matriz) |
| 4 | Hash final SHA-256 | 🟡 **Parcial** | Existe `Firma.hashDocumentoFirmado` (el `H_CLIENTE` del documento). **No existe un `H_FINAL`** posterior a las firmas institucionales. Ver §3 |
| 5 | OTP exclusivo para la firma | ✅ **Ya estaba** | Regla inviolable #1: OTP de canal (paso 2) y OTP del acto de firma (paso 6), nunca reutilizados. Solo el hash se persiste (regla #2) |
| 6 | Página pública con información enmascarada | ⚠️ **Divergencia deliberada** | La página existe (`/verificar/[codigo]`) pero publica **cero** datos de la persona, ni siquiera enmascarados. Ver §4 |
| 7 | Verificación local del archivo | ✅ **Ya estaba** | `ComparadorDeHuella.tsx` — calcula el SHA-256 con `crypto.subtle` **en el dispositivo**; el PDF no se sube. Es exactamente el mecanismo que describe el §6 del documento |
| 8 | Descarga mediante nuevo OTP | ⚠️ **Choca con D-05** | Hoy los tres documentos se descargan desde la pantalla de confirmación, con la sesión del flujo. Ver §5 |
| 9 | Registro inmutable de evidencias | ✅ **Ya estaba** | Regla inviolable #10, `EvidenceStore`, append-only. Cubre generación, OTP pedido/validado, firma, firmas institucionales, entrega y descarga |
| 10 | Nueva versión y nuevo QR ante cualquier modificación | 🟡 **Parcial** | El modelo tiene `version` y el token deriva de ella, así que una versión nueva **ya produce un QR nuevo**. Lo que no existe es el estado `SUSTITUIDA`/`ANULADO` ni la cadena entre versiones. Ver §6 |

---

## 2. La brecha que se cerró: el token público (§1 y §2 del documento)

### Qué decía el documento

> `* Código visible: SLT-SOL-00018425-V1`
> `* URL del QR: https://segurolotengo.com/verificar/7fK9mP2x...`
> `* El fragmento final debe ser aleatorio, no solamente correlativo.`
> «El token evita que alguien pueda recorrer direcciones correlativas y
> consultar solicitudes de terceros.»

### Qué había

El QR codificaba `<URL_BASE>/verificar/<código>`, y el código es
`PROP-<correlativo>` con el correlativo de ocho dígitos que acuña
`generarNumeroPropuesta`. Eso son **10⁸ combinaciones ≈ 27 bits**: recorrerlas
enteras es cuestión de un script y una tarde. La página de destino es pública,
sin sesión y sin límite de tasa (el rate limiting es trabajo de L6), así que un
barrido devolvía la lista de correlativos que existen con su versión, su sello
de tiempo, su SHA-256 y sus firmantes.

Ningún dato de la persona salía —eso lo garantiza la proyección de
`verificacion-documento.ts` (regla inviolable #7)— pero **sí salía el hecho de
que ese expediente existe**, que es justamente lo que el documento fuente pide
evitar.

### Qué hay ahora

El QR codifica `<URL_BASE>/verificar/<correlativo>-<32 hexadecimales>`.

**Formato.** `00018425-3f0a…` — ocho dígitos de correlativo, un guion, y 128
bits en hexadecimal. Va delante el correlativo, y no un blob opaco entero,
porque así la búsqueda reusa el índice que ya existe
(`buscarPorNumeroPropuesta`): se parte el token, se busca por su mitad conocida
y se compara el sufijo contra el registrado. Un token íntegramente aleatorio
habría exigido un índice nuevo en DynamoDB sin ganar un solo bit de
imprevisibilidad. Se eligió hexadecimal y no base64url porque el alfabeto de
base64url incluye el guion y el token no se podría partir sin ambigüedad.

**Se deriva, no se sortea, y eso es deliberado.** `randomBytes` daría un token
distinto en cada llamada, y el certificado se emite de nuevo en cada reintento
de la confirmación del pago: dos intentos producirían dos PDF con bytes
distintos y dos huellas distintas para el mismo documento y el mismo instante.
Eso rompería el **determinismo**, que en este servicio no es una comodidad sino
la propiedad que permite que una auditoría reproduzca el archivo y le vuelva a
salir el mismo SHA-256 (`docs/CONSOLA_ADMINISTRATIVA.md`, CLAUDE.md → «Tres
cosas no negociables de este servicio»).

La derivación es:

```
sufijo = SHA-256( <id del expediente> : <código del documento> : <versión> )[0:32]
```

El `id` del expediente es un `randomUUID` — 122 bits de CSPRNG que nunca se
imprimen en un documento ni viajan en una URL pública— y el SHA-256 que lo
envuelve es de un solo sentido, así que del token no se vuelve al `id`. Quien
conozca el `id` puede derivar los tokens de ese expediente, y no es un
problema: para conocerlo ya tiene que ser su titular o el personal de la
consola, que ven bastante más que estos tokens.

El **código** y la **versión** entran en la derivación por dos motivos
distintos: el paquete y el certificado comparten correlativo pero cada QR tiene
que abrir la verificación del suyo, y una versión nueva de un documento es un
documento nuevo que no debe heredar la dirección del anterior (punto 10 del
documento fuente).

**El código impreso no desaparece.** Sigue en la caja del encabezado y en el
pie de todas las páginas, y `/verificar/PROP-00018425` sigue resolviendo: el
propio documento fuente contempla las dos vías («escaneando el QR **o**
ingresando el código»). Las dos devuelven exactamente el mismo documento — el
token no da acceso a nada que el código no dé. Lo que cambia es quién puede
llegar.

### Tensión declarada del documento fuente

El documento pide a la vez (a) un token que impida recorrer correlativos y (b)
que el código visible se pueda tipear en el sitio. **Las dos cosas juntas no
cierran**: mientras el código tipeado resuelva, el recorrido sigue siendo
posible. Acá se resolvió así, y conviene que quede escrito:

- El **token** cierra la mitad que importa hoy: que la URL que circula por
  WhatsApp y queda impresa en un PDF reenviado no sea deducible de las que ya
  se vieron.
- El **recorrido del código** se acota con **límite de tasa sobre la ruta**, que
  ya tiene módulo propio (`src/domain/rate-limit.ts`, ventana deslizante por IP)
  y que el plan asigna a **L6** — el mismo lote donde ya estaba anotada la
  reevaluación de la evidencia por visita en `/verificar`. **Queda pendiente:
  aplicar `rate-limit.ts` a `/verificar/[codigo]`.**

Sin ese paso, el token mejora la situación pero no la resuelve del todo.

### Respaldo normativo

**Esto no tiene fila en la matriz de cumplimiento.** El QR entero es una
decisión de producto: la fila 77 exige el hash individual de cada documento y
la fila 47 exige vincular póliza, Solicitud, FIPF, pago y firmas por
correlativo o hash — cosas que el paquete ya cumplía sin QR. El token es un
control de seguridad razonable, no una obligación legal, y así hay que
presentarlo.

---

## 3. Brecha abierta: `H_FINAL` (§4 del documento)

El documento propone tres huellas encadenadas:

| Evidencia | Qué demuestra | En el repo |
| :-- | :-- | :-- |
| `H_CONTRACTUAL` | Documento exacto que vio y aceptó el cliente | ✅ `DocumentoCerrado.hashSha256` |
| `H_CLIENTE` | Documento resultante de la firma no cualificada | ✅ `Firma.hashDocumentoFirmado` |
| `H_FINAL` | Documento definitivo con firmas institucionales | ❌ **No existe** |

Hoy `FirmaInstitucional` guarda rol, nivel, modalidad, certificado e instante,
pero **no una huella del PDF resultante**. La página de verificación publica
`Firma.hashDocumentoFirmado` incluso después de las institucionales, lo cual es
correcto en el demo —el mock no vuelve a tocar los bytes, así que
`H_CLIENTE == H_FINAL`— y dejaría de serlo con Code100 real, que sí incrusta
las firmas cualificadas en el archivo.

**No se implementó, y hay una razón de principio.** Modelar `H_FINAL` exige
saber qué le hacen las firmas institucionales a los bytes, y eso lo define el
adaptador oficial de `SignatureProvider`, que todavía no existe. Inventarle un
comportamiento al proveedor es lo mismo que inventarle un webhook (PEN-02) o un
endpoint de documentos a WhatsApp-Modular: se declara la brecha y se espera al
contrato.

**Recomendación:** agregar `hashDocumentoFinal: string | null` a
`Expediente` (o a cada `FirmaInstitucional`) **en el mismo commit** en que se
escriba `src/adapters/live/signature-provider.ts`, y hacer que
`verificarDocumento` publique `hashDocumentoFinal ?? hashDocumentoFirmado ??
hashSha256`. El comparador de huella de la página debería entonces distinguir
los tres resultados que el documento tabula en su §6 en vez de responder
solo coincide/no coincide.

---

## 4. Divergencia declarada: datos enmascarados en la página pública (§5)

El documento propone que la página pública muestre:

> `* Asegurado enmascarado: Mónica M. G. T.`
> `* Cédula enmascarada: ***.***.336`

**El repositorio hace lo contrario, a propósito, y se propone no cambiarlo.**
`src/domain/verificacion-documento.ts` no publica **ningún** dato de la
persona: ni nombre, ni cédula, ni canales, ni plan, ni importe. Hay un test que
serializa la proyección entera y falla si aparece cualquiera de esos campos.

Tres razones:

1. **El enmascarado no es anonimato cuando el conjunto es chico.** «Mónica M.
   G. T.» + `***.***.336` + fecha de firma identifica a una persona concreta
   ante cualquiera que ya tenga una sospecha — y el código llega por un PDF
   reenviado, así que quien lo tiene puede ser cualquiera.
2. **La regla inviolable #7** aísla los datos sensibles; una página sin sesión
   ni auditoría de quién consulta es el peor lugar para relajarla.
3. **No hace falta para el propósito.** CMP-06 pide verificar la
   **autenticidad** del documento. Quien tenga el PDF ya ve los datos en el
   PDF; lo que necesita comprobar es que la huella coincide, y para eso están
   el SHA-256 publicado y el comparador local.

Si Legal o Interseguros quieren los datos enmascarados, es una decisión de
producto que hay que tomar explícitamente y anotar como decisión nueva
(`docs/plan/DECISIONES.md`) — no algo que este análisis deba resolver solo.

**Lo que sí conviene incorporar del §5:** el documento pide `noindex` en la
página. **Ya está** (`robots: { index: false, follow: false }` en
`generateMetadata`).

---

## 5. Alcance nuevo que choca con D-05: descarga protegida por OTP (§7)

El documento propone que la página pública no entregue el documento y que la
descarga exija un OTP nuevo al canal verificado, con enlace de vencimiento
corto y registro de quién descargó.

**La primera mitad ya se cumple:** `/verificar/<…>` no entrega el PDF; solo
publica hechos del documento y ofrece comparar el archivo que uno ya tiene.

**La segunda mitad contradice a D-05.** Hoy los tres descargables —paquete
firmado, certificado y comprobante de pago— se bajan desde la pantalla de
confirmación con la sesión del flujo (`GET /api/p8/documento?codigo=…`), sin un
OTP adicional. Meter un OTP ahí le agrega fricción a alguien que acaba de
verificar identidad biométrica, firmar con OTP y pagar, en un producto cuyo
principio explícito es la mínima fricción.

Dónde **sí** tendría sentido: para una descarga **posterior**, desde fuera de
la sesión del flujo (la persona vuelve un mes después con el código en la
mano). Ese caso hoy no existe — no hay «mi cuenta» ni recuperación de
documentos —, así que la propuesta describe una funcionalidad que todavía no
está en el alcance, más que un arreglo de una que sí.

**Recomendación:** tratarlo como requerimiento nuevo («acceso posterior a mis
documentos»), no como cambio a la pantalla de confirmación. Cuando se abra,
`OtpProvider` y `EvidenceStore` ya tienen todo lo necesario.

---

## 6. Alcance nuevo: estados del documento y versionado (§7 y §8)

El documento pide que la página pública informe `SUSTITUIDA` y `ANULADO`, y que
una corrección genere V2 con token, QR y hash nuevos, dejando la versión
anterior marcada y enlazada.

**Lo que ya se cumple:**

- El modelo tiene `version` en cada documento, y el token **ya deriva de la
  versión**, así que una V2 produce un QR distinto por construcción.
- Cerrar un documento es inmutable: el archivo se guarda con la huella en la
  clave y nunca se reemplaza (§8 «no se permite reemplazarlo»).
- La cadena entre expedientes existe (`expedienteAnteriorId`, regla inviolable
  #11), aunque a nivel de **expediente**, no de documento.

**Lo que falta:** no hay estado `SUSTITUIDA`/`ANULADO` por documento, ni un
camino que genere una V2 del paquete. Hoy un expediente que necesita corrección
se reinicia desde la consola administrativa creando un expediente **nuevo**
enlazado al anterior, con su propio correlativo y sus propios documentos — un
diseño distinto del que propone el documento, pero que cumple la misma
intención (nada se reescribe, todo queda enlazado).

Nótese también que la página **declara explícitamente que verifica autenticidad
y no vigencia**, y eso es deliberado: afirmar «vigente» o «anulado» exigiría una
regla sobre qué le pasa a la cobertura cuando un cobro se revierte, y esa regla
no está decidida en ningún documento fuente.

**Recomendación:** si se quiere el versionado por documento, decidirlo primero
(¿reemplaza al reinicio por expediente o convive con él?) antes de modelarlo.

---

## 7. Equivalencias de nomenclatura (no son brechas)

| El documento dice | El repositorio usa | Comentario |
| :-- | :-- | :-- |
| `SLT-SOL-00018425-V1` | `PROP-00018425` + `VERSIÓN 1` en la caja del encabezado | Misma información, distinto formato. Cambiar el prefijo arrastraría a `FIPF-`, `CPC-` y `REC-`, a la matriz y a las evidencias ya guardadas. No se cambia |
| `DOCUMENTO_EN_PREPARACIÓN` | `DECLARACIONES_OK` (antes de cerrar el paquete) | La máquina de estados del expediente ya cubre el momento; el documento no tiene estado propio |
| `FIRMADO_ELECTRÓNICAMENTE_POR_CLIENTE` | `FIRMADO_CLIENTE` | Mismo estado, mismo significado (D-13) |
| «QR en la primera página» y «QR nuevamente en la página de evidencias» | QR en **todas** las páginas | `dibujarEncabezado` corre por página; cubre lo pedido y más |
| «Código visible en el pie de todas las páginas» | ✅ | `dibujarPie` imprime código, vinculado, versión y fecha de cierre |

---

## 8. Qué queda pendiente, ordenado

1. **Límite de tasa en `/verificar/[codigo]`** — L6. Sin esto, el camino del
   código tipeado sigue siendo enumerable. Es el complemento necesario del
   token, no un extra.
2. **`H_FINAL`** — junto con el adaptador oficial de `SignatureProvider`, y con
   el comparador de huella distinguiendo las tres huellas.
3. **Decisión de producto:** ¿datos enmascarados en la página pública? (§4).
   Hoy la respuesta implementada es «ninguno», con test que lo sostiene.
4. **Requerimiento nuevo:** acceso posterior a los documentos con OTP (§5).
5. **Decisión de producto:** versionado `SUSTITUIDA`/`ANULADO` por documento
   contra el reinicio por expediente que ya existe (§6).

---

## 9. Qué se tocó en esta sesión

| Archivo | Cambio |
| :-- | :-- |
| `src/domain/tipos.ts` | `tokenVerificacion: string \| null` en `DocumentoCerrado` y `CertificadoCobertura`. `null` para los documentos cerrados antes de esta sesión — no se reescriben (regla inviolable #10) |
| `src/domain/documentos.ts` | `TOKEN_VERIFICACION`, `partirTokenVerificacion`, `tokensIguales`; `urlDeVerificacion` pasa a recibir el token; `OpcionesContenido.tokenVerificacion` obligatorio y **sin valor por defecto**, para que no exista un camino que produzca un QR enumerable en silencio |
| `src/domain/certificado-cobertura.ts` | Ídem para el certificado |
| `src/documentos/servicio.ts` | `derivarTokenVerificacion`; el token se acuña con el correlativo y se persiste en la misma escritura que el documento |
| `src/domain/verificacion-documento.ts` | `interpretarEntrada` (token o código) y `documentoDelToken`, con comparación de tiempo constante |
| `src/app/verificar/[codigo]/page.tsx` | La ruta resuelve las dos formas. Un sufijo que no coincide responde igual que un correlativo inexistente |
| Tests | 18 nuevos (1119 → 1137), más una comprobación en el E2E del camino feliz |
