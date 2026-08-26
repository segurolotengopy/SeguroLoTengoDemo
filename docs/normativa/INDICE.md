# Índice de `docs/normativa/`

**Última actualización:** 26-ago-2026

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

## 0. Aclaración de numeración: los tres «215» (26-ago-2026)

**Si tenés un archivo llamado `215_2025.pdf`, ese archivo es la Res. 210/2025.**
Ha circulado dos veces con ese nombre y conviene dejarlo asentado, porque la
confusión lleva a citar una resolución en lugar de otra.

El documento que circula como `215_2025.pdf` se identifica a sí mismo, en su
carátula y en sus metadatos, como **RESOLUCIÓN SS.SG. N° 210/2025 —
«Condiciones mínimas para la comercialización de seguros por medios
electrónicos y canales no presenciales»**, Asunción, 25 de setiembre de 2025,
expediente EXP-2025-003387, firmada digitalmente por la Superintendente el
26-09-2025. Es el mismo contenido que este directorio ya guarda, bien
nombrado, como `210 2025.pdf`.

Cómo se comprueba sin abrir ninguna otra fuente: su parte resolutiva tiene
**dos puntos** (1° establecer las condiciones mínimas del Anexo I; 2°
publicar, registrar y archivar) y su Anexo I tiene **diez artículos**. Las
filas de la matriz de cumplimiento que citan «215» invocan, en cambio,
*«Anexo 1, numeral 11.14»*, *«numeral 6.13.14»*, *«numerales 12.8 y 6.13.6»*,
*«punto resolutivo 14»*, *«punto 9(d)»*. Nada de eso existe en este
documento: no tiene numerales 6.x, 11.x ni 12.x, y no tiene un punto 14 ni un
punto 9(d). **Las filas «215» no citan este texto.**

Los tres números distintos que conviven, para no volver a mezclarlos:

| Cómo aparece | Qué es realmente | Dónde está |
| :--- | :--- | :--- |
| **Res. SIS 215/2017** (el CSV la escribía «215/15») | Modelos de propuesta y póliza, numeración, contenido contractual, art. 1556. Sustituyó a la 292/2007; modificada por las Res. 238/2019 y 181/2020. **Es la que citan las ~30 filas «215» de la matriz** | ❌ **Falta** — ver §2 |
| **Res. SIS 210/2025** (circula mal nombrada como `215_2025.pdf`) | Condiciones mínimas de comercialización electrónica. Norma central del portal | ✅ `210 2025.pdf` |
| **Res. SIS 215/2025** | Renovación de inscripción de matrículas de auxiliares del seguro. Acto administrativo, sin relación con el flujo | No se necesita |

Corolario que importa: **tener el PDF adjunto no cubre la brecha de la
215/2017.** Esa sigue siendo la norma más citada del proyecto y su texto
oficial sigue sin estar en el repositorio (§2, prioridad A).

---

## 1. Presentes

| Archivo | Qué es | Quién lo usa |
| :--- | :--- | :--- |
| `210 2025.pdf`<br>*(circula también como `215_2025.pdf` — ver §0)* | **Res. SS.SG. N° 210/2025** — Condiciones mínimas para la comercialización de seguros por medios electrónicos y canales no presenciales (25-sep-2025). Parte resolutiva + Anexo I con 10 artículos | **Norma central del portal.** Analizada artículo por artículo en `docs/auditoria/ANALISIS_RES_210_2025.md`; filas 86-93 de la matriz de cumplimiento |
| `231 2025.pdf` | **Res. SS.SG. N° 231/2025** — Condiciones para la emisión de pólizas electrónicas (29-oct-2025) | Firma cualificada de Alianza, QR de verificación, prohibición de firmas facsimilares, aviso previo a la SIS |
| `190 2025.pdf` | **Res. SS.SG. N° 190/2025** — Uso exclusivo de la denominación registrada y autorizada (8-sep-2025) | `src/domain/entidades.ts` (`marcaVisible()`, flag `MARCA_FANTASIA_AUTORIZADA`) |
| `011 2025.pdf` | **Circular SS.SG. N° 011/2025** — Uso de denominaciones comerciales | Formato de `IDENTIFICACION_SIS` (razón social + actividad + matrícula) |
| `117 2026.pdf` | **Res. SS.SG. N° 117/2026** — Modifica el Anexo II de la Res. 031/2026 (matriculación de auxiliares) | Calendario de renovación de matrícula; no toca pantallas |
| `matriz 16 08 2026.pdf` | **Matriz Legal Final V4** — documento de trabajo jurídico-funcional del proyecto, no es una norma | Fuente maestra de cumplimiento mientras dure el Plan de Cambios v2 |
| `ESPECIFICACION.pdf` | Especificación funcional y revisión normativa (17-ago-2026) — documento propio del proyecto, no es una norma | Antecedente; el detalle vigente vive en `docs/ESPECIFICACION_PANTALLAS.md` |

---

## 2. Faltan — Prioridad A: el código ya las cita

Estas normas aparecen hoy en comentarios de `src/` justificando reglas de
negocio, y su texto oficial **no está en el repositorio**. Es la brecha más
seria del inventario: son citas que nadie puede contrastar.

| Norma | Por qué hace falta | Dónde conseguirla |
| :--- | :--- | :--- |
| **Res. SIS N° 215/2017** (mod. por 238/2019 y 181/2020) | La más citada del proyecto: modelos de propuesta y póliza, numeración, contenido contractual, art. 1556. Sostiene ~30 filas de la matriz de cumplimiento y decenas de comentarios | Ficha oficial del BCP: `www.bcp.gov.py/web/institucional/w/res.ss.sg.n°215/17` |
| **Ley N° 6822/2021** — Servicios de confianza para transacciones electrónicas | Base de toda la arquitectura de firma; define firma simple y cualificada, y los arts. 9, 13, 14, 15 y 20 deciden si Interseguros debe comunicarse al MIC | `www.mic.gov.py/wp-content/uploads/2023/11/Ley-Nro-6822-2021pdf-1.pdf` |
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
| **Decreto N° 7576/2022** | Reglamento de servicios de confianza: prestadores cualificados y no cualificados, certificados, ICPP | `www.mic.gov.py/wp-content/uploads/2025/06/Decreto_7576-2022.pdf` |
| **Decreto N° 1165/2014** | Reglamenta la Ley de Comercio Electrónico: resumen revisable antes de contratar, acuse de recibo, deberes de información | `www.mic.gov.py/wp-content/uploads/2023/11/decreto__1165_2014_ce0.pdf` |

---

## 4. Cómo incorporarlas

Las descargas **no se pueden hacer desde el entorno de desarrollo remoto**:
el proxy de egreso bloquea `bcp.gov.py`, `mic.gov.py`, `acraiz.gov.py` y
`silpy.congreso.gov.py` (comprobado el 26-ago-2026, los cuatro devuelven
error de túnel). Las baja una persona desde una red común y las commitea.

Las direcciones de la columna «dónde conseguirla» vienen de los memos de
investigación jurídica del 26-ago-2026 y **no fueron verificadas** por no
poder abrirlas desde acá: hay que confirmar que el documento descargado es
el que dice ser antes de citarlo. Los PDF de la SIS traen carátula con
número, título y fecha, que es lo que hay que mirar.

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
| Res. SIS 136/2018 | Res. SIS 231/2025 |
| Res. SIS 292/2007 | Res. SIS 215/2017 |
| Res. SIS 022/2024 | Res. SIS 030/2025 |
| Res. SIS 303/2024 y arts. 1-8 de la Res. 14/1996 | Res. SIS 031/2026 (ampliada por la 117/2026) |
| «Res. 215/15» | Errata de numeración: esa resolución es **215/2017** |
