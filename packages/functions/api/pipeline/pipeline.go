// Package pipeline provides composable image processing steps for card detection
package pipeline

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"strings"
)

// Step represents a single image processing step
type Step interface {
	// Name returns the step identifier for logging
	Name() string
	// Apply transforms the image and returns the result
	Apply(img image.Image) image.Image
}

// Pipeline chains multiple processing steps together
type Pipeline struct {
	steps []Step
}

// New creates a new empty pipeline
func New() *Pipeline {
	return &Pipeline{steps: []Step{}}
}

// Add appends a step to the pipeline
func (p *Pipeline) Add(step Step) *Pipeline {
	p.steps = append(p.steps, step)
	return p
}

// Steps returns the list of steps for inspection
func (p *Pipeline) Steps() []Step {
	return p.steps
}

// Process applies all steps to a base64-encoded image
// Returns base64-encoded result in the same format
func (p *Pipeline) Process(imageBase64, mediaType string) (string, error) {
	// Decode base64 to bytes
	imgBytes, err := base64.StdEncoding.DecodeString(imageBase64)
	if err != nil {
		return "", fmt.Errorf("decoding base64: %w", err)
	}

	// Decode image
	img, format, err := image.Decode(bytes.NewReader(imgBytes))
	if err != nil {
		return "", fmt.Errorf("decoding image: %w", err)
	}

	// Apply each step in sequence
	for _, step := range p.steps {
		img = step.Apply(img)
	}

	// Encode back to same format
	var buf bytes.Buffer
	switch strings.ToLower(format) {
	case "jpeg", "jpg":
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90})
	case "png":
		err = png.Encode(&buf, img)
	default:
		// Default to JPEG for other formats (webp, gif)
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90})
	}
	if err != nil {
		return "", fmt.Errorf("encoding image: %w", err)
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}
