import { Router } from "express";
import { db } from "../db/database";
import { fetchFundProfile, fetchStockProfile } from "../services/eastmoney";
import { getChartData, getFundById, getPaginatedNavHistory, getPaginatedPriceHistory, listFunds, mapFund } from "../services/funds";
import { getDefaultSyncStartDate, syncActiveFundsInBackground, syncAssetPrice, syncFundNav } from "../services/navSync";
import { getAccountIdFromRequest } from "../services/accounts";
import { assertDate, assertPositiveNumber, cleanText, normalizeAssetCode, normalizeCode } from "../utils/validators";
import { toHttpError } from "../utils/httpError";

export const fundRoutes = Router();

const upsertNav = db.prepare(
  `INSERT INTO nav_history (fund_id, nav_date, unit_nav, accumulated_nav, source)
   VALUES (@fundId, @date, @nav, @accumulatedNav, 'eastmoney')
   ON CONFLICT(fund_id, nav_date) DO UPDATE SET
     unit_nav = excluded.unit_nav,
     accumulated_nav = excluded.accumulated_nav,
     source = excluded.source`,
);

function listAssetsHandler(req: any, res: any) {
  const accountId = getAccountIdFromRequest(req);
  res.json({ funds: listFunds(accountId) });
  syncActiveFundsInBackground();
}

function listHiddenAssetsHandler(req: any, res: any) {
  const accountId = getAccountIdFromRequest(req);
  res.json({ funds: listFunds(accountId, { hidden: true }) });
}

async function createAssetHandler(req: any, res: any, next: any) {
  try {
    const accountId = getAccountIdFromRequest(req);
    const assetType = req.body.assetType === "stock" ? "stock" : "fund";
    const code = assetType === "stock" ? normalizeAssetCode(req.body.code) : normalizeCode(req.body.code);
    const inputName = cleanText(req.body.name);
    if (!code && !inputName) {
      throw toHttpError(assetType === "stock" ? "请至少填写股票代码或股票名称" : "请至少填写基金代码或基金名称", 400);
    }

    const profile = code
      ? assetType === "stock"
        ? await fetchStockProfile(code)
        : await fetchFundProfile(code)
      : null;
    const name = inputName || profile?.name || code;
    const fundType = profile?.fundType || (assetType === "stock" ? "股票" : null);

    const insert = db.prepare(
      `INSERT INTO funds (code, name, asset_type, fund_type)
       VALUES (@code, @name, @assetType, @fundType)
       ON CONFLICT(code) DO UPDATE SET
         name = CASE WHEN excluded.name != '' THEN excluded.name ELSE funds.name END,
         asset_type = COALESCE(excluded.asset_type, funds.asset_type),
         fund_type = COALESCE(excluded.fund_type, funds.fund_type)
       RETURNING id`,
    );
    const row = insert.get({ code: code || null, name, assetType, fundType }) as { id: number };

    if (assetType === "fund") {
      db.prepare(
        `INSERT INTO strategy_settings (fund_id, drop_rate)
         VALUES (?, 0.04)
         ON CONFLICT(fund_id) DO NOTHING`,
      ).run(row.id);
    }

    db.prepare(
      `INSERT INTO user_funds (account_id, fund_id, is_active, drop_rate)
       VALUES (?, ?, 1, 0.04)
       ON CONFLICT(account_id, fund_id) DO UPDATE SET is_active = 1`,
    ).run(accountId, row.id);

    if (assetType === "fund") {
      await syncFundNav(row.id, { fullHistory: true, source: "add-fund" });
    }

    res.status(201).json({ fund: mapFund(getFundById(row.id, { accountId }), accountId) });
  } catch (error) {
    next(error);
  }
}

function hideAssetHandler(req: any, res: any) {
  const accountId = getAccountIdFromRequest(req);
  db.prepare("UPDATE user_funds SET is_active = 0 WHERE account_id = ? AND fund_id = ?")
    .run(accountId, Number(req.params.id));
  res.json({ ok: true });
}

function restoreAssetHandler(req: any, res: any) {
  const accountId = getAccountIdFromRequest(req);
  db.prepare("UPDATE user_funds SET is_active = 1 WHERE account_id = ? AND fund_id = ?")
    .run(accountId, Number(req.params.id));
  res.json({ ok: true });
}

fundRoutes.get("/api/funds", listAssetsHandler);
fundRoutes.get("/api/assets", listAssetsHandler);

fundRoutes.get("/api/hidden-funds", listHiddenAssetsHandler);
fundRoutes.get("/api/hidden-assets", listHiddenAssetsHandler);

fundRoutes.post("/api/funds", createAssetHandler);
fundRoutes.post("/api/assets", createAssetHandler);

fundRoutes.delete("/api/funds/:id", hideAssetHandler);
fundRoutes.delete("/api/assets/:id", hideAssetHandler);

fundRoutes.post("/api/funds/:id/restore", restoreAssetHandler);
fundRoutes.post("/api/assets/:id/restore", restoreAssetHandler);

fundRoutes.patch("/api/funds/:id/settings", (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    const accountId = getAccountIdFromRequest(req);
    const dropRatePercent = assertPositiveNumber(req.body.dropRatePercent, "跌幅幅度");
    if (dropRatePercent >= 100) throw toHttpError("跌幅幅度必须小于 100%", 400);

    const result = db
      .prepare("UPDATE user_funds SET drop_rate = ? WHERE account_id = ? AND fund_id = ?")
      .run(dropRatePercent / 100, accountId, fundId);
    if (result.changes === 0) throw toHttpError("基金不存在或不属于当前账户", 404);

    res.json({ fund: mapFund(getFundById(fundId, { accountId, includeHidden: true }), accountId) });
  } catch (error) {
    next(error);
  }
});

fundRoutes.post("/api/funds/:id/nav", (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    assertDate(req.body.date, "净值日期");
    const nav = assertPositiveNumber(req.body.nav, "单位净值");

    upsertNav.run({
      fundId,
      date: req.body.date,
      nav,
      accumulatedNav: req.body.accumulatedNav ? Number(req.body.accumulatedNav) : null,
    });

    const accountId = getAccountIdFromRequest(req);
    res.status(201).json({ fund: mapFund(getFundById(fundId, { accountId, includeHidden: true }), accountId) });
  } catch (error) {
    next(error);
  }
});

fundRoutes.post("/api/assets/:id/prices", (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    assertDate(req.body.date, "价格日期");
    const nav = assertPositiveNumber(req.body.nav ?? req.body.price, "价格");

    upsertNav.run({
      fundId,
      date: req.body.date,
      nav,
      accumulatedNav: req.body.accumulatedNav ? Number(req.body.accumulatedNav) : null,
    });

    const accountId = getAccountIdFromRequest(req);
    res.status(201).json({ fund: mapFund(getFundById(fundId, { accountId, includeHidden: true }), accountId) });
  } catch (error) {
    next(error);
  }
});

fundRoutes.delete("/api/nav/:id", (req, res) => {
  res.status(405).json({ error: "历史净值由系统同步维护，不支持手动删除" });
});

fundRoutes.get("/api/funds/:id/nav", (req, res) => {
  res.json(getPaginatedNavHistory(Number(req.params.id), req.query.page, req.query.pageSize));
});

fundRoutes.get("/api/assets/:id/prices", (req, res) => {
  res.json(getPaginatedPriceHistory(Number(req.params.id), req.query.page, req.query.pageSize));
});

fundRoutes.get("/api/funds/:id/chart", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  res.json(getChartData(Number(req.params.id), accountId));
});

fundRoutes.get("/api/assets/:id/chart", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  res.json(getChartData(Number(req.params.id), accountId));
});

fundRoutes.post("/api/funds/:id/sync-nav", async (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    const accountId = getAccountIdFromRequest(req);
    const fullHistory = req.body.fullHistory === true && !req.body.startDate;
    const startDate = req.body.startDate
      ? assertDate(req.body.startDate, "开始日期")
      : getDefaultSyncStartDate(fundId);
    const endDate = req.body.endDate ? assertDate(req.body.endDate, "结束日期") : "";
    const sync = await syncFundNav(fundId, { startDate, endDate, fullHistory, source: "manual" });

    res.json({
      fund: mapFund(getFundById(fundId, { accountId }), accountId),
      sync,
    });
  } catch (error) {
    next(error);
  }
});

fundRoutes.post("/api/assets/:id/sync-price", async (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    const accountId = getAccountIdFromRequest(req);
    const fullHistory = req.body.fullHistory === true && !req.body.startDate;
    const startDate = req.body.startDate
      ? assertDate(req.body.startDate, "开始日期")
      : undefined;
    const endDate = req.body.endDate ? assertDate(req.body.endDate, "结束日期") : "";
    console.info(`[price-sync-api] ${new Date().toISOString()} 请求同步价格 fundId=${fundId} accountId=${accountId} fullHistory=${fullHistory} startDate=${startDate || "auto"} endDate=${endDate || "最新"}`);
    const sync = await syncAssetPrice(fundId, { startDate, endDate, fullHistory, source: "manual" });

    res.json({
      fund: mapFund(getFundById(fundId, { accountId }), accountId),
      sync,
    });
  } catch (error) {
    next(error);
  }
});

fundRoutes.get("/api/export", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  res.json({
    exportedAt: new Date().toISOString(),
    funds: listFunds(accountId),
  });
});

fundRoutes.delete("/api/all-data", (req, res) => {
  db.prepare("DELETE FROM funds").run();
  res.json({ ok: true });
});
