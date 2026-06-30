import express from "express";
import { DB_PATH, IS_DEV, PORT } from "./config/paths";
import "./db/database";
import { migrateAccounts, migrateAssetTypes, migrateStockPriceFields, migrateTradeFees, migrateTradeRecordsForPendingStatus } from "./db/migrations";
import { setupFrontend } from "./frontend";
import { accountRoutes } from "./routes/accountRoutes";
import { fundRoutes } from "./routes/fundRoutes";
import { tradeRoutes } from "./routes/tradeRoutes";
import { installServerErrorLogging, logError, logInfo } from "./utils/logger";

const app = express();
app.use(express.json({ limit: "2mb" }));
installServerErrorLogging();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

migrateAccounts();
migrateAssetTypes();
migrateTradeRecordsForPendingStatus();
migrateTradeFees();
migrateStockPriceFields();

app.use(accountRoutes);
app.use(fundRoutes);
app.use(tradeRoutes);

function setupErrorHandler() {
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
      error: error.message || "服务暂时不可用",
    });
  });
}

async function startServer() {
  await setupFrontend(app);
  setupErrorHandler();

  app.listen(PORT, () => {
    logInfo(`基点已启动 url=http://127.0.0.1:${PORT}`);
    logInfo(`运行模式 mode=${IS_DEV ? "development" : "production"}`);
    logInfo(`SQLite 数据库 path=${DB_PATH}`);
  });
}

startServer().catch((error) => {
  logError("服务启动失败", error);
  process.exit(1);
});
