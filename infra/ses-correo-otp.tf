# ---------------------------------------------------------------------------
# OTP de correo (P4) por Amazon SES — ítem 4 de la tabla de integraciones
# (decisión 2026-08-14: SES como plataforma, Infobip 2FA Email solo backup).
#
# El adaptador vivo (`src/adapters/live/otp-provider-correo-ses.ts`) se activa
# con INTEGRATION_OTP_EMAIL=live + OTP_EMAIL_FROM=<remitente verificado>.
#
# OJO — primer apply de este archivo:
#   * `SLTDemoDeployerPolicy` NO incluye `ses:CreateEmailIdentity` hoy, así
#     que crear la identidad requiere un paso de administración (consola o
#     CloudShell con Andres_Alberdi_1) — igual que cada cambio de esa
#     política (recordar el tope de 5 versiones: borrar una vieja antes).
#     Alternativa sin tocar la política: crear la identidad a mano y traerla
#     con `terraform import aws_sesv2_email_identity.otp_correo_remitente <email>`.
#   * La identidad queda "pendiente" hasta que se haga clic en el enlace del
#     correo de verificación que manda AWS al remitente.
#   * La cuenta arranca en sandbox de SES: solo se puede enviar a direcciones
#     también verificadas. Para la demo, verificar la casilla de cada
#     destinatario; para producción, pedir salida del sandbox (caso de soporte).
#   * El permiso del usuario local `aab1-demo-qa` (npm run dev) es de usuario,
#     no de rol: no se gestiona acá. El JSON de referencia ya lo incluye
#     (`iam-policy-qa-reference.json`, Sid SesEnvioOtpCorreo) — aplicarlo en
#     consola con la cuenta de administración.
# ---------------------------------------------------------------------------

variable "otp_email_remitente" {
  type        = string
  default     = "segurolotengo.py@gmail.com"
  description = <<-EOT
    Remitente del OTP de correo (OTP_EMAIL_FROM). Con una casilla gmail el
    correo puede caer en spam (no se puede firmar DKIM de gmail.com): para el
    piloto conviene migrar a un dominio propio verificado en SES.
  EOT
}

# ---------------------------------------------------------------------------
# La identidad del remitente NO se declara como recurso, a propósito.
#
# Ya existe: se creó y verificó a mano por consola (paso 1 de
# docs/MENSAJERIA_REAL_PASOS.md). Declararla acá obligaba a una de dos cosas,
# las dos malas:
#
#   * Dejar que Terraform intente **crearla**, que es lo que pasaba antes. En
#     el mejor caso corta con AccessDenied —`SLTDemoDeployerPolicy` no tiene
#     `ses:CreateEmailIdentity`— y deja el apply a medias; en el peor, toca la
#     identidad verificada de la que hoy depende el OTP de correo.
#   * Importarla al state, que necesita `ses:GetEmailIdentity` y por lo tanto
#     credenciales de administración, en una máquina donde solo hay perfiles
#     de mínimo privilegio.
#
# El ARN de una identidad de SES tiene formato fijo y documentado, así que se
# construye. La consecuencia hay que decirla: **Terraform no gestiona la
# identidad**, y si alguien la borra de la consola este código no la recrea —
# el síntoma sería que P4 deja de enviar. Es una descripción honesta de quién
# es dueño de qué, no un atajo: el deployer nunca pudo gestionarla.
#
# Para que Terraform la gestione de verdad hay que ampliar la política del
# deployer con `ses:*EmailIdentity*` (ojo al tope de 5 versiones de IAM) y
# después importarla. Está anotado como pendiente, no como bloqueante.
# ---------------------------------------------------------------------------
locals {
  # ---------------------------------------------------------------------------
  # `identity/*` y NO el ARN de la identidad exacta. No es pereza: acotarlo a
  # `identity/segurolotengo.py@gmail.com` **no funciona** — probado contra la
  # cuenta real, con la evidencia del expediente diciendo
  # `causa=SES: AccessDeniedException` mientras el mismo envío, con el mismo
  # remitente y el mismo destinatario, salía bien desde el usuario
  # `aab1-demo-qa`, cuya política de referencia
  # (`iam-policy-qa-reference.json`, Sid SesEnvioOtpCorreo) usa el comodín.
  #
  # La lección, que costó una demostración a ciegas: una política más estricta
  # que la que se sabe que anda no es "más segura", es **rota**. Y una rota
  # falla en runtime, en el peor momento, con un mensaje que no dice cuál de
  # las dos cosas pasó.
  #
  # Sigue acotado a la región y a la cuenta. Lo que se pierde es la garantía de
  # "solo desde esta casilla"; recuperarla es posible con una condición
  # `ses:FromAddress` sobre este mismo statement, pero eso hay que **probarlo
  # contra la cuenta** antes de dejarlo, no razonarlo — que es exactamente el
  # error que se cometió acá.
  # ---------------------------------------------------------------------------
  otp_email_identity_arn = "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/*"
}

# El rol de Amplify es a la vez build y cómputo SSR (ver amplify.tf): este
# permiso es el que usa el Route Handler de P4 desplegado.
resource "aws_iam_role_policy" "amplify_ses_envio_otp" {
  name = "aab1-demo-ses-envio-otp"
  role = aws_iam_role.amplify_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SesEnvioOtpCorreo"
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = [local.otp_email_identity_arn]
      }
    ]
  })
}
