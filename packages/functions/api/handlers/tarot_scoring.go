package handlers

// Tarot scoring constants and calculation
// Total points in deck: 91
// Required points depend on bouts (oudlers) held by taker

const (
	// TarotTotalPoints is the sum of all card points in a Tarot deck
	TarotTotalPoints = 91
)

// TarotRequiredPoints maps bouts count to required points for taker to win
var TarotRequiredPoints = map[int]int{
	0: 56, // No bouts: need 56 points
	1: 51, // 1 bout: need 51 points
	2: 41, // 2 bouts: need 41 points
	3: 36, // 3 bouts: need 36 points
}

// TarotContractMultipliers maps contract names to their multipliers
var TarotContractMultipliers = map[string]int{
	"petite":        1, // Petite: x1
	"garde":         2, // Garde: x2
	"garde_sans":    4, // Garde Sans (without chien): x4
	"garde_contre":  6, // Garde Contre (defense takes chien): x6
}

// TarotPoigneeBonuses maps trumps shown to bonus points
var TarotPoigneeBonuses = map[int]int{
	10: 20, // Simple poignee (10 trumps): +20
	13: 30, // Double poignee (13 trumps): +30
	15: 40, // Triple poignee (15 trumps): +40
}

// TarotChelemBonus returns bonus for chelem (slam)
const (
	TarotChelemAnnounced = 400 // Announced and achieved
	TarotChelemAchieved  = 200 // Achieved without announcement
)

// TarotPetitAuBoutBonus is the bonus for petit au bout (1 trump wins last trick)
const TarotPetitAuBoutBonus = 10

// CalculateTarotScores computes the score delta for each player in a round
// Returns a map of player index (as string) to score delta
func CalculateTarotScores(
	takerIndex int,
	partnerIndex *int, // nil if no partner (3-4 player game)
	playerCount int,
	contract string,
	bouts int,
	takerPoints int,
	petitAuBout *string, // "taker" | "defense" | nil
	poignee int,         // 0, 10, 13, or 15
	chelem *string,      // "announced" | "achieved" | nil
) (scores map[string]int, won bool) {
	scores = make(map[string]int)

	// Calculate required points based on bouts
	required := TarotRequiredPoints[bouts]

	// Calculate difference
	diff := takerPoints - required
	won = diff >= 0

	// Base calculation: (|diff| rounded to nearest 10) + 25
	absDiff := diff
	if absDiff < 0 {
		absDiff = -absDiff
	}
	rounded := ((absDiff + 5) / 10) * 10
	base := rounded + 25

	// Apply contract multiplier
	multiplier := TarotContractMultipliers[contract]
	base *= multiplier

	// Calculate bonuses
	bonus := 0

	// Petit au bout: +10 × multiplier (negative if defense won it)
	if petitAuBout != nil {
		petitBonus := TarotPetitAuBoutBonus * multiplier
		if *petitAuBout == "defense" {
			petitBonus = -petitBonus
		}
		bonus += petitBonus
	}

	// Poignee: always positive for announcer
	if poignee > 0 {
		if poigneeBonus, ok := TarotPoigneeBonuses[poignee]; ok {
			bonus += poigneeBonus
		}
	}

	// Chelem (slam)
	if chelem != nil {
		if *chelem == "announced" {
			bonus += TarotChelemAnnounced
		} else if *chelem == "achieved" {
			bonus += TarotChelemAchieved
		}
	}

	// Per-defender score
	perDefender := base + bonus
	if !won {
		perDefender = -perDefender
	}

	// Calculate number of defenders
	defenderCount := playerCount - 1
	if partnerIndex != nil {
		defenderCount = playerCount - 2
	}

	// Taker score = perDefender × defenderCount
	takerScore := perDefender * defenderCount

	// Assign scores to each player
	for i := 0; i < playerCount; i++ {
		key := string(rune('0' + i)) // "0", "1", "2", etc.
		if i >= 10 {
			// Handle player index >= 10 (unlikely but safe)
			key = string(rune('0'+i/10)) + string(rune('0'+i%10))
		}

		if i == takerIndex {
			scores[key] = takerScore
		} else if partnerIndex != nil && i == *partnerIndex {
			// Partner gets same as taker (for 5-player with partner)
			scores[key] = perDefender
		} else {
			// Defenders lose what taker gains
			scores[key] = -perDefender
		}
	}

	return scores, won
}
