package middleware

import (
	"net/http"
	"strings"

	"github.com/awslabs/aws-lambda-go-api-proxy/core"
	"github.com/gin-gonic/gin"
)

const (
	// UserIDKey is the context key for storing the authenticated user ID
	UserIDKey = "userId"
	// RequiredGroup is the Cognito group required for API access
	RequiredGroup = "cardgames-score"
)

// RequireApproval middleware checks that the user belongs to the approved group
// User claims are extracted from API Gateway Lambda authorizer context
func RequireApproval(c *gin.Context) {
	// Get the Lambda request context from the request's context
	reqCtx, ok := core.GetAPIGatewayV2ContextFromContext(c.Request.Context())
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"message": "Missing authorization context",
		})
		return
	}

	// Extract user ID from JWT claims (sub claim)
	userID := reqCtx.Authorizer.JWT.Claims["sub"]
	if userID == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"message": "Missing user ID in token",
		})
		return
	}

	// Check cognito:groups claim for required group membership
	groups := reqCtx.Authorizer.JWT.Claims["cognito:groups"]
	if !containsGroup(groups, RequiredGroup) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"message": "User not approved for this application",
		})
		return
	}

	// Store user ID in context for handlers
	c.Set(UserIDKey, userID)
	c.Next()
}

// containsGroup checks if the groups claim contains the required group
// Groups claim can be a string (single group) or array format
func containsGroup(groups, required string) bool {
	if groups == "" {
		return false
	}

	// Handle both single group and array format from JWT
	// Array format: "[group1, group2]" or "group1 group2"
	groups = strings.Trim(groups, "[]")
	for _, g := range strings.Split(groups, " ") {
		g = strings.Trim(g, ", ")
		if g == required {
			return true
		}
	}

	return groups == required
}

// GetUserID retrieves the authenticated user ID from the Gin context
func GetUserID(c *gin.Context) string {
	userID, _ := c.Get(UserIDKey)
	if id, ok := userID.(string); ok {
		return id
	}
	return ""
}
