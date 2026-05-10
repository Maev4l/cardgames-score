# terraform-modules v1.7.1 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `Maev4l/terraform-modules` references from `v1.6.0` to `v1.7.1` in `packages/infrastructure/` and adapt `module.api_trigger` to the new `lambda-trigger-apigw` interface (multi-Lambda `integrations` map).

**Architecture:** Single-file change (`functions.tf`). `lambda-function` is a no-op (variables identical). `lambda-trigger-apigw` requires switching from top-level `function_name`/`function_arn`/`invoke_arn`/`routes` to a new `api_name` + `integrations` map. Internal API resource (`aws_apigatewayv2_api.this`) is preserved by setting `api_name = "cardgames-score-api"` so the rendered `name` attribute matches the v1.6.0 value (`${function_name}-http-api`). Children (integration, route, lambda permission) destroy + recreate; downtime is accepted.

**Tech Stack:** Terraform ≥ 1.10, AWS provider ~> 6.0, S3 backend with native locking. Yarn workspaces drive infra commands (`yarn infra:plan`, `yarn infra:apply`).

**Spec:** `docs/superpowers/specs/2026-05-10-terraform-modules-v1.7.1-upgrade-design.md`

**Important constraints from user:**
- **Do NOT commit anything.** The user will commit themselves. Do not run `git commit` at any point.
- Downtime during apply is accepted — no `terraform state mv` is needed.

---

## File Map

- Modify: `packages/infrastructure/functions.tf` (entire file content rewritten — see Task 1)
- No other files touched. `cloudfront.tf`, `outputs.tf`, etc. consume `module.api_trigger.api_endpoint` which remains stable.

---

## Task 1: Update `functions.tf` to v1.7.1

**Files:**
- Modify: `packages/infrastructure/functions.tf`

- [ ] **Step 1: Replace file contents**

Replace the entire contents of `packages/infrastructure/functions.tf` with:

```hcl
module "api" {
  source        = "github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1"
  function_name = "cardgames-score-api"
  zip = {
    filename = "../functions/api/dist/api.zip"
    runtime  = "provided.al2023"
    handler  = "bootstrap"
    hash     = filebase64sha256("../functions/api/bin/bootstrap")
  }
  architecture = "arm64"
  timeout      = 60
  memory_size  = 768

  environment_variables = {
    GAMES_TABLE   = aws_dynamodb_table.games.name
    REGION        = var.region
    BEDROCK_MODEL = var.bedrock_model
  }

  additional_policy_arns = [aws_iam_policy.api.arn]
}

module "api_trigger" {
  source = "github.com/Maev4l/terraform-modules//modules/lambda-trigger-apigw?ref=v1.7.1"

  # WHY: matches v1.6.0's `${function_name}-http-api` so the underlying
  # aws_apigatewayv2_api keeps the same `name`, avoiding API replacement
  # (preserves api_id / api_endpoint that CloudFront depends on).
  api_name = "cardgames-score-api"

  cors                         = true
  disable_execute_api_endpoint = false

  # JWT Authorizer integrated with Cognito User Pool
  authorizer = {
    name     = "cardgames-score-cognito-authorizer"
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${data.aws_cognito_user_pools.cardgames_score.ids[0]}"
    audience = [local.cognito_client_id]
  }

  # v1.7.x supports fan-out across multiple Lambdas behind one HTTP API.
  # We have a single Lambda; key it as "api".
  integrations = {
    api = {
      function_name = module.api.function_name
      function_arn  = module.api.function_arn
      invoke_arn    = module.api.invoke_arn
      routes        = ["ANY /api/{proxy+}"]
    }
  }
}
```

- [ ] **Step 2: Re-init Terraform to pull v1.7.1 module sources**

Run from `packages/infrastructure/`:

```bash
cd /Users/jrsue/dev/repos/cardgames-score/packages/infrastructure
terraform init -upgrade
```

Expected output: lines like `Downloading git::https://github.com/Maev4l/terraform-modules.git?ref=v1.7.1 for api...` and `...for api_trigger...`, then `Terraform has been successfully initialized!`.

If `init` fails (e.g. network, auth), stop and report the error — do not proceed.

- [ ] **Step 3: Plan and capture the diff**

Run from `packages/infrastructure/`:

```bash
cd /Users/jrsue/dev/repos/cardgames-score/packages/infrastructure
terraform plan -no-color -out=/tmp/atout-v1.7.1.tfplan 2>&1 | tee /tmp/atout-v1.7.1-plan.txt
```

(Or equivalently from repo root: `yarn infra:plan` — but capture the output for review.)

- [ ] **Step 4: Verify plan diff matches expectations (ABORT GATE)**

Read `/tmp/atout-v1.7.1-plan.txt` and verify:

**Expected (allowed):**
- `module.api_trigger.aws_apigatewayv2_integration.this` → destroyed.
- `module.api_trigger.aws_apigatewayv2_integration.this["api"]` → created.
- `module.api_trigger.aws_apigatewayv2_route.this["ANY /api/{proxy+}"]` → destroyed.
- `module.api_trigger.aws_apigatewayv2_route.this["api:ANY /api/{proxy+}"]` → created.
- `module.api_trigger.aws_lambda_permission.this` → destroyed.
- `module.api_trigger.aws_lambda_permission.this["api"]` → created (note `statement_id = "AllowAPIGatewayInvoke-api"`).

**Required NOT to change (must NOT be replaced or destroyed):**
- `module.api_trigger.aws_apigatewayv2_api.this` — must NOT be replaced. Same for `aws_apigatewayv2_stage.this`.
- `aws_cloudfront_distribution.main` — no diff.
- `aws_route53_record.cardgames_score_ipv4` / `_ipv6` — no diff.
- `module.api.aws_lambda_function.this` (or equivalent path inside the lambda-function module) — should be unchanged or trivially unchanged.

**ABORT** if any of the following appear:
- `aws_apigatewayv2_api.this` shows `# forces replacement` or `-/+` (would change `api_id` and break CloudFront origin).
- `aws_cloudfront_distribution.main` is being modified (it should not).
- The Lambda function itself is being destroyed and recreated.

If aborting, do NOT apply. Report the unexpected diff to the user and stop.

- [ ] **Step 5: Apply**

Only if Step 4 passed. Run from `packages/infrastructure/`:

```bash
cd /Users/jrsue/dev/repos/cardgames-score/packages/infrastructure
terraform apply /tmp/atout-v1.7.1.tfplan
```

(Or `yarn infra:apply` from repo root — but applying the saved plan file is preferred so what's applied matches what was reviewed.)

Expected output: `Apply complete! Resources: <N> added, 0 changed, <N> destroyed.` Counts of added and destroyed should match (3 of each, given the integration/route/permission churn).

If apply fails partway, report the error and stop. Do not retry without re-planning.

- [ ] **Step 6: Smoke test the API endpoint**

The CloudFront distribution and `api_endpoint` URL should be unchanged. Verify the API still answers via CloudFront:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://atout.isnan.eu/api/games
```

Expected: `401` (unauthenticated request rejected by the JWT authorizer). Any of:
- `200` — also fine (means the route is reachable; auth pass-through differs by route).
- `401` / `403` — fine, authorizer is alive.

NOT expected (failure):
- `404` — route not registered.
- `502` / `503` — Lambda permission missing or integration broken.
- `000` / connection error — DNS/CloudFront issue.

If unexpected, check `module.api_trigger.aws_lambda_permission.this["api"]` exists in state:

```bash
cd /Users/jrsue/dev/repos/cardgames-score/packages/infrastructure
terraform state list | grep lambda_permission
```

Should show `module.api_trigger.aws_lambda_permission.this["api"]`.

- [ ] **Step 7: Hand off to user (DO NOT COMMIT)**

Per user instruction, do NOT run `git commit` or `git push`. Print the modified file path and the verified outcome, then stop:

```
Modified: packages/infrastructure/functions.tf
Plan diff: as expected (3 destroyed + 3 created in module.api_trigger).
Apply: success.
Smoke test: <result from Step 6>.
Ready for user to commit.
```

---

## Notes

**Why no TDD steps:** This repo has no Terraform test framework wired up. The verification gate is the `terraform plan` diff (Step 4) and the live smoke test (Step 6). Treat the plan diff as the test and the abort gate as the assertion.

**Why no `terraform state mv`:** Spec explicitly accepts downtime. The replaced resources (integration, route, lambda permission) are recreated within the same apply; the API itself is preserved so the endpoint URL (and thus CloudFront origin and DNS) does not change.

**Rollback:** If apply fails or the smoke test fails irrecoverably, revert `functions.tf` to its previous content (use `git diff` / `git checkout HEAD -- packages/infrastructure/functions.tf`) and re-run `terraform init -upgrade && terraform apply` to roll back. Note this would also recreate the integration/route/permission once more.
