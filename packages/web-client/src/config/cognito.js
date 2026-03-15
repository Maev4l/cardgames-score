// AWS Amplify Auth configuration for Cognito
import output from '../../output.json';

const isDev = window.location.hostname === 'localhost';
const redirectUrl = isDev ? 'http://localhost:5176/' : 'https://atout.isnan.eu/';
const logoutUrl = isDev ? 'http://localhost:5176/login' : 'https://atout.isnan.eu/login';

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: output.cognito_user_pool_id?.value || '',
      userPoolClientId: output.cognito_client_id?.value || '',
      loginWith: {
        oauth: {
          domain: 'platform-idp-auth.isnan.eu',
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [redirectUrl],
          redirectSignOut: [logoutUrl],
          responseType: 'code',
          providers: ['Google'],
        },
      },
    },
  },
};

export const apiEndpoint = output.api_endpoint?.value || '';
export const region = output.region?.value || '';
