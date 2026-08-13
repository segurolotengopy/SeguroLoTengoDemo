# Rol de servicio/ejecución que usa Amplify Hosting para correr el backend
# SSR de Next.js (WEB_COMPUTE) y acceder a los recursos de la demo.
resource "aws_iam_role" "amplify_service_role" {
  name = "aab1-demo-amplify-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AmplifyAssume"
        Effect    = "Allow"
        Principal = { Service = "amplify.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

# Permisos mínimos: solo la tabla DynamoDB y el bucket S3 de esta demo (por
# ARN, sin wildcards de servicio), el secret de la demo, y lo necesario para
# escribir logs de aplicación en CloudWatch Logs.
resource "aws_iam_role_policy" "amplify_service_policy" {
  name = "aab1-demo-amplify-service-policy"
  role = aws_iam_role.amplify_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBExpedientesTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.expedientes.arn,
          "${aws_dynamodb_table.expedientes.arn}/index/*"
        ]
      },
      {
        Sid    = "S3EvidenciasBucket"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.evidencias.arn,
          "${aws_s3_bucket.evidencias.arn}/*"
        ]
      },
      {
        Sid    = "SecretsManagerAppSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn
        ]
      },
      # Verificación de identidad de P5 (ítems 31 y 32 de la tabla de
      # integraciones externas). Son las APIs "sin almacenamiento" de
      # Rekognition: no crean colecciones ni persisten vectores faciales del
      # lado de AWS, así que no hay nada que apuntar por ARN.
      #
      # Resource = "*" NO es descuido: ni Rekognition ni Textract admiten
      # permisos a nivel de recurso para estas operaciones. Acotar por ARN
      # produce AccessDenied, no una política más estricta. El recorte real
      # acá es la lista de acciones, que es la mínima del flujo.
      {
        Sid    = "RekognitionVerificacionIdentidad"
        Effect = "Allow"
        Action = [
          # Prueba de vida (sesión de streaming desde el navegador).
          "rekognition:CreateFaceLivenessSession",
          "rekognition:StartFaceLivenessSession",
          "rekognition:GetFaceLivenessSessionResults",
          # Calidad de imagen y recorte previo (obligatorio con umbral 99).
          "rekognition:DetectFaces",
          # Coincidencia facial 1:1 entre la selfie y la foto de la cédula.
          "rekognition:CompareFaces"
        ]
        Resource = "*"
      },
      {
        Sid    = "TextractOcrCedula"
        Effect = "Allow"
        Action = [
          # Solo OCR genérico. AnalyzeID queda fuera a propósito: está
          # entrenado sobre documentos de EE.UU. y no sirve para la cédula
          # paraguaya, así que ni siquiera se concede el permiso.
          "textract:DetectDocumentText"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogsApp"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/amplify/*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/amplify/*:log-stream:*"
        ]
      }
    ]
  })
}
