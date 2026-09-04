# Índice de `docs/normativa/`

**Última actualización:** 04-sep-2026

Qué normas están acá, cuáles faltan y por qué hacen falta. La regla de
trabajo de `CLAUDE.md` es que **nunca se cita de memoria un artículo de
ley**: para justificar una regla de negocio hay que poder abrir el texto. Una
norma que el proyecto invoca y cuyo PDF no está en esta carpeta es una cita
que nadie puede verificar.

Convención de nombre: `<número> <año>.pdf` para resoluciones y circulares de
la SIS (`210 2025.pdf`), y nombre descriptivo para leyes y decretos
(`ley-6822-2021.pdf`). La documentación técnica de proveedores **no** va acá:
va en `docs/Integraciones/`.

---

## 0. Aclaración de numeración: 215/17, 210/2025 y la errata «215/2025» (corregida el 04-sep-2026)

**La resolución de registro de planes y modelos que citan las filas «215»
de la matriz es la Res. SS.SG. N.º 215/17** — «Registro de Planes de Seguro y
Emisión de Instrumentos de Cobertura – Pautas Generales», Asunción, 28 de
diciembre de 2017; modificada por la Res. 238/19 y con plazo prorrogado por
la Res. 181/2020. Está en esta carpeta desde el 04-sep-2026 y se leyó de
primera mano: su Anexo trae el modelo de certificado individual (numeral 10)
y el de la propuesta (numeral 11, con la firma del corredor o del proponente
en el 11.15), y su parte resolutiva los requisitos de emisión (arts. 7º a
15º). La **Res. 231/2025 la cita expresamente como su base** en los
considerandos.

**Cómo se llegó a la errata.** El CSV la escribía «215/15». Un análisis del
26-ago-2026 la «corrigió» a «215/2025», siguiendo el nombre del archivo
`215_2025.pdf` que circulaba — y que contiene el texto de la **210/2025**
(carátula, metadatos y firma digital lo dicen). Esa corrección quedó escrita
en 89 citas, en `CLAUDE.md` y en un test que la imponía. El 04-sep-2026, con
el texto oficial descargado del BCP, se revirtió: las citas dicen «215/17» y
el test rechaza ahora «215/15» y «215/2025». El `CATALOGO.md` §3 lo había
advertido el 27-ago; la regla «ante discrepancia manda el índice» hizo que
ganara el documento equivocado.

**Sí existe otra Res. SS.SG. 215/2025**, sobre renovación de matrículas de
auxiliares. No regula modelos ni propuestas y no debe citarse para eso.

| Número | Qué regula | Dónde está |
| :--- | :--- | :--- |
| **Res. SS.SG. 215/17** | Registro de planes; requisitos de emisión de instrumentos de cobertura (arts. 7º-15º); modelos de póliza (9), de certificado individual (10) y de propuesta (11); nota técnica (12). Art. 1556 en el 11.14; firma del corredor o proponente en el 11.15 | ✅ `SIS-Res-215-2017-registro-planes-e-instrumentos-de-cobertura.pdf` |
| **Res. SS.SG. 210/2025** | Condiciones mínimas de comercialización por medios electrónicos y canales no presenciales. Norma central del portal (parte resolutiva de 2 puntos + Anexo I de 10 artículos) | ✅ `210 2025.pdf` |
| **Res. SS.SG. 231/2025** | Emisión de pólizas y otros instrumentos de cobertura en formato electrónico. **Abroga la 136/18** (art. 1º) | ✅ `231 2025.pdf` |

### Cuidado con el archivo `215_2025.pdf`

Circula un PDF con ese nombre que **contiene el texto de la 210/2025**: su
carátula, sus metadatos y su firma digital lo dicen, y su estructura —dos
puntos resolutivos y diez artículos— no tiene los numerales que las filas
«215» de la matriz invocan. Sirve como copia de la 210/2025, no como fuente
de las citas «215». Fue el origen de la errata de arriba.

---

## 1. Presentes

| Archivo | Qué es | Quién lo usa |
| :--- | :--- | :--- |
| `210 2025.pdf`<br>*(circula también como `215_2025.pdf` — ver §0)* | **Res. SS.SG. N° 210/2025** — Condiciones mínimas para la comercialización de seguros por medios electrónicos y canales no presenciales (25-sep-2025). Parte resolutiva + Anexo I con 10 artículos | **Norma central del portal.** Analizada artículo por artículo en `docs/auditoria/ANALISIS_RES_210_2025.md`; filas 86-93 de la matriz de cumplimiento |
| `231 2025.pdf` | **Res. SS.SG. N° 231/2025** — Condiciones mínimas para la emisión de pólizas y otros instrumentos de cobertura en formato electrónico (29-oct-2025). **Abroga la Res. 136/18** (art. 1º) | Firma cualificada del suscriptor de Alianza sobre póliza **y CPC** (Anexo I arts. 1-2), nómina de firmantes y comunicación previa a la SIS, medio de recepción declarado en la propuesta (art. 4), QR de verificación (art. 5) |
| `190 2025.pdf` | **Res. SS.SG. N° 190/2025** — Uso exclusivo de la denominación registrada y autorizada (8-sep-2025) | `src/domain/entidades.ts` (`marcaVisible()`, flag `MARCA_FANTASIA_AUTORIZADA`) |
| `011 2025.pdf` | **Circular SS.SG. N° 011/2025** — Uso de denominaciones comerciales | Formato de `IDENTIFICACION_SIS` (razón social + actividad + matrícula) |
| `117 2026.pdf` | **Res. SS.SG. N° 117/2026** — Modifica el Anexo II de la Res. 031/2026 (matriculación de auxiliares) | Calendario de renovación de matrícula; no toca pantallas |
| `ley-6822-2021.pdf` | **Ley N° 6822/2021** — De los servicios de confianza para las transacciones electrónicas, del documento electrónico y los documentos transmisibles electrónicos (44 p) | **Base de toda la arquitectura de firma.** Define firma electrónica cualificada (art. 4 num. 27), sus efectos (art. 39), el certificado cualificado (art. 43), el dispositivo cualificado (arts. 44-45) y el régimen de prestadores (arts. 10, 15, 24-26). Analizada en `docs/firma-cualificada/README.md` |
| `decreto-7576-2022.pdf` | **Decreto N° 7576/2022** — Reglamenta artículos de la Ley 6822/2021 (14 p) | Prestadores cualificados y no cualificados, certificados y funcionamiento de la ICPP |
| `SIS-Res-215-2017-registro-planes-e-instrumentos-de-cobertura.pdf` | **Res. SS.SG. N° 215/17** — Registro de planes de seguro y emisión de instrumentos de cobertura, pautas generales (28-dic-2017; 16 p). Modificada por la 238/19; plazo prorrogado por la 181/2020 | **La resolución de modelos.** Numeral 11 (propuesta: 11.4 beneficiario, 11.14 art. 1556, 11.15 firma del corredor o proponente), numeral 10 (certificado individual), arts. 7º, 9º.d-e y 14º de la parte resolutiva. Descargada del BCP por Andres el 04-sep-2026 |
| `SIS-Res-136-2018-polizas-firma-facsimilar-y-digital-ABROGADA.pdf` | **Res. SS.SG. N° 136/18** — Pólizas impresas con firma facsimilar y electrónicas con firma digital (07-may-2018; 5 p). **Abrogada por el art. 1º de la 231/2025** | Antecedente histórico: de acá vienen la nómina de firmantes, el certificado del suscriptor y la opción electrónica en la propuesta que la 231/2025 conserva. Se guarda para leer la 231 en contexto; **no se cita como vigente** (§5) |
| `matriz 16 08 2026.pdf` | **Matriz Legal Final V4** — documento de trabajo jurídico-funcional del proyecto, no es una norma | Fuente maestra de cumplimiento mientras dure el Plan de Cambios v2 |
| `ESPECIFICACION.pdf` | Especificación funcional y revisión normativa (17-ago-2026) — documento propio del proyecto, no es una norma | Antecedente; el detalle vigente vive en `docs/ESPECIFICACION_PANTALLAS.md` |

---

## 2. Faltan — Prioridad A: el código ya las cita

Estas normas aparecen hoy en comentarios de `src/` justificando reglas de
negocio, y su texto oficial **no está en el repositorio**. Es la brecha más
seria del inventario: son citas que nadie puede contrastar. (La 215/17, que
encabezaba esta lista, entró el 04-sep-2026.)

| Norma | Por qué hace falta | Dónde conseguirla |
| :--- | :--- | :--- |
| **Ley N° 827/1996** — De Seguros | Rol de aseguradora y corredor; art. 61 inc. b) (potestad reglamentaria de la SIS) y art. 76 (firma del corredor) | `www.bcp.gov.py/documents/20117/213083/LEY_827_96_DE_SEGUROS.pdf` |
| **Ley N° 4868/2013** — Comercio electrónico | La norma más citada en `src/`: información previa, precio total, conservación, acuse, retracto | `bacn.gov.py` |
| **Ley N° 1334/1998** — Defensa del consumidor | Información veraz, cláusulas abusivas, retracto (art. 26) | `bacn.gov.py` |
| **Código Civil (Ley 1183/1985), parte de seguros** | Formación del contrato, arts. 1348-1355, 1374, 1556 y la exigibilidad de la prima contra entrega de póliza o certificado provisional | `www.bcp.gov.py/documents/20117/213083/Codigo_Civil_Parte_Seguro.pdf` |
| **Res. SEPRELAD N° 71/2019 y N° 50/2020** | FIPF, debida diligencia, PEP y conservación de evidencias (5 años) | `bacn.gov.py` / `seprelad.gov.py` |
| **Res. BCP N° 25/2021** | Seguridad del proveedor de pagos; citada en las filas 78-84 de la matriz | `www.bcp.gov.py` |

## 3. Faltan — Prioridad B: el criterio unificado las incorpora

Normas que los memos del 26-ago-2026 traen al proyecto y que **todavía no se
citan en el código ni en la matriz, justamente porque su PDF no está**. El
orden de trabajo es: conseguir el PDF → leerlo → recién entonces agregar la
fila a la matriz de cumplimiento.

| Norma | Para qué se la necesita | Dónde conseguirla |
| :--- | :--- | :--- |
| **Res. SIS N° 205/2025** | Renovación de la matrícula de Interseguros: SIS 118, ramos, vigencia hasta el 18-sep-2027 y **firmante autorizado de las propuestas**. Es la que verifica la compuerta de producción del certificado cualificado en Code100 | `www.bcp.gov.py/documents/20117/0/` — «RESOLUCIÓN SS.SG. N 205 RENOVACIÓN CORREDORA INTERSEGUROS.pdf» |
| **Res. SIS N° 030/2025** | Consultas, quejas y reclamos ante la SIS (abrogó la 022/2024). Respalda CMP-10 y el enlace de la aclaración de reclamos | `www.bcp.gov.py` (Anuario SIS 2025 la lista) |
| **Res. SIS N° 219/2018 (MGCTI)** | Marco de gobierno y control de tecnología de las aseguradoras. Es la norma que da nombre a las compuertas de producción del art. 2.c, 2.d y 10 de la 210/2025 | `www.bcp.gov.py/en/web/institucional/w/res.ss.sg.n°219/18` |
| **Res. SIS N° 167/2010** | Libros electrónicos, instrumentos de cobertura, copias de respaldo y trazabilidad | `www.bcp.gov.py/documents/20117/0/2010-12-31-res-sssgn-167-10-tenencia-electronica-de-libros.pdf` |
| **Res. SIS N° 031/2026** | Régimen de matriculación y renovación de auxiliares (tenemos la 117/2026 que la modifica, pero no el texto base) | `www.bcp.gov.py/documents/20117/753661/` — «Resolución SS.SG. N° 031_2026.pdf» |
| **Ley N° 7503/2025** — Sistema Nacional de Pagos | Fundamenta que el comercio receptor en Bancard sea Alianza y no el corredor ni el portal | `www.bcp.gov.py/leyes1` + reglamentos SIPAP 2026 |
| **Ley N° 7593/2025** — Protección de Datos Personales | Vigencia plena a fines de 2027, pero es el estándar de diseño desde ahora (CMP-12/13) | Ficha del Congreso: `silpy.congreso.gov.py/web/ley/146223` |
| **Decreto N° 1165/2014** | Reglamenta la Ley de Comercio Electrónico: resumen revisable antes de contratar, acuse de recibo, deberes de información | `www.mic.gov.py/wp-content/uploads/2023/11/decreto__1165_2014_ce0.pdf` |

---

## 4. Cómo incorporarlas

**Actualización del 02-sep-2026.** El diagnóstico anterior —«el proxy de egreso
bloquea `bcp.gov.py`, `mic.gov.py`, `acraiz.gov.py` y `silpy.congreso.gov.py`»,
del 26-ago-2026— era demasiado amplio:

- `mic.gov.py` **responde**. De ahí se bajaron la Ley 6822/2021 y el
  Decreto 7576/2022 que ahora figuran en §1.
- `acraiz.gov.py` **no está bloqueado**: falla porque el servidor no envía el
  certificado intermedio de su cadena TLS. Aportándolo, la descarga funciona
  con la verificación intacta — la receta está en
  `docs/firma-cualificada/referencias/INDICE.md`, y con ella entró el cuerpo
  normativo de la ICPP.
- `bcp.gov.py` y `silpy.congreso.gov.py` **siguen sin comprobarse** desde el
  entorno remoto. Ahí sigue valiendo lo de siempre: las baja una persona desde
  una red común y las commitea.

Las direcciones de la columna «dónde conseguirla» que todavía no se usaron
vienen de los memos de investigación jurídica del 26-ago-2026 y **no fueron
verificadas**: hay que confirmar que el documento descargado es el que dice ser
antes de citarlo. Los PDF de la SIS traen carátula con número, título y fecha,
que es lo que hay que mirar.

Al agregar un PDF: (1) nombrarlo con la convención de arriba, (2) sumar su
fila a la sección 1 de este índice, (3) recién entonces citarlo en la matriz
de cumplimiento o en el código.

## 5. Normas que no deben citarse como vigentes

Derogadas, sustituidas o abrogadas. **`src/domain/__tests__/higiene-de-citas.test.ts`
pone la suite en rojo** si alguna reaparece en `src/` o en la matriz de
cumplimiento:

| No citar | Corresponde |
| :--- | :--- |
| Ley 4017/2010 y Ley 4610/2012 | Ley 6822/2021 |
| Res. SIS 136/2018 (abrogada por el art. 1º de la 231/2025) | Res. SIS 231/2025 |
| Res. SIS 292/2007 (derogada por el art. 19º de la 215/17) | Res. SIS 215/17 |
| Res. SIS 022/2024 | Res. SIS 030/2025 |
| Res. SIS 303/2024 y arts. 1-8 de la Res. 14/1996 | Res. SIS 031/2026 (ampliada por la 117/2026) |
| «Res. 215/15» y «Res. 215/2025» | Erratas de numeración: la resolución de registro de planes y modelos es la **215/17** (28-dic-2017). La 215/2025 que sí existe es de renovación de matrículas y no se cita para modelos (§0) |
