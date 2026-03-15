package handlers

import (
	"net/http"
	"strings"

	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// RequestDetection handles POST /detections
// Accepts one or more base64-encoded images and returns deduplicated detected cards
func (h *HTTPHandler) RequestDetection(c *gin.Context) {
	var request DetectRequest
	if err := c.BindJSON(&request); err != nil {
		log.Error().Msgf("Invalid request: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request. Required: images array or image+mediaType",
		})
		return
	}

	validMediaTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
	}

	// Build list of images to process (support both single and multiple)
	var images []ImageData
	if len(request.Images) > 0 {
		images = request.Images
	} else if request.Image != "" && request.MediaType != "" {
		// Legacy single-image support
		images = []ImageData{{Image: request.Image, MediaType: request.MediaType}}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "No images provided",
		})
		return
	}

	// Validate all media types
	for i, img := range images {
		if !validMediaTypes[img.MediaType] {
			log.Error().Msgf("Invalid media type for image %d: %s", i, img.MediaType)
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Invalid mediaType. Supported: image/jpeg, image/png, image/webp, image/gif",
			})
			return
		}
	}

	// Detect cards from all images
	var allCards []services.Card
	for i, img := range images {
		cards, err := h.bedrock.DetectCards(c.Request.Context(), img.Image, img.MediaType)
		if err != nil {
			log.Error().Msgf("Card detection failed for image %d: %s", i, err.Error())
			// Continue with other images instead of failing completely
			continue
		}
		allCards = append(allCards, cards...)
	}

	// Deduplicate cards across all images
	responseCards := deduplicateCards(allCards)

	c.JSON(http.StatusOK, DetectResponse{
		Cards: responseCards,
	})
}

// deduplicateCards removes duplicate cards based on rank+suit
func deduplicateCards(cards []services.Card) []Card {
	seen := make(map[string]bool)
	result := []Card{}

	for _, card := range cards {
		key := strings.ToLower(card.Rank + "-" + card.Suit)
		if !seen[key] {
			seen[key] = true
			result = append(result, Card{
				Rank: card.Rank,
				Suit: card.Suit,
			})
		}
	}
	return result
}
