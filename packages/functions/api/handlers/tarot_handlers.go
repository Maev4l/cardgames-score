package handlers

import (
	"net/http"
	"strconv"

	"cardgames-score.isnan.eu/functions/api/middleware"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// AddTarotRoundRequest is the request body for adding a Tarot round
// Note: int fields don't use "required" since 0 is a valid value
type AddTarotRoundRequest struct {
	Taker       int     `json:"taker" binding:"min=0,max=4"`                                           // Player index (0-4)
	Partner     *int    `json:"partner,omitempty"`                                                     // Partner index for 5-player
	Contract    string  `json:"contract" binding:"required,oneof=petite garde garde_sans garde_contre"` // Contract type
	Bouts       int     `json:"bouts" binding:"min=0,max=3"`                                           // Number of bouts (oudlers)
	TakerPoints int     `json:"takerPoints" binding:"min=0,max=91"`                                    // Points won by taker
	PetitAuBout *string `json:"petitAuBout,omitempty" binding:"omitempty,oneof=taker defense"`         // Who won petit au bout
	Poignee     int     `json:"poignee,omitempty" binding:"omitempty,oneof=0 10 13 15"`                // Trumps shown for poignee
	Chelem      *string `json:"chelem,omitempty" binding:"omitempty,oneof=announced achieved"`         // Slam bonus
}

// AddTarotRound handles POST /api/games/:id/rounds for Tarot games
func (h *GamesHandler) AddTarotRound(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")

	var req AddTarotRoundRequest
	if err := c.BindJSON(&req); err != nil {
		log.Error().Msgf("Invalid tarot round request: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request. Required: taker, contract, bouts, takerPoints",
		})
		return
	}

	// Get game to validate it exists and get current round count
	game, rounds, err := h.db.GetTarotGame(c.Request.Context(), userID, gameID)
	if err != nil {
		log.Error().Msgf("Failed to get tarot game: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to get game",
		})
		return
	}
	if game == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Game not found"})
		return
	}

	// Reject if game is already finished
	if game.Status == "finished" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Cannot add round to a finished game"})
		return
	}

	// Validate taker index is within player count
	if req.Taker >= game.PlayerCount {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid taker index"})
		return
	}

	// Validate partner if provided (5-player only)
	if req.Partner != nil {
		if game.PlayerCount != 5 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Partner only valid for 5-player games"})
			return
		}
		if *req.Partner >= game.PlayerCount || *req.Partner == req.Taker {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid partner index"})
			return
		}
	}

	// Calculate scores using tarot scoring logic
	scores, won := CalculateTarotScores(
		req.Taker,
		req.Partner,
		game.PlayerCount,
		req.Contract,
		req.Bouts,
		req.TakerPoints,
		req.PetitAuBout,
		req.Poignee,
		req.Chelem,
	)

	round := &services.TarotRound{
		RoundNum:    len(rounds) + 1,
		Taker:       req.Taker,
		Partner:     req.Partner,
		Contract:    req.Contract,
		Bouts:       req.Bouts,
		TakerPoints: req.TakerPoints,
		Won:         won,
		PetitAuBout: req.PetitAuBout,
		Poignee:     req.Poignee,
		Chelem:      req.Chelem,
		Scores:      scores,
	}

	if err := h.db.AddTarotRound(c.Request.Context(), gameID, round); err != nil {
		log.Error().Msgf("Failed to add tarot round: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to add round",
		})
		return
	}

	// Update player scores
	for i := 0; i < game.PlayerCount; i++ {
		key := strconv.Itoa(i)
		if delta, ok := scores[key]; ok {
			game.Players[i].Score += delta
		}
	}

	if err := h.db.UpdateTarotGame(c.Request.Context(), userID, game); err != nil {
		log.Error().Msgf("Failed to update tarot game scores: %s", err.Error())
	}

	c.JSON(http.StatusCreated, round)
}
