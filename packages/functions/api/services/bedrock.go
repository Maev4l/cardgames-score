package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

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

// Card represents a playing card
type Card struct {
	Rank string `json:"rank"`
	Suit string `json:"suit"`
}

// BedrockService handles card detection via Claude on Bedrock
type BedrockService struct {
	client  *bedrockruntime.Client
	modelID string
}

// NewBedrockService creates a new Bedrock service
func NewBedrockService(region string) (*BedrockService, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	return &BedrockService{
		client:  bedrockruntime.NewFromConfig(cfg),
		modelID: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
	}, nil
}

// DetectCards analyzes an image and returns detected playing cards
func (s *BedrockService) DetectCards(ctx context.Context, imageBase64, mediaType string) ([]Card, error) {
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
						Text: `Carefully examine this image and identify ALL playing cards visible, including partially visible or overlapping cards.

IMPORTANT: Look at the ENTIRE image systematically - check all corners and edges.

For each card found:
- Rank: 7, 8, 9, 10, Jack, Queen, King, or Ace
- Suit: Hearts (red ♥), Diamonds (red ♦), Clubs (black ♣), Spades (black ♠)

This is French Belote (32-card deck): 7, 8, 9, 10, J, Q, K, A in each suit.

Return ONLY a JSON array, no other text:
[{"rank": "Ace", "suit": "Spades"}, {"rank": "10", "suit": "Hearts"}]

Count the cards you see and make sure you list them all.`,
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

	var cards []Card
	if err := json.Unmarshal([]byte(jsonStr), &cards); err != nil {
		return nil, fmt.Errorf("parsing cards JSON: %w (raw: %s)", err, rawText)
	}

	// Deduplicate cards
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

// deduplicateCards removes duplicate cards from the slice
func deduplicateCards(cards []Card) []Card {
	seen := make(map[string]bool)
	result := []Card{}

	for _, card := range cards {
		key := strings.ToLower(card.Rank + "-" + card.Suit)
		if !seen[key] {
			seen[key] = true
			result = append(result, card)
		}
	}
	return result
}
