const { execSync } = require("node:child_process");

try {
  execSync("npm rebuild better-sqlite3", {
    stdio: "inherit",
  });
} catch (error) {
  console.error("[desktop-build] 恢复本地 better-sqlite3 失败");
  process.exit(1);
}
