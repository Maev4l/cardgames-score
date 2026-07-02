.PHONY: infra-plan infra-apply infra-output \
	backend-build backend-deploy \
	frontend-serve frontend-build frontend-sync frontend-invalidate frontend-deploy

INFRA_DIR := packages/infrastructure
WEB_CLIENT_DIR := packages/web-client
FUNCTIONS_DIR := packages/functions

# --- Infrastructure ---
infra-plan:
	terraform -chdir=$(INFRA_DIR) plan

infra-apply:
	terraform -chdir=$(INFRA_DIR) apply -auto-approve

infra-output:
	terraform -chdir=$(INFRA_DIR) output -json > $(WEB_CLIENT_DIR)/output.json

# --- Backend ---
backend-build:
	$(MAKE) -C $(FUNCTIONS_DIR) package build

backend-deploy:
	$(MAKE) -C $(FUNCTIONS_DIR) package
	$(MAKE) infra-apply

# --- Frontend ---
frontend-serve:
	yarn --cwd $(WEB_CLIENT_DIR) dev

frontend-build: infra-output
	yarn --cwd $(WEB_CLIENT_DIR) build

frontend-sync:
	aws s3 sync $(WEB_CLIENT_DIR)/dist s3://$$(terraform -chdir=$(INFRA_DIR) output -raw webclient_bucket) --delete

frontend-invalidate:
	aws cloudfront create-invalidation --path '/*' --distribution-id $$(terraform -chdir=$(INFRA_DIR) output -raw cloudfront_distribution_id)

frontend-deploy: frontend-build frontend-sync frontend-invalidate
