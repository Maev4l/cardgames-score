# UI Screen Flow

## Navigation

```
/login
  └── Email/password or Google OAuth
  └── → /home (if approved) or /pending-approval

/home
  └── List of games (active first, then finished)
  └── FAB "+" → /new-game
  └── Tap game → /belote/game/:id

/new-game
  └── Game type selector
  └── Belote (active) → /belote/setup
  └── Tarot (disabled, "Coming soon")

/belote/setup
  └── Team A name (default: "Nous")
  └── Team B name (default: "Eux")
  └── Target score: 1000 / 2000 toggle
  └── "Start Game" → creates game → /belote/game/:id

/belote/game/:id
  └── Score header (team names, scores, winner banner)
  └── Round entry form (if game active):
      - Taker toggle (A / B)
      - Trump selector (4 suit buttons)
      - Points inputs (A / B)
      - Camera button → capture → detect → review
      - Belote checkbox (+20)
      - Capot checkbox (252 total)
      - "Validate" button
  └── Round history (collapsible, delete to undo)
  └── Winner popup (auto-shows when target reached)
      - Trophy icon + winning team name
      - Final score display
      - "View Game" to dismiss and stay
      - "Back to Games" to return to /home
```

## Components

### GameCard
- Shows team names and scores
- Trophy icon for finished games, clock for active
- Date and target score footer

### TrumpSelector
- 4 buttons: ♥ ♦ ♣ ♠
- Gold border for selected suit

### TeamToggle
- Two-button toggle for A/B team selection
- Ruby background for selected

### RoundHistory
- Collapsible list of past rounds
- Shows trump suit, taker, score, bonuses
- Delete button for undo (active games only)

### CameraCapture
- Full-screen camera interface using react-webcam
- Live camera preview with guide overlay
- Supports capturing multiple photos before submitting
- Thumbnails of captured images on left side
- Sends all images to `/api/detections` (deduplicates cards across images)
- Shows loading spinner during analysis

### DetectedCards
- Review screen for AI-detected cards
- Remove misdetected cards
- Add missing cards manually
- Shows calculated point total

## Scoring Logic

### Base Card Points
| Card | Normal | Trump |
|------|--------|-------|
| 7, 8 | 0 | 0 |
| 9 | 0 | 14 |
| 10 | 10 | 10 |
| Jack | 2 | 20 |
| Queen | 3 | 3 |
| King | 4 | 4 |
| Ace | 11 | 11 |

**Total per round:** 162 points

### Bonuses
- **Belote:** +20 to team holding King+Queen of trump
- **Capot:** Winner takes all 252 points (162 + 90 bonus)

### Win Condition
First team to reach target score (1000 or 2000) wins.
