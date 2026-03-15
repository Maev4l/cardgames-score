# API Lambda Policy
data "aws_iam_policy_document" "api" {
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock:ListFoundationModels",
      "bedrock:GetFoundationModel",
      "bedrock:ListInferenceProfiles"
    ]
    resources = [
      "arn:aws:bedrock:*::foundation-model/*",
      "arn:aws:bedrock:*:*:inference-profile/*",
    ]
  }
  statement {
    effect = "Allow"
    actions = [
      "aws-marketplace:ViewSubscriptions",
      "aws-marketplace:Subscribe"
    ]
    resources = [
      "*",
    ]
  }
  # DynamoDB access for games table
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:BatchWriteItem"
    ]
    resources = [
      aws_dynamodb_table.games.arn
    ]
  }
}

resource "aws_iam_policy" "api" {
  name   = "cardgames-score-api"
  policy = data.aws_iam_policy_document.api.json
}
