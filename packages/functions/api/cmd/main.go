package main

import (
	"os"

	"cardgames-score.isnan.eu/functions/api/handlers"
	"cardgames-score.isnan.eu/functions/api/middleware"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

func main() {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())

	region := os.Getenv("REGION")
	if region == "" {
		region = "eu-central-1"
	}
	gamesTable := os.Getenv("GAMES_TABLE")
	if gamesTable == "" {
		gamesTable = "atout-games"
	}

	bedrockSvc, err := services.NewBedrockService(region, os.Getenv("BEDROCK_MODEL"))
	if err != nil {
		log.Fatal().Msgf("Failed to initialize Bedrock service: %s", err.Error())
	}
	dynamoSvc, err := services.NewDynamoDBService(region, gamesTable)
	if err != nil {
		log.Fatal().Msgf("Failed to initialize DynamoDB service: %s", err.Error())
	}

	h := handlers.NewHTTPHandler(bedrockSvc)
	g := handlers.NewGamesHandler(dynamoSvc)

	// TokenParser must register before RequireApproval — RequireApproval
	// reads the tokenInfo TokenParser stored in the gin context.
	api := router.Group("/api")
	api.Use(middleware.TokenParser())
	api.Use(middleware.RequireApproval())
	{
		api.POST("/detections", h.RequestDetection)

		api.POST("/games", g.CreateGame)
		api.GET("/games", g.ListGames)
		api.GET("/games/:id", g.GetGame)
		api.DELETE("/games/:id", g.DeleteGame)
		api.POST("/games/:id/rounds", g.AddRound)
		api.DELETE("/games/:id/rounds/:num", g.DeleteRound)
		api.PATCH("/games/:id", g.UpdateGame)
	}

	// LWA forwards Lambda events to this port on 127.0.0.1.
	// Locally (no LWA) the same default lets `go run ./api/cmd` work.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	_ = router.Run(":" + port)
}
