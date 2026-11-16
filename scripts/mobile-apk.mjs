// Local Android preview build. Store releases are signed separately by EAS.
import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  mobile = resolve(root, "apps/mobile");
const local = process.argv.slice(2).includes("--local");
if (process.argv.slice(2).some((arg) => arg !== "--local"))
  throw new Error("Usage: npm run mobile:apk -- [--local]");
const env = {
  ...process.env,
  EXPO_NO_DOTENV: "1",
  EAS_BUILD_PROFILE: local ? "preview-local" : "preview",
  EXPO_PUBLIC_ALLOW_LOCAL_HTTP: local ? "true" : "false",
};
if (local) env.EXPO_PUBLIC_API_URL ||= "http://localhost:3000";
const require = createRequire(resolve(mobile, "package.json"));
const expo = resolve(dirname(require.resolve("expo/package.json")), "bin/cli");
function run(command, args, cwd) {
  return new Promise((done, fail) => {
    const process = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    process.on("error", fail);
    process.on("exit", (code) =>
      code === 0 ? done() : fail(new Error("Android build exited " + code)),
    );
  });
}
await run(
  process.execPath,
  [expo, "prebuild", "--platform", "android", "--no-install"],
  mobile,
);
const gradleArgs = [
  ":app:assembleRelease",
  "-PreactNativeArchitectures=arm64-v8a,x86_64",
  "--no-daemon",
  "--max-workers=4",
];
if (process.platform === "win32")
  await run(
    "cmd.exe",
    ["/d", "/s", "/c", "gradlew.bat " + gradleArgs.join(" ")],
    resolve(mobile, "android"),
  );
else await run("./gradlew", gradleArgs, resolve(mobile, "android"));
const target = resolve(root, ".runtime/mobile-builds");
await mkdir(target, { recursive: true });
const filename = local
  ? "CryptoSight-AI-local.apk"
  : "CryptoSight-AI-preview.apk";
await copyFile(
  resolve(mobile, "android/app/build/outputs/apk/release/app-release.apk"),
  resolve(target, filename),
);
console.log("Preview APK: " + resolve(target, filename));
console.log(
  "Signed with the generated development key. Use EAS production signing for Play Store.",
);
