# Firma electrónica cualificada — carpeta de trabajo

**Abierta:** 02-sep-2026
**Motivo:** hay que resolver las firmas cualificadas institucionales **con o sin
Code100**. La decisión está en evaluación, y **Alianza Garantía informó que ya
lo resolvió sin usar Code100 ni otro proveedor de firma**; la explicación llega
en la reunión del 03-sep-2026 (§6 tiene las preguntas para esa reunión).

Esta carpeta reúne, por primera vez en el repositorio, **los textos oficiales
que gobiernan la firma cualificada en Paraguay**. Hasta ahora el proyecto los
citaba de fuentes secundarias: `docs/normativa/INDICE.md` §2 los listaba como
faltantes de prioridad A.

> **Alcance.** Acá se analiza únicamente la **firma cualificada**. La firma del
> cliente es no cualificada, está decidida (D1, 30-ago-2026) e implementada en
> `src/domain/firma-cliente.ts`; nada de este documento la toca.

---

## 1. Respuesta corta

Hay tres cosas distintas que suelen llamarse igual, y solo la del medio está
realmente en discusión:

| | Qué sería | Veredicto |
| :-- | :-- | :-- |
| **Emitir certificados** cualificados propios | Ser Prestador **Cualificado** de Servicios de Confianza (PCSC) | **Descartado.** Evaluación de conformidad, lista de confianza, seguro de 500 salarios mínimos, conservación 10 años, auditorías. Para uso propio no se amortiza |
| **Aplicar** firmas cualificadas desde infraestructura propia, con certificado comprado a un PCSC | Certificado F2 o sello S2, clave en un HSM nuestro | **Viable en la norma, con dos condiciones duras.** Es, casi con certeza, lo que hace Alianza |
| **Delegar** la firma en el PCSC | Certificado F3/S3, clave en el HSM del prestador, firma por API | Es lo que ofrece Code100 hoy (Api Flow) |

Las dos condiciones duras del camino del medio: **el HSM tiene que estar
certificado por el MIC**, y **la clave privada de un certificado de persona
física queda bajo control exclusivo de esa persona** (Ley 6822/2021 art. 44).

## 2. Lo que fija la norma

La firma electrónica cualificada exige **dos** cosas a la vez (Ley 6822/2021,
art. 4 num. 27): que se cree **mediante un dispositivo cualificado de creación
de firma** *y* que se base en **un certificado cualificado**. Solo ella tiene
efecto equivalente a la firma manuscrita (art. 39.2). El sello electrónico
cualificado (art. 50.2) garantiza origen e integridad — no equivale a firma
manuscrita.

La ICPP define seis perfiles. La tabla sale de `DOC-ICPP-04` (Anexo de la
Res. MIC N.º 811/2022, ítems 1.1 y 6.1.1-6.1.2) y de `DOC-ICPP-06` §4
(Res. N.º 1547/2023):

| Perfil | Medio de almacenamiento de la clave | Quién la custodia | Estándar mínimo |
| :-- | :-- | :-- | :-- |
| **F1 / S1** | Smart card o token **sin** generación de claves, **o un repositorio cifrado por software** | El titular | FIPS 140-1 o 140-2 (nivel 1-2) |
| **F2 / S2** | Smart card o token **con** generación de claves, **o HSM** | **El titular.** «Las claves privadas relacionadas a los certificados del tipo F1, F2, S1, S2 **no podrán ser generadas ni gestionadas por los PCSC**» | **FIPS 140-2 nivel 3**, «certificado por el MIC» |
| **F3 / S3** | HSM «**gestionado y custodiado por un PCSC**» | El prestador | FIPS 140-2 nivel 3, certificado por el MIC |

El propio texto del certificado nombra la diferencia: F1 lleva impreso
*«claves en módulo software»*, F2 *«claves en dispositivo cualificado»* y F3
*«claves en dispositivo cualificado centralizado»* (`DOC-ICPP-04`, ítem 7).

**Consecuencia que decide la pregunta del PKCS#12:** un archivo de claves es
el perfil F1/S1, y la ICPP lo clasifica explícitamente como *módulo software*,
no como dispositivo cualificado. Da un **certificado** cualificado, pero no una
**firma** cualificada en los términos del art. 4 num. 27. Coincide con el
art. 44.1, que exige que los datos de creación puedan ser protegidos por el
firmante «frente a su utilización por otros»: un archivo copiable no lo cumple.

## 3. Sobre AWS KMS y CloudHSM

**El estándar no es el obstáculo.** `DOC-ICPP-06` §4 ancla los requisitos de
hardware en **FIPS 140-2 nivel 3** para F2/F3/S2/S3 y no menciona Common
Criteria ni los perfiles de protección europeos EN 419221-5 / EN 419241-2. AWS
KMS está validado en **FIPS 140-3 nivel 3** desde feb-2025 y CloudHSM
`hsm2m.medium` desde ago-2024: cumplen o exceden el nivel exigido.

**El obstáculo es la homologación.** El requisito de `DOC-ICPP-06` no es solo
el nivel FIPS sino «**Certificado por el MIC**», y ese trámite existe:
*Certificación de dispositivos cualificados de creación de firma y/o sello
electrónico* (`DOC-ICPP-22`, Res. N.º 1390/2022; formulario FOR-ICPP-06;
20 jornales mínimos; 30 días hábiles; validez 3 años).

Ahí hay una **ambigüedad que conviene resolver antes de invertir**: la ficha
publicada del trámite declara como *beneficiarios* a los «Prestadores
Cualificados de Servicios de Confianza», pero el procedimiento aprobado
(`DOC-ICPP-22` §II) **no repite esa restricción**: pide cédula del solicitante
o representante legal, instrumento de constitución, acreditación de la
representación y documentación de cumplimiento del `DOC-ICPP-06`. Si el trámite
admite solicitante no PCSC, la puerta del camino B se abre sola; si no, hay que
entrar de la mano de un PCSC.

Queda además una pregunta de hecho que ninguna norma responde: **si algún
dispositivo de nube figura ya entre los certificados por el MIC**. Esa lista no
está publicada — hay que pedirla a la DGCE (§7).

## 4. Las tres arquitecturas, comparadas

| | **A · F3/S3 remoto** | **B · F2/S2 con HSM propio** | **C · ser PCSC** |
| :-- | :-- | :-- | :-- |
| Dónde vive la clave | HSM del PCSC | HSM nuestro, certificado por el MIC | Nuestro |
| Proveedor en el camino crítico de cada venta | **Sí** | **No** | No |
| Qué se le compra al PCSC | El servicio, por firma | El certificado, y se renueva | Nada |
| Trabajo propio | Adaptador del API | Constructor PAdES + TSA + custodia | Todo, más el régimen regulatorio |
| Estado | Es lo que Code100 ofrece hoy | **A confirmar con Alianza y con un PCSC** | Descartado |

El camino B **no elimina al prestador**: sigue haciendo falta que un PCSC emita
el certificado. Lo que elimina es su intervención **en cada firma**, que es
justamente el problema operativo que el proyecto tiene abierto (consulta C21,
sin responder desde el 20-ago-2026).

## 5. El techo que ninguna arquitectura evita

Aunque la arquitectura se resuelva, la SIS pide firmas **de personas
nominadas**, no de la empresa:

- **Res. SS.SG. 210/2025 art. 5:** la propuesta intermediada debe llevar la
  firma electrónica cualificada **del agente o corredor** (por Res. 205/2025,
  el agente autorizado de Interseguros).
- **Res. SS.SG. 231/2025 art. 2:** Alianza debe comunicar a la SIS la **nómina
  de firmantes**, con el certificado cualificado vigente **de cada uno**.

Un sello electrónico de persona jurídica (S2/S3) no sustituye eso, y
automatizar la clave de una persona tensiona el control exclusivo del art. 44.1
— **con Code100 o sin Code100**. Es el mismo problema, movido de lugar.

## 6. Preguntas para la reunión con Alianza (03-sep-2026)

> ## ✅ Reunión realizada — respondidas el 03-sep-2026
>
> **El análisis de las respuestas y de lo que hay que cambiar está en
> [`CAMBIOS_NECESARIOS.md`](CAMBIOS_NECESARIOS.md).** En una línea: Alianza usa
> un certificado **F2 por token USB** de **Confirma**, con un firmador masivo
> comprado que corre en una NUC dedicada y trabaja por **carpeta de entrada y
> carpeta de salida cada 30 segundos**.
>
> Quedaron respondidas las preguntas 1 a 5, 8, 9 y 10; **sin responder la 6**
> (cómo sostienen el control exclusivo con el PIN cargado: no tienen dictamen,
> lo asumen) y **sin confirmar la 7** (si el firmador incluye TSA).
>
> Lo que sigue abajo se conserva como registro de lo que se preguntó.

El objetivo era identificar **cuál de los seis perfiles** usan y **cómo
resuelven el control exclusivo**. Con las respuestas 1 a 4 ya se sabe si su
solución es trasladable a Interseguros.

1. ¿Qué tipo de certificado usan: **F1, F2, F3, S1, S2 o S3**? (Aparece impreso
   en el propio certificado, como `OU = FIRMA F2` o `SELLO ELECTRÓNICO`.)
2. ¿Es un certificado de **firma de una persona física** o un **sello
   electrónico de la persona jurídica**? Si es sello: ¿cómo cubren la exigencia
   de la Res. 231/2025 art. 2, que pide nómina de firmantes con certificado de
   cada uno?
3. ¿Dónde vive la clave privada: token, HSM propio, HSM del prestador?
   ¿Qué marca y modelo de HSM, y **está certificado por el MIC**?
4. ¿Qué PCSC les emitió el certificado, y **aceptó emitirlo contra una clave
   generada en un dispositivo suyo**? ¿Qué les exigió para eso?
5. La firma, ¿es **desatendida** (el sistema firma sin intervención humana por
   documento) o hay una persona autorizando por lote / por documento?
6. Si es desatendida: ¿cómo documentan el **control exclusivo del titular**
   (art. 44.1 de la Ley 6822/2021)? ¿Tienen dictamen legal o consulta escrita
   al MIC sobre ese punto?
7. ¿Qué nivel PAdES producen (B, T, LT, LTA) y **de dónde sacan el sello de
   tiempo**? ¿Contrataron una TSA cualificada, y a quién?
8. ¿Qué software aplica la firma: desarrollo propio, biblioteca, producto?
9. ¿Cuánto costó y cuánto tardó **conseguir el certificado**, y cuál es el
   costo de renovación?
10. ¿Lo usan ya para **pólizas electrónicas** bajo la Res. 231/2025, y
    completaron la comunicación previa a la SIS con 10 días hábiles?

## 7. Qué falta averiguar

| Pendiente | A quién | Por qué importa |
| :-- | :-- | :-- |
| ~~Lista de **dispositivos certificados por el MIC**~~ | DGCE | **Ya no bloquea:** el dispositivo cualificado es el token que entrega el PSC. Solo hace falta si se vuelve a la idea del HSM propio |
| ~~Si el trámite `DOC-ICPP-22` admite **solicitante no PCSC**~~ | DGCE | **Ya no bloquea**, por lo mismo |
| ~~Formulario **FOR-ICPP-06**~~ | DGCE | **Ya no bloquea**, por lo mismo |
| ~~Si algún PCSC emite **F2/S2 contra clave del cliente**~~ | — | **Respondido por los hechos:** Confirma le emitió el F2 a Alianza y la clave vive en su token |
| **Dictamen legal sobre control exclusivo en firma automatizada** | Legal | **Sigue abierto, y es el único que no se movió.** Alianza tampoco lo resolvió: cargan el PIN y asumen |
| ~~Cómo lo resolvió **Alianza**~~ | — | **Respondido** el 03-sep: ver [`CAMBIOS_NECESARIOS.md`](CAMBIOS_NECESARIOS.md) §1 |

## 8. Contenido de la carpeta

- `referencias/INDICE.md` — **catálogo** de los 21 documentos oficiales de la
  ICPP en que se apoya este análisis: qué es cada uno, de dónde se baja, su
  SHA-256 y la receta de descarga. Los PDF **no se versionan** (decisión del
  02-sep-2026: son ~19 MB de consulta ocasional); una copia local en esa
  carpeta queda ignorada por git.
- La **Ley 6822/2021** y el **Decreto 7576/2022** sí están en el repositorio,
  en `docs/normativa/` (`ley-6822-2021.pdf`, `decreto-7576-2022.pdf`): son las
  que este documento cita, y la regla de `CLAUDE.md` es que una norma entra
  antes de citarse. Se descargaron en esta misma sesión.

## 9. Relación con lo que ya está escrito

- `docs/ANALISIS_MODELO_DE_FIRMA.md` §1 plantea, para la firma **del cliente**,
  la variante «(a) firma criptográfica propia» con clave en KMS. Nada de este
  documento la contradice: esa firma es **no cualificada** y no necesita
  dispositivo homologado. Lo que este documento agrega es que ese mismo montaje
  **no se convierte en cualificado** por cambiar el certificado.
- `docs/PLAN_ACCION_CODE100.md` §7 y la consulta C21 quedan enmarcados: la
  firma desatendida no es una carencia del producto de Code100, es una tensión
  de la norma.
- `docs/CRITERIO_UNIFICADO_NORMATIVA_Y_SEGURIDAD.md` §5 lista como compuerta de
  producción «certificados cualificados vigentes en Code100». Si prospera el
  camino B, esa compuerta cambia de proveedor, no de contenido.
