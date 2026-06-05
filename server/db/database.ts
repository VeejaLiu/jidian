import fs from "node:fs";
import Database from "better-sqlite3";
import { DATA_DIR, DB_PATH, SCHEMA_PATH } from "../config/paths";

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
