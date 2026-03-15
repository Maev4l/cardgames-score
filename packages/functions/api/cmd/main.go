package main

import (
	"context"
	"os"

	"cardgames-score.isnan.eu/functions/api/handlers"
	"cardgames-score.isnan.eu/functions/api/middleware"
	"cardgames-score.isnan.eu/functions/api/services"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

var ginLambda *ginadapter.GinLambdaV2

func init() {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())

	// Get config from environment
	region := os.Getenv("REGION")
	if region == "" {
		region = "eu-central-1"
	}
	gamesTable := os.Getenv("GAMES_TABLE")
	if gamesTable == "" {
		gamesTable = "atout-games"
	}

	// Initialize services
	bedrock, err := services.NewBedrockService(region)
	if err != nil {
		log.Fatal().Msgf("Failed to initialize Bedrock service: %s", err.Error())
	}

	dynamodb, err := services.NewDynamoDBService(region, gamesTable)
	if err != nil {
		log.Fatal().Msgf("Failed to initialize DynamoDB service: %s", err.Error())
	}

	// Initialize handlers
	h := handlers.NewHTTPHandler(bedrock)
	g := handlers.NewGamesHandler(dynamodb)

	// Public routes (still require JWT auth via API Gateway)
	router.POST("/api/detections", h.RequestDetection)

	// Protected routes (require group membership)
	protected := router.Group("/api")
	protected.Use(middleware.RequireApproval)
	{
		protected.POST("/games", g.CreateGame)
		protected.GET("/games", g.ListGames)
		protected.GET("/games/:id", g.GetGame)
		protected.DELETE("/games/:id", g.DeleteGame)
		protected.POST("/games/:id/rounds", g.AddRound)
		protected.DELETE("/games/:id/rounds/:num", g.DeleteRound)
		protected.PATCH("/games/:id", g.UpdateGame)
	}

	ginLambda = ginadapter.NewV2(router)
}

func handler(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	return ginLambda.ProxyWithContext(ctx, req)
}

func main() {
	lambda.Start(handler)
}
