# UI Screen Flow

## Navigation

```
/login
  └── Email/password or Google OAuth
  └── → /home (if approved) or /pending-approval

/home
  └── List of games (active first, then finished)
  └── FAB "+" → /new-game
  └── Tap game → /belote/game/:id or /tarot/game/:id

/new-game
  └── Game type selector
  └── Belote → /belote/setup
  └── Tarot → /tarot/setup
```

## Belote Flow

```
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
```

## Tarot Flow

```
/tarot/setup
  └── Player count: 3 / 4 / 5 toggle
  └── Player name inputs (dynamic based on count)
  └── "Start Game" → creates game → /tarot/game/:id

/tarot/game/:id
  └── Score header (all players, horizontal scroll)
  └── Round entry form (if game active):
      - Taker selector (player buttons)
      - Partner selector (5-player only)
      - Called King (5-player only)
      - Contract selector (Petite/Garde/Garde Sans/Garde Contre)
      - Bouts selector (0/1/2/3)
      - Taker points slider (0-91)
      - Bonuses: Petit au bout, Poignee, Chelem
      - Score preview (auto-calculated)
      - "Validate" button
  └── Round history
  └── End game button (manual end)
```

## Components

### Shared Components

#### GameCard
- Shows team/player names and scores
- Trophy icon for finished games, clock for active
- Date footer

#### ConfirmModal
- Generic confirmation dialog
- Supports danger/warning variants

#### CameraCapture
- Full-screen camera interface using react-webcam
- Live camera preview with guide overlay
- Supports capturing multiple photos before submitting
- Thumbnails of captured images on left side
- Sends all images to `/api/detections` with game type
- Shows loading spinner during analysis

#### DetectedCards
- Review screen for AI-detected cards
- Remove misdetected cards
- Add missing cards manually
- Shows calculated point total
- Retake button to capture new images

### Belote Components

#### TrumpSelector
- 4 buttons: ♥ ♦ ♣ ♠
- Gold border for selected suit

#### TeamToggle
- Two-button toggle for A/B team selection
- Ruby background for selected

#### RoundHistory
- Collapsible list of past rounds
- Shows trump suit, taker, score, bonuses
- Delete button for undo (active games only)

### Tarot Components

#### PlayerSelector
- Player name buttons for taker/partner selection
- Ruby background for selected

#### ContractSelector
- 4 buttons: Petite (x1), Garde (x2), Garde Sans (x4), Garde Contre (x6)
- Gold background for selected

#### BoutsSelector
- 4 buttons: 0, 1, 2, 3
- Shows required points for each option

## Belote Scoring Logic

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

## Tarot Scoring Logic

### Required Points (by bouts)
| Bouts | Required |
|-------|----------|
| 0 | 56 |
| 1 | 51 |
| 2 | 41 |
| 3 | 36 |

### Contracts
| Contract | Multiplier |
|----------|------------|
| Petite | x1 |
| Garde | x2 |
| Garde Sans | x4 |
| Garde Contre | x6 |

### Bonuses
- **Petit au bout:** +10 (x multiplier)
- **Poignee:** +20/+30/+40 for 10/13/15 trumps shown
- **Chelem:** +200 (achieved) / +400 (announced)

### Win Condition
Manual end - no target score. Players decide when to stop.
