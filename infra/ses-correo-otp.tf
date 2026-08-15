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

resource "aws_sesv2_email_identity" "otp_correo_remitente" {
  email_identity = var.otp_email_remitente
}

# El rol de Amplify es a la vez build y cómputo SSR (ver amplify.tf): este
# permiso es el que usa el Route Handler de P4 desplegado. Acotado a la
# identidad del remitente: enviar "desde" cualquier otra identidad falla.
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
        Resource = [aws_sesv2_email_identity.otp_correo_remitente.arn]
      }
    ]
  })
}
