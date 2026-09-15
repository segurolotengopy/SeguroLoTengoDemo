# ---------------------------------------------------------------------------
# VPN IPsec con Alianza — CONDICIONAL, apagada por defecto.
#
# Alianza todavía no respondió si quiere una VPN. Si la pide, este archivo la
# deja lista con un solo cambio de variable. Mientras
# `alianza_vpn_habilitada = false` no crea nada.
#
# ## Cómo pasa el tráfico SFTP por el túnel
#
# Un conector de Transfer Family con egreso SERVICE_MANAGED sale por Internet
# desde NAT del servicio, y no hay forma de meterlo en un túnel. Pero desde
# octubre de 2025 el conector admite egreso **VPC_LATTICE**: el tráfico entra a
# una VPC nuestra por un *resource gateway* de VPC Lattice y sale hacia una
# *resource configuration* que apunta a la **IP privada** del servidor. Si la
# VPC tiene una ruta a esa IP por un Virtual Private Gateway, el tráfico viaja
# por el túnel IPsec. AWS lo documenta como caso de uso explícito
# ("Connect to on-premises SFTP servers through AWS Direct Connect or AWS
# Site-to-Site VPN connections"):
#   https://docs.aws.amazon.com/transfer/latest/userguide/create-vpc-sftp-connector-procedure.html
#   https://docs.aws.amazon.com/transfer/latest/userguide/configure-sftp-connector.html
#
#   conector (VPC_LATTICE) → resource gateway (2 subredes, 2 AZ)
#     → tabla de rutas: <CIDR de Alianza> → VGW → túnel IPsec → 10.x de Alianza
#
# Consecuencias que conviene saber antes de encenderla:
#
# * **No hace falta Lambda, ECS ni NAT propio.** Sigue siendo el mismo conector
#   y el mismo código de la app; cambia solo por dónde sale.
# * **Alianza ve como origen las IP del resource gateway**, que son privadas y
#   de nuestra VPC (var.alianza_vpn_vpc_cidr), no las 3 IP públicas del
#   servicio. Su firewall tiene que habilitar ese CIDR del lado del túnel.
# * **El CIDR de nuestra VPC no puede solaparse con la red de Alianza.** La
#   captura mostraba 10.0.7.101: por eso el default es 192.168.250.0/24.
# * La resource configuration solo admite IP privadas de 10.0.0.0/8,
#   100.64.0.0/10, 172.16.0.0/12 o 192.168.0.0/16:
#   https://docs.aws.amazon.com/vpc-lattice/latest/ug/resource-configuration.html
# * El resource gateway exige subredes en al menos dos zonas, y no todas las
#   zonas de us-east-1 admiten VPC Lattice: por eso las zonas son una variable
#   por ID (use1-azN), no por nombre.
# * Costo: la conexión VPN y VPC Lattice cobran por hora y por GB; no es
#   gratis tenerla encendida sin uso.
#
# Terraform (provider hashicorp/aws ~> 6.0):
#   aws_customer_gateway, aws_vpn_gateway, aws_vpn_connection,
#   aws_vpn_connection_route, aws_vpn_gateway_route_propagation,
#   aws_vpclattice_resource_gateway, aws_vpclattice_resource_configuration
#   https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpclattice_resource_gateway
#   https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpclattice_resource_configuration
# ---------------------------------------------------------------------------

variable "alianza_vpn_habilitada" {
  description = <<-EOT
    Crea la VPN IPsec con Alianza y cambia el conector SFTP a egreso por VPC
    (VPC Lattice). Default false: Alianza todavía no respondió si la quiere.
    Exige alianza_sftp_habilitado = true.
  EOT
  type        = bool
  default     = false
}

variable "alianza_vpn_ip_publica_alianza" {
  description = "IP pública del equipo VPN de Alianza (customer gateway). La manda Alianza."
  type        = string
  default     = ""
}

variable "alianza_vpn_bgp_asn" {
  description = "ASN del customer gateway. Con rutas estáticas no se usa para enrutar, pero AWS lo exige; 65000 es privado."
  type        = number
  default     = 65000
}

variable "alianza_vpn_cidr_remoto" {
  description = "Red de Alianza que se alcanza por el túnel (la que contiene al servidor SFTP), p. ej. 10.0.7.0/24. La confirma Alianza."
  type        = string
  default     = ""
}

variable "alianza_vpn_ip_servidor_sftp" {
  description = "IP privada del servidor SFTP de Alianza del lado del túnel (la captura mostraba 10.0.7.101; confirmarla)."
  type        = string
  default     = ""
}

variable "alianza_vpn_vpc_cidr" {
  description = "CIDR de la VPC propia del túnel. Tiene que NO solaparse con alianza_vpn_cidr_remoto. Es también lo que Alianza habilita como origen."
  type        = string
  default     = "192.168.250.0/24"
}

variable "alianza_vpn_zonas" {
  description = "IDs de zona (no nombres) para las dos subredes del resource gateway. Tienen que admitir VPC Lattice."
  type        = list(string)
  default     = ["use1-az1", "use1-az2"]

  validation {
    condition     = length(var.alianza_vpn_zonas) >= 2
    error_message = "El resource gateway de VPC Lattice exige subredes en al menos dos zonas."
  }
}

locals {
  alianza_vpn_activa = var.alianza_sftp_habilitado && var.alianza_vpn_habilitada
}

resource "aws_vpc" "alianza_vpn" {
  count                = local.alianza_vpn_activa ? 1 : 0
  cidr_block           = var.alianza_vpn_vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "slt-demo-alianza-vpn" }

  lifecycle {
    precondition {
      condition = alltrue([
        var.alianza_vpn_ip_publica_alianza != "",
        var.alianza_vpn_cidr_remoto != "",
        var.alianza_vpn_ip_servidor_sftp != "",
      ])
      error_message = "alianza_vpn_habilitada = true exige alianza_vpn_ip_publica_alianza, alianza_vpn_cidr_remoto y alianza_vpn_ip_servidor_sftp (los manda Alianza)."
    }
    # Chequeo grueso: HCL no tiene una función de solapamiento de CIDR, así que
    # esto solo atrapa el error obvio (la misma red). Un solapamiento parcial lo
    # detecta AWS al propagar rutas, o la prueba de conexión.
    precondition {
      condition     = var.alianza_vpn_cidr_remoto != var.alianza_vpn_vpc_cidr
      error_message = "El CIDR de la VPC propia no puede ser el mismo que el de Alianza."
    }
  }
}

# Dos subredes privadas, sin salida a Internet: el único camino fuera es el túnel.
resource "aws_subnet" "alianza_vpn" {
  count                = local.alianza_vpn_activa ? 2 : 0
  vpc_id               = aws_vpc.alianza_vpn[0].id
  cidr_block           = cidrsubnet(var.alianza_vpn_vpc_cidr, 1, count.index)
  availability_zone_id = var.alianza_vpn_zonas[count.index]

  tags = { Name = "slt-demo-alianza-vpn-${count.index}" }
}

resource "aws_vpn_gateway" "alianza" {
  count  = local.alianza_vpn_activa ? 1 : 0
  vpc_id = aws_vpc.alianza_vpn[0].id

  tags = { Name = "slt-demo-alianza-vgw" }
}

resource "aws_customer_gateway" "alianza" {
  count      = local.alianza_vpn_activa ? 1 : 0
  bgp_asn    = var.alianza_vpn_bgp_asn
  ip_address = var.alianza_vpn_ip_publica_alianza
  type       = "ipsec.1"

  tags = { Name = "slt-demo-alianza-cgw" }
}

# Dos túneles (los crea AWS siempre), rutas estáticas. Las claves precompartidas
# las genera AWS: quedan en el state local y se le pasan a Alianza con el
# archivo de configuración que se descarga de la consola (ver la guía). No se
# fijan acá para no versionarlas.
resource "aws_vpn_connection" "alianza" {
  count               = local.alianza_vpn_activa ? 1 : 0
  vpn_gateway_id      = aws_vpn_gateway.alianza[0].id
  customer_gateway_id = aws_customer_gateway.alianza[0].id
  type                = "ipsec.1"
  static_routes_only  = true

  tags = { Name = "slt-demo-alianza-vpn" }
}

resource "aws_vpn_connection_route" "alianza" {
  count                  = local.alianza_vpn_activa ? 1 : 0
  vpn_connection_id      = aws_vpn_connection.alianza[0].id
  destination_cidr_block = var.alianza_vpn_cidr_remoto
}

resource "aws_route_table" "alianza_vpn" {
  count  = local.alianza_vpn_activa ? 1 : 0
  vpc_id = aws_vpc.alianza_vpn[0].id

  tags = { Name = "slt-demo-alianza-vpn" }
}

# La ruta estática de la conexión se propaga sola a esta tabla por el VGW.
resource "aws_vpn_gateway_route_propagation" "alianza" {
  count          = local.alianza_vpn_activa ? 1 : 0
  vpn_gateway_id = aws_vpn_gateway.alianza[0].id
  route_table_id = aws_route_table.alianza_vpn[0].id
}

resource "aws_route_table_association" "alianza_vpn" {
  count          = local.alianza_vpn_activa ? 2 : 0
  subnet_id      = aws_subnet.alianza_vpn[count.index].id
  route_table_id = aws_route_table.alianza_vpn[0].id
}

# El grupo de seguridad del resource gateway gobierna lo que sale de sus ENI:
# solo SSH/SFTP hacia la red de Alianza.
resource "aws_security_group" "alianza_resource_gateway" {
  count       = local.alianza_vpn_activa ? 1 : 0
  name        = "slt-demo-alianza-resource-gateway"
  description = "Salida del resource gateway de VPC Lattice: solo SFTP hacia la red de Alianza por el tunel."
  vpc_id      = aws_vpc.alianza_vpn[0].id

  egress {
    description = "SFTP hacia el servidor de Alianza por el tunel IPsec"
    from_port   = var.alianza_sftp_puerto
    to_port     = var.alianza_sftp_puerto
    protocol    = "tcp"
    cidr_blocks = [var.alianza_vpn_cidr_remoto]
  }
}

resource "aws_vpclattice_resource_gateway" "alianza" {
  count              = local.alianza_vpn_activa ? 1 : 0
  name               = "slt-demo-alianza-sftp"
  vpc_id             = aws_vpc.alianza_vpn[0].id
  subnet_ids         = aws_subnet.alianza_vpn[*].id
  security_group_ids = [aws_security_group.alianza_resource_gateway[0].id]
  ip_address_type    = "IPV4"
}

resource "aws_vpclattice_resource_configuration" "alianza_sftp" {
  count                       = local.alianza_vpn_activa ? 1 : 0
  name                        = "slt-demo-alianza-sftp"
  resource_gateway_identifier = aws_vpclattice_resource_gateway.alianza[0].id
  port_ranges                 = [tostring(var.alianza_sftp_puerto)]
  protocol                    = "TCP"

  resource_configuration_definition {
    ip_resource {
      ip_address = var.alianza_vpn_ip_servidor_sftp
    }
  }
}
