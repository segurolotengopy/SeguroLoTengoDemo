output "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB de expedientes."
  value       = aws_dynamodb_table.expedientes.name
}

output "dynamodb_table_arn" {
  value = aws_dynamodb_table.expedientes.arn
}

output "s3_bucket_name" {
  description = "Nombre del bucket S3 de evidencias (incluye sufijo aleatorio)."
  value       = aws_s3_bucket.evidencias.bucket
}

output "s3_bucket_arn" {
  value = aws_s3_bucket.evidencias.arn
}

output "amplify_service_role_arn" {
  description = "ARN del rol de ejecución IAM usado por Amplify Hosting."
  value       = aws_iam_role.amplify_service_role.arn
}

output "app_secrets_arn" {
  description = "ARN del secret con DEMO_PANEL_KEY y OTP_PEPPER."
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "amplify_app_id" {
  value = aws_amplify_app.slt_demo.id
}

output "amplify_default_domain" {
  description = "Dominio *.amplifyapp.com por defecto (una vez conectado y desplegado un branch)."
  value       = aws_amplify_app.slt_demo.default_domain
}

output "cloudwatch_log_group_name" {
  value = aws_cloudwatch_log_group.app.name
}
