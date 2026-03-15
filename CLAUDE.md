# Atout - Card Game Scoring App

A PWA for tracking card game scores (French Belote and Tarot).

## Architecture

- **Frontend:** React PWA (`packages/web-client`) - Vite, TailwindCSS, shadcn/ui
- **Backend:** Go Lambda + API Gateway (`packages/functions`)
- **Infrastructure:** Terraform (`packages/infrastructure`)
- **Auth:** AWS Cognito (shared platform-idp pool, requires `cardgames-score` group)
- **Storage:** DynamoDB (`atout-games` table)

## Commands

```bash
# Infrastructure
yarn infra:plan          # Preview infrastructure changes
yarn infra:apply         # Apply infrastructure changes

# Backend
yarn backend:build       # Build Go Lambda (creates api.zip)

# Frontend
yarn frontend:serve      # Local dev server (port 5176)
yarn frontend:build      # Production build
yarn frontend:deploy     # Build, sync to S3, invalidate CloudFront
```

## Documentation

- [Backend & Data Model](./docs/backend.md)
- [UI Screen Flow](./docs/ui.md)

## Key Files

### Backend
- `packages/functions/api/cmd/main.go` - Lambda entry point, route registration
- `packages/functions/api/handlers/games.go` - Game CRUD handlers
- `packages/functions/api/services/dynamodb.go` - DynamoDB operations
- `packages/functions/api/middleware/auth.go` - Group-based authorization

### Frontend
- `packages/web-client/src/App.jsx` - Routes
- `packages/web-client/src/lib/api.js` - API client
- `packages/web-client/src/pages/belote/GamePage.jsx` - Main game screen

### Infrastructure
- `packages/infrastructure/dynamodb.tf` - Games table
- `packages/infrastructure/functions.tf` - Lambda + API Gateway
