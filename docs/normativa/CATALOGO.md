# Catálogo de normas — SeguroLoTengo

**Última revisión:** 2026-08-27
**Regla de esta carpeta:** el nombre del archivo se deriva del **contenido**, verificado abriendo el documento, no de cómo llegó. Formato: `<emisor>-<tipo>-<número>-<año>-<materia>.pdf`.

Toda norma que se agregue acá se registra en este catálogo con su fecha, su materia y **si fue leída de primera mano**. Una norma citada en la matriz de cumplimiento pero no presente en esta carpeta es una cita que nadie verificó.

---

## 1. Normas presentes y verificadas

| Archivo | Norma | Fecha | Materia | Verificado |
| :---- | :---- | :---- | :---- | :---- |
| `SIS-Res-210-2025-comercializacion-medios-electronicos.pdf` | Resolución SS.SG. N.º **210/2025** | 25-sep-2025 | Condiciones mínimas para comercializar seguros por medios electrónicos y canales no presenciales. **Norma central del portal**: art. 4 (firma simple del proponente con autenticación previa), art. 5 (firma cualificada del corredor), art. 8 (responsabilidad no delegable), art. 9 (conservación 2 años desde el vencimiento), art. 10 (procedimiento aprobado por Directorio) | **Sí**, texto completo |
| `SIS-Res-231-2025-emision-polizas-electronicas.pdf` | Resolución SS.SG. N.º **231/2025** | 29-oct-2025 | Emisión de pólizas e instrumentos de cobertura en formato electrónico: firma cualificada del suscriptor, comunicación previa a la SIS con 10 días hábiles, verificación por QR o equivalente. **Deroga la Res. 136/2018** | **Sí**, texto completo |
| `SIS-Res-190-2025-denominacion-registrada.pdf` | Resolución SS.SG. N.º **190/2025** | 08-sep-2025 | Uso exclusivo de la denominación registrada y autorizada por la SIS para agentes, corredores y liquidadores | Sí, encabezado y parte dispositiva |
| `SIS-Circular-011-2025-registracion-nombre-comercial.pdf` | **Circular** SS.SG. N.º **011/2025** | 30-sep-2025 | Lineamientos para registrar el nombre comercial o de fantasía, en el marco de la Res. 190/2025. Criterios de formación del nombre y documentos a presentar | Sí, primera página |
| `SIS-Res-117-2026-matriculacion-auxiliares-anexo-II.pdf` | Resolución SS.SG. N.º **117/2026** | 23-mar-2026 | Modifica el Anexo II de la Res. 031/2026 (régimen de matriculación y renovación de auxiliares de seguros) | Sí, encabezado |

## 2. Errores de rotulación corregidos

| Nombre anterior | Qué contenía en realidad | Resolución |
| :---- | :---- | :---- |
| `215 2025.pdf` | **La Resolución 210/2025**, no la 215. Es un duplicado del mismo documento (mismo contenido, distinto hash de archivo) | No se versionó: es copia. El archivo suelto puede borrarse del checkout principal |
| `210 2025.pdf` | Correcto | Renombrado con su materia |
| `011 2025.pdf` | Circular, no Resolución | Renombrado indicando que es Circular |
| `matriz 16 08 2026.pdf` | **No es una norma**: es la Matriz Legal Final V4 del proyecto | Movida a `docs/MATRIZ_LEGAL_V4_2026-08-16.pdf` |
| `ESPECIFICACION.pdf` | **No es una norma**: es una especificación funcional de seis pantallas | Movida a `docs/ESPECIFICACION_SEIS_PANTALLAS_2026-08-17.pdf` |

**No existe en esta carpeta ninguna copia de la Resolución 215.** La cita más repetida de la matriz de cumplimiento apunta a una norma que el proyecto nunca tuvo a la vista (§3).

## 3. Validación de las citas de la matriz de cumplimiento

Contraste entre `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` y las normas verificadas.

| Cita en el CSV | Veces | Diagnóstico |
| :---- | :---- | :---- |
| `Res. SS SG. 215/15` | **35** | **Incorrecta.** La resolución sobre registro de modelos de pólizas es la **215/2017**, modificada por las Resoluciones 238/2019 y 181/2020. Lo confirman dos fuentes independientes: el **visto de la propia Resolución 231/2025**, que cita "Resolución SS.SG. N° 215/17", y la Matriz Legal V4, que cita "Res. SIS 215/2017, 238/2019 y 181/2020". Es la cita más repetida de toda la matriz |
| `Res. SEPRELAD 50/20` | 2 | **Probablemente incorrecta**: las dos fuentes secundarias disponibles citan la **50/2019**. No pude verificarla de primera mano — no tenemos el PDF |
| `Res. SS SG. 223/17` | 1 | Sin verificar: no tenemos el documento |
| `Res. BCP 25/21` | 10 | Sin verificar: no tenemos el documento |
| `Ley 6822/21`, `Ley 4868/13`, `Ley 1334/98`, `Ley 827/96`, `Res. SEPRELAD 71/19` | 19 / 29 / 6 / 3 / 12 | Coherentes con las fuentes secundarias. Ninguna derogada |
| — | — | **Ausentes: Res. 210/2025 y Res. 231/2025.** Son hoy las dos normas centrales del canal electrónico y la matriz no las menciona ni una vez |
| — | — | Ausentes también: Res. 190/2025 y Circular 011/2025 (denominación), Ley 7593/2025 (datos personales), Ley 3940/2009 (VIH), Decreto 1165/2014, Ley 7503/2025 (pagos) |

**Lo que la matriz hace bien:** no cita ninguna norma derogada. No aparecen la Res. 136/2018, ni las Leyes 4017/2010 y 4610/2012, ni la Res. 292/2007.

## 4. Normas citadas que convendría conseguir

Res. SS.SG. 215/2017 (y sus modificatorias 238/2019 y 181/2020), Res. SS.SG. 223/2017, Res. SEPRELAD 71/2019 y 50/2019, Res. BCP 25/2021, Res. SS.SG. 031/2026, Res. SS.SG. 219/2018, Ley 7593/2025 y Ley 3940/2009.

Mientras no estén, cualquier afirmación sobre su contenido proviene de fuentes secundarias y así debe declararse.
