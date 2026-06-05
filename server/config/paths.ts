import path from "node:path";

export const PORT = Number(process.env.PORT || 4173);
export const ROOT_DIR = process.cwd();
export const DIST_DIR = path.join(ROOT_DIR, "dist");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const DB_PATH = path.join(DATA_DIR, "fund-dca.sqlite");
export const SCHEMA_PATH = path.join(ROOT_DIR, "database", "schema.sql");
export const IS_DEV = process.env.NODE_ENV === "development";
