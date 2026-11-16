import type { ExpoConfig } from "expo/config";

const profile = process.env.EAS_BUILD_PROFILE || "development";
const localHttp = process.env.EXPO_PUBLIC_ALLOW_LOCAL_HTTP === "true";
if (profile === "production" && localHttp)
  throw new Error("Production builds require HTTPS");
const config: ExpoConfig = {
  name: "CryptoSight AI",
  slug: "cryptosight-ai-mobile",
  version: "1.0.0",
  scheme: "cryptosightai",
  platforms: ["ios", "android"],
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  backgroundColor: "#080d14",
  ios: {
    bundleIdentifier: "com.ghostelapp.cryptosightai",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(localHttp
        ? {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: true,
              NSAllowsLocalNetworking: true,
            },
          }
        : {}),
    },
  },
  android: {
    package: "com.ghostelapp.cryptosightai",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#080d14",
    },
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    "./plugins/with-windows-native-build.js",
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-sharing",
    [
      "expo-local-authentication",
      {
        faceIDPermission: "Use Face ID to unlock your CryptoSight AI session.",
      },
    ],
    ["expo-build-properties", { android: { usesCleartextTraffic: localHttp } }],
  ],
  ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ? { extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } }
    : {}),
};
export default config;
