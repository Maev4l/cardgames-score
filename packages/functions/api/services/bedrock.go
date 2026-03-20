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
)

// Detection prompts - each focuses on different aspects
// Output format is strictly defined: rank and suit must use exact values below
var detectionPrompts = []string{
	// Prompt 0: General systematic scan
	`You are analyzing a photo of French Belote playing cards. Identify ALL visible cards.

STEP 1 - SCAN SYSTEMATICALLY:
- Divide the image into 4 quadrants (top-left, top-right, bottom-left, bottom-right)
- Check each quadrant carefully
- Pay special attention to edges where cards may be partially visible
- Look for overlapping cards

STEP 2 - IDENTIFY EACH CARD:
Cards may be printed in FRENCH or ENGLISH:
- French: R (Roi), D (Dame), V (Valet), As
- English: K, Q, J, A
- Numbers: 7, 8, 9, 10

Suits: Hearts (red ♥), Diamonds (red ♦), Clubs (black ♣), Spades (black ♠)
Belote uses 32 cards: 7, 8, 9, 10, J/V, Q/D, K/R, A in each suit

STEP 3 - RATE CONFIDENCE (1-100):
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

	// Prompt 1: Focus on hard-to-see/partial cards
	`You are a specialist at finding PARTIALLY VISIBLE playing cards that are easy to miss.

FOCUS AREAS (where cards often hide):
1. IMAGE EDGES - cards cut off at top/bottom/left/right borders
2. UNDER OTHER CARDS - look for corners or edges peeking out
3. FANNED/SPREAD CARDS - where only the corner index shows
4. TILTED/ROTATED CARDS - at unusual angles

CARD IDENTIFICATION:
- Look for corner indices (small rank + suit symbol in corners)
- French cards: R=King, D=Queen, V=Jack, As=Ace
- English cards: K=King, Q=Queen, J=Jack, A=Ace
- Numbers: 7, 8, 9, 10

Suits: ♥ Hearts (red), ♦ Diamonds (red), ♣ Clubs (black), ♠ Spades (black)
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
)

// Standard suit values (API contract)
const (
	SuitHearts   = "Hearts"
	SuitDiamonds = "Diamonds"
	SuitClubs    = "Clubs"
	SuitSpades   = "Spades"
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

// NumPrompts returns the number of available detection prompts
func (s *BedrockService) NumPrompts() int {
	return len(detectionPrompts)
}

// DetectCards analyzes an image using default prompt (prompt 0)
func (s *BedrockService) DetectCards(ctx context.Context, imageBase64, mediaType string) ([]Card, error) {
	return s.DetectCardsWithPrompt(ctx, imageBase64, mediaType, 0)
}

// DetectCardsWithPrompt analyzes an image using a specific prompt
func (s *BedrockService) DetectCardsWithPrompt(ctx context.Context, imageBase64, mediaType string, promptIndex int) ([]Card, error) {
	if promptIndex < 0 || promptIndex >= len(detectionPrompts) {
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
						Text: detectionPrompts[promptIndex],
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
	return deduplicateCards(cards), nil
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
