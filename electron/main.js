const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");
const { app, BrowserWindow, dialog } = require("electron");

const HOST = "127.0.0.1";
const DEV_SERVER_PORT = 4173;
const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 30000;
const HEALTH_POLL_INTERVAL_MS = 400;

let mainWindow = null;
let serverProcess = null;
let serverPort = 0;
let shuttingDown = false;
let lastServerError = "";
let desktopLogDir = "";
let mainLogPath = "";
let errorLogPath = "";
let windowStatePath = "";

const gotSingleInstanceLock = app.isPackaged ? app.requestSingleInstanceLock() : true;
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

function resolveAppRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar")
    : path.resolve(__dirname, "..");
}

function resolveWorkingDir() {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
}

function resolveResourceRoot(rootDir) {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked")
    : rootDir;
}

function ensureUserDataDir() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureDesktopLogDir() {
  const dir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(dir, { recursive: true });
  desktopLogDir = dir;
  mainLogPath = path.join(dir, "main.log");
  errorLogPath = path.join(dir, "errors.log");
  return dir;
}

function ensureWindowStatePath() {
  if (!windowStatePath) {
    windowStatePath = path.join(app.getPath("userData"), "window-state.json");
  }
  return windowStatePath;
}

function ensureLocalDataDir(rootDir) {
  const dir = path.join(rootDir, "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function pickServerPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ port: 0, host: HOST }, () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function getServerEntry(rootDir) {
  return app.isPackaged
    ? path.join(rootDir, "build", "server", "server", "index.js")
    : path.join(rootDir, "server", "index.ts");
}

function writeDesktopLog(level, message, errorText = "") {
  if (!desktopLogDir) ensureDesktopLogDir();
  const line = `[${level}] ${new Date().toISOString()} ${message}${errorText ? `\n${errorText}` : ""}\n`;
  fs.appendFileSync(level === "ERROR" ? errorLogPath : mainLogPath, line, "utf8");
}

function loadWindowState() {
  try {
    const filePath = ensureWindowStatePath();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    logMainError("读取窗口状态失败", error);
    return null;
  }
}

function saveWindowState(window) {
  try {
    const bounds = window.getBounds();
    const nextState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized(),
    };
    fs.writeFileSync(ensureWindowStatePath(), JSON.stringify(nextState, null, 2), "utf8");
  } catch (error) {
    logMainError("保存窗口状态失败", error);
  }
}

function logMain(message) {
  console.log(`[desktop-main] ${message}`);
  writeDesktopLog("INFO", message);
}

function logMainError(message, error) {
  const errorText = error instanceof Error ? `${error.message}\n${error.stack || ""}` : error ? String(error) : "";
  console.error(`[desktop-main] ${message}`, error || "");
  writeDesktopLog("ERROR", message, errorText);
}

function getNodeCommand(rootDir) {
  if (app.isPackaged) {
    return process.execPath;
  }
  return process.execPath;
}

function getNodeArgs(rootDir) {
  if (app.isPackaged) {
    return [getServerEntry(rootDir)];
  }
  const tsxCli = require.resolve("tsx/dist/cli.mjs", { paths: [rootDir] });
  return [tsxCli, getServerEntry(rootDir)];
}

function waitForHealth(port) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() > deadline) {
        reject(new Error("桌面内置服务启动超时"));
        return;
      }

      try {
        const response = await fetch(`http://${HOST}:${port}${HEALTH_PATH}`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Wait for next poll.
      }

      setTimeout(tick, HEALTH_POLL_INTERVAL_MS);
    };

    tick();
  });
}

async function startEmbeddedServer() {
  const rootDir = resolveAppRoot();
  const workingDir = resolveWorkingDir();
  const resourceRootDir = resolveResourceRoot(rootDir);
  const dataDir = app.isPackaged ? ensureUserDataDir() : ensureLocalDataDir(rootDir);
  const logDir = ensureDesktopLogDir();
  serverPort = app.isPackaged ? await pickServerPort() : DEV_SERVER_PORT;

  const env = {
    ...process.env,
    NODE_ENV: app.isPackaged ? "production" : "development",
    APP_RUNTIME: "desktop",
    APP_HOST: HOST,
    PORT: String(serverPort),
    APP_ROOT_DIR: rootDir,
    APP_RESOURCE_DIR: resourceRootDir,
    APP_DIST_DIR: app.isPackaged ? path.join(rootDir, "dist") : path.join(rootDir, "dist"),
    APP_DATA_DIR: dataDir,
    APP_LOG_DIR: logDir,
    APP_DB_PATH: path.join(dataDir, "fund-dca.sqlite"),
    APP_SCHEMA_PATH: path.join(resourceRootDir, "database", "schema.sql"),
    ELECTRON_RUN_AS_NODE: "1",
  };

  const child = spawn(getNodeCommand(rootDir), getNodeArgs(rootDir), {
    cwd: workingDir,
    env,
    stdio: "pipe",
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    process.stdout.write(`[desktop-server] ${text}`);
    writeDesktopLog("INFO", `[desktop-server] ${text}`.trimEnd());
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    lastServerError = `${lastServerError}${text}`.slice(-4000);
    process.stderr.write(`[desktop-server] ${text}`);
    writeDesktopLog("ERROR", "[desktop-server] stderr", text.trimEnd());
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal=${signal}` : `code=${code}`;
    const details = lastServerError.trim() ? `\n\n${lastServerError.trim()}` : "";
    logMainError(`内置服务意外退出 ${reason}`, lastServerError.trim());
    dialog.showErrorBox("服务已停止", `内置服务意外退出：${reason}${details}`);
    app.quit();
  });

  serverProcess = child;
  logMain(`内置服务启动 port=${serverPort} logDir=${logDir}`);
  await waitForHealth(serverPort);
  logMain(`内置服务健康检查通过 port=${serverPort}`);
}

function createErrorWindow(message) {
  const errorWindow = new BrowserWindow({
    width: 720,
    height: 480,
    show: false,
    title: "基点",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  const html = `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>基点</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f4f6f8; color: #172026; }
          main { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
          section { max-width: 560px; background: #fff; border: 1px solid #dbe3e7; border-radius: 12px; padding: 24px; box-shadow: 0 14px 38px rgba(29,45,53,0.09); }
          h1 { margin: 0 0 12px; font-size: 22px; }
          p { margin: 0; line-height: 1.6; color: #65727e; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <main>
          <section>
            <h1>桌面服务启动失败</h1>
            <p>${message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>
          </section>
        </main>
      </body>
    </html>
  `;

  errorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  errorWindow.once("ready-to-show", () => errorWindow.show());
  return errorWindow;
}

async function createMainWindow() {
  if (app.isPackaged) {
    try {
      await startEmbeddedServer();
    } catch (error) {
      mainWindow = createErrorWindow(error instanceof Error ? error.message : "未知错误");
      return;
    }
  } else {
    serverPort = DEV_SERVER_PORT;
  }

  const previousWindowState = loadWindowState();
  mainWindow = new BrowserWindow({
    width: previousWindowState?.width || 1440,
    height: previousWindowState?.height || 960,
    x: Number.isInteger(previousWindowState?.x) ? previousWindowState.x : undefined,
    y: Number.isInteger(previousWindowState?.y) ? previousWindowState.y : undefined,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: "基点",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--jidian-api-origin=${process.env.JIDIAN_API_ORIGIN || `http://${HOST}:${serverPort}`}`],
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (previousWindowState?.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  mainWindow.on("resize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    saveWindowState(mainWindow);
  });

  mainWindow.on("move", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    saveWindowState(mainWindow);
  });

  mainWindow.on("maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    saveWindowState(mainWindow);
  });

  mainWindow.on("unmaximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    saveWindowState(mainWindow);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(app.isPackaged ? `http://${HOST}:${serverPort}` : "http://127.0.0.1:5173");
}

function stopEmbeddedServer() {
  shuttingDown = true;
  if (!serverProcess) return;
  logMain("正在停止内置服务");
  serverProcess.kill();
  serverProcess = null;
}

process.on("uncaughtException", (error) => {
  logMainError("主进程未捕获异常", error);
});

process.on("unhandledRejection", (reason) => {
  logMainError("主进程未处理 Promise 拒绝", reason);
});

app.on("window-all-closed", () => {
  stopEmbeddedServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopEmbeddedServer();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});

app.whenReady().then(createMainWindow);
