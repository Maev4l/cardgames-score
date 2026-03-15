output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = data.aws_cognito_user_pools.cardgames_score.ids[0]
}

output "cognito_client_id" {
  description = "Cognito App Client ID for cardgames-score"
  value       = local.cognito_client_id
  sensitive   = true
}

output "region" {
  value = var.region
}

output "api_endpoint" {
  description = "API Gateway endpoint URL for local development proxy"
  value       = module.api_trigger.api_endpoint
}

output "webclient_bucket" {
  description = "S3 bucket name for the web client"
  value       = aws_s3_bucket.webclient.id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution for cache invalidation"
  value       = aws_cloudfront_distribution.main.id
}

output "dynamodb_games_table" {
  description = "DynamoDB table name for games storage"
  value       = aws_dynamodb_table.games.name
}
