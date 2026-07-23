import { db } from "../db/database";
import type { DividendRecord } from "../types";
import { toHttpError } from "../utils/httpError";
import { assertDate, assertPositiveNumber, cleanText, optionalPositiveNumber } from "../utils/validators";

export function listDividends(fundId: number, accountId: number, order: "ASC" | "DESC" = "DESC") {
  const direction = order === "ASC" ? "ASC" : "DESC";
  return db
    .prepare(
      `SELECT
        id,
        account_id AS accountId,
        fund_id AS fundId,
        dividend_type AS type,
        dividend_date AS date,
        amount,
        dividend_nav AS nav,
        shares,
        note
       FROM dividend_records
       WHERE fund_id = ?
         AND account_id = ?
       ORDER BY dividend_date ${direction}, id ${direction}`,
    )
    .all(fundId, accountId) as DividendRecord[];
}

export function buildDividendInput(body: any): DividendRecord {
  const type = cleanText(body.type);
  if (!["cash", "reinvest", "stock_bonus", "capital_increase", "dividend_tax"].includes(type)) {
    throw toHttpError("不支持的分红或公司行为类型", 400);
  }

  const date = assertDate(body.date, "分红日期");
  const isShareIncrease = type === "stock_bonus" || type === "capital_increase";
  const amount = isShareIncrease ? null : assertPositiveNumber(body.amount, type === "dividend_tax" ? "股息红利个人所得税" : "分红金额");
  const nav = optionalPositiveNumber(body.nav, "再投净值");
  const shares = optionalPositiveNumber(body.shares, isShareIncrease ? (type === "capital_increase" ? "转增股数" : "送股数量") : "再投份额");

  if (type === "reinvest" && !shares && !nav) {
    throw toHttpError("红利再投需要填写再投份额或再投净值", 400);
  }
  if (isShareIncrease && !shares) {
    throw toHttpError(type === "capital_increase" ? "转增股本需要填写转增股数" : "送股需要填写送股数量", 400);
  }

  return {
    type: type as DividendRecord["type"],
    date,
    amount,
    nav,
    shares: type === "reinvest" ? shares || (nav && amount ? amount / nav : null) : isShareIncrease ? shares : null,
    note: cleanText(body.note),
  };
}

export function createDividend(fundId: number, accountId: number, body: any) {
  const dividend = buildDividendInput(body);
  db.prepare(
    `INSERT INTO dividend_records (account_id, fund_id, dividend_type, dividend_date, amount, dividend_nav, shares, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(accountId, fundId, dividend.type, dividend.date, dividend.amount, dividend.nav || null, dividend.shares || null, dividend.note);
  return dividend;
}

export function updateDividend(id: number, accountId: number, body: any) {
  const current = db
    .prepare("SELECT id, account_id AS accountId, fund_id AS fundId FROM dividend_records WHERE id = ? AND account_id = ?")
    .get(id, accountId) as { id: number; accountId: number; fundId: number } | undefined;
  if (!current) throw toHttpError("分红或公司行为记录不存在", 404);

  const dividend = buildDividendInput(body);
  db.prepare(
    `UPDATE dividend_records
     SET dividend_type = ?, dividend_date = ?, amount = ?, dividend_nav = ?, shares = ?, note = ?
     WHERE id = ?`,
  ).run(dividend.type, dividend.date, dividend.amount, dividend.nav || null, dividend.shares || null, dividend.note, id);
  return { fundId: current.fundId, dividend };
}

export function deleteDividend(id: number, accountId: number) {
  const result = db.prepare("DELETE FROM dividend_records WHERE id = ? AND account_id = ?").run(id, accountId);
  if (result.changes === 0) throw toHttpError("分红或公司行为记录不存在", 404);
}
