# Cambios necesarios para la firma cualificada con token F2

**Fecha:** 03-sep-2026 · **actualizado el 04-sep-2026** con el análisis legal de
Rodrigo y las decisiones de Andres de ese día (§4).
**Origen:** reunión técnica Alianza–Interseguros del 03-sep-2026 (Benjamín
Cámara y TI de Alianza, con Andres Alberdi). Notas y transcripción en
`docs/antecedentes/Reunión Técnica Alianza-Interseguros - 2026_09_03 - Notes by Gemini.pdf`;
análisis legal del CPC en [`ANALISIS_LEGAL_CPC_2026-09-03.md`](ANALISIS_LEGAL_CPC_2026-09-03.md).
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
| El firmador por carpetas mete decenas de segundos entre la firma del cliente y el pago | **Resuelto por la norma, no por ingeniería** (§4): la firma de Interseguros va **después** del pago |

Y aparece un dato que no teníamos: **Alianza migró de Code100 por la calidad de
su F2**. Es un juicio de ellos, no un hecho verificado, pero es información
directa de un cliente del proveedor y pesa en la decisión pendiente.

## 4. La secuencia legal, y las tres decisiones del 04-sep-2026

El análisis de Rodrigo (matriz *«Firmas, actos, respaldo jurídico y plazos»* y
el memo del CPC del 03-sep) fija el orden. Se transcribe porque la matriz
llegó como imagen y este repositorio necesita poder citarla:

| N.º | Acto / documento | Responsable | Firma o respaldo | Momento / plazo | Respaldo jurídico | Resultado |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Firma de la Solicitud + FIPF | Cliente / proponente | Firma electrónica simple de SeguroLoTengo: OTP, identidad, fecha, hora, IP, hash e integridad | Antes de la aceptación y del CPC | Res. 210/2025 arts. 4, 6 y 9 | **Obligatorio** |
| 2 | Confirmación del pago del premio | Cliente · Bancard · Alianza | Registro electrónico de la operación y referencia Bancard | Inmediato, al aprobarse el pago | Código Civil arts. 1573 y 1574 | **Habilita CPC** |
| 3 | Emisión del Certificado de Cobertura Provisional | **Alianza Garantía** | Firma electrónica cualificada del suscriptor autorizado, con el proveedor propio de Alianza | Inmediatamente después del pago | Código Civil art. 1573; Res. 231/2025 Anexo I arts. 1 y 2; Res. 215/17 art. 7º y numeral 10 | **Permitido** |
| 4 | Firma de Interseguros sobre Solicitud + FIPF | Interseguros S.A. · Rodrigo Fernández Echazú | Firma electrónica cualificada sobre el mismo PDF cerrado | **Dentro de 24/48 h y antes de la póliza definitiva.** Plazo operativo acordado con Alianza | Res. 210/2025 arts. 5 y 9; Ley 827/96 art. 76; Res. 205/2025 art. 2; Res. 215/17 num. 11.15 | **Obligatorio** |
| 5 | Verificación y archivo del FIPF | Alianza, como sujeto obligado | Verificación documental y constancia electrónica. **No exige firma institucional de Alianza en el FIPF** | Durante el procesamiento, según el procedimiento ALA/CFT | Res. SEPRELAD 71/2019 arts. 25, 26, 27 y 53 | **Obligatorio** |
| 6 | Emisión de póliza y factura en SEBAOT | Alianza Garantía | Póliza: firma cualificada del suscriptor autorizado. Factura: emisión de Alianza | Dentro de 24/48 h, según plazo operativo de Alianza | Código Civil art. 1555; Res. 231/2025 arts. 2 a 6; Res. 215/17 art. 14º | **Obligatorio** |
| 7 | Entrega y acceso del cliente | SeguroLoTengo y Alianza | CPC; Solicitud + FIPF finales; póliza y factura por canales verificados | CPC tras el pago; documentos finales cuando sean emitidos y firmados | Ley 4868/2013 arts. 7.c y 28.b; Res. 210/2025 art. 9; Código Civil art. 1558 | **Disponible** |

> **Conclusión de la matriz:** el CPC puede emitirse después del pago y antes
> de la firma cualificada de Interseguros. **El plazo de 24/48 h es operativo,
> no legal**: la normativa exige las firmas y su trazabilidad, no un plazo, ni
> condiciona el CPC a la firma previa del corredor. Debe quedar documentado en
> el procedimiento aprobado por Alianza (Res. 210/2025 art. 10).

**Lo que la matriz fijaba «mediante Code100» no es exigencia**: la norma pide
firma cualificada del corredor, no un proveedor, y Alianza ya migró (§1).

### Las tres decisiones (Andres, 04-sep-2026)

| Decisión | Qué cambia | Respaldo | Registro |
| :-- | :-- | :-- | :-- |
| **6-bis re-baseada** | El cobro se habilita con la firma **del cliente** (`FIRMADO_CLIENTE`); la firma cualificada de Interseguros se aplica **después**, dentro de 24/48 h. `FIRMADO` queda entre el pago y la emisión | Res. 210/2025 arts. 4 y 5; Res. 215/17 num. 11.15 (*«Firma del Agente / Corredor de Seguros, o del Proponente»*) | D-08 modificada |
| **D-12** | El CPC **lo emite y firma solo Alianza** desde su sistema. SeguroLoTengo deja de generarlo; el **comprobante de pago (D-05)** cubre la entrega inmediata | Res. 231/2025 Anexo I arts. 1-2; Res. 215/17 art. 7º y num. 10; CC art. 1573 | D-12 modificada |
| **D-13** | **Alianza no firma** la Solicitud ni el FIPF. Firmantes del paquete: cliente + Interseguros | Res. 215/17 num. 11.15; Matriz V4 §7 (tenía razón) | D-13 modificada; ALR-07 cerrada |

Lo que esto resuelve de un golpe: **la latencia del firmador por token deja de
importar**, porque ya no hay nadie esperando en pantalla a que Interseguros
firme. Y es exactamente lo que hace viable el prototipo con firma manual de
Rodrigo (§9): un proceso con un humano adentro solo funciona fuera del camino
crítico de la venta.

**Cautela sobre citas.** De las normas de la matriz, están en `docs/normativa/`
la 210/2025, la 231/2025, la 215/17 y la Ley 6822/2021. **No están** el Código
Civil (parte de seguros), la Ley 827/96, la Res. 205/2025, la Res. SEPRELAD
71/2019, la Ley 4868/2013 ni la Res. SS.SG. 012/12 (identificación del corredor
con nombre, matrícula y teléfono). Hasta que entren, esas citas son de segunda
mano y así hay que declararlas.

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
   que la firma anterior (la del cliente, si es criptográfica) siga válida.
4. Pide el sello de tiempo a la TSA (RFC 3161) y lo incorpora ⇒ **PAdES-T**.
5. Devuelve el PDF firmado, su nueva huella y los datos del certificado usado.

### Qué NO hace

- **No extrae la clave** (§2), y hay que dejarlo escrito en el código.
- **No decide** quién firma ni en qué orden: eso ya vive en
  `firmantes-documento.ts` (D-13) y sigue ahí.
- **No guarda el PDF**: la custodia es de `ArchivoRepository`.
- **No cierra ni hashea documentos**: eso es de `src/documentos/`, y la regla
  inviolable #4 exige que el documento llegue ya cerrado.

### Construirlo o comprarlo

El firmador de Alianza cuesta ≈ 4 M Gs y trae el límite de **una firma por
programa**. A nosotros nos hace falta **una sola** firma propia (la de
Interseguros), así que ese límite casi no pesa y comprar es una salida legítima
y rápida. A favor de construirlo: evita las carpetas como interfaz —que no
dejan trazabilidad ni acuse— y encaja en la arquitectura de puertos. En contra:
**PAdES incremental es trabajo real** (ByteRange, CMS, DSS).

**Recomendación:** decidirlo después de ver el formato que mande Cámara. Con la
firma fuera del camino crítico (§4) la urgencia bajó: el prototipo manual (§9)
cubre la salida.

## 6. Cambios por capa

| Capa | Qué cambia |
| :-- | :-- |
| **Máquina de estados** (`expediente.ts`) | El cobro se abre desde `FIRMADO_CLIENTE`, no desde `FIRMADO`. `FIRMADO` (institucional) pasa a vivir **entre** `PAGO_CONFIRMADO` y `EMITIDO`, y admite quedar pendiente 24/48 h sin frenar nada. `VENCIDO` = firmado por el cliente y no pagado. Es la regla 6-bis re-baseada: se reescribe en `CLAUDE.md` cuando se implemente, no antes |
| **Pago** (`confirmarPagoP7`, `registrarPagoConfirmadoP7`) | Dejan de cerrar y asentar el CPC: la emisión del certificado **sale** de la transición del pago (D-12). Desaparece `DependenciasP7.emitirCertificado` y el desenlace `CERTIFICADO_NO_EMITIDO` |
| **Documentos** (`certificado-cobertura.ts`, `plantillas.ts`, `servicio.ts`) | El CPC deja de ser documento del motor. Se conserva el comprobante de pago (D-05). La clave `CPC-…` en S3 y `/verificar/<código>` para el CPC pierden objeto; los expedientes que ya lo tienen no se reescriben (regla #10) |
| **Firmantes** (`firmantes-documento.ts`) | `PAQUETE`: cliente + Interseguros. Sale `ALIANZA` del paquete y sale `CPC` de `DocumentoFirmable`. Los dos invariantes con test (cliente primero y simple; institucional cualificada) siguen valiendo |
| **Puerto** | `SignatureProvider` pasa a modelar **la aplicación de una firma institucional sobre un PDF cerrado**, sin canal, destino, enlace ni sondeo del proveedor; con `origen` de la firma y certificado real en la evidencia |
| **Adaptadores** | Adaptador del firmador (token o consola, §9) y adaptador **SFTP a Alianza** para el lote de documentos firmados. El mock debe simular **la latencia**, no solo el resultado |
| **Infraestructura** | Componente **on-premise** nuevo: máquina dedicada + token, y cómo le llegan los documentos desde Amplify. Custodia física del token y del PIN |
| **Pantalla de confirmación** (P9) | Descargables inmediatos: paquete firmado por el cliente y comprobante de pago. El CPC y la póliza pasan a «en emisión por Alianza · llega por tus canales». La firma de Interseguros no la espera el cliente |
| **Entrega y remisión** (CHG-44, CHG-47) | La remisión a Alianza se convierte en el **lote SFTP** de paquetes firmados (§9); el CPC vuelve de Alianza y se entrega por los canales verificados con acuse |
| **Documentos fuente** | `CLAUDE.md` (6-bis, máquina de estados, sección del CPC, «tres descargables», contrato de `SignatureProvider`), `ESPECIFICACION_PANTALLAS.md` (paso 3 y confirmación), `Tabla Cumplimiento` (filas 44 y 47, CMP-07), `PLAN_DE_CAMBIOS_v2.md` (L5a/L5b) |
| **Catálogo de integraciones** | **Confirma**, la consola firmadora y el SFTP de Alianza entran en `docs/Tabla de Integraciones externas - Tabla.csv` **antes** de escribir una línea |

## 7. Lo que queda por decidir

1. **Comprar o construir el firmador** (§5), después de ver el formato de Alianza.
2. **PIN desatendido**: quién lo custodia, cómo se repone tras un corte, y con
   qué dictamen se sostiene el control exclusivo del art. 44.1.
3. **Code100 o Confirma** para el certificado F2 de Interseguros, con lo que
   contó Alianza en la mesa.
4. **Sello de tiempo**: si el firmador no lo trae, qué TSA cualificada se
   contrata (`DOC-ICPP-25/26`).

Decididas el 04-sep-2026: la espera del §4 (desaparece), la firma de Alianza
sobre el paquete (no va) y el CPC (lo emite Alianza).

## 8. Lo que hay que pedir

| A quién | Qué |
| :-- | :-- |
| **Alianza** | El formato y los campos del intercambio (ya prometido por Cámara); el formato del **lote SFTP** y su acuse; si su firmador incluye TSA; cómo devuelven el CPC |
| **Confirma / Code100** | F2 a nombre del agente autorizado de Interseguros (Res. 205/2025); costo, plazo y renovación; si su firmador tiene modo servicio además de carpetas |
| **Legal** | Dictamen sobre el PIN desatendido |

Las consultas al MIC que pedía el `README.md` §7 dejan de ser bloqueantes.

## 9. La consola firmadora y el piloto (recomendaciones del 04-sep-2026)

Andres está creando un **proyecto separado, multi-cliente**, del que
SeguroLoTengo es el primer cliente. Piloto: una miniPC en Santa Cruz (Bolivia)
con un token de Code100, para ver si responde. Antes, un **prototipo** en el
que Rodrigo firma a mano con su herramienta actual: una consola donde descarga
los PDF, los firma afuera, los vuelve a cargar, y el sistema los deposita por
**SFTP a Alianza en bloque**.

**Encaja con §4:** la firma manual solo es viable porque la firma del corredor
salió del camino crítico. Sostenerla exige un techo explícito de volumen.

**Va aparte.** Repo y directorio propios; acá entra por el puerto de firma con
su adaptador, como cualquier integración. Multi-cliente desde el modelo de datos
(aislamiento entre clientes), pero alcance mínimo en el prototipo.

**Lo no negociable: la validación en la carga.** Un humano baja un PDF y sube
otro. La consola rechaza salvo que se cumpla **todo** esto:

1. **Mismo documento.** Una firma PAdES se aplica como actualización
   incremental: el PDF firmado **conserva byte a byte** el original al
   principio y solo agrega al final. Verificar que el archivo subido tenga
   como **prefijo exacto** el que se entregó. Barato, y detecta sustitución,
   recompaginación o regeneración — el error humano más probable.
2. **Firma sobre todo el archivo:** el `/ByteRange` cubre de 0 al final, con el
   único hueco de `/Contents`.
3. **Certificado esperado:** titular (el agente autorizado, Res. 205/2025),
   emisor, vigencia al sello de tiempo, perfil F2. Se guarda en la evidencia.
4. **Firma y sello de tiempo válidos** criptográficamente.
5. **Nada nuevo** fuera de la firma: ni páginas ni anotaciones.

Cada rechazo con motivo accionable; cada descarga y cada carga con quién,
cuándo y resultado, append-only (regla #10). Los PDF llevan declaraciones de
salud: cifrado, acceso por identidad y regla #7.

**El lote SFTP a Alianza:** idempotencia por nombre derivado de `PROP-<correlativo>`
(nunca por marca de tiempo); **manifiesto** por lote con cantidad y huellas
para que acusen; política explícita de reintento y de lote duplicado; clave
SSH en un secreto, no contraseña ni repositorio. El formato lo manda Cámara:
**no se inventa antes.**

**Advertencia sobre el piloto en Bolivia.** El token de un firmante paraguayo en
una miniPC en Santa Cruz debilita el **control exclusivo del titular** (art.
44.1) más que en la oficina: el titular no puede ni verlo, y con el PIN cargado
un argumento ya frágil se vuelve difícil de sostener. Separar: para el **piloto
técnico** (¿responde el token por PKCS#11?) la ubicación es irrelevante — usar
**un certificado de prueba, no el de Rodrigo**. Para producción, la máquina con
el token del corredor donde está el corredor, con control de acceso físico
documentado. Y tener a **Confirma como plan B** desde el arranque, por lo que
contó Alianza del F2 de Code100.
