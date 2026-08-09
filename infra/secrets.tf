# Un solo secret con ambos valores como JSON (DEMO_PANEL_KEY y el pepper de
# hashing de OTP). Se eligió consolidar en vez de dos secrets separados
# porque: (a) ambos se leen juntos al arrancar la app / en la misma ruta de
# configuración, (b) reduce el número de llamadas a Secrets Manager y de
# recursos IAM a autorizar, (c) el volumen y la sensibilidad de ambos
# valores es comparable (secretos de aplicación de bajo volumen, no
# credenciales de infraestructura separadas). Si en el futuro divergen los
# consumidores o el ciclo de rotación de cada valor, separarlos en dos
# secrets es un cambio de bajo riesgo.
resource "random_password" "otp_pepper" {
  length  = 32
  special = true
}

resource "random_password" "panel_key" {
  length  = 24
  special = false
}

# Clave de la consola administrativa (docs/CONSOLA_ADMINISTRATIVA.md, secc. 2).
# Secreto separado del panel de demo a propósito: la consola puede crear
# expedientes y levantar el bloqueo por cedula, el panel no. Compartir clave
# haria imposible revocar una sin la otra.
resource "random_password" "admin_console_key" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "slt-demo-app-secrets"
  description = "Secrets de arranque de la app demo SeguroLoTengo: DEMO_PANEL_KEY (acceso al panel de demo), ADMIN_CONSOLE_KEY (acceso a la consola administrativa) y OTP_PEPPER (pepper aplicado antes de hashear los OTP). Valores generados por Terraform como placeholders de arranque; se pueden rotar manualmente desde Secrets Manager sin volver a aplicar Terraform."
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    DEMO_PANEL_KEY    = random_password.panel_key.result
    OTP_PEPPER        = random_password.otp_pepper.result
    ADMIN_CONSOLE_KEY = random_password.admin_console_key.result
  })

  # Evita que Terraform pise una rotación manual del secret hecha desde la
  # consola/CLI en aplicaciones posteriores del plan.
  #
  # OJO al agregar una clave nueva a este JSON (p. ej. ADMIN_CONSOLE_KEY): en
  # un despliegue que ya existe, `ignore_changes` hace que Terraform NO
  # actualice el secret. Hay que agregar el campo a mano en Secrets Manager, o
  # quitar temporalmente este `lifecycle`, aplicar y volver a ponerlo. Si falta,
  # la app arranca pero `obtenerSecretosApp()` falla con "no tiene la forma
  # esperada".
  lifecycle {
    ignore_changes = [secret_string]
  }
}
