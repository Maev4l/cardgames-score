package handlers

import (
	"net/http"
	"strconv"

	"cardgames-score.isnan.eu/functions/api/middleware"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// GamesHandler handles game-related HTTP requests
type GamesHandler struct {
	db *services.DynamoDBService
}

// NewGamesHandler creates a new games handler
func NewGamesHandler(db *services.DynamoDBService) *GamesHandler {
	return &GamesHandler{db: db}
}

// CreateGameRequest is the request body for creating a game
type CreateGameRequest struct {
	Type        string              `json:"type" binding:"required,oneof=belote tarot"`
	Teams       *services.Teams     `json:"teams,omitempty"`
	TargetScore int                 `json:"targetScore,omitempty"`
}

// CreateGame handles POST /api/games
func (h *GamesHandler) CreateGame(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	var req CreateGameRequest
	if err := c.BindJSON(&req); err != nil {
		log.Error().Msgf("Invalid request: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request. Required: type (belote or tarot)",
		})
		return
	}

	game := &services.Game{
		ID:          uuid.New().String(),
		Type:        req.Type,
		Status:      "active",
		Teams:       req.Teams,
		TargetScore: req.TargetScore,
	}

	// Default target score for Belote
	if req.Type == "belote" && game.TargetScore == 0 {
		game.TargetScore = 1000
	}

	if err := h.db.CreateGame(c.Request.Context(), userID, game); err != nil {
		log.Error().Msgf("Failed to create game: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to create game",
		})
		return
	}

	c.JSON(http.StatusCreated, game)
}

// ListGames handles GET /api/games
func (h *GamesHandler) ListGames(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	// Optional filter by game type
	gameType := c.Query("type")

	games, err := h.db.ListGames(c.Request.Context(), userID, gameType)
	if err != nil {
		log.Error().Msgf("Failed to list games: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to list games",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"games": games})
}

// GetGame handles GET /api/games/:id
func (h *GamesHandler) GetGame(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")
	gameType := c.Query("type")
	if gameType == "" {
		gameType = "belote" // Default to belote
	}

	game, rounds, err := h.db.GetGame(c.Request.Context(), userID, gameType, gameID)
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

	c.JSON(http.StatusOK, gin.H{
		"game":   game,
		"rounds": rounds,
	})
}

// AddRoundRequest is the request body for adding a round
type AddRoundRequest struct {
	Taker  string         `json:"taker" binding:"required,oneof=A B"`
	Trump  string         `json:"trump" binding:"required,oneof=hearts diamonds clubs spades"`
	Scores map[string]int `json:"scores" binding:"required"`
	Belote bool           `json:"belote"`
	Capot  bool           `json:"capot"`
}

// AddRound handles POST /api/games/:id/rounds
func (h *GamesHandler) AddRound(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")
	gameType := c.Query("type")
	if gameType == "" {
		gameType = "belote"
	}

	var req AddRoundRequest
	if err := c.BindJSON(&req); err != nil {
		log.Error().Msgf("Invalid request: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request. Required: taker (A/B), trump, scores",
		})
		return
	}

	// Get game to validate it exists and get current round count
	game, rounds, err := h.db.GetGame(c.Request.Context(), userID, gameType, gameID)
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

		// Check if game is finished
		if game.Teams.A.Score >= game.TargetScore || game.Teams.B.Score >= game.TargetScore {
			game.Status = "finished"
		}

		if err := h.db.UpdateGame(c.Request.Context(), userID, game); err != nil {
			log.Error().Msgf("Failed to update game scores: %s", err.Error())
		}
	}

	c.JSON(http.StatusCreated, round)
}

// DeleteRound handles DELETE /api/games/:id/rounds/:num
func (h *GamesHandler) DeleteRound(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")
	roundNumStr := c.Param("num")
	gameType := c.Query("type")
	if gameType == "" {
		gameType = "belote"
	}

	roundNum, err := strconv.Atoi(roundNumStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid round number"})
		return
	}

	// Verify game ownership before deleting round
	game, _, err := h.db.GetGame(c.Request.Context(), userID, gameType, gameID)
	if err != nil {
		log.Error().Msgf("Failed to get game: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to verify game ownership",
		})
		return
	}
	if game == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Game not found"})
		return
	}

	if err := h.db.DeleteRound(c.Request.Context(), gameID, roundNum); err != nil {
		log.Error().Msgf("Failed to delete round: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to delete round",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Round deleted"})
}

// DeleteGame handles DELETE /api/games/:id
func (h *GamesHandler) DeleteGame(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")
	gameType := c.Query("type")
	if gameType == "" {
		gameType = "belote"
	}

	// Verify game exists and belongs to user
	game, _, err := h.db.GetGame(c.Request.Context(), userID, gameType, gameID)
	if err != nil {
		log.Error().Msgf("Failed to get game: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to verify game ownership",
		})
		return
	}
	if game == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Game not found"})
		return
	}

	if err := h.db.DeleteGame(c.Request.Context(), userID, gameType, gameID); err != nil {
		log.Error().Msgf("Failed to delete game: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to delete game",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Game deleted"})
}

// UpdateGameRequest is the request body for updating a game
type UpdateGameRequest struct {
	Status string          `json:"status,omitempty"`
	Teams  *services.Teams `json:"teams,omitempty"`
}

// UpdateGame handles PATCH /api/games/:id
func (h *GamesHandler) UpdateGame(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User not authenticated"})
		return
	}

	gameID := c.Param("id")
	gameType := c.Query("type")
	if gameType == "" {
		gameType = "belote"
	}

	var req UpdateGameRequest
	if err := c.BindJSON(&req); err != nil {
		log.Error().Msgf("Invalid request: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request",
		})
		return
	}

	// Get existing game
	game, _, err := h.db.GetGame(c.Request.Context(), userID, gameType, gameID)
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

	// Apply updates
	if req.Status != "" {
		game.Status = req.Status
	}
	if req.Teams != nil {
		game.Teams = req.Teams
	}

	if err := h.db.UpdateGame(c.Request.Context(), userID, game); err != nil {
		log.Error().Msgf("Failed to update game: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to update game",
		})
		return
	}

	c.JSON(http.StatusOK, game)
}
