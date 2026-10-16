import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const forbidden = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_(?:rsa|ed25519)|credentials(?:\.json)?|(?:data|backups|exports|release|node_modules)\/.*)$|\.(?:sqlite(?:3)?(?:-wal|-shm)?|db(?:-wal|-shm)?|pem|key|p12|pfx|log)$|(^|\/)jidian-backup-.*\.json$/i;
const problems = [];
for (const file of files) {
  if (file === "data/.gitkeep") continue;
  if (forbidden.test(file)) problems.push(`${file}: private data or generated file`);
  const data = readFileSync(file);
  if (data.subarray(0, 16).toString() === "SQLite format 3\0") {
    problems.push(`${file}: SQLite database content`);
  }
  if (file.endsWith(".json")) {
    try {
      const payload = JSON.parse(data.toString("utf8"));
      if (payload?.tables && ("user_accounts" in payload.tables || "trade_records" in payload.tables)) {
        problems.push(`${file}: investment backup content`);
      }
    } catch {
      // Non-JSON content is covered by the separate secret scan.
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Public-file check passed (${files.length} tracked files). Review screenshots manually; scan secrets with Gitleaks.`);
}
