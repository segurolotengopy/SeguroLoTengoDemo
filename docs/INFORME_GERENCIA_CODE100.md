# Informe a la Gerencia — Firma electrónica del Seguro CONFÍO

**Para:** Gerencia de Interseguros S.A.
**De:** Equipo técnico de SeguroLoTengo — AAB1 (operador tecnológico)
**Fecha:** 20 de agosto de 2026
**Asunto:** Respuestas de Code100 sobre la firma electrónica: un punto bloqueante, cinco advertencias y seis recomendaciones
**Estado:** requiere decisión de la Gerencia

> **Actualización del 27 de agosto de 2026.** La Gerencia decidió la **opción C**. Además, la revisión normativa posterior encontró respaldo expreso: el **artículo 4 de la Resolución SS.SG. N.º 210/2025** admite que el proponente firme la propuesta y los documentos precontractuales con firma electrónica simple respaldada por un mecanismo de autenticación previo (OTP u otro medio idóneo). El detalle está en `docs/VALIDACION_LEGAL_FIRMA_INTERNA.md`. Para las firmas cualificadas de Interseguros y Alianza puede contratarse **cualquier prestador cualificado habilitado en Paraguay**; Code100 sigue siendo la primera opción.

> Versión técnica de este informe: `docs/PLAN_ACCION_CODE100.md`.
> Respuestas originales del proveedor: `docs/Integraciones/Code100 - Respuestas C1 a C12.md`.

---

## Resumen ejecutivo

El 12 de agosto le enviamos a Code100 doce consultas técnicas sobre la firma electrónica. Ya respondieron todas, por escrito y con buen nivel de detalle. La respuesta más importante es un **no**:

> **La plataforma de firma de Code100 solo admite firmas hechas con un certificado digital que el firmante ya tenga emitido a su nombre.**

El cliente de CONFÍO no tiene ese certificado. Obtenerlo cuesta dinero, exige un trámite de identificación y demora días. Dicho en términos comerciales: **tal como está hoy, la plataforma de Code100 no puede recibir la firma de un cliente que compra un seguro en minutos desde el celular.**

Esto no detiene el proyecto ni invalida al proveedor: Code100 sigue siendo apto para las firmas de Interseguros y de Alianza, que sí son empresas con certificado — y no es el único, hay varios prestadores cualificados habilitados en Paraguay. Lo que hay que decidir es **cómo firma el cliente**, y esa es una decisión de negocio y legal, no técnica. Recomendamos que la firma del cliente la resuelva la propia plataforma SeguroLoTengo, con dictamen legal previo (Recomendación 1).

Necesitamos **tres decisiones de la Gerencia** y hay **seis acciones** ya listas para ejecutar. Mientras tanto el desarrollo continúa: todo lo que no depende de esta definición sigue avanzando.

---

## 1. El punto bloqueante: cómo firma el cliente

**Lo que el proyecto asumía.** El cliente firma la Solicitud de Seguro y el formulario FIPF con una *firma electrónica simple*, identificado por lo que la plataforma ya hace: foto de la cédula, selfie con verificación biométrica y un código de un solo uso enviado a su celular o correo.

**Lo que Code100 respondió.** Su servicio firma únicamente con *certificado cualificado*: el equivalente digital de firmar ante escribano. Se tramita una vez, tiene costo, tiene vencimiento y exige identificación previa del titular. No ofrecen ninguna otra modalidad, ni tienen documentación alternativa.

**Por qué importa comercialmente.** Exigirle ese certificado al cliente equivale a pedirle un trámite previo, arancelado y con demora, antes de poder comprar. En un producto de venta electrónica masiva, es equivalente a no poder vender.

**Qué dice la matriz de cumplimiento del proyecto.** La fila 34 exige que el cliente firme electrónicamente la Solicitud y el FIPF. La fila 36 —usar Code100 para esa firma— aclara textualmente que *"no es exigencia legal, es diseño del proceso"*. Y la matriz distingue la firma del cliente de la firma cualificada de Alianza, que sí está en la fila 39. **La lectura definitiva de esas filas le corresponde al asesor legal**; nosotros solo dejamos constancia de que cambiar de mecanismo para la firma del cliente no contradice ninguna fila de la matriz vigente.

### Las cuatro salidas posibles

| Opción | En qué consiste | Evaluación |
| :---- | :---- | :---- |
| **A** | El cliente tramita su certificado antes de contratar | **Descartar.** Rompe el producto: nadie compra un seguro si antes tiene que hacer un trámite pago. |
| **B** | Esperar a que Code100 desarrolle la firma simple | **No planificable.** No tienen fecha. Corresponde preguntarlo, no esperarlo. |
| **C** | **La firma del cliente la resuelve SeguroLoTengo**, y un prestador cualificado (Code100 u otro habilitado) queda para las firmas de Interseguros y Alianza | **Recomendada.** No agrega proveedores ni costos nuevos, y reutiliza lo que la plataforma ya hace: verificación de identidad, código de un solo uso y registro de evidencia. |
| **D** | Contratar otro proveedor para la firma del cliente | Solo si el asesor legal rechaza la opción C. Implica una búsqueda, una negociación y un contrato nuevo. |

**Un dato que refuerza la opción C:** Code100 confirmó que su servicio **no registra la dirección IP ni el dispositivo del firmante**, y que **no emite un acta de evidencias descargable**. Es decir, aun firmando el cliente con Code100, el respaldo probatorio exigido por la fila 42 de la matriz tendríamos que producirlo y conservarlo nosotros igual. La opción C no agrega esa obligación: la hace explícita.

**Lo que hay que sopesar en contra de la opción C, sin adornos:** una firma simple respaldada por nuestro propio registro tiene menos fuerza probatoria ante un litigio que una firma cualificada, y su solidez depende íntegramente de la calidad de ese registro. Ese es exactamente el punto que el asesor legal debe resolver antes de que se escriba una línea de código.

---

## 2. Cinco advertencias que no bloquean, pero cambian costos y plazos

### 2.1 Cada póliza podría requerir dos firmas manuales — *impacto alto, sin confirmar*

Después del cliente firman Interseguros y Alianza. Code100 explicó que **cada firmante se autentica personalmente** para autorizar el uso de su certificado. Si eso también rige para las firmas de las empresas, cada póliza emitida necesitaría que una persona de Interseguros y una de Alianza firmen a mano, expediente por expediente. Con volumen, es un cuello de botella operativo y un costo permanente de personal.

Ya está formulada la consulta al proveedor sobre si existe firma automática (desatendida) para personas jurídicas. **La respuesta condiciona el modelo operativo de la emisión**, no solo el desarrollo.

### 2.2 Las tres firmas deben aplicarse una después de la otra — *impacto bajo*

El diseño preveía que Interseguros y Alianza firmaran en paralelo. Code100 confirmó que eso produce dos documentos distintos e incompatibles: hay que firmar en fila india. Es un ajuste de diseño interno, invisible para el cliente. Corresponde corregir la documentación del proyecto, incluida la fila 37 de la matriz, que hoy dice "en paralelo" y aclara que ningún artículo impone ese orden.

### 2.3 Si el cliente rechaza la firma, el sistema no se entera — *impacto medio*

La plataforma no informa que el firmante rechazó: solo se puede saber que el plazo venció. En la práctica, un cliente que decide no firmar queda esperando hasta que se cumplan las 24 horas, y recién ahí se inicia la devolución del dinero. Code100 ofreció acordar ese detalle durante la certificación; hay que pedirlo formalmente.

### 2.4 La validez del documento a largo plazo es menor que la deseable — *impacto medio*

El documento firmado lleva sello de tiempo, lo que fija de manera oponible el momento de la firma. Pero **no incorpora el nivel de conservación de largo plazo**: dentro de varios años, su verificación dependerá de información externa que hoy no queda guardada dentro del archivo. En un seguro de vida, donde el reclamo puede ocurrir muchos años después de la contratación, esa diferencia es relevante. Code100 indicó que elevarlo es una configuración de su servicio; hay que solicitarlo por escrito antes de pasar a producción.

### 2.5 No entregaron las credenciales del ambiente de pruebas — *impacto en el cronograma*

Confirmaron que el ambiente de pruebas existe y está operativo, pero los tres datos concretos para usarlo —dirección, usuario y contraseña, y un certificado de prueba— vinieron en blanco. **Sin eso no se puede empezar a integrar ni a certificar.** Es el pedido más urgente y el más fácil de resolver.

> **Un riesgo técnico adicional, que resolvemos nosotros y no requiere decisión de la Gerencia:** ante una falla de comunicación, el servicio de Code100 puede llegar a firmar el mismo documento dos veces. Ya está previsto el control que lo impide de nuestro lado, y se probará explícitamente durante la certificación.

---

## 3. Decisiones que necesitamos de la Gerencia

| # | Decisión | Quién decide | Si se demora |
| :---- | :---- | :---- | :---- |
| **D1** | Cómo firma el cliente: opción A, B, C o D del cuadro anterior | Gerencia de Interseguros, con dictamen del asesor legal | Se detiene todo el desarrollo de la etapa de firma. El resto del sistema sigue. |
| **D2** | Aceptar que el respaldo probatorio de la firma del cliente lo produzca y conserve SeguroLoTengo (identidad verificada, código de un solo uso, IP, fecha, hora y huella digital de cada documento) | Asesor legal, con conformidad de Alianza | Es la condición de la opción C: sin esta aceptación, la opción C no puede ejecutarse. |
| **D3** | Quiénes son los titulares de los certificados de firma de Interseguros y de Alianza, y quién los custodia y renueva | Gerencia de Interseguros y de Alianza | La emisión de pólizas no puede automatizarse ni certificarse sin titulares definidos. |

---

## 4. Recomendaciones

1. **Adoptar la opción C —la firma del cliente la resuelve SeguroLoTengo— sujeta a dictamen legal previo.** Es la única salida que preserva el producto tal como fue concebido, sin sumar proveedores ni costos por operación. *Responsable: Gerencia + asesor legal. Plazo sugerido: una semana.*
2. **Reclamar por escrito a Code100 las credenciales del ambiente de pruebas y su especificación técnica vigente.** Es lo que destraba el cronograma de integración. *Responsable: equipo técnico. Plazo: inmediato.*
3. **Consultar formalmente si las firmas de Interseguros y Alianza pueden hacerse en forma automática.** De la respuesta depende que la emisión sea automática o que requiera dos personas firmando cada póliza. *Responsable: equipo técnico. Plazo: inmediato; la respuesta condiciona el modelo operativo.*
4. **Solicitar la elevación del nivel de conservación del documento firmado.** El propio proveedor lo ofreció como cambio de configuración, sin desarrollo de nuestra parte. *Responsable: equipo técnico. Plazo: antes del pase a producción.*
5. **Pedir que el rechazo del firmante sea informado**, dentro del proceso de certificación que Code100 ya ofreció acordar. *Responsable: equipo técnico. Plazo: durante la homologación.*
6. **Incorporar al contrato con Code100 los compromisos que hoy solo constan en un correo:** vigencia de 24 horas del enlace de firma, límites de uso, nivel de firma aplicado, ambiente de pruebas y soporte. La fila 80 de la matriz de cumplimiento pide formalizar responsabilidades con los proveedores. *Responsable: Gerencia + asesor legal.*

---

## 5. Qué sigue avanzando mientras tanto

La demostración funcional del sistema está completa y operativa: el recorrido íntegro de contratación puede mostrarse hoy. Ninguna de estas definiciones afecta la venta, la selección de plan, la verificación de identidad, las declaraciones, el pago ni la generación de documentos. **Lo único que queda a la espera es la conexión real con el servicio de firma.**

---

## Glosario

| Término | Qué significa |
| :---- | :---- |
| **Firma electrónica simple** | Firma respaldada por la identificación del firmante y por el registro de lo que hizo: quién, cuándo, desde dónde y sobre qué documento. No requiere trámite previo del cliente. |
| **Certificado cualificado** | Credencial digital emitida a nombre de una persona por una entidad autorizada, tras identificarla. Tiene costo, vencimiento y trámite. Es lo único que acepta Code100. |
| **Ambiente de homologación** | Copia del sistema del proveedor destinada a pruebas, con datos ficticios. Es el paso obligatorio antes de operar con clientes reales. |
| **Sello de tiempo** | Constancia, emitida por un tercero, de que un documento existía y estaba firmado en un momento determinado. |
| **Nivel de conservación de largo plazo** | Configuración que guarda dentro del propio documento todo lo necesario para verificarlo años después, sin depender de servicios externos. |
