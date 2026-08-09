# App de Amplify Hosting, plataforma WEB_COMPUTE (necesaria para el SSR de
# Next.js 15 / App Router). El nombre no está sujeto al prefijo obligatorio
# de la política de permisos (esa restricción aplica a DynamoDB, S3 y
# Secrets Manager), pero se usa el prefijo slt-demo- por consistencia.
resource "aws_amplify_app" "slt_demo" {
  name     = "slt-demo-segurolotengo"
  platform = "WEB_COMPUTE"

  iam_service_role_arn = aws_iam_role.amplify_service_role.arn

  # Conexión a GitHub: Terraform puede conectar el repo automáticamente solo
  # si se le pasa un token de acceso de GitHub (var.amplify_github_access_token)
  # junto con var.amplify_repository_url. Sin esos valores, la app se crea
  # sin repo conectado; conectar el repo "main" se hace una única vez desde
  # la consola de Amplify (Hosting environments > Connect branch), lo cual
  # también permite usar la integración nativa de GitHub Apps de Amplify
  # (recomendada sobre un PAT) sin manejar tokens en el state de Terraform.
  repository = var.amplify_repository_url != "" ? var.amplify_repository_url : null
  access_token = (
    var.amplify_repository_url != "" && var.amplify_github_access_token != ""
    ? var.amplify_github_access_token
    : null
  )

  environment_variables = {
    DEMO_MODE = "true"
    # DEMO_PANEL_KEY y OTP_PEPPER NO se inyectan acá como variables de
    # entorno en texto plano: la app los lee en runtime desde el secret
    # slt-demo-app-secrets en Secrets Manager, usando el rol de servicio
    # de Amplify (aws_iam_role.amplify_service_role) para leerlo.
    # AWS_REGION NO se declara acá: Amplify rechaza toda variable de entorno
    # que empiece con el prefijo reservado "AWS" (CreateApp devuelve
    # BadRequestException). No hace falta: el runtime de cómputo de Amplify
    # ya expone AWS_REGION por sí mismo, que es lo que leen
    # `dynamo-client.ts` y `secrets-client.ts`; y si faltara, el SDK resuelve
    # la región por su propia cadena estándar.
    DYNAMODB_TABLE  = aws_dynamodb_table.expedientes.name
    S3_BUCKET       = aws_s3_bucket.evidencias.bucket
    APP_SECRETS_ARN = aws_secretsmanager_secret.app_secrets.arn
  }

  lifecycle {
    # La conexión con GitHub se hace UNA vez desde la consola de Amplify, con
    # la GitHub App (recomendada sobre un PAT: no deja tokens en el state).
    # Sin esto, Terraform vería esa conexión como deriva y querría
    # desconectar el repo en el próximo apply, dejando la app sin desplegar.
    #
    # Solo se ignoran los tres atributos de la conexión. Todo lo demás
    # (plataforma, rol, variables de entorno) lo sigue gobernando este código:
    # si alguien los edita a mano en la consola, Terraform los revierte.
    ignore_changes = [repository, access_token, oauth_token]
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.slt_demo.id
  branch_name = "main"

  framework = "Next.js - SSR"
  stage     = "PRODUCTION"

  enable_auto_build = var.amplify_repository_url != ""
}
