# Referencias — marco de firma cualificada de Paraguay (ICPP)

Catálogo de los documentos oficiales de la **Infraestructura de Clave Pública
del Paraguay (ICPP)** que sostienen el análisis de `../README.md`. Publicados
por el Ministerio de Industria y Comercio en
`https://www.acraiz.gov.py/adjunt/DOC-ICPP/`.

> **Los PDF no están en el repositorio, por decisión del 02-sep-2026.** Son
> ~19 MB de documentación técnica de consulta ocasional, y el repositorio no
> es su lugar. Lo que queda acá es lo que hace falta para volver a tenerlos y
> saber que son los mismos: qué es cada uno, de dónde sale y su SHA-256. La
> receta de descarga está al final; una copia local en esta misma carpeta
> queda ignorada por git.
>
> **Las leyes sí están.** La **Ley 6822/2021** y el **Decreto 7576/2022**
> viven en `docs/normativa/` (`ley-6822-2021.pdf`, `decreto-7576-2022.pdf`),
> porque de ellas cuelgan las citas del análisis y la regla de `CLAUDE.md` es
> que una norma entra al repositorio **antes** de citarse. Origen: `mic.gov.py`.

Los 21 documentos se descargaron y se abrieron el 02-sep-2026 para verificar
que cada uno es lo que su nombre dice, según la regla de
`docs/normativa/INDICE.md` §4. La paginación indicada sale de esa lectura.

---

## Los cuatro que deciden el análisis

| Archivo | Qué es | Por qué importa |
| :-- | :-- | :-- |
| `DOC-ICPP-04.pdf` | Directivas obligatorias para la **Política de Certificación** de los PCSC (Anexo de la Res. N.º 811/2022) · 81 p | **La fuente de los perfiles F1/F2/F3 y S1/S2/S3**: qué medio de almacenamiento admite cada uno, quién custodia la clave privada y cómo se rotula en el certificado. Ítems 1.1, 6.1.1, 6.1.2 y 7 |
| `DOC-ICPP-06.pdf` | Normas de **algoritmos criptográficos** de la ICPP (Anexo de la Res. N.º 1547/2023) · 13 p | §4 «Estándares de hardware»: fija **FIPS 140-2 nivel 3** para F2/F3/S2/S3 y el requisito «Certificado por el MIC». **No menciona Common Criteria ni EN 419221-5** |
| `DOC-ICPP-22.pdf` | Procedimiento para la **certificación de dispositivos cualificados** de firma y/o sello (Anexo de la Res. N.º 1390/2022) · 4 p | El trámite que homologa un HSM: documentación, 30 días hábiles, aprobación por Resolución. **No restringe el solicitante a un PCSC** (la ficha web del MIC sí) |
| `DOC-ICPP-07.pdf` | Directivas para la Declaración de Prácticas del PCSC que preste el **servicio de generación o gestión de datos de creación de firma/sello** · 60 p | Es el régimen de la **firma remota** (perfiles F3/S3): la custodia de claves ajenas es un servicio regulado y exclusivo de un PCSC |

## El resto del cuerpo normativo de la ICPP

| Archivo | Qué es |
| :-- | :-- |
| `DOC-ICPP-01.pdf` | Política y Declaración de Prácticas de Certificación de la **AC Raíz** de la ICPP, versión 2.0 (Res. N.º 0495/2026; deja sin efecto la v1.0 de la Res. 810/2022) · 81 p |
| `DOC-ICPP-03.pdf` | Directivas obligatorias para la **Declaración de Prácticas de Certificación** de los PCSC · 147 p |
| `DOC-ICPP-05.pdf` | Características mínimas de seguridad para las **Autoridades de Registro** · 26 p |
| `DOC-ICPP-08.pdf` | Procedimientos operacionales mínimos del servicio de generación o gestión de datos de creación de firma/sello · 43 p |
| `DOC-ICPP-09.pdf` | Política de **identificación electrónica** · 41 p |
| `DOC-ICPP-11.pdf` | Guía para la **acreditación del OEC** (organismo de evaluación de la conformidad) · 5 p |
| `DOC-ICPP-13.pdf` | **Política tarifaria** — de acá salen los 20 jornales mínimos del trámite de certificación de dispositivos · 5 p |
| `DOC-ICPP-17.pdf` | Procedimiento de **identificación remota de una persona física** (Res. N.º 529/2024) · 16 p |
| `DOC-ICPP-18.pdf` | Estructura y contenido del **informe de evaluación de la conformidad** · 11 p |
| `DOC-ICPP-19.pdf` | Formulario de solicitud de habilitación de servicios anexos para el PCSC reconocido por leyes anteriores · 3 p · **escaneado, sin capa de texto** |
| `DOC-ICPP-20.pdf` | **Perfil del certificado del prestador NO cualificado** · 15 p |
| `DOC-ICPP-21.pdf` | Proceso de habilitación del servicio de generación o gestión de datos de creación de firma **en nombre del firmante**, para PCSC reconocido por leyes anteriores · 5 p |
| `DOC-ICPP-23.pdf` | Procedimiento general para solicitudes de autorización de procesos que modifiquen la operativa de un PCSC (Res. N.º 156/2023) · 4 p |
| `DOC-ICPP-24.pdf` | Proceso de habilitación de **servicios anexos** prestados por el PCSC (Res. N.º 185/2023) · 4 p · **escaneado, sin capa de texto** |
| `DOC-ICPP-25.pdf` | Requisitos mínimos para la Declaración de Prácticas de **sello cualificado de tiempo** (TSA) (Res. N.º 1546/2023) · 56 p |
| `DOC-ICPP-26.pdf` | Requisitos mínimos para la **Política** de sello cualificado de tiempo (Res. N.º 1546/2023) · 20 p |
| `DOC-PKI-04-perfiles-de-certificados-v2.0.pdf` | Directivas obligatorias para la Política de Certificación de los PSC de la **PKI-Paraguay** (Anexo II de la Res. N.º 577/2020) · 68 p. **Antecedente anterior a la Ley 6822/2021**; su tabla de perfiles coincide con la del `DOC-ICPP-04`, que es el vigente |

**Faltan** (no publicados junto a los demás): el formulario **FOR-ICPP-06** del
trámite de certificación de dispositivos, y la **lista de dispositivos ya
certificados por el MIC**. Los dos hay que pedirlos a `info-dgce@mic.gov.py`.

Los números `DOC-ICPP-02, 10, 12, 14, 15, 16` y del `27` en adelante devuelven
404: no existen o no están publicados.

---

## Cómo descargarlos

`www.acraiz.gov.py` **no envía el certificado intermedio** de su cadena TLS, así
que `curl` y `WebFetch` fallan con *unable to get local issuer certificate*.
Por eso `docs/normativa/INDICE.md` §4 lo daba por inaccesible. No hace falta
desactivar la verificación: alcanza con aportar el intermedio que el servidor
omite, que el propio certificado publica en su extensión *Authority Information
Access*.

```bash
curl -sS -o gs-inter.crt http://secure.globalsign.com/cacert/gsgccr3evtlsca2025.crt
openssl x509 -inform DER -in gs-inter.crt -out gs-inter.pem
cat /etc/ssl/certs/ca-certificates.crt gs-inter.pem > bundle.pem
curl --cacert bundle.pem -O "https://www.acraiz.gov.py/adjunt/DOC-ICPP/DOC-ICPP-04.pdf"
```

La cadena queda verificada de verdad: el intermedio se valida contra
*GlobalSign Root CA - R3*, que ya está en el almacén del sistema. El
intermedio vence el 05-dic-2026, así que la URL puede cambiar después.

## Huellas (verificación de integridad)

Calculadas sobre los archivos descargados el 02-sep-2026, que son los que se
leyeron para escribir `../README.md`. Sirven para confirmar que una descarga
posterior trae el mismo documento y no una versión distinta: el MIC republica
estos archivos sin cambiarles el nombre.

| Archivo | Bytes | SHA-256 |
| :-- | --: | :-- |
| `DOC-ICPP-01.pdf` | 731059 | `9a5c44e295421f52890d26ffe3e96afafebf8d5280dd2dbdf4f15a226b7c72f1` |
| `DOC-ICPP-03.pdf` | 2107594 | `fa33f14bd8f51e0f9d14ed0e2d5f7879044f2173b1a4dd23b8f96e5b884bba44` |
| `DOC-ICPP-04.pdf` | 1493845 | `75211bcafc8ddebbac1ab4c15a59b09de1468fdb72e7a3b6a1b2adfc4bdce962` |
| `DOC-ICPP-05.pdf` | 452885 | `2f6cf6ccd98429289a8eb81e2ed4a377dffed9e3b71fdd6436b3997cc503dc49` |
| `DOC-ICPP-06.pdf` | 966973 | `eb0418839e4379c3b10a5cfa3bfb69e29708dcf7ac0434e91b8ee294a71fcc49` |
| `DOC-ICPP-07.pdf` | 666048 | `2a335ce92d2bff74fbe43c4be0f186ef1cf649e2f4d3c0faef60e352ea482ce0` |
| `DOC-ICPP-08.pdf` | 535623 | `ce8edfc44fd1e95b7f2fe73de01fa09a8e741d7910298c1c493e655ee06af388` |
| `DOC-ICPP-09.pdf` | 1171148 | `c11b43d4b7d1c3bb5b2770e845ee7537dfc8097a2a1930a0a3e8b64ea2e250a0` |
| `DOC-ICPP-11.pdf` | 419399 | `b59a65bb7fac22736c3f21904771078bee0eb78ed623ab73bc9a2a724b0685f0` |
| `DOC-ICPP-13.pdf` | 434614 | `d9f7f2f96114011bb00f8014a1e8f40c6c815e1b61a790d49ba97b8322eedfa1` |
| `DOC-ICPP-17.pdf` | 708001 | `d8e594b829d8b5e46c0b3cbe1978daa4bcd992f6042848ed67a5ac65bb1dde8a` |
| `DOC-ICPP-18.pdf` | 445235 | `d2d21c68a52d285f8cebf3b9bf10f54b66ad6b7b616c5d88c1004e52b0d66a88` |
| `DOC-ICPP-19.pdf` | 4282664 | `dec4ad7e7b831104ee04442a186fd0adba9ca8d45a43b31098aa8703ecbdd79b` |
| `DOC-ICPP-20.pdf` | 432462 | `739af06447ccee82e39e7366df2bcb515565a73ab30350356ba6d3fc186374c2` |
| `DOC-ICPP-21.pdf` | 446162 | `ec86de81111b8a4118f3fb3d1b084e015978ed5591a974cbbce537dee1caed6a` |
| `DOC-ICPP-22.pdf` | 466795 | `d4af9283a54307eb1824ff9d241c855f3a426cf2dbe02d0161fd0abb55c1a8df` |
| `DOC-ICPP-23.pdf` | 130733 | `47e7ba19f1a5cbf3f024d8b62a90311dc8076239798bb289017c2ed1d0763ab9` |
| `DOC-ICPP-24.pdf` | 247732 | `7489619c80aa5313ff94efb78662f107861869717fc33f175d2f9a5568056f9d` |
| `DOC-ICPP-25.pdf` | 1095419 | `fc46e6d329ef9aba3d30d2a1153d8d7108974df66166f070dba1dfcbe932b774` |
| `DOC-ICPP-26.pdf` | 908388 | `26d94b8f130dc47ac3cd2db36f095068fd0be8f6546586f6c0b8e5e6fc096174` |
| `DOC-PKI-04-perfiles-de-certificados-v2.0.pdf` | 705943 | `15246e2d33e1841059143a7dc9fede2aa1af52b9227c9831b468220fa9f16e75` |
