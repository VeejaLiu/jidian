import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Tests import database-backed services. Always give them a disposable database.
const dataDir = mkdtempSync(path.join(tmpdir(), "jidian-tests-"));
try {
  const tests = readdirSync("tests").filter((file) => file.endsWith(".test.ts"))
    .sort().map((file) => path.join("tests", file));
  if (!tests.length) throw new Error("No test files found");
  const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], {
    stdio: "inherit",
    env: {
      ...process.env,
      APP_ROOT_DIR: process.cwd(),
      APP_DATA_DIR: dataDir,
      APP_DB_PATH: path.join(dataDir, "tests.sqlite"),
      APP_SCHEMA_PATH: path.resolve("database/schema.sql"),
      APP_BACKUP_DIR: path.join(dataDir, "backups"),
      APP_LOG_DIR: path.join(dataDir, "logs"),
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
