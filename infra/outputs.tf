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

# --- Intercambio con Alianza (alianza-sftp.tf / alianza-vpn.tf) --------------
# Todos vacíos mientras alianza_sftp_habilitado = false.

output "alianza_sftp_ips_salida" {
  description = <<-EOT
    IP públicas estáticas de salida del conector SFTP (egreso SERVICE_MANAGED):
    las que se le mandan a Alianza para su firewall. Con la VPN encendida no
    aplican: el origen pasa a ser alianza_vpn_cidr_origen.
  EOT
  value       = try(data.aws_transfer_connector.alianza[0].service_managed_egress_ip_addresses, [])
}

output "alianza_sftp_connector_id" {
  description = "ID del conector (c-…): ALIANZA_SFTP_CONNECTOR_ID de la app."
  value       = try(aws_transfer_connector.alianza[0].connector_id, null)
}

output "alianza_sftp_bandeja_bucket" {
  description = "Bucket de tránsito del intercambio: ALIANZA_SFTP_BUCKET de la app."
  value       = try(aws_s3_bucket.intercambio_alianza[0].bucket, null)
}

output "alianza_sftp_secret_arn" {
  description = "Secreto SIN valor donde se carga la credencial SFTP (Username + PrivateKey)."
  value       = try(aws_secretsmanager_secret.alianza_sftp[0].arn, null)
}

output "alianza_vpn_cidr_origen" {
  description = "Con la VPN encendida, el CIDR que Alianza ve como origen (subredes del resource gateway)."
  value       = local.alianza_vpn_activa ? var.alianza_vpn_vpc_cidr : null
}

output "alianza_vpn_connection_id" {
  description = "ID de la conexión Site-to-Site VPN: con él se descarga la configuración para el equipo de Alianza."
  value       = try(aws_vpn_connection.alianza[0].id, null)
}
