# ---------------------------------------------------------------------------
# Intercambio de PDF con Alianza Garantía por SFTP — ítem 36 de
# `docs/Tabla de Integraciones externas - Tabla.csv`.
#
# Alianza propuso (correo del 14-sep-2026) un servidor SFTP propio detrás de un
# firewall que habilita por IP pública. Amplify no tiene IP de salida fija, así
# que el intercambio no sale del cómputo de la app: sale de un **conector SFTP
# de AWS Transfer Family**, que tiene IP estáticas y lee y escribe S3 directo.
# La app solo le pide al conector que mueva archivos entre S3 y el servidor
# (`src/adapters/live/intercambio-aseguradora-sftp.ts`).
#
# **Apagado por defecto.** Con `alianza_sftp_habilitado = false` (el default)
# este archivo no crea nada, y un `apply` sin los datos de Alianza no cambia la
# cuenta. Guía operativa: `docs/CONFIGURACION_SFTP_ALIANZA.md`.
#
# Referencias verificadas (15-sep-2026):
# - Recurso: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/transfer_connector
#   (`access_role`, `logging_role`, `url`, `security_policy_name`,
#   `sftp_config { trusted_host_keys, user_secret_id }`,
#   `egress_config { vpc_lattice { resource_configuration_arn, port_number } }`).
# - Data source con las IP: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/transfer_connector
#   (`service_managed_egress_ip_addresses`). El recurso NO expone las IP; solo
#   `arn` y `connector_id`.
# - API: https://docs.aws.amazon.com/transfer/latest/APIReference/API_DescribedConnector.html
#   (`ServiceManagedEgressIpAddresses`, `EgressType = SERVICE_MANAGED | VPC_LATTICE`).
# - Egreso y cantidad de IP: https://docs.aws.amazon.com/transfer/latest/userguide/configure-sftp-connector.html
#   ("The service provides 3 static IP addresses for your connectors").
# - Formato del secreto: https://docs.aws.amazon.com/transfer/latest/userguide/sftp-connector-secret-procedure.html
#   (claves `Username` y `PrivateKey` y/o `Password`; la clave privada NO
#   puede tener passphrase).
# ---------------------------------------------------------------------------

variable "alianza_sftp_habilitado" {
  description = <<-EOT
    Crea el conector SFTP de Transfer Family, su rol, su secreto y la bandeja de
    S3 del intercambio con Alianza. Default false: sin los datos de Alianza
    (host, puerto, huella de la clave del servidor, usuario) no hay nada que
    crear. Ver docs/CONFIGURACION_SFTP_ALIANZA.md.
  EOT
  type        = bool
  default     = false
}

variable "alianza_sftp_url" {
  description = <<-EOT
    URL del servidor SFTP de Alianza, con el formato sftp://<host-o-ip-publica>:<puerto>.
    Obligatoria con egreso por Internet (IP estáticas del servicio). Con la VPN
    encendida se ignora: el destino pasa a ser la IP privada del servidor
    (var.alianza_vpn_ip_servidor_sftp). No se versiona: va en el .tfvars local.
  EOT
  type        = string
  default     = ""

  validation {
    condition     = var.alianza_sftp_url == "" || can(regex("^sftp://[^/\\s]+(:[0-9]{1,5})?$", var.alianza_sftp_url))
    error_message = "alianza_sftp_url tiene que tener la forma sftp://host:puerto, sin ruta."
  }
}

variable "alianza_sftp_trusted_host_keys" {
  description = <<-EOT
    Parte pública de la o las claves de host del servidor SFTP de Alianza
    (formato "ssh-ed25519 AAAA..." o "ssh-rsa AAAA..."). Es lo que impide que el
    conector le entregue documentos con datos de salud a un servidor que se hace
    pasar por el de Alianza. Se contrasta contra la huella que mande Alianza por
    un canal distinto del que trae la clave (ver la guía).
  EOT
  type        = list(string)
  default     = []
}

variable "alianza_sftp_security_policy" {
  description = <<-EOT
    Política criptográfica del conector (TransferSFTPConnectorSecurityPolicy-*).
    null deja la que AWS aplica por defecto. Si el servidor de Alianza solo
    admite algoritmos viejos, la conexión falla y hay que elegir otra: no se
    elige a ciegas antes de conocer el servidor.
  EOT
  type        = string
  default     = null
}

variable "alianza_sftp_puerto" {
  description = "Puerto del servidor SFTP. Solo se usa con la VPN (VPC Lattice); con egreso por Internet va dentro de alianza_sftp_url."
  type        = number
  default     = 22
}

locals {
  alianza_sftp_activo = var.alianza_sftp_habilitado

  # Prefijos de la bandeja. Uno por dirección, y el conector no tiene permiso
  # fuera de ellos:
  #   salida/    — lo que mandamos a Alianza (la app escribe, el conector lee)
  #   entrada/   — lo que Alianza devuelve (el conector escribe, la app lee)
  #   listados/  — los JSON de StartDirectoryListing (el conector escribe)
  #   control/   — idempotencia y bitácora append-only de cada transferencia
  #                (solo la app; el conector no lo toca)
  alianza_prefijo_bandeja = "alianza"

  # Variables de entorno que el adaptador live necesita (amplify.tf las suma
  # con merge). Vacío con el intercambio apagado, así que un apply sin Alianza
  # no cambia la app. No incluye INTEGRATION_INTERCAMBIO_ASEGURADORA: pasar a
  # `live` es una decisión aparte, después de probar la conexión.
  alianza_sftp_env = {
    for clave, valor in {
      ALIANZA_SFTP_CONNECTOR_ID = try(aws_transfer_connector.alianza[0].connector_id, null)
      ALIANZA_SFTP_BUCKET       = try(aws_s3_bucket.intercambio_alianza[0].bucket, null)
    } : clave => valor if valor != null
  }
}

# ---------------------------------------------------------------------------
# Bandeja de S3 del intercambio
#
# Bucket propio y no el de evidencias, por dos razones:
#
# 1. El de evidencias tiene Object Lock, y S3 exige una suma de verificación
#    (Content-MD5 o checksum) en todo PutObject contra un bucket con retención
#    por defecto. No está documentado que el conector la mande al traer un
#    archivo, y descubrirlo con el primer CPC firmado de un cliente es el peor
#    momento. La evidencia definitiva la guarda después el lote de firma en el
#    bucket de evidencias (docs/plan/DISENO_FIRMA_EN_LOTE.md §2).
# 2. Es un buzón de tránsito: se puede acotar el rol del conector a este bucket
#    sin darle nada del de evidencias.
#
# Los PDF llevan declaraciones de salud y condición PEP (regla inviolable #7):
# acceso público bloqueado, cifrado en reposo, y los listados expiran solos.
# ---------------------------------------------------------------------------
resource "random_id" "intercambio_alianza_suffix" {
  count       = local.alianza_sftp_activo ? 1 : 0
  byte_length = 4
}

resource "aws_s3_bucket" "intercambio_alianza" {
  count  = local.alianza_sftp_activo ? 1 : 0
  bucket = "slt-demo-intercambio-alianza-${random_id.intercambio_alianza_suffix[0].hex}"
}

resource "aws_s3_bucket_versioning" "intercambio_alianza" {
  count  = local.alianza_sftp_activo ? 1 : 0
  bucket = aws_s3_bucket.intercambio_alianza[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "intercambio_alianza" {
  count  = local.alianza_sftp_activo ? 1 : 0
  bucket = aws_s3_bucket.intercambio_alianza[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "intercambio_alianza" {
  count  = local.alianza_sftp_activo ? 1 : 0
  bucket = aws_s3_bucket.intercambio_alianza[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "intercambio_alianza" {
  count  = local.alianza_sftp_activo ? 1 : 0
  bucket = aws_s3_bucket.intercambio_alianza[0].id

  # Los listados son instantáneas del directorio remoto: sirven minutos.
  rule {
    id     = "expirar-listados-7d"
    status = "Enabled"

    filter {
      prefix = "${local.alianza_prefijo_bandeja}/listados/"
    }

    expiration {
      days = 7
    }
  }

  # Las versiones reemplazadas no aportan nada: cada archivo lleva su huella en
  # la clave de control y el lote guarda el definitivo en el bucket de evidencias.
  rule {
    id     = "expirar-versiones-no-vigentes-30d"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ---------------------------------------------------------------------------
# Credencial del conector — SIN valor.
#
# Terraform crea el contenedor y nada más. El valor lo carga Andres a mano
# (JSON con `Username` y `PrivateKey`), porque:
#   * la clave privada no tiene por qué pasar por el state de Terraform, que es
#     local y en texto claro;
#   * el usuario lo define Alianza, no nosotros.
# Sin valor cargado el conector se crea igual, pero `TestConnection` falla con
# un error de autenticación: la guía dice en qué orden hacerlo.
#
# Nombre con prefijo slt-demo-: `SLTDemoDeployerPolicy` limita Secrets Manager
# a ese prefijo. AWS *recomienda* aws/transfer/ pero no lo exige.
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "alianza_sftp" {
  count       = local.alianza_sftp_activo ? 1 : 0
  name        = "slt-demo-alianza-sftp-credencial"
  description = "Credencial del conector SFTP de Transfer Family hacia el servidor de Alianza: JSON con Username y PrivateKey (sin passphrase). Se carga a mano; ver docs/CONFIGURACION_SFTP_ALIANZA.md."
}

# ---------------------------------------------------------------------------
# Rol del conector: lo asume Transfer Family, no la app.
#
# Mínimo privilegio: solo la bandeja (y dentro de ella, salida/ entrada/
# listados/ — nunca control/), el secreto de la credencial y sus propios logs.
#
# Get y Put en los tres prefijos, y no Get en uno y Put en otro: la
# documentación de AWS pide que el rol tenga "read and write access to the
# parent directory of the file location" de cada transferencia. Una política
# más estricta que la que AWS documenta no es más segura, es una que falla en
# runtime (la lección de ses-correo-otp.tf).
# ---------------------------------------------------------------------------
resource "aws_iam_role" "alianza_sftp_conector" {
  count = local.alianza_sftp_activo ? 1 : 0
  name  = "aab1-demo-alianza-sftp-conector"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "TransferFamilyAssume"
        Effect    = "Allow"
        Principal = { Service = "transfer.amazonaws.com" }
        Action    = "sts:AssumeRole"
        # Confused deputy: solo Transfer Family actuando para esta cuenta.
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "alianza_sftp_conector" {
  count = local.alianza_sftp_activo ? 1 : 0
  name  = "aab1-demo-alianza-sftp-conector"
  role  = aws_iam_role.alianza_sftp_conector[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "BandejaListar"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = [aws_s3_bucket.intercambio_alianza[0].arn]
      },
      {
        Sid    = "BandejaObjetos"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"]
        Resource = [
          "${aws_s3_bucket.intercambio_alianza[0].arn}/${local.alianza_prefijo_bandeja}/salida/*",
          "${aws_s3_bucket.intercambio_alianza[0].arn}/${local.alianza_prefijo_bandeja}/entrada/*",
          "${aws_s3_bucket.intercambio_alianza[0].arn}/${local.alianza_prefijo_bandeja}/listados/*",
        ]
      },
      {
        Sid      = "CredencialSftp"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.alianza_sftp[0].arn]
      },
      {
        # Mismo rol como logging_role. Los logs del conector traen rutas de
        # archivo y códigos de estado: por eso los nombres de archivo nunca
        # llevan datos de la persona (el adaptador lo hace cumplir).
        Sid    = "LogsDelConector"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/transfer/*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/transfer/*:log-stream:*"
        ]
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# El conector.
#
# Egreso SERVICE_MANAGED (sin egress_config): sale por NAT del servicio con 3
# IP estáticas, que son las que se le mandan a Alianza (output
# alianza_sftp_ips_salida). Con la VPN encendida pasa a VPC_LATTICE: `url` tiene
# que ser null (lo exige la API) y el destino es la resource configuration de
# alianza-vpn.tf.
# ---------------------------------------------------------------------------
resource "aws_transfer_connector" "alianza" {
  count = local.alianza_sftp_activo ? 1 : 0

  access_role          = aws_iam_role.alianza_sftp_conector[0].arn
  logging_role         = aws_iam_role.alianza_sftp_conector[0].arn
  security_policy_name = var.alianza_sftp_security_policy
  url                  = var.alianza_vpn_habilitada ? null : var.alianza_sftp_url

  sftp_config {
    trusted_host_keys = var.alianza_sftp_trusted_host_keys
    user_secret_id    = aws_secretsmanager_secret.alianza_sftp[0].id
  }

  dynamic "egress_config" {
    for_each = var.alianza_vpn_habilitada ? [1] : []
    content {
      vpc_lattice {
        resource_configuration_arn = aws_vpclattice_resource_configuration.alianza_sftp[0].arn
        port_number                = var.alianza_sftp_puerto
      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.alianza_vpn_habilitada || var.alianza_sftp_url != ""
      error_message = "alianza_sftp_habilitado = true exige alianza_sftp_url (sftp://host:puerto) mientras la VPN esté apagada. Pedíselo a Alianza: la captura mostraba 10.0.7.101, que es interna y no sirve por Internet."
    }
    precondition {
      condition     = length(var.alianza_sftp_trusted_host_keys) > 0
      error_message = "alianza_sftp_habilitado = true exige alianza_sftp_trusted_host_keys. Sin la clave del servidor, el conector no puede comprobar que habla con Alianza."
    }
  }
}

# El recurso no expone las IP de salida; el data source sí.
data "aws_transfer_connector" "alianza" {
  count = local.alianza_sftp_activo ? 1 : 0
  id    = aws_transfer_connector.alianza[0].connector_id
}

# ---------------------------------------------------------------------------
# Permisos de la app (rol de cómputo de Amplify) sobre el intercambio.
#
# La app pide transferencias y lee/escribe la bandeja; nunca ve la credencial
# SFTP. Acotado al ARN del conector y a la bandeja.
# ---------------------------------------------------------------------------
resource "aws_iam_role_policy" "amplify_intercambio_alianza" {
  count = local.alianza_sftp_activo ? 1 : 0
  name  = "aab1-demo-intercambio-alianza"
  role  = aws_iam_role.amplify_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConectorAlianza"
        Effect = "Allow"
        Action = [
          "transfer:StartFileTransfer",
          "transfer:StartDirectoryListing",
          "transfer:StartRemoteMove",
          "transfer:ListFileTransferResults",
          "transfer:DescribeConnector"
        ]
        Resource = [aws_transfer_connector.alianza[0].arn]
      },
      {
        Sid      = "BandejaListar"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.intercambio_alianza[0].arn]
      },
      {
        # Sin DeleteObject: la bitácora de control/ es append-only (regla #10),
        # y la app tampoco borra lo que Alianza devolvió.
        Sid      = "BandejaObjetos"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = ["${aws_s3_bucket.intercambio_alianza[0].arn}/${local.alianza_prefijo_bandeja}/*"]
      }
    ]
  })
}
