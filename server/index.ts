import express from "express";
import { DB_PATH, HOST, IS_DEV, PORT } from "./config/paths";
import "./db/database";
import { migrateAccounts, migrateAssetTypes, migrateDividendRecords, migrateDividendRecordTypes, migrateStockPriceFields, migrateStocksToUnadjustedPrices, migrateTradeAmountNullable, migrateTradeFees, migrateTradeRecordsForPendingStatus } from "./db/migrations";
import { setupFrontend } from "./frontend";
import { accountRoutes } from "./routes/accountRoutes";
import { fundRoutes } from "./routes/fundRoutes";
import { tradeRoutes } from "./routes/tradeRoutes";
import { startBackgroundSyncScheduler } from "./services/navSync";
import { getHttpStatus, getPublicErrorMessage } from "./utils/httpError";
import { installServerErrorLogging, logError, logInfo } from "./utils/logger";

const app = express();
app.use(express.json({ limit: "32mb" }));
installServerErrorLogging();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

migrateAccounts();
migrateAssetTypes();
migrateTradeRecordsForPendingStatus();
migrateTradeFees();
migrateTradeAmountNullable();
migrateStockPriceFields();
migrateStocksToUnadjustedPrices();
migrateDividendRecords();
migrateDividendRecordTypes();

app.use(accountRoutes);
app.use(fundRoutes);
app.use(tradeRoutes);

function setupErrorHandler() {
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    const status = getHttpStatus(error);
    if (status >= 500) {
      logError(`请求失败 method=${req.method} path=${req.path} status=${status}`, error);
    }
    res.status(status).json({
      error: getPublicErrorMessage(error),
    });
  });
}

async function startServer() {
  await setupFrontend(app);
  setupErrorHandler();

  app.listen(PORT, HOST, () => {
    logInfo(`基点已启动 url=http://${HOST}:${PORT}`);
    logInfo(`运行模式 mode=${IS_DEV ? "development" : "production"}`);
    logInfo(`SQLite 数据库 path=${DB_PATH}`);
    startBackgroundSyncScheduler();
  });
}

startServer().catch((error) => {
  logError("服务启动失败", error);
  process.exit(1);
});
