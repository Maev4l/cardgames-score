.PHONY: build package build-api clean run-api-local

BIN_DIR := bin
PACKAGE_DIR := dist
# Build settings for AWS Lambda (ARM64)
GOOS := linux
GOARCH := arm64
LDFLAGS := -s -w

build-api:
	mkdir -p api/$(BIN_DIR)
	GOOS=$(GOOS) GOARCH=$(GOARCH) go build -ldflags="$(LDFLAGS)" -o api/$(BIN_DIR)/bootstrap ./api/cmd

package-api: build-api
	mkdir -p api/$(PACKAGE_DIR)
	cd api/$(BIN_DIR) && zip ../$(PACKAGE_DIR)/api.zip bootstrap

build: build-api

package: package-api

clean:
	rm -rf api/$(BIN_DIR) api/$(PACKAGE_DIR)

# Run the API lambda locally as a plain HTTP server (Web Adapter mode).
# Requires AWS credentials in the environment (e.g. `aws sso login`)
# and env vars sourced from api/.env.local (copy from .env.local.example).
run-api-local:
	@test -f api/.env.local || (echo "Missing api/.env.local — copy from api/.env.local.example"; exit 1)
	@set -a && . ./api/.env.local && set +a && go run ./api/cmd
