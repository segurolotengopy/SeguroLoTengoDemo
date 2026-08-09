variable "aws_region" {
  description = "Región de AWS donde se despliega la demo (decidido: us-east-1, sin VPC/NAT/Aurora)."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = <<-EOT
    Perfil de AWS CLI a usar para autenticar el provider. Dejalo en null (default)
    para que el provider resuelva credenciales vía la cadena estándar de AWS
    (incluida la variable de entorno AWS_PROFILE). Para este proyecto, corré
    Terraform con: AWS_PROFILE=aab1-demo-deployer terraform <comando>
    Nunca uses un perfil admin/root para este proyecto.
  EOT
  type        = string
  default     = null
}

variable "project" {
  description = "Nombre del proyecto, usado en tags."
  type        = string
  default     = "SeguroLoTengo"
}

variable "environment" {
  description = "Entorno (siempre 'demo' para esta vía de infraestructura)."
  type        = string
  default     = "demo"
}

variable "amplify_repository_url" {
  description = <<-EOT
    URL del repositorio de GitHub a conectar con Amplify Hosting (ej:
    https://github.com/org/segurolotengo-demo). Se deja vacío por default:
    conectar un repo de GitHub vía Terraform requiere un token OAuth/access
    token de GitHub que no se gestiona en este código. Si se define esta
    variable junto con var.amplify_github_access_token, Terraform intentará
    conectar el repo; si no, la app de Amplify se crea sin repo conectado y
    la conexión se completa manualmente desde la consola de Amplify
    (Hosting > conectar rama) una sola vez.
  EOT
  type        = string
  default     = ""
}

variable "amplify_github_access_token" {
  description = "Token de acceso personal de GitHub para conectar el repo a Amplify. Sensible; no lo pongas en el .tfvars versionado, pasalo por TF_VAR_amplify_github_access_token o -var en la línea de comandos."
  type        = string
  default     = ""
  sensitive   = true
}
