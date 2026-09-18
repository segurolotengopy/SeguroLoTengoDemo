# Correo 7 · Alianza — sesión técnica, prueba de firma y SEBAOT

**Estado: LISTO PARA ENVIAR, a la espera del OK de Andres.** Redactado el
18-sep-2026 en respuesta a
`docs/Integraciones/Alianza - Respuestas SFTP, firma y emision.md`.
Análisis que lo sustenta: `docs/ANALISIS_RESPUESTAS_ALIANZA.md`.

**Decidido (Andres, 18-sep):** se crea el conector ahora, sin esperar la clave
de host, para que Alianza habilite el firewall en paralelo a la sesión técnica
(sección 3.4 de `docs/CONFIGURACION_SFTP_ALIANZA.md`).

**El texto está completo.** El conector `c-f2f1ac065481446ab` se creó el
18-sep-2026 con sus tres IP, ya pegadas en el punto 1, y la clave pública SSH
también está. La privada vive en `~/slt-alianza-sftp` hasta cargarla en Secrets
Manager, y se borra ahí mismo.

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

Para que no tengan que esperar a la sesión, les dejamos ya lo nuestro.

**Nuestra clave pública SSH**, dedicada exclusivamente a este intercambio:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHdIE8bfK5v5ad8V9G0QK2O7c+PriRe4G8KnmPexNVU4 segurolotengo-alianza-sftp
```

Su huella, para que la contrasten:
`SHA256:LhMYdIDjLB7EINRgzAu50196WcKNDmC45cQ06Z//Prc`

Si su servidor no admite ed25519, avísennos y generamos una RSA de 4096 bits.

**Nuestras tres direcciones IP de salida**, para el firewall:

```
67.202.57.40
44.209.137.228
50.19.171.17
```

Las tres se usan indistintamente, así que hay que habilitar las tres. Son fijas
y no cambian cuando completemos la configuración en la sesión técnica.

**2. Envío de archivos**

Tomamos nota: les mandamos **únicamente el PDF**, sin ningún archivo adicional
al lado.

2.1. Para que su firmador nunca tome un archivo a medio subir, ya cambiamos la
forma de depositarlo: lo subimos primero a una carpeta de tránsito y recién lo
movemos a la carpeta que ustedes vigilan cuando la subida terminó. El
movimiento es instantáneo, así que todo lo que aparece en la carpeta del
firmador está completo. Lo único que necesitamos de ustedes es que creen esa
carpeta de tránsito, por ejemplo `entrada/en-curso`.
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
avisamos por mail, como nos indicaron. ¿A qué correo y en qué horario conviene
enviar fuera del horario de oficina, teniendo en cuenta que la firma funciona
24/7?

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
