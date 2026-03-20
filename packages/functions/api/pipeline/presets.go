package pipeline

// CardDetection returns the default pipeline optimized for card detection
// Steps: Contrast +20% → Brightness +5% → Sharpen
func CardDetection() *Pipeline {
	return New().
		Add(Contrast(20)).
		Add(Brightness(5)).
		Add(Sharpen(1.0))
}
