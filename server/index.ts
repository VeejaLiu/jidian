import express from "express";
import { DB_PATH, IS_DEV, PORT } from "./config/paths";
import "./db/database";
import { migrateTradeRecordsForPendingStatus } from "./db/migrations";
import { setupFrontend } from "./frontend";
import { fundRoutes } from "./routes/fundRoutes";
import { tradeRoutes } from "./routes/tradeRoutes";

const app = express();
app.use(express.json({ limit: "2mb" }));

migrateTradeRecordsForPendingStatus();

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
    console.log(`基点已启动：http://127.0.0.1:${PORT}`);
    console.log(`运行模式：${IS_DEV ? "开发模式，支持前端自动更新" : "生产模式"}`);
    console.log(`SQLite 数据库：${DB_PATH}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
