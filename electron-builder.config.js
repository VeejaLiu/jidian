const path = require("node:path");

module.exports = {
  appId: "com.veejaliu.jidian",
  productName: "基点",
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: [
    "dist/**/*",
    "build/server/**/*",
    "database/**/*",
    "electron/**/*",
    "package.json",
    "package-lock.json",
    "!server/**/*.test.*",
    "!**/node_modules/better-sqlite3/build/Release/test_extension.node",
  ],
  extraMetadata: {
    main: "electron/main.js",
  },
  asarUnpack: [
    "build/server/**/*",
    "database/**/*",
    "node_modules/better-sqlite3/**/*",
    "!node_modules/better-sqlite3/build/Release/test_extension.node",
  ],
  mac: {
    category: "public.app-category.finance",
    target: ["dmg", "zip"],
    artifactName: "${productName}-${version}-${arch}.${ext}",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    icon: path.join("build", "icon.icns"),
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
