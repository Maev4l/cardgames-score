package handlers

// Card represents a playing card
type Card struct {
	Rank string `json:"rank"`
	Suit string `json:"suit"`
}

// ImageData represents a single image with its metadata
type ImageData struct {
	// Base64 encoded image
	Image string `json:"image" binding:"required"`
	// MIME type of the image (image/jpeg, image/png, etc.)
	MediaType string `json:"mediaType" binding:"required"`
}

// DetectRequest is the incoming request payload
// Supports both single image (legacy) and multiple images
type DetectRequest struct {
	// Single image (legacy support)
	Image     string `json:"image"`
	MediaType string `json:"mediaType"`
	// Multiple images
	Images []ImageData `json:"images"`
}

// DetectResponse is the response payload
type DetectResponse struct {
	Cards        []Card   `json:"cards"`
	CardsByImage [][]Card `json:"cardsByImage"`
}
