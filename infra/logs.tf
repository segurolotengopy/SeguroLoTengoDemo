resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/amplify/slt-demo-segurolotengo"
  retention_in_days = 7
}
