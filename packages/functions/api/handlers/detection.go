package handlers

import (
	"net/http"
	"sort"
	"strings"
	"sync"

	"cardgames-score.isnan.eu/functions/api/pipeline"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// detectionResult holds detection result for a single image + prompt combination
type detectionResult struct {
	imageIndex  int
	promptIndex int
	cards       []services.Card
	err         error
}

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

	// Determine number of passes (default 1, cap at max prompts)
	numPasses := request.Passes
	maxPrompts := h.bedrock.NumPrompts()
	if numPasses <= 0 {
		numPasses = 1
	} else if numPasses > maxPrompts {
		numPasses = maxPrompts
	}

	// Step 1: Enhance all images using the card detection pipeline
	// Pipeline: Contrast +20% → Brightness +5% → Sharpen
	// Done sequentially before parallel detection to avoid memory spikes
	imgPipeline := pipeline.CardDetection()
	enhancedImages := make([]ImageData, len(images))
	for i, img := range images {
		enhanced, err := imgPipeline.Process(img.Image, img.MediaType)
		if err != nil {
			log.Warn().Msgf("Image enhancement failed for image %d, using original: %s", i, err.Error())
			enhancedImages[i] = img // Fallback to original
		} else {
			enhancedImages[i] = ImageData{Image: enhanced, MediaType: img.MediaType}
			log.Debug().Msgf("Image %d enhanced successfully", i)
		}
	}

	// Step 2: Run all detections in parallel (enhanced images x passes)
	resultChan := make(chan detectionResult, len(enhancedImages)*numPasses)
	var wg sync.WaitGroup

	for imgIdx, img := range enhancedImages {
		for passIdx := 0; passIdx < numPasses; passIdx++ {
			wg.Add(1)
			go func(imgIndex int, imgData ImageData, promptIndex int) {
				defer wg.Done()

				cards, err := h.bedrock.DetectCardsWithPrompt(
					c.Request.Context(),
					imgData.Image,
					imgData.MediaType,
					promptIndex,
				)
				if err != nil {
					log.Error().Msgf("Card detection failed for image %d, pass %d: %s", imgIndex, promptIndex, err.Error())
					resultChan <- detectionResult{imageIndex: imgIndex, promptIndex: promptIndex, cards: nil, err: err}
					return
				}

				resultChan <- detectionResult{imageIndex: imgIndex, promptIndex: promptIndex, cards: cards, err: nil}
			}(imgIdx, img, passIdx)
		}
	}

	// Wait for all goroutines and close channel
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results: group cards by image index
	cardsByImageMap := make(map[int][]services.Card)

	for result := range resultChan {
		if result.err == nil && result.cards != nil {
			cardsByImageMap[result.imageIndex] = append(cardsByImageMap[result.imageIndex], result.cards...)
		}
	}

	// Build flat list: dedupe per image, add image number, preserve order
	var allCards []Card

	for imgIdx := 0; imgIdx < len(images); imgIdx++ {
		// Deduplicate cards within this image (across all passes)
		imageCards := deduplicateServiceCards(cardsByImageMap[imgIdx])

		// Convert to handler Card type with image number (1-based)
		for _, card := range imageCards {
			allCards = append(allCards, Card{
				Rank:       card.Rank,
				Suit:       card.Suit,
				Confidence: card.Confidence,
				Order:      card.Order, // Order within image (1-based)
				Image:      imgIdx + 1, // Image number (1-based)
			})
		}
	}

	// Deduplicate across all images (same card in multiple photos = keep first occurrence with highest confidence)
	responseCards := deduplicateCards(allCards)

	c.JSON(http.StatusOK, DetectResponse{
		Cards: responseCards,
	})
}

// deduplicateServiceCards removes duplicate services.Card, keeping highest confidence but earliest order
func deduplicateServiceCards(cards []services.Card) []services.Card {
	best := make(map[string]services.Card)

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

	result := make([]services.Card, 0, len(best))
	for _, card := range best {
		result = append(result, card)
	}

	// Sort by detection order
	sort.Slice(result, func(i, j int) bool {
		return result[i].Order < result[j].Order
	})

	return result
}

// deduplicateCards removes duplicate cards across all images, keeping highest confidence but earliest occurrence
func deduplicateCards(cards []Card) []Card {
	best := make(map[string]Card)

	for _, card := range cards {
		key := strings.ToLower(card.Rank + "-" + card.Suit)
		if existing, found := best[key]; !found {
			best[key] = card
		} else if card.Confidence > existing.Confidence {
			// Keep higher confidence but preserve earlier image/order
			card.Image = existing.Image
			card.Order = existing.Order
			best[key] = card
		}
	}

	result := make([]Card, 0, len(best))
	for _, card := range best {
		result = append(result, card)
	}

	// Sort by image first, then by order within image
	sort.Slice(result, func(i, j int) bool {
		if result[i].Image != result[j].Image {
			return result[i].Image < result[j].Image
		}
		return result[i].Order < result[j].Order
	})

	return result
}

