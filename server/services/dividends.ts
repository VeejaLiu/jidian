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
  if (!["cash", "reinvest"].includes(type)) {
    throw toHttpError("分红类型必须是现金分红或红利再投", 400);
  }

  const date = assertDate(body.date, "分红日期");
  const amount = assertPositiveNumber(body.amount, "分红金额");
  const nav = optionalPositiveNumber(body.nav, "再投净值");
  const shares = optionalPositiveNumber(body.shares, "再投份额");

  if (type === "reinvest" && !shares && !nav) {
    throw toHttpError("红利再投需要填写再投份额或再投净值", 400);
  }

  return {
    type: type as "cash" | "reinvest",
    date,
    amount,
    nav,
    shares: type === "reinvest" ? shares || (nav ? amount / nav : null) : null,
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
