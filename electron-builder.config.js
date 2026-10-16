const path = require("node:path");

module.exports = {
  appId: "com.veejaliu.jidian",
  productName: "基点",
  directories: {
    output: process.env.JIDIAN_DESKTOP_OUTPUT || "release",
    buildResources: "build",
  },
  files: [
    "dist/**/*",
    "build/server/**/*",
    "database/schema.sql",
    "electron/**/*",
    "package.json",
    "package-lock.json",
    "LICENSE",
    "!**/.env*",
    "!**/*.sqlite*",
    "!**/*.db",
    "!**/jidian-backup-*.json",
    "!**/.DS_Store",
    "!server/**/*.test.*",
    "!**/node_modules/better-sqlite3/build/Release/test_extension.node",
  ],
  extraMetadata: {
    main: "electron/main.js",
  },
  asarUnpack: [
    "build/server/**/*",
    "database/schema.sql",
    "node_modules/better-sqlite3/**/*",
    "!node_modules/better-sqlite3/build/Release/test_extension.node",
  ],
  mac: {
    minimumSystemVersion: "13.0.0",
    category: "public.app-category.finance",
    target: ["dmg", "zip"],
    artifactName: "jidian-${version}-macos-${arch}.${ext}",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    icon: path.join("build", "icon.icns"),
    // Keep the Chinese display name while making the app discoverable as "jidian" in Spotlight.
    extendInfo: {
      // Electron derives Helper app names from CFBundleName, so this must match productName.
      CFBundleName: "基点",
      CFBundleDisplayName: "基点",
      CFBundleSpokenName: "jidian",
    },
  },
  dmg: {
    sign: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
  win: {
    target: ["nsis"],
    artifactName: "${productName}-${version}-${arch}.${ext}",
    icon: path.join("build", "icon.ico"),
  },
  afterSign: "electron/notarize.js",
};
