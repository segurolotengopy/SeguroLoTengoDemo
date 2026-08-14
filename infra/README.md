# Infraestructura de la demo SeguroLoTengo (Vía A)

Terraform para el entorno de demo (Amplify Hosting + DynamoDB + S3, sin
VPC/NAT/Aurora), en la cuenta AWS "Seguro Lo Tengo" (120005938663), región
`us-east-1`.

## Cómo correrlo

Usá siempre el perfil `aab1-demo-deployer` (nunca admin/root):

```bash
export AWS_PROFILE=aab1-demo-deployer
export AWS_DEFAULT_REGION=us-east-1

terraform init
terraform validate
terraform plan
```

`terraform apply` requiere confirmación explícita fuera de este flujo
automatizado — no lo corras sin que alguien lo pida en el chat.

El provider `aws` no tiene el perfil hardcodeado: la variable `aws_profile`
(en `variables.tf`) es `null` por default, así que Terraform resuelve
credenciales por la cadena estándar de AWS, incluida la variable de entorno
`AWS_PROFILE`. Si preferís pasarlo explícito: `terraform plan -var="aws_profile=aab1-demo-deployer"`.

## State

Sin backend remoto por ahora: el state queda local
(`infra/terraform.tfstate`, ya excluido del control de versiones — ver
`.gitignore`). Si más de una persona necesita aplicar cambios, migrar a un
backend `s3` apuntando a un bucket `slt-demo-*` dedicado es el siguiente
paso natural.

## Convención de nombres (obligatoria)

El usuario `aab1-demo-deployer` está limitado por la política
`SLTDemoDeployerPolicy` a operar solo sobre recursos con prefijo:

- `slt-demo-*` — DynamoDB, S3, Secrets Manager
- `aab1-demo-*` — roles IAM

Cualquier recurso fuera de esos prefijos en esos servicios devuelve
`AccessDenied`.

`SLTDemoDeployerPolicy` fue ampliada el 2026-08-07 (aplicada a mano vía
consola con el perfil admin `Andres_Alberdi_1`, ya que `aab1-demo-deployer`
no tiene permiso para modificarse a sí mismo) para cubrir también IAM
(`aab1-demo-*`, incluido `iam:PassRole` acotado a `iam:PassedToService =
amplify.amazonaws.com`), Amplify (`apps/*` de esta cuenta, más
`amplify:CreateApp` sin scoping posible por ARN — limitación del servicio)
y CloudWatch Logs (`/aws/amplify/*`). El documento completo, tal como se
aplicó, queda respaldado en
[`iam-policy-deployer-reference.json`](./iam-policy-deployer-reference.json)
— es solo referencia/backup, no un recurso gestionado por Terraform (el
usuario deployer no puede leer su propia policy para verificarla por API,
así que este archivo es la fuente de verdad manual). Si se vuelve a tocar
la política, actualizar ese archivo a mano.

## Recursos definidos

- `dynamodb.tf` — tabla `slt-demo-expedientes` (on-demand, PK `pk`/SK `sk`, TTL en `expiresAt`, cifrado en reposo).
- `s3.tf` — bucket `slt-demo-evidencias-<sufijo>` (acceso público bloqueado, versionado, SSE-S3, lifecycle a 90 días).
- `iam.tf` — rol `aab1-demo-amplify-service-role` con permisos mínimos (solo esa tabla, ese bucket, ese secret, y logs de `/aws/amplify/*`).
- `secrets.tf` — secret `slt-demo-app-secrets` (JSON con `DEMO_PANEL_KEY` y `OTP_PEPPER`, valores de arranque generados por Terraform, rotables manualmente sin volver a aplicar).
- `amplify.tf` — app de Amplify Hosting (`WEB_COMPUTE`) y rama `main`. La conexión al repo de GitHub queda pendiente de un paso manual salvo que se provean `amplify_repository_url` y `amplify_github_access_token`.
- `logs.tf` — log group `/aws/amplify/slt-demo-segurolotengo`, retención 7 días.
- `presupuesto.tf` — presupuestos mensuales `slt-demo-presupuesto-mensual` (cuenta completa, USD 50) y `slt-demo-presupuesto-identidad` (solo Rekognition y Textract, USD 20), con alertas al 50/80/100 %.

## Verificación de identidad (P5) — Rekognition y Textract

El rol de cómputo de Amplify tiene desde ahora los permisos de las APIs sin almacenamiento de Rekognition (`CreateFaceLivenessSession`, `StartFaceLivenessSession`, `GetFaceLivenessSessionResults`, `DetectFaces`, `CompareFaces`) y de `textract:DetectDocumentText`.

Tres cosas de esa política que conviene no "corregir" sin leer esto:

1. **`Resource = "*"` es obligatorio.** Ni Rekognition ni Textract admiten permisos a nivel de recurso en estas operaciones: acotar por ARN devuelve `AccessDenied`, no una política más estricta. El recorte real es la lista de acciones.
2. **`textract:AnalyzeID` está deliberadamente excluido.** Está entrenado sobre documentos de EE.UU. y no sirve para la cédula paraguaya; no se concede el permiso para que nadie lo use por error creyendo que es "el bueno".
3. **`rekognition:IndexFaces` / `SearchFaces` tampoco están.** Ese camino crea colecciones que **persisten vectores faciales del lado de AWS**; el flujo de P5 es 1:1 contra la foto de la cédula y no necesita almacenar biometría en ningún servicio externo. Si algún día hace falta detección de duplicados, es una decisión de privacidad a tomar antes, no un permiso a agregar.

**Región:** Face Liveness solo existe en `us-east-1`, `us-west-2`, `eu-west-1`, `ap-northeast-1` y `ap-south-1` — **no hay región sudamericana**. La demo ya está en `us-east-1`, así que no hay cambio de región, pero sí una consecuencia legal: las selfies de clientes paraguayos salen del continente y esa transferencia internacional de datos biométricos hay que declararla en el aviso de privacidad (Ley 7593/2025).

## Política de opt-out de servicios de IA (obligatoria antes de procesar imágenes reales)

Que las imágenes de rostro y cédula **no se usen para mejorar los servicios de AWS** se configura como *AI services opt-out policy* a nivel de **AWS Organizations**, no de cuenta. Con datos biométricos bajo la Ley 7593/2025 es condición de entrada, no un pendiente cosmético: sin esto, AWS puede almacenar contenido de clientes para mejora del servicio, incluso en una región distinta de la que se usa.

El documento vive versionado en **`infra/politica-opt-out-ia.json`**. Opta por *no* participar en **todos** los servicios de IA, presentes y futuros (`default`), y bloquea cualquier excepción posterior con `@@operators_allowed_for_child_policies: ["@@none"]` en los tres niveles. Es el ejemplo 1 de la documentación de AWS, elegido sobre la variante por servicio a propósito: enumerar `rekognition` y `textract` dejaría fuera cualquier servicio de IA que AWS agregue después, y este proyecto ya prevé sumar proveedores.

**No está en Terraform, y es deliberado.** El recurso existe (`aws_organizations_policy`), pero `aab1-demo-deployer` no tiene —ni debe tener— permisos de Organizations: incluirlo haría fallar con `AccessDenied` **todos** los `terraform apply` de la demo, incluidos los que no tienen nada que ver. Es una tarea de la cuenta de gestión, de una sola vez.

### Cómo aplicarla

**Estado verificado el 14/08/2026: la cuenta `120005938663` NO está en ninguna organización** (`AWSOrganizationsNotInUseException`). Hay que crear una, con la cuenta como única integrante. No hay vía documentada para el opt-out sin organización: es el mecanismo que AWS provee.

Todo el flujo está en **`infra/aplicar-opt-out-ia.sh`**. Se corre una sola vez, con credenciales de **administración** (el deployer no sirve y el script lo rechaza):

```bash
AWS_PROFILE=<perfil-admin> ./infra/aplicar-opt-out-ia.sh
```

Es **idempotente**: cada paso verifica el estado antes de actuar, así que se puede reintentar sin miedo si algo falla a mitad de camino. Hace, en orden: crear la organización con `--feature-set ALL` (pidiendo confirmación, porque es el único paso estructural), habilitar `AISERVICES_OPT_OUT_POLICY` en el root, crear o sincronizar la política desde el JSON versionado, adjuntarla al root y **verificar la política efectiva**.

Se adjunta al root y no a la cuenta a propósito: así alcanza también a cualquier cuenta que se sume a la organización más adelante, sin que nadie tenga que acordarse.

Cuatro barreras, todas probadas:

| Situación | Qué hace |
| :---- | :---- |
| Perfil apunta a otra cuenta de AWS | corta antes de tocar nada |
| Perfil es `aab1-demo-deployer` o `aab1-demo-qa` | corta: son de mínimo privilegio |
| Sin credenciales válidas | corta con instrucción de qué exportar |
| El JSON no dice `optOut` | corta antes de subir nada |

`--si` salta la confirmación, para uso desatendido.

**Migrar de `CONSOLIDATED_BILLING` a `ALL` el script no lo hace solo**, aunque detecta el caso y lo avisa: es un cambio de una sola dirección y corresponde decidirlo, no que lo haga un script.

### Verificar que quedó activa

```bash
aws organizations describe-effective-policy \
  --policy-type AISERVICES_OPT_OUT_POLICY \
  --target-id 120005938663
```

**Ojo con la forma de la respuesta**, que no es la del documento de origen:

| | `opt_out_policy` |
| :---- | :---- |
| Documento de origen (`politica-opt-out-ia.json`) | `{ "@@assign": "optOut" }` |
| Política **efectiva** | `"optOut"` (string suelto) |

AWS ya resolvió los operadores de herencia, y además **expande `default` en cada servicio individual** — buscar la clave `default` en la efectiva puede no encontrar nada aunque el opt-out esté perfectamente aplicado. Por eso el script verifica que **ningún servicio quede fuera de `optOut`**, que es más estricto y no depende de cómo AWS represente la herencia.

Esa salida —ningún servicio fuera de `optOut`— **es la evidencia de cumplimiento**, no el hecho de haber corrido el script. El script no se da por exitoso hasta comprobarlo.

**Ya aplicado y registrado: ver `infra/evidencia-opt-out-ia.md`** (política efectiva vigente desde el 14/08/2026, anterior a cualquier procesamiento de imágenes reales). Ese archivo se regenera cuando cambie la política, se sume una cuenta a la organización, o antes de una auditoría.

**Un efecto que conviene conocer antes de aplicarla:** al optar por no participar, los servicios **borran el contenido histórico** que hubieran almacenado con ese fin. Es lo que se busca, pero es irreversible.

## Otros pasos manuales que Terraform no puede hacer
- **Aplicar el JSON de `iam-policy-deployer-reference.json` sobre `SLTDemoDeployerPolicy` en AWS.** El archivo es la referencia versionada, no la fuente. **Hecho el 13/08/2026** (versión `v5`, con el bloque `BudgetsSltDemo`): hay que repetirlo cada vez que el archivo cambie, y el deployer **no puede hacerlo solo** —sus permisos de IAM llegan hasta `role/aab1-demo-*`— así que requiere credenciales de administración. **Cuidado: la política ya está en 5 versiones, que es el máximo de IAM.** El próximo cambio falla con `LimitExceeded` hasta que se borre una vieja (`aws iam delete-policy-version --version-id v1`).

### `TF_VAR_presupuesto_correo_alerta` es obligatoria

`terraform apply` **corta** si no está. Es a propósito y vale entenderlo antes de "arreglarlo": la variable tenía `default = ""` y las notificaciones salían de un `dynamic` condicional, así que un apply sin la variable **borraba las alertas en silencio** y dejaba dos presupuestos que no avisan a nadie. Ahora falta la variable y Terraform se detiene, que es el modo de falla correcto.

```bash
AWS_PROFILE=aab1-demo-deployer TF_VAR_presupuesto_correo_alerta=<correo> terraform apply
```

Conviene ponerlo en el `.tfvars` local (gitignoreado) para no depender de acordarse.
- Conectar el repo de GitHub a la app de Amplify (manual, vía consola, salvo que se pase un token).
- Migrar el state a un backend remoto si el equipo crece.
