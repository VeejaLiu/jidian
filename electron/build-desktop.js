const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "release");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "jidian-desktop-build-"));

function isIgnored(source) {
  const relativePath = path.relative(projectRoot, source);
  const firstSegment = relativePath.split(path.sep)[0];

  return [".git", "node_modules", "dist", "release", "data"].includes(firstSegment)
    || relativePath === path.join("build", "server")
    || relativePath.startsWith(`${path.join("build", "server")}${path.sep}`)
    || relativePath === ".DS_Store";
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: workspace,
    stdio: "inherit",
    ...options,
  });
}

try {
  // Electron rebuilds native modules in this disposable directory, never in the dev workspace.
  fs.cpSync(projectRoot, workspace, {
    recursive: true,
    filter: (source) => !isIgnored(source),
  });
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[desktop-build] 隔离构建目录：${workspace}`);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["ci"]);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:server"]);

  const builder = path.join(
    workspace,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
  );
  run(builder, ["--config", "electron-builder.config.js", ...process.argv.slice(2)], {
    env: {
      ...process.env,
      JIDIAN_DESKTOP_OUTPUT: outputDir,
      // Local builds are intentionally unsigned unless signing is explicitly configured.
      CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || "false",
    },
  });
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
