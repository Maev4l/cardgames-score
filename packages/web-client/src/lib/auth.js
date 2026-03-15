import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
} from 'aws-amplify/auth';

/**
 * Sign in with email and password
 */
export const signIn = async (email, password) => {
  const result = await amplifySignIn({
    username: email,
    password,
  });
  return result;
};

/**
 * Sign up with email and password
 */
export const signUp = async (email, password, displayName) => {
  const result = await amplifySignUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        ...(displayName && { name: displayName }),
      },
    },
  });
  return result;
};

/**
 * Sign in with Google (redirects to Cognito hosted UI)
 */
export const signInWithGoogle = () => {
  return signInWithRedirect({ provider: 'Google' });
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
  await amplifySignOut();
};

/**
 * Get the current authenticated user
 */
export const getCurrentUser = async () => {
  try {
    const user = await amplifyGetCurrentUser();
    return user;
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  try {
    const session = await fetchAuthSession();
    return !!session.tokens;
  } catch {
    return false;
  }
};
