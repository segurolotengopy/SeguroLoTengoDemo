# Control de gasto de la demo.
#
# Por qué existe: la demo corre sobre crédito promocional de AWS, y el costo
# por expediente de la verificación de identidad es bajo pero **por evento**
# (~USD 0,015 por chequeo de prueba de vida, ~USD 0,001 por comparación
# facial, ~USD 0,0015 por página de OCR). Un bucle de reintentos, una prueba
# de carga o un demo que quede abierto pueden consumir crédito sin que nadie
# se entere hasta que se acabó. La alerta llega por correo antes de eso.
#
# El saldo del crédito en sí **no se consulta desde acá**: el usuario
# `aab1-demo-deployer` no tiene permisos de Cost Explorer a propósito (es de
# mínimo privilegio) y los créditos se miran desde la consola de Billing.
# Esto controla el gasto, que es lo accionable por infraestructura.

variable "presupuesto_mensual_usd" {
  description = <<-EOT
    Tope mensual de gasto de la cuenta de demo, en dólares. El default es
    deliberadamente chico: a ~USD 0,021 por expediente completo de P5, mil
    verificaciones son ~USD 21, y el resto de la demo (DynamoDB bajo demanda,
    S3, Amplify) es de centavos. Si un mes se acerca a este número, algo se
    está usando de más — que es exactamente lo que la alerta tiene que avisar.
  EOT
  type        = number
  default     = 50
}

variable "presupuesto_correo_alerta" {
  description = <<-EOT
    Correo que recibe las alertas de presupuesto. Vacío desactiva las
    notificaciones (el presupuesto se sigue creando y se puede ver en la
    consola, pero no avisa a nadie). Pasalo por TF_VAR_presupuesto_correo_alerta
    o en el .tfvars local, que no se versiona.
  EOT
  type        = string
  default     = ""
}

locals {
  # Sin correo no tiene sentido crear notificaciones: AWS rechaza una
  # notificación sin destinatarios.
  notificar_presupuesto = var.presupuesto_correo_alerta != ""
}

# Presupuesto de la cuenta completa. Tres avisos escalonados: al 50% y al 80%
# de lo gastado (para enterarse a tiempo) y al 100% de lo *proyectado* (para
# enterarse antes de que pase, no después).
resource "aws_budgets_budget" "demo_mensual" {
  name         = "slt-demo-presupuesto-mensual"
  budget_type  = "COST"
  limit_amount = var.presupuesto_mensual_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = local.notificar_presupuesto ? [50, 80] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.presupuesto_correo_alerta]
    }
  }

  dynamic "notification" {
    for_each = local.notificar_presupuesto ? [1] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 100
      threshold_type             = "PERCENTAGE"
      notification_type          = "FORECASTED"
      subscriber_email_addresses = [var.presupuesto_correo_alerta]
    }
  }
}

# Presupuesto acotado a los dos servicios de verificación de identidad.
#
# Va aparte del anterior a propósito: el gasto de Rekognition y Textract es el
# único de esta demo que escala con el uso de personas reales, así que conviene
# verlo solo, sin que lo tape el costo fijo del resto. Si este se dispara y el
# general no, el problema está en P5.
resource "aws_budgets_budget" "identidad_mensual" {
  name         = "slt-demo-presupuesto-identidad"
  budget_type  = "COST"
  limit_amount = 20
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Rekognition", "Amazon Textract"]
  }

  dynamic "notification" {
    for_each = local.notificar_presupuesto ? [80] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.presupuesto_correo_alerta]
    }
  }
}
