# Análisis de las respuestas de Alianza (18-sep-2026)

Qué desbloquean, qué chocan con lo construido y qué hay que decidir.

**Fuente:** `docs/Integraciones/Alianza - Respuestas SFTP, firma y emision.md`
(original sin editar al lado). **Consulta de origen:**
`docs/recepcion/2026-09-14-interseguros/BORRADOR_CORREO_ALIANZA.md`, enviado por
Andres el 17-sep-2026.

---

## 0. Lo que hay que retener

| # | Hallazgo | Impacto |
| :---- | :---- | :---- |
| **G1** | Confirmaron el esquema de firmantes | **D-42 deja de ser preliminar** en su parte de firmantes |
| **G2** | Host y puerto: `138.186.63.132:2222` | Desbloquea `alianza_sftp_url`; el `apply` sigue trabado por la clave de host |
| **G3** | *"favor enviar el documento en PDF"* y ninguna palabra sobre `.tmp` | El adaptador manda **dos** archivos y usa `.tmp`: hay que cambiarlo o confirmarlo |
| **G4** | No hay archivo de error, ni acuse, ni respuestas (fase 1) | Un CPC que no vuelve **no avisa a nadie**: hace falta un temporizador y una alerta nuestra |
| **G5** | *"La firma se agrega sobre el documento original"* | Compatible con incremental, **no lo prueba**. Es el riesgo #1 del lote de firma |
| **G6** | Firma 24/7, **emisión manual** con horario sin definir | «Póliza en preparación» puede durar un fin de semana entero |
| **G7** | SEBAOT: *"podés conseguir con sebaot"* | El formato del TXT sigue sin dueño; bloquea la emisión |

---

## 1. Lo que queda confirmado

**El esquema de firmantes (A1.1).** Alianza firma **solo el CPC**; la Solicitud
+ FIPF lleva cliente e Interseguros y ellos no la firman. Es exactamente D-42, y
coincide con `src/domain/firmantes-documento.ts` y con la sección «Firmantes por
documento» de `CLAUDE.md`. **Consecuencia práctica:**
`INTERCAMBIO_ASEGURADORA_DOCUMENTOS=CPC`, sin `PROP`. La variable no tiene valor
por defecto justamente porque esto estaba abierto (P1); ya no lo está.

**El número de póliza (A4.4).** *"si se mantiene"*. Confirma lo que el sistema
hace desde D-08: el correlativo lo acuña el cierre del paquete documental y la
póliza lo conserva. No hay nada que cambiar.

**Lote diario para la emisión (A4.3)**, y el firmador **no compite** con la
emisión (A3.7): son dos caminos independientes, así que un lote diario grande no
retrasa un CPC.

**Fase 1 por Internet, VPN después (A2.8).** `infra/alianza-vpn.tf` se queda
apagado, como está. Nada que hacer.

---

## 2. G2 · El conector: lo que ya se puede y lo que no

Tenemos destino (`sftp://138.186.63.132:2222`) y nos falta lo demás:
**clave pública de host**, **usuario** y **algoritmos admitidos**, los tres
diferidos a la sesión conjunta (A2.3, A2.4).

`infra/alianza-sftp.tf` tiene una `precondition` que exige
`alianza_sftp_trusted_host_keys` no vacía, así que hoy el `apply` **corta**. La
salvaguarda es correcta y no hay que quitarla: sin la clave de host, el conector
le entregaría documentos con declaraciones de salud a cualquiera que conteste en
esa IP.

**Pero hay un camino intermedio documentado por AWS.** La guía de Transfer
Family dice que se puede crear el conector con `TrustedHostKeys` vacío:

> *"You have an option to create your connector while leaving the
> `TrustedHostKeys` parameter empty. However, your connector will not be able to
> transfer files with the remote server until you provide this parameter"*
> ([Create an SFTP connector](https://docs.aws.amazon.com/transfer/latest/userguide/create-sftp-connector-procedure.html))

Un conector así **no transfiere nada** —o sea, la salvaguarda se sostiene sola,
del lado del servicio— pero **ya tiene sus tres IP asignadas**. Eso permite
mandarle las IP a Alianza hoy y que habiliten su firewall en paralelo a la
sesión técnica, en vez de en serie. Las IP pertenecen al conector y sobreviven a
un `UpdateConnector`: agregar después la clave de host **no las cambia**; solo
destruirlo y recrearlo lo haría.

**Decisión para Andres.** Dos opciones:

| | Qué implica |
| :---- | :---- |
| **A. Crear el conector ahora, sin clave de host** | Las tres IP salen hoy; Alianza habilita el firewall mientras coordinamos la sesión. El conector no puede transferir hasta cargar la clave. Exige relajar la `precondition` de forma explícita y visible (una variable que diga que el conector queda inutilizable a propósito) |
| **B. Esperar la sesión técnica** | Un solo `apply`, sin código temporal. El firewall de Alianza se habilita después, y si tardan, se suma a la espera |

Recomiendo **A**: la habilitación de firewall del otro lado es la parte que no
controlamos, y el riesgo de crear un conector que no puede conectarse es nulo.

Lo que **no** cambia en ningún caso: la clave de host se confirma por un canal
distinto del que la trae (teléfono contra correo), y `ssh-keyscan` no sirve para
eso. Está en `docs/CONFIGURACION_SFTP_ALIANZA.md` §1.

---

## 3. G3 · «Solo PDF»: el adaptador manda dos archivos

Hoy `enviarDocumento` sube **dos** archivos por documento y los publica
renombrando:

1. `CPC-00018425-v1.json.tmp` → `.json` (código, correlativo, versión, huella
   SHA-256 y tamaño; ningún dato de la persona)
2. `CPC-00018425-v1.pdf.tmp` → `.pdf`

Alianza pidió *"favor enviar el documento en PDF para que se firme y se devuelva
de la misma forma"* y **no contestó** si su firmador ignora los `.tmp` y los
`.json`. Son dos riesgos distintos:

- **El `.json`.** Si su firmador toma todo lo que aparece en la carpeta, va a
  intentar firmar un archivo que no es un PDF. En el mejor caso lo ignora; en el
  peor lo devuelve roto o se traba. El metadato existía para comodidad de ellos
  —la huella y el tamaño para que puedan verificar— y ellos no lo quieren.
- **El `.tmp`.** Es más grave: un firmador que no filtre por extensión puede
  tomar un PDF a medio subir, firmar un archivo truncado y devolverlo. Ese
  documento **no empareja** con el enviado (`NO_EMPAREJA` del lote de firma) y el
  CPC de un cliente real nunca se entrega.

**Implementado el 18-sep-2026**, con el OK de Andres. Dos cambios en el
adaptador y en el mock, ninguno en el puerto:

1. **El metadato dejó de viajar.** `ConfiguracionIntercambioAseguradora.enviarMetadato`,
   apagado por defecto y encendible con `INTERCAMBIO_ASEGURADORA_METADATO=true`
   para otra aseguradora que sí lo quiera. Nuestra verificación no lo necesita:
   la huella la tenemos y la recalculamos al recibir.
2. **El `.tmp` se reemplazó por una carpeta de tránsito.** El PDF se sube a
   `/entrada/en-curso/` y se **mueve** a `/entrada/documentos/` al terminar, con
   el mismo `StartRemoteMove` que ya usaba `archivarRecibido`. Un archivo
   aparece en la carpeta vigilada solo cuando está completo, **sin depender de
   que el firmador entienda extensiones**. El sufijo `.tmp` sigue vivo para el
   otro sentido: es lo que le pedimos a Alianza al depositar, y la recepción lo
   hace cumplir.

Con tests: que solo viaje el PDF, que la carpeta del firmador esté vacía hasta
la publicación, y que con el metadato encendido el PDF se mueva último.

La opción 2 es más robusta que insistir con el `.tmp` y no le pide nada a
Alianza salvo crear una carpeta más, algo que ya dijeron que no es problema
(A2.5).

**Falta un dato que solo ellos tienen:** qué carpeta exacta vigila el firmador
cada 30 s y en cuál deposita. Hasta saberlo, `ALIANZA_SFTP_CARPETA_ENVIO` y
`…_FIRMADOS` son una propuesta nuestra.

---

## 4. G4 · Nadie avisa cuando algo sale mal

Tres respuestas apuntan al mismo hueco:

- **A3.2:** si el firmador está caído, *"se deben comunicar con nosotros"*.
- **A3.5:** *"No informamos, el documento se firma o no se firma."*
- **A5:** no hay archivos de respuesta en la fase 1.

Es decir: **el único detector de que un CPC no volvió somos nosotros**, y el
único canal de reclamo es humano. Lo que hace falta de nuestro lado:

1. **Un plazo de espera del CPC firmado**, con un valor decidido (su estimación
   es 5 minutos y el ciclo es de 30 s; un umbral de 15 minutos deja margen sin
   volverse inútil).
2. **Una alerta operativa** cuando se vence: la consola administrativa es el
   lugar natural, porque ya muestra el expediente y sus envíos a proveedores.
   **El aviso a Alianza va por correo y automatizado** (decisión de Andres del
   18-sep, que cambió el punto 4 del Correo 7: el original decía teléfono).
   Dos cosas que eso arrastra, ninguna resuelta todavía:
   - **SES está en sandbox**, y ahí un destinatario sin verificar no recibe un
     correo tardío: la llamada a la API se **rechaza**. Cuando Alianza nos dé la
     casilla hay que verificarla como identidad —lo confirman ellos con un clic—
     o salir del sandbox (`docs/CONFIGURACION_SES.md`).
   - **El aviso no lleva ningún dato de la persona** (regla inviolable #7):
     código del documento, correlativo y cuánto lleva esperando. Es el mismo
     criterio de `remision-alianza.ts`, que ni siquiera manda el motivo de una
     derivación.
3. **Qué ve la persona mientras tanto.** Es **P2 de D-42**, que sigue abierta.
   Dato a favor: `Pantalla05B` ya sondea y ya trata «sin certificado» como «en
   preparación», así que la espera tiene dónde apoyarse sin inventar una
   pantalla nueva.
4. **Un reintento de envío.** El envío es idempotente por huella, así que
   reenviar el mismo CPC no duplica nada mientras el intento anterior no haya
   fallado; el adaptador ya reserva una referencia nueva cuando falló.

**La carpeta `salida/respuestas` queda sin uso en la fase 1.** El puerto no
cambia —`CarpetaRecepcion.RESPUESTAS` sigue existiendo— pero nadie la va a
llenar. Conviene que el documento de configuración lo diga, para que la sesión
que la vea vacía no la trate como una falla.

**Efecto colateral sobre la póliza:** sin archivos de respuesta tampoco llega el
aviso de póliza emitida ni de póliza entregada. `Expediente.poliza` solo se
puede mover **a mano desde la consola** en la fase 1. Eso no rompe nada: P9 ya
separa «Solicitud aceptada» de «Póliza en preparación» justamente porque son dos
cosas distintas y la segunda la maneja Alianza a su ritmo.

---

## 5. G5 · La firma incremental sigue sin probarse

*"La firma se agrega sobre el documento original"* es compatible con una firma
PAdES incremental, pero también con un firmador que reescriba el PDF entero
conservando el contenido visual. La diferencia es exactamente lo que
`docs/plan/DISENO_FIRMA_EN_LOTE.md` §6 marca como **riesgo principal**: si
reescribe, el prefijo de bytes no empareja y **todos** los documentos se
rechazan.

Alianza ofreció el ambiente de pruebas y hasta un PDF en blanco (A2.6). **Esa
prueba es barata y decide una parte del diseño**, así que va primero, antes de
construir nada sobre la recepción. Criterio de aceptación, los dos controles que
ya define el diseño del lote:

1. Los bytes enviados son **prefijo exacto** del archivo devuelto.
2. El `ByteRange` de la firma cubre todo el archivo salvo el hueco de
   `/Contents`, y el prefijo cae antes de ese hueco.

Y de paso se responden dos cosas que la respuesta dejó a medias: si la firma es
**PAdES** (A3.4 dice «visible» y «con su sello de tiempo», sin nombrar el
formato), y si ese sello viene de una **autoridad de sellado** o es la hora del
equipo firmador. Se lee del PDF devuelto; no hace falta preguntarlo de nuevo.

---

## 6. G6 · El horario de emisión

La firma es 24/7, pero *"la emisión de la póliza se hace de manera local (…) ya
que es tarea manual"*, con horario sin definir. Con lote diario, un caso pagado
el viernes a la noche puede tener póliza recién el lunes o el martes.

**No obliga a cambiar código**: P9 y 05B no prometen un plazo, dicen «Póliza en
preparación». Sí conviene **confirmarlo antes del lanzamiento** y que el horario
real quede escrito, porque es lo que va a contestar atención al cliente.

---

## 7. G7 · SEBAOT, y lo que no se puede diseñar todavía

Las tres preguntas de formato (A4.1, A4.2, A4.5) se derivaron a SEBAOT o a
«Emisión». **El TXT de emisión no se puede escribir** hasta que alguien defina
campos, tipos y codificación, y el TXT de ejemplo que mandaron es de migración
de vida colectivo, con un tabulador de más en la fila 3.

Dos caminos, y conviene empujar los dos: pedirles el **contacto directo de
SEBAOT**, y mientras tanto **proponer nosotros el formato** (el correo ya lo
ofrecía en 4.1) a partir de la lista de campos de 4.5, que es la que sale de
`Solicitud.pdf` y `FIPF.pdf`. Un formato propuesto por nosotros y aceptado por
ellos es mejor que esperar una especificación que quizás no exista.

Tampoco se pronunciaron sobre **no repetir las respuestas de salud** en el TXT.
Mientras no lo pidan explícitamente, no van: regla inviolable #7, y ya están en
la Solicitud firmada que reciben igual.

---

## 8. G8 · La retención, y por qué no insistir mucho

A2.7 se rechazó: *"la manipulación de archivos internos es de carácter
privado"*. Es defendible: los documentos llevan datos que Alianza trata **por
derecho propio** como aseguradora, no como encargada nuestra, así que su
política de conservación es suya.

Lo que sí queda para el acuerdo de servicio, no para el correo técnico: que la
conservación y la destrucción estén por escrito. Y una consecuencia operativa
concreta: nosotros **movemos a `procesados/` y nunca borramos** —el puerto no
tiene operación de borrado, por diseño—, así que esa carpeta crece para siempre
del lado de ellos. Vale avisarlo en la sesión técnica para que no los sorprenda.

**No hay fila en la matriz de cumplimiento que exija preguntar esto.** La
conservación que la normativa nos exige es la nuestra, y la cubre el bucket de
evidencias con Object Lock.

---

## 9. Qué falta pedirles

Para la **sesión técnica** (A2.3, A2.4), que es lo que destraba el `apply`:

1. Clave pública de host del servidor y su huella, confirmada por un canal
   distinto.
2. Usuario del SFTP, y confirmación de que aceptan autenticación por clave.
3. Algoritmos de clave y cifrado que admite el servidor.
4. Nombres exactos de las carpetas, y **cuál vigila el firmador**.

Por correo, junto con las IP:

5. **A qué casilla mandamos el aviso automático** de un certificado que no
   volvió, y en qué horario fuera de oficina (punto 4 del Correo 7). De esa
   casilla depende además verificarla en SES, o salir del sandbox.
6. Si el ambiente de pruebas firma con **certificado de prueba** o con el
   cualificado real (A2.6 quedó a medias).
7. Que el firmador **ignore todo lo que no sea `.pdf`**, y confirmación de que
   el nombre del archivo se conserva (A3.5 no lo dijo).
8. Contacto de SEBAOT (A4.1).
9. Horario real de emisión (A3.1).

---

## 10. La emisión no va por SFTP: va por correo y a mano (18-sep, tarde)

Aviso posterior de Alianza, por fuera de las respuestas numeradas: **las
solicitudes de emisión llegan por correo**, en los archivos TXT del modelo que
mandaron, y **las procesan a mano en SEBAOT**. No hay SFTP para esto y **no hay
confirmación automática**. Alianza no sabe cuánto tiempo va a funcionar así.

Confirma y endurece lo que A5 ya insinuaba, y cambia tres cosas del plan.

### 10.1. El puerto de emisión modela un sistema que no existe

`src/ports/policy-issuer.ts` supone una integración que **contesta**:
`emitirPoliza` devuelve estado y número, y `consultarEstadoPoliza` pregunta por
uno. Con la operación real no hay a quién preguntarle: del otro lado hay una
persona abriendo un correo.

Lo que el adaptador oficial va a poder hacer, cuando se escriba:

- **Componer el lote del día y mandarlo.** Su resultado honesto es «remitido»,
  con fecha y destinatario, nunca «emitida» ni un número de póliza.
- **Nada más.** Consultar estado y consultar factura **no tienen
  implementación posible** por este canal, y el estado real entra a mano por la
  consola administrativa.

**No se reescribe el puerto todavía** —el adaptador live no existe y el mock
sirve para el demo—, pero queda anotado para que nadie construya encima de la
premisa de que hay respuesta. El encabezado del puerto ya lo advierte.

### 10.2. Un adjunto con datos personales, por un canal que no controlamos

El TXT lleva nombre, cédula, fecha de nacimiento, domicilio, actividad e
ingresos. Por correo eso viaja entre servidores que no son nuestros ni de
Alianza, y queda copiado en dos buzones por tiempo indefinido (A2.7: su
retención es asunto interno de ellos).

**No hay una fila de la matriz que prohíba el correo**, y conviene decirlo así
en vez de inventar una: lo más cercano es la **fila 78** —mantener
infraestructura segura y evaluación de riesgos, Res. SS.SG. 231/2025 Anexo I
art. 6 y 210/2025 Anexo I art. 10—, que es un control derivado, igual que la
fila 79 con la separación de ambientes.

Dos mitigaciones que no dependen de Alianza y conviene proponerles:

1. **Adjunto cifrado**, con la contraseña por un canal distinto del correo.
2. **Enlace de descarga autenticado** en lugar del adjunto, con el archivo
   viviendo en nuestra bandeja y un acceso que caduca.

La segunda es mejor y más trabajo. La primera se puede hacer ya.

### 10.3. Nada de esto cambia el cobro ni la cobertura

Vale dejarlo escrito porque es lo que más tranquiliza: la emisión manual pasa
**después** del pago y de la firma. El cobro, la vigencia del certificado y el
paquete firmado no dependen de que alguien abra un correo. Lo que se estira es
el momento en que la póliza existe, y P9 ya está diseñado para eso: muestra
«Solicitud aceptada» y «Póliza en preparación» por separado, sin prometer
fecha.

### 10.4. Lo que hay que preguntar antes de seguir

1. **¿Esto alcanza también al certificado?** El aviso habla de «solicitudes de
   emisión de certificados» y de TXT procesados en SEBAOT, que es el circuito
   de la **póliza**. El **CPC** es un PDF que va a firma por carpetas cada 30
   segundos (A3.1), que es otro camino. Si el CPC también pasara a correo, el
   conector SFTP se queda sin uso y hay que decidir qué se hace con él.
2. **A qué casilla** se manda el lote, y si aceptan el adjunto cifrado.
3. **Cómo sabemos que lo procesaron**, aunque sea una respuesta escrita a mano:
   sin ninguna señal, un lote perdido en una bandeja no se detecta nunca.

## 11. Estado de los pendientes del intercambio

| Ítem | Antes | Ahora |
| :---- | :---- | :---- |
| Qué firma Alianza (P1) | ⬜ abierto | ✅ **solo el CPC** (A1.1 confirma D-42) |
| Host y puerto | ⬜ | ✅ `138.186.63.132:2222` |
| Clave de host, usuario, algoritmos | ⬜ | ⬜ sesión técnica |
| Carpetas | ⬜ | ⚠️ aceptan el esquema, faltan los nombres |
| Firma incremental | ⬜ | ⚠️ hay que probarlo en su ambiente |
| Archivos de respuesta | ⬜ | ❌ **no en fase 1** |
| Formato del TXT de emisión | ⬜ | ⬜ SEBAOT |
| Conciliación de pagos | ⬜ | ⬜ sesión con tesorería |
