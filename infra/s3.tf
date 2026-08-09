# Sufijo aleatorio para evitar colisiones de nombre de bucket (los nombres
# de bucket S3 son globalmente únicos en AWS).
resource "random_id" "evidencias_suffix" {
  byte_length = 4
}

// Object Lock (WORM) para el bucket de evidencias.
//
// Respaldo normativo: fila 76 de docs/Tabla Cumplimiento SeguroLo Tengo -
// Tabla.csv — R8 SEGURIDAD, CONSERVACIÓN Y AUDITORÍA, "Conservar el
// expediente y las evidencias durante el plazo aplicable", Res. SEPRELAD
// 71/19, arts. 43-44 (mínimo 5 años); Ley 6822/21, art. 66. Es además la
// contracara de infraestructura de la regla de negocio inviolable #10
// (evidencia append-only): con versionado solo, un principal con permisos
// puede borrar; con Object Lock, no.
//
// `object_lock_enabled` SOLO puede fijarse al crear el bucket y no se puede
// desactivar después. Por eso se decide ahora, antes del primer apply.
resource "aws_s3_bucket" "evidencias" {
  bucket              = "slt-demo-evidencias-${random_id.evidencias_suffix.hex}"
  object_lock_enabled = true
}

// Retención por defecto de cada objeto.
//
// GOVERNANCE + 30 días para la demo: da la forma WORM real (ningún borrado
// accidental, ninguna sobrescritura de una versión retenida) sin dejar la
// cuenta con un bucket indestruible durante cinco años. Un principal con
// s3:BypassGovernanceRetention puede levantarlo, que es justo lo que se
// necesita para desmontar un entorno de demostración.
//
// PARA EL PILOTO / PRODUCCIÓN hay que cambiar a:
//     mode = "COMPLIANCE"
//     years = 5
// COMPLIANCE es irreversible por diseño: durante el plazo no puede borrar
// nadie, ni el usuario root de la cuenta. Eso es exactamente lo que exige la
// fila 76, y exactamente lo que no conviene en un entorno descartable.
resource "aws_s3_bucket_object_lock_configuration" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 30
    }
  }

  // El versionado tiene que estar activo antes de configurar la retención.
  depends_on = [aws_s3_bucket_versioning.evidencias]
}

resource "aws_s3_bucket_versioning" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Regla de ciclo de vida a 90 días: como el bucket tiene versionado activado,
# cada sobrescritura o borrado lógico de un objeto (PDF regenerado, hash
# actualizado, etc.) deja una versión "no vigente". Expirar esas versiones
# no vigentes a los 90 días acota el costo de almacenamiento sin perder la
# versión actual de cada evidencia (que se conserva indefinidamente, como
# corresponde a evidencia de un flujo con valor legal). También se limpian
# uploads multipart incompletos para evitar cargos huérfanos.
#
# Interacción con Object Lock: una versión bajo retención NO se borra aunque
# la regla la alcance — S3 la deja pasar y la expira recién cuando el bloqueo
# vence. Con la retención de la demo (30 días) contra estos 90, la regla
# funciona igual. Si el piloto pasa a COMPLIANCE con 5 años, esta regla queda
# sin efecto práctico y hay que revisarla junto con el plazo.
resource "aws_s3_bucket_lifecycle_configuration" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  rule {
    id     = "expire-noncurrent-versions-90d"
    status = "Enabled"

    # Filtro vacío = aplica a todos los objetos del bucket.
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
