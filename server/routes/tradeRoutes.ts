import { Router } from "express";
import { db } from "../db/database";
import { getFundById, mapFund } from "../services/funds";
import { importTradesFromText } from "../services/imports";
import { assertTradeTimeline, buildTradeInput } from "../services/trades";
import { getAccountIdFromRequest } from "../services/accounts";

export const tradeRoutes = Router();

function createTradeRecord(req: any, res: any, next: any, forcedType: "buy" | null = null) {
  try {
    const fundId = Number(req.params.id);
    const accountId = getAccountIdFromRequest(req);
    const trade = buildTradeInput(fundId, req.body, forcedType);
    assertTradeTimeline(fundId, accountId, trade);

    db.prepare(
      `INSERT INTO trade_records (account_id, fund_id, trade_type, trade_date, trade_nav, amount, fee, shares, status, note, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      accountId,
      fundId,
      trade.type,
      trade.date,
      trade.nav,
      trade.amount,
      trade.fee || 0,
      trade.shares,
      trade.status,
      trade.note,
      trade.status === "confirmed" ? new Date().toISOString() : null,
    );

    res.status(201).json({ fund: mapFund(getFundById(fundId, { accountId }), accountId) });
  } catch (error) {
    next(error);
  }
}

tradeRoutes.post("/api/funds/:id/trades", (req, res, next) => {
  createTradeRecord(req, res, next);
});

tradeRoutes.post("/api/funds/:id/buys", (req, res, next) => {
  createTradeRecord(req, res, next, "buy");
});

tradeRoutes.post("/api/trades/import", (req, res, next) => {
  try {
    const accountId = getAccountIdFromRequest(req);
    const payload = importTradesFromText(String(req.body?.text || ""), accountId);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

tradeRoutes.put("/api/trades/:id", (req, res, next) => {
  try {
    const tradeId = Number(req.params.id);
    const currentTrade = db
      .prepare("SELECT id, account_id, fund_id, source_buy_id FROM trade_records WHERE id = ?")
      .get(tradeId) as { id: number; account_id: number; fund_id: number; source_buy_id?: number } | undefined;

    if (!currentTrade) {
      const error = new Error("交易记录不存在") as Error & { status?: number };
      error.status = 404;
      throw error;
    }

    const trade = buildTradeInput(currentTrade.fund_id, req.body);
    assertTradeTimeline(currentTrade.fund_id, currentTrade.account_id, { ...trade, id: tradeId }, tradeId);

    const updateTrade = db.transaction(() => {
      db.prepare(
        `UPDATE trade_records
         SET trade_type = ?, trade_date = ?, trade_nav = ?, amount = ?, fee = ?, shares = ?, status = ?, note = ?, confirmed_at = ?
         WHERE id = ?`,
      ).run(
        trade.type,
        trade.date,
        trade.nav,
        trade.amount,
        trade.fee || 0,
        trade.shares,
        trade.status,
        trade.note,
        trade.status === "confirmed" ? new Date().toISOString() : null,
        tradeId,
      );

      if (currentTrade.source_buy_id && trade.type === "buy" && trade.status === "confirmed") {
        db.prepare(
          `UPDATE buy_records
           SET buy_date = ?, buy_nav = ?, amount = ?, shares = ?, note = ?
           WHERE id = ?`,
        ).run(trade.date, trade.nav, trade.amount, trade.shares, trade.note, currentTrade.source_buy_id);
      } else if (currentTrade.source_buy_id && (trade.type === "sell" || trade.status === "pending")) {
        db.prepare("DELETE FROM buy_records WHERE id = ?").run(currentTrade.source_buy_id);
        db.prepare("UPDATE trade_records SET source_buy_id = NULL WHERE id = ?").run(tradeId);
      }
    });

    updateTrade();
    res.json({ fund: mapFund(getFundById(currentTrade.fund_id, { accountId: currentTrade.account_id }), currentTrade.account_id) });
  } catch (error) {
    next(error);
  }
});

tradeRoutes.delete("/api/trades/:id", (req, res) => {
  const removeTrade = db.transaction((tradeId: number) => {
    const trade = db.prepare("SELECT source_buy_id FROM trade_records WHERE id = ?").get(tradeId) as { source_buy_id?: number } | undefined;
    db.prepare("DELETE FROM trade_records WHERE id = ?").run(tradeId);
    if (trade?.source_buy_id) {
      db.prepare("DELETE FROM buy_records WHERE id = ?").run(trade.source_buy_id);
    }
  });
  removeTrade(Number(req.params.id));
  res.json({ ok: true });
});

tradeRoutes.delete("/api/buys/:id", (req, res) => {
  const removeBuy = db.transaction((tradeId: number) => {
    const trade = db
      .prepare("SELECT source_buy_id FROM trade_records WHERE id = ? AND trade_type = 'buy'")
      .get(tradeId) as { source_buy_id?: number } | undefined;
    db.prepare("DELETE FROM trade_records WHERE id = ? AND trade_type = 'buy'").run(tradeId);
    if (trade?.source_buy_id) {
      db.prepare("DELETE FROM buy_records WHERE id = ?").run(trade.source_buy_id);
    }
  });
  removeBuy(Number(req.params.id));
  res.json({ ok: true });
});
