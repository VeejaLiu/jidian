import { Router } from "express";
import { db } from "../db/database";
import { fetchFundProfile } from "../services/eastmoney";
import { getChartData, getFundById, getPaginatedNavHistory, listFunds, mapFund } from "../services/funds";
import { getDefaultSyncStartDate, syncActiveFundsInBackground, syncFundNav } from "../services/navSync";
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
  res.json({ funds: listFunds() });
  syncActiveFundsInBackground();
});

fundRoutes.get("/api/hidden-funds", (req, res) => {
  res.json({ funds: listFunds({ hidden: true }) });
});

fundRoutes.post("/api/funds", async (req, res, next) => {
  try {
    const code = normalizeCode(req.body.code);
    const inputName = cleanText(req.body.name);
    if (!code && !inputName) throw toHttpError("请至少填写基金代码或基金名称", 400);

    const profile = code ? await fetchFundProfile(code) : null;
    const name = inputName || profile?.name || code;
    const fundType = profile?.fundType || null;

    const insert = db.prepare(
      `INSERT INTO funds (code, name, fund_type, is_active)
       VALUES (@code, @name, @fundType, 1)
       ON CONFLICT(code) DO UPDATE SET
         name = CASE WHEN excluded.name != '' THEN excluded.name ELSE funds.name END,
         fund_type = COALESCE(excluded.fund_type, funds.fund_type),
         is_active = 1
       RETURNING id`,
    );
    const row = insert.get({ code: code || null, name, fundType }) as { id: number };

    db.prepare(
      `INSERT INTO strategy_settings (fund_id, drop_rate)
       VALUES (?, 0.04)
       ON CONFLICT(fund_id) DO NOTHING`,
    ).run(row.id);

    await syncFundNav(row.id, { fullHistory: true });

    res.status(201).json({ fund: mapFund(getFundById(row.id)) });
  } catch (error) {
    next(error);
  }
});

fundRoutes.delete("/api/funds/:id", (req, res) => {
  db.prepare("UPDATE funds SET is_active = 0 WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

fundRoutes.post("/api/funds/:id/restore", (req, res) => {
  db.prepare("UPDATE funds SET is_active = 1 WHERE id = ?").run(Number(req.params.id));
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

    res.status(201).json({ fund: mapFund(getFundById(fundId)) });
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
  res.json(getChartData(Number(req.params.id)));
});

fundRoutes.post("/api/funds/:id/sync-nav", async (req, res, next) => {
  try {
    const fundId = Number(req.params.id);
    const fullHistory = req.body.fullHistory !== false && !req.body.startDate;
    const startDate = req.body.startDate
      ? assertDate(req.body.startDate, "开始日期")
      : getDefaultSyncStartDate(fundId);
    const endDate = req.body.endDate ? assertDate(req.body.endDate, "结束日期") : "";
    const sync = await syncFundNav(fundId, { startDate, endDate, fullHistory });

    res.json({
      fund: mapFund(getFundById(fundId)),
      sync,
    });
  } catch (error) {
    next(error);
  }
});

fundRoutes.get("/api/export", (req, res) => {
  res.json({
    exportedAt: new Date().toISOString(),
    funds: listFunds(),
  });
});

fundRoutes.delete("/api/all-data", (req, res) => {
  db.prepare("DELETE FROM funds").run();
  res.json({ ok: true });
});
