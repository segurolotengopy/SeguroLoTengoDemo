# Borrador de correo a Rodrigo: pantallas v4 y manual funcional

**Estado: borrador, no enviado.** Redactado el 15-sep-2026 a partir de
`02-pantallas-v4/ANALISIS.md` (§6 y §7) y de las decisiones D-28 a D-42. Las
preguntas están numeradas para que se puedan responder en línea. Cuando llegue
la respuesta, cada punto se asienta en `DECISIONES.md` y en la bitácora.

---

**Asunto:** Pantallas v4 y manual funcional: confirmaciones y consultas para avanzar con el desarrollo

Rodrigo, buen día:

Gracias por el handoff de pantallas y el manual funcional del 14-sep. Ya los
analizamos contra la plataforma y arrancamos el desarrollo. Te dejo los puntos
numerados para que puedas responder en línea. Algunos son para Legal; los marco.

**A. Lo que tomamos como definición (avisanos si algo no corresponde)**

1. **Firmas, versión preliminar.** La Solicitud + FIPF lleva dos firmas: la del cliente (no cualificada, con OTP web) y la de Interseguros (cualificada, Code100). Alianza no firma la propuesta. El Certificado de Cobertura Provisional lo genera Interseguros desde SeguroLoTengo, con el modelo aprobado por Alianza, y lo firma Alianza. La página 9 del manual dice que Alianza firma la Solicitud + FIPF y que emite el CPC. ¿Podés corregirla, o confirmarnos cuál vale?
2. **Firma de Interseguros en la primera fase.** Se aplica en lote, por fuera del sistema, después del pago. La plataforma entrega un lote de PDF con su manifiesto y recibe los firmados. Necesitamos saber qué software de firma se va a usar y probarlo con un documento de prueba, porque la firma tiene que agregarse de forma **incremental**, sin reescribir el PDF. Si no, se invalida la del cliente.
3. **Orden de autoridad.** Cuando el manual y el arte difieren, seguimos el manual. Por ejemplo: el reenvío del código espera 60 s (en los artes figuran 30 s y 51 s); el tercer bloque de Consentimientos es informativo, sin casilla; y el botón CONTINUAR arranca deshabilitado (en los artes de 04A y 04D figura habilitado).
4. **Datos extraídos (03D).** Se pueden editar y cada cambio queda registrado. La edad y el control de cédula se siguen calculando con lo que se leyó de la cédula, no con lo editado.
5. **Plazo de pago** de 10 minutos después de la firma del cliente. **Contingencia SMS** con el proveedor de AWS: en Paraguay el SMS llega desde un remitente variable y sin garantía de entrega.
6. **Tipografía.** Nimbus Sans no tiene licencia gratuita para uso web comercial. Usaremos **Arimo**, libre y de dibujo muy parecido. ¿Están de acuerdo?
7. **Trato.** Todos los textos van a salir en **voseo** («Verificá tu número», «Completá tus datos»). Los artes están mayormente en usted, con algunas partes en tú y en vos. Los consentimientos en primera persona no cambian. ¿Están de acuerdo?
8. **Primera fase sin modo oscuro.** En computadora, los bloques se ubican lado a lado. Como todos los artes son de celular, les vamos a mandar capturas de la versión de escritorio para aprobar.
9. **Pasos del indicador.** Usamos la numeración de los artes (02 = 1 de 5, 03A a 03D = 2 de 5, 03E = 3 de 5, 04A y 04D = 4 de 5). Proponemos que la revisión por PEP (03E2) muestre **3 de 5**, la etapa en que se detiene, y no 4 de 5. El `main_stage` del JSON no coincide con los artes y lo vamos a ignorar.

**B. Consultas**

10. **Mientras la firma de Alianza sobre el CPC no llega** (se estiman unos 5 minutos, o más si su firmador está caído), ¿qué ve y qué recibe el cliente en la confirmación?
11. **Documentos en la confirmación.** ¿Qué se descarga en el momento? Proponemos: la Solicitud + FIPF firmada por el cliente, el comprobante de pago y la constancia del acto de firma. Además, el CPC firmado cuando llegue, por WhatsApp y correo. La Solicitud con la firma de Interseguros llegaría después.
12. **Inicio de la cobertura.** El manual y los artes dicen «al acreditarse el pago». La plataforma calculaba hasta ahora «24 horas después del pago acreditado». ¿Cuál es la regla correcta? También define la fecha que va impresa en el CPC.
13. **«Canales verificados (WhatsApp y correo electrónico)»**, en Consentimientos. El correo se declara con doble tipeo y no se verifica con un código. ¿Cambiamos a «canales declarados», o hay que verificar el correo?
14. **Sexo (03D).** El arte lo pide como selector. La matriz de campos indicaba no preguntarlo y tomarlo de la cédula. ¿Lo precargamos desde la cédula y dejamos que se corrija, igual que los demás datos?
15. **Declaración de licitud y veracidad.** No tiene pantalla en v4. Proponemos que vaya en el PDF y se acepte al firmar, en la revisión final (04E). ¿Correcto?
16. **«Salir y descartar» (01B).** Por norma, los registros de la contratación no se pueden borrar. Proponemos que la sesión se cierre y la solicitud quede marcada como abandonada, conservando lo registrado. ¿Correcto?
17. **Premio o prima.** En la pantalla de planes aparecen las dos palabras («Premio total anual» y, en la aclaración, «prima»). ¿Cuál usamos?
18. **Material que falta:**
    - el **logo de SeguroLoTengo en vector** (SVG o PDF vectorial), porque solo lo tenemos en PNG;
    - los **textos en formato editable** (Word o similar), para no transcribirlos desde imágenes;
    - los **artes de 03E, 04E, 05A y 05B** cuando estén aprobados.
19. **Campos 31 a 35.** La definición del 07-sep los menciona como eliminados. ¿Cuáles son?

**C. Para Legal**

20. **Publicidad por WhatsApp.** En 03A la autorización de publicidad va dentro de la misma casilla obligatoria que el envío del código, así que no se puede verificar el número sin aceptar publicidad. Habíamos definido separarla en una casilla aparte, opcional y revocable, para que el consentimiento sea libre. ¿Legal valida que vaya junta?
21. **Cookies.** El aviso de Google Analytics es «He leído y entendido», sin opción de rechazar. La matriz de cumplimiento (fila 85) pide permitir rechazar las cookies no necesarias. ¿Legal valida el aviso sin opción? De nuestro lado, la analítica no va a recibir ningún dato personal, de salud, PEP ni de pago.
22. **Retracto.** El manual no incluye el derecho de retracto en Información legal ni en el menú. La matriz lo exige (fila 64). ¿Se elimina, o lo sumamos a Información legal?

Si les resulta más práctico, coordinamos una llamada corta para cerrar la parte A y avanzamos con la B por escrito.

Saludos,

**Andres Alberdi**
AAB1, operador tecnológico de SeguroLoTengo
