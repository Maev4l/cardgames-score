package handlers

import (
	"net/http"

	"cardgames-score.isnan.eu/functions/api/middleware"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// AddBeloteRoundRequest is the request body for adding a Belote round
type AddBeloteRoundRequest struct {
	Taker  string         `json:"taker" binding:"required,oneof=A B"`
	Trump  string         `json:"trump" binding:"required,oneof=hearts diamonds clubs spades"`
	Scores map[string]int `json:"scores" binding:"required"`
	Belote bool           `json:"belote"`
	Capot  bool           `json:"capot"`
}

// AddBeloteRound handles POST /api/games/:id/rounds for Belote games
func (h *GamesHandler) AddBeloteRound(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")

	var req AddBeloteRoundRequest
	if err := c.BindJSON(&req); err != nil {
		log.Error().Msgf("Invalid request: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request. Required: taker (A/B), trump, scores",
		})
		return
	}

	// Get game to validate it exists and get current round count
	game, rounds, err := h.db.GetGame(c.Request.Context(), userID, "belote", gameID)
	if err != nil {
		log.Error().Msgf("Failed to get game: %s", err.Error())
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

	round := &services.Round{
		RoundNum: len(rounds) + 1,
		Taker:    req.Taker,
		Trump:    req.Trump,
		Scores:   req.Scores,
		Belote:   req.Belote,
		Capot:    req.Capot,
	}

	if err := h.db.AddRound(c.Request.Context(), gameID, round); err != nil {
		log.Error().Msgf("Failed to add round: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to add round",
		})
		return
	}

	// Update game scores
	if game.Teams != nil {
		game.Teams.A.Score += req.Scores["A"]
		game.Teams.B.Score += req.Scores["B"]

		// Check if game is finished (target score reached)
		if game.Teams.A.Score >= game.TargetScore || game.Teams.B.Score >= game.TargetScore {
			game.Status = "finished"
		}

		if err := h.db.UpdateGame(c.Request.Context(), userID, game); err != nil {
			log.Error().Msgf("Failed to update game scores: %s", err.Error())
		}
	}

	c.JSON(http.StatusCreated, round)
}
