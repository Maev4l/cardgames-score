# DynamoDB table for storing games and rounds
# Uses single-table design with PK/SK pattern for flexible access patterns

resource "aws_dynamodb_table" "games" {
  name         = "cardgames-score"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # TTL for automatic cleanup (1 month after creation)
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

}
