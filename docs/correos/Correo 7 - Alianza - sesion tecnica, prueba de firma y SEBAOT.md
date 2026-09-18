# Correo 7 · Alianza — sesión técnica, prueba de firma y SEBAOT

**Estado: BORRADOR, sin enviar.** Redactado el 18-sep-2026 en respuesta a
`docs/Integraciones/Alianza - Respuestas SFTP, firma y emision.md`.
Análisis que lo sustenta: `docs/ANALISIS_RESPUESTAS_ALIANZA.md`.

**Antes de enviarlo, Andres decide una cosa:** si creamos el conector **ahora**,
sin la clave de host, para mandarles las tres IP y que habiliten el firewall en
paralelo (sección 3.4 de `docs/CONFIGURACION_SFTP_ALIANZA.md`), o si esperamos a
la sesión técnica y mandamos todo junto. El párrafo de las IP está escrito en las
dos variantes; hay que borrar la que no corresponda.

Lo que **no** va en este correo, a propósito: la retención de archivos (2.7).
Contestaron que es asunto interno y es defendible; eso va al acuerdo de servicio,
no a un correo técnico.

---

**Asunto:** RE: Pruebas de archivos SFTP — sesión técnica, prueba de firma y formato de emisión

Estimados:

Gracias por las respuestas. Con eso quedan cerrados el esquema de firmantes, el
número de póliza y la periodicidad del envío, así que vamos directo a lo que
falta para hacer la primera prueba.

**1. Sesión técnica**

Les tomamos la propuesta de verlo en conjunto. Para esa reunión necesitamos
cuatro datos, y con ellos creamos la conexión el mismo día:

1.1. La clave pública de host de su servidor, y su huella. La huella se la
confirmamos leyéndola por teléfono, para no depender de un solo canal.
1.2. El usuario del SFTP, y que nos confirmen que aceptan autenticación con
clave (les mandamos nuestra clave pública, sin contraseña).
1.3. Los algoritmos de clave y cifrado que admite el servidor.
1.4. Los nombres exactos de las carpetas y, sobre todo, **cuál de ellas vigila
el firmador cada 30 segundos** y en cuál deja los documentos firmados.

Díganos dos o tres horarios y nos acomodamos.

*[VARIANTE A — si creamos el conector antes de la sesión]*
Les adjuntamos ya las **tres direcciones IP de salida** y nuestra clave pública,
así pueden ir habilitando el firewall en paralelo: son fijas y no cambian cuando
completemos la configuración en la sesión.

*[VARIANTE B — si esperamos]*
Apenas tengamos esos datos les enviamos las tres direcciones IP de salida y
nuestra clave pública, dentro de las 48 horas.

**2. Envío de archivos**

Tomamos nota: les mandamos **únicamente el PDF**, sin ningún archivo adicional
al lado.

2.1. Para que su firmador nunca tome un archivo a medio subir, vamos a dejarlo
primero en una carpeta de tránsito y recién moverlo a la carpeta que ustedes
vigilan cuando terminó de subir. Así, todo lo que aparece en la carpeta del
firmador está completo. Solo necesitamos que creen esa carpeta de tránsito, por
ejemplo `entrada/en-curso`.
2.2. ¿Nos confirman que el documento firmado conserva el mismo nombre del que
les enviamos?

**3. Prueba de firma**

Queremos hacer cuanto antes la prueba del PDF en blanco que nos ofrecieron, en
el ambiente de pruebas. Con el archivo devuelto verificamos de nuestro lado el
formato de la firma y el sello de tiempo, así que no hace falta que nos
contesten nada más sobre eso.

3.1. Una sola aclaración: en ese ambiente, ¿la firma se aplica con un
certificado de prueba o con el certificado cualificado real? Lo preguntamos para
que ningún documento de prueba quede con una firma con valor legal.

**4. Detección de fallas**

Entendido que el firmador no informa errores. De nuestro lado vamos a poner un
plazo de espera: si un certificado no vuelve firmado dentro de ese plazo, les
avisamos por teléfono, como nos indicaron. ¿A qué número y en qué horario
conviene llamar fuera del horario de oficina, teniendo en cuenta que la firma
funciona 24/7?

**5. Emisión**

5.1. ¿Nos pasan el contacto de SEBAOT para el formato de importación? Mientras
tanto, y para no frenar, les proponemos nosotros un formato a partir de la lista
de campos del punto 4.5 de nuestro correo anterior, y ustedes lo ajustan con
Emisión.
5.2. ¿Cuál es el horario real del proceso de emisión? Lo necesitamos para no
prometerle al cliente un plazo que no se pueda cumplir: hoy la pantalla le dice
que la póliza está en preparación, sin fecha.

**6. Certificado**

Nos falta el **modelo de Certificado de Cobertura Provisional aprobado** por
ustedes, para generarlo con ese diseño.

Quedamos a la espera de los horarios para la sesión.

Saludos,
