package handlers

import (
	"cardgames-score.isnan.eu/functions/api/services"
)

// HTTPHandler handles HTTP requests for card detection
type HTTPHandler struct {
	bedrock *services.BedrockService
}

// NewHTTPHandler creates a new HTTP handler
func NewHTTPHandler(bedrock *services.BedrockService) *HTTPHandler {
	return &HTTPHandler{bedrock: bedrock}
}
