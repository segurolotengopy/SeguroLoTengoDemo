# Borrador de respuesta a Alianza — SFTP, firma y emisión

**Estado: borrador, no enviado.** Redactado el 14-sep-2026 en respuesta al correo
de Alianza que pidió la IP pública para su firewall, avisó que el servidor SFTP
está listo y adjuntó un TXT de ejemplo de migración de vida colectivo.

**Antes de enviarlo:**

1. **Cerrar P1 con Rodrigo** (¿Alianza firma también la Solicitud + FIPF, o solo
   el CPC?) y dejar en el punto 1 la variante que corresponda.
2. **Completar la fecha de las IP.** La plataforma sale por Amplify, que no
   tiene IP de salida fija. Recomendado: conector SFTP de AWS Transfer Family
   (IP estáticas, lee y escribe S3 directo). Hay que registrarlo en
   `docs/Tabla de Integraciones externas - Tabla.csv` antes de escribir código.
3. Si el PDF de legal o el modelo de CPC cambian algo, ajustar el punto 1.

Análisis completo del TXT y de la captura del SFTP: entrada del 14-sep de
`docs/BITACORA.md`. Del TXT, lo esencial: tabulado, CRLF, sin encabezado, un
tabulador doble en la fila 3 que corre todas las columnas, beneficiario en texto
libre, y el premio es el 0,7023 ‰ de la columna 4. Es un formato de migración,
no de emisión. **Tiene nombres y cédulas reales y no entra al repositorio.**

---

**Asunto:** RE: Pruebas de archivos SFTP – IP pública y formato de intercambio (SeguroLoTengo)

Estimados:

Muchas gracias por la información y por tener el servidor listo. Antes de
pasarles la IP les hago una precisión sobre mi correo anterior, y les dejo
algunas consultas numeradas para que puedan responderlas en línea y arranquemos
las pruebas sin retrabajo.

**1. Documentos a firmar**

- **Certificado de Cobertura Provisional:** lo generaremos desde la plataforma
  con el modelo aprobado por ustedes, una vez que el cliente haya firmado la
  Solicitud + FIPF y el pago esté acreditado, y se lo enviaremos por SFTP para
  que lo firmen con su firma cualificada y nos lo devuelvan. Es el documento
  más urgente, porque el cliente lo espera en la pantalla de confirmación.
- **Solicitud de Seguro + FIPF (un único PDF):**
  - *[Variante A — si Alianza firma]* lo firma primero el cliente, con firma
    electrónica no cualificada antes del pago; después del pago firman
    Interseguros y Alianza, con firma cualificada, una después de otra sobre el
    mismo archivo. Se lo enviaremos firmado por el cliente y por Interseguros
    para que agreguen la suya.
  - *[Variante B — si Alianza no firma]* lo firman el cliente, antes del pago, e
    Interseguros, con firma cualificada, después del pago. Se lo enviaremos ya
    firmado, para su archivo, la verificación del FIPF y la emisión de la póliza.

1.1. ¿Coinciden con este esquema?

**2. Conexión y ambiente de pruebas**

Nuestra plataforma opera en AWS y estamos habilitando una salida con IP fija
dedicada a este intercambio. Les enviaremos la o las direcciones a más tardar el
**[fecha]**.

2.1. ¿Pueden habilitar dos direcciones IP (principal y respaldo)?
2.2. ¿Cuál es el host o la IP pública y el puerto del servidor? En la captura figura 10.0.7.101, que es una dirección interna.
2.3. ¿Nos pasan la huella (fingerprint) de la clave del servidor, para validarla en la primera conexión?
2.4. ¿Podemos autenticarnos con clave SSH en lugar de contraseña? Les enviamos nuestra clave pública.
2.5. ¿Pueden asignarnos carpetas dedicadas, separadas por tipo y dirección? Por ejemplo `entrada/emision`, `entrada/documentos`, `salida/cpc`, `salida/respuestas`, y que no sean el escritorio de un usuario.
2.6. ¿Tienen un ambiente de pruebas separado del de producción? Y para las pruebas del certificado, ¿pueden firmar con un certificado de prueba? Así ningún documento de prueba queda firmado con la firma cualificada real. De nuestro lado, en pruebas solo enviaremos datos ficticios.
2.7. ¿Cuánto tiempo conservan los archivos en el servidor una vez procesados, y quién los retira? Los documentos llevan datos personales y declaraciones de salud.

**3. Firma de los documentos**

3.1. ¿Qué tiempo máximo de respuesta pueden garantizar, además del estimado de 5 minutos? ¿Funciona las 24 horas, incluidos fines de semana y feriados? La cobertura comienza 24 horas después del pago, y el certificado tiene que estar en manos del cliente antes.
3.2. ¿Cuál es el procedimiento si el firmador está fuera de servicio? ¿Cómo nos enteramos?
3.3. ¿Cómo evitamos que se procese un archivo que todavía se está subiendo? Proponemos subir con extensión `.tmp` y renombrar al terminar, y que ustedes hagan lo mismo al depositar los documentos firmados.
3.4. Formato de la firma: ¿PAdES? ¿Incluye sello de tiempo? ¿La firma es visible?
3.5. ¿Cómo se llama el archivo que nos devuelven, y cómo informan un error (archivo de respuesta, código de error)?
3.6. Su firmador, ¿agrega la firma como **actualización incremental** del PDF? Es imprescindible para no invalidar las firmas anteriores del cliente y de Interseguros.
3.7. ¿Pueden priorizar los certificados sobre las solicitudes, o se procesan en orden de llegada?

**4. Registro para la emisión**

Gracias por el TXT de ejemplo. Entendemos que es el formato de migración de vida
colectivo, y este es un seguro individual con otros datos. Además, en la fila 3
hay un tabulador de más que corre todas las columnas, y el beneficiario va en
texto libre. Por eso les pedimos:

4.1. ¿Tienen una especificación de importación para SEBAOT de este producto (diccionario de datos: campo, tipo, largo, obligatoriedad y valores admitidos)? Si no la tienen, les proponemos nosotros el formato.
4.2. Formato del archivo: codificación (¿UTF-8 o ANSI? Hay nombres con ñ y tildes), separador, encabezado y registro de control con cantidad de registros, formato de fechas y montos sin separador de miles.
4.3. Periodicidad: ¿un archivo por caso apenas se acredita el pago, o un lote diario?
4.4. Número de póliza: ¿la póliza conserva el número de nuestra propuesta, o SEBAOT asigna un número propio?
4.5. Estos son los datos que podemos entregar por caso. Indíquennos cuáles necesitan y en qué orden:
- Propuesta: número de propuesta, producto (15-VI.0002), plan, suma asegurada, premio (prima neta e IVA), fecha de la solicitud y de la firma del cliente.
- Asegurado: nombres, apellidos, cédula, fecha de nacimiento, sexo, estado civil, nacionalidad, país de nacimiento y de residencia.
- Contacto: celular (WhatsApp) verificado, correo, domicilio y ciudad.
- Datos del FIPF: situación laboral, actividad económica, ocupación u oficio, profesión, empleador, ingreso mensual y origen de los ingresos.
- Beneficiario: herederos legales o persona designada (nombre, domicilio, parentesco y cédula si la informó).
- Facturación: nombre y cédula o RUC.
- Pago: fecha y hora, monto, medio (tarjeta de crédito, débito o QR), referencia y número de autorización de Bancard. Nunca el número completo de la tarjeta.
- Documento: nombre del PDF de la Solicitud + FIPF y su huella SHA-256.

Las respuestas de la declaración de salud están en la Solicitud firmada. Salvo
que las necesiten como datos para SEBAOT, preferimos no repetirlas en el TXT.

**5. Respuestas de Alianza**

¿Cómo nos informan cada etapa? Nos sirve un archivo de respuesta en
`salida/respuestas`, identificado por el número de propuesta:

5.1. Archivo recibido (con la cantidad de registros).
5.2. Registros aceptados y rechazados, con el motivo del rechazo. Para reenviar, proponemos mandar el registro corregido con el mismo número de propuesta, y que un reenvío nunca genere una póliza duplicada.
5.3. Pólizas emitidas (número de póliza, fecha de emisión y referencia de la factura electrónica).
5.4. Pólizas enviadas al cliente (fecha y canal).
5.5. Errores posteriores a la aceptación (por ejemplo, en la emisión o la facturación).

**6. Pagos**

Como el cobro se hace por Bancard directamente a las cuentas de Alianza:

6.1. ¿Necesitan un archivo de conciliación de pagos aparte (diario, por ejemplo), o les alcanza con los datos del pago dentro del registro de emisión? Si hay devoluciones, ¿cómo quieren que se las informemos?

Si les resulta práctico, podemos coordinar una llamada técnica corta para
cerrar estos puntos, y ya con la IP habilitada hacemos la primera prueba con
datos ficticios.

Quedo atento. Saludos cordiales,

**Andres Alberdi**
AAB1 – Operador tecnológico de SeguroLoTengo
