package pipeline

import (
	"image"

	"github.com/disintegration/imaging"
)

// ContrastStep adjusts image contrast
type ContrastStep struct {
	// Percentage change (-100 to 100)
	Percentage float64
}

func (s ContrastStep) Name() string {
	return "contrast"
}

func (s ContrastStep) Apply(img image.Image) image.Image {
	return imaging.AdjustContrast(img, s.Percentage)
}

// Contrast creates a contrast adjustment step
func Contrast(percentage float64) Step {
	return ContrastStep{Percentage: percentage}
}

// BrightnessStep adjusts image brightness
type BrightnessStep struct {
	// Percentage change (-100 to 100)
	Percentage float64
}

func (s BrightnessStep) Name() string {
	return "brightness"
}

func (s BrightnessStep) Apply(img image.Image) image.Image {
	return imaging.AdjustBrightness(img, s.Percentage)
}

// Brightness creates a brightness adjustment step
func Brightness(percentage float64) Step {
	return BrightnessStep{Percentage: percentage}
}

// SharpenStep sharpens the image
type SharpenStep struct {
	// Sigma controls the sharpening intensity (0.5-3.0 typical)
	Sigma float64
}

func (s SharpenStep) Name() string {
	return "sharpen"
}

func (s SharpenStep) Apply(img image.Image) image.Image {
	return imaging.Sharpen(img, s.Sigma)
}

// Sharpen creates a sharpening step
func Sharpen(sigma float64) Step {
	return SharpenStep{Sigma: sigma}
}

// SaturationStep adjusts color saturation
type SaturationStep struct {
	// Percentage change (-100 to 100)
	Percentage float64
}

func (s SaturationStep) Name() string {
	return "saturation"
}

func (s SaturationStep) Apply(img image.Image) image.Image {
	return imaging.AdjustSaturation(img, s.Percentage)
}

// Saturation creates a saturation adjustment step
func Saturation(percentage float64) Step {
	return SaturationStep{Percentage: percentage}
}

// GammaStep applies gamma correction
type GammaStep struct {
	// Gamma value (< 1 darkens, > 1 lightens midtones)
	Gamma float64
}

func (s GammaStep) Name() string {
	return "gamma"
}

func (s GammaStep) Apply(img image.Image) image.Image {
	return imaging.AdjustGamma(img, s.Gamma)
}

// Gamma creates a gamma correction step
func Gamma(gamma float64) Step {
	return GammaStep{Gamma: gamma}
}
