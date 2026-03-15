import { fetchAuthSession } from 'aws-amplify/auth';

// Dev: use Vite proxy (relative paths), Prod: use CloudFront URL (same domain)
const isDev = window.location.hostname === 'localhost';
const baseUrl = isDev ? '' : 'https://atout.isnan.eu';

/**
 * Get the current auth token for API requests
 */
const getAuthToken = async () => {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() || '';
};

/**
 * Make an authenticated API request
 */
const apiRequest = async (path, options = {}) => {
  const token = await getAuthToken();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

// === Games API ===

/**
 * Create a new game
 * @param {Object} data - Game data { type: 'belote'|'tarot', teams?, targetScore? }
 */
export const createGame = async (data) => {
  return apiRequest('/api/games', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * List all games for the current user
 * @param {string} type - Optional filter by game type ('belote' or 'tarot')
 */
export const listGames = async (type = '') => {
  const params = type ? `?type=${type}` : '';
  return apiRequest(`/api/games${params}`);
};

/**
 * Get a specific game with all its rounds
 * @param {string} id - Game ID
 * @param {string} type - Game type (defaults to 'belote')
 */
export const getGame = async (id, type = 'belote') => {
  return apiRequest(`/api/games/${id}?type=${type}`);
};

/**
 * Add a round to a game
 * @param {string} gameId - Game ID
 * @param {Object} round - Round data { taker, trump, scores, belote?, capot? }
 * @param {string} type - Game type (defaults to 'belote')
 */
export const addRound = async (gameId, round, type = 'belote') => {
  return apiRequest(`/api/games/${gameId}/rounds?type=${type}`, {
    method: 'POST',
    body: JSON.stringify(round),
  });
};

/**
 * Delete a round from a game (undo)
 * @param {string} gameId - Game ID
 * @param {number} roundNum - Round number
 * @param {string} type - Game type (defaults to 'belote')
 */
export const deleteRound = async (gameId, roundNum, type = 'belote') => {
  return apiRequest(`/api/games/${gameId}/rounds/${roundNum}?type=${type}`, {
    method: 'DELETE',
  });
};

/**
 * Update a game (e.g., finish it)
 * @param {string} gameId - Game ID
 * @param {Object} data - Update data { status?, teams? }
 * @param {string} type - Game type (defaults to 'belote')
 */
export const updateGame = async (gameId, data, type = 'belote') => {
  return apiRequest(`/api/games/${gameId}?type=${type}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

/**
 * Delete a game and all its rounds
 * @param {string} gameId - Game ID
 * @param {string} type - Game type (defaults to 'belote')
 */
export const deleteGame = async (gameId, type = 'belote') => {
  return apiRequest(`/api/games/${gameId}?type=${type}`, {
    method: 'DELETE',
  });
};

// === Detection API ===

/**
 * Detect cards from one or more images
 * @param {Array<{image: string, mediaType: string}>} images - Array of base64-encoded images with MIME types
 * @returns {Promise<{cards: Array<{rank: string, suit: string}>}>} Deduplicated detected cards
 */
export const detectCards = async (images) => {
  return apiRequest('/api/detections', {
    method: 'POST',
    body: JSON.stringify({ images }),
  });
};

/**
 * Detect cards from a single image (legacy helper)
 * @param {string} imageBase64 - Base64-encoded image data
 * @param {string} mediaType - MIME type (e.g., 'image/jpeg')
 */
export const detectCardsSingle = async (imageBase64, mediaType) => {
  return detectCards([{ image: imageBase64, mediaType }]);
};
