# Tabla única (single-table design) para expedientes y OTP, con TTL nativo
# para expiración automática (OTP de 5 minutos, expedientes vencidos, etc.).
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
