# Upgrade `Maev4l/terraform-modules` v1.6.0 → v1.7.1

**Date:** 2026-05-10
**Scope:** `packages/infrastructure/functions.tf`
**Downtime:** accepted by user

## Context

Two modules currently pinned to `v1.6.0`:

- `module.api` — `lambda-function`
- `module.api_trigger` — `lambda-trigger-apigw`

## Upstream changes (v1.6.0 → v1.7.1)

### `lambda-function` — non-breaking

Variables identical. Bump ref only.

### `lambda-trigger-apigw` — **breaking**

Redesigned to fan one HTTP API across multiple Lambdas via an `integrations` map.

**Removed (top-level):** `function_name`, `function_arn`, `invoke_arn`, `routes`.

**New required:** `api_name` (string), `integrations` (map of `{ function_name, function_arn, invoke_arn, routes }`).

**Unchanged:** `stage_name`, `custom_domain`, `authorizer`, `cors`, `disable_execute_api_endpoint`, `tags`.

**Outputs:** `api_endpoint`, `api_id`, `execution_arn`, `stage_id`, `custom_domain_url`, `authorizer_id` unchanged. New: `integration_ids` (unused here).

## Internal resource-address impact

| v1.6.0 address | v1.7.1 address | Action |
|---|---|---|
| `aws_apigatewayv2_api.this` | same | kept (name unchanged — see below) |
| `aws_apigatewayv2_stage.this` | same | kept |
| `aws_apigatewayv2_integration.this` | `aws_apigatewayv2_integration.this["api"]` | destroy + create |
| `aws_apigatewayv2_route.this["ANY /api/{proxy+}"]` | `aws_apigatewayv2_route.this["api:ANY /api/{proxy+}"]` | destroy + create |
| `aws_lambda_permission.this` (`statement_id = "AllowAPIGatewayInvoke"`) | `aws_lambda_permission.this["api"]` (`statement_id = "AllowAPIGatewayInvoke-api"`) | destroy + create |

`api_id` and `api_endpoint` preserved → CloudFront origin (`cloudfront.tf`) needs no update.

No `terraform state mv` performed; downtime is accepted and is limited to the seconds during which the route resource is replaced.

## Changes

### `packages/infrastructure/functions.tf`

`module.api` — bump ref only:

```hcl
module "api" {
  source        = "github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1"
  # ...rest unchanged
}
```

`module.api_trigger` — bump ref + restructure:

```hcl
module "api_trigger" {
  source = "github.com/Maev4l/terraform-modules//modules/lambda-trigger-apigw?ref=v1.7.1"

  # WHY: matches v1.6.0's `${function_name}-http-api` so the underlying
  # aws_apigatewayv2_api keeps the same `name`, avoiding API replacement
  # (preserves api_id / api_endpoint that CloudFront depends on).
  api_name = "cardgames-score-api"

  integrations = {
    api = {
      function_name = module.api.function_name
      function_arn  = module.api.function_arn
      invoke_arn    = module.api.invoke_arn
      routes        = ["ANY /api/{proxy+}"]
    }
  }

  cors                         = true
  disable_execute_api_endpoint = false

  authorizer = {
    name     = "cardgames-score-cognito-authorizer"
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${data.aws_cognito_user_pools.cardgames_score.ids[0]}"
    audience = [local.cognito_client_id]
  }
}
```

No other files touched. `cloudfront.tf` continues to consume `module.api_trigger.api_endpoint` unchanged.

## Procedure

1. Edit `packages/infrastructure/functions.tf` per above.
2. `yarn infra:plan`. Expected diff:
   - `module.api`: no change (or trivial).
   - `module.api_trigger.aws_apigatewayv2_integration.this`: destroyed; `…["api"]`: created.
   - `module.api_trigger.aws_apigatewayv2_route.this["ANY /api/{proxy+}"]`: destroyed; `…["api:ANY /api/{proxy+}"]`: created.
   - `module.api_trigger.aws_lambda_permission.this`: destroyed; `…["api"]`: created.
   - `aws_apigatewayv2_api.this` and `aws_apigatewayv2_stage.this`: **not replaced**.
   - `aws_cloudfront_distribution.main`: no change.
3. **Abort gate:** if plan shows `aws_apigatewayv2_api.this` being replaced, stop. Replacement would change `api_id` and break CloudFront origin. Recover with `terraform state mv` or `-target` ordering, or revisit `api_name`.
4. `yarn infra:apply`.
5. Smoke test: `curl -i https://atout.isnan.eu/api/<known-route>` returns expected status (with auth header for protected routes).
6. Hand off to user for git commit. **Do not commit.**

## Out of scope

- Other module versions (none pinned besides these two).
- Refactoring of any other `.tf` file.
- State migration to preserve resource identities (downtime accepted).

## Unresolved questions

None.
