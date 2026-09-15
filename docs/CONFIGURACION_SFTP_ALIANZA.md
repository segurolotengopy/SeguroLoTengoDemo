# Configuración del intercambio SFTP con Alianza

Guía operativa del envío y la recepción de PDF con Alianza Garantía (ítem 36 de
`Tabla de Integraciones externas - Tabla.csv`): les mandamos un documento para
que lo firmen y traemos de vuelta lo firmado y sus archivos de respuesta.

Región: **us-east-1**. Cuenta: **120005938663**. Terraform: `infra/alianza-sftp.tf`
y `infra/alianza-vpn.tf`. Código: puerto `src/ports/intercambio-aseguradora.ts`,
adaptador `src/adapters/live/intercambio-aseguradora-sftp.ts`.

**Estado al 15-sep-2026: todo escrito y apagado.** Nada existe en la cuenta hasta
que se complete la sección 3.

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
| **Host público o IP pública, y puerto** | La URL del conector. La captura mostraba `10.0.7.101`, que es interna y no sirve por Internet | `alianza_sftp_url` |
| **Clave pública de host del servidor** (`ssh-ed25519 AAAA…` o `ssh-rsa AAAA…`) y su **huella** | Que el conector compruebe que habla con Alianza y no con un impostor | `alianza_sftp_trusted_host_keys` |
| **Usuario** | La credencial | secreto |
| Que acepten **autenticación por clave SSH** | Les mandamos nuestra clave pública (sección 2) | — |
| **Carpetas**: dónde depositamos, dónde dejan lo firmado, dónde las respuestas, y una subcarpeta `procesados/` en cada una | La app mueve lo ya recibido a `procesados/` en vez de borrarlo | `ALIANZA_SFTP_CARPETA_*` |
| Si aceptan subir como **`.tmp` y renombrar** al terminar, y que hagan lo mismo | Que nadie procese un archivo a medio escribir | — |
| Qué **algoritmos SSH** admite el servidor | Si son viejos, hay que elegir otra política criptográfica | `alianza_sftp_security_policy` |
| Si la firma es **PAdES incremental** | Lo devuelto tiene que contener lo enviado como prefijo | — |

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
alianza_sftp_url               = "sftp://<host-publico>:<puerto>"
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
- `ALIANZA_SFTP_CARPETA_ENVIO`, `…_FIRMADOS` y `…_RESPUESTAS`, si Alianza
  confirma otras carpetas que las propuestas (`/entrada/documentos`,
  `/salida/documentos`, `/salida/respuestas`).

Lo que tiene que pasar al enviar: en el servidor de Alianza aparecen
`CPC-<correlativo>-v1.json.tmp` y `….pdf.tmp`, y al rato los dos sin `.tmp`, el
JSON primero. El JSON lleva código, correlativo, versión, huella SHA-256 y
tamaño: **ningún dato de la persona**, y los nombres de archivo tampoco, porque
los logs del conector registran rutas.

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
| Terraform de la VPN | ✅ escrito, apagado |
| Puerto, mock, adaptador live y contrato | ✅ |
| Política `SLTDemoAlianzaSftpPolicy` adjuntada | ⬜ Andres, con administración |
| Datos de Alianza (host, puerto, clave de host, usuario, carpetas) | ⬜ esperan la respuesta al correo |
| Clave SSH generada y pública enviada | ⬜ |
| Secreto cargado | ⬜ |
| IP enviadas a Alianza y habilitadas | ⬜ |
| `test-connection` en `OK` | ⬜ |
| Qué documentos firma Alianza (`INTERCAMBIO_ASEGURADORA_DOCUMENTOS`) | ⬜ P1, Rodrigo |
