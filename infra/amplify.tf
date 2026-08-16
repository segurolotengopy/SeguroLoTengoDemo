# App de Amplify Hosting, plataforma WEB_COMPUTE (necesaria para el SSR de
# Next.js 15 / App Router). El nombre no está sujeto al prefijo obligatorio
# de la política de permisos (esa restricción aplica a DynamoDB, S3 y
# Secrets Manager), pero se usa el prefijo slt-demo- por consistencia.
resource "aws_amplify_app" "slt_demo" {
  name     = "slt-demo-segurolotengo"
  platform = "WEB_COMPUTE"

  # Son DOS roles distintos y es fácil confundirlos:
  #
  # - iam_service_role_arn: lo usa Amplify para CONSTRUIR (clonar, buildear,
  #   escribir logs).
  # - compute_role_arn: lo asume el cómputo SSR EN RUNTIME. Sin esto, los
  #   Route Handlers no tienen credenciales y toda llamada a DynamoDB,
  #   S3 o Secrets Manager falla con 500, aunque el build haya salido verde y
  #   las variables de entorno estén bien.
  #
  # Se reutiliza el mismo rol porque su política ya es exactamente la que el
  # runtime necesita (GetItem/PutItem/Query sobre slt-demo-*, objetos del
  # bucket de evidencias y GetSecretValue del secret de la app), y su relación
  # de confianza ya habilita a amplify.amazonaws.com.
  iam_service_role_arn = aws_iam_role.amplify_service_role.arn
  compute_role_arn     = aws_iam_role.amplify_service_role.arn

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
    # Consola administrativa (docs/CONSOLA_ADMINISTRATIVA.md). Flag propio, no
    # compartido con DEMO_MODE: la consola es una herramienta de staff que
    # eventualmente va a existir en entornos donde el panel de demo no debe
    # existir. Con este flag apagado, /admin-consola responde 404.
    ADMIN_CONSOLE_ENABLED = "true"
    # DEMO_PANEL_KEY, ADMIN_CONSOLE_KEY y OTP_PEPPER NO se inyectan acá como
    # variables de entorno en texto plano: la app los lee en runtime desde el
    # secret slt-demo-app-secrets en Secrets Manager, usando el rol de servicio
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

    # Verificación de identidad de P5 con AWS de verdad: Textract para el OCR
    # de la cédula y Rekognition para calidad de rostro y coincidencia facial.
    # Los permisos ya están en el rol de servicio (aws_iam_role_policy en
    # infra/iam.tf, Sids RekognitionVerificacionIdentidad y TextractOcrCedula).
    INTEGRATION_IDENTITY = "live"

    # Cómo se toma la selfie. `camara-demo` = foto de la cámara del navegador,
    # SIN prueba de vida, con umbral facial de demostración (90 en vez de 99) y
    # OCR aproximado cuando la cédula no tiene MRZ.
    #
    # ⚠️ Es apto SOLO para demostración, y el adaptador lo hace cumplir: tira
    # si DEMO_MODE no es "true". Para el piloto hay que sacar esta variable —
    # sin ella, P5 usa Rekognition Face Liveness, que es prueba de vida real.
    INTEGRATION_IDENTITY_SELFIE = "camara-demo"

    # Documentos que P5 acepta. Sin esta variable, solo Paraguay, que es lo que
    # dice docs/ESPECIFICACION_PANTALLAS.md. Sumar Bolivia es una decisión de
    # demostración sin fila en la matriz de cumplimiento — el producto se vende
    # en Paraguay.
    IDENTITY_PAISES_CEDULA = "PY,BO"
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

  # El repositorio NO se conecta desde este código: la consola de Amplify no
  # ofrece conectar un repo a una app creada por IaC, y la API lo rechaza
  # mientras exista una rama "desplegada manualmente". La secuencia real fue:
  # borrar esta rama, conectar el repo con `aws amplify update-app
  # --repository ... --access-token ...`, y volver a crearla. Por eso el
  # bloque `lifecycle` de arriba ignora `repository` y los tokens.
  #
  # Consecuencia: `var.amplify_repository_url` quedó vacía aunque el repo SÍ
  # está conectado, así que no sirve para decidir esto. Antes decía
  # `var.amplify_repository_url != ""` y dejaba el auto-build apagado, con lo
  # cual un push a main no desplegaba nada.
  enable_auto_build = true
}
