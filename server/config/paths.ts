import path from "node:path";

export const PORT = Number(process.env.PORT || 4173);
export const APP_RUNTIME = process.env.APP_RUNTIME || "server";
export const IS_DESKTOP = APP_RUNTIME === "desktop";
export const IS_DEV = process.env.NODE_ENV === "development";

function resolveProjectRoot() {
  if (process.env.APP_ROOT_DIR) return path.resolve(process.env.APP_ROOT_DIR);
  if (process.env.NODE_ENV === "development") return process.cwd();
  return path.resolve(__dirname, "..", "..");
}

function resolveResourceRoot(rootDir: string) {
  if (process.env.APP_RESOURCE_DIR) return path.resolve(process.env.APP_RESOURCE_DIR);
  return rootDir;
}

function resolveDistRoot(rootDir: string) {
  if (process.env.APP_DIST_DIR) return path.resolve(process.env.APP_DIST_DIR);
  return path.join(rootDir, "dist");
}

export const ROOT_DIR = resolveProjectRoot();
export const RESOURCE_ROOT_DIR = resolveResourceRoot(ROOT_DIR);
export const DIST_DIR = resolveDistRoot(ROOT_DIR);
export const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(ROOT_DIR, "data");
export const LOG_DIR = process.env.APP_LOG_DIR
  ? path.resolve(process.env.APP_LOG_DIR)
  : path.join(DATA_DIR, "logs");
export const DB_PATH = process.env.APP_DB_PATH
  ? path.resolve(process.env.APP_DB_PATH)
  : path.join(DATA_DIR, "fund-dca.sqlite");
export const SCHEMA_PATH = process.env.APP_SCHEMA_PATH
  ? path.resolve(process.env.APP_SCHEMA_PATH)
  : path.join(RESOURCE_ROOT_DIR, "database", "schema.sql");
