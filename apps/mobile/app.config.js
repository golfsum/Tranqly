const staticConfig = require("./app.json").expo;

function env(primary, fallback) {
  return process.env[primary] || (fallback ? process.env[fallback] : "") || "";
}

module.exports = {
  ...staticConfig,
  extra: {
    ...staticConfig.extra,
    apiBaseUrl: env("EXPO_PUBLIC_API_BASE_URL"),
    firebaseApiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"),
    firebaseProjectId: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    firebaseAuthDomain: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    googleIosClientId: env("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"),
    googleWebClientId: env("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
    eas: staticConfig.extra?.eas,
  },
};
