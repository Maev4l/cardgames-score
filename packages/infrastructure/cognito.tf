
data "aws_cognito_user_pools" "cardgames_score" {
  name = "platform-idp"
}

# Fetch app client ID from platform SSM
data "aws_ssm_parameter" "app_clients" {
  name = "platform.idp.app-clients"
}

locals {
  cognito_client_id = jsondecode(data.aws_ssm_parameter.app_clients.value)["cardgames-score"]
}
