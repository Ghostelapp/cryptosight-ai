const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// The Next.js workspace has its own React patch version. Every native dependency
// must resolve to the React version paired with this Expo SDK's native renderer.
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === "react" || name.startsWith("react/")) {
    return {
      type: "sourceFile",
      filePath: require.resolve(name, { paths: [__dirname] }),
    };
  }
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
