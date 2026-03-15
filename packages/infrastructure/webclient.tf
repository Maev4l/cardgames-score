# S3 bucket for PWA static files

resource "aws_s3_bucket" "webclient" {
  bucket = "cardgames-score-web-client"
}

resource "aws_s3_bucket_public_access_block" "webclient_public_access" {
  bucket = aws_s3_bucket.webclient.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy to allow CloudFront OAC access
resource "aws_s3_bucket_policy" "webclient" {
  bucket = aws_s3_bucket.webclient.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.webclient.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })
}
