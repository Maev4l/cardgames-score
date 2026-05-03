package services

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/rs/zerolog/log"
)

// Belote detection prompts (32-card deck: 7-A in each suit)
var belotePrompts = []string{
	// Prompt 0: General systematic scan with explicit suit shape guidance
	`You are analyzing a photo of French Belote playing cards. Identify ALL visible cards.

STEP 1 - SCAN SYSTEMATICALLY:
- Divide the image into 4 quadrants (top-left, top-right, bottom-left, bottom-right)
- Check each quadrant carefully
- Pay special attention to edges where cards may be partially visible
- Look for overlapping cards

STEP 2 - IDENTIFY SUITS BY SHAPE (CRITICAL - color alone is not enough):
RED SUITS - distinguish by SHAPE:
  ♥ Hearts = curved top with pointed bottom (valentine heart shape)
  ♦ Diamonds = four equal pointed corners (rhombus/tilted square shape)

BLACK SUITS - distinguish by SHAPE:
  ♠ Spades = pointed top + stem at bottom (upside-down heart with stem)
  ♣ Clubs = three rounded lobes at top + stem at bottom (shamrock/clover shape)

STEP 3 - IDENTIFY RANKS:
Cards may be printed in FRENCH or ENGLISH:
- French: R (Roi), D (Dame), V (Valet), As or 1
- English: K, Q, J, A or 1
- Numbers: 7, 8, 9, 10
- Note: Ace can be shown as "A", "As", or "1" depending on the deck

Belote uses 32 cards: 7, 8, 9, 10, J/V, Q/D, K/R, A in each suit

STEP 4 - RATE CONFIDENCE (1-100):
- 90-100: Card fully visible, rank and suit clearly readable
- 70-89: Card mostly visible, high certainty
- 50-69: Card partially obscured but identifiable
- Below 50: Uncertain, do not include

OUTPUT FORMAT (STRICT):
- rank MUST be exactly one of: "7", "8", "9", "10", "Jack", "Queen", "King", "Ace"
- suit MUST be exactly one of: "Hearts", "Diamonds", "Clubs", "Spades"
- confidence: integer 1-100

Return ONLY a JSON array:
[{"rank": "Ace", "suit": "Spades", "confidence": 95}, {"rank": "King", "suit": "Hearts", "confidence": 78}]

Include ALL cards with confidence >= 50. No other text, just the JSON array.`,

	// Prompt 1: Focus on hard-to-see/partial cards with suit shape guidance
	`You are a specialist at finding PARTIALLY VISIBLE playing cards that are easy to miss.

FOCUS AREAS (where cards often hide):
1. IMAGE EDGES - cards cut off at top/bottom/left/right borders
2. UNDER OTHER CARDS - look for corners or edges peeking out
3. FANNED/SPREAD CARDS - where only the corner index shows
4. TILTED/ROTATED CARDS - at unusual angles

CRITICAL - SUIT IDENTIFICATION BY SHAPE:
Do NOT rely on color alone. Same-color suits have DIFFERENT SHAPES:

RED SUITS:
  ♥ Hearts = curved/rounded top, pointed bottom (classic heart shape)
  ♦ Diamonds = 4 corners, all pointed, like a rotated square

BLACK SUITS:
  ♠ Spades = pointed top, curves out at sides, stem at bottom
  ♣ Clubs = 3 rounded bumps/lobes at top, stem at bottom

CARD IDENTIFICATION:
- Look for corner indices (small rank + suit symbol in corners)
- French cards: R=King, D=Queen, V=Jack, As or 1=Ace
- English cards: K=King, Q=Queen, J=Jack, A or 1=Ace
- Numbers: 7, 8, 9, 10

Belote deck: 7, 8, 9, 10, J/V, Q/D, K/R, A in each suit

OUTPUT FORMAT (STRICT):
- rank MUST be exactly one of: "7", "8", "9", "10", "Jack", "Queen", "King", "Ace"
- suit MUST be exactly one of: "Hearts", "Diamonds", "Clubs", "Spades"
- confidence: integer 1-100
- Include cards with confidence >= 30

Return ONLY a JSON array:
[{"rank": "Queen", "suit": "Clubs", "confidence": 45}, {"rank": "7", "suit": "Hearts", "confidence": 85}]

If no cards found, return: []`,
}

// Tarot detection prompts (78-card deck: standard suits + 21 trumps + Excuse)
var tarotPrompts = []string{
	// Prompt 0: General systematic scan for Tarot cards
	`You are analyzing a photo of French Tarot playing cards. Identify ALL visible cards.

The Tarot deck has 78 cards:
1. STANDARD SUITS (56 cards) - 14 cards each in Hearts, Diamonds, Clubs, Spades:
   - Numbers: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
   - Court cards: Valet (V/Jack), Cavalier (C/Knight), Dame (D/Queen), Roi (R/King)

2. TRUMPS (21 cards) - Numbered 1-21, suit is ALWAYS "Trump"
   HOW TO RECOGNIZE TRUMPS:
   - NO suit symbols (no hearts/diamonds/clubs/spades) - this is KEY!
   - Large illustrated scenes with figures, animals, or symbolic imagery
   - Number in corner or center: Arabic (1-21) OR Roman (I-XXI)
   - Roman variants: IIII=4, VIIII=9, XIIII=14, XVIIII=19
   - May be labeled "ATOUT" (French for trump)
   - Notable: 1 (Le Petit/Magician), 21 (Le Monde/World with wreath)

3. EXCUSE (1 card) - The Fool/Mat
   - No number
   - May show: jester/fool figure, OR a star (5 or 6 branches)
   - Sometimes marked with "*" or "Excuse"

SUIT IDENTIFICATION BY SHAPE:
RED SUITS:
  ♥ Hearts = curved top, pointed bottom (valentine heart)
  ♦ Diamonds = four pointed corners (rhombus shape)

BLACK SUITS:
  ♠ Spades = pointed top + stem (upside-down heart with stem)
  ♣ Clubs = three lobes at top + stem (clover shape)

CONFIDENCE RATING (1-100):
- 90-100: Card fully visible, clearly readable
- 70-89: Card mostly visible, high certainty
- 50-69: Card partially obscured but identifiable
- Below 50: Do not include

OUTPUT FORMAT (STRICT):
For standard suits:
- rank: "1"-"10", "Jack", "Knight", "Queen", "King"
- suit: "Hearts", "Diamonds", "Clubs", "Spades"

For trumps:
- rank: "1"-"21"
- suit: "Trump"

For Excuse:
- rank: "Excuse"
- suit: "Trump"

Return ONLY a JSON array:
[{"rank": "21", "suit": "Trump", "confidence": 95}, {"rank": "King", "suit": "Hearts", "confidence": 78}, {"rank": "Excuse", "suit": "Trump", "confidence": 90}]

Include ALL cards with confidence >= 50. No other text, just the JSON array.`,

	// Prompt 1: Focus on hard-to-see Tarot cards
	`You are a specialist at finding PARTIALLY VISIBLE Tarot cards that are easy to miss.

FOCUS AREAS:
1. IMAGE EDGES - cards cut off at borders
2. UNDER OTHER CARDS - corners/edges peeking out
3. FANNED CARDS - only corner index visible
4. TILTED/ROTATED cards

TAROT DECK (78 cards):
- Standard suits: 1-10, Valet, Cavalier, Dame, Roi in each suit (HAVE suit symbols)
- Trumps 1-21: NO suit symbols! Illustrated scenes with number (Arabic 1-21 or Roman I-XXI)
- Excuse: The Fool (no number, jester figure OR star symbol)

SUIT SHAPES (critical for same-color distinction):
♥ Hearts = rounded top, pointed bottom
♦ Diamonds = 4 pointed corners
♠ Spades = pointed top, stem at bottom
♣ Clubs = 3 rounded lobes, stem at bottom

OUTPUT FORMAT:
Standard suits: rank ("1"-"10", "Jack", "Knight", "Queen", "King"), suit ("Hearts"/"Diamonds"/"Clubs"/"Spades")
Trumps: rank ("1"-"21"), suit ("Trump")
Excuse: rank ("Excuse"), suit ("Trump")

Return ONLY a JSON array:
[{"rank": "Knight", "suit": "Clubs", "confidence": 45}, {"rank": "14", "suit": "Trump", "confidence": 85}]

Include cards with confidence >= 30. If none found, return: []`,
}

// Claude request/response structures for Bedrock API
type claudeRequest struct {
	AnthropicVersion string    `json:"anthropic_version"`
	MaxTokens        int       `json:"max_tokens"`
	Messages         []message `json:"messages"`
}

type message struct {
	Role    string    `json:"role"`
	Content []content `json:"content"`
}

type content struct {
	Type   string  `json:"type"`
	Text   string  `json:"text,omitempty"`
	Source *source `json:"source,omitempty"`
}

type source struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

type claudeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// Standard rank values (API contract)
const (
	RankSeven = "7"
	RankEight = "8"
	RankNine  = "9"
	RankTen   = "10"
	RankJack  = "Jack"
	RankQueen = "Queen"
	RankKing  = "King"
	RankAce   = "Ace"
	// Tarot-specific ranks
	RankKnight = "Knight"
	RankExcuse = "Excuse"
)

// Standard suit values (API contract)
const (
	SuitHearts   = "Hearts"
	SuitDiamonds = "Diamonds"
	SuitClubs    = "Clubs"
	SuitSpades   = "Spades"
	// Tarot-specific suit
	SuitTrump    = "Trump"
)

// Card represents a playing card with detection confidence
type Card struct {
	Rank       string `json:"rank"`
	Suit       string `json:"suit"`
	Confidence int    `json:"confidence"` // 1-100, how confident the model is
	Order      int    `json:"order"`      // Detection order (1-based, order AI returned it)
}

// normalizeRank converts AI-returned rank to standard API value
func normalizeRank(rank string) string {
	r := strings.ToLower(strings.TrimSpace(rank))
	switch r {
	// Belote ranks
	case "7":
		return RankSeven
	case "8":
		return RankEight
	case "9":
		return RankNine
	case "10":
		return RankTen
	case "j", "jack", "v", "valet":
		return RankJack
	case "q", "queen", "d", "dame":
		return RankQueen
	case "k", "king", "r", "roi":
		return RankKing
	case "a", "ace", "as":
		return RankAce
	// Tarot-specific ranks
	case "c", "cavalier", "knight":
		return RankKnight
	case "excuse", "fool", "mat", "star", "*":
		return RankExcuse
	// Tarot numbers 1-21 (Arabic and Roman numerals)
	case "1", "i":
		return "1"
	case "2", "ii":
		return "2"
	case "3", "iii":
		return "3"
	case "4", "iv", "iiii":
		return "4"
	case "5":
		return "5"
	case "6", "vi":
		return "6"
	case "11", "xi":
		return "11"
	case "12", "xii":
		return "12"
	case "13", "xiii":
		return "13"
	case "14", "xiv", "xiiii":
		return "14"
	case "15", "xv":
		return "15"
	case "16", "xvi":
		return "16"
	case "17", "xvii":
		return "17"
	case "18", "xviii":
		return "18"
	case "19", "xix", "xviiii":
		return "19"
	case "20", "xx":
		return "20"
	case "21", "xxi":
		return "21"
	default:
		return "" // Invalid rank
	}
}

// normalizeSuit converts AI-returned suit to standard API value
func normalizeSuit(suit string) string {
	s := strings.ToLower(strings.TrimSpace(suit))
	switch s {
	case "hearts", "heart", "coeur", "coeurs", "♥":
		return SuitHearts
	case "diamonds", "diamond", "carreau", "carreaux", "♦":
		return SuitDiamonds
	case "clubs", "club", "trefle", "trefles", "trèfle", "trèfles", "♣":
		return SuitClubs
	case "spades", "spade", "pique", "piques", "♠":
		return SuitSpades
	// Tarot-specific
	case "trump", "trumps", "atout", "atouts":
		return SuitTrump
	default:
		return "" // Invalid suit
	}
}

// BedrockService handles card detection via Claude on Bedrock
type BedrockService struct {
	client  *bedrockruntime.Client
	modelID string
}

// NewBedrockService creates a new Bedrock service
func NewBedrockService(region, modelID string) (*BedrockService, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	// Default model if not provided
	if modelID == "" {
		modelID = "eu.anthropic.claude-sonnet-4-6"
	}

	return &BedrockService{
		client:  bedrockruntime.NewFromConfig(cfg),
		modelID: modelID,
	}, nil
}

// getPrompts returns the prompts for the given game type
func getPrompts(gameType string) []string {
	if gameType == "tarot" {
		return tarotPrompts
	}
	return belotePrompts
}

// NumPrompts returns the number of available detection prompts for a game type
func (s *BedrockService) NumPrompts(gameType string) int {
	return len(getPrompts(gameType))
}

// DetectCards analyzes an image using default prompt (prompt 0) for Belote
func (s *BedrockService) DetectCards(ctx context.Context, imageBase64, mediaType string) ([]Card, error) {
	return s.DetectCardsWithPrompt(ctx, imageBase64, mediaType, 0, "belote")
}

// DetectCardsWithPrompt analyzes an image using a specific prompt for a game type
func (s *BedrockService) DetectCardsWithPrompt(ctx context.Context, imageBase64, mediaType string, promptIndex int, gameType string) ([]Card, error) {
	prompts := getPrompts(gameType)
	if promptIndex < 0 || promptIndex >= len(prompts) {
		promptIndex = 0
	}

	request := claudeRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        1024,
		Messages: []message{
			{
				Role: "user",
				Content: []content{
					{
						Type: "image",
						Source: &source{
							Type:      "base64",
							MediaType: mediaType,
							Data:      imageBase64,
						},
					},
					{
						Type: "text",
						Text: prompts[promptIndex],
					},
				},
			},
		},
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	output, err := s.client.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     &s.modelID,
		Body:        requestBody,
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return nil, fmt.Errorf("invoking model: %w", err)
	}

	var response claudeResponse
	if err := json.Unmarshal(output.Body, &response); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	if len(response.Content) == 0 {
		return []Card{}, nil
	}

	// Extract JSON array from response text
	rawText := response.Content[0].Text
	jsonStr := extractJSONArray(rawText)

	log.Debug().
		Int("prompt", promptIndex).
		Str("raw_response", rawText).
		Msg("Detection raw response")

	var rawCards []Card
	if err := json.Unmarshal([]byte(jsonStr), &rawCards); err != nil {
		return nil, fmt.Errorf("parsing cards JSON: %w (raw: %s)", err, rawText)
	}

	// Normalize and filter valid cards, assign detection order (1-based)
	var cards []Card
	for i, c := range rawCards {
		rank := normalizeRank(c.Rank)
		suit := normalizeSuit(c.Suit)
		if rank != "" && suit != "" {
			cards = append(cards, Card{
				Rank:       rank,
				Suit:       suit,
				Confidence: c.Confidence,
				Order:      i + 1, // 1-based detection order
			})
		}
	}

	// Deduplicate cards within this prompt's results (preserves order of first occurrence)
	result := deduplicateCards(cards)

	log.Info().
		Int("prompt", promptIndex).
		Int("raw_count", len(rawCards)).
		Int("valid_count", len(result)).
		Interface("cards", result).
		Msg("Detection result")

	return result, nil
}

// extractJSONArray extracts JSON array from text that may contain other content
func extractJSONArray(text string) string {
	start := strings.Index(text, "[")
	end := strings.LastIndex(text, "]")
	if start != -1 && end != -1 && end > start {
		return text[start : end+1]
	}
	return text
}

// deduplicateCards removes duplicate cards, keeping highest confidence but earliest order
func deduplicateCards(cards []Card) []Card {
	best := make(map[string]Card)

	for _, card := range cards {
		key := strings.ToLower(card.Rank + "-" + card.Suit)
		if existing, found := best[key]; !found {
			best[key] = card
		} else if card.Confidence > existing.Confidence {
			// Keep higher confidence but preserve earlier order
			card.Order = existing.Order
			best[key] = card
		}
	}

	result := make([]Card, 0, len(best))
	for _, card := range best {
		result = append(result, card)
	}

	// Sort by detection order
	sort.Slice(result, func(i, j int) bool {
		return result[i].Order < result[j].Order
	})

	return result
}
