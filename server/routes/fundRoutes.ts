import { Router } from "express";
import { db } from "../db/database";
import { fetchFundProfile } from "../services/eastmoney";
import { getChartData, getFundById, getPaginatedNavHistory, listFunds, mapFund } from "../services/funds";
import { getDefaultSyncStartDate, syncActiveFundsInBackground, syncFundNav } from "../services/navSync";
import { getAccountIdFromRequest } from "../services/accounts";
import { assertDate, assertPositiveNumber, cleanText, normalizeCode } from "../utils/validators";
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

fundRoutes.get("/api/funds", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  res.json({ funds: listFunds(accountId) });
  syncActiveFundsInBackground();
});

fundRoutes.get("/api/hidden-funds", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  res.json({ funds: listFunds(accountId, { hidden: true }) });
});

fundRoutes.post("/api/funds", async (req, res, next) => {
  try {
    const code = normalizeCode(req.body.code);
    const accountId = getAccountIdFromRequest(req);
    const inputName = cleanText(req.body.name);
    if (!code && !inputName) throw toHttpError("请至少填写基金代码或基金名称", 400);

    const profile = code ? await fetchFundProfile(code) : null;
    const name = inputName || profile?.name || code;
    const fundType = profile?.fundType || null;

    const insert = db.prepare(
      `INSERT INTO funds (code, name, fund_type)
       VALUES (@code, @name, @fundType)
       ON CONFLICT(code) DO UPDATE SET
         name = CASE WHEN excluded.name != '' THEN excluded.name ELSE funds.name END,
         fund_type = COALESCE(excluded.fund_type, funds.fund_type)
       RETURNING id`,
    );
    const row = insert.get({ code: code || null, name, fundType }) as { id: number };

    db.prepare(
      `INSERT INTO strategy_settings (fund_id, drop_rate)
       VALUES (?, 0.04)
       ON CONFLICT(fund_id) DO NOTHING`,
    ).run(row.id);

    db.prepare(
      `INSERT INTO user_funds (account_id, fund_id, is_active)
       VALUES (?, ?, 1)
       ON CONFLICT(account_id, fund_id) DO UPDATE SET is_active = 1`,
    ).run(accountId, row.id);

    await syncFundNav(row.id, { fullHistory: true, source: "add-fund" });

    res.status(201).json({ fund: mapFund(getFundById(row.id, { accountId }), accountId) });
  } catch (error) {
    next(error);
  }
});

fundRoutes.delete("/api/funds/:id", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  db.prepare("UPDATE user_funds SET is_active = 0 WHERE account_id = ? AND fund_id = ?")
    .run(accountId, Number(req.params.id));
  res.json({ ok: true });
});

fundRoutes.post("/api/funds/:id/restore", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  db.prepare("UPDATE user_funds SET is_active = 1 WHERE account_id = ? AND fund_id = ?")
    .run(accountId, Number(req.params.id));
  res.json({ ok: true });
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

fundRoutes.delete("/api/nav/:id", (req, res) => {
  res.status(405).json({ error: "历史净值由系统同步维护，不支持手动删除" });
});

fundRoutes.get("/api/funds/:id/nav", (req, res) => {
  res.json(getPaginatedNavHistory(Number(req.params.id), req.query.page, req.query.pageSize));
});

fundRoutes.get("/api/funds/:id/chart", (req, res) => {
  const accountId = getAccountIdFromRequest(req);
  res.json(getChartData(Number(req.params.id), accountId));
});

fundRoutes.post("/api/funds/:id/sync-nav", async (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    const accountId = getAccountIdFromRequest(req);
    const fullHistory = req.body.fullHistory !== false && !req.body.startDate;
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
