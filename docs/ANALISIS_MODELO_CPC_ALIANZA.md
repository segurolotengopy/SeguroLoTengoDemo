# El modelo oficial del Certificado de Cobertura, contra el que emitimos hoy

Alianza mandó el **modelo aprobado** del certificado el 18-sep-2026, que era el
último pendiente de D-42. Vive en `docs/MODELO_CERTIFICADO_COBERTURA_ALIANZA.docx`
(y su conversión a PDF al lado, para poder verlo sin Word).

Lo que sigue es qué pide ese modelo, qué de eso ya tenemos, y qué hay que
decidir o preguntar antes de emitir con él. **Todavía no se implementó nada.**

---

## 1. Qué es el archivo

Una **plantilla en blanco**, sin un solo valor de ejemplo, maquetada con
cuadros de texto sobre un lienzo. No trae logos ni pie de página. El título
interno es **«Certificado de Cobertura Provisorio»** y el producto,
**«Vida individual con indemnización adicional por diagnóstico de cáncer»**.

Su estructura, de arriba abajo:

| Bloque | Campos |
| :---- | :---- |
| Identificación | Certificado Nro. · Sección/sub-sección · Documento · Tomador y/o Asegurado · Domicilio · Localidad · Lugar y fecha de emisión |
| Vigencia | Vigencia desde las …hs del … · Vigencia hasta las …hs del … |
| Alcance | Objeto del seguro · Edad límite |
| Coberturas | Fallecimiento · A) Indemnización por cáncer · B) Renta hospitalaria · C) Gastos médicos por accidente, cada una con su suma asegurada en guaraníes |
| Límites | Límite de padecimientos · Edad máxima · Edad mínima |
| Fechas | Plazo máximo del pago · Período de espera · Período de carencia |
| Deducible | Deducible |
| Beneficiarios | Nombre · Parentesco · CI · Proporción (%) |
| Cierre | «Demás coberturas y exclusiones, de conformidad a las establecidas en las condiciones generales y particulares de la póliza del rubro.» |

---

## 2. Lo que ya tenemos y entra sin discusión

El expediente cobrado alcanza para llenar la mayor parte:

- **Certificado Nro.** → `CPC-<correlativo>`, el mismo correlativo del paquete.
- **Documento** y **Tomador y/o Asegurado** → cédula y nombre de la identidad
  verificada. En este producto tomador y asegurado son la **misma persona**
  (regla inviolable #9), así que el campo doble se llena una sola vez.
- **Domicilio** y **Localidad** → `datosPersonales.domicilio` y `.ciudad`.
- **Vigencia desde / hasta, con hora** → es exactamente lo que ya calculamos:
  el cobro acreditado más 24 horas exactas, y el aniversario. El modelo pide
  hora, y nosotros la tenemos al milisegundo (CHG-41).
- **Las cuatro coberturas con sus sumas** → las cuatro ya están en el catálogo
  por plan, y el certificado actual ya las imprime.
- **Edad máxima y mínima** → 64 y 18 (regla inviolable #8).
- **Beneficiarios: nombre, parentesco y CI** → `Expediente.beneficiario`, que
  además distingue herederos legales de persona designada.

---

## 3. Lo que el modelo pide y nadie definió todavía

Ninguno de estos valores existe en el producto, y **no se pueden inventar**:

| Campo | Por qué no lo tenemos |
| :---- | :---- |
| **Sección/sub-sección** | Es la nomenclatura de ramo de Alianza, no nuestra |
| **Objeto del seguro** | Texto fijo del producto; hay que acordar la redacción |
| **Edad límite** | Distinta de la edad máxima de ingreso: sería la de permanencia |
| **Límite de padecimientos** | No figura en ningún documento del producto |
| **Plazo máximo del pago** | Ambiguo: ¿el plazo para pagar el premio o para pagar un siniestro? |
| **Período de espera** y **Período de carencia** | Tenemos carencias **por cobertura** (180 días para cáncer, 30 para renta, 1 para el resto) y el modelo pide **un** valor de cada uno. Espera y carencia además no son lo mismo |
| **Deducible** | El producto no declara ninguno |
| **Proporción (%)** del beneficiario | Con un único beneficiario es 100 %, pero conviene que lo confirmen |

Son **ocho preguntas para Alianza**, y la mayoría se contesta con un valor fijo
que después vive en el catálogo del producto, no en el código del PDF.

---

## 4. Lo que hoy imprimimos y el modelo no contempla

Acá está el punto delicado. El certificado actual lleva cosas que **no son
decoración**: salen de la matriz de cumplimiento o de decisiones ya tomadas.

| Qué | Por qué está |
| :---- | :---- |
| **QR y código de verificación** | CMP-06: la página pública `/verificar/<código>` |
| **Huella SHA-256 y vínculo con `PROP-<correlativo>`** | Fila 47 de la matriz: vincular por correlativo o hash |
| **«No es la póliza ni una Nota de Cobertura»** | El producto no contempla Nota de Cobertura, y sin la leyenda el documento se lee como si lo fuera |
| **Firmantes, con nivel y modalidad** | D-13: un certificado que no dice quién lo firmó no prueba nada |
| **Referencia de Bancard y premio pagado** | Es el hecho que habilita la cobertura |

**Ninguno se puede sacar para que entre el modelo.** La salida natural es
sumarlos como un bloque al pie, debajo del cierre, sin tocar el cuerpo que
Alianza aprobó. Pero el modelo es de ellos, así que conviene avisarlo en vez
de hacerlo y que aparezca en la primera prueba.

---

## 5. El nombre del documento y el del producto

El modelo dice **«Certificado de Cobertura Provisorio»**; nosotros lo llamamos
**«Certificado de Cobertura Provisional»** en todo el sistema, incluida la
pantalla de confirmación y la página de verificación. Y el producto que el
modelo nombra es la **denominación registrada** del plan, mientras que la
persona compró un **VIVE**, **VIVE+** o **VIVE TOTAL**.

Propuesta, a confirmar: el **título** del documento pasa a ser el del modelo,
y el nombre comercial del plan va en **«Objeto del seguro»**, junto con el
código del plan registrado que el certificado ya imprime. Así el documento
dice a la vez lo que la norma registró y lo que la persona compró. El
`PlanId` interno no se toca (regla #10 del proyecto).

---

## 6. Lo que ya se adelantó (18-sep-2026)

Sin esperar las respuestas, y para que después sea solo llenar valores:

- **Domicilio y localidad** entraron al bloque del asegurado, desde
  `datosComplementarios`, que es el que se compone siempre.
- **Edad de ingreso** se imprime como `18 a 64 años`. El modelo la pide en dos
  renglones y acá va en uno para no estirar el documento; los dos números
  quedan a la vista, que es lo que obliga la regla #8.
- **Bloque de beneficiarios**, con nombre, parentesco, cédula y proporción.
  Herederos legales se resuelven en un renglón con el 100 %; la cédula del
  designado es opcional (CHG-24) y si falta **se omite el renglón**.
- **`src/domain/condiciones-producto.ts`**: las ocho condiciones pendientes,
  todas en `null`, y la regla `camposDefinidos` que hace que **lo que Alianza
  no confirmó no se imprima**. Cuando contesten, se llenan ahí y aparecen solas:
  no hay que tocar la plantilla ni el armado.
- Nueve tests nuevos, incluido el que fija que los ocho campos pendientes **no**
  salgan en el PDF.

**Efecto secundario aceptado: el certificado pasó a dos carillas.** El cierre
—firma y pie— bajó a la segunda. Se decidió no pelear por la carilla única,
porque las ocho condiciones que faltan suman hasta ocho filas más y la
romperían igual. Lo que se conserva es que el cierre baje **entero**, nunca el
pie solo.

## 7. Qué hace falta para terminarlo

1. **Las ocho respuestas de la sección 3**, que se cargan en
   `CONDICIONES_PRODUCTO` y con eso aparecen en el PDF.
2. **El OK de Alianza al bloque de respaldo** de la sección 4.
3. **La confirmación del título y del orden** de la sección 5. Eso sí obliga a
   reordenar la plantilla, y por eso no se adelantó: cambiar el nombre de un
   documento que ya se emitió, sin confirmación, sería peor que esperar.

Mientras tanto, la leyenda actual del PDF —«Modelo provisional, pendiente del
modelo registrado de Alianza Garantía»— **sigue siendo cierta** y no hay que
tocarla.
