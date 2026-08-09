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
