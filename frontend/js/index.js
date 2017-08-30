'use strict';

const COGNITO_APP_ID = '5n1bo1i9pkgngofpkeskcv9et3';
const COGNITO_AUTH_URL = 'https://xero-webhooks-sample-app.auth.us-east-1.amazoncognito.com';
const CLOUDFRONT_URL = 'https://d1kyjbvgsd1y6g.cloudfront.net';
const API_GW_URL = 'https://7wthc1c794.execute-api.us-east-1.amazonaws.com/latest';

function login() {
  sessionStorage.clear();
  location.href = COGNITO_AUTH_URL + "/login?client_id=" + COGNITO_APP_ID + "&redirect_uri=" + CLOUDFRONT_URL + "/dashboard.html&scope=openid&response_type=token";
}