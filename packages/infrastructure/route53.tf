# Route53 hosted zone data source

data "aws_route53_zone" "isnan" {
  name = "isnan.eu"
}

# DNS records pointing to CloudFront distribution
resource "aws_route53_record" "cardgames_score_ipv4" {
  zone_id = data.aws_route53_zone.isnan.zone_id
  name    = "atout.isnan.eu"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "cardgames_score_ipv6" {
  zone_id = data.aws_route53_zone.isnan.zone_id
  name    = "atout.isnan.eu"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}
