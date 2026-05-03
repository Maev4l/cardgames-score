package handlers

// Belote scoring constants and calculation
// Total points per round: 162 (without bonuses)
// Belote bonus: +20 to team holding King+Queen of trump
// Capot: Winner takes all 252 points (162 + 90 bonus)

const (
	// BeloteTotalPoints is the sum of all card points in a Belote round
	BeloteTotalPoints = 162

	// BeloteBonusPoints is the bonus for holding Belote (King+Queen of trump)
	BeloteBonusPoints = 20

	// BeloteCapotPoints is the total points for a Capot (all tricks won)
	BeloteCapotPoints = 252
)

// BeloteCardPoints maps card ranks to their point values
// First value is normal, second is trump
var BeloteCardPoints = map[string][2]int{
	"7":     {0, 0},
	"8":     {0, 0},
	"9":     {0, 14},  // 9 is worth 14 in trump
	"10":    {10, 10},
	"Jack":  {2, 20},  // Jack is worth 20 in trump
	"Queen": {3, 3},
	"King":  {4, 4},
	"Ace":   {11, 11},
}

// CalculateBeloteCardPoints returns the point value for a card
// isTrump indicates if the card's suit is trump
func CalculateBeloteCardPoints(rank string, isTrump bool) int {
	points, ok := BeloteCardPoints[rank]
	if !ok {
		return 0
	}
	if isTrump {
		return points[1]
	}
	return points[0]
}
