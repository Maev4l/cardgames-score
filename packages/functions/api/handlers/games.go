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
	// Belote-specific fields
	Teams       *services.Teams     `json:"teams,omitempty"`
	TargetScore int                 `json:"targetScore,omitempty"`
	// Tarot-specific fields
	Players     []string            `json:"players,omitempty"`     // Player names
	PlayerCount int                 `json:"playerCount,omitempty"` // 3, 4, or 5
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
		ID:     uuid.New().String(),
		Type:   req.Type,
		Status: "active",
	}

	// Initialize game-specific fields
	if req.Type == "belote" {
		game.Teams = req.Teams
		game.TargetScore = req.TargetScore
		// Default target score for Belote
		if game.TargetScore == 0 {
			game.TargetScore = 1000
		}
	} else if req.Type == "tarot" {
		// Validate player count
		playerCount := req.PlayerCount
		if playerCount < 3 || playerCount > 5 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Invalid playerCount. Must be 3, 4, or 5",
			})
			return
		}

		// Initialize players with names (or defaults)
		players := make([]services.TarotPlayer, playerCount)
		for i := 0; i < playerCount; i++ {
			name := ""
			if i < len(req.Players) {
				name = req.Players[i]
			}
			if name == "" {
				name = "Joueur " + strconv.Itoa(i+1)
			}
			players[i] = services.TarotPlayer{Name: name, Score: 0}
		}
		game.Players = players
		game.PlayerCount = playerCount
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

	// Route to game-type-specific getter (different round struct types)
	if gameType == "tarot" {
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
		c.JSON(http.StatusOK, gin.H{
			"game":   game,
			"rounds": rounds,
		})
		return
	}

	// Belote (default)
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

// AddRound handles POST /api/games/:id/rounds
// Routes to game-specific handler based on type query param
func (h *GamesHandler) AddRound(c *gin.Context) {
	gameType := c.Query("type")
	if gameType == "" {
		gameType = "belote"
	}

	// Route to game-specific handler
	switch gameType {
	case "tarot":
		h.AddTarotRound(c)
	default:
		h.AddBeloteRound(c)
	}
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
