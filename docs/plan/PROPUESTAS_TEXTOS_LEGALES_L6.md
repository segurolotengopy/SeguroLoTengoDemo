# Propuestas de texto con consecuencia legal — L6

**Fecha:** 20 de agosto de 2026 · **Para:** Rodrigo / asesoría legal, con
conocimiento de la Gerencia de Interseguros · **De:** equipo técnico de
SeguroLoTengo (AAB1)

Ninguno de estos textos está publicado todavía. Se proponen para que Legal los
**apruebe, corrija o reemplace**; recién entonces se implementan como literales
versionados en `src/domain/textos-*.ts`, con su versión en la evidencia.

## Cómo leer cada propuesta

Cada una trae tres cosas separadas a propósito:

1. **Lo que exige la matriz**, con su fila y su cita tal como figura en
   `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`. No se cita ningún
   artículo de memoria.
2. **El texto propuesto**, palabra por palabra.
3. **Qué parte es un hecho verificable de nuestro sistema y qué parte necesita
   una decisión de Legal.** Es la distinción que más importa: lo primero lo
   podemos afirmar porque lo podemos demostrar; lo segundo no lo redactamos
   nosotros.

Donde falta un dato que la matriz no fija —un plazo, un cómputo— va un
marcador `[…]` en vez de un número. **Poner un número que no está en la fuente
sería inventar la norma**, que es exactamente lo que el procedimiento del
proyecto prohíbe.

---

## P-01 · Identificación del canal

**Fila 1 de la matriz** — *"Informar que SeguroLoTengo.com es marca y canal
digital de Interseguros, no aseguradora"* · Ley 4868/13, arts. 3, 7(a) y 7(d);
Ley 827/96, arts. 70-71; Res. SS SG. 223/17, numeral 9(c).

**Dónde iría:** pie permanente de las ocho pantallas, debajo de la cabecera
institucional que ya identifica a las dos entidades.

> SeguroLoTengo es la marca y el canal digital de venta electrónica de
> **Interseguros S.A.**, corredor de seguros inscripto en la Superintendencia
> de Seguros bajo Matrícula SIS N° 118. Interseguros S.A. **no es una compañía
> de seguros**: intermedia la contratación. El Seguro de Vida Oncológico CONFÍO
> lo emite y lo respalda **Alianza Garantía Seguros y Reaseguros S.A.**, que es
> la aseguradora y la única obligada al pago de las indemnizaciones.

**Hecho verificable:** las dos entidades, sus roles y la matrícula salen de
`src/domain/entidades.ts` y ya se muestran en la cabecera de todas las
pantallas.

**Decisión de Legal:** si la última frase —*"única obligada al pago"*— es la
formulación correcta o excede lo que corresponde afirmar en el canal.

---

## P-02 · Derecho de retracto

**Fila 64 de la matriz** — *"Informar el derecho de retracto aplicable a la
venta electrónica"* · Ley 4868/13, arts. 30(b) y 26(f); Ley 1334/98,
arts. 26-27.

**Dónde iría:** página propia enlazada desde el pie, y resumen en la pantalla
de confirmación.

> **Derecho de retracto.** Por tratarse de una contratación celebrada por medios
> electrónicos, podés retractarte de la contratación **sin expresar causa y sin
> penalidad** dentro del plazo de `[PLAZO]`, contado desde `[CÓMPUTO]`.
>
> Para ejercerlo alcanza con comunicarlo a
> **segurolotengo@interseguros360.com** desde el correo que declaraste, o desde
> el WhatsApp que verificaste, indicando el número de tu solicitud.
> No hace falta ningún formulario.
>
> Si ya se cobró el premio y no hubo siniestro, la devolución la tramita
> **Alianza Garantía Seguros y Reaseguros S.A.**; SeguroLoTengo asienta el
> pedido y te informa el estado. Si todavía no se cobró nada, no hay nada que
> devolver.

**Hechos verificables:** el correo está publicado y cerrado en la matriz
**para este uso**; el expediente ya sabe distinguir si hubo cobro acreditado; y
el trámite de devolución existe y se sigue paso a paso desde la consola (D-02).

**Decisión de Legal, y es bloqueante:** `[PLAZO]` y `[CÓMPUTO]`. La fila 64
manda informar el derecho pero no fija el término ni desde cuándo corre, y no
lo vamos a completar nosotros. También corresponde a Legal decidir si el
retracto se informa **antes** de contratar —además de después—, porque eso
cambia en qué pantalla aparece.

---

## P-03 · Datos personales y privacidad

**Fila 84 de la matriz** — *"Aplicar privacidad desde el diseño y minimización
de datos"* · Ley 4868/13, arts. 6(a) y 7(b); Constitución Nacional, arts. 33 y
36.

**Dónde iría:** página propia enlazada desde el pie de todas las pantallas.

> **Qué datos pedimos y para qué.** Para contratar este seguro pedimos: tu
> número de WhatsApp y tu correo, para verificarlos y entregarte los
> documentos; las fotografías de tu cédula y una selfie en vivo, para verificar
> que sos vos; los datos que figuran en tu cédula; tus datos de domicilio,
> laborales y económicos, que exige el formulario de identificación de persona
> física; tus declaraciones de salud y tu condición de Persona Expuesta
> Políticamente, que determinan si la emisión puede ser automática; y los datos
> de facturación. **No pedimos ningún dato que no se use para alguna de esas
> cosas.**
>
> **Quién los trata.** Interseguros S.A. como corredor y Alianza Garantía
> Seguros y Reaseguros S.A. como aseguradora, y los proveedores que hacen falta
> para ejecutar la contratación: verificación de identidad, firma electrónica,
> procesamiento del pago y entrega de los documentos.
>
> **Qué no hacemos.** Tus respuestas de salud y tu condición PEP **no salen**
> hacia analítica, publicidad, gestión comercial ni servicios de inteligencia
> artificial. El número completo de tu tarjeta y su código de seguridad **no se
> almacenan en ningún momento**: los procesa Bancard.
>
> **Tus derechos.** Podés pedir acceso, actualización, rectificación y
> eliminación de tus datos escribiendo a
> **segurolotengo@interseguros360.com**. La eliminación tiene el límite de los
> plazos de conservación que la normativa de seguros y de prevención de lavado
> impone a los documentos de una contratación.
>
> **Cuánto los conservamos.** `[PLAZOS DE CONSERVACIÓN]`.

**Hechos verificables, todos:** la lista de datos es exactamente la que el
sistema pide; el aislamiento de salud y PEP es una regla que el código hace
imposible de violar y tiene un test que falla si alguien la rompe; y lo del PAN
y el CVV también.

**Decisión de Legal:** los `[PLAZOS DE CONSERVACIÓN]` —la fila 83 de la matriz
habla de 2, 5 y 10 años según el documento, y hay que decidir cómo se le
explica eso a una persona— y si la enumeración de proveedores debe nombrarlos
uno por uno.

---

## P-04 · Cookies

**Fila 85 de la matriz** — *"Informar el uso de cookies y permitir rechazar las
no necesarias"* · Ley 4868/13, art. 30(c).

**Dónde iría:** aviso al entrar, con enlace a la página de privacidad.

> **Cookies.** Este portal usa **tres cookies propias y estrictamente
> necesarias** para sostener tu trámite: mantienen tu sesión, recuerdan en qué
> solicitud estás y vinculan el código de verificación que te enviamos. Sin
> ellas el trámite no puede continuar. Duran ocho horas, no son accesibles
> desde el navegador y no se comparten con terceros.
>
> **No usamos cookies de analítica, de publicidad ni de terceros**, así que no
> hay ninguna que puedas rechazar sin impedir la contratación. Si en el futuro
> incorporáramos alguna, te la vamos a pedir antes de instalarla.

**Hechos verificables:** son exactamente `slt_sesion`, `slt_expediente` y
`slt_otp`, todas `HttpOnly`, `SameSite=Lax`, con vida de ocho horas; el portal
no carga ninguna herramienta de analítica. La preferencia de tema claro/oscuro
se guarda en el navegador, no es una cookie y no identifica a nadie.

**Decisión de Legal:** si con este aviso alcanza —dado que **no hay cookies no
necesarias que rechazar**— o si la fila 85 exige igualmente un panel con
opciones. Es la única propuesta donde proponemos **no** construir algo, y
conviene que quede por escrito quién lo decidió.

---

## P-05 · Lista de orígenes de fondos

**Filas 16 y 18 de la matriz** (FIPF · Res. SEPRELAD 71/19). El formulario pide
el origen de los fondos como dato abierto; ofrecerlo como lista hace que el
dato sea comparable entre expedientes en vez de depender de cómo lo escriba
cada persona.

**Ya está implementado**, con esta lista rotulada como propuesta:

> Ingresos laborales (sueldo o salario) · Actividad comercial o empresarial ·
> Ejercicio de profesión independiente · Jubilación o pensión · Rentas o
> inversiones · Venta de bienes · Herencia o donación · Remesas del exterior

**Decisión de cumplimiento de Alianza:** confirmarla, corregirla o
reemplazarla. El FIPF de referencia trae un solo ejemplo ("Ingresos
laborales"), así que estas ocho opciones las propuso el equipo técnico
cubriendo las fuentes de ingreso corrientes del mercado local. Es una compuerta
de producción, como los códigos `CDXXXXX`.

---

## Textos nuevos que ya están implementados y conviene que Legal mire

Los tres se aceptan en pantalla y quedan guardados en la evidencia con su
versión. Están en uso en el demo; si Legal los corrige, se cambia el literal y
**se sube la versión**, porque los expedientes ya firmados conservan el que
aceptaron.

### P-06 · Autorización del paso 7 (CHG-37) — `P7-ACEPTACION-CERTIFICADO-v1`

> Una vez pagado el premio, acepto expresamente que se emita el Certificado de
> Cobertura Provisional y que la póliza y la factura electrónica se envíen a
> mis canales verificados.

Es la única casilla obligatoria del paso de pago. Sin marcarla no se abre
ninguna operación en Bancard.

### P-07 · Autorización del envío del código, paso 2 — `P1-AUTORIZACION-CANAL-v2`

> Al presionar el botón autorizo el envío de un código por WhatsApp con el
> único fin de verificar que este número es mío y continuar con la contratación
> del seguro. Esta autorización no incluye publicidad ni ofertas.

La última frase es deliberada: el consentimiento comercial vive separado,
desmarcado y en la última pantalla (D-01).

### P-08 · Consentimiento inicial, paso 3 — `P3-AUTORIZACION-INICIAL-v2`

> Al presionar el botón TENGO TODO LISTO Y CONTINUAR acepto que todos mis datos
> personales proporcionados, incluyendo información de salud, fotografías y
> demás información brindada, sean utilizados exclusivamente para verificar mi
> identidad, evaluar el riesgo y generar la documentación contractual vinculada
> a la contratación del seguro y al pago correspondiente. Si no fuera posible
> emitir automáticamente, autorizo el envío de mi caso a Interseguros y Alianza
> Garantía para su análisis y que puedan contactarme. Esto no contrata ni
> autoriza un pago.

---

## Lo que este documento no resuelve

- **La firma del cliente.** Code100 respondió que su plataforma firma
  exclusivamente con certificado cualificado, así que no puede recibir la firma
  del cliente de CONFÍO. Eso está en el informe a la Gerencia del 20-ago y
  necesita las decisiones D1, D2 y D3 que ese informe pide. Ninguna pantalla
  nombra al proveedor, así que la definición no obliga a reescribir textos.
- **Los datos institucionales pendientes de D-19** (teléfono y correo de
  atención de Interseguros, correo de Alianza): lo que falta se omite en
  pantalla en vez de mostrarse como marcador.
