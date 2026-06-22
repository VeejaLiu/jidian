import { db } from "../db/database";
import type { AssetType, ImportedTradeRow, TradeRecord, TradeType } from "../types";
import { getFundById, mapFund } from "./funds";
import { assertTradeTimeline } from "./trades";
import { toHttpError } from "../utils/httpError";
import { assertDate, assertPositiveNumber, cleanText, normalizeAssetCode } from "../utils/validators";

const HEADER_ALIASES: Record<string, string[]> = {
  assetCode: ["code", "ticker", "symbol", "股票代码", "证券代码", "基金代码", "代码"],
  assetName: ["name", "asset", "stock", "fund", "股票名称", "证券名称", "基金名称", "名称"],
  assetType: ["assettype", "type", "品种", "资产类型", "证券类型", "资产"],
  tradeType: ["tradetype", "side", "bs", "买卖方向", "交易方向", "方向", "买卖"],
  date: ["date", "tradedate", "成交日期", "交易日期", "日期"],
  price: ["price", "nav", "成交价", "价格", "单价", "净值"],
  quantity: ["quantity", "shares", "amountshares", "成交数量", "数量", "股数", "份额"],
  amount: ["amount", "成交金额", "金额", "发生金额"],
  note: ["note", "memo", "remark", "备注", "说明"],
};

function normalizeHeader(value: string) {
  return cleanText(value).toLowerCase().replace(/[\s_\-()（）]/g, "");
}

function resolveHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return aliases
    .map((alias) => normalizedHeaders.indexOf(normalizeHeader(alias)))
    .find((index) => index >= 0) ?? -1;
}

function splitRow(line: string) {
  return line.includes("\t") ? line.split("\t") : line.split(",").map((part) => part.trim());
}

function parseTradeType(value: unknown): TradeType {
  const text = cleanText(value).toLowerCase();
  if (["buy", "b", "买入", "买"].includes(text)) return "buy";
  if (["sell", "s", "卖出", "卖"].includes(text)) return "sell";
  throw toHttpError(`无法识别交易方向：${String(value || "")}`, 400);
}

function parseAssetType(value: unknown): AssetType {
  const text = cleanText(value).toLowerCase();
  if (!text) return "stock";
  if (["stock", "股票", "a股", "港股", "美股"].includes(text)) return "stock";
  if (["fund", "基金"].includes(text)) return "fund";
  throw toHttpError(`无法识别资产类型：${String(value || "")}`, 400);
}

function parseRows(input: string): ImportedTradeRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw toHttpError("请至少提供表头和一条成交记录", 400);
  }

  const headers = splitRow(lines[0]);
  const fieldIndex = {
    assetCode: resolveHeaderIndex(headers, HEADER_ALIASES.assetCode),
    assetName: resolveHeaderIndex(headers, HEADER_ALIASES.assetName),
    assetType: resolveHeaderIndex(headers, HEADER_ALIASES.assetType),
    tradeType: resolveHeaderIndex(headers, HEADER_ALIASES.tradeType),
    date: resolveHeaderIndex(headers, HEADER_ALIASES.date),
    price: resolveHeaderIndex(headers, HEADER_ALIASES.price),
    quantity: resolveHeaderIndex(headers, HEADER_ALIASES.quantity),
    amount: resolveHeaderIndex(headers, HEADER_ALIASES.amount),
    note: resolveHeaderIndex(headers, HEADER_ALIASES.note),
  };

  if (fieldIndex.assetCode < 0 || fieldIndex.assetName < 0 || fieldIndex.tradeType < 0 || fieldIndex.date < 0 || fieldIndex.price < 0 || fieldIndex.quantity < 0) {
    throw toHttpError("导入表缺少必要列。至少需要：代码、名称、买卖方向、日期、价格、数量", 400);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitRow(line);
    const price = assertPositiveNumber(cells[fieldIndex.price], `第 ${rowIndex + 2} 行价格`);
    const quantity = assertPositiveNumber(cells[fieldIndex.quantity], `第 ${rowIndex + 2} 行数量`);
    const amount = fieldIndex.amount >= 0
      ? assertPositiveNumber(cells[fieldIndex.amount], `第 ${rowIndex + 2} 行金额`)
      : Number((price * quantity).toFixed(2));

    return {
      assetCode: normalizeAssetCode(cells[fieldIndex.assetCode]),
      assetName: cleanText(cells[fieldIndex.assetName]),
      assetType: fieldIndex.assetType >= 0 ? parseAssetType(cells[fieldIndex.assetType]) : "stock",
      type: parseTradeType(cells[fieldIndex.tradeType]),
      date: assertDate(cells[fieldIndex.date], `第 ${rowIndex + 2} 行日期`),
      price,
      quantity,
      amount,
      note: fieldIndex.note >= 0 ? cleanText(cells[fieldIndex.note]) : "",
    };
  });
}

function ensureAsset(row: ImportedTradeRow, accountId: number) {
  const existing = db
    .prepare(
      `SELECT id
       FROM funds
       WHERE code = ?`,
    )
    .get(row.assetCode) as { id: number } | undefined;

  const assetId = existing?.id
    ?? Number(
      db.prepare(
        `INSERT INTO funds (code, name, asset_type, fund_type)
         VALUES (?, ?, ?, ?)`
      ).run(
        row.assetCode,
        row.assetName || row.assetCode,
        row.assetType,
        row.assetType === "stock" ? "股票" : null,
      ).lastInsertRowid,
    );

  db.prepare(
    `INSERT INTO user_funds (account_id, fund_id, is_active, drop_rate)
     VALUES (?, ?, 1, 0.04)
     ON CONFLICT(account_id, fund_id) DO UPDATE SET is_active = 1`,
  ).run(accountId, assetId);

  if (row.assetType === "fund") {
    db.prepare(
      `INSERT INTO strategy_settings (fund_id, drop_rate)
       VALUES (?, 0.04)
       ON CONFLICT(fund_id) DO NOTHING`,
    ).run(assetId);
  }

  return assetId;
}

function buildImportedTrade(row: ImportedTradeRow): TradeRecord {
  return {
    type: row.type,
    date: row.date,
    nav: row.price,
    amount: row.amount,
    shares: row.quantity,
    status: "confirmed",
    note: row.note || "",
  };
}

export function importTradesFromText(input: string, accountId: number) {
  const rows = parseRows(input);
  const touchedFundIds = new Set<number>();

  const insertTrade = db.prepare(
    `INSERT INTO trade_records (account_id, fund_id, trade_type, trade_date, trade_nav, amount, shares, status, note, confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const transaction = db.transaction(() => {
    rows.forEach((row) => {
      if (!row.assetCode) throw toHttpError("存在空的资产代码，请检查导入内容", 400);
      if (!row.assetName) throw toHttpError(`资产 ${row.assetCode} 缺少名称，请补充名称列`, 400);

      const fundId = ensureAsset(row, accountId);
      const trade = buildImportedTrade(row);
      assertTradeTimeline(fundId, accountId, trade);
      insertTrade.run(
        accountId,
        fundId,
        trade.type,
        trade.date,
        trade.nav,
        trade.amount,
        trade.shares,
        trade.status,
        trade.note,
        new Date().toISOString(),
      );
      touchedFundIds.add(fundId);
    });
  });

  transaction();

  const importedFunds = Array.from(touchedFundIds).map((fundId) => mapFund(getFundById(fundId, { accountId, includeHidden: true }), accountId));
  return {
    imported: rows.length,
    assets: importedFunds.length,
    funds: importedFunds,
  };
}
