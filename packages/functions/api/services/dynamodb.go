package services

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// DynamoDBService handles game storage operations
type DynamoDBService struct {
	client    *dynamodb.Client
	tableName string
}

// Game represents a card game session
type Game struct {
	PK          string    `dynamodbav:"PK"`
	SK          string    `dynamodbav:"SK"`
	ID          string    `dynamodbav:"id" json:"id"`
	Type        string    `dynamodbav:"type" json:"type"`
	Status      string    `dynamodbav:"status" json:"status"`
	Teams       *Teams    `dynamodbav:"teams,omitempty" json:"teams,omitempty"`
	TargetScore int       `dynamodbav:"targetScore,omitempty" json:"targetScore,omitempty"`
	CreatedAt   string    `dynamodbav:"createdAt" json:"createdAt"`
	ExpiresAt   int64     `dynamodbav:"expiresAt" json:"-"`
}

// Teams holds team information for Belote games
type Teams struct {
	A TeamScore `dynamodbav:"a" json:"a"`
	B TeamScore `dynamodbav:"b" json:"b"`
}

// TeamScore holds name and score for a team
type TeamScore struct {
	Name  string `dynamodbav:"name" json:"name"`
	Score int    `dynamodbav:"score" json:"score"`
}

// Round represents a single round in a game
type Round struct {
	PK        string         `dynamodbav:"PK"`
	SK        string         `dynamodbav:"SK"`
	RoundNum  int            `dynamodbav:"roundNum" json:"roundNum"`
	Taker     string         `dynamodbav:"taker" json:"taker"`
	Trump     string         `dynamodbav:"trump" json:"trump"`
	Scores    map[string]int `dynamodbav:"scores" json:"scores"`
	Belote    bool           `dynamodbav:"belote" json:"belote"`
	Capot     bool           `dynamodbav:"capot" json:"capot"`
	CreatedAt string         `dynamodbav:"createdAt" json:"createdAt"`
}

// NewDynamoDBService creates a new DynamoDB service
func NewDynamoDBService(region, tableName string) (*DynamoDBService, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	return &DynamoDBService{
		client:    dynamodb.NewFromConfig(cfg),
		tableName: tableName,
	}, nil
}

// CreateGame creates a new game for a user
func (s *DynamoDBService) CreateGame(ctx context.Context, userID string, game *Game) error {
	// Set keys and TTL
	game.PK = fmt.Sprintf("USER#%s", userID)
	game.SK = fmt.Sprintf("GAME#%s#%s", game.Type, game.ID)
	game.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	game.ExpiresAt = time.Now().AddDate(0, 1, 0).Unix() // 1 month TTL

	item, err := attributevalue.MarshalMap(game)
	if err != nil {
		return fmt.Errorf("marshaling game: %w", err)
	}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &s.tableName,
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("putting game: %w", err)
	}

	return nil
}

// ListGames returns all games for a user, optionally filtered by type
// Results are sorted by createdAt descending (most recent first)
func (s *DynamoDBService) ListGames(ctx context.Context, userID, gameType string) ([]Game, error) {
	pk := fmt.Sprintf("USER#%s", userID)

	// Build SK prefix based on game type filter
	skPrefix := "GAME#"
	if gameType != "" {
		skPrefix = fmt.Sprintf("GAME#%s#", gameType)
	}

	result, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              &s.tableName,
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: pk},
			":sk": &types.AttributeValueMemberS{Value: skPrefix},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("querying games: %w", err)
	}

	games := make([]Game, 0, len(result.Items))
	for _, item := range result.Items {
		var game Game
		if err := attributevalue.UnmarshalMap(item, &game); err != nil {
			return nil, fmt.Errorf("unmarshaling game: %w", err)
		}
		games = append(games, game)
	}

	// Sort by createdAt descending (most recent first)
	sort.Slice(games, func(i, j int) bool {
		return games[i].CreatedAt > games[j].CreatedAt
	})

	return games, nil
}

// GetGame returns a game by ID with all its rounds
func (s *DynamoDBService) GetGame(ctx context.Context, userID, gameType, gameID string) (*Game, []Round, error) {
	// First get the game
	gamePK := fmt.Sprintf("USER#%s", userID)
	gameSK := fmt.Sprintf("GAME#%s#%s", gameType, gameID)

	gameResult, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &s.tableName,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: gamePK},
			"SK": &types.AttributeValueMemberS{Value: gameSK},
		},
	})
	if err != nil {
		return nil, nil, fmt.Errorf("getting game: %w", err)
	}
	if gameResult.Item == nil {
		return nil, nil, nil // Not found
	}

	var game Game
	if err := attributevalue.UnmarshalMap(gameResult.Item, &game); err != nil {
		return nil, nil, fmt.Errorf("unmarshaling game: %w", err)
	}

	// Then get all rounds
	roundPK := fmt.Sprintf("GAME#%s", gameID)
	roundResult, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              &s.tableName,
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: roundPK},
			":sk": &types.AttributeValueMemberS{Value: "ROUND#"},
		},
		ScanIndexForward: aws.Bool(true), // Oldest first (round order)
	})
	if err != nil {
		return nil, nil, fmt.Errorf("querying rounds: %w", err)
	}

	rounds := make([]Round, 0, len(roundResult.Items))
	for _, item := range roundResult.Items {
		var round Round
		if err := attributevalue.UnmarshalMap(item, &round); err != nil {
			return nil, nil, fmt.Errorf("unmarshaling round: %w", err)
		}
		rounds = append(rounds, round)
	}

	return &game, rounds, nil
}

// AddRound adds a new round to a game
func (s *DynamoDBService) AddRound(ctx context.Context, gameID string, round *Round) error {
	round.PK = fmt.Sprintf("GAME#%s", gameID)
	round.SK = fmt.Sprintf("ROUND#%03d", round.RoundNum) // Zero-padded for sort order
	round.CreatedAt = time.Now().UTC().Format(time.RFC3339)

	item, err := attributevalue.MarshalMap(round)
	if err != nil {
		return fmt.Errorf("marshaling round: %w", err)
	}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &s.tableName,
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("putting round: %w", err)
	}

	return nil
}

// DeleteRound removes a round from a game
func (s *DynamoDBService) DeleteRound(ctx context.Context, gameID string, roundNum int) error {
	pk := fmt.Sprintf("GAME#%s", gameID)
	sk := fmt.Sprintf("ROUND#%03d", roundNum)

	_, err := s.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: &s.tableName,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: pk},
			"SK": &types.AttributeValueMemberS{Value: sk},
		},
	})
	if err != nil {
		return fmt.Errorf("deleting round: %w", err)
	}

	return nil
}

// UpdateGame updates a game (e.g., status, scores)
func (s *DynamoDBService) UpdateGame(ctx context.Context, userID string, game *Game) error {
	game.PK = fmt.Sprintf("USER#%s", userID)
	game.SK = fmt.Sprintf("GAME#%s#%s", game.Type, game.ID)

	item, err := attributevalue.MarshalMap(game)
	if err != nil {
		return fmt.Errorf("marshaling game: %w", err)
	}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &s.tableName,
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("putting game: %w", err)
	}

	return nil
}

// DeleteGame deletes a game and all its rounds
func (s *DynamoDBService) DeleteGame(ctx context.Context, userID, gameType, gameID string) error {
	// First delete all rounds
	roundPK := fmt.Sprintf("GAME#%s", gameID)
	roundResult, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              &s.tableName,
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: roundPK},
			":sk": &types.AttributeValueMemberS{Value: "ROUND#"},
		},
	})
	if err != nil {
		return fmt.Errorf("querying rounds for deletion: %w", err)
	}

	// Batch delete rounds (if any)
	if len(roundResult.Items) > 0 {
		writeRequests := make([]types.WriteRequest, 0, len(roundResult.Items))
		for _, item := range roundResult.Items {
			writeRequests = append(writeRequests, types.WriteRequest{
				DeleteRequest: &types.DeleteRequest{
					Key: map[string]types.AttributeValue{
						"PK": item["PK"],
						"SK": item["SK"],
					},
				},
			})
		}

		_, err = s.client.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
			RequestItems: map[string][]types.WriteRequest{
				s.tableName: writeRequests,
			},
		})
		if err != nil {
			return fmt.Errorf("batch deleting rounds: %w", err)
		}
	}

	// Then delete the game itself
	gamePK := fmt.Sprintf("USER#%s", userID)
	gameSK := fmt.Sprintf("GAME#%s#%s", gameType, gameID)

	_, err = s.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: &s.tableName,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: gamePK},
			"SK": &types.AttributeValueMemberS{Value: gameSK},
		},
	})
	if err != nil {
		return fmt.Errorf("deleting game: %w", err)
	}

	return nil
}
