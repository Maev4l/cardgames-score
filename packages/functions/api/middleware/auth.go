package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/jwt"
)

const (
	UserIDKey     = "userId"
	tokenInfoKey  = "tokenInfo"
	RequiredGroup = "cardgames-score"
)

type tokenInfo struct {
	userID string
	groups string
}

// API Gateway has already validated the JWT signature/expiry upstream; this
// only decodes claims. TokenParser must register before RequireApproval —
// RequireApproval calls MustGet(tokenInfoKey).
func TokenParser() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.Request.Header.Get("Authorization")
		if strings.HasPrefix(raw, "Bearer ") {
			raw = raw[7:]
		}

		var info tokenInfo
		if tok, err := jwt.Parse([]byte(raw)); err == nil && tok != nil {
			if sub, ok := tok.Get("sub"); ok {
				info.userID = fmt.Sprintf("%v", sub)
			}
			if g, ok := tok.Get("cognito:groups"); ok {
				info.groups = fmt.Sprintf("%v", g)
			}
		}
		c.Set(tokenInfoKey, &info)
		c.Next()
	}
}

func RequireApproval() gin.HandlerFunc {
	return func(c *gin.Context) {
		t, ok := c.MustGet(tokenInfoKey).(*tokenInfo)
		if !ok || t.userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Missing user ID in token"})
			return
		}
		if !containsGroup(t.groups, RequiredGroup) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "User not approved for this application"})
			return
		}
		c.Set(UserIDKey, t.userID)
		c.Next()
	}
}

// Cognito serializes the groups claim either as a single string or as a
// bracketed space-separated list, e.g. "[group1 group2]". Handle both.
func containsGroup(groups, required string) bool {
	if groups == "" {
		return false
	}
	groups = strings.Trim(groups, "[]")
	for _, g := range strings.Split(groups, " ") {
		if strings.Trim(g, ", ") == required {
			return true
		}
	}
	return groups == required
}

func GetUserID(c *gin.Context) string {
	if v, ok := c.Get(UserIDKey); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}
