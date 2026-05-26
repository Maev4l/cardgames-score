# Migrate `api` Lambda from `aws-lambda-go-api-proxy` to AWS Lambda Web Adapter

**Status:** Design approved
**Date:** 2026-05-26
**Scope:** `packages/functions/api` and `packages/infrastructure/functions.tf`

## Problem

The `api` Lambda uses `github.com/awslabs/aws-lambda-go-api-proxy/gin` to bridge API Gateway HTTP API v2 events to a Gin router. The library is sunset (GitHub repo `archived: true` since 2024-12). AWS now publishes and recommends [AWS Lambda Web Adapter (LWA)](https://github.com/aws/aws-lambda-web-adapter) as the supported way to run web frameworks on Lambda. LWA is distributed as a public Lambda Layer and lets the function run as a normal HTTP server with no code coupling to Lambda's runtime API.

The companion repo [`alexandria`](../../../alexandria) executed this same migration on 2026-05-25 — that spec is the proven reference for this one.

### Deprecation evidence for `aws-lambda-go-api-proxy`

| Signal | Value |
|---|---|
| GitHub `archived` flag | **true** (no issues/PRs accepted) |
| Last commit | 2024-12-11 |
| Releases ever published | 0 (only Git tags exist; `v0.16.1` is the last) |

### Official-status evidence for AWS Lambda Web Adapter

| Signal | Evidence |
|---|---|
| GitHub org | `github.com/aws/aws-lambda-web-adapter` — official `aws` org, not experimental `awslabs` |
| Repo state | `archived: false`, active maintenance, regular releases |
| AWS-published layer | Public Lambda Layer published by AWS account `753240598075` across all standard regions |
| AWS reference example | `examples/gin-zip` in the official AWS repo demonstrates this exact pattern |

## Scope

Only the `api` Lambda is affected — it is the only Lambda in `packages/functions/`. No event-driven Lambdas exist in this repo.

The migration is bundled with two correctness/ergonomics wins:

1. **Auth middleware refactor** — `RequireApproval` currently reads JWT claims via `core.GetAPIGatewayV2ContextFromContext` from the proxy library. This stops working under LWA (no API Gateway event in `c.Request.Context()`). Auth is rewritten to parse the JWT from the `Authorization` header via a new `TokenParser` middleware (alexandria's pattern). API Gateway still validates the JWT signature/expiry upstream; the app only decodes already-validated claims.
2. **`/api/detections` joins the protected group.** Today it sits outside the group check, requiring only a valid JWT (no `cardgames-score` Cognito-group membership). After this migration, all `/api/*` routes — including detection — require group membership. This is a deliberate behavior change agreed during brainstorming; it aligns with alexandria's posture.

## Goals

1. Remove `github.com/awslabs/aws-lambda-go-api-proxy` and `github.com/aws/aws-lambda-go` from `go.mod`.
2. Replace with the LWA arm64 Lambda Layer.
3. Rewrite the auth middleware so `userId` and group come from JWT parsing (not the proxy's request context).
4. Move `/api/detections` inside the protected group.
5. Make the `api` Lambda runnable locally as a standard HTTP server (`make run-api-local`).
6. Preserve every other existing behavior: route paths, response shapes, API Gateway integration, CORS.

## Non-goals

- Moving the `api` Lambda to a container image. Zip+layer is the proven path; image-based LWA is viable but out of scope.
- Introducing integration tests (none exist today; orthogonal initiative).
- LocalStack or any AWS-services stub for offline development. Local runs hit real AWS dev resources.
- Changing API Gateway routes, JWT authorizer, CloudFront, or Cognito wiring.

## Verified facts

- Only `packages/functions/api/cmd/main.go:12` imports `aws-lambda-go-api-proxy`.
- Only `packages/functions/api/middleware/auth.go:7` imports `aws-lambda-go-api-proxy/core`.
- `packages/functions/api/handlers/*.go` consume `userId` exclusively via `middleware.GetUserID(c)` (8 call sites across `games.go`, `belote_handlers.go`, `tarot_handlers.go`). Their signatures depend only on `*gin.Context` — handler code is untouched.
- `github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1` already exposes `var.layers` (`list(string)`); alexandria uses it. No module bump required.
- LWA on zip works via the **Lambda Extension** mechanism: the layer installs `/opt/extensions/lambda-adapter`, which Lambda auto-loads. No `AWS_LAMBDA_EXEC_WRAPPER` needed.
- LWA layer ARN (arm64): `arn:aws:lambda:<region>:753240598075:layer:LambdaAdapterLayerArm64:27`.
- Build pipeline is identical to alexandria's: `GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bootstrap ./api/cmd` → zip → `provided.al2023`. No Makefile rewrite for build itself.
- API GW route is the catch-all `ANY /api/{proxy+}` (`packages/infrastructure/functions.tf:48`) — LWA is transparent to it.

## Architecture

### Before

```
API GW HTTP API v2 (JWT authorizer, ANY /api/{proxy+})
  → invokes Lambda with events.APIGatewayV2HTTPRequest
  → init(): builds router, wraps in ginadapter.NewV2(router) → global ginLambda
  → handler(ctx, req): ginLambda.ProxyWithContext(ctx, req)
  → adapter synthesizes net/http request, stashes APIGW event in ctx
  → middleware.RequireApproval reads claims via core.GetAPIGatewayV2ContextFromContext
```

### After

```
API GW HTTP API v2 (JWT authorizer, ANY /api/{proxy+})       (unchanged)
  → invokes Lambda; LWA Extension on the layer intercepts runtime API
  → LWA translates event → real HTTP request on 127.0.0.1:8080
  → main(): builds router, router.Run(":8080")
  → TokenParser parses Bearer JWT from Authorization header → tokenInfo in gin context
  → RequireApproval reads tokenInfo, enforces cardgames-score group, sets userId in gin context
  → LWA translates response → APIGatewayV2HTTPResponse
```

### Consequences

- `init()` + global `ginLambda` collapse into a single `main()`. No Lambda imports in `api/cmd/main.go`.
- The auth surface shifts from "trust the proxy library to plumb the API GW event" to "decode the JWT we already received" (signature was validated by API GW upstream).
- `/api/detections` requires `cardgames-score` group membership, same as games endpoints.
- `core.GetAPIGatewayV2ContextFromContext` and the proxy library disappear from the call path.
- Cold-start adds the LWA Extension spin-up (~tens of ms). Negligible for this interactive UX.
- The Go binary is a normal HTTP server — `go run ./api/cmd` works locally.

## Code changes

### `packages/functions/api/middleware/auth.go` — rewrite

The current implementation reads from the proxy-stashed APIGW event. The new version parses the JWT from the `Authorization` header and stores claims in gin context.

```go
package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/jwt"
)

const (
	UserIDKey     = "userId"
	tokenInfoKey  = "tokenInfo"
	RequiredGroup = "cardgames-score"
)

type tokenInfo struct {
	userID string
	groups string
}

// TokenParser extracts claims from the Bearer JWT and stores them in gin context.
// API Gateway has already validated the JWT signature/expiry upstream — this only decodes.
func TokenParser() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.Request.Header.Get("Authorization")
		if strings.HasPrefix(raw, "Bearer ") {
			raw = raw[7:]
		}

		var info tokenInfo
		if tok, err := jwt.Parse([]byte(raw)); err == nil && tok != nil {
			if sub, ok := tok.Get("sub"); ok {
				info.userID = fmt.Sprintf("%v", sub)
			}
			if g, ok := tok.Get("cognito:groups"); ok {
				info.groups = fmt.Sprintf("%v", g)
			}
		}
		c.Set(tokenInfoKey, &info)
		c.Next()
	}
}

// RequireApproval ensures the caller belongs to the cardgames-score group.
// Must run AFTER TokenParser.
func RequireApproval() gin.HandlerFunc {
	return func(c *gin.Context) {
		t, ok := c.MustGet(tokenInfoKey).(*tokenInfo)
		if !ok || t.userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Missing user ID in token"})
			return
		}
		if !containsGroup(t.groups, RequiredGroup) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "User not approved for this application"})
			return
		}
		c.Set(UserIDKey, t.userID)
		c.Next()
	}
}

func containsGroup(groups, required string) bool {
	if groups == "" {
		return false
	}
	groups = strings.Trim(groups, "[]")
	for _, g := range strings.Split(groups, " ") {
		if strings.Trim(g, ", ") == required {
			return true
		}
	}
	return groups == required
}

func GetUserID(c *gin.Context) string {
	if v, ok := c.Get(UserIDKey); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}
```

**Important: middleware run order.** Gin executes `.Use()` middleware in registration order. `TokenParser()` MUST be registered before `RequireApproval()` — `RequireApproval` calls `c.MustGet(tokenInfoKey)`, which panics if `TokenParser` hasn't run. `main.go` registers them in the correct order; if a future change adds a route group that uses `RequireApproval` without `TokenParser` upstream, this invariant is violated.

The factory pattern (`func() gin.HandlerFunc`) is preserved rather than the bare-function form the current code uses — it matches alexandria and allows future middleware to capture init-time state (e.g. a base logger for warm-start safety) without churning call sites again.

### `packages/functions/api/cmd/main.go` — full rewrite

```go
package main

import (
	"os"

	"cardgames-score.isnan.eu/functions/api/handlers"
	"cardgames-score.isnan.eu/functions/api/middleware"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

func main() {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())

	region := os.Getenv("REGION")
	if region == "" {
		region = "eu-central-1"
	}
	gamesTable := os.Getenv("GAMES_TABLE")
	if gamesTable == "" {
		gamesTable = "atout-games"
	}

	bedrockSvc, err := services.NewBedrockService(region, os.Getenv("BEDROCK_MODEL"))
	if err != nil {
		log.Fatal().Msgf("Failed to initialize Bedrock service: %s", err.Error())
	}
	dynamoSvc, err := services.NewDynamoDBService(region, gamesTable)
	if err != nil {
		log.Fatal().Msgf("Failed to initialize DynamoDB service: %s", err.Error())
	}

	h := handlers.NewHTTPHandler(bedrockSvc)
	g := handlers.NewGamesHandler(dynamoSvc)

	// Single protected group — detection joins it (per design decision).
	// TokenParser runs first; RequireApproval reads its output.
	api := router.Group("/api")
	api.Use(middleware.TokenParser())
	api.Use(middleware.RequireApproval())
	{
		api.POST("/detections", h.RequestDetection)

		api.POST("/games", g.CreateGame)
		api.GET("/games", g.ListGames)
		api.GET("/games/:id", g.GetGame)
		api.DELETE("/games/:id", g.DeleteGame)
		api.POST("/games/:id/rounds", g.AddRound)
		api.DELETE("/games/:id/rounds/:num", g.DeleteRound)
		api.PATCH("/games/:id", g.UpdateGame)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	_ = router.Run(":" + port)
}
```

### What disappears

- `import ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"`
- `import "github.com/aws/aws-lambda-go/events"`
- `import "github.com/aws/aws-lambda-go/lambda"`
- `import "github.com/awslabs/aws-lambda-go-api-proxy/core"` (in `middleware/auth.go`)
- The `init()` function (merges into `main()`).
- `var ginLambda *ginadapter.GinLambdaV2`.
- The `handler(ctx, req)` adapter function.
- `lambda.Start(handler)`.

### What stays bit-for-bit identical

- All 7 game handlers + `RequestDetection`. Bodies untouched.
- `middleware.CORS()`, `middleware.GetUserID()` exported API.
- Handler signatures (only depend on `*gin.Context`).
- DynamoDB, Bedrock service wiring.

### `go.mod`

- **Remove**: `github.com/awslabs/aws-lambda-go-api-proxy v0.16.1`
- **Remove**: `github.com/aws/aws-lambda-go v1.49.0` (only the proxy used it; no event-driven lambdas in this repo)
- **Add**: `github.com/lestrrat-go/jwx` (TokenParser JWT decode — same as alexandria; pick the latest minor compatible with Go 1.26)
- Run `go mod tidy` to flush transitive deps.

### Build pipeline

`packages/functions/Makefile` build/package targets unchanged:

```makefile
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o api/bin/bootstrap ./api/cmd
```

The output binary just happens to be an HTTP server instead of a Lambda handler. `provided.al2023` doesn't care what `bootstrap` does internally — the layer's Extension intercepts events.

## Terraform changes

File: `packages/infrastructure/functions.tf`. Only `module "api"` is touched. `module "api_trigger"` (API GW HTTP API, JWT authorizer, `ANY /api/{proxy+}` route, CORS, CloudFront-friendly `api_name`) is untouched — LWA is transparent to API GW.

### LWA layer pinning (new `locals` block)

```hcl
locals {
  # AWS Lambda Web Adapter (arm64) - publisher account 753240598075.
  # Bump intentionally; release notes:
  # https://github.com/aws/aws-lambda-web-adapter/releases
  lwa_layer_version = 27
  lwa_layer_arn     = "arn:aws:lambda:${var.region}:753240598075:layer:LambdaAdapterLayerArm64:${local.lwa_layer_version}"
}
```

### `module "api"` diff (additive)

```hcl
module "api" {
  source        = "github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1"
  function_name = "cardgames-score-api"

  # AWS Lambda Web Adapter (arm64). The layer's Extension intercepts the
  # Lambda runtime API and forwards events as HTTP requests to PORT.
  layers = [local.lwa_layer_arn]   # NEW

  zip = {
    filename = "../functions/api/dist/api.zip"
    runtime  = "provided.al2023"   # unchanged
    handler  = "bootstrap"         # unchanged
    hash     = filebase64sha256("../functions/api/bin/bootstrap")
  }

  architecture = "arm64"
  timeout      = 60
  memory_size  = 768

  environment_variables = {
    GAMES_TABLE   = aws_dynamodb_table.games.name
    REGION        = var.region
    BEDROCK_MODEL = var.bedrock_model

    # NEW: LWA-specific
    # Port the Gin HTTP server binds to. LWA forwards events to 127.0.0.1:PORT.
    # Must match the default in api/cmd/main.go.
    PORT                = "8080"
    AWS_LWA_INVOKE_MODE = "buffered"
  }

  additional_policy_arns = [aws_iam_policy.api.arn]
}
```

### Why `AWS_LWA_INVOKE_MODE = "buffered"`

`buffered` is LWA's default — Lambda accumulates the full response, then returns it as one `APIGatewayV2HTTPResponse`. The alternative `response_stream` requires Lambda Function URLs (not API GW HTTP API). Setting it explicitly documents the chosen mode; behavior is unchanged from the default.

### What does NOT change

- `module "api_trigger"`: API GW HTTP API v2, JWT authorizer (Cognito), `routes = ["ANY /api/{proxy+}"]`, CORS settings.
- `aws_iam_policy.api`, `aws_dynamodb_table.games`, Cognito wiring, CloudFront, route53, ACM.
- `timeout = 60`, `memory_size = 768`. LWA extension adds ~10 MB RSS; 768 has plenty of headroom.

### Expected `terraform plan` shape

Diffs against `module.api.aws_lambda_function.this` only:

1. `layers` → `["arn:aws:lambda:<region>:753240598075:layer:LambdaAdapterLayerArm64:27"]`
2. `environment.variables` gains `PORT = "8080"` and `AWS_LWA_INVOKE_MODE = "buffered"` (other keys unchanged)
3. `source_code_hash` changes (new `bootstrap` binary)

Any diff on `api_trigger`, IAM, DynamoDB, CloudFront, or route53 → stop and investigate.

## Local development

### Running the API locally

From `packages/functions/`:

```bash
make run-api-local
```

Server listens at `http://localhost:8080/api/...`. AWS SDK calls pick up credentials from the shell environment (e.g. `aws sso login`), same way the Lambda picks up its execution-role credentials.

### New files

**`packages/functions/api/.env.local.example`** (template, committed):

```dotenv
# Copy to .env.local and fill in dev values before `make run-api-local`.
# .env.local is gitignored — never commit credentials or env-specific values.

# AWS region the dev resources live in
REGION=eu-central-1

# DynamoDB table for games
GAMES_TABLE=atout-games

# Bedrock model for card detection (leave empty for the service default)
BEDROCK_MODEL=

# Port the local HTTP server binds to. LWA uses 8080 in Lambda.
PORT=8080
```

### Modified files

**`packages/functions/Makefile`** — add `run-api-local` and update `.PHONY`:

```makefile
.PHONY: build build-api package package-api clean run-api-local

# ... existing build/package/clean targets unchanged ...

# Run the API lambda locally as a plain HTTP server (Web Adapter mode).
# Requires AWS credentials in the environment (e.g. `aws sso login`)
# and env vars sourced from api/.env.local (copy from .env.local.example).
run-api-local:
	@test -f api/.env.local || (echo "Missing api/.env.local — copy from api/.env.local.example"; exit 1)
	@set -a && . ./api/.env.local && set +a && go run ./api/cmd
```

**Root `.gitignore`** — append:

```
# Local dev env files (per-developer secrets/values)
**/.env.local
```

The `**/.env.local` glob covers any future package using the same pattern.

### Hitting the local API with auth

`TokenParser` decodes the Cognito JWT from `Authorization: Bearer <idToken>`. To get a JWT:

1. Sign in to the deployed web client.
2. Copy `idToken` from devtools (`localStorage` or a recent network-request header).
3. `curl -H "Authorization: Bearer <idToken>" http://localhost:8080/api/games`.

A `cardgames-score`-group user gets 200. A user without the group gets `403 "User not approved for this application"` — the same response the deployed Lambda would give.

**No "skip auth in dev" code path.** Code branches that exist only locally violate the project's guidance against fallbacks unreachable in prod. If the friction is too high, use a long-lived dev JWT.

## Rollout

Small blast radius: one lambda, additive Terraform diff. Single straight-line cutover — no canary, no parallel deployment.

### Order of operations

1. **Code** — rewrite `api/cmd/main.go` and `middleware/auth.go`, `go mod tidy`.
2. **Build locally** — `yarn backend:build`. Confirm `packages/functions/api/dist/api.zip` produced.
3. **Local smoke test** — `make run-api-local` in `packages/functions`, hit `GET /api/games` with a real cardgames-score-group JWT, confirm 200 + JSON. Proves the new code path before touching AWS.
4. **`terraform plan`** — confirm only the expected diffs on `cardgames-score-api`: `layers` (+1), 2 new env vars, code hash.
5. **`terraform apply`** — user runs this (per `.claude/rules/git.md` / never auto-apply). In-place function update; no API GW changes.
6. **Post-deploy verification** (below). On failure: `terraform apply` the previous commit. Single-step rollback since no schema/auth changes at the API GW level.

### Post-deploy verification checklist

Exercise representative routes via the deployed API GW endpoint with a real prod JWT from a `cardgames-score`-group user:

| Route | What it proves |
|---|---|
| `GET /api/games` | Read path, JWT decode, group check, DynamoDB query |
| `POST /api/games` then `DELETE /api/games/<id>` | Write path, JSON body parsing, round-trip |
| `GET /api/games/<id>` | Path-param routing |
| `POST /api/detections` (real card image) | Bedrock integration, longer timeout exercised, **and** group check on the formerly-public route |
| Any route as a non-group user | Confirms `403 "User not approved..."` shape unchanged |

CloudWatch checks:

- Cold-start log shows the Gin server starting (`[GIN] Listening and serving HTTP on :8080`, or just `[GIN]` request lines in release mode).
- **No** `panic`, `connection refused`, or `dial tcp 127.0.0.1:8080: connect: connection refused`. The last would indicate LWA forwarded before Gin bound the port (very unlikely at 768 MB; see risk row).
- p50/p99 latency roughly unchanged vs. pre-migration baseline.

### Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LWA layer `:27` not available in `eu-central-1` | Very low | AWS publishes to all standard regions. Verify pre-apply: `aws lambda list-layer-versions --layer-name LambdaAdapterLayerArm64 --region eu-central-1` and grep for `"Version": 27`. |
| Cold-start race: LWA forwards before Gin binds `:8080` | Very low at 768 MB on arm64 | If observed: add `AWS_LWA_READINESS_CHECK_PATH=/health` env var + `GET /health` route returning 200. Not in scope by default — YAGNI. |
| `/api/detections` regression: pre-approved users lose access | Low (deliberate change) | Intentional per Section "Scope". If the web client lets pre-approved users into the detection screen today, the UI either already gates by approval, or this surfaces a real issue worth fixing. |
| Memory creep from running the LWA extension | Low (~10 MB) | Function is at 768 MB; plenty of headroom. Measure post-deploy first. |
| Lost behavior in proxy library's request synthesis (path/query encoding) | Low | Smoke test the full route set in step 3. Handlers depend only on `*gin.Context`, so behavioral parity is high. |

### Rollback

If post-deploy checks fail:

```bash
git revert <terraform-commit-sha>
cd packages/infrastructure && terraform apply
```

The previous `bootstrap` binary stays on disk; reverting the Terraform commit restores prior `layers`/env config, and unchanged `source_code_hash` means Lambda keeps the binary it has. Then triage and re-attempt.

## Open questions

None at the time of writing. LWA layer version `:27` pinned to the current release.
