# Tabla única (single-table design) para expedientes y OTP, con TTL nativo
# para expiración automática (OTP de 5 minutos, expedientes vencidos, etc.).
# Point-in-Time Recovery apagado — ACEPTADO HASTA GO-LIVE (2026-08-20).
#
# Es un entorno de demostración: lo que vive en esta tabla son los expedientes
# de las personas de prueba de `src/adapters/mock/personas.ts`, no de clientes.
# Lo que sí tiene consecuencia legal —la evidencia probatoria, regla inviolable
# #10 de CLAUDE.md— no está acá sino en S3 con Object Lock, que es lo que la
# matriz de cumplimiento exige (fila 76, Res. SEPRELAD 71/19 arts. 43-44).
#
# PITR entra con el resto del endurecimiento de Go-Live, junto con el pase del
# bucket de evidencias de GOVERNANCE a COMPLIANCE + 5 años y la separación en
# tres cuentas de AWS. Arreglarlo suelto ahora daría una sensación de
# completitud que el entorno no tiene.
#
# Deja de ser aceptable apenas la tabla reciba datos de una persona real, o
# sea al empezar el piloto.
#
# No se anota con `# snyk:ignore:SNYK-CC-TF-125`: se probó y esta versión del
# CLI no aplica los ignores en línea de IaC (los cuenta como 0 ignorados).
# Dejar el directivo anunciaría un control que no existe. El hallazgo se
# tolera por el umbral del comando `npm run seguridad`, y queda anotado en
# `docs/POLITICA_DE_DESPLIEGUE.md` para que no se pierda.
resource "aws_dynamodb_table" "expedientes" {
  name         = "slt-demo-expedientes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  # Cifrado en reposo con la llave gestionada por AWS para DynamoDB
  # (alias/aws/dynamodb). No se usa una CMK propia porque no aporta
  # requisito adicional en este entorno de demo.
  server_side_encryption {
    enabled = true
  }
}
