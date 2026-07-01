const { contextBridge } = require("electron");
const path = require("node:path");
const os = require("node:os");

const apiOriginArg = process.argv.find((arg) => arg.startsWith("--jidian-api-origin="));
const apiOrigin = apiOriginArg ? apiOriginArg.slice("--jidian-api-origin=".length) : null;

contextBridge.exposeInMainWorld("desktopApp", {
  runtime: "desktop",
  platform: process.platform,
  apiOrigin,
  logDir:
    process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "jidian", "logs")
      : null,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
