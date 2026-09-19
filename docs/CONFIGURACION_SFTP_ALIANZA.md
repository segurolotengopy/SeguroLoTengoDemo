# Configuración del intercambio SFTP con Alianza

Guía operativa del envío y la recepción de PDF con Alianza Garantía (ítem 36 de
`Tabla de Integraciones externas - Tabla.csv`): les mandamos un documento para
que lo firmen y traemos de vuelta lo firmado y sus archivos de respuesta.

> **Este canal es para los documentos que Alianza firma, no para la emisión.**
> El 18-sep-2026 avisaron que **las solicitudes de emisión van por correo**, en
> archivos TXT, y las procesan a mano en SEBAOT. **El certificado sigue por
> acá** (D-49), así que el conector conserva su razón de ser; lo que nunca va a
> pasar por este canal es el lote de pólizas
> (`docs/ANALISIS_RESPUESTAS_ALIANZA.md` §10).

Región: **us-east-1**. Cuenta: **120005938663**. Terraform: `infra/alianza-sftp.tf`
y `infra/alianza-vpn.tf`. Código: puerto `src/ports/intercambio-aseguradora.ts`,
adaptador `src/adapters/live/intercambio-aseguradora-sftp.ts`.

**Estado al 18-sep-2026: el conector existe, y todavía no transfiere nada.**
`c-f2f1ac065481446ab`, creado **sin clave de host a propósito** (sección 3.4)
para tener sus tres IP: `67.202.57.40`, `44.209.137.228` y `50.19.171.17`.
Bandeja `slt-demo-intercambio-alianza-4d889806`, secreto
`slt-demo-alianza-sftp-credencial` **vacío**. Falta la sesión técnica con
Alianza para cargar la clave de host y el usuario. Alianza contestó el 18-sep
(`docs/Integraciones/Alianza - Respuestas SFTP, firma y emision.md`, análisis en
`docs/ANALISIS_RESPUESTAS_ALIANZA.md`): dieron **host y puerto**, y dejaron la
**clave de host**, el **usuario** y los **algoritmos** para una sesión técnica
conjunta. Sin esos tres, el `apply` completo sigue trabado — ver la sección 3.4.

---

## Lo primero, porque cambia todo lo demás

**La app no se conecta a Alianza. Se conecta un conector de AWS Transfer Family.**

Alianza habilita su firewall por IP pública, y la app corre en Amplify, que
**no tiene IP de salida fija**: cada ejecución puede salir por otra dirección.
Por eso la conexión SFTP no la abre la app. La abre un **conector SFTP de
Transfer Family**, un recurso de AWS que:

- sale siempre por las mismas **3 IP estáticas**, asignadas al crearlo. Son
  las que se le mandan a Alianza;
- lee de S3 lo que se manda y escribe en S3 lo que trae;
- guarda la credencial SFTP en Secrets Manager: la app nunca la ve.

La app solo le pide al conector *"mandá este archivo"*, *"listá esta
carpeta"* o *"traé este archivo"*, y consulta después cómo terminó. Todo es
asincrónico.

```
app (Amplify) ──pide──▶ conector Transfer Family ──SFTP, 3 IP fijas──▶ servidor de Alianza
      │                        │
      └──── bandeja S3 ◀───────┘   (slt-demo-intercambio-alianza-*)
```

Referencias: [egreso y cantidad de IP](https://docs.aws.amazon.com/transfer/latest/userguide/configure-sftp-connector.html),
[`ServiceManagedEgressIpAddresses`](https://docs.aws.amazon.com/transfer/latest/APIReference/API_DescribedConnector.html).

---

## 1. Qué pedirle a Alianza

Sin estos datos no hay nada que crear. Son las preguntas 2.2 a 2.5 y 3.3 a 3.6
del borrador de respuesta (`docs/recepcion/2026-09-14-interseguros/BORRADOR_CORREO_ALIANZA.md`).

| Dato | Para qué | Variable |
| :---- | :---- | :---- |
| ✅ **Host público o IP pública, y puerto** — **`138.186.63.132`, puerto `2222`** (A2.2) | La URL del conector. La captura mostraba `10.0.7.101`, que es interna y no sirve por Internet | `alianza_sftp_url` |
| ⬜ **Clave pública de host del servidor** (`ssh-ed25519 AAAA…` o `ssh-rsa AAAA…`) y su **huella** — sesión técnica (A2.3) | Que el conector compruebe que habla con Alianza y no con un impostor | `alianza_sftp_trusted_host_keys` |
| ⬜ **Usuario** — sesión técnica (A2.4) | La credencial | secreto |
| ⬜ Que acepten **autenticación por clave SSH** — sesión técnica (A2.4) | Les mandamos nuestra clave pública (sección 2) | — |
| ⚠️ **Carpetas**: una de **tránsito**, una donde depositamos, donde dejan lo firmado, y una subcarpeta `procesados/` en cada una de recepción — aceptaron el esquema (A2.5) pero **faltan los nombres**, y sobre todo **cuál vigila el firmador** | La app sube a tránsito y **mueve** a la del firmador al terminar; y mueve lo ya recibido a `procesados/` en vez de borrarlo | `ALIANZA_SFTP_CARPETA_*` |
| ✅ Que nadie procese un archivo a medio escribir — **resuelto sin pedirles nada más que una carpeta**: subimos a `entrada/en-curso` y movemos a la carpeta del firmador al terminar. Ver `ANALISIS_RESPUESTAS_ALIANZA.md` §3 | El `.tmp` apostaba a que su firmador filtrara por extensión, y no lo confirmaron (A3.3) | `ALIANZA_SFTP_CARPETA_TRANSITO` |
| ⬜ Qué **algoritmos SSH** admite el servidor — sesión técnica (A2.4) | Si son viejos, hay que elegir otra política criptográfica | `alianza_sftp_security_policy` |
| ⚠️ Si la firma es **PAdES incremental** — dijeron *"se agrega sobre el documento original"* (A3.6), que no lo prueba. **Se verifica con el PDF en blanco en su ambiente de pruebas**, no preguntando de nuevo | Lo devuelto tiene que contener lo enviado como prefijo | — |

**La huella se confirma por un canal distinto del que trae la clave.** Si la clave
llega por correo, la huella se confirma por teléfono o WhatsApp con alguien de
sistemas de Alianza. Para calcular la huella de la clave que mandaron:

```bash
echo "ssh-ed25519 AAAA...clave-que-mandaron" | ssh-keygen -lf -
```

Con eso se compara contra la que dicten del otro lado. **No sirve pedirle la
clave al propio servidor** (`ssh-keyscan`): eso confía en la misma red que la
huella tiene que proteger.

---

## 2. Generar la clave SSH

Una clave **nueva y dedicada** a este intercambio, no una personal:

```bash
ssh-keygen -t ed25519 -N "" -C "segurolotengo-alianza-sftp" -f ~/slt-alianza-sftp
```

- **Sin passphrase** (`-N ""`): Transfer Family no admite claves protegidas con
  passphrase ([fuente](https://docs.aws.amazon.com/transfer/latest/userguide/sftp-connector-secret-procedure.html)).
  Por eso la clave privada solo vive en Secrets Manager y en tu máquina el
  tiempo justo para cargarla.
- Si Alianza no acepta ed25519, usar `-t rsa -b 4096`.
- A Alianza se le manda **solo** `~/slt-alianza-sftp.pub`.
- **Nunca** entra al repositorio: `docs/recepcion/…/.gitignore` excluye llaves,
  pero lo correcto es no copiarla ahí.

---

## 3. Habilitar con Terraform

### 3.1. Permisos del deployer (una sola vez, con administración)

`SLTDemoDeployerPolicy` no cubre Transfer Family ni `iam:PassRole` hacia
`transfer.amazonaws.com`, y ya está en **5 versiones**, el máximo de IAM. Por eso
van en una política aparte, igual que el atajo de SES:

```bash
aws iam create-policy --policy-name SLTDemoAlianzaSftpPolicy \
  --policy-document file://infra/iam-policy-alianza-sftp-reference.json
aws iam attach-group-policy --group-name aab1-demo-deployers \
  --policy-arn arn:aws:iam::120005938663:policy/SLTDemoAlianzaSftpPolicy
```

Los dos comandos requieren **credenciales de administración**.

### 3.2. Variables

En el `.tfvars` local, que **no** se versiona:

```hcl
alianza_sftp_habilitado        = true
alianza_sftp_url               = "sftp://138.186.63.132:2222"
alianza_sftp_trusted_host_keys = ["ssh-ed25519 AAAA..."]
# alianza_sftp_security_policy = "TransferSFTPConnectorSecurityPolicy-…"  # solo si hace falta
```

Si falta la URL o la clave de host, el `plan` corta con un mensaje que dice cuál,
en vez de crear un conector que no puede verificar al servidor.

### 3.3. Orden: secreto primero, conector después

El conector se puede crear con el secreto vacío, pero no conecta. Para no dejarlo
en ese estado:

```bash
cd infra
export AWS_PROFILE=aab1-demo-deployer

# 1. Solo el secreto
terraform apply -target=aws_secretsmanager_secret.alianza_sftp

# 2. Cargar el valor (sección 4)

# 3. Todo lo demás
terraform apply
```

El `apply` completo crea: la bandeja `slt-demo-intercambio-alianza-<sufijo>`, el
rol `aab1-demo-alianza-sftp-conector`, el conector, el permiso del rol de
Amplify sobre ambos, y las variables `ALIANZA_SFTP_CONNECTOR_ID` y
`ALIANZA_SFTP_BUCKET` en la app. **No** cambia el modo del adaptador: la app
sigue en mock hasta la sección 6.

### 3.4. Sacar las IP antes de tener la clave de host

Alianza confirmó host y puerto pero dejó la clave de host para una sesión
técnica (A2.3), y la `precondition` del conector exige
`alianza_sftp_trusted_host_keys`. La salvaguarda es correcta: sin la clave, el
conector le entregaría documentos con declaraciones de salud a cualquiera que
conteste en esa IP.

Hay un camino intermedio que **no la debilita**, porque quien lo impone es AWS:

> *"You have an option to create your connector while leaving the
> `TrustedHostKeys` parameter empty. However, your connector will not be able to
> transfer files with the remote server until you provide this parameter"*
> ([Create an SFTP connector](https://docs.aws.amazon.com/transfer/latest/userguide/create-sftp-connector-procedure.html))

Un conector sin clave de host **no transfiere nada**, y sin embargo **ya tiene
sus tres IP**. Sirve para mandárselas a Alianza y que habiliten el firewall en
paralelo a la sesión técnica, en vez de en serie. Agregar la clave después es un
`UpdateConnector` (cambio en el lugar), así que **las IP no cambian**: solo
destruir y recrear el conector las cambiaría.

**Requiere autorización de Andres**, porque crea recursos en la cuenta real, y
deja el estado degradado a la vista en vez de escondido: la variable se llama
`alianza_sftp_sin_clave_de_host` y el `plan` la anuncia.

**No se usa para nada más.** Con la clave en mano se vuelve a `false` y el
conector queda como corresponde.

---

## 4. Cargar el secreto

JSON con `Username` y `PrivateKey`
([formato](https://docs.aws.amazon.com/transfer/latest/userguide/sftp-connector-secret-procedure.html)).
Se arma con `jq`, para no pelearse con los saltos de línea de la clave:

```bash
jq -n --arg u "<usuario-de-alianza>" --rawfile k ~/slt-alianza-sftp \
  '{Username: $u, PrivateKey: $k}' > /tmp/slt-sftp.json

AWS_PROFILE=aab1-demo-deployer aws secretsmanager put-secret-value \
  --secret-id slt-demo-alianza-sftp-credencial \
  --secret-string file:///tmp/slt-sftp.json

shred -u /tmp/slt-sftp.json
```

Después, **borrar la privada de la máquina** (`shred -u ~/slt-alianza-sftp`):
si hace falta rotarla, se genera otra. Terraform nunca ve el valor: el secreto
se declara sin `aws_secretsmanager_secret_version`.

---

## 5. Leer las IP para mandárselas a Alianza

```bash
terraform -chdir=infra output alianza_sftp_ips_salida
```

o, sin Terraform:

```bash
AWS_PROFILE=aab1-demo-deployer aws transfer describe-connector \
  --connector-id "$(terraform -chdir=infra output -raw alianza_sftp_connector_id)" \
  --query 'Connector.ServiceManagedEgressIpAddresses'
```

Son **tres**, y Alianza tiene que habilitar las tres: el conector puede salir
por cualquiera. Eso responde la pregunta 2.1 del borrador («principal y
respaldo»): no son dos, son tres, y las tres van en uso.

Las IP pertenecen al conector. **Si se destruye y se vuelve a crear, cambian**, y
hay que mandárselas de nuevo.

---

## 6. Cómo se prueba

**Conexión**, antes de tocar la app:

```bash
AWS_PROFILE=aab1-demo-deployer aws transfer test-connection \
  --connector-id "$(terraform -chdir=infra output -raw alianza_sftp_connector_id)"
```

Tiene que devolver `"Status": "OK"`. Los errores típicos:

| Mensaje | Causa |
| :---- | :---- |
| timeout / connection refused | Alianza todavía no habilitó las IP, o el puerto es otro |
| host key mismatch | La clave de `alianza_sftp_trusted_host_keys` no es la del servidor. **No la cambies por la que devuelva el servidor**: volvé a confirmarla con Alianza |
| authentication failed | Secreto vacío, usuario errado, o Alianza no cargó nuestra clave pública |

**Un listado**, que prueba lectura sin mover nada:

```bash
AWS_PROFILE=aab1-demo-deployer aws transfer start-directory-listing \
  --connector-id <c-…> --remote-directory-path /salida/documentos \
  --output-directory-path /<bucket>/alianza/listados
```

El resultado aparece segundos después en `s3://<bucket>/alianza/listados/`.

**Desde la app**, con datos ficticios (pregunta 2.6: nada real en pruebas):

- `INTEGRATION_INTERCAMBIO_ASEGURADORA=live`
- `INTERCAMBIO_ASEGURADORA_DOCUMENTOS=CPC`. **No tiene valor por defecto**:
  qué firma Alianza sigue abierto (P1), y sin la variable no sale ningún documento.
- `ALIANZA_SFTP_CARPETA_TRANSITO`, `…_ENVIO`, `…_FIRMADOS` y `…_RESPUESTAS`, si
  Alianza confirma otras carpetas que las propuestas (`/entrada/en-curso`,
  `/entrada/documentos`, `/salida/documentos`, `/salida/respuestas`).
- `INTERCAMBIO_ASEGURADORA_METADATO` **no se enciende con Alianza**: pidieron
  solo el PDF (A3.3) y por eso el `.json` está apagado por defecto.

**`salida/respuestas` va a estar vacía, y no es una falla.** Alianza contestó
que los archivos de respuesta *"por ahora no tenemos esa opción"* (A5): en la
fase 1 no hay acuse de recepción, ni aceptados/rechazados, ni aviso de póliza
emitida. La carpeta y `CarpetaRecepcion.RESPUESTAS` se conservan para cuando la
adecúen.

Lo que tiene que pasar al enviar: `CPC-<correlativo>-v1.pdf` aparece primero en
`/entrada/en-curso` y **después** en la carpeta del firmador, entero, por un
movimiento del servidor. **Ningún otro archivo viaja** (A3.3). Los nombres no
llevan datos de la persona, porque los logs del conector registran rutas.

---

## 7. VPN IPsec (solo si Alianza la pide)

Apagada por defecto (`alianza_vpn_habilitada = false`).

**Cómo viaja el tráfico.** El conector no se puede meter en un túnel mientras
salga por la red del servicio. Pero admite un segundo tipo de egreso,
**VPC Lattice**: el tráfico entra a una VPC nuestra por un *resource gateway* y
va hacia la **IP privada** del servidor de Alianza, y la tabla de rutas de esa
VPC la manda por el túnel. AWS lo documenta como caso de uso: *"on-premises
connectivity through AWS Direct Connect or AWS Site-to-Site VPN"*
([fuente](https://docs.aws.amazon.com/transfer/latest/userguide/create-vpc-sftp-connector-procedure.html)).
**No hace falta Lambda, ECS ni NAT propio**, y el código de la app no cambia.

Qué pedirle a Alianza:

| Dato | Variable |
| :---- | :---- |
| IP pública de su equipo VPN | `alianza_vpn_ip_publica_alianza` |
| Red del lado de ellos (la que contiene al servidor) | `alianza_vpn_cidr_remoto` |
| IP privada del servidor SFTP (¿`10.0.7.101`?) | `alianza_vpn_ip_servidor_sftp` |
| Parámetros de IKE/IPsec que admite su equipo | se ajustan en `aws_vpn_connection` si los defaults no les sirven |

Qué cambia al encenderla:

- **El origen que ve Alianza deja de ser las 3 IP públicas** y pasa a ser la
  VPC propia (`terraform output alianza_vpn_cidr_origen`, por defecto
  `192.168.250.0/24`). Tiene que no solaparse con su red.
- La conexión se **reemplaza**: pasa de egreso por Internet a VPC Lattice, y la
  API exige `url` nula en ese modo.
- La configuración del túnel para el equipo de Alianza, con las claves
  precompartidas que genera AWS, se descarga desde la consola (**VPC → Site-to-Site
  VPN connections → Download configuration**) y se les manda por un canal seguro.
  Las claves quedan también en el state local de Terraform, que no se versiona.

Permisos: `infra/iam-policy-alianza-vpn-reference.json` (EC2, VPC Lattice y el
rol vinculado de Lattice), adjuntada aparte y solo cuando haga falta.

**Costo:** la conexión VPN y VPC Lattice cobran por hora y por GB. No conviene
dejarla encendida "por las dudas".

---

## 8. Estado y pendientes

| Ítem | Estado |
| :---- | :---- |
| Registro en la tabla de integraciones (ítem 36) | ✅ |
| Terraform del conector, bandeja, rol y secreto | ✅ escrito, `validate` en verde, **sin aplicar** |
| Terraform de la VPN | ✅ escrito, apagado — Alianza prefiere empezar por Internet (A2.8) |
| Puerto, mock, adaptador live y contrato | ✅ |
| Qué documentos firma Alianza (`INTERCAMBIO_ASEGURADORA_DOCUMENTOS`) | ✅ **`CPC`**: A1.1 confirmó D-42 y cerró P1 |
| Host y puerto | ✅ `sftp://138.186.63.132:2222` (A2.2) |
| Política `SLTDemoAlianzaSftpPolicy` adjuntada | ✅ Andres, 18-sep-2026 |
| Conector creado, por ahora solo por sus IP | ✅ `c-f2f1ac065481446ab` |
| Clave de host, usuario y algoritmos | ⬜ **sesión técnica conjunta** (A2.3, A2.4) |
| Clave SSH generada | ✅ `ed25519`, huella `SHA256:LhMYdIDjLB7EINRgzAu50196WcKNDmC45cQ06Z//Prc`; enviarla ⬜ |
| Secreto cargado | ⬜ |
| IP enviadas a Alianza y habilitadas | ⬜ están en el Correo 7, sin enviar |
| `test-connection` en `OK` | ⬜ |
| Nombres de carpeta, y cuál vigila el firmador | ⬜ aceptaron el esquema (A2.5), faltan los nombres |
| Solo PDF, sin metadato `.json`, y `.tmp` o carpeta de tránsito | ⬜ decisión pendiente (A3.3, análisis §3) |
| Firma incremental verificada con un PDF de prueba | ⬜ **la prueba que va primero** (A3.6, análisis §5) |
| Modelo de CPC aprobado por Alianza | ⬜ no vino con la respuesta |
