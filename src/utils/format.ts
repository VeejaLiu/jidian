import type { TradeType } from "../types/fund";

export function formatNav(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : "--";
}

export function formatPercent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : "--";
}

export function formatSignedPercent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (Math.abs(number) < 0.005) return "0.00%";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export function formatDateTime(value: unknown) {
  if (!value) return "--";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatMoney(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "--";
}

export function formatShares(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "--";
}

export function formatUnits(value: unknown, assetType?: string | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return assetType === "stock" ? number.toFixed(0) : number.toFixed(2);
}

export function tradeTypeLabel(type?: TradeType | string | null) {
  return type === "sell" ? "卖出" : "买入";
}

export function formatChartDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value || "");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
