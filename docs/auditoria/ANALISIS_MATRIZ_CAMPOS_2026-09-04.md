# Análisis de la Matriz Normativa de Campos del Cliente (04-sep-2026)

**Fuente:** `docs/MATRIZ_CAMPOS_OBLIGATORIOS_2026-09-04.pdf` — *«Informe final ·
Matriz normativa de campos del cliente»*, elaborado para Interseguros S.A.
Corredores, versión revisada del 4 de septiembre de 2026 (9 páginas).
**Alcance declarado por la matriz:** únicamente los campos y controles visibles
en las pantallas aprobadas; excluye preguntas médicas, PEP, declaraciones y
consentimientos. **Principio:** pedir solo lo necesario; derivar o
autocompletar todo dato disponible en el sistema.
**Qué hace este documento:** contrasta cada decisión de la matriz con el
estado del código (`src/domain/tipos.ts`, `catalogo.ts`, `entidades.ts`) y de
`docs/ESPECIFICACION_PANTALLAS.md`, y deja la lista de cambios. **No
implementa ninguno**: varios tocan más de una pantalla y dos exigen decisión
previa (§3, §5).

---

## 1. La corrección central, y por qué ya está cubierta

La matriz corrige un análisis anterior que evaluaba el domicilio del
beneficiario solo desde SEPRELAD: **cuando el cliente designa nominalmente a
una persona, su nombre y domicilio son obligatorios en la Solicitud**, por la
**Res. SS.SG. 215/17, numeral 11.4** — leída de primera mano en
`docs/normativa/`: *«Nombre y domicilio del o los beneficiarios, si corresponde
enunciar explícitamente»*. Sin comprobante.

Estado: **ya implementado.** `Beneficiario.nombreCompleto` y `domicilio` son
obligatorios con `PERSONA_DESIGNADA`, `numeroCedula` es opcional y no
bloqueante (`tipos.ts`, con la cita —hoy correcta— al 11.4), y la
especificación lo registra como divergencia deliberada con el canvas (DI-7).
Solo cambia la numeración de la cita, corregida en esta misma sesión.

## 2. Campo por campo

Leyenda: ✅ ya es así · ✏️ cambio de configuración o de texto · 🔧 cambio de
modelo o de pantalla · ⚠️ requiere decisión.

### 2.1 Campos que se mantienen en las dos rutas de diligencia

| Campo | Decisión de la matriz | Estado actual | Cambio |
| :-- | :-- | :-- | :-- |
| Plan seleccionado | Mantener; la selección completa los datos técnicos del plan | Paso 2, `catalogo.ts` | ✅ |
| Nombres · Apellidos | Extraídos de la cédula | OCR + corrección cotejada (CHG-15) | ✅ |
| Número de cédula | Extraído, identifica al proponente | OCR, no editable | ✅ |
| Tipo de documento | **Sin selector**: registrar «Cédula de Identidad paraguaya» | No hay selector; `IDENTITY_PAISES_CEDULA` admite BO solo como demo | ✅ (confirmar que el PDF imprime el tipo) |
| Cédula frente / dorso | Captura documental, no campo escrito | Capturas con MRZ | ✅ |
| Número de WhatsApp | Mantener como teléfono; satisface el dato teléfono del FIPF | Paso 1 sección 2 | ✅ |
| País / prefijo | No tratar como dato independiente; **preseleccionar +595** | El campo muestra `Ej.: +595 981 000 000` | ✏️ verificar que el prefijo esté preseleccionado y no sea campo aparte |
| Domicilio del proponente · Ciudad | Obligatorios, **sin comprobante**; ciudad unida al domicilio en el PDF | `DatosComplementariosP6.domicilio`, `ciudad` | ✅ (verificar que el PDF los una) |
| Fecha de nacimiento | Extraída, para validar edad | OCR, no editable, regla #8 | ✅ |
| Edad | **No pedir; calcular** | No existe campo; `calcularEdadDesde` | ✅ |
| Actividad económica / ocupación / profesión | **Un único campo unificado** | `actividad` **y** `profesion`, dos campos, ambos en el paso 1 y en el FIPF del PDF | 🔧 fusionar en el modelo, la pantalla, el PDF y `catalogo-p6.ts`; **nueva versión documental** porque cambia el PDF |
| Modalidad de beneficiario | Herederos legales o persona designada | `BeneficiarioTipo` | ✅ |
| Nombre y domicilio del beneficiario designado | Obligatorios solo al designar (215/17 num. 11.4) | Implementado | ✅ |

### 2.2 Campos que se muestran únicamente en diligencia normal

| Campo | Estado actual | Cambio |
| :-- | :-- | :-- |
| Nacionalidad | En `Identidad`, editable en el paso 1 (sección 1); en simplificada la matriz la oculta; en normal puede tomarse de la cédula y confirmarse | 🔧 mover a la ruta normal; en simplificada no se muestra |
| País de residencia | En `Identidad`, declarado por la persona | 🔧 solo ruta normal |
| Empresa / empleador | `empresa: string | null`, en el paso 1 | 🔧 solo ruta normal; obligatorio para dependientes |
| Ingreso mensual declarado | `ingresoMensualDeclaradoGs`, obligatorio en el paso 1 | 🔧 solo ruta normal; **sin** carga de comprobante |
| Origen principal de fondos | `origenFondos`, obligatorio en el paso 1 | 🔧 solo ruta normal |

### 2.3 Controles y datos automáticos (no son campos declarados)

| Elemento | Decisión | Estado | Cambio |
| :-- | :-- | :-- | :-- |
| OTP de WhatsApp · selfie y prueba de vida | Controles y evidencia, no datos del formulario | Así están | ✅ |
| **Sexo** | **No pedir manualmente.** Conservar automáticamente solo si integra el modelo técnico registrado por Alianza | Se **elige** (decisión del 21-ago-2026, vigente en la especificación) | ⚠️ ver §5.1 |
| Correo electrónico | **Opcional**, canal alternativo; no bloquear con WhatsApp verificado | Doble tipeo en el paso 1; hoy requerido | 🔧 hacerlo opcional; la confirmación solo si se carga |
| Situación laboral | Selector de lógica (decide si hay empleador) | `situacionLaboral` | ✅ |
| Nombre a quien facturar | Autocompletar con el asegurado | `nombreAFacturar` derivado de `Identidad` | ✅ |
| RUC | Opcional, no bloquea | `ruc: string | null` | ✅ |
| Medio de pago | En pago, no dato del FIPF | Paso 3 | ✅ |
| Canal de firma | **Predeterminar WhatsApp verificado**; preguntar solo si desea cambiar a correo | Se elige en el paso 3 | ✏️ predeterminar |

### 2.4 Campos a retirar, fusionar o desactivar

| Campo | Decisión | Estado | Cambio |
| :-- | :-- | :-- | :-- |
| País de nacimiento | Retirar como obligatorio; mantener solo si Alianza lo configura | `Identidad.paisNacimiento`, editable, paso 1 | 🔧 retirar u ocultar tras configuración |
| Estado civil | Retirar como obligatorio | `Identidad.estadoCivil`, paso 1 | 🔧 retirar |
| Profesión separada de Actividad | Fusionar | Dos campos | 🔧 (ver 2.1) |
| Parentesco del beneficiario | Retirar como obligatorio; puede quedar opcional | `parentesco: string | null`; la especificación lo lista como campo del designado | ✏️ confirmar que no bloquea; rotular opcional |
| Cédula del beneficiario | Opcional o retirar; **nunca bloquear** | Opcional, no bloqueante | ✅ |
| Edad escrita por el cliente | Eliminar; calcular | No existe | ✅ |

**Resultado:** de 30 decisiones, 17 ya se cumplen, 3 son ajustes de
configuración o texto, 9 son cambios de modelo o de pantalla, y 1 exige
decisión previa.

## 3. Lo estructural: dos rutas de diligencia

La matriz introduce algo que el modelo no tiene: **dos configuraciones del
formulario** (§6 del PDF). La **simplificada** —nombres, apellidos, cédula,
capturas, WhatsApp, domicilio y ciudad, actividad, fecha de nacimiento, plan,
beneficiario— y la **normal**, que agrega nacionalidad, país de residencia,
empleador, ingreso y origen de fondos. Hoy el paso 1 pide **todo** a todos.

La matriz dice que *«la gestión de aplicación del régimen por Alianza queda
fuera de la pantalla del cliente»*, pero no dice **quién decide la ruta ni
cuándo**. Tres lecturas posibles:

| | Cómo se elige la ruta | Consecuencia |
| :-- | :-- | :-- |
| (a) Siempre simplificada; Alianza pide lo demás después, fuera del portal | Sin decisión en pantalla | Mínima fricción; los cinco campos salen del portal y Alianza los recaba por su cuenta |
| (b) **Parámetro del producto** (umbral de premio u otro criterio de la Res. SEPRELAD 71/2019 art. 27), simplificada por defecto | Se resuelve antes de mostrar el paso 1 | Un flag por plan; los cinco campos aparecen solo cuando el criterio lo exige |
| (c) La persona elige | — | Descartable: nadie elige más diligencia |

**Recomendación: (b)**, con la simplificada como valor por defecto y el
criterio fijado por cumplimiento de Alianza — no por nosotros —, porque la
71/2019 no está en `docs/normativa/` y su art. 27 es lo que define cuándo
aplica el régimen simplificado. Hasta que Alianza fije el criterio, la
implementación puede llevar el flag en `false` (simplificada) sin perder nada.
**Es una decisión nueva (propuesta: D-24)** para Andres y Rodrigo.

## 4. Lo que el sistema incorpora al PDF (§7 de la matriz)

La lista de la matriz —aseguradora, identificación registral, plan, cobertura,
precio, temporalidad, expediente, texto del art. 1556, intermediario, firma y
trazabilidad— coincide con lo que `src/domain/documentos.ts` ya proyecta,
salvo un punto que la matriz marca como **actualización obligatoria de
pantalla**:

> Sustituir los marcadores provisionales `CDXXXXX` por la denominación
> **«Seguro de Vida Individual con Indemnización Adicional por Diagnóstico de
> Cáncer»**, código **15-VI.0002**, inscrito mediante **Nota SS.SG. N.º
> 397/2026** (7 de agosto de 2026).

Coincide con `docs/RegistrosOficiales/Nombre y registro oficial del seguro.txt`
(sin versionar). Dónde va: `RegistroProducto` en `src/domain/catalogo.ts`
(`MARCADOR_PENDIENTE_ALIANZA`, `esProvisional → false`); ninguna pantalla
necesita cambiar, que es para lo que se diseñó. Dos precisiones:

- La **denominación registral** y el **nombre comercial** («Seguro de Vida
  Oncológico CONFÍO») son datos distintos y el PDF debe llevar los dos: el
  primero por la Res. 215/17 (num. 11.2 en la propuesta; art. 9º.d en la
  póliza, con la fórmula *«inscrito … bajo el Código … según …»*), el segundo
  por la Res. 190/2025 y la Circular 011/2025 (`MARCA_FANTASIA_AUTORIZADA`).
- Cambiar el código cambia los bytes del PDF: **nueva versión documental**, sin
  reescribir los expedientes ya cerrados (reglas #4 y #10).

También el intermediario: la matriz pide *«identificación y matrícula de
Interseguros»*; la Res. 215/17 art. 9º.e pide en las condiciones particulares
nombre, teléfono, dirección y matrícula del corredor **y de su apoderado**, y
el análisis del CPC agrega la Res. SS.SG. 012/12 (nombre, matrícula y
teléfono). `entidades.ts` tiene la matrícula 118 y el teléfono de Interseguros
en `null` (D-19): ese `null` pasa a ser bloqueante para la póliza y el CPC.

## 5. Lo que exige decisión antes de tocar código

### 5.1 Sexo

La matriz: *«No pedir manualmente. Conservar automáticamente solo si integra el
modelo técnico registrado por Alianza»*. El repositorio decidió el 21-ago-2026
que **se elige** entre los dos valores de la cédula, justamente porque el OCR
lo leía mal y el error pasaba inadvertido hasta el documento firmado. Las dos
posturas son razonables y la que manda es el **modelo registrado**: si la
Solicitud del plan 15-VI.0002 trae el campo, se conserva; si no, se retira.
Hay que abrir `docs/Solicitud.pdf` de Alianza y mirar. **Decisión de Andres con
Alianza.**

### 5.2 Criterio de ruta de diligencia

§3, propuesta D-24.

## 6. Citas de la matriz y su estado en el repositorio

| Norma citada | ¿En `docs/normativa/`? | Observación |
| :-- | :-- | :-- |
| Res. SS.SG. 215/17, Título VI numeral 11 (11.2, 11.3, 11.4, 11.5) | ✅ desde el 04-sep-2026 | Los numerales **coinciden** con el texto. Ojo: el CSV de cumplimiento cita numerales «6.13.x», «6.12.23», «8.4», «12.x» que **no corresponden** a la numeración del Anexo leído (1-3 criterios, 4-7 formalidades, 8 descripción, 9 póliza con 9.13.x particulares, 10 certificado, 11 propuesta, 12 nota técnica). Pendiente: revalidar esas ~30 filas contra el texto |
| Res. SS.SG. 238/19 (modifica la 215/17 sin alterar el 11.4) | ❌ | Conseguir (BCP) |
| Código Civil arts. 1548, 1555, 1556, 1666, 1668, 1678-1681 | ❌ (parte de seguros) | Conseguir; `INDICE.md` §2 |
| Ley 827/96 arts. 10 y 61 h | ❌ | Conseguir; `INDICE.md` §2 |
| Res. SEPRELAD 71/19 arts. 26 y 27 | ❌ | Conseguir; es la que define la ruta (§3) |
| Boletín BCP N.º 19 | ❌ | Resumen oficial del régimen simplificado; conseguir |

## 7. Orden de trabajo sugerido

1. **Decidir §5** (sexo; criterio de ruta D-24) y registrar el resultado en
   `docs/plan/DECISIONES.md`.
2. **Corregir la especificación** (`ESPECIFICACION_PANTALLAS.md`, paso 1
   secciones 1-3 y beneficiario) antes de tocar pantallas, según la regla del
   repositorio.
3. **`catalogo.ts`**: código 15-VI.0002 y Nota 397/2026, con nueva versión
   documental. Es el cambio más chico y el que la matriz marca obligatorio.
4. **Modelo y paso 1**: fusión actividad/profesión; retiro de estado civil y
   país de nacimiento; nacionalidad, residencia, empleador, ingreso y origen
   detrás del flag de ruta; correo opcional. Una pantalla por sesión.
5. **Paso 3**: canal de firma predeterminado a WhatsApp.
6. **Revalidar los numerales del CSV** contra la 215/17 (§6).
