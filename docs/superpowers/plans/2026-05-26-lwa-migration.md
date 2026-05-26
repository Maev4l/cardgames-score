# AWS Lambda Web Adapter Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the cardgames-score `api` Lambda off the archived `github.com/awslabs/aws-lambda-go-api-proxy` to AWS Lambda Web Adapter (LWA), rewrite the auth middleware so JWT claims are parsed from the `Authorization` header instead of the proxy-injected APIGW context, and move `/api/detections` inside the group-protected scope.

**Architecture:** Rewrite `packages/functions/api/cmd/main.go` as a plain Gin HTTP server bound to `PORT` (default 8080). Rewrite `packages/functions/api/middleware/auth.go` with a `TokenParser` middleware that parses the Bearer JWT (validated upstream by API GW's JWT authorizer) and a factory-style `RequireApproval` middleware that enforces `cardgames-score` group membership. Attach the public LWA arm64 Lambda Layer (`LambdaAdapterLayerArm64:27`) to the function via Terraform. LWA's auto-loading Lambda Extension translates API Gateway HTTP API v2 events into HTTP requests transparently. No changes to API Gateway, Cognito, IAM, DynamoDB, or CloudFront.

**Tech Stack:** Go 1.26, Gin, `github.com/lestrrat-go/jwx/jwt` (JWT decode), AWS Lambda (`provided.al2023`, arm64, zip), Terraform, `github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1`, AWS Lambda Web Adapter Layer (`arm64:27` published by AWS account `753240598075`), yarn workspaces.

**Spec:** `docs/superpowers/specs/2026-05-26-lwa-migration-design.md`

**Operational rules:**
- Per user's global rule (`~/.claude/rules/git.md`), **never commit/push automatically**. Commit steps below are *suggested messages* — confirm with the user before running each one.
- **Never run `terraform apply` or `yarn infra:apply` automatically.** The deploy task spells out the apply command but the user runs it.
- The yarn convention is `yarn backend:build` (calls `make -C packages/functions package build`) and `yarn infra:plan` (`terraform -chdir=packages/infrastructure plan`).
- Run `go vet` after Go changes (`packages/functions` has no `make lint` target).
- Run `terraform fmt` and `terraform validate` after HCL changes.

---

## File Structure

Changes are localized to four files plus two new files:

| Path | Action | Responsibility |
|---|---|---|
| `packages/functions/api/middleware/auth.go` | Rewrite | `TokenParser` decodes Bearer JWT into gin context; `RequireApproval` enforces group. Drops proxy import. |
| `packages/functions/api/cmd/main.go` | Rewrite | Plain Gin HTTP server. Drops `init()` + `ginLambda` + Lambda imports. Wires single protected `/api` group (detection joins it). |
| `packages/functions/go.mod` + `go.sum` | Modify | Drop `aws-lambda-go`, `aws-lambda-go-api-proxy`. Add `lestrrat-go/jwx`. Result of `go mod tidy`. |
| `packages/functions/Makefile` | Modify | Add `run-api-local` target + update `.PHONY`. Build/package targets unchanged. |
| `packages/functions/api/.env.local.example` | Create | Template for local dev env vars. |
| `.gitignore` (root) | Modify | Ignore `**/.env.local`. |
| `packages/infrastructure/functions.tf` | Modify | Add LWA `locals` block. Attach `layers` and add `PORT` / `AWS_LWA_INVOKE_MODE` env vars to `module "api"`. `module "api_trigger"` untouched. |

Handlers (`packages/functions/api/handlers/*.go`) are **untouched** — they consume `userId` exclusively via `middleware.GetUserID(c)`, whose signature is preserved.

---

## Task 1: Rewrite the auth middleware

Goal: replace `middleware.RequireApproval` (which depends on the deprecated proxy's APIGW context helper) with `TokenParser` + factory-style `RequireApproval` that parse JWT claims from the `Authorization` header.

**Files:**
- Modify: `packages/functions/api/middleware/auth.go` (full rewrite)
- Modify: `packages/functions/go.mod`, `packages/functions/go.sum` (add jwx)

- [ ] **Step 1: Add the jwx dependency**

Run:
```bash
cd packages/functions && go get github.com/lestrrat-go/jwx/jwt@v1.2.30
```
Expected: `go.mod` and `go.sum` gain `github.com/lestrrat-go/jwx`. Exit code 0.

Version `v1.2.30` matches the alexandria pattern (jwx v1). Do NOT use `jwx/v2` — the v2 module has a different import path and API; alexandria proved v1.2.x works with Go 1.25+.

- [ ] **Step 2: Replace `middleware/auth.go` contents**

Use `Write` (full replacement — the file structure changes from bare-function to factory pattern).

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

// API Gateway has already validated the JWT signature/expiry upstream; this
// only decodes claims. TokenParser must register before RequireApproval —
// RequireApproval calls MustGet(tokenInfoKey).
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

// Cognito serializes the groups claim either as a single string or as a
// bracketed space-separated list, e.g. "[group1 group2]". Handle both.
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

- [ ] **Step 3: Verify the package compiles**

Run:
```bash
cd packages/functions && go build ./api/middleware
```
Expected: exit code 0, no output.

If you see `undefined: jwt.Parse`, the `go get` in Step 1 didn't take — re-run it.

- [ ] **Step 4: Verify `go vet` passes on the middleware**

Run:
```bash
cd packages/functions && go vet ./api/middleware
```
Expected: exit code 0, no output.

- [ ] **Step 5: Verify handlers still compile against the new middleware API**

Run:
```bash
cd packages/functions && go build ./api/handlers
```
Expected: exit code 0, no output.

This proves `middleware.GetUserID` and `middleware.RequiredGroup` (the public symbols handlers reference) still exist with compatible signatures. If this fails, the rewrite changed an exported symbol — fix before continuing.

- [ ] **Step 6: Suggested commit**

Confirm with the user, then:
```bash
git add packages/functions/api/middleware/auth.go packages/functions/go.mod packages/functions/go.sum
git commit -m "$(cat <<'EOF'
refactor(api): Rewrite auth middleware to parse JWT from Authorization header

The previous implementation read JWT claims via
core.GetAPIGatewayV2ContextFromContext from aws-lambda-go-api-proxy.
That helper relies on the proxy library injecting the APIGW event into
the request context — under AWS Lambda Web Adapter (next commit) the
request context is empty.

The new TokenParser/RequireApproval pair decodes the same JWT directly
from the Authorization header. API Gateway's JWT authorizer still
validates signature/expiry upstream, so this is a pure claim read.
EOF
)"
```

---

## Task 2: Rewrite `api/cmd/main.go` and clean go.mod

Goal: drop the `init()` + `ginLambda` + `aws-lambda-go` pattern, move `/api/detections` inside the protected group, and remove the proxy + `aws-lambda-go` from `go.mod`.

**Files:**
- Modify: `packages/functions/api/cmd/main.go` (full rewrite)
- Modify: `packages/functions/go.mod`, `packages/functions/go.sum`

- [ ] **Step 1: Replace `api/cmd/main.go` contents**

Use `Write` (full replacement — the structure changes too much for a clean `Edit`).

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

	// TokenParser must register before RequireApproval — RequireApproval
	// reads the tokenInfo TokenParser stored in the gin context.
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

	// LWA forwards Lambda events to this port on 127.0.0.1.
	// Locally (no LWA) the same default lets `go run ./api/cmd` work.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	_ = router.Run(":" + port)
}
```

- [ ] **Step 2: Verify the package compiles**

Run:
```bash
cd packages/functions && go build -o /tmp/cardgames-buildcheck ./api/cmd && rm /tmp/cardgames-buildcheck
```
Expected: exit code 0, no output.

If you see `imported and not used: "github.com/aws/aws-lambda-go/..."`, Step 1 wasn't fully applied — re-check.

- [ ] **Step 3: Verify `go vet` passes**

Run:
```bash
cd packages/functions && go vet ./api/cmd
```
Expected: exit code 0, no output.

- [ ] **Step 4: Tidy modules**

Run:
```bash
cd packages/functions && go mod tidy
```
Expected: `go.mod` and `go.sum` updated. Exit code 0.

Inspect with `git diff packages/functions/go.mod`:
- `github.com/awslabs/aws-lambda-go-api-proxy v0.16.1` MUST be removed.
- `github.com/aws/aws-lambda-go v1.49.0` MUST be removed (no other lambda in this repo uses it).
- `github.com/lestrrat-go/jwx` MUST remain (added in Task 1).

If `aws-lambda-go` is still present after `go mod tidy`, grep for stray imports:
```bash
cd packages/functions && grep -rn "aws-lambda-go" --include='*.go'
```
Investigate any hits — every Go source file in this repo should be free of `aws-lambda-go*` imports after this task.

- [ ] **Step 5: Build the production binary via the project's standard command**

Run:
```bash
yarn backend:build
```
Expected: produces `packages/functions/api/bin/bootstrap` (arm64 Linux binary) and `packages/functions/api/dist/api.zip`. Exit code 0.

Sanity check:
```bash
ls -la packages/functions/api/bin/bootstrap packages/functions/api/dist/api.zip
file packages/functions/api/bin/bootstrap
```
Expected: `ELF 64-bit LSB executable, ARM aarch64, ...` for the bootstrap binary.

- [ ] **Step 6: Suggested commit**

Confirm with the user, then:
```bash
git add packages/functions/api/cmd/main.go packages/functions/go.mod packages/functions/go.sum
git commit -m "$(cat <<'EOF'
refactor(api): Migrate api Lambda to plain Gin HTTP server for LWA

The api lambda now runs as a standard Gin HTTP server on PORT (default
8080). The AWS Lambda Web Adapter Extension on the layer (added in a
follow-up infra commit) intercepts API Gateway events and forwards them
as HTTP requests, so no Lambda-runtime imports are needed in main.go.

Drops aws-lambda-go-api-proxy (archived 2024-12) and aws-lambda-go (no
other lambda in this repo uses it). Moves /api/detections inside the
group-protected scope to match all other /api routes.
EOF
)"
```

---

## Task 3: Local development ergonomics

Goal: make `go run ./api/cmd` ergonomic via a Makefile target + an `.env.local` template, and stop accidental check-in of `.env.local`.

**Files:**
- Create: `packages/functions/api/.env.local.example`
- Modify: `packages/functions/Makefile` (add `run-api-local`)
- Modify: `.gitignore` (root) — ignore `**/.env.local`

- [ ] **Step 1: Create `packages/functions/api/.env.local.example`**

Use `Write`:

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

- [ ] **Step 2: Add `run-api-local` target to the Makefile**

The current Makefile starts with:
```makefile
.PHONY: build package build-api clean
```

Use `Edit` to replace that line with:
```makefile
.PHONY: build package build-api clean run-api-local
```

Then append at the very end of the file (after the existing `clean:` target):

```makefile

# Run the API lambda locally as a plain HTTP server (Web Adapter mode).
# Requires AWS credentials in the environment (e.g. `aws sso login`)
# and env vars sourced from api/.env.local (copy from .env.local.example).
run-api-local:
	@test -f api/.env.local || (echo "Missing api/.env.local — copy from api/.env.local.example"; exit 1)
	@set -a && . ./api/.env.local && set +a && go run ./api/cmd
```

Important: Makefile recipes use **tabs**, not spaces. The two indented lines under `run-api-local:` must start with a tab character.

- [ ] **Step 3: Add `.env.local` to root `.gitignore`**

The current `.gitignore` ends with `output.json` on line 11. Use `Edit` to append:

```
output.json
```
becomes:
```
output.json

# Local dev env files (per-developer secrets/values)
**/.env.local
```

`**/.env.local` catches any path so future packages can use the same pattern.

- [ ] **Step 4: Verify the Makefile target parses**

Run:
```bash
make -C packages/functions -n run-api-local 2>&1 | head -5
```
Expected: prints the recipe commands without running them. No `*** missing separator` or `No rule to make target` errors.

If you see `*** missing separator`: Step 2 used spaces instead of tabs in the recipe lines. Fix and retry.

- [ ] **Step 5: Suggested commit**

Confirm with the user, then:
```bash
git add packages/functions/Makefile packages/functions/api/.env.local.example .gitignore
git commit -m "$(cat <<'EOF'
chore(api): Add local-dev ergonomics for the api lambda

- `make run-api-local` runs the api lambda as a plain HTTP server
- api/.env.local.example documents the required env vars
- .env.local files (per-developer) gitignored at the repo root

Local runs hit real AWS resources (DynamoDB, Bedrock); use a dev
profile or scope credentials accordingly.
EOF
)"
```

---

## Task 4: Local smoke test (decision gate before infra)

Goal: prove the rewritten binary serves real Gin routes locally with a real Cognito JWT, before touching infra.

**Files:** none modified.

**Preconditions for the engineer:**
- AWS credentials in the shell with read access to the production DynamoDB `atout-games` table and Bedrock (the cardgames-score project does not have a separate dev account — local runs hit production, so use read-only ops where possible).
- A real Cognito JWT (`idToken`) from a user in the `cardgames-score` group. Obtain by signing into the deployed web client, opening devtools, and copying the `idToken` from `localStorage` (or from the `Authorization` header on a recent network request).

- [ ] **Step 1: Populate `api/.env.local`**

```bash
cp packages/functions/api/.env.local.example packages/functions/api/.env.local
```

The defaults (`REGION=eu-central-1`, `GAMES_TABLE=atout-games`, empty `BEDROCK_MODEL`, `PORT=8080`) match production. No edits needed for read-only smoke testing.

- [ ] **Step 2: Start the server**

In one terminal:
```bash
make -C packages/functions run-api-local
```
Expected (after a few seconds):
```
[GIN-debug] Listening and serving HTTP on :8080
```

(`gin.SetMode(gin.ReleaseMode)` in the code suppresses the long debug banner; you should still see the listen line.)

If you see `Address already in use`, free port 8080 (`lsof -i :8080`) or change `PORT` in `.env.local`.

If the process dies immediately with `Failed to initialize DynamoDB service` or `Failed to initialize Bedrock service`: AWS credentials aren't reachable in this shell. Confirm with `aws sts get-caller-identity`.

- [ ] **Step 3: Hit the games list with a real JWT**

In a second terminal, replace `<JWT>` with the `idToken`:
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  http://localhost:8080/api/games
```
Expected: `HTTP 200` and a JSON body. Empty list (`{"games":[]}` or similar) is also a pass — proves auth + DynamoDB query both work.

If you see `HTTP 401 "Missing user ID in token"`: the JWT's `sub` claim wasn't found. Most likely you sent an `accessToken` instead of an `idToken`. Cognito `accessToken` has `sub` too, but ID tokens are what the deployed flow uses — match it.

If you see `HTTP 403 "User not approved for this application"`: the JWT is for a user not in the `cardgames-score` Cognito group. Use a JWT from a group member.

If you see `HTTP 500`: check the server terminal for the Go stack trace. Most likely AWS credentials / DynamoDB permission issue.

- [ ] **Step 4: Hit a route with a path parameter**

Pick a real game ID from the previous response (or list one via `aws dynamodb scan --table-name atout-games --limit 1`), then:
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  http://localhost:8080/api/games/<gameId>
```
Expected: `HTTP 200` and the full game JSON, OR `HTTP 404` if the ID doesn't belong to the JWT's user. Both prove path-param routing works.

- [ ] **Step 5: Hit the detection endpoint (now group-protected)**

Construct a small `detection.json` body that matches the `DetectRequest` shape used by `handlers.RequestDetection`. The simplest probe is to send a malformed body and confirm the route is reachable + group-guarded:

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:8080/api/detections
```
Expected: `HTTP 400` (invalid request body) or `HTTP 200` with empty detection — what matters is **not** `HTTP 403`. A 403 here would mean the detection route is still outside the protected group, contrary to the goal of this migration.

Then verify a non-group user gets 403 (if you have one):
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <NON_GROUP_JWT>" \
  http://localhost:8080/api/detections
```
Expected: `HTTP 403 "User not approved for this application"`. Confirms detection is now group-protected. Skip this sub-step if no non-group JWT is available.

- [ ] **Step 6: Stop the server**

`Ctrl-C` in the server terminal.

**Decision gate:** if any step above fails, do NOT proceed to Task 5 (Terraform). Fix locally first. The whole point of local dev is to catch issues before deploying.

---

## Task 5: Terraform — attach LWA layer and env vars

Goal: attach the LWA arm64 layer (version `:27`) and the two LWA env vars to the `cardgames-score-api` Lambda. No other Terraform changes.

**Files:**
- Modify: `packages/infrastructure/functions.tf`

- [ ] **Step 1: Verify the LWA layer version 27 exists in `eu-central-1`**

```bash
aws lambda list-layer-versions \
  --layer-name LambdaAdapterLayerArm64 \
  --region eu-central-1 \
  --query 'LayerVersions[?Version==`27`].[Version,LayerVersionArn]' \
  --output table
```
Expected: a row containing `27` and an ARN like `arn:aws:lambda:eu-central-1:753240598075:layer:LambdaAdapterLayerArm64:27`.

If version `:27` is not present in the region (very unlikely — AWS publishes to all standard regions):
```bash
aws lambda list-layer-versions --layer-name LambdaAdapterLayerArm64 --region eu-central-1 \
  --query 'LayerVersions[].Version' --output text
```
Pick the highest available version and update the literal in Step 2 accordingly.

- [ ] **Step 2: Prepend an LWA `locals` block to `functions.tf`**

The current `functions.tf` starts directly with `module "api"` (no `locals` block). Use `Edit` to insert a new `locals` block at the top of the file.

Old (lines 1-3):
```hcl
module "api" {
  source        = "github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1"
  function_name = "cardgames-score-api"
```

New:
```hcl
locals {
  # AWS Lambda Web Adapter (arm64) - publisher account 753240598075.
  # Bump intentionally; release notes:
  # https://github.com/aws/aws-lambda-web-adapter/releases
  lwa_layer_version = 27
  lwa_layer_arn     = "arn:aws:lambda:${var.region}:753240598075:layer:LambdaAdapterLayerArm64:${local.lwa_layer_version}"
}

module "api" {
  source        = "github.com/Maev4l/terraform-modules//modules/lambda-function?ref=v1.7.1"
  function_name = "cardgames-score-api"
```

- [ ] **Step 3: Attach the layer to `module "api"`**

Find this block in `module "api"`:

Old:
```hcl
  function_name = "cardgames-score-api"
  zip = {
```

New:
```hcl
  function_name = "cardgames-score-api"

  # AWS Lambda Web Adapter (arm64). The layer's Extension intercepts the
  # Lambda runtime API and forwards events as HTTP requests to PORT.
  layers = [local.lwa_layer_arn]

  zip = {
```

- [ ] **Step 4: Add LWA env vars to `module "api"`**

Find the `environment_variables` block:

Old:
```hcl
  environment_variables = {
    GAMES_TABLE   = aws_dynamodb_table.games.name
    REGION        = var.region
    BEDROCK_MODEL = var.bedrock_model
  }
```

New:
```hcl
  environment_variables = {
    GAMES_TABLE   = aws_dynamodb_table.games.name
    REGION        = var.region
    BEDROCK_MODEL = var.bedrock_model

    # AWS Lambda Web Adapter forwards events to this port on 127.0.0.1.
    # Must match the port the Gin server binds to in api/cmd/main.go.
    PORT                = "8080"
    AWS_LWA_INVOKE_MODE = "buffered"
  }
```

- [ ] **Step 5: Format and validate**

```bash
terraform -chdir=packages/infrastructure fmt
```
Expected: prints the path of any reformatted file, or nothing if already well-formatted. Exit code 0.

```bash
terraform -chdir=packages/infrastructure validate
```
Expected: `Success! The configuration is valid.` Exit code 0.

If validate fails with `Reference to undeclared input variable`: confirm `var.region` exists in `packages/infrastructure/variables.tf` (it does — default `eu-central-1`).

- [ ] **Step 6: Suggested commit**

Confirm with the user, then:
```bash
git add packages/infrastructure/functions.tf
git commit -m "$(cat <<'EOF'
infra(api): Attach AWS Lambda Web Adapter layer to cardgames-score-api

Adds the public LWA arm64 layer (v27, published by 753240598075) and
the two env vars LWA needs:
- PORT=8080 (where Gin binds inside the Lambda runtime)
- AWS_LWA_INVOKE_MODE=buffered (default; explicit for clarity vs.
  response_stream)

Replaces the now-archived aws-lambda-go-api-proxy that the Go code
just dropped. API Gateway integration is unchanged.
EOF
)"
```

---

## Task 6: Deploy and verify

Goal: roll the changes to AWS and confirm the production API behaves identically (except for `/api/detections` now requiring group membership — the deliberate behavior change).

**Preconditions for the engineer:**
- Tasks 1–5 are committed.
- AWS credentials for the deployment account are in the environment.

- [ ] **Step 1: Rebuild the api zip**

Even if Task 2 Step 5 already built it, rebuild to guarantee the binary on disk matches the committed code:

```bash
yarn backend:build
```
Expected: produces `packages/functions/api/dist/api.zip` containing the new `bootstrap` binary. Exit code 0.

Confirm freshness:
```bash
ls -la packages/functions/api/bin/bootstrap packages/functions/api/dist/api.zip
```
Both should be timestamped within the last minute.

- [ ] **Step 2: `terraform plan`**

```bash
yarn infra:plan -out=lwa-migration.tfplan
```

Expected diffs — and **only** these — on `module.api.aws_lambda_function.this`:

1. `layers` adds `["arn:aws:lambda:eu-central-1:753240598075:layer:LambdaAdapterLayerArm64:27"]`.
2. `environment.variables` gains two keys: `PORT = "8080"` and `AWS_LWA_INVOKE_MODE = "buffered"`. No other env var changes.
3. `source_code_hash` changes (new `bootstrap` binary).

If you see diffs on `module.api_trigger`, IAM, Cognito, DynamoDB, CloudFront, route53, ACM, or any other resource — **STOP** and investigate. The migration should be purely additive on `cardgames-score-api`.

If the plan looks clean, the `-out=lwa-migration.tfplan` flag saved it to `packages/infrastructure/lwa-migration.tfplan` for the next step.

- [ ] **Step 3: `terraform apply` — user runs this themselves**

Hand the plan to the user:
> Plan saved to `packages/infrastructure/lwa-migration.tfplan`. The expected diffs are limited to `module.api.aws_lambda_function.this` (layer + 2 env vars + code hash). Apply with:
> ```bash
> terraform -chdir=packages/infrastructure apply lwa-migration.tfplan
> ```
> Per your global rule, I won't apply for you — let me know once it's done so I can run the post-deploy checks.

Wait for the user to confirm apply succeeded before continuing.

- [ ] **Step 4: Post-deploy verification — read paths**

Get the API GW endpoint URL. It's behind CloudFront in production; use the production URL from `packages/web-client/output.json` (regenerate with `yarn infra:output` if stale), or read it from the Terraform output. Substitute as `<API_URL>` below, and use a real prod JWT for a `cardgames-score`-group user.

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  <API_URL>/api/games
```
Expected: `HTTP 200`, valid JSON body. Same shape as pre-migration.

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  <API_URL>/api/games/<gameId>
```
Expected: `HTTP 200`, full game JSON (or `HTTP 404` if the ID isn't owned by this user — also fine).

- [ ] **Step 5: Post-deploy verification — write path round-trip**

Create and delete a throwaway game. The exact body shape comes from `handlers.CreateGame` — a minimal Belote game probe:

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"variant":"belote","team1Name":"lwa-smoke","team2Name":"delete-me","targetScore":1000}' \
  <API_URL>/api/games
```
Expected: `HTTP 201` (or `HTTP 200`) with `{ "id": "...", ... }`. If the body shape doesn't match `CreateGame`'s validation, check `packages/functions/api/handlers/games.go` for the exact required fields and adjust — the goal here is just to exercise a write path, not validate the request schema.

Then delete it:
```bash
curl -sS -w "\nHTTP %{http_code}\n" -X DELETE \
  -H "Authorization: Bearer <JWT>" \
  <API_URL>/api/games/<id-from-create>
```
Expected: `HTTP 200`.

- [ ] **Step 6: Verify detection is now group-protected**

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  <API_URL>/api/detections
```
Expected: `HTTP 400` (invalid body) or another non-403 — proves the group user can reach it.

If a non-group JWT is available:
```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer <NON_GROUP_JWT>" \
  <API_URL>/api/detections
```
Expected: `HTTP 403 "User not approved for this application"`. Confirms the deliberate behavior change is live.

- [ ] **Step 7: CloudWatch checks**

```bash
aws logs tail /aws/lambda/cardgames-score-api --since 5m --region eu-central-1
```
Look for:
- A cold-start log line like `Listening and serving HTTP on :8080` (or `[GIN]` request lines in release mode).
- **No** `panic`, `connection refused`, or `dial tcp 127.0.0.1:8080: connect: connection refused`. The last would indicate LWA forwarded before Gin bound the port — see Spec risk row for the readiness-check mitigation.
- HTTP status codes on `[GIN]` lines matching what `curl` saw (200/201/204).

Spot-check latency:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/cardgames-score-api \
  --filter-pattern 'REPORT' \
  --max-items 20 \
  --region eu-central-1
```
Look at `Duration` and `Billed Duration` — should be in the same ballpark as pre-migration baseline (sample a few values from before the apply for comparison).

- [ ] **Step 8: Confirm web-client end-to-end**

Sign into the deployed web client, list games, create a Belote game, add a round, delete it. Anything that breaks here is a regression — capture the failing request from devtools and triage against CloudWatch logs.

Note: if a previously unapproved user could call `/api/detections` before this migration and the web client allowed them to, this is the deliberate behavior change — they now get 403. That is intended, not a regression.

- [ ] **Step 9: Mark migration complete**

If everything is green: the LWA migration is done. No tag/release needed — git history is the record.

If anything is red, roll back:
```bash
git revert <task-5-commit-sha>
terraform -chdir=packages/infrastructure apply
```
The previous `bootstrap` binary stays on disk; reverting the Terraform commit restores prior `layers`/env config, and the unchanged `source_code_hash` (since we don't revert Tasks 1-2) means the Lambda keeps... wait, that's not right. The reverted state still expects the **new** binary on disk, so reverting only Task 5 leaves a mismatch.

Honest rollback options:
- **Fast path (recommended if production is hot):** revert Tasks 1, 2, and 5 together (`git revert <task-1-sha> <task-2-sha> <task-5-sha>`), `yarn backend:build`, `terraform apply`. Restores the previous proxy-based binary + previous infra config in one step.
- **Slow path:** investigate without rolling back. Any non-Bedrock route still works because the proxy library and LWA both produce equivalent `*gin.Context` for handlers — the most likely failure modes are detection-specific or auth-specific.

---

## Self-review (against spec)

**Spec coverage check** (each section of the spec maps to at least one task):

| Spec section | Covered by |
|---|---|
| Problem / scope (only `api` lambda) | Task 1 + Task 2 (touch only `middleware/auth.go`, `api/cmd/main.go`, `go.mod`) |
| Goal 1 (remove proxy + aws-lambda-go) | Task 2, Step 4 |
| Goal 2 (LWA arm64 layer) | Task 5, Steps 2-3 |
| Goal 3 (rewrite auth middleware to parse JWT from header) | Task 1, Step 2 |
| Goal 4 (move /api/detections inside protected group) | Task 2, Step 1 (new `main.go` routes); Task 4 Step 5 + Task 6 Step 6 (verification) |
| Goal 5 (locally runnable HTTP server) | Task 3 (Makefile + .env template); Task 4 (smoke test) |
| Goal 6 (preserve other behavior) | Task 1 Step 5 + Task 6 Steps 4-8 (smoke + post-deploy proves handlers untouched) |
| Architecture (before/after) | Task 5 (layer + env vars wire up LWA); Task 2 (main.go rewrite collapses init() + ginLambda) |
| Code changes (`middleware/auth.go` rewrite) | Task 1, Step 2 |
| Code changes (`main.go` rewrite) | Task 2, Step 1 |
| Code changes (`go.mod` cleanup) | Task 1 Step 1 (add jwx) + Task 2 Step 4 (tidy drops proxy/aws-lambda-go) |
| Code changes (build pipeline unchanged) | Task 2, Step 5 verifies `yarn backend:build` still produces the artifacts |
| Terraform changes (locals + module "api" diff) | Task 5, Steps 2-4 |
| Local development (`make run-api-local`, `.env.local.example`, gitignore) | Task 3 |
| Rollout order (code → build → smoke → plan → apply) | Tasks 1 → 2 → 3 → 4 → 5 → 6 |
| Post-deploy verification checklist | Task 6, Steps 4-8 |
| Risk: layer not in region | Task 5, Step 1 |
| Risk: cold-start race | Task 6, Step 7 (CloudWatch error check) |
| Risk: detection regression (deliberate) | Task 4 Step 5, Task 6 Step 6, Task 6 Step 8 (note) |
| Risk: rollback complexity | Task 6, Step 9 (revised honest rollback options) |

No spec section is uncovered.

**Placeholder scan:** `<JWT>`, `<NON_GROUP_JWT>`, `<gameId>`, `<id-from-create>`, `<API_URL>`, `<task-N-sha>` are intentional runtime-substitution placeholders, not unresolved decisions. Every code block is complete. Every command has an exact expected output.

**Type/name consistency:**
- `middleware.TokenParser()`, `middleware.RequireApproval()`, `middleware.GetUserID()`, `middleware.CORS()`, `middleware.UserIDKey`, `middleware.RequiredGroup` — referenced identically across Tasks 1, 2, and self-review.
- Env var names `PORT`, `AWS_LWA_INVOKE_MODE`, `REGION`, `GAMES_TABLE`, `BEDROCK_MODEL` — consistent across Tasks 2, 3, 5.
- Terraform locals `lwa_layer_version`, `lwa_layer_arn` — defined in Task 5 Step 2, referenced in Step 3.
- Lambda function name `cardgames-score-api` — consistent across Tasks 5 and 6.
- Layer name `LambdaAdapterLayerArm64`, publisher account `753240598075`, layer version `:27` — referenced identically across spec and Tasks 5/6.
