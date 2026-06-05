import { toHttpError } from "./httpError";

export function assertDate(value: unknown, label: string) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw toHttpError(`${label}格式应为 YYYY-MM-DD`, 400);
  }
  return text;
}

export function assertPositiveNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw toHttpError(`${label}必须大于 0`, 400);
  }
  return number;
}

export function optionalPositiveNumber(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  return assertPositiveNumber(value, label);
}

export function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function normalizeCode(value: unknown) {
  return cleanText(value).replace(/\D/g, "");
}
