#!/usr/bin/env bash
#
# Aplica la política de opt-out de servicios de IA de AWS a la cuenta de la demo.
#
# Qué logra: que las imágenes de rostro y de cédula que P5 manda a Rekognition y
# a Textract **no se usen ni se almacenen para mejorar los servicios de AWS**.
# Con datos biométricos bajo la Ley 7593/2025 es condición de entrada antes de
# procesar la primera imagen de una persona real, no un pendiente cosmético.
#
# Por qué hace falta un script y no un `terraform apply`: es una política de AWS
# **Organizations**, no de cuenta. `aab1-demo-deployer` no tiene —ni debe tener—
# permisos de Organizations, así que meterla en el stack de Terraform haría
# fallar con AccessDenied *todos* los apply de la demo. Esto se corre una sola
# vez, con credenciales de administración.
#
#   AWS_PROFILE=<perfil-admin> ./infra/aplicar-opt-out-ia.sh
#
# Es **idempotente**: se puede correr las veces que haga falta. Cada paso
# verifica el estado antes de actuar y no repite lo ya hecho. Si algo falla a
# mitad de camino, se corrige y se vuelve a correr.
#
# La creación de la organización —el único paso estructural— pide confirmación.
# Con `--si` no pregunta, para uso desatendido.
#
set -euo pipefail

# Cuenta esperada. El usuario tiene varias cuentas de AWS: si el perfil apunta a
# otra, el script corta antes de tocar nada. Un opt-out aplicado a la cuenta
# equivocada no protege nada y sí modifica una organización ajena.
readonly CUENTA_ESPERADA="120005938663"

readonly TIPO_POLITICA="AISERVICES_OPT_OUT_POLICY"
readonly NOMBRE_POLITICA="slt-opt-out-servicios-ia"
readonly DESCRIPCION_POLITICA="Opt-out de uso de contenido para mejora de servicios de IA de AWS (datos biometricos, Ley 7593/2025)"

readonly DIRECTORIO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ARCHIVO_POLITICA="${DIRECTORIO}/politica-opt-out-ia.json"

export AWS_PAGER=""

CONFIRMAR_TODO=false
[[ "${1:-}" == "--si" ]] && CONFIRMAR_TODO=true

# --- Salida legible -----------------------------------------------------------

if [[ -t 1 ]]; then
  readonly AZUL=$'\033[34m' VERDE=$'\033[32m' AMARILLO=$'\033[33m' ROJO=$'\033[31m' FIN=$'\033[0m'
else
  readonly AZUL='' VERDE='' AMARILLO='' ROJO='' FIN=''
fi

paso()  { printf '\n%s==>%s %s\n' "$AZUL" "$FIN" "$1"; }
ok()    { printf '  %s✓%s %s\n' "$VERDE" "$FIN" "$1"; }
salto() { printf '  %s·%s %s\n' "$AMARILLO" "$FIN" "$1"; }
fallar() { printf '\n%sError:%s %s\n' "$ROJO" "$FIN" "$1" >&2; exit 1; }

confirmar() {
  $CONFIRMAR_TODO && return 0
  printf '\n%s%s%s\n' "$AMARILLO" "$1" "$FIN"
  read -r -p '  ¿Continuar? [s/N] ' respuesta
  [[ "$respuesta" == "s" || "$respuesta" == "S" ]] || fallar "Cancelado por el usuario."
}

# --- 0. Comprobaciones previas -----------------------------------------------

paso "Comprobaciones previas"

command -v aws  >/dev/null || fallar "Falta la CLI de AWS."
command -v jq   >/dev/null || fallar "Falta jq."
[[ -f "$ARCHIVO_POLITICA" ]] || fallar "No encuentro $ARCHIVO_POLITICA"

jq -e '.services.default.opt_out_policy["@@assign"] == "optOut"' "$ARCHIVO_POLITICA" >/dev/null \
  || fallar "$ARCHIVO_POLITICA no opta por salir de todos los servicios (services.default = optOut)."
ok "Documento de política válido"

identidad="$(aws sts get-caller-identity --output json 2>/dev/null)" \
  || fallar "No hay credenciales válidas. Exportá un perfil de administración: AWS_PROFILE=<perfil-admin>"

cuenta="$(jq -r '.Account' <<<"$identidad")"
arn="$(jq -r '.Arn' <<<"$identidad")"

if [[ "$cuenta" != "$CUENTA_ESPERADA" ]]; then
  fallar "El perfil apunta a la cuenta $cuenta y se esperaba $CUENTA_ESPERADA.
  Identidad: $arn
  Revisá AWS_PROFILE: aplicar esto a otra cuenta no protege la demo y sí modifica una organización ajena."
fi
ok "Cuenta $cuenta · $arn"

if [[ "$arn" == *":user/aab1-demo-deployer" || "$arn" == *":user/aab1-demo-qa" ]]; then
  fallar "Ese usuario es de mínimo privilegio y no tiene permisos de Organizations.
  Usá un perfil de administración."
fi

# --- 1. Organización ----------------------------------------------------------

paso "Organización de AWS"

if organizacion="$(aws organizations describe-organization --output json 2>/dev/null)"; then
  id_org="$(jq -r '.Organization.Id' <<<"$organizacion")"
  conjunto="$(jq -r '.Organization.FeatureSet' <<<"$organizacion")"
  maestra="$(jq -r '.Organization.MasterAccountId' <<<"$organizacion")"
  salto "Ya existe: $id_org (FeatureSet=$conjunto)"

  [[ "$maestra" == "$cuenta" ]] \
    || fallar "Esta cuenta ($cuenta) no es la de gestión de $id_org (lo es $maestra).
  La política se aplica desde la cuenta de gestión."

  # Las políticas de organización solo existen con todas las funcionalidades.
  # La migración desde CONSOLIDATED_BILLING es de una sola dirección, así que no
  # se hace automáticamente: es una decisión del dueño de la organización.
  [[ "$conjunto" == "ALL" ]] \
    || fallar "La organización está en FeatureSet=$conjunto y las políticas exigen ALL.
  Migrar es un cambio **de una sola dirección**: hacelo a conciencia con
  'aws organizations enable-all-features' y volvé a correr este script."
else
  confirmar "La cuenta $cuenta no pertenece a ninguna organización y hay que crear una (solo esta cuenta como miembro).
  Es el único mecanismo que AWS ofrece para el opt-out de servicios de IA.
  Se crea con --feature-set ALL, que es obligatorio para las políticas.
  Reversible: se puede borrar con 'delete-organization' mientras no tenga cuentas miembro."

  organizacion="$(aws organizations create-organization --feature-set ALL --output json)"
  id_org="$(jq -r '.Organization.Id' <<<"$organizacion")"
  ok "Organización creada: $id_org"
fi

id_root="$(aws organizations list-roots --query 'Roots[0].Id' --output text)"
[[ -n "$id_root" && "$id_root" != "None" ]] || fallar "No pude obtener el id del root de la organización."
ok "Root: $id_root"

# --- 2. Habilitar el tipo de política ----------------------------------------

paso "Tipo de política $TIPO_POLITICA"

# Ojo con el identificador: es AISERVICES_OPT_OUT_POLICY, con guiones bajos —
# no AISERVICESOPTOUT_POLICY, que es lo que uno escribiría por analogía con
# BACKUP_POLICY. Sale del modelo de la API, la documentación no lista el enum.
habilitado="$(aws organizations list-roots \
  --query "Roots[0].PolicyTypes[?Type=='${TIPO_POLITICA}' && Status=='ENABLED'] | length(@)" \
  --output text)"

if [[ "$habilitado" == "0" ]]; then
  aws organizations enable-policy-type --root-id "$id_root" --policy-type "$TIPO_POLITICA" >/dev/null
  ok "Habilitado en el root"
else
  salto "Ya estaba habilitado"
fi

# --- 3. Crear o actualizar la política ---------------------------------------

paso "Política $NOMBRE_POLITICA"

contenido="$(jq -c . "$ARCHIVO_POLITICA")"

id_politica="$(aws organizations list-policies --filter "$TIPO_POLITICA" \
  --query "Policies[?Name=='${NOMBRE_POLITICA}'].Id | [0]" --output text)"

if [[ -z "$id_politica" || "$id_politica" == "None" ]]; then
  id_politica="$(aws organizations create-policy \
    --name "$NOMBRE_POLITICA" \
    --description "$DESCRIPCION_POLITICA" \
    --type "$TIPO_POLITICA" \
    --content "$contenido" \
    --query 'Policy.PolicySummary.Id' --output text)"
  ok "Creada: $id_politica"
else
  # Se reescribe el contenido para que el archivo del repo siga siendo la
  # fuente de verdad aunque alguien haya editado la política en la consola.
  aws organizations update-policy --policy-id "$id_politica" --content "$contenido" >/dev/null
  salto "Ya existía ($id_politica); contenido sincronizado con el repo"
fi

# --- 4. Adjuntar al root ------------------------------------------------------

paso "Adjuntar al root"

# Al root y no a la cuenta: así alcanza también a cualquier cuenta que se sume
# a la organización más adelante, sin que nadie tenga que acordarse.
adjunta="$(aws organizations list-policies-for-target --target-id "$id_root" \
  --filter "$TIPO_POLITICA" \
  --query "Policies[?Id=='${id_politica}'] | length(@)" --output text)"

if [[ "$adjunta" == "0" ]]; then
  aws organizations attach-policy --policy-id "$id_politica" --target-id "$id_root" >/dev/null
  ok "Adjuntada a $id_root"
else
  salto "Ya estaba adjunta"
fi

# --- 5. Verificación ----------------------------------------------------------

paso "Verificación de la política efectiva"

# Esto es lo que importa: no que los comandos hayan salido bien, sino que la
# política **efectiva** sobre la cuenta diga optOut. Es la evidencia de
# cumplimiento que hay que guardar.
efectiva="$(aws organizations describe-effective-policy \
  --policy-type "$TIPO_POLITICA" --target-id "$cuenta" \
  --query 'EffectivePolicy.PolicyContent' --output text)"

valor="$(jq -r '.services.default.opt_out_policy["@@assign"] // "ausente"' <<<"$efectiva")"

if [[ "$valor" != "optOut" ]]; then
  printf '%s\n' "$efectiva" >&2
  fallar "La política efectiva no dice optOut para 'default' (dice: $valor).
  AWS puede tardar unos segundos en propagarla: reintentá en un minuto."
fi

ok "services.default = optOut"

paso "Listo"
cat <<RESUMEN

  Organización : $id_org
  Root         : $id_root
  Política     : $id_politica ($NOMBRE_POLITICA)
  Cuenta       : $cuenta

  Rekognition y Textract ya no pueden usar las imágenes de rostro y cédula
  para mejorar los servicios de AWS.

  Guardá como evidencia de cumplimiento la salida de:

    aws organizations describe-effective-policy \\
      --policy-type $TIPO_POLITICA --target-id $cuenta

  Nota: al optar por salir, los servicios borran el contenido histórico que
  hubieran almacenado con ese fin. Es lo buscado, y es irreversible.

RESUMEN
