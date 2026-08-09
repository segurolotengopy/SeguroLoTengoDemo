terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.58"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Sin backend remoto para esta demo: el state queda local (terraform.tfstate
  # en esta carpeta). Se documenta la decisión en README.md. Si más adelante
  # se quiere compartir el state entre operadores, migrar a un backend "s3"
  # apuntando a un bucket slt-demo-* dedicado.
}
