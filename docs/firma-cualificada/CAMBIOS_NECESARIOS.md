# Cambios necesarios para la firma cualificada con token F2

**Fecha:** 03-sep-2026
**Origen:** reunión técnica Alianza–Interseguros del 03-sep-2026 (Benjamín
Cámara y TI de Alianza, con Andres Alberdi). Notas y transcripción en
`docs/antecedentes/Reunión Técnica Alianza-Interseguros - 2026_09_03 - Notes by Gemini.pdf`.
**Continúa:** `README.md` de esta carpeta, que planteó las preguntas.

---

## 1. Lo que contó Alianza

| Hecho | Detalle | Marca |
| :-- | :-- | :-- |
| **Perfil** | Certificado **F2**, por token USB | 00:15:42 |
| **Emisor** | **Confirma**. Antes usaban Code100 y migraron: *«COD 100 cambió su tipo F2 (…) ahora utiliza unos chinos que tienen problemas a nivel nacional»* | 00:16-00:17 |
| **Montaje** | Un **firmador masivo comprado**, instalado en una **NUC dedicada** con el token conectado. Se ingresa la contraseña una vez | 00:15:42 |
| **Interfaz** | **Carpeta de entrada y carpeta de salida.** Una tarea programada corre **cada 30 segundos**, toma lo que haya, lo firma y lo deposita firmado | 00:18:30 |
| **Límite** | **Una firma por programa.** Para varias firmas hacen falta varias computadoras encadenadas, cada una con su token | 00:17:13 |
| **Costo** | El software de firma, **≈ 4 millones de guaraníes** | 00:19:49 |
| **Redundancia** | Varios firmadores **de distintas marcas** como plan A / B / C, misma arquitectura | 00:21:36 |
| **Vencimientos** | **Sin alertas internas.** Dependen del correo del emisor; la renovación exige que el emisor vaya a la oficina y entregue **un token USB nuevo** | 00:21:36 |
| **Sello de tiempo** | Consultado, quedó **sin confirmar**: la respuesta fue *«para el documento»*, sin precisar si el firmador incluye TSA | 00:19:49 |

Alianza además ofreció mostrar cómo hacen sus firmas **no cualificadas**, y
quedó en enviar **el formato y los campos** con que quieren recibir la
información para empezar las pruebas.

## 2. Una precisión que define el módulo

**Del token no se extrae la clave privada.** No es una limitación del software:
es lo que hace que el certificado sea F2. La clave se genera dentro del token y
no sale nunca (`DOC-ICPP-04`: F2 = *«claves en dispositivo cualificado»*;
Ley 6822/2021 art. 44.1). Un token del que se pudiera extraer la clave dejaría
de ser dispositivo cualificado, y la firma dejaría de ser cualificada.

Lo que el firmador **sí** hace, y es lo que se describió en la reunión, es:

1. abrir sesión contra el token con el PIN (**PKCS#11**),
2. **leer el certificado** — la parte pública, que sí sale,
3. mandarle al token **el hash** del documento y recibir **la firma** calculada
   adentro,
4. armar con eso la estructura PAdES y escribirla en el PDF.

Por eso el módulo se llama *firmador con token*, no *extractor*: el nombre
importa porque marca el límite entre lo que se puede diseñar y lo que
invalidaría el resultado.

## 3. Qué se confirma y qué se corrige del análisis del 02-sep

| Hipótesis del `README.md` | Resultado |
| :-- | :-- |
| Alianza usa un perfil con clave del titular (F2/S2) | **Confirmado.** F2, token USB |
| «Sin proveedor» significa sin proveedor **en el camino crítico** | **Confirmado.** El PSC sigue existiendo — les emite el certificado — pero no interviene en cada firma |
| Hay que averiguar si podemos homologar un HSM propio ante el MIC | **Ya no hace falta.** El dispositivo cualificado es el token que entrega el PSC, homologado por él. Nuestro software no necesita certificación: la norma homologa el dispositivo, no el programa que lo invoca |
| AWS KMS / CloudHSM como dispositivo | **Descartado para firma cualificada**, no por incumplir FIPS sino porque el camino del token lo vuelve innecesario. KMS sigue en pie para la firma **no** cualificada del cliente |
| La firma desatendida tensiona el control exclusivo del art. 44.1 | **Sin resolver, y Alianza tampoco lo resuelve**: ingresan el PIN una vez y el proceso queda corriendo. Lo asumen. Es una decisión que Interseguros tiene que tomar con dictamen, no heredar |

Y aparece un dato que no teníamos: **Alianza migró de Code100 por la calidad de
su F2**. Es un juicio de ellos, no un hecho verificado, pero es información
directa de un cliente del proveedor y pesa en la decisión pendiente.

## 4. El problema nuevo: la latencia contra D-08

Es la consecuencia más importante de la reunión, y no estaba en el análisis.

Con **D-08** la firma ocurre **antes del pago**: el expediente queda en
`FIRMADO_CLIENTE` con el cobro inhabilitado hasta que se apliquen las
institucionales y pase a `FIRMADO`. Hoy eso es instantáneo porque las
institucionales son simuladas (`firma-p8.ts`, certificados `DEMO-CERT-…`).

Con un firmador por carpetas, deja de serlo:

- **Nuestra firma** (Interseguros, token propio): una tarea cada 30 s ⇒
  0-30 s de espera, más el tiempo de firmar.
- **La firma de Alianza**: su token está en **su** CPD, no en el nuestro. Hay
  un salto entre organizaciones — depositar el documento, que su tarea lo tome,
  que nos lo devuelvan. Ese es exactamente el intercambio cuyo formato Cámara
  quedó en enviar.

O sea: **entre que el cliente firma y puede pagar pueden pasar decenas de
segundos, o más si Alianza responde en diferido**, con la persona esperando en
pantalla. Tres salidas, y la elección es de producto:

| | Qué implica | Costo |
| :-- | :-- | :-- |
| **(a) Esperar en pantalla** | P8 sondea hasta `FIRMADO` y recién ahí habilita el pago. Reusa el patrón de sondeo que ya existe | Conversión: decenas de segundos de espera en el peor momento del embudo |
| **(b) Desacoplar** | La firma del cliente habilita el cobro; las institucionales se aplican en diferido por cola | **Toca la regla inviolable 6-bis** («no hay cobro sin firma», único origen `FIRMADO`) y hay que redefinir qué significa `FIRMADO`. Decisión con consecuencia legal |
| **(c) Solo Interseguros en línea** | Se espera la firma del corredor —que es la que la Res. 210/2025 art. 5 exige— y la de Alianza se aplica en diferido | Intermedia. Requiere revisar D-13, que hoy pone a Alianza como `CONJUNTO` sobre el paquete |

La (c) tiene a favor que la **firma de Alianza sobre la Solicitud y el FIPF no
es una exigencia normativa** — ya está anotado en `VALIDACION_LEGAL_FIRMA_INTERNA.md`
§3: lo que la norma le exige a la aseguradora es firmar la póliza. Es la pieza
que puede moverse sin tocar cumplimiento.

## 5. El módulo firmador

### Qué es

Un componente que corre **junto al token**, no en Amplify: una función SSR no
puede ver un USB. Es un servicio chico en una máquina dedicada — la misma
receta de la NUC de Alianza — con esta responsabilidad y ninguna otra:

```
documento cerrado + hash  →  [PKCS#11 · token F2]  →  PDF con firma PAdES
```

### Qué hace

1. Abre la sesión PKCS#11 contra el token con el PIN.
2. Lee el certificado y **verifica que sea el esperado**: titular, vigencia,
   emisor. Un token cambiado por renovación no debe pasar inadvertido.
3. Calcula el `ByteRange`, arma el CMS/PKCS#7 *detached*, le pide al token la
   firma del hash y escribe la **actualización incremental** del PDF, de modo
   que las firmas anteriores sigan siendo válidas.
4. Pide el sello de tiempo a la TSA (RFC 3161) y lo incorpora ⇒ **PAdES-T**.
5. Devuelve el PDF firmado, su nueva huella y los datos del certificado usado.

### Qué NO hace

- **No extrae la clave** (§2), y hay que dejarlo escrito en el código.
- **No decide** quién firma ni en qué orden: eso ya vive en
  `firmantes-documento.ts` (D-13) y sigue ahí.
- **No guarda el PDF**: la custodia entre firmas es de `ArchivoRepository`.
- **No cierra ni hashea documentos**: eso es de `src/documentos/`, y la regla
  inviolable #4 exige que el documento llegue ya cerrado.

### Construirlo o comprarlo

El firmador de Alianza cuesta ≈ 4 M Gs y trae el límite de **una firma por
programa**, que a ellos les obliga a encadenar computadoras. A nosotros nos
haría falta **una sola** firma propia (la de Interseguros), así que ese límite
casi no nos pesa y comprar es una salida legítima y rápida.

A favor de construirlo: elimina el encadenamiento si algún día hacen falta dos
firmas nuestras, evita las carpetas como interfaz —que no dejan trazabilidad ni
acuse— y encaja en la arquitectura de puertos en vez de convivir con ella. En
contra: **PAdES incremental es trabajo real** (ByteRange, CMS, DSS), bastante
más que el generador de PDF propio que ya tenemos.

**Recomendación:** decidirlo recién después de ver el formato que mande Cámara,
porque si el intercambio con Alianza va a ser por carpetas de todos modos, la
ventaja del módulo propio se reduce a la mitad.

## 6. Cambios por capa

| Capa | Qué cambia |
| :-- | :-- |
| **Puerto** | `SignatureProvider` deja de modelar el acto del cliente —canal, destino, enlace, sondeo del proveedor— y pasa a modelar **la aplicación de una firma institucional sobre un PDF**: entra documento cerrado, sale documento firmado y su huella. Lo anticipaba `ANALISIS_MODELO_DE_FIRMA.md` §3; ahora hay contrato concreto que escribir |
| **Dominio** | `firma-p8.ts` deja de fabricar `FirmaInstitucional` con `DEMO-CERT-…` y pasa a pedirlas al puerto, una por vez y **en serie**. Hace falta el desenlace para «se aplicó una y falló la otra»: hoy `FIRMADO_CLIENTE` lo cubre a medias |
| **Adaptadores** | Nuevo adaptador del firmador (token o servicio local). El mock se mantiene y debe simular **la latencia**, no solo el resultado: si el mock responde instantáneo, el problema del §4 no se ve hasta producción |
| **Infraestructura** | Aparece un componente **on-premise** que hoy no existe: máquina dedicada, token, y cómo le llegan los documentos desde Amplify (S3 + agente, cola, o carpeta compartida). Custodia física del token y del PIN |
| **Evidencia** | Cada firma institucional deja certificado real, sello de tiempo y huella resultante. Los `DEMO-CERT-…` desaparecen del camino live |
| **Documentos fuente** | `CLAUDE.md` §*Contrato oficial de `SignatureProvider`* describe los cuatro endpoints de Code100 como el contrato de las institucionales: deja de ser cierto si se va por token. `ESPECIFICACION_PANTALLAS.md` P8 cambia si se elige (a) |
| **Catálogo** | **Confirma** entra en `docs/Tabla de Integraciones externas - Tabla.csv` antes de escribir una línea, junto con el firmador y la TSA. Es regla de `CLAUDE.md`, no preferencia |

## 7. Lo que hay que decidir

1. **Qué pasa con la espera del §4** — producto, con Rodrigo. Es lo que
   bloquea el diseño de P8 y toca la regla 6-bis si se elige (b).
2. **Comprar o construir el firmador** (§5), después de ver el formato de
   Alianza.
3. **Si la firma de Alianza sobre el paquete se conserva** (D-13) o se limita a
   la póliza, que es lo único que la norma le exige.
4. **PIN desatendido**: quién lo custodia, cómo se repone tras un corte, y con
   qué dictamen se sostiene el control exclusivo del art. 44.1.
5. **Code100**: con Alianza migrando por calidad del F2, hay que decidir si
   sigue siendo la primera opción para el certificado de Interseguros.

## 8. Lo que hay que pedir

| A quién | Qué |
| :-- | :-- |
| **Alianza** | El formato y los campos del intercambio (ya prometido por Cámara); si su firmador incluye TSA; marca del firmador y de los planes B/C |
| **Confirma** | F2 a nombre del agente autorizado de Interseguros (Res. 205/2025); costo, plazo y renovación; si su firmador tiene modo servicio además de carpetas |
| **Legal** | Dictamen sobre el PIN desatendido y sobre el punto 3 |

Las consultas al MIC que pedía el `README.md` §7 —lista de dispositivos
certificados y formulario FOR-ICPP-06— **dejan de ser bloqueantes**: sirven
solo si se vuelve a la idea del HSM propio.
