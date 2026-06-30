import fs from "node:fs";
import path from "node:path";
import { LOG_DIR } from "../config/paths";

type LogLevel = "INFO" | "WARN" | "ERROR";

const SERVER_LOG_PATH = path.join(LOG_DIR, "server.log");
const ERROR_LOG_PATH = path.join(LOG_DIR, "errors.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

function appendLine(filePath: string, line: string) {
  fs.appendFileSync(filePath, `${line}\n`, "utf8");
}

function formatLine(level: LogLevel, message: string) {
  return `[${level}] ${new Date().toISOString()} ${message}`;
}

export function logInfo(message: string) {
  const line = formatLine("INFO", message);
  console.info(message);
  appendLine(SERVER_LOG_PATH, line);
}

export function logWarn(message: string) {
  const line = formatLine("WARN", message);
  console.warn(message);
  appendLine(SERVER_LOG_PATH, line);
}

export function logError(message: string, error?: unknown) {
  const errorText = error instanceof Error ? `${error.message}\n${error.stack || ""}` : error ? String(error) : "";
  const combined = errorText ? `${message}\n${errorText}` : message;
  const line = formatLine("ERROR", combined);
  console.error(message, error || "");
  appendLine(SERVER_LOG_PATH, line);
  appendLine(ERROR_LOG_PATH, line);
}

export function installServerErrorLogging() {
  process.on("uncaughtException", (error) => {
    logError("服务发生未捕获异常", error);
  });

  process.on("unhandledRejection", (reason) => {
    logError("服务发生未处理 Promise 拒绝", reason);
  });
}
