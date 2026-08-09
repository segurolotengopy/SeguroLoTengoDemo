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

## Pendiente / fuera de alcance de este agente

- Conectar el repo de GitHub a la app de Amplify (manual, vía consola, salvo que se pase un token).
- Migrar el state a un backend remoto si el equipo crece.
