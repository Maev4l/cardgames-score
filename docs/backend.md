# Backend & Data Model

## DynamoDB Schema

Table: `atout-games`

### Data Model (Single-Table Design)

| PK | SK | Attributes |
|----|-----|------------|
| `USER#{userId}` | `GAME#belote#{gameId}` | type, status, teams, targetScore, createdAt, expiresAt |
| `USER#{userId}` | `GAME#tarot#{gameId}` | type, status, players[], playerCount, createdAt, expiresAt |
| `GAME#{gameId}` | `ROUND#{roundNum}` | (game-type specific fields) |

### Belote Round Attributes
- taker, trump, scores, belote, capot, createdAt

### Tarot Round Attributes
- taker, partner, calledKing, contract, bouts, takerPoints, won, petitAuBout, poignee, chelem, scores, createdAt

### Access Patterns

1. **List user's games**: `PK = USER#{userId}, SK begins_with GAME#`
2. **List Belote games only**: `PK = USER#{userId}, SK begins_with GAME#belote#`
3. **List Tarot games only**: `PK = USER#{userId}, SK begins_with GAME#tarot#`
4. **Get game rounds**: `PK = GAME#{gameId}, SK begins_with ROUND#`

### TTL

- `expiresAt` attribute, set to 1 month after creation
- Automatically deletes old games

## API Routes

All routes require JWT authentication via API Gateway Cognito authorizer.
Game routes additionally require `cardgames-score` group membership.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/games` | Create new game |
| GET | `/api/games` | List user's games (optional `?type=belote\|tarot`) |
| GET | `/api/games/:id?type=` | Get game with rounds |
| POST | `/api/games/:id/rounds?type=` | Add round |
| DELETE | `/api/games/:id/rounds/:num?type=` | Delete round (undo) |
| PATCH | `/api/games/:id?type=` | Update game (status, scores) |
| DELETE | `/api/games/:id?type=` | Delete game |
| POST | `/api/detections` | Detect cards from image (Bedrock) |

## Authorization Flow

1. User authenticates via Cognito (email/password or Google OAuth)
2. API Gateway validates JWT and extracts claims
3. `middleware/auth.go` checks `cognito:groups` claim contains `cardgames-score`
4. User ID (`sub` claim) is stored in Gin context for handlers

## Request/Response Examples

### Create Belote Game
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

### Create Tarot Game
```json
POST /api/games
{
  "type": "tarot",
  "players": ["Alice", "Bob", "Charlie", "Dave"],
  "playerCount": 4
}
```

### Add Belote Round
```json
POST /api/games/{id}/rounds?type=belote
{
  "taker": "A",
  "trump": "hearts",
  "scores": { "A": 120, "B": 42 },
  "belote": true,
  "capot": false
}
```

### Add Tarot Round
```json
POST /api/games/{id}/rounds?type=tarot
{
  "taker": 0,
  "contract": "garde",
  "bouts": 2,
  "takerPoints": 45,
  "petitAuBout": "taker",
  "poignee": 10,
  "chelem": null
}
```

**Notes:**
- Returns `400 Bad Request` if game is already finished
- Belote: Auto-finishes game when team reaches target score
- Tarot: Manually ended by user (no target score)

### Card Detection
```json
POST /api/detections
{
  "type": "belote",
  "images": [
    { "image": "<base64>", "mediaType": "image/jpeg" }
  ]
}

Response:
{
  "cards": [
    { "rank": "Ace", "suit": "Spades", "confidence": 95 },
    { "rank": "10", "suit": "Hearts", "confidence": 88 }
  ]
}
```

**Detection Types:**
- `belote`: 32-card deck (7-A in each suit)
- `tarot`: 78-card deck (1-10 + court cards + 21 trumps + Excuse)

## Tarot Scoring

### Required Points (based on bouts/oudlers)
| Bouts | Required |
|-------|----------|
| 0 | 56 |
| 1 | 51 |
| 2 | 41 |
| 3 | 36 |

### Contract Multipliers
| Contract | Multiplier |
|----------|------------|
| Petite | x1 |
| Garde | x2 |
| Garde Sans | x4 |
| Garde Contre | x6 |

### Bonuses
- **Petit au bout**: +10 (x multiplier) if 1 trump wins last trick
- **Poignee**: +20/+30/+40 for showing 10/13/15 trumps
- **Chelem**: +200 (achieved) / +400 (announced) for winning all tricks

### Formula
```
diff = takerPoints - requiredPoints
base = (roundToNearest10(|diff|) + 25) x multiplier
bonus = petitAuBout + poignee + chelem
perDefender = base + bonus (negative if lost)
takerScore = perDefender x defenderCount
```
