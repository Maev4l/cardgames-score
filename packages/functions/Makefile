.PHONY: build package build-api clean

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
