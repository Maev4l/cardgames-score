module "api" {
  source        = "github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.5.1"
  function_name = "cardgames-score-api"
  zip = {
    filename = "../functions/api/dist/api.zip"
    runtime  = "provided.al2023"
    handler  = "bootstrap"
  }
  architecture = "arm64"
  timeout      = 60
  memory_size  = 768

  environment_variables = {
    GAMES_TABLE    = aws_dynamodb_table.games.name
    REGION         = var.region
    BEDROCK_MODEL  = var.bedrock_model
  }

  additional_policy_arns = [aws_iam_policy.api.arn]
}

module "api_trigger" {
  source = "github.com/Maev4l/terraform-modules//modules/lambda-trigger-apigw?ref=v1.5.1"

  function_name = module.api.function_name
  function_arn  = module.api.function_arn
  invoke_arn    = module.api.invoke_arn
  cors          = true

  # Allow CloudFront to reach the API Gateway via execute-api endpoint
  disable_execute_api_endpoint = false

  # JWT Authorizer integrated with Cognito User Pool
  authorizer = {
    name     = "cardgames-score-cognito-authorizer"
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${data.aws_cognito_user_pools.cardgames_score.ids[0]}"
    audience = [local.cognito_client_id]
  }

  routes = [
    "ANY /api/{proxy+}"
  ]
}
