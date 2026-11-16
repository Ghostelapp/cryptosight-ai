const { withProjectBuildGradle } = require("expo/config-plugins");

// Keep Windows-specific compiler workarounds in CNG, not in generated files or
// node_modules. Short compiler filenames lose clang++'s C++ driver inference;
// deep absolute object filenames also exceed Ninja's Windows path limit.
const block = `
// @generated begin cryptosight-native-build
if (System.getProperty("os.name").toLowerCase().contains("windows")) {
    subprojects { nativeProject ->
        ["com.android.application", "com.android.library"].each { pluginId ->
            nativeProject.plugins.withId(pluginId) {
                nativeProject.extensions.getByName("androidComponents").finalizeDsl { androidDsl ->
                    if (nativeProject.path == ":app") {
                        def stagingKey = Integer.toHexString(rootProject.projectDir.absolutePath.hashCode())
                        androidDsl.externalNativeBuild.cmake.buildStagingDirectory = new File(System.getProperty("java.io.tmpdir"), "cs/" + stagingKey)
                    }
                    def cmake = androidDsl.defaultConfig.externalNativeBuild.cmake
                    def args = cmake.arguments
                    args.removeAll { it.startsWith("-DCMAKE_OBJECT_PATH_MAX=") || it.startsWith("-DCMAKE_CXX_COMPILER_ARG1=") }
                    args.add("-DCMAKE_OBJECT_PATH_MAX=240")
                    cmake.cppFlags.removeAll { it == "--driver-mode=g++" }
                    cmake.cppFlags.add("--driver-mode=g++")
                }
            }
        }
    }
}
// @generated end cryptosight-native-build
`;
module.exports = (config) =>
  withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy")
      throw new Error("Expected Expo's Groovy Android project");
    const contents = mod.modResults.contents
      .replace(
        /\n\/\/ CryptoSight: compact CMake object paths\nsubprojects \{[\s\S]*?\n\}\n?/g,
        "\n",
      )
      .replace(
        /\n\/\/ @generated begin cryptosight-native-build[\s\S]*?\/\/ @generated end cryptosight-native-build\n?/g,
        "\n",
      )
      .trimEnd();
    const anchor = /apply plugin:\s*["']expo-root-project["']/;
    if (!anchor.test(contents))
      throw new Error("Missing Expo root-project plugin anchor");
    // React's root plugin eagerly evaluates :app; register DSL callbacks first.
    mod.modResults.contents =
      contents.replace(anchor, (match) => block + "\n" + match) + "\n";
    return mod;
  });
