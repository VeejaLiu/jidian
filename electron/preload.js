const { contextBridge } = require("electron");
const path = require("node:path");
const os = require("node:os");

contextBridge.exposeInMainWorld("desktopApp", {
  runtime: "desktop",
  platform: process.platform,
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
