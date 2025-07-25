import type { ResourcesConfig } from 'aws-amplify';

const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-northeast-1_LuvUmWDZ4',
      userPoolClientId: '1io057uu2e3jobtl0rsggpc3js',
      loginWith: {
        oauth: {
          domain: 'ap-northeast-1luvumwdz4.auth.ap-northeast-1.amazoncognito.com',
          scopes: ['openid', 'email', 'phone'],
          redirectSignIn: ['http://localhost:5173'],
          redirectSignOut: ['http://localhost:5173'],
          responseType: 'code'
        }
      }
    }
  }
};

export default amplifyConfig;