# Backend & Data Model

## DynamoDB Schema

Table: `atout-games`

### Data Model (Single-Table Design)

| PK | SK | Attributes |
|----|-----|------------|
| `USER#{userId}` | `GAME#belote#{gameId}` | type, status, teams, targetScore, createdAt, expiresAt |
| `USER#{userId}` | `GAME#tarot#{gameId}` | type, status, players, targetRounds, createdAt, expiresAt |
| `GAME#{gameId}` | `ROUND#{roundNum}` | taker, trump, scores, belote, capot, createdAt |

### Access Patterns

1. **List user's games**: `PK = USER#{userId}, SK begins_with GAME#`
2. **List Belote games only**: `PK = USER#{userId}, SK begins_with GAME#belote#`
3. **Get game rounds**: `PK = GAME#{gameId}, SK begins_with ROUND#`

### TTL

- `expiresAt` attribute, set to 1 month after creation
- Automatically deletes old games

## API Routes

All routes require JWT authentication via API Gateway Cognito authorizer.
Game routes additionally require `cardgames-score` group membership.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/games` | Create new game |
| GET | `/api/games` | List user's games (optional `?type=belote`) |
| GET | `/api/games/:id` | Get game with rounds |
| POST | `/api/games/:id/rounds` | Add round |
| DELETE | `/api/games/:id/rounds/:num` | Delete round (undo) |
| PATCH | `/api/games/:id` | Update game (status, scores) |
| POST | `/api/detections` | Detect cards from image (Bedrock) |

## Authorization Flow

1. User authenticates via Cognito (email/password or Google OAuth)
2. API Gateway validates JWT and extracts claims
3. `middleware/auth.go` checks `cognito:groups` claim contains `cardgames-score`
4. User ID (`sub` claim) is stored in Gin context for handlers

## Request/Response Examples

### Create Game
```json
POST /api/games
{
  "type": "belote",
  "teams": {
    "a": { "name": "Nous", "score": 0 },
    "b": { "name": "Eux", "score": 0 }
  },
  "targetScore": 1000
}
```

### Add Round
```json
POST /api/games/{id}/rounds
{
  "taker": "A",
  "trump": "hearts",
  "scores": { "A": 120, "B": 42 },
  "belote": true,
  "capot": false
}
```

**Notes:**
- Returns `400 Bad Request` if game is already finished
- Auto-finishes game when team reaches target score

### Card Detection
```json
POST /api/detections
{
  "image": "<base64-encoded-image>",
  "mediaType": "image/jpeg"
}

Response:
{
  "cards": [
    { "rank": "Ace", "suit": "Spades" },
    { "rank": "10", "suit": "Hearts" }
  ]
}
```
